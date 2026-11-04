/**
 * Compensation engine. Pure and deterministic: identical inputs + formula version
 * always produce identical settlement output (MVP backlog F, acceptance criterion).
 */
import { formatINR } from "./money";
import type { Formula, SettlementInput, SettlementLine, SettlementResult } from "./types";
import { DomainError } from "./types";

const DAY_MS = 86_400_000;

export function validateFormula(f: Formula): void {
  const nonNeg = (v: number | undefined, label: string) => {
    if (v !== undefined && (!Number.isSafeInteger(v) || v < 0)) throw new DomainError(`${label} must be a positive whole amount`);
  };
  nonNeg(f.fixedFeeMinor, "Fixed fee");
  nonNeg(f.baseFeeMinor, "Base fee");
  nonNeg(f.ratePerOutcomeMinor, "Rate per outcome");
  nonNeg(f.capMinor, "Cap");
  nonNeg(f.floorMinor, "Floor");
  if (f.attributionWindowDays < 0 || f.attributionWindowDays > 90) throw new DomainError("Attribution window must be 0–90 days");
  if (f.model === "fixed" && !f.fixedFeeMinor) throw new DomainError("A fixed-fee campaign needs a fee");
  if (f.model !== "fixed") {
    if (!f.ratePerOutcomeMinor) throw new DomainError("Performance pricing needs a rate per outcome");
    if (!f.outcomeEvent) throw new DomainError("Choose which outcome is paid for");
  }
  if (f.model === "hybrid" && !f.baseFeeMinor) throw new DomainError("A hybrid campaign needs a guaranteed base fee");
  if (f.capMinor !== undefined && f.floorMinor !== undefined && f.floorMinor > f.capMinor)
    throw new DomainError("Floor cannot be higher than the cap");
}

/** Maximum a single creator could earn under this formula (used for budget checks). */
export function maxPayout(f: Formula, targetOutcomes: number): number {
  if (f.model === "fixed") return f.fixedFeeMinor ?? 0;
  const base = f.model === "hybrid" ? (f.baseFeeMinor ?? 0) : 0;
  const uncapped = base + (f.ratePerOutcomeMinor ?? 0) * targetOutcomes;
  return f.capMinor !== undefined ? Math.min(uncapped, f.capMinor) : uncapped;
}

