import Link from "next/link";
import { Logo } from "@/components/logo";
import { ButtonLink, Card, Badge } from "@/components/ui";
import { getActor, homeFor } from "@/server/session";

const steps = [
  { n: "01", t: "Publish a clear brief", b: "Objective, deliverables, dates, usage rights and the payout formula — all visible before anyone applies." },
  { n: "02", t: "Hire on evidence", b: "Compare applicants on verified track record, audience fit and on-time delivery — not just follower counts." },
  { n: "03", t: "Agree, then execute", b: "Both sides accept a versioned agreement. Content, revisions and deadlines live in one workspace." },
  { n: "04", t: "Settle what was verified", b: "Tracked links, coupon codes and signed brand events feed a transparent, reproducible settlement." },
];

export default async function Landing() {
  const actor = await getActor();
  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {actor ? (
            <ButtonLink href={homeFor(actor)} size="sm">Open workspace</ButtonLink>
          ) : (
            <ButtonLink href="/login" variant="secondary" size="sm">Sign in</ButtonLink>
          )}
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-16">
          <div>
            <Badge tone="accent">Built for India · INR · Instagram & YouTube</Badge>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl">
              Creator partnerships with clear terms, verified outcomes and dependable payouts.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Know what you&apos;re agreeing to. Know what happened. Know what you&apos;ll earn.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Link href="/login?as=brand" className="group rounded-2xl border border-line p-5 transition-colors hover:border-accent hover:bg-accent-50">
                <div className="text-sm font-semibold text-accent">I&apos;m a brand or agency →</div>
                <p className="mt-1 text-sm text-muted">Launch a campaign, hire creators on evidence, pay for verified results.</p>
              </Link>
              <Link href="/login?as=creator" className="group rounded-2xl border border-line p-5 transition-colors hover:border-accent hover:bg-accent-50">
                <div className="text-sm font-semibold text-accent">I&apos;m a creator →</div>
                <p className="mt-1 text-sm text-muted">Find paid work, see the payout formula up front, build a verified track record.</p>
              </Link>
            </div>
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Example: hybrid compensation</div>
              <Badge tone="good">Verified events</Badge>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted">Guaranteed base</div>
                <div className="tnum text-2xl font-semibold">₹3,000</div>
                <div className="text-xs text-muted">for approved Reel + Stories</div>
              </div>
              <div>
                <div className="text-xs text-muted">Per verified signup</div>
                <div className="tnum text-2xl font-semibold">₹70</div>
                <div className="text-xs text-muted">capped at ₹10,000</div>
              </div>
            </div>
            <div className="mt-6 border-t border-line pt-5">
              <div className="flex items-baseline justify-between">
                <div className="text-xs font-medium uppercase tracking-wide text-muted">Actual performance</div>
                <div className="text-xs text-muted">50 of 100 target</div>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 w-1/2 rounded-full bg-accent" /></div>
              <dl className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Base (deliverables approved)</dt><dd className="tnum">₹3,000</dd></div>
                <div className="flex justify-between"><dt className="text-muted">50 verified signups × ₹70</dt><dd className="tnum">₹3,500</dd></div>
                <div className="flex justify-between"><dt className="text-muted">3 duplicates, 1 test signup</dt><dd className="tnum text-muted">excluded</dd></div>
                <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Creator earns</dt><dd className="tnum">₹6,500</dd></div>
              </dl>
              <p className="mt-4 text-xs text-muted">
                50% of target doesn&apos;t mean 50% of budget. Payment follows the formula both sides accepted — creators aren&apos;t penalised for a brand&apos;s landing page.
              </p>
            </div>
          </Card>
        </section>

        <section className="border-t border-line bg-canvas">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s) => (
                <Card key={s.n} className="p-5">
                  <div className="tnum text-xs font-semibold text-accent">{s.n}</div>
                  <div className="mt-2 font-semibold">{s.t}</div>
                  <p className="mt-1 text-sm text-muted">{s.b}</p>
                </Card>
              ))}
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {[
                ["Fixed fee", "Paid when agreed deliverables are approved. Best for UGC and awareness."],
                ["Performance", "Paid per verified outcome with caps, attribution windows and exclusions agreed up front."],
                ["Hybrid (recommended)", "A guaranteed base for the work plus an outcome bonus — fair to both sides."],
              ].map(([t, b]) => (
                <div key={t} className="rounded-2xl border border-line bg-white p-5">
                  <div className="font-semibold">{t}</div>
                  <p className="mt-1 text-sm text-muted">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-xs text-muted sm:px-6">
        <span>© 2026 Project Creator (working name). Demo build — no real money moves.</span>
        <span>Payments via an approved provider only after legal review.</span>
      </footer>
    </div>
  );
}
