"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CalendarClock, MessageSquareText, Plus, Search } from "lucide-react";
import { LoadingCard } from "@/components/loading-card";
import { StatusMessage } from "@/components/status-message";
import {
  getActionCompletedStatus,
  getLeadStatusColor,
  getLeadTemperature,
  getDaysSinceLastActivity,
  getNextActionLabel,
  normalizeLeadStatus,
  getPriorityColor,
  getPriorityLabel,
  LEAD_STATUSES,
  NEXT_ACTION_TYPES,
  PRIORITIES,
  type Lead,
  type LeadStatus,
  getLeadScore,
} from "@/lib/leads";
import { buildWhatsAppUrl, getWhatsAppMessage, WHATSAPP_MESSAGE_OPTIONS, type WhatsAppMessageType } from "@/lib/whatsapp";

type SortKey = "score_desc" | "inactivity_desc" | "value_desc" | "urgency" | "created_desc" | "created_asc" | "name_asc";

const initialForm = {
  name: "",
  phone: "",
  priority: "medium",
  source: "",
  value: "",
};

const moneyFormatter = new Intl.NumberFormat("he-IL", {
  currency: "ILS",
  maximumFractionDigits: 0,
  style: "currency",
});

function isValidPhone(value: string) {
  return /^[0-9+\-()\s]{7,20}$/.test(value);
}

function formatMoney(value: number) {
  return moneyFormatter.format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) {
    return "לא נקבע";
  }

  return new Date(value).toLocaleString("he-IL", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
}

function formatDaysSinceActivity(lead: Lead) {
  const days = getDaysSinceLastActivity(lead);
  return days >= 999 ? "אין תיעוד קשר" : days === 0 ? "היום" : `לפני ${days} ימים`;
}

function formatNextAction(lead: Lead) {
  if (!lead.next_action_date) {
    return "הפעולה הבאה: לא נקבעה";
  }

  const actionDate = new Date(lead.next_action_date);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const isToday = actionDate.toDateString() === today.toDateString();
  const isTomorrow = actionDate.toDateString() === tomorrow.toDateString();
  const when = isToday ? "היום" : isTomorrow ? "מחר" : formatDate(lead.next_action_date);

  return `הפעולה הבאה: ${getNextActionLabel(lead.next_action_type)} ${when}`;
}

function toInputDateTime(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isOverdue(value: string | null) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

function getTomorrowIso() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow.toISOString();
}

function getUrgencyTime(lead: Lead) {
  return lead.next_action_date ? new Date(lead.next_action_date).getTime() : Number.MAX_SAFE_INTEGER;
}

