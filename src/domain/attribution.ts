/** Attribution event contract, signature verification and CSV parsing (pure). */
import { createHmac, timingSafeEqual } from "node:crypto";
import { DomainError } from "./types";

export interface AttributionEventPayload {
  event_id: string;
  campaign_id: string;
  creator_id: string;
  event_type: string;
  occurred_at: string;
  value_minor?: number;
  currency?: string;
  source?: string;
  external_order_id?: string | null;
  test?: boolean;
}

const EVENT_TYPES = new Set(["signup", "sale", "lead", "install", "click"]);

export function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifySignature(secret: string, body: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signPayload(secret, body), "hex");
  let given: Buffer;
  try {
    given = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Validates shape. Returns a normalised payload or throws a DomainError explaining what is wrong. */
export function parseEvent(raw: unknown, now = new Date()): AttributionEventPayload {
  if (!raw || typeof raw !== "object") throw new DomainError("Event must be an object", "bad_event");
  const r = raw as Record<string, unknown>;
  const str = (k: string) => {
    const v = r[k];
    if (typeof v !== "string" || v.trim() === "") throw new DomainError(`Missing ${k}`, "bad_event");
    return v.trim();
  };
  const event: AttributionEventPayload = {
    event_id: str("event_id"),
    campaign_id: str("campaign_id"),
    creator_id: str("creator_id"),
    event_type: str("event_type").toLowerCase(),
    occurred_at: str("occurred_at"),
    value_minor: r.value_minor === undefined || r.value_minor === "" ? 0 : Number(r.value_minor),
    currency: typeof r.currency === "string" && r.currency ? r.currency : "INR",
    source: typeof r.source === "string" && r.source ? r.source : "brand_webhook",
    external_order_id: typeof r.external_order_id === "string" ? r.external_order_id : null,
    test: r.test === true || r.test === "true",
  };
  if (event.event_id.length > 128) throw new DomainError("event_id too long", "bad_event");
  if (!EVENT_TYPES.has(event.event_type)) throw new DomainError(`Unknown event_type "${event.event_type}"`, "bad_event");
  if (!Number.isSafeInteger(event.value_minor) || (event.value_minor ?? 0) < 0)
    throw new DomainError("value_minor must be a non-negative integer (paise)", "bad_event");
  const t = new Date(event.occurred_at);
  if (Number.isNaN(t.getTime())) throw new DomainError("occurred_at must be ISO-8601", "bad_event");
  if (t.getTime() > now.getTime() + 5 * 60_000) throw new DomainError("occurred_at is in the future", "bad_event");
  return event;
}

/** Minimal RFC-4180-ish CSV parser (quoted fields, commas, newlines). Header row required. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}
