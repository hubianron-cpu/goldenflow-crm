import { isFinalLeadStatus, normalizeLeadStatus } from "@/lib/leads";

export const BUSINESS_INSIGHTS_TIME_ZONE = "Asia/Jerusalem";
export const BUSINESS_INSIGHTS_TREND_MONTHS = 6;

const DAY_MS = 86_400_000;
const INITIAL_LEAD_STATUS = "לידים חדשים";
const WON_LEAD_STATUS = "נסגר בהצלחה";
const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ZonedParts = {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
};

export type BusinessInsightsSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type BusinessPeriodType = "week" | "month";

export type BusinessPeriodSelection = {
  currentKey: string;
  currentMonthKey: string;
  currentWeekKey: string;
  endDate: string;
  endIso: string;
  isCurrent: boolean;
  key: string;
  label: string;
  nextKey: string | null;
  previousKey: string;
  startDate: string;
  startIso: string;
  type: BusinessPeriodType;
};

export type BusinessTrendMonth = {
  endIso: string;
  key: string;
  label: string;
  startIso: string;
};

export type BusinessInsightsSelection = {
  period: BusinessPeriodSelection;
  profileId: string | null;
  trendMonths: BusinessTrendMonth[];
};

export type AvailableData<T> =
  | {
      available: true;
      data: T;
    }
  | {
      available: false;
      reason: "load_failed" | "not_installed";
    };

export type InsightLeadRow = {
  closed_at: string | null;
  created_at: string;
  full_name: string;
  id: string;
  next_action_date: string | null;
  source: string;
  status: string;
  updated_at: string;
};

export type InsightClosedLeadRow = {
  closed_at: string | null;
  id: string;
  status: string;
};

export type InsightTrendLeadRow = {
  closed_at: string | null;
  created_at: string;
  id: string;
  status: string;
};

export type InsightMonthlyMetricRow = {
  actual_revenue: number;
  month_start: string;
  target_leads: number | null;
  target_revenue: number | null;
};

export type InsightStuckLeadRow = {
  full_name: string;
  id: string;
  next_action_date: string | null;
  status: string;
  updated_at: string;
};

export type InsightSocialProfileRow = {
  created_at: string;
  display_name: string;
  handle: string | null;
  id: string;
  is_active: boolean;
  platform: string;
};

export type InsightSocialSnapshotRow = {
  followers_count: number;
  snapshot_date: string;
  social_profile_id: string;
};

export type SummaryMetric = {
  available: boolean;
  explanation: string;
  kind: "money" | "number";
  label: string;
  source: string;
  temporalNature: "historical" | "current_state" | "manual" | "unavailable";
  unavailableText?: string;
  value: number | null;
};

export type LeadingSourceSummary =
  | {
      available: false;
      explanation: string;
      label: "המקור המוביל לפי מספר לידים";
      source: "leads.source";
    }
  | {
      available: true;
      count: number;
      explanation: string;
      label: "המקור המוביל לפי מספר לידים";
      name: string;
      percentage: number;
      source: "leads.source";
    };

export type StuckLeadSummary = {
  days: number;
  id: string;
  name: string;
  nextActionDate: string | null;
  reason:
    | "פעולה באיחור"
    | "לא עודכן לאחרונה ואין פעולה מתוכננת";
  status: string;
};

export type BusinessPeriodSummary = {
  actions: Array<{
    id: string;
    text: string;
  }>;
  attribution:
    | {
        available: false;
      }
    | {
        attributedLeads: number;
        available: true;
        coverage: number | null;
        unattributedLeads: number;
      };
  leadingSource: LeadingSourceSummary;
  metrics: {
    closed: SummaryMetric;
    contentPublished: SummaryMetric;
    leadsEntered: SummaryMetric;
    progressed: SummaryMetric;
    revenue: SummaryMetric;
    revenueTarget: SummaryMetric | null;
  };
  period: BusinessPeriodSelection;
  stuckLeads:
    | {
        available: false;
        items: [];
        total: null;
      }
    | {
        available: true;
        items: StuckLeadSummary[];
        total: number;
      };
};

export type LeadsAndClosuresTrend =
  | {
      available: false;
      points: [];
    }
  | {
      available: true;
      closureMode: "historical";
      points: Array<{
        closed: number;
        closeRatio: number | null;
        label: string;
        leads: number;
        month: string;
      }>;
    };

