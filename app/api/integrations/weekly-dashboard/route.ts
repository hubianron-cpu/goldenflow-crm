import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { readWeeklyDashboard } from "@/lib/weekly-dashboard";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return readWeeklyDashboard(
    request,
    "crm",
    process.env.WEEKLY_DASHBOARD_READ_KEY,
    async () => {
      const db = getSupabaseAdminClient();
      if (!db) throw new Error("Database unavailable");
      const { count, error } = await db
        .from("user_subscriptions")
        .select("user_id", { count: "exact", head: true })
        .eq("status", "active")
        .or(
          `renewal_cancelled_at.is.null,access_until.gt.${new Date().toISOString()}`,
        );
      if (error || count === null) throw new Error("Count unavailable");
      return count;
    },
  );
}
