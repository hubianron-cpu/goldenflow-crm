"use client";

import { useEffect, useState, useTransition } from "react";
import type { Database } from "@/types/database";

type RoiTool = Database["public"]["Tables"]["roi_tools"]["Row"];

type RoiForm = {
  average_sale_value: string;
  category: string;
  leads_count: string;
  monthly_cost: string;
  name: string;
  notes: string;
  result_type: string;
  sales_count: string;
};

type RoiMetrics = {
  conversionRate: number | null;
  costPerLead: number | null;
  costPerSale: number | null;
  estimatedRevenue: number;
  paybackLabel: string;
  netProfit: number;
  paybackDays: number | null;
  roiPercentage: number | null;
  recommendation: string;
  status: string;
  statusClassName: string;
};

const categoryOptions = ["פרסום", "תוכנה", "עובדים", "אוטומציה", "ציוד", "ייעוץ", "שיווק", "תפעול", "תוכן", "אחר"];
const resultTypeOptions = ["לידים", "מכירות", "שעות שנחסכו", "פגישות שנקבעו", "לקוחות שטופלו", "משימות שבוצעו", "כסף שנחסך", "שיפור תפעולי", "אחר"];

const emptyForm: RoiForm = {
  average_sale_value: "0",
  category: "אחר",
  leads_count: "0",
  monthly_cost: "0",
  name: "",
  notes: "",
  result_type: "לידים",
  sales_count: "0",
};

function formatMoney(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const absoluteValue = Math.abs(safeValue);
  const shouldShowDecimals = absoluteValue > 0 && absoluteValue < 10;

  return new Intl.NumberFormat("he-IL", {
    currency: "ILS",
    maximumFractionDigits: shouldShowDecimals ? 2 : 0,
    minimumFractionDigits: shouldShowDecimals ? 2 : 0,
    style: "currency",
  }).format(safeValue);
}

function formatOptionalMoney(value: number | null) {
  return value === null || !Number.isFinite(value) ? "-" : formatMoney(value);
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  const absoluteValue = Math.abs(value);
  const fractionDigits = absoluteValue < 1 ? 2 : absoluteValue <= 10 ? 1 : value % 1 === 0 ? 0 : 1;
  return `${value.toFixed(fractionDigits)}%`;
}

function formatConversionRate(value: number | null) {
  return value === null || !Number.isFinite(value) ? "אין מספיק נתונים" : formatPercent(value);
}

