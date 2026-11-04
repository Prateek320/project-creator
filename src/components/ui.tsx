/** Small, accessible component system. Server components unless noted. */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatINR } from "@/domain/money";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ---------- layout ----------
export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-sm text-muted">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={cx("rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line-2 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("px-5 py-4", className)}>{children}</div>;
}

// ---------- buttons ----------
type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-600 border border-accent",
  secondary: "bg-white text-ink border border-line hover:bg-slate-50",
  ghost: "text-ink-2 hover:bg-slate-100 border border-transparent",
  danger: "bg-white text-bad border border-red-200 hover:bg-bad-50",
  success: "bg-good text-white border border-good hover:bg-emerald-800",
};
const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm" };
export const buttonClass = (variant: Variant = "primary", size: "sm" | "md" = "md") =>
  cx("inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap", variants[variant], sizes[size]);

export function Button({ variant = "primary", size = "md", className, ...rest }: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button className={cx(buttonClass(variant, size), className)} {...rest} />;
}
export function ButtonLink({ variant = "primary", size = "md", className, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...rest} />;
}

// ---------- status ----------
type Tone = "neutral" | "accent" | "good" | "warn" | "bad" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  accent: "bg-accent-50 text-accent-600 ring-accent-100",
  good: "bg-good-50 text-good ring-emerald-200",
  warn: "bg-warn-50 text-warn ring-amber-200",
  bad: "bg-bad-50 text-bad ring-red-200",
  info: "bg-info-50 text-info ring-sky-200",
};
const dots: Record<Tone, string> = { neutral: "bg-slate-400", accent: "bg-accent", good: "bg-good", warn: "bg-amber-500", bad: "bg-bad", info: "bg-sky-500" };

export function Badge({ tone = "neutral", children, dot = true, title }: { tone?: Tone; children: ReactNode; dot?: boolean; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone])}>
      {dot && <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}

const STATUS: Record<string, [string, Tone]> = {
  draft: ["Draft", "neutral"],
  published: ["Live", "good"],
  paused: ["Paused", "warn"],
  completed: ["Completed", "info"],
  cancelled: ["Cancelled", "neutral"],
  submitted: ["Submitted", "accent"],
  shortlisted: ["Shortlisted", "info"],
  offered: ["Offer pending", "warn"],
  accepted: ["Active", "good"],
  rejected: ["Declined", "neutral"],
  withdrawn: ["Withdrawn", "neutral"],
  expired: ["Closed", "neutral"],
  superseded: ["Superseded", "neutral"],
  disputed: ["In dispute", "bad"],
  pending: ["To do", "neutral"],
  changes_requested: ["Changes requested", "warn"],
  resubmitted: ["Resubmitted", "accent"],
  approved: ["Approved", "good"],
  not_funded: ["Not funded", "warn"],
  funding_pending: ["Funding pending", "warn"],
  funded: ["Funded", "good"],
  refunded: ["Closed out", "neutral"],
  transfer_pending: ["Transfer pending", "warn"],
  paid: ["Paid", "good"],
  failed: ["Failed", "bad"],
  reversed: ["Reversed", "bad"],
  open: ["Open", "bad"],
  under_review: ["Under review", "warn"],
  resolved: ["Resolved", "good"],
  valid: ["Valid", "good"],
  invalid: ["Excluded", "bad"],
  duplicate: ["Duplicate", "neutral"],
  out_of_window: ["Outside window", "warn"],
  test: ["Test", "neutral"],
  earned: ["Earned", "good"],
  partially_earned: ["Partly earned", "warn"],
  not_earned: ["Not earned", "neutral"],
  evaluating: ["Evaluating", "accent"],
  settled: ["Settled", "good"],
  verified: ["Verified", "good"],
  unverified: ["Unverified", "neutral"],
};
export function StatusChip({ status, label }: { status: string; label?: string }) {
  const [l, t] = STATUS[status] ?? [status.replace(/_/g, " "), "neutral" as Tone];
  return <Badge tone={t}>{label ?? l}</Badge>;
}

