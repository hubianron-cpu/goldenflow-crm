import { NextResponse } from "next/server";
import {
  ATTRIBUTABLE_CONTENT_STATUSES,
  isMissingAttributionTable,
  isUuid,
  sanitizeAttributionSearch,
  validateAttributionInput,
  type ContentAttributionOption,
  type LeadContentAttribution,
} from "@/lib/business-center/content-attribution";
import { hasSupabaseEnv } from "@/lib/env";
import { requireSubscriptionAccess } from "@/lib/subscription-guard";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AttributionInsert =
  Database["public"]["Tables"]["business_center_lead_attributions"]["Insert"];
type ContentRow =
  Database["public"]["Tables"]["business_center_content_items"]["Row"];
type RouteContext = {
  params: Promise<{ leadId: string }>;
};

type AttributionQueryRow = {
  attribution_notes: string | null;
  content_item: ContentAttributionOption | ContentAttributionOption[] | null;
  content_item_id: string;
  id: string;
};

const CONTENT_OPTION_SELECT =
  "id, title, platform, content_type, published_on, status";
const ATTRIBUTION_SELECT = `
  id,
  content_item_id,
  attribution_notes,
  content_item:business_center_content_items!business_center_lead_attributions_content_item_id_fkey (
    id,
    title,
    platform,
    content_type,
    published_on,
    status
  )
`;

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ code, error: message }, { status });
}

function logDatabaseError(
  event: string,
  error: { code?: string; details?: string; hint?: string; message?: string },
) {
  console.error(event, {
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    message: error.message ?? null,
  });
}

