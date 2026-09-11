import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSalesIntelligenceCredentialAccess,
  hashSalesIntelligenceToken,
  parseSalesIntelligenceBearerToken,
  type SalesIntelligenceCredentialRecord,
} from "@/lib/agents/sales-intelligence-credential";
import {
  buildSalesIntelligenceDetail,
  buildSalesIntelligenceSearchResponse,
  type SalesIntelligenceActivityRow,
  type SalesIntelligenceLeadRow,
  type SalesIntelligenceSearchInput,
  type SalesIntelligenceSearchRow,
  type SalesIntelligenceSourceRow,
  type SalesIntelligenceTaskRow,
} from "@/lib/agents/sales-intelligence";
import { getSubscriptionAccess } from "@/lib/subscriptions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

export type SalesIntelligenceAuthContext = {
  admin: AdminClient;
  credentialId: string;
  userId: string;
};

export type SalesIntelligenceAuthResult =
  | { context: SalesIntelligenceAuthContext; ok: true }
  | { error: string; ok: false; status: 401 | 403 | 500 };

type DataResult<T> = { data: T; ok: true } | { error: string; ok: false };

function logDatabaseError(event: string, error: { code?: string; message?: string }) {
  console.error(event, {
    code: error.code ?? null,
    message: error.message ?? null,
  });
}

export async function authenticateSalesIntelligenceRequest(
  request: Request,
): Promise<SalesIntelligenceAuthResult> {
  const token = parseSalesIntelligenceBearerToken(request.headers.get("authorization"));

  if (!token) {
    return { error: "Invalid or missing credential", ok: false, status: 401 };
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    console.error("SALES_INTELLIGENCE_CONFIGURATION_MISSING", {
      component: "supabase_admin",
    });
    return { error: "Integration is not configured", ok: false, status: 500 };
  }

  const tokenHash = hashSalesIntelligenceToken(token);
  const { data, error } = await admin
    .from("agent_integration_credentials")
    .select("id,user_id,token_hash,scopes,expires_at,revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    logDatabaseError("SALES_INTELLIGENCE_CREDENTIAL_LOOKUP_FAILED", error);
    return { error: "Unable to verify integration access", ok: false, status: 500 };
  }

  const credential = data as SalesIntelligenceCredentialRecord | null;
  const access = getSalesIntelligenceCredentialAccess(credential);
  if (!access.ok) {
    return {
      error: access.status === 403 ? "Credential lacks required scope" : "Invalid or missing credential",
      ok: false,
      status: access.status,
    };
  }

  if (!credential) {
    return { error: "Invalid or missing credential", ok: false, status: 401 };
  }

  const { data: subscription, error: subscriptionError } = await admin
    .from("user_subscriptions")
    .select("status,trial_end_at")
    .eq("user_id", credential.user_id)
    .maybeSingle();

  if (subscriptionError) {
    logDatabaseError("SALES_INTELLIGENCE_SUBSCRIPTION_LOOKUP_FAILED", subscriptionError);
    return { error: "Unable to verify integration access", ok: false, status: 500 };
  }

  if (!getSubscriptionAccess(subscription).hasAccess) {
    return { error: "Subscription access required", ok: false, status: 403 };
  }

  return {
    context: {
      admin,
      credentialId: credential.id,
      userId: credential.user_id,
    },
    ok: true,
  };
}

function escapeIlikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function searchSalesIntelligenceLeads(
  admin: AdminClient,
  userId: string,
  input: SalesIntelligenceSearchInput,
): Promise<DataResult<ReturnType<typeof buildSalesIntelligenceSearchResponse>>> {
  const select = "id,user_id,full_name,status,source,phone,email,updated_at";
  const query = admin.from("leads").select(select).eq("user_id", userId);
  const candidateLimit = 500;

  const result = input.kind === "email"
    ? await query.ilike("email", escapeIlikePattern(input.normalizedQuery)).limit(candidateLimit)
    : input.kind === "phone"
      ? await query.not("phone", "is", null).limit(500)
      : await query
          .ilike("full_name", `%${escapeIlikePattern(input.query)}%`)
          .limit(candidateLimit);

  if (result.error) {
    logDatabaseError("SALES_INTELLIGENCE_SEARCH_QUERY_FAILED", result.error);
    return { error: "Unable to search leads", ok: false };
  }

  return {
    data: buildSalesIntelligenceSearchResponse(
      (result.data ?? []) as SalesIntelligenceSearchRow[],
      userId,
      input,
    ),
    ok: true,
  };
}

