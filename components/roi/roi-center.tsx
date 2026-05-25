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
  sales_count: string;
};

type RoiMetrics = {
  conversionRate: number | null;
  costPerLead: number | null;
  costPerSale: number | null;
  estimatedRevenue: number;
  netProfit: number;
  roiMultiplier: number | null;
  status: string;
  statusClassName: string;
};

const emptyForm: RoiForm = {
  average_sale_value: "0",
  category: "",
  leads_count: "0",
  monthly_cost: "0",
  name: "",
  notes: "",
  sales_count: "0",
};

const moneyFormatter = new Intl.NumberFormat("he-IL", {
  currency: "ILS",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatMoney(value: number) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatOptionalMoney(value: number | null) {
  return value === null || !Number.isFinite(value) ? "-" : formatMoney(value);
}

function formatRoi(value: number | null) {
  return value === null || !Number.isFinite(value) ? "-" : `x${value.toFixed(1)}`;
}

function formatPercent(value: number | null) {
  return value === null || !Number.isFinite(value) ? "-" : `${value.toFixed(1)}%`;
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

function isOperationalCategory(category: string) {
  const normalized = category.trim().toLowerCase();
  return ["תפעול", "כלי", "תוכנה", "שירות", "עובד", "מערכת", "software", "tool", "ops"].some((token) =>
    normalized.includes(token),
  );
}

function getMetrics(tool: Pick<RoiTool, "average_sale_value" | "category" | "leads_count" | "monthly_cost" | "sales_count">): RoiMetrics {
  const monthlyCost = Number(tool.monthly_cost) || 0;
  const leadsCount = Number(tool.leads_count) || 0;
  const salesCount = Number(tool.sales_count) || 0;
  const averageSaleValue = Number(tool.average_sale_value) || 0;
  const estimatedRevenue = salesCount * averageSaleValue;
  const netProfit = estimatedRevenue - monthlyCost;
  const roiMultiplier = monthlyCost > 0 ? estimatedRevenue / monthlyCost : null;
  const costPerLead = leadsCount > 0 ? monthlyCost / leadsCount : null;
  const costPerSale = salesCount > 0 ? monthlyCost / salesCount : null;
  const conversionRate = leadsCount > 0 ? (salesCount / leadsCount) * 100 : null;

  if (monthlyCost === 0 && estimatedRevenue > 0) {
    return {
      conversionRate,
      costPerLead,
      costPerSale,
      estimatedRevenue,
      netProfit,
      roiMultiplier,
      status: "רווחי מאוד",
      statusClassName: "border-success/30 bg-success/15 text-green-100",
    };
  }

  if (estimatedRevenue === 0 && isOperationalCategory(tool.category)) {
    return {
      conversionRate,
      costPerLead,
      costPerSale,
      estimatedRevenue,
      netProfit,
      roiMultiplier,
      status: "תפעולי",
      statusClassName: "border-blue/30 bg-blue/15 text-blue-100",
    };
  }

  if (roiMultiplier !== null && roiMultiplier >= 2) {
    return {
      conversionRate,
      costPerLead,
      costPerSale,
      estimatedRevenue,
      netProfit,
      roiMultiplier,
      status: "רווחי",
      statusClassName: "border-gold/35 bg-gold/15 text-gold-soft",
    };
  }

  if (roiMultiplier !== null && roiMultiplier >= 1) {
    return {
      conversionRate,
      costPerLead,
      costPerSale,
      estimatedRevenue,
      netProfit,
      roiMultiplier,
      status: "גבולי",
      statusClassName: "border-gold/20 bg-gold/10 text-yellow-100",
    };
  }

  return {
    conversionRate,
    costPerLead,
    costPerSale,
    estimatedRevenue,
    netProfit,
    roiMultiplier,
    status: "מפסיד",
    statusClassName: "border-danger/30 bg-danger/15 text-red-100",
  };
}

function validateForm(form: RoiForm) {
  const name = form.name.trim();
  const monthlyCost = toSafeNumber(form.monthly_cost);
  const leadsCount = toSafeInteger(form.leads_count);
  const salesCount = toSafeInteger(form.sales_count);
  const averageSaleValue = toSafeNumber(form.average_sale_value);

  if (!name) {
    return "שם הכלי הוא שדה חובה.";
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
    return "כמות לידים לא יכולה להיות שלילית.";
  }

  if (salesCount < 0) {
    return "כמות מכירות לא יכולה להיות שלילית.";
  }

  if (averageSaleValue < 0) {
    return "שווי מכירה ממוצעת לא יכול להיות שלילי.";
  }

  if (leadsCount > 0 && salesCount > leadsCount) {
    return "כמות מכירות לא יכולה להיות גבוהה מכמות הלידים.";
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
  const overallRoi = totalCost > 0 ? totalRevenue / totalCost : null;
  const bestTool = sortedTools[0] ?? null;
  const weakestTool = [...tools].sort((a, b) => getMetrics(a).netProfit - getMetrics(b).netProfit)[0] ?? null;
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
    { label: "סך הכנסות משוערות", value: formatMoney(totalRevenue), tone: "card-money" },
    { label: "רווח נקי משוער", value: formatMoney(totalNetProfit), tone: totalNetProfit >= 0 ? "card-success" : "card-danger" },
    { label: "ROI כללי", value: formatRoi(overallRoi), tone: "card-default" },
    { label: "הכלי הכי רווחי", value: bestTool ? bestTool.name : "-", tone: "card-money" },
    { label: "הכלי הכי חלש", value: weakestTool ? weakestTool.name : "-", tone: "card-danger" },
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
              <h2 className="mt-2 text-2xl font-black text-white">{editingId ? "עריכת כלי" : "הוספת כלי"}</h2>
            </div>
            {editingId ? (
              <button className="button-secondary min-h-9 px-3 py-2 text-xs" onClick={resetForm} type="button">
                ביטול עריכה
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4">
            <label className="text-sm font-bold text-zinc-300">
              שם הכלי
              <input className="field mt-2" onChange={(event) => updateField("name", event.target.value)} value={form.name} />
            </label>
            <label className="text-sm font-bold text-zinc-300">
              קטגוריה
              <input className="field mt-2" onChange={(event) => updateField("category", event.target.value)} value={form.category} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-zinc-300">
                עלות חודשית
                <input className="field mt-2" min="0" onChange={(event) => updateField("monthly_cost", event.target.value)} type="number" value={form.monthly_cost} />
              </label>
              <label className="text-sm font-bold text-zinc-300">
                כמות לידים
                <input className="field mt-2" min="0" onChange={(event) => updateField("leads_count", event.target.value)} type="number" value={form.leads_count} />
              </label>
              <label className="text-sm font-bold text-zinc-300">
                כמות מכירות
                <input className="field mt-2" min="0" onChange={(event) => updateField("sales_count", event.target.value)} type="number" value={form.sales_count} />
              </label>
              <label className="text-sm font-bold text-zinc-300">
                שווי מכירה ממוצעת
                <input className="field mt-2" min="0" onChange={(event) => updateField("average_sale_value", event.target.value)} type="number" value={form.average_sale_value} />
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
            {editingId ? "שמירת שינויים" : "הוספת כלי ROI"}
          </button>
        </form>

        <section className="space-y-5">
          <div className="panel p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-gold-soft">Tools</p>
                <h2 className="mt-2 text-2xl font-black text-white">כלים והשקעות</h2>
              </div>
              <p className="text-sm text-zinc-500">ממויין לפי רווח נקי מהגבוה לנמוך</p>
            </div>

            {loading ? (
              <p className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5 text-center text-sm text-zinc-400">טוען נתוני ROI...</p>
            ) : sortedTools.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-dashed border-gold/20 bg-gold/5 p-6 text-center text-sm leading-7 text-zinc-300">
                עדיין לא הוספת כלים. הוסף את הכלי הראשון שלך כדי להבין מה באמת מחזיר השקעה בעסק.
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
                          <p className="mt-1 text-sm text-zinc-500">{tool.category || "ללא קטגוריה"}</p>
                        </div>
                        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${metrics.statusClassName}`}>
                          {metrics.status}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Metric label="עלות חודשית" value={formatMoney(tool.monthly_cost)} />
                        <Metric label="הכנסה משוערת" value={formatMoney(metrics.estimatedRevenue)} />
                        <Metric label="רווח נקי" value={formatMoney(metrics.netProfit)} />
                        <Metric label="ROI" value={formatRoi(metrics.roiMultiplier)} />
                        <Metric label="עלות לליד" value={formatOptionalMoney(metrics.costPerLead)} />
                        <Metric label="עלות למכירה" value={formatOptionalMoney(metrics.costPerSale)} />
                        <Metric label="אחוז המרה" value={formatPercent(metrics.conversionRate)} />
                        <Metric label="מכירות / לידים" value={`${tool.sales_count} / ${tool.leads_count}`} />
                      </div>

                      {tool.notes ? <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-zinc-400">{tool.notes}</p> : null}

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button className="button-secondary flex-1" onClick={() => startEdit(tool)} type="button">
                          עריכה
                        </button>
                        <button className="button-danger flex-1" disabled={pendingActionId === tool.id} onClick={() => deleteTool(tool)} type="button">
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
            <h2 className="mt-2 text-2xl font-black text-white">עלות מול הכנסה משוערת</h2>
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
                        <p className="text-xs text-zinc-500">{formatMoney(metrics.netProfit)} נטו</p>
                      </div>
                      <ComparisonBar label="עלות" value={formatMoney(tool.monthly_cost)} width={costWidth} tone="bg-danger/70" />
                      <ComparisonBar label="הכנסה" value={formatMoney(metrics.estimatedRevenue)} width={revenueWidth} tone="bg-gradient-to-l from-gold to-gold-soft" />
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
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
