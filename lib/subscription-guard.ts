import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { getSubscriptionAccess } from "@/lib/subscriptions";

export const SUBSCRIPTION_REQUIRED_MESSAGE = "Subscription access required";

type SubscriptionGuardResult =
  | {
      error: typeof SUBSCRIPTION_REQUIRED_MESSAGE;
      ok: false;
      status: 403;
    }
  | {
      ok: true;
    };

export async function requireSubscriptionAccess(userId: string): Promise<SubscriptionGuardResult> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("user_id,status,plan_name,trial_start_at,trial_end_at,upgraded_at,created_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("SUBSCRIPTION_ACCESS_CHECK_FAILED", {
      code: error.code ?? null,
      message: error.message ?? null,
    });
  }

  if (!getSubscriptionAccess(data).hasAccess) {
    return {
      error: SUBSCRIPTION_REQUIRED_MESSAGE,
      ok: false,
      status: 403,
    };
  }

  return { ok: true };
}
