import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { checkRateLimit, getClientIp, getRateLimitResponseHeaders } from "@/lib/security/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const TRIAL_DAYS = 14;
const GENERIC_REGISTER_ERROR = "לא ניתן להשלים את ההרשמה כרגע. בדקו את הפרטים או נסו שוב מאוחר יותר.";
const REGISTER_RATE_LIMIT = {
  limit: 5,
  windowMs: 15 * 60 * 1000,
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string) {
  return /^[0-9+\-()\s]{7,30}$/.test(phone);
}

function isTooLong(value: string, maxLength: number) {
  return value.length > maxLength;
}

function getTrialEndDate(now: Date) {
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
  return trialEnd.toISOString();
}

function getRateLimitedResponse(retryAfter: number) {
  return NextResponse.json(
    { error: "יותר מדי ניסיונות הרשמה. נסו שוב בעוד כמה דקות." },
    { headers: getRateLimitResponseHeaders(retryAfter), status: 429 },
  );
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return jsonError("חסרה הגדרת Supabase.", 503);
  }

  const clientIp = getClientIp(request.headers);
  const rateLimit = checkRateLimit({
    key: `register:${clientIp}`,
    limit: REGISTER_RATE_LIMIT.limit,
    windowMs: REGISTER_RATE_LIMIT.windowMs,
  });

  if (!rateLimit.allowed) {
    return getRateLimitedResponse(rateLimit.retryAfter);
  }

  const serviceSupabase = getSupabaseAdminClient();

  if (!serviceSupabase) {
    return jsonError(GENERIC_REGISTER_ERROR, 500);
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return jsonError("בקשה לא תקינה.", 400);
  }

  const record = body as Record<string, unknown>;
  const honeypot = cleanText(record.website);

  if (honeypot) {
    return NextResponse.json({ success: true }, { status: 200 });
  }

  const fullName = cleanText(record.full_name);
  const email = cleanText(record.email).toLowerCase();
  const password = typeof record.password === "string" ? record.password : "";
  const businessName = cleanText(record.business_name);
  const phone = cleanText(record.phone);
  const profession = cleanText(record.profession);

  if (!fullName || isTooLong(fullName, 120)) {
    return jsonError("יש להזין שם מלא.", 400);
  }

  if (!email || email.length > 254 || !isValidEmail(email)) {
    return jsonError("יש להזין אימייל תקין.", 400);
  }

  if (password.length < 8 || password.length > 128) {
    return jsonError("יש להזין סיסמה באורך 8 עד 128 תווים.", 400);
  }

  if (!businessName || isTooLong(businessName, 120)) {
    return jsonError("יש להזין שם עסק.", 400);
  }

  if (!phone || phone.length > 30 || !isValidPhone(phone)) {
    return jsonError("יש להזין טלפון תקין.", 400);
  }

  if (!profession || isTooLong(profession, 120)) {
    return jsonError("יש לבחור תחום עיסוק.", 400);
  }

  const firstName = fullName.split(/\s+/)[0] || fullName;
  const now = new Date();
  const nowIso = now.toISOString();
  const trialEndAt = getTrialEndDate(now);
  const { data, error } = await serviceSupabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: {
      business_name: businessName,
      first_name: firstName,
      full_name: fullName,
      phone,
      profession,
      role: "coach",
    },
  });

  if (error || !data.user) {
    return jsonError(GENERIC_REGISTER_ERROR, error?.status || 400);
  }

  const userId = data.user.id;
  const { error: profileError } = await serviceSupabase
    .from("users")
    .upsert(
      {
        daily_target: 3000,
        first_name: firstName,
        id: userId,
        updated_at: nowIso,
      },
      { onConflict: "id" },
    );

  if (profileError) {
    await serviceSupabase.auth.admin.deleteUser(userId);
    return jsonError(GENERIC_REGISTER_ERROR, 500);
  }

  const { error: subscriptionError } = await serviceSupabase
    .from("user_subscriptions")
    .upsert(
      {
        created_at: nowIso,
        plan_name: "trial_14_days",
        status: "trial",
        trial_end_at: trialEndAt,
        trial_start_at: nowIso,
        updated_at: nowIso,
        user_id: userId,
      },
      { onConflict: "user_id" },
    );

  if (subscriptionError) {
    await serviceSupabase.auth.admin.deleteUser(userId);
    return jsonError(GENERIC_REGISTER_ERROR, 500);
  }

  return NextResponse.json(
    {
      success: true,
      trial_end_at: trialEndAt,
    },
    { status: 201 },
  );
}
