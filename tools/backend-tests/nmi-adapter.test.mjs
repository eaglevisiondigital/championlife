import assert from "node:assert/strict";
import { webcrypto, createHmac } from "node:crypto";
import {
  createNmiAdapter,
  NMI_BASE,
  ACCEPTANCE,
  credential,
  decimal,
  decimalMinor,
  normalizeNmi,
  verifyNmiWebhook,
  webhookProjection,
  NmiFailure,
} from "../../supabase/functions/_shared/payments/nmi.mjs";
import { createNmiHandler } from "../../supabase/functions/payments-nmi/gateway.mjs";
import { createNmiWebhook } from "../../supabase/functions/payments-nmi-webhook/gateway.mjs";
let n = 0,
  calls = [];
const ok = (v, m) => {
    assert.ok(v, m);
    n++;
    console.log("PASS " + m);
  },
  deny = async (fn, m) => {
    await assert.rejects(async () => fn(), NmiFailure);
    ok(true, m);
  };
const id = "74000000-0000-4000-8000-000000000001",
  gid = "74000000-0000-4000-8000-000000000031",
  scope = {
    organization_id: id,
    gateway_id: gid,
    provider: "nmi",
    environment: "sandbox",
    secret_version: 1,
    processor_id: "mock-MAIN",
    route_verified: true,
    currency: "USD",
    vault_route_authorized: true,
  },
  config = {
    project: ACCEPTANCE,
    enabled: true,
    organization_id: id,
    gateway_id: gid,
  },
  secret = "LOCAL_FAKE_SECRET_DO_NOT_USE",
  reader = (key) =>
    key === "PAYMENTS_" + gid.replaceAll("-", "") + "_SANDBOX_V1"
      ? secret
      : null;
