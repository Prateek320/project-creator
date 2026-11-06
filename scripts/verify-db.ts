/**
 * Sanity checks for a database, used by the restore drill (docs/runbooks/restore-drill.md) and
 * after any manual recovery. Read-only.
 *   DATABASE_URL=postgres://… npx tsx scripts/verify-db.ts
 * Exits 1 if any ledger transaction group doesn't balance or migrations are missing.
 */
import { readdirSync } from "node:fs";
import { sql } from "drizzle-orm";
import { createPostgres } from "../src/db";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const db = await createPostgres(url, 1);
const rows = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as { rows: T[] };
let ok = true;

const expected = readdirSync("drizzle").filter((f) => f.endsWith(".sql")).length;
const applied = (await rows<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`)).rows[0]!.n;
console.log(`migrations: ${applied} applied, ${expected} in repo`);
if (applied < expected) ok = false;

for (const t of ["users", "organizations", "campaigns", "agreements", "ledger_entries", "payment_transfers", "audit_events", "jobs", "data_requests"]) {
  const n = (await rows<{ n: number }>(sql.raw(`select count(*)::int as n from "${t}"`))).rows[0]!.n;
  console.log(`${t.padEnd(20)} ${n}`);
}

const unbalanced = (
  await rows<{ g: string; s: string }>(sql`select transaction_group_id as g, sum(amount_minor)::text as s from ledger_entries group by 1 having sum(amount_minor) <> 0 limit 10`)
).rows;
console.log(`unbalanced ledger groups: ${unbalanced.length}`);
for (const u of unbalanced) console.log(`  ${u.g} sums to ${u.s}`);
if (unbalanced.length) ok = false;

const latest = (await rows<{ ledger: string | null; audit: string | null }>(sql`select (select max(created_at) from ledger_entries)::text as ledger, (select max(created_at) from audit_events)::text as audit`)).rows[0]!;
console.log(`latest ledger entry: ${latest.ledger ?? "none"}\nlatest audit event: ${latest.audit ?? "none"}`);

const dead = (await rows<{ n: number }>(sql`select count(*)::int as n from jobs where status = 'dead'`)).rows[0]!.n;
console.log(`dead jobs: ${dead}`);

console.log(ok ? "VERIFY OK" : "VERIFY FAILED");
process.exit(ok ? 0 : 1);
