"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  Clapperboard,
  Eye,
  FilePenLine,
  Filter,
  Handshake,
  HandCoins,
  IndianRupee,
  Landmark,
  Megaphone,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { formatINR } from "@/domain/money";
import { cx, darkPill, glass, glassRow } from "./styles";
import type { ChipDef, DashRow } from "./types";

const KIND: Record<string, { icon: LucideIcon; tint: string }> = {
  offer: { icon: FilePenLine, tint: "bg-amber-100 text-amber-700" },
  todo: { icon: Clapperboard, tint: "bg-violet-100 text-violet-700" },
  review: { icon: Eye, tint: "bg-violet-100 text-violet-700" },
  collab: { icon: Handshake, tint: "bg-emerald-100 text-emerald-700" },
  application: { icon: Send, tint: "bg-sky-100 text-sky-700" },
  applicant: { icon: UserRound, tint: "bg-sky-100 text-sky-700" },
  earning: { icon: IndianRupee, tint: "bg-lime-100 text-lime-700" },
  settle: { icon: HandCoins, tint: "bg-lime-100 text-lime-700" },
  campaign: { icon: Megaphone, tint: "bg-indigo-100 text-indigo-700" },
  ledger: { icon: Landmark, tint: "bg-lime-100 text-lime-700" },
  dispute: { icon: Scale, tint: "bg-rose-100 text-rose-700" },
  event: { icon: Filter, tint: "bg-amber-100 text-amber-700" },
  verify: { icon: ShieldCheck, tint: "bg-emerald-100 text-emerald-700" },
  transfer: { icon: TriangleAlert, tint: "bg-rose-100 text-rose-700" },
  verified: { icon: BadgeCheck, tint: "bg-emerald-100 text-emerald-700" },
};

const NEUTRAL = "bg-black/5 text-muted";
const STATUS: Record<string, [string, string]> = {
  offered: ["Offer", "bg-amber-100 text-amber-800"],
  pending: ["To do", "bg-white text-ink-2 ring-1 ring-black/5"],
  changes_requested: ["Fix", "bg-rose-100 text-rose-700"],
  accepted: ["Active", "bg-emerald-100 text-emerald-800"],
  disputed: ["In dispute", "bg-rose-100 text-rose-700"],
  submitted: ["Submitted", "bg-sky-100 text-sky-800"],
  resubmitted: ["Resubmitted", "bg-sky-100 text-sky-800"],
  shortlisted: ["Shortlisted", "bg-indigo-100 text-indigo-700"],
  rejected: ["Declined", NEUTRAL],
  withdrawn: ["Withdrawn", NEUTRAL],
  expired: ["Closed", NEUTRAL],
  paid: ["Paid", "bg-emerald-100 text-emerald-800"],
  approved: ["On its way", "bg-lime-100 text-lime-800"],
  approve: ["To approve", "bg-amber-100 text-amber-800"],
  payout: ["To pay", "bg-lime-100 text-lime-800"],
  review: ["Review", "bg-violet-100 text-violet-700"],
  published: ["Live", "bg-emerald-100 text-emerald-800"],
  draft: ["Draft", NEUTRAL],
  paused: ["Paused", "bg-amber-100 text-amber-800"],
  completed: ["Completed", "bg-sky-100 text-sky-800"],
  cancelled: ["Cancelled", NEUTRAL],
  funding: ["Funded", "bg-indigo-100 text-indigo-700"],
  settlement: ["Approved", "bg-lime-100 text-lime-800"],
  payout_done: ["Paid out", "bg-emerald-100 text-emerald-800"],
  refund: ["Refunded", NEUTRAL],
  open: ["Open", "bg-rose-100 text-rose-700"],
  under_review: ["Under review", "bg-amber-100 text-amber-800"],
  invalid: ["Excluded", "bg-rose-100 text-rose-700"],
  out_of_window: ["Outside window", "bg-amber-100 text-amber-800"],
  verify_pending: ["Pending", "bg-amber-100 text-amber-800"],
  failed: ["Failed", "bg-rose-100 text-rose-700"],
};

