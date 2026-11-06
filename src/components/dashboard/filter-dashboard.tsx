"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
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
      <div role="tablist" aria-label="Dashboard filters" className={cx("tiles grid grid-cols-2 gap-3 sm:gap-4", views.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {views.map((v, i) => {
          const on = v.id === view;
          const Icon = VIEW_ICONS[v.icon] ?? Zap;
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
                "group relative overflow-hidden p-4 text-left transition-all duration-300 ease-out sm:p-5",
                on
                  ? "dk-raise rounded-3xl bg-ink text-white shadow-[0_12px_32px_-12px_rgba(15,18,34,0.55)] dark:bg-[#1a1a1a] dark:text-ink dark:shadow-[inset_0_0_0_1px_rgba(227,242,92,0.4),0_16px_40px_-16px_rgba(227,242,92,0.22)]" : cx(glass, "text-ink hover:-translate-y-0.5 hover:bg-white/75 hover:shadow-md"),
              )}
            >
              {on && <span aria-hidden className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-lime/25 blur-2xl dark:bg-lime/15" />}
              <div className="relative flex items-center justify-between">
                <span className={cx("grid h-9 w-9 place-items-center rounded-full transition-colors", on ? "bg-lime text-ink" : v.tint)}>
                  <Icon size={17} strokeWidth={2.2} aria-hidden />
                </span>
                <ArrowUpRight size={16} aria-hidden className={cx("transition-all duration-300", on ? "rotate-45 text-lime" : "text-faint group-hover:text-ink")} />
              </div>
              <div className={cx("relative mt-4 text-[13px] font-semibold", on ? "text-white/70 dark:text-muted" : "text-muted")}>{v.label}</div>
              <div className="relative mt-0.5 truncate text-[26px] font-extrabold leading-tight tracking-[-0.02em] tabular-nums sm:text-[30px]">{v.value}</div>
              <div className={cx("relative mt-1 truncate text-xs font-medium", on ? "text-lime" : "text-muted")}>{v.caption}</div>
            </button>
          );
        })}
      </div>
      <div id="dash-panel" role="tabpanel" aria-labelledby={`tab-${view}`} key={view} className="animate-rise">
        {panels[view]}
      </div>
    </>
  );
}
