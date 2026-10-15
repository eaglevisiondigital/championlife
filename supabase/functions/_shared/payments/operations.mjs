// Provider-neutral operational projection, not a payment executor or financial finalizer.
import { summarize, normalizeError } from "./providers.mjs";
export function recovery(result) {
  const rawCategory = result?.category || result?.failure_category;
  const failure = normalizeError({ category: rawCategory }).category;
  const blocked = [
    "unknown",
    "fraud_review",
    "duplicate",
    "configuration_error",
    "routing_error",
    "invalid_payment_method",
    "expired_card",
  ];
  const state = String(result?.status || "review");
  return Object.freeze({
    result:
      state === "not_found"
        ? "not_found"
        : state === "failed"
          ? "failed"
          : ["captured", "settled", "partially_refunded", "refunded"].includes(
                state,
              )
            ? "paid"
            : state === "pending"
              ? "still_pending"
              : "unknown",
    failure_category:
      result?.category || result?.failure_category ? failure : null,
    automatic_retry: false,
    explicit_retry_allowed:
      (state === "not_found" || state === "failed") &&
      (state === "not_found" && !rawCategory
        ? true
        : !blocked.includes(failure)),
    message:
      state === "failed"
        ? "Your payment was not completed."
        : "We're confirming whether your payment went through. Please do not submit it again yet.",
  });
}
export function partialCheckout(legs) {
  let processed = 0n,
    failed = 0n,
    unconfirmed = 0n;
  for (const leg of legs) {
    if (
      typeof leg.amount_minor !== "string" ||
      !/^\d{1,13}$/.test(leg.amount_minor)
    )
      throw Error("Exact minor units required");
    const amount = BigInt(leg.amount_minor);
    if (
      ["captured", "settled", "partially_refunded", "refunded"].includes(
        leg.status,
      )
    )
      processed += amount;
    else if (leg.status === "failed") failed += amount;
    else unconfirmed += amount;
  }
  return {
    status: summarize(legs),
    processed_minor: processed.toString(),
    not_processed_minor: failed.toString(),
    unconfirmed_minor: unconfirmed.toString(),
    message:
      processed > 0n && failed > 0n
        ? "Part of your payment was completed."
        : unconfirmed > 0n
          ? "We're confirming whether your payment went through. Please do not submit it again yet."
          : failed > 0n
            ? "Your payment was not completed."
            : "Payment activity recorded.",
  };
}
export function createRecoveryWorker({
  enabled = false,
  claim,
  lookup,
  observe,
}) {
  return async (work) => {
    if (!enabled) return { execution: "held" };
    if (work?.kind !== "lookup")
      return {
        execution: "held",
        reason: "No charge/refund/void/recurring transport in GIV-3D",
      };
    const lease = await claim(work);
    if (!lease?.claimed) return { execution: "held", claimed: false };
    let result;
    try {
      result = await lookup(work);
    } catch {
      result = { status: "review", category: "unknown" };
    }
    const safe = recovery(result);
    await observe({
      ...work,
      normalized: safe,
      lease_token: lease.lease_token,
    });
    return { execution: "held", result: safe.result, financial_posting: false };
  };
}
