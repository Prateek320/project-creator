import Link from "next/link";
import { eq } from "drizzle-orm";
import { BadgeCheck, Plus } from "lucide-react";
import { getDb, schema } from "@/db";
import { Flash } from "@/components/ui";
import { ActivityFeed, agoLabel, ContinueBlock, DashHeader, MoneySummary, SideCard } from "@/components/dashboard/blocks";
import { FilterDashboard, type ViewDef } from "@/components/dashboard/filter-dashboard";
import { FilteredList } from "@/components/dashboard/list";
import { Fact, QuickSheet } from "@/components/dashboard/sheet";
import { cx, darkPill, stampPill } from "@/components/dashboard/styles";
import { greetingFor, pickView } from "@/components/dashboard/types";
import { brandHomeData } from "@/server/home";
import { requireActor } from "@/server/session";
import { listNotifications } from "@/server/admin";

export const metadata = { title: "Overview" };

export default async function BrandHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor("brand");
  const sp = await searchParams;
  const db = await getDb();
  const [d, [org], notes] = await Promise.all([brandHomeData(db, actor), db.select().from(schema.organizations).where(eq(schema.organizations.id, actor.orgId!)), listNotifications(db, actor)]);
  const of = (v: string) => d.rows.filter((r) => r.view === v);
  const now = Date.now();
  const activity = notes.rows.slice(0, 5).map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, ago: agoLabel(n.createdAt, now), unread: !n.readAt }));
  const b = d.balances;
  const campaignCount = of("campaigns").length;

  const fallback = d.counts.action > 0 || campaignCount === 0 ? "action" : "campaigns";
  const views: ViewDef[] = [
    { id: "action", label: "Needs you", icon: "zap", tint: "bg-warn-50 text-warn", value: String(d.counts.action), caption: d.counts.action ? "Reviews, approvals, disputes" : "All caught up" },
    { id: "campaigns", label: "Live campaigns", icon: "megaphone", tint: "bg-stamp-soft text-stamp", value: String(d.counts.live), caption: `${campaignCount} in total` },
    { id: "applicants", label: "New applicants", icon: "users", tint: "bg-info-50 text-info", value: String(d.counts.newApplicants), caption: "Waiting for a decision" },
    // Amounts live in the Money summary; this tab counts ledger movements so no figure repeats.
    { id: "spend", label: "Money movements", icon: "wallet", tint: "", value: String(of("spend").length), caption: "From the double-entry ledger" },
  ];
  const initialView = pickView(sp.view, views.map((v) => v.id), fallback);
  const chipFor = (v: string) => (v === initialView ? sp.chip : undefined);
  const newCampaign = (
    <Link href="/brand/campaigns/new" className={stampPill}>
      <Plus size={16} aria-hidden /> New campaign
    </Link>
  );

  const panels = {
    action: (
      <FilteredList
        title="Needs you"
        question="Content to review, earnings to approve or pay, and disputes to answer."
        chips={[{ id: "all", label: "All" }, { id: "review", label: "Content review" }, { id: "money", label: "Approve & pay" }, { id: "disputes", label: "Disputes" }]}
        rows={of("action")}
        beamFirst
        initialChip={chipFor("action")}
        emptyTitle="You're all caught up"
        emptyBody="No content, settlements or disputes are waiting on you."
        emptyCta={campaignCount === 0 ? { href: "/brand/campaigns/new", label: "Launch your first campaign" } : undefined}
      />
    ),
    campaigns: (
      <FilteredList
        title="Campaigns"
        question="Every campaign with hiring progress and its apply-by date."
        chips={[{ id: "all", label: "All" }, { id: "live", label: "Live" }, { id: "unfunded", label: "Needs funding" }, { id: "draft", label: "Drafts" }, { id: "closed", label: "Closed" }]}
        rows={of("campaigns")}
        initialChip={chipFor("campaigns")}
        emptyTitle="No campaigns yet"
        emptyBody="Set an objective, deliverables and a payout formula. Creators see every term before they apply."
        emptyCta={{ href: "/brand/campaigns/new", label: "Create campaign" }}
        action={<Link href="/brand/campaigns" className="text-sm font-semibold text-ink-2 hover:text-ink">All campaigns →</Link>}
      />
    ),
    applicants: (
      <FilteredList
        title="Applicants"
        question="Who applied, who you shortlisted and who you hired."
        chips={[{ id: "all", label: "All" }, { id: "submitted", label: "New" }, { id: "shortlisted", label: "Shortlisted" }, { id: "offered", label: "Offered" }, { id: "hired", label: "Hired" }, { id: "closed", label: "Closed" }]}
        rows={of("applicants")}
        initialChip={chipFor("applicants")}
        emptyTitle="No applicants yet"
        emptyBody="Publish a campaign or invite creators from Discover."
        emptyCta={{ href: "/brand/creators", label: "Discover creators" }}
      />
    ),
    spend: (
      <FilteredList
        title="Spend"
        question="Every money movement, straight from the double-entry ledger."
        chips={[{ id: "all", label: "All" }, { id: "funded", label: "Funded" }, { id: "approved", label: "Approved" }, { id: "paid", label: "Paid out" }, { id: "held", label: "Held" }, { id: "refunded", label: "Refunded" }]}
        rows={of("spend")}
        initialChip={chipFor("spend")}
        emptyTitle="No money has moved yet"
        emptyBody="Funding a campaign creates the first ledger entry."
        action={<Link href="/brand/billing" className="text-sm font-semibold text-ink-2 hover:text-ink">Billing & ledger →</Link>}
      />
    ),
  };

  return (
    <>
      <Flash sp={sp as Record<string, string>} />
      <div className="space-y-6 sm:space-y-8">
        <DashHeader
          name={actor.name}
          greeting={greetingFor()}
          title={org?.displayName ?? "Overview"}
          subtitle={d.counts.action ? `${d.counts.action} ${d.counts.action === 1 ? "thing needs" : "things need"} your decision today.` : "Nothing is waiting on you."}
          search={{ action: "/brand/creators", placeholder: "Search creators by niche, city, language", filtersHref: "/brand/creators" }}
          actions={newCampaign}
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
          <div className="space-y-6">
            <FilterDashboard views={views} panels={panels} initialView={initialView} defaultView={fallback} />
          </div>
          <aside className="space-y-6">
            {d.continueCard && <ContinueBlock data={d.continueCard} />}
            <MoneySummary
              rows={[
                { label: "Held in escrow", minor: b.campaign_funds, hint: "Funded, not yet earned" },
                { label: "Approved, awaiting payout", minor: b.creator_payable },
                ...(b.dispute_hold ? [{ label: "Held for disputes", minor: b.dispute_hold }] : []),
                { label: "Paid to creators", minor: b.creator_paid, strong: true },
              ]}
              href="/brand/billing"
              cta="Open billing & ledger"
            />
            <ActivityFeed items={activity} />
            <SideCard title="Top creators" href="/brand/creators" linkLabel="Discover">
              {d.topCreators.length === 0 ? (
                <p className="px-1 text-sm text-muted">Creators with a verified track record appear here.</p>
              ) : (
                d.topCreators.map((c) => (
                  <QuickSheet
                    key={c.id}
                    avatarColor={c.accent}
                    initials={c.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    badge={`${c.verified} verified outcomes`}
                    title={c.name}
                    subtitle={`${c.location.split(",")[0]} · ${c.niches}`}
                    eyebrow={c.verifiedId ? "ID verified creator" : "Creator"}
                    description={c.headline}
                  >
                    <div className="mt-5 grid grid-cols-2 gap-2.5">
                      <Fact label="Completed" value={String(c.completed)} />
                      <Fact label="On time" value={c.onTime} />
                      <Fact label="Rating" value={c.rating} />
                      <Fact label="Rate" value={c.rate} />
                    </div>
                    {c.verifiedId && (
                      <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-good">
                        <BadgeCheck size={16} aria-hidden /> Identity verified by proovd
                      </p>
                    )}
                    <Link href={`/creators/${c.id}`} className={cx(darkPill, "mt-5 w-full")}>
                      View profile & invite
                    </Link>
                  </QuickSheet>
                ))
              )}
            </SideCard>
          </aside>
        </div>
      </div>
    </>
  );
}
