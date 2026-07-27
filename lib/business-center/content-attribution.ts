import {
  getBusinessCenterMonthBounds,
  type BusinessCenterLeadSource,
} from "@/lib/business-center/lead-analytics";
import type { ContentType } from "@/lib/business-center/content";
import { normalizeLeadStatus } from "@/lib/leads";

export const ATTRIBUTION_NOTES_MAX_LENGTH = 500;
export const ATTRIBUTABLE_CONTENT_STATUSES = ["published", "archived"] as const;

export type AttributableContentStatus = (typeof ATTRIBUTABLE_CONTENT_STATUSES)[number];

export type ContentAttributionOption = {
  content_type: ContentType;
  id: string;
  platform: string;
  published_on: string | null;
  status: "draft" | AttributableContentStatus;
  title: string;
};

export type LeadContentAttribution = {
  attribution_notes: string | null;
  content_item: ContentAttributionOption | null;
  content_item_id: string;
  id: string;
};

export type ContentAttributionAnalyticsRow = {
  content_item: Omit<ContentAttributionOption, "status"> | null;
  content_item_id: string;
  lead_id: string;
};

export type ContentAttributionAnalytics =
  | {
      available: false;
      reason: "load_failed" | "not_installed";
    }
  | {
      attributedLeads: number;
      attributionCoverage: number | null;
      available: true;
      contentWithLeads: number;
      leadSources: Array<{
        count: number;
        name: string;
        percentage: number;
      }>;
      topContent: Array<{
        attributedLeads: number;
        contentItemId: string;
        currentCloseRatio: number;
        currentIrrelevant: number;
        currentOpen: number;
        currentWon: number;
        platform: string;
        publishedOn: string | null;
        title: string;
      }>;
      totalLeads: number;
      unattributedLeads: number;
    };