export function LeadManager() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(initialForm);
  const [isPending, startTransition] = useTransition();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("score_desc");
  const [statusFilter, setStatusFilter] = useState("");
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);

  const loadLeads = useCallback(async () => {
    const response = await fetch("/api/leads", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error || "לא הצלחנו לטעון את הלידים. נסו לרענן את הדף.");
      setLeads([]);
      return;
    }

    setLeads(payload.leads ?? []);
  }, []);

  useEffect(() => {
    let active = true;

    async function boot() {
      setLoading(true);
      await loadLeads();

      if (active) {
        setLoading(false);
      }
    }

    boot();
    const refresh = window.setInterval(loadLeads, 15000);

    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, [loadLeads]);

  const followUpLeads = useMemo(() => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    return leads
      .filter((lead) => lead.next_action_date && new Date(lead.next_action_date).getTime() <= endOfToday.getTime())
      .sort((a, b) => getUrgencyTime(a) - getUrgencyTime(b));
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return leads
      .filter((lead) => {
        const matchesStatus = !statusFilter || normalizeLeadStatus(lead.status) === statusFilter;
        const haystack = [lead.name, lead.phone, lead.source, lead.notes].filter(Boolean).join(" ").toLowerCase();
        const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
        return matchesStatus && matchesQuery;
      })
      .sort((a, b) => {
        if (sort === "score_desc") {
          return (
            getLeadScore(b) - getLeadScore(a) ||
            (b.value || 0) - (a.value || 0) ||
            getDaysSinceLastActivity(b) - getDaysSinceLastActivity(a)
          );
        }

        if (sort === "inactivity_desc") {
          return getDaysSinceLastActivity(b) - getDaysSinceLastActivity(a);
        }

        if (sort === "name_asc") {
          return a.name.localeCompare(b.name, "he");
        }

        if (sort === "value_desc") {
          return (b.value || 0) - (a.value || 0);
        }

        if (sort === "urgency") {
          return getUrgencyTime(a) - getUrgencyTime(b);
        }

        const first = new Date(a.created_at).getTime();
        const second = new Date(b.created_at).getTime();
        return sort === "created_asc" ? first - second : second - first;
      });
  }, [leads, query, sort, statusFilter]);

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function validateForm() {
    if (!form.name.trim()) {
      return "שם הליד הוא שדה חובה.";
    }

    if (!form.phone.trim()) {
      return "טלפון הוא שדה חובה כדי שאפשר יהיה לחזור לליד.";
    }

    if (!isValidPhone(form.phone.trim())) {
      return "מספר הטלפון אינו תקין.";
    }

    return "";
  }

  function patchLead(body: Record<string, unknown>, message: string) {
    setError("");
    setSuccess("");

    startTransition(async () => {
      const response = await fetch("/api/leads", {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error || "לא הצלחנו לעדכן את הליד. נסו שוב.");
        return;
      }

      setSuccess(message);
      await loadLeads();
    });
  }

  function getApiErrorMessage(payload: Record<string, unknown>, fallback: string) {
    return [
      typeof payload.error === "string" ? payload.error : "",
      typeof payload.message === "string" ? payload.message : "",
      typeof payload.details === "string" ? payload.details : "",
      typeof payload.hint === "string" ? payload.hint : "",
      typeof payload.code === "string" ? `Code: ${payload.code}` : "",
    ]
      .filter(Boolean)
      .join(" ") || fallback;
  }

  function handleCreateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/leads", {
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          priority: form.priority,
          source: form.source.trim(),
          status: "לידים חדשים",
          value: form.value,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(getApiErrorMessage(payload, "לא הצלחנו לשמור את הליד. בדקו חיבור ונסו שוב."));
        return;
      }

      if (payload.lead) {
        setLeads((current) => [payload.lead, ...current.filter((lead) => lead.id !== payload.lead.id)]);
      }

      setForm(initialForm);
      setSuccess("הליד נוסף ונשמר במערכת.");

      if (payload.taskAutomationError) {
        setError("הליד נשמר, אך יצירת המשימה האוטומטית נכשלה");
      }

      await loadLeads();
    });
  }

  function updateStatus(leadId: string, status: LeadStatus) {
    patchLead({ id: leadId, last_contact_date: new Date().toISOString(), status }, "סטטוס הליד עודכן.");
  }

  function completeAction(lead: Lead) {
    const nextStatus = getActionCompletedStatus(lead.status);
    const now = new Date().toISOString();

    patchLead(
      {
        id: lead.id,
        last_contact_date: now,
        next_action_date: getTomorrowIso(),
        next_action_type: "follow-up",
        status: nextStatus ?? lead.status,
        updated_at: now,
      },
      "✔ הליד עודכן והועבר קדימה",
    );
  }

  function handleNote(event: FormEvent<HTMLFormElement>, leadId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    patchLead({ id: leadId, notes: data.get("notes") }, "ההערה נשמרה.");
  }

  function handleFollowUp(event: FormEvent<HTMLFormElement>, leadId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    patchLead(
      {
        id: leadId,
        next_action_date: data.get("next_action_date"),
        next_action_type: data.get("next_action_type"),
      },
      "המעקב הבא נשמר.",
    );
  }

  function handleSalesDetails(event: FormEvent<HTMLFormElement>, leadId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    patchLead(
      {
        deal_probability: data.get("deal_probability"),
        id: leadId,
        name: data.get("name"),
        phone: data.get("phone"),
        priority: data.get("priority"),
        source: data.get("source"),
        value: data.get("value"),
      },
      "פרטי המכירה עודכנו.",
    );
  }

  function deleteLead(lead: Lead) {
    setError("");
    setSuccess("");

    startTransition(async () => {
      const response = await fetch("/api/leads", {
        body: JSON.stringify({ id: lead.id }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        setError(getApiErrorMessage(payload, "לא הצלחנו למחוק את הליד. נסו שוב."));
        return;
      }

      setLeads((current) => current.filter((item) => item.id !== lead.id));
      setLeadToDelete(null);
      setSuccess("הליד נמחק לצמיתות.");
      await loadLeads();
    });
  }

  function getWhatsAppUrl(lead: Lead, type: WhatsAppMessageType) {
    return buildWhatsAppUrl(lead.phone, getWhatsAppMessage(type, lead));
  }

  function showMissingPhoneMessage() {
    setSuccess("");
    setError("אין מספר טלפון לליד הזה");
  }

  function renderWhatsAppCenter(lead: Lead) {
    return (
      <details className="group relative">
        <summary className="button-secondary w-full cursor-pointer list-none py-2 text-center text-sm [&::-webkit-details-marker]:hidden">
          וואטסאפ
        </summary>
        <div className="mt-2 grid gap-2 rounded-xl border border-white/10 bg-black/35 p-2">
          {WHATSAPP_MESSAGE_OPTIONS.map((option) => {
            const whatsappUrl = getWhatsAppUrl(lead, option.type);

            return whatsappUrl ? (
              <a
                className="button-secondary min-h-10 justify-center px-3 py-2 text-xs"
                href={whatsappUrl}
                key={option.type}
                rel="noopener noreferrer"
                target="_blank"
              >
                {option.label}
              </a>
            ) : (
              <button
                className="button-secondary min-h-10 justify-center px-3 py-2 text-xs opacity-80"
                key={option.type}
                onClick={showMissingPhoneMessage}
                type="button"
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </details>
    );
  }

  if (loading) {
    return <LoadingCard label="טוען לידים..." />;
  }

  return (
    <div className="space-y-6">
      <StatusMessage error={error} success={success} />

      <section className="panel p-4 sm:p-5">
        <form onSubmit={handleCreateLead} className="grid gap-3 lg:grid-cols-[1.2fr_1fr_0.8fr_1fr_0.8fr_auto]">
          <input
            className="field"
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="שם ליד"
            required
            value={form.name}
          />
          <input
            className="field"
            inputMode="tel"
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="טלפון"
            required
            value={form.phone}
          />
          <input
            className="field"
            inputMode="numeric"
            min="0"
            onChange={(event) => updateField("value", event.target.value)}
            placeholder="שווי"
            type="number"
            value={form.value}
          />
          <input
            className="field"
            onChange={(event) => updateField("source", event.target.value)}
            placeholder="מקור"
            value={form.source}
          />
          <select className="field" onChange={(event) => updateField("priority", event.target.value)} value={form.priority}>
            {PRIORITIES.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </select>
          <button className="button-primary gap-2 whitespace-nowrap" disabled={isPending} type="submit">
            <Plus className="h-4 w-4" />
            הוספה
          </button>
        </form>
      </section>

      {leadToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-danger/30 bg-zinc-950 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <h2 className="text-xl font-semibold text-white">האם אתה בטוח שברצונך למחוק את הליד?</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">הפעולה תמחק את הליד לצמיתות ולא ניתן לשחזר.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button className="button-secondary" disabled={isPending} onClick={() => setLeadToDelete(null)} type="button">
                בטל
              </button>
              <button
                className="button-danger"
                disabled={isPending}
                onClick={() => deleteLead(leadToDelete)}
                type="button"
              >
                מחק ליד
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">לידים למעקב</h2>
            <p className="mt-1 text-sm text-zinc-400">לידים שהפעולה הבאה שלהם כבר הגיעה או מתוכננת להיום.</p>
          </div>
          <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-sm text-gold-soft">
            {followUpLeads.length} למעקב
          </span>
        </div>

        {followUpLeads.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {followUpLeads.slice(0, 6).map((lead) => {
              const overdue = isOverdue(lead.next_action_date);

              return (
                <article
                  className={`rounded-lg border p-4 ${
                    overdue ? "border-danger/30 bg-danger/10" : "border-white/10 bg-white/5"
                  }`}
                  key={lead.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{lead.name}</h3>
                      <p className="mt-1 text-sm text-zinc-400">{lead.phone}</p>
                    </div>
                    <CalendarClock className={overdue ? "h-5 w-5 text-red-200" : "h-5 w-5 text-gold"} />
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">
                    {getNextActionLabel(lead.next_action_type)} · {formatDate(lead.next_action_date)}
                  </p>
                  {overdue ? <p className="mt-2 text-xs font-medium text-red-200">באיחור - כדאי לטפל עכשיו</p> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-white/10 p-4 text-sm leading-6 text-zinc-400">
            אין מעקבים דחופים כרגע. כשמגדירים פעולה הבאה לליד, היא תופיע כאן ביום הפעולה.
          </p>
        )}
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-white/10 p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_210px_190px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-zinc-500" />
              <input
                className="field pr-10"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="חיפוש לפי שם, טלפון, מקור או הערה"
                value={query}
              />
            </label>
            <select className="field" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">כל הסטטוסים</option>
              {LEAD_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <select className="field" onChange={(event) => setSort(event.target.value as SortKey)} value={sort}>
              <option value="score_desc">ציון גבוה קודם</option>
              <option value="inactivity_desc">חוסר פעילות קודם</option>
              <option value="value_desc">שווי גבוה קודם</option>
              <option value="urgency">מעקב דחוף קודם</option>
              <option value="created_desc">חדשים קודם</option>
              <option value="created_asc">ישנים קודם</option>
              <option value="name_asc">שם א-ת</option>
            </select>
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="p-6 text-center sm:p-10">
            <p className="text-lg font-semibold">אין עדיין לידים</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
              הוסיפו ליד ראשון עם שם וטלפון בלבד. אחר כך אפשר להוסיף שווי, הערות ומעקב.
            </p>
            <button
              className="button-primary mt-5"
              onClick={() => {
                document.querySelector<HTMLInputElement>('input[placeholder="שם ליד"]')?.focus();
              }}
              type="button"
            >
              הוספת ליד
            </button>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-6 text-center sm:p-10">
            <p className="text-lg font-semibold">לא נמצאו לידים</p>
            <p className="mt-2 text-sm text-zinc-400">נסו לשנות חיפוש, סטטוס או מיון.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[1180px] table-fixed text-right text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03] text-xs text-zinc-400">
                  <tr>
                    <th className="w-[18%] px-5 py-3 font-medium">ליד</th>
                    <th className="w-[13%] px-5 py-3 font-medium">שווי ועדיפות</th>
                    <th className="w-[15%] px-5 py-3 font-medium">סטטוס</th>
                    <th className="w-[18%] px-5 py-3 font-medium">מעקב הבא</th>
                    <th className="w-[18%] px-5 py-3 font-medium">הערה</th>
                    <th className="w-[18%] px-5 py-3 font-medium">פעולות מהירות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className={`align-top ${getLeadScore(lead) >= 80 ? "bg-gold/[0.04]" : ""}`}
                    >
                      <td className="px-5 py-4">
                        <p className="font-medium text-white">{lead.name}</p>
                        <p className="mt-1 text-zinc-300">{lead.phone || "ללא טלפון"}</p>
                        <p className="mt-1 text-xs text-zinc-500">מקור: {lead.source || "לא הוגדר"}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs ${getLeadTemperature(lead).color}`}>
                            {getLeadTemperature(lead).label} · {getLeadTemperature(lead).score}
                          </span>
                          {getDaysSinceLastActivity(lead) > 2 ? (
                            <span className="rounded-full border border-danger/30 bg-danger/10 px-2.5 py-1 text-xs text-red-200">
                              ⚠️ תקוע · {formatDaysSinceActivity(lead)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">{formatMoney(lead.value)}</p>
                        <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs ${getPriorityColor(lead.priority)}`}>
                          {getPriorityLabel(lead.priority)}
                        </span>
                        <p className="mt-2 text-xs text-zinc-500">{lead.deal_probability}% הסתברות</p>
                        <p className={getDaysSinceLastActivity(lead) > 2 ? "mt-1 text-xs text-red-200" : "mt-1 text-xs text-zinc-500"}>
                          קשר אחרון: {formatDaysSinceActivity(lead)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full border px-3 py-1 text-xs ${getLeadStatusColor(lead.status)}`}>
                          {normalizeLeadStatus(lead.status)}
                        </span>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {LEAD_STATUSES.map((status) => (
                            <button
                              className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                                normalizeLeadStatus(lead.status) === status.value
                                  ? "border-gold/40 bg-gold/20 text-gold-soft"
                                  : "border-white/10 bg-white/5 text-zinc-300 hover:border-gold/30"
                              }`}
                              disabled={isPending}
                              key={status.value}
                              onClick={() => updateStatus(lead.id, status.value)}
                              type="button"
                            >
                              {status.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className={isOverdue(lead.next_action_date) ? "font-medium text-red-200" : "text-zinc-300"}>
                          {formatNextAction(lead)}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">{getNextActionLabel(lead.next_action_type)}</p>
                        <form className="mt-3 space-y-2" onSubmit={(event) => handleFollowUp(event, lead.id)}>
                          <input className="field py-2" defaultValue={toInputDateTime(lead.next_action_date)} name="next_action_date" type="datetime-local" />
                          <select className="field py-2" defaultValue={lead.next_action_type ?? "follow-up"} name="next_action_type">
                            {NEXT_ACTION_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                          <button className="button-secondary w-full py-2" disabled={isPending} type="submit">
                            שמירת מעקב
                          </button>
                        </form>
                      </td>
                      <td className="px-5 py-4">
                        <form onSubmit={(event) => handleNote(event, lead.id)}>
                          <textarea
                            className="field min-h-24 resize-none"
                            defaultValue={lead.notes ?? ""}
                            name="notes"
                            placeholder="סיכום שיחה קצר..."
                          />
                          <button className="button-secondary mt-2 w-full py-2" disabled={isPending} type="submit">
                            <MessageSquareText className="ml-2 h-4 w-4" />
                            שמירת הערה
                          </button>
                        </form>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          className="button-primary mb-3 w-full py-2"
                          disabled={isPending}
                          onClick={() => completeAction(lead)}
                          type="button"
                        >
                          ✔ סיימתי פעולה
                        </button>
                        <button
                          className="button-danger mb-3 w-full py-2"
                          disabled={isPending}
                          onClick={() => setLeadToDelete(lead)}
                          type="button"
                        >
                          מחק ליד
                        </button>
                        <div className="mb-3">
                          {renderWhatsAppCenter(lead)}
                        </div>
                        <form className="space-y-2" onSubmit={(event) => handleSalesDetails(event, lead.id)}>
                          <input className="field py-2" defaultValue={lead.name} name="name" placeholder="שם" />
                          <input className="field py-2" defaultValue={lead.phone ?? ""} name="phone" placeholder="טלפון" />
                          <input className="field py-2" defaultValue={lead.source ?? ""} name="source" placeholder="מקור" />
                          <input className="field py-2" defaultValue={lead.value} min="0" name="value" placeholder="שווי עסקה" type="number" />
                          <input
                            className="field py-2"
                            defaultValue={lead.deal_probability}
                            max="100"
                            min="0"
                            name="deal_probability"
                            placeholder="הסתברות"
                            type="number"
                          />
                          <select className="field py-2" defaultValue={lead.priority} name="priority">
                            {PRIORITIES.map((priority) => (
                              <option key={priority.value} value={priority.value}>
                                {priority.label}
                              </option>
                            ))}
                          </select>
                          <button className="button-secondary w-full py-2" disabled={isPending} type="submit">
                            עדכון פרטים
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-white/10 xl:hidden">
              {filteredLeads.map((lead) => (
                <article
                  key={lead.id}
                  className={`p-4 ${getLeadScore(lead) >= 80 ? "border-r-2 border-gold bg-gold/[0.04]" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{lead.name}</h3>
                      <p className="mt-1 text-sm text-zinc-400">{lead.phone || "ללא טלפון"}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-xs ${getLeadTemperature(lead).color}`}>
                          {getLeadTemperature(lead).label} · {getLeadTemperature(lead).score}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            getDaysSinceLastActivity(lead) > 2
                              ? "border-danger/30 bg-danger/10 text-red-200"
                              : "border-white/10 bg-white/5 text-zinc-400"
                          }`}
                        >
                          {getDaysSinceLastActivity(lead) > 2 ? "⚠️ תקוע · " : ""}
                          {formatDaysSinceActivity(lead)}
                        </span>
                      </div>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs ${getPriorityColor(lead.priority)}`}>
                      {getPriorityLabel(lead.priority)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs text-zinc-500">שווי</p>
                      <p className="mt-1 font-semibold">{formatMoney(lead.value)}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs text-zinc-500">מעקב הבא</p>
                      <p className={isOverdue(lead.next_action_date) ? "mt-1 font-medium text-red-200" : "mt-1 text-zinc-300"}>
                        {formatNextAction(lead)}
                      </p>
                    </div>
                  </div>

                  <button
                    className="button-primary mt-4 w-full py-2"
                    disabled={isPending}
                    onClick={() => completeAction(lead)}
                    type="button"
                  >
                    ✔ סיימתי פעולה
                  </button>
                  <button
                    className="button-danger mt-3 w-full py-2"
                    disabled={isPending}
                    onClick={() => setLeadToDelete(lead)}
                    type="button"
                  >
                    מחק ליד
                  </button>
                  <div className="mt-3">
                    {renderWhatsAppCenter(lead)}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {LEAD_STATUSES.map((status) => (
                      <button
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          normalizeLeadStatus(lead.status) === status.value
                            ? "border-gold/40 bg-gold/20 text-gold-soft"
                            : "border-white/10 bg-white/5 text-zinc-300"
                        }`}
                        disabled={isPending}
                        key={status.value}
                        onClick={() => updateStatus(lead.id, status.value)}
                        type="button"
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>

                  <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_150px_auto]" onSubmit={(event) => handleFollowUp(event, lead.id)}>
                    <input className="field py-2" defaultValue={toInputDateTime(lead.next_action_date)} name="next_action_date" type="datetime-local" />
                    <select className="field py-2" defaultValue={lead.next_action_type ?? "follow-up"} name="next_action_type">
                      {NEXT_ACTION_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    <button className="button-secondary py-2" disabled={isPending} type="submit">
                      שמירה
                    </button>
                  </form>

                  <form className="mt-3" onSubmit={(event) => handleNote(event, lead.id)}>
                    <textarea className="field min-h-20 resize-none" defaultValue={lead.notes ?? ""} name="notes" placeholder="סיכום שיחה..." />
                    <button className="button-secondary mt-2 w-full py-2" disabled={isPending} type="submit">
                      שמירת הערה
                    </button>
                  </form>

                  <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={(event) => handleSalesDetails(event, lead.id)}>
                    <input className="field py-2" defaultValue={lead.name} name="name" placeholder="שם" />
                    <input className="field py-2" defaultValue={lead.phone ?? ""} name="phone" placeholder="טלפון" />
                    <input className="field py-2" defaultValue={lead.source ?? ""} name="source" placeholder="מקור" />
                    <input className="field py-2" defaultValue={lead.value} min="0" name="value" placeholder="שווי" type="number" />
                    <input
                      className="field py-2"
                      defaultValue={lead.deal_probability}
                      max="100"
                      min="0"
                      name="deal_probability"
                      placeholder="הסתברות"
                      type="number"
                    />
                    <select className="field py-2" defaultValue={lead.priority} name="priority">
                      {PRIORITIES.map((priority) => (
                        <option key={priority.value} value={priority.value}>
                          {priority.label}
                        </option>
                      ))}
                    </select>
                    <button className="button-secondary py-2 sm:col-span-2" disabled={isPending} type="submit">
                      עדכון פרטים
                    </button>
                  </form>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
