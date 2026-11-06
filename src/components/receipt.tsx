"use client";

import { useEffect, useRef, useState } from "react";
import { formatINR } from "@/domain/money";
import { CountUp } from "./motion";

export interface ReceiptLine {
  label: string;
  amountMinor: number;
}

/**
 * Shown once, right after a payout: the check draws itself, the amount counts up and the ledger
 * lines slide in. Esc, the backdrop or "Done" closes it and removes ?receipt= from the URL.
 */
export function PayoutReceipt({ amountMinor, creator, campaign, providerRef, when, lines }: { amountMinor: number; creator: string; campaign: string; providerRef: string; when: string; lines: ReceiptLine[] }) {
  const [open, setOpen] = useState(true);
  const done = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  const close = () => {
    setOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("receipt");
    window.history.replaceState(window.history.state, "", url.toString());
    (opener.current as HTMLElement | null)?.focus?.();
  };

  useEffect(() => {
    opener.current = document.activeElement;
    done.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div aria-hidden onClick={close} className="absolute inset-0 animate-fade bg-ink/25 dark:bg-black/60" />
      <div role="dialog" aria-modal="true" aria-labelledby="receipt-title" className="relative w-full max-w-sm animate-pop-in rounded-[16px] border border-line bg-surface p-6 text-center shadow-[var(--shadow-pop)] dark:border-line">
        <svg viewBox="0 0 52 52" className="mx-auto h-14 w-14" aria-hidden>
          <circle cx="26" cy="26" r="24" className="fill-stamp" />
          <path d="M15 27l7 7 15-16" fill="none" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" className="check-draw" style={{ stroke: "var(--color-canvas)" }} />
        </svg>
        <h2 id="receipt-title" className="mt-4 text-sm font-semibold text-muted">
          Paid to {creator}
        </h2>
        <div className="mt-1 text-[40px] font-extrabold leading-none tracking-[-0.03em] text-ink">
          <CountUp value={amountMinor} format="inr" duration={1100} />
        </div>
        <p className="mt-2 text-xs text-muted">
          {campaign} · {when}
        </p>
        <ul className="mt-5 space-y-1.5 rounded-2xl bg-black/[0.04] p-3 text-left text-[13px]">
          {lines.map((l, i) => (
            <li key={l.label} className="flex animate-rise items-center justify-between gap-3" style={{ animationDelay: `${450 + i * 90}ms` }}>
              <span className="text-ink-2">{l.label}</span>
              <span className={`tnum font-semibold ${l.amountMinor < 0 ? "text-muted" : "text-ink"}`}>
                {l.amountMinor > 0 ? "+" : "−"}
                {formatINR(Math.abs(l.amountMinor))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 font-mono text-[11px] text-faint">{providerRef} · test mode</p>
        <button ref={done} type="button" onClick={close} className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-ink text-sm font-semibold text-white transition-transform duration-200">
          Done
        </button>
      </div>
    </div>
  );
}
