import type { Database } from "@/types/database";

export type UserSubscription = Database["public"]["Tables"]["user_subscriptions"]["Row"];
export type SubscriptionStatus = UserSubscription["status"];
export type SubscriptionAccessStatus = SubscriptionStatus | "missing";
type SubscriptionAccessInput = Pick<UserSubscription, "status" | "trial_end_at" | "renewal_cancelled_at" | "access_until">;

export type SubscriptionAccess = {
  daysRemaining: number;
  hasAccess: boolean;
  isActive: boolean;
  isExpired: boolean;
  isTrial: boolean;
  status: SubscriptionAccessStatus;
  trialEndDate: string | null;
  accessUntil: string | null;
};

const DAY_IN_MS = 86_400_000;

function getDateTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function getSubscriptionAccess(
  subscription: SubscriptionAccessInput | null | undefined,
  now: Date = new Date(),
): SubscriptionAccess {
  if (!subscription) {
    return {
      daysRemaining: 0,
      hasAccess: false,
      isActive: false,
      isExpired: false,
      isTrial: false,
      status: "missing",
      trialEndDate: null,
      accessUntil: null,
    };
  }

  const status = subscription.status;
  const trialEndTime = getDateTime(subscription.trial_end_at);
  const nowTime = now.getTime();
  const accessEndTime = getDateTime(subscription.access_until);
  const isActive = status === "active" && (!subscription.renewal_cancelled_at || (accessEndTime !== null && accessEndTime > nowTime));
  const isTrial = status === "trial";
  const trialIsValid = isTrial && trialEndTime !== null && trialEndTime > nowTime;
  const isExpired = status === "expired" || (isTrial && !trialIsValid) || (status === "active" && !isActive);
  const daysRemaining = trialIsValid ? Math.max(0, Math.ceil((trialEndTime - nowTime) / DAY_IN_MS)) : 0;

  return {
    daysRemaining,
    hasAccess: isActive || trialIsValid,
    isActive,
    isExpired,
    isTrial,
    status,
    trialEndDate: subscription.trial_end_at,
    accessUntil: subscription.renewal_cancelled_at ? subscription.access_until : null,
  };
}

export async function getCurrentUserSubscription() {
  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      access: getSubscriptionAccess(null),
      error: userError?.message ?? "No authenticated user.",
      subscription: null,
      user: null,
    };
  }

  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("user_id,status,plan_name,trial_start_at,trial_end_at,renewal_cancelled_at,access_until,upgraded_at,created_at,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    access: getSubscriptionAccess(data),
    error: error?.message ?? null,
    subscription: data,
    user,
  };
}
