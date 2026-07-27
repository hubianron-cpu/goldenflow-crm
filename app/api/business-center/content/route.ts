import { NextResponse } from "next/server";
import {
  CONTENT_METRIC_FIELDS,
  CONTENT_PLATFORMS,
  CONTENT_SORTS,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  contentMetricsChanged,
  validateContentInput,
  type ContentMetricField,
  type ContentPlatform,
  type ContentSort,
  type ContentStatus,
  type ContentType,
} from "@/lib/business-center/content";
import { isMissingAttributionTable } from "@/lib/business-center/content-attribution";
import { hasSupabaseEnv } from "@/lib/env";
import { normalizeLeadStatus } from "@/lib/leads";
import { requireSubscriptionAccess } from "@/lib/subscription-guard";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ContentRow = Database["public"]["Tables"]["business_center_content_items"]["Row"];
type ContentResultRow = Omit<ContentRow, "user_id">;
type ContentInsert = Database["public"]["Tables"]["business_center_content_items"]["Insert"];
type ContentUpdate = Database["public"]["Tables"]["business_center_content_items"]["Update"];
type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>;
type AttributionCountRow = {
  content_item_id: string;
  lead: { status: string } | Array<{ status: string }> | null;
};
type AttributionAvailability =
  | { available: true }
  | { available: false; reason: "load_failed" | "not_installed" };

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const CONTENT_SELECT =
  "id, title, platform, content_type, status, published_on, content_url, topic, target_audience, promoted_product, campaign_source, notes, views_count, likes_count, comments_count, saves_count, shares_count, profile_visits_count, metrics_updated_at, created_at, updated_at";
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ code, error: message }, { status });
}

function logDatabaseError(event: string, error: { code?: string; message?: string }) {
  console.error(event, {
    code: error.code ?? null,
    message: error.message ?? null,
  });
}

function isMissingContentTable(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes('relation "business_center_content_items" does not exist') ||
    message.includes("Could not find the table 'public.business_center_content_items'")
  );
}

function databaseErrorResponse(error: { code?: string; message?: string }, event: string) {
  logDatabaseError(event, error);

  if (error.code === "23505") {
    return jsonError(
      "התוכן הזה כבר קיים עבור הפלטפורמה שנבחרה. אפשר לערוך את הרשומה הקיימת.",
      409,
      "CONTENT_DUPLICATE",
    );
  }

  if (isMissingContentTable(error)) {
    return jsonError(
      "ספריית התוכן עדיין לא הופעלה במסד הנתונים.",
      503,
      "CONTENT_LIBRARY_NOT_INSTALLED",
    );
  }

  return jsonError("לא הצלחנו להשלים את הפעולה בספריית התוכן. נסו שוב.", 500);
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
    return { error: jsonError("יש להתחבר כדי לגשת לספריית התוכן.", 401) };
  }

  const subscription = await requireSubscriptionAccess(user.id);
  if (!subscription.ok) {
    return { error: jsonError(subscription.error, subscription.status) };
  }

  return { supabase, user };
}

async function getBody(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parsePositiveInteger(value: string | null, fallback: number, maximum?: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return null;
  }

  return maximum ? Math.min(parsed, maximum) : parsed;
}

function getNextMonth(month: string) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 7);
}