export type AttributionValidationResult =
  | {
      data: {
        attribution_notes: string | null;
        content_item_id: string;
      };
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function roundPercentage(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return Math.round(Math.min(100, Math.max(0, safeValue)) * 10) / 10;
}

function getPublishedOnTime(value: string | null) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = Date.parse(`${value}T12:00:00.000Z`);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function getCurrentStatusGroup(status: string) {
  const normalized = normalizeLeadStatus(status);

  if (normalized === "נסגר בהצלחה") {
    return "won" as const;
  }

  if (normalized === "לא רלוונטי") {
    return "irrelevant" as const;
  }

  return "open" as const;
}

export function isUuid(value: string) {
  return uuidPattern.test(value);
}

export function sanitizeAttributionSearch(value: string) {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

export function isMissingAttributionTable(error: {
  code?: string;
  details?: string;
  message?: string;
}) {
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();

  return (
    error.code === "42P01" ||
    error.code === "PGRST200" ||
    error.code === "PGRST205" ||
    (message.includes("business_center_lead_attributions") &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find the table")))
  );
}

export function validateAttributionInput(
  record: Record<string, unknown>,
): AttributionValidationResult {
  const allowedKeys = new Set(["attribution_notes", "content_item_id"]);
  if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
    return { error: "הבקשה כוללת שדות שאינם נתמכים.", ok: false };
  }

  const rawContentItemId = record.content_item_id;
  const contentItemId =
    typeof rawContentItemId === "string" ? rawContentItemId.trim() : "";

  if (!isUuid(contentItemId)) {
    return { error: "בחירת התוכן אינה תקינה.", ok: false };
  }

  if (
    record.attribution_notes !== undefined &&
    record.attribution_notes !== null &&
    typeof record.attribution_notes !== "string"
  ) {
    return { error: "הערת השיוך אינה תקינה.", ok: false };
  }

  const notes =
    typeof record.attribution_notes === "string"
      ? record.attribution_notes.trim()
      : "";

  if (notes.length > ATTRIBUTION_NOTES_MAX_LENGTH) {
    return {
      error: `הערת השיוך יכולה להכיל עד ${ATTRIBUTION_NOTES_MAX_LENGTH} תווים.`,
      ok: false,
    };
  }

  return {
    data: {
      attribution_notes: notes || null,
      content_item_id: contentItemId,
    },
    ok: true,
  };
}

export function buildContentAttributionAnalytics(
  leads: Array<BusinessCenterLeadSource & { source: string }>,
  rows: ContentAttributionAnalyticsRow[],
  monthStart: string,
): Extract<ContentAttributionAnalytics, { available: true }> {
  const bounds = getBusinessCenterMonthBounds(monthStart);
  const monthlyLeads = leads.filter((lead) => {
    const createdAt = new Date(lead.created_at).getTime();
    return createdAt >= bounds.currentStart && createdAt < bounds.currentEnd;
  });
  const monthlyLeadById = new Map(monthlyLeads.map((lead) => [lead.id, lead]));
  const attributedByLead = new Map<string, ContentAttributionAnalyticsRow>();

  for (const row of rows) {
    if (
      row.content_item_id &&
      monthlyLeadById.has(row.lead_id) &&
      !attributedByLead.has(row.lead_id)
    ) {
      attributedByLead.set(row.lead_id, row);
    }
  }

  const contentTotals = new Map<
    string,
    {
      attributedLeads: number;
      currentIrrelevant: number;
      currentOpen: number;
      currentWon: number;
      platform: string;
      publishedOn: string | null;
      title: string;
    }
  >();

  for (const [leadId, row] of attributedByLead) {
    const lead = monthlyLeadById.get(leadId);
    if (!lead || !row.content_item_id) {
      continue;
    }

    const current = contentTotals.get(row.content_item_id) ?? {
      attributedLeads: 0,
      currentIrrelevant: 0,
      currentOpen: 0,
      currentWon: 0,
      platform: row.content_item?.platform ?? "Other",
      publishedOn: row.content_item?.published_on ?? null,
      title: row.content_item?.title ?? "תוכן לא זמין",
    };
    const statusGroup = getCurrentStatusGroup(lead.status);
    current.attributedLeads += 1;
    current.currentWon += statusGroup === "won" ? 1 : 0;
    current.currentIrrelevant += statusGroup === "irrelevant" ? 1 : 0;
    current.currentOpen += statusGroup === "open" ? 1 : 0;
    contentTotals.set(row.content_item_id, current);
  }

  const sourceTotals = new Map<string, number>();
  for (const lead of monthlyLeads) {
    const source = lead.source.trim() || "לא ידוע";
    sourceTotals.set(source, (sourceTotals.get(source) ?? 0) + 1);
  }

  const totalLeads = monthlyLeads.length;
  const attributedLeads = attributedByLead.size;

  return {
    attributedLeads,
    attributionCoverage:
      totalLeads > 0 ? roundPercentage((attributedLeads / totalLeads) * 100) : null,
    available: true,
    contentWithLeads: contentTotals.size,
    leadSources: Array.from(sourceTotals, ([name, count]) => ({
      count,
      name,
      percentage: totalLeads > 0 ? roundPercentage((count / totalLeads) * 100) : 0,
    }))
      .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name, "he"))
      .slice(0, 5),
    topContent: Array.from(contentTotals, ([contentItemId, content]) => ({
      ...content,
      contentItemId,
      currentCloseRatio:
        content.attributedLeads > 0
          ? roundPercentage((content.currentWon / content.attributedLeads) * 100)
          : 0,
    }))
      .sort(
        (first, second) =>
          second.attributedLeads - first.attributedLeads ||
          getPublishedOnTime(second.publishedOn) -
            getPublishedOnTime(first.publishedOn) ||
          first.contentItemId.localeCompare(second.contentItemId),
      )
      .slice(0, 5),
    totalLeads,
    unattributedLeads: Math.max(0, totalLeads - attributedLeads),
  };
}
