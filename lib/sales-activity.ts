import { isNextActionType, type NextActionType } from "./leads";

export const SALES_OUTCOMES = [
  { value: "no_answer", label: "לא ענה", activityType: "contact_attempt", direction: "outbound" },
  { value: "call", label: "שיחה התקיימה", activityType: "call_completed", direction: null },
  { value: "whatsapp", label: "WhatsApp נשלח", activityType: "message_sent", direction: "outbound" },
  { value: "offer", label: "הצעה נשלחה", activityType: "offer_sent", direction: "outbound" },
  { value: "later", label: "ביקש לחזור מאוחר יותר", activityType: "note_recorded", direction: null },
  { value: "irrelevant", label: "לא רלוונטי", activityType: "note_recorded", direction: "internal" },
] as const;

export type SalesOutcome = (typeof SALES_OUTCOMES)[number]["value"];
export type SalesActivityInput = {
  requestId: string;
  outcome: SalesOutcome;
  summary: string;
  nextStep: "keep" | "none" | "schedule";
  nextActionType: NextActionType | null;
  nextActionDate: string | null;
};

export const ACTIVITY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseSalesActivity(value: unknown): SalesActivityInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["requestId", "outcome", "summary", "nextStep", "nextActionType", "nextActionDate"].includes(key))) return null;
  if (typeof input.requestId !== "string" || !ACTIVITY_UUID.test(input.requestId)) return null;
  if (!SALES_OUTCOMES.some((outcome) => outcome.value === input.outcome)) return null;
  if (typeof input.summary !== "string" || input.summary.length > 2000) return null;
  if (typeof input.nextStep !== "string" || !["keep", "none", "schedule"].includes(input.nextStep)) return null;
  if (input.nextStep === "schedule") {
    if (typeof input.nextActionType !== "string" || !isNextActionType(input.nextActionType)) return null;
    if (typeof input.nextActionDate !== "string" || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(input.nextActionDate) || !Number.isFinite(Date.parse(input.nextActionDate))) return null;
  } else if (input.nextActionType !== null || input.nextActionDate !== null) {
    return null;
  }
  return { ...input, summary: input.summary.trim() } as SalesActivityInput;
}

export type SalesActivityHistoryItem = {
  id: string;
  occurred_at: string;
  activity_type: string;
  outcome: string | null;
  summary: string | null;
  next_step_mode: string | null;
  next_action_type: string | null;
  next_action_date: string | null;
};
