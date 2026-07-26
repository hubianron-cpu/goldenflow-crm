"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Gauge,
  Lightbulb,
  Library,
  Pencil,
  Plus,
  Save,
  Share2,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { BusinessCenterLeadIntelligence } from "@/components/business-center/lead-intelligence";
import { StatusMessage } from "@/components/status-message";
import type { BusinessCenterLeadAnalytics } from "@/lib/business-center/lead-analytics";
import type { Database } from "@/types/database";

type MonthlyMetrics = Database["public"]["Tables"]["business_center_monthly_metrics"]["Row"];
type SocialProfile = Database["public"]["Tables"]["business_center_social_profiles"]["Row"];
type SocialSnapshot = Database["public"]["Tables"]["business_center_social_snapshots"]["Row"];
type ProfileWithSnapshots = SocialProfile & {
  latest_snapshot: SocialSnapshot | null;
  previous_snapshot: SocialSnapshot | null;
  snapshots: SocialSnapshot[];
  thirty_day_snapshot: SocialSnapshot | null;
};

type BusinessCenterResponse = {
  lead_analytics: BusinessCenterLeadAnalytics;
  monthly: MonthlyMetrics | null;
  previous_monthly: MonthlyMetrics | null;
  profiles: ProfileWithSnapshots[];
};

type MonthlyForm = {
  actual_content_published: string;
  actual_new_customers: string;
  actual_revenue: string;
  actual_sales_calls: string;
  notes: string;
  target_content_published: string;
  target_leads: string;
  target_new_customers: string;
  target_revenue: string;
  target_sales_calls: string;
};

type ProfileForm = {
  display_name: string;
  followers_goal: string;
  handle: string;
  is_active: boolean;
  platform: SocialProfile["platform"];
  profile_url: string;
};

type SnapshotForm = {
  attributed_leads_count: string;
  followers_count: string;
  notes: string;
  profile_visits_count: string;
  snapshot_date: string;
  views_count: string;
};

type ManualMetricDefinition = {
  actualKey:
    | "actual_revenue"
    | "actual_sales_calls"
    | "actual_new_customers"
    | "actual_content_published";
  label: string;
  money?: boolean;
  source: "manual";
  targetKey:
    | "target_revenue"
    | "target_sales_calls"
    | "target_new_customers"
    | "target_content_published";
};

type MetricDefinition =
  | ManualMetricDefinition
  | {
      label: string;
      money?: false;
      source: "crm";
      targetKey: "target_leads";
    };

const platformOptions: Array<{ label: string; value: SocialProfile["platform"] }> = [
  { label: "Instagram", value: "Instagram" },
  { label: "TikTok", value: "TikTok" },
  { label: "YouTube", value: "YouTube" },
  { label: "Facebook", value: "Facebook" },
  { label: "LinkedIn", value: "LinkedIn" },
  { label: "אחר", value: "Other" },
];

const metricDefinitions: MetricDefinition[] = [
  {
    actualKey: "actual_revenue",
    label: "הכנסה",
    money: true,
    source: "manual",
    targetKey: "target_revenue",
  },
  {
    label: "לידים שנכנסו החודש",
    source: "crm",
    targetKey: "target_leads",
  },
  {
    actualKey: "actual_sales_calls",
    label: "שיחות מכירה",
    source: "manual",
    targetKey: "target_sales_calls",
  },
  {
    actualKey: "actual_new_customers",
    label: "לקוחות חדשים",
    source: "manual",
    targetKey: "target_new_customers",
  },
  {
    actualKey: "actual_content_published",
    label: "תכנים שפורסמו",
    source: "manual",
    targetKey: "target_content_published",
  },
];

const emptyMonthlyForm: MonthlyForm = {
  actual_content_published: "0",
  actual_new_customers: "0",
  actual_revenue: "0",
  actual_sales_calls: "0",
  notes: "",
  target_content_published: "",
  target_leads: "",
  target_new_customers: "",
  target_revenue: "",
  target_sales_calls: "",
};

const emptyProfileForm: ProfileForm = {
  display_name: "",
  followers_goal: "",
  handle: "",
  is_active: true,
  platform: "Instagram",
  profile_url: "",
};

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

function getToday() {
  const { day, month, year } = getJerusalemDateParts();
  return `${year}-${month}-${day}`;
}

function getCurrentMonth() {
  const { month, year } = getJerusalemDateParts();
  return `${year}-${month}`;
}

function getMonthStart(month: string) {
  return `${month}-01`;
}

