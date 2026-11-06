/**
 * Brand conversion webhook.
 *   POST /api/v1/attribution/events
 *   x-pc-org: <organization id>
 *   x-pc-signature: sha256=<hex HMAC-SHA256 of the raw body using the org's webhook secret>
 *                   (the previous secret is also accepted for 24 h after a rotation)
 *   body: one event object, an array of events, or { "events": [...] }
 * Idempotent: replaying an event_id is counted once.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ingestEvents } from "@/server/finance";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { verifyOrgSignature } from "@/server/webhooks";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const orgId = req.headers.get("x-pc-org") ?? "";
  const db = await getDb();
  if (!(await rateLimit(db, `webhook:${orgId}:${clientIp(req.headers)}`, 120, 60_000))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
  }
  const body = await req.text();
  if (body.length > 1_000_000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) return NextResponse.json({ error: "unknown_org" }, { status: 401 });
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
  // Same response for unknown org and bad signature: don't reveal which tenants exist.
  if (!org || !verifyOrgSignature(org, body, req.headers.get("x-pc-signature"))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const events = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && Array.isArray((parsed as { events?: unknown }).events) ? (parsed as { events: unknown[] }).events : [parsed];
  try {
    const result = await ingestEvents(db, org.id, events, "brand_webhook");
    return NextResponse.json(result, { status: result.rejected.length && !result.accepted && !result.duplicates ? 422 : 200 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 400 });
  }
}
