import { normalizeTaskStatus } from "../tasks";

export const SALES_INTELLIGENCE_CACHE_CONTROL = "no-store, max-age=0";
export const SALES_INTELLIGENCE_TIMEZONE = "Asia/Jerusalem";
export const SALES_INTELLIGENCE_MAX_SEARCH_RESULTS = 10;
export const SALES_INTELLIGENCE_MAX_TIMELINE_ITEMS = 50;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEARCH_PARAMS = new Set(["q", "limit"]);
const DETAIL_PARAMS = new Set(["timeline_limit"]);
const ACTIVE_TASK_STATUSES = new Set(["פתוחה", "בתהליך", "נדחתה"]);

export type SalesIntelligenceSearchKind = "email" | "name" | "phone";
export type SalesIntelligenceMatchKind =
  | "exact_email"
  | "exact_name"
  | "exact_phone"
  | "name_contains"
  | "name_prefix";

export type SalesIntelligenceSearchInput = {
  kind: SalesIntelligenceSearchKind;
  limit: number;
  normalizedQuery: string;
  query: string;
};

export type SalesIntelligenceSearchRow = {
  email: string | null;
  full_name: string;
  id: string;
  phone: string | null;
  source: string | null;
  status: string | null;
  updated_at: string | null;
  user_id: string;
};

export type SalesIntelligenceLeadRow = {
  closed_at: string | null;
  created_at: string;
  full_name: string;
  id: string;
  last_contact_date: string | null;
  next_action_date: string | null;
  next_action_type: string | null;
  notes: string | null;
  priority: string | null;
  reason_not_closed: string | null;
  source: string | null;
  status: string | null;
  updated_at: string | null;
  user_id: string;
  value: number | null;
};

export type SalesIntelligenceTaskRow = {
  completed_at: string | null;
  created_at: string;
  deleted_at: string | null;
  description: string | null;
  due_date: string | null;
  id: string;
  is_automated: boolean | null;
  linked_lead_id: string | null;
  priority: string | null;
  status: string;
  title: string;
  user_id: string;
};

export type SalesIntelligenceActivityRow = {
  activity_type: string;
  created_at: string;
  direction: string | null;
  id: string;
  lead_id: string;
  occurred_at: string;
  outcome: string | null;
  source: string;
  summary: string | null;
  user_id: string;
};

export type SalesIntelligenceSourceRow = {
  campaign_name: string | null;
  form_name: string | null;
  lead_id: string;
  provider: string;
  received_at: string | null;
  submitted_at: string | null;
  user_id: string;
};

export type SalesIntelligenceSearchResponse = {
  generated_at: string;
  has_more: boolean;
  match_count: number;
  matches: Array<{
    display_name: string;
    email_hint: string | null;
    lead_id: string;
    match_kind: SalesIntelligenceMatchKind;
    phone_hint: string | null;
    source: string | null;
    status: string | null;
    updated_at: string | null;
  }>;
  timezone: typeof SALES_INTELLIGENCE_TIMEZONE;
};

function hasOnlyAllowedParams(searchParams: URLSearchParams, allowed: Set<string>) {
  return [...searchParams.keys()].every((key) => allowed.has(key));
}

function parseBoundedInteger(value: string | null, fallback: number, maximum: number) {
  if (value === null || value === "") {
    return fallback;
  }

  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

export function normalizeSalesIntelligencePhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) {
    return digits.slice(2);
  }

  if (digits.startsWith("0") && digits.length >= 9) {
    return `972${digits.slice(1)}`;
  }

  return digits;
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("he-IL");
}

