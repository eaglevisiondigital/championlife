// GIV-3A provider-neutral architecture. No provider SDK, endpoint, secret or network transport.
export const operations = Object.freeze([
  "create_tokenization_session",
  "create_customer",
  "attach_payment_method",
  "authorize",
  "capture",
  "sale",
  "void",
  "refund",
  "create_recurring_profile",
  "update_recurring_profile",
  "cancel_recurring_profile",
  "retrieve_transaction",
  "retrieve_settlement",
  "verify_webhook",
  "normalize_error",
]);
export const failures = Object.freeze([
  "declined",
  "insufficient_funds",
  "invalid_payment_method",
  "expired_card",
  "processor_unavailable",
  "fraud_review",
  "routing_error",
  "configuration_error",
  "duplicate",
  "unknown",
]);
export const statuses = Object.freeze([
  "created",
  "tokenized",
  "pending",
  "authorized",
  "captured",
  "settled",
  "failed",
  "voided",
  "partially_refunded",
  "refunded",
  "review",
]);
export function minor(value) {
  if (typeof value !== "string" || !/^\d{1,13}$/.test(value))
    throw Error("Exact minor-unit string required");
  const n = BigInt(value);
  if (n < 1n || n > 1000000000000n) throw Error("Amount outside allowed range");
  return n.toString();
}
export function safeInput(value) {
  const denied =
    /^(pan|cvv|cvc|card_number|cardnumber|account_number|routing_number|bank_account|api_key|password|transaction_key|private_key|secret|raw_response|raw_body)$/i;
  function visit(v, k = "") {
    if (denied.test(k)) throw Error("Sensitive payment input is not accepted");
    if (
      typeof v === "string" &&
      ![
        "amount_minor",
        "total_minor",
        "intended_minor",
        "gross_minor",
        "fee_minor",
        "net_minor",
      ].includes(k) &&
      /^[\d -]{13,25}$/.test(v) &&
      v.replace(/\D/g, "").length >= 13
    )
      throw Error("Raw payment value is not accepted");
    if (Array.isArray(v)) v.forEach((x) => visit(x, k));
    else if (v && typeof v === "object")
      Object.entries(v).forEach(([a, b]) => visit(b, a));
  }
  visit(value);
  return value;
}
export function normalizeError(error) {
  const category = failures.includes(error?.category)
    ? error.category
    : "unknown";
  const messages = {
    declined: "The payment was declined.",
    insufficient_funds: "The payment could not be completed.",
    invalid_payment_method: "The payment method is unavailable.",
    expired_card: "The payment method has expired.",
    processor_unavailable: "Payment processing is temporarily unavailable.",
    fraud_review: "This payment requires review.",
    routing_error: "The payment destination is unavailable.",
    configuration_error: "Payment processing is not yet enabled.",
    duplicate: "This request has already been received.",
    unknown: "The payment outcome requires review.",
  };
  return Object.freeze({
    category,
    message: messages[category],
    retry_automatically: false,
  });
}
export const requiredGates = Object.freeze([
  "stage_enabled",
  "global_enabled",
  "organization_enabled",
  "gateway_enabled",
  "route_enabled",
  "form_enabled",
  "environment_matches",
  "route_matches",
  "amount_valid",
  "token_compatible",
  "credentials_configured",
  "initiator_authorized",
  "provider_capability_verified",
  "session_current",
]);
export function executionGate(snapshot) {
  return requiredGates.every((k) => snapshot?.[k] === true);
}
export function compatibleToken(token, leg) {
  return (
    token?.active === true &&
    token.organization_id === leg.organization_id &&
    token.person_id === leg.person_id &&
    token.provider === leg.provider &&
    token.gateway_id === leg.gateway_id &&
    token.environment === leg.environment &&
    Array.isArray(token.route_ids) &&
    token.route_ids.includes(leg.route_id)
  );
}
export function summarize(legs) {
  if (!Array.isArray(legs) || !legs.length)
    throw Error("Transaction legs required");
  const success = legs.filter((l) =>
      ["captured", "settled", "partially_refunded", "refunded"].includes(
        l.status,
      ),
    ).length,
    failed = legs.filter((l) => ["failed", "voided"].includes(l.status)).length;
  return success + failed < legs.length
    ? "pending_review"
    : success === legs.length
      ? "all_success"
      : success
        ? "partial_success"
        : "all_failed";
}
export function plan(lines) {
  safeInput(lines);
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 30)
    throw Error("Bounded checkout required");
  let currency,
    total = 0n;
  const legs = new Map();
  for (const [i, line] of lines.entries()) {
    const r = line.route;
    if (
      !r?.organization_id ||
      !r.destination_id ||
      !r.gateway_id ||
      !r.route_id ||
      !["nmi", "authorize_net", "manual", "future"].includes(r.provider) ||
      !["sandbox", "live"].includes(r.environment) ||
      !/^[A-Z]{3}$/.test(r.currency)
    )
      throw Error("Bound routing snapshot required");
    currency ??= r.currency;
    if (currency !== r.currency)
      throw Error("Currency conversion is not supported");
    if (i && lines[0].route.organization_id !== r.organization_id)
      throw Error("Financial owner mismatch");
    const amount = BigInt(minor(line.amount_minor));
    total += amount;
    if (total > 1000000000000n) throw Error("Total outside bounds");
    const key = [
      r.organization_id,
      r.destination_id,
      r.gateway_id,
      r.route_id,
      r.consolidation_allowed === true ? "consolidate" : String(i),
    ].join(":");
    const x = legs.get(key) || {
      route: structuredClone(r),
      amount_minor: "0",
      lines: [],
    };
    if (legs.has(key) && JSON.stringify(x.route) !== JSON.stringify(r))
      throw Error("Inconsistent route snapshot");
    x.amount_minor = (BigInt(x.amount_minor) + amount).toString();
    x.lines.push({ ...line, amount_minor: amount.toString() });
    legs.set(key, x);
  }
  return Object.freeze({
    currency,
    total_minor: total.toString(),
    legs: [...legs.values()],
  });
}
/** @returns {Readonly<Record<string, any>>} Complete dynamic provider operation map. */
export function providerContract(provider) {
  if (!["nmi", "authorize_net", "manual", "future"].includes(provider))
    throw Error("Provider code unavailable");
  const accountModel = {
    provider,
    multiple_accounts: true,
    multiple_routes_per_account: true,
    token_portability: "explicit_account_environment_route_binding_only",
    real_transport_installed: false,
  };
  const api = {
    provider,
    mode: "disabled",
    accountModel: Object.freeze(accountModel),
  };
  for (const op of operations)
    api[op] = async (input) => {
      safeInput(input);
      if (op === "normalize_error") return normalizeError(input);
      if (op === "verify_webhook")
        return {
          verified: false,
          reason: "Provider verification is not configured.",
        };
      if (op === "create_tokenization_session")
        return {
          status: "held",
          widget_enabled: false,
          environment: input?.environment || null,
          token_scope: accountModel.token_portability,
          message: "Payment processing is not yet enabled.",
        };
      throw Object.assign(Error("Payment processing is not yet enabled."), {
        category: "configuration_error",
      });
    };
  return Object.freeze(api);
}
export function textRoutePlan(keyword, token) {
  safeInput(keyword);
  return {
    keyword: keyword.keyword,
    route: keyword.route,
    token_compatible: compatibleToken(token, keyword.route),
    execution: "held",
    sms_credit_hook: "organization.channel_usage",
    creates_authority: false,
  };
}
