import { createHash } from "node:crypto";

export const LEAD_FOLLOWUPS_READ_SCOPE = "lead_followups:read";
export const LEAD_FOLLOWUPS_TOKEN_PATTERN = /^gflf_[a-f0-9]{64}$/;

export type LeadFollowupsCredentialRecord = {
  expires_at: string | null;
  id: string;
  revoked_at: string | null;
  scopes: string[];
  token_hash: string;
  user_id: string;
};

export type CredentialAccessResult =
  | { ok: true }
  | { code: "expired" | "invalid" | "revoked"; ok: false; status: 401 }
  | { code: "missing_scope"; ok: false; status: 403 };

export function parseBearerToken(authorization: string | null) {
  const match = /^Bearer\s+(.+)$/i.exec(authorization?.trim() ?? "");
  const token = match?.[1]?.trim() ?? "";
  return LEAD_FOLLOWUPS_TOKEN_PATTERN.test(token) ? token : null;
}

export function hashLeadFollowupsToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function getCredentialAccess(
  credential: LeadFollowupsCredentialRecord | null | undefined,
  now: Date = new Date(),
): CredentialAccessResult {
  if (!credential) {
    return { code: "invalid", ok: false, status: 401 };
  }

  if (credential.revoked_at) {
    return { code: "revoked", ok: false, status: 401 };
  }

  if (credential.expires_at) {
    const expiresAt = new Date(credential.expires_at).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
      return { code: "expired", ok: false, status: 401 };
    }
  }

  if (!credential.scopes.includes(LEAD_FOLLOWUPS_READ_SCOPE)) {
    return { code: "missing_scope", ok: false, status: 403 };
  }

  return { ok: true };
}
