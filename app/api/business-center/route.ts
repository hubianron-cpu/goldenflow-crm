import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import {
  buildContentAttributionAnalytics,
  isMissingAttributionTable,
  type ContentAttributionAnalytics,
  type ContentAttributionAnalyticsRow,
  type ContentAttributionOption,
} from "@/lib/business-center/content-attribution";
import {
  getBusinessCenterMonthBounds,
  getBusinessCenterLeadAnalytics,
  type BusinessCenterLeadSource,
} from "@/lib/business-center/lead-analytics";
import { requireSubscriptionAccess } from "@/lib/subscription-guard";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type MonthlyInsert = Database["public"]["Tables"]["business_center_monthly_metrics"]["Insert"];
type MonthlyMetrics = Database["public"]["Tables"]["business_center_monthly_metrics"]["Row"];
type MonthlyUpdate = Database["public"]["Tables"]["business_center_monthly_metrics"]["Update"];
type ProfileInsert = Database["public"]["Tables"]["business_center_social_profiles"]["Insert"];
type ProfileUpdate = Database["public"]["Tables"]["business_center_social_profiles"]["Update"];
type SnapshotInsert = Database["public"]["Tables"]["business_center_social_snapshots"]["Insert"];
type SocialSnapshot = Database["public"]["Tables"]["business_center_social_snapshots"]["Row"];
type BusinessCenterLeadWithSource = BusinessCenterLeadSource & { source: string };
type AttributionQueryRow = {
  content_item:
    | Omit<ContentAttributionOption, "status">
    | Array<Omit<ContentAttributionOption, "status">>
    | null;
  content_item_id: string;
  lead_id: string;
};
type AttributionRowsLoadResult =
  | Extract<ContentAttributionAnalytics, { available: false }>
  | {
      available: true;
      rows: ContentAttributionAnalyticsRow[];
    };

const platforms = ["Instagram", "TikTok", "YouTube", "Facebook", "LinkedIn", "Other"] as const;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])-01$/;
const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MAX_COUNT = 2_147_483_647;
const MAX_MONEY = 999_999_999_999.99;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function logDatabaseError(event: string, error: { code?: string; message?: string }) {
  console.error(event, {
    code: error.code ?? null,
    message: error.message ?? null,
  });
}

function isMissingBusinessCenterTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (error.message ?? "").includes("business_center_")
  );
}

function databaseErrorResponse(error: { code?: string; message?: string }, event: string) {
  logDatabaseError(event, error);

  if (error.code === "23505") {
    return jsonError("כבר קיימת רשומה זהה. אפשר לערוך את הרשומה הקיימת.", 409);
  }

  if (isMissingBusinessCenterTable(error)) {
    return jsonError(
      "טבלאות מרכז העסק עדיין לא הותקנו ב-Supabase. יש להריץ את המיגרציה של המודול ולרענן את הדף.",
      503,
    );
  }

  return jsonError("לא הצלחנו להשלים את הפעולה במרכז העסק. נסו שוב.", 500);
}

function getRelatedContent(
  value: AttributionQueryRow["content_item"],
): Omit<ContentAttributionOption, "status"> | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