const PROVENANCE: Record<string, [string, Tone, string]> = {
  verified_api: ["Verified API", "good", "Fetched from the platform's official API with the creator's consent"],
  verified_brand_event: ["Verified event", "good", "Signed server-side event from the brand"],
  creator_reported: ["Creator reported", "warn", "Supplied by the creator with evidence; not independently verified"],
  manual_reviewed: ["Reviewed", "info", "Checked manually by operations"],
  estimated: ["Estimated", "neutral", "Modelled — never treat as verified"],
  unavailable: ["Unavailable", "neutral", "No permitted data source"],
  stale: ["Stale", "bad", "Source disconnected or data is too old"],
};
export function ProvenanceChip({ status, observedAt }: { status: string; observedAt?: Date }) {
  const [label, tone, help] = PROVENANCE[status] ?? [status, "neutral" as Tone, ""];
  return (
    <Badge tone={tone} title={`${help}${observedAt ? ` · observed ${observedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}`}>
      {label}
    </Badge>
  );
}

// ---------- data display ----------
export function Money({ minor, className }: { minor: number; className?: string }) {
  return <span className={cx("tnum", className)}>{formatINR(minor)}</span>;
}

export function Stat({ label, value, hint, tone }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: "good" | "warn" | "bad" }) {
  return (
    <Card className="px-5 py-4">
      <div className="text-[13px] font-medium text-muted">{label}</div>
      <div className="tnum mt-1.5 text-[26px] font-semibold tracking-tight text-ink">{value}</div>
      {hint && <div className={cx("mt-1 text-xs", tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-muted")}>{hint}</div>}
    </Card>
  );
}

export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div aria-hidden className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-accent-50 text-accent">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
      </div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ name, color, size = 36 }: { name: string; color?: string; size?: number }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span aria-hidden className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: color ?? "#4f46e5", fontSize: size * 0.36 }}>
      {initials}
    </span>
  );
}

export function DL({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">{k}</dt>
          <dd className="mt-0.5 text-sm text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({ tabs, active }: { tabs: { href: string; label: string; count?: number }[]; active: string }) {
  return (
    <nav aria-label="Sections" className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-6">
        {tabs.map((t) => {
          const on = t.href === active;
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={on ? "page" : undefined} className={cx("inline-flex items-center gap-2 border-b-2 pb-3 pt-1 text-sm font-medium whitespace-nowrap", on ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink")}>
                {t.label}
                {t.count !== undefined && <span className="tnum rounded-full bg-slate-100 px-1.5 text-xs text-muted">{t.count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---------- forms ----------
export const inputClass =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-100";

export function Field({ label, hint, children, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Notice({ tone = "info", children, title }: { tone?: "info" | "warn" | "good" | "bad"; children: ReactNode; title?: ReactNode }) {
  const c = { info: "border-sky-200 bg-info-50 text-sky-900", warn: "border-amber-200 bg-warn-50 text-amber-900", good: "border-emerald-200 bg-good-50 text-emerald-900", bad: "border-red-200 bg-bad-50 text-red-900" }[tone];
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cx("rounded-xl border px-4 py-3 text-sm", c)}>
      {title && <div className="mb-0.5 font-semibold">{title}</div>}
      {children}
    </div>
  );
}

/** Shows ?notice= / ?error= set by server actions. */
export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const notice = typeof sp.notice === "string" ? sp.notice : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  if (!notice && !error) return null;
  return <div className="mb-5">{error ? <Notice tone="bad">{error}</Notice> : <Notice tone="good">{notice}</Notice>}</div>;
}

export function TestModeBadge() {
  return (
    <span title="No real money moves and no live social data is fetched" className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-warn-50 px-2.5 py-1 text-xs font-medium text-warn">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Test mode
    </span>
  );
}

export const fmtDate = (d: Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  d ? d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", ...opts }) : "—";
export const fmtDateTime = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export function relDays(d: Date): string {
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (days === 0) return "today";
  if (days > 0) return `in ${days} day${days === 1 ? "" : "s"}`;
  return `${-days} day${days === -1 ? "" : "s"} ago`;
}
export const pct = (n: number | null, digits = 0) => (n === null ? "—" : `${(n * 100).toFixed(digits)}%`);
