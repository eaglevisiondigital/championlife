import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  createAuthorizeNetAdapter,
  ANET_SANDBOX_API,
  opaqueData,
  exactDecimal,
  exactMinor,
  normalizeAuthorizeNet,
  logicalMethodBinding,
  normalizeAuthorizeNetWebhook,
  verifyAuthorizeNetSignature,
  createAuthorizeNetWebhookHandler,
} from "../../supabase/functions/_shared/payments/authorize-net.mjs";
import {
  operations,
  requiredGates,
  summarize,
  plan,
} from "../../supabase/functions/_shared/payments/providers.mjs";
import { credentialReference } from "../../supabase/functions/_shared/payments/runtime.mjs";
let n = 0;
const ok = (x, m) => {
    assert.ok(x, m);
    n++;
    console.log("PASS " + m);
  },
  deny = async (fn, m) => {
    await assert.rejects(fn);
    ok(true, m);
  };
const scope = {
    organization_id: "74000000-0000-4000-8000-000000000001",
    person_id: "74000000-0000-4000-8000-000000000002",
    gateway_id: "74000000-0000-4000-8000-000000000031",
    route_id: "74000000-0000-4000-8000-000000000032",
    provider: "authorize_net",
    environment: "sandbox",
    version: 1,
    currency: "USD",
    country: "US",
  },
  binding = { ...scope, reference: credentialReference(scope) },
  secret = {
    apiLoginId: "MOCKLOGIN",
    transactionKey: "MOCKTRANSACTIONKEY",
    signatureKey: "ab".repeat(64),
  },
  config = {
    ...scope,
    enabled: true,
    return_urls: [
      "https://isolated--championlifechurch.netlify.app/checkout.html",
    ],
  },
  all = Object.fromEntries(requiredGates.map((k) => [k, true]));
let gates = { ...all },
  calls = [],
  response = {
    messages: { resultCode: "Ok" },
    transactionResponse: {
      responseCode: "1",
      transId: "123456",
      accountNumber: "XXXX1111",
      accountType: "Visa",
    },
  },
  fault = null;
const transport = async (url, options) => {
  calls.push({ url, options });
  if (fault) throw fault;
  return new Response(JSON.stringify(response));
};
const make = (extra = {}) =>
  createAuthorizeNetAdapter({
    config,
    scope,
    binding,
    readSecret: () => JSON.stringify(secret),
    transport,
    currentContext: () => gates,
    ...extra,
  });
const adapter = make(),
  method = {
    opaque: {
      dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT",
      dataValue: "mock_transient_opaque_token_value",
    },
    opaque_scope: {
      ...Object.fromEntries(
        ["organization_id", "person_id", "gateway_id", "environment"].map(
          (k) => [k, scope[k]],
        ),
      ),
      expires_at: Date.now() + 600000,
    },
  },
  profile = {
    ...method.opaque_scope,
    customer_id: "100",
    payment_profile_id: "101",
    active: true,
  };
delete profile.expires_at;
const original = {
  organization_id: scope.organization_id,
  gateway_id: scope.gateway_id,
  route_id: scope.route_id,
  environment: "sandbox",
  transaction_reference: "123456",
  status: "settled",
  amount_minor: "20000",
  refunded_minor: "0",
  last4: "1111",
  currency: "USD",
};
for (const op of operations)
  ok(typeof adapter[op] === "function", "neutral operation " + op);
for (const gate of requiredGates) {
  gates = { ...all, [gate]: false };
  const before = calls.length;
  await deny(
    () =>
      adapter.sale({
        request_reference: "sale1",
        amount_minor: "20000",
        method,
      }),
    "current missing gate denied " + gate,
  );
  ok(
    calls.length === before,
    "gate denial makes zero mock transport calls " + gate,
  );
}
gates = { ...all };
await deny(
  () =>
    createAuthorizeNetAdapter().sale({
      request_reference: "x",
      amount_minor: "1",
      method,
    }),
  "default unconfigured adapter held",
);
await deny(
  () =>
    make({ config: { ...config, environment: "live" } }).sale({
      request_reference: "x",
      amount_minor: "1",
      method,
    }),
  "live configuration rejected",
);
await deny(
  () =>
    make({
      config: {
        ...config,
        endpoint: "https://api.authorize.net/xml/v1/request.api",
      },
    }).sale({ request_reference: "x", amount_minor: "1", method }),
  "live endpoint override rejected",
);
await deny(
  () => adapter.sale({ request_reference: "x", amount_minor: 20000, method }),
  "numeric money rejected",
);
ok(
  exactDecimal("20001") === "200.01" && exactMinor("200.01") === "20001",
  "exact minor/decimal conversion",
);
for (const value of [
  { ...method.opaque, cardNumber: "NOT_ALLOWED" },
  { dataDescriptor: "wrong", dataValue: "mock_opaque_value_12345" },
  { ...method.opaque, dataValue: "4111111111111111" },
])
  assert.throws(() => opaqueData(value));
