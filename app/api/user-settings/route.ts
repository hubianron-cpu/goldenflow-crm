import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { requireSubscriptionAccess } from "@/lib/subscription-guard";
import { createServerClient } from "@/lib/supabase/server";

const DEFAULT_DAILY_TARGET = 3000;
const MIN_DAILY_TARGET = 500;
const MAX_DAILY_TARGET = 100000;

function jsonError(message: string, status: number, meta?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...meta }, { status });
}

function getSupabaseErrorMeta(error: {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string;
}) {
  return {
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    message: error.message ?? null,
  };
}

async function getContext() {
  if (!hasSupabaseEnv()) {
    return { error: jsonError("Supabase is not configured.", 503) };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return { error: jsonError(error.message, 401, getSupabaseErrorMeta(error)) };
  }

  if (!user) {
    return { error: jsonError("אין משתמש מחובר.", 401) };
  }

  const subscription = await requireSubscriptionAccess(user.id);

  if (!subscription.ok) {
    return { error: jsonError(subscription.error, subscription.status) };
  }

  return { supabase, user };
}

function parseDailyTarget(value: unknown) {
  const dailyTarget = Number(value);

  if (!Number.isFinite(dailyTarget)) {
    return null;
  }

  return Math.round(dailyTarget);
}

function getMetadataDailyTarget(metadata: Record<string, unknown> | null | undefined) {
  const dailyTarget = Number(metadata?.daily_target ?? DEFAULT_DAILY_TARGET);
  return Number.isFinite(dailyTarget) && dailyTarget >= MIN_DAILY_TARGET && dailyTarget <= MAX_DAILY_TARGET
    ? Math.round(dailyTarget)
    : DEFAULT_DAILY_TARGET;
}

export async function GET() {
  const context = await getContext();

  if ("error" in context) {
    return context.error;
  }

  return NextResponse.json(
    { daily_target: getMetadataDailyTarget(context.user.user_metadata) },
    { status: 200 },
  );
}

export async function PATCH(request: Request) {
  const context = await getContext();

  if ("error" in context) {
    return context.error;
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body.", 400);
  }

  const dailyTarget = parseDailyTarget((body as Record<string, unknown>).daily_target);

  if (dailyTarget === null || dailyTarget < MIN_DAILY_TARGET || dailyTarget > MAX_DAILY_TARGET) {
    return jsonError("Daily target must be between 500 and 100000.", 400);
  }

  const { data, error } = await context.supabase.auth.updateUser({
    data: {
      ...context.user.user_metadata,
      daily_target: dailyTarget,
    },
  });

  if (error) {
    return jsonError(error.message, 500, getSupabaseErrorMeta(error));
  }

  return NextResponse.json(
    { daily_target: getMetadataDailyTarget(data.user?.user_metadata) },
    { status: 200 },
  );
}
