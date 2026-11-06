"use client";

import type { ReactNode } from "react";
import { Drawer } from "vaul";
import { ChevronRight, Sparkles, X } from "lucide-react";
import { cx, glassRow, roundBtn } from "./styles";

const TONES = ["from-emerald-100 to-teal-50", "from-sky-100 to-indigo-50", "from-amber-100 to-rose-50", "from-violet-100 to-fuchsia-50"];

/**
 * A list card that opens an iOS-style bottom sheet (Vaul, built on Radix Dialog: focus trap, Esc,
 * swipe to dismiss). The sheet body is rendered on the server and passed in as children.
 */
export function QuickSheet({ initials, badge, title, subtitle, eyebrow, description, tone = 0, avatarColor, children }: {
  initials: string;
  badge: string;
  title: string;
  subtitle: string;
  eyebrow: string;
  description: string;
  tone?: number;
  avatarColor?: string;
  children: ReactNode;
}) {
  return (
    <Drawer.Root shouldScaleBackground={false}>
      <Drawer.Trigger asChild>
        <button className={cx(glassRow, "group flex w-full items-center gap-3 p-2.5 text-left")}>
          <span
            className={cx("grid h-[72px] w-[72px] shrink-0 place-items-center rounded-xl text-xl font-extrabold", avatarColor ? "text-white" : cx("bg-gradient-to-br text-ink/80", TONES[tone % TONES.length]))}
            style={avatarColor ? { background: `linear-gradient(160deg, color-mix(in srgb, ${avatarColor} 70%, white), ${avatarColor})` } : undefined}
          >
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-lime">
              <Sparkles size={10} aria-hidden /> {badge}
            </span>
            <span className="mt-1 block truncate text-[15px] font-bold leading-tight text-ink">{title}</span>
            <span className="mt-0.5 block truncate text-xs text-muted">{subtitle}</span>
          </span>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/[0.05] text-ink-2 transition-colors group-hover:bg-ink group-hover:text-white">
            <ChevronRight size={16} aria-hidden />
          </span>
        </button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px]" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-xl flex-col rounded-t-[32px] bg-gradient-to-br from-green-50 via-amber-50 to-blue-50 font-sans outline-none">
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-ink/15" aria-hidden />
          <div className="overflow-y-auto px-5 pb-8 pt-4 sm:px-7">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{eyebrow}</div>
                <Drawer.Title className="mt-1 text-2xl font-extrabold tracking-[-0.02em] text-ink">{title}</Drawer.Title>
              </div>
              <Drawer.Close aria-label="Close" className={roundBtn}>
                <X size={18} aria-hidden />
              </Drawer.Close>
            </div>
            <Drawer.Description className="mt-3 text-[15px] leading-relaxed text-ink-2">{description}</Drawer.Description>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className="mt-0.5 truncate text-sm font-bold text-ink">{value}</div>
    </div>
  );
}
