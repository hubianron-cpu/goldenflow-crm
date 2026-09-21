import { NextResponse } from "next/server";
import { expenseContext, expenseError } from "@/lib/expenses/access";
import { calendarAdmin, calendarConfig, readConnection } from "@/lib/calendar/server";
import { addDays, dateKey, DEFAULT_TIME_ZONE, parseAmount, validDate, type CalendarEvent, type ExpenseData, type ManualExpense } from "@/lib/expenses/model";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const manualFields = "id,title,amount_agorot,due_date,status,category,notes";
const eventFields = "event_id,title,starts_at,ends_at,event_date,all_day,amount_agorot,is_meeting,expense_status";
export async function GET() {
  try {
    const context = await expenseContext();
    if (context.error) return context.error;
    const { supabase, user } = context;
    const manual: ManualExpense[] = [], events: CalendarEvent[] = [];
    let connection = null, calendarUnavailable = false;
    try { connection = await readConnection(user.id); } catch { calendarUnavailable = true; }
    for (let page = 0; page < 21; page++) {
      const { data, error } = await supabase.from("manual_expenses").select(manualFields).eq("user_id", user.id).order("id").range(page * 500, page * 500 + 499);
      if (error || (page === 20 && data?.length)) return expenseError(503, "ניהול ההוצאות אינו זמין כרגע. נסה שוב מאוחר יותר.");
      manual.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    if (connection?.token_ciphertext && connection.last_synced_at && !connection.reconnect_required) {
      for (let page = 0; page < 21; page++) {
        const { data, error } = await supabase.from("google_calendar_events").select(eventFields).eq("user_id", user.id).order("event_id").range(page * 500, page * 500 + 499);
        if (error || (page === 20 && data?.length)) { calendarUnavailable = true; events.length = 0; break; }
        events.push(...(data ?? []));
        if (!data || data.length < 500) break;
      }
    }
    const timeZone = connection?.time_zone ?? DEFAULT_TIME_ZONE;
    const today = dateKey(new Date(), timeZone);
    const result: ExpenseData = { manual, events, today, timeZone, connection: {
      connected: Boolean(connection?.token_ciphertext), reconnect: Boolean(connection?.reconnect_required),
      lastSync: connection?.last_synced_at ?? null, configured: Boolean(calendarConfig()),
      stale: calendarUnavailable || Boolean(connection?.token_ciphertext && (!connection.last_synced_at || Date.now() - Date.parse(connection.last_synced_at) > 86400000 || !connection.sync_until || connection.sync_until < addDays(today, 90))),
    } };
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return expenseError(); }
}
async function mutate(request: Request) {
  try {
    const context = await expenseContext(request);
    if (context.error) return context.error;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || typeof body.id !== "string") return expenseError(400);
    if (body.source === "google_calendar") {
      if (request.method !== "PATCH" || !["planned", "paid", "cancelled"].includes(body.status) || body.id.length > 1024) return expenseError(400);
      const { data, error } = await calendarAdmin().from("google_calendar_events").update({ expense_status: body.status }).eq("user_id", context.user.id).eq("event_id", body.id).select("event_id").maybeSingle();
      return error ? expenseError() : !data ? expenseError(404) : NextResponse.json({ ok: true });
    }
    if (!uuid.test(body.id)) return expenseError(400);
    const table = context.supabase.from("manual_expenses");
    if (request.method === "DELETE") {
      const { data, error } = await table.delete().eq("id", body.id).eq("user_id", context.user.id).select("id").maybeSingle();
      return error ? expenseError() : !data ? expenseError(404) : NextResponse.json({ ok: true });
    }
    const status = body.status ?? "planned";
    if (!["planned", "paid", "cancelled"].includes(status)) return expenseError(400);
    if (request.method === "PATCH" && body.title === undefined) {
      const { data, error } = await table.update({ status, updated_at: new Date().toISOString() }).eq("id", body.id).eq("user_id", context.user.id).select("id").maybeSingle();
      return error ? expenseError() : !data ? expenseError(404) : NextResponse.json({ ok: true });
    }
    const amount = typeof body.amount === "string" ? parseAmount(body.amount) : null;
    if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 160 || !amount || !validDate(body.due_date) ||
      typeof body.category !== "string" || body.category.length > 80 || typeof body.notes !== "string" || body.notes.length > 1000) return expenseError(400, "יש להזין שם, סכום חיובי ותאריך תקין.");
    const payload = { title: body.title.trim(), amount_agorot: amount, due_date: body.due_date, category: body.category.trim(), notes: body.notes.trim(), status, updated_at: new Date().toISOString() };
    const query = request.method === "POST" ? table.insert({ ...payload, id: body.id, user_id: context.user.id }) : table.update(payload).eq("id", body.id).eq("user_id", context.user.id);
    const { data, error } = await query.select("id").maybeSingle();
    if (error?.code === "23505") return expenseError(409, "ההוצאה כבר נשמרה. רענן את הרשימה לפני ניסיון נוסף.");
    return error ? expenseError() : !data ? expenseError(404) : NextResponse.json({ ok: true }, { status: request.method === "POST" ? 201 : 200 });
  } catch { return expenseError(); }
}
export const POST = mutate;
export const PATCH = mutate;
export const DELETE = mutate;
