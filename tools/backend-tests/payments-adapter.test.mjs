import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  operations,
  failures,
  providerContract,
  executionGate,
  requiredGates,
  compatibleToken,
  minor,
  plan,
  summarize,
  normalizeError,
  safeInput,
  textRoutePlan,
} from "../../supabase/functions/_shared/payments/providers.mjs";
import { testProvider } from "./payment-test-provider.mjs";
import {
  credentialReference,
  resolveCredential,
  credentialStatus,
  processHeldOperation,
  verifyBoundWebhook,
} from "../../supabase/functions/_shared/payments/runtime.mjs";
let n = 0;
const ok = (v, m) => {
  assert.ok(v, m);
  n++;
  console.log("PASS " + m);
};
const base = {
  organization_id: "synthetic-church",
  person_id: "synthetic-donor",
  gateway_id: "nmi-A",
  route_id: "MAIN",
  destination_id: "Main",
  provider: "nmi",
  environment: "sandbox",
  currency: "USD",
  consolidation_allowed: true,
};
const route = (id, gateway = "nmi-A", provider = "nmi") => ({
  ...base,
  route_id: id,
  destination_id: id,
  gateway_id: gateway,
  provider,
});
for (const provider of ["nmi", "authorize_net", "manual", "future"]) {
  const a = providerContract(provider);
  ok(
    operations.every((k) => typeof a[k] === "function"),
    "complete provider-neutral contract " + provider,
  );
  for (const op of [
    "sale",
    "authorize",
    "capture",
    "refund",
    "void",
    "create_customer",
    "attach_payment_method",
    "create_recurring_profile",
    "update_recurring_profile",
    "cancel_recurring_profile",
    "retrieve_transaction",
    "retrieve_settlement",
  ])
    await assert.rejects(
      () => a[op]({}),
      (e) => e.category === "configuration_error",
    );
  ok(
    !(await a.create_tokenization_session({ environment: "sandbox" }))
      .widget_enabled,
    "tokenization held " + provider,
  );
  ok(
    !(await a.verify_webhook({})).verified,
    "unconfigured signatures fail closed " + provider,
  );
}
const legs = plan([
  { route: route("MAIN"), amount_minor: "20000" },
  { route: route("YOUTH"), amount_minor: "5000" },
  { route: route("OUTREACH"), amount_minor: "10000" },
  { route: route("MERCH"), amount_minor: "3500" },
]);
ok(
  legs.total_minor === "38500" && legs.legs.length === 4,
  "exact four-MID 385-dollar split",
);
ok(
  plan([
    { route: base, amount_minor: "1000" },
    { route: base, amount_minor: "2000" },
  ]).legs.length === 1,
  "explicit compatible consolidation",
);
ok(
  plan([
    { route: { ...base, consolidation_allowed: false }, amount_minor: "1000" },
    { route: { ...base, consolidation_allowed: false }, amount_minor: "2000" },
  ]).legs.length === 2,
  "do not consolidate without allowed policy",
);
assert.throws(() =>
  plan([
    { route: base, amount_minor: "1000" },
    { route: { ...base, organization_id: "sowgo" }, amount_minor: "1000" },
  ]),
);
ok(true, "Champion Life and SowGo ownership cannot mix");
assert.throws(() =>
  plan([
    { route: base, amount_minor: "1000" },
    { route: { ...base, currency: "EUR" }, amount_minor: "1000" },
  ]),
);
ok(true, "currency conversion rejected");
assert.throws(() => minor(38500));
assert.throws(() => minor("38500.1"));
assert.throws(() => minor("1000000000001"));
ok(minor("1000000000000") === "1000000000000", "bounded exact bigint money");
const gates = Object.fromEntries(requiredGates.map((k) => [k, true]));
ok(executionGate(gates), "all explicit gates required by contract");
for (const k of requiredGates)
  ok(!executionGate({ ...gates, [k]: false }), "missing gate blocks " + k);
ok(
  !executionGate({ ...gates, stage_enabled: false }),
  "GIV-3A stage cannot execute even with credentials",
);
const token = { ...base, active: true, route_ids: ["MAIN", "YOUTH"] };
ok(
  compatibleToken(token, base),
  "explicit gateway/environment/MID token scope",
);
for (const mismatch of [
  { gateway_id: "AN-B" },
  { provider: "authorize_net" },
  { route_id: "MERCH" },
  { environment: "live" },
  { organization_id: "sowgo" },
  { person_id: "other" },
])
  ok(
    !compatibleToken(token, { ...base, ...mismatch }),
    "mismatched token rejected " + Object.keys(mismatch)[0],
  );