/** Panel with heading, filter chips and rows. Chip choice is mirrored to ?chip=. */
export function FilteredList({
  title,
  question,
  chips,
  rows,
  initialChip = "all",
  emptyTitle,
  emptyBody,
  emptyCta,
  action,
}: {
  title: string;
  question: string;
  chips: ChipDef[];
  rows: DashRow[];
  initialChip?: string;
  emptyTitle: string;
  emptyBody: string;
  emptyCta?: { href: string; label: string };
  action?: ReactNode;
}) {
  const [chip, setChip] = useState(chips.some((c) => c.id === initialChip) ? initialChip : "all");
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const url = new URL(window.location.href);
    if (chip === "all") url.searchParams.delete("chip");
    else url.searchParams.set("chip", chip);
    window.history.replaceState(window.history.state, "", url.toString());
  }, [chip]);
  const shown = useMemo(() => (chip === "all" ? rows : rows.filter((r) => r.tags.includes(chip))), [rows, chip]);
  const count = (id: string) => (id === "all" ? rows.length : rows.filter((r) => r.tags.includes(id)).length);

  return (
    <section className={cx(glass, "p-4 sm:p-6")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-[-0.02em] text-ink">{title}</h2>
          <p className="mt-0.5 text-sm text-muted">{question}</p>
        </div>
        {action}
      </div>
      {chips.length > 1 && (
        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={`Filter ${title}`}>
          {chips.map((c) => {
            const on = chip === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setChip(c.id)}
                aria-pressed={on}
                className={cx(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200",
                  on ? "bg-lime text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]" : "border border-black/[0.06] bg-white/70 text-ink-2 hover:bg-white",
                )}
              >
                {c.label}
                <span className={cx("tabular-nums", on ? "text-ink/70" : "text-faint")}>{count(c.id)}</span>
              </button>
            );
          })}
        </div>
      )}
      <ul key={chip} className="mt-4 space-y-2.5" aria-live="polite">
        {shown.length === 0 ? (
          <li className="animate-rise rounded-2xl border border-dashed border-black/10 bg-white/40 px-6 py-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-lime text-ink">
              <Sparkles size={20} aria-hidden />
            </div>
            <div className="mt-3 font-bold text-ink">{emptyTitle}</div>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{emptyBody}</p>
            {emptyCta && (
              <Link href={emptyCta.href} className={cx(darkPill, "mt-5")}>
                {emptyCta.label} <ArrowUpRight size={16} aria-hidden />
              </Link>
            )}
          </li>
        ) : (
          shown.map((r, i) => <Row key={r.id} row={r} delay={Math.min(i, 8) * 35} />)
        )}
      </ul>
    </section>
  );
}

function Row({ row, delay }: { row: DashRow; delay: number }) {
  const k = KIND[row.kind] ?? KIND.campaign!;
  const [label, cls] = STATUS[row.status] ?? [row.status.replace(/_/g, " "), NEUTRAL];
  const due = row.due;
  const dueCls = due?.tone === "late" ? "bg-rose-100 text-rose-700" : due?.tone === "soon" ? "bg-amber-100 text-amber-800" : "bg-black/5 text-muted";
  return (
    <li className="animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <Link href={row.href} className={cx(glassRow, "group flex items-center gap-3 p-3 sm:p-3.5")}>
        <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", k.tint)}>
          <k.icon size={19} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-bold text-ink">{row.title}</span>
            <span className={cx("hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold sm:inline", cls)}>{label}</span>
          </div>
          <div className="truncate text-[13px] text-muted">
            {row.context && <span className="font-semibold text-ink-2">{row.context} · </span>}
            {row.subtitle}
          </div>
          {due && <div className={cx("mt-1 text-[11px] font-bold sm:hidden", due.tone === "late" ? "text-rose-700" : due.tone === "soon" ? "text-amber-700" : "text-muted")}>{due.text}</div>}
          {row.progress && row.progress.total > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-[#eceef5]">
                <div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, (row.progress.done / row.progress.total) * 100)}%` }} />
              </div>
              <span className="text-[11px] font-bold tabular-nums text-muted">
                {row.progress.done}/{row.progress.total}
              </span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {row.amountMinor !== undefined && <span className="text-[15px] font-extrabold tabular-nums text-ink">{formatINR(row.amountMinor)}</span>}
          {due && (
            <span className={cx("hidden items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold sm:inline-flex", dueCls)}>
              <CalendarClock size={11} aria-hidden />
              {due.text}
            </span>
          )}
          {!due && row.amountLabel && <span className="text-[11px] font-medium text-muted">{row.amountLabel}</span>}
        </div>
        <span className="hidden h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f1f2f7] text-ink-2 transition-colors group-hover:bg-ink group-hover:text-white sm:grid">
          <ChevronRight size={16} aria-hidden />
        </span>
      </Link>
    </li>
  );
}
