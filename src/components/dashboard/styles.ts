/** Shared class strings for the warm-glass design language (usable from server and client). */
export const glass = "backdrop-blur-md bg-white/55 border border-white/70 shadow-sm rounded-3xl";
export const glassRow =
  "rounded-2xl border border-white/70 bg-white/75 shadow-[0_1px_2px_rgba(15,18,34,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_8px_20px_-10px_rgba(15,18,34,0.25)]";
export const roundBtn =
  "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink shadow-[0_1px_2px_rgba(15,18,34,0.08),0_4px_12px_-4px_rgba(15,18,34,0.12)] transition-transform duration-200 hover:scale-105 active:scale-95";
export const darkRoundBtn =
  "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-lime shadow-[0_6px_16px_-6px_rgba(15,18,34,0.5)] transition-transform duration-200 hover:scale-105 active:scale-95";
export const darkPill =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgba(15,18,34,0.5)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0";
export const limePill =
  "inline-flex items-center justify-center gap-2 rounded-full bg-lime px-5 py-3 text-sm font-bold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_4px_12px_-4px_rgba(150,170,20,0.6)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0";
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
