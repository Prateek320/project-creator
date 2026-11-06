"use client";

import type { ReactNode } from "react";
import { Drawer } from "vaul";
import { ChevronRight, X } from "lucide-react";
import { cx, glassRow, roundBtn } from "./styles";


/**
 * A list card that opens an iOS-style bottom sheet (Vaul, built on Radix Dialog: focus trap, Esc,
 * swipe to dismiss). The sheet body is rendered on the server and passed in as children.
 */
export function QuickSheet({ initials, badge, title, subtitle, eyebrow, description, avatarColor, children }: {
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
            className={cx("grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-bold", avatarColor ? "text-white" : "border border-line bg-sunken text-ink-2")}
            style={avatarColor ? { background: avatarColor } : undefined}
          >
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold leading-tight text-ink">{title}</span>
            <span className="mt-0.5 block truncate text-xs text-muted">{subtitle}</span>
            <span className="mt-1 block truncate text-xs font-medium text-stamp">{badge}</span>
          </span>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-faint transition-colors group-hover:text-ink">
            <ChevronRight size={16} aria-hidden />
          </span>
        </button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/30" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-xl flex-col rounded-t-[20px] border-t border-line bg-surface font-sans outline-none">
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-ink/15" aria-hidden />
          <div className="overflow-y-auto px-5 pb-8 pt-4 sm:px-7">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-muted">{eyebrow}</div>
                <Drawer.Title className="mt-1 text-2xl font-bold tracking-[-0.02em] text-ink">{title}</Drawer.Title>
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
    <div className="rounded-xl border border-line-2 bg-sunken px-4 py-3">
      <div className="text-[12.5px] font-semibold text-muted">{label}</div>
      <div className="mt-0.5 truncate text-sm font-bold text-ink">{value}</div>
    </div>
  );
}
