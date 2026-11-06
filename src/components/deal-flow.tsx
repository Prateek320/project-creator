"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Building2, Check, FileText, Handshake, IndianRupee, ShieldCheck, Sparkles, UserRound, Video } from "lucide-react";
import { formatINR } from "@/domain/money";
import { prefersReducedMotion, TypingDots } from "./motion";

const STEPS = [
  { icon: FileText, title: "Brief published", detail: "₹3,000 base + ₹70 per verified signup", doing: "Publishing the brief" },
  { icon: UserRound, title: "Meera applied", detail: "12 campaigns delivered · 96% on time", doing: "Reviewing applicants" },
  { icon: Handshake, title: "Agreement v1 accepted", detail: "Both sides signed the same terms", doing: "Waiting for both signatures" },
  { icon: Video, title: "Reel + 3 Stories approved", detail: "Base unlocked", doing: "Reviewing content" },
  { icon: ShieldCheck, title: "Signups verified", detail: "3 duplicates and 1 test signup excluded", doing: "Verifying signups" },
  { icon: BadgeCheck, title: "Settlement approved", detail: "₹3,000 + 50 × ₹70", doing: "Calculating the settlement" },
] as const;

const STEP_MS = 1500;
const HOLD_MS = 3800;
const SIGNUPS = 50;

/** A tiny tween: animates from 0 to `to` while `run` is true; snaps when motion is reduced. */
function useTween(to: number, run: boolean, ms: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) {
      setV(0);
      return;
    }
    if (prefersReducedMotion()) {
      setV(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, run, ms]);
  return v;
}

/**
 * Landing-page hero: one hybrid deal plays from brief to payout on a loop. It pauses when the
 * tab is hidden or the card is off screen, and shows the finished deal when motion is reduced.
 */
export function DealFlow() {
  const total = STEPS.length + 1; // last step = paid
  const [step, setStep] = useState(total); // SSR and first paint show the finished deal
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = prefersReducedMotion();
    if (!reduced.current) setStep(0);
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { threshold: 0.2 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced.current || !visible) return;
    const id = window.setTimeout(() => {
      setStep((s) => (s >= total ? 0 : s + 1));
    }, step >= total ? HOLD_MS : step === 4 ? STEP_MS + 700 : STEP_MS);
    return () => window.clearTimeout(id);
  }, [step, visible, total]);

  const signups = useTween(SIGNUPS, step >= 4, 1500);
  const earned = 300000 + (step >= 4 ? signups : 0) * 7000 * (step >= 3 ? 1 : 0);
  const shownEarned = step >= 3 ? earned : 0;
  const paid = step >= total;
  const doing = paid ? null : STEPS[Math.min(step, STEPS.length - 1)]!.doing;

  return (
    <div ref={ref} className="rounded-[16px] border border-line bg-surface p-5 dark:border-line sm:p-6" aria-label="Example deal from brief to payout">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stamp-soft text-stamp"><Building2 size={17} aria-hidden /></span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-ink">Glow Botanics × Meera Iyer</div>
            <div className="text-xs text-muted">Hybrid · Monsoon Glow Serum launch</div>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors duration-300 ${paid ? "bg-stamp text-white" : "bg-black/5 text-ink-2"}`} aria-live="polite">
          {paid ? <><Check size={12} aria-hidden /> Paid</> : <><TypingDots /> {doing}</>}
        </span>
      </div>

      <ol className="mt-5 space-y-1">
        {STEPS.map((s, i) => {
          const done = step > i;
          const active = step === i;
          return (
            <li key={s.title} className={`flex items-center gap-3 rounded-2xl px-2.5 py-2 transition-all duration-500 ${active ? "bg-white" : ""} ${done || active ? "opacity-100" : "opacity-40"}`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors duration-500 ${done ? "dk-raise bg-ink text-stamp-line dark:bg-[#232323]" : active ? "bg-stamp text-white" : "bg-black/5 text-muted"}`}>
                {done ? <Check size={15} aria-hidden /> : <s.icon size={15} aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-ink">{s.title}</div>
                <div className="truncate text-xs text-muted">
                  {i === 4 && step >= 4 ? <><span className="tnum font-semibold text-ink-2">{signups}</span> verified · {s.detail}</> : s.detail}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex items-end justify-between gap-4 rounded-2xl bg-black/[0.04] p-4">
        <div>
          <div className="text-xs font-semibold text-muted">{paid ? "Paid to Meera" : "Earned so far"}</div>
          <div className="tnum mt-0.5 text-[30px] font-extrabold leading-none tracking-[-0.03em] text-ink">{formatINR(shownEarned)}</div>
        </div>
        <div className="text-right text-[11px] leading-relaxed text-muted">
          <div><IndianRupee size={11} className="mr-0.5 inline" aria-hidden />3,000 base</div>
          <div className="tnum">{step >= 4 ? signups : 0} × ₹70 signups</div>
        </div>
        {paid && (
          <svg viewBox="0 0 52 52" className="h-11 w-11 shrink-0" aria-hidden>
            <circle cx="26" cy="26" r="24" className="fill-stamp" />
            <path d="M15 27l7 7 15-16" fill="none" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" className="check-draw" style={{ stroke: "var(--color-canvas)" }} />
          </svg>
        )}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-faint"><Sparkles size={11} aria-hidden /> Demo data · same formula, same events, same payout every time.</p>
    </div>
  );
}

