/**
 * Durable jobs and outbox (ADR-003, ADR-007).
 *
 * Contract:
 *  - `enqueue` is called inside the same transaction as the state change that needs the job, so
 *    the job exists if and only if that change committed. Re-enqueueing the same key is a no-op.
 *  - The worker claims due jobs with FOR UPDATE SKIP LOCKED, so any number of workers can run.
 *  - Handlers must be idempotent: a job can run more than once (crash after the side effect but
 *    before "done"). Every handler checks state first and passes a stable idempotency key on to
 *    the provider.
 *  - Failures retry with exponential backoff and jitter. After max_attempts the job is "dead",
 *    audited, and left for operations to inspect.
 *  - A job locked for more than 5 minutes is treated as abandoned by a crashed worker and reclaimed.
 */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { DB } from "@/db";
import { jobs } from "@/db/schema";
import { audit, type Executor } from "./core";

export type JobKind = "payout.transfer" | "funding.collect" | "maintenance.prune";
export type JobHandler = (db: DB, payload: Record<string, unknown>) => Promise<void>;

export async function enqueue(
  db: Executor,
  kind: JobKind,
  payload: Record<string, unknown>,
  opts: { key: string; runAt?: Date; maxAttempts?: number },
): Promise<void> {
  await db
    .insert(jobs)
    .values({ kind, payload, idempotencyKey: opts.key, runAt: opts.runAt ?? new Date(), maxAttempts: opts.maxAttempts ?? 8 })
    .onConflictDoNothing({ target: jobs.idempotencyKey });
}

interface ClaimedJob {
  id: string;
  kind: JobKind;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

const rowsOf = <T>(res: unknown): T[] => (res as { rows: T[] }).rows;

const STALE_LOCK = "5 minutes";

async function claim(db: DB, limit: number, workerId: string): Promise<ClaimedJob[]> {
  const res = await db.execute(sql`
    update jobs
       set status = 'running', locked_at = now(), locked_by = ${workerId}, attempts = attempts + 1, updated_at = now()
     where id in (
       select id from jobs
        where (status = 'queued' and run_at <= now())
           or (status = 'running' and locked_at < now() - ${STALE_LOCK}::interval)
        order by run_at
        limit ${limit}
        for update skip locked)
    returning id, kind, payload, attempts, max_attempts`);
  return rowsOf<ClaimedJob>(res);
}

/** 5 s, 10 s, 20 s … capped at 1 h, with ±50% jitter so retries from one incident don't stampede. */
export function backoffMs(attempts: number, rand = Math.random): number {
  const base = Math.min(5_000 * 2 ** Math.max(0, attempts - 1), 3_600_000);
  return Math.round(base * (0.5 + rand() * 0.5));
}

export interface DrainResult {
  done: number;
  retried: number;
  dead: number;
}

/** Runs due jobs until none are left, `limit` per batch, stopping before `deadlineMs` elapses. */
export async function drain(
  db: DB,
  handlers: Record<JobKind, JobHandler>,
  opts: { batch?: number; deadlineMs?: number; workerId?: string } = {},
): Promise<DrainResult> {
  const { batch = 10, deadlineMs = 50_000, workerId = `w-${randomUUID().slice(0, 8)}` } = opts;
  const stopAt = Date.now() + deadlineMs;
  const out: DrainResult = { done: 0, retried: 0, dead: 0 };
  while (Date.now() < stopAt) {
    const claimed = await claim(db, batch, workerId);
    if (claimed.length === 0) break;
    for (const job of claimed) {
      try {
        const handler = handlers[job.kind];
        if (!handler) throw new Error(`No handler for job kind "${job.kind}"`);
        await handler(db, job.payload);
        await db.execute(sql`update jobs set status = 'done', locked_at = null, locked_by = null, last_error = null, updated_at = now() where id = ${job.id}`);
        out.done++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (job.attempts >= job.max_attempts) {
          await db.execute(sql`update jobs set status = 'dead', locked_at = null, locked_by = null, last_error = ${message}, updated_at = now() where id = ${job.id}`);
          await audit(db, null, "job", job.id, "job_dead", { kind: job.kind, attempts: job.attempts, error: message });
          console.error(`[jobs] ${job.kind} ${job.id} is dead after ${job.attempts} attempts: ${message}`);
          out.dead++;
        } else {
          const runAt = new Date(Date.now() + backoffMs(job.attempts));
          await db.execute(
            sql`update jobs set status = 'queued', locked_at = null, locked_by = null, last_error = ${message}, run_at = ${runAt.toISOString()}, updated_at = now() where id = ${job.id}`,
          );
          out.retried++;
        }
      }
    }
  }
  return out;
}

/** Jobs that should have run more than five minutes ago: the health check's backlog signal. */
export async function overdueJobCount(db: Executor): Promise<number> {
  const res = await db.execute(sql`select count(*)::int as n from jobs where status = 'queued' and run_at < now() - interval '5 minutes'`);
  return rowsOf<{ n: number }>(res)[0]?.n ?? 0;
}
