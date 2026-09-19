import { NextRequest, NextResponse } from "next/server";
import { expenseContext } from "@/lib/expenses/access";
import { finishConnection, syncCalendar } from "@/lib/calendar/server";

export async function GET(request: NextRequest) {
  let outcome = "failed";
  try {
    const context = await expenseContext();
    const state = request.nextUrl.searchParams.get("state");
    const code = request.nextUrl.searchParams.get("code");
    const browserState = request.cookies.get("gf-calendar-state")?.value;
    if (!context.error && state && state.length <= 128 && state === browserState && code && code.length <= 4096 && !request.nextUrl.searchParams.has("error")) {
      await finishConnection(context.user.id, code, state);
      outcome = "sync_failed";
      await syncCalendar(context.user.id);
      outcome = "connected";
    }
  } catch { /* Return only a fixed public outcome, never provider error details. */ }
  const response = NextResponse.redirect(new URL(`/expenses?calendar=${outcome}`, request.url), 303);
  response.cookies.set("gf-calendar-state", "", { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/api/calendar", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
