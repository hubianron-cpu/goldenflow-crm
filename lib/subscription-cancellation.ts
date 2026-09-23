const jerusalemFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function canReactivateFromGrowPayment(
  cancelledAt: string | null,
  existingMandateId: string | null,
  incomingMandateId: string,
) {
  if (!cancelledAt) return true;
  return Boolean(existingMandateId && incomingMandateId && existingMandateId !== incomingMandateId);
}

export function updatedGrowMandateId(existingMandateId: string | null, incomingMandateId: string) {
  return incomingMandateId || existingMandateId;
}

export function toJerusalemUtcIso(localValue: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localValue);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const wallTimeUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  if (!Number.isFinite(wallTimeUtc)) return null;

  // Reject nonexistent and repeated wall-clock times around daylight-saving transitions.
  const matches = [2, 3].map((offsetHours) => wallTimeUtc - offsetHours * 60 * 60 * 1000).filter((candidate) => {
    const parts = Object.fromEntries(jerusalemFormatter.formatToParts(new Date(candidate)).map(({ type, value }) => [type, value]));
    return parts.year === year && parts.month === month && parts.day === day &&
      parts.hour === hour && parts.minute === minute;
  });

  return matches.length === 1 ? new Date(matches[0]).toISOString() : null;
}
