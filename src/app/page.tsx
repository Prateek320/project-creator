import Link from "next/link";
import { ArrowRight, FileText, Handshake, ReceiptIndianRupee, UsersRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { DealFlow, RoleShowcase } from "@/components/deal-flow";
import { Badge, ButtonLink } from "@/components/ui";
import { SettlementReceipt } from "@/components/settlement";
import { formatINR } from "@/domain/money";
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
        <section className="mx-auto grid max-w-6xl gap-14 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-[1fr_minmax(0,500px)] lg:items-center lg:gap-16 lg:pt-16">
          <div>
            <p className="text-[15px] font-medium text-muted">Creator partnerships for Indian brands, paid in INR</p>
            <h1 className="mt-4 text-[42px] font-bold leading-[1.02] tracking-[-0.035em] text-ink sm:text-[60px]">
              Proof you can see. Performance you get paid for.
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-2">
              Every collaboration runs on one agreement both sides accept. Outcomes are verified, not claimed. The settlement shows its working, line by line.
            </p>
            <div className="mt-10 grid max-w-xl gap-3 sm:grid-cols-2">
              <EntryLink href="/login?as=brand" title="I'm a brand or agency" body="Launch a campaign, hire on evidence, pay for verified results." primary />
              <EntryLink href="/login?as=creator" title="I'm a creator" body="See the payout formula before you apply. Build a track record you own." />
            </div>
          </div>

          <div className="relative">
            <SettlementReceipt
              number="EXAMPLE/v1"
              title="Settlement"
              parties="Meera Iyer for Monsoon Glow Serum launch"
              formulaText="₹3,000 guaranteed for approved deliverables + ₹70 per verified signup, capped at ₹10,000"
              lines={[
                { label: "Guaranteed base", detail: "Reel + 3 Stories approved", amountMinor: 300000 },
                { label: "Verified signups", detail: "50 × ₹70", amountMinor: 350000 },
                { label: "Excluded events", detail: "3 duplicates, 1 test signup", amountMinor: 0 },
              ]}
              total={formatINR(650000)}
              stamp={{ word: "PAID", date: "Worked example" }}
              notes={["Hitting half the target doesn't mean half the budget. The base pays for the work the creator controls."]}
            />
          </div>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-[-0.02em] text-ink">From brief to payout, on the record.</h2>
              <ol className="mt-8 space-y-5">
                {steps.map((s, i) => (
                  <li key={s.t} className="grid grid-cols-[2rem_1fr] gap-3">
                    <span aria-hidden className="figures grid h-8 w-8 place-items-center rounded-full border border-line text-sm font-semibold text-ink-2">{i + 1}</span>
                    <div>
                      <div className="font-semibold text-ink">{s.t}</div>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{s.b}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <DealFlow />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <div>
              <h2 className="text-3xl font-bold tracking-[-0.02em]">Everyone sees the same deal, tailored to their job.</h2>
              <p className="mt-4 leading-relaxed text-muted">Brands, creators and operations work from one versioned agreement and one ledger. Nobody keeps their own spreadsheet of what was promised.</p>
            </div>
            <RoleShowcase />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-[-0.02em]">Three ways to pay, agreed before work starts.</h2>
              <p className="mt-4 leading-relaxed text-muted">Every agreement snapshots its formula. Changes need an amendment both sides accept — so nobody is surprised at payout time.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {models.map(([t, b], i) => (
                <div key={t} className={`rounded-[14px] border bg-surface p-6 ${i === 2 ? "border-stamp-line ring-1 ring-stamp-line" : "border-line"}`}>
                  <div className="flex items-center gap-2 font-semibold">{t}{i === 2 && <Badge tone="accent" dot={false}>Default</Badge>}</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6">
          <div className="mx-auto max-w-6xl rounded-[16px] bg-ink px-8 py-16 sm:px-16">
            <h2 className="max-w-2xl text-3xl font-bold tracking-[-0.02em] text-white sm:text-4xl">Who actually delivers? Every completed campaign makes the answer clearer.</h2>
            <p className="mt-4 max-w-xl text-white/75">Verified outcomes build a track record creators own and brands can trust.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login?as=brand" className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-white/90">Try the brand demo</Link>
              <Link href="/login?as=creator" className="inline-flex h-11 items-center rounded-full border border-white/30 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10">Try the creator demo</Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-line-2 px-4 py-8 text-xs text-muted sm:px-6">
        <span className="inline-flex items-center gap-2"><Logo size={20} className="scale-90" /> Demo build. No real money moves.</span>
        <span>Payments via an approved provider only after legal review.</span>
      </footer>
    </div>
  );
}

function EntryLink({ href, title, body, primary = false }: { href: string; title: string; body: string; primary?: boolean }) {
  return (
    <Link href={href} className={`group block rounded-[14px] border p-5 transition-colors ${primary ? "border-ink bg-ink text-white hover:bg-ink-2" : "border-line bg-surface hover:border-faint"}`}>
      <div className="font-semibold">{title}</div>
      <p className={`mt-1.5 text-sm leading-relaxed ${primary ? "text-white/70" : "text-muted"}`}>{body}</p>
    </Link>
  );
}
