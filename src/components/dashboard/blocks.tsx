/** Server-renderable dashboard blocks shared by every role. */
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Search, SlidersHorizontal } from "lucide-react";
import { formatINR } from "@/domain/money";
import { cx, glass, roundBtn } from "./styles";
import type { ContinueCard as ContinueData } from "./types";

export function DashHeader({ name, greeting, title, subtitle, search, actions }: { name: string; accent?: string; greeting: string; title: string; subtitle?: ReactNode; search?: { action: string; placeholder: string; filtersHref: string }; actions?: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="text-[15px] font-medium text-muted">
          {greeting}, {name.split(" ")[0]}
        </div>
        <h1 className="mt-1 text-[32px] font-bold leading-[1.08] tracking-[-0.025em] text-ink sm:text-[38px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-ink-2">{subtitle}</p>}
      </div>
      <div className="flex w-full flex-wrap items-center gap-2.5 lg:w-auto">
        {search && (
          <form action={search.action} role="search" className="flex w-full min-w-0 flex-none items-center gap-2 sm:w-auto sm:flex-1 lg:w-[380px] lg:flex-none">
            <label className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-line bg-surface px-4 focus-within:border-stamp focus-within:ring-4 focus-within:ring-stamp-soft">
              <Search size={17} className="shrink-0 text-faint" aria-hidden />
              <span className="sr-only">Search</span>
              <input name="q" placeholder={search.placeholder} className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none" />
            </label>
            <Link href={search.filtersHref} aria-label="All filters" className={cx(roundBtn, "h-11 w-11")}>
              <SlidersHorizontal size={17} aria-hidden />
            </Link>
          </form>
        )}
        {actions}
      </div>
    </section>
  );
}

export function ContinueBlock({ data }: { data: ContinueData }) {
  const pctDone = data.progress?.total ? Math.min(100, (data.progress.done / data.progress.total) * 100) : 0;
  return (
    <Link href={data.href} className={cx(glass, "group block p-5 transition-colors hover:border-faint/60")}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-muted">{data.label}</span>
        <ArrowUpRight size={17} className="text-faint transition-colors group-hover:text-ink" aria-hidden />
      </div>
      <div className="mt-2 text-lg font-bold leading-snug tracking-[-0.015em] text-ink">{data.title}</div>
      <div className="mt-0.5 text-sm text-muted">
        {data.eyebrow} — {data.subtitle}
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <span className="figures text-[26px] font-bold text-ink">{formatINR(data.amountMinor)}</span>
        <span className="text-xs text-muted">{data.amountLabel}</span>
      </div>
      {data.progress && (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-2">
            <div className="h-full origin-left animate-grow rounded-full bg-ink" style={{ width: `${pctDone}%` }} />
          </div>
          <span className="text-xs font-semibold tabular-nums text-ink-2">{data.progress.label}</span>
        </div>
      )}
    </Link>
  );
}

export function SideCard({ title, href, linkLabel = "See all", children }: { title: string; href?: string; linkLabel?: string; children: ReactNode }) {
  return (
    <section className={cx(glass, "p-4 sm:p-5")}>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {href && (
          <Link href={href} className="text-sm font-semibold text-ink-2 hover:text-ink">
            {linkLabel}
          </Link>
        )}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function Ring({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[68px] w-[68px] shrink-0" role="img" aria-label={`${value}% complete`}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" style={{ stroke: "var(--color-line-2)" }} strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" style={{ stroke: "var(--color-ink)" }} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <span className="figures absolute inset-0 grid place-items-center text-sm font-bold text-ink">{value}%</span>
    </div>
  );
}

/**
 * Where the money is, in one place. Replaces three separate tiles that each repeated escrow or
 * paid totals. Rows mirror the ledger accounts, so every figure here reconciles with billing.
 */
export function MoneySummary({ rows, href, cta }: { rows: { label: string; minor: number; hint?: string; strong?: boolean }[]; href: string; cta: string }) {
  return (
    <section className={cx(glass, "p-5")}>
      <h2 className="text-[15px] font-bold text-ink">Money</h2>
      <dl className="mt-3 divide-y divide-dashed divide-line">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="min-w-0">
              <span className={cx("block text-sm", r.strong ? "font-semibold text-ink" : "text-ink-2")}>{r.label}</span>
              {r.hint && <span className="block text-xs text-muted">{r.hint}</span>}
            </dt>
            <dd className={cx("figures shrink-0 text-[17px]", r.strong ? "font-bold text-ink" : "font-semibold text-ink-2")}>{formatINR(r.minor)}</dd>
          </div>
        ))}
      </dl>
      <Link href={href} className="mt-3 inline-flex text-sm font-semibold text-stamp hover:underline">
        {cta}
      </Link>
    </section>
  );
}

export interface ActivityItem {
  id: string;
  title: string;
  body: string;
  href: string | null;
  ago: string;
  unread: boolean;
}

/** Server-side "5m ago" label (avoids client clock drift during hydration). */
export function agoLabel(d: Date, now = Date.now()) {
  const m = Math.max(0, Math.round((now - d.getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Recent activity with a live indicator on unread items; entries pop in one after another. */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <SideCard title="Activity" href="/notifications" linkLabel="All">
      {items.length === 0 ? (
        <p className="px-1 text-sm text-muted">Updates on offers, content and payouts show up here.</p>
      ) : (
        <ol className="space-y-1">
          {items.map((it) => {
            const inner = (
              <>
                <span aria-label={it.unread ? "Unread" : undefined} className={cx("mt-1.5 inline-flex h-2 w-2 shrink-0 rounded-full", it.unread ? "bg-stamp" : "bg-line")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{it.title}</span>
                  {it.body && <span className="block truncate text-xs text-muted">{it.body}</span>}
                </span>
                <span className="shrink-0 pt-0.5 text-[11px] font-medium text-faint">{it.ago}</span>
              </>
            );
            return (
              <li key={it.id}>
                {it.href ? (
                  <Link href={it.href} className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-sunken">
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 px-2 py-2">{inner}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </SideCard>
  );
}
