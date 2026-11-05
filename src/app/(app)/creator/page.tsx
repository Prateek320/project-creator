import Link from "next/link";
import { ArrowUpRight, Compass } from "lucide-react";
import { getDb } from "@/db";
import { formatINR } from "@/domain/money";
import { Flash } from "@/components/ui";
import { EarningsPreview } from "@/components/formula";
import { ContinueBlock, DashHeader, MoneyCta, Ring, SideCard } from "@/components/dashboard/blocks";
import { FilterDashboard, type ViewDef } from "@/components/dashboard/filter-dashboard";
import { FilteredList } from "@/components/dashboard/list";
import { Fact, QuickSheet } from "@/components/dashboard/sheet";
import { cx, darkPill, glass, limePill } from "@/components/dashboard/styles";
import { greetingFor, pickView } from "@/components/dashboard/types";
import { creatorHomeData } from "@/server/home";
import { requireActor } from "@/server/session";

export const metadata = { title: "Home" };

export default async function CreatorHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor("creator");
  const sp = await searchParams;
  const d = await creatorHomeData(await getDb(), actor);
  const of = (v: string) => d.rows.filter((r) => r.view === v);

  // Smart default: "Needs you", unless nothing needs the creator and something is running.
  const fallback = d.counts.action > 0 || d.counts.active === 0 ? "action" : "active";
  const views: ViewDef[] = [
    { id: "action", label: "Needs you", icon: "zap", tint: "bg-amber-100 text-amber-700", value: String(d.counts.action), caption: d.counts.action ? "Offers and to-dos" : "All caught up" },
    { id: "active", label: "In progress", icon: "rocket", tint: "bg-emerald-100 text-emerald-700", value: String(d.counts.active), caption: "Active collaborations" },
    { id: "applications", label: "Applications", icon: "send", tint: "bg-sky-100 text-sky-700", value: String(d.counts.applications), caption: "Open applications" },
    { id: "earnings", label: "Earnings", icon: "wallet", tint: "bg-lime-100 text-lime-700", value: formatINR(d.balances.creator_paid), caption: d.balances.creator_payable ? `${formatINR(d.balances.creator_payable)} on its way` : "Paid lifetime" },
  ];
  const initialView = pickView(sp.view, views.map((v) => v.id), fallback);
  const chipFor = (v: string) => (v === initialView ? sp.chip : undefined);

  const panels = {
    action: (
      <FilteredList
        title="Needs you"
        question="Offers to accept and content to submit or fix, soonest first."
        chips={[{ id: "all", label: "All" }, { id: "offers", label: "Offers" }, { id: "soon", label: "Due soon" }, { id: "changes", label: "Changes requested" }]}
        rows={of("action")}
        initialChip={chipFor("action")}
        emptyTitle="You're all caught up"
        emptyBody="Nothing needs you right now. Find your next paid campaign."
        emptyCta={{ href: "/creator/campaigns", label: "Discover campaigns" }}
      />
    ),
    active: (
      <FilteredList
        title="In progress"
        question="Every running collaboration with deliverable progress and earnings so far."
        chips={[{ id: "all", label: "All" }, { id: "review", label: "Awaiting review" }, { id: "ontrack", label: "On track" }, { id: "dispute", label: "In dispute" }]}
        rows={of("active")}
        initialChip={chipFor("active")}
        emptyTitle="No active collaborations"
        emptyBody="Accepted offers show up here with their deliverables."
        emptyCta={{ href: "/creator/campaigns", label: "Find a campaign" }}
      />
    ),
    applications: (
      <FilteredList
        title="Applications"
        question="Where each application stands and what happens next."
        chips={[{ id: "all", label: "All" }, { id: "shortlisted", label: "Shortlisted" }, { id: "submitted", label: "Submitted" }, { id: "offered", label: "Offered" }, { id: "closed", label: "Closed" }]}
        rows={of("applications")}
        initialChip={chipFor("applications")}
        emptyTitle="No applications yet"
        emptyBody="Apply to campaigns in your niche. The payout formula is shown before you apply."
        emptyCta={{ href: "/creator/campaigns", label: "Discover campaigns" }}
      />
    ),
    earnings: (
      <FilteredList
        title="Earnings"
        question="What you've been paid, what's approved and what's held."
        chips={[{ id: "all", label: "All" }, { id: "paid", label: "Paid" }, { id: "payable", label: "On its way" }, { id: "held", label: "Held" }]}
        rows={of("earnings")}
        initialChip={chipFor("earnings")}
        emptyTitle="No earnings yet"
        emptyBody="Approved deliverables and verified outcomes turn into earnings here."
        action={<Link href="/creator/earnings" className="text-sm font-semibold text-ink-2 hover:text-ink">Full history →</Link>}
      />
    ),
  };

  return (
    <>
      <Flash sp={sp as Record<string, string>} />
      <div className="space-y-6 sm:space-y-8">
        <DashHeader
          name={d.profile.displayName}
          accent={d.profile.accent}
          greeting={greetingFor()}
          title="Your creator dashboard"
          search={{ action: "/creator/campaigns", placeholder: "Search campaigns, brands, niches", filtersHref: "/creator/campaigns" }}
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
          <div className="space-y-6">
            <FilterDashboard views={views} panels={panels} initialView={initialView} defaultView={fallback} />
          </div>
          <aside className="space-y-6">
            {d.continueCard && <ContinueBlock data={d.continueCard} />}
            {d.balances.creator_payable > 0 && (
              <MoneyCta amountLabel={`${formatINR(d.balances.creator_payable)} on its way`} sub="Approved and queued for payout" href="/creator/earnings" cta="View earnings" />
            )}
            <SideCard title="For you" href="/creator/campaigns" linkLabel="Discover">
              {d.recommended.length === 0 ? (
                <p className="px-1 text-sm text-muted">You&apos;ve applied to every open campaign in your niche. New ones appear here.</p>
              ) : (
                d.recommended.map((c, i) => (
                  <QuickSheet
                    key={c.id}
                    tone={i}
                    initials={c.brand.slice(0, 2)}
                    badge={c.model}
                    title={c.title}
                    subtitle={`${c.brand} · ${c.formulaText}`}
                    eyebrow={c.brand}
                    description={c.brief}
                  >
                    <div className="mt-5 grid grid-cols-2 gap-2.5">
                      <Fact label="Pay" value={c.formulaText} />
                      <Fact label="Channels" value={c.channels} />
                      <Fact label="Runs" value={c.runs} />
                      <Fact label="Apply by" value={c.applyBy} />
                    </div>
                    <div className="mt-4">
                      <EarningsPreview formula={c.formula} target={c.target} title="What you could earn" />
                    </div>
                    <Link href={`/creator/campaigns/${c.id}`} className={cx(darkPill, "mt-5 w-full")}>
                      View brief & apply <ArrowUpRight size={16} className="text-lime" aria-hidden />
                    </Link>
                  </QuickSheet>
                ))
              )}
            </SideCard>
            <section className={cx(glass, "flex items-center gap-4 p-5")}>
              <Ring value={d.strength} />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-ink">Profile strength</div>
                <p className="mt-0.5 text-sm text-muted">{d.strength >= 100 ? "Brands see your full evidence." : "Complete profiles get shortlisted more."}</p>
                {d.strength < 100 && (
                  <Link href="/creator/profile" className={cx(limePill, "mt-3 px-4 py-2 text-[13px]")}>
                    Complete profile
                  </Link>
                )}
              </div>
            </section>
            <Link href="/creator/campaigns" className={cx(glass, "flex items-center gap-3 p-4 text-sm font-semibold text-ink transition-colors hover:bg-white/75 lg:hidden")}>
              <Compass size={18} aria-hidden /> Browse all open campaigns
            </Link>
          </aside>
        </div>
      </div>
    </>
  );
}
