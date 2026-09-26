import "server-only";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function calendarAccessAllowed(userId: string) {
  if (!uuid.test(userId)) return false;
  const mode = process.env.GOOGLE_CALENDAR_ACCESS_MODE;
  if (mode === "public") return true;
  if (mode !== "qa") return false;
  return (process.env.GOOGLE_CALENDAR_QA_USER_IDS ?? "")
    .split(",")
    .some(id => id.trim().toLowerCase() === userId.toLowerCase());
}
