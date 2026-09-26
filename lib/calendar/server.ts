import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "./crypto";
import { addDays, dateKey, DEFAULT_TIME_ZONE, midnight, normalizeEvents, weekBounds, type CalendarEvent, type GoogleEvent } from "@/lib/expenses/model";

type Connection = {
  user_id: string; generation: string; token_ciphertext: string | null;
  oauth_state_hash: string | null; oauth_verifier_ciphertext: string | null; oauth_expires_at: string | null;
  time_zone: string; reconnect_required: boolean; last_synced_at: string | null; sync_until: string | null; sync_lease_until: string;
};
type Table<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };
type CalendarDatabase = { public: {
  Tables: { google_calendar_connections: Table<Connection>; google_calendar_events: Table<CalendarEvent & { user_id: string }> };
  Views: Record<string, never>;
  Functions: { publish_calendar_snapshot: { Args: { p_user_id: string; p_generation: string; p_events: CalendarEvent[]; p_time_zone: string; p_until: string }; Returns: boolean } };
} };
export function calendarAdmin() {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Calendar server configuration unavailable");
  return client as unknown as SupabaseClient<CalendarDatabase>;
}
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";
export function calendarConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  const encodedKey = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
  if (!clientId || !clientSecret || !redirectUri || !encodedKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const uri = new URL(redirectUri);
    if (uri.pathname !== "/api/calendar/callback" || uri.search || uri.hash || uri.username || uri.password || (uri.protocol !== "https:" && !(uri.protocol === "http:" && uri.hostname === "localhost"))) return null;
    const key = Buffer.from(encodedKey, "base64");
    if (key.length !== 32) return null;
    return { clientId, clientSecret, redirectUri, key };
  } catch { return null; }
}
export async function readConnection(userId: string) {
  const { data, error } = await calendarAdmin().from("google_calendar_connections").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Calendar connection unavailable");
  return data;
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function startConnection(userId: string) {
  const config = calendarConfig();
  if (!config) throw new Error("Calendar configuration unavailable");
  const state = randomBytes(32).toString("base64url"), verifier = randomBytes(48).toString("base64url");
  const { error } = await calendarAdmin().from("google_calendar_connections").upsert({
    user_id: userId, oauth_state_hash: hash(state), oauth_verifier_ciphertext: encryptToken(verifier, userId, config.key),
    oauth_expires_at: new Date(Date.now() + 600000).toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new Error("Calendar connection unavailable");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri,
    response_type: "code", scope: CALENDAR_SCOPE, access_type: "offline", prompt: "consent", state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
  return { state, url: url.toString() };
}
class GoogleRevokedError extends Error {}
async function tokenRequest(params: Record<string, string>) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params),
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) {
    if (data.error === "invalid_grant") throw new GoogleRevokedError();
    throw new Error("Google authorization unavailable");
  }
  if (typeof data.access_token !== "string") throw new Error("Invalid Google response");
  return data as { access_token: string; refresh_token?: string; scope?: string };
}
export async function finishConnection(userId: string, code: string, state: string) {
  const config = calendarConfig();
  if (!config) throw new Error("Calendar configuration unavailable");
  const admin = calendarAdmin();
  const connection = await readConnection(userId);
  if (!connection?.oauth_verifier_ciphertext || connection.oauth_state_hash !== hash(state) || !connection.oauth_expires_at || Date.parse(connection.oauth_expires_at) < Date.now()) throw new Error("Invalid OAuth state");
  // Consume before exchange. The browser cookie and owner-bound state must both match.
  const { data: claimed, error } = await admin.from("google_calendar_connections").update({ oauth_state_hash: null, oauth_verifier_ciphertext: null, oauth_expires_at: null })
    .eq("user_id", userId).eq("oauth_state_hash", hash(state)).select("user_id").maybeSingle();
  if (error || !claimed) throw new Error("OAuth state already consumed");
  const tokens = await tokenRequest({ client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri,
    grant_type: "authorization_code", code, code_verifier: decryptToken(connection.oauth_verifier_ciphertext, userId, config.key) });
  if (!tokens.refresh_token || !tokens.scope?.split(" ").includes(CALENDAR_SCOPE)) throw new Error("Calendar permission required");
  // A generation change invalidates any in-flight sync from the previous connection.
  const { data, error: saveError } = await admin.from("google_calendar_connections").update({ token_ciphertext: encryptToken(tokens.refresh_token, userId, config.key),
    generation: randomUUID(), reconnect_required: false, last_synced_at: null, sync_until: null, sync_lease_until: new Date(0).toISOString() })
    .eq("user_id", userId).eq("generation", connection.generation).select("user_id").maybeSingle();
  if (saveError || !data) throw new Error("Connection changed");
}