let response = {
  id: "mock-tx",
  response: "1",
  processor_id: "mock-MAIN",
  amount: "10.00",
  payment_details: { card_number: "4***********1111", card_type: "Visa" },
};
const fetcher = async (url, options) => {
  calls.push({ url, options });
  return new Response(JSON.stringify(response), { status: 200 });
};
const provider = createNmiAdapter({
  config,
  scope,
  readSecret: reader,
  fetcher,
});
for (const [a, b] of [
  ["1", "0.01"],
  ["350", "3.50"],
  ["999999999999", "9999999999.99"],
]) {
  ok(decimal(a) === b, "exact decimal " + a);
  ok(decimalMinor(b) === a, "exact minor " + b);
}
for (const [bad, label] of [
  [
    { ...config, project: "https://exdocjbmylgxssanymjk.supabase.co" },
    "production project",
  ],
  [{ ...config, enabled: false }, "runtime kill"],
  [{ ...config, gateway_id: "other" }, "foreign gateway"],
]) {
  await deny(
    () =>
      createNmiAdapter({
        config: bad,
        scope,
        readSecret: reader,
        fetcher,
      }).sale({
        amount_minor: "1000",
        method: { payment_token: "fake_token" },
      }),
    label + " fails before network",
  );
}
await deny(
  () =>
    createNmiAdapter({
      config,
      scope: { ...scope, environment: "live" },
      readSecret: reader,
      fetcher,
    }).sale({ amount_minor: "1000", method: { payment_token: "fake_token" } }),
  "live environment rejected",
);
ok(calls.length === 0, "default/owner/live denial zero provider transport");
const result = await provider.sale({
  amount_minor: "1000",
  method: { payment_token: "fake_token" },
});
ok(
  result.status === "captured" && result.last4 === "1111",
  "sale normalizes safe reference/mask",
);
ok(
  calls[0].url === NMI_BASE + "/payments/sale",
  "official REST sandbox sale path",
);
const payload = JSON.parse(calls[0].options.body);
ok(
  payload.processor_id === "mock-MAIN" &&
    payload.amount === 10 &&
    calls[0].options.body.includes('"amount":10.00') &&
    payload.customer_receipt === false,
  "explicit processor exact money receipt off",
);
ok(
  payload.payment_details.payment_token === "fake_token" &&
    !JSON.stringify(result).includes("fake_token") &&
    !JSON.stringify(result).includes(secret),
  "transient token/key excluded from normalized result",
);
ok(
  calls[0].options.redirect === "error",
  "redirect cannot leak Authorization to another host",
);
await deny(
  () =>
    provider.sale({
      amount_minor: "1000",
      method: { payment_token: "fake_token", card_number: "not permitted" },
    }),
  "unknown raw card method key rejected",
);
await deny(
  () =>
    provider.sale({
      amount_minor: "1000",
      method: { payment_token: "4111111111111111" },
    }),
  "PAN-like token rejected",
);
response = { ...response, processor_id: "mock-YOUTH" };
await deny(
  () =>
    provider.sale({
      amount_minor: "1000",
      method: { payment_token: "fake_token" },
    }),
  "wrong returned processor requires routing review",
);
response.processor_id = "mock-MAIN";
response.amount = "9.99";
await deny(
  () =>
    provider.sale({
      amount_minor: "1000",
      method: { payment_token: "fake_token" },
    }),
  "amount discrepancy is unknown/review",
);
response.amount = "10.00";
let auth = await provider.authorize({
  amount_minor: "1000",
  method: { payment_token: "fake_token" },
});
ok(auth.status === "authorized", "auth response never becomes settled giving");
await provider.capture({
  transaction_reference: "mock-tx",
  amount_minor: "1000",
});
ok(
  calls.at(-1).url.endsWith("/mock-tx/capture") &&
    !("processor_id" in JSON.parse(calls.at(-1).options.body)),
  "capture bound by original ID, no invented processor field",
);
await provider.refund({
  transaction_reference: "mock-tx",
  amount_minor: "1000",
});
ok(
  calls.at(-1).url.endsWith("/mock-tx/refund"),
  "refund uses official original payment endpoint",
);
await provider.void({ transaction_reference: "mock-tx" });
ok(
  JSON.stringify(JSON.parse(calls.at(-1).options.body)) === "{}",
  "void sends documented empty JSON",
);
await provider.sale({
  amount_minor: "1000",
  method: {
    vault_reference: "mock-vault",
    initial_transaction_id: "mock-first",
    initiated_by: "merchant",
  },
});
let mit = JSON.parse(calls.at(-1).options.body);
ok(
  mit.cit_mit.initiated_by === "merchant" &&
    mit.cit_mit.stored_credential_indicator === "used" &&
    mit.cit_mit.initial_transaction_id === "mock-first",
  "stored MIT uses original CIT reference",
);
await deny(
  () =>
    provider.sale({
      amount_minor: "1000",
      method: { vault_reference: "mock-vault", initiated_by: "merchant" },
    }),
  "MIT without original credential transaction denied",
);
await deny(
  () =>
    createNmiAdapter({
      config,
      scope: { ...scope, vault_route_authorized: false },
      readSecret: reader,
      fetcher,
    }).sale({
      amount_minor: "1000",
      method: { vault_reference: "mock-vault" },
    }),
  "unproven vault route fails closed",
);
response = {
  id: "mock-customer",
  response: "1",
  billing: [
    { payment_details: { card_number: "4***********1111", card_type: "Visa" } },
  ],
};
let customer = await provider.create_customer({
  payment_token: "fake_token",
  customer_id: "mock-stable-customer",
});
ok(
  customer.customer_reference === "mock-customer" && customer.last4 === "1111",
  "Customer Vault safe nested billing projection",
);
ok(
  JSON.parse(calls.at(-1).options.body).id === "mock-stable-customer",
  "stable vault creation ID for canonical operation",
);
await deny(
  () =>
    provider.create_recurring_profile({
      plan_id: "mock-plan",
      method: { vault_reference: "mock-vault" },
      start_date: "20270101",
    }),
  "subscription route unproven is held",
);
response = { id: "mock-sub", response: "1" };
const recurring = createNmiAdapter({
  config,
  scope: { ...scope, subscription_default_verified: true },
  readSecret: reader,
  fetcher,
});
await recurring.create_recurring_profile({
  plan_id: "mock-plan",
  method: { vault_reference: "mock-vault" },
  start_date: "20270101",
});
let sub = JSON.parse(calls.at(-1).options.body);
ok(
  sub.paused_subscription === true && !("processor_id" in sub),
  "subscription remains paused and does not invent processor parameter",
);
await recurring.update_recurring_profile({
  subscription_reference: "mock-sub",
  amount_minor: "500",
  start_date: "20270201",
});
ok(
  calls.at(-1).options.method === "PUT",
  "documented update subscription HTTP method",
);
await recurring.cancel_recurring_profile({
  subscription_reference: "mock-sub",
});
ok(
  calls.at(-1).options.method === "DELETE",
  "documented cancellation HTTP method",
);
response = {
  id: "mock-tx",
  response: "1",
  processor_id: "mock-MAIN",
  status: "settled",
  amount: "10.00",
};
await provider.retrieve_transaction({ transaction_reference: "mock-tx" });
ok(
  calls.at(-1).options.method === "GET",
  "transaction reconciliation lookup is read-only",
);
await deny(
  () => provider.retrieve_settlement({}),
  "unknown REST settlement path not fabricated",
);
const timeout = createNmiAdapter({
  config,
  scope,
  readSecret: reader,
  fetcher: async () => {
    throw Error(secret + " fake_token");
  },
});
let error;
try {
  await timeout.sale({
    amount_minor: "1000",
    method: { payment_token: "fake_token" },
  });
} catch (e) {
  error = e;
}
ok(
  error.status === "review" &&
    !error.retry_automatically &&
    !error.message.includes(secret),
  "network exception sanitized and never blindly retried",
);
for (const [code, cat] of [
  ["200", "declined"],
  ["202", "insufficient_funds"],
  ["223", "expired_card"],
  ["225", "invalid_payment_method"],
  ["253", "fraud_review"],
  ["410", "configuration_error"],
  ["420", "unknown"],
  ["430", "duplicate"],
]) {
  const r = normalizeNmi(
    { response: "2", response_code: code, response_text: secret },
    "sale",
  );
  ok(
    r.category === cat && !JSON.stringify(r).includes(secret),
    "safe normalized provider code " + code,
  );
}
const raw = JSON.stringify({
    event_id: "mock-event",
    event_type: "transaction.sale.success",
    event_body: {
      features: { is_test_mode: true },
      merchant: { id: "mock-merchant" },
      transaction_id: "mock-tx",
      processor_id: "mock-MAIN",
      card: { ccnumber: "4***********1111" },
    },
  }),
  sig =
    "t=mock-nonce,s=" +
    createHmac("sha256", secret)
      .update("mock-nonce." + raw)
      .digest("hex");
