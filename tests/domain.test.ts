import { describe, expect, it } from "vitest";
import { evaluateSettlement, previewEarnings, validateFormula, maxPayout } from "@/domain/compensation";
import { assertBalanced, balances, fundingLines, payoutLines, reversalLines, settlementLines } from "@/domain/ledger";
import { assertTransition, campaignMachine, deliverableMachine, applicationMachine } from "@/domain/state";
import { parseCsv, parseEvent, signPayload, verifySignature } from "@/domain/attribution";
import { formatINR, rupeesToMinor } from "@/domain/money";
import type { Formula, SettlementEventInput } from "@/domain/types";

const start = new Date("2026-10-01T00:00:00Z");
const end = new Date("2026-10-10T00:00:00Z");
const ev = (id: string, day: number, extra: Partial<SettlementEventInput> = {}): SettlementEventInput => ({
  eventId: id,
  eventType: "signup",
  occurredAt: new Date(start.getTime() + day * 86_400_000),
  validityState: "valid",
  ...extra,
});
const approved = (n: number, pending = 0) => [
  ...Array.from({ length: n }, () => ({ approvalState: "approved" })),
  ...Array.from({ length: pending }, () => ({ approvalState: "submitted" })),
];

const hybrid: Formula = {
  model: "hybrid",
  currency: "INR",
  baseFeeMinor: 300_000,
  ratePerOutcomeMinor: 7_000,
  capMinor: 1_000_000,
  outcomeEvent: "signup",
  attributionWindowDays: 7,
  partialDeliverablePolicy: "all_or_nothing",
  exclusions: "",
};

describe("compensation engine", () => {
  it("PRD worked example: ₹3,000 base + 50 × ₹70 = ₹6,500", () => {
    const events = Array.from({ length: 50 }, (_, i) => ev(`e${i}`, 1));
    const r = evaluateSettlement({ formula: hybrid, deliverables: approved(2), events, window: { start, end } });
    expect(r.totalMinor).toBe(650_000);
    expect(r.validOutcomes).toBe(50);
  });

  it("fixed model pays only once every deliverable is approved", () => {
    const f: Formula = { ...hybrid, model: "fixed", fixedFeeMinor: 800_000, partialDeliverablePolicy: "all_or_nothing" };
    expect(evaluateSettlement({ formula: f, deliverables: approved(3, 1), events: [], window: { start, end } }).totalMinor).toBe(0);
    expect(evaluateSettlement({ formula: f, deliverables: approved(4), events: [], window: { start, end } }).totalMinor).toBe(800_000);
  });

  it("fixed model with pro-rata pays approved share, rounding down to whole paise", () => {
    const f: Formula = { ...hybrid, model: "fixed", fixedFeeMinor: 1_000_000, partialDeliverablePolicy: "pro_rata" };
    expect(evaluateSettlement({ formula: f, deliverables: approved(1, 2), events: [], window: { start, end } }).totalMinor).toBe(333_333);
  });

  it("performance model excludes duplicate, invalid, test, wrong-type and out-of-window events", () => {
    const f: Formula = { ...hybrid, model: "performance", baseFeeMinor: undefined };
    const events = [
      ev("a", 1),
      ev("a", 2), // duplicate id
      ev("b", 1, { validityState: "invalid" }),
      ev("c", 1, { validityState: "test" }),
      ev("d", 1, { eventType: "click" }),
      ev("e", -1), // before start
      ev("f", 9 + 8), // after end + 7-day window
      ev("g", 9 + 6), // inside window
    ];
    const r = evaluateSettlement({ formula: f, deliverables: approved(1), events, window: { start, end } });
    expect(r.validOutcomes).toBe(2);
    expect(r.excluded).toEqual({ duplicate: 1, invalid: 1, outOfWindow: 2, wrongType: 1, test: 1 });
    expect(r.totalMinor).toBe(14_000);
  });

  it("hybrid applies the cap", () => {
    const events = Array.from({ length: 500 }, (_, i) => ev(`e${i}`, 1));
    const r = evaluateSettlement({ formula: hybrid, deliverables: approved(1), events, window: { start, end } });
    expect(r.totalMinor).toBe(1_000_000);
    expect(r.cappedAtMinor).toBe(1_000_000);
  });

  it("floor applies only when deliverables are approved (fairness guardrail)", () => {
    const f: Formula = { ...hybrid, model: "performance", baseFeeMinor: undefined, floorMinor: 200_000 };
    expect(evaluateSettlement({ formula: f, deliverables: approved(1), events: [ev("x", 1)], window: { start, end } }).totalMinor).toBe(200_000);
    expect(evaluateSettlement({ formula: f, deliverables: approved(0, 1), events: [ev("x", 1)], window: { start, end } }).totalMinor).toBe(7_000);
  });

  it("is deterministic regardless of event order", () => {
    const events = Array.from({ length: 30 }, (_, i) => ev(`e${i % 25}`, i % 12));
    const a = evaluateSettlement({ formula: hybrid, deliverables: approved(2), events, window: { start, end } });
    const b = evaluateSettlement({ formula: hybrid, deliverables: approved(2), events: [...events].reverse(), window: { start, end } });
    expect(a).toEqual(b);
  });

  it("rejects inconsistent formulas", () => {
    expect(() => validateFormula({ ...hybrid, baseFeeMinor: undefined })).toThrow(/base fee/);
    expect(() => validateFormula({ ...hybrid, floorMinor: 2_000_000 })).toThrow(/Floor/);
    expect(() => validateFormula({ ...hybrid, ratePerOutcomeMinor: 10.5 })).toThrow();
  });

  it("previews and bounds payouts", () => {
    expect(previewEarnings(hybrid, 50)).toBe(650_000);
    expect(previewEarnings(hybrid, 50, false)).toBe(350_000);
    expect(maxPayout(hybrid, 1000)).toBe(1_000_000);
  });
});