export async function syncCalendar(userId: string) {
  const config = calendarConfig();
  if (!config) throw new Error("Calendar configuration unavailable");
  const admin = calendarAdmin();
  const connection = await readConnection(userId);
  if (!connection?.token_ciphertext || connection.reconnect_required) throw new Error("Reconnect required");
  const generation = randomUUID();
  const { data: claimed, error } = await admin.from("google_calendar_connections")
    .update({ generation, sync_lease_until: new Date(Date.now() + 300000).toISOString() })
    .eq("user_id", userId).eq("generation", connection.generation).lt("sync_lease_until", new Date().toISOString()).select("user_id").maybeSingle();
  if (error || !claimed) throw new Error("Sync already running");
  try {
    const tokens = await tokenRequest({ client_id: config.clientId, client_secret: config.clientSecret, grant_type: "refresh_token", refresh_token: decryptToken(connection.token_ciphertext, userId, config.key) });
    const today = dateKey(new Date());
    // Padding covers all calendar timezones; actual totals use the returned calendar timezone.
    const until = addDays(today, 100);
    const from = addDays(weekBounds(today).start, -2);
    const events: GoogleEvent[] = [];
    let pageToken = "", timeZone = DEFAULT_TIME_ZONE;
    for (let page = 0; page < 20; page++) {
      const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
      url.search = new URLSearchParams({ singleEvents: "true", showDeleted: "false", maxResults: "1000",
        timeMin: new Date(midnight(from)).toISOString(), timeMax: new Date(midnight(until)).toISOString(),
        fields: "nextPageToken,timeZone,items(id,iCalUID,summary,status,start,end)", ...(pageToken ? { pageToken } : {}) }).toString();
      const response = await fetch(url, { headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (response.status === 401 || response.status === 403) throw new GoogleRevokedError();
      if (!response.ok) throw new Error("Calendar sync unavailable");
      const payload = await response.json();
      if (!Array.isArray(payload.items)) throw new Error("Invalid Calendar response");
      if (payload.timeZone) {
        new Intl.DateTimeFormat("en", { timeZone: payload.timeZone }).format();
        timeZone = payload.timeZone;
      }
      events.push(...payload.items);
      if (events.length > 10000) throw new Error("Calendar sync limit exceeded");
      pageToken = payload.nextPageToken || "";
      if (!pageToken) break;
    }
    if (pageToken) throw new Error("Incomplete Calendar snapshot");
    const { data, error: publishError } = await admin.rpc("publish_calendar_snapshot", { p_user_id: userId, p_generation: generation,
      p_events: normalizeEvents(events, timeZone), p_time_zone: timeZone, p_until: addDays(until, -2) });
    if (publishError || !data) throw new Error("Calendar snapshot unavailable");
  } catch (error) {
    if (error instanceof GoogleRevokedError) {
      await admin.from("google_calendar_connections").update({ reconnect_required: true, token_ciphertext: null }).eq("user_id", userId).eq("generation", generation);
    }
    throw error;
  } finally {
    await admin.from("google_calendar_connections").update({ sync_lease_until: new Date(0).toISOString() }).eq("user_id", userId).eq("generation", generation);
  }
}
export async function disconnectCalendar(userId: string) {
  const connection = await readConnection(userId);
  if (!connection) return false;
  if (connection?.token_ciphertext) {
    const config = calendarConfig();
    if (!config) throw new Error("Calendar configuration unavailable");
    let response: Response;
    try {
      response = await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: decryptToken(connection.token_ciphertext, userId, config.key) }), signal: AbortSignal.timeout(10000) });
    } catch {
      throw new Error("Google authorization could not be revoked; retry disconnect");
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (response.status !== 400 || body?.error !== "invalid_token") throw new Error("Google authorization could not be revoked; retry disconnect");
    }
  }
  const { data, error } = await calendarAdmin().from("google_calendar_connections")
    .delete().eq("user_id", userId).eq("generation", connection.generation).select("user_id");
  if (error || data?.length !== 1) throw new Error("Connection changed during disconnect; retry");
  return true;
}
