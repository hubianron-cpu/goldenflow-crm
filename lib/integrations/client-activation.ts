import { createHmac } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isBusinessCenterWonStatus } from "@/lib/business-center/semantics";

const MAX_OUTBOX_ATTEMPTS = 5;

function config() {
  const enabled = process.env.CLIENT_ACTIVATION_ENABLED?.trim().toLowerCase() === "true";
  const serviceUrl = process.env.CLIENT_ACTIVATION_SERVICE_URL?.trim();
  const webhookSecret = process.env.CLIENT_ACTIVATION_WEBHOOK_SECRET?.trim();
  const authorizedBusinessId = process.env.CLIENT_ACTIVATION_BUSINESS_ID?.trim();
  const protectionBypass = process.env.CLIENT_ACTIVATION_PROTECTION_BYPASS?.trim();
  if (!enabled || !serviceUrl || !webhookSecret || !authorizedBusinessId) return null;
  return { serviceUrl, webhookSecret, authorizedBusinessId, protectionBypass };
}

function clean(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

export async function queueAndDispatchDealWon(leadId: string, userId: string) {
  const settings = config();
  if (!settings) return { status: "not_configured" as const };
  if (userId !== settings.authorizedBusinessId) return { status: "ignored" as const };
  const admin = getSupabaseAdminClient();
  if (!admin) return { status: "not_configured" as const };

  const { data: lead, error: leadError } = await admin
    .from("leads")
    .select("id,user_id,full_name,email,phone,id_number,program,value,currency,status,closed_at,updated_at")
    .eq("id", leadId)
    .eq("user_id", userId)
    .maybeSingle();
  if (leadError || !lead) return { status: "failed" as const, code: "LEAD_NOT_FOUND" };
  if (!isBusinessCenterWonStatus(lead.status)) return { status: "ignored" as const };

  const { error: queueError } = await admin.from("crm_client_activation_outbox").upsert({
    user_id: userId,
    lead_id: leadId,
    event_type: "deal.won"
  }, { onConflict: "user_id,lead_id,event_type", ignoreDuplicates: true });
  if (queueError) return { status: "failed" as const, code: "OUTBOX_QUEUE_FAILED" };

  const { data: outbox, error: outboxError } = await admin
    .from("crm_client_activation_outbox")
    .select("id,attempt_count,delivery_status,created_at")
    .eq("user_id", userId)
    .eq("lead_id", leadId)
    .eq("event_type", "deal.won")
    .single();
  if (outboxError || !outbox) return { status: "failed" as const, code: "OUTBOX_READ_FAILED" };
  if (outbox.delivery_status === "delivered") return { status: "delivered" as const };
  if (outbox.delivery_status === "manual_review" || outbox.attempt_count >= MAX_OUTBOX_ATTEMPTS) {
    return { status: "manual_review" as const };
  }

  const body = JSON.stringify({
    eventId: outbox.id,
    eventType: "deal.won",
    occurredAt: lead.closed_at || lead.updated_at || outbox.created_at,
    businessId: userId,
    crmDealId: lead.id,
    crmClientId: lead.id,
    client: {
      fullName: lead.full_name,
      email: clean(lead.email) || "",
      phone: clean(lead.phone) || "",
      idNumber: clean(lead.id_number) || ""
    },
    program: clean(lead.program) || "",
    dealAmount: Number(lead.value || 0),
    currency: clean(lead.currency) || "ILS"
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", settings.webhookSecret).update(`${timestamp}.${body}`).digest("hex");

  try {
    const response = await fetch(settings.serviceUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goldenflow-timestamp": timestamp,
        "x-goldenflow-signature": `v1=${signature}`,
        ...(settings.protectionBypass
          ? { "x-vercel-protection-bypass": settings.protectionBypass }
          : {})
      },
      body,
      cache: "no-store"
    });
    const nextAttempts = outbox.attempt_count + 1;
    if (response.ok) {
      await admin.from("crm_client_activation_outbox").update({
        delivery_status: "delivered",
        attempt_count: nextAttempts,
        last_error: null,
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq("id", outbox.id);
      return { status: "delivered" as const };
    }
    const manualReview = nextAttempts >= MAX_OUTBOX_ATTEMPTS || response.status < 500;
    await admin.from("crm_client_activation_outbox").update({
      delivery_status: manualReview ? "manual_review" : "failed",
      attempt_count: nextAttempts,
      last_error: `HTTP_${response.status}`,
      updated_at: new Date().toISOString()
    }).eq("id", outbox.id);
    return { status: manualReview ? "manual_review" as const : "failed" as const, code: `HTTP_${response.status}` };
  } catch {
    const nextAttempts = outbox.attempt_count + 1;
    await admin.from("crm_client_activation_outbox").update({
      delivery_status: nextAttempts >= MAX_OUTBOX_ATTEMPTS ? "manual_review" : "failed",
      attempt_count: nextAttempts,
      last_error: "NETWORK_ERROR",
      updated_at: new Date().toISOString()
    }).eq("id", outbox.id);
    return { status: nextAttempts >= MAX_OUTBOX_ATTEMPTS ? "manual_review" as const : "failed" as const, code: "NETWORK_ERROR" };
  }
}

export async function reconcileAndDispatchDealWon() {
  const settings = config();
  const admin = getSupabaseAdminClient();
  if (!settings || !admin) return { processed: 0, status: "not_configured" as const };
  const { data, error } = await admin
    .from("leads")
    .select("id,user_id,status")
    .eq("user_id", settings.authorizedBusinessId)
    .in("status", ["נסגר בהצלחה", "נסגר", "won"])
    .order("updated_at", { ascending: true })
    .limit(20);
  if (error) return { processed: 0, status: "failed" as const };
  const results = [];
  for (const lead of data || []) results.push(await queueAndDispatchDealWon(lead.id, lead.user_id));
  return { processed: results.length, status: "ok" as const };
}