export function evaluateSettlement(input: SettlementInput): SettlementResult {
  const { formula: f, deliverables, events, window } = input;
  validateFormula(f);
  const lines: SettlementLine[] = [];

  // 1. Deliverables (creator-controlled).
  const total = deliverables.length;
  const approved = deliverables.filter((d) => d.approvalState === "approved").length;
  const allApproved = total > 0 && approved === total;
  const deliverableFee = f.model === "fixed" ? (f.fixedFeeMinor ?? 0) : f.model === "hybrid" ? (f.baseFeeMinor ?? 0) : 0;
  let deliverablePortion = 0;
  if (deliverableFee > 0) {
    if (allApproved) deliverablePortion = deliverableFee;
    else if (f.partialDeliverablePolicy === "pro_rata" && total > 0)
      deliverablePortion = Math.floor((deliverableFee * approved) / total);
    lines.push({
      label: f.model === "fixed" ? "Fixed fee" : "Guaranteed base",
      detail: `${approved} of ${total} deliverables approved · ${
        f.partialDeliverablePolicy === "pro_rata" ? "paid pro-rata" : "paid when all are approved"
      }`,
      amountMinor: deliverablePortion,
    });
  }

  // 2. Outcomes (business results), only if the model pays for them.
  const excluded = { duplicate: 0, invalid: 0, outOfWindow: 0, wrongType: 0, test: 0 };
  let validOutcomes = 0;
  let outcomePortion = 0;
  if (f.model !== "fixed") {
    const windowEnd = window.end.getTime() + f.attributionWindowDays * DAY_MS;
    const seen = new Set<string>();
    // Sort for determinism regardless of input order.
    const sorted = [...events].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.eventId.localeCompare(b.eventId),
    );
    for (const e of sorted) {
      if (seen.has(e.eventId) || e.validityState === "duplicate") {
        excluded.duplicate++;
        continue;
      }
      seen.add(e.eventId);
      if (e.eventType !== f.outcomeEvent) {
        excluded.wrongType++;
        continue;
      }
      if (e.validityState === "test") {
        excluded.test++;
        continue;
      }
      if (e.validityState === "invalid") {
        excluded.invalid++;
        continue;
      }
      const t = e.occurredAt.getTime();
      if (e.validityState === "out_of_window" || t < window.start.getTime() || t > windowEnd) {
        excluded.outOfWindow++;
        continue;
      }
      validOutcomes++;
    }
    outcomePortion = validOutcomes * (f.ratePerOutcomeMinor ?? 0);
    lines.push({
      label: `Verified ${f.outcomeEvent}s`,
      detail: `${validOutcomes} × ${formatINR(f.ratePerOutcomeMinor ?? 0)}`,
      amountMinor: outcomePortion,
    });
    const excludedCount = excluded.duplicate + excluded.invalid + excluded.outOfWindow + excluded.test;
    if (excludedCount > 0) {
      lines.push({
        label: "Excluded events",
        detail: [
          excluded.duplicate && `${excluded.duplicate} duplicate`,
          excluded.invalid && `${excluded.invalid} invalid`,
          excluded.outOfWindow && `${excluded.outOfWindow} outside window`,
          excluded.test && `${excluded.test} test`,
        ]
          .filter(Boolean)
          .join(" · "),
        amountMinor: 0,
      });
    }
  }

  // 3. Floor (only once the creator has delivered — fairness guardrail) and cap.
  let totalMinor = deliverablePortion + outcomePortion;
  let flooredAtMinor: number | null = null;
  let cappedAtMinor: number | null = null;
  if (f.floorMinor !== undefined && f.model !== "fixed" && allApproved && totalMinor < f.floorMinor) {
    lines.push({ label: "Floor applied", detail: `Minimum payout once deliverables are approved`, amountMinor: f.floorMinor - totalMinor });
    totalMinor = f.floorMinor;
    flooredAtMinor = f.floorMinor;
  }
  if (f.capMinor !== undefined && totalMinor > f.capMinor) {
    lines.push({ label: "Cap applied", detail: `Agreement caps total payout at ${formatINR(f.capMinor)}`, amountMinor: f.capMinor - totalMinor });
    totalMinor = f.capMinor;
    cappedAtMinor = f.capMinor;
  }

  return {
    deliverablesApproved: approved,
    deliverablesTotal: total,
    deliverablePortionMinor: deliverablePortion,
    outcomePortionMinor: outcomePortion,
    totalMinor,
    validOutcomes,
    excluded,
    cappedAtMinor,
    flooredAtMinor,
    lines,
  };
}

/** Quick what-if used by the campaign builder and the creator's pre-application calculator. */
export function previewEarnings(f: Formula, outcomes: number, deliverablesApproved = true): number {
  const deliverables = deliverablesApproved ? [{ approvalState: "approved" }] : [{ approvalState: "pending" }];
  const start = new Date("2026-01-01T00:00:00Z");
  const events = Array.from({ length: f.model === "fixed" ? 0 : Math.max(0, Math.floor(outcomes)) }, (_, i) => ({
    eventId: `preview-${i}`,
    eventType: f.outcomeEvent ?? "signup",
    occurredAt: start,
    validityState: "valid" as const,
  }));
  return evaluateSettlement({ formula: f, deliverables, events, window: { start, end: start } }).totalMinor;
}

export function describeFormula(f: Formula): string {
  const cap = f.capMinor ? `, capped at ${formatINR(f.capMinor)}` : "";
  switch (f.model) {
    case "fixed":
      return `${formatINR(f.fixedFeeMinor ?? 0)} when all agreed deliverables are approved`;
    case "performance":
      return `${formatINR(f.ratePerOutcomeMinor ?? 0)} per verified ${f.outcomeEvent}${cap} · ${f.attributionWindowDays}-day attribution window`;
    case "hybrid":
      return `${formatINR(f.baseFeeMinor ?? 0)} guaranteed for approved deliverables + ${formatINR(
        f.ratePerOutcomeMinor ?? 0,
      )} per verified ${f.outcomeEvent}${cap}`;
  }
}
