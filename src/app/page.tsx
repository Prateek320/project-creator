import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, FileText, Handshake, ReceiptIndianRupee, Sparkles, UsersRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { getActor, homeFor } from "@/server/session";

const steps = [
  { icon: FileText, t: "Publish a clear brief", b: "Objective, deliverables, dates, usage rights and the payout formula — all visible before anyone applies." },
  { icon: UsersRound, t: "Hire on evidence", b: "Compare applicants on verified track record, audience fit and on-time delivery — not just follower counts." },
  { icon: Handshake, t: "Agree, then execute", b: "Both sides accept a versioned agreement. Content, revisions and deadlines live in one workspace." },
  { icon: ReceiptIndianRupee, t: "Settle what was verified", b: "Tracked links, coupon codes and signed brand events feed a transparent, reproducible settlement." },
];

const models = [
  ["Fixed fee", "Paid when agreed deliverables are approved. Best for UGC and awareness."],
  ["Performance", "Paid per verified outcome, with caps, attribution windows and exclusions agreed up front."],
  ["Hybrid", "A guaranteed base for the work plus an outcome bonus — fair to both sides."],
];

export default async function Landing() {
  const actor = await getActor();
  return (
    <div className="min-h-dvh overflow-x-clip">
      {/* Soft top light: the page is lit from above. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[640px] bg-[radial-gradient(60%_60%_at_50%_0%,#eef0ff_0%,rgba(255,255,255,0)_70%)]" />

      <header className="relative mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo size={30} />
        <nav className="flex items-center gap-2">
          {actor ? (
            <ButtonLink href={homeFor(actor)} size="sm">Open workspace <ArrowRight size={14} aria-hidden /></ButtonLink>
          ) : (
            <ButtonLink href="/login" variant="secondary" size="sm">Sign in</ButtonLink>
          )}
        </nav>
      </header>

      <main id="main" className="relative">
        <section className="mx-auto grid max-w-6xl gap-14 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-16">
          <div className="animate-rise">
            <Badge tone="accent">Built for India · INR · Instagram &amp; YouTube</Badge>
            <h1 className="mt-6 text-[40px] font-bold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[56px]">
              Creator partnerships with <span className="bg-gradient-to-b from-accent-400 to-accent-700 bg-clip-text text-transparent">clear terms</span>, verified outcomes and dependable payouts.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Know what you&apos;re agreeing to. Know what happened. Know what you&apos;ll earn.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <EntryCard href="/login?as=brand" icon={Building2} title="I'm a brand or agency" body="Launch a campaign, hire creators on evidence, pay for verified results." />
              <EntryCard href="/login?as=creator" icon={Sparkles} title="I'm a creator" body="Find paid work, see the payout formula up front, build a verified track record." />
            </div>
          </div>

          <div className="relative animate-rise [animation-delay:120ms]">
            <div aria-hidden className="absolute -inset-6 -z-10 rounded-[32px] bg-gradient-to-b from-accent-100/70 to-transparent blur-2xl" />
            <Card className="p-7">
              <div className="flex items-center justify-between">
                <div className="eyebrow">Example · hybrid compensation</div>
                <Badge tone="good">Verified events</Badge>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-6">
                <div>
                  <div className="tnum text-[32px] font-bold leading-none tracking-[-0.02em]">₹3,000</div>
                  <div className="mt-2 text-sm text-muted">guaranteed base for approved Reel + Stories</div>
                </div>
                <div>
                  <div className="tnum text-[32px] font-bold leading-none tracking-[-0.02em]">₹70</div>
                  <div className="mt-2 text-sm text-muted">per verified signup, capped at ₹10,000</div>
                </div>
              </div>
              <div className="mt-7 border-t border-line-2 pt-6">
                <div className="flex items-baseline justify-between">
                  <div className="eyebrow">Actual performance</div>
                  <div className="text-xs font-medium text-muted">50 of 100 target</div>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#e8ebf2] shadow-[var(--shadow-inset)]">
                  <div className="h-full w-1/2 origin-left animate-grow rounded-full bg-gradient-to-r from-accent-400 to-accent [animation-delay:400ms]" />
                </div>
                <dl className="mt-6 space-y-3 text-sm">
                  <div className="flex justify-between"><dt className="text-muted">Base (deliverables approved)</dt><dd className="tnum font-medium">₹3,000</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">50 verified signups × ₹70</dt><dd className="tnum font-medium">₹3,500</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">3 duplicates, 1 test signup</dt><dd className="text-faint">excluded</dd></div>
                  <div className="flex items-baseline justify-between border-t border-line-2 pt-4"><dt className="font-semibold">Creator earns</dt><dd className="tnum text-2xl font-bold tracking-[-0.02em] text-good">₹6,500</dd></div>
                </dl>
                <p className="mt-5 text-xs leading-relaxed text-muted">
                  50% of target doesn&apos;t mean 50% of budget. Payment follows the formula both sides accepted — creators aren&apos;t penalised for a brand&apos;s landing page.
                </p>
              </div>
            </Card>
          </div>
        </section>

        <section className="border-t border-white/60 bg-white/40 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="eyebrow text-accent">How it works</div>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.02em]">From brief to payout, on the record.</h2>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <Card key={s.t} interactive className="p-6">
                  <div className="flex items-center justify-between">
                    <span aria-hidden className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-b from-accent-50 to-accent-100 text-accent ring-1 ring-inset ring-accent-100">
                      <s.icon size={20} strokeWidth={1.9} />
                    </span>
                    <span className="tnum text-xs font-semibold text-faint">0{i + 1}</span>
                  </div>
                  <div className="mt-5 font-semibold">{s.t}</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.b}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:items-center">
            <div>
              <div className="eyebrow text-accent">Fair pay</div>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.02em]">Three ways to pay, agreed before work starts.</h2>
              <p className="mt-4 leading-relaxed text-muted">Every agreement snapshots its formula. Changes need an amendment both sides accept — so nobody is surprised at payout time.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {models.map(([t, b], i) => (
                <div key={t} className={`rounded-2xl border p-6 ${i === 2 ? "border-accent-200 bg-gradient-to-b from-accent-50 to-white shadow-[var(--shadow-card)]" : "border-line bg-white"}`}>
                  <div className="flex items-center gap-2 font-semibold">{t}{i === 2 && <Badge tone="accent" dot={false}>Default</Badge>}</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Dark band: white text on a scrim (radial darkening) over a decorative gradient. */}
        <section className="px-4 pb-24 sm:px-6">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-[#1b1a4b] px-8 py-16 text-center sm:px-16">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_80%_at_20%_0%,#5b54f0_0%,transparent_60%),radial-gradient(40%_70%_at_90%_100%,#0d9488_0%,transparent_60%)] opacity-80" />
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(45%_55%_at_50%_50%,rgba(10,10,40,0.55),transparent_75%)]" />
            <div className="relative">
              <BadgeCheck className="mx-auto text-emerald-300" size={28} aria-hidden />
              <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-[-0.02em] text-white sm:text-4xl">Who actually delivers? Every completed campaign makes the answer clearer.</h2>
              <p className="mx-auto mt-4 max-w-xl text-indigo-100/90">Verified outcomes build a track record creators own and brands can trust.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <ButtonLink href="/login?as=brand">Try the brand demo <ArrowRight size={15} aria-hidden /></ButtonLink>
                <Link href="/login?as=creator" className="inline-flex h-10 items-center rounded-[10px] border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20">Try the creator demo</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-line-2 px-4 py-8 text-xs text-muted sm:px-6">
        <span className="inline-flex items-center gap-2"><Logo size={20} className="scale-90" /> · Demo build — no real money moves.</span>
        <span>Payments via an approved provider only after legal review.</span>
      </footer>
    </div>
  );
}

function EntryCard({ href, icon: Icon, title, body }: { href: string; icon: typeof Building2; title: string; body: string }) {
  return (
    <Link href={href} className="group rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[var(--shadow-card-hover)]">
      <span aria-hidden className="grid h-10 w-10 place-items-center rounded-2xl bg-accent-50 text-accent ring-1 ring-inset ring-accent-100"><Icon size={19} strokeWidth={1.9} /></span>
      <div className="mt-4 flex items-center gap-1.5 font-semibold text-ink">
        {title}
        <ArrowRight size={15} className="text-accent transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
    </Link>
  );
}