function toSafeNumber(value: string) {
  if (!value.trim()) {
    return 0;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function toSafeInteger(value: string) {
  const number = toSafeNumber(value);
  return Number.isFinite(number) ? Math.trunc(number) : Number.NaN;
}

function getPaybackLabel(monthlyCost: number, estimatedRevenue: number, netProfit: number, paybackDays: number | null) {
  if (monthlyCost === 0) {
    return "אין עלות";
  }

  if (estimatedRevenue <= 0 || paybackDays === null || !Number.isFinite(paybackDays)) {
    return "עדיין לא החזיר";
  }

  if (paybackDays <= 1) {
    return "פחות מיום";
  }

  if (paybackDays <= 30) {
    return netProfit > 0 ? `החזיר תוך ${paybackDays} ימים` : `${paybackDays} ימים`;
  }

  return `${Math.ceil(paybackDays / 30)} חודשים`;
}

function getStatus(roiPercentage: number | null) {
  if (roiPercentage === null || !Number.isFinite(roiPercentage)) {
    return {
      status: "-",
      statusClassName: "border-white/10 bg-white/[0.04] text-zinc-300",
    };
  }

  if (roiPercentage > 50) {
    return {
      status: "🟢 רווחי",
      statusClassName: "border-success/30 bg-success/15 text-green-100",
    };
  }

  if (roiPercentage >= -10) {
    return {
      status: "🟡 גבולי",
      statusClassName: "border-gold/25 bg-gold/10 text-yellow-100",
    };
  }

  return {
    status: "🔴 מפסיד",
    statusClassName: "border-danger/30 bg-danger/15 text-red-100",
  };
}

function getRecommendation(
  monthlyCost: number,
  estimatedRevenue: number,
  roiPercentage: number | null,
  conversionRate: number | null,
  resultQuantity: number,
  conversionsCount: number,
) {
  if (monthlyCost === 0) {
    return "לא הוזנה עלות חודשית, לכן אי אפשר לחשב ROI אמיתי.";
  }

  if (resultQuantity >= 1000 && conversionsCount > 0 && conversionRate !== null && conversionRate < 1) {
    return "יש הרבה תוצאות אבל מעט המרות - הבעיה כנראה לא בכמות אלא באיכות או בסגירה.";
  }

  if (roiPercentage !== null && roiPercentage > 100) {
    return "זה אחד הכלים המשתלמים בעסק כרגע - שווה לבדוק אם אפשר להגדיל שימוש או השקעה.";
  }

  if (roiPercentage !== null && roiPercentage > 0 && conversionRate !== null && conversionRate < 2) {
    return "הכלי מחזיר את עצמו, אבל אחוז ההמרה נמוך - כדאי לשפר פולואפ או תהליך מכירה.";
  }

  if (roiPercentage !== null && roiPercentage >= -10 && roiPercentage <= 50) {
    return "הכלי קרוב לאיזון - כדאי לבדוק אם אפשר להוריד עלות או לשפר שימוש.";
  }

  if (roiPercentage !== null && roiPercentage < -10) {
    return "לפי הנתונים כרגע, ההוצאה לא מחזירה את עצמה - כדאי לבדוק אם להפסיק, לשפר או למדוד מחדש.";
  }

  if (estimatedRevenue > 0) {
    return "ההוצאה הזו מחזירה את עצמה.";
  }

  return "ההוצאה כרגע לא מחזירה את עצמה לפי הנתונים שהוזנו.";
}

function shouldUseConversionsForReturn(resultType: string) {
  return ["לידים", "פגישות שנקבעו"].includes(resultType.trim());
}

function getMetrics(tool: Pick<RoiTool, "average_sale_value" | "category" | "leads_count" | "monthly_cost" | "result_type" | "sales_count">): RoiMetrics {
  const monthlyCost = Number(tool.monthly_cost) || 0;
  const leadsCount = Number(tool.leads_count) || 0;
  const salesCount = Number(tool.sales_count) || 0;
  const averageSaleValue = Number(tool.average_sale_value) || 0;
  const resultType = tool.result_type || "לידים";
  const estimatedRevenue = (shouldUseConversionsForReturn(resultType) ? salesCount : leadsCount) * averageSaleValue;
  const netProfit = estimatedRevenue - monthlyCost;
  const roiPercentage = monthlyCost > 0 ? (netProfit / monthlyCost) * 100 : null;
  const costPerLead = leadsCount > 0 ? monthlyCost / leadsCount : null;
  const costPerSale = salesCount > 0 ? monthlyCost / salesCount : null;
  const conversionRate = leadsCount > 0 ? (salesCount / leadsCount) * 100 : null;
  const paybackDays = monthlyCost > 0 && estimatedRevenue > 0 ? Math.round((monthlyCost / estimatedRevenue) * 30) : null;
  const paybackLabel = getPaybackLabel(monthlyCost, estimatedRevenue, netProfit, paybackDays);
  const recommendation = getRecommendation(monthlyCost, estimatedRevenue, roiPercentage, conversionRate, leadsCount, salesCount);
  const status = getStatus(roiPercentage);

  return {
    conversionRate,
    costPerLead,
    costPerSale,
    estimatedRevenue,
    netProfit,
    paybackLabel,
    paybackDays,
    roiPercentage,
    recommendation,
    status: status.status,
    statusClassName: status.statusClassName,
  };
}

function validateForm(form: RoiForm) {
  const name = form.name.trim();
  const monthlyCost = toSafeNumber(form.monthly_cost);
  const leadsCount = toSafeInteger(form.leads_count);
  const salesCount = toSafeInteger(form.sales_count);
  const averageSaleValue = toSafeNumber(form.average_sale_value);

  if (!name) {
    return "שם ההוצאה / הכלי הוא שדה חובה.";
  }

  if (
    !Number.isFinite(monthlyCost) ||
    !Number.isFinite(leadsCount) ||
    !Number.isFinite(salesCount) ||
    !Number.isFinite(averageSaleValue)
  ) {
    return "יש להזין מספרים תקינים בלבד.";
  }

  if (monthlyCost < 0) {
    return "עלות חודשית לא יכולה להיות שלילית.";
  }

  if (leadsCount < 0) {
    return "כמות תוצאות לא יכולה להיות שלילית.";
  }

  if (salesCount < 0) {
    return "כמות המרות / מכירות לא יכולה להיות שלילית.";
  }

  if (averageSaleValue < 0) {
    return "שווי תוצאה ממוצעת לא יכול להיות שלילי.";
  }

  if (leadsCount > 0 && salesCount > leadsCount) {
    return "כמות המרות / מכירות לא יכולה להיות גבוהה מכמות התוצאות.";
  }

  return "";
}

function buildPayload(form: RoiForm) {
  return {
    average_sale_value: toSafeNumber(form.average_sale_value),
    category: form.category.trim(),
    leads_count: toSafeInteger(form.leads_count),
    monthly_cost: toSafeNumber(form.monthly_cost),
    name: form.name.trim(),
    notes: form.notes.trim(),
    result_type: form.result_type.trim() || "לידים",
    sales_count: toSafeInteger(form.sales_count),
  };
}

function getErrorMessage(payload: Record<string, unknown>, fallback: string) {
  return [
    typeof payload.error === "string" ? payload.error : "",
    typeof payload.message === "string" ? payload.message : "",
    typeof payload.details === "string" ? payload.details : "",
    typeof payload.hint === "string" ? payload.hint : "",
    typeof payload.code === "string" ? `Code: ${payload.code}` : "",
  ]
    .filter(Boolean)
    .join(" · ") || fallback;
}

function createFormFromTool(tool: RoiTool): RoiForm {
  return {
    average_sale_value: String(tool.average_sale_value ?? 0),
    category: tool.category ?? "",
    leads_count: String(tool.leads_count ?? 0),
    monthly_cost: String(tool.monthly_cost ?? 0),
    name: tool.name ?? "",
    notes: tool.notes ?? "",
    result_type: tool.result_type ?? "לידים",
    sales_count: String(tool.sales_count ?? 0),
  };
}

export function RoiCenter() {
  const [tools, setTools] = useState<RoiTool[]>([]);
  const [form, setForm] = useState<RoiForm>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingActionId, setPendingActionId] = useState("");
  const [isPending, startTransition] = useTransition();

  const sortedTools = [...tools].sort((a, b) => getMetrics(b).netProfit - getMetrics(a).netProfit);
  const totalCost = tools.reduce((sum, tool) => sum + (Number(tool.monthly_cost) || 0), 0);
  const totalRevenue = tools.reduce((sum, tool) => sum + getMetrics(tool).estimatedRevenue, 0);
  const totalNetProfit = totalRevenue - totalCost;
  const overallRoiPercentage = totalCost > 0 ? (totalNetProfit / totalCost) * 100 : null;
  const bestTool = sortedTools[0] ?? null;
  const losingTools = tools.filter((tool) => {
    const metrics = getMetrics(tool);
    return metrics.roiPercentage !== null && metrics.roiPercentage < -10;
  });
  const weakestTool = [...losingTools].sort((a, b) => {
    const aMetrics = getMetrics(a);
    const bMetrics = getMetrics(b);
    return aMetrics.netProfit - bMetrics.netProfit || (aMetrics.roiPercentage ?? 0) - (bMetrics.roiPercentage ?? 0);
  })[0] ?? null;
  const maxComparisonValue = Math.max(
    1,
    ...tools.flatMap((tool) => [Number(tool.monthly_cost) || 0, getMetrics(tool).estimatedRevenue]),
  );

  useEffect(() => {
    startTransition(async () => {
      setLoading(true);
      const response = await fetch("/api/roi-tools", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as { tools?: RoiTool[] } & Record<string, unknown>;

      if (!response.ok) {
        setError(getErrorMessage(payload, "לא הצלחנו לטעון את מרכז ROI."));
        setLoading(false);
        return;
      }

      setTools(payload.tools ?? []);
      setLoading(false);
    });
  }, []);

  function updateField(field: keyof RoiForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId("");
  }

  const visibleCategoryOptions = categoryOptions.includes(form.category) || !form.category
    ? categoryOptions
    : [form.category, ...categoryOptions];
  const visibleResultTypeOptions = resultTypeOptions.includes(form.result_type) || !form.result_type
    ? resultTypeOptions
    : [form.result_type, ...resultTypeOptions];

  function submitTool() {
    setError("");
    setSuccess("");

    const validationError = validateForm(form);

    if (validationError) {
      setError(validationError);
      return;
    }

    setPendingActionId("save");
    startTransition(async () => {
      const response = await fetch("/api/roi-tools", {
        body: JSON.stringify(editingId ? { ...buildPayload(form), id: editingId } : buildPayload(form)),
        headers: { "Content-Type": "application/json" },
        method: editingId ? "PATCH" : "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as { tool?: RoiTool } & Record<string, unknown>;

      setPendingActionId("");

      if (!response.ok || !payload.tool) {
        setError(getErrorMessage(payload, "לא הצלחנו לשמור את הכלי."));
        return;
      }

      const savedTool = payload.tool;
      setTools((current) =>
        editingId ? current.map((tool) => (tool.id === savedTool.id ? savedTool : tool)) : [savedTool, ...current],
      );
      setSuccess(editingId ? "הכלי עודכן בהצלחה." : "הכלי נוסף למרכז ROI.");
      resetForm();
    });
  }

  function startEdit(tool: RoiTool) {
    setError("");
    setSuccess("");
    setEditingId(tool.id);
    setForm(createFormFromTool(tool));
  }

  function deleteTool(tool: RoiTool) {
    if (!window.confirm(`למחוק את ${tool.name} ממרכז ROI?`)) {
      return;
    }

    setError("");
    setSuccess("");
    setPendingActionId(tool.id);
    startTransition(async () => {
      const response = await fetch("/api/roi-tools", {
        body: JSON.stringify({ id: tool.id }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      setPendingActionId("");

      if (!response.ok) {
        setError(getErrorMessage(payload, "לא הצלחנו למחוק את הכלי."));
        return;
      }

      setTools((current) => current.filter((item) => item.id !== tool.id));
      setSuccess("הכלי נמחק.");

      if (editingId === tool.id) {
        resetForm();
      }
    });
  }

  const summaryCards = [
    { label: "סך השקעה חודשית", value: formatMoney(totalCost), tone: "card-default" },
    { label: "סך החזר משוער", value: formatMoney(totalRevenue), tone: "card-money" },
    { label: "רווח חודשי משוער", value: formatMoney(totalNetProfit), tone: totalNetProfit >= 0 ? "card-success" : "card-danger" },
    { label: "ROI כללי", value: formatPercent(overallRoiPercentage), tone: "card-default" },
    {
      label: "הכלי הכי רווחי",
      meta: bestTool ? `רווח חודשי משוער: ${formatMoney(getMetrics(bestTool).netProfit)}` : "",
      value: bestTool ? bestTool.name : "-",
      tone: "card-money",
    },
    {
      label: weakestTool ? "הכלי הכי חלש" : "אין כרגע כלי מפסיד",
      value: weakestTool ? weakestTool.name : "כל הכלים כרגע רווחיים",
      tone: "card-danger",
    },
  ];

  return (
    <div className="space-y-8" dir="rtl">
      <section className="panel relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(201,162,39,0.14),transparent_34rem)]" />
        <p className="text-xs font-black uppercase tracking-[0.28em] text-gold-soft">ROI Center</p>
        <h1 className="mt-3 text-3xl font-black leading-tight text-white sm:text-5xl">מרכז ROI</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
          להבין איזה כלים באמת מחזירים לך כסף - ואיזה רק נראים חשובים.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map((card) => (
          <article className={`${card.tone} flex min-h-32 flex-col justify-between p-5`} key={card.label}>
            <p className="text-xs font-bold text-zinc-400">{card.label}</p>
            <p className="mt-5 break-words text-2xl font-black leading-tight text-white sm:text-3xl">{card.value}</p>
            {"meta" in card && card.meta ? <p className="mt-2 text-xs font-bold text-zinc-400">{card.meta}</p> : null}
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <form
          className="panel p-5 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            submitTool();
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-gold-soft">Input</p>
              <h2 className="mt-2 text-2xl font-black text-white">{editingId ? "עריכת הוצאה / כלי" : "הוספת הוצאה / כלי"}</h2>
            </div>
            {editingId ? (
              <button className="button-secondary min-h-9 px-3 py-2 text-xs" onClick={resetForm} type="button">
                ביטול עריכה
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4">
            <label className="text-sm font-bold text-zinc-300">
              שם ההוצאה / הכלי
              <input
                className="field mt-2"
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Canva Pro, עובד מכירות, פרסום לפגישות, אוטומציה לוואטסאפ"
                value={form.name}
              />
            </label>
            <label className="text-sm font-bold text-zinc-300">
              קטגוריה
              <select className="field mt-2" onChange={(event) => updateField("category", event.target.value)} value={form.category || "אחר"}>
                {visibleCategoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold text-zinc-300">
              סוג תוצאה
              <select className="field mt-2" onChange={(event) => updateField("result_type", event.target.value)} value={form.result_type || "לידים"}>
                {visibleResultTypeOptions.map((resultType) => (
                  <option key={resultType} value={resultType}>
                    {resultType}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs leading-5 text-zinc-500">
                בחר מה ההוצאה הזאת באמת יצרה בעסק - לידים, מכירות, זמן שנחסך, משימות שבוצעו או כל תוצאה מדידה אחרת.
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-zinc-300">
                עלות חודשית
                <input className="field mt-2" min="0" onChange={(event) => updateField("monthly_cost", event.target.value)} type="number" value={form.monthly_cost} />
              </label>
              <label className="text-sm font-bold text-zinc-300">
                כמות תוצאות
                <input className="field mt-2" min="0" onChange={(event) => updateField("leads_count", event.target.value)} placeholder="20" type="number" value={form.leads_count} />
              </label>
              <label className="text-sm font-bold text-zinc-300">
                כמות המרות / מכירות
                <input className="field mt-2" min="0" onChange={(event) => updateField("sales_count", event.target.value)} type="number" value={form.sales_count} />
              </label>
              <label className="text-sm font-bold text-zinc-300">
                שווי תוצאה ממוצעת
                <input className="field mt-2" min="0" onChange={(event) => updateField("average_sale_value", event.target.value)} placeholder="150" type="number" value={form.average_sale_value} />
                <span className="mt-2 block text-xs leading-5 text-zinc-500">
                  לדוגמה: אם זו שעה שנחסכה, הזן כמה שווה לך שעה. אם זה ליד, הזן כמה שווה לך ליד או לקוח בממוצע.
                </span>
              </label>
            </div>
            <label className="text-sm font-bold text-zinc-300">
              הערות
              <textarea className="field mt-2 min-h-24 resize-y" onChange={(event) => updateField("notes", event.target.value)} value={form.notes} />
            </label>
          </div>

          {error ? <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm leading-6 text-red-100">{error}</p> : null}
          {success ? <p className="mt-4 rounded-xl border border-success/30 bg-success/10 p-3 text-sm leading-6 text-green-100">{success}</p> : null}

          <button className="button-primary mt-5 w-full" disabled={isPending || pendingActionId === "save"} type="submit">
            {editingId ? "שמירת שינויים" : "הוספת הוצאה / כלי"}
          </button>
        </form>

        <section className="space-y-5">
          <div className="panel p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-gold-soft">Tools</p>
                <h2 className="mt-2 text-2xl font-black text-white">כלים והשקעות</h2>
              </div>
              <p className="text-sm text-zinc-500">ממויין לפי רווח חודשי משוער מהגבוה לנמוך</p>
            </div>

            {loading ? (
              <p className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5 text-center text-sm text-zinc-400">טוען נתוני ROI...</p>
            ) : sortedTools.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-dashed border-gold/20 bg-gold/5 p-6 text-center text-sm leading-7 text-zinc-300">
                הוסף את הכלי הראשון שלך כדי להבין איפה הכסף באמת חוזר אליך.
              </p>
            ) : (
              <div className="mt-6 grid gap-4">
                {sortedTools.map((tool) => {
                  const metrics = getMetrics(tool);

                  return (
                    <article className="rounded-[22px] border border-white/[0.08] bg-black/25 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-gold/25" key={tool.id}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="break-words text-xl font-black text-white">{tool.name}</h3>
                          <p className="mt-1 text-sm text-zinc-500">{tool.category || "ללא קטגוריה"} · {tool.result_type || "לידים"}</p>
                        </div>
                        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${metrics.statusClassName}`}>
                          {metrics.status}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Metric label="עלות חודשית" value={formatMoney(tool.monthly_cost)} />
                        <Metric label="החזר משוער" value={formatMoney(metrics.estimatedRevenue)} />
                        <Metric label="רווח חודשי משוער" value={formatMoney(metrics.netProfit)} />
                        <Metric className={metrics.statusClassName} label="ROI" value={formatPercent(metrics.roiPercentage)} />
                        <Metric label="עלות לתוצאה" value={formatOptionalMoney(metrics.costPerLead)} />
                        <Metric label="עלות להמרה / מכירה" value={formatOptionalMoney(metrics.costPerSale)} />
                        <Metric label="אחוז המרה" value={formatConversionRate(metrics.conversionRate)} />
                        <Metric label="המרות / תוצאות" value={`${tool.sales_count} / ${tool.leads_count}`} />
                        <Metric label="זמן החזר השקעה" value={metrics.paybackLabel} />
                      </div>

                      <div className="mt-4 rounded-xl border border-gold/15 bg-gold/[0.06] p-3">
                        <p className="text-xs font-black text-gold-soft">המלצת מערכת</p>
                        <p className="mt-2 text-sm leading-6 text-zinc-300">{metrics.recommendation}</p>
                      </div>

                      {tool.notes ? <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-zinc-400">{tool.notes}</p> : null}

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button className="button-primary flex-1" onClick={() => startEdit(tool)} type="button">
                          עריכה
                        </button>
                        <button className="button-secondary flex-1 border-danger/30 text-red-100 hover:border-danger/45 hover:bg-danger/10 hover:shadow-[0_0_24px_rgba(229,72,77,0.12)]" disabled={pendingActionId === tool.id} onClick={() => deleteTool(tool)} type="button">
                          מחיקה
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="panel p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-gold-soft">Comparison</p>
            <h2 className="mt-2 text-2xl font-black text-white">עלות מול החזר לפי כלי</h2>
            <div className="mt-6 space-y-4">
              {sortedTools.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-zinc-500">ההשוואה תופיע אחרי הוספת כלי ראשון.</p>
              ) : (
                sortedTools.map((tool) => {
                  const metrics = getMetrics(tool);
                  const costWidth = `${Math.max(0, ((Number(tool.monthly_cost) || 0) / maxComparisonValue) * 100)}%`;
                  const revenueWidth = `${Math.max(0, (metrics.estimatedRevenue / maxComparisonValue) * 100)}%`;

                  return (
                    <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4" key={tool.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold text-white">{tool.name}</p>
                        <p className="text-xs text-zinc-500">רווח חודשי משוער: {formatMoney(metrics.netProfit)}</p>
                      </div>
                      <ComparisonBar label="עלות" value={formatMoney(tool.monthly_cost)} width={costWidth} tone="bg-danger/70" />
                      <ComparisonBar label="החזר" value={formatMoney(metrics.estimatedRevenue)} width={revenueWidth} tone="bg-gradient-to-l from-gold to-gold-soft" />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}

function Metric({ className = "", label, value }: { className?: string; label: string; value: string }) {
  return (
    <div className={`rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 ${className}`}>
      <p className="text-[11px] font-bold text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-base font-black text-white">{value}</p>
    </div>
  );
}

function ComparisonBar({ label, tone, value, width }: { label: string; tone: string; value: string; width: string }) {
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-zinc-500">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${tone}`} style={{ width }} />
      </div>
    </div>
  );
}