export function parseSalesIntelligenceSearch(searchParams: URLSearchParams):
  | { input: SalesIntelligenceSearchInput; ok: true }
  | { error: string; ok: false } {
  if (!hasOnlyAllowedParams(searchParams, SEARCH_PARAMS)) {
    return { error: "Unsupported query parameter", ok: false };
  }

  const query = searchParams.get("q")?.trim().replace(/\s+/g, " ") ?? "";
  if (query.length < 2 || query.length > 100 || /[\u0000-\u001f\u007f]/.test(query)) {
    return { error: "q must contain 2 to 100 valid characters", ok: false };
  }

  const limit = parseBoundedInteger(searchParams.get("limit"), 5, SALES_INTELLIGENCE_MAX_SEARCH_RESULTS);
  if (limit === null) {
    return { error: "limit must be an integer between 1 and 10", ok: false };
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query)) {
    return { input: { kind: "email", limit, normalizedQuery: query.toLowerCase(), query }, ok: true };
  }

  if (/^[+\d().\s-]+$/.test(query)) {
    const normalizedPhone = normalizeSalesIntelligencePhone(query);
    if (normalizedPhone.length < 8 || normalizedPhone.length > 15) {
      return { error: "q does not contain a valid phone number", ok: false };
    }
    return { input: { kind: "phone", limit, normalizedQuery: normalizedPhone, query }, ok: true };
  }

  return { input: { kind: "name", limit, normalizedQuery: normalizeName(query), query }, ok: true };
}

export function parseSalesIntelligenceDetailRequest(
  leadId: string,
  searchParams: URLSearchParams,
): { input: { leadId: string; timelineLimit: number }; ok: true } | { error: string; ok: false } {
  if (!UUID_PATTERN.test(leadId)) {
    return { error: "lead_id must be a valid UUID", ok: false };
  }

  if (!hasOnlyAllowedParams(searchParams, DETAIL_PARAMS)) {
    return { error: "Unsupported query parameter", ok: false };
  }

  const timelineLimit = parseBoundedInteger(
    searchParams.get("timeline_limit"),
    30,
    SALES_INTELLIGENCE_MAX_TIMELINE_ITEMS,
  );
  if (timelineLimit === null) {
    return { error: "timeline_limit must be an integer between 1 and 50", ok: false };
  }

  return { input: { leadId, timelineLimit }, ok: true };
}

function maskPhone(value: string | null) {
  const digits = normalizeSalesIntelligencePhone(value);
  return digits.length >= 4 ? `***${digits.slice(-4)}` : null;
}

function maskEmail(value: string | null) {
  if (!value) {
    return null;
  }

  const [local, domain] = value.split("@");
  if (!local || !domain) {
    return null;
  }

  const domainParts = domain.split(".");
  const host = domainParts.shift() ?? "";
  const suffix = domainParts.length ? `.${domainParts.join(".")}` : "";
  return `${local.slice(0, 1)}***@${host.slice(0, 1)}***${suffix}`;
}

export function sanitizeSalesIntelligenceText(value: string | null | undefined, maximum: number) {
  if (!value) {
    return null;
  }

  const sanitized = value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  return sanitized ? sanitized.slice(0, maximum) : null;
}

function getMatchKind(row: SalesIntelligenceSearchRow, input: SalesIntelligenceSearchInput) {
  if (input.kind === "email") {
    return row.email?.trim().toLowerCase() === input.normalizedQuery ? "exact_email" : null;
  }

  if (input.kind === "phone") {
    return normalizeSalesIntelligencePhone(row.phone) === input.normalizedQuery ? "exact_phone" : null;
  }

  const name = normalizeName(row.full_name);
  if (name === input.normalizedQuery) {
    return "exact_name";
  }
  if (name.startsWith(input.normalizedQuery)) {
    return "name_prefix";
  }
  return name.includes(input.normalizedQuery) ? "name_contains" : null;
}

const MATCH_RANK: Record<SalesIntelligenceMatchKind, number> = {
  exact_email: 0,
  exact_phone: 0,
  exact_name: 1,
  name_prefix: 2,
  name_contains: 3,
};

function dateTimeOrZero(value: string | null) {
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : 0;
}

