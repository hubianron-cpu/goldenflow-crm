import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import {
  isLeadStatus,
  isNextActionType,
  normalizeLeadStatus,
  isPriority,
  shouldMoveToReactivation,
  type Lead,
  type LeadStatus,
  type NextActionType,
  type Priority,
} from "@/lib/leads";
import { getDefaultLeadOwnerId, getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const leadSelect =
  "id, closed_at, created_at, deal_probability, last_contact_date, name, next_action_date, next_action_type, notes, phone, priority, reason_not_closed, source, status, updated_at, user_id, value";
type LeadWriteClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;

function jsonError(message: string, status: number, meta?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...meta }, { status });
}

function getSupabaseErrorMessage(error: {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string;
}) {
  return [error.message, error.details, error.hint, error.code ? `Code: ${error.code}` : ""].filter(Boolean).join(" ");
}

function logSupabaseError(scope: string, error: {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string;
}) {
  console.error(`SUPABASE_${scope.toUpperCase()}_ERROR`, getSupabaseErrorMeta(error));
}

function getSupabaseErrorMeta(error: {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string;
}) {
  return {
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    message: error.message ?? null,
  };
}

async function getContext() {
  if (!hasSupabaseEnv()) {
    return { error: jsonError("Supabase is not configured.", 503) };
  }

  const supabase = await createServerClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (sessionError) {
    logSupabaseError("auth.getSession", sessionError);
    return { error: jsonError(getSupabaseErrorMessage(sessionError), 401) };
  }

  if (error) {
    logSupabaseError("auth.getUser", error);
    return { error: jsonError(getSupabaseErrorMessage(error), 401) };
  }

  if (!session || !user) {
    return { error: jsonError("אין משתמש מחובר. התחברו מחדש לפני שמירת לידים.", 401) };
  }

  return { supabase, user };
}

async function getOptionalWriteContext() {
  if (!hasSupabaseEnv()) {
    return { error: jsonError("Supabase is not configured.", 503) };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return { source: "session" as const, supabase, userId: user.id };
  }

  const admin = getSupabaseAdminClient();
  const defaultOwnerId = getDefaultLeadOwnerId();

  if (!admin || !defaultOwnerId) {
    return {
      error: jsonError(
        "Public lead capture is not configured. Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DEFAULT_OWNER_ID.",
        503,
      ),
    };
  }

  return { source: "public" as const, supabase: admin, userId: defaultOwnerId };
}

function cleanOptional(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function parseDate(value: unknown) {
  const text = cleanOptional(value);

  if (!text) {
    return null;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function parseProbability(value: unknown) {
  const probability = Number(value ?? 0);

  if (!Number.isFinite(probability)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(probability)));
}

function isValidPhone(value: string | null) {
  return !value || /^[0-9+\-()\s]{7,20}$/.test(value);
}

function normalizeLeadPayload(body: Record<string, unknown>) {
  const status = typeof body.status === "string" && isLeadStatus(body.status) ? normalizeLeadStatus(body.status) : "לידים חדשים";
  const nextActionType =
    typeof body.next_action_type === "string" && isNextActionType(body.next_action_type)
      ? body.next_action_type
      : null;
  const priority = typeof body.priority === "string" && isPriority(body.priority) ? body.priority : "medium";

  return {
    deal_probability: parseProbability(body.deal_probability),
    last_contact_date: parseDate(body.last_contact_date),
    name: typeof body.name === "string" ? body.name.trim() : "",
    next_action_date: parseDate(body.next_action_date),
    next_action_type: nextActionType,
    notes: cleanOptional(body.notes),
    phone: cleanOptional(body.phone),
    priority,
    reason_not_closed: cleanOptional(body.reason_not_closed),
    source: cleanOptional(body.source) ?? "organic",
    status,
    value: parseMoney(body.value),
  };
}

function getTomorrowIso() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow.toISOString();
}

type AutomationRuleType = "new_lead" | "followup_24h";

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function isMoreThan24HoursAgo(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return Date.now() - date.getTime() > 24 * 60 * 60 * 1000;
}

function getAutomatedTaskCopy(lead: Lead, ruleType: AutomationRuleType) {
  if (ruleType === "new_lead") {
    return {
      description: "צור קשר ראשוני עם הליד",
      priority: "גבוהה",
      title: "ליצור קשר",
    };
  }

  return {
    description: "לא היה קשר מעל 24 שעות. לבצע פולואפ קצר ולהחזיר את הליד לתנועה.",
    priority: "גבוהה",
    title: `פולואפ 24 שעות: ${lead.name}`,
  };
}

async function hasAutomationLog(supabase: LeadWriteClient, leadId: string, ruleType: AutomationRuleType) {
  const { data, error } = await supabase
    .from("task_automations_log")
    .select("id")
    .eq("lead_id", leadId)
    .eq("rule_type", ruleType)
    .maybeSingle();

  if (error) {
    logSupabaseError(`task_automation.${ruleType}.log_select`, error);
    return true;
  }

  return Boolean(data);
}

async function hasExistingAutomatedTask(supabase: LeadWriteClient, leadId: string, title: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id")
    .eq("linked_lead_id", leadId)
    .eq("title", title)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("AUTO_TASK_DUPLICATE_CHECK_FAILED", getSupabaseErrorMeta(error));
    return true;
  }

  return Boolean(data);
}