export type RevenueTrend = {
  available: boolean;
  points: Array<{
    actualRevenue: number | null;
    label: string;
    month: string;
    targetRevenue: number | null;
  }>;
};

export type FollowersTrend =
  | {
      available: false;
      profiles: Array<{
        id: string;
        label: string;
        platform: string;
      }>;
      reason: "load_failed" | "no_profiles" | "no_snapshots";
      selectedProfileId: string | null;
    }
  | {
      available: true;
      hasTrend: boolean;
      points: Array<{
        followers: number;
        label: string;
        month: string;
        snapshotDate: string;
      }>;
      profiles: Array<{
        id: string;
        label: string;
        platform: string;
      }>;
      selectedProfileId: string;
      selectedProfileLabel: string;
    };

export type BusinessTrendSeries = {
  followers: FollowersTrend;
  leadsAndClosures: LeadsAndClosuresTrend;
  revenue: RevenueTrend;
};

export type BusinessPeriodSummaryInput = {
  attributionLeadIds: AvailableData<string[]>;
  closedLeads: AvailableData<InsightClosedLeadRow[]>;
  monthlyMetrics: AvailableData<InsightMonthlyMetricRow | null>;
  now: Date;
  overdueLeads: AvailableData<{
    rows: InsightStuckLeadRow[];
    total: number;
  }>;
  period: BusinessPeriodSelection;
  periodLeads: AvailableData<InsightLeadRow[]>;
  publishedContentCount: AvailableData<number>;
  unscheduledLeads: AvailableData<{
    rows: InsightStuckLeadRow[];
    total: number;
  }>;
};

export type BusinessTrendSeriesInput = {
  leads: AvailableData<InsightTrendLeadRow[]>;
  monthlyMetrics: AvailableData<InsightMonthlyMetricRow[]>;
  profiles: AvailableData<InsightSocialProfileRow[]>;
  selectedProfileId: string | null;
  snapshots: AvailableData<InsightSocialSnapshotRow[]>;
  trendMonths: BusinessTrendMonth[];
};

