/** FormData parsing helpers shared by server actions. */
import { rupeesToMinor } from "@/domain/money";
import { DomainError, type Formula, type OutcomeEvent } from "@/domain/types";

export const str = (fd: FormData, k: string, max = 4000) => String(fd.get(k) ?? "").trim().slice(0, max);
export const list = (fd: FormData, k: string) => fd.getAll(k).map((v) => String(v).trim()).filter(Boolean);
export const csvList = (fd: FormData, k: string) => str(fd, k).split(",").map((s) => s.trim()).filter(Boolean);
export const int = (fd: FormData, k: string, fallback = 0) => {
  const v = str(fd, k);
  if (v === "") return fallback;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new DomainError(`${k.replace(/([A-Z])/g, " $1").toLowerCase()} must be a whole number`);
  return n;
};
export const money = (fd: FormData, k: string) => {
  try {
    return rupeesToMinor(str(fd, k));
  } catch {
    throw new DomainError(`Enter a valid rupee amount for ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`);
  }
};
export const optMoney = (fd: FormData, k: string) => (str(fd, k) === "" ? undefined : money(fd, k));
export const date = (fd: FormData, k: string) => {
  const v = str(fd, k);
  const d = new Date(v.length === 10 ? `${v}T00:00:00+05:30` : v);
  if (Number.isNaN(d.getTime())) throw new DomainError(`Choose a valid ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`);
  return d;
};

const OUTCOMES: OutcomeEvent[] = ["signup", "sale", "lead", "install", "click"];

/** Reads a compensation formula from fields prefixed by `p` (e.g. "f_model"). */
export function formulaFrom(fd: FormData, p = "f_"): Formula {
  const model = str(fd, `${p}model`);
  if (model !== "fixed" && model !== "performance" && model !== "hybrid") throw new DomainError("Choose a compensation model");
  const outcome = str(fd, `${p}outcomeEvent`) as OutcomeEvent;
  const f: Formula = {
    model,
    currency: "INR",
    attributionWindowDays: int(fd, `${p}attributionWindowDays`, 7),
    partialDeliverablePolicy: str(fd, `${p}partialDeliverablePolicy`) === "pro_rata" ? "pro_rata" : "all_or_nothing",
    exclusions: str(fd, `${p}exclusions`, 500),
  };
  if (model === "fixed") f.fixedFeeMinor = money(fd, `${p}fixedFee`);
  if (model === "hybrid") f.baseFeeMinor = money(fd, `${p}baseFee`);
  if (model !== "fixed") {
    f.ratePerOutcomeMinor = money(fd, `${p}rate`);
    f.outcomeEvent = OUTCOMES.includes(outcome) ? outcome : "signup";
    f.capMinor = optMoney(fd, `${p}cap`);
    f.floorMinor = optMoney(fd, `${p}floor`);
  }
  return f;
}

/** Only same-site relative paths may be used as post-action redirects. */
export function safeBack(fd: FormData, fallback: string): string {
  const b = str(fd, "back", 500);
  return b.startsWith("/") && !b.startsWith("//") ? b : fallback;
}
