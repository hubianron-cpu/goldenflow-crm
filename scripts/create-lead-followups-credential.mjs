import { createHash, randomBytes } from "node:crypto";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

try {
  process.loadEnvFile?.(".env.local");
} catch {
  // Environment variables may already be supplied by the shell or hosting environment.
}

const userId = process.argv[2]?.trim() ?? "";
const name = process.argv.slice(3).join(" ").trim() || "Lead Follow-ups";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!UUID_PATTERN.test(userId)) {
  console.error("Usage: npm run agent:credential -- <USER_UUID> [credential name]");
  process.exit(1);
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Supabase server environment is not configured.");
  process.exit(1);
}

if (name.length > 100) {
  console.error("Credential name must be 100 characters or fewer.");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: userResult, error: userError } = await admin.auth.admin.getUserById(userId);

if (userError || !userResult.user) {
  console.error("The requested Supabase Auth user does not exist.");
  process.exit(1);
}

const token = `gflf_${randomBytes(32).toString("hex")}`;
const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
const tokenPrefix = token.slice(0, 17);
const { data, error } = await admin
  .from("agent_integration_credentials")
  .insert({
    name,
    scopes: ["lead_followups:read"],
    token_hash: tokenHash,
    token_prefix: tokenPrefix,
    user_id: userId,
  })
  .select("id,token_prefix,created_at")
  .single();

if (error || !data) {
  console.error("Credential creation failed.", {
    code: error?.code ?? null,
    message: error?.message ?? null,
  });
  process.exit(1);
}

console.log("Credential created. Store this token now; it cannot be recovered later.");
console.log(`Token: ${token}`);
console.log(`Credential ID: ${data.id}`);
console.log(`Token prefix: ${data.token_prefix}`);
