/** Pure domain types shared by the database layer, services and UI. No I/O here. */

export type CompensationModel = "fixed" | "performance" | "hybrid";
export type OutcomeEvent = "signup" | "sale" | "lead" | "install" | "click";

/**
 * A versioned compensation formula. Snapshotted onto every agreement version,
 * so the settlement for an agreement is always computed against the terms both parties accepted.
 */
export interface Formula {
  model: CompensationModel;
  currency: "INR";
  /** Fixed model: fee for completing all agreed deliverables (paise). */
  fixedFeeMinor?: number;
  /** Hybrid model: guaranteed base for approved deliverables (paise). */
  baseFeeMinor?: number;
  /** Performance / hybrid: amount per valid outcome (paise). */
  ratePerOutcomeMinor?: number;
  outcomeEvent?: OutcomeEvent;
  /** Maximum total payable to the creator under this agreement (paise). */
  capMinor?: number;
  /** Minimum performance payout once deliverables are approved (paise). Hybrid/performance only. */
  floorMinor?: number;
  /** Days after the campaign end date during which outcomes still count. */
  attributionWindowDays: number;
  /** How the deliverable-linked fee behaves if only some deliverables are approved. */
  partialDeliverablePolicy: "all_or_nothing" | "pro_rata";
  /** Free-text exclusions shown to both parties, e.g. "test accounts, self-referrals". */
  exclusions: string;
}

export interface CampaignAudience {
  locations: string[];
  ageRange: string;
  languages: string[];
  minFollowers: number;
}

export interface MeasurementPlan {
  primaryMetric: string;
  target: number;
  sourceOfTruth: "brand_webhook" | "csv_upload" | "tracked_link";
  validDefinition: string;
}

export interface SettlementEventInput {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  validityState: "valid" | "invalid" | "duplicate" | "out_of_window" | "test";
}

export interface SettlementInput {
  formula: Formula;
  deliverables: { approvalState: string }[];
  events: SettlementEventInput[];
  window: { start: Date; end: Date };
}

export interface SettlementLine {
  label: string;
  detail: string;
  amountMinor: number;
}

export interface SettlementResult {
  deliverablesApproved: number;
  deliverablesTotal: number;
  deliverablePortionMinor: number;
  outcomePortionMinor: number;
  totalMinor: number;
  validOutcomes: number;
  excluded: { duplicate: number; invalid: number; outOfWindow: number; wrongType: number; test: number };
  cappedAtMinor: number | null;
  flooredAtMinor: number | null;
  lines: SettlementLine[];
}

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string = "domain_error",
  ) {
    super(message);
    this.name = "DomainError";
  }
}
