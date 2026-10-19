import assert from "node:assert/strict";
import {
  recovery,
  partialCheckout,
  createRecoveryWorker,
} from "../../supabase/functions/_shared/payments/operations.mjs";
import { testProvider } from "./payment-test-provider.mjs";
let n = 0;
const ok = (v, m) => {
  assert.ok(v, m);
  n++;
  console.log("PASS " + m);
};
for (const provider of ["nmi", "authorize_net", "future"])
  for (const category of [
    "declined",
    "expired_card",
    "invalid_payment_method",
    "unknown",
    "fraud_review",
    "duplicate",
    "configuration_error",
    "processor_unavailable",
  ]) {
    const r = recovery({
      provider,
      status: category === "unknown" ? "review" : "failed",
      category,
    });
    ok(
      !r.automatic_retry && !JSON.stringify(r).includes(provider),
      "provider-neutral " + provider + " " + category,
    );
    if (
      [
        "expired_card",
        "unknown",
        "fraud_review",
        "duplicate",
        "configuration_error",
        "invalid_payment_method",
      ].includes(category)
    )
      ok(!r.explicit_retry_allowed, "unsafe retry denied " + category);
  }
ok(
  recovery({ status: "not_found" }).result === "not_found" &&
    recovery({ status: "not_found" }).explicit_retry_allowed,
  "verified not-found result remains explicit safe retry foundation",
);
for (const [scenario, expected] of [
  ["decline", "declined"],
  ["timeout", "unknown"],
]) {
  const provider = testProvider({ scenario });
  const result = await provider.sale({
    request_key: "synthetic-ops-" + scenario,
    gateway_id: "synthetic-gateway",
    organization_id: "synthetic-owner",
    route_id: "synthetic-route",
    environment: "sandbox",
    amount_minor: "1000",
  });
  ok(
    recovery(result).failure_category === expected &&
      provider.networkCalls() === 0,
    "accepted GIV-3A deterministic provider " + scenario + " projection",
  );
}
const p = partialCheckout([
  { amount_minor: "20000", status: "captured" },
  { amount_minor: "5000", status: "failed" },
  { amount_minor: "10000", status: "captured" },
]);
ok(
  p.status === "partial_success" &&
    p.processed_minor === "30000" &&
    p.not_processed_minor === "5000",
  "Main/Youth/Outreach partial exact completed amount",
);
assert.throws(() => partialCheckout([{ amount_minor: 1, status: "captured" }]));
ok(true, "numeric money rejected");
let calls = 0,
  observed;
const worker = createRecoveryWorker({
  enabled: true,
  claim: async () => ({ claimed: true, lease_token: "synthetic-private" }),
  lookup: async () => {
    calls++;
    throw Error("mock-only timeout");
  },
  observe: async (x) => {
    observed = x;
  },
});
for (const kind of ["retry", "refund", "void", "recurring_retry"])
  ok(
    (await worker({ kind })).execution === "held",
    "worker cannot execute " + kind,
  );
ok(calls === 0, "zero provider operations for held work");
ok(
  (await worker({ kind: "lookup" })).result === "unknown" &&
    observed.normalized.result === "unknown",
  "lookup ambiguity safely recorded",
);
ok(
  (await createRecoveryWorker({})({ kind: "lookup" })).execution === "held",
  "default disabled",
);
console.log(n + " GIV-3D neutral recovery contract checks passed; no network");
