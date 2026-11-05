/** Server-renderable dashboard blocks shared by every role. */
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Search, SlidersHorizontal } from "lucide-react";
import { formatINR } from "@/domain/money";
import { cx, darkRoundBtn, glass, roundBtn } from "./styles";
import type { ContinueCard as ContinueData } from "./types";

export function DashHeader({ name, accent, greeting, title, search, actions }: { name: string; accent?: string; greeting: string; title: string; search?: { action: string; placeholder: string; filtersHref: string }; actions?: ReactNode }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white ring-2 ring-white"
            style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${accent ?? "#4f46e5"} 75%, white), ${accent ?? "#4f46e5"})` }}
          >
            {initials}
          </span>
          <span className="text-[15px] font-semibold text-ink-2">
            {greeting}, {name.split(" ")[0]}
          </span>
        </div>
        <h1 className="mt-3 text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[42px]">{title}</h1>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2.5 lg:w-auto">
        {search && (
          <form action={search.action} role="search" className="flex w-full min-w-0 flex-none items-center gap-2.5 sm:w-auto sm:flex-1 lg:w-[420px] lg:flex-none">
            <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-white px-4 shadow-[0_1px_2px_rgba(15,18,34,0.06),0_8px_24px_-12px_rgba(15,18,34,0.18)] focus-within:ring-4 focus-within:ring-lime/60">
              <Search size={18} className="shrink-0 text-faint" aria-hidden />
              <span className="sr-only">Search</span>
              <input name="q" placeholder={search.placeholder} className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none" />
            </label>
            <Link href={search.filtersHref} aria-label="All filters" className={cx(roundBtn, "h-12 w-12")}>
              <SlidersHorizontal size={18} aria-hidden />
            </Link>
          </form>
        )}
        {actions}
      </div>
    </section>
  );
}

export function ContinueBlock({ data }: { data: ContinueData }) {
  return (
    <section className="rounded-3xl bg-gradient-to-br from-indigo-200/80 via-violet-100/80 to-sky-100/80 p-1.5 shadow-sm">
      <div className="flex items-center justify-between px-3 pb-2 pt-1.5">
        <span className="rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold text-ink shadow-sm">{data.label}</span>
        <Link href={data.href} aria-label={`Open ${data.title}`} className={darkRoundBtn}>
          <ArrowUpRight size={18} aria-hidden />
        </Link>
      </div>
      <div className="rounded-[20px] bg-white/70 p-5 backdrop-blur-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{data.eyebrow}</div>
            <div className="mt-1 text-xl font-bold tracking-[-0.02em] text-ink">{data.title}</div>
            <div className="mt-1 text-sm text-muted">{data.subtitle}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold tracking-[-0.02em] tabular-nums text-ink">{formatINR(data.amountMinor)}</div>
            <div className="text-xs font-medium text-muted">{data.amountLabel}</div>
          </div>
        </div>
        {data.progress && (
          <div className="mt-5 flex items-center gap-3 rounded-full bg-white p-1.5 pr-4 shadow-sm">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#eceef5]">
              <div className="h-full origin-left animate-grow rounded-full bg-ink" style={{ width: `${data.progress.total ? Math.min(100, (data.progress.done / data.progress.total) * 100) : 0}%` }} />
            </div>
            <span className="text-xs font-bold tabular-nums text-ink">{data.progress.label}</span>
          </div>
        )}
      </div>
    </section>
  );
}

export function SideCard({ title, href, linkLabel = "See all", children }: { title: string; href?: string; linkLabel?: string; children: ReactNode }) {
  return (
    <section className={cx(glass, "p-4 sm:p-5")}>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold tracking-[-0.02em] text-ink">{title}</h2>
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
        <circle cx="32" cy="32" r={r} fill="none" stroke="white" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="#0f1222" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-extrabold tabular-nums text-ink">{value}%</span>
    </div>
  );
}

export function MoneyCta({ amountLabel, sub, href, cta }: { amountLabel: string; sub: string; href: string; cta: string }) {
  return (
    <section className="rounded-3xl bg-gradient-to-br from-amber-100 via-lime-50 to-emerald-100 p-1.5 shadow-sm">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-sm">₹</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-ink">{amountLabel}</div>
          <div className="truncate text-xs text-muted">{sub}</div>
        </div>
      </div>
      <Link href={href} className="inline-flex w-full items-center justify-center gap-2 rounded-[20px] bg-ink px-5 py-3.5 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgba(15,18,34,0.5)] transition-transform duration-200 hover:-translate-y-0.5">
        {cta} <span className="font-normal text-lime">→</span>
      </Link>
    </section>
  );
}
