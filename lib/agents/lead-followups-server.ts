import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCredentialAccess,
  hashLeadFollowupsToken,
  parseBearerToken,
  type LeadFollowupsCredentialRecord,
} from "@/lib/agents/lead-followups-credential";
import type {
  LeadFollowupLead,
  LeadFollowupTask,
} from "@/lib/agents/lead-followups";
import { getSubscriptionAccess } from "@/lib/subscriptions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

export type LeadFollowupsAuthContext = {
  admin: AdminClient;
  credentialId: string;
  userId: string;
};

export type LeadFollowupsAuthResult =
  | { context: LeadFollowupsAuthContext; ok: true }
  | { error: string; ok: false; status: 401 | 403 | 500 };

export type LeadFollowupSourceDataResult =
  | { leads: LeadFollowupLead[]; ok: true; tasks: LeadFollowupTask[] }
  | { error: string; ok: false };

function logDatabaseError(event: string, error: { code?: string; message?: string }) {
  console.error(event, {
    code: error.code ?? null,
    message: error.message ?? null,
  });
}

export async function authenticateLeadFollowupsRequest(
  request: Request,
): Promise<LeadFollowupsAuthResult> {
  const token = parseBearerToken(request.headers.get("authorization"));

  if (!token) {
    return { error: "Invalid or missing credential", ok: false, status: 401 };
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    console.error("LEAD_FOLLOWUPS_CONFIGURATION_MISSING", {
      component: "supabase_admin",
    });
    return { error: "Integration is not configured", ok: false, status: 500 };
  }

  const tokenHash = hashLeadFollowupsToken(token);
  const { data, error } = await admin
    .from("agent_integration_credentials")
    .select("id,user_id,token_hash,scopes,expires_at,revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    logDatabaseError("LEAD_FOLLOWUPS_CREDENTIAL_LOOKUP_FAILED", error);
    return { error: "Unable to verify integration access", ok: false, status: 500 };
  }

  const credential = data as LeadFollowupsCredentialRecord | null;
  const access = getCredentialAccess(credential);
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
    logDatabaseError("LEAD_FOLLOWUPS_SUBSCRIPTION_LOOKUP_FAILED", subscriptionError);
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

export async function loadLeadFollowupSourceData(
  admin: AdminClient,
  userId: string,
  dayStartIso: string,
  dayEndIso: string,
): Promise<LeadFollowupSourceDataResult> {
  const [leadsResult, activeTasksResult, completedTasksResult] = await Promise.all([
    admin
      .from("leads")
      .select(
        "id,user_id,full_name,status,created_at,updated_at,last_contact_date,next_action_date,next_action_type,priority,deal_probability,value",
      )
      .eq("user_id", userId),
    admin
      .from("tasks")
      .select("id,user_id,linked_lead_id,status,due_date,completed_at,deleted_at,created_at")
      .eq("user_id", userId)
      .not("linked_lead_id", "is", null)
      .is("deleted_at", null)
      .in("status", ["פתוחה", "בתהליך", "נדחתה"]),
    admin
      .from("tasks")
      .select("id,user_id,linked_lead_id,status,due_date,completed_at,deleted_at,created_at")
      .eq("user_id", userId)
      .not("linked_lead_id", "is", null)
      .is("deleted_at", null)
      .eq("status", "הושלמה")
      .gte("completed_at", dayStartIso)
      .lt("completed_at", dayEndIso),
  ]);

  if (leadsResult.error) {
    logDatabaseError("LEAD_FOLLOWUPS_LEADS_QUERY_FAILED", leadsResult.error);
    return { error: "Unable to load lead follow-ups", ok: false };
  }

  if (activeTasksResult.error) {
    logDatabaseError("LEAD_FOLLOWUPS_ACTIVE_TASKS_QUERY_FAILED", activeTasksResult.error);
    return { error: "Unable to load lead follow-ups", ok: false };
  }

  if (completedTasksResult.error) {
    logDatabaseError("LEAD_FOLLOWUPS_COMPLETED_TASKS_QUERY_FAILED", completedTasksResult.error);
    return { error: "Unable to load lead follow-ups", ok: false };
  }

  return {
    leads: (leadsResult.data ?? []) as LeadFollowupLead[],
    ok: true,
    tasks: [
      ...((activeTasksResult.data ?? []) as LeadFollowupTask[]),
      ...((completedTasksResult.data ?? []) as LeadFollowupTask[]),
    ],
  };
}
