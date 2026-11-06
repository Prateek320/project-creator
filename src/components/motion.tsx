"use client";

/**
 * Small, subtle motion helpers. Every one of them checks prefers-reduced-motion and falls back
 * to showing the final state immediately.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatINR } from "@/domain/money";

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function readStore(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, v: string) {
  try {
    sessionStorage.setItem(key, v);
  } catch {
    /* storage unavailable: animation simply starts from the current value next time */
  }
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * A number that ticks up (or down) to its value. With `storageKey`, it starts from the value the
 * viewer last saw in this tab, so a refresh after new signups counts only the difference.
 * It also animates whenever the value prop changes (e.g. after router.refresh()).
 */
export function CountUp({ value, format = "int", storageKey, duration = 900, className }: { value: number; format?: "int" | "inr"; storageKey?: string; duration?: number; className?: string }) {
  // While ticking, money shows whole rupees; the final frame shows the exact amount.
  const fmt = (n: number) => (format === "inr" ? formatINR(n === value ? value : Math.round(n / 100) * 100) : Math.round(n).toLocaleString("en-IN"));
  // Server and first client render show the final value, so there is no hydration mismatch.
  const [shown, setShown] = useState(value);
  const from = useRef<number | null>(null);

  useEffect(() => {
    let start = from.current;
    if (start === null) {
      const stored = storageKey ? readStore(`cu:${storageKey}`) : null;
      start = stored !== null ? Number(stored) : value;
    }
    from.current = value;
    if (storageKey) writeStore(`cu:${storageKey}`, String(value));
    if (start === value || prefersReducedMotion() || !Number.isFinite(start)) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const s = start;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      setShown(s + (value - s) * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setShown(s);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, storageKey, duration]);

  return (
    <span className={`tnum ${className ?? ""}`} aria-live="polite">
      {fmt(shown)}
    </span>
  );
}

/** Re-fetches the server component tree on an interval while the tab is visible. */
export function AutoRefresh({ every = 15000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, every);
    return () => window.clearInterval(id);
  }, [router, every]);
  return null;
}

/**
 * Marks rows (elements with data-row-id) the viewer hasn't seen before in this tab, so they slide
 * in and glow briefly. The first visit marks nothing.
 */
export function NewRows({ storageKey, children, className }: { storageKey: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const mark = () => {
      const rows = [...root.querySelectorAll<HTMLElement>("[data-row-id]")];
      const ids = rows.map((r) => r.dataset.rowId!);
      const raw = readStore(`nr:${storageKey}`);
      if (raw !== null && !prefersReducedMotion()) {
        const seen = new Set(raw.split(","));
        rows.forEach((r, i) => {
          if (!seen.has(r.dataset.rowId!)) {
            r.classList.add("row-new");
            r.style.setProperty("--row-delay", `${Math.min(i, 12) * 40}ms`);
          }
        });
      }
      writeStore(`nr:${storageKey}`, ids.join(","));
    };
    mark();
    const mo = new MutationObserver(mark);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [storageKey]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Three softly bouncing dots, for "in progress" status chips. */
export function TypingDots({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`typing-dots inline-flex items-center gap-[3px] ${className}`}>
      <span />
      <span />
      <span />
    </span>
  );
}