function databaseErrorResponse(
  error: { code?: string; details?: string; hint?: string; message?: string },
  event: string,
) {
  logDatabaseError(event, error);

  if (isMissingAttributionTable(error)) {
    return jsonError(
      "שיוך תוכן ללידים עדיין לא הופעל במסד הנתונים.",
      503,
      "CONTENT_ATTRIBUTION_NOT_INSTALLED",
    );
  }

  if (error.code === "42501") {
    return jsonError("אין הרשאה לבצע את פעולת השיוך.", 403);
  }

  if (error.code === "23505") {
    return jsonError(
      "כבר קיים שיוך לליד הזה. רעננו את האזור ונסו שוב.",
      409,
      "CONTENT_ATTRIBUTION_CONFLICT",
    );
  }

  if (error.code === "23503") {
    return jsonError(
      "התוכן שנבחר אינו זמין עוד. בחרו תוכן אחר.",
      409,
      "CONTENT_ATTRIBUTION_CONTENT_UNAVAILABLE",
    );
  }

  return jsonError("לא הצלחנו להשלים את פעולת השיוך. נסו שוב.", 500);
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
    return { error: jsonError("יש להתחבר כדי לנהל שיוך תוכן ללידים.", 401) };
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

function getRelatedContent(
  value: AttributionQueryRow["content_item"],
): ContentAttributionOption | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function toAttribution(row: AttributionQueryRow | null): LeadContentAttribution | null {
  if (!row) {
    return null;
  }

  return {
    attribution_notes: row.attribution_notes,
    content_item: getRelatedContent(row.content_item),
    content_item_id: row.content_item_id,
    id: row.id,
  };
}

async function getOwnedLead(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  leadId: string,
  userId: string,
) {
  return supabase
    .from("leads")
    .select("id, source")
    .eq("id", leadId)
    .eq("user_id", userId)
    .maybeSingle();
}

export async function GET(request: Request, routeContext: RouteContext) {
  const context = await getContext();
  if ("error" in context) {
    return context.error;
  }

  const { leadId } = await routeContext.params;
  if (!isUuid(leadId)) {
    return jsonError("מזהה הליד אינו תקין.", 400);
  }

  const leadResult = await getOwnedLead(
    context.supabase,
    leadId,
    context.user.id,
  );
  if (leadResult.error) {
    return databaseErrorResponse(
      leadResult.error,
      "CONTENT_ATTRIBUTION_LEAD_CHECK_FAILED",
    );
  }
  if (!leadResult.data) {
    return jsonError("הליד לא נמצא.", 404);
  }

  const search = sanitizeAttributionSearch(
    new URL(request.url).searchParams.get("search") ?? "",
  );
  let optionsQuery = context.supabase
    .from("business_center_content_items")
    .select(CONTENT_OPTION_SELECT)
    .eq("user_id", context.user.id)
    .in("status", [...ATTRIBUTABLE_CONTENT_STATUSES])
    .order("published_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (search) {
    const pattern = `%${search}%`;
    optionsQuery = optionsQuery.or(
      `title.ilike.${pattern},topic.ilike.${pattern},promoted_product.ilike.${pattern},campaign_source.ilike.${pattern}`,
    );
  }

  const [attributionResult, optionsResult] = await Promise.all([
    context.supabase
      .from("business_center_lead_attributions")
      .select(ATTRIBUTION_SELECT)
      .eq("lead_id", leadId)
      .eq("user_id", context.user.id)
      .maybeSingle(),
    optionsQuery,
  ]);

  if (attributionResult.error) {
    return databaseErrorResponse(
      attributionResult.error,
      "CONTENT_ATTRIBUTION_LOAD_FAILED",
    );
  }
  if (optionsResult.error) {
    return databaseErrorResponse(
      optionsResult.error,
      "CONTENT_ATTRIBUTION_OPTIONS_LOAD_FAILED",
    );
  }

  return NextResponse.json(
    {
      attribution: toAttribution(
        attributionResult.data as unknown as AttributionQueryRow | null,
      ),
      leadSource: leadResult.data.source,
      options: (optionsResult.data ?? []) as ContentAttributionOption[],
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function PATCH(request: Request, routeContext: RouteContext) {
  const context = await getContext();
  if ("error" in context) {
    return context.error;
  }

  const { leadId } = await routeContext.params;
  if (!isUuid(leadId)) {
    return jsonError("מזהה הליד אינו תקין.", 400);
  }

  const body = await getBody(request);
  if (!body) {
    return jsonError("בקשה לא תקינה.", 400);
  }

  const parsed = validateAttributionInput(body);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  const leadResult = await getOwnedLead(
    context.supabase,
    leadId,
    context.user.id,
  );
  if (leadResult.error) {
    return databaseErrorResponse(
      leadResult.error,
      "CONTENT_ATTRIBUTION_LEAD_CHECK_FAILED",
    );
  }
  if (!leadResult.data) {
    return jsonError("הליד לא נמצא.", 404);
  }

  const contentResult = await context.supabase
    .from("business_center_content_items")
    .select(CONTENT_OPTION_SELECT)
    .eq("id", parsed.data.content_item_id)
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (contentResult.error) {
    return databaseErrorResponse(
      contentResult.error,
      "CONTENT_ATTRIBUTION_CONTENT_CHECK_FAILED",
    );
  }
  if (!contentResult.data) {
    return jsonError("התוכן שנבחר לא נמצא.", 404);
  }

  const content = contentResult.data as Pick<
    ContentRow,
    "content_type" | "id" | "platform" | "published_on" | "status" | "title"
  >;

  if (!ATTRIBUTABLE_CONTENT_STATUSES.includes(
    content.status as (typeof ATTRIBUTABLE_CONTENT_STATUSES)[number],
  )) {
    const existingResult = await context.supabase
      .from("business_center_lead_attributions")
      .select("content_item_id")
      .eq("lead_id", leadId)
      .eq("user_id", context.user.id)
      .maybeSingle();

    if (existingResult.error) {
      return databaseErrorResponse(
        existingResult.error,
        "CONTENT_ATTRIBUTION_EXISTING_CHECK_FAILED",
      );
    }
    if (existingResult.data?.content_item_id !== content.id) {
      return jsonError("ניתן לשייך רק תוכן שפורסם או הועבר לארכיון.", 400);
    }
  }
  const selectedContent = content as ContentAttributionOption;

  const payload: AttributionInsert = {
    attribution_notes: parsed.data.attribution_notes,
    content_item_id: parsed.data.content_item_id,
    lead_id: leadId,
    user_id: context.user.id,
  };
  const result = await context.supabase
    .from("business_center_lead_attributions")
    .upsert(payload, { onConflict: "user_id,lead_id" })
    .select("id, content_item_id, attribution_notes")
    .single();

  if (result.error) {
    return databaseErrorResponse(
      result.error,
      "CONTENT_ATTRIBUTION_SAVE_FAILED",
    );
  }

  return NextResponse.json({
    attribution: {
      attribution_notes: result.data.attribution_notes,
      content_item: selectedContent,
      content_item_id: result.data.content_item_id,
      id: result.data.id,
    } satisfies LeadContentAttribution,
  });
}

export async function DELETE(_request: Request, routeContext: RouteContext) {
  const context = await getContext();
  if ("error" in context) {
    return context.error;
  }

  const { leadId } = await routeContext.params;
  if (!isUuid(leadId)) {
    return jsonError("מזהה הליד אינו תקין.", 400);
  }

  const leadResult = await getOwnedLead(
    context.supabase,
    leadId,
    context.user.id,
  );
  if (leadResult.error) {
    return databaseErrorResponse(
      leadResult.error,
      "CONTENT_ATTRIBUTION_LEAD_CHECK_FAILED",
    );
  }
  if (!leadResult.data) {
    return jsonError("הליד לא נמצא.", 404);
  }

  const result = await context.supabase
    .from("business_center_lead_attributions")
    .delete()
    .eq("lead_id", leadId)
    .eq("user_id", context.user.id)
    .select("id")
    .maybeSingle();

  if (result.error) {
    return databaseErrorResponse(
      result.error,
      "CONTENT_ATTRIBUTION_DELETE_FAILED",
    );
  }

  return NextResponse.json({
    removed: Boolean(result.data),
  });
}
