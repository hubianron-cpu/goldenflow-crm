import { NextResponse } from "next/server";
import { calendarDisconnectContext, expenseError } from "@/lib/expenses/access";
import { disconnectCalendar } from "@/lib/calendar/server";

export async function POST(request: Request) {
  try {
    const context = await calendarDisconnectContext(request);
    if (context.error) return context.error;
    const disconnected = await disconnectCalendar(context.user.id);
    return NextResponse.json({ ok: true, disconnected });
  } catch { return expenseError(); }
}
