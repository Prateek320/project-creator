import Link from "next/link";
import { ScrollText, ShieldCheck } from "lucide-react";
import { getDb } from "@/db";
import { formatINR } from "@/domain/money";
import { Flash } from "@/components/ui";
import { DashHeader, SideCard } from "@/components/dashboard/blocks";
import { FilterDashboard, type ViewDef } from "@/components/dashboard/filter-dashboard";
import { FilteredList } from "@/components/dashboard/list";
import { cx, glassRow, limePill } from "@/components/dashboard/styles";
import { greetingFor, pickView } from "@/components/dashboard/types";
import { adminHomeData } from "@/server/home";
import { requireActor } from "@/server/session";

export const metadata = { title: "Operations" };

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor("admin");
  const sp = await searchParams;
  const d = await adminHomeData(await getDb(), actor);
  const of = (v: string) => d.rows.filter((r) => r.view === v);
  const c = d.counts;

  const fallback = c.disputes > 0 ? "disputes" : c.verify > 0 ? "verify" : c.events > 0 ? "events" : "payments";
  const views: ViewDef[] = [
    { id: "disputes", label: "Open disputes", icon: "scale", tint: "bg-rose-100 text-rose-700", value: String(c.disputes), caption: c.disputes ? "Only the disputed amount is held" : "None open" },
    { id: "events", label: "Excluded events", icon: "filter", tint: "bg-amber-100 text-amber-700", value: String(c.events), caption: "Invalid or out of window" },
    { id: "verify", label: "Verification", icon: "shield", tint: "bg-emerald-100 text-emerald-700", value: String(c.verify), caption: "Creators and businesses" },
    { id: "payments", label: "Payouts", icon: "wallet", tint: "bg-lime-100 text-lime-700", value: formatINR(c.paidMinor), caption: c.failed ? `${c.failed} failed transfer${c.failed > 1 ? "s" : ""}` : "No payment exceptions" },
  ];
  const initialView = pickView(sp.view, views.map((v) => v.id), fallback);
  const chipFor = (v: string) => (v === initialView ? sp.chip : undefined);

  const panels = {
    disputes: (
      <FilteredList
        title="Disputes"
        question="Open disputes oldest first. Each resolution needs a written reason."
        chips={[{ id: "all", label: "All" }, { id: "open", label: "Open" }, { id: "resolved", label: "Resolved" }]}
        rows={of("disputes")}
        initialChip={chipFor("disputes")}
        emptyTitle="No disputes"
        emptyBody="When a brand or creator raises one, it lands here."
      />
    ),
    events: (
      <FilteredList
        title="Excluded attribution events"
        question="Outcomes that didn't count toward a payout, and why."
        chips={[{ id: "all", label: "All" }, { id: "manual", label: "Marked invalid" }, { id: "window", label: "Outside window" }]}
        rows={of("events")}
        initialChip={chipFor("events")}
        emptyTitle="Nothing excluded"
        emptyBody="Duplicate, test and out-of-window events show up here for review."
        action={<Link href="/admin/queue#events" className="text-sm font-semibold text-ink-2 hover:text-ink">Restore in queue →</Link>}
      />
    ),
    verify: (
      <FilteredList
        title="Verification requests"
        question="Creator identity and business KYB waiting for a human decision."
        chips={[{ id: "all", label: "All" }, { id: "creators", label: "Creators" }, { id: "businesses", label: "Businesses" }]}
        rows={of("verify")}
        initialChip={chipFor("verify")}
        emptyTitle="Queue is clear"
        emptyBody="New verification requests appear here."
      />
    ),
    payments: (
      <FilteredList
        title="Payouts"
        question="Every provider transfer, with failures first to fix."
        chips={[{ id: "all", label: "All" }, { id: "failed", label: "Failed" }, { id: "paid", label: "Paid" }, { id: "other", label: "In flight" }]}
        rows={of("payments")}
        initialChip={chipFor("payments")}
        emptyTitle="No transfers yet"
        emptyBody="Payouts appear here once a brand pays a settlement."
      />
    ),
  };

  return (
    <>
      <Flash sp={sp as Record<string, string>} />
      <div className="space-y-6 sm:space-y-8">
        <DashHeader
          name={actor.name}
          accent="#0f766e"
          greeting={greetingFor()}
          title="Trust & safety"
          actions={
            <Link href="/admin/queue" className={limePill}>
              <ShieldCheck size={16} aria-hidden /> Open review queue
            </Link>
          }
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
          <div className="space-y-6">
            <FilterDashboard views={views} panels={panels} initialView={initialView} defaultView={fallback} />
          </div>
          <aside className="space-y-6">
            <SideCard title="Principles">
              {[
                ["Hold only what's disputed", "Undisputed earnings keep flowing to the creator."],
                ["Every override has a reason", "Actor, time and reason go to the append-only audit log."],
                ["Matching is advisory", "Signals never auto-reject a creator."],
              ].map(([t, s]) => (
                <div key={t} className="rounded-2xl bg-white/70 px-4 py-3">
                  <div className="text-sm font-bold text-ink">{t}</div>
                  <div className="mt-0.5 text-[13px] text-muted">{s}</div>
                </div>
              ))}
            </SideCard>
            <Link href="/admin/audit" className={cx(glassRow, "flex items-center gap-3 p-4")}>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-100 text-indigo-700">
                <ScrollText size={19} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink">Audit trail</span>
                <span className="block text-[13px] text-muted">Append-only at the database level</span>
              </span>
            </Link>
          </aside>
        </div>
      </div>
    </>
  );
}