const request = {
  ...base,
  request_key: "synthetic-retry",
  amount_minor: "20000",
  token,
};
const a = testProvider();
const first = await a.sale(request);
ok(first.status === "captured" && a.calls() === 1, "offline success scenario");
ok(
  (await a.sale(request)) === first && a.calls() === 1,
  "duplicate retry no second execution",
);
await assert.rejects(() => a.sale({ ...request, amount_minor: "20001" }));
ok(true, "changed retry content cannot execute");
const timeout = testProvider({ scenario: "timeout" });
ok(
  (await timeout.sale(request)).status === "review",
  "unknown timeout requires review",
);
await timeout.sale(request);
ok(timeout.calls() === 1, "unknown outcome cannot blindly retry");
ok(
  (await testProvider({ scenario: "decline" }).sale(request))
    .failure_category === "declined",
  "offline decline normalized",
);
ok(
  summarize([{ status: "captured" }, { status: "failed" }]) ===
    "partial_success",
  "partial failure never says full success",
);
ok(
  summarize([{ status: "authorized" }]) === "pending_review",
  "authorization is not captured/settled giving",
);
ok(
  summarize([{ status: "failed" }]) === "all_failed" &&
    summarize([{ status: "settled" }]) === "all_success",
  "complete/failed normalized outcomes",
);
ok(
  (await a.refund({ ...request, request_key: "refund", partial: true }))
    .status === "partially_refunded",
  "offline partial refund",
);
ok(
  (await a.void({ ...request, request_key: "void" })).status === "voided",
  "offline void",
);
const body = '{"event":"synthetic"}',
  signature = createHmac("sha256", "synthetic-local-key")
    .update(body)
    .digest("hex");
ok(
  (await a.verify_webhook({ body, signature })).verified,
  "offline webhook signature valid",
);
ok(
  !(await a.verify_webhook({ body, signature: "invalid" })).verified,
  "invalid webhook signature denied",
);
for (const key of [
  "pan",
  "cvv",
  "bank_account",
  "transaction_key",
  "raw_response",
]) {
  assert.throws(() => safeInput({ nested: { [key]: "synthetic-forbidden" } }));
  ok(true, "sensitive key rejected " + key);
}
assert.throws(() => safeInput({ token: "4111111111111111" }));
ok(true, "raw card-like reference rejected");
ok(
  normalizeError({ message: "raw secret-ish internals" }).message ===
    "The payment outcome requires review.",
  "processor internals never echoed",
);
for (const k of failures)
  ok(normalizeError({ category: k }).category === k, "normalized failure " + k);
ok(
  textRoutePlan({ keyword: "YOUTH", route: base }, token).execution === "held",
  "Text-to-Give compatibility never activates execution",
);
ok(
  a.networkCalls() === 0 && timeout.networkCalls() === 0,
  "zero provider network calls",
);
const scope = {
  organization_id: "74000000-0000-4000-8000-000000000001",
  gateway_id: "91000000-0000-4000-8000-000000000001",
  environment: "sandbox",
  version: 1,
};
const binding = { ...scope, reference: credentialReference(scope) },
  readSecret = (key) =>
    key === "PAYMENTS_91000000000040008000000000000001_SANDBOX_V1"
      ? "synthetic-private-runtime-value"
      : undefined;
ok(
  resolveCredential(binding, scope, readSecret) ===
    "synthetic-private-runtime-value",
  "server-only scoped runtime secret lookup",
);
for (const mismatch of [
  { organization_id: "74000000-0000-4000-8000-000000000002" },
  { gateway_id: "91000000-0000-4000-8000-000000000002" },
  { environment: "live" },
  { version: 2 },
]) {
  assert.throws(() =>
    resolveCredential(binding, { ...scope, ...mismatch }, readSecret),
  );
  ok(
    true,
    "credential binding rejects scope mismatch " + Object.keys(mismatch)[0],
  );
}
ok(
  !JSON.stringify(credentialStatus(binding, scope, readSecret)).includes(
    "synthetic-private-runtime-value",
  ),
  "credential UI status never returns runtime secret",
);
ok(
  credentialStatus(binding, scope, () => null).status === "Missing or invalid",
  "missing runtime secret fails closed",
);
let claims = 0;
const held = await processHeldOperation(
  {
    rpc: async () => {
      claims++;
      return { data: { claimed: true, gate: gates } };
    },
  },
  {
    organization_id: scope.organization_id,
    operation_id: "synthetic-operation",
  },
);
ok(
  claims === 1 && held.status === "held",
  "server runner forcibly holds even forged all-true gates",
);
ok(
  (
    await processHeldOperation(
      { rpc: async () => ({ data: { claimed: false } }) },
      {
        organization_id: scope.organization_id,
        operation_id: "synthetic-operation",
      },
    )
  ).claimed === false,
  "already leased operation never executes",
);
ok(
  !(
    await verifyBoundWebhook("nmi", {
      body: "synthetic",
      signature: "synthetic",
      scope,
    })
  ).verified,
  "unconfigured runtime webhook never verifies",
);
await assert.rejects(() =>
  verifyBoundWebhook("nmi", {
    body: "x".repeat(262145),
    signature: "synthetic",
    scope,
  }),
);
ok(true, "runtime webhook enforces raw body bound");
console.log(n + " GIV-3A provider contract checks passed");
