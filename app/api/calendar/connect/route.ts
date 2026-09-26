import { NextResponse } from "next/server";
import { expenseContext, expenseError } from "@/lib/expenses/access";
import { calendarAccessAllowed } from "@/lib/calendar/access";
import { calendarConfig, startConnection } from "@/lib/calendar/server";

export async function POST(request: Request) {
  try {
    const context = await expenseContext(request);
    if (context.error) return context.error;
    if (!calendarAccessAllowed(context.user.id)) return expenseError(403, "חיבור היומן זמין כרגע רק לחשבונות בדיקה מורשים.");
    const config = calendarConfig();
    if (!config) return expenseError(503, "חיבור Google Calendar עדיין אינו זמין. אפשר להוסיף הוצאות ידנית.");
    if (new URL(config.redirectUri).origin !== new URL(request.url).origin) return expenseError(503, "חיבור היומן אינו מוגדר לסביבה הזו.");
    const { state, url } = await startConnection(context.user.id);
    const response = NextResponse.redirect(url, 303);
    response.cookies.set("gf-calendar-state", state, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/api/calendar", maxAge: 600 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch { return expenseError(); }
}
