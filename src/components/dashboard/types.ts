/** Serialisable dashboard row shared by every role's dashboard. Dates are pre-formatted on the server. */
export interface DashRow {
  id: string;
  /** Which filter view this row belongs to. */
  view: string;
  /** Chip keys (besides "all"). */
  tags: string[];
  /** Icon/colour key, see KIND in list.tsx. */
  kind: string;
  title: string;
  subtitle: string;
  /** Status pill key, see STATUS in list.tsx. */
  status: string;
  href: string;
  context?: string;
  amountMinor?: number;
  amountLabel?: string;
  due?: { text: string; tone: "late" | "soon" | "ok" };
  progress?: { done: number; total: number };
  at: string;
}

export interface ChipDef {
  id: string;
  label: string;
}

export interface ContinueCard {
  eyebrow: string;
  title: string;
  subtitle: string;
  href: string;
  label: string;
  amountMinor: number;
  amountLabel: string;
  progress?: { done: number; total: number; label: string };
}

/** Server-side date helpers (avoid client/server clock and timezone drift during hydration). */
export function dueOf(d: Date | null | undefined, now = Date.now()): DashRow["due"] {
  if (!d) return undefined;
  const days = Math.round((d.getTime() - now) / 86_400_000);
  if (days < 0) return { text: `${-days}d overdue`, tone: "late" };
  if (days === 0) return { text: "Due today", tone: "soon" };
  if (days <= 3) return { text: `Due in ${days}d`, tone: "soon" };
  return { text: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }), tone: "ok" };
}
export const shortDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** Time-of-day greeting in IST, computed on the server. */
export function greetingFor(d = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(d));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Pick the requested view if valid, otherwise the fallback. */
export const pickView = (requested: string | undefined, ids: string[], fallback: string) => (requested && ids.includes(requested) ? requested : fallback);
