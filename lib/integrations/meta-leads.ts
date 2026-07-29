import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPhoneDuplicateCandidates, normalizePhoneForComparison } from "@/lib/phone";
import { isFinalLeadStatus } from "@/lib/leads";
import type { Database } from "@/types/database";

export const META_LEAD_PROVIDER = "meta_lead_ads";

const META_TASK_TITLE = "לחזור לליד שהגיע מפייסבוק";
const META_TASK_DESCRIPTION = "ליצור קשר עם ליד שהגיע מטופס Facebook Lead Ads.";
const META_SOURCE = "facebook_lead_ads";
const MAX_REQUEST_BODY_BYTES = 32_768;
const ALLOWED_FIELDS = new Set([
  "externalLeadId",
  "submittedAt",
  "fullName",
  "phone",
  "email",
  "pageId",
  "pageName",
  "formId",
  "formName",
  "campaignId",
  "campaignName",
  "adSetId",
  "adSetName",
  "adId",
  "adName",
]);
const EXTERNAL_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AdminClient = SupabaseClient<Database>;
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type ExternalSourceRow = Database["public"]["Tables"]["lead_external_sources"]["Row"];
type MetaLeadResult = "already_processed" | "created" | "linked_existing";
type TaskResult = "created" | "existing" | "failed" | "skipped_final";

type SupabaseErrorLike = {
  code?: string | null;
};

export type MetaLeadPayload = {
  adId: string | null;
  adName: string | null;
  adSetId: string | null;
  adSetName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  email: string | null;
  externalLeadId: string;
  formId: string | null;
  formName: string | null;
  fullName: string | null;
  pageId: string | null;
  pageName: string | null;
  phone: string | null;
  submittedAt: string | null;
};

export type MetaLeadValidationResult =
  | {
      issues: string[];
      ok: false;
    }
  | {
      data: MetaLeadPayload;
      ok: true;
    };

export type MetaLeadIngestionResult = {
  leadId: string;
  result: MetaLeadResult;
  taskResult: TaskResult;
  taskErrorCode?: string;
};

export class MetaLeadIngestionError extends Error {
  errorCode: string;
  stage: string;

  constructor(stage: string, errorCode = "INTERNAL_ERROR") {
    super("Meta lead ingestion failed");
    this.name = "MetaLeadIngestionError";
    this.errorCode = errorCode;
    this.stage = stage;
  }
}

export function getMetaLeadMaxBodyBytes() {
  return MAX_REQUEST_BODY_BYTES;
}

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function readText(
  record: Record<string, unknown>,
  key: string,
  maxLength: number,
  issues: string[],
  options: { externalId?: boolean; required?: boolean } = {},
) {
  const rawValue = record[key];

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    if (options.required) {
      issues.push(`${key} is required`);
    }

    return null;
  }

  if (typeof rawValue !== "string") {
    issues.push(`${key} must be a string`);
    return null;
  }

  const value = options.externalId ? rawValue.trim() : cleanText(rawValue);

  if (!value) {
    if (options.required) {
      issues.push(`${key} is required`);
    }

    return null;
  }

  if (value.length > maxLength) {
    issues.push(`${key} is too long`);
  }

  if (options.externalId && !EXTERNAL_ID_PATTERN.test(value)) {
    issues.push(`${key} has an invalid format`);
  }

  if (!options.externalId && /[<>]/.test(value)) {
    issues.push(`${key} contains unsupported characters`);
  }

  return value;
}

function normalizePhone(value: string | null, issues: string[]) {
  if (!value) {
    return null;
  }

  const digits = normalizePhoneForComparison(value);

  if (digits.length < 7 || digits.length > 15) {
    issues.push("phone has an invalid format");
    return null;
  }

  return `+${digits}`;
}

function normalizeEmail(value: string | null, issues: string[]) {
  if (!value) {
    return null;
  }

  const email = value.toLowerCase();

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    issues.push("email has an invalid format");
    return null;
  }

  return email;
}

function normalizeSubmittedAt(value: string | null, issues: string[]) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value);
  const year = timestamp.getUTCFullYear();

  if (Number.isNaN(timestamp.getTime()) || year < 2000 || year > 2100) {
    issues.push("submittedAt must be a valid timestamp");
    return null;
  }

  return timestamp.toISOString();
}

