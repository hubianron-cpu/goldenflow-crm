"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  FileQuestion,
  Library,
  Link2,
  RefreshCcw,
  UsersRound,
} from "lucide-react";
import type { ContentAttributionAnalytics } from "@/lib/business-center/content-attribution";

type ContentLeadPerformanceProps = {
  analytics: ContentAttributionAnalytics;
  monthLabel: string;
  onRetry: () => void;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("he-IL", {
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string | null) {
  if (!value) {
    return "ללא תאריך פרסום";
  }

  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

export function ContentLeadPerformance({
  analytics,
  monthLabel,
  onRetry,
}: ContentLeadPerformanceProps) {
  return (
    <details className="group panel min-w-0 p-5 sm:p-7">
      <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold-soft">
            <Link2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-black text-white" id="content-leads-title">
              תוכן שמביא לידים
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              שיוך ידני לפי לידים שנוצרו ב{monthLabel}.
            </p>
          </div>
        </div>
        <ChevronDown className="mt-2 h-5 w-5 shrink-0 text-zinc-500 transition group-open:rotate-180" />
      </summary>

      <div className="mt-5 border-t border-white/[0.07] pt-5">
        <div className="flex justify-end">
        <Link
          className="button-secondary min-h-10 w-full gap-2 px-4 py-2 text-xs sm:w-auto"
          href="/business-center/content"
        >
          <Library className="h-4 w-4 text-gold-soft" />
          לספריית התוכן
        </Link>
        </div>

      {!analytics.available ? (
        <div className="mt-5 rounded-2xl border border-gold/20 bg-gold/[0.05] p-5 text-sm">
          <FileQuestion className="h-6 w-6 text-gold-soft" />
          <p className="mt-3 font-bold text-zinc-200">
            {analytics.reason === "not_installed"
              ? "שיוך תוכן ללידים עדיין לא הופעל במסד הנתונים."
              : "לא הצלחנו לטעון כרגע את נתוני שיוך התוכן."}
          </p>
          <p className="mt-1 leading-6 text-zinc-500">
            שאר נתוני מרכז העסק ממשיכים לפעול כרגיל.
          </p>
          <button
            className="button-secondary mt-4 gap-2 px-4 py-2 text-xs"
            onClick={onRetry}
            type="button"
          >
            <RefreshCcw className="h-4 w-4" />
            ניסיון חוזר
          </button>
        </div>
      ) : (
        <>
          <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "לידים ששויכו לתוכן",
                value: formatNumber(analytics.attributedLeads),
              },
              {
                label: "לידים ללא שיוך תוכן",
                value: formatNumber(analytics.unattributedLeads),
              },
              {
                label: "אחוז כיסוי שיוך",
                value:
                  analytics.attributionCoverage === null
                    ? "אין לידים בחודש"
                    : `${formatNumber(analytics.attributionCoverage)}%`,
              },
              {
                label: "תכנים שהביאו לידים",
                value: formatNumber(analytics.contentWithLeads),
              },
            ].map((metric) => (
              <article
                className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"
                key={metric.label}
              >
                <p className="text-xs font-bold text-zinc-500">{metric.label}</p>
                <p className="mt-2 break-words text-xl font-black text-white">
                  {metric.value}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[1.6fr_1fr]">
            <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-gold-soft" />
                <div>
                  <h3 className="font-black text-white">התכנים המובילים</h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    מצב נוכחי של הלידים שנוצרו בחודש
                  </p>
                </div>
              </div>

              {analytics.topContent.length === 0 ? (
                <p className="mt-5 rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                  עדיין אין לידים משויכים לתוכן בחודש הזה.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {analytics.topContent.map((content, index) => (
                    <article
                      className="min-w-0 rounded-xl border border-white/[0.07] bg-black/20 p-4"
                      key={content.contentItemId}
                    >
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-gold-soft">
                            #{index + 1}
                          </p>
                          <h4 className="mt-1 break-words font-black text-white">
                            {content.title}
                          </h4>
                          <p className="mt-1 text-xs text-zinc-500">
                            {content.platform} · {formatDate(content.publishedOn)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs font-bold text-gold-soft">
                          {formatNumber(content.attributedLeads)} לידים
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-2.5">
                          <p className="text-zinc-500">פתוחים כרגע</p>
                          <p className="mt-1 font-black text-white">
                            {formatNumber(content.currentOpen)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-2.5">
                          <p className="text-zinc-500">נסגרו בהצלחה כרגע</p>
                          <p className="mt-1 font-black text-white">
                            {formatNumber(content.currentWon)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-2.5">
                          <p className="text-zinc-500">לא רלוונטיים כרגע</p>
                          <p className="mt-1 font-black text-white">
                            {formatNumber(content.currentIrrelevant)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-2.5">
                          <p className="text-zinc-500">יחס סגירה נוכחי</p>
                          <p className="mt-1 font-black text-white">
                            {formatNumber(content.currentCloseRatio)}%
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <UsersRound className="mt-0.5 h-5 w-5 shrink-0 text-gold-soft" />
                <div>
                  <h3 className="font-black text-white">מקורות לידים מובילים</h3>
                  <p className="mt-1 text-xs text-zinc-500">לפי מקור הליד הקיים ב־CRM</p>
                </div>
              </div>

              {analytics.leadSources.length === 0 ? (
                <p className="mt-5 rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                  אין לידים להצגת מקורות בחודש הזה.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {analytics.leadSources.map((source) => (
                    <div
                      className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-3"
                      key={source.name}
                    >
                      <span className="min-w-0 break-words text-sm font-bold text-zinc-300">
                        {source.name}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-500">
                        {formatNumber(source.count)} · {formatNumber(source.percentage)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      </div>
    </details>
  );
}
