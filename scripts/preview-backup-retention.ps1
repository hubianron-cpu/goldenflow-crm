param(
  [Parameter(Mandatory = $true)]
  [ValidateScript({ Test-Path -LiteralPath $_ -PathType Container })]
  [string] $BackupDirectory,

  [string] $AdditionalCopiesDirectory = '',

  [switch] $Apply
)

$ErrorActionPreference = 'Stop'
$directory = (Get-Item -LiteralPath $BackupDirectory).FullName
if ((Get-Item -LiteralPath $directory).Attributes -band [IO.FileAttributes]::ReparsePoint) {
  throw 'Backup directory must not be a symlink or junction.'
}
if ($Apply -and -not $AdditionalCopiesDirectory) {
  throw 'Apply requires an explicit additional-copies directory; inventory all known copies first.'
}

$now = [DateTime]::UtcNow
$cutoff = $now.AddDays(-7)
$backups = @(Get-ChildItem -LiteralPath $directory -File -Filter 'goldenflow-production-*.gfbackup' | ForEach-Object {
  if ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw "Backup path must not be a symlink: $($_.Name)"
  }
  if ($_.Name -notmatch '^goldenflow-production-(?<stamp>\d{8}T\d{6})Z\.gfbackup$') {
    throw "Unexpected backup filename: $($_.Name)"
  }
  $created = [DateTime]::SpecifyKind(
    [DateTime]::ParseExact($Matches.stamp, 'yyyyMMddTHHmmss', [Globalization.CultureInfo]::InvariantCulture),
    [DateTimeKind]::Utc
  )
  [pscustomobject]@{ File = $_; CreatedUtc = $created }
} | Sort-Object CreatedUtc -Descending)

if ($backups.Count -eq 0) { throw 'No Production backups found; nothing can be pruned.' }

$verified = @($backups | Where-Object {
  $reportPath = Join-Path $directory "restore-check-$($_.File.BaseName).json"
  if (-not (Test-Path -LiteralPath $reportPath -PathType Leaf)) {
    Write-Verbose "No restore check for $($_.File.Name)"
    return $false
  }
  $report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
  if ($report.backup_name -cne $_.File.Name -or $report.ok -cne $true) {
    Write-Verbose "Restore check did not pass for $($_.File.Name)"
    return $false
  }
  $checked = if ($report.checked_at_utc -is [DateTime]) {
    $report.checked_at_utc.ToUniversalTime()
  } else {
    [DateTimeOffset]::Parse([string] $report.checked_at_utc, [Globalization.CultureInfo]::InvariantCulture).UtcDateTime
  }
  if ($checked -lt $_.File.LastWriteTimeUtc -or $checked -gt $now) {
    Write-Verbose "Restore check is stale for $($_.File.Name): checked=$($checked.ToString('o')), file=$($_.File.LastWriteTimeUtc.ToString('o')), now=$($now.ToString('o'))"
  }
  $checked -ge $_.File.LastWriteTimeUtc -and $checked -le $now
})

$protected = $verified | Where-Object { $_.CreatedUtc -gt $cutoff } | Select-Object -First 1
if (-not $protected) {
  throw 'No recently restored backup is available. Do not prune until a new isolated restore passes.'
}

$expired = @($backups | Where-Object { $_.CreatedUtc -le $cutoff -and $_.File.FullName -cne $protected.File.FullName })
$additionalDirectory = $AdditionalCopiesDirectory
if (-not $additionalDirectory -and $env:LOCALAPPDATA -and $env:OneDrive) {
  $productionDirectory = Join-Path $env:LOCALAPPDATA 'GoldenFlowBackups'
  if ($directory -ieq $productionDirectory) {
    $additionalDirectory = Join-Path $env:OneDrive 'Desktop\GoldenFlowBackups'
  }
}

$knownCopies = @()
if ($additionalDirectory) {
  if (-not (Test-Path -LiteralPath $additionalDirectory -PathType Container)) {
    throw "Known-copy directory is unavailable: $additionalDirectory"
  }
  $copyDirectory = (Get-Item -LiteralPath $additionalDirectory).FullName
  if ($copyDirectory -ieq $directory) { throw 'Known-copy directory must differ from backup directory.' }
  if ((Get-Item -LiteralPath $copyDirectory).Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw 'Known-copy directory must not be a symlink or junction.'
  }
  $knownCopies = @(Get-ChildItem -LiteralPath $copyDirectory -File -Filter 'goldenflow-production-*.gfbackup' | ForEach-Object {
    if ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) {
      throw "Known-copy path must not be a symlink: $($_.Name)"
    }
    if ($_.Name -notmatch '^goldenflow-production-(?<stamp>\d{8}T\d{6})Z\.gfbackup$') {
      throw "Unexpected known-copy filename: $($_.Name)"
    }
    $created = [DateTime]::SpecifyKind(
      [DateTime]::ParseExact($Matches.stamp, 'yyyyMMddTHHmmss', [Globalization.CultureInfo]::InvariantCulture),
      [DateTimeKind]::Utc
    )
    [pscustomobject]@{ File = $_; CreatedUtc = $created }
  })
}
$unmanagedExpired = @($knownCopies | Where-Object { $_.CreatedUtc -le $cutoff })
Write-Output "Retention cutoff (UTC): $($cutoff.ToString('o'))"
Write-Output "Protected restored backup: $($protected.File.Name)"
Write-Output "Expired backup count: $($expired.Count)"
Write-Output "Known additional copy count: $($knownCopies.Count)"
Write-Output "Unmanaged expired copy count: $($unmanagedExpired.Count)"
foreach ($entry in $knownCopies) { Write-Output "KNOWN_COPY $($entry.File.Name)" }
if ($Apply -and $unmanagedExpired.Count -gt 0) {
  throw 'An expired copy exists outside the managed backup directory. Reconcile it before applying local pruning.'
}

foreach ($entry in $expired) {
  if (-not $Apply) {
    Write-Output "DRY_RUN $($entry.File.Name)"
    continue
  }
  $answer = Read-Host "Permanently delete $($entry.File.Name)? Type DELETE"
  if ($answer -cne 'DELETE') { throw 'Deletion cancelled; no further files were touched.' }
  Remove-Item -LiteralPath $entry.File.FullName -Force
  Write-Output "DELETED $($entry.File.Name)"
}
