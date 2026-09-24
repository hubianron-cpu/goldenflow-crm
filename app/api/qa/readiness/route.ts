import { NextResponse } from "next/server";
import { isClosureQaRuntime } from "@/lib/account-closure/qa-guard.mjs";
import { calendarConfig } from "@/lib/calendar/server";

const STAGING_GOOGLE_CLIENT_ID = "1050151882712-f0072msci8l4m53gfq47lbvv48esfk81.apps.googleusercontent.com";

export function GET(request: Request) {
  if (!isClosureQaRuntime(process.env)) return new Response(null, { status: 404 });

  const config = calendarConfig();
  const ready = Boolean(config
    && config.clientId === STAGING_GOOGLE_CLIENT_ID
    && config.redirectUri === `${new URL(request.url).origin}/api/calendar/callback`);

  return NextResponse.json({ ready }, {
    status: ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
