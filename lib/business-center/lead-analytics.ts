import {
  LEAD_STATUSES,
  normalizeLeadStatus,
  type LeadStatus,
} from "@/lib/leads";

const TIME_ZONE = "Asia/Jerusalem";
const DAY_MS = 86_400_000;
const PRIORITY_LIMIT = 10;

type LeadPriorityGroup = "new" | "active" | "followup" | "closed" | "irrelevant";

export const BUSINESS_CENTER_LEAD_STAGES = LEAD_STATUSES.map((stage) => ({
  ...stage,
  priorityGroup: (
    stage.value === "לידים חדשים"
      ? "new"
      : stage.value === "דורש המשך טיפול"
        ? "followup"
        : stage.value === "נסגר בהצלחה"
          ? "closed"
          : stage.value === "לא רלוונטי"
            ? "irrelevant"
            : "active"
  ) as LeadPriorityGroup,
}));

export type BusinessCenterLeadSource = {
  created_at: string;
  full_name: string;
  id: string;
  next_action_date: string | null;
  status: string;
  value: number;
};

export type BusinessCenterPriorityLead = {
  ageDays: number;
  createdAt: string;
  id: string;
  name: string;
  nextActionDate: string | null;
  nextActionState: "overdue" | "today" | null;
  overdueDays: number | null;
  status: LeadStatus;
  statusLabel: string;
  value: number;
};

export type BusinessCenterPriorityGroup = {
  items: BusinessCenterPriorityLead[];
  total: number;
};

export type BusinessCenterLeadAnalytics = {
  followUpAvailable: true;
  monthlyActivity: {
    available: true;
    changeFromPrevious: number;
    currentOpen: number;
    currentWon: number;
    currentIrrelevant: number;
    editable: false;
    previousTotal: number;
    source: "crm";
    total: number;
  };
  pipeline: Array<{
    count: number;
    label: string;
    priorityGroup: LeadPriorityGroup;
    status: LeadStatus;
  }>;
  priorities: {
    callbacks: BusinessCenterPriorityGroup;
    followupRequiredCount: number;
    immediate: BusinessCenterPriorityGroup;
    newLeads: BusinessCenterPriorityGroup;
    overdueCount: number;
    todayCount: number;
  };
};

type ZonedParts = {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
};

function getZonedParts(date: Date): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    month: Number(values.month),
    second: Number(values.second),
    year: Number(values.year),
  };
}

function zonedStartOfDay(year: number, month: number, day: number) {
  const targetAsUtc = Date.UTC(year, month - 1, day);
  let candidate = targetAsUtc;

  for (let index = 0; index < 2; index += 1) {
    const parts = getZonedParts(new Date(candidate));
    const displayedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    candidate += targetAsUtc - displayedAsUtc;
  }

  return candidate;
}

export function getBusinessCenterMonthBounds(monthStart: string) {
  const [year, month] = monthStart.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;

  return {
    currentEnd: zonedStartOfDay(nextYear, nextMonth, 1),
    currentStart: zonedStartOfDay(year, month, 1),
    previousStart: zonedStartOfDay(previousYear, previousMonth, 1),
  };
}

function getTodayBounds(now: Date) {
  const today = getZonedParts(now);
  const todayStart = zonedStartOfDay(today.year, today.month, today.day);
  const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));

  return {
    today,
    todayEnd: zonedStartOfDay(
      tomorrow.getUTCFullYear(),
      tomorrow.getUTCMonth() + 1,
      tomorrow.getUTCDate(),
    ),
    todayStart,
  };
}

function getCalendarDayNumber(parts: ZonedParts) {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS);
}

function getAgeDays(createdAt: string, today: ZonedParts) {
  const createdTime = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTime)) {
    return 0;
  }

  return Math.max(
    0,
    getCalendarDayNumber(today) - getCalendarDayNumber(getZonedParts(new Date(createdTime))),
  );
}

function getNextActionState(
  nextActionDate: string | null,
  today: ZonedParts,
  todayStart: number,
  todayEnd: number,
) {
  if (!nextActionDate) {
    return { overdueDays: null, state: null } as const;
  }

  const actionTime = new Date(nextActionDate).getTime();
  if (!Number.isFinite(actionTime) || actionTime >= todayEnd) {
    return { overdueDays: null, state: null } as const;
  }

  if (actionTime >= todayStart) {
    return { overdueDays: null, state: "today" } as const;
  }

  const actionDay = getCalendarDayNumber(getZonedParts(new Date(actionTime)));
  return {
    overdueDays: Math.max(1, getCalendarDayNumber(today) - actionDay),
    state: "overdue",
  } as const;
}

function toPriorityLead(
  lead: BusinessCenterLeadSource,
  today: ZonedParts,
  todayStart: number,
  todayEnd: number,
): BusinessCenterPriorityLead {
  const status = normalizeLeadStatus(lead.status);
  const nextAction = getNextActionState(
    lead.next_action_date,
    today,
    todayStart,
    todayEnd,
  );

  return {
    ageDays: getAgeDays(lead.created_at, today),
    createdAt: lead.created_at,
    id: lead.id,
    name: lead.full_name.trim() || "ליד ללא שם",
    nextActionDate: lead.next_action_date,
    nextActionState: nextAction.state,
    overdueDays: nextAction.overdueDays,
    status,
    statusLabel:
      BUSINESS_CENTER_LEAD_STAGES.find((stage) => stage.value === status)?.label ?? status,
    value: Number.isFinite(lead.value) ? lead.value : 0,
  };
}

