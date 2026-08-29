import {
  isFinalLeadStatus,
  isLeadStatus,
  normalizeLeadStatus,
  type NextActionType,
} from "../leads";

export const LEAD_FOLLOWUPS_TIME_ZONE = "Asia/Jerusalem";
export const LEAD_FOLLOWUPS_CACHE_CONTROL = "no-store, max-age=0";
export const NEW_LEAD_GRACE_MINUTES = 60;
export const RECOVERY_STALE_DAYS = 14;
export const LEAD_FOLLOWUPS_DEFAULT_LIMIT = 20;
export const LEAD_FOLLOWUPS_MAX_LIMIT = 100;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVE_TASK_STATUSES = new Set(["פתוחה", "בתהליך", "נדחתה", "open", "in_progress", "postponed"]);
const COMPLETED_TASK_STATUSES = new Set(["הושלמה", "done", "completed"]);
const EXTRA_TERMINAL_STATUSES = new Set([
  "disqualified",
  "archived",
  "deleted",
]);
const DISABLED_RULE_WARNINGS = [
  "proposal_no_next_step disabled: the current schema has no reliable proposal activity timestamp.",
  "sales_meeting_no_next_step disabled: the current schema has no meetings model.",
  "hot_lead_stalled disabled: the current schema has no reliable high-intent activity timestamp.",
];

export type FollowupType = "due" | "suggested" | "recovery";
export type FollowupPriority = "P1" | "P2" | "P3";
export type FollowupSourceRule =
  | "explicit_overdue_followup"
  | "explicit_followup_today"
  | "new_lead_no_contact"
  | "recovery";

export type LeadFollowupLead = {
  created_at: string;
  deal_probability: number | null;
  full_name: string;
  id: string;
  last_contact_date: string | null;
  next_action_date: string | null;
  next_action_type: string | null;
  priority: string | null;
  status: string;
  updated_at: string;
  user_id: string;
  value: number | null;
};

export type LeadFollowupTask = {
  completed_at: string | null;
  created_at: string;
  deleted_at: string | null;
  due_date: string | null;
  id: string;
  linked_lead_id: string | null;
  status: string;
  user_id: string;
};

export type LeadFollowupItem = {
  followup_type: FollowupType;
  last_meaningful_activity_at: string | null;
  lead_id: string;
  name: string;
  next_followup_at: string | null;
  pipeline_stage: string;
  primary_source_rule: FollowupSourceRule;
  priority: FollowupPriority;
  reason: string;
  recommended_action: string;
  score: number;
};

export type LeadFollowupCounts = {
  due: number;
  p1: number;
  p2: number;
  p3: number;
  recovery: number;
  suggested: number;
};

export type LeadFollowupResponse = {
  counts: LeadFollowupCounts;
  effective_date: string;
  generated_at: string;
  items: LeadFollowupItem[];
  timezone: typeof LEAD_FOLLOWUPS_TIME_ZONE;
  warnings: string[];
};

export type LeadFollowupRequestOptions = {
  date: string;
  includeRecovery: boolean;
  limit: number;
  priority: FollowupPriority | null;
};

type EvaluationInput = LeadFollowupRequestOptions & {
  generatedAt?: Date;
  leads: LeadFollowupLead[];
  tasks: LeadFollowupTask[];
  tenantUserId: string;
};

type Candidate = LeadFollowupItem & {
  dueTime: number;
};

type ParsedRequest =
  | { ok: true; options: LeadFollowupRequestOptions }
  | { error: string; ok: false };

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getDateParts(value: Date, timeZone = LEAD_FOLLOWUPS_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getDateTimeParts(value: Date, timeZone = LEAD_FOLLOWUPS_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });
  return Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<"day" | "hour" | "minute" | "month" | "second" | "year", number>;
}

function addCalendarDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function zonedStartOfDay(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const desired = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = desired;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getDateTimeParts(new Date(guess));
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour === 24 ? 0 : parts.hour,
      parts.minute,
      parts.second,
    );
    const adjustment = desired - represented;
    guess += adjustment;

    if (adjustment === 0) {
      break;
    }
  }

  return new Date(guess);
}