export function validateMetaLeadPayload(value: unknown): MetaLeadValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { issues: ["Body must be a JSON object"], ok: false };
  }

  const record = value as Record<string, unknown>;
  const issues = Object.keys(record)
    .filter((key) => !ALLOWED_FIELDS.has(key))
    .map((key) => `Unknown field: ${key}`);
  const externalLeadId =
    readText(record, "externalLeadId", 128, issues, { externalId: true, required: true }) ?? "";
  const phone = normalizePhone(readText(record, "phone", 40, issues), issues);
  const email = normalizeEmail(readText(record, "email", 254, issues), issues);
  const submittedAt = normalizeSubmittedAt(readText(record, "submittedAt", 40, issues), issues);
  const adId = readText(record, "adId", 128, issues, { externalId: true });
  const adName = readText(record, "adName", 240, issues);
  const adSetId = readText(record, "adSetId", 128, issues, { externalId: true });
  const adSetName = readText(record, "adSetName", 240, issues);
  const campaignId = readText(record, "campaignId", 128, issues, { externalId: true });
  const campaignName = readText(record, "campaignName", 240, issues);
  const formId = readText(record, "formId", 128, issues, { externalId: true });
  const formName = readText(record, "formName", 240, issues);
  const fullName = readText(record, "fullName", 120, issues);
  const pageId = readText(record, "pageId", 128, issues, { externalId: true });
  const pageName = readText(record, "pageName", 160, issues);

  if (!phone && !email) {
    issues.push("At least one of phone or email is required");
  }

  if (issues.length) {
    return { issues: Array.from(new Set(issues)), ok: false };
  }

  return {
    data: {
      adId,
      adName,
      adSetId,
      adSetName,
      campaignId,
      campaignName,
      email,
      externalLeadId,
      formId,
      formName,
      fullName,
      pageId,
      pageName,
      phone,
      submittedAt,
    },
    ok: true,
  };
}

