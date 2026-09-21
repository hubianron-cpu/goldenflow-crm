import { NextResponse } from "next/server";
import { expenseContext, expenseError } from "@/lib/expenses/access";
import { disconnectCalendar } from "@/lib/calendar/server";

export async function POST(request: Request) {
  try {
    const context = await expenseContext(request);
    if (context.error) return context.error;
    await disconnectCalendar(context.user.id);
    return NextResponse.json({ ok: true });
  } catch { return expenseError(); }
}
