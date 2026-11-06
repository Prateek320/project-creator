"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Filter,
  Inbox,
  Megaphone,
  Rocket,
  Scale,
  Send,
  ShieldCheck,
  UsersRound,
  WalletMinimal,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cx, glass } from "./styles";

export const VIEW_ICONS: Record<string, LucideIcon> = {
  zap: Zap,
  rocket: Rocket,
  send: Send,
  wallet: WalletMinimal,
  megaphone: Megaphone,
  users: UsersRound,
  scale: Scale,
  filter: Filter,
  shield: ShieldCheck,
  alert: AlertTriangle,
  inbox: Inbox,
  badge: BadgeCheck,
};

export interface ViewDef {
  id: string;
  label: string;
  icon: keyof typeof VIEW_ICONS;
  tint: string;
  value: string;
  caption: string;
}

/**
 * Stat cards that double as filters (WAI-ARIA tabs). Exactly one view is selected; its panel is
 * shown below. The choice is mirrored to ?view= so refresh and shared links keep it.
 */
export function FilterDashboard({ views, panels, initialView, defaultView }: { views: ViewDef[]; panels: Record<string, ReactNode>; initialView: string; defaultView: string }) {
  const [view, setView] = useState(initialView);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const mounted = useRef(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("notice");
    url.searchParams.delete("error");
    if (view === defaultView) url.searchParams.delete("view");
    else url.searchParams.set("view", view);
    // A chip belongs to one view: drop it when the user switches views (not on first render).
    if (mounted.current) url.searchParams.delete("chip");
    mounted.current = true;
    window.history.replaceState(window.history.state, "", url.toString());
  }, [view, defaultView]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const n = (i + dir + views.length) % views.length;
    setView(views[n]!.id);
    refs.current[n]?.focus();
  };

  return (
    <>
      {/* One ruled strip, not four floating cards: the cells read as columns of the same ledger. */}
      <div role="tablist" aria-label="Dashboard filters" className={cx(glass, "grid grid-cols-2 overflow-hidden", views.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {views.map((v, i) => {
          const on = v.id === view;
          return (
            <button
              key={v.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              id={`tab-${v.id}`}
              aria-selected={on}
              aria-controls="dash-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => setView(v.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cx(
                "relative border-line-2 px-4 pb-4 pt-5 text-left transition-colors duration-150 sm:px-5 [&:nth-child(odd)]:border-r lg:border-r lg:last:border-r-0 [&:nth-child(-n+2)]:border-b lg:[&:nth-child(-n+2)]:border-b-0",
                on ? "bg-surface" : "bg-sunken/60 hover:bg-surface",
              )}
            >
              <span aria-hidden className={cx("absolute inset-x-0 top-0 h-[3px] transition-colors", on ? "bg-stamp" : "bg-transparent")} />
              <div className={cx("text-[13px] font-semibold", on ? "text-ink" : "text-muted")}>{v.label}</div>
              <div className={cx("figures mt-1 truncate text-[26px] font-bold leading-tight xl:text-[30px]", on ? "text-ink" : "text-ink-2")}>{v.value}</div>
              <div className="mt-0.5 truncate text-xs text-muted">{v.caption}</div>
            </button>
          );
        })}
      </div>
      <div id="dash-panel" role="tabpanel" aria-labelledby={`tab-${view}`} key={view} className="animate-fade">
        {panels[view]}
      </div>
    </>
  );
}