function getParam(
  searchParams: BusinessInsightsSearchParams,
  key: string,
): string {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getZonedParts(date: Date): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: BUSINESS_INSIGHTS_TIME_ZONE,
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

  for (let index = 0; index < 3; index += 1) {
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

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateKeyFromUtcCalendar(date: Date) {
  return dateKey(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

function getCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addCalendarDays(value: string, days: number) {
  const date = getCalendarDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKeyFromUtcCalendar(date);
}

function addCalendarMonths(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isValidDate(value: string) {
  if (!datePattern.test(value)) {
    return false;
  }

  return dateKeyFromUtcCalendar(getCalendarDate(value)) === value;
}

function isSunday(value: string) {
  return getCalendarDate(value).getUTCDay() === 0;
}

function startIsoFromDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(zonedStartOfDay(year, month, day)).toISOString();
}

function getJerusalemDateKey(date: Date) {
  const parts = getZonedParts(date);
  return dateKey(parts.year, parts.month, parts.day);
}

function getJerusalemMonthKey(date: Date) {
  return getJerusalemDateKey(date).slice(0, 7);
}

function getCurrentWeekStart(date: Date) {
  const today = getJerusalemDateKey(date);
  return addCalendarDays(today, -getCalendarDate(today).getUTCDay());
}

function formatPeriodLabel(
  type: BusinessPeriodType,
  startDate: string,
  endDate: string,
) {
  const formatter = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  });

  if (type === "month") {
    return new Intl.DateTimeFormat("he-IL", {
      month: "long",
      timeZone: "UTC",
      year: "numeric",
    }).format(new Date(`${startDate}T12:00:00.000Z`));
  }

  return `${formatter.format(new Date(`${startDate}T12:00:00.000Z`))} – ${formatter.format(
    new Date(`${addCalendarDays(endDate, -1)}T12:00:00.000Z`),
  )}`;
}

function createPeriodSelection(
  type: BusinessPeriodType,
  key: string,
  currentKey: string,
  currentMonthKey: string,
  currentWeekKey: string,
): BusinessPeriodSelection {
  const startDate = type === "week" ? key : `${key}-01`;
  const endDate =
    type === "week"
      ? addCalendarDays(startDate, 7)
      : `${addCalendarMonths(key, 1)}-01`;
  const previousKey =
    type === "week" ? addCalendarDays(key, -7) : addCalendarMonths(key, -1);
  const possibleNextKey =
    type === "week" ? addCalendarDays(key, 7) : addCalendarMonths(key, 1);

  return {
    currentKey,
    currentMonthKey,
    currentWeekKey,
    endDate,
    endIso: startIsoFromDateKey(endDate),
    isCurrent: key === currentKey,
    key,
    label: formatPeriodLabel(type, startDate, endDate),
    nextKey: possibleNextKey <= currentKey ? possibleNextKey : null,
    previousKey,
    startDate,
    startIso: startIsoFromDateKey(startDate),
    type,
  };
}

function getTrendMonths(now: Date): BusinessTrendMonth[] {
  const currentMonth = getJerusalemMonthKey(now);

  return Array.from({ length: BUSINESS_INSIGHTS_TREND_MONTHS }, (_, index) =>
    addCalendarMonths(
      currentMonth,
      index - (BUSINESS_INSIGHTS_TREND_MONTHS - 1),
    ),
  ).map((month) => {
    const startDate = `${month}-01`;
    const endDate = `${addCalendarMonths(month, 1)}-01`;
    return {
      endIso: startIsoFromDateKey(endDate),
      key: month,
      label: new Intl.DateTimeFormat("he-IL", {
        month: "short",
        timeZone: "UTC",
        year: "2-digit",
      }).format(new Date(`${startDate}T12:00:00.000Z`)),
      startIso: startIsoFromDateKey(startDate),
    };
  });
}

export function resolveBusinessInsightsSelection(
  searchParams: BusinessInsightsSearchParams,
  now = new Date(),
): BusinessInsightsSelection {
  const requestedType = getParam(searchParams, "period");
  const type: BusinessPeriodType =
    requestedType === "week" ? "week" : "month";
  const currentWeekKey = getCurrentWeekStart(now);
  const currentMonthKey = getJerusalemMonthKey(now);
  const currentKey = type === "week" ? currentWeekKey : currentMonthKey;
  const requestedKey =
    type === "week"
      ? getParam(searchParams, "start")
      : getParam(searchParams, "month");
  const validRequestedKey =
    type === "week"
      ? isValidDate(requestedKey) &&
        isSunday(requestedKey) &&
        requestedKey <= currentKey
      : monthPattern.test(requestedKey) && requestedKey <= currentKey;
  const key = validRequestedKey ? requestedKey : currentKey;
  const requestedProfileId = getParam(searchParams, "profile");

  return {
    period: createPeriodSelection(
      type,
      key,
      currentKey,
      currentMonthKey,
      currentWeekKey,
    ),
    profileId: uuidPattern.test(requestedProfileId)
      ? requestedProfileId
      : null,
    trendMonths: getTrendMonths(now),
  };
}

export function getBusinessInsightsHref(
  type: BusinessPeriodType,
  key: string,
  profileId?: string | null,
) {
  const params = new URLSearchParams({ period: type });
  params.set(type === "week" ? "start" : "month", key);
  if (profileId && uuidPattern.test(profileId)) {
    params.set("profile", profileId);
  }
  return `/business-center/insights?${params.toString()}`;
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}

function roundPercentage(value: number) {
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
}

function getTimestampMonth(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return getJerusalemMonthKey(date);
}

function getCalendarDayNumber(value: string) {
  return Math.floor(getCalendarDate(value).getTime() / DAY_MS);
}

function getDaysBetween(date: Date, earlierValue: string) {
  const earlier = new Date(earlierValue);
  if (!Number.isFinite(earlier.getTime())) {
    return 0;
  }

  return Math.max(
    0,
    getCalendarDayNumber(getJerusalemDateKey(date)) -
      getCalendarDayNumber(getJerusalemDateKey(earlier)),
  );
}

function isWonStatus(status: string) {
  const cleanStatus = status.trim().toLowerCase();
  return (
    normalizeLeadStatus(status) === WON_LEAD_STATUS ||
    cleanStatus === "won"
  );
}

function isOpenStatus(status: string) {
  return !isFinalLeadStatus(status);
}

function buildUnavailableMetric(
  label: string,
  kind: SummaryMetric["kind"],
  unavailableText: string,
  explanation: string,
  source: string,
): SummaryMetric {
  return {
    available: false,
    explanation,
    kind,
    label,
    source,
    temporalNature: "unavailable",
    unavailableText,
    value: null,
  };
}

function buildStuckLeads(
  overdueData: BusinessPeriodSummaryInput["overdueLeads"],
  unscheduledData: BusinessPeriodSummaryInput["unscheduledLeads"],
  now: Date,
): BusinessPeriodSummary["stuckLeads"] {
  if (!overdueData.available || !unscheduledData.available) {
    return {
      available: false,
      items: [],
      total: null,
    };
  }

  const overdueItems = uniqueById(overdueData.data.rows)
    .filter(
      (lead) =>
        isOpenStatus(lead.status) &&
        Boolean(lead.next_action_date) &&
        new Date(lead.next_action_date ?? "").getTime() < now.getTime(),
    )
    .map((lead): StuckLeadSummary => ({
      days: getDaysBetween(now, lead.next_action_date ?? lead.updated_at),
      id: lead.id,
      name: lead.full_name.trim() || "ליד ללא שם",
      nextActionDate: lead.next_action_date,
      reason: "פעולה באיחור",
      status: normalizeLeadStatus(lead.status),
    }))
    .sort(
      (first, second) =>
        second.days - first.days ||
        new Date(first.nextActionDate ?? "").getTime() -
          new Date(second.nextActionDate ?? "").getTime() ||
        first.id.localeCompare(second.id),
    );
  const overdueIds = new Set(overdueItems.map((lead) => lead.id));
  const secondaryItems = uniqueById(unscheduledData.data.rows)
    .filter(
      (lead) =>
        !overdueIds.has(lead.id) &&
        isOpenStatus(lead.status) &&
        !lead.next_action_date &&
        getDaysBetween(now, lead.updated_at) >= 7,
    )
    .map((lead): StuckLeadSummary => ({
      days: getDaysBetween(now, lead.updated_at),
      id: lead.id,
      name: lead.full_name.trim() || "ליד ללא שם",
      nextActionDate: null,
      reason: "לא עודכן לאחרונה ואין פעולה מתוכננת",
      status: normalizeLeadStatus(lead.status),
    }))
    .sort(
      (first, second) =>
        second.days - first.days || first.id.localeCompare(second.id),
    );
  const items = [...overdueItems, ...secondaryItems].slice(0, 5);

  return {
    available: true,
    items,
    total: Math.max(
      items.length,
      overdueData.data.total + unscheduledData.data.total,
    ),
  };
}

export function getBusinessPeriodSummary(
  input: BusinessPeriodSummaryInput,
): BusinessPeriodSummary {
  const periodLeads = input.periodLeads.available
    ? uniqueById(input.periodLeads.data)
    : [];
  const closedLeads = input.closedLeads.available
    ? uniqueById(input.closedLeads.data).filter(
        (lead) => lead.closed_at && isWonStatus(lead.status),
      )
    : [];
  const metrics = {
    leadsEntered: input.periodLeads.available
      ? {
          available: true,
          explanation: "לידים ייחודיים לפי תאריך היצירה ב־CRM.",
          kind: "number" as const,
          label: "לידים שנכנסו",
          source: "leads.created_at",
          temporalNature: "historical" as const,
          value: periodLeads.length,
        }
      : buildUnavailableMetric(
          "לידים שנכנסו",
          "number",
          "לא זמין",
          "לא ניתן היה לטעון את נתוני הלידים לתקופה.",
          "leads.created_at",
        ),
    progressed: input.periodLeads.available
      ? {
          available: true,
          explanation:
            "המדד מבוסס על מצבם הנוכחי של הלידים, משום שאין היסטוריית פעולות מלאה.",
          kind: "number" as const,
          label: "לידים מהתקופה שכבר התקדמו",
          source: "leads.status",
          temporalNature: "current_state" as const,
          value: periodLeads.filter(
            (lead) =>
              normalizeLeadStatus(lead.status) !== INITIAL_LEAD_STATUS,
          ).length,
        }
      : buildUnavailableMetric(
          "לידים מהתקופה שכבר התקדמו",
          "number",
          "לא זמין",
          "לא ניתן היה לטעון את מצב הלידים לתקופה.",
          "leads.status",
        ),
    closed: input.closedLeads.available
      ? {
          available: true,
          explanation:
            "סגירות לפי תאריך הסגירה שנשמר ב־CRM ולידים שנמצאים בסטטוס נסגר בהצלחה.",
          kind: "number" as const,
          label: "נסגרו בהצלחה",
          source: "leads.closed_at",
          temporalNature: "historical" as const,
          value: closedLeads.length,
        }
      : buildUnavailableMetric(
          "נסגרו בהצלחה",
          "number",
          "לא זמין",
          "לא ניתן היה לטעון את תאריכי הסגירה לתקופה.",
          "leads.closed_at",
        ),
    revenue:
      input.period.type === "week"
        ? buildUnavailableMetric(
            "הכנסה שבועית",
            "money",
            "לא זמין לפי שבוע",
            "המערכת שומרת כרגע את ההכנסה ברמה חודשית בלבד.",
            "business_center_monthly_metrics.actual_revenue",
          )
        : input.monthlyMetrics.available && input.monthlyMetrics.data
          ? {
              available: true,
              explanation: "הוזן ידנית",
              kind: "money" as const,
              label: "הכנסה בפועל",
              source: "business_center_monthly_metrics.actual_revenue",
              temporalNature: "manual" as const,
              value: input.monthlyMetrics.data.actual_revenue,
            }
          : buildUnavailableMetric(
              "הכנסה בפועל",
              "money",
              "לא הוזן",
              input.monthlyMetrics.available
                ? "לא נשמרה רשומת הכנסה לחודש שנבחר."
                : "לא ניתן היה לטעון את נתוני ההכנסה.",
              "business_center_monthly_metrics.actual_revenue",
            ),
    revenueTarget:
      input.period.type === "week"
        ? null
        : input.monthlyMetrics.available &&
            input.monthlyMetrics.data?.target_revenue !== null &&
            input.monthlyMetrics.data?.target_revenue !== undefined
          ? {
              available: true,
              explanation: "היעד החודשי שהוגדר במרכז העסק.",
              kind: "money" as const,
              label: "יעד הכנסה",
              source: "business_center_monthly_metrics.target_revenue",
              temporalNature: "manual" as const,
              value: input.monthlyMetrics.data.target_revenue,
            }
          : buildUnavailableMetric(
              "יעד הכנסה",
              "money",
              "לא הוגדר יעד",
              input.monthlyMetrics.available
                ? "לא הוגדר יעד הכנסה לחודש שנבחר."
                : "לא ניתן היה לטעון את יעד ההכנסה.",
              "business_center_monthly_metrics.target_revenue",
            ),
    contentPublished: input.publishedContentCount.available
      ? {
          available: true,
          explanation:
            "תוכן שפורסם בפועל לפי published_on; טיוטות אינן נספרות.",
          kind: "number" as const,
          label: "תכנים שפורסמו",
          source: "business_center_content_items.published_on",
          temporalNature: "historical" as const,
          value: input.publishedContentCount.data,
        }
      : buildUnavailableMetric(
          "תכנים שפורסמו",
          "number",
          "לא זמין",
          "לא ניתן היה לטעון את ספריית התוכן לתקופה.",
          "business_center_content_items.published_on",
        ),
  };
  const sourceTotals = new Map<
    string,
    { count: number; currentWon: number }
  >();

  for (const lead of periodLeads) {
    const source = lead.source.trim() || "לא ידוע";
    const current = sourceTotals.get(source) ?? { count: 0, currentWon: 0 };
    current.count += 1;
    current.currentWon += isWonStatus(lead.status) ? 1 : 0;
    sourceTotals.set(source, current);
  }

  const topSource = Array.from(sourceTotals, ([name, values]) => ({
    ...values,
    name,
  })).sort(
    (first, second) =>
      second.count - first.count ||
      second.currentWon - first.currentWon ||
      first.name.localeCompare(second.name, "he"),
  )[0];
  const leadingSource: LeadingSourceSummary =
    input.periodLeads.available && topSource
      ? {
          available: true,
          count: topSource.count,
          explanation:
            "הדירוג מבוסס על מספר הלידים שנוצרו בתקופה, לא על הכנסה או ROI.",
          label: "המקור המוביל לפי מספר לידים",
          name: topSource.name,
          percentage:
            periodLeads.length > 0
              ? roundPercentage((topSource.count / periodLeads.length) * 100)
              : 0,
          source: "leads.source",
        }
      : {
          available: false,
          explanation: input.periodLeads.available
            ? "אין לידים בתקופה ולכן אין מקור מוביל."
            : "לא ניתן היה לטעון את מקורות הלידים.",
          label: "המקור המוביל לפי מספר לידים",
          source: "leads.source",
        };
  const attributedLeadIds = input.attributionLeadIds.available
    ? new Set(input.attributionLeadIds.data)
    : null;
  const attribution: BusinessPeriodSummary["attribution"] =
    attributedLeadIds && input.periodLeads.available
      ? {
          attributedLeads: attributedLeadIds.size,
          available: true,
          coverage:
            periodLeads.length > 0
              ? roundPercentage(
                  (attributedLeadIds.size / periodLeads.length) * 100,
                )
              : null,
          unattributedLeads: Math.max(
            0,
            periodLeads.length - attributedLeadIds.size,
          ),
        }
      : { available: false };
  const stuckLeads = buildStuckLeads(
    input.overdueLeads,
    input.unscheduledLeads,
    input.now,
  );
  const actions: BusinessPeriodSummary["actions"] = [];

  if (stuckLeads.available && stuckLeads.total > 0) {
    actions.push({
      id: "stuck-leads",
      text: `לטפל ב־${stuckLeads.total} לידים שמחכים לפעולה.`,
    });
  }

  if (
    periodLeads.length >= 3 &&
    attribution.available &&
    attribution.coverage !== null &&
    attribution.coverage < 70 &&
    attribution.unattributedLeads > 0
  ) {
    actions.push({
      id: "content-attribution",
      text: `לשייך תוכן ל־${attribution.unattributedLeads} לידים כדי להבין מה באמת מביא תוצאות.`,
    });
  }

  if (
    metrics.contentPublished.available &&
    metrics.contentPublished.value === 0
  ) {
    actions.push({
      id: "publish-content",
      text: "לפרסם לפחות תוכן אחד בתקופה הבאה.",
    });
  }

  if (leadingSource.available && leadingSource.count >= 3) {
    actions.push({
      id: "repeat-leading-source",
      text: `ליצור פעילות נוספת במקור המוביל: ${leadingSource.name}.`,
    });
  }

  if (
    input.period.type === "month" &&
    metrics.revenue.available &&
    metrics.revenueTarget?.available &&
    metrics.revenue.value !== null &&
    metrics.revenueTarget.value !== null &&
    metrics.revenueTarget.value > metrics.revenue.value
  ) {
    const gap = metrics.revenueTarget.value - metrics.revenue.value;
    actions.push({
      id: "revenue-gap",
      text: `נשאר פער של ${new Intl.NumberFormat("he-IL", {
        currency: "ILS",
        maximumFractionDigits: 0,
        style: "currency",
      }).format(gap)} מול יעד ההכנסה.`,
    });
  }

  return {
    actions: actions.slice(0, 3),
    attribution,
    leadingSource,
    metrics,
    period: input.period,
    stuckLeads,
  };
}

export function getBusinessTrendSeries(
  input: BusinessTrendSeriesInput,
): BusinessTrendSeries {
  const monthLabels = new Map(
    input.trendMonths.map((month) => [month.key, month.label]),
  );
  const leadTotals = new Map<string, Set<string>>();
  const closedTotals = new Map<string, Set<string>>();
  const currentWonCohorts = new Map<string, Set<string>>();

  if (input.leads.available) {
    for (const lead of input.leads.data) {
      const createdMonth = getTimestampMonth(lead.created_at);
      if (createdMonth && monthLabels.has(createdMonth)) {
        const ids = leadTotals.get(createdMonth) ?? new Set<string>();
        ids.add(lead.id);
        leadTotals.set(createdMonth, ids);
        if (isWonStatus(lead.status)) {
          const wonIds =
            currentWonCohorts.get(createdMonth) ?? new Set<string>();
          wonIds.add(lead.id);
          currentWonCohorts.set(createdMonth, wonIds);
        }
      }

      const closedMonth = getTimestampMonth(lead.closed_at);
      if (
        closedMonth &&
        monthLabels.has(closedMonth) &&
        isWonStatus(lead.status)
      ) {
        const ids = closedTotals.get(closedMonth) ?? new Set<string>();
        ids.add(lead.id);
        closedTotals.set(closedMonth, ids);
      }
    }
  }

  const leadsAndClosures: LeadsAndClosuresTrend = input.leads.available
    ? {
        available: true,
        closureMode: "historical",
        points: input.trendMonths.map((month) => {
          const leads = leadTotals.get(month.key)?.size ?? 0;
          const closed = closedTotals.get(month.key)?.size ?? 0;
          const currentWon = currentWonCohorts.get(month.key)?.size ?? 0;
          return {
            closed,
            closeRatio:
              leads > 0
                ? roundPercentage((currentWon / leads) * 100)
                : null,
            label: month.label,
            leads,
            month: month.key,
          };
        }),
      }
    : {
        available: false,
        points: [],
      };
  const metricRows = input.monthlyMetrics.available
    ? new Map(
        input.monthlyMetrics.data.map((row) => [
          row.month_start.slice(0, 7),
          row,
        ]),
      )
    : new Map<string, InsightMonthlyMetricRow>();
  const revenuePoints = input.trendMonths.map((month) => {
    const metric = metricRows.get(month.key);
    return {
      actualRevenue: metric ? metric.actual_revenue : null,
      label: month.label,
      month: month.key,
      targetRevenue: metric?.target_revenue ?? null,
    };
  });
  const revenue: RevenueTrend = {
    available:
      input.monthlyMetrics.available &&
      revenuePoints.filter(
        (point) =>
          point.actualRevenue !== null || point.targetRevenue !== null,
      ).length >= 2,
    points: revenuePoints,
  };
  const profiles = input.profiles.available
    ? [...input.profiles.data]
        .sort(
          (first, second) =>
            Number(second.is_active) - Number(first.is_active) ||
            new Date(second.created_at).getTime() -
              new Date(first.created_at).getTime() ||
            first.id.localeCompare(second.id),
        )
        .map((profile) => ({
          id: profile.id,
          label:
            profile.display_name.trim() ||
            profile.handle?.trim() ||
            profile.platform,
          platform: profile.platform,
        }))
    : [];
  const selectedProfile =
    profiles.find((profile) => profile.id === input.selectedProfileId) ??
    profiles[0] ??
    null;

  if (!input.profiles.available || !input.snapshots.available) {
    return {
      followers: {
        available: false,
        profiles,
        reason: "load_failed",
        selectedProfileId: selectedProfile?.id ?? null,
      },
      leadsAndClosures,
      revenue,
    };
  }

  if (!selectedProfile) {
    return {
      followers: {
        available: false,
        profiles,
        reason: "no_profiles",
        selectedProfileId: null,
      },
      leadsAndClosures,
      revenue,
    };
  }

  const snapshotsByMonth = new Map<string, InsightSocialSnapshotRow>();
  for (const snapshot of input.snapshots.data) {
    if (snapshot.social_profile_id !== selectedProfile.id) {
      continue;
    }
    const month = snapshot.snapshot_date.slice(0, 7);
    if (!monthLabels.has(month)) {
      continue;
    }
    const current = snapshotsByMonth.get(month);
    if (!current || snapshot.snapshot_date > current.snapshot_date) {
      snapshotsByMonth.set(month, snapshot);
    }
  }

  const followerPoints = input.trendMonths.flatMap((month) => {
    const snapshot = snapshotsByMonth.get(month.key);
    return snapshot
      ? [
          {
            followers: snapshot.followers_count,
            label: month.label,
            month: month.key,
            snapshotDate: snapshot.snapshot_date,
          },
        ]
      : [];
  });
  const followers: FollowersTrend =
    followerPoints.length > 0
      ? {
          available: true,
          hasTrend: followerPoints.length >= 2,
          points: followerPoints,
          profiles,
          selectedProfileId: selectedProfile.id,
          selectedProfileLabel: `${selectedProfile.label} · ${selectedProfile.platform}`,
        }
      : {
          available: false,
          profiles,
          reason: "no_snapshots",
          selectedProfileId: selectedProfile.id,
        };

  return {
    followers,
    leadsAndClosures,
    revenue,
  };
}
