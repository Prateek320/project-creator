import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { loginAs } from "@/app/actions";
import { Logo } from "@/components/logo";
import { Avatar, Card, Flash, buttonClass } from "@/components/ui";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isDemo } from "@/server/env";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const SCENARIOS: Record<string, string> = {
  "aarav@glowbotanics.demo": "Review Meera's final Story, approve the settlement, compare applicants",
  "nisha@urbanstride.demo": "Performance campaign with a dispute on returned orders",
  "meera@creators.demo": "Active hybrid collaboration, tracked link and earnings, verified history",
  "kabir@creators.demo": "Performance creator with part of his payout held in dispute",
  "zoya@creators.demo": "Has an offer waiting to be accepted",
  "ritu@ops.demo": "Resolve disputes, review excluded events, verify accounts",
};

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  // Demo sign-in only. Real sign-in arrives with managed auth (slice 2).
  if (!isDemo()) notFound();
  const sp = await searchParams;
  const db = await getDb();
  const users = await db.select().from(schema.users).orderBy(schema.users.role);
  const featured = users.filter((u) => SCENARIOS[u.email]);
  const others = users.filter((u) => !SCENARIOS[u.email] && u.role === "creator");
  const orgs = await db.select({ email: schema.users.email, org: schema.organizations.displayName }).from(schema.memberships)
    .innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
    .innerJoin(schema.organizations, eq(schema.memberships.organizationId, schema.organizations.id));
  const orgOf = (email: string) => orgs.find((o) => o.email === email)?.org;
  const order = sp.as === "creator" ? ["creator", "brand", "admin"] : ["brand", "creator", "admin"];
  featured.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));

  return (
    <div className="min-h-dvh">
      <main id="main" className="page-enter mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <Link href="/"><Logo /></Link>
        <h1 className="mt-10 text-[28px] font-bold tracking-[-0.02em]">Sign in to the demo</h1>
        <p className="mt-1 text-muted">Pick a seeded account. Each one lands mid-workflow so you can try the full loop. Authentication here is a demo stand-in for a managed auth provider.</p>
        <div className="mt-8"><Flash sp={sp} /></div>
        <Card className="divide-y divide-line-2">
          {featured.map((u) => (
            <form key={u.id} action={loginAs} className="flex items-center gap-4 px-6 py-5">
              <input type="hidden" name="email" value={u.email} />
              <Avatar name={u.name} color={u.role === "brand" ? "#0f172a" : u.role === "admin" ? "#b45309" : undefined} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{u.name}</span>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs capitalize text-muted">{u.role === "admin" ? "Operations" : u.role}{orgOf(u.email) ? ` · ${orgOf(u.email)}` : ""}</span>
                </div>
                <div className="mt-0.5 text-sm text-muted">{SCENARIOS[u.email]}</div>
              </div>
              <button className={buttonClass("secondary", "sm")}>Continue <ArrowRight size={14} aria-hidden /></button>
            </form>
          ))}
        </Card>
        <details className="mt-4">
          <summary className="text-sm font-medium text-accent">More creator accounts ({others.length})</summary>
          <Card className="mt-2 divide-y divide-line-2">
            {others.map((u) => (
              <form key={u.id} action={loginAs} className="flex items-center gap-3 px-6 py-4">
                <input type="hidden" name="email" value={u.email} />
                <span className="flex-1 text-sm">{u.name}</span>
                <button className="text-sm font-medium text-accent hover:underline">Sign in</button>
              </form>
            ))}
          </Card>
        </details>
      </main>
    </div>
  );
}
