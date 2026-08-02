const VERIFIED_WON_STATUSES = new Set([
  "נסגר בהצלחה",
  "נסגר",
  "won",
]);

export function calculatePercentage(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
) {
  if (
    numerator === null ||
    numerator === undefined ||
    denominator === null ||
    denominator === undefined ||
    denominator <= 0
  ) {
    return null;
  }

  const percentage = (numerator / denominator) * 100;
  return Number.isFinite(percentage) ? percentage : null;
}

export function isBusinessCenterWonStatus(
  status: string | null | undefined,
) {
  const cleanStatus = (status ?? "").trim().toLowerCase();
  return VERIFIED_WON_STATUSES.has(cleanStatus);
}
