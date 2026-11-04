/** First-party tracked link: records a deduplicated click, then redirects to the brand's landing page. */
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { recordClick } from "@/server/finance";
import { rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ua = req.headers.get("user-agent") ?? "";
  // Basic bot filtering: obvious crawlers are redirected but not counted.
  const isBot = /bot|crawler|spider|preview|curl|wget/i.test(ua);
  const db = await getDb();
  const fingerprint = createHash("sha256").update(`${ip}|${ua}`).digest("hex");
  const target = isBot || !rateLimit(`click:${ip}`, 30, 60_000) ? null : await recordClick(db, slug, fingerprint);
  if (!target) return NextResponse.redirect(new URL("/", req.url), 302);
  return NextResponse.redirect(target, 302);
}
