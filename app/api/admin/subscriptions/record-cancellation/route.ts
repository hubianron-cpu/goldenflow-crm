import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return error("מקור הבקשה אינו מורשה", 403);
  }

  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return error("יש להתחבר", 401);
  if (!isAdminEmail(user.email)) return error("אין הרשאה", 403);

  const admin = getSupabaseAdminClient();
  if (!admin) return error("חסרה הגדרת שרת", 503);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return error("בקשה לא תקינה", 400);
  const { userId, growDirectDebitId, accessUntil, growCancellationVerified } = body as Record<string, unknown>;
  if (growCancellationVerified !== true || typeof userId !== "string" || !UUID.test(userId) ||
      typeof growDirectDebitId !== "string" || !growDirectDebitId.trim() ||
      typeof accessUntil !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(accessUntil)) {
    return error("יש להזין מזהה משתמש, מזהה הוראת קבע ותאריך UTC, ולאשר שביטול Grow אומת", 400);
  }

  const end = new Date(accessUntil).getTime();
  const now = Date.now();
  if (!Number.isFinite(end) || end <= now) {
    return error("מועד סיום הגישה חייב להיות בעתיד", 400);
  }

  // Conditional write: only an active, not-yet-cancelled matching Grow mandate can be scheduled.
  const { data, error: updateError } = await admin
    .from("user_subscriptions")
    .update({ renewal_cancelled_at: new Date(now).toISOString(), access_until: accessUntil, updated_at: new Date(now).toISOString() })
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("grow_direct_debit_id", growDirectDebitId.trim())
    .is("renewal_cancelled_at", null)
    .select("user_id,access_until")
    .maybeSingle();

  if (updateError) return error("שמירת הביטול נכשלה", 500);
  if (!data) return error("לא נמצא מנוי פעיל תואם, או שהביטול כבר תועד", 409);
  return NextResponse.json({ userId: data.user_id, accessUntil: data.access_until });
}
