/**
 * Job registry. Kept apart from ./jobs so services can enqueue without importing every handler
 * (which would make finance → jobs → finance an import cycle).
 */
import { sql } from "drizzle-orm";
import type { DB } from "@/db";
import { processFundingCollect } from "./campaigns";
import { processPayoutTransfer } from "./finance";
import { drain, enqueue, type DrainResult, type JobHandler, type JobKind } from "./jobs";

/** Deletes finished jobs after 14 days and rate-limit windows idle for a day. Dead jobs are kept for review. */
async function prune(db: DB) {
  await db.execute(sql`delete from jobs where status = 'done' and updated_at < now() - interval '14 days'`);
  await db.execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
}

export const HANDLERS: Record<JobKind, JobHandler> = {
  "payout.transfer": (db, p) => processPayoutTransfer(db, String(p.transferId)),
  "funding.collect": (db, p) => processFundingCollect(db, String(p.campaignId)),
  "maintenance.prune": (db) => prune(db),
};

export function runJobs(db: DB, opts?: Parameters<typeof drain>[2]): Promise<DrainResult> {
  return drain(db, HANDLERS, opts);
}

/** Schedules the hourly prune. The hour in the key makes repeated scheduler calls in one hour a no-op. */
export async function scheduleMaintenance(db: DB, now = new Date()) {
  await enqueue(db, "maintenance.prune", {}, { key: `maintenance.prune:${now.toISOString().slice(0, 13)}` });
}