async function createAutomatedTask(
  supabase: LeadWriteClient,
  lead: Lead,
  ownerId: string,
  ruleType: AutomationRuleType,
) {
  if (!lead.id || !ownerId || lead.user_id !== ownerId || (await hasAutomationLog(supabase, lead.id, ruleType))) {
    return { created: false };
  }

  const copy = getAutomatedTaskCopy(lead, ruleType);

  if (await hasExistingAutomatedTask(supabase, lead.id, copy.title)) {
    return { created: false };
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      assigned_to: ownerId,
      description: copy.description,
      due_date: getTodayDateValue(),
      is_automated: true,
      linked_lead_id: lead.id,
      priority: copy.priority,
      status: "פתוחה",
      title: copy.title,
      user_id: ownerId,
    })
    .select("id, title, linked_lead_id, user_id, assigned_to, status, priority, due_date, is_automated")
    .single();

  if (taskError) {
    logSupabaseError(`task_automation.${ruleType}.task_insert`, taskError);
    console.error("AUTO_TASK_CREATE_FAILED", getSupabaseErrorMeta(taskError));
    return { error: getSupabaseErrorMessage(taskError) };
  }

  console.log("AUTO_TASK_CREATED", task);

  const { error: logError } = await supabase.from("task_automations_log").insert({
    lead_id: lead.id,
    rule_type: ruleType,
  });

  if (!logError) {
    return { created: true, task };
  }

  logSupabaseError(`task_automation.${ruleType}.log_insert`, logError);
  console.error("AUTO_TASK_LOG_FAILED", getSupabaseErrorMeta(logError));

  if (task?.id) {
    const { error: cleanupError } = await supabase.from("tasks").delete().eq("id", task.id).eq("user_id", ownerId);

    if (cleanupError) {
      logSupabaseError(`task_automation.${ruleType}.task_cleanup`, cleanupError);
      console.error("AUTO_TASK_CLEANUP_FAILED", getSupabaseErrorMeta(cleanupError));
    }
  }

  return { error: getSupabaseErrorMessage(logError) };
}

async function runTaskAutomations(
  supabase: LeadWriteClient,
  lead: Lead,
  ownerId: string,
  options: { newLead?: boolean } = {},
) {
  const results = [];

  if (options.newLead) {
    results.push(await createAutomatedTask(supabase, lead, ownerId, "new_lead"));
  }

  if (isMoreThan24HoursAgo(lead.last_contact_date)) {
    results.push(await createAutomatedTask(supabase, lead, ownerId, "followup_24h"));
  }

  return results.find((result) => result?.error);
}

