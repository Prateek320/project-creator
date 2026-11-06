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

// Row icons are neutral; colour is reserved for status (and red for things that are going wrong).
const N = "bg-sunken text-ink-2";
const KIND: Record<string, { icon: LucideIcon; tint: string }> = {
  offer: { icon: FilePenLine, tint: N },
  todo: { icon: Clapperboard, tint: N },
  review: { icon: Eye, tint: N },
  collab: { icon: Handshake, tint: N },
  application: { icon: Send, tint: N },
  applicant: { icon: UserRound, tint: N },
  earning: { icon: IndianRupee, tint: N },
  settle: { icon: HandCoins, tint: N },
  campaign: { icon: Megaphone, tint: N },
  ledger: { icon: Landmark, tint: N },
  dispute: { icon: Scale, tint: "bg-bad-50 text-bad" },
  event: { icon: Filter, tint: N },
  verify: { icon: ShieldCheck, tint: N },
  transfer: { icon: TriangleAlert, tint: "bg-bad-50 text-bad" },
  verified: { icon: BadgeCheck, tint: N },
};

const NEUTRAL = "bg-sunken text-muted";
const STATUS: Record<string, [string, string]> = {
  offered: ["Offer", "bg-warn-50 text-warn"],
  pending: ["To do", "bg-surface text-ink-2 ring-1 ring-line"],
  changes_requested: ["Fix", "bg-bad-50 text-bad"],
  accepted: ["Active", "bg-good-50 text-good"],
  disputed: ["In dispute", "bg-bad-50 text-bad"],
  submitted: ["Submitted", "bg-info-50 text-info"],
  resubmitted: ["Resubmitted", "bg-info-50 text-info"],
  shortlisted: ["Shortlisted", "bg-stamp-soft text-stamp"],
  rejected: ["Declined", NEUTRAL],
  withdrawn: ["Withdrawn", NEUTRAL],
  expired: ["Closed", NEUTRAL],
  paid: ["Paid", "bg-good-50 text-good"],
  approved: ["On its way", "bg-good-50 text-good"],
  approve: ["To approve", "bg-warn-50 text-warn"],
  payout: ["To pay", "bg-good-50 text-good"],
  review: ["Review", "bg-stamp-soft text-stamp"],
  published: ["Live", "bg-good-50 text-good"],
  draft: ["Draft", NEUTRAL],
  paused: ["Paused", "bg-warn-50 text-warn"],
  completed: ["Completed", "bg-info-50 text-info"],
  cancelled: ["Cancelled", NEUTRAL],
  funding: ["Funded", "bg-stamp-soft text-stamp"],
  settlement: ["Approved", "bg-good-50 text-good"],
  payout_done: ["Paid out", "bg-good-50 text-good"],
  refund: ["Refunded", NEUTRAL],
  open: ["Open", "bg-bad-50 text-bad"],
  under_review: ["Under review", "bg-warn-50 text-warn"],
  invalid: ["Excluded", "bg-bad-50 text-bad"],
  out_of_window: ["Outside window", "bg-warn-50 text-warn"],
  verify_pending: ["Pending", "bg-warn-50 text-warn"],
  failed: ["Failed", "bg-bad-50 text-bad"],
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
  beamFirst = false,
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
  /** Draw a slow light around the first row: the single most urgent thing to do. */
  beamFirst?: boolean;
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
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-150",
                  on ? "bg-ink text-white" : "border border-line bg-surface text-ink-2 hover:bg-sunken",
                )}
              >
                {c.label}
                <span className={cx("tabular-nums", on ? "text-white/60" : "text-faint")}>{count(c.id)}</span>
              </button>
            );
          })}
        </div>
      )}
      <ul key={chip} className="mt-4 space-y-2.5" aria-live="polite">
        {shown.length === 0 ? (
          <li className="rounded-xl border border-dashed border-line bg-sunken px-6 py-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-line bg-surface text-muted">
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
          shown.map((r, i) => <Row key={r.id} row={r} beam={beamFirst && chip === "all" && i === 0} />)
        )}
      </ul>
    </section>
  );
}

function Row({ row, beam }: { row: DashRow; beam?: boolean }) {
  const k = KIND[row.kind] ?? KIND.campaign!;
  const [label, cls] = STATUS[row.status] ?? [row.status.replace(/_/g, " "), NEUTRAL];
  const due = row.due;
  const dueCls = due?.tone === "late" ? "bg-bad-50 text-bad" : due?.tone === "soon" ? "bg-warn-50 text-warn" : "bg-sunken text-muted";
  return (
    <li>
      <Link href={row.href} className={cx(glassRow, "group flex items-center gap-3 p-3 sm:p-3.5", beam && "beam")}>
        <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", k.tint)}>
          <k.icon size={19} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-ink">{row.title}</span>
            <span className={cx("hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline", cls)}>{label}</span>
          </div>
          <div className="truncate text-[13px] text-muted">
            {row.context && <span className="font-semibold text-ink-2">{row.context} · </span>}
            {row.subtitle}
          </div>
          {due && <div className={cx("mt-1 text-[11px] font-bold sm:hidden", due.tone === "late" ? "text-bad" : due.tone === "soon" ? "text-warn" : "text-muted")}>{due.text}</div>}
          {row.progress && row.progress.total > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-line-2">
                <div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, (row.progress.done / row.progress.total) * 100)}%` }} />
              </div>
              <span className="text-[11px] font-bold tabular-nums text-muted">
                {row.progress.done}/{row.progress.total}
              </span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {row.amountMinor !== undefined && <span className="figures text-[16px] font-bold text-ink">{formatINR(row.amountMinor)}</span>}
          {due && (
            <span className={cx("hidden items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold sm:inline-flex", dueCls)}>
              <CalendarClock size={11} aria-hidden />
              {due.text}
            </span>
          )}
          {!due && row.amountLabel && <span className="text-[11px] font-medium text-muted">{row.amountLabel}</span>}
        </div>
        <span className="hidden h-8 w-8 shrink-0 place-items-center rounded-full text-faint transition-colors group-hover:text-ink sm:grid">
          <ChevronRight size={16} aria-hidden />
        </span>
      </Link>
    </li>
  );
}
