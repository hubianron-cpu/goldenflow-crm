import "server-only";

import {
  getBusinessPeriodSummary,
  getBusinessTrendSeries,
  type AvailableData,
  type BusinessInsightsSelection,
  type BusinessPeriodSummaryInput,
  type InsightClosedLeadRow,
  type InsightLeadRow,
  type InsightMonthlyMetricRow,
  type InsightSocialProfileRow,
  type InsightSocialSnapshotRow,
  type InsightStuckLeadRow,
  type InsightTrendLeadRow,
} from "@/lib/business-center/insights";
import { isMissingAttributionTable } from "@/lib/business-center/content-attribution";
import { createServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>;
type QueryError = {
  code?: string;
  details?: string;
  message?: string;
};

const FINAL_STATUS_FILTER =
  '("נסגר בהצלחה","לא רלוונטי","נסגר","סגור","closed","won","lost")';

function logQueryError(event: string, error: QueryError) {
  console.error(event, {
    code: error.code ?? null,
    message: error.message ?? null,
  });
}

function isMissingTable(error: QueryError, tableName: string) {
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST200" ||
    error.code === "PGRST205" ||
    (message.includes(tableName.toLowerCase()) &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find the table")))
  );
}

function failedData<T>(
  error: QueryError,
  event: string,
  tableName?: string,
): AvailableData<T> {
  logQueryError(event, error);
  return {
    available: false,
    reason:
      tableName && isMissingTable(error, tableName)
        ? "not_installed"
        : "load_failed",
  };
}

function addMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getBusinessInsightsData(
  supabase: SupabaseServerClient,
  userId: string,
  selection: BusinessInsightsSelection,
  now = new Date(),
) {
  const trendStart = selection.trendMonths[0];
  const trendEnd = selection.trendMonths.at(-1);

  if (!trendStart || !trendEnd) {
    throw new Error("Business insight trend range is empty.");
  }

  const trendStartDate = `${trendStart.key}-01`;
  const trendEndDate = `${addMonth(trendEnd.key)}-01`;
  const selectedMonthStart =
    selection.period.type === "month" ? `${selection.period.key}-01` : null;
  const monthlyFilter = selectedMonthStart
    ? `and(month_start.gte.${trendStartDate},month_start.lt.${trendEndDate}),month_start.eq.${selectedMonthStart}`
    : `and(month_start.gte.${trendStartDate},month_start.lt.${trendEndDate})`;
  const staleCutoff = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const nowIso = now.toISOString();

  const [
    periodLeadsResult,
    closedLeadsResult,
    trendLeadsResult,
    monthlyMetricsResult,
    publishedContentResult,
    attributionResult,
    profilesResult,
    overdueLeadsResult,
    unscheduledLeadsResult,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, created_at, closed_at, full_name, next_action_date, source, status, updated_at",
      )
      .eq("user_id", userId)
      .gte("created_at", selection.period.startIso)
      .lt("created_at", selection.period.endIso)
      .order("created_at", { ascending: true }),
    supabase
      .from("leads")
      .select("id, closed_at, status")
      .eq("user_id", userId)
      .in("status", ["נסגר בהצלחה", "נסגר", "won"])
      .not("closed_at", "is", null)
      .gte("closed_at", selection.period.startIso)
      .lt("closed_at", selection.period.endIso),
    supabase
      .from("leads")
      .select("id, created_at, closed_at, status")
      .eq("user_id", userId)
      .or(
        `and(created_at.gte.${trendStart.startIso},created_at.lt.${trendEnd.endIso}),and(closed_at.gte.${trendStart.startIso},closed_at.lt.${trendEnd.endIso})`,
      ),
    supabase
      .from("business_center_monthly_metrics")
      .select(
        "month_start, actual_revenue, target_revenue, target_leads",
      )
      .eq("user_id", userId)
      .or(monthlyFilter)
      .order("month_start", { ascending: true }),
    supabase
      .from("business_center_content_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["published", "archived"])
      .gte("published_on", selection.period.startDate)
      .lt("published_on", selection.period.endDate),
    supabase
      .from("business_center_lead_attributions")
      .select(`
        lead_id,
        lead:leads!business_center_lead_attributions_lead_id_fkey!inner (
          created_at
        )
      `)
      .eq("user_id", userId)
      .gte("lead.created_at", selection.period.startIso)
      .lt("lead.created_at", selection.period.endIso),
    supabase
      .from("business_center_social_profiles")
      .select(
        "id, display_name, handle, platform, is_active, created_at",
      )
      .eq("user_id", userId)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("leads")
      .select(
        "id, full_name, status, next_action_date, updated_at",
        { count: "exact" },
      )
      .eq("user_id", userId)
      .not("status", "in", FINAL_STATUS_FILTER)
      .lt("next_action_date", nowIso)
      .order("next_action_date", { ascending: true })
      .order("id", { ascending: true })
      .limit(5),
    supabase
      .from("leads")
      .select(
        "id, full_name, status, next_action_date, updated_at",
        { count: "exact" },
      )
      .eq("user_id", userId)
      .not("status", "in", FINAL_STATUS_FILTER)
      .is("next_action_date", null)
      .lt("updated_at", staleCutoff)
      .order("updated_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(5),
  ]);

  const periodLeads: AvailableData<InsightLeadRow[]> = periodLeadsResult.error
    ? failedData(
        periodLeadsResult.error,
        "BUSINESS_INSIGHTS_PERIOD_LEADS_FAILED",
      )
    : {
        available: true,
        data: (periodLeadsResult.data ?? []) as InsightLeadRow[],
      };
  const closedLeads: AvailableData<InsightClosedLeadRow[]> =
    closedLeadsResult.error
      ? failedData(
          closedLeadsResult.error,
          "BUSINESS_INSIGHTS_CLOSED_LEADS_FAILED",
        )
      : {
          available: true,
          data: (closedLeadsResult.data ?? []) as InsightClosedLeadRow[],
        };
  const trendLeads: AvailableData<InsightTrendLeadRow[]> =
    trendLeadsResult.error
      ? failedData(
          trendLeadsResult.error,
          "BUSINESS_INSIGHTS_TREND_LEADS_FAILED",
        )
      : {
          available: true,
          data: (trendLeadsResult.data ?? []) as InsightTrendLeadRow[],
        };
  const monthlyMetricRows: AvailableData<InsightMonthlyMetricRow[]> =
    monthlyMetricsResult.error
      ? failedData(
          monthlyMetricsResult.error,
          "BUSINESS_INSIGHTS_MONTHLY_METRICS_FAILED",
          "business_center_monthly_metrics",
        )
      : {
          available: true,
          data: (monthlyMetricsResult.data ?? []) as InsightMonthlyMetricRow[],
        };
  const selectedMonthlyMetrics: AvailableData<InsightMonthlyMetricRow | null> =
    monthlyMetricRows.available
      ? {
          available: true,
          data:
            monthlyMetricRows.data.find(
              (row) => row.month_start === selectedMonthStart,
            ) ?? null,
        }
      : monthlyMetricRows;
  const publishedContentCount: AvailableData<number> =
    publishedContentResult.error
      ? failedData(
          publishedContentResult.error,
          "BUSINESS_INSIGHTS_PUBLISHED_CONTENT_FAILED",
          "business_center_content_items",
        )
      : {
          available: true,
          data: publishedContentResult.count ?? 0,
        };
  const attributionLeadIds: AvailableData<string[]> = attributionResult.error
    ? {
        available: false,
        reason: isMissingAttributionTable(attributionResult.error)
          ? "not_installed"
          : "load_failed",
      }
    : {
        available: true,
        data: Array.from(
          new Set(
            (attributionResult.data ?? []).map((row) => row.lead_id),
          ),
        ),
      };

  if (attributionResult.error) {
    logQueryError(
      "BUSINESS_INSIGHTS_ATTRIBUTION_FAILED",
      attributionResult.error,
    );
  }

  const profiles: AvailableData<InsightSocialProfileRow[]> =
    profilesResult.error
      ? failedData(
          profilesResult.error,
          "BUSINESS_INSIGHTS_SOCIAL_PROFILES_FAILED",
          "business_center_social_profiles",
        )
      : {
          available: true,
          data: (profilesResult.data ?? []) as InsightSocialProfileRow[],
        };
  let snapshots: AvailableData<InsightSocialSnapshotRow[]> = profiles.available
    ? { available: true, data: [] }
    : {
        available: false,
        reason: profiles.reason,
      };

  if (profiles.available && profiles.data.length > 0) {
    const snapshotsResult = await supabase
      .from("business_center_social_snapshots")
      .select("social_profile_id, snapshot_date, followers_count")
      .in(
        "social_profile_id",
        profiles.data.map((profile) => profile.id),
      )
      .gte("snapshot_date", trendStartDate)
      .lt("snapshot_date", trendEndDate)
      .order("snapshot_date", { ascending: true });

    snapshots = snapshotsResult.error
      ? failedData(
          snapshotsResult.error,
          "BUSINESS_INSIGHTS_SOCIAL_SNAPSHOTS_FAILED",
          "business_center_social_snapshots",
        )
      : {
          available: true,
          data: (snapshotsResult.data ?? []) as InsightSocialSnapshotRow[],
        };
  }

  const overdueLeads: BusinessPeriodSummaryInput["overdueLeads"] =
    overdueLeadsResult.error
      ? failedData(
          overdueLeadsResult.error,
          "BUSINESS_INSIGHTS_OVERDUE_LEADS_FAILED",
        )
      : {
          available: true,
          data: {
            rows: (overdueLeadsResult.data ?? []) as InsightStuckLeadRow[],
            total: overdueLeadsResult.count ?? 0,
          },
        };
  const unscheduledLeads: BusinessPeriodSummaryInput["unscheduledLeads"] =
    unscheduledLeadsResult.error
      ? failedData(
          unscheduledLeadsResult.error,
          "BUSINESS_INSIGHTS_UNSCHEDULED_LEADS_FAILED",
        )
      : {
          available: true,
          data: {
            rows: (unscheduledLeadsResult.data ?? []) as InsightStuckLeadRow[],
            total: unscheduledLeadsResult.count ?? 0,
          },
        };

  return {
    summary: getBusinessPeriodSummary({
      attributionLeadIds,
      closedLeads,
      monthlyMetrics: selectedMonthlyMetrics,
      now,
      overdueLeads,
      period: selection.period,
      periodLeads,
      publishedContentCount,
      unscheduledLeads,
    }),
    trends: getBusinessTrendSeries({
      leads: trendLeads,
      monthlyMetrics: monthlyMetricRows,
      profiles,
      selectedProfileId: selection.profileId,
      snapshots,
      trendMonths: selection.trendMonths,
    }),
  };
}
