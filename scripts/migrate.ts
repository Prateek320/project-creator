/**
 * Applies SQL migrations from ./drizzle to DATABASE_URL. Run from the deploy pipeline, never at boot.
 * Usage: DATABASE_URL=postgres://… npm run db:migrate
 */
import { createPostgres, migrateDb } from "../src/db";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required. The embedded PGlite database migrates itself.");
  process.exit(1);
}
const db = await createPostgres(url, 1);
await migrateDb(db, "pg");
console.log("Migrations applied.");
process.exit(0);
