/** Small, accessible component system. Server components unless noted. */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Plus, type LucideIcon } from "lucide-react";
import { formatINR } from "@/domain/money";
import { Toast } from "./toast";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ---------- layout ----------
/** Page title is the only element that is "all pop": large, bold, high contrast. */
export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-sm font-semibold text-muted">{eyebrow}</div>}
        <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.025em] text-ink sm:text-[36px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

/** A sheet on paper: solid surface, ruled border. No blur, no lift. */
export function Card({ className, children, interactive, ...rest }: ComponentProps<"section"> & { interactive?: boolean }) {
  return (
    <section
      className={cx(
        "rounded-[14px] border border-line bg-surface shadow-[var(--shadow-card)]",
        interactive && "transition-colors duration-150 hover:border-faint/60 hover:shadow-[var(--shadow-card-hover)]",
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line-2 px-5 py-4 sm:px-6 sm:py-5">
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-[-0.02em] text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("px-5 py-5 sm:px-6", className)}>{children}</div>;
}

// ---------- buttons ----------
/*
 * Buttons are raised: slightly lighter at the top, darker bottom edge, small shadow below.
 * Pressed state sinks: darker fill, inner shadow, 1px down.
 */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-2 active:translate-y-px",
  secondary: "border border-line bg-surface text-ink hover:border-faint/70 hover:bg-sunken active:translate-y-px",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
  danger: "border border-bad/30 bg-surface text-bad hover:bg-bad-50",
  /** The one action a screen exists for (approve, pay, accept). Stamp violet; use once per view. */
  success: "bg-stamp text-white hover:bg-stamp-600 active:translate-y-px",
};
const sizes = { sm: "h-9 px-4 text-[13px]", md: "h-11 px-5 text-sm" };
export const buttonClass = (variant: Variant = "primary", size: "sm" | "md" = "md") =>
  cx(
    "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
  );

export function Button({ variant = "primary", size = "md", className, ...rest }: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button className={cx(buttonClass(variant, size), className)} {...rest} />;
}
export function ButtonLink({ variant = "primary", size = "md", className, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...rest} />;
}

// ---------- status ----------
type Tone = "neutral" | "accent" | "good" | "warn" | "bad" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2 ring-1 ring-inset ring-line-2",
  accent: "bg-stamp-soft text-stamp",
  good: "bg-good-50 text-good",
  warn: "bg-warn-50 text-warn",
  bad: "bg-bad-50 text-bad",
  info: "bg-info-50 text-info",
};
const dots: Record<Tone, string> = { neutral: "bg-faint", accent: "bg-stamp", good: "bg-good", warn: "bg-warn", bad: "bg-bad", info: "bg-info" };

export function Badge({ tone = "neutral", children, dot = true, title }: { tone?: Tone; children: ReactNode; dot?: boolean; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold", tones[tone])}>
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
/** Every rupee amount renders in the figures face so money reads as money. */
export function Money({ minor, className }: { minor: number; className?: string }) {
  return <span className={cx("figures", className)}>{formatINR(minor)}</span>;
}

/**
 * Inline provenance mark: a small tick or dot after a number instead of a full pill. Hover/focus
 * shows where the number came from. Use where a pill per row would be noise.
 */
export function SourceMark({ status }: { status: string }) {
  const [label, tone, help] = PROVENANCE[status] ?? [status, "neutral" as Tone, ""];
  const verified = tone === "good" || tone === "info";
  return (
    <span title={`${label}: ${help}`} className={cx("inline-flex items-center gap-1 whitespace-nowrap text-[11.5px] font-medium", verified ? "text-good" : tone === "warn" ? "text-warn" : "text-faint")}>
      <span aria-hidden>{verified ? "✓" : "○"}</span>
      <span className="sr-only sm:not-sr-only">{verified ? "verified" : tone === "warn" ? "self-reported" : label.toLowerCase()}</span>
    </span>
  );
}

/** Stat tile: the number pops in the figures face; the label stays small, muted, sentence case. */
export function Stat({ label, value, hint, tone, icon: Icon }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: "good" | "warn" | "bad"; icon?: LucideIcon }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] font-semibold text-muted">{label}</div>
        {Icon && (
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-sunken text-muted">
            <Icon size={17} strokeWidth={2.2} />
          </span>
        )}
      </div>
      <div className="figures mt-2 truncate text-[28px] font-bold leading-tight text-ink sm:text-[32px]">{value}</div>
      {hint && <div className={cx("mt-2.5 text-xs font-medium", tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-muted")}>{hint}</div>}
    </Card>
  );
}

export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full origin-left animate-grow rounded-full bg-ink" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ title, body, action, icon: Icon = Plus }: { title: string; body: ReactNode; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div aria-hidden className="mb-4 grid h-12 w-12 place-items-center rounded-full border border-dashed border-line bg-sunken text-muted">
        <Icon size={20} strokeWidth={2} />
      </div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Initials avatar; top-lit gradient from the person's accent colour. */
export function Avatar({ name, color, size = 36 }: { name: string; color?: string; size?: number }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const c = color ?? "#5e2b8c";
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.36, background: c }}
    >
      {initials}
    </span>
  );
}

export function DL({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="eyebrow">{k}</dt>
          <dd className="mt-1 text-sm leading-relaxed text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({ tabs, active }: { tabs: { href: string; label: string; count?: number }[]; active: string }) {
  return (
    <nav aria-label="Sections" className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="inline-flex gap-6 border-b border-line">
        {tabs.map((t) => {
          const on = t.href === active;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-0.5 pb-3 pt-1 text-sm font-semibold transition-colors duration-150",
                  on ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {t.label}
                {t.count !== undefined && <span className={cx("tnum rounded-full px-1.5 text-xs", on ? "bg-ink text-white" : "bg-sunken text-muted")}>{t.count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---------- forms ----------
/** Inputs are sunken: slightly darker fill with an inner top shadow; they lift to white on focus. */
export const inputClass =
  "block w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink shadow-[var(--shadow-inset)] placeholder:text-faint transition-colors duration-150 hover:border-faint focus:border-stamp focus:outline-none focus:ring-4 focus:ring-stamp-soft";

export function Field({ label, hint, children, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

export function Notice({ tone = "info", children, title }: { tone?: "info" | "warn" | "good" | "bad"; children: ReactNode; title?: ReactNode }) {
  const c = {
    info: "border-info/20 bg-info-50 text-ink",
    warn: "border-warn/25 bg-warn-50 text-ink",
    good: "border-good/20 bg-good-50 text-ink",
    bad: "border-bad/25 bg-bad-50 text-ink",
  }[tone];
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cx("animate-pop-in rounded-xl border px-4 py-3.5 text-sm leading-relaxed", c)}>
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
  return error ? <Toast key={`e:${error}`} tone="bad" message={error} /> : <Toast key={`n:${notice}`} tone="good" message={notice!} />;
}

export function TestModeBadge() {
  return (
    <span title="No real money moves and no live social data is fetched" className="inline-flex items-center gap-1.5 rounded-full border border-warn/25 bg-warn-50 px-2.5 py-1 text-xs font-semibold text-warn">
      <span aria-hidden className="relative flex h-1.5 w-1.5">
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warn" />
      </span>
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