async function getContentAttributionRows(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  monthStart: string,
): Promise<AttributionRowsLoadResult> {
  const bounds = getBusinessCenterMonthBounds(monthStart);
  const result = await supabase
    .from("business_center_lead_attributions")
    .select(`
      lead_id,
      content_item_id,
      lead:leads!business_center_lead_attributions_lead_id_fkey!inner (
        created_at
      ),
      content_item:business_center_content_items!business_center_lead_attributions_content_item_id_fkey (
        id,
        title,
        platform,
        content_type,
        published_on
      )
    `)
    .eq("user_id", userId)
    .gte("lead.created_at", new Date(bounds.currentStart).toISOString())
    .lt("lead.created_at", new Date(bounds.currentEnd).toISOString());

  if (result.error) {
    logDatabaseError("BUSINESS_CENTER_CONTENT_ATTRIBUTION_LOAD_FAILED", result.error);
    return {
      available: false,
      reason: isMissingAttributionTable(result.error)
        ? "not_installed"
        : "load_failed",
    };
  }

  return {
    available: true,
    rows: ((result.data ?? []) as unknown as AttributionQueryRow[]).map(
      (row): ContentAttributionAnalyticsRow => ({
        content_item: getRelatedContent(row.content_item),
        content_item_id: row.content_item_id,
        lead_id: row.lead_id,
      }),
    ),
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

  if (error || !user) {
    return { error: jsonError("יש להתחבר כדי לגשת למרכז העסק.", 401) };
  }

  const subscription = await requireSubscriptionAccess(user.id);

  if (!subscription.ok) {
    return { error: jsonError(subscription.error, subscription.status) };
  }

  return { supabase, user };
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function parseOptionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseRequiredNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isValidCount(value: number | null) {
  return value === null || (Number.isInteger(value) && value >= 0 && value <= MAX_COUNT);
}

function isValidMoney(value: number | null) {
  return value === null || (Number.isFinite(value) && value >= 0 && value <= MAX_MONEY);
}

function isValidCalendarDate(value: string) {
  if (!datePattern.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function getJerusalemDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jerusalem",
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    day: values.day,
    month: values.month,
    year: values.year,
  };
}

function getJerusalemToday() {
  const { day, month, year } = getJerusalemDateParts();
  return `${year}-${month}-${day}`;
}

function getPreviousMonthStart(monthStart: string) {
  const date = new Date(`${monthStart}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 10);
}

function getMonthEnd(monthStart: string) {
  const date = new Date(`${monthStart}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeHandle(handle: string) {
  return handle.trim().replace(/^@+/, "").toLowerCase() || null;
}

function normalizeProfileUrl(profileUrl: string) {
  return profileUrl.trim().replace(/\/+$/, "").toLowerCase() || null;
}

function validateProfileUrl(profileUrl: string) {
  if (!profileUrl) {
    return true;
  }

  try {
    const url = new URL(profileUrl);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function getMonthlyPayload(record: Record<string, unknown>, userId: string) {
  const monthStart = cleanText(record.month_start, 10);
  const targetRevenue = parseOptionalNumber(record.target_revenue);
  const targetLeads = parseOptionalNumber(record.target_leads);
  const targetSalesCalls = parseOptionalNumber(record.target_sales_calls);
  const targetNewCustomers = parseOptionalNumber(record.target_new_customers);
  const targetContentPublished = parseOptionalNumber(record.target_content_published);
  const actualRevenue = parseRequiredNumber(record.actual_revenue);
  const actualSalesCalls = parseRequiredNumber(record.actual_sales_calls);
  const actualNewCustomers = parseRequiredNumber(record.actual_new_customers);
  const actualContentPublished = parseRequiredNumber(record.actual_content_published);
  const notes = cleanText(record.notes, 1001);

  if (!monthPattern.test(monthStart) || !isValidCalendarDate(monthStart)) {
    return { error: "יש לבחור חודש תקין." };
  }

  if (!isValidMoney(targetRevenue) || !isValidMoney(actualRevenue)) {
    return { error: "יש להזין סכומי הכנסה תקינים שאינם שליליים." };
  }

  const counts = [
    targetLeads,
    targetSalesCalls,
    targetNewCustomers,
    targetContentPublished,
    actualSalesCalls,
    actualNewCustomers,
    actualContentPublished,
  ];

  if (counts.some((value) => !isValidCount(value))) {
    return { error: "יש להזין ספירות שלמות ותקינות שאינן שליליות." };
  }

  if (notes.length > 1000) {
    return { error: "ההערה החודשית יכולה להכיל עד 1,000 תווים." };
  }

  const updatePayload: MonthlyUpdate = {
    actual_content_published: actualContentPublished,
    actual_new_customers: actualNewCustomers,
    actual_revenue: actualRevenue,
    actual_sales_calls: actualSalesCalls,
    notes: notes || null,
    target_content_published: targetContentPublished,
    target_leads: targetLeads,
    target_new_customers: targetNewCustomers,
    target_revenue: targetRevenue,
    target_sales_calls: targetSalesCalls,
  };
  const insertPayload: MonthlyInsert = {
    ...updatePayload,
    month_start: monthStart,
    user_id: userId,
  };

  return { insertPayload, monthStart, updatePayload };
}

function getProfilePayload(record: Record<string, unknown>, userId: string) {
  const platform = cleanText(record.platform, 20);
  const displayName = cleanText(record.display_name, 120);
  const handle = cleanText(record.handle, 100).replace(/^@+/, "");
  const profileUrl = cleanText(record.profile_url, 500);
  const followersGoal = parseOptionalNumber(record.followers_goal);
  const isActive = typeof record.is_active === "boolean" ? record.is_active : true;

  if (!platforms.includes(platform as (typeof platforms)[number])) {
    return { error: "יש לבחור פלטפורמה תקינה." };
  }

  if (!displayName) {
    return { error: "יש להזין שם תצוגה לפרופיל." };
  }

  if (!handle && !profileUrl) {
    return { error: "יש להזין לפחות Handle או קישור לפרופיל." };
  }

  if (!validateProfileUrl(profileUrl)) {
    return { error: "יש להזין קישור פרופיל תקין שמתחיל ב-http או https." };
  }

  if (!isValidCount(followersGoal)) {
    return { error: "יעד העוקבים חייב להיות מספר שלם שאינו שלילי." };
  }

  const payload: ProfileInsert = {
    data_source: "manual",
    display_name: displayName,
    external_account_id: null,
    followers_goal: followersGoal,
    handle: handle || null,
    is_active: isActive,
    last_synced_at: null,
    normalized_handle: normalizeHandle(handle),
    normalized_profile_url: normalizeProfileUrl(profileUrl),
    platform: platform as ProfileInsert["platform"],
    profile_url: profileUrl || null,
    user_id: userId,
  };

  return { payload };
}

function getSnapshotPayload(record: Record<string, unknown>, profileId: string) {
  const snapshotDate = cleanText(record.snapshot_date, 10);
  const followersCount = parseRequiredNumber(record.followers_count);
  const viewsCount = parseOptionalNumber(record.views_count);
  const profileVisitsCount = parseOptionalNumber(record.profile_visits_count);
  const attributedLeadsCount = parseOptionalNumber(record.attributed_leads_count);
  const notes = cleanText(record.notes, 501);

  if (!isValidCalendarDate(snapshotDate) || snapshotDate > getJerusalemToday()) {
    return { error: "תאריך המדידה אינו תקין או נמצא בעתיד." };
  }

  if (
    ![followersCount, viewsCount, profileVisitsCount, attributedLeadsCount].every(isValidCount)
  ) {
    return { error: "מדדי הרשתות חייבים להיות מספרים שלמים שאינם שליליים." };
  }

  if (notes.length > 500) {
    return { error: "הערת המדידה יכולה להכיל עד 500 תווים." };
  }

  const payload: SnapshotInsert = {
    attributed_leads_count: attributedLeadsCount,
    data_source: "manual",
    followers_count: followersCount,
    notes: notes || null,
    profile_visits_count: profileVisitsCount,
    snapshot_date: snapshotDate,
    social_profile_id: profileId,
    views_count: viewsCount,
  };

  return { payload };
}

function findThirtyDayBaseline(snapshots: SocialSnapshot[], latest: SocialSnapshot | null) {
  if (!latest) {
    return null;
  }

  const cutoff = addDays(latest.snapshot_date, -30);
  return snapshots.find((snapshot) => snapshot.snapshot_date <= cutoff) ?? null;
}

export async function GET(request: Request) {
  const context = await getContext();

  if ("error" in context) {
    return context.error;
  }

  const monthStart = new URL(request.url).searchParams.get("month") ?? "";

  if (!monthPattern.test(monthStart) || !isValidCalendarDate(monthStart)) {
    return jsonError("יש לבחור חודש תקין.", 400);
  }

  const previousMonthStart = getPreviousMonthStart(monthStart);
  const snapshotCutoff = getMonthEnd(monthStart);
  const [monthlyMetricsResult, profilesResult, leadsResult, attributionRowsResult] = await Promise.all([
    context.supabase
      .from("business_center_monthly_metrics")
      .select("*")
      .eq("user_id", context.user.id)
      .in("month_start", [monthStart, previousMonthStart]),
    context.supabase
      .from("business_center_social_profiles")
      .select("*")
      .eq("user_id", context.user.id)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false }),
    context.supabase
      .from("leads")
      .select("id, created_at, full_name, next_action_date, source, status, value")
      .eq("user_id", context.user.id),
    getContentAttributionRows(
      context.supabase,
      context.user.id,
      monthStart,
    ),
  ]);

  if (leadsResult.error) {
    logDatabaseError("BUSINESS_CENTER_LEADS_LOAD_FAILED", leadsResult.error);
    return jsonError("לא ניתן לטעון את נתוני הלידים מה־CRM.", 500);
  }

  const firstError = monthlyMetricsResult.error ?? profilesResult.error;
  if (firstError) {
    return databaseErrorResponse(firstError, "BUSINESS_CENTER_LOAD_FAILED");
  }

  const profiles = profilesResult.data ?? [];
  let snapshots: SocialSnapshot[] = [];

  if (profiles.length > 0) {
    const snapshotsResult = await context.supabase
      .from("business_center_social_snapshots")
      .select("*")
      .in(
        "social_profile_id",
        profiles.map((profile) => profile.id),
      )
      .order("snapshot_date", { ascending: false });

    if (snapshotsResult.error) {
      return databaseErrorResponse(snapshotsResult.error, "BUSINESS_CENTER_SNAPSHOTS_LOAD_FAILED");
    }

    snapshots = (snapshotsResult.data ?? []) as SocialSnapshot[];
  }

  const profilesWithSnapshots = profiles.map((profile) => {
    const profileSnapshots = snapshots.filter(
      (snapshot) => snapshot.social_profile_id === profile.id,
    );
    const relevantSnapshots = profileSnapshots.filter(
      (snapshot) => snapshot.snapshot_date <= snapshotCutoff,
    );
    const latestSnapshot = relevantSnapshots[0] ?? null;

    return {
      ...profile,
      latest_snapshot: latestSnapshot,
      previous_snapshot: relevantSnapshots[1] ?? null,
      snapshots: profileSnapshots,
      thirty_day_snapshot: findThirtyDayBaseline(relevantSnapshots, latestSnapshot),
    };
  });
  const leads = (leadsResult.data ?? []) as BusinessCenterLeadWithSource[];
  const monthlyRows = (monthlyMetricsResult.data ?? []) as MonthlyMetrics[];
  const contentAttribution = attributionRowsResult.available
    ? buildContentAttributionAnalytics(
        leads,
        attributionRowsResult.rows,
        monthStart,
      )
    : attributionRowsResult;

  return NextResponse.json(
    {
      content_attribution: contentAttribution,
      monthly:
        monthlyRows.find((row) => row.month_start === monthStart) ?? null,
      previous_monthly:
        monthlyRows.find((row) => row.month_start === previousMonthStart) ?? null,
      profiles: profilesWithSnapshots,
      lead_analytics: getBusinessCenterLeadAnalytics(
        leads,
        monthStart,
      ),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
      status: 200,
    },
  );
}

export async function PUT(request: Request) {
  const context = await getContext();

  if ("error" in context) {
    return context.error;
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("בקשה לא תקינה.", 400);
  }

  const parsed = getMonthlyPayload(body as Record<string, unknown>, context.user.id);
  if ("error" in parsed) {
    return jsonError(parsed.error ?? "בקשה לא תקינה.", 400);
  }

  const existingResult = await context.supabase
    .from("business_center_monthly_metrics")
    .select("id")
    .eq("user_id", context.user.id)
    .eq("month_start", parsed.monthStart)
    .maybeSingle();

  if (existingResult.error) {
    return databaseErrorResponse(
      existingResult.error,
      "BUSINESS_CENTER_MONTHLY_EXISTENCE_CHECK_FAILED",
    );
  }

  const saveResult = existingResult.data
    ? await context.supabase
        .from("business_center_monthly_metrics")
        .update(parsed.updatePayload)
        .eq("id", existingResult.data.id)
        .eq("user_id", context.user.id)
        .select("*")
        .single()
    : await context.supabase
        .from("business_center_monthly_metrics")
        .insert(parsed.insertPayload)
        .select("*")
        .single();

  if (saveResult.error) {
    return databaseErrorResponse(
      saveResult.error,
      "BUSINESS_CENTER_MONTHLY_SAVE_FAILED",
    );
  }

  return NextResponse.json({ monthly: saveResult.data }, { status: 200 });
}

export async function POST(request: Request) {
  const context = await getContext();

  if ("error" in context) {
    return context.error;
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("בקשה לא תקינה.", 400);
  }

  const record = body as Record<string, unknown>;
  const kind = cleanText(record.kind, 20);

  if (kind === "profile") {
    const parsed = getProfilePayload(record, context.user.id);
    if ("error" in parsed) {
      return jsonError(parsed.error ?? "בקשה לא תקינה.", 400);
    }

    const { data, error } = await context.supabase
      .from("business_center_social_profiles")
      .insert(parsed.payload)
      .select("*")
      .single();

    if (error) {
      return databaseErrorResponse(error, "BUSINESS_CENTER_PROFILE_CREATE_FAILED");
    }

    return NextResponse.json({ profile: data }, { status: 201 });
  }

  if (kind === "snapshot") {
    const profileId = cleanText(record.social_profile_id, 36);
    if (!profileId) {
      return jsonError("חסר מזהה פרופיל.", 400);
    }

    const { data: ownedProfile, error: profileError } = await context.supabase
      .from("business_center_social_profiles")
      .select("id")
      .eq("id", profileId)
      .eq("user_id", context.user.id)
      .maybeSingle();

    if (profileError) {
      return databaseErrorResponse(profileError, "BUSINESS_CENTER_PROFILE_OWNERSHIP_CHECK_FAILED");
    }

    if (!ownedProfile) {
      return jsonError("הפרופיל לא נמצא.", 404);
    }

    const parsed = getSnapshotPayload(record, profileId);
    if ("error" in parsed) {
      return jsonError(parsed.error ?? "בקשה לא תקינה.", 400);
    }

    const { data, error } = await context.supabase
      .from("business_center_social_snapshots")
      .upsert(parsed.payload, { onConflict: "social_profile_id,snapshot_date" })
      .select("*")
      .single();

    if (error) {
      return databaseErrorResponse(error, "BUSINESS_CENTER_SNAPSHOT_SAVE_FAILED");
    }

    return NextResponse.json({ snapshot: data }, { status: 200 });
  }

  return jsonError("סוג הפעולה אינו נתמך.", 400);
}

export async function PATCH(request: Request) {
  const context = await getContext();

  if ("error" in context) {
    return context.error;
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("בקשה לא תקינה.", 400);
  }

  const record = body as Record<string, unknown>;
  const id = cleanText(record.id, 36);

  if (!id) {
    return jsonError("חסר מזהה פרופיל.", 400);
  }

  const parsed = getProfilePayload(record, context.user.id);
  if ("error" in parsed) {
    return jsonError(parsed.error ?? "בקשה לא תקינה.", 400);
  }

  const updatePayload: ProfileUpdate = parsed.payload;
  delete updatePayload.user_id;

  const { data, error } = await context.supabase
    .from("business_center_social_profiles")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", context.user.id)
    .select("*")
    .single();

  if (error) {
    return databaseErrorResponse(error, "BUSINESS_CENTER_PROFILE_UPDATE_FAILED");
  }

  return NextResponse.json({ profile: data }, { status: 200 });
}