ok(true, "opaque descriptor/strict keys/raw PAN guard");
for (const delta of [
  { gateway_id: "74000000-0000-4000-8000-000000000099" },
  { environment: "live" },
  { person_id: "other" },
  { expires_at: 1 },
])
  await deny(
    () =>
      adapter.sale({
        request_reference: "x",
        amount_minor: "1",
        method: {
          ...method,
          opaque_scope: { ...method.opaque_scope, ...delta },
        },
      }),
    "opaque account/person/environment/expiry binding " + Object.keys(delta)[0],
  );
for (const [operation, status, type, args] of [
  ["sale", "captured", "authCaptureTransaction", { method }],
  ["authorize", "authorized", "authOnlyTransaction", { method }],
  [
    "capture",
    "captured",
    "priorAuthCaptureTransaction",
    { original: { ...original, status: "authorized" } },
  ],
  [
    "void",
    "voided",
    "voidTransaction",
    { original: { ...original, status: "authorized" } },
  ],
  ["refund", "pending", "refundTransaction", { original }],
]) {
  const p = {
    request_reference: operation,
    ...args,
    ...(operation === "void" ? {} : { amount_minor: "20000" }),
  };
  const r = await adapter[operation](p);
  ok(r.status === status, operation + " canonical result");
  const sent = JSON.parse(calls.at(-1).options.body).createTransactionRequest;
  ok(
    sent.transactionRequest.transactionType === type &&
      sent.transactionRequest.currencyCode === "USD",
    operation + " exact provider operation/currency",
  );
  ok(
    calls.at(-1).url === ANET_SANDBOX_API &&
      calls.at(-1).options.redirect === "error",
    operation + " fixed sandbox no redirects",
  );
  ok(
    !JSON.stringify(r).includes(secret.apiLoginId) &&
      !JSON.stringify(r).includes("mock_transient"),
    "safe projection " + operation,
  );
}
const refundWire = JSON.parse(calls.at(-1).options.body)
  .createTransactionRequest.transactionRequest;
ok(
  refundWire.payment.creditCard.cardNumber === "1111" &&
    refundWire.payment.creditCard.expirationDate === "XXXX",
  "refund sends only allowed last4 and masked expiry",
);
await adapter.refund({
  request_reference: "partial",
  amount_minor: "5000",
  original,
});
ok(
  JSON.parse(calls.at(-1).options.body).createTransactionRequest
    .transactionRequest.amount === "50.00",
  "partial refund exact amount",
);
await deny(
  () =>
    adapter.refund({
      request_reference: "over",
      amount_minor: "15001",
      original: { ...original, refunded_minor: "5000" },
    }),
  "cumulative overrefund rejected",
);
await deny(
  () =>
    adapter.refund({
      request_reference: "unsettled",
      amount_minor: "1",
      original: { ...original, status: "captured" },
    }),
  "unsettled refund rejected",
);
for (const operation of ["refund", "void", "capture", "retrieve_transaction"])
  await deny(
    () =>
      adapter[operation]({
        request_reference: "foreign",
        amount_minor: "1",
        original: { ...original, gateway_id: "foreign" },
      }),
    "historical gateway cannot change " + operation,
  );