export function isValidDateKey(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function getJerusalemDateKey(value: Date = new Date()) {
  return getDateParts(value);
}

export function getJerusalemDayBounds(dateKey: string) {
  if (!isValidDateKey(dateKey)) {
    throw new Error("Invalid Jerusalem date key");
  }

  const start = zonedStartOfDay(dateKey);
  const end = zonedStartOfDay(addCalendarDays(dateKey, 1));
  return { end, start };
}

function getReferenceTime(dateKey: string, generatedAt: Date) {
  if (dateKey === getJerusalemDateKey(generatedAt)) {
    return generatedAt.getTime();
  }

  return getJerusalemDayBounds(dateKey).end.getTime() - 1;
}

function toTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function getCanonicalStage(status: string) {
  return isLeadStatus(status) ? normalizeLeadStatus(status) : null;
}

export function isTerminalLeadForFollowups(status: string | null | undefined) {
  const cleanStatus = (status ?? "").trim();
  return (
    isFinalLeadStatus(cleanStatus) ||
    EXTRA_TERMINAL_STATUSES.has(cleanStatus.toLowerCase())
  );
}

function getRecommendedAction(type: string | null) {
  const labels: Partial<Record<NextActionType, string>> = {
    call: "Call lead",
    "follow-up": "Contact lead",
    meeting: "Complete scheduled meeting follow-up",
    message: "Send follow-up message",
  };
  return labels[type as NextActionType] ?? "Contact lead";
}

function getPriorityRank(priority: FollowupPriority) {
  return { P1: 0, P2: 1, P3: 2 }[priority];
}

function getTypeRank(type: FollowupType) {
  return { due: 0, suggested: 1, recovery: 2 }[type];
}

function toPublicItem(candidate: Candidate): LeadFollowupItem {
  return {
    followup_type: candidate.followup_type,
    last_meaningful_activity_at: candidate.last_meaningful_activity_at,
    lead_id: candidate.lead_id,
    name: candidate.name,
    next_followup_at: candidate.next_followup_at,
    pipeline_stage: candidate.pipeline_stage,
    primary_source_rule: candidate.primary_source_rule,
    priority: candidate.priority,
    reason: candidate.reason,
    recommended_action: candidate.recommended_action,
    score: candidate.score,
  };
}

function getDateDifferenceInDays(earlierDateKey: string, laterDateKey: string) {
  const earlier = Date.parse(`${earlierDateKey}T00:00:00.000Z`);
  const later = Date.parse(`${laterDateKey}T00:00:00.000Z`);
  return Math.max(0, Math.floor((later - earlier) / 86_400_000));
}

function chooseExplicitDue(
  lead: LeadFollowupLead,
  tasks: LeadFollowupTask[],
  effectiveDate: string,
  endTime: number,
) {
  const candidates: Array<{ at: string; source: "lead" | "task" }> = [];
  const nextActionTime = toTime(lead.next_action_date);

  if (nextActionTime !== null && nextActionTime < endTime) {
    candidates.push({ at: lead.next_action_date as string, source: "lead" });
  }

  for (const task of tasks) {
    const dueTime = toTime(task.due_date);
    if (ACTIVE_TASK_STATUSES.has(task.status) && dueTime !== null && dueTime < endTime) {
      candidates.push({ at: task.due_date as string, source: "task" });
    }
  }

  candidates.sort((a, b) => (toTime(a.at) ?? 0) - (toTime(b.at) ?? 0) || a.source.localeCompare(b.source));
  const selected = candidates[0];

  if (!selected) {
    return null;
  }

  const dueDate = getJerusalemDateKey(new Date(selected.at));
  const overdue = dueDate < effectiveDate;
  const overdueDays = overdue ? getDateDifferenceInDays(dueDate, effectiveDate) : 0;

  return {
    at: selected.at,
    reason: overdue
      ? `Follow-up was due on ${dueDate} and remains incomplete.`
      : `Follow-up is due today (${effectiveDate}) and remains incomplete.`,
    rule: overdue
      ? ("explicit_overdue_followup" as const)
      : ("explicit_followup_today" as const),
    score: overdue ? Math.min(100, 94 + overdueDays) : 92,
    source: selected.source,
  };
}

function hasFutureOrOpenNextStep(tasks: LeadFollowupTask[], lead: LeadFollowupLead, endTime: number) {
  const leadNextActionTime = toTime(lead.next_action_date);
  if (leadNextActionTime !== null && leadNextActionTime >= endTime) {
    return true;
  }

  return tasks.some((task) => {
    if (!ACTIVE_TASK_STATUSES.has(task.status)) {
      return false;
    }

    const dueTime = toTime(task.due_date);
    return dueTime === null || dueTime >= endTime;
  });
}

function hasCompletedTaskToday(tasks: LeadFollowupTask[], effectiveDate: string) {
  return tasks.some(
    (task) =>
      COMPLETED_TASK_STATUSES.has(task.status) &&
      task.completed_at !== null &&
      getJerusalemDateKey(new Date(task.completed_at)) === effectiveDate,
  );
}

function createBaseItem(lead: LeadFollowupLead) {
  return {
    last_meaningful_activity_at: lead.last_contact_date,
    lead_id: lead.id,
    name: lead.full_name,
    pipeline_stage: getCanonicalStage(lead.status) ?? lead.status,
  };
}

export function parseLeadFollowupRequest(
  searchParams: URLSearchParams,
  now: Date = new Date(),
): ParsedRequest {
  const requestedDate = searchParams.get("date")?.trim() || getJerusalemDateKey(now);
  if (!isValidDateKey(requestedDate)) {
    return { error: "date must use YYYY-MM-DD format.", ok: false };
  }

  const rawLimit = searchParams.get("limit")?.trim();
  const limit = rawLimit ? Number(rawLimit) : LEAD_FOLLOWUPS_DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > LEAD_FOLLOWUPS_MAX_LIMIT) {
    return { error: `limit must be an integer between 1 and ${LEAD_FOLLOWUPS_MAX_LIMIT}.`, ok: false };
  }

  const rawPriority = searchParams.get("priority")?.trim().toUpperCase() || "";
  if (rawPriority && !["P1", "P2", "P3"].includes(rawPriority)) {
    return { error: "priority must be P1, P2, or P3.", ok: false };
  }

  const rawRecovery = searchParams.get("include_recovery")?.trim().toLowerCase();
  if (rawRecovery && !["true", "false"].includes(rawRecovery)) {
    return { error: "include_recovery must be true or false.", ok: false };
  }

  return {
    ok: true,
    options: {
      date: requestedDate,
      includeRecovery: rawRecovery === "true",
      limit,
      priority: (rawPriority || null) as FollowupPriority | null,
    },
  };
}

