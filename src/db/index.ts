/**
 * Database access. Uses real Postgres when DATABASE_URL is set; otherwise an embedded
 * PGlite (Postgres compiled to WASM) persisted in ./.data so the demo runs with zero setup.
 * Both paths run the same SQL migrations from ./drizzle.
 */
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { seed } from "./seed";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };

const MIGRATIONS = path.join(process.cwd(), "drizzle");

async function createPglite(dataDir?: string): Promise<DB> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dataDir) (await import("node:fs")).mkdirSync(dataDir, { recursive: true });
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

async function createPostgres(url: string): Promise<DB> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const pool = new Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

async function init(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  const db = url ? await createPostgres(url) : await createPglite(path.join(process.cwd(), ".data", "pglite"));
  await seed(db);
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
