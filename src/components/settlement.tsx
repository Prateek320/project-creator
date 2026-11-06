/**
 * Settlement as a document. Server components.
 *
 * - SettlementStatus: one line that says where the money is (earned → approved → paid), replacing
 *   four stat tiles that repeated the same amount.
 * - SettlementReceipt: the calculation printed as a receipt, with excluded events struck through
 *   and a rubber stamp once the amount is approved or paid.
 * - LedgerGroups: ledger lines grouped by transaction so "every transaction balances to zero" is
 *   visible, not just claimed.
 */
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { ACCOUNTS } from "@/domain/ledger";
import { formatINR } from "@/domain/money";
import { cx, fmtDate, fmtDateTime } from "./ui";

// ---------- status line ----------

type StepState = "done" | "current" | "todo" | "warn";
export interface StatusStep {
  label: string;
  amountMinor: number;
  note: string;
  state: StepState;
}

export function SettlementStatus({ steps, children }: { steps: StatusStep[]; children?: ReactNode }) {
  return (
    <section aria-label="Where the money is" className="rounded-[14px] border border-line bg-surface">
      <ol className="grid divide-y divide-line-2 sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))] sm:divide-x sm:divide-y-0">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-start gap-3 px-5 py-4">
            <span
              aria-hidden
              className={cx(
                "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                s.state === "done" && "bg-ink text-white",
                s.state === "current" && "border-2 border-stamp text-stamp",
                s.state === "todo" && "border border-dashed border-line text-faint",
                s.state === "warn" && "bg-warn-50 text-warn ring-1 ring-warn/30",
              )}
            >
              {s.state === "done" ? <Check size={13} strokeWidth={3} /> : i + 1}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-muted">{s.label}</div>
              <div className={cx("figures text-[22px] font-bold leading-tight", s.state === "todo" ? "text-faint" : "text-ink")}>{formatINR(s.amountMinor)}</div>
              <div className={cx("mt-0.5 text-xs", s.state === "current" ? "font-medium text-stamp" : s.state === "warn" ? "font-medium text-warn" : "text-muted")}>{s.note}</div>
            </div>
          </li>
        ))}
      </ol>
      {children}
    </section>
  );
}

// ---------- receipt ----------

export interface ReceiptLineData {
  label: string;
  detail: string;
  amountMinor: number;
}

