"use client";

import { useMemo, useState } from "react";
import { describeFormula, previewEarnings } from "@/domain/compensation";
import { formatINR } from "@/domain/money";
import type { CompensationModel, Formula, OutcomeEvent } from "@/domain/types";
import { cx, inputClass } from "./ui";

const toRupees = (minor?: number) => (minor === undefined ? "" : String(minor / 100));
const toMinor = (v: string): number | undefined => {
  const n = Number(v.replace(/,/g, ""));
  return v.trim() === "" || !Number.isFinite(n) || n < 0 ? undefined : Math.round(n * 100);
};

const MODELS: { id: CompensationModel; title: string; body: string }[] = [
  { id: "hybrid", title: "Hybrid", body: "Guaranteed base for approved content + a bonus per verified outcome. Recommended." },
  { id: "fixed", title: "Fixed fee", body: "Pay for approved deliverables, regardless of results. Best for UGC and awareness." },
  { id: "performance", title: "Performance", body: "Pay only per verified outcome. Creators carry the risk, so expect fewer applicants." },
];

/**
 * Compensation inputs (named with a prefix so several can coexist on a page) plus a live
 * preview. Server re-validates everything; this is for clarity, not trust.
 */
export function FormulaFields({ initial, prefix = "f_", target = 100, budgetMinor, slots = 1, compact = false }: { initial?: Formula; prefix?: string; target?: number; budgetMinor?: number; slots?: number; compact?: boolean }) {
  const [model, setModel] = useState<CompensationModel>(initial?.model ?? "hybrid");
  const [fixedFee, setFixedFee] = useState(toRupees(initial?.fixedFeeMinor ?? 800_000));
  const [baseFee, setBaseFee] = useState(toRupees(initial?.baseFeeMinor ?? 300_000));
  const [rate, setRate] = useState(toRupees(initial?.ratePerOutcomeMinor ?? 7_000));
  const [cap, setCap] = useState(toRupees(initial?.capMinor ?? 1_000_000));
  const [floor, setFloor] = useState(toRupees(initial?.floorMinor));
  const [event, setEvent] = useState<OutcomeEvent>(initial?.outcomeEvent ?? "signup");
  const [windowDays, setWindowDays] = useState(String(initial?.attributionWindowDays ?? 7));
  const [policy, setPolicy] = useState(initial?.partialDeliverablePolicy ?? "all_or_nothing");
  const [exclusions, setExclusions] = useState(initial?.exclusions ?? "Test accounts, self-referrals and duplicate signups");

  const formula: Formula = useMemo(
    () => ({
      model,
      currency: "INR",
      fixedFeeMinor: model === "fixed" ? toMinor(fixedFee) : undefined,
      baseFeeMinor: model === "hybrid" ? toMinor(baseFee) : undefined,
      ratePerOutcomeMinor: model !== "fixed" ? toMinor(rate) : undefined,
      capMinor: model !== "fixed" ? toMinor(cap) : undefined,
      floorMinor: model !== "fixed" ? toMinor(floor) : undefined,
      outcomeEvent: model !== "fixed" ? event : undefined,
      attributionWindowDays: Number(windowDays) || 0,
      partialDeliverablePolicy: policy,
      exclusions,
    }),
    [model, fixedFee, baseFee, rate, cap, floor, event, windowDays, policy, exclusions],
  );

  const n = (k: string) => `${prefix}${k}`;
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-2">Compensation model</legend>
        <div className={cx("grid gap-2", compact ? "sm:grid-cols-3" : "sm:grid-cols-3")}>
          {MODELS.map((m) => (
            <label key={m.id} className={cx("cursor-pointer rounded-2xl border p-3 text-sm transition-colors", model === m.id ? "border-ink bg-white" : "border-black/[0.07] bg-surface hover:bg-sunken")}>
              <input type="radio" name={n("model")} value={m.id} checked={model === m.id} onChange={() => setModel(m.id)} className="sr-only" />
              <div className="font-semibold text-ink">{m.title}</div>
              {!compact && <div className="mt-0.5 text-xs text-muted">{m.body}</div>}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {model === "fixed" && <MoneyInput label="Fee for all deliverables" name={n("fixedFee")} value={fixedFee} onChange={setFixedFee} />}
        {model === "hybrid" && <MoneyInput label="Guaranteed base" name={n("baseFee")} value={baseFee} onChange={setBaseFee} hint="Paid when deliverables are approved" />}
        {model !== "fixed" && (
          <>
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <MoneyInput label="Rate per verified outcome" name={n("rate")} value={rate} onChange={setRate} />
              <select aria-label="Outcome" name={n("outcomeEvent")} value={event} onChange={(e) => setEvent(e.target.value as OutcomeEvent)} className={cx(inputClass, "w-auto")}>
                <option value="signup">per signup</option>
                <option value="sale">per sale</option>
                <option value="lead">per lead</option>
                <option value="install">per install</option>
                <option value="click">per click</option>
              </select>
            </div>
            <MoneyInput label="Cap per creator" name={n("cap")} value={cap} onChange={setCap} hint="Maximum total payout under this agreement" />
            <MoneyInput label="Floor (optional)" name={n("floor")} value={floor} onChange={setFloor} hint="Minimum payout once content is approved" />
            <label className="space-y-1.5">
              <span className="block text-sm font-medium text-ink-2">Attribution window</span>
              <span className="flex items-center gap-2">
                <input name={n("attributionWindowDays")} inputMode="numeric" value={windowDays} onChange={(e) => setWindowDays(e.target.value)} className={cx(inputClass, "w-20")} />
                <span className="text-sm text-muted">days after campaign end</span>
              </span>
            </label>
          </>
        )}
        {model !== "performance" && (
          <label className="space-y-1.5">
            <span className="block text-sm font-medium text-ink-2">If only some deliverables are approved</span>
            <select name={n("partialDeliverablePolicy")} value={policy} onChange={(e) => setPolicy(e.target.value as "pro_rata" | "all_or_nothing")} className={inputClass}>
              <option value="all_or_nothing">Pay the fee once all are approved</option>
              <option value="pro_rata">Pay pro-rata per approved deliverable</option>
            </select>
          </label>
        )}
        {model === "performance" && <input type="hidden" name={n("partialDeliverablePolicy")} value="all_or_nothing" />}
        {model === "fixed" && <input type="hidden" name={n("attributionWindowDays")} value="0" />}
      </div>
      {model !== "fixed" && (
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-ink-2">Excluded outcomes</span>
          <input name={n("exclusions")} value={exclusions} onChange={(e) => setExclusions(e.target.value)} className={inputClass} />
        </label>
      )}
      {model === "fixed" && <input type="hidden" name={n("exclusions")} value="" />}
      <EarningsPreview formula={formula} target={target} budgetMinor={budgetMinor} slots={slots} />
    </div>
  );
}

function MoneyInput({ label, name, value, onChange, hint }: { label: string; name: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-ink-2">{label}</span>
      <span className="relative block">
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">₹</span>
        <input name={name} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputClass, "pl-7 tnum")} />
      </span>
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** "What would the creator earn?" — the same pure function the server uses to settle. */
export function EarningsPreview({ formula, target = 100, budgetMinor, slots = 1, title = "Earnings preview" }: { formula: Formula; target?: number; budgetMinor?: number; slots?: number; title?: string }) {
  const [outcomes, setOutcomes] = useState(Math.round(target / 2));
  const max = Math.max(10, Math.round(target * 2));
  let value = 0;
  let ok = true;
  try {
    value = previewEarnings(formula, outcomes);
  } catch {
    ok = false;
  }
  const points = Array.from({ length: 21 }, (_, i) => {
    const o = Math.round((max * i) / 20);
    try {
      return { o, v: previewEarnings(formula, o) };
    } catch {
      return { o, v: 0 };
    }
  });
  const peak = Math.max(1, ...points.map((p) => p.v));
  const worst = points[points.length - 1]!.v * slots;
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-medium text-ink-2">{title}</div>
        {ok && <div className="text-xs text-muted">{describeFormula(formula)}</div>}
      </div>
      {!ok ? (
        <p className="mt-2 text-sm text-warn">Complete the amounts above to see a preview.</p>
      ) : (
        <>
          <div className="mt-3 flex items-end gap-6">
            <div>
              <div className="tnum text-3xl font-semibold tracking-tight">{formatINR(value)}</div>
              <div className="text-xs text-muted">
                {formula.model === "fixed" ? "once deliverables are approved" : `if ${outcomes} verified ${formula.outcomeEvent}s and content is approved`}
              </div>
            </div>
            <svg viewBox="0 0 200 48" className="h-12 flex-1" aria-hidden preserveAspectRatio="none">
              <polyline fill="none" stroke="var(--color-accent)" strokeWidth="2" points={points.map((p, i) => `${(i / 20) * 200},${46 - (p.v / peak) * 42}`).join(" ")} />
              <line x1={(outcomes / max) * 200} x2={(outcomes / max) * 200} y1="0" y2="48" stroke="#94a3b8" strokeDasharray="2 2" />
            </svg>
          </div>
          {formula.model !== "fixed" && (
            <label className="mt-3 block">
              <span className="sr-only">Verified outcomes</span>
              <input type="range" min={0} max={max} value={outcomes} onChange={(e) => setOutcomes(Number(e.target.value))} className="w-full" />
              <span className="flex justify-between text-xs text-muted">
                <span>0</span>
                <span>{max} {formula.outcomeEvent}s</span>
              </span>
            </label>
          )}
          {budgetMinor !== undefined && (
            <p className={cx("mt-2 text-xs", worst > budgetMinor ? "text-bad" : "text-muted")}>
              Worst case for {slots} creator{slots > 1 ? "s" : ""}: {formatINR(worst)} · budget {formatINR(budgetMinor)}
              {worst > budgetMinor ? " — raise the budget or lower the cap before publishing" : " ✓ covered"}
            </p>
          )}
        </>
      )}
    </div>
  );
}
