/**
 * Fixed-window rate limiter backed by Postgres, so every server instance (and every serverless
 * invocation) shares one count. One round trip: an upsert that starts a new window when the old
 * one has expired. Stale rows are pruned by the maintenance.prune job.
 *
 * Move to Upstash Redis only if this adds more than 20 ms p95 to a hot route (backend plan, Phase 5).
 */
import { sql } from "drizzle-orm";
import type { Executor } from "./core";

/** Returns true when the request is allowed. */
export async function rateLimit(db: Executor, key: string, limit: number, windowMs: number): Promise<boolean> {
  const res = await db.execute(sql`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start <= now() - (${windowMs} * interval '1 millisecond') then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start <= now() - (${windowMs} * interval '1 millisecond') then now() else rate_limits.window_start end
    returning count`);
  const count = (res as unknown as { rows: { count: number }[] }).rows[0]?.count ?? 1;
  return count <= limit;
}

/**
 * Client IP for rate limiting. Prefers x-real-ip (set by Vercel and most reverse proxies), then the
 * last x-forwarded-for hop (appended by the nearest proxy; earlier hops are client-controlled).
 */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const hops = headers.get("x-forwarded-for")?.split(",").map((h) => h.trim()).filter(Boolean);
  return hops?.at(-1) ?? "local";
}
