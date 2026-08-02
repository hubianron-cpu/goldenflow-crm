import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  ContactRound,
  GitBranch,
  UserRoundPlus,
} from "lucide-react";
import type {
  BusinessCenterLeadAnalytics,
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

type PriorityLeadDisplay = {
  lead: BusinessCenterPriorityLead;
  reasons: string[];
};

function getPriorityLeads(analytics: BusinessCenterLeadAnalytics): PriorityLeadDisplay[] {
  const { callbacks, immediate, newLeads } = analytics.priorities;
  const callbackIds = new Set(callbacks.items.map((lead) => lead.id));
  const newLeadIds = new Set(newLeads.items.map((lead) => lead.id));
  const leadsById = new Map<string, BusinessCenterPriorityLead>();

  [...immediate.items, ...newLeads.items, ...callbacks.items].forEach((lead) => {
    if (!leadsById.has(lead.id)) {
      leadsById.set(lead.id, lead);
    }
  });

  return Array.from(leadsById.values()).map((lead) => {
    const reasons: string[] = [];

    if (lead.nextActionState === "overdue") {
      reasons.push("פולואפ שעבר");
    } else if (lead.nextActionState === "today") {
      reasons.push("חזרה להיום");
    }

    if (lead.status === "דורש המשך טיפול") {
      reasons.push("דורש פעולה");
    }

    if (newLeadIds.has(lead.id)) {
      reasons.push("ליד חדש");
    }

    if (callbackIds.has(lead.id)) {
      reasons.push("שיחת המשך");
    }

    return { lead, reasons };
  });
}

function LeadRow({ lead, reasons }: PriorityLeadDisplay) {
  return (
    <article className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words font-black text-white">{lead.name}</p>
            <span className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-1 text-[11px] font-bold text-gold-soft">
              {lead.statusLabel}
            </span>
            {reasons.map((reason) => (
              <span
                className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold text-zinc-300"
                key={reason}
              >
                {reason}
              </span>
            ))}
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

export function BusinessCenterLeadIntelligence({
  analytics,
  monthLabel,
}: {
  analytics: BusinessCenterLeadAnalytics;
  monthLabel: string;
}) {
  const monthly = analytics.monthlyActivity;
  const priorityLeads = getPriorityLeads(analytics);

  return (
    <>
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

        <div className="mb-5 grid min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] sm:grid-cols-2 xl:grid-cols-4">
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
              <div
                className="border-b border-white/[0.07] p-4 last:border-b-0 sm:border-l sm:last:border-l-0 xl:border-b-0"
                key={item.label}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-zinc-500">{item.label}</p>
                  <Icon className="h-4 w-4 text-gold-soft" />
                </div>
                <p className="mt-2 text-2xl font-black text-white">
                  {formatNumber(item.value)}
                </p>
              </div>
            );
          })}
        </div>

        {priorityLeads.length > 0 ? (
          <div className="space-y-3">
            {priorityLeads.map((item) => (
              <LeadRow key={item.lead.id} {...item} />
            ))}
            <div className="flex justify-end">
              <Link
                className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-bold text-gold-soft transition hover:bg-white/[0.04] hover:text-white"
                href="/leads"
              >
                לכל הלידים
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 p-5 text-sm text-zinc-500">
            אין כרגע לידים שדורשים טיפול.
          </div>
        )}
      </section>

      <details className="group panel p-5 sm:p-7">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold-soft">
              <ContactRound className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-white">פירוט מצב הלידים והמסלול</h2>
              <p className="mt-1 text-sm text-zinc-500">
                נתוני הסטטוסים וצינור המכירות המלאים
              </p>
            </div>
          </div>
          <ChevronDown className="h-5 w-5 shrink-0 text-zinc-500 transition group-open:rotate-180" />
        </summary>

        <div className="mt-5 border-t border-white/[0.07] pt-5">
          <section aria-labelledby="monthly-leads-title">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-white" id="monthly-leads-title">
                  מצב הלידים שנכנסו בחודש
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  חלוקה לפי הסטטוס הנוכחי של הלידים שנוצרו ב{monthLabel}.
                </p>
              </div>
              <span className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-[11px] font-bold text-gold-soft">
                אוטומטי מה־CRM
              </span>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
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
          </section>

          <section className="mt-7 border-t border-white/[0.07] pt-5" aria-labelledby="pipeline-now-title">
            <div className="mb-4 flex items-start gap-3">
              <GitBranch className="mt-0.5 h-5 w-5 shrink-0 text-gold-soft" />
              <div>
                <h3 className="font-black text-white" id="pipeline-now-title">
                  מצב צינור המכירות עכשיו
                </h3>
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
        </div>
      </details>
    </>
  );
}
