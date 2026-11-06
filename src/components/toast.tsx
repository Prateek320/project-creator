"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

/**
 * Corner toast for the ?notice= / ?error= messages server actions set. Success toasts dismiss
 * themselves after a few seconds (paused while hovered or focused); errors stay until closed.
 * The query params are removed so a refresh doesn't show the toast again.
 */
export function Toast({ message, tone }: { message: string; tone: "good" | "bad" }) {
  const [open, setOpen] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("notice") || url.searchParams.has("error")) {
      url.searchParams.delete("notice");
      url.searchParams.delete("error");
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, []);

  useEffect(() => {
    if (tone === "bad" || paused || !open) return;
    const id = window.setTimeout(() => setOpen(false), 6000);
    return () => window.clearTimeout(id);
  }, [tone, paused, open]);

  if (!open) return null;
  const Icon = tone === "bad" ? CircleAlert : CircleCheck;
  return (
    <div className="pointer-events-none fixed inset-x-4 top-20 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:justify-end">
      <div
        role={tone === "bad" ? "alert" : "status"}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 pr-2.5 text-sm text-ink shadow-[var(--shadow-pop)] dark:border-line"
      >
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${tone === "bad" ? "bg-bad-50 text-bad" : "bg-stamp text-white"}`}>
          <Icon size={16} aria-hidden />
        </span>
        <p className="min-w-0 flex-1 pt-1 leading-snug">{message}</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Dismiss" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink">
          <X size={15} aria-hidden />
        </button>
      </div>
    </div>
  );
}
