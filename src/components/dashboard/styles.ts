/**
 * Shared class strings (usable from server and client).
 * Surfaces are flat sheets on paper: solid fill, ruled border, no blur and no lift on hover.
 */
export const glass = "rounded-[14px] border border-line bg-surface shadow-[var(--shadow-card)]";
export const glassRow =
  "rounded-xl border border-line-2 bg-surface transition-colors duration-150 hover:border-line hover:bg-sunken";
export const roundBtn =
  "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink transition-colors duration-150 hover:bg-sunken active:scale-95";
export const darkRoundBtn =
  "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-white transition-colors duration-150 hover:bg-ink-2 active:scale-95";
export const darkPill =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-ink-2";
/** The one most important action on a screen. Use once per view. */
export const stampPill =
  "inline-flex items-center justify-center gap-2 rounded-full bg-stamp px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-stamp-600";
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
