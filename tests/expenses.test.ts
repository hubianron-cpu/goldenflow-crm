import assert from "node:assert/strict";
import test from "node:test";
import { addDays, dateKey, forecast, isMeetingTitle, midnight, normalizeEvents, parseAmount, parseExpenseTitle, periodBounds, weeklyMeetings, type ExpenseData } from "../lib/expenses/model";
import { decryptToken, encryptToken } from "../lib/calendar/crypto";

const empty: ExpenseData = { today: "2026-09-20", timeZone: "Asia/Jerusalem", manual: [], events: [], connection: { configured: false, connected: false, reconnect: false, stale: false, lastSync: null } };
test("explicit ILS titles only, exact integer agorot, conservative ambiguity rejection", () => {
  for (const title of ['₪500', '500₪', '500 ₪', '500 ש"ח', '500 ש״ח', '500 שקל', 'רואה חשבון - 500 ₪']) assert.equal(parseExpenseTitle(title), 50000, title);
  for (const title of ['1,500 ₪', '1500 ₪', 'Meta Ads - ₪1,500']) assert.equal(parseExpenseTitle(title), 150000, title);
  assert.equal(parseExpenseTitle("Vercel 70₪"), 7000);
  assert.equal(parseExpenseTitle("ספק - 1200 ש\"ח"), 120000);
  assert.equal(parseExpenseTitle("פרסום - 2,000 שקל"), 200000);
  assert.equal(parseExpenseTitle("99.99 ₪"), 9999);
  for (const title of ['15:00', '2027', 'לקוח 500', 'פגישה 300', '12,34 ₪', '500.999 ₪', '-500 ₪', '500 ₪ + 100 ₪', '0 ₪', '500 דולר']) assert.equal(parseExpenseTitle(title), null, title);
  assert.equal(parseAmount("0.01"), 1);
  assert.equal(parseAmount("1e3"), null);
});
test("meeting classification uses whole Hebrew keywords and punctuation, not AI", () => {
  for (const title of ["פגישה עם דנה", "פגישת ייעוץ", "פגישה - לקוח חדש", "(פגישה)", "פגישת מכירה", "פגישה בזום"]) assert.equal(isMeetingTitle(title), true, title);
  for (const title of ["עבודה על האתר", "אימון", "תזכורת להתקשר", "Meta Ads - 1,500 ₪", "רופא", "פגישות", "מפגישה"]) assert.equal(isMeetingTitle(title), false, title);
});
const timed = (id: string, title: string, start = "2026-09-21T10:00:00+03:00", end = "2026-09-21T11:00:00+03:00") => ({ id, summary: title, start: { dateTime: start }, end: { dateTime: end } });
test("one event can feed both consumers; duplicates and cancelled/all-day meetings excluded", () => {
  const event = { ...timed("one", "פגישה עם רואה חשבון - 500 ₪"), iCalUID: "one@calendar" };
  const events = normalizeEvents([event, event, { ...event, id: "copy" }, { ...event, id: "cancelled", status: "cancelled" }, { id: "day", summary: "פגישה 100 ₪", start: { date: "2026-09-21" }, end: { date: "2026-09-22" } }], empty.timeZone);
  assert.equal(events.length, 2);
  assert.equal(weeklyMeetings({ ...empty, events }).weeklyMeetingCount, 1);
  assert.equal(weeklyMeetings({ ...empty, events }).weeklyMeetingMinutes, 60);
  assert.equal(forecast({ ...empty, events }, "week").total, 60000);
});
test("recurring occurrences remain distinct while synchronized copies do not", () => {
  const events = normalizeEvents([
    { ...timed("recurring_1", "פגישה"), iCalUID: "series" },
    { ...timed("recurring_2", "פגישה", "2026-09-22T10:00:00+03:00", "2026-09-22T11:00:00+03:00"), iCalUID: "series" },
  ], empty.timeZone);
  assert.equal(weeklyMeetings({ ...empty, events }).weeklyMeetingCount, 2);
});
test("weekly minutes, outside-week exclusions and boundary clipping", () => {
  const events = normalizeEvents(Array.from({ length: 8 }, (_, i) => timed(String(i), "פגישה", "2026-09-21T10:00:00+03:00", i === 7 ? "2026-09-21T11:15:00+03:00" : "2026-09-21T10:45:00+03:00")), empty.timeZone);
  assert.deepEqual(weeklyMeetings({ ...empty, events }), { weeklyMeetingCount: 8, weeklyMeetingMinutes: 390 });
  const crossing = normalizeEvents([timed("cross", "פגישה", "2026-09-26T23:30:00+03:00", "2026-09-27T01:00:00+03:00"), timed("outside", "פגישה", "2026-09-27T10:00:00+03:00", "2026-09-27T11:00:00+03:00")], empty.timeZone);
  assert.deepEqual(weeklyMeetings({ ...empty, events: crossing }), { weeklyMeetingCount: 1, weeklyMeetingMinutes: 30 });
});
test("forecast periods exclude past, paid, cancelled and preserve manual expenses", () => {
  const manual = [
    { id: "a", title: "QA", amount_agorot: 10001, due_date: "2026-09-20", status: "planned" as const, category: "", notes: "" },
    { id: "b", title: "QA", amount_agorot: 20002, due_date: "2026-09-28", status: "planned" as const, category: "", notes: "" },
  ];
  const data: ExpenseData = { ...empty, manual: [...manual, { ...manual[0], id: "c", status: "paid" }, { ...manual[0], id: "d", status: "cancelled" }, { ...manual[0], id: "e", due_date: "2026-09-19" }] };
  assert.equal(forecast(data, "week").total, 10001);
  assert.equal(forecast(data, "month").total, 30003);
  assert.equal(periodBounds(empty.today, "30").end, "2026-10-20");
  assert.equal(periodBounds(empty.today, "90").end, "2026-12-19");
  assert.equal(periodBounds("2026-12-30", "month").end, "2027-01-01");
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
});
test("Jerusalem DST boundaries use actual offset, not 24-hour assumptions", () => {
  assert.equal(midnight("2026-03-28") - midnight("2026-03-27"), 23 * 3600000);
  assert.equal(midnight("2026-10-26") - midnight("2026-10-25"), 25 * 3600000);
  assert.equal(dateKey(new Date("2026-09-19T22:00:00Z")), "2026-09-20");
});
test("removed amount/title and cancelled events stop contributing; invalid duration ignored", () => {
  assert.equal(normalizeEvents([timed("x", "רואה חשבון")], empty.timeZone).length, 0);
  const meetingOnly = normalizeEvents([timed("x", "פגישה")], empty.timeZone);
  assert.equal(forecast({ ...empty, events: meetingOnly }, "week").total, 0);
  assert.equal(normalizeEvents([timed("x", "פגישה", "bad", "bad")], empty.timeZone).length, 0);
});
test("encrypted refresh tokens reject cross-owner access and tampering", () => {
  const key = Buffer.alloc(32, 7);
  const cipher = encryptToken("synthetic-refresh-token", "qa-a", key);
  assert.equal(decryptToken(cipher, "qa-a", key), "synthetic-refresh-token");
  assert.throws(() => decryptToken(cipher, "qa-b", key));
  assert.throws(() => decryptToken(cipher.slice(0, -3) + "xxx", "qa-a", key));
  assert.ok(!cipher.includes("synthetic"));
});
