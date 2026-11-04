/** State machines from ARCHITECTURE.md. Only these transitions are legal. */
import { DomainError } from "./types";

type Machine<S extends string> = Record<S, readonly S[]>;

export const campaignMachine = {
  draft: ["published", "cancelled"],
  published: ["paused", "completed", "cancelled"],
  paused: ["published", "completed", "cancelled"],
  completed: [],
  cancelled: [],
} as const satisfies Machine<"draft" | "published" | "paused" | "completed" | "cancelled">;

export const applicationMachine = {
  submitted: ["shortlisted", "offered", "rejected", "withdrawn", "expired"],
  shortlisted: ["offered", "rejected", "withdrawn", "expired"],
  offered: ["accepted", "rejected", "withdrawn", "expired"],
  accepted: [],
  rejected: [],
  withdrawn: [],
  expired: [],
} as const satisfies Machine<"submitted" | "shortlisted" | "offered" | "accepted" | "rejected" | "withdrawn" | "expired">;

export const agreementMachine = {
  offered: ["accepted", "cancelled", "superseded"],
  accepted: ["superseded", "completed", "disputed", "cancelled"],
  disputed: ["accepted", "completed", "cancelled"],
  superseded: [],
  completed: [],
  cancelled: [],
} as const satisfies Machine<"offered" | "accepted" | "superseded" | "completed" | "cancelled" | "disputed">;

export const deliverableMachine = {
  pending: ["submitted"],
  submitted: ["changes_requested", "approved", "rejected"],
  changes_requested: ["resubmitted"],
  resubmitted: ["changes_requested", "approved", "rejected"],
  approved: [],
  rejected: [],
} as const satisfies Machine<"pending" | "submitted" | "changes_requested" | "resubmitted" | "approved" | "rejected">;

export const transferMachine = {
  transfer_pending: ["paid", "failed"],
  failed: ["transfer_pending"],
  paid: ["reversed"],
  reversed: [],
  refunded: [],
} as const satisfies Machine<"transfer_pending" | "paid" | "failed" | "reversed" | "refunded">;

export function canTransition<M extends Record<string, readonly string[]>>(machine: M, from: keyof M, to: string): boolean {
  return (machine[from] as readonly string[]).includes(to);
}

export function assertTransition<M extends Record<string, readonly string[]>>(
  machine: M,
  entity: string,
  from: keyof M & string,
  to: string,
): void {
  if (!canTransition(machine, from, to)) {
    throw new DomainError(`A ${entity} that is "${from.replace(/_/g, " ")}" cannot move to "${to.replace(/_/g, " ")}"`, "invalid_transition");
  }
}

/** Max revision rounds included in the default agreement. */
export const MAX_REVISIONS = 2;
