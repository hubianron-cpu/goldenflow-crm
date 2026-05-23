"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BadgeDollarSign,
  Bell,
  Target,
  TrendingUp,
} from "lucide-react";
import { LoadingCard } from "@/components/loading-card";
import { StatusMessage } from "@/components/status-message";
import {
  getActionCompletedStatus,
  getDaysSinceLastActivity,
  getLeadScore,
  getLeadStatusColor,
  getLeadTemperature,
  getNextActionLabel,
  getReactivationScore,
  getRescueActionLabel,
  getRescueActivityLabel,
  isRescueLead,
  LEAD_STATUSES,
  normalizeLeadStatus,
  sortRescueLeads,
  type Lead,
} from "@/lib/leads";

const CLOSABLE_STAGES: string[] = ["הצעה נשלחה", "ממתין לתגובה"];
const CONTACTED_STAGES: string[] = LEAD_STATUSES.filter((status) => status.value !== "לידים חדשים").map((status) => status.value);
const MEETING_STAGES: string[] = ["בתהליך שיחה", "הצעה נשלחה", "ממתין לתגובה"];
const CLOSED_STAGE = "נסגר בהצלחה";
const DEFAULT_DAILY_TARGET = 3000;
const MIN_DAILY_TARGET = 500;
const MAX_DAILY_TARGET = 100000;
const STUCK_AFTER_DAYS = 3;
const RECOMMENDED_MESSAGE = "היי, דיברנו בעבר וזה בנוגע לשינוי שרצית לעשות\nתהיה זמין בשעות הקרובות?";
const REACTIVATION_MESSAGES = [
  RECOMMENDED_MESSAGE,
  RECOMMENDED_MESSAGE,
  RECOMMENDED_MESSAGE,
];

