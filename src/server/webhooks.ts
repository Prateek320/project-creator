/**
 * Brand webhook signing secrets: encrypted at rest, shown exactly once, rotated with overlap.
 *
 * After a rotation the previous secret keeps verifying for 24 hours, so a brand can deploy the
 * new secret to its backend without dropping events in between.
 */
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { organizations } from "@/db/schema";
import { verifySignature } from "@/domain/attribution";
import { audit, requireBrand, type Actor, type Executor } from "./core";
import { decryptSecret, encryptSecret } from "./crypto";

export const ROTATION_OVERLAP_MS = 24 * 60 * 60 * 1000;

export const newWebhookSecret = () => randomBytes(32).toString("hex");

type OrgSecrets = Pick<typeof organizations.$inferSelect, "webhookSecretEnc" | "webhookSecretPrevEnc" | "webhookSecretRotatedAt">;

/** Generates a new secret (or the first one) and returns it in plain text. Callers must show it once and never store it. */
export async function rotateWebhookSecret(db: Executor, actor: Actor): Promise<string> {
  requireBrand(actor);
  const [org] = await db.select().from(organizations).where(eq(organizations.id, actor.orgId!));
  if (!org) throw new Error("Organisation missing for brand actor");
  const secret = newWebhookSecret();
  await db
    .update(organizations)
    .set({ webhookSecretEnc: encryptSecret(secret), webhookSecretPrevEnc: org.webhookSecretEnc, webhookSecretRotatedAt: new Date() })
    .where(eq(organizations.id, org.id));
  await audit(db, actor, "organization", org.id, org.webhookSecretEnc ? "webhook_secret_rotated" : "webhook_secret_created");
  return secret;
}

/** Accepts the current secret, or the previous one within the rotation overlap window. */
export function verifyOrgSignature(org: OrgSecrets, body: string, signature: string | null, now = new Date()): boolean {
  if (org.webhookSecretEnc && verifySignature(decryptSecret(org.webhookSecretEnc), body, signature)) return true;
  const inOverlap = org.webhookSecretRotatedAt && now.getTime() - org.webhookSecretRotatedAt.getTime() < ROTATION_OVERLAP_MS;
  return Boolean(inOverlap && org.webhookSecretPrevEnc && verifySignature(decryptSecret(org.webhookSecretPrevEnc), body, signature));
}
