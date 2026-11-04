/** Smoke test against a real Postgres: runs migrations + seed and checks ledger integrity. Usage: DATABASE_URL=... npx tsx scripts/pg-smoke.ts */
import { sql } from "drizzle-orm";
import { getDb, schema } from "../src/db";

const db = await getDb();
const [rows] = await db.select({ n: sql<number>`count(*)::int`, sum: sql<string>`coalesce(sum(amount_minor),0)` }).from(schema.ledgerEntries);
const unbalanced = await db.execute(sql`select transaction_group_id from ledger_entries group by 1 having sum(amount_minor) <> 0`);
console.log({ ledgerRows: rows?.n, netSum: rows?.sum, unbalancedGroups: (unbalanced as unknown as { rows: unknown[] }).rows.length });
process.exit(0);
