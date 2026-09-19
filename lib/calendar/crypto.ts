import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Imported only by server-only modules. AAD prevents ciphertext swapping between owners.
export function encryptToken(value: string, owner: string, key: Buffer) {
  if (key.length !== 32) throw new Error("Invalid encryption configuration");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(owner));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(v => v.toString("base64url")).join(".");
}
export function decryptToken(value: string, owner: string, key: Buffer) {
  const parts = value.split(".").map(v => Buffer.from(v, "base64url"));
  if (parts.length !== 3 || key.length !== 32) throw new Error("Invalid encrypted credential");
  const decipher = createDecipheriv("aes-256-gcm", key, parts[0]);
  decipher.setAAD(Buffer.from(owner));
  decipher.setAuthTag(parts[1]);
  return Buffer.concat([decipher.update(parts[2]), decipher.final()]).toString("utf8");
}
