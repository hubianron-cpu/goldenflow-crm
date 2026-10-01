$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot '..\scripts\preview-backup-retention.ps1'
$testDirectory = Join-Path ([IO.Path]::GetTempPath()) ("goldenflow-retention-test-{0}" -f [Guid]::NewGuid().ToString('N'))
$externalDirectory = Join-Path $testDirectory 'external'
$null = New-Item -ItemType Directory -Path $testDirectory

try {
  $oldStamp = [DateTime]::UtcNow.AddDays(-8).ToString('yyyyMMddTHHmmss')
  $newStamp = [DateTime]::UtcNow.AddHours(-1).ToString('yyyyMMddTHHmmss')
  $oldName = "goldenflow-production-${oldStamp}Z.gfbackup"
  $newName = "goldenflow-production-${newStamp}Z.gfbackup"
  $oldPath = Join-Path $testDirectory $oldName
  $newPath = Join-Path $testDirectory $newName
  [IO.File]::WriteAllBytes($oldPath, [byte[]]@(1, 2, 3))
  [IO.File]::WriteAllBytes($newPath, [byte[]]@(4, 5, 6))

  $blocked = $false
  try {
    $null = & $scriptPath -BackupDirectory $testDirectory
  } catch {
    $blocked = $_.Exception.Message -like '*No recently restored backup*'
  }
  if (-not $blocked) { throw 'Pruning was not blocked without a verified recent restore.' }

  $reportPath = Join-Path $testDirectory "restore-check-$([IO.Path]::GetFileNameWithoutExtension($newName)).json"
  @{ backup_name = $newName; ok = $true; checked_at_utc = [DateTime]::UtcNow.ToString('o') } |
    ConvertTo-Json | Set-Content -LiteralPath $reportPath
  $result = @(& $scriptPath -BackupDirectory $testDirectory)
  if (-not ($result -contains 'Expired backup count: 1')) { throw 'Expected one expired backup.' }
  if (-not ($result -contains "DRY_RUN $oldName")) { throw 'Expected a dry-run listing for the old backup.' }
  if (-not (Test-Path -LiteralPath $oldPath) -or -not (Test-Path -LiteralPath $newPath)) {
    throw 'Dry run removed a backup.'
  }

  $null = New-Item -ItemType Directory -Path $externalDirectory
  Copy-Item -LiteralPath $oldPath -Destination (Join-Path $externalDirectory $oldName)
  $withCopy = @(& $scriptPath -BackupDirectory $testDirectory -AdditionalCopiesDirectory $externalDirectory)
  if (-not ($withCopy -contains 'Known additional copy count: 1') -or
      -not ($withCopy -contains 'Unmanaged expired copy count: 1')) {
    throw 'Dry run did not report the unmanaged expired copy.'
  }
  $blocked = $false
  try {
    $null = & $scriptPath -BackupDirectory $testDirectory -AdditionalCopiesDirectory $externalDirectory -Apply
  } catch {
    $blocked = $_.Exception.Message -like '*expired copy exists outside*'
  }
  if (-not $blocked -or -not (Test-Path -LiteralPath $oldPath)) {
    throw 'Apply was not blocked by an unmanaged expired copy.'
  }
  Remove-Item -LiteralPath (Join-Path $externalDirectory $oldName)

  $blocked = $false
  try {
    $null = & $scriptPath -BackupDirectory $testDirectory -Apply
  } catch {
    $blocked = $_.Exception.Message -like '*explicit additional-copies directory*'
  }
  if (-not $blocked -or -not (Test-Path -LiteralPath $oldPath)) {
    throw 'Apply was not blocked without an explicit copy inventory.'
  }

  @{ backup_name = $newName; ok = $false; checked_at_utc = [DateTime]::UtcNow.ToString('o') } |
    ConvertTo-Json | Set-Content -LiteralPath $reportPath
  $blocked = $false
  try {
    $null = & $scriptPath -BackupDirectory $testDirectory
  } catch {
    $blocked = $_.Exception.Message -like '*No recently restored backup*'
  }
  if (-not $blocked) { throw 'Pruning was not blocked by a failed restore report.' }

  @{ backup_name = $newName; ok = $true; checked_at_utc = [DateTime]::UtcNow.ToString('o') } |
    ConvertTo-Json | Set-Content -LiteralPath $reportPath
  $start = [Diagnostics.ProcessStartInfo]::new((Join-Path $PSHOME 'pwsh.exe'))
  $start.ArgumentList.Add('-NoProfile')
  $start.ArgumentList.Add('-File')
  $start.ArgumentList.Add($scriptPath)
  $start.ArgumentList.Add('-BackupDirectory')
  $start.ArgumentList.Add($testDirectory)
  $start.ArgumentList.Add('-Apply')
  $start.ArgumentList.Add('-AdditionalCopiesDirectory')
  $start.ArgumentList.Add($externalDirectory)
  $start.UseShellExecute = $false
  $start.RedirectStandardInput = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $process = [Diagnostics.Process]::Start($start)
  try {
    $process.StandardInput.WriteLine('DELETE')
    $process.StandardInput.Close()
    if (-not $process.WaitForExit(15000)) {
      $process.Kill()
      throw 'Synthetic apply test timed out.'
    }
    $output = $process.StandardOutput.ReadToEnd()
    $errorOutput = $process.StandardError.ReadToEnd()
    if ($process.ExitCode -ne 0 -or $output -notlike "*DELETED $oldName*") {
      throw "Synthetic apply failed: $errorOutput"
    }
    if ((Test-Path -LiteralPath $oldPath) -or -not (Test-Path -LiteralPath $newPath)) {
      throw 'Apply did not delete exactly the expired synthetic backup.'
    }
  } finally {
    $process.Dispose()
  }

  Write-Output 'BACKUP_RETENTION_TEST=PASS'
} finally {
  if (Test-Path -LiteralPath $externalDirectory) {
    Get-ChildItem -LiteralPath $externalDirectory -File | Remove-Item -Force
    Remove-Item -LiteralPath $externalDirectory
  }
  Get-ChildItem -LiteralPath $testDirectory -File | Remove-Item -Force
  Remove-Item -LiteralPath $testDirectory
}
