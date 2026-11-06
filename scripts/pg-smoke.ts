/** Smoke test against a real Postgres: checks ledger integrity after db:migrate and db:seed. Usage: APP_ENV=demo DATABASE_URL=... npm run db:smoke */
import { sql } from "drizzle-orm";
import { getDb, schema } from "../src/db";

const db = await getDb();
const [rows] = await db.select({ n: sql<number>`count(*)::int`, sum: sql<string>`coalesce(sum(amount_minor),0)` }).from(schema.ledgerEntries);
const unbalanced = await db.execute(sql`select transaction_group_id from ledger_entries group by 1 having sum(amount_minor) <> 0`);
const unbalancedGroups = (unbalanced as unknown as { rows: unknown[] }).rows.length;
console.log({ ledgerRows: rows?.n, netSum: rows?.sum, unbalancedGroups });
process.exit(unbalancedGroups === 0 && Number(rows?.sum) === 0 ? 0 : 1);