function sortOldestFirst(
  first: BusinessCenterPriorityLead,
  second: BusinessCenterPriorityLead,
) {
  return (
    new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime() ||
    first.name.localeCompare(second.name, "he")
  );
}

function getImmediateRank(lead: BusinessCenterPriorityLead) {
  if (lead.nextActionState === "overdue") {
    return 0;
  }

  if (lead.nextActionState === "today") {
    return 1;
  }

  return lead.status === "דורש המשך טיפול" ? 2 : 3;
}

function sortImmediate(
  first: BusinessCenterPriorityLead,
  second: BusinessCenterPriorityLead,
) {
  return (
    getImmediateRank(first) - getImmediateRank(second) ||
    (first.nextActionDate
      ? new Date(first.nextActionDate).getTime()
      : Number.MAX_SAFE_INTEGER) -
      (second.nextActionDate
        ? new Date(second.nextActionDate).getTime()
        : Number.MAX_SAFE_INTEGER) ||
    sortOldestFirst(first, second)
  );
}

function limitGroup(items: BusinessCenterPriorityLead[]): BusinessCenterPriorityGroup {
  return {
    items: items.slice(0, PRIORITY_LIMIT),
    total: items.length,
  };
}

export function getBusinessCenterLeadAnalytics(
  leads: BusinessCenterLeadSource[],
  monthStart: string,
  now = new Date(),
): BusinessCenterLeadAnalytics {
  const monthBounds = getBusinessCenterMonthBounds(monthStart);
  const todayBounds = getTodayBounds(now);
  const monthlyLeads = leads.filter((lead) => {
    const createdAt = new Date(lead.created_at).getTime();
    return createdAt >= monthBounds.currentStart && createdAt < monthBounds.currentEnd;
  });
  const previousMonthTotal = leads.filter((lead) => {
    const createdAt = new Date(lead.created_at).getTime();
    return createdAt >= monthBounds.previousStart && createdAt < monthBounds.currentStart;
  }).length;
  const normalizedMonthlyStatuses = monthlyLeads.map((lead) =>
    normalizeLeadStatus(lead.status),
  );
  const openLeads = leads.filter((lead) => {
    const status = normalizeLeadStatus(lead.status);
    return status !== "נסגר בהצלחה" && status !== "לא רלוונטי";
  });
  const priorityLeads = openLeads.map((lead) =>
    toPriorityLead(
      lead,
      todayBounds.today,
      todayBounds.todayStart,
      todayBounds.todayEnd,
    ),
  );
  const immediate = priorityLeads
    .filter(
      (lead) =>
        lead.status === "דורש המשך טיפול" ||
        lead.nextActionState === "overdue" ||
        lead.nextActionState === "today",
    )
    .sort(sortImmediate);
  const newLeads = priorityLeads
    .filter((lead) => lead.status === "לידים חדשים")
    .sort(sortOldestFirst);
  const callbackStatuses = new Set<LeadStatus>([
    "יצירת קשר",
    "בתהליך שיחה",
    "הצעה נשלחה",
    "ממתין לתגובה",
  ]);
  const callbacks = priorityLeads
    .filter(
      (lead) =>
        callbackStatuses.has(lead.status) &&
        (lead.nextActionState === "overdue" || lead.nextActionState === "today"),
    )
    .sort(sortImmediate);

  return {
    followUpAvailable: true,
    monthlyActivity: {
      available: true,
      changeFromPrevious: monthlyLeads.length - previousMonthTotal,
      currentIrrelevant: normalizedMonthlyStatuses.filter(
        (status) => status === "לא רלוונטי",
      ).length,
      currentOpen: normalizedMonthlyStatuses.filter(
        (status) => status !== "נסגר בהצלחה" && status !== "לא רלוונטי",
      ).length,
      currentWon: normalizedMonthlyStatuses.filter(
        (status) => status === "נסגר בהצלחה",
      ).length,
      editable: false,
      previousTotal: previousMonthTotal,
      source: "crm",
      total: monthlyLeads.length,
    },
    pipeline: BUSINESS_CENTER_LEAD_STAGES.map((stage) => ({
      count: leads.filter(
        (lead) => normalizeLeadStatus(lead.status) === stage.value,
      ).length,
      label: stage.label,
      priorityGroup: stage.priorityGroup,
      status: stage.value,
    })),
    priorities: {
      callbacks: limitGroup(callbacks),
      followupRequiredCount: priorityLeads.filter(
        (lead) => lead.status === "דורש המשך טיפול",
      ).length,
      immediate: limitGroup(immediate),
      newLeads: limitGroup(newLeads),
      overdueCount: priorityLeads.filter(
        (lead) => lead.nextActionState === "overdue",
      ).length,
      todayCount: priorityLeads.filter(
        (lead) => lead.nextActionState === "today",
      ).length,
    },
  };
}
