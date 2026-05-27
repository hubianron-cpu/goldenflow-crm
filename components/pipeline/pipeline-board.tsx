"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Check, GripVertical, MessageCircle, PhoneCall } from "lucide-react";
import { LoadingCard } from "@/components/loading-card";
import { StatusMessage } from "@/components/status-message";
import {
  getActionCompletedStatus,
  getLeadStatusColor,
  normalizeLeadStatus,
  getPriorityColor,
  getPriorityLabel,
  LEAD_STATUSES,
  type Lead,
  type LeadStatus,
} from "@/lib/leads";

const moneyFormatter = new Intl.NumberFormat("he-IL", {
  currency: "ILS",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatMoney(value: number) {
  return moneyFormatter.format(value || 0);
}

function formatShortDate(value: string | null) {
  if (!value) {
    return "אין קשר";
  }

  return new Date(value).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getTomorrowIso() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow.toISOString();
}

function getWhatsappUrl(phone: string | null) {
  const cleanPhone = phone?.replace(/[^\d]/g, "");

  if (!cleanPhone) {
    return "#";
  }

  const normalizedPhone = cleanPhone.startsWith("0") ? `972${cleanPhone.slice(1)}` : cleanPhone;
  return `https://wa.me/${normalizedPhone}`;
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

export function PipelineBoard() {
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeads = useCallback(async () => {
    try {
      const response = await fetch("/api/leads", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error || "לא הצלחנו לטעון את מסלול המכירה.");
        setLeads([]);
        return;
      }

      setLeads(payload.leads ?? []);
      setError("");
    } catch {
      setError("לא הצלחנו לטעון את מסלול המכירה. בדקו את החיבור ונסו שוב.");
      setLeads([]);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function boot() {
      setLoading(true);
      try {
        await loadLeads();
      } finally {
        if (!active) {
          return;
        }

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

  const groupedLeads = useMemo(
    () =>
      LEAD_STATUSES.map((stage) => {
        const stageLeads = leads.filter((lead) => normalizeLeadStatus(lead.status) === stage.value);
        const totalValue = stageLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);

        return {
          ...stage,
          leads: stageLeads,
          totalValue,
        };
      }),
    [leads],
  );

  function patchLead(leadId: string, fields: Partial<Lead>, message: string) {
    setError("");
    setSuccess("");

    startTransition(async () => {
      const response = await fetch("/api/leads", {
        body: JSON.stringify({
          id: leadId,
          ...fields,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        setError(getApiErrorMessage(payload, "לא הצלחנו לעדכן את הליד."));
        return;
      }

      setSuccess(message);
      await loadLeads();
    });
  }

  function updateStage(leadId: string, status: LeadStatus) {
    patchLead(
      leadId,
      {
        last_contact_date: new Date().toISOString(),
        status,
      },
      "הליד עבר שלב ונשמר.",
    );
  }

  function handleLeadHandled(lead: Lead) {
    const nextStatus = getActionCompletedStatus(lead.status);
    const now = new Date().toISOString();

    patchLead(
      lead.id,
      {
        last_contact_date: now,
        next_action_date: getTomorrowIso(),
        next_action_type: "follow-up",
        ...(nextStatus ? { status: nextStatus } : {}),
        updated_at: now,
      },
      "✔ הליד עודכן והועבר קדימה",
    );
  }

  function handlePostponeToTomorrow(lead: Lead) {
    const now = new Date().toISOString();
    patchLead(
      lead.id,
      {
        next_action_date: getTomorrowIso(),
        next_action_type: "follow-up",
        updated_at: now,
      },
      "⏩ הליד נדחה למחר",
    );
  }

  function handleDrop(status: LeadStatus) {
    if (!draggedLeadId) {
      return;
    }

    const draggedLead = leads.find((lead) => lead.id === draggedLeadId);

    if (draggedLead && normalizeLeadStatus(draggedLead.status) === status) {
      setDraggedLeadId(null);
      setDragOverStatus(null);
      return;
    }

    updateStage(draggedLeadId, status);
    setDraggedLeadId(null);
    setDragOverStatus(null);
  }

  function handleSwipe(lead: Lead, endX: number) {
    if (touchStartX === null) {
      return;
    }

    const delta = endX - touchStartX;
    setTouchStartX(null);

    if (delta > 70) {
      handleLeadHandled(lead);
    }

    if (delta < -70) {
      handlePostponeToTomorrow(lead);
    }
  }

  if (loading) {
    return <LoadingCard label="טוען מסלול המכירה..." />;
  }

  return (
    <div className="space-y-6">
      <StatusMessage error={error} success={success} />

      {leads.length === 0 ? (
        <section className="panel p-6 text-center">
          <p className="text-lg font-semibold">אין עדיין לידים במסלול המכירה</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
            הוסיפו לידים במסך הלידים, והם יופיעו כאן לפי שלב המכירה שלהם.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {groupedLeads.map((stage) => (
            <section
              className={`panel p-3 transition duration-200 ${
                dragOverStatus === stage.value ? "scale-[1.01] border-gold/50 bg-gold/[0.06] shadow-[0_0_40px_rgba(201,162,39,0.14)]" : ""
              }`}
              key={stage.value}
              onDragLeave={() => setDragOverStatus(null)}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverStatus(stage.value);
              }}
              onDrop={() => handleDrop(stage.value)}
            >
              <div className={`mb-3 rounded-2xl border px-3 py-3 ${getLeadStatusColor(stage.value)}`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{stage.label}</h3>
                  <span className="rounded-full border border-white/10 bg-black/15 px-2 py-0.5 text-xs">{stage.leads.length}</span>
                </div>
                <p className="mt-1 text-xl font-semibold">{formatMoney(stage.totalValue)}</p>
              </div>

              <div className="divide-y divide-white/5">
                {stage.leads.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                    אין לידים בשלב הזה.
                  </p>
                ) : (
                  stage.leads.map((lead) => {
                    const expanded = expandedLeadId === lead.id;

                    return (
                      <article
                        className={`group cursor-pointer rounded-2xl border border-transparent px-3 py-3 transition duration-200 hover:border-gold/25 hover:bg-white/[0.045] ${
                          draggedLeadId === lead.id ? "scale-[0.98] opacity-60" : ""
                        } ${expanded ? "border-gold/30 bg-gold/[0.06]" : ""}`}
                        draggable
                        key={lead.id}
                        onClick={() => setExpandedLeadId((current) => (current === lead.id ? null : lead.id))}
                        onDragEnd={() => {
                          setDraggedLeadId(null);
                          setDragOverStatus(null);
                        }}
                        onDragStart={() => setDraggedLeadId(lead.id)}
                        onTouchEnd={(event) => handleSwipe(lead, event.changedTouches[0]?.clientX ?? 0)}
                        onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <GripVertical className="h-4 w-4 shrink-0 text-zinc-600" />
                              <h4 className="truncate text-sm font-semibold">{lead.name}</h4>
                            </div>
                            <p className="mt-1 text-[11px] text-zinc-500">
                              קשר: {formatShortDate(lead.last_contact_date)} · {stage.label}
                            </p>
                          </div>
                          <div className="shrink-0 text-left">
                            <p className="text-lg font-semibold leading-none text-gold-soft">{formatMoney(lead.value)}</p>
                            <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] ${getPriorityColor(lead.priority)}`}>
                              {getPriorityLabel(lead.priority)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex max-w-full flex-wrap gap-2">
                          {lead.phone ? (
                            <a
                              className="button-secondary min-h-10 min-w-[72px] flex-1 px-2 py-2 text-xs"
                              href={`tel:${lead.phone}`}
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              <PhoneCall className="h-3.5 w-3.5" />
                              שיחה
                            </a>
                          ) : (
                            <span className="button-secondary min-h-10 min-w-[72px] flex-1 cursor-not-allowed px-2 py-2 text-xs opacity-50">שיחה</span>
                          )}
                          {lead.phone ? (
                            <a
                              className="button-secondary min-h-10 w-11 flex-none px-2 py-2 text-xs"
                              href={getWhatsappUrl(lead.phone)}
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                              rel="noreferrer"
                              target="_blank"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="button-secondary min-h-10 w-11 flex-none cursor-not-allowed px-2 py-2 text-xs opacity-50">
                              <MessageCircle className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <button
                            className="button-secondary min-h-10 min-w-[86px] flex-1 px-2 py-2 text-xs"
                            disabled={isPending}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleLeadHandled(lead);
                            }}
                            title="סימנתי שטיפלתי בליד והתקדמתי לשלב הבא"
                            type="button"
                          >
                            <Check className="h-3.5 w-3.5" />
                            ✔ טיפלתי
                          </button>
                        </div>

                        <div className={`${expanded ? "grid" : "hidden group-hover:grid"} mt-3 gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-400`}>
                          <p>טלפון: {lead.phone || "לא קיים"}</p>
                          <p>סיכוי סגירה: {lead.deal_probability}%</p>
                          <p>פעולה הבאה: {formatShortDate(lead.next_action_date)}</p>
                          {lead.notes ? <p className="line-clamp-2">הערות: {lead.notes}</p> : null}
                          <label className="grid gap-1 text-xs font-semibold text-zinc-300">
                            שינוי שלב
                            <select
                              className="field min-h-10 py-2 text-xs"
                              onChange={(event) => {
                                event.stopPropagation();
                                const nextStatus = event.target.value as LeadStatus;

                                if (normalizeLeadStatus(lead.status) !== nextStatus) {
                                  updateStage(lead.id, nextStatus);
                                }
                              }}
                              onClick={(event) => event.stopPropagation()}
                              value={normalizeLeadStatus(lead.status)}
                            >
                              {LEAD_STATUSES.map((status) => (
                                <option key={status.value} value={status.value}>
                                  {status.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              className="button-secondary min-h-9 px-2 py-1.5 text-xs"
                              disabled={isPending}
                              onClick={(event) => {
                                event.stopPropagation();
                                handlePostponeToTomorrow(lead);
                              }}
                              title="הליד יחזור לטיפול מחר"
                              type="button"
                            >
                              ⏩ מחר
                            </button>
                            <button
                              className="button-primary min-h-9 px-2 py-1.5 text-xs"
                              disabled={isPending}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleLeadHandled(lead);
                              }}
                              title="סימנתי שטיפלתי בליד והתקדמתי לשלב הבא"
                              type="button"
                            >
                              ✔ טיפלתי
                            </button>
                          </div>
                          <p className="text-[10px] text-zinc-600 md:hidden">במובייל: החלקה ימינה מסמנת טיפלתי, החלקה שמאלה דוחה למחר</p>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