ok(
  await verifyNmiWebhook(raw, sig, secret, webcrypto),
  "official gateway nonce-dot-raw HMAC verified",
);
ok(
  !(await verifyNmiWebhook(raw + " ", sig, secret, webcrypto)),
  "changed raw body signature denied",
);
ok(
  !(await verifyNmiWebhook(raw, "Signature=incorrect", secret, webcrypto)),
  "signup signature format never accepted as gateway signature",
);
const event = webhookProjection(raw);
ok(
  event.kind === "transaction" && !JSON.stringify(event).includes("1111"),
  "webhook projection excludes card and raw body",
);
assert.throws(() =>
  webhookProjection(raw.replace("4***********1111", "4111111111111111")),
);
ok(true, "unmasked webhook PAN rejected");
const batch = webhookProjection(
  JSON.stringify({
    event_id: "mock-batch",
    event_type: "settlement.batch.complete",
    event_body: {
      batch_id: "mock-batch-id",
      merchant: { id: "mock-merchant" },
      processor: { id: "mock-MAIN" },
      amount: "10.00",
      count: 1,
    },
  }),
);
ok(
  batch.gross_minor === "1000" &&
    !("fee_minor" in batch) &&
    !("net_minor" in batch),
  "batch projection preserves unknown fees/net",
);
let forbidden = 0;
const held = createNmiHandler(
  {
    project: ACCEPTANCE,
    enabled: false,
    origins: ["https://isolated--championlifechurch.netlify.app"],
  },
  async () => {
    forbidden++;
    throw Error("network");
  },
);
let h = await held(
  new Request("https://local.invalid", {
    method: "POST",
    headers: { Origin: "https://isolated--championlifechurch.netlify.app" },
    body: "{}",
  }),
);
ok(
  h.status === 503 && forbidden === 0,
  "held Edge config stops all database/provider calls",
);
const wh = createNmiWebhook(
  { project: ACCEPTANCE, enabled: false },
  () => secret,
  async () => {
    forbidden++;
  },
);
ok(
  (
    await wh(
      new Request("https://local.invalid", { method: "POST", body: raw }),
    )
  ).status === 503 && forbidden === 0,
  "held webhook never consumes private payload or touches database",
);
console.log(
  n + " GIV-3B adapter/security/log checks passed; zero real provider calls",
);
