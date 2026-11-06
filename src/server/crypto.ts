/**
 * Secrets at rest: AES-256-GCM with a random 96-bit IV per value.
 * Stored as `v1:<iv>:<tag>:<ciphertext>` (base64url parts). The version prefix lets a future key
 * rotation decrypt old values with the old key while new writes use the new one.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { encryptionKey } from "./env";

const VERSION = "v1";

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(":");
}

/** Throws if the value was tampered with or encrypted under a different key. */
export function decryptSecret(stored: string): string {
  const [version, iv, tag, ct] = stored.split(":");
  if (version !== VERSION || !iv || !tag || !ct) throw new Error("Unrecognised encrypted secret format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
