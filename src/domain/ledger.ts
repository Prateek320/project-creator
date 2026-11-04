/**
 * Double-entry ledger rules. Every transaction group must sum to zero.
 * The platform does not hold funds: "campaign_funds" mirrors money held by the
 * approved payment provider on the campaign's behalf (mock provider in this MVP).
 */
import { DomainError } from "./types";

export const ACCOUNTS = {
  brand_external: "Brand bank (external)",
  campaign_funds: "Campaign funds at payment provider",
  creator_payable: "Approved, awaiting payout",
  dispute_hold: "Held for open dispute",
  creator_paid: "Paid to creator (external)",
  brand_refund: "Refunded to brand (external)",
} as const;
export type Account = keyof typeof ACCOUNTS;

export interface LedgerLine {
  account: Account;
  amountMinor: number;
}

export function assertBalanced(lines: LedgerLine[]): void {
  if (lines.length < 2) throw new DomainError("A ledger transaction needs at least two lines");
  for (const l of lines) {
    if (!Number.isSafeInteger(l.amountMinor)) throw new DomainError("Ledger amounts must be integer paise");
  }
  const sum = lines.reduce((s, l) => s + l.amountMinor, 0);
  if (sum !== 0) throw new DomainError(`Ledger transaction is unbalanced by ${sum} paise`);
}

export function balances(entries: { account: string; amountMinor: number }[]): Record<Account, number> {
  const out = Object.fromEntries(Object.keys(ACCOUNTS).map((k) => [k, 0])) as Record<Account, number>;
  for (const e of entries) {
    if (e.account in out) out[e.account as Account] += e.amountMinor;
  }
  return out;
}

/** Funding: brand pays the provider. */
export const fundingLines = (amount: number): LedgerLine[] => [
  { account: "brand_external", amountMinor: -amount },
  { account: "campaign_funds", amountMinor: amount },
];

/** Settlement approval: move earned amount from campaign funds to payable (or to hold if disputed). */
export const settlementLines = (payable: number, held: number): LedgerLine[] => [
  { account: "campaign_funds", amountMinor: -(payable + held) },
  ...(payable > 0 ? [{ account: "creator_payable" as const, amountMinor: payable }] : []),
  ...(held > 0 ? [{ account: "dispute_hold" as const, amountMinor: held }] : []),
];

export const payoutLines = (amount: number): LedgerLine[] => [
  { account: "creator_payable", amountMinor: -amount },
  { account: "creator_paid", amountMinor: amount },
];

/** Compensating entry: never edit a settled row, append its inverse. */
export const reversalLines = (lines: LedgerLine[]): LedgerLine[] => lines.map((l) => ({ ...l, amountMinor: -l.amountMinor }));

export const refundLines = (amount: number): LedgerLine[] => [
  { account: "campaign_funds", amountMinor: -amount },
  { account: "brand_refund", amountMinor: amount },
];

export const releaseHoldLines = (toCreator: number, toCampaign: number): LedgerLine[] => [
  { account: "dispute_hold", amountMinor: -(toCreator + toCampaign) },
  ...(toCreator > 0 ? [{ account: "creator_payable" as const, amountMinor: toCreator }] : []),
  ...(toCampaign > 0 ? [{ account: "campaign_funds" as const, amountMinor: toCampaign }] : []),
];