async function markInactiveLeadsForReactivation(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
) {
  const { data: candidates, error } = await supabase
    .from("leads")
    .select(leadSelect)
    .eq("user_id", userId)
    .neq("status", "ממתין לתגובה");

  if (error) {
    logSupabaseError("leads.reactivation_select", error);
    return;
  }

  const staleLeads = (candidates ?? []).filter((lead) => shouldMoveToReactivation(lead as Lead));

  if (!staleLeads.length) {
    return;
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      next_action_date: getTomorrowIso(),
      next_action_type: "follow-up",
      status: "ממתין לתגובה",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .in(
      "id",
      staleLeads.map((lead) => lead.id),
    );

  if (updateError) {
    logSupabaseError("leads.reactivation_update", updateError);
  }
}

export async function GET() {
  const context = await getContext();

  if ("error" in context) {
    return context.error;
  }

  await markInactiveLeadsForReactivation(context.supabase, context.user.id);

  const { data, error } = await context.supabase
    .from("leads")
    .select(leadSelect)
    .eq("user_id", context.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("leads.select", error);
    return jsonError(getSupabaseErrorMessage(error), 500, getSupabaseErrorMeta(error));
  }

  return NextResponse.json({ leads: data ?? [] }, { status: 200 });
}

export async function POST(request: Request) {
  const context = await getOptionalWriteContext();

  if ("error" in context) {
    return context.error;
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body.", 400);
  }

  const lead = normalizeLeadPayload(body as Record<string, unknown>);
  const isQuickWhatsapp = lead.source === "whatsapp";

  if (!lead.name && !isQuickWhatsapp) {
    return jsonError("Lead name is required.", 400);
  }

  if (!lead.phone) {
    return jsonError("Phone number is required.", 400);
  }

  if (!isValidPhone(lead.phone)) {
    return jsonError("Phone number is invalid.", 400);
  }

  const now = new Date().toISOString();
  const ownerId = context.userId;
  const phone = lead.phone;
  const leadName = lead.name || `WhatsApp ${phone}`;
  const writeSupabase = context.supabase as unknown as LeadWriteClient;
  const { data: existingLead, error: duplicateCheckError } = await writeSupabase
    .from("leads")
    .select(leadSelect)
    .eq("user_id", ownerId)
    .eq("phone", phone)
    .maybeSingle();

  if (duplicateCheckError) {
    logSupabaseError("leads.duplicate_check", duplicateCheckError);
    return jsonError(getSupabaseErrorMessage(duplicateCheckError), 500, getSupabaseErrorMeta(duplicateCheckError));
  }

  if (existingLead) {
    const { data, error } = await writeSupabase
      .from("leads")
      .update({
        last_contact_date: now,
        next_action_date: now,
        next_action_type: "call",
        source: lead.source,
        ...(existingLead.name.startsWith("WhatsApp ") && lead.name ? { name: lead.name } : {}),
      })
      .eq("id", existingLead.id)
      .eq("user_id", ownerId)
      .select(leadSelect)
      .single();

    if (error) {
      logSupabaseError("leads.duplicate_update", error);
      return jsonError(getSupabaseErrorMessage(error), 500, getSupabaseErrorMeta(error));
    }

    const automationError = await runTaskAutomations(writeSupabase, data as Lead, ownerId);

    return NextResponse.json(
      {
        duplicate: true,
        lead: data,
        taskAutomationError: automationError?.error ?? null,
      },
      { status: 200 },
    );
  }

  const { data, error } = await writeSupabase
    .from("leads")
    .insert({
      deal_probability: lead.deal_probability,
      last_contact_date: now,
      name: leadName,
      next_action_date: now,
      notes: lead.notes,
      status: lead.status satisfies LeadStatus,
      next_action_type: "call" satisfies NextActionType,
      phone,
      priority: lead.priority satisfies Priority,
      reason_not_closed: lead.reason_not_closed,
      source: lead.source,
      user_id: ownerId,
      value: lead.value,
    })
    .select(leadSelect)
    .single();

  if (error) {
    logSupabaseError("leads.insert", error);
    return jsonError(getSupabaseErrorMessage(error), 500, getSupabaseErrorMeta(error));
  }

  console.log("LEAD_CREATED", data);
  const automationError = await runTaskAutomations(writeSupabase, data as Lead, ownerId, { newLead: true });

  return NextResponse.json(
    {
      lead: data,
      taskAutomationError: automationError?.error ?? null,
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const context = await getContext();

  if ("error" in context) {
    return context.error;
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body.", 400);
  }

  const record = body as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";

  if (!id) {
    return jsonError("Lead id is required.", 400);
  }

  const update: Record<string, unknown> = {};

  if ("status" in record) {
    if (typeof record.status !== "string" || !isLeadStatus(record.status)) {
      return jsonError("Lead status is invalid.", 400);
    }

    update.status = normalizeLeadStatus(record.status);
  }

  if ("name" in record) {
    const name = typeof record.name === "string" ? record.name.trim() : "";

    if (!name) {
      return jsonError("Lead name is required.", 400);
    }

    update.name = name;
  }

  if ("phone" in record) {
    const phone = cleanOptional(record.phone);

    if (!phone) {
      return jsonError("Phone number is required.", 400);
    }

    if (!isValidPhone(phone)) {
      return jsonError("Phone number is invalid.", 400);
    }

    update.phone = phone;
  }

  if ("source" in record) {
    update.source = cleanOptional(record.source) ?? "לא ידוע";
  }

  if ("notes" in record) {
    update.notes = cleanOptional(record.notes);
  }

  if ("reason_not_closed" in record) {
    update.reason_not_closed = cleanOptional(record.reason_not_closed);
  }

  if ("next_action_date" in record) {
    update.next_action_date = parseDate(record.next_action_date);
  }

  if ("next_action_type" in record) {
    if (
      record.next_action_type &&
      (typeof record.next_action_type !== "string" || !isNextActionType(record.next_action_type))
    ) {
      return jsonError("Next action type is invalid.", 400);
    }

    update.next_action_type = record.next_action_type || null;
  }

  if ("last_contact_date" in record) {
    update.last_contact_date = parseDate(record.last_contact_date);
  }

  if ("closed_at" in record) {
    update.closed_at = parseDate(record.closed_at);
  }

  if ("deal_probability" in record) {
    update.deal_probability = parseProbability(record.deal_probability);
  }

  if ("priority" in record) {
    if (typeof record.priority !== "string" || !isPriority(record.priority)) {
      return jsonError("Priority is invalid.", 400);
    }

    update.priority = record.priority;
  }

  if ("value" in record) {
    update.value = parseMoney(record.value);
  }

  const updatedAt = new Date().toISOString();

  if (update.status === "נסגר בהצלחה" && !("closed_at" in update)) {
    update.closed_at = updatedAt;
  }

  if (Object.keys(update).length === 0) {
    return jsonError("No supported fields to update.", 400);
  }

  update.updated_at = updatedAt;

  const { data, error } = await context.supabase
    .from("leads")
    .update(update)
    .eq("id", id)
    .eq("user_id", context.user.id)
    .select(leadSelect)
    .single();

  if (error) {
    logSupabaseError("leads.update", error);
    return jsonError(getSupabaseErrorMessage(error), 500, getSupabaseErrorMeta(error));
  }

  const automationError = await runTaskAutomations(context.supabase as unknown as LeadWriteClient, data as Lead, context.user.id);

  return NextResponse.json(
    {
      lead: data,
      taskAutomationError: automationError?.error ?? null,
    },
    { status: 200 },
  );
}

export async function DELETE(request: Request) {
  const context = await getContext();

  if ("error" in context) {
    return context.error;
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body.", 400);
  }

  const record = body as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";

  if (!id) {
    return jsonError("Lead id is required.", 400);
  }

  const { data, error } = await context.supabase
    .from("leads")
    .delete()
    .eq("id", id)
    .eq("user_id", context.user.id)
    .select("id")
    .single();

  if (error) {
    logSupabaseError("leads.delete", error);
    return jsonError(getSupabaseErrorMessage(error), 500, getSupabaseErrorMeta(error));
  }

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/pipeline");

  return NextResponse.json({ deletedLead: data }, { status: 200 });
}
