import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  ContactRound,
  GitBranch,
  UserRoundPlus,
} from "lucide-react";
import type {
  BusinessCenterLeadAnalytics,
  BusinessCenterPriorityGroup,
  BusinessCenterPriorityLead,
} from "@/lib/business-center/lead-analytics";

function formatNumber(value: number) {
  return new Intl.NumberFormat("he-IL").format(Number.isFinite(value) ? value : 0);
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

function getAgeText(days: number) {
  if (days === 0) {
    return "נכנס היום";
  }

  if (days === 1) {
    return "לפני יום";
  }

  return `לפני ${formatNumber(days)} ימים`;
}

function LeadRow({ lead }: { lead: BusinessCenterPriorityLead }) {
  return (
    <article className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="break-words font-black text-white">{lead.name}</h4>
            <span className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-1 text-[11px] font-bold text-gold-soft">
              {lead.statusLabel}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span>{getAgeText(lead.ageDays)}</span>
            {lead.nextActionDate ? (
              <span>
                חזרה: {formatDateTime(lead.nextActionDate)}
                {lead.nextActionState === "overdue" && lead.overdueDays
                  ? ` · באיחור ${formatNumber(lead.overdueDays)} ימים`
                  : lead.nextActionState === "today"
                    ? " · היום"
                    : ""}
              </span>
            ) : null}
            {lead.value > 0 ? <span>פוטנציאל: {formatMoney(lead.value)}</span> : null}
          </div>
        </div>
        <Link
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-zinc-300 transition hover:border-gold/30 hover:text-gold-soft"
          href="/leads"
        >
          למסך הלידים
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

function PriorityList({
  emptyText,
  group,
  title,
}: {
  emptyText: string;
  group: BusinessCenterPriorityGroup;
  title: string;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-black text-white">{title}</h3>
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-black text-zinc-300">
          {formatNumber(group.total)}
        </span>
      </div>
      {group.items.length > 0 ? (
        <div className="space-y-3">
          {group.items.map((lead) => (
            <LeadRow key={lead.id} lead={lead} />
          ))}
          {group.total > group.items.length ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/15 px-4 py-3 text-xs text-zinc-500">
              <span>
                קיימים עוד {formatNumber(group.total - group.items.length)} לידים בקבוצה.
              </span>
              <Link className="font-bold text-gold-soft hover:text-white" href="/leads">
                לכל הלידים
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 p-5 text-sm text-zinc-500">
          {emptyText}
        </div>
      )}
    </div>
  );
}

export function BusinessCenterLeadIntelligence({
  analytics,
  monthLabel,
}: {
  analytics: BusinessCenterLeadAnalytics;
  monthLabel: string;
}) {
  const monthly = analytics.monthlyActivity;
  const changeText =
    monthly.previousTotal === 0
      ? monthly.total === 0
        ? "ללא שינוי לעומת החודש הקודם"
        : "אין בסיס קודם להשוואה"
      : `${monthly.changeFromPrevious >= 0 ? "+" : ""}${formatNumber(monthly.changeFromPrevious)} לעומת החודש הקודם`;

  return (
    <>
      <section className="panel p-5 sm:p-7" aria-labelledby="monthly-leads-title">
        <div className="mb-5 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold-soft">
            <ContactRound className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-black text-white" id="monthly-leads-title">
              פעילות הלידים בחודש
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              נתוני יצירה מה־CRM עבור {monthLabel}, ללא תלות בסטטוס הנוכחי.
            </p>
          </div>
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <article className="card-default min-w-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-zinc-400">לידים שנכנסו החודש</p>
              <span className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-[11px] font-bold text-gold-soft">
                אוטומטי מה־CRM
              </span>
            </div>
            <p className="mt-4 text-4xl font-black text-white sm:text-5xl">
              {formatNumber(monthly.total)}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              {monthly.total === 0
                ? `לא נכנסו לידים חדשים ב${monthLabel}.`
                : `לידים שנוצרו ב${monthLabel}.`}
            </p>
            <p className="mt-4 text-xs font-bold text-zinc-400">{changeText}</p>
          </article>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { label: "פתוחים כיום", value: monthly.currentOpen },
              { label: "נסגרו בהצלחה", value: monthly.currentWon },
              { label: "לא רלוונטיים", value: monthly.currentIrrelevant },
            ].map((item) => (
              <article
                className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"
                key={item.label}
              >
                <p className="text-xs font-bold text-zinc-500">{item.label}</p>
                <p className="mt-2 text-2xl font-black text-white">
                  {formatNumber(item.value)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="panel p-5 sm:p-7" aria-labelledby="lead-priorities-title">
        <div className="mb-5 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold-soft">
            <AlertCircle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-black text-white" id="lead-priorities-title">
              עדיפויות לטיפול עכשיו
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              מצב עדכני להיום · אוטומטי מה־CRM · לקריאה וניווט בלבד
            </p>
          </div>
        </div>

        <div className="mb-7 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              icon: UserRoundPlus,
              label: "לידים חדשים כרגע",
              value: analytics.priorities.newLeads.total,
            },
            {
              icon: AlertCircle,
              label: "דורשים המשך טיפול",
              value: analytics.priorities.followupRequiredCount,
            },
            {
              icon: CalendarClock,
              label: "חזרות באיחור",
              value: analytics.priorities.overdueCount,
            },
            {
              icon: CalendarClock,
              label: "חזרות להיום",
              value: analytics.priorities.todayCount,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article
                className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"
                key={item.label}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-zinc-500">{item.label}</p>
                  <Icon className="h-4 w-4 text-gold-soft" />
                </div>
                <p className="mt-2 text-2xl font-black text-white">
                  {formatNumber(item.value)}
                </p>
              </article>
            );
          })}
        </div>

        <div className="grid min-w-0 gap-7">
          <PriorityList
            emptyText="אין כרגע לידים שדורשים טיפול מיידי."
            group={analytics.priorities.immediate}
            title="דורשים טיפול מיידי"
          />
          <PriorityList
            emptyText="אין כרגע לידים חדשים שממתינים לטיפול."
            group={analytics.priorities.newLeads}
            title="לידים חדשים שממתינים לטיפול"
          />
          <PriorityList
            emptyText="אין כרגע לידים שמועד החזרה אליהם הגיע."
            group={analytics.priorities.callbacks}
            title="לידים שממתינים לחזרה"
          />
        </div>
      </section>

      <section className="panel p-5 sm:p-7" aria-labelledby="pipeline-now-title">
        <div className="mb-5 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold-soft">
            <GitBranch className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-black text-white" id="pipeline-now-title">
              מצב צינור המכירות עכשיו
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              מצב עדכני להיום · אוטומטי מה־CRM
            </p>
          </div>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {analytics.pipeline.map((stage) => (
            <article
              className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"
              key={stage.status}
            >
              <p className="break-words text-xs font-bold text-zinc-500">{stage.label}</p>
              <p className="mt-2 text-2xl font-black text-white">
                {formatNumber(stage.count)}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Link className="button-secondary gap-2" href="/pipeline">
            למסלול המכירה
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