function sanitizeSearch(value: string) {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

async function findDuplicate(
  supabase: SupabaseServerClient,
  userId: string,
  platform: ContentPlatform,
  contentUrl: string,
  excludeId?: string,
) {
  let query = supabase
    .from("business_center_content_items")
    .select("id")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("content_url", contentUrl)
    .limit(1);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  return query.maybeSingle();
}

function getRelatedLeadStatus(value: AttributionCountRow["lead"]) {
  if (Array.isArray(value)) {
    return value[0]?.status ?? null;
  }

  return value?.status ?? null;
}

async function getAttributionCounts(
  supabase: SupabaseServerClient,
  userId: string,
  contentItemIds: string[],
) {
  if (contentItemIds.length === 0) {
    const probe = await supabase
      .from("business_center_lead_attributions")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (probe.error) {
      logDatabaseError("BUSINESS_CENTER_CONTENT_ATTRIBUTION_PROBE_FAILED", probe.error);
      return {
        availability: {
          available: false,
          reason: isMissingAttributionTable(probe.error)
            ? "not_installed"
            : "load_failed",
        } satisfies AttributionAvailability,
        counts: new Map<string, { attributedLeads: number; currentWon: number }>(),
      };
    }

    return {
      availability: { available: true } satisfies AttributionAvailability,
      counts: new Map<string, { attributedLeads: number; currentWon: number }>(),
    };
  }

  const result = await supabase
    .from("business_center_lead_attributions")
    .select(`
      content_item_id,
      lead:leads!business_center_lead_attributions_lead_id_fkey!inner (
        status
      )
    `)
    .eq("user_id", userId)
    .in("content_item_id", contentItemIds);

  if (result.error) {
    logDatabaseError("BUSINESS_CENTER_CONTENT_ATTRIBUTION_COUNTS_FAILED", result.error);
    return {
      availability: {
        available: false,
        reason: isMissingAttributionTable(result.error)
          ? "not_installed"
          : "load_failed",
      } satisfies AttributionAvailability,
      counts: new Map<string, { attributedLeads: number; currentWon: number }>(),
    };
  }

  const counts = new Map<
    string,
    { attributedLeads: number; currentWon: number }
  >();

  for (const row of (result.data ?? []) as unknown as AttributionCountRow[]) {
    const current = counts.get(row.content_item_id) ?? {
      attributedLeads: 0,
      currentWon: 0,
    };
    const status = getRelatedLeadStatus(row.lead);
    current.attributedLeads += 1;
    current.currentWon +=
      status && normalizeLeadStatus(status) === "נסגר בהצלחה" ? 1 : 0;
    counts.set(row.content_item_id, current);
  }

  return {
    availability: { available: true } satisfies AttributionAvailability,
    counts,
  };
}

export async function GET(request: Request) {
  const context = await getContext();
  if ("error" in context) {
    return context.error;
  }

  const searchParams = new URL(request.url).searchParams;
  const page = parsePositiveInteger(searchParams.get("page"), 1);
  const pageSize = parsePositiveInteger(
    searchParams.get("pageSize"),
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const rawSearch = searchParams.get("search") ?? "";
  const search = sanitizeSearch(rawSearch);
  const month = searchParams.get("month") ?? "";
  const platform = searchParams.get("platform") ?? "";
  const contentType = searchParams.get("contentType") ?? "";
  const status = searchParams.get("status") ?? "active";
  const sort = searchParams.get("sort") ?? "newest";

  if (page === null || pageSize === null) {
    return jsonError("מספר העמוד או גודל העמוד אינם תקינים.", 400);
  }
  if (month && !monthPattern.test(month)) {
    return jsonError("חודש הפרסום אינו תקין.", 400);
  }
  if (platform && !CONTENT_PLATFORMS.includes(platform as ContentPlatform)) {
    return jsonError("פילטר הפלטפורמה אינו תקין.", 400);
  }
  if (contentType && !CONTENT_TYPES.includes(contentType as ContentType)) {
    return jsonError("פילטר סוג התוכן אינו תקין.", 400);
  }
  if (
    !["active", "all", ...CONTENT_STATUSES].includes(status)
  ) {
    return jsonError("פילטר הסטטוס אינו תקין.", 400);
  }
  if (!CONTENT_SORTS.includes(sort as ContentSort)) {
    return jsonError("אפשרות המיון אינה תקינה.", 400);
  }

  let query = context.supabase
    .from("business_center_content_items")
    .select(CONTENT_SELECT, { count: "exact" })
    .eq("user_id", context.user.id);

  if (status === "active") {
    query = query.in("status", ["draft", "published"]);
  } else if (status !== "all") {
    query = query.eq("status", status as ContentStatus);
  }

  if (platform) {
    query = query.eq("platform", platform as ContentPlatform);
  }
  if (contentType) {
    query = query.eq("content_type", contentType as ContentType);
  }
  if (month) {
    query = query
      .gte("published_on", `${month}-01`)
      .lt("published_on", `${getNextMonth(month)}-01`);
  }
  if (search) {
    const pattern = `%${search}%`;
    query = query.or(
      `title.ilike.${pattern},topic.ilike.${pattern},promoted_product.ilike.${pattern},campaign_source.ilike.${pattern}`,
    );
  }

  if (sort === "views") {
    query = query
      .order("views_count", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  } else {
    const ascending = sort === "oldest";
    query = query
      .order("published_on", { ascending, nullsFirst: false })
      .order("created_at", { ascending })
      .order("id", { ascending });
  }

  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset)) {
    return jsonError("מספר העמוד אינו תקין.", 400);
  }
  const result = await query.range(offset, offset + pageSize - 1);

  if (result.error) {
    return databaseErrorResponse(result.error, "BUSINESS_CENTER_CONTENT_LIST_FAILED");
  }

  const total = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const contentItems = result.data ?? [];
  const attributionCounts = await getAttributionCounts(
    context.supabase,
    context.user.id,
    contentItems.map((item) => item.id),
  );

  return NextResponse.json(
    {
      filters: {
        contentType: contentType || null,
        month: month || null,
        platform: platform || null,
        search,
        sort,
        status,
      },
      items: contentItems.map((item) => {
        const counts = attributionCounts.counts.get(item.id);
        return {
          ...item,
          lead_attribution: attributionCounts.availability.available
            ? {
                attributed_leads: counts?.attributedLeads ?? 0,
                current_won: counts?.currentWon ?? 0,
              }
            : null,
        };
      }),
      leadAttribution: attributionCounts.availability,
      page,
      pageSize,
      total,
      totalPages,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: Request) {
  const context = await getContext();
  if ("error" in context) {
    return context.error;
  }

  const body = await getBody(request);
  if (!body) {
    return jsonError("בקשה לא תקינה.", 400);
  }

  const parsed = validateContentInput(body);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  if (parsed.data.content_url) {
    const duplicate = await findDuplicate(
      context.supabase,
      context.user.id,
      parsed.data.platform,
      parsed.data.content_url,
    );
    if (duplicate.error) {
      return databaseErrorResponse(
        duplicate.error,
        "BUSINESS_CENTER_CONTENT_DUPLICATE_CHECK_FAILED",
      );
    }
    if (duplicate.data) {
      return jsonError(
        "התוכן הזה כבר קיים עבור הפלטפורמה שנבחרה. אפשר לערוך את הרשומה הקיימת.",
        409,
        "CONTENT_DUPLICATE",
      );
    }
  }

  const hasMetrics = CONTENT_METRIC_FIELDS.some((field) => parsed.data[field] !== null);
  const insertPayload: ContentInsert = {
    ...parsed.data,
    metrics_updated_at: hasMetrics ? new Date().toISOString() : null,
    user_id: context.user.id,
  };
  const result = await context.supabase
    .from("business_center_content_items")
    .insert(insertPayload)
    .select(CONTENT_SELECT)
    .single();

  if (result.error) {
    return databaseErrorResponse(result.error, "BUSINESS_CENTER_CONTENT_CREATE_FAILED");
  }

  return NextResponse.json({ item: result.data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await getContext();
  if ("error" in context) {
    return context.error;
  }

  const body = await getBody(request);
  if (!body) {
    return jsonError("בקשה לא תקינה.", 400);
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!uuidPattern.test(id)) {
    return jsonError("מזהה התוכן אינו תקין.", 400);
  }

  const existingResult = await context.supabase
    .from("business_center_content_items")
    .select(CONTENT_SELECT)
    .eq("id", id)
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (existingResult.error) {
    return databaseErrorResponse(
      existingResult.error,
      "BUSINESS_CENTER_CONTENT_OWNERSHIP_CHECK_FAILED",
    );
  }
  if (!existingResult.data) {
    return jsonError("התוכן לא נמצא.", 404);
  }

  const existing = existingResult.data as ContentResultRow;
  const action = body.action;

  if (action === "archive" || action === "restore") {
    if (action === "restore" && existing.status !== "archived") {
      return jsonError("ניתן לשחזר רק תוכן שנמצא בארכיון.", 400);
    }

    const status: ContentStatus = action === "archive" ? "archived" : "draft";
    if (existing.status === status) {
      return NextResponse.json({ item: existing });
    }

    const result = await context.supabase
      .from("business_center_content_items")
      .update({ status })
      .eq("id", id)
      .eq("user_id", context.user.id)
      .select(CONTENT_SELECT)
      .single();

    if (result.error) {
      return databaseErrorResponse(
        result.error,
        action === "archive"
          ? "BUSINESS_CENTER_CONTENT_ARCHIVE_FAILED"
          : "BUSINESS_CENTER_CONTENT_RESTORE_FAILED",
      );
    }

    return NextResponse.json({ item: result.data });
  }

  if (action !== undefined) {
    return jsonError("פעולת התוכן אינה תקינה.", 400);
  }

  const parsed = validateContentInput(body);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  if (parsed.data.content_url) {
    const duplicate = await findDuplicate(
      context.supabase,
      context.user.id,
      parsed.data.platform,
      parsed.data.content_url,
      id,
    );
    if (duplicate.error) {
      return databaseErrorResponse(
        duplicate.error,
        "BUSINESS_CENTER_CONTENT_DUPLICATE_CHECK_FAILED",
      );
    }
    if (duplicate.data) {
      return jsonError(
        "התוכן הזה כבר קיים עבור הפלטפורמה שנבחרה. אפשר לערוך את הרשומה הקיימת.",
        409,
        "CONTENT_DUPLICATE",
      );
    }
  }

  const currentMetrics = Object.fromEntries(
    CONTENT_METRIC_FIELDS.map((field) => [field, existing[field]]),
  ) as Record<ContentMetricField, number | null>;
  const updatePayload: ContentUpdate = { ...parsed.data };

  if (contentMetricsChanged(currentMetrics, parsed.data)) {
    updatePayload.metrics_updated_at = new Date().toISOString();
  }

  const result = await context.supabase
    .from("business_center_content_items")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", context.user.id)
    .select(CONTENT_SELECT)
    .single();

  if (result.error) {
    return databaseErrorResponse(result.error, "BUSINESS_CENTER_CONTENT_UPDATE_FAILED");
  }

  return NextResponse.json({ item: result.data });
}