function deterministicUuid(seed: string) {
  const bytes = Buffer.from(createHash("sha256").update(seed).digest("hex").slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getLeadId(ownerId: string, externalLeadId: string) {
  return deterministicUuid(`${ownerId}:${META_LEAD_PROVIDER}:${externalLeadId}`);
}

function getJerusalemDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jerusalem",
    year: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function getTaskId(ownerId: string, leadId: string) {
  return deterministicUuid(`${ownerId}:${leadId}:meta-follow-up:${getJerusalemDate()}`);
}

function isUniqueViolation(error: SupabaseErrorLike | null) {
  return error?.code === "23505";
}

function asIngestionError(stage: string, error: SupabaseErrorLike | null) {
  return new MetaLeadIngestionError(stage, error?.code || "DATABASE_ERROR");
}

async function getExternalSource(
  admin: AdminClient,
  ownerId: string,
  externalLeadId: string,
) {
  const { data, error } = await admin
    .from("lead_external_sources")
    .select("*")
    .eq("user_id", ownerId)
    .eq("provider", META_LEAD_PROVIDER)
    .eq("external_lead_id", externalLeadId)
    .maybeSingle();

  if (error) {
    throw asIngestionError("external_source_lookup", error);
  }

  return data;
}

async function getLeadById(admin: AdminClient, ownerId: string, leadId: string) {
  const { data, error } = await admin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (error) {
    throw asIngestionError("lead_lookup_by_id", error);
  }

  return data;
}

async function findMatchingLead(
  admin: AdminClient,
  ownerId: string,
  payload: MetaLeadPayload,
  deterministicLeadId: string,
) {
  const recoveredLead = await getLeadById(admin, ownerId, deterministicLeadId);

  if (recoveredLead) {
    return { lead: recoveredLead, recoveredCreate: true };
  }

  if (payload.phone) {
    const { data, error } = await admin
      .from("leads")
      .select("*")
      .eq("user_id", ownerId)
      .in("phone", getPhoneDuplicateCandidates(payload.phone))
      .limit(1)
      .maybeSingle();

    if (error) {
      throw asIngestionError("lead_phone_lookup", error);
    }

    if (data) {
      return { lead: data, recoveredCreate: false };
    }
  }

  if (payload.email) {
    const { data, error } = await admin
      .from("leads")
      .select("*")
      .eq("user_id", ownerId)
      .eq("email", payload.email)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw asIngestionError("lead_email_lookup", error);
    }

    if (data) {
      return { lead: data, recoveredCreate: false };
    }
  }

  return { lead: null, recoveredCreate: false };
}

async function updateOnlyMissingLeadFields(
  admin: AdminClient,
  ownerId: string,
  lead: LeadRow,
  payload: MetaLeadPayload,
) {
  const update: Database["public"]["Tables"]["leads"]["Update"] = {};

  if (!lead.full_name.trim() && payload.fullName) {
    update.full_name = payload.fullName;
  }

  if (!lead.phone && payload.phone) {
    update.phone = payload.phone;
  }

  if (!lead.email && payload.email) {
    update.email = payload.email;
  }

  if (!lead.source.trim()) {
    update.source = META_SOURCE;
  }

  if (!Object.keys(update).length) {
    return lead;
  }

  update.updated_at = new Date().toISOString();

  const { data, error } = await admin
    .from("leads")
    .update(update)
    .eq("id", lead.id)
    .eq("user_id", ownerId)
    .select("*")
    .single();

  if (error) {
    throw asIngestionError("lead_safe_update", error);
  }

  return data;
}

async function createLead(
  admin: AdminClient,
  ownerId: string,
  payload: MetaLeadPayload,
  leadId: string,
  receivedAt: string,
) {
  const { data, error } = await admin
    .from("leads")
    .insert({
      deal_probability: 0,
      email: payload.email,
      full_name: payload.fullName || "ליד Facebook",
      id: leadId,
      last_contact_date: receivedAt,
      next_action_date: receivedAt,
      next_action_type: "call",
      phone: payload.phone,
      priority: "high",
      source: META_SOURCE,
      status: "לידים חדשים",
      user_id: ownerId,
      value: 0,
    })
    .select("*")
    .single();

  if (!error && data) {
    return data;
  }

  if (isUniqueViolation(error)) {
    const existingLead = await getLeadById(admin, ownerId, leadId);

    if (existingLead) {
      return existingLead;
    }
  }

  throw asIngestionError("lead_insert", error);
}

async function insertExternalSource(
  admin: AdminClient,
  ownerId: string,
  leadId: string,
  payload: MetaLeadPayload,
  receivedAt: string,
) {
  const { data, error } = await admin
    .from("lead_external_sources")
    .insert({
      ad_id: payload.adId,
      ad_name: payload.adName,
      adset_id: payload.adSetId,
      adset_name: payload.adSetName,
      campaign_id: payload.campaignId,
      campaign_name: payload.campaignName,
      external_lead_id: payload.externalLeadId,
      form_id: payload.formId,
      form_name: payload.formName,
      lead_id: leadId,
      page_id: payload.pageId,
      page_name: payload.pageName,
      provider: META_LEAD_PROVIDER,
      received_at: receivedAt,
      submitted_at: payload.submittedAt,
      user_id: ownerId,
    })
    .select("*")
    .single();

  if (!error && data) {
    return { created: true, source: data };
  }

  if (isUniqueViolation(error)) {
    const existingSource = await getExternalSource(admin, ownerId, payload.externalLeadId);

    if (existingSource) {
      return { created: false, source: existingSource };
    }
  }

  throw asIngestionError("external_source_insert", error);
}

async function ensureMetaFollowUpTask(
  admin: AdminClient,
  ownerId: string,
  lead: LeadRow,
): Promise<{ errorCode?: string; result: TaskResult }> {
  if (isFinalLeadStatus(lead.status)) {
    return { result: "skipped_final" };
  }

  const { data: existingTask, error: existingTaskError } = await admin
    .from("tasks")
    .select("id")
    .eq("user_id", ownerId)
    .eq("linked_lead_id", lead.id)
    .eq("is_automated", true)
    .is("deleted_at", null)
    .in("status", ["פתוחה", "בתהליך"])
    .limit(1)
    .maybeSingle();

  if (existingTaskError) {
    return { errorCode: existingTaskError.code || "TASK_LOOKUP_FAILED", result: "failed" };
  }

  if (existingTask) {
    return { result: "existing" };
  }

  const { error } = await admin.from("tasks").insert({
    assigned_to: ownerId,
    description: META_TASK_DESCRIPTION,
    due_date: getJerusalemDate(),
    id: getTaskId(ownerId, lead.id),
    is_automated: true,
    linked_lead_id: lead.id,
    priority: "גבוהה",
    status: "פתוחה",
    title: META_TASK_TITLE,
    user_id: ownerId,
  });

  if (!error) {
    return { result: "created" };
  }

  if (isUniqueViolation(error)) {
    return { result: "existing" };
  }

  return { errorCode: error.code || "TASK_INSERT_FAILED", result: "failed" };
}

async function getLeadForSource(admin: AdminClient, ownerId: string, source: ExternalSourceRow) {
  const lead = await getLeadById(admin, ownerId, source.lead_id);

  if (!lead) {
    throw new MetaLeadIngestionError("external_source_lead_missing", "RELATED_LEAD_NOT_FOUND");
  }

  return lead;
}

export async function ingestMetaLead(
  admin: AdminClient,
  ownerId: string,
  payload: MetaLeadPayload,
): Promise<MetaLeadIngestionResult> {
  const existingSource = await getExternalSource(admin, ownerId, payload.externalLeadId);

  if (existingSource) {
    const lead = await getLeadForSource(admin, ownerId, existingSource);
    const task = await ensureMetaFollowUpTask(admin, ownerId, lead);

    return {
      leadId: lead.id,
      result: "already_processed",
      taskErrorCode: task.errorCode,
      taskResult: task.result,
    };
  }

  const receivedAt = new Date().toISOString();
  const deterministicLeadId = getLeadId(ownerId, payload.externalLeadId);
  const match = await findMatchingLead(admin, ownerId, payload, deterministicLeadId);
  const lead = match.lead
    ? await updateOnlyMissingLeadFields(admin, ownerId, match.lead, payload)
    : await createLead(admin, ownerId, payload, deterministicLeadId, receivedAt);
  const intendedResult: MetaLeadResult = match.lead && !match.recoveredCreate ? "linked_existing" : "created";
  const metadata = await insertExternalSource(admin, ownerId, lead.id, payload, receivedAt);
  const persistedLead = metadata.created
    ? lead
    : await getLeadForSource(admin, ownerId, metadata.source);
  const task = await ensureMetaFollowUpTask(admin, ownerId, persistedLead);

  return {
    leadId: persistedLead.id,
    result: metadata.created ? intendedResult : "already_processed",
    taskErrorCode: task.errorCode,
    taskResult: task.result,
  };
}

export function getMetaLeadLogId(externalLeadId: string) {
  return createHash("sha256").update(externalLeadId).digest("hex").slice(0, 12);
}
