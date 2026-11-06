/**
 * Uptime check. 200 when the database answers and the job queue is keeping up; 503 otherwise.
 * Reveals nothing about configuration or providers.
 */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { overdueJobCount } from "@/server/jobs";

export const dynamic = "force-dynamic";

const MAX_OVERDUE_JOBS = 50;

export async function GET() {
  const t = Date.now();
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    const dbMs = Date.now() - t;
    const overdue = await overdueJobCount(db);
    const ok = overdue <= MAX_OVERDUE_JOBS;
    return NextResponse.json({ ok, db_ms: dbMs, jobs_overdue: overdue }, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("[health]", err);
    return NextResponse.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