function dateTimeOrMax(value: string | null) {
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

export function buildSalesIntelligenceSearchResponse(
  rows: SalesIntelligenceSearchRow[],
  tenantUserId: string,
  input: SalesIntelligenceSearchInput,
  now: Date = new Date(),
): SalesIntelligenceSearchResponse {
  const matches = rows
    .filter((row) => row.user_id === tenantUserId)
    .map((row) => ({ matchKind: getMatchKind(row, input), row }))
    .filter((candidate): candidate is { matchKind: SalesIntelligenceMatchKind; row: SalesIntelligenceSearchRow } =>
      candidate.matchKind !== null,
    )
    .sort((left, right) =>
      MATCH_RANK[left.matchKind] - MATCH_RANK[right.matchKind] ||
      dateTimeOrZero(right.row.updated_at) - dateTimeOrZero(left.row.updated_at) ||
      left.row.id.localeCompare(right.row.id),
    );

  return {
    generated_at: now.toISOString(),
    has_more: matches.length > input.limit,
    match_count: matches.length,
    matches: matches.slice(0, input.limit).map(({ matchKind, row }) => ({
      display_name: sanitizeSalesIntelligenceText(row.full_name, 160) ?? "ליד ללא שם",
      email_hint: maskEmail(row.email),
      lead_id: row.id,
      match_kind: matchKind,
      phone_hint: maskPhone(row.phone),
      source: sanitizeSalesIntelligenceText(row.source, 120),
      status: sanitizeSalesIntelligenceText(row.status, 120),
      updated_at: row.updated_at,
    })),
    timezone: SALES_INTELLIGENCE_TIMEZONE,
  };
}

function isValidTimestamp(value: string | null | undefined) {
  return Boolean(value && Number.isFinite(new Date(value).getTime()));
}

export function buildSalesIntelligenceDetail({
  activities,
  lead,
  leadId,
  now = new Date(),
  source,
  tasks,
  tenantUserId,
  timelineLimit,
  timelineReliableFrom,
}: {
  activities: SalesIntelligenceActivityRow[];
  lead: SalesIntelligenceLeadRow;
  leadId: string;
  now?: Date;
  source: SalesIntelligenceSourceRow | null;
  tasks: SalesIntelligenceTaskRow[];
  tenantUserId: string;
  timelineLimit: number;
  timelineReliableFrom?: string | null;
}) {
  if (lead.id !== leadId || lead.user_id !== tenantUserId) {
    return null;
  }

  const verifiedActivities = activities
    .filter((activity) =>
      activity.user_id === tenantUserId &&
      activity.lead_id === leadId &&
      isValidTimestamp(activity.occurred_at),
    )
    .sort((left, right) =>
      new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime() ||
      right.id.localeCompare(left.id),
    );

  const timeline = verifiedActivities.map((activity) => ({
    direction: activity.direction,
    event_type: activity.activity_type,
    occurred_at: activity.occurred_at,
    outcome: sanitizeSalesIntelligenceText(activity.outcome, 500),
    provenance: `lead_sales_activities:${activity.source}`,
    reliability: "high" as const,
    summary: sanitizeSalesIntelligenceText(activity.summary, 500),
  }));

  if (isValidTimestamp(lead.created_at)) {
    timeline.push({
      direction: null,
      event_type: "lead_created",
      occurred_at: lead.created_at,
      outcome: null,
      provenance: "leads.created_at",
      reliability: "high",
      summary: null,
    });
  }

  timeline.sort((left, right) => new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime());
  const timelineTruncated = timeline.length > timelineLimit;
  const boundedTimeline = timeline.slice(0, timelineLimit);
  const tenantSource = source?.user_id === tenantUserId && source.lead_id === leadId ? source : null;
  const openTasks = tasks
    .filter((task) =>
      task.user_id === tenantUserId &&
      task.linked_lead_id === leadId &&
      !task.deleted_at &&
      !task.completed_at &&
      ACTIVE_TASK_STATUSES.has(normalizeTaskStatus(task.status)),
    )
    .sort((left, right) =>
      dateTimeOrMax(left.due_date) - dateTimeOrMax(right.due_date) ||
      left.created_at.localeCompare(right.created_at) ||
      left.id.localeCompare(right.id),
    )
    .slice(0, 10)
    .map((task) => ({
      created_at: task.created_at,
      description: sanitizeSalesIntelligenceText(task.description, 500),
      due_at: task.due_date,
      is_automated: Boolean(task.is_automated),
      priority: sanitizeSalesIntelligenceText(task.priority, 80),
      status: normalizeTaskStatus(task.status),
      task_id: task.id,
      title: sanitizeSalesIntelligenceText(task.title, 200) ?? "משימה ללא כותרת",
    }));

  const activityTypes = new Set(verifiedActivities.map((activity) => activity.activity_type));
  const missing = [];
  if (!activityTypes.has("call_completed")) missing.push("sales_call_outcome");
  if (!activityTypes.has("objection_recorded")) missing.push("objection");
  if (!verifiedActivities.some((activity) => activity.direction === "inbound" || activity.direction === "outbound")) {
    missing.push("waiting_party");
  }

  const warnings = [];
  if (lead.last_contact_date) {
    warnings.push("legacy_last_contact_at is not proof of a sales interaction");
  }
  if (!verifiedActivities.length) {
    warnings.push("No verified sales activity history is available for this lead");
  }

  const reliableTimes = verifiedActivities.map((activity) => new Date(activity.occurred_at).getTime());
  const reliableFrom = isValidTimestamp(timelineReliableFrom)
    ? timelineReliableFrom
    : reliableTimes.length
      ? new Date(Math.min(...reliableTimes)).toISOString()
      : null;
  const dealValue = typeof lead.value === "number" && Number.isFinite(lead.value) && lead.value > 0 ? lead.value : null;

  const response = {
    data_quality: {
      missing,
      timeline_reliable_from: reliableFrom,
      warnings,
    },
    generated_at: now.toISOString(),
    lead: {
      closed_at: lead.closed_at,
      created_at: lead.created_at,
      crm_priority: sanitizeSalesIntelligenceText(lead.priority, 80),
      current_note: sanitizeSalesIntelligenceText(lead.notes, 2_000),
      deal_value: dealValue,
      display_name: sanitizeSalesIntelligenceText(lead.full_name, 160) ?? "ליד ללא שם",
      lead_id: lead.id,
      pipeline_stage: sanitizeSalesIntelligenceText(lead.status, 120),
      reason_not_closed: sanitizeSalesIntelligenceText(lead.reason_not_closed, 500),
      source: sanitizeSalesIntelligenceText(lead.source, 120),
      status: sanitizeSalesIntelligenceText(lead.status, 120),
    },
    open_tasks: openTasks,
    sales_state: {
      last_verified_sales_activity_at: verifiedActivities[0]?.occurred_at ?? null,
      legacy_last_contact_at: lead.last_contact_date,
      legacy_last_contact_reliability: "low" as const,
      next_step: lead.next_action_date || lead.next_action_type
        ? {
            due_at: lead.next_action_date,
            source: "lead_record" as const,
            type: sanitizeSalesIntelligenceText(lead.next_action_type, 80),
          }
        : null,
    },
    source_context: tenantSource
      ? {
          campaign_name: sanitizeSalesIntelligenceText(tenantSource.campaign_name, 240),
          form_name: sanitizeSalesIntelligenceText(tenantSource.form_name, 240),
          provider: sanitizeSalesIntelligenceText(tenantSource.provider, 80),
          received_at: tenantSource.received_at,
          submitted_at: tenantSource.submitted_at,
        }
      : null,
    timeline: boundedTimeline,
    timeline_truncated: timelineTruncated,
    timezone: SALES_INTELLIGENCE_TIMEZONE,
  };

  const encoder = new TextEncoder();
  while (encoder.encode(JSON.stringify(response)).byteLength > 64 * 1024 && response.timeline.length > 0) {
    response.timeline.pop();
    response.timeline_truncated = true;
  }

  return response;
}
