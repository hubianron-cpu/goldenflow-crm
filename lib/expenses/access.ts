import "server-only";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireSubscriptionAccess } from "@/lib/subscription-guard";

export const expenseError = (status = 500, message = "לא הצלחנו להשלים את הפעולה. אפשר לנסות שוב.") => NextResponse.json({ error: message }, { status });

async function authenticatedContext(request?: Request) {
  if (request && request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin) {
    return { error: expenseError(403) };
  }
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: expenseError(401, "יש להתחבר למערכת.") };
  return { supabase, user };
}

export async function calendarDisconnectContext(request: Request) {
  return authenticatedContext(request);
}

export async function expenseContext(request?: Request) {
  const context = await authenticatedContext(request);
  if (context.error) return context;
  const { user } = context;
  const access = await requireSubscriptionAccess(user.id);
  if (!access.ok) return { error: expenseError(403, "נדרש מנוי פעיל.") };
  return context;
}
