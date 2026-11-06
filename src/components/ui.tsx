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
        <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[36px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

/** Raised surface: white on a slightly darker canvas, lighter top edge, soft shadow below. */
export function Card({ className, children, interactive, ...rest }: ComponentProps<"section"> & { interactive?: boolean }) {
  return (
    <section
      className={cx(
        "rounded-3xl border border-white/70 bg-white/60 shadow-sm backdrop-blur-md",
        interactive && "transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-[var(--shadow-card-hover)]",
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
  primary: "bg-ink text-white shadow-[0_6px_16px_-8px_rgba(15,18,34,0.6)] hover:-translate-y-0.5 hover:bg-ink/90 active:translate-y-0",
  secondary: "bg-white text-ink shadow-[0_1px_2px_rgba(15,18,34,0.08),0_4px_12px_-6px_rgba(15,18,34,0.15)] hover:-translate-y-0.5 active:translate-y-0 active:bg-white/80",
  ghost: "text-ink-2 hover:bg-white/70 hover:text-ink",
  danger: "bg-white text-bad ring-1 ring-inset ring-red-200 shadow-[0_1px_2px_rgba(15,18,34,0.06)] hover:bg-bad-50",
  success: "bg-lime text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_4px_12px_-4px_rgba(150,170,20,0.6)] hover:-translate-y-0.5 active:translate-y-0",
};
const sizes = { sm: "h-9 px-4 text-[13px]", md: "h-11 px-5 text-sm" };
export const buttonClass = (variant: Variant = "primary", size: "sm" | "md" = "md") =>
  cx(
    "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50",
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
  neutral: "bg-black/5 text-ink-2",
  accent: "bg-indigo-100 text-indigo-700",
  good: "bg-emerald-100 text-emerald-800",
  warn: "bg-amber-100 text-amber-800",
  bad: "bg-rose-100 text-rose-700",
  info: "bg-sky-100 text-sky-800",
};
const dots: Record<Tone, string> = { neutral: "bg-faint", accent: "bg-accent", good: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-red-500", info: "bg-sky-500" };

export function Badge({ tone = "neutral", children, dot = true, title }: { tone?: Tone; children: ReactNode; dot?: boolean; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold", tones[tone])}>
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

/**
 * Stat tile: the number pops (large, bold, ink); the label un-pops (small, muted) but stays
 * scannable through uppercase and tracking.
 */
export function Stat({ label, value, hint, tone, icon: Icon }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: "good" | "warn" | "bad"; icon?: LucideIcon }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] font-semibold text-muted">{label}</div>
        {Icon && (
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-indigo-100 text-indigo-700">
            <Icon size={17} strokeWidth={2.2} />
          </span>
        )}
      </div>
      <div className="tnum mt-2 truncate text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[30px]">{value}</div>
      {hint && <div className={cx("mt-2.5 text-xs font-medium", tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-muted")}>{hint}</div>}
    </Card>
  );
}

export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.07]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full origin-left animate-grow rounded-full bg-ink" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ title, body, action, icon: Icon = Plus }: { title: string; body: ReactNode; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div aria-hidden className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-lime text-ink">
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
  const c = color ?? "#4f46e5";
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white ring-2 ring-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(180deg, color-mix(in srgb, ${c} 78%, white), ${c})`,
        boxShadow: "0 1px 2px rgba(14,22,48,0.18)",
      }}
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
      <ul className="inline-flex gap-1 rounded-full border border-white/70 bg-white/50 p-1 shadow-sm backdrop-blur-md">
        {tabs.map((t) => {
          const on = t.href === active;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all duration-150",
                  on ? "bg-ink text-white shadow-[0_6px_16px_-8px_rgba(15,18,34,0.6)]" : "text-ink-2 hover:bg-white/80 hover:text-ink",
                )}
              >
                {t.label}
                {t.count !== undefined && <span className={cx("tnum rounded-full px-1.5 text-xs", on ? "bg-lime text-ink" : "bg-black/5 text-muted")}>{t.count}</span>}
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
  "block w-full rounded-2xl border border-black/[0.07] bg-white/80 px-4 py-2.5 text-sm text-ink shadow-[var(--shadow-inset)] placeholder:text-faint transition-colors duration-150 hover:border-black/15 focus:border-ink/40 focus:bg-white focus:outline-none focus:ring-4 focus:ring-lime/60";

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
    info: "border-sky-200/80 bg-info-50 text-sky-900",
    warn: "border-amber-200/80 bg-warn-50 text-amber-900",
    good: "border-emerald-200/80 bg-good-50 text-emerald-900",
    bad: "border-red-200/80 bg-bad-50 text-red-900",
  }[tone];
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cx("animate-pop-in rounded-2xl border px-4 py-3.5 text-sm leading-relaxed shadow-[0_1px_2px_rgba(14,22,48,0.04)]", c)}>
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
    <span title="No real money moves and no live social data is fetched" className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-warn-50 px-2.5 py-1 text-xs font-semibold text-warn">
      <span aria-hidden className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
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
