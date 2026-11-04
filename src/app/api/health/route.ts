import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const t = Date.now();
  const db = await getDb();
  await db.execute(sql`select 1`);
  return NextResponse.json({ ok: true, db_ms: Date.now() - t, payments: process.env.PAYMENT_PROVIDER ?? "mock" });
}