await deny(
  () =>
    adapter.sale({
      request_reference: "raw",
      amount_minor: "1",
      method: { cardNumber: "NOT_ALLOWED" },
    }),
  "application raw payment method rejected",
);
const customer = {
  organization_id: scope.organization_id,
  person_id: scope.person_id,
  gateway_id: scope.gateway_id,
  environment: "sandbox",
  customer_id: "100",
};
response = {
  messages: { resultCode: "Ok" },
  customerProfileId: "100",
  customerPaymentProfileIdList: ["101"],
};
ok(
  (
    await adapter.create_customer({
      request_reference: "customer",
      merchant_customer_id: "canonical-donor",
      method,
    })
  ).customer_reference === "100",
  "customer creation from transient opaque token",
);
ok(
  (
    await adapter.attach_payment_method({
      request_reference: "attach",
      customer,
      method,
    })
  ).payment_profile_reference === "101",
  "payment profile creation scoped to customer account",
);
await deny(
  () =>
    adapter.attach_payment_method({
      request_reference: "attach",
      customer: { ...customer, gateway_id: "foreign" },
      method,
    }),
  "foreign customer rejected before mock transport",
);
response = {
  messages: { resultCode: "Ok" },
  transactionResponse: { responseCode: "1", transId: "123457" },
};
ok(
  (
    await adapter.sale({
      request_reference: "saved",
      amount_minor: "1",
      method: { profile },
    })
  ).status === "captured",
  "second mock sale via saved profile",
);
ok(
  !calls.at(-1).options.body.includes("mock_transient"),
  "saved charge needs no raw reentry or opaque token",
);
await deny(
  () =>
    adapter.sale({
      request_reference: "other",
      amount_minor: "1",
      method: { profile: { ...profile, gateway_id: "foreign" } },
    }),
  "payment profile not portable between gateway accounts",
);
const mapped = logicalMethodBinding(scope, profile, {
  logical_method_id: "74000000-0000-4000-8000-000000000035",
  brand: "Visa",
  last4: "1111",
});
ok(
  mapped.descriptor === "Visa ending 1111" &&
    mapped.gateway_id === scope.gateway_id,
  "safe canonical logical method mapping",
);
response = {
  messages: { resultCode: "Ok" },
  token: "mock_hosted_form_token_value_long",
};
const session = await adapter.create_tokenization_session({
  request_reference: "hosted",
  amount_minor: "20000",
  return_url: config.return_urls[0],
  save_method: false,
});
ok(
  session.form_url === "https://test.authorize.net/payment/payment" &&
    session.expires_in_seconds === 900,
  "Accept Hosted token contract and expiry",
);
ok(
  !JSON.stringify(session).includes(secret.apiLoginId) &&
    !JSON.stringify(session).includes(secret.transactionKey),
  "no API Login ID/Transaction Key in browser session",
);
await deny(
  () =>
    adapter.create_tokenization_session({
      request_reference: "redirect",
      amount_minor: "1",
      return_url: "https://evil.test/",
    }),
  "hosted return redirect exact allowlist",
);
response = {
  messages: { resultCode: "Ok" },
  transaction: {
    transId: original.transaction_reference,
    transactionStatus: "settledSuccessfully",
    settleAmount: "200.00",
  },
};
ok(
  (
    await adapter.retrieve_transaction({
      request_reference: "lookup",
      original,
    })
  ).status === "settled",
  "verified lookup canonical settlement",
);
response.transaction.transId = "999";
await deny(
  () => adapter.retrieve_transaction({ request_reference: "lookup", original }),
  "lookup wrong transaction rejected",
);
response = { messages: { resultCode: "Ok" }, subscriptionId: "300" };
const sub = {
  organization_id: scope.organization_id,
  gateway_id: scope.gateway_id,
  route_id: scope.route_id,
  environment: "sandbox",
  instruction_id: "74000000-0000-4000-8000-000000000040",
  subscription_reference: "300",
};
ok(
  (
    await adapter.create_recurring_profile({
      request_reference: "arb",
      profile,
      amount_minor: "20000",
      frequency: "monthly",
      start_date: "2027-01-01",
      occurrences: 12,
    })
  ).subscription_reference === "300",
  "ARB create from scoped profile",
);
ok(
  (
    await adapter.update_recurring_profile({
      subscription: sub,
      amount_minor: "5000",
    })
  ).status === "pending",
  "ARB update exact canonical amount",
);
ok(
  (await adapter.cancel_recurring_profile({ subscription: sub })).status ===
    "voided",
  "ARB cancel original account",
);
await deny(
  () =>
    adapter.cancel_recurring_profile({
      subscription: { ...sub, gateway_id: "foreign" },
    }),
  "ARB foreign account rejected",
);
response = { messages: { resultCode: "Ok" }, status: "canceled" };
ok(
  (await adapter.retrieve_subscription({ subscription: sub })).status ===
    "voided",
  "ARB status mapping",
);
response = {
  messages: { resultCode: "Ok" },
  batchList: [
    {
      batchId: "400",
      settlementTimeUTC: "2026-10-14T00:00:00Z",
      settlementState: "settledSuccessfully",
    },
  ],
};
ok(
  (
    await adapter.retrieve_settlement({
      first_date: "2026-10-01",
      last_date: "2026-10-15",
    })
  ).batches[0].batch_reference === "400",
  "settled batch list bounded dates",
);
response = {
  messages: { resultCode: "Ok" },
  batch: {
    batchId: "400",
    statistics: [
      {
        accountType: "Visa",
        chargeAmount: "200.00",
        refundAmount: "50.00",
        chargeCount: 1,
        refundCount: 1,
      },
    ],
  },
};
const batch = await adapter.retrieve_settlement({ batch_id: "400" });
ok(
  batch.statistics[0].gross_minor === "20000" &&
    batch.fee_minor === null &&
    batch.net_minor === null,
  "batch statistics exact known amounts unknown fees/net",
);
for (const [responseCode, code, want] of [
  ["2", "2", "declined"],
  ["3", "6", "invalid_payment_method"],
  ["3", "8", "expired_card"],
  ["3", "11", "duplicate"],
  ["4", "193", "fraud_review"],
  ["3", "30", "configuration_error"],
  ["3", "39", "routing_error"],
  ["3", "901", "processor_unavailable"],
])
  ok(
    normalizeAuthorizeNet(
      {
        messages: { resultCode: "Error" },
        transactionResponse: {
          responseCode,
          errors: [{ errorCode: code, errorText: "PRIVATE_RAW_DO_NOT_RETURN" }],
        },
      },
      "sale",
    ).category === want,
    "failure category " + want,
  );
