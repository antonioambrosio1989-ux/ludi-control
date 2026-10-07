export type PaymentLifecycle = {
  refunded: boolean;
  disputed: boolean;
  disputeCreatedAt: number;
  disputeClosedAt: number;
};
export type PaymentSignal =
  | { type: "refund"; full: boolean }
  | { type: "dispute_opened"; created: number }
  | { type: "dispute_closed"; created: number; won: boolean };

export function applyPaymentSignal(
  previous: Partial<PaymentLifecycle>,
  signal: PaymentSignal,
): PaymentLifecycle {
  const next: PaymentLifecycle = {
    refunded: previous.refunded === true,
    disputed: previous.disputed === true,
    disputeCreatedAt: previous.disputeCreatedAt ?? 0,
    disputeClosedAt: previous.disputeClosedAt ?? 0,
  };
  if (signal.type === "refund") next.refunded ||= signal.full;
  if (
    signal.type === "dispute_opened" &&
    signal.created > next.disputeClosedAt
  ) {
    next.disputeCreatedAt = Math.max(next.disputeCreatedAt, signal.created);
    next.disputed = true;
  }
  if (
    signal.type === "dispute_closed" &&
    signal.created >= next.disputeClosedAt &&
    signal.created >= next.disputeCreatedAt
  ) {
    next.disputeClosedAt = signal.created;
    next.disputed = !signal.won;
  }
  return next;
}

export function paymentAccessStatus(
  state: Partial<PaymentLifecycle>,
): "active" | "revoked" | "suspended" {
  return state.refunded ? "revoked" : state.disputed ? "suspended" : "active";
}