export function SettlementReceipt({
  number,
  title,
  parties,
  formulaText,
  lines,
  total,
  stamp,
  notes,
}: {
  number: string;
  title: string;
  parties: string;
  formulaText: string;
  lines: ReceiptLineData[];
  total: ReactNode;
  stamp?: { word: string; date: string } | null;
  notes: ReactNode[];
}) {
  return (
    <article aria-labelledby="receipt-h" className="receipt px-6 pb-9 pt-10 sm:px-9">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="receipt-h" className="text-lg font-bold tracking-[-0.015em] text-ink">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{parties}</p>
        </div>
        <div className="shrink-0 text-right text-xs text-muted">
          <div>Receipt no.</div>
          <div className="figures text-[15px] font-semibold text-ink-2">{number}</div>
        </div>
      </header>

      <p className="mt-5 rounded-lg bg-sunken px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink-2">{formulaText}</p>

      <dl className="mt-5">
        {lines.map((l) => {
          const excluded = l.label === "Excluded events";
          const adjustment = l.amountMinor < 0;
          return (
            <div key={l.label} className="rule-dash flex items-baseline justify-between gap-4 py-3 first:border-t-0">
              <dt className="min-w-0">
                <span className={cx("block text-[15px]", excluded ? "text-muted line-through decoration-bad/60 decoration-[1.5px]" : "font-medium text-ink")}>{l.label}</span>
                <span className="block text-xs text-muted">{excluded ? `${l.detail}. Not counted toward pay.` : l.detail}</span>
              </dt>
              <dd className={cx("figures shrink-0 text-[17px]", excluded ? "text-[13px] font-medium text-muted" : adjustment ? "font-semibold text-bad" : "font-semibold text-ink")}>
                {excluded ? "not counted" : `${adjustment ? "−" : ""}${formatINR(Math.abs(l.amountMinor))}`}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="relative mt-1 border-t-2 border-ink pt-4">
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <span className="self-start text-[15px] font-semibold text-ink sm:self-auto">Total earned</span>
          <span className="figures text-[34px] font-bold leading-none text-ink sm:text-[40px]">{total}</span>
        </div>
        {stamp && (
          <div role="img" className="stamp stamp-in pointer-events-none absolute left-1 top-10 sm:left-[36%] sm:top-0" aria-label={`Stamped ${stamp.word.toLowerCase()}, ${stamp.date}`}>
            <span className="text-[24px] tracking-[0.08em] sm:text-[34px]">{stamp.word}</span>
            <span className="text-[9.5px] font-semibold tracking-[0.06em] sm:text-[11px]">{stamp.date}</span>
          </div>
        )}
      </div>

      <footer className="mt-6 space-y-1.5 text-xs leading-relaxed text-muted">
        {notes.map((n, i) => (
          <p key={i}>{n}</p>
        ))}
      </footer>
    </article>
  );
}

// ---------- ledger ----------

interface Entry {
  id: string;
  transactionGroupId: string;
  entryType: string;
  account: string;
  memo: string;
  amountMinor: number;
  createdAt: Date;
}

const ENTRY_TYPE: Record<string, string> = {
  funding: "Campaign funded",
  settlement: "Settlement approved",
  payout: "Paid out",
  reversal: "Reversal",
  refund: "Refund to brand",
  dispute_hold: "Held for dispute",
  dispute_release: "Dispute released",
};

export function LedgerGroups({ entries }: { entries: Entry[] }) {
  const groups: { id: string; type: string; at: Date; memo: string; lines: Entry[] }[] = [];
  for (const e of [...entries].reverse()) {
    let g = groups.find((x) => x.id === e.transactionGroupId);
    if (!g) {
      g = { id: e.transactionGroupId, type: e.entryType, at: e.createdAt, memo: e.memo, lines: [] };
      groups.push(g);
    }
    g.lines.push(e);
  }
  return (
    <ol className="divide-y divide-line">
      {groups.map((g) => {
        const sum = g.lines.reduce((t, l) => t + l.amountMinor, 0);
        return (
          <li key={g.id} data-row-id={g.lines[0]?.id} className="px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-sm font-semibold text-ink">{ENTRY_TYPE[g.type] ?? g.type.replace(/_/g, " ")}</span>
              <span className="text-xs text-muted">{fmtDateTime(g.at)}</span>
            </div>
            {g.memo && <p className="mt-0.5 text-xs text-muted">{g.memo}</p>}
            <table className="mt-2.5 w-full text-sm">
              <tbody>
                {g.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-1 pr-3 text-ink-2">{ACCOUNTS[l.account as keyof typeof ACCOUNTS] ?? l.account}</td>
                    <td className={cx("figures w-28 py-1 text-right", l.amountMinor < 0 ? "text-muted" : "text-ink")}>
                      {l.amountMinor > 0 ? "+" : "−"}
                      {formatINR(Math.abs(l.amountMinor))}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-dashed border-line">
                  <td className="pt-1.5 text-xs text-muted">Net</td>
                  <td className={cx("figures pt-1.5 text-right text-xs font-semibold", sum === 0 ? "text-good" : "text-bad")}>
                    {sum === 0 ? "₹0 ✓ balanced" : `${formatINR(sum)} unbalanced`}
                  </td>
                </tr>
              </tbody>
            </table>
          </li>
        );
      })}
    </ol>
  );
}

/** Short, human-readable receipt number from an agreement id. */
export const receiptNo = (id: string, version: number) => `${id.slice(0, 4).toUpperCase()}-${id.slice(4, 8).toUpperCase()}/v${version}`;
export { fmtDate };
