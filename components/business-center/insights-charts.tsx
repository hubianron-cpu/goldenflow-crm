import Link from "next/link";
import {
  BarChart3,
  LineChart,
  Target,
  UsersRound,
} from "lucide-react";
import type {
  BusinessPeriodSelection,
  BusinessTrendSeries,
} from "@/lib/business-center/insights";

const CHART_WIDTH = 720;
const CHART_HEIGHT = 260;
const CHART_TOP = 24;
const CHART_BOTTOM = 205;
const CHART_LEFT = 28;
const CHART_RIGHT = 12;
const CHART_AREA_HEIGHT = CHART_BOTTOM - CHART_TOP;

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

function EmptyChart({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/15 p-6 text-center text-sm leading-6 text-zinc-500">
      {children}
    </div>
  );
}

function Legend({
  items,
}: {
  items: Array<{ color: string; label: string }>;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-400">
      {items.map((item) => (
        <span className="inline-flex items-center gap-2" key={item.label}>
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function ChartHeader({
  icon: Icon,
  question,
  title,
}: {
  icon: typeof BarChart3;
  question: string;
  title: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold-soft">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h2 className="text-xl font-black text-white">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-500">{question}</p>
        <p className="mt-1 text-xs text-zinc-600">
          ששת החודשים האחרונים, כולל החודש הנוכחי
        </p>
      </div>
    </div>
  );
}

function GroupedBarChart({
  ariaLabel,
  firstColor,
  firstLabel,
  formatValue = formatNumber,
  points,
  secondColor,
  secondLabel,
}: {
  ariaLabel: string;
  firstColor: string;
  firstLabel: string;
  formatValue?: (value: number) => string;
  points: Array<{
    first: number | null;
    label: string;
    second: number | null;
  }>;
  secondColor: string;
  secondLabel: string;
}) {
  const values = points.flatMap((point) =>
    [point.first, point.second].filter(
      (value): value is number => value !== null,
    ),
  );
  const maxValue = Math.max(1, ...values);
  const chartWidth = CHART_WIDTH - CHART_LEFT - CHART_RIGHT;
  const groupWidth = chartWidth / Math.max(1, points.length);
  const barWidth = Math.min(28, Math.max(12, groupWidth * 0.25));

  return (
    <>
      <div className="mt-5 min-w-0">
        <svg
          aria-label={ariaLabel}
          className="h-auto w-full"
          role="img"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        >
          {[0, 0.5, 1].map((ratio) => {
            const y = CHART_BOTTOM - CHART_AREA_HEIGHT * ratio;
            return (
              <line
                key={ratio}
                stroke="var(--color-border)"
                strokeDasharray={ratio === 0 ? undefined : "4 6"}
                x1={CHART_LEFT}
                x2={CHART_WIDTH - CHART_RIGHT}
                y1={y}
                y2={y}
              />
            );
          })}
          {points.map((point, index) => {
            const center = CHART_LEFT + groupWidth * index + groupWidth / 2;
            const firstHeight =
              point.first === null
                ? 0
                : (point.first / maxValue) * CHART_AREA_HEIGHT;
            const secondHeight =
              point.second === null
                ? 0
                : (point.second / maxValue) * CHART_AREA_HEIGHT;
            return (
              <g key={`${point.label}-${index}`}>
                {point.first !== null ? (
                  <rect
                    fill={firstColor}
                    height={firstHeight}
                    rx="4"
                    width={barWidth}
                    x={center - barWidth - 2}
                    y={CHART_BOTTOM - firstHeight}
                  >
                    <title>
                      {point.label} · {firstLabel}: {formatValue(point.first)}
                    </title>
                  </rect>
                ) : null}
                {point.second !== null ? (
                  <rect
                    fill={secondColor}
                    height={secondHeight}
                    opacity="0.82"
                    rx="4"
                    width={barWidth}
                    x={center + 2}
                    y={CHART_BOTTOM - secondHeight}
                  >
                    <title>
                      {point.label} · {secondLabel}: {formatValue(point.second)}
                    </title>
                  </rect>
                ) : null}
                <text
                  fill="var(--text-muted)"
                  fontSize="11"
                  textAnchor="middle"
                  x={center}
                  y={CHART_BOTTOM + 24}
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <Legend
        items={[
          { color: firstColor, label: firstLabel },
          { color: secondColor, label: secondLabel },
        ]}
      />
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th>חודש</th>
              <th>{firstLabel}</th>
              <th>{secondLabel}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.label}>
                <th>{point.label}</th>
                <td>
                  {point.first === null ? "לא זמין" : formatValue(point.first)}
                </td>
                <td>
                  {point.second === null
                    ? "לא זמין"
                    : formatValue(point.second)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FollowersLineChart({
  points,
}: {
  points: Extract<
    BusinessTrendSeries["followers"],
    { available: true }
  >["points"];
}) {
  const values = points.map((point) => point.followers);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(1, maxValue - minValue);
  const chartWidth = CHART_WIDTH - CHART_LEFT - CHART_RIGHT;
  const xStep = chartWidth / Math.max(1, points.length - 1);
  const coordinates = points.map((point, index) => ({
    ...point,
    x: CHART_LEFT + xStep * index,
    y:
      CHART_BOTTOM -
      ((point.followers - minValue) / range) * CHART_AREA_HEIGHT,
  }));

  return (
    <>
      <div className="mt-5 min-w-0">
        <svg
          aria-label="גרף צמיחת עוקבים לפי המדידה האחרונה בכל חודש"
          className="h-auto w-full"
          role="img"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        >
          {[0, 0.5, 1].map((ratio) => {
            const y = CHART_BOTTOM - CHART_AREA_HEIGHT * ratio;
            return (
              <line
                key={ratio}
                stroke="var(--color-border)"
                strokeDasharray={ratio === 0 ? undefined : "4 6"}
                x1={CHART_LEFT}
                x2={CHART_WIDTH - CHART_RIGHT}
                y1={y}
                y2={y}
              />
            );
          })}
          {coordinates.length > 1 ? (
            <polyline
              fill="none"
              points={coordinates
                .map((point) => `${point.x},${point.y}`)
                .join(" ")}
              stroke="var(--color-gold)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
            />
          ) : null}
          {coordinates.map((point) => (
            <g key={point.month}>
              <circle
                cx={point.x}
                cy={point.y}
                fill="var(--color-bg-card)"
                r="7"
                stroke="var(--color-gold)"
                strokeWidth="4"
              >
                <title>
                  {point.label} · {formatNumber(point.followers)} עוקבים · מדידה
                  מ־{point.snapshotDate}
                </title>
              </circle>
              <text
                fill="var(--text-muted)"
                fontSize="11"
                textAnchor="middle"
                x={point.x}
                y={CHART_BOTTOM + 24}
              >
                {point.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <Legend
        items={[
          { color: "var(--color-gold)", label: "מספר עוקבים" },
        ]}
      />
      <div className="sr-only">
        <table>
          <caption>צמיחת עוקבים לפי המדידה האחרונה בכל חודש</caption>
          <thead>
            <tr>
              <th>חודש</th>
              <th>עוקבים</th>
              <th>תאריך המדידה</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.month}>
                <th>{point.label}</th>
                <td>{formatNumber(point.followers)}</td>
                <td>{point.snapshotDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function BusinessInsightsCharts({
  period,
  trends,
}: {
  period: BusinessPeriodSelection;
  trends: BusinessTrendSeries;
}) {
  const leadsHaveData =
    trends.leadsAndClosures.available &&
    trends.leadsAndClosures.points.some(
      (point) => point.leads > 0 || point.closed > 0,
    );

  return (
    <section
      aria-labelledby="business-trends-title"
      className="space-y-5"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold-soft">
          BUSINESS TRENDS
        </p>
        <h2 className="mt-2 text-2xl font-black text-white" id="business-trends-title">
          מגמות עסקיות
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          שלושה מבטים קבועים, ללא תחזיות וללא שימוש בשווי פוטנציאלי.
        </p>
      </div>

      <article className="panel min-w-0 p-5 sm:p-7">
        <ChartHeader
          icon={BarChart3}
          question="האם כמות הלידים ותוצאות המכירה משתפרות?"
          title="לידים וסגירות לאורך זמן"
        />
        {!trends.leadsAndClosures.available ? (
          <EmptyChart>לא ניתן לטעון כרגע את נתוני הלידים לגרף.</EmptyChart>
        ) : !leadsHaveData ? (
          <EmptyChart>
            אין נתוני לידים או סגירות בששת החודשים האחרונים.
          </EmptyChart>
        ) : (
          <>
            <GroupedBarChart
              ariaLabel="לידים וסגירות היסטוריות לפי חודש"
              firstColor="var(--color-gold)"
              firstLabel="לידים שנכנסו"
              points={trends.leadsAndClosures.points.map((point) => ({
                first: point.leads,
                label: point.label,
                second: point.closed,
              }))}
              secondColor="var(--color-green)"
              secondLabel="נסגרו בהצלחה"
            />
            <p className="mt-4 text-xs leading-5 text-zinc-500">
              הסגירות משויכות לחודש לפי `closed_at`. יחס הסגירה הנוכחי זמין
              בטבלה הנגישה וב־tooltip כאשר קיימים לידים בחודש.
            </p>
            <div className="sr-only">
              <table>
                <caption>יחס סגירה נוכחי לפי חודש</caption>
                <thead>
                  <tr>
                    <th>חודש</th>
                    <th>יחס סגירה נוכחי</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.leadsAndClosures.points.map((point) => (
                    <tr key={point.month}>
                      <th>{point.label}</th>
                      <td>
                        {point.closeRatio === null
                          ? "לא זמין"
                          : `${formatNumber(point.closeRatio)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </article>

      <article className="panel min-w-0 p-5 sm:p-7">
        <ChartHeader
          icon={Target}
          question="האם העסק מתקדם לעבר יעד ההכנסה?"
          title="הכנסה מול יעד"
        />
        {!trends.revenue.available ? (
          <EmptyChart>
            נדרשים לפחות שני חודשים עם נתוני יעד או הכנסה כדי להציג מגמה.
          </EmptyChart>
        ) : (
          <GroupedBarChart
            ariaLabel="הכנסה חודשית בפועל מול יעד"
            firstColor="var(--color-gold)"
            firstLabel="הכנסה בפועל"
            formatValue={formatMoney}
            points={trends.revenue.points.map((point) => ({
              first: point.actualRevenue,
              label: point.label,
              second: point.targetRevenue,
            }))}
            secondColor="var(--text-secondary)"
            secondLabel="יעד הכנסה"
          />
        )}
        <p className="mt-4 text-xs leading-5 text-zinc-500">
          הנתונים הוזנו ידנית ברמה חודשית. חודש ללא רשומה נשאר חסר ואינו מוצג
          כאפס.
        </p>
      </article>

      <article className="panel min-w-0 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <ChartHeader
            icon={LineChart}
            question="האם הפעילות ברשת מייצרת צמיחה?"
            title="צמיחת עוקבים"
          />
          {trends.followers.profiles.length > 1 ? (
            <form
              action="/business-center/insights"
              className="flex w-full flex-col gap-2 sm:w-auto"
              method="get"
            >
              <input name="period" type="hidden" value={period.type} />
              <input
                name={period.type === "week" ? "start" : "month"}
                type="hidden"
                value={period.key}
              />
              <label className="text-xs font-bold text-zinc-400" htmlFor="insights-profile">
                פרופיל להצגה
              </label>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <select
                  className="field min-w-0 py-2 sm:w-56"
                  defaultValue={trends.followers.selectedProfileId ?? ""}
                  id="insights-profile"
                  name="profile"
                >
                  {trends.followers.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.label} · {profile.platform}
                    </option>
                  ))}
                </select>
                <button className="button-secondary min-h-10 px-4 py-2 text-xs" type="submit">
                  הצגה
                </button>
              </div>
            </form>
          ) : null}
        </div>

        {!trends.followers.available ? (
          <EmptyChart>
            {trends.followers.reason === "load_failed"
              ? "לא ניתן לטעון כרגע את נתוני הפרופילים החברתיים."
              : trends.followers.reason === "no_profiles"
                ? "עדיין לא נוספו פרופילים חברתיים."
                : "אין מדידות עוקבים לפרופיל הזה בששת החודשים האחרונים."}
            <div className="mt-3">
              <Link
                className="font-bold text-gold-soft hover:text-white"
                href="/business-center#social-profiles-title"
              >
                לאזור הפרופילים החברתיים
              </Link>
            </div>
          </EmptyChart>
        ) : (
          <>
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs font-bold text-gold-soft">
              <UsersRound className="h-3.5 w-3.5" />
              {trends.followers.selectedProfileLabel}
            </p>
            <FollowersLineChart points={trends.followers.points} />
            {!trends.followers.hasTrend ? (
              <p className="mt-4 text-xs leading-5 text-zinc-500">
                נדרשת לפחות מדידה נוספת כדי להציג מגמת צמיחה.
              </p>
            ) : (
              <p className="mt-4 text-xs leading-5 text-zinc-500">
                בכל חודש מוצגת המדידה האחרונה בלבד; פרופילים מפלטפורמות שונות
                אינם מחוברים יחד.
              </p>
            )}
          </>
        )}
      </article>
    </section>
  );
}
