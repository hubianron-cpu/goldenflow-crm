export type ExpenseStatus = "planned" | "paid" | "cancelled";
export type Period = "week" | "month" | "30" | "90";
export type ManualExpense = {
  id: string; title: string; amount_agorot: number; due_date: string;
  status: ExpenseStatus; category: string; notes: string;
};
export type CalendarEvent = {
  event_id: string; title: string; starts_at: string | null; ends_at: string | null;
  event_date: string; all_day: boolean; amount_agorot: number | null; is_meeting: boolean;
  expense_status: ExpenseStatus;
};
export type ExpenseItem = {
  id: string; title: string; amount_agorot: number; due_date: string;
  source: "manual" | "google_calendar"; status: ExpenseStatus;
};
export type ExpenseData = {
  manual: ManualExpense[]; events: CalendarEvent[]; today: string; timeZone: string;
  connection: { connected: boolean; reconnect: boolean; lastSync: string | null; configured: boolean; stale: boolean };
};

export const DEFAULT_TIME_ZONE = "Asia/Jerusalem";
export function dateKey(date: Date, timeZone = DEFAULT_TIME_ZONE) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function addDays(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function weekBounds(today: string) {
  const start = addDays(today, -new Date(`${today}T12:00:00Z`).getUTCDay());
  return { start, end: addDays(start, 7) };
}
export function periodBounds(today: string, period: Period) {
  if (period === "week") return { start: today, end: weekBounds(today).end };
  if (period === "month") {
    const date = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + 1);
    return { start: today, end: date.toISOString().slice(0, 10) };
  }
  return { start: today, end: addDays(today, Number(period)) };
}

// Resolve midnight in the business timezone without assuming a fixed UTC offset (DST).
export function midnight(key: string, timeZone = DEFAULT_TIME_ZONE) {
  const target = Date.parse(`${key}T00:00:00Z`);
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess)).map(p => [p.type, p.value]));
    const represented = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    if (target === represented) break;
    guess += target - represented;
  }
  return guess;
}

export function parseAmount(value: string): number | null {
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.replaceAll(",", "").split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 100_000_000_00 ? amount : null;
}

// Reject ambiguous titles (multiple prices, malformed numbers, negative amounts).
export function parseExpenseTitle(title: string): number | null {
  const currency = '(?:₪|ש["״]ח|שקל(?:ים)?)';
  const number = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?';
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}.,])(?:${currency}\\s*(${number})|(${number})\\s*${currency})(?![\\p{L}\\p{N}.,])`, "gu");
  const matches = [...title.matchAll(pattern)];
  if (matches.length !== 1) return null;
  const match = matches[0];
  if (/(?:^|\s)-$/.test(title.slice(0, match.index)) || title.includes("−")) return null;
  return parseAmount(match[1] ?? match[2]);
}
export function isMeetingTitle(title: string) {
  return /(?:^|[^\p{L}\p{N}])(?:פגישה|פגישת)(?=$|[^\p{L}\p{N}])/iu.test(title.normalize("NFKC"));
}
export type GoogleEvent = {
  id?: string; iCalUID?: string; summary?: string; status?: string;
  start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string };
};
export function normalizeEvents(events: GoogleEvent[], timeZone: string): CalendarEvent[] {
  const seen = new Set<string>();
  return events.flatMap(event => {
    if (!event.id || event.status === "cancelled" || !event.start || !event.end) return [];
    const timed = Boolean(event.start.dateTime && event.end.dateTime);
    const start = timed ? Date.parse(event.start.dateTime!) : NaN;
    const end = timed ? Date.parse(event.end.dateTime!) : NaN;
    if (timed ? !Number.isFinite(start) || !Number.isFinite(end) || end <= start : !validDate(event.start.date)) return [];
    const identity = `${event.iCalUID || event.id}:${timed ? start : event.start.date}`;
    if (seen.has(identity)) return [];
    seen.add(identity);
    const title = (event.summary ?? "").slice(0, 1000);
    const amount = parseExpenseTitle(title);
    const meeting = timed && isMeetingTitle(title);
    if (amount === null && !meeting) return [];
    return [{ event_id: event.id, title, starts_at: timed ? new Date(start).toISOString() : null,
      ends_at: timed ? new Date(end).toISOString() : null, all_day: !timed,
      event_date: timed ? dateKey(new Date(start), timeZone) : event.start.date!,
      amount_agorot: amount, is_meeting: meeting, expense_status: "planned" as const }];
  });
}
export function forecast(data: ExpenseData, period: Period) {
  const { start, end } = periodBounds(data.today, period);
  const items: ExpenseItem[] = [
    ...data.manual.map(e => ({ ...e, source: "manual" as const })),
    ...data.events.filter(e => e.amount_agorot !== null).map(e => ({ id: e.event_id, title: e.title, due_date: e.event_date, amount_agorot: e.amount_agorot!, status: e.expense_status, source: "google_calendar" as const })),
  ];
  const upcoming = items.filter(e => e.status === "planned" && e.due_date >= start && e.due_date < end).sort((a,b) => a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title));
  return { upcoming, total: upcoming.reduce((sum, e) => sum + e.amount_agorot, 0) };
}
export function weeklyMeetings(data: ExpenseData) {
  const bounds = weekBounds(data.today);
  const start = midnight(bounds.start, data.timeZone), end = midnight(bounds.end, data.timeZone);
  const meetings = data.events.filter(e => e.is_meeting && !e.all_day && e.starts_at && e.ends_at && Date.parse(e.starts_at) < end && Date.parse(e.ends_at) > start);
  const minutes = meetings.reduce((sum,e) => sum + Math.max(0, Math.min(end, Date.parse(e.ends_at!)) - Math.max(start, Date.parse(e.starts_at!))) / 60000, 0);
  return { weeklyMeetingCount: meetings.length, weeklyMeetingMinutes: Math.round(minutes) };
}
export const formatMoney = (agorot: number) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: agorot % 100 ? 2 : 0 }).format(agorot / 100);
export const formatDate = (date: string) => new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