fault = Error("PRIVATE_TRANSPORT_DETAIL");
await deny(
  () =>
    adapter.sale({ request_reference: "timeout", amount_minor: "1", method }),
  "timeout leaves unknown review, no blind retry",
);
fault = null;
const raw = JSON.stringify({
    notificationId: "74000000-0000-4000-8000-000000000045",
    eventType: "net.authorize.payment.authcapture.created",
    payload: { id: "123456", authAmount: 200, privateNoise: "DO_NOT_RETURN" },
  }),
  signature =
    "sha512=" +
    createHmac("sha512", Buffer.from(secret.signatureKey, "hex"))
      .update(raw)
      .digest("hex");
ok(
  await verifyAuthorizeNetSignature(raw, signature, secret.signatureKey),
  "current raw-body HMAC-SHA512 with hex-decoded key",
);
ok(
  !(await verifyAuthorizeNetSignature(
    raw + " ",
    signature,
    secret.signatureKey,
  )),
  "altered raw body rejected",
);
ok(
  !(await verifyAuthorizeNetSignature(raw, "", secret.signatureKey)),
  "unsigned rejected",
);
const event = await normalizeAuthorizeNetWebhook(
  raw,
  signature,
  secret.signatureKey,
  scope,
);
ok(
  event.status === "captured" &&
    event.requires_verified_lookup &&
    !JSON.stringify(event).includes("DO_NOT_RETURN"),
  "safe webhook metadata requires canonical lookup",
);
let recorded = 0,
  lookups = 0;
const seen = new Map();
const handler = createAuthorizeNetWebhookHandler({
  enabled: true,
  scope,
  readSignatureKey: () => secret.signatureKey,
  lookupCanonical: async (event) => {
    lookups++;
    return { ...scope, provider_reference: event.provider_reference };
  },
  recordEvent: async (event) => {
    recorded++;
    const old = seen.get(event.event_reference);
    if (old && old !== event.body_digest) return { accepted: false };
    seen.set(event.event_reference, event.body_digest);
    return { accepted: true, duplicate: !!old };
  },
});
const req = (text = raw, sig = signature) =>
  new Request("https://isolated.invalid/", {
    method: "POST",
    headers: { "X-ANET-Signature": sig },
    body: text,
  });
ok(
  (await handler(req())).status === 200,
  "signed HTTP webhook accepted after canonical binding",
);
ok(
  (await (await handler(req())).json()).duplicate,
  "same webhook returns canonical duplicate",
);
const previous = lookups;
ok(
  (await handler(req(raw + " ", signature))).status === 403 &&
    lookups === previous,
  "invalid raw signature rejected before lookup/store",
);
const foreign = createAuthorizeNetWebhookHandler({
  enabled: true,
  scope,
  readSignatureKey: () => secret.signatureKey,
  lookupCanonical: async () => ({ ...scope, gateway_id: "foreign" }),
  recordEvent: async () => {
    throw Error("must never store");
  },
});
ok(
  (await foreign(req())).status === 403,
  "signed event cannot cross canonical gateway binding",
);
ok(
  (await createAuthorizeNetWebhookHandler()(req())).status === 503,
  "default webhook held",
);
const changed = raw.replace("123456", "123457"),
  changedSignature =
    "sha512=" +
    createHmac("sha512", Buffer.from(secret.signatureKey, "hex"))
      .update(changed)
      .digest("hex");
