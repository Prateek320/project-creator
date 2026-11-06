"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_KEY as KEY } from "./theme-script";

export type ThemePref = "light" | "dark" | "system";

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

const OPTIONS: { id: ThemePref; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

/** Segmented Light / Dark / System control. The choice is stored per browser. */
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref | null>(null);
  useEffect(() => {
    try {
      setPref((localStorage.getItem(KEY) as ThemePref | null) ?? "light");
    } catch {
      setPref("light");
    }
  }, []);
  const choose = (p: ThemePref) => {
    setPref(p);
    try {
      localStorage.setItem(KEY, p);
    } catch {
      /* private mode: still applies for this page view */
    }
    apply(p);
  };
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex gap-1 rounded-full border border-line bg-surface p-1 dark:border-line">
      {OPTIONS.map((o) => {
        const on = pref === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => choose(o.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ${on ? "bg-ink text-white" : "text-ink-2 hover:bg-sunken hover:text-ink"}`}
          >
            <o.icon size={16} aria-hidden className={on ? "text-stamp-line" : ""} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
