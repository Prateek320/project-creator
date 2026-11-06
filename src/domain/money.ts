/** Money helpers. All amounts are integer paise; never use floats for money. */

export function assertMinor(amount: number, label = "amount"): number {
  if (!Number.isSafeInteger(amount)) throw new Error(`${label} must be an integer number of paise`);
  return amount;
}

/** Parse a rupee amount typed by a user ("12,500" or "12500.50") into paise without float math. */
export function rupeesToMinor(input: string | number): number {
  const raw = String(input).replace(/[,\s₹]/g, "").trim();
  if (raw === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error(`Invalid amount: ${input}`);
  const [whole = "0", frac = ""] = raw.split(".");
  return assertMinor(Number(whole) * 100 + Number(frac.padEnd(2, "0")));
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

export function formatINR(minor: number, opts: { paise?: boolean } = {}): string {
  // `|| 0` folds -0 into 0: sums of negated ledger lines can produce -0, which Intl renders "-₹0".
  const rupees = (minor || 0) / 100; // display only
  return opts.paise || minor % 100 !== 0 ? inrPaise.format(rupees) : inr.format(rupees);
}

export function formatCompact(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1).replace(/\.0$/, "")}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}