export function evaluateLeadFollowups(input: EvaluationInput): LeadFollowupResponse {
  const generatedAt = input.generatedAt ?? new Date();
  const { end } = getJerusalemDayBounds(input.date);
  const endTime = end.getTime();
  const referenceTime = getReferenceTime(input.date, generatedAt);
  const warnings = new Set(DISABLED_RULE_WARNINGS);
  const tenantLeads = input.leads.filter((lead) => lead.user_id === input.tenantUserId);
  const tenantLeadIds = new Set(tenantLeads.map((lead) => lead.id));
  const tenantTasks = input.tasks.filter(
    (task) =>
      task.user_id === input.tenantUserId &&
      task.linked_lead_id !== null &&
      tenantLeadIds.has(task.linked_lead_id) &&
      task.deleted_at === null,
  );
  const tasksByLead = new Map<string, LeadFollowupTask[]>();

  for (const task of tenantTasks) {
    const leadTasks = tasksByLead.get(task.linked_lead_id as string) ?? [];
    leadTasks.push(task);
    tasksByLead.set(task.linked_lead_id as string, leadTasks);
  }

  const candidates: Candidate[] = [];
  let unknownStatusCount = 0;

  for (const lead of tenantLeads) {
    if (isTerminalLeadForFollowups(lead.status)) {
      continue;
    }

    const canonicalStage = getCanonicalStage(lead.status);
    if (!canonicalStage) {
      unknownStatusCount += 1;
    }

    const leadTasks = tasksByLead.get(lead.id) ?? [];
    const explicitDue = chooseExplicitDue(lead, leadTasks, input.date, endTime);

    if (explicitDue) {
      candidates.push({
        ...createBaseItem(lead),
        dueTime: toTime(explicitDue.at) ?? 0,
        followup_type: "due",
        next_followup_at: explicitDue.at,
        primary_source_rule: explicitDue.rule,
        priority: "P1",
        reason: explicitDue.reason,
        recommended_action:
          explicitDue.source === "lead"
            ? getRecommendedAction(lead.next_action_type)
            : "Complete scheduled follow-up",
        score: explicitDue.score,
      });
      continue;
    }

    if (
      hasFutureOrOpenNextStep(leadTasks, lead, endTime) ||
      hasCompletedTaskToday(leadTasks, input.date)
    ) {
      continue;
    }

    const createdTime = toTime(lead.created_at);
    const graceTime = NEW_LEAD_GRACE_MINUTES * 60_000;
    if (
      canonicalStage === "לידים חדשים" &&
      lead.last_contact_date === null &&
      createdTime !== null &&
      createdTime <= referenceTime - graceTime
    ) {
      candidates.push({
        ...createBaseItem(lead),
        dueTime: createdTime,
        followup_type: "suggested",
        next_followup_at: null,
        primary_source_rule: "new_lead_no_contact",
        priority: "P1",
        reason: `Lead was created more than ${NEW_LEAD_GRACE_MINUTES} minutes ago and has no recorded sales contact or next step.`,
        recommended_action: "Make first sales contact",
        score: 75,
      });
      continue;
    }

    const lastContactTime = toTime(lead.last_contact_date);
    const recoveryCutoff = referenceTime - RECOVERY_STALE_DAYS * 86_400_000;
    if (
      input.includeRecovery &&
      canonicalStage === "דורש המשך טיפול" &&
      lastContactTime !== null &&
      lastContactTime <= recoveryCutoff
    ) {
      candidates.push({
        ...createBaseItem(lead),
        dueTime: lastContactTime,
        followup_type: "recovery",
        next_followup_at: null,
        primary_source_rule: "recovery",
        priority: "P3",
        reason: `Lead is in the verified recovery stage and has no recorded contact for at least ${RECOVERY_STALE_DAYS} days.`,
        recommended_action: "Review whether to reactivate lead",
        score: 30,
      });
    }
  }

  if (unknownStatusCount > 0) {
    warnings.add(
      `${unknownStatusCount} lead(s) had an unrecognized status; only explicit due follow-ups were considered for them.`,
    );
  }

  const filtered = candidates
    .filter((candidate) => !input.priority || candidate.priority === input.priority)
    .sort(
      (a, b) =>
        getTypeRank(a.followup_type) - getTypeRank(b.followup_type) ||
        getPriorityRank(a.priority) - getPriorityRank(b.priority) ||
        a.dueTime - b.dueTime ||
        b.score - a.score ||
        a.lead_id.localeCompare(b.lead_id),
    )
    .slice(0, input.limit)
    .map(toPublicItem);

  const counts: LeadFollowupCounts = {
    due: filtered.filter((item) => item.followup_type === "due").length,
    p1: filtered.filter((item) => item.priority === "P1").length,
    p2: filtered.filter((item) => item.priority === "P2").length,
    p3: filtered.filter((item) => item.priority === "P3").length,
    recovery: filtered.filter((item) => item.followup_type === "recovery").length,
    suggested: filtered.filter((item) => item.followup_type === "suggested").length,
  };

  return {
    counts,
    effective_date: input.date,
    generated_at: generatedAt.toISOString(),
    items: filtered,
    timezone: LEAD_FOLLOWUPS_TIME_ZONE,
    warnings: [...warnings],
  };
}
