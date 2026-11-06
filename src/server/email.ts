/**
 * Transactional email through the outbox (ADR-003). Services never send directly: `notify()` writes an
 * in-app notification and, in the same transaction, an `email.send` job keyed by the notification id.
 * The job looks the address up when it runs, so the queue holds no personal data and an erased user
 * is simply skipped.
 *
 * Providers: `mock` (default; records in memory, logs in the demo) and `resend` (EMAIL_PROVIDER=resend,
 * RESEND_API_KEY, EMAIL_FROM). Production refuses to "send" through the mock so mail can't be lost silently.
 */
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { notifications, users } from "@/db/schema";
import { audit } from "./core";
import { appEnv, appUrl, isDemo } from "./env";

export interface OutgoingEmail {
  idempotencyKey: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export class PermanentEmailError extends Error {}

export interface EmailProvider {
  readonly name: string;
  send(m: OutgoingEmail): Promise<{ id: string }>;
}

/** Sent mock emails, newest last. Tests read this; it is capped so a long demo can't grow it unbounded. */
export const mockOutbox: OutgoingEmail[] = [];

export const mockEmailProvider: EmailProvider = {
  name: "mock",
  async send(m) {
    if (appEnv() === "production") throw new Error("EMAIL_PROVIDER is not configured in production");
    if (!mockOutbox.some((e) => e.idempotencyKey === m.idempotencyKey)) mockOutbox.push(m);
    if (mockOutbox.length > 200) mockOutbox.shift();
    if (isDemo()) console.info(`[email:mock] to=${m.to} subject=${JSON.stringify(m.subject)}`);
    return { id: `mock_${m.idempotencyKey}` };
  },
};

export const resendProvider: EmailProvider = {
  name: "resend",
  async send(m) {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!key || !from) throw new Error("RESEND_API_KEY and EMAIL_FROM must be set for EMAIL_PROVIDER=resend");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "idempotency-key": m.idempotencyKey },
      body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { id: String(((await res.json()) as { id?: string }).id ?? "") };
    const detail = (await res.text()).slice(0, 300);
    // 4xx other than rate limiting won't succeed on retry (bad address, unverified domain, invalid payload).
    if (res.status >= 400 && res.status < 500 && res.status !== 429) throw new PermanentEmailError(`Resend ${res.status}: ${detail}`);
    throw new Error(`Resend ${res.status}: ${detail}`);
  },
};

export function getEmailProvider(): EmailProvider {
  const name = process.env.EMAIL_PROVIDER ?? "mock";
  if (name === "resend") return resendProvider;
  if (name === "mock") return mockEmailProvider;
  throw new Error(`Unknown EMAIL_PROVIDER "${name}"`);
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderNotificationEmail(n: { title: string; body: string; href: string | null }, base: string) {
  const link = n.href ? `${base}${n.href.startsWith("/") ? "" : "/"}${n.href}` : base;
  const text = `${n.title}\n\n${n.body}\n\nOpen in proovd: ${link}\n\nYou get this email because of activity on your proovd account.`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;color:#181b2c">
<p style="font-size:18px;font-weight:600;margin:0 0 8px">${escapeHtml(n.title)}</p>
<p style="margin:0 0 20px;color:#5b6075">${escapeHtml(n.body)}</p>
<p><a href="${escapeHtml(link)}" style="background:#5e2b8c;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">Open in proovd</a></p>
<p style="font-size:12px;color:#5b6075;margin-top:28px">You get this email because of activity on your proovd account.</p></div>`;
  return { subject: n.title, text, html };
}

/** Job handler. Idempotent: the provider receives the notification id as its idempotency key. */
export async function processEmailSend(db: DB, notificationId: string, provider = getEmailProvider()) {
  const [row] = await db
    .select({ n: notifications, email: users.email, status: users.status })
    .from(notifications)
    .innerJoin(users, eq(notifications.userId, users.id))
    .where(eq(notifications.id, notificationId))
    .limit(1);
  // Notification gone (account erased) or the person can't be reached any more: nothing to send.
  if (!row || row.status !== "active") return;
  const msg = renderNotificationEmail(row.n, appUrl());
  try {
    await provider.send({ idempotencyKey: `notification:${notificationId}`, to: row.email, ...msg });
  } catch (err) {
    if (!(err instanceof PermanentEmailError)) throw err;
    await audit(db, null, "notification", notificationId, "email_rejected", { provider: provider.name, error: err.message });
  }
}