function formatMonth(month: string) {
  return new Intl.DateTimeFormat("he-IL", {
    month: "long",
    timeZone: "Asia/Jerusalem",
    year: "numeric",
  }).format(new Date(`${month}-01T12:00:00.000Z`));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("he-IL", {
    currency: "ILS",
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    style: "currency",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("he-IL", {
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function toFormValue(value: number | null) {
  return value === null ? "" : String(value);
}

function monthlyToForm(monthly: MonthlyMetrics | null): MonthlyForm {
  if (!monthly) {
    return { ...emptyMonthlyForm };
  }

  return {
    actual_content_published: String(monthly.actual_content_published),
    actual_new_customers: String(monthly.actual_new_customers),
    actual_revenue: String(monthly.actual_revenue),
    actual_sales_calls: String(monthly.actual_sales_calls),
    notes: monthly.notes ?? "",
    target_content_published: toFormValue(monthly.target_content_published),
    target_leads: toFormValue(monthly.target_leads),
    target_new_customers: toFormValue(monthly.target_new_customers),
    target_revenue: toFormValue(monthly.target_revenue),
    target_sales_calls: toFormValue(monthly.target_sales_calls),
  };
}

function createSnapshotForm(snapshot: SocialSnapshot | null, snapshotDate = getToday()): SnapshotForm {
  return {
    attributed_leads_count: snapshot ? toFormValue(snapshot.attributed_leads_count) : "",
    followers_count: snapshot ? String(snapshot.followers_count) : "0",
    notes: snapshot?.notes ?? "",
    profile_visits_count: snapshot ? toFormValue(snapshot.profile_visits_count) : "",
    snapshot_date: snapshotDate,
    views_count: snapshot ? toFormValue(snapshot.views_count) : "",
  };
}

function parseNumber(value: string, emptyValue: number | null) {
  if (!value.trim()) {
    return emptyValue;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isNonNegativeNumber(value: string, optional = false) {
  const parsed = parseNumber(value, optional ? null : 0);
  return parsed === null || (Number.isFinite(parsed) && parsed >= 0);
}

function isNonNegativeInteger(value: string, optional = false) {
  const parsed = parseNumber(value, optional ? null : 0);
  return parsed === null || (Number.isInteger(parsed) && parsed >= 0);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "אירעה שגיאה. נסו שוב.";
}

async function getJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(payload?.error || "לא הצלחנו להשלים את הפעולה.");
  }

  return payload as T;
}

function getProgress(actual: number, target: number | null) {
  if (target === null || target <= 0) {
    return null;
  }

  const percentage = (actual / target) * 100;
  return Number.isFinite(percentage) && percentage >= 0 ? percentage : null;
}

function getPaceLabel(progress: number | null, selectedMonth: string) {
  if (progress === null) {
    return null;
  }

  const currentMonth = getCurrentMonth();
  if (selectedMonth > currentMonth) {
    return "חודש עתידי";
  }

  if (selectedMonth < currentMonth) {
    return "תוצאה סופית";
  }

  const { day, month, year } = getJerusalemDateParts();
  const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  const elapsed = (Number(day) / daysInMonth) * 100;
  const difference = progress - elapsed;

  if (difference > 10) {
    return "לפני הקצב";
  }

  if (difference < -10) {
    return "מאחורי הקצב";
  }

  return "בקצב";
}

function getComparison(actual: number, previous: number | null, money = false) {
  if (previous === null) {
    return "אין נתוני חודש קודם";
  }

  const difference = actual - previous;
  const formattedDifference = money
    ? `${difference >= 0 ? "+" : ""}${formatMoney(difference)}`
    : `${difference >= 0 ? "+" : ""}${formatNumber(difference)}`;

  if (previous === 0) {
    return `${formattedDifference} · אין בסיס להשוואת אחוזים`;
  }

  const percentage = (difference / previous) * 100;
  return `${formattedDifference} (${percentage >= 0 ? "+" : ""}${formatNumber(percentage)}%)`;
}

function safeRate(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return null;
  }

  const value = (numerator / denominator) * 100;
  return Number.isFinite(value) ? value : null;
}

function safeLeadRate(numerator: number, monthlyLeads: number | null) {
  if (monthlyLeads === null) {
    return null;
  }

  if (monthlyLeads === 0) {
    return 0;
  }

  return safeRate(numerator, monthlyLeads);
}

function getProfileLastUpdated(profile: ProfileWithSnapshots) {
  const profileUpdatedAt = new Date(profile.updated_at).getTime();
  const snapshotUpdatedAt = profile.latest_snapshot
    ? new Date(profile.latest_snapshot.updated_at).getTime()
    : 0;
  const latestTimestamp = Math.max(profileUpdatedAt, snapshotUpdatedAt);

  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(latestTimestamp));
}

function getBusinessInsights(
  leadAnalytics: BusinessCenterLeadAnalytics | null,
  resolvedMonthlyLeads: number | null,
  monthly: MonthlyMetrics | null,
  profiles: ProfileWithSnapshots[],
  selectedMonth: string,
) {
  const activeProfiles = profiles.filter((profile) => profile.is_active);
  const measuredThisMonth = activeProfiles.filter(
    (profile) => profile.latest_snapshot?.snapshot_date.slice(0, 7) === selectedMonth,
  );
  const profilesMissingMeasurement = activeProfiles.length - measuredThisMonth.length;
  const actualCalls = monthly?.actual_sales_calls ?? 0;
  const actualCustomers = monthly?.actual_new_customers ?? 0;
  const leadToCallRate = safeLeadRate(actualCalls, resolvedMonthlyLeads);
  const callToCustomerRate = safeRate(actualCustomers, actualCalls);
  const attributedLeads = measuredThisMonth.reduce(
    (total, profile) => total + (profile.latest_snapshot?.attributed_leads_count ?? 0),
    0,
  );
  const profilesWithGrowth = measuredThisMonth
    .map((profile) => {
      const baseline = profile.thirty_day_snapshot ?? profile.previous_snapshot;
      return {
        growth:
          profile.latest_snapshot && baseline
            ? profile.latest_snapshot.followers_count - baseline.followers_count
            : null,
        name: profile.display_name,
      };
    })
    .filter((profile): profile is { growth: number; name: string } => profile.growth !== null)
    .sort((a, b) => b.growth - a.growth);
  const bestSocialGrowth = profilesWithGrowth[0] ?? null;

  let salesText = "עדיין אין נתוני לידים מה־CRM לניתוח מצב המכירות.";
  if (leadAnalytics) {
    const activity = leadAnalytics.monthlyActivity;
    salesText =
      activity.total === 0
        ? "לא נכנסו לידים בחודש שנבחר לפי נתוני ה־CRM."
        : `${activity.total} לידים נכנסו בחודש שנבחר. ${activity.currentOpen} מהם עדיין פתוחים, ו־${activity.currentWon} נסגרו בהצלחה.`;
  } else if (monthly) {
    if (resolvedMonthlyLeads === 0) {
      salesText = "לא הוזנו לידים חדשים החודש, ולכן עדיין אי אפשר לזהות את ביצועי משפך המכירה.";
    } else if (leadToCallRate !== null && leadToCallRate < 30) {
      salesText = `רק ${formatNumber(leadToCallRate)}% מהלידים הגיעו לשיחת מכירה. נקודת השיפור המרכזית היא מעבר מהתעניינות לשיחה.`;
    } else if (callToCustomerRate !== null && callToCustomerRate < 20) {
      salesText = `רק ${formatNumber(callToCustomerRate)}% משיחות המכירה הפכו ללקוחות. כדאי לבדוק את איכות השיחות ותהליך הסגירה.`;
    } else if (actualCustomers > 0) {
      salesText = `${actualCustomers} לקוחות חדשים נרשמו החודש. משפך המכירה פעיל, וכדאי לשמר את הפעולות שמביאות שיחות איכותיות.`;
    } else {
      salesText = "יש פעילות במעלה משפך המכירה, אך עדיין לא נרשמו לקוחות חדשים החודש.";
    }
  }

  let socialText = "עדיין לא נוספו פרופילים פעילים לניתוח רשתות חברתיות.";
  if (activeProfiles.length > 0 && measuredThisMonth.length === 0) {
    socialText = "יש פרופילים פעילים, אך אין עבורם מדידה בחודש שנבחר. עדכון קצר יאפשר לזהות מגמות.";
  } else if (measuredThisMonth.length > 0) {
    const growthText = bestSocialGrowth
      ? bestSocialGrowth.growth > 0
        ? `הצמיחה הבולטת ביותר היא ב־${bestSocialGrowth.name}: תוספת של ${formatNumber(bestSocialGrowth.growth)} עוקבים.`
        : "לא נרשמה עדיין צמיחה חיובית בעוקבים במדידות הזמינות."
      : "נדרשת לפחות מדידה קודמת אחת כדי לחשב מגמת עוקבים.";
    const leadsText =
      attributedLeads > 0
        ? ` לפי המדידות החודשיות יוחסו לרשתות ${formatNumber(attributedLeads)} לידים.`
        : " עדיין לא יוחסו לידים למדידות החודשיות.";
    socialText = `${growthText}${leadsText}`;
  }

  let actionText = "הגדירו יעדים ותוצאות לחודש כדי לקבל כיוון פעולה מבוסס נתונים.";
  const revenueProgress = monthly
    ? getProgress(monthly.actual_revenue, monthly.target_revenue)
    : null;
  const revenuePace = getPaceLabel(revenueProgress, selectedMonth);

  if (leadAnalytics) {
    if (leadAnalytics.priorities.overdueCount > 0) {
      actionText = `יש ${leadAnalytics.priorities.overdueCount} לידים שמועד החזרה אליהם עבר. מומלץ להתחיל מהחזרה הוותיקה ביותר.`;
    } else if (leadAnalytics.priorities.callbacks.total > 0) {
      actionText = `יש ${leadAnalytics.priorities.callbacks.total} לידים שמועד החזרה אליהם הגיע היום.`;
    } else if (leadAnalytics.priorities.followupRequiredCount > 0) {
      actionText = `יש ${leadAnalytics.priorities.followupRequiredCount} לידים שמסומנים כדורשים המשך טיפול.`;
    } else if (leadAnalytics.priorities.newLeads.total > 0) {
      actionText = `יש ${leadAnalytics.priorities.newLeads.total} לידים חדשים שממתינים לטיפול. מומלץ להתחיל מהליד הוותיק ביותר.`;
    } else {
      actionText = "אין כרגע לידים חדשים, חזרות שמועדן הגיע או לידים שמסומנים כדורשים המשך טיפול.";
    }
  } else if (monthly && revenuePace === "מאחורי הקצב") {
    actionText = "ההכנסה מאחורי הקצב החודשי. התמקדו בפעולה שמקדמת את הלידים הקרובים ביותר לשיחת מכירה או לסגירה.";
  } else if (monthly && leadToCallRate !== null && leadToCallRate < 30) {
    actionText = "העדיפות החודש היא להגדיל את מספר שיחות המכירה מתוך הלידים שכבר נכנסו.";
  } else if (monthly && callToCustomerRate !== null && callToCustomerRate < 20) {
    actionText = "העדיפות החודש היא לשפר פולואפ וסגירה לאחר שיחות המכירה.";
  } else if (profilesMissingMeasurement > 0) {
    actionText = `חסרה מדידה חודשית ב־${profilesMissingMeasurement} פרופילים פעילים. השלמת הנתונים תחדד את ניתוח הערוצים.`;
  } else if (bestSocialGrowth?.growth && bestSocialGrowth.growth > 0) {
    actionText = `כדאי לבדוק איזה תוכן או פעילות הובילו לצמיחה ב־${bestSocialGrowth.name}, ולחזור על מה שעבד.`;
  } else if (monthly) {
    actionText = "הנתונים מעודכנים. המשיכו לעקוב אחר משפך המכירה והערוצים שמייצרים לידים בפועל.";
  }

  return [
    {
      icon: TrendingUp,
      label: "מצב המכירות",
      text: salesText,
    },
    {
      icon: Share2,
      label: "תמונת הרשתות",
      text: socialText,
    },
    {
      icon: Lightbulb,
      label: "הפעולה המומלצת",
      text: actionText,
    },
  ];
}

function MetricCard({
  actual,
  label,
  money,
  pace,
  previous,
  progress,
  source,
  target,
}: {
  actual: number;
  label: string;
  money?: boolean;
  pace: string | null;
  previous: number | null;
  progress: number | null;
  source: "crm" | "manual";
  target: number | null;
}) {
  return (
    <article className="card-default min-w-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-zinc-300">{label}</p>
            <span className="rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-[10px] font-bold text-gold-soft">
              {source === "crm" ? "אוטומטי מה־CRM" : "הזנה ידנית"}
            </span>
          </div>
          <p className="mt-2 break-words text-2xl font-black text-white sm:text-3xl">
            {money ? formatMoney(actual) : formatNumber(actual)}
          </p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold-soft">
          <Target className="h-5 w-5" />
        </span>
      </div>

      <p className="mt-3 text-xs text-zinc-400">
        {target === null
          ? "לא הוגדר יעד"
          : `יעד: ${money ? formatMoney(target) : formatNumber(target)}`}
      </p>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-l from-gold to-gold-soft transition-all"
          style={{ width: `${Math.min(progress ?? 0, 100)}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-gold-soft">
          {progress === null ? "לא הוגדר יעד" : `${formatNumber(progress)}%`}
        </span>
        {pace ? (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-zinc-300">
            {pace}
          </span>
        ) : null}
      </div>

      <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs leading-5 text-zinc-500">
        מול חודש קודם: {getComparison(actual, previous, money)}
      </p>
    </article>
  );
}

function FormField({
  children,
  hint,
  label,
}: {
  children: React.ReactNode;
  hint?: string;
  label: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-bold text-zinc-300">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs leading-5 text-zinc-500">{hint}</span> : null}
    </label>
  );
}

export function BusinessCenter() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [pendingMonth, setPendingMonth] = useState<string | null>(null);
  const [data, setData] = useState<BusinessCenterResponse | null>(null);
  const [monthlyForm, setMonthlyForm] = useState<MonthlyForm>(emptyMonthlyForm);
  const [savedMonthlyForm, setSavedMonthlyForm] = useState<MonthlyForm>(emptyMonthlyForm);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [snapshotProfileId, setSnapshotProfileId] = useState<string | null>(null);
  const [snapshotForm, setSnapshotForm] = useState<SnapshotForm>(createSnapshotForm(null));
  const [loading, setLoading] = useState(true);
  const [savingMonthly, setSavingMonthly] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isDirty = JSON.stringify(monthlyForm) !== JSON.stringify(savedMonthlyForm);

  async function loadBusinessCenter(
    month: string,
    signal?: AbortSignal,
    options: { preserveMonthlyForm?: boolean; silent?: boolean } = {},
  ) {
    if (!options.silent) {
      setLoading(true);
    }
    setError("");

    try {
      const response = await fetch(`/api/business-center?month=${getMonthStart(month)}`, {
        cache: "no-store",
        signal,
      });
      const payload = await getJson<BusinessCenterResponse>(response);
      const nextForm = monthlyToForm(payload.monthly);
      setData(payload);
      if (!options.preserveMonthlyForm) {
        setMonthlyForm(nextForm);
        setSavedMonthlyForm(nextForm);
      }
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }

      setError(getErrorMessage(loadError));
      if (!options.silent) {
        setData(null);
      }
    } finally {
      if (!signal?.aborted && !options.silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadBusinessCenter(selectedMonth, controller.signal);
    return () => controller.abort();
  }, [selectedMonth]);

  function updateMonthlyField(field: keyof MonthlyForm, value: string) {
    setMonthlyForm((current) => ({ ...current, [field]: value }));
    setSuccess("");
  }

  function validateMonthlyForm() {
    if (
      !isNonNegativeNumber(monthlyForm.target_revenue, true) ||
      !isNonNegativeNumber(monthlyForm.actual_revenue)
    ) {
      return "יש להזין סכומי הכנסה תקינים שאינם שליליים.";
    }

    const countFields: Array<[keyof MonthlyForm, boolean]> = [
      ["target_leads", true],
      ["target_sales_calls", true],
      ["target_new_customers", true],
      ["target_content_published", true],
      ["actual_sales_calls", false],
      ["actual_new_customers", false],
      ["actual_content_published", false],
    ];

    if (countFields.some(([field, optional]) => !isNonNegativeInteger(monthlyForm[field], optional))) {
      return "יעדים ותוצאות מסוג ספירה חייבים להיות מספרים שלמים שאינם שליליים.";
    }

    if (monthlyForm.notes.length > 1000) {
      return "ההערה החודשית יכולה להכיל עד 1,000 תווים.";
    }

    return "";
  }

  async function saveMonthly() {
    const validationError = validateMonthlyForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSavingMonthly(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/business-center", {
        body: JSON.stringify({
          ...monthlyForm,
          month_start: getMonthStart(selectedMonth),
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const payload = await getJson<{ monthly: MonthlyMetrics }>(response);
      const nextForm = monthlyToForm(payload.monthly);
      setMonthlyForm(nextForm);
      setSavedMonthlyForm(nextForm);
      setData((current) =>
        current
          ? {
              ...current,
              monthly: payload.monthly,
            }
          : current,
      );
      setSuccess("הנתונים החודשיים נשמרו בהצלחה.");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSavingMonthly(false);
    }
  }

  function requestMonthChange(month: string) {
    if (!month || month === selectedMonth) {
      return;
    }

    if (isDirty) {
      setPendingMonth(month);
      return;
    }

    setSelectedMonth(month);
  }

  function continueMonthChange() {
    if (!pendingMonth) {
      return;
    }

    setSelectedMonth(pendingMonth);
    setPendingMonth(null);
    setSuccess("");
    setError("");
  }

  function openNewProfileForm() {
    setProfileForm({ ...emptyProfileForm });
    setEditingProfileId(null);
    setShowProfileForm(true);
    setSuccess("");
  }

  function openEditProfileForm(profile: ProfileWithSnapshots) {
    setProfileForm({
      display_name: profile.display_name,
      followers_goal: toFormValue(profile.followers_goal),
      handle: profile.handle ?? "",
      is_active: profile.is_active,
      platform: profile.platform,
      profile_url: profile.profile_url ?? "",
    });
    setEditingProfileId(profile.id);
    setShowProfileForm(true);
    setSuccess("");
  }

  function validateProfileForm() {
    if (!profileForm.display_name.trim()) {
      return "יש להזין שם תצוגה לפרופיל.";
    }

    if (!profileForm.handle.trim() && !profileForm.profile_url.trim()) {
      return "יש להזין לפחות Handle או קישור לפרופיל.";
    }

    if (!isNonNegativeInteger(profileForm.followers_goal, true)) {
      return "יעד העוקבים חייב להיות מספר שלם שאינו שלילי.";
    }

    if (profileForm.profile_url.trim()) {
      try {
        const url = new URL(profileForm.profile_url);
        if (!["http:", "https:"].includes(url.protocol)) {
          return "יש להזין קישור פרופיל תקין.";
        }
      } catch {
        return "יש להזין קישור פרופיל תקין.";
      }
    }

    return "";
  }

  async function saveProfile() {
    const validationError = validateProfileForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSavingProfile(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/business-center", {
        body: JSON.stringify({
          ...profileForm,
          id: editingProfileId,
          kind: "profile",
        }),
        headers: { "Content-Type": "application/json" },
        method: editingProfileId ? "PATCH" : "POST",
      });
      await getJson<{ profile: SocialProfile }>(response);
      setSuccess(editingProfileId ? "הפרופיל עודכן בהצלחה." : "הפרופיל נוסף בהצלחה.");
      setShowProfileForm(false);
      setEditingProfileId(null);
      setProfileForm({ ...emptyProfileForm });
      await loadBusinessCenter(selectedMonth, undefined, {
        preserveMonthlyForm: true,
        silent: true,
      });
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSavingProfile(false);
    }
  }

  async function toggleProfile(profile: ProfileWithSnapshots) {
    setSavingProfile(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/business-center", {
        body: JSON.stringify({
          display_name: profile.display_name,
          followers_goal: profile.followers_goal,
          handle: profile.handle,
          id: profile.id,
          is_active: !profile.is_active,
          kind: "profile",
          platform: profile.platform,
          profile_url: profile.profile_url,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      await getJson<{ profile: SocialProfile }>(response);
      setSuccess(profile.is_active ? "הפרופיל הושבת." : "הפרופיל הופעל.");
      await loadBusinessCenter(selectedMonth, undefined, {
        preserveMonthlyForm: true,
        silent: true,
      });
    } catch (toggleError) {
      setError(getErrorMessage(toggleError));
    } finally {
      setSavingProfile(false);
    }
  }

  function openSnapshotForm(profile: ProfileWithSnapshots) {
    const today = getToday();
    const existingSnapshot = profile.snapshots.find(
      (snapshot) => snapshot.snapshot_date === today,
    );
    setSnapshotProfileId(profile.id);
    setSnapshotForm(createSnapshotForm(existingSnapshot ?? null, today));
    setSuccess("");
  }

  function changeSnapshotDate(profile: ProfileWithSnapshots, snapshotDate: string) {
    const existingSnapshot = profile.snapshots.find(
      (snapshot) => snapshot.snapshot_date === snapshotDate,
    );
    setSnapshotForm(createSnapshotForm(existingSnapshot ?? null, snapshotDate));
  }

  function validateSnapshotForm() {
    if (snapshotForm.snapshot_date > getToday()) {
      return "לא ניתן לשמור תאריך מדידה עתידי.";
    }

    if (!isNonNegativeInteger(snapshotForm.followers_count)) {
      return "מספר העוקבים חייב להיות מספר שלם שאינו שלילי.";
    }

    const optionalCounts: Array<keyof SnapshotForm> = [
      "views_count",
      "profile_visits_count",
      "attributed_leads_count",
    ];

    if (optionalCounts.some((field) => !isNonNegativeInteger(snapshotForm[field], true))) {
      return "מדדי הרשתות חייבים להיות מספרים שלמים שאינם שליליים.";
    }

    if (snapshotForm.notes.length > 500) {
      return "הערת המדידה יכולה להכיל עד 500 תווים.";
    }

    return "";
  }

  async function saveSnapshot() {
    if (!snapshotProfileId) {
      return;
    }

    const validationError = validateSnapshotForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSavingSnapshot(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/business-center", {
        body: JSON.stringify({
          ...snapshotForm,
          kind: "snapshot",
          social_profile_id: snapshotProfileId,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      await getJson<{ snapshot: SocialSnapshot }>(response);
      setSuccess("נתוני הפרופיל נשמרו בהצלחה.");
      setSnapshotProfileId(null);
      await loadBusinessCenter(selectedMonth, undefined, {
        preserveMonthlyForm: true,
        silent: true,
      });
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSavingSnapshot(false);
    }
  }

  const monthly = data?.monthly ?? null;
  const previousMonthly = data?.previous_monthly ?? null;
  const resolvedMonthlyLeads = data?.lead_analytics.monthlyActivity.total ?? null;
  const actualCalls = monthly?.actual_sales_calls ?? (Number(monthlyForm.actual_sales_calls) || 0);
  const actualCustomers =
    monthly?.actual_new_customers ?? (Number(monthlyForm.actual_new_customers) || 0);
  const actualRevenue = monthly?.actual_revenue ?? (Number(monthlyForm.actual_revenue) || 0);
  const calculatedMetrics = [
    {
      label: "המרה מליד לשיחה",
      value: safeLeadRate(actualCalls, resolvedMonthlyLeads),
      suffix: "%",
    },
    {
      label: "המרה משיחה ללקוח",
      value: safeRate(actualCustomers, actualCalls),
      suffix: "%",
    },
    {
      label: "המרה מליד ללקוח",
      value: safeLeadRate(actualCustomers, resolvedMonthlyLeads),
      suffix: "%",
    },
    {
      label: "הכנסה ממוצעת ללקוח",
      money: true,
      value: actualCustomers > 0 ? actualRevenue / actualCustomers : null,
    },
  ];
  const businessInsights = getBusinessInsights(
    data?.lead_analytics ?? null,
    resolvedMonthlyLeads,
    monthly,
    data?.profiles ?? [],
    selectedMonth,
  );
  const isSaving = savingMonthly || savingProfile || savingSnapshot;

  return (
    <div aria-busy={loading} className="min-w-0 space-y-6" dir="rtl">
      <section className="panel relative overflow-hidden p-5 sm:p-7">
        <div className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-gold-soft">
              BUSINESS CENTER
            </p>
            <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">מרכז העסק</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              יעדים, תוצאות ונתוני רשתות חברתיות במקום אחד, בהזנה ידנית וברורה.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
            <FormField label="חודש להצגה">
              <div className="relative min-w-0 sm:w-56">
                <CalendarDays className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-gold-soft" />
                <input
                  aria-label="בחירת חודש"
                  className="field pr-10"
                  disabled={loading || isSaving}
                  onChange={(event) => requestMonthChange(event.target.value)}
                  type="month"
                  value={selectedMonth}
                />
              </div>
            </FormField>
            <Link
              className="button-secondary min-h-10 w-full gap-2 px-4 py-2 text-xs sm:w-auto"
              href="/business-center/content"
            >
              <Library className="h-4 w-4 text-gold-soft" />
              ספריית התוכן
            </Link>
          </div>
        </div>
      </section>

      {pendingMonth ? (
        <section className="rounded-2xl border border-gold/30 bg-gold/10 p-4 text-sm text-zinc-200">
          <p className="font-bold">יש שינויים שלא נשמרו בחודש הנוכחי.</p>
          <p className="mt-1 text-zinc-400">מעבר חודש יבטל את השינויים שטרם נשמרו.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="button-primary" onClick={continueMonthChange} type="button">
              לעבור בלי לשמור
            </button>
            <button
              className="button-secondary"
              onClick={() => setPendingMonth(null)}
              type="button"
            >
              להישאר בחודש
            </button>
          </div>
        </section>
      ) : null}

      <div aria-live="polite">
        <StatusMessage error={error} success={success} />
      </div>

      {loading ? (
        <section className="panel p-8 text-center text-sm text-zinc-400">
          טוען את נתוני מרכז העסק...
        </section>
      ) : data ? (
        <>
          <section aria-labelledby="business-status-title">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold-soft">
                <Gauge className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-black text-white" id="business-status-title">
                  מצב עסקי · {formatMonth(selectedMonth)}
                </h2>
                <p className="text-sm text-zinc-500">תוצאות בפועל מול היעדים שהוגדרו</p>
              </div>
            </div>

            <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {metricDefinitions.map((definition) => {
                const actual = definition.source === "crm"
                  ? resolvedMonthlyLeads ?? 0
                  : monthly?.[definition.actualKey] ?? 0;
                const target = monthly?.[definition.targetKey] ?? null;
                const previous = definition.source === "crm"
                  ? data.lead_analytics.monthlyActivity.previousTotal
                  : previousMonthly?.[definition.actualKey] ?? null;
                const progress = getProgress(actual, target);

                return (
                  <MetricCard
                    actual={actual}
                    key={definition.targetKey}
                    label={definition.label}
                    money={definition.money}
                    pace={getPaceLabel(progress, selectedMonth)}
                    previous={previous}
                    progress={progress}
                    source={definition.source}
                    target={target}
                  />
                );
              })}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {calculatedMetrics.map((metric) => (
                <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4" key={metric.label}>
                  <p className="text-xs font-bold text-zinc-400">{metric.label}</p>
                  <p className="mt-2 text-xl font-black text-white">
                    {metric.value === null
                      ? "אין מספיק נתונים"
                      : metric.money
                        ? formatMoney(metric.value)
                        : `${formatNumber(metric.value)}${metric.suffix}`}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <BusinessCenterLeadIntelligence
            analytics={data.lead_analytics}
            monthLabel={formatMonth(selectedMonth)}
          />

          <section className="panel p-5 sm:p-7" aria-labelledby="business-insights-title">
            <div className="mb-5 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold-soft">
                <Lightbulb className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-black text-white" id="business-insights-title">
                  תובנות מהנתונים
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  תמונת מצב קצרה לפי הנתונים שהוזנו לחודש ולפרופילים החברתיים.
                </p>
              </div>
            </div>

            <div className="grid min-w-0 gap-4 lg:grid-cols-3">
              {businessInsights.map((insight) => {
                const InsightIcon = insight.icon;
                return (
                  <article
                    className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"
                    key={insight.label}
                  >
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-gold/20 bg-gold/10 text-gold-soft">
                        <InsightIcon className="h-4 w-4" />
                      </span>
                      <h3 className="font-black text-white">{insight.label}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">{insight.text}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="panel p-5 sm:p-7" aria-labelledby="monthly-form-title">
            <div className="mb-6 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold-soft">
                <BarChart3 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-black text-white" id="monthly-form-title">
                  יעדים ותוצאות חודשיות
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  יעד ריק יוצג כ״לא הוגדר יעד״. תוצאה בפועל יכולה להיות 0.
                </p>
              </div>
            </div>

            {!monthly ? (
              <div className="mb-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-sm text-zinc-400">
                עדיין אין נתונים שמורים לחודש זה. הרשומה תיווצר רק לאחר שמירה.
              </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-2">
              <div>
                <h3 className="mb-4 text-sm font-black text-gold-soft">יעדים</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="יעד הכנסה">
                    <input
                      className="field"
                      inputMode="decimal"
                      min="0"
                      onChange={(event) => updateMonthlyField("target_revenue", event.target.value)}
                      placeholder="לא הוגדר יעד"
                      step="0.01"
                      type="number"
                      value={monthlyForm.target_revenue}
                    />
                  </FormField>
                  <FormField label="יעד לידים חדשים">
                    <input
                      className="field"
                      inputMode="numeric"
                      min="0"
                      onChange={(event) => updateMonthlyField("target_leads", event.target.value)}
                      placeholder="לא הוגדר יעד"
                      step="1"
                      type="number"
                      value={monthlyForm.target_leads}
                    />
                  </FormField>
                  <FormField label="יעד שיחות מכירה">
                    <input
                      className="field"
                      inputMode="numeric"
                      min="0"
                      onChange={(event) => updateMonthlyField("target_sales_calls", event.target.value)}
                      placeholder="לא הוגדר יעד"
                      step="1"
                      type="number"
                      value={monthlyForm.target_sales_calls}
                    />
                  </FormField>
                  <FormField label="יעד לקוחות חדשים">
                    <input
                      className="field"
                      inputMode="numeric"
                      min="0"
                      onChange={(event) => updateMonthlyField("target_new_customers", event.target.value)}
                      placeholder="לא הוגדר יעד"
                      step="1"
                      type="number"
                      value={monthlyForm.target_new_customers}
                    />
                  </FormField>
                  <FormField label="יעד תכנים שיפורסמו">
                    <input
                      className="field"
                      inputMode="numeric"
                      min="0"
                      onChange={(event) =>
                        updateMonthlyField("target_content_published", event.target.value)
                      }
                      placeholder="לא הוגדר יעד"
                      step="1"
                      type="number"
                      value={monthlyForm.target_content_published}
                    />
                  </FormField>
                </div>
              </div>

              <div>
                <h3 className="mb-4 text-sm font-black text-gold-soft">תוצאות בפועל</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField hint="הזנה ידנית" label="הכנסה בפועל">
                    <input
                      className="field"
                      inputMode="decimal"
                      min="0"
                      onChange={(event) => updateMonthlyField("actual_revenue", event.target.value)}
                      step="0.01"
                      type="number"
                      value={monthlyForm.actual_revenue}
                    />
                  </FormField>
                  <div className="min-w-0">
                    <span className="mb-2 block text-sm font-bold text-zinc-300">
                      לידים שנכנסו בפועל
                    </span>
                    <div className="rounded-2xl border border-gold/20 bg-gold/10 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-2xl font-black text-white">
                          {resolvedMonthlyLeads === null
                            ? "אין נתון זמין"
                            : formatNumber(resolvedMonthlyLeads)}
                        </span>
                        <span className="rounded-full border border-gold/20 bg-black/20 px-2.5 py-1 text-[11px] font-bold text-gold-soft">
                          אוטומטי מה־CRM
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-zinc-500">
                        מספר הלידים מחושב לפי הלידים שנוצרו במערכת בחודש שנבחר.
                      </p>
                    </div>
                  </div>
                  <FormField hint="הזנה ידנית" label="שיחות מכירה בפועל">
                    <input
                      className="field"
                      inputMode="numeric"
                      min="0"
                      onChange={(event) => updateMonthlyField("actual_sales_calls", event.target.value)}
                      step="1"
                      type="number"
                      value={monthlyForm.actual_sales_calls}
                    />
                  </FormField>
                  <FormField hint="הזנה ידנית" label="לקוחות חדשים בפועל">
                    <input
                      className="field"
                      inputMode="numeric"
                      min="0"
                      onChange={(event) =>
                        updateMonthlyField("actual_new_customers", event.target.value)
                      }
                      step="1"
                      type="number"
                      value={monthlyForm.actual_new_customers}
                    />
                  </FormField>
                  <FormField hint="הזנה ידנית" label="תכנים שפורסמו בפועל">
                    <input
                      className="field"
                      inputMode="numeric"
                      min="0"
                      onChange={(event) =>
                        updateMonthlyField("actual_content_published", event.target.value)
                      }
                      step="1"
                      type="number"
                      value={monthlyForm.actual_content_published}
                    />
                  </FormField>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <FormField
                hint={`${monthlyForm.notes.length}/1000`}
                label="הערה חודשית (אופציונלי)"
              >
                <textarea
                  className="field min-h-28 resize-y"
                  maxLength={1000}
                  onChange={(event) => updateMonthlyField("notes", event.target.value)}
                  placeholder="מה עבד החודש, מה דרש שיפור ומה חשוב לזכור?"
                  value={monthlyForm.notes}
                />
              </FormField>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                className="button-primary gap-2"
                disabled={isSaving || !isDirty}
                onClick={() => void saveMonthly()}
                type="button"
              >
                <Save className="h-4 w-4" />
                {savingMonthly ? "שומר..." : "שמירת נתוני החודש"}
              </button>
              {!isDirty && monthly ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  כל השינויים נשמרו
                </span>
              ) : null}
            </div>
          </section>

          <section className="panel p-5 sm:p-7" aria-labelledby="social-profiles-title">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold-soft">
                  <UsersRound className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-black text-white" id="social-profiles-title">
                    פרופילים ברשתות החברתיות
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    הנתונים מוזנים ידנית ומוצגים לפי החודש שנבחר.
                  </p>
                </div>
              </div>
              <button
                className="button-primary gap-2"
                disabled={isSaving}
                onClick={openNewProfileForm}
                type="button"
              >
                <Plus className="h-4 w-4" />
                הוספת פרופיל
              </button>
            </div>

            {showProfileForm ? (
              <div className="mt-6 rounded-2xl border border-gold/20 bg-gold/[0.04] p-4 sm:p-5">
                <h3 className="text-base font-black text-white">
                  {editingProfileId ? "עריכת פרופיל" : "פרופיל חדש"}
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField label="פלטפורמה">
                    <select
                      className="field"
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          platform: event.target.value as SocialProfile["platform"],
                        }))
                      }
                      value={profileForm.platform}
                    >
                      {platformOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="שם תצוגה">
                    <input
                      className="field"
                      maxLength={120}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          display_name: event.target.value,
                        }))
                      }
                      placeholder="לדוגמה: GoldenFlow"
                      value={profileForm.display_name}
                    />
                  </FormField>
                  <FormField label="Handle / שם משתמש">
                    <input
                      className="field"
                      maxLength={100}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          handle: event.target.value,
                        }))
                      }
                      placeholder="@goldenflow"
                      value={profileForm.handle}
                    />
                  </FormField>
                  <FormField label="קישור לפרופיל">
                    <input
                      className="field"
                      maxLength={500}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          profile_url: event.target.value,
                        }))
                      }
                      placeholder="https://..."
                      type="url"
                      value={profileForm.profile_url}
                    />
                  </FormField>
                  <FormField label="יעד עוקבים (אופציונלי)">
                    <input
                      className="field"
                      inputMode="numeric"
                      min="0"
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          followers_goal: event.target.value,
                        }))
                      }
                      step="1"
                      type="number"
                      value={profileForm.followers_goal}
                    />
                  </FormField>
                  <FormField label="מצב הפרופיל">
                    <label className="flex min-h-[46px] items-center gap-3 rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-zinc-300">
                      <input
                        checked={profileForm.is_active}
                        onChange={(event) =>
                          setProfileForm((current) => ({
                            ...current,
                            is_active: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                      פרופיל פעיל
                    </label>
                  </FormField>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  חובה להזין לפחות Handle או קישור לפרופיל.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    className="button-primary gap-2"
                    disabled={isSaving}
                    onClick={() => void saveProfile()}
                    type="button"
                  >
                    <Save className="h-4 w-4" />
                    {savingProfile ? "שומר..." : editingProfileId ? "שמירת שינויים" : "הוספת פרופיל"}
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => {
                      setShowProfileForm(false);
                      setEditingProfileId(null);
                    }}
                    type="button"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            ) : null}

            {data.profiles.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                <UsersRound className="mx-auto h-9 w-9 text-zinc-600" />
                <p className="mt-3 font-bold text-zinc-300">עדיין לא נוספו פרופילים חברתיים</p>
                <p className="mt-1 text-sm text-zinc-500">
                  הוסיפו פרופיל ראשון כדי להתחיל לתעד התקדמות ידנית.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid min-w-0 gap-4 xl:grid-cols-2">
                {data.profiles.map((profile) => {
                  const latest = profile.latest_snapshot;
                  const previous = profile.previous_snapshot;
                  const thirtyDay = profile.thirty_day_snapshot;
                  const latestFollowers = latest?.followers_count ?? 0;
                  const followerProgress = getProgress(latestFollowers, profile.followers_goal);

                  return (
                    <article
                      className={`card-default min-w-0 p-5 ${profile.is_active ? "" : "opacity-65"}`}
                      key={profile.id}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words text-lg font-black text-white">
                              {profile.display_name}
                            </h3>
                            <span className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-1 text-[11px] font-bold text-gold-soft">
                              הזנה ידנית
                            </span>
                            {!profile.is_active ? (
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-400">
                                לא פעיל
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-zinc-400">
                            {profile.platform}
                            {profile.handle ? ` · @${profile.handle.replace(/^@+/, "")}` : ""}
                          </p>
                          {profile.profile_url ? (
                            <a
                              className="mt-2 inline-flex max-w-full items-center gap-1.5 break-all text-xs text-gold-soft hover:text-gold"
                              href={profile.profile_url}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              פתיחת הפרופיל
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            </a>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="button-secondary min-h-9 gap-1.5 px-3 py-2 text-xs"
                            onClick={() => openEditProfileForm(profile)}
                            type="button"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            עריכה
                          </button>
                          <button
                            className="button-secondary min-h-9 px-3 py-2 text-xs"
                            disabled={isSaving}
                            onClick={() => void toggleProfile(profile)}
                            type="button"
                          >
                            {profile.is_active ? "השבתה" : "הפעלה"}
                          </button>
                        </div>
                      </div>

                      {latest ? (
                        <>
                          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                              <p className="text-[11px] text-zinc-500">עוקבים</p>
                              <p className="mt-1 font-black text-white">{formatNumber(latest.followers_count)}</p>
                            </div>
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                              <p className="text-[11px] text-zinc-500">צפיות</p>
                              <p className="mt-1 font-black text-white">
                                {latest.views_count === null ? "-" : formatNumber(latest.views_count)}
                              </p>
                            </div>
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                              <p className="text-[11px] text-zinc-500">כניסות לפרופיל</p>
                              <p className="mt-1 font-black text-white">
                                {latest.profile_visits_count === null
                                  ? "-"
                                  : formatNumber(latest.profile_visits_count)}
                              </p>
                            </div>
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                              <p className="text-[11px] text-zinc-500">לידים מיוחסים</p>
                              <p className="mt-1 font-black text-white">
                                {latest.attributed_leads_count === null
                                  ? "-"
                                  : formatNumber(latest.attributed_leads_count)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
                            <p>מדידה אחרונה: {formatDate(latest.snapshot_date)}</p>
                            <p>
                              שינוי ממדידה קודמת:{" "}
                              {previous
                                ? `${latest.followers_count - previous.followers_count >= 0 ? "+" : ""}${formatNumber(
                                    latest.followers_count - previous.followers_count,
                                  )}`
                                : "אין מספיק נתונים"}
                            </p>
                            <p>
                              שינוי כ־30 יום:{" "}
                              {thirtyDay
                                ? `${latest.followers_count - thirtyDay.followers_count >= 0 ? "+" : ""}${formatNumber(
                                    latest.followers_count - thirtyDay.followers_count,
                                  )}`
                                : "אין מספיק נתונים"}
                            </p>
                          </div>

                          {profile.followers_goal !== null ? (
                            <div className="mt-4">
                              <div className="flex items-center justify-between gap-3 text-xs">
                                <span className="text-zinc-400">
                                  יעד עוקבים: {formatNumber(profile.followers_goal)}
                                </span>
                                <span className="font-bold text-gold-soft">
                                  {followerProgress === null ? "0%" : `${formatNumber(followerProgress)}%`}
                                </span>
                              </div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                                <div
                                  className="h-full rounded-full bg-gradient-to-l from-gold to-gold-soft"
                                  style={{ width: `${Math.min(followerProgress ?? 0, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="mt-5 rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                          אין צילום מצב רלוונטי עד סוף {formatMonth(selectedMonth)}.
                        </div>
                      )}

                      <button
                        className="button-primary mt-5 w-full gap-2 sm:w-auto"
                        disabled={isSaving}
                        onClick={() => openSnapshotForm(profile)}
                        type="button"
                      >
                        <ChevronDown className="h-4 w-4" />
                        עדכון נתונים
                      </button>

                      {snapshotProfileId === profile.id ? (
                        <div className="mt-5 rounded-2xl border border-gold/20 bg-black/20 p-4">
                          <h4 className="font-black text-white">צילום מצב ידני</h4>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <FormField label="תאריך המדידה">
                              <input
                                className="field"
                                max={getToday()}
                                onChange={(event) => changeSnapshotDate(profile, event.target.value)}
                                type="date"
                                value={snapshotForm.snapshot_date}
                              />
                            </FormField>
                            <FormField label="מספר עוקבים">
                              <input
                                className="field"
                                min="0"
                                onChange={(event) =>
                                  setSnapshotForm((current) => ({
                                    ...current,
                                    followers_count: event.target.value,
                                  }))
                                }
                                step="1"
                                type="number"
                                value={snapshotForm.followers_count}
                              />
                            </FormField>
                            <FormField label="מספר צפיות (אופציונלי)">
                              <input
                                className="field"
                                min="0"
                                onChange={(event) =>
                                  setSnapshotForm((current) => ({
                                    ...current,
                                    views_count: event.target.value,
                                  }))
                                }
                                step="1"
                                type="number"
                                value={snapshotForm.views_count}
                              />
                            </FormField>
                            <FormField label="כניסות לפרופיל (אופציונלי)">
                              <input
                                className="field"
                                min="0"
                                onChange={(event) =>
                                  setSnapshotForm((current) => ({
                                    ...current,
                                    profile_visits_count: event.target.value,
                                  }))
                                }
                                step="1"
                                type="number"
                                value={snapshotForm.profile_visits_count}
                              />
                            </FormField>
                            <FormField label="לידים מיוחסים (אופציונלי)">
                              <input
                                className="field"
                                min="0"
                                onChange={(event) =>
                                  setSnapshotForm((current) => ({
                                    ...current,
                                    attributed_leads_count: event.target.value,
                                  }))
                                }
                                step="1"
                                type="number"
                                value={snapshotForm.attributed_leads_count}
                              />
                            </FormField>
                            <FormField label="הערה קצרה (אופציונלי)">
                              <input
                                className="field"
                                maxLength={500}
                                onChange={(event) =>
                                  setSnapshotForm((current) => ({
                                    ...current,
                                    notes: event.target.value,
                                  }))
                                }
                                value={snapshotForm.notes}
                              />
                            </FormField>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              className="button-primary gap-2"
                              disabled={isSaving}
                              onClick={() => void saveSnapshot()}
                              type="button"
                            >
                              <Save className="h-4 w-4" />
                              {savingSnapshot ? "שומר..." : "שמירת מדידה"}
                            </button>
                            <button
                              className="button-secondary"
                              onClick={() => setSnapshotProfileId(null)}
                              type="button"
                            >
                              ביטול
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <p className="mt-4 text-[11px] text-zinc-600">
                        עודכן לאחרונה: {getProfileLastUpdated(profile)}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="panel p-8 text-center">
          <p className="font-bold text-zinc-300">לא הצלחנו לטעון את מרכז העסק.</p>
          <p className="mt-2 text-sm text-zinc-500">
            אפשר לנסות שוב. אם הטבלאות טרם הותקנו, יש להריץ את המיגרציה של המודול.
          </p>
          <button
            className="button-primary mt-5"
            onClick={() => void loadBusinessCenter(selectedMonth)}
            type="button"
          >
            ניסיון חוזר
          </button>
        </section>
      )}
    </div>
  );
}
