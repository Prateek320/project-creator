/**
 * Job worker endpoint, called every minute by Vercel Cron (or any scheduler) with
 * `Authorization: Bearer $CRON_SECRET`. Drains due jobs for up to 50 s, inside the function limit.
 */
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { cronSecret } from "@/server/env";
import { runJobs, scheduleMaintenance } from "@/server/job-handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(req: Request): boolean {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${cronSecret()}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = await getDb();
  await scheduleMaintenance(db);
  const result = await runJobs(db, { deadlineMs: 50_000 });
  return NextResponse.json({ ok: true, ...result });
}
