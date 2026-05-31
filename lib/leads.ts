export const LEAD_STATUSES = [
  { value: "לידים חדשים", label: "לידים חדשים", color: "border-gold/30 bg-gold/10 text-gold-soft" },
  { value: "יצירת קשר", label: "יצירת קשר", color: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300" },
  { value: "בתהליך שיחה", label: "בתהליך שיחה", color: "border-process/30 bg-process/10 text-blue-200" },
  { value: "הצעה נשלחה", label: "הצעה נשלחה", color: "border-process/30 bg-process/10 text-blue-200" },
  { value: "ממתין לתגובה", label: "ממתין לתגובה", color: "border-process/30 bg-process/10 text-blue-200" },
  { value: "דורש המשך טיפול", label: "דורש המשך טיפול", color: "border-danger/30 bg-danger/10 text-red-200" },
  { value: "נסגר בהצלחה", label: "נסגר בהצלחה", color: "border-success/40 bg-success/15 text-green-100" },
  { value: "לא רלוונטי", label: "לא רלוונטי", color: "border-zinc-600/35 bg-zinc-600/10 text-zinc-300" },
] as const;

export const NEXT_ACTION_TYPES = [
  { value: "call", label: "שיחה" },
  { value: "message", label: "הודעה" },
  { value: "meeting", label: "פגישה" },
  { value: "follow-up", label: "מעקב" },
] as const;

export const PRIORITIES = [
  { value: "high", label: "גבוהה", color: "border-danger/30 bg-danger/10 text-red-200" },
  { value: "medium", label: "בינונית", color: "border-gold/30 bg-gold/10 text-gold-soft" },
  { value: "low", label: "נמוכה", color: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300" },
] as const;

const RESCUE_WEAK_STATUSES = new Set([
  "יצירת קשר",
  "ממתין לתגובה",
  "הצעה נשלחה",
  "דורש המשך טיפול",
]);

const LEGACY_STATUS_MAP: Record<string, LeadStatus> = {
  "ליד חדש": "לידים חדשים",
  "אין מענה": "יצירת קשר",
  "נקבעה שיחה": "בתהליך שיחה",
  "שלחתי הצעה": "הצעה נשלחה",
  "ניתנה הצעת מחיר": "הצעה נשלחה",
  "מעקב": "ממתין לתגובה",
  "להחזיר": "דורש המשך טיפול",
  "להציל": "דורש המשך טיפול",
  "שיחה לא התקיימה": "דורש המשך טיפול",
  "לא הגיע לפגישה": "דורש המשך טיפול",
  "נסגר": "נסגר בהצלחה",
};

export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];
export type NextActionType = (typeof NEXT_ACTION_TYPES)[number]["value"];
export type Priority = (typeof PRIORITIES)[number]["value"];

export type Lead = {
  closed_at: string | null;
  created_at: string;
  deal_probability: number;
  id: string;
  last_contact_date: string | null;
  name: string;
  next_action_date: string | null;
  next_action_type: NextActionType | null;
  notes: string | null;
  phone: string | null;
  priority: Priority;
  reason_not_closed: string | null;
  source: string;
  status: string;
  updated_at: string;
  user_id: string;
  value: number;
};

export function getLeadStatusLabel(status: string) {
  const normalized = normalizeLeadStatus(status);
  return LEAD_STATUSES.find((item) => item.value === normalized)?.label ?? status;
}

export function getLeadStatusColor(status: string) {
  const normalized = normalizeLeadStatus(status);
  return LEAD_STATUSES.find((item) => item.value === normalized)?.color ?? "border-white/10 bg-white/5 text-zinc-300";
}

export function getNextActionLabel(type: string | null) {
  return NEXT_ACTION_TYPES.find((item) => item.value === type)?.label ?? "מעקב";
}

export function getPriorityLabel(priority: string) {
  return PRIORITIES.find((item) => item.value === priority)?.label ?? priority;
}

export function getPriorityColor(priority: string) {
  return PRIORITIES.find((item) => item.value === priority)?.color ?? PRIORITIES[1].color;
}

export function isLeadStatus(value: string): value is LeadStatus {
  return LEAD_STATUSES.some((item) => item.value === value) || value in LEGACY_STATUS_MAP;
}

export function normalizeLeadStatus(status: string): LeadStatus {
  if (LEAD_STATUSES.some((item) => item.value === status)) {
    return status as LeadStatus;
  }

  return LEGACY_STATUS_MAP[status] ?? "דורש המשך טיפול";
}

const RAW_FINAL_STATUS_VALUES = new Set(["closed", "won", "lost", "\u05e1\u05d2\u05d5\u05e8"]);

export function isFinalLeadStatus(status: string | null | undefined) {
  const cleanStatus = (status ?? "").trim();

  if (!cleanStatus) {
    return false;
  }

  const normalized = normalizeLeadStatus(cleanStatus);
  return normalized === LEAD_STATUSES[6].value || normalized === LEAD_STATUSES[7].value || RAW_FINAL_STATUS_VALUES.has(cleanStatus.toLowerCase());
}

export function isNextActionType(value: string): value is NextActionType {
  return NEXT_ACTION_TYPES.some((item) => item.value === value);
}

export function isPriority(value: string): value is Priority {
  return PRIORITIES.some((item) => item.value === value);
}

export function getLeadActivityDate(lead: Lead) {
  return lead.last_contact_date || lead.updated_at || lead.created_at;
}

export function getDaysSinceLastActivity(lead: Lead) {
  const activityDate = lead.last_contact_date ? new Date(lead.last_contact_date).getTime() : 0;

  if (!activityDate || Number.isNaN(activityDate)) {
    return 999;
  }

  return Math.max(0, Math.floor((Date.now() - activityDate) / 86_400_000));
}

function getLeadLastContactTime(lead: Lead) {
  if (!lead.last_contact_date) {
    return 0;
  }

  const time = new Date(lead.last_contact_date).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function hasMissedNextAction(lead: Pick<Lead, "next_action_date">) {
  if (!lead.next_action_date) {
    return false;
  }

  const nextActionTime = new Date(lead.next_action_date).getTime();
  return Number.isFinite(nextActionTime) && nextActionTime < Date.now();
}

export function isRescueLead(lead: Lead) {
  const status = normalizeLeadStatus(lead.status);

  if (isFinalLeadStatus(lead.status) || isNotRelevantLead(lead)) {
    return false;
  }

  const daysSinceContact = getDaysSinceLastActivity(lead);
  const noActivity = !lead.last_contact_date || daysSinceContact > 3;
  const missedNextAction = hasMissedNextAction(lead);
  const weakStatusWithNoActivity = RESCUE_WEAK_STATUSES.has(status) && daysSinceContact >= 2;

  return noActivity || missedNextAction || weakStatusWithNoActivity;
}

export function sortRescueLeads(a: Lead, b: Lead) {
  return (
    getLeadLastContactTime(a) - getLeadLastContactTime(b) ||
    (b.value || 0) - (a.value || 0) ||
    (b.deal_probability || 0) - (a.deal_probability || 0)
  );
}

export function getRescueActivityLabel(lead: Lead) {
  const days = getDaysSinceLastActivity(lead);

  if (days >= 999) {
    return "אין תיעוד קשר אחרון";
  }

  return `עברו ${days} ימים מאז קשר אחרון`;
}

export function getRescueActionLabel(lead: Lead) {
  return lead.next_action_date ? `פעולה מתוזמנת: ${new Date(lead.next_action_date).toLocaleDateString("he-IL")}` : "אין פעולה מתוזמנת";
}

export function getNextLeadStatus(status: string): LeadStatus | null {
  const index = LEAD_STATUSES.findIndex((item) => item.value === status);
  return LEAD_STATUSES[index + 1]?.value ?? null;
}

export function getActionCompletedStatus(status: string): LeadStatus | null {
  const leadNewStatus = LEAD_STATUSES[0].value;
  const contactStatus = LEAD_STATUSES[1].value;
  const conversationStatus = LEAD_STATUSES[2].value;
  const proposalStatus = LEAD_STATUSES[3].value;
  const waitingStatus = LEAD_STATUSES[4].value;
  const rescueStatus = LEAD_STATUSES[5].value;
  const closedStatus = LEAD_STATUSES[6].value;
  const irrelevantStatus = LEAD_STATUSES[7].value;
  const currentStatus = normalizeLeadStatus(status);

  if (isFinalLeadStatus(status)) {
    return null;
  }

  if (currentStatus === leadNewStatus) {
    return contactStatus;
  }

  if (currentStatus === contactStatus) {
    return conversationStatus;
  }

  if (currentStatus === conversationStatus) {
    return proposalStatus;
  }

  if (currentStatus === proposalStatus) {
    return waitingStatus;
  }

  if (currentStatus === waitingStatus) {
    return rescueStatus;
  }

  if (currentStatus === rescueStatus) {
    return contactStatus;
  }

  if (currentStatus === closedStatus || currentStatus === irrelevantStatus) {
    return null;
  }

  const nextStatus = getNextLeadStatus(currentStatus);
  return nextStatus && nextStatus !== closedStatus ? nextStatus : null;
}

export function getLeadScore(lead: Lead) {
  const stageScore: Record<string, number> = {
    "לידים חדשים": 40,
    "יצירת קשר": 35,
    "בתהליך שיחה": 58,
    "הצעה נשלחה": 84,
    "ממתין לתגובה": 72,
    "דורש המשך טיפול": 48,
    "נסגר בהצלחה": 100,
    "לא רלוונטי": 0,
  };
  const days = getDaysSinceLastActivity(lead);
  const activityScore = days <= 1 ? 10 : days === 2 ? 0 : -20;
  const valueScore = lead.value >= 15_000 ? 15 : lead.value >= 7_500 ? 10 : lead.value >= 2_500 ? 5 : 0;

  return Math.min(100, Math.max(0, (stageScore[normalizeLeadStatus(lead.status)] ?? 30) + activityScore + valueScore));
}

export function isNotRelevantLead(lead: Pick<Lead, "reason_not_closed" | "status">) {
  return normalizeLeadStatus(lead.status) === "לא רלוונטי" || lead.reason_not_closed?.includes("לא רלוונטי");
}

export function shouldMoveToReactivation(lead: Lead) {
  const status = normalizeLeadStatus(lead.status);

  if (status === "ממתין לתגובה" || status === "הצעה נשלחה" || isFinalLeadStatus(lead.status) || isNotRelevantLead(lead)) {
    return false;
  }

  const days = getDaysSinceLastActivity(lead);
  const nextActionPassed = lead.next_action_date ? new Date(lead.next_action_date).getTime() < Date.now() : false;

  return days >= 4 || nextActionPassed;
}

export function getReactivationScore(lead: Lead) {
  const stageScore: Record<string, number> = {
    "הצעה נשלחה": 35,
    "ממתין לתגובה": 30,
    "בתהליך שיחה": 20,
    "דורש המשך טיפול": 18,
    "יצירת קשר": 10,
    "לידים חדשים": 5,
  };
  const valueScore = lead.value >= 15_000 ? 40 : lead.value >= 7_500 ? 30 : lead.value >= 2_500 ? 20 : 10;
  const inactivityScore = Math.min(30, getDaysSinceLastActivity(lead) * 4);

  return valueScore + (stageScore[normalizeLeadStatus(lead.status)] ?? 0) + inactivityScore;
}

export function getLeadTemperature(lead: Lead) {
  const score = getLeadScore(lead);

  if (score >= 75) {
    return {
      color: "border-gold/30 bg-gold/10 text-gold-soft",
      label: "🔥 חם",
      score,
    };
  }

  if (score >= 50) {
    return {
      color: "border-gold/30 bg-gold/10 text-gold-soft",
      label: "🟡 חמים",
      score,
    };
  }

  return {
    color: "border-process/30 bg-process/10 text-blue-200",
    label: "🔵 קר",
    score,
  };
}
