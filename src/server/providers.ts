/**
 * Provider adapters. The MVP ships only mock implementations: no real money moves and no
 * live social data is fetched. Real adapters (e.g. a split-settlement payment product,
 * Instagram Graph / YouTube Data APIs) plug in behind these interfaces after approval and legal review.
 */
import { createHash } from "node:crypto";

export interface PaymentProvider {
  readonly name: string;
  readonly isLive: boolean;
  collect(p: { idempotencyKey: string; amountMinor: number; currency: string }): Promise<{ providerRef: string; status: "funded" }>;
  transfer(p: { idempotencyKey: string; amountMinor: number; currency: string; destination: string }): Promise<{
    providerRef: string;
    status: "paid" | "failed";
  }>;
}

const ref = (prefix: string, key: string) => `${prefix}_${createHash("sha256").update(key).digest("hex").slice(0, 18)}`;

/** Deterministic: the same idempotency key always yields the same provider reference. */
export const mockPaymentProvider: PaymentProvider = {
  name: "mock",
  isLive: false,
  async collect({ idempotencyKey }) {
    return { providerRef: ref("mock_ord", idempotencyKey), status: "funded" };
  },
  async transfer({ idempotencyKey, destination }) {
    // Simulate a provider-side failure for a reserved test destination so exception handling can be demoed.
    const status = destination.endsWith("-fail") ? "failed" : "paid";
    return { providerRef: ref("mock_trf", idempotencyKey), status };
  },
};

export function getPaymentProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? "mock";
  if (name !== "mock") {
    throw new Error(`Payment provider "${name}" is not configured. Live payments require provider approval and legal sign-off.`);
  }
  return mockPaymentProvider;
}