const moneyFormatter = new Intl.NumberFormat("he-IL", {
  currency: "ILS",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatMoney(value: number) {
  return moneyFormatter.format(value || 0);
}

function getActivityDate(lead: Lead) {
  return lead.last_contact_date || lead.created_at;
}

function getHoursSinceActivity(lead: Lead) {
  return (Date.now() - new Date(getActivityDate(lead)).getTime()) / 36e5;
}

function getDaysSinceActivity(lead: Lead) {
  return getDaysSinceLastActivity(lead);
}

function getUrgencyState(lead: Lead) {
  const days = getDaysSinceActivity(lead);

  if (days >= 3) {
    return {
      className: "border-danger/35 bg-danger/10 text-red-100",
      label: "🔥 ליד בסיכון",
    };
  }

  if (days >= 2) {
    return {
      className: "border-gold/35 bg-gold/10 text-gold-soft",
      label: "⚠ מתחיל להתקרר",
    };
  }

  return {
    className: "border-white/10 bg-white/[0.04] text-zinc-300",
    label: "רגיל",
  };
}

function formatDate(value: string | null) {
  if (!value) {
    return "אין תיעוד";
  }

  return new Date(value).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function getTomorrowIso() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow.toISOString();
}

function getWhatsappUrl(phone: string | null, message: string) {
  const cleanPhone = phone?.replace(/[^\d+]/g, "");
  return cleanPhone ? `https://wa.me/${cleanPhone.replace(/^\+/, "")}?text=${encodeURIComponent(message)}` : "#";
}

function getPriority(lead: Lead) {
  const score = getLeadScore(lead);
  const days = getDaysSinceActivity(lead);
  const value = lead.value || 0;

  if (score >= 75 || days >= 3 || value >= 10000) {
    return {
      label: "עדיפות גבוהה",
      short: "High",
      className: "border-danger/40 bg-danger/10 text-red-100",
    };
  }

  if (score >= 50 || days >= 2 || value >= 3500) {
    return {
      label: "עדיפות בינונית",
      short: "Medium",
      className: "border-gold/35 bg-gold/10 text-gold-soft",
    };
  }

  return {
    label: "יציב",
    short: "Low",
    className: "border-success/35 bg-success/10 text-green-100",
  };
}

function getActionReason(lead: Lead) {
  const days = getDaysSinceActivity(lead);

  if (!lead.last_contact_date) {
    return "אין תיעוד קשר - להתחיל שיחה";
  }

  if (days >= STUCK_AFTER_DAYS) {
    return "תקוע במסלול המכירה - להחזיר תנועה";
  }

  if ((lead.value || 0) >= 10000) {
    return "שווי גבוה - לקדם שלב";
  }

  if (lead.next_action_date) {
    return `פעולה מתוכננת: ${getNextActionLabel(lead.next_action_type)}`;
  }

  return "בדיקת סטטוס קצרה";
}

function getStagePriority(status: string) {
  const weights: Record<string, number> = {
    "לידים חדשים": 28,
    "יצירת קשר": 36,
    "בתהליך שיחה": 58,
    "הצעה נשלחה": 92,
    "ממתין לתגובה": 84,
    "דורש המשך טיפול": 66,
    "נסגר בהצלחה": 100,
    "לא רלוונטי": 0,
  };

  return weights[normalizeLeadStatus(status)] ?? 35;
}

function getDailyPriorityScore(lead: Lead) {
  const value = lead.value || 0;
  const days = getDaysSinceActivity(lead);
  const dueToday =
    lead.next_action_date &&
    new Date(lead.next_action_date).setHours(0, 0, 0, 0) <= new Date().setHours(0, 0, 0, 0);
  const valueScore = Math.min(30, Math.floor(value / 1000) * 2);
  const inactivityScore = days >= 999 ? 18 : Math.min(24, days * 6);
  const nextActionScore = dueToday ? 22 : lead.next_action_date ? 8 : 4;
  const priorityScore = lead.priority === "high" ? 18 : lead.priority === "low" ? 4 : 10;
  const probabilityScore = Math.round((lead.deal_probability || 0) / 5);

  return getStagePriority(lead.status) + valueScore + inactivityScore + nextActionScore + priorityScore + probabilityScore;
}

function getDailyReason(lead: Lead) {
  const reasons: string[] = [];
  const days = getDaysSinceActivity(lead);

  if ((lead.value || 0) >= 5000) {
    reasons.push("שווי גבוה");
  }

  if (days >= STUCK_AFTER_DAYS) {
    reasons.push(`לא עודכן ${days} ימים`);
  }

  if (lead.next_action_date && new Date(lead.next_action_date).getTime() <= Date.now()) {
    reasons.push("פעולה מתוכננת להיום");
  }

  if (["הצעה נשלחה", "ממתין לתגובה"].includes(normalizeLeadStatus(lead.status))) {
    reasons.push("קרוב לסגירה");
  }

  if (normalizeLeadStatus(lead.status) === "דורש המשך טיפול") {
    reasons.push("צריך החזרה למסלול המכירה");
  }

  return reasons.length ? reasons.join(" + ") : getActionReason(lead);
}

function getRecommendedAction(lead: Lead) {
  const status = normalizeLeadStatus(lead.status);

  if (status === "הצעה נשלחה") {
    return "לסגור הצעה";
  }

  if (status === "ממתין לתגובה") {
    return "פולואפ לסגירה";
  }

  if (["לידים חדשים", "יצירת קשר"].includes(status)) {
    return "להתקשר ולקבוע שיחה";
  }

  if (status === "דורש המשך טיפול") {
    return "לשלוח הודעת החזרה";
  }

  return "פולואפ קצר";
}

function getScriptSuggestion(_lead: Lead) {
  void _lead;
  return RECOMMENDED_MESSAGE;
}

function getUrgencyIcon(lead: Lead) {
  if (["הצעה נשלחה", "ממתין לתגובה"].includes(normalizeLeadStatus(lead.status))) {
    return "💰";
  }

  if (normalizeLeadStatus(lead.status) === "דורש המשך טיפול" || getDaysSinceActivity(lead) >= STUCK_AFTER_DAYS) {
    return "⚠️";
  }

  return "🔥";
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

function isValidLeadForUpdate(lead: Lead) {
  return Boolean(lead.id && Number.isFinite(Number(lead.value || 0)));
}

export function DashboardMetrics() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [actionImpact, setActionImpact] = useState("");
  const [focusedLeadId, setFocusedLeadId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [handledLeadIds, setHandledLeadIds] = useState<string[]>([]);
  const [expandedDailyLeadId, setExpandedDailyLeadId] = useState<string | null>(null);
  const [handledToday, setHandledToday] = useState(0);
  const [completedInteractions, setCompletedInteractions] = useState(0);
  const [dailyTarget, setDailyTarget] = useState(DEFAULT_DAILY_TARGET);
  const [targetDraft, setTargetDraft] = useState(String(DEFAULT_DAILY_TARGET));
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [success, setSuccess] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [lastUserActionAt, setLastUserActionAt] = useState(Date.now());
  const [showIdleWarning, setShowIdleWarning] = useState(false);

  function markUserAction() {
    setLastUserActionAt(Date.now());
    setShowIdleWarning(false);
  }

  const loadLeads = useCallback(async () => {
    const response = await fetch("/api/leads", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error || "לא הצלחנו לטעון את נתוני הדאשבורד.");
      setLeads([]);
      setUpdatingLeadId(null);
      return;
    }

    setLeads(payload.leads ?? []);
    setError("");
  }, []);

  const loadDailyTarget = useCallback(async () => {
    const response = await fetch("/api/user-settings", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      setError(getApiErrorMessage(payload, "לא הצלחנו לטעון את היעד היומי."));
      setDailyTarget(DEFAULT_DAILY_TARGET);
      setTargetDraft(String(DEFAULT_DAILY_TARGET));
      return;
    }

    const loadedTarget = Number(payload.daily_target ?? DEFAULT_DAILY_TARGET);
    const safeTarget = Number.isFinite(loadedTarget) && loadedTarget > 0 ? loadedTarget : DEFAULT_DAILY_TARGET;
    setDailyTarget(safeTarget);
    setTargetDraft(String(safeTarget));
  }, []);

  useEffect(() => {
    let active = true;

    async function boot() {
      setLoading(true);
      await Promise.all([loadLeads(), loadDailyTarget()]);

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
  }, [loadDailyTarget, loadLeads]);

  useEffect(() => {
    const idleCheck = window.setInterval(() => {
      setShowIdleWarning(Date.now() - lastUserActionAt >= 15 * 60 * 1000);
    }, 60_000);

    return () => window.clearInterval(idleCheck);
  }, [lastUserActionAt]);

  const metrics = useMemo(() => {
    const total = leads.length;
    const totalValue = leads.reduce((sum, lead) => sum + (lead.value || 0), 0);
    const active = leads.filter((lead) => !["נסגר בהצלחה", "לא רלוונטי"].includes(normalizeLeadStatus(lead.status))).length;
    const moneyAtRisk = leads
      .filter((lead) => (lead.value || 0) > 0 && getDaysSinceActivity(lead) > 3)
      .reduce((sum, lead) => sum + (lead.value || 0), 0);
    const closableRevenue = leads
      .filter((lead) => CLOSABLE_STAGES.includes(normalizeLeadStatus(lead.status)))
      .reduce((sum, lead) => sum + (lead.value || 0), 0);
    const contacted = leads.filter((lead) => CONTACTED_STAGES.includes(normalizeLeadStatus(lead.status))).length;
    const meetings = leads.filter((lead) => MEETING_STAGES.includes(normalizeLeadStatus(lead.status))).length;
    const closed = leads.filter((lead) => normalizeLeadStatus(lead.status) === CLOSED_STAGE).length;
    const todayKey = new Date().toDateString();
    const closedTodayRevenue = leads
      .filter((lead) => normalizeLeadStatus(lead.status) === CLOSED_STAGE && (lead.closed_at || lead.last_contact_date) && new Date(lead.closed_at || lead.last_contact_date || "").toDateString() === todayKey)
      .reduce((sum, lead) => sum + (lead.value || 0), 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const nextMonthStart = new Date(monthStart);
    nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);
    const monthlyClosedLeads = leads.filter((lead) => {
      if (normalizeLeadStatus(lead.status) !== CLOSED_STAGE || !lead.closed_at) {
        return false;
      }

      const closedAt = new Date(lead.closed_at).getTime();
      return closedAt >= monthStart.getTime() && closedAt < nextMonthStart.getTime();
    });
    const monthlyRevenue = monthlyClosedLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);
    const monthlyClosedCount = monthlyClosedLeads.length;
    const conversion = total ? Math.round((closed / total) * 100) : 0;
    const valueByStage = LEAD_STATUSES.map((status) => {
      const stageLeads = leads.filter((lead) => normalizeLeadStatus(lead.status) === status.value);

      return {
        ...status,
        count: stageLeads.length,
        avgDays: stageLeads.length
          ? Math.round(stageLeads.reduce((sum, lead) => sum + Math.min(getDaysSinceActivity(lead), 30), 0) / stageLeads.length)
          : 0,
        totalValue: stageLeads.reduce((sum, lead) => sum + (lead.value || 0), 0),
      };
    });
    const actionLeads = leads
      .filter((lead) => {
        const dueToday =
          lead.next_action_date &&
          new Date(lead.next_action_date).setHours(0, 0, 0, 0) <= new Date().setHours(0, 0, 0, 0);

        return normalizeLeadStatus(lead.status) !== CLOSED_STAGE && (dueToday || getDaysSinceActivity(lead) >= 2 || !lead.last_contact_date);
      })
      .sort((a, b) => getLeadScore(b) - getLeadScore(a) || (b.value || 0) - (a.value || 0))
      .slice(0, 6);
    const stuckLeads = leads
      .filter((lead) => normalizeLeadStatus(lead.status) !== CLOSED_STAGE && getDaysSinceActivity(lead) >= STUCK_AFTER_DAYS)
      .sort((a, b) => getHoursSinceActivity(b) - getHoursSinceActivity(a));
    const reactivationLeads = leads.filter(isRescueLead).sort(sortRescueLeads);
    const recoverableMoney = reactivationLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);
    const closeableLeads = leads
      .filter((lead) => CLOSABLE_STAGES.includes(normalizeLeadStatus(lead.status)))
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 5);
    const byDailyPriority = (a: Lead, b: Lead) =>
      getDailyPriorityScore(b) - getDailyPriorityScore(a) || (b.value || 0) - (a.value || 0);
    const dailyClosing = {
      actionToday: leads
        .filter((lead) => ["לידים חדשים", "יצירת קשר"].includes(normalizeLeadStatus(lead.status)))
        .sort(byDailyPriority)
        .slice(0, 4),
      scheduleCall: leads
        .filter((lead) => normalizeLeadStatus(lead.status) === "בתהליך שיחה")
        .sort(byDailyPriority)
        .slice(0, 4),
      close: leads
        .filter((lead) => ["הצעה נשלחה", "ממתין לתגובה"].includes(normalizeLeadStatus(lead.status)))
        .sort(byDailyPriority)
        .slice(0, 4),
      followUp: leads
        .filter((lead) => normalizeLeadStatus(lead.status) === "דורש המשך טיפול")
        .sort(byDailyPriority)
        .slice(0, 4),
    };
    const dailyLeadMap = new Map<string, Lead>();
    Object.values(dailyClosing).forEach((group) => {
      group.forEach((lead) => dailyLeadMap.set(lead.id, lead));
    });
    const dailyLeads = Array.from(dailyLeadMap.values()).sort(byDailyPriority).slice(0, 10);
    const dailyRevenuePotential = dailyLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);

    return {
      actionLeads,
      active,
      closableRevenue,
      closed,
      closedTodayRevenue,
      closeableLeads,
      contacted,
      conversion,
      dailyClosing,
      dailyLeads,
      dailyRevenuePotential,
      meetings,
      moneyAtRisk,
      monthlyClosedCount,
      monthlyRevenue,
      reactivationLeads,
      recoverableMoney,
      stuckLeads,
      total,
      totalValue,
      valueByStage,
    };
  }, [leads]);

  const closingQueue = useMemo(() => {
    const dueRank = (lead: Lead) => {
      if (!lead.next_action_date) {
        return 0;
      }

      return new Date(lead.next_action_date).setHours(0, 0, 0, 0) <= new Date().setHours(0, 0, 0, 0) ? 2 : 1;
    };
    const priorityRank = (lead: Lead) => (lead.priority === "high" ? 3 : lead.priority === "medium" ? 2 : 1);
    const closeRank = (lead: Lead) => getStagePriority(lead.status);

    return leads
      .filter((lead) => {
        const alreadyHandledClosedLead = normalizeLeadStatus(lead.status) === CLOSED_STAGE && !lead.next_action_date && getDaysSinceActivity(lead) === 0;
        return !handledLeadIds.includes(lead.id) && !alreadyHandledClosedLead;
      })
      .sort(
        (a, b) =>
          dueRank(b) - dueRank(a) ||
          (b.value || 0) - (a.value || 0) ||
          priorityRank(b) - priorityRank(a) ||
          getDaysSinceActivity(b) - getDaysSinceActivity(a) ||
          closeRank(b) - closeRank(a),
      );
  }, [handledLeadIds, leads]);

  const nextBestLead = metrics.actionLeads[0] ?? metrics.stuckLeads[0] ?? metrics.closeableLeads[0] ?? null;
  const priorityActionLead = useMemo(() => {
    return [...leads]
      .filter((lead) => {
        const status = normalizeLeadStatus(lead.status);
        return status !== CLOSED_STAGE && (CLOSABLE_STAGES.includes(status) || status.includes("ממתין") || status.includes("לסגור"));
      })
      .sort(
        (a, b) =>
          (b.value || 0) - (a.value || 0) ||
          new Date(getActivityDate(a)).getTime() - new Date(getActivityDate(b)).getTime(),
      )[0] ?? nextBestLead;
  }, [leads, nextBestLead]);
  const closingLead = closingQueue[0] ?? null;
  const nextActionLead = focusMode ? closingLead : metrics.dailyLeads[0] ?? priorityActionLead;
  const remainingPotential = closingQueue.reduce((sum, lead) => sum + (lead.value || 0), 0);
  const closedTodayRevenue = metrics.closedTodayRevenue;
  const dailyProgress = dailyTarget > 0 ? Math.min(100, Math.round((closedTodayRevenue / dailyTarget) * 100)) : 0;
  const dailyGap = Math.max(0, dailyTarget - closedTodayRevenue);
  const dailyTargetReached = closedTodayRevenue >= dailyTarget && dailyTarget > 0;

  async function returnToPipeline(lead: Lead) {
    markUserAction();
    setError("");
    setSuccess("");

    setUpdatingLeadId(lead.id);
    const now = new Date().toISOString();
    const response = await fetch("/api/leads", {
      body: JSON.stringify({
        id: lead.id,
        last_contact_date: now,
        next_action_date: now,
        next_action_type: "follow-up",
        status: "בתהליך שיחה",
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const payload = (await response.json().catch(() => ({}))) as { lead?: Lead } & Record<string, unknown>;

    if (!response.ok) {
      setError(getApiErrorMessage(payload, "לא הצלחנו להחזיר את הליד למסלול המכירה."));
      setUpdatingLeadId(null);
      return;
    }

    if (payload.lead) {
      setLeads((current) => current.map((item) => (item.id === payload.lead?.id ? payload.lead : item)));
    }
    setSuccess("הליד חזר למסלול המכירה ונקבע לטיפול היום.");
    await loadLeads();
    setUpdatingLeadId(null);
  }

  async function saveDailyTarget() {
    markUserAction();
    const nextTarget = Number(targetDraft);

    setError("");
    setSuccess("");

    if (!Number.isFinite(nextTarget) || nextTarget < MIN_DAILY_TARGET || nextTarget > MAX_DAILY_TARGET) {
      setError("היעד היומי חייב להיות בין 500 ל-100,000.");
      return;
    }

    setSavingTarget(true);

    try {
      const response = await fetch("/api/user-settings", {
        body: JSON.stringify({ daily_target: Math.round(nextTarget) }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        setError(getApiErrorMessage(payload, "לא הצלחנו לשמור את היעד היומי."));
        return;
      }

      const savedTarget = Number(payload.daily_target ?? nextTarget);
      setDailyTarget(savedTarget);
      setTargetDraft(String(savedTarget));
      setTargetModalOpen(false);
      setSuccess("✔ היעד עודכן");
    } finally {
      setSavingTarget(false);
    }
  }

  async function updateLeadAction(leadId: string, mode: "done" | "tomorrow") {
    markUserAction();
    setError("");
    setActionImpact("");
    setSuccess("");

    if (updatingLeadId) {
      return;
    }

    const lead = leads.find((item) => item.id === leadId);

    if (!lead) {
      setError("לא ניתן לעדכן את הליד: הליד לא נמצא ברשימה הנוכחית.");
      return;
    }

    if (!isValidLeadForUpdate(lead)) {
      setError("לא ניתן לעדכן את הליד: מזהה חסר או שווי לא תקין.");
      return;
    }

    setUpdatingLeadId(lead.id);
    const now = new Date().toISOString();
    const nextStatus = mode === "done" ? getActionCompletedStatus(lead.status) : null;
    const nextAction =
      mode === "done"
        ? {
            ...(nextStatus ? { status: nextStatus } : {}),
            next_action_date: getTomorrowIso(),
            next_action_type: "follow-up",
          }
        : { next_action_date: getTomorrowIso(), next_action_type: "follow-up" };
    const response = await fetch("/api/leads", {
      body: JSON.stringify({
        id: lead.id,
        ...(mode === "done" ? { last_contact_date: now } : {}),
        ...nextAction,
        updated_at: now,
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const payload = (await response.json().catch(() => ({}))) as { lead?: Lead } & Record<string, unknown>;

    if (!response.ok) {
      setError(getApiErrorMessage(payload, "לא הצלחנו לעדכן את הפעולה היומית."));
      setUpdatingLeadId(null);
      return;
    }

    if (payload.lead) {
      setLeads((current) => current.map((item) => (item.id === payload.lead?.id ? payload.lead : item)));
    }
    setHandledLeadIds((current) => [...new Set([...current, lead.id])]);
    setHandledToday((current) => current + 1);
    if (mode === "done") {
      setCompletedInteractions((current) => current + 1);
    }
    setActionImpact(mode === "done" ? `+${formatMoney(lead.value || 0)} פוטנציאל קודם` : "הפעולה נשמרה למחר");
    setSuccess(mode === "done" ? "✔ הליד עודכן והועבר קדימה" : "⏩ הליד נדחה למחר");
    if (focusedLeadId === lead.id) {
      setFocusedLeadId(null);
    }
    await loadLeads();
    setUpdatingLeadId(null);
  }

  async function handleLeadHandled(leadId: string) {
    await updateLeadAction(leadId, "done");
  }

  async function handlePostponeToTomorrow(leadId: string) {
    await updateLeadAction(leadId, "tomorrow");
  }

  async function closeDeal(lead: Lead) {
    markUserAction();
    setError("");
    setActionImpact("");
    setSuccess("");

    if (!isValidLeadForUpdate(lead)) {
      setError("לא ניתן לסגור את הליד: מזהה חסר או שווי לא תקין.");
      return;
    }

    const now = new Date().toISOString();
    const response = await fetch("/api/leads", {
      body: JSON.stringify({
        closed_at: now,
        id: lead.id,
        last_contact_date: now,
        next_action_date: null,
        next_action_type: null,
        status: CLOSED_STAGE,
        updated_at: now,
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const payload = (await response.json().catch(() => ({}))) as { lead?: Lead } & Record<string, unknown>;

    if (!response.ok) {
      setError(getApiErrorMessage(payload, "לא הצלחנו לסגור את העסקה."));
      return;
    }

    if (payload.lead) {
      setLeads((current) => current.map((item) => (item.id === payload.lead?.id ? payload.lead : item)));
    }
    setActionImpact(`✔ נסגר! התקדמת ליעד · +${formatMoney(lead.value || 0)}`);
    setHandledLeadIds((current) => [...new Set([...current, lead.id])]);
    setHandledToday((current) => current + 1);
    setCompletedInteractions((current) => current + 1);
    setSuccess("✔ נסגר! התקדמת ליעד");
    await loadLeads();
  }

  function backToDashboard() {
    setFocusMode(false);
    router.push("/dashboard");
  }

  if (loading) {
    return <LoadingCard label="טוען דאשבורד..." />;
  }

  const highestMoneyKpi = Math.max(metrics.totalValue, metrics.closableRevenue, metrics.monthlyRevenue, metrics.moneyAtRisk);

  return (
    <div className="w-full max-w-full space-y-6 overflow-x-clip">
      <StatusMessage error={error} success={success} />
      {actionImpact ? (
        <div className="number-rise rounded-2xl border border-gold/25 bg-gold/10 p-4 text-sm font-semibold text-gold-soft shadow-[0_0_35px_rgba(201,162,39,0.12)]">
          {actionImpact}
        </div>
      ) : null}
      {targetModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-gold/20 bg-zinc-950 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
            <h3 className="text-xl font-semibold text-white">מה היעד היומי שלך?</h3>
            <label className="mt-5 block text-sm text-zinc-300">
              מה היעד היומי שלך?
              <input
                className="field mt-2"
                max={MAX_DAILY_TARGET}
                min={MIN_DAILY_TARGET}
                onChange={(event) => setTargetDraft(event.target.value)}
                placeholder="לדוגמה: 3000"
                type="number"
                value={targetDraft}
              />
            </label>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button className="button-primary" disabled={savingTarget} onClick={saveDailyTarget} type="button">
                שמור
              </button>
              <button
                className="button-secondary"
                disabled={savingTarget}
                onClick={() => {
                  setTargetDraft(String(dailyTarget));
                  setTargetModalOpen(false);
                }}
                type="button"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="relative mx-auto w-full max-w-full overflow-hidden rounded-[32px] border border-gold/20 bg-[radial-gradient(circle_at_top,rgba(201,162,39,0.18),rgba(8,8,8,0.96)_48%,rgba(5,5,5,0.98))] px-4 py-10 text-center shadow-[0_30px_100px_rgba(0,0,0,0.42),0_0_58px_rgba(201,162,39,0.12)] sm:px-8 sm:py-16">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
        <div className="relative mx-auto flex max-w-[900px] flex-col items-center gap-5">
          <h1 className="max-w-[760px] break-words text-[clamp(2rem,9vw,3rem)] font-black leading-[1.14] tracking-tight text-white sm:text-5xl sm:leading-tight lg:text-[56px]">
            לסגור יותר עסקאות - עם סדר עבודה שמייצר כסף כל יום
          </h1>
          <p className="max-w-[600px] break-words text-base leading-7 text-zinc-300 sm:text-xl sm:leading-8">
            המערכת שמראה לך מי הלקוח הבא שלך - וכמה כסף מחכה לך
          </p>
          <button
            className="button-primary mt-3 min-h-12 px-7 text-base"
            onClick={() => document.getElementById("daily-command-center")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            type="button"
          >
            התחל סגירה יומית 🔥
          </button>
        </div>
      </section>

      {priorityActionLead ? (
        <section className="mx-auto w-full max-w-4xl rounded-[28px] border border-gold/30 bg-[linear-gradient(135deg,rgba(201,162,39,0.16),rgba(17,18,20,0.92))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28),0_0_34px_rgba(201,162,39,0.14)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gold-soft">👉 הפעולה הבאה שלך:</p>
              <h2 className="mt-2 break-words text-xl font-black tracking-tight text-white sm:text-2xl">
                📞 התקשר ל{priorityActionLead.name} - שווה {formatMoney(priorityActionLead.value)}
              </h2>
              <p className="mt-2 break-words text-sm text-zinc-400">
                {getUrgencyState(priorityActionLead).label} · {getActionReason(priorityActionLead)} · 💰 שווה {formatMoney(priorityActionLead.value)} אם תסגור היום
              </p>
            </div>
            {priorityActionLead.phone ? (
              <a className="button-primary min-h-12 w-full shrink-0 px-7 sm:w-auto" href={`tel:${priorityActionLead.phone}`} onClick={markUserAction}>
                בצע עכשיו
              </a>
            ) : (
              <Link className="button-primary min-h-12 w-full shrink-0 px-7 sm:w-auto" href="/leads" onClick={markUserAction}>
                בצע עכשיו
              </Link>
            )}
          </div>
        </section>
      ) : null}

      {showIdleWarning ? (
        <div className="mx-auto max-w-4xl rounded-2xl border border-danger/30 bg-danger/10 p-4 text-center text-sm font-semibold text-red-100 shadow-[0_0_28px_rgba(229,72,77,0.10)]">
          ⚠ לא בוצעה פעולה ב־15 דקות · 👉 בחר ליד והתקדם
        </div>
      ) : null}

      <section className="relative mx-auto my-6 max-w-[760px] overflow-hidden rounded-[30px] border border-gold/25 bg-[linear-gradient(145deg,rgba(8,8,8,0.96),rgba(21,17,8,0.88))] p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,0.42),0_0_52px_rgba(201,162,39,0.13)] sm:my-10 sm:p-6">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-gold-soft">Daily Closing Pressure Bar</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">התקדמות לסגירת היעד היומי</h2>
        <div className="mx-auto mt-4 flex w-full max-w-md flex-col items-center justify-center gap-3 rounded-2xl border border-gold/25 bg-gold/10 px-4 py-3 shadow-[0_0_28px_rgba(201,162,39,0.12)] sm:flex-row">
          <p className="text-base font-semibold text-white">יעד יומי: {formatMoney(dailyTarget)}</p>
          <button
            className="button-primary min-h-10 px-4 py-2 text-sm"
            onClick={() => {
              setTargetDraft(String(dailyTarget));
              setTargetModalOpen(true);
            }}
            type="button"
          >
            ✏️ שנה יעד
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-gold/15 bg-black/35 p-3">
            <p className="text-xs text-zinc-500">יעד יומי</p>
            <p className="mt-1 text-lg font-semibold text-white">{formatMoney(dailyTarget)}</p>
          </div>
          <div className="rounded-2xl border border-gold/35 bg-gold/10 p-3 shadow-[0_0_24px_rgba(201,162,39,0.12)]">
            <p className="text-xs text-gold-soft">נסגר היום</p>
            <p className="mt-1 text-xl font-semibold text-white">{formatMoney(closedTodayRevenue)}</p>
          </div>
          <div className="rounded-2xl border border-danger/30 bg-danger/10 p-3 shadow-[0_0_24px_rgba(229,72,77,0.10)]">
            <p className="text-xs text-red-200">חסר ליעד היומי</p>
            <p className="mt-1 text-xl font-semibold text-white">{formatMoney(dailyGap)}</p>
          </div>
          <div className="rounded-2xl border border-gold/20 bg-gold/10 p-3">
            <p className="text-xs text-gold-soft">פוטנציאל פתוח</p>
            <p className="mt-1 text-lg font-semibold text-white">{formatMoney(metrics.dailyRevenuePotential)}</p>
          </div>
        </div>

        <div className="mt-5 h-5 overflow-hidden rounded-full bg-zinc-950 ring-1 ring-white/10">
          <div
            className="relative h-full rounded-full bg-gradient-to-l from-gold-soft via-gold to-gold shadow-[0_0_24px_rgba(201,162,39,0.38)] transition-all duration-700 ease-out after:absolute after:left-0 after:top-1/2 after:h-7 after:w-7 after:-translate-y-1/2 after:rounded-full after:bg-gold-soft after:blur-md after:content-['']"
            style={{ width: `${dailyProgress}%` }}
          />
        </div>
        <p className="mt-3 text-sm font-semibold text-gold-soft">{dailyProgress}% מהיעד היומי</p>
        <p className="mt-3 text-base font-semibold text-white">
          {dailyTargetReached ? "🔥 היעד היומי נסגר - עבודה חזקה!" : `🔥 עוד ${formatMoney(dailyGap)} לסגירת היעד - בוא נסגור את זה עכשיו`}
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          נסגר היום: {formatMoney(closedTodayRevenue)} · נשאר: {formatMoney(dailyGap)} · {dailyProgress}% התקדמות
        </p>
        <a className="button-primary mx-auto mt-5 w-full sm:w-auto" href="#daily-command-center">
          קח אותי ללידים שיסגרו את זה 🔥
        </a>
        <p className="mt-3 text-xs text-zinc-500">כל פעולה מקרבת אותך לסגירה הבאה.</p>
      </section>

      <section
        className={`relative w-full max-w-full overflow-hidden rounded-[32px] border border-gold/25 bg-[radial-gradient(circle_at_top_right,rgba(201,162,39,0.24),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.025))] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.44)] sm:p-7 ${focusMode ? "min-h-[100dvh] lg:min-h-[calc(100vh-3rem)]" : ""}`}
        id="daily-command-center"
      >
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-l from-transparent via-gold/70 to-transparent" />
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gold-soft">
            {focusMode ? "Focused Execution" : "Sales Command Center"}
          </p>
          <h2 className="mt-3 text-[clamp(1.9rem,8vw,3rem)] font-semibold tracking-tight sm:text-5xl">
            {focusMode ? "מצב סגירה 🔥" : "מערכת סגירה יומית 🔥"}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">
            סדר עבודה יומי לפי כסף, דחיפות ושלבי מכירה.
          </p>

          <div className="mx-auto mt-6 max-w-[520px] rounded-[28px] border border-gold/20 bg-black/35 p-4 shadow-[0_0_45px_rgba(201,162,39,0.10)]">
            <label className="sr-only" htmlFor="daily-target">
              יעד יומי
            </label>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-xs text-zinc-500">יעד יומי</p>
                <p className="mt-1 text-lg font-semibold text-white">{formatMoney(dailyTarget)}</p>
              </div>
              <div className="rounded-2xl border border-gold/20 bg-gold/10 p-3">
                <p className="text-xs text-gold-soft">פוטנציאל היום</p>
                <p className="mt-1 text-lg font-semibold text-white">{formatMoney(metrics.dailyRevenuePotential)}</p>
              </div>
              <div className="rounded-2xl border border-gold/25 bg-gold/10 p-3">
                <p className="text-xs text-gold-soft">נסגר היום</p>
                <p className="mt-1 text-lg font-semibold text-white">{formatMoney(closedTodayRevenue)}</p>
              </div>
              <div className="rounded-2xl border border-danger/20 bg-danger/10 p-3">
                <p className="text-xs text-red-200">פער ליעד</p>
                <p className="mt-1 text-lg font-semibold text-white">{formatMoney(Math.max(0, dailyTarget - closedTodayRevenue))}</p>
              </div>
            </div>
            <button
              className={`${focusMode ? "button-secondary" : "button-primary"} mt-4 w-full`}
              onClick={() => setFocusMode((current) => !current)}
              type="button"
            >
              {focusMode ? "יציאה ממצב סגירה" : "🔥 מצב סגירה"}
            </button>
          </div>
        </div>

        {nextActionLead ? (
          <div className="mx-auto mt-9 flex w-full max-w-3xl flex-col items-center justify-center gap-5">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gold-soft">Next Best Action</p>
              <h3 className="mt-2 text-[clamp(1.5rem,7vw,2.25rem)] font-semibold tracking-tight sm:text-4xl">🎯 הפעולה הכי חשובה עכשיו</h3>
            </div>
            <div className="number-rise w-full max-w-full rounded-[30px] border border-gold/30 bg-black/35 p-4 text-center shadow-[0_0_60px_rgba(201,162,39,0.14)] sm:p-8">
              <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-6">
                <div className="w-full text-center">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="text-2xl">{getUrgencyIcon(nextActionLead)}</span>
                    <h3 className={`${focusMode ? "text-[clamp(2rem,10vw,3.75rem)] sm:text-6xl" : "text-[clamp(1.5rem,7vw,2rem)] sm:text-3xl"} min-w-0 break-words font-semibold [overflow-wrap:anywhere]`}>{nextActionLead.name}</h3>
                    <span className={`rounded-full border px-3 py-1 text-xs ${getPriority(nextActionLead).className}`}>
                      {getLeadTemperature(nextActionLead).label}
                    </span>
                  </div>
                  <p className={`${focusMode ? "mt-5 text-[clamp(3rem,15vw,5rem)] sm:text-8xl" : "mt-3 text-[clamp(2.25rem,12vw,3.5rem)] sm:text-5xl"} whitespace-nowrap font-semibold tracking-tight text-gold-soft [direction:ltr]`}>
                    {formatMoney(nextActionLead.value)}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-sm ${getLeadStatusColor(nextActionLead.status)}`}>{nextActionLead.status}</span>
                    <span className={`rounded-full border px-3 py-1 text-sm ${getPriority(nextActionLead).className}`}>{getPriority(nextActionLead).label}</span>
                    <span className="rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-sm text-gold-soft">ציון {getDailyPriorityScore(nextActionLead)}</span>
                  </div>
                  <div className="mx-auto mt-6 grid w-full max-w-2xl gap-3 text-center text-sm sm:grid-cols-2">
                    <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-zinc-300">
                      טלפון: <strong className="text-white">{nextActionLead.phone || "אין טלפון"}</strong>
                    </p>
                    <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-zinc-300">
                      קשר אחרון: <strong className="text-white">{formatDate(nextActionLead.last_contact_date)}</strong>
                    </p>
                    <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-zinc-300">
                      פעולה הבאה: <strong className="text-white">{formatDate(nextActionLead.next_action_date)}</strong>
                    </p>
                    <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-zinc-300">
                      תור: <strong className="text-white">{closingQueue.length} נשארו</strong>
                    </p>
                  </div>
                </div>
                <div className="w-full rounded-3xl border border-gold/20 bg-gold/10 p-5 text-center">
                  <p className="text-sm font-semibold text-gold-soft">למה עכשיו:</p>
                  <p className="mt-2 text-lg leading-7 text-white">{getDailyReason(nextActionLead)}</p>
                  <p className="mt-4 rounded-2xl border border-gold/25 bg-gold/10 p-4 text-xl font-semibold text-gold-soft">
                    👉 פעולה מומלצת: {getRecommendedAction(nextActionLead)}
                  </p>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs font-semibold text-zinc-500">הודעה מומלצת</p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-200">{getScriptSuggestion(nextActionLead)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full rounded-[28px] border border-white/10 bg-black/30 p-4">
              <div className="mb-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xl font-semibold text-gold-soft">{handledToday}</p>
                  <p className="mt-1 text-xs text-zinc-500">טיפלת</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xl font-semibold text-gold-soft">{formatMoney(closedTodayRevenue)}</p>
                  <p className="mt-1 text-xs text-zinc-500">נסגר</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xl font-semibold text-gold-soft">{completedInteractions}</p>
                  <p className="mt-1 text-xs text-zinc-500">שיחות/הודעות</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xl font-semibold text-gold-soft">{formatMoney(remainingPotential)}</p>
                  <p className="mt-1 text-xs text-zinc-500">פוטנציאל נשאר</p>
                </div>
              </div>
              <div className="mx-auto grid w-full max-w-2xl gap-3 sm:grid-cols-2">
              {nextActionLead.phone ? (
                <a
                  className="button-secondary min-h-14 gap-2 px-5 py-3 text-base"
                  href={`tel:${nextActionLead.phone}`}
                  onClick={() => {
                    markUserAction();
                    setCompletedInteractions((current) => current + 1);
                  }}
                >
                  📞 להתקשר
                </a>
              ) : (
                <Link className="button-primary min-h-14 text-base" href="/leads">
                  👉 בצע עכשיו
                </Link>
              )}
              {nextActionLead.phone ? (
                <a
                  className="button-secondary min-h-14 gap-2 px-5 py-3 text-base"
                  href={getWhatsappUrl(nextActionLead.phone, `היי ${nextActionLead.name}, רציתי לבדוק איך נכון להתקדם מכאן.`)}
                  onClick={() => {
                    markUserAction();
                    setCompletedInteractions((current) => current + 1);
                  }}
                  rel="noreferrer"
                  target="_blank"
                >
                  💬 שלח הודעה
                </a>
              ) : null}
              <button className="button-secondary min-h-12" disabled={updatingLeadId === nextActionLead.id} onClick={() => handleLeadHandled(nextActionLead.id)} title="סימנתי שטיפלתי בליד והתקדמתי לשלב הבא" type="button">
                ✔ טיפלתי
              </button>
              <button className="button-secondary min-h-12" disabled={updatingLeadId === nextActionLead.id} onClick={() => handlePostponeToTomorrow(nextActionLead.id)} title="הליד יחזור לטיפול מחר" type="button">
                ⏩ מחר
              </button>
              <button className="button-primary col-span-1 mx-auto min-h-14 w-full max-w-md px-7 text-base shadow-[0_0_34px_rgba(201,162,39,0.34)] sm:col-span-2" onClick={() => closeDeal(nextActionLead)} type="button">
                💰 נסגר
              </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-gold/20 bg-zinc-950/95 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur md:hidden">
              {nextActionLead.phone ? (
                <a className="button-secondary min-h-14 text-base" href={`tel:${nextActionLead.phone}`} onClick={markUserAction}>
                  📞 להתקשר
                </a>
              ) : null}
              {nextActionLead.phone ? (
                <a
                  className="button-secondary min-h-14 text-base"
                  href={getWhatsappUrl(nextActionLead.phone, getScriptSuggestion(nextActionLead))}
                  onClick={markUserAction}
                  rel="noreferrer"
                  target="_blank"
                >
                  💬 שלח הודעה
                </a>
              ) : null}
              <button className="button-secondary min-h-12" disabled={updatingLeadId === nextActionLead.id} onClick={() => handleLeadHandled(nextActionLead.id)} title="סימנתי שטיפלתי בליד והתקדמתי לשלב הבא" type="button">
                ✔ טיפלתי
              </button>
              <button className="button-secondary min-h-12" disabled={updatingLeadId === nextActionLead.id} onClick={() => handlePostponeToTomorrow(nextActionLead.id)} title="הליד יחזור לטיפול מחר" type="button">
                ⏩ מחר
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-auto mt-10 max-w-xl rounded-[30px] border border-gold/25 bg-black/35 p-8 text-center shadow-[0_0_55px_rgba(201,162,39,0.12)]">
            <p className="text-4xl">🔥</p>
            <h3 className="mt-4 text-3xl font-semibold">סיימת את כל הפעולות להיום</h3>
            <p className="mt-3 text-sm text-zinc-400">אפשר לחזור לדאשבורד, להוסיף ליד חדש או להכין משימות למחר.</p>
            <button className="button-primary mt-6" onClick={backToDashboard} type="button">
              חזרה לדאשבורד
            </button>
          </div>
        )}
      </section>

      {!focusMode ? (
        <>
      <section className="relative w-full max-w-full overflow-hidden rounded-[30px] border border-gold/20 bg-[radial-gradient(circle_at_top_right,rgba(201,162,39,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.10),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.42)] sm:p-7">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gold-soft">Daily Closing Board</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">לוח סגירה יומי</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
            המערכת שמראה לך בדיוק על מי לעבוד עכשיו כדי לייצר הכנסה היום
            <br />
            בלי לנחש, בלי להתפזר - רק פעולות שמביאות כסף
          </p>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-4">
          {[
            {
              key: "actionToday",
              label: "🔥 לידים לטיפול היום",
              microcopy: "לידים חדשים שצריך לפעול עליהם עכשיו",
              tone: "border-gold/35 bg-[radial-gradient(circle_at_top_right,rgba(201,162,39,0.18),rgba(255,255,255,0.035)_46%,rgba(0,0,0,0.12))] shadow-[0_0_34px_rgba(201,162,39,0.12)]",
              leads: metrics.dailyClosing.actionToday,
            },
            {
              key: "scheduleCall",
              label: "📞 לקבוע שיחה",
              microcopy: "לידים שצריך לקדם לשיחה",
              tone: "border-process/25 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),rgba(255,255,255,0.025)_48%,rgba(0,0,0,0.10))] shadow-[0_0_30px_rgba(59,130,246,0.08)]",
              leads: metrics.dailyClosing.scheduleCall,
            },
            {
              key: "close",
              label: "🔥 כאן הכסף שלך",
              microcopy: "לידים חמים - כאן הכסף נמצא",
              tone: "border-gold/60 bg-[radial-gradient(circle_at_top_right,rgba(201,162,39,0.34),rgba(201,162,39,0.12)_42%,rgba(0,0,0,0.16))] shadow-[0_0_68px_rgba(201,162,39,0.28)] xl:scale-[1.05]",
              leads: metrics.dailyClosing.close,
            },
            {
              key: "followUp",
              label: "♻️ לידים להמשך טיפול",
              microcopy: "לידים שלא התקדמו וצריך להחזיר לפעולה",
              tone: "border-danger/30 bg-[radial-gradient(circle_at_top_right,rgba(229,72,77,0.16),rgba(255,255,255,0.025)_48%,rgba(0,0,0,0.12))] shadow-[0_0_34px_rgba(229,72,77,0.10)]",
              leads: metrics.dailyClosing.followUp,
            },
          ].map((group) => (
            <div className={`w-full max-w-full rounded-[24px] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(0,0,0,0.24),0_0_38px_rgba(201,162,39,0.12)] ${group.tone}`} key={group.key}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{group.label}</h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">{group.microcopy}</p>
                </div>
                <span className="shrink-0 rounded-full border border-gold/20 bg-black/35 px-3 py-1 text-xs font-bold text-gold-soft shadow-[0_0_18px_rgba(201,162,39,0.10)]">
                  {group.leads.length}
                </span>
              </div>
              {group.leads.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-3 text-sm leading-6 text-zinc-500">אין פעולות בקבוצה הזו.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {group.leads.map((lead) => {
                    const expanded = expandedDailyLeadId === lead.id;

                    return (
                      <article
                        className={`rounded-2xl border border-white/[0.07] bg-black/20 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-gold/25 hover:bg-white/[0.04] hover:shadow-[0_18px_42px_rgba(0,0,0,0.20),0_0_24px_rgba(201,162,39,0.08)] ${expanded ? "bg-black/35" : ""}`}
                        key={lead.id}
                      >
                        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold">{lead.name}</p>
                              <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[10px] text-gold-soft">
                                {getDailyPriorityScore(lead)}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-[11px] text-zinc-500">
                              קשר: {getDaysSinceActivity(lead) >= 999 ? "אין תיעוד" : `לפני ${getDaysSinceActivity(lead)} ימים`} · {normalizeLeadStatus(lead.status)}
                            </p>
                            <p className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] ${getUrgencyState(lead).className}`}>
                              {getUrgencyState(lead).label}
                            </p>
                            <p className="mt-1 text-[11px] font-medium text-gold-soft">
                              💰 שווה {formatMoney(lead.value)} אם תסגור היום
                            </p>
                            {group.key === "followUp" ? (
                              <p className="mt-1 text-[11px] font-medium text-red-200">
                                🔥 עברו {getDaysSinceActivity(lead) >= 999 ? "כמה" : getDaysSinceActivity(lead)} ימים מאז קשר אחרון
                              </p>
                            ) : null}
                          </div>
                          <p className="shrink-0 whitespace-nowrap text-lg font-black leading-none text-gold-soft drop-shadow-[0_0_16px_rgba(201,162,39,0.18)] sm:text-xl">{formatMoney(lead.value)}</p>
                        </div>

                        <div className="mt-3 flex max-w-full flex-wrap gap-2">
                          {lead.phone ? (
                            <a className="button-secondary min-h-9 min-w-[64px] flex-1 px-2 py-1.5 text-xs active:scale-[0.97]" href={`tel:${lead.phone}`} onClick={markUserAction}>
                              שיחה
                            </a>
                          ) : (
                            <span className="button-secondary min-h-9 min-w-[64px] flex-1 cursor-not-allowed px-2 py-1.5 text-xs opacity-50">שיחה</span>
                          )}
                          <a
                            className="button-secondary min-h-9 w-10 flex-none px-2 py-1.5 text-xs active:scale-[0.97]"
                            href={getWhatsappUrl(lead.phone, `היי ${lead.name}, רציתי לבדוק איך אפשר להתקדם.`)}
                            onClick={markUserAction}
                            rel="noreferrer"
                            target="_blank"
                          >
                            💬
                          </a>
                          <button className="button-secondary min-h-9 min-w-[72px] flex-1 px-2 py-1.5 text-xs active:scale-[0.97]" disabled={updatingLeadId === lead.id} onClick={() => handleLeadHandled(lead.id)} title="סימנתי שטיפלתי בליד והתקדמתי לשלב הבא" type="button">
                            ✔ טיפלתי
                          </button>
                          <button className="button-secondary min-h-9 min-w-[82px] flex-1 px-2 py-1.5 text-xs active:scale-[0.97]" disabled={updatingLeadId === lead.id} onClick={() => handleLeadHandled(lead.id)} type="button">
                            קבע שיחה
                          </button>
                          <button
                            className="min-h-9 min-w-[58px] flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] text-zinc-300 transition duration-200 hover:border-gold/30 hover:text-gold-soft active:scale-[0.97]"
                            onClick={() => setExpandedDailyLeadId((current) => (current === lead.id ? null : lead.id))}
                            type="button"
                          >
                            פרטים
                          </button>
                        </div>

                        {expanded ? (
                          <div className="number-rise mt-2 rounded-xl border border-white/10 bg-black/25 p-3 text-xs leading-5 text-zinc-400">
                            <p>{getUrgencyIcon(lead)} {getDailyReason(lead)}</p>
                            <p className="mt-1 text-gold-soft">פעולה מומלצת: {getRecommendedAction(lead)}</p>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <button className="button-secondary min-h-9 px-2 py-1.5 text-xs active:scale-[0.97]" disabled={updatingLeadId === lead.id} onClick={() => handlePostponeToTomorrow(lead.id)} title="הליד יחזור לטיפול מחר" type="button">
                                ⏩ מחר
                              </button>
                              <button className="button-primary col-span-2 mx-auto min-h-10 w-full max-w-[220px] px-4 py-2 text-xs shadow-[0_0_28px_rgba(201,162,39,0.30)] active:scale-[0.97]" onClick={() => closeDeal(lead)} type="button">
                                סגור עסקה
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(201,162,39,0.10),rgba(0,0,0,0.28)_48%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <h3 className="font-semibold">צ׳קליסט ביצוע יומי</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {["התקשרתי ללידים חמים", "שלחתי הודעות מעקב", "החזרתי לידים ישנים", "עדכנתי סטטוסים"].map((item) => (
              <label className={`flex cursor-pointer items-center gap-3 rounded-full border px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-gold/35 hover:shadow-[0_0_24px_rgba(201,162,39,0.10)] active:scale-[0.98] ${checklist[item] ? "border-gold/35 bg-gold/10 text-gold-soft" : "border-white/10 bg-white/[0.04] text-zinc-200"}`} key={item}>
                <input
                  checked={Boolean(checklist[item])}
                  className="h-4 w-4 accent-[#c9a227]"
                  onChange={(event) => setChecklist((current) => ({ ...current, [item]: event.target.checked }))}
                  type="checkbox"
                />
                <span className={checklist[item] ? "text-gold-soft line-through decoration-gold/50" : "text-zinc-200"}>{item}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        {[
          {
            accent: "from-success/20 to-gold/5",
            icon: Activity,
            label: "לידים פעילים",
            meta: "לידים שעוד דורשים עבודה היום",
            rawValue: metrics.active,
            sublabel: metrics.active > 0 ? "יש תנועה במסלול המכירה" : "אין לידים פעילים",
            tone: "text-gold",
            value: metrics.active,
          },
          {
            accent: "from-gold/20 to-gold-soft/5",
            icon: BadgeDollarSign,
            label: "פוטנציאל הכנסות",
            meta: "שווי כולל של כל מסלול המכירה",
            rawValue: metrics.totalValue,
            sublabel: metrics.totalValue > 0 ? "הכסף שנמצא במערכת" : "עוד אין מסלול מכירה",
            tone: "text-gold",
            value: formatMoney(metrics.totalValue),
          },
          {
            accent: "from-success/20 to-gold/5",
            icon: Target,
            label: "הכנסה השבוע",
            meta: "פגישות והצעות מחיר שאפשר לסגור",
            rawValue: metrics.closableRevenue,
            sublabel: metrics.closableRevenue > 0 ? "קרוב לסגירה" : "צריך לקדם לפגישה",
            tone: "text-gold",
            value: formatMoney(metrics.closableRevenue),
          },
          {
            accent: "from-gold/20 to-gold-soft/5",
            icon: BadgeDollarSign,
            label: "הכנסה חודשית",
            meta: "עסקאות שנסגרו החודש",
            rawValue: metrics.monthlyRevenue,
            sublabel: `${metrics.monthlyClosedCount} עסקאות שנסגרו החודש`,
            tone: "text-gold",
            value: formatMoney(metrics.monthlyRevenue),
          },
          {
            accent: metrics.moneyAtRisk > 0 ? "from-danger/20 to-danger/5" : "from-success/15 to-gold/5",
            icon: AlertTriangle,
            label: "כסף בסיכון",
            meta: "שווי לידים בלי פעילות מעל 3 ימים",
            rawValue: metrics.moneyAtRisk,
            sublabel: metrics.moneyAtRisk > 0 ? "דורש פעולה עכשיו" : "אין סיכון חריג",
            tone: metrics.moneyAtRisk > 0 ? "text-red-200" : "text-green-100",
            value: formatMoney(metrics.moneyAtRisk),
          },
        ].map(({ accent, icon: Icon, label, meta, rawValue, sublabel, tone, value }) => (
          <article
            className={`panel group relative flex min-h-[230px] flex-col justify-between overflow-visible bg-gradient-to-br ${accent} p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] transition duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:border-gold/35 hover:shadow-[0_30px_90px_rgba(0,0,0,0.36),0_0_42px_rgba(201,162,39,0.18)] ${rawValue === highestMoneyKpi && rawValue > 0 ? "border-gold/45 shadow-[0_28px_90px_rgba(0,0,0,0.34),0_0_46px_rgba(201,162,39,0.20)]" : ""}`}
            key={label}
          >
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent opacity-0 transition group-hover:opacity-100" />
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition duration-200 group-hover:border-gold/30 group-hover:bg-gold/10">
                  <Icon className={`h-5 w-5 ${tone}`} />
                </span>
                <p className="text-xs font-bold uppercase leading-none tracking-[0.16em] text-zinc-400">{label}</p>
              </div>
              <p className="mt-3 min-h-8 text-xs leading-4 text-zinc-500">{sublabel}</p>
            </div>
            <div className="mt-6 min-w-0 max-w-full overflow-visible px-1 text-center">
              <p className="number-rise block max-w-full whitespace-nowrap text-center text-[clamp(1.75rem,3.1vw,3rem)] font-black leading-[1.05] tracking-[-0.03em] text-white drop-shadow-[0_0_18px_rgba(201,162,39,0.12)] [direction:ltr]">{value}</p>
              <p className="mt-4 min-h-10 text-xs leading-5 text-zinc-500">{meta}</p>
            </div>
          </article>
        ))}
      </div>

      <section className="panel border-white/[0.08] bg-white/[0.035] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_28px_90px_rgba(201,162,39,0.08)] sm:p-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-danger/20 bg-danger/10 text-red-100">
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-white">🔥 לידים לטיפול היום</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400/80">פעולה שתוכננה להיום או לידים בלי קשר ב-2-3 הימים האחרונים.</p>
            </div>
          </div>
          <span className="rounded-full border border-danger/30 bg-danger/10 px-4 py-1.5 text-sm font-medium text-red-100 shadow-[0_0_24px_rgba(229,72,77,0.10)]">
            {metrics.actionLeads.length} לטיפול
          </span>
        </div>

        {metrics.actionLeads.length === 0 ? (
          <div className="mt-7 flex min-h-[180px] w-full flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 py-8 text-center opacity-80 transition duration-200 sm:px-8">
            <Bell className="mb-4 h-5 w-5 text-zinc-500" />
            <p className="mx-auto max-w-[400px] text-sm leading-7 text-zinc-400">
              אין לידים דחופים כרגע. מצוין - אפשר להתמקד בקידום הפגישות וההצעות.
            </p>
          </div>
        ) : (
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            {metrics.actionLeads.map((lead) => {
              const days = getDaysSinceActivity(lead);
              const urgent = getHoursSinceActivity(lead) >= 72 || !lead.last_contact_date;
              const isStuck = days >= STUCK_AFTER_DAYS;
              const priority = getPriority(lead);
              const temperature = getLeadTemperature(lead);
              const selected = focusedLeadId === lead.id;
              const highValue = (lead.value || 0) >= 10000;

              return (
                <article
                  className={`group rounded-2xl border p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_32px_rgba(201,162,39,0.10)] ${
                    selected
                      ? "border-gold/60 bg-gold/10 shadow-[0_0_45px_rgba(201,162,39,0.20)]"
                      : urgent
                      ? "border-danger/25 bg-danger/[0.075] hover:border-danger/45"
                      : "border-gold/20 bg-glass hover:border-gold/40"
                  }`}
                  key={lead.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <Link className="min-w-0 flex-1 rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-gold/50" href="/leads">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-semibold transition group-hover:text-gold-soft">{lead.name}</h4>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${temperature.color}`}>
                          {temperature.label} · {temperature.score}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${priority.className}`}>
                          Priority: {priority.short}
                        </span>
                        {isStuck ? (
                          <span className="rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-xs text-red-200">
                            תקוע
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            urgent ? "border-danger/40 bg-danger/10 text-red-200" : "border-gold/30 bg-gold/10 text-gold-soft"
                          }`}
                        >
                          {urgent ? "דחוף" : "בינוני"}
                        </span>
                        {highValue ? (
                          <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs text-gold-soft">
                            שווי גבוה
                          </span>
                        ) : null}
                        {!lead.last_contact_date ? (
                          <span className="rounded-full border border-zinc-400/30 bg-white/10 px-2 py-0.5 text-xs text-zinc-200">
                            אין קשר אחרון
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-zinc-300">{lead.phone || "אין טלפון"}</p>
                      <p className={days > 2 ? "mt-2 text-sm text-red-100" : "mt-2 text-sm text-zinc-400"}>
                        קשר אחרון: {formatDate(lead.last_contact_date)} · {days >= 999 ? "אין תיעוד" : days > 0 ? `לפני ${days} ימים` : "היום"}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        פעולה הבאה: {lead.next_action_date ? `${getNextActionLabel(lead.next_action_type)} · ${formatDate(lead.next_action_date)}` : "לא נקבעה"}
                      </p>
                      <p className="mt-2 inline-flex rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-300">
                        Needs action: {getActionReason(lead)}
                      </p>
                    </Link>
                    <span className={`rounded-full border px-3 py-1 text-xs ${getLeadStatusColor(lead.status)}`}>
                      {normalizeLeadStatus(lead.status)}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {lead.phone ? (
                      <a className="button-secondary gap-2 px-5 py-3.5 text-sm sm:text-base" href={`tel:${lead.phone}`}>
                        📞 להתקשר
                      </a>
                    ) : null}
                    {lead.phone ? (
                      <a
                        className="button-secondary gap-2 px-5 py-3.5 text-sm sm:text-base"
                        href={getWhatsappUrl(lead.phone, `היי ${lead.name}, רציתי לבדוק איך אפשר להתקדם מכאן.`)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        💬 שלח הודעה
                      </a>
                    ) : null}
                    <Link className="button-secondary px-5 py-3.5 text-sm sm:text-base" href="/leads">
                      עדכון ליד
                    </Link>
                    <Link className="button-secondary gap-2 px-5 py-3.5 text-sm sm:text-base" href="/tasks">
                      <Bell className="h-4 w-4" />
                      מעקב
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="card-danger p-6 sm:p-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-danger/20 bg-danger/10 text-red-100">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-white">🔥 לידים להחזרה</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400/80">לידים שלא נסגרו ונכנסו למעקב החזרה, מסודרים לפי שווי וחוסר פעילות.</p>
            </div>
          </div>
          <span className="rounded-full border border-danger/30 bg-danger/10 px-4 py-1.5 text-sm font-medium text-red-100 shadow-[0_0_24px_rgba(229,72,77,0.10)]">
            {formatMoney(metrics.recoverableMoney)}
          </span>
        </div>

        {metrics.reactivationLeads.length === 0 ? (
          <div className="mt-7 flex min-h-[180px] w-full flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 py-8 text-center opacity-80 transition duration-200 sm:px-8">
            <AlertTriangle className="mb-4 h-5 w-5 text-zinc-500" />
            <p className="mx-auto max-w-[400px] text-sm leading-7 text-zinc-400">
              אין כרגע לידים להחזרה. כשLead לא מתקדם או פעולה עוברת ללא עדכון, הוא יופיע כאן אוטומטית.
            </p>
          </div>
        ) : (
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            {metrics.reactivationLeads.slice(0, 6).map((lead, index) => {
              const message = REACTIVATION_MESSAGES[index % REACTIVATION_MESSAGES.length];

              return (
                <article
                  className="animate-pulse rounded-2xl border border-danger/25 bg-danger/[0.045] p-5 shadow-[0_0_30px_rgba(229,72,77,0.08)] transition duration-200 hover:-translate-y-0.5 hover:border-danger/45 hover:shadow-[0_0_32px_rgba(229,72,77,0.16)]"
                  key={lead.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold">{lead.name}</h4>
                        <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs text-gold-soft">
                          ציון החזרה {getReactivationScore(lead)}
                        </span>
                        <span className="rounded-full border border-danger/35 bg-danger/10 px-2 py-0.5 text-xs text-red-100">
                          דורש החזרה
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-300">{lead.phone || "אין טלפון"}</p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-red-100 drop-shadow-[0_0_18px_rgba(229,72,77,0.18)]">{formatMoney(lead.value)}</p>
                      <p className="mt-1 text-xs text-red-200">
                        {getRescueActivityLabel(lead)}
                      </p>
                      <p className="mt-1 text-xs text-red-200/80">
                        {getRescueActionLabel(lead)}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs ${getLeadStatusColor(lead.status)}`}>
                      {lead.status}
                    </span>
                  </div>

                  <p className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-sm leading-6 text-zinc-200">
                    {message}
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <a className="button-secondary px-4 py-3.5" href={getWhatsappUrl(lead.phone, message)} rel="noreferrer" target="_blank">
                      💬 שלח הודעה
                    </a>
                    {lead.phone ? (
                      <a className="button-secondary px-4 py-3.5" href={`tel:${lead.phone}`}>
                        📞 להתקשר
                      </a>
                    ) : null}
                    <button className="button-primary px-4 py-3.5" disabled={updatingLeadId === lead.id} onClick={() => returnToPipeline(lead)} type="button">
                      🔥 החזר לליד
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel flex h-full flex-col border-white/[0.08] bg-white/[0.035] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_28px_90px_rgba(201,162,39,0.08)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-md">
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-2xl border border-gold/20 bg-gold/10 text-gold-soft">
                <BadgeDollarSign className="h-4 w-4" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-white">💰 פוטנציאל סגירה השבוע</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400/80">לידים בשלבי פגישה או הצעת מחיר, מסודרים לפי שווי.</p>
            </div>
            <span className="rounded-2xl border border-gold/25 bg-gold/10 px-4 py-2 text-2xl font-semibold tracking-tight text-gold-soft shadow-[0_0_26px_rgba(201,162,39,0.12)]">
              {formatMoney(metrics.closableRevenue)}
            </span>
          </div>

          {metrics.closeableLeads.length === 0 ? (
            <div className="mt-6 flex min-h-[150px] flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 py-8 text-center opacity-80">
              <BadgeDollarSign className="mb-4 h-5 w-5 text-zinc-500" />
              <p className="mx-auto max-w-[400px] text-sm leading-7 text-zinc-400">
                אין כרגע כסף בשלבי סגירה. המיקוד הבא הוא לקדם לידים לפגישה.
              </p>
            </div>
          ) : (
            <div className="mt-6 flex-1 space-y-3">
              {metrics.closeableLeads.map((lead) => (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-gold/25 hover:bg-white/[0.055]" key={lead.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{lead.name}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${getLeadTemperature(lead).color}`}>
                          {getLeadTemperature(lead).label} · {getLeadTemperature(lead).score}
                        </span>
                      </div>
                      <p className={getDaysSinceActivity(lead) > 2 ? "mt-1 text-xs text-red-200" : "mt-1 text-xs text-zinc-500"}>
                        {lead.status} · קשר אחרון {getDaysSinceActivity(lead) >= 999 ? "לא תועד" : `לפני ${getDaysSinceActivity(lead)} ימים`}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        פעולה הבאה: {lead.next_action_date ? `${getNextActionLabel(lead.next_action_type)} · ${formatDate(lead.next_action_date)}` : "לא נקבעה"}
                      </p>
                    </div>
                    <p className="text-xl font-semibold tracking-tight text-gold-soft drop-shadow-[0_0_16px_rgba(201,162,39,0.14)]">{formatMoney(lead.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel flex h-full flex-col border-white/[0.08] bg-white/[0.035] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_28px_90px_rgba(248,113,113,0.07)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-md">
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-2xl border border-danger/20 bg-danger/10 text-red-200">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-white">אינדיקטור לידים תקועים</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400/80">לידים שלא עודכנו לפחות {STUCK_AFTER_DAYS} ימים.</p>
            </div>
            <span className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-2 text-2xl font-semibold tracking-tight text-red-100 shadow-[0_0_26px_rgba(229,72,77,0.10)]">
              {metrics.stuckLeads.length} תקועים
            </span>
          </div>

          {metrics.stuckLeads.length === 0 ? (
            <div className="mt-6 flex min-h-[150px] flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 py-8 text-center opacity-80">
              <Activity className="mb-4 h-5 w-5 text-zinc-500" />
              <p className="mx-auto max-w-[400px] text-sm leading-7 text-zinc-400">
                אין לידים תקועים כרגע.
              </p>
            </div>
          ) : (
            <div className="mt-6 flex-1 space-y-3">
              {metrics.stuckLeads.slice(0, 5).map((lead) => (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-danger/25 hover:bg-danger/[0.045]" key={lead.id}>
                  <div>
                    <p className="font-medium">{lead.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {lead.status} · {getDaysSinceActivity(lead)} ימים ללא עדכון
                    </p>
                  </div>
                  <span className="rounded-full border border-danger/40 bg-danger/10 px-2 py-1 text-xs text-red-200">
                    תקוע
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel border-white/[0.08] bg-white/[0.035] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_28px_90px_rgba(201,162,39,0.08)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-2xl border border-gold/20 bg-gold/10 text-gold-soft">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h3 className="text-2xl font-semibold tracking-tight text-white">שווי לפי שלב מכירה</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400/80">תמונה רחבה של איפה הכסף נמצא ומה צריך לקבל תשומת לב.</p>
          </div>
          <div className="rounded-3xl border border-gold/25 bg-gold/10 px-5 py-4 text-left shadow-[0_0_30px_rgba(201,162,39,0.12)]">
            <p className="text-xs text-gold-soft/90">סה״כ מסלול המכירה</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-white drop-shadow-[0_0_18px_rgba(201,162,39,0.16)]">{formatMoney(metrics.totalValue)}</p>
          </div>
        </div>

        {metrics.total === 0 ? (
          <div className="mt-7 flex min-h-[180px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 py-8 text-center opacity-80">
            <TrendingUp className="mb-4 h-5 w-5 text-zinc-500" />
            <p className="mx-auto max-w-[400px] text-sm leading-7 text-zinc-400">
              עדיין אין לידים. אחרי הוספת ליד ראשון, המדדים והשווי לפי שלבים יתעדכנו כאן אוטומטית.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            {metrics.valueByStage.map((stage) => {
              const width = metrics.totalValue ? Math.max(5, Math.round((stage.totalValue / metrics.totalValue) * 100)) : 0;
              const percent = metrics.totalValue ? Math.round((stage.totalValue / metrics.totalValue) * 100) : 0;
              const activeStage = stage.totalValue > 0 || stage.count > 0;
              const highestStageValue = Math.max(...metrics.valueByStage.map((item) => item.totalValue));
              const highValue = stage.totalValue === highestStageValue && stage.totalValue > 0;

              return (
                <div
                  className={`grid gap-3 rounded-2xl border px-3 py-2.5 transition duration-200 sm:grid-cols-[minmax(150px,1.1fr)_minmax(100px,auto)_72px_64px_minmax(180px,1.4fr)] sm:items-center sm:gap-4 ${
                    highValue
                      ? "scale-[1.01] border-gold/45 bg-gold/[0.075] shadow-[0_0_34px_rgba(201,162,39,0.18)] hover:border-gold/60"
                      : activeStage
                        ? "border-gold/15 bg-gold/[0.025] hover:border-gold/30 hover:bg-gold/[0.04]"
                        : "border-white/10 bg-black/20 opacity-75 hover:border-white/15 hover:opacity-100"
                  }`}
                  key={stage.value}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`truncate rounded-full border px-2.5 py-1 text-xs font-medium ${getLeadStatusColor(stage.value)}`}>
                      {stage.label}
                    </span>
                    {highValue ? (
                      <span className="shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[11px] text-gold-soft">
                        מוביל
                      </span>
                    ) : null}
                  </div>
                  <p className={highValue ? "text-xl font-semibold tracking-tight text-gold-soft" : "text-lg font-semibold tracking-tight text-white"}>
                    {formatMoney(stage.totalValue)}
                  </p>
                  <p className="text-xs text-zinc-400">{stage.count} לידים</p>
                  <p className="text-xs font-medium text-zinc-300">{percent}%</p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/45 ring-1 ring-white/10">
                      <div
                        className={highValue ? "h-full rounded-full bg-gradient-to-l from-gold-soft via-gold to-gold shadow-[0_0_18px_rgba(201,162,39,0.34)] transition-all duration-500" : "h-full rounded-full bg-gradient-to-l from-gold/80 to-gold/60 transition-all duration-500"}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className="hidden whitespace-nowrap text-[11px] text-zinc-500 md:inline">ממוצע {stage.avgDays} ימים</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">משפך המרה</h3>
            <p className="mt-1 text-sm text-zinc-400">מספרים אמיתיים ממסלול המכירה: סה״כ → קשר → פגישות → הצעה.</p>
          </div>
          <BadgeDollarSign className="h-5 w-5 text-gold" />
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-center">
          {[
            ["סה״כ", metrics.total],
            ["נוצר קשר", metrics.contacted],
            ["פגישות", metrics.meetings],
            ["הצעות", metrics.closed],
          ].map(([label, value], index, funnel) => {
            const numericValue = Number(value);
            const highlighted = numericValue > 0 && (index === funnel.length - 1 || numericValue === Math.max(metrics.total, metrics.contacted, metrics.meetings, metrics.closed));

            return (
              <div className="contents" key={label}>
                <div
                  className={`rounded-2xl border p-5 text-center transition duration-200 ${
                    highlighted
                      ? "border-gold/30 bg-gold/10 shadow-[0_0_28px_rgba(201,162,39,0.10)]"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <p className="text-3xl font-semibold tracking-tight">{value}</p>
                  <p className="mt-2 text-sm text-zinc-400">{label}</p>
                </div>
                {index < funnel.length - 1 ? (
                  <div className="hidden text-center text-2xl text-gold/70 lg:block">←</div>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-zinc-400">יחס התקדמות להצעה: {metrics.conversion}%</p>
      </section>
        </>
      ) : null}
    </div>
  );
}
