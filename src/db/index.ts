/**
 * Database access. Uses real Postgres when DATABASE_URL is set; otherwise an embedded
 * PGlite (Postgres compiled to WASM) persisted in ./.data so the demo runs with zero setup.
 *
 * Boot never changes a real database: against Postgres, migrations run only from the deploy
 * pipeline (`npm run db:migrate`) and demo data only from `npm run db:seed` or the demo itself.
 * The embedded PGlite file has no pipeline, so it migrates itself on first use.
 */
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { seed } from "./seed";
import { isDemo } from "@/server/env";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };

const MIGRATIONS = path.join(process.cwd(), "drizzle");

export async function migrateDb(db: DB, driver: "pglite" | "pg") {
  const { migrate } =
    driver === "pglite" ? await import("drizzle-orm/pglite/migrator") : await import("drizzle-orm/node-postgres/migrator");
  await (migrate as (d: DB, o: { migrationsFolder: string }) => Promise<void>)(db, { migrationsFolder: MIGRATIONS });
}

async function createPglite(dataDir?: string): Promise<DB> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dataDir) (await import("node:fs")).mkdirSync(dataDir, { recursive: true });
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema }) as unknown as DB;
  await migrateDb(db, "pglite");
  return db;
}

/** Connects only. Migrations are the deploy pipeline's job (scripts/migrate.ts). */
export async function createPostgres(url: string, max = 10): Promise<DB> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({ connectionString: url, max });
  return drizzle(pool, { schema }) as unknown as DB;
}

async function init(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  const db = url ? await createPostgres(url) : await createPglite(process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite"));
  // Seed only ever runs in the demo. seed() itself is a no-op once any user exists.
  if (isDemo()) await seed(db);
  return db;
}

const g = globalThis as unknown as { __pcDb?: Promise<DB> };

/** Lazily initialised singleton (survives Next.js dev hot reloads). */
export function getDb(): Promise<DB> {
  if (!g.__pcDb) {
    g.__pcDb = init().catch((err) => {
      g.__pcDb = undefined;
      throw err;
    });
  }
  return g.__pcDb;
}

/** Fresh in-memory database for tests. */
export async function createTestDb(withSeed = true): Promise<DB> {
  const db = await createPglite();
  if (withSeed) await seed(db);
  return db;
}
