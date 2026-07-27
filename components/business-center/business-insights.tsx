import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Lightbulb,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { BusinessInsightsCharts } from "@/components/business-center/insights-charts";
import {
  getBusinessInsightsHref,
  type BusinessPeriodSummary,
  type BusinessTrendSeries,
  type SummaryMetric,
} from "@/lib/business-center/insights";

function formatNumber(value: number) {
  return new Intl.NumberFormat("he-IL", {
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("he-IL", {
    currency: "ILS",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function MetricCard({ metric }: { metric: SummaryMetric }) {
  const value =
    metric.available && metric.value !== null
      ? metric.kind === "money"
        ? formatMoney(metric.value)
        : formatNumber(metric.value)
      : metric.unavailableText ?? "לא זמין";
  const temporalLabel =
    metric.temporalNature === "historical"
      ? "נתון היסטורי"
      : metric.temporalNature === "current_state"
        ? "מצב נוכחי"
        : metric.temporalNature === "manual"
          ? "הזנה ידנית"
          : "מידע חסר";

  return (
    <article className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 break-words text-xs font-bold text-zinc-500">
          {metric.label}
        </p>
        <span className="shrink-0 rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
          {temporalLabel}
        </span>
      </div>
      <p
        className={`mt-3 break-words text-2xl font-black ${
          metric.available ? "text-white" : "text-zinc-400"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">
        {metric.explanation}
      </p>
    </article>
  );
}

export function BusinessInsights({
  summary,
  trends,
}: {
  summary: BusinessPeriodSummary;
  trends: BusinessTrendSeries;
}) {
  const profileId = trends.followers.selectedProfileId;
  const period = summary.period;
  const metrics = [
    summary.metrics.leadsEntered,
    summary.metrics.progressed,
    summary.metrics.closed,
    summary.metrics.revenue,
    ...(summary.metrics.revenueTarget
      ? [summary.metrics.revenueTarget]
      : []),
    summary.metrics.contentPublished,
  ];
  const weeklyHref = getBusinessInsightsHref(
    "week",
    period.type === "week" ? period.key : period.currentWeekKey,
    profileId,
  );
  const monthlyHref = getBusinessInsightsHref(
    "month",
    period.type === "month" ? period.key : period.currentMonthKey,
    profileId,
  );

  return (
    <div className="min-w-0 space-y-6" dir="rtl">
      <section className="panel relative overflow-hidden p-5 sm:p-7">
        <div className="pointer-events-none absolute -left-16 top-0 h-52 w-52 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative">
          <Link
            className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-zinc-400 hover:text-gold-soft"
            href="/business-center"
          >
            <ArrowRight className="h-4 w-4" />
            חזרה למרכז העסק
          </Link>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.26em] text-gold-soft">
                BUSINESS INSIGHTS
              </p>
              <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">
                סיכומים ומגמות
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                תמונת מצב תקופתית המבוססת על נתוני ה־CRM, מרכז העסק והרשתות
                החברתיות בלבד.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 lg:w-auto lg:items-end">
              <div
                aria-label="בחירת סוג סיכום"
                className="grid w-full grid-cols-2 gap-2 rounded-2xl border border-white/[0.08] bg-black/20 p-1.5 lg:w-64"
                role="tablist"
              >
                <Link
                  aria-current={period.type === "week" ? "page" : undefined}
                  className={
                    period.type === "week"
                      ? "button-primary min-h-10 px-4 py-2 text-xs"
                      : "button-secondary min-h-10 px-4 py-2 text-xs"
                  }
                  href={weeklyHref}
                  role="tab"
                >
                  שבועי
                </Link>
                <Link
                  aria-current={period.type === "month" ? "page" : undefined}
                  className={
                    period.type === "month"
                      ? "button-primary min-h-10 px-4 py-2 text-xs"
                      : "button-secondary min-h-10 px-4 py-2 text-xs"
                  }
                  href={monthlyHref}
                  role="tab"
                >
                  חודשי
                </Link>
              </div>
              <div className="flex w-full flex-wrap items-center justify-end gap-2">
                <Link
                  aria-label={`מעבר ל${period.type === "week" ? "שבוע" : "חודש"} הקודם`}
                  className="button-secondary min-h-10 gap-1.5 px-3 py-2 text-xs"
                  href={getBusinessInsightsHref(
                    period.type,
                    period.previousKey,
                    profileId,
                  )}
                >
                  <ChevronRight className="h-4 w-4" />
                  קודם
                </Link>
                {!period.isCurrent ? (
                  <Link
                    aria-label={`חזרה ל${period.type === "week" ? "שבוע" : "חודש"} הנוכחי`}
                    className="button-secondary min-h-10 gap-1.5 px-3 py-2 text-xs"
                    href={getBusinessInsightsHref(
                      period.type,
                      period.currentKey,
                      profileId,
                    )}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    נוכחי
                  </Link>
                ) : null}
                {period.nextKey ? (
                  <Link
                    aria-label={`מעבר ל${period.type === "week" ? "שבוע" : "חודש"} הבא`}
                    className="button-secondary min-h-10 gap-1.5 px-3 py-2 text-xs"
                    href={getBusinessInsightsHref(
                      period.type,
                      period.nextKey,
                      profileId,
                    )}
                  >
                    הבא
                    <ChevronLeft className="h-4 w-4" />
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="inline-flex min-h-10 cursor-not-allowed items-center gap-1.5 rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2 text-xs font-bold text-zinc-600"
                  >
                    הבא
                    <ChevronLeft className="h-4 w-4" />
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3">
            <CalendarDays className="h-4 w-4 shrink-0 text-gold-soft" />
            <p className="font-bold text-zinc-200">{period.label}</p>
            {period.isCurrent ? (
              <span className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-[11px] font-bold text-gold-soft">
                סיכום ביניים — נתונים עד כה
              </span>
            ) : (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-zinc-400">
                תקופה שהסתיימה
              </span>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="period-summary-title">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold-soft">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-black text-white" id="period-summary-title">
              סיכום {period.type === "week" ? "שבועי" : "חודשי"}
            </h2>
            <p className="text-sm text-zinc-500">
              מקורות הנתונים וההבהרות מוצגים בכל כרטיס.
            </p>
          </div>
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
          <article className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 break-words text-xs font-bold text-zinc-500">
                {summary.leadingSource.label}
              </p>
              <span className="shrink-0 rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                לפי כמות לידים
              </span>
            </div>
            {summary.leadingSource.available ? (
              <>
                <p className="mt-3 break-words text-2xl font-black text-white">
                  {summary.leadingSource.name}
                </p>
                <p className="mt-1 text-sm font-bold text-gold-soft">
                  {formatNumber(summary.leadingSource.count)} לידים ·{" "}
                  {formatNumber(summary.leadingSource.percentage)}%
                </p>
              </>
            ) : (
              <p className="mt-3 text-2xl font-black text-zinc-400">לא זמין</p>
            )}
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              {summary.leadingSource.explanation}
            </p>
          </article>
        </div>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[1.35fr_1fr]">
        <article className="panel min-w-0 p-5 sm:p-7" aria-labelledby="stuck-leads-title">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-danger/25 bg-danger/10 text-red-200">
              <AlertCircle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-white" id="stuck-leads-title">
                לידים שדורשים טיפול
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                קודם פעולות באיחור, ואז לידים ללא פעולה שלא עודכנו לפחות שבעה ימים.
              </p>
            </div>
          </div>

          {!summary.stuckLeads.available ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/15 p-5 text-sm text-zinc-500">
              לא ניתן לטעון כרגע את רשימת הלידים שדורשים טיפול.
            </div>
          ) : summary.stuckLeads.items.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/15 p-5 text-sm text-zinc-500">
              לא נמצאו כרגע לידים עם פעולה באיחור או ללא פעולה מתוכננת.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {summary.stuckLeads.items.map((lead) => (
                <div
                  className="flex min-w-0 flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:flex-row sm:items-start sm:justify-between"
                  key={lead.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words font-black text-white">{lead.name}</h3>
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold text-zinc-400">
                        {lead.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-red-200">
                      {lead.reason}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                      {lead.nextActionDate ? (
                        <span>פעולה: {formatDateTime(lead.nextActionDate)}</span>
                      ) : (
                        <span>אין פעולה מתוכננת</span>
                      )}
                      <span>
                        {lead.days === 0
                          ? "באיחור פחות מיום"
                          : `${formatNumber(lead.days)} ימים`}
                      </span>
                    </div>
                  </div>
                  <Link
                    className="button-secondary min-h-10 shrink-0 px-4 py-2 text-xs"
                    href="/leads"
                  >
                    לפתיחת הליד
                  </Link>
                </div>
              ))}
              {summary.stuckLeads.total > summary.stuckLeads.items.length ? (
                <p className="text-xs text-zinc-500">
                  מוצגים 5 מתוך {formatNumber(summary.stuckLeads.total)} לידים
                  שדורשים טיפול.
                </p>
              ) : null}
            </div>
          )}
        </article>

        <article className="panel min-w-0 p-5 sm:p-7" aria-labelledby="next-actions-title">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold-soft">
              <Lightbulb className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-white" id="next-actions-title">
                פעולות חשובות לתקופה הבאה
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                עד שלוש פעולות דטרמיניסטיות לפי הנתונים הזמינים.
              </p>
            </div>
          </div>

          {summary.actions.length > 0 ? (
            <ol className="mt-5 space-y-3">
              {summary.actions.map((action, index) => (
                <li
                  className="flex min-w-0 items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"
                  key={action.id}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-gold/20 bg-gold/10 text-xs font-black text-gold-soft">
                    {index + 1}
                  </span>
                  <p className="min-w-0 break-words text-sm font-bold leading-6 text-zinc-300">
                    {action.text}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/15 p-5 text-sm leading-6 text-zinc-500">
              <CheckCircle2 className="mb-3 h-5 w-5 text-gold-soft" />
              לא זוהתה כרגע פעולה דחופה על בסיס הנתונים הקיימים.
            </div>
          )}

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-white/[0.07] bg-black/15 p-3 text-xs leading-5 text-zinc-500">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-gold-soft" />
            ההמלצות אינן נשמרות במסד ואינן משתמשות ב־AI.
          </div>
        </article>
      </section>

      <BusinessInsightsCharts period={period} trends={trends} />
    </div>
  );
}