const ROLES = {
  brand: {
    label: "Brands",
    lede: "Hire on evidence, approve content, pay only for what was verified.",
    rows: [
      ["Meera Iyer · Story 3 of 3", "Content to review", "Review"],
      ["Approve earnings · ₹3,220", "46 verified signups", "To approve"],
      ["Sunscreen UGC pack", "1 of 3 creators hired", "Live"],
    ],
  },
  creator: {
    label: "Creators",
    lede: "See the payout formula before you apply. Watch earnings arrive as outcomes are verified.",
    rows: [
      ["Offer · Urban Stride", "₹12,000 when deliverables are approved", "Offer"],
      ["Monsoon Glow Serum", "3 of 4 approved · ₹3,220 earned", "Active"],
      ["Paid to you", "₹6,500 · Winter Lip Care", "Paid"],
    ],
  },
  ops: {
    label: "Operations",
    lede: "Resolve disputes with full evidence. Hold only what's disputed.",
    rows: [
      ["Invalid leads · ₹1,500 held", "10K Steps Challenge", "Open"],
      ["Kabir Malhotra", "Creator ID verification", "Pending"],
      ["Payout · ₹6,500", "Provider transfer", "Paid"],
    ],
  },
} as const;

/** "Choose your side" chip switcher for the landing page. */
export function RoleShowcase() {
  const [role, setRole] = useState<keyof typeof ROLES>("brand");
  const r = ROLES[role];
  return (
    <div>
      <div role="tablist" aria-label="Choose your side" className="flex flex-wrap gap-2">
        {(Object.keys(ROLES) as (keyof typeof ROLES)[]).map((k) => {
          const on = k === role;
          return (
            <button
              key={k}
              role="tab"
              id={`role-${k}`}
              aria-selected={on}
              aria-controls="role-panel"
              onClick={() => setRole(k)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 ${on ? "bg-stamp text-white" : "border border-black/[0.06] bg-surface text-ink-2 hover:bg-white"}`}
            >
              {ROLES[k].label}
            </button>
          );
        })}
      </div>
      <div id="role-panel" role="tabpanel" aria-labelledby={`role-${role}`} key={role} className="mt-5 animate-rise">
        <p className="text-[15px] leading-relaxed text-muted">{r.lede}</p>
        <ul className="mt-4 space-y-2.5">
          {r.rows.map(([t, s, chip], i) => (
            <li key={t} className="flex animate-rise items-center gap-3 rounded-2xl border border-line bg-surface p-3 dark:border-line" style={{ animationDelay: `${80 + i * 70}ms` }}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-black/5 text-ink-2">{i === 2 ? <IndianRupee size={17} aria-hidden /> : i === 1 ? <ShieldCheck size={17} aria-hidden /> : <Sparkles size={17} aria-hidden />}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink">{t}</span>
                <span className="block truncate text-xs text-muted">{s}</span>
              </span>
              <span className="shrink-0 rounded-full bg-black/5 px-2.5 py-0.5 text-[11px] font-bold text-ink-2">{chip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
