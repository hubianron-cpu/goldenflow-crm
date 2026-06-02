import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const TRIAL_DAYS = 14;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getReadableAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("already") || normalized.includes("registered") || normalized.includes("exists")) {
    return "כבר קיים משתמש עם האימייל הזה. אפשר להתחבר במקום.";
  }

  if (normalized.includes("password")) {
    return "הסיסמה קצרה מדי או לא עומדת בדרישות.";
  }

  return "לא ניתן לפתוח חשבון ניסיון כרגע.";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getTrialEndDate(now: Date) {
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
  return trialEnd.toISOString();
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return jsonError("חסרה הגדרת Supabase.", 503);
  }

  const serviceSupabase = getSupabaseAdminClient();

  if (!serviceSupabase) {
    return jsonError("לא ניתן לפתוח חשבון ניסיון כרגע.", 500);
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return jsonError("בקשה לא תקינה.", 400);
  }

  const record = body as Record<string, unknown>;
  const fullName = cleanText(record.full_name);
  const email = cleanText(record.email).toLowerCase();
  const password = typeof record.password === "string" ? record.password : "";
  const businessName = cleanText(record.business_name);
  const phone = cleanText(record.phone);
  const profession = cleanText(record.profession);

  if (!fullName) {
    return jsonError("יש להזין שם מלא.", 400);
  }

  if (!email || !isValidEmail(email)) {
    return jsonError("יש להזין אימייל תקין.", 400);
  }

  if (password.length < 6) {
    return jsonError("יש להזין סיסמה באורך 6 תווים לפחות.", 400);
  }

  if (!businessName) {
    return jsonError("יש להזין שם עסק.", 400);
  }

  if (!phone) {
    return jsonError("יש להזין טלפון.", 400);
  }

  if (!profession) {
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
    return jsonError(getReadableAuthError(error?.message || ""), error?.status || 400);
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
    return jsonError("לא ניתן לפתוח חשבון ניסיון כרגע.", 500);
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
    return jsonError("לא ניתן לפתוח חשבון ניסיון כרגע.", 500);
  }

  return NextResponse.json(
    {
      success: true,
      trial_end_at: trialEndAt,
    },
    { status: 201 },
  );
}