ok(
  (await handler(req(changed, changedSignature))).status === 409,
  "altered event identity/digest conflicts",
);
ok(
  !JSON.stringify(event).includes(secret.signatureKey) &&
    !JSON.stringify(event).includes("mock_transient"),
  "no secret/token/raw payload persisted in normalized webhook",
);
const legs = plan(
  ["Main", "Youth", "Merch"].map((name, i) => ({
    amount_minor: ["20000", "5000", "3500"][i],
    route: {
      ...scope,
      gateway_id: "AN-" + i,
      destination_id: name,
      route_id: name,
    },
  })),
);
ok(
  legs.total_minor === "28500" && legs.legs.length === 3,
  "one285-dollar checkout separate200/50/35 accounts",
);
ok(
  summarize([
    { status: "captured" },
    { status: "failed" },
    { status: "captured" },
  ]) === "partial_success",
  "main/merch retained youth decline never full success",
);
await deny(
  () =>
    make({
      transport: async () =>
        new Response(
          JSON.stringify({
            messages: { resultCode: "Ok" },
            transactionResponse: { responseCode: "1", transId: "123" },
          }),
          { status: 401 },
        ),
    }).sale({ request_reference: "denied-http", amount_minor: "1", method }),
  "unauthorized HTTP response cannot claim financial success",
);
for (const operation of ["sale", "authorize", "capture", "refund", "void"])
  ok(
    normalizeAuthorizeNet({ messages: { resultCode: "Ok" } }, operation)
      .status === "review",
    operation + " cannot claim success without a transaction response",
  );
await deny(
  () =>
    make({
      transport: async () =>
        new Response(
          JSON.stringify({
            messages: { resultCode: "Ok" },
            transactionResponse: { responseCode: "1", transId: "123" },
          }),
          { status: 400 },
        ),
    }).sale({ request_reference: "bad-http", amount_minor: "1", method }),
  "non-success HTTP response cannot claim financial success",
);
for (const delta of [{ currency: "CAD" }, { country: "CA" }])
  await deny(
    () =>
      make({ config: { ...config, ...delta } }).sale({
        request_reference: "mismatch",
        amount_minor: "1",
        method,
      }),
    "gateway currency/country must match frozen route " + Object.keys(delta)[0],
  );
const partial = [];
for (const [i, amount] of ["20000", "5000", "3500"].entries()) {
  const gateway_id = "94000000-0000-4000-8000-00000000000" + (i + 1),
    accountScope = { ...scope, gateway_id },
    accountSecret = {
      ...secret,
      apiLoginId: "MOCKLOGIN" + i,
      transactionKey: "MOCKTRANSACTION" + i,
    };
  const a = createAuthorizeNetAdapter({
    scope: accountScope,
    config: { ...config, gateway_id },
    binding: { ...accountScope, reference: credentialReference(accountScope) },
    readSecret: (name) => {
      assert(name.includes(gateway_id.replaceAll("-", "").toUpperCase()));
      return JSON.stringify(accountSecret);
    },
    currentContext: () => all,
    transport: async (url, options) => {
      assert.equal(url, ANET_SANDBOX_API);
      assert.equal(
        JSON.parse(options.body).createTransactionRequest.merchantAuthentication
          .name,
        accountSecret.apiLoginId,
      );
      return new Response(
        JSON.stringify({
          messages: { resultCode: i === 1 ? "Error" : "Ok" },
          transactionResponse:
            i === 1
              ? { responseCode: "2", errors: [{ errorCode: "2" }] }
              : { responseCode: "1", transId: "500" + i },
        }),
      );
    },
  });
  partial.push(
    await a.sale({
      request_reference: "partial" + i,
      amount_minor: amount,
      method: {
        ...method,
        opaque_scope: { ...method.opaque_scope, gateway_id },
      },
    }),
  );
}
ok(
  partial[0].status === "captured" &&
    partial[1].status === "failed" &&
    partial[2].status === "captured" &&
    summarize(partial) === "partial_success",
  "three actual adapter mock responses retain Main/Merch success and Youth decline with distinct credentials",
);
ok(
  calls.every((c) => c.url === ANET_SANDBOX_API),
  "zero live endpoints; all transport calls explicitly mocked",
);
console.log(
  n + " GIV-3C adapter/security checks passed; ZERO provider network calls",
);
