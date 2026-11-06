/**
 * Loads demo data. Refuses to run unless APP_ENV=demo, so a real database can never be seeded.
 * Usage: APP_ENV=demo DATABASE_URL=postgres://… npm run db:seed
 */
import { isDemo } from "../src/server/env";

if (!isDemo()) {
  console.error("Refusing to seed: APP_ENV must be demo.");
  process.exit(1);
}
const { getDb } = await import("../src/db");
await getDb(); // getDb() seeds when APP_ENV=demo and the users table is empty
console.log("Demo data ready.");
process.exit(0);
