/**
 * Local job worker. Polls every 2 s; `--once` drains what is due and exits (used in CI).
 * Usage: npm run jobs:work   |   npx tsx scripts/worker.ts --once
 */
import { getDb } from "../src/db";
import { runJobs, scheduleMaintenance } from "../src/server/job-handlers";

const once = process.argv.includes("--once");
const db = await getDb();
await scheduleMaintenance(db);
do {
  const r = await runJobs(db, { deadlineMs: 10_000 });
  if (r.done || r.retried || r.dead) console.log(`[worker] done ${r.done}, retried ${r.retried}, dead ${r.dead}`);
  if (!once) await new Promise((res) => setTimeout(res, 2_000));
} while (!once);
process.exit(0);