describe("money", () => {
  it("parses rupees without floating point", () => {
    expect(rupeesToMinor("12,500")).toBe(1_250_000);
    expect(rupeesToMinor("0.1")).toBe(10);
    expect(rupeesToMinor("19.99")).toBe(1999);
    expect(() => rupeesToMinor("12.345")).toThrow();
  });
  it("never renders negative zero (sums of negated ledger lines can be -0)", () => {
    expect(formatINR(-0)).toBe(formatINR(0));
    expect(formatINR(-0)).not.toMatch(/^[-−]/);
  });
});

describe("ledger", () => {
  it("requires balanced transactions", () => {
    expect(() => assertBalanced([{ account: "campaign_funds", amountMinor: 100 }, { account: "creator_payable", amountMinor: -99 }])).toThrow(/unbalanced/);
    expect(() => assertBalanced(settlementLines(5000, 1000))).not.toThrow();
  });
  it("reversals net to zero", () => {
    const lines = [...fundingLines(10_000), ...settlementLines(4000, 0), ...payoutLines(4000), ...reversalLines(payoutLines(4000))];
    const b = balances(lines);
    expect(b.creator_paid).toBe(0);
    expect(b.creator_payable).toBe(4000);
    expect(b.campaign_funds).toBe(6000);
  });
});

describe("state machines", () => {
  it("allows legal transitions only", () => {
    expect(() => assertTransition(campaignMachine, "campaign", "draft", "published")).not.toThrow();
    expect(() => assertTransition(campaignMachine, "campaign", "completed", "published")).toThrow();
    expect(() => assertTransition(deliverableMachine, "deliverable", "approved", "submitted")).toThrow();
    expect(() => assertTransition(deliverableMachine, "deliverable", "changes_requested", "resubmitted")).not.toThrow();
    expect(() => assertTransition(applicationMachine, "application", "rejected", "offered")).toThrow();
  });
});

describe("attribution contract", () => {
  it("verifies HMAC signatures in constant time", () => {
    const body = JSON.stringify({ a: 1 });
    const sig = signPayload("s3cret", body);
    expect(verifySignature("s3cret", body, sig)).toBe(true);
    expect(verifySignature("s3cret", body, `sha256=${sig}`)).toBe(true);
    expect(verifySignature("other", body, sig)).toBe(false);
    expect(verifySignature("s3cret", body + " ", sig)).toBe(false);
    expect(verifySignature("s3cret", body, null)).toBe(false);
  });
  it("validates event shape", () => {
    const ok = { event_id: "x", campaign_id: "c", creator_id: "k", event_type: "SIGNUP", occurred_at: "2026-10-01T00:00:00Z" };
    expect(parseEvent(ok).event_type).toBe("signup");
    expect(() => parseEvent({ ...ok, event_type: "like" })).toThrow(/Unknown/);
    expect(() => parseEvent({ ...ok, occurred_at: "2999-01-01T00:00:00Z" })).toThrow(/future/);
    expect(() => parseEvent({ ...ok, value_minor: 1.5 })).toThrow(/integer/);
  });
  it("parses quoted CSV", () => {
    const rows = parseCsv('event_id,event_type,note\r\n1,signup,"hello, world"\n2,sale,"say ""hi"""\n');
    expect(rows).toEqual([
      { event_id: "1", event_type: "signup", note: "hello, world" },
      { event_id: "2", event_type: "sale", note: 'say "hi"' },
    ]);
  });
});