export async function loadSalesIntelligenceLeadDetail(
  admin: AdminClient,
  userId: string,
  leadId: string,
  timelineLimit: number,
): Promise<DataResult<ReturnType<typeof buildSalesIntelligenceDetail>>> {
  const leadResult = await admin
    .from("leads")
    .select(
      "id,user_id,full_name,status,source,priority,value,notes,reason_not_closed,created_at,updated_at,closed_at,last_contact_date,next_action_date,next_action_type",
    )
    .eq("user_id", userId)
    .eq("id", leadId)
    .maybeSingle();

  if (leadResult.error) {
    logDatabaseError("SALES_INTELLIGENCE_LEAD_QUERY_FAILED", leadResult.error);
    return { error: "Unable to load lead intelligence", ok: false };
  }

  if (!leadResult.data) {
    return { data: null, ok: true };
  }

  const [activitiesResult, oldestActivityResult, tasksResult, sourceResult] = await Promise.all([
    admin
      .from("lead_sales_activities")
      .select("id,user_id,lead_id,occurred_at,activity_type,direction,outcome,summary,source,created_at")
      .eq("user_id", userId)
      .eq("lead_id", leadId)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(timelineLimit + 1),
    admin
      .from("lead_sales_activities")
      .select("occurred_at")
      .eq("user_id", userId)
      .eq("lead_id", leadId)
      .order("occurred_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from("tasks")
      .select(
        "id,user_id,linked_lead_id,title,description,status,priority,due_date,completed_at,deleted_at,is_automated,created_at",
      )
      .eq("user_id", userId)
      .eq("linked_lead_id", leadId)
      .is("deleted_at", null)
      .limit(25),
    admin
      .from("lead_external_sources")
      .select("user_id,lead_id,provider,submitted_at,received_at,form_name,campaign_name")
      .eq("user_id", userId)
      .eq("lead_id", leadId)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (activitiesResult.error) {
    logDatabaseError("SALES_INTELLIGENCE_ACTIVITIES_QUERY_FAILED", activitiesResult.error);
    return { error: "Unable to load lead intelligence", ok: false };
  }
  if (oldestActivityResult.error) {
    logDatabaseError("SALES_INTELLIGENCE_OLDEST_ACTIVITY_QUERY_FAILED", oldestActivityResult.error);
    return { error: "Unable to load lead intelligence", ok: false };
  }
  if (tasksResult.error) {
    logDatabaseError("SALES_INTELLIGENCE_TASKS_QUERY_FAILED", tasksResult.error);
    return { error: "Unable to load lead intelligence", ok: false };
  }
  if (sourceResult.error) {
    logDatabaseError("SALES_INTELLIGENCE_SOURCE_QUERY_FAILED", sourceResult.error);
    return { error: "Unable to load lead intelligence", ok: false };
  }

  return {
    data: buildSalesIntelligenceDetail({
      activities: (activitiesResult.data ?? []) as SalesIntelligenceActivityRow[],
      lead: leadResult.data as SalesIntelligenceLeadRow,
      leadId,
      source: sourceResult.data as SalesIntelligenceSourceRow | null,
      tasks: (tasksResult.data ?? []) as SalesIntelligenceTaskRow[],
      tenantUserId: userId,
      timelineLimit,
      timelineReliableFrom: oldestActivityResult.data?.occurred_at ?? null,
    }),
    ok: true,
  };
}
