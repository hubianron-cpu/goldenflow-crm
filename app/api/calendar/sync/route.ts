import { NextResponse } from "next/server";
import { expenseContext, expenseError } from "@/lib/expenses/access";
import { syncCalendar } from "@/lib/calendar/server";

export async function POST(request: Request) {
  try {
    const context = await expenseContext(request);
    if (context.error) return context.error;
    await syncCalendar(context.user.id);
    return NextResponse.json({ ok: true });
  } catch { return expenseError(503, "לא הצלחנו לסנכרן את היומן. הנתונים הידניים נשמרו. נסה שוב או חבר את היומן מחדש."); }
}
