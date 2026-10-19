// Server-only NMI REST v5 sandbox adapter. No credential/token/raw response logging.
import { minor, normalizeError } from "./providers.mjs";
import {dedicatedAcceptance} from "./acceptance-pin.mjs";
export const NMI_BASE = "https://sandbox.nmi.com/api/v5";
export const ACCEPTANCE = "https://bkbmjisprwmkptywtmih.supabase.co";
export class NmiFailure extends Error {
  constructor(category = "unknown", status = "review") {
    super(normalizeError({ category }).message);
    this.category = category;
    this.status = status;
    this.retry_automatically = false;
  }
}
const fail = (category = "configuration_error", status = "failed") => {
  throw new NmiFailure(category, status);
};
export function reference(v) {
  if (
    typeof v !== "string" ||
    !/^[A-Za-z0-9_-]{1,120}$/.test(v) ||
    /^\d{13,19}$/.test(v)
  )
    fail("configuration_error");
  return v;
}
export function decimal(v) {
  const n = BigInt(minor(v));
  return `${n / 100n}.${(n % 100n).toString().padStart(2, "0")}`;
}
export function decimalMinor(v) {
  if (!/^(0|[1-9]\d{0,10})(\.\d{1,2})?$/.test(String(v)))
    fail("unknown", "review");
  const [a, b = ""] = String(v).split(".");
  return (BigInt(a) * 100n + BigInt(b.padEnd(2, "0"))).toString();
}
export function inputOnly(value, keys) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    fail("invalid_payment_method");
  return value;
}
export function credential(config, scope, readSecret) {
  if (
    (config.project !== ACCEPTANCE && !dedicatedAcceptance(config)) ||
    config.enabled !== true ||
    scope.environment !== "sandbox" ||
    scope.provider !== "nmi" ||
    scope.organization_id !== config.organization_id ||
    scope.gateway_id !== config.gateway_id
  )
    fail();
  if (
    !/^[a-f0-9-]{36}$/.test(scope.organization_id) ||
    !/^[a-f0-9-]{36}$/.test(scope.gateway_id) ||
    !Number.isInteger(scope.secret_version) ||
    scope.secret_version < 1
  )
    fail();
  const name = `PAYMENTS_${scope.gateway_id.replaceAll("-", "").toUpperCase()}_SANDBOX_V${scope.secret_version}`;
  const key = readSecret(name);
  if (
    typeof key !== "string" ||
    key.length < 12 ||
    key.length > 512 ||
    /[\r\n]/.test(key)
  )
    fail();
  return key;
}
export function normalizeNmi(data, operation, httpStatus = 200) {
  // Explicit projection only; provider response_text, billing, token, BIN and raw payment data discarded.
  if (!data || typeof data !== "object")
    return {
      status: "review",
      category: "unknown",
      retry_automatically: false,
    };
  const code = String(data.response_code || ""),
    response = String(data.response || "");
  if (
    response === "2" ||
    response === "3" ||
    httpStatus === 400 ||
    httpStatus === 401
  ) {
    const category =
      code === "202"
        ? "insufficient_funds"
        : code === "223"
          ? "expired_card"
          : /^22[01456]$/.test(code)
            ? "invalid_payment_method"
            : /^25[123]$/.test(code)
              ? "fraud_review"
              : /^41[01]$/.test(code) || httpStatus === 401
                ? "configuration_error"
                : code === "430"
                  ? "duplicate"
                  : /^42[01]$/.test(code)
                    ? "unknown"
                    : response === "2"
                      ? "declined"
                      : "configuration_error";
    return {
      status:
        category === "unknown" || category === "duplicate"
          ? "review"
          : "failed",
      category,
      retry_automatically: false,
    };
  }
  if (httpStatus >= 500)
    return {
      status: "review",
      category: "unknown",
      retry_automatically: false,
    };
  const documented = {
    pendingsettlement: "captured",
    pending: "pending",
    complete: "settled",
    settled: "settled",
    failed: "failed",
    voided: "voided",
    refunded: "refunded",
    authorized: "authorized",
  };
  let status =
    response === "1"
      ? {
          authorize: "authorized",
          sale: "captured",
          capture: "captured",
          void: "voided",
          refund: "refunded",
          create_customer: "tokenized",
          create_recurring_profile: "pending",
          update_recurring_profile: "pending",
          cancel_recurring_profile: "voided",
        }[operation] ||
        documented[data.status] ||
        "review"
      : documented[data.status] || "review";
  const result = {
    status,
    category: status === "review" ? "unknown" : null,
    retry_automatically: false,
  };
  if(typeof data.currency==='string'&&/^[A-Z]{3}$/.test(data.currency))result.currency=data.currency;
  for (const [field, key] of [
    ["id", "provider_reference"],
    ["customer_vault_id", "customer_reference"],
    ["processor_id", "processor_id"],
  ])
    if (data[field] !== undefined && data[field] !== null && data[field] !== "")
      result[key] = reference(String(data[field]));
  if (operation === "create_customer" && result.provider_reference)
    result.customer_reference = result.provider_reference;
  if (data.amount !== undefined)
    result.amount_minor = decimalMinor(data.amount);
  if(typeof data.paused_subscription==='boolean')result.paused=data.paused_subscription;
  if(typeof data.plan_id==='string')result.plan_reference=reference(data.plan_id);
  if(operation==='subscription_status'&&result.provider_reference&&typeof result.paused==='boolean')result.status=result.paused?'paused':'active';
  const details =
    data.payment_details ||
    data.billing?.payment_details ||
    data.billing?.[0]?.payment_details ||
    {};
  const masked = details.card_number,
    brand = details.card_type;
  if (
    typeof masked === "string" &&
    /^[*xX\d -]+\d{4}$/.test(masked) &&
    /[*xX]/.test(masked) &&
    masked.replace(/\D/g, "").length <= 10
  )
    result.last4 = masked.slice(-4);
  if (
    [
      "Visa",
      "Mastercard",
      "MasterCard",
      "American Express",
      "Discover",
      "Bank",
      "Other",
    ].includes(brand)
  )
    result.brand = brand === "MasterCard" ? "Mastercard" : brand;
  return result;
}
// NMI v5 specifies numeric amounts. Emit validated decimal JSON number literals without float arithmetic.
export function nmiJson(body) {
  return (
    "{" +
    Object.entries(body)
      .map(
        ([key, value]) =>
          JSON.stringify(key) +
          ":" +
          (["amount", "plan_amount"].includes(key)
            ? /^\d+\.\d{2}$/.test(value)
              ? value
              : fail()
            : JSON.stringify(value)),
      )
      .join(",") +
    "}"
  );
}
export function createNmiAdapter({
  config,
  scope,
  readSecret,
  fetcher = fetch,
}) {
  const post = async (path, body, op, method = "POST") => {
    const key = credential(config, scope, readSecret);
    let res;
    try {
      res = await fetcher(NMI_BASE + path, {
        method,
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: key,
        },
        ...(method !== "GET" ? { body: nmiJson(body) } : {}),
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      throw new NmiFailure("unknown", "review");
    }
    if(res.status===404&&op==='cancel_subscription_lookup')return {status:'cancelled',authoritative:true};
    // Bound streamed response. Nothing from a response or transport exception is logged.
    const reader = res.body?.getReader();
    let bytes = 0,
      chunks = [];
    if (!reader) throw new NmiFailure("unknown", "review");
    try {
      for (;;) {
        const r = await reader.read();
        if (r.done) break;
        bytes += r.value.length;
        if (bytes > 65536) {
          await reader.cancel();
          throw Error("bound");
        }
        chunks.push(r.value);
      }
    } catch {
      throw new NmiFailure("unknown", "review");
    }
    const joined = new Uint8Array(bytes);
    let offset = 0;
    for (const c of chunks) {
      joined.set(c, offset);
      offset += c.length;
    }
    let data;
    try {
      data = JSON.parse(new TextDecoder().decode(joined));
    } catch {
      throw new NmiFailure("unknown", "review");
    }
    const result = normalizeNmi(data, op, res.status);
    if (
      (["sale", "authorize", "retrieve_transaction"].includes(op) &&
        result.status !== "failed" &&
        !result.processor_id) ||
      (result.processor_id && result.processor_id !== scope.processor_id)
    )
      throw new NmiFailure("routing_error", "review");
    if (
      ["sale", "authorize", "capture", "refund"].includes(op) &&
      result.status !== "failed" &&
      result.status !== "review" &&
      (!result.provider_reference ||
        !result.amount_minor ||
        result.amount_minor !== decimalMinor(body.amount))
    ) {
      // Compare canonical amount against provider amount, without sending check-only metadata.
      if (
        !result.provider_reference ||
        !result.amount_minor ||
        result.amount_minor !== decimalMinor(body.amount)
      )
        throw new NmiFailure("unknown", "review");
    }
    return result;
  };
  function route() {
    if (!/^[A-Z]{3}$/.test(scope.currency || "")) fail();
    if (!scope.route_verified || !scope.processor_id) fail("routing_error");
    return reference(scope.processor_id);
  }
  function method(p) {
    inputOnly(p, [
      "payment_token",
      "vault_reference",
      "initial_transaction_id",
      "initiated_by",
    ]);
    if (p.payment_token) {
      if (
        p.vault_reference ||
        typeof p.payment_token !== "string" ||
        !/^[A-Za-z0-9_-]{8,256}$/.test(p.payment_token) ||
        /^\d{13,19}$/.test(p.payment_token)
      )
        fail("invalid_payment_method");
      return { payment_token: p.payment_token };
    }
    if (!scope.vault_route_authorized || !p.vault_reference)
      fail("invalid_payment_method");
    return { customer_vault_id: reference(p.vault_reference) };
  }
  const charge = (op, p) => {
    inputOnly(p, ["amount_minor", "method", "save_method", "order_reference"]);
    const details = method(p.method);
    const body = {
      amount: decimal(p.amount_minor),
      currency: scope.currency,
      processor_id: route(),
      payment_details: details,
      customer_receipt: false,
      ...(p.order_reference ? {order_details:{order_id:reference(p.order_reference)},dup_seconds:900}:{}),
    };
    if (p.save_method === true) {
      body.customer_vault = { add_customer: true };
      body.cit_mit = {
        stored_credential_indicator: "stored",
        initiated_by: "customer",
      };
    }
    if (details.customer_vault_id) {
      body.cit_mit = p.method.initial_transaction_id
        ? {
            stored_credential_indicator: "used",
            initiated_by:
              p.method.initiated_by === "merchant" ? "merchant" : "customer",
            initial_transaction_id: reference(p.method.initial_transaction_id),
          }
        : { stored_credential_indicator: "stored", initiated_by: "customer" };
      if (
        p.method.initiated_by === "merchant" &&
        !p.method.initial_transaction_id
      )
        fail();
    }
    return post(
      "/payments/" + (op === "authorize" ? "auth" : "sale"),
      body,
      op,
    );
  };
  return Object.freeze({
    provider: "nmi",
    environment: "sandbox",
    normalize_error: async (p) => normalizeError(p),
    verify_webhook: async (p) => ({
      verified: await verifyNmiWebhook(p.body, p.signature, p.key),
    }),
    create_tokenization_session: async () => {
      credential(config, scope, readSecret);
      route();
      return {
        environment: "sandbox",
        token_lifetime: "single_use",
        gateway_id: scope.gateway_id,
        cardholder_data: "NMI-hosted-only",
      };
    },
    attach_payment_method: async (p) => {
      inputOnly(p, ["vault_reference"]);
      if (!scope.vault_route_authorized) fail("invalid_payment_method");
      return {
        customer_reference: reference(p.vault_reference),
        status: "tokenized",
      };
    },
    sale: (p) => charge("sale", p),
    authorize: (p) => charge("authorize", p),
    capture: (p) => {
      inputOnly(p, ["transaction_reference", "amount_minor"]);
      route();
      return post(
        `/payments/${reference(p.transaction_reference)}/capture`,
        { amount: decimal(p.amount_minor) },
        "capture",
      );
    },
    void: (p) => {
      inputOnly(p, ["transaction_reference"]);
      route();
      return post(
        `/payments/${reference(p.transaction_reference)}/void`,
        {},
        "void",
      );
    },
    refund: (p) => {
      inputOnly(p, ["transaction_reference", "amount_minor"]);
      route();
      return post(
        `/payments/${reference(p.transaction_reference)}/refund`,
        { amount: decimal(p.amount_minor) },
        "refund",
      );
    },
    retrieve_transaction: async (p) => {
      inputOnly(p, ["transaction_reference"]);
      route();
      const result = await post(
        `/payments/${reference(p.transaction_reference)}`,
        {},
        "retrieve_transaction",
        "GET",
      );
      if (result.provider_reference !== p.transaction_reference)
        throw new NmiFailure("unknown", "review");
      return result;
    },
    create_customer: (p) => {
      inputOnly(p, ["payment_token", "customer_id"]);
      route();
      const details = method({ payment_token: p.payment_token });
      return post(
        "/customers",
        { id: reference(p.customer_id), billing: { payment_details: details } },
        "create_customer",
      );
    },
    create_recurring_profile: (p) => {
      inputOnly(p, ["plan_id", "method", "start_date", "active", "save_method", "order_reference"]);
      route();
      // Current v5 subscription schema has no processor_id. Require provider-verified default processor, never assume routing.
      if (scope.subscription_default_verified !== true) fail("routing_error");
      if (!/^\d{8}$/.test(p.start_date)) fail();
      return post(
        "/subscriptions",
        {
          plan_id: reference(p.plan_id),
          ...(p.order_reference?{order_details:{order_id:reference(p.order_reference)}}:{}),
          ...(p.save_method===true?{customer_vault:{add_customer:true}}:{}),
          payment_details: method(p.method),
          start_date: p.start_date,
          paused_subscription: p.active===true&&dedicatedAcceptance(config)?false:true,
        },
        "create_recurring_profile",
      );
    },
    update_recurring_profile: (p) => {
      inputOnly(p, ["subscription_reference", "amount_minor", "start_date"]);
      route();
      if (!scope.subscription_default_verified) fail("routing_error");
      if (!/^\d{8}$/.test(p.start_date)) fail();
      return post(
        `/subscriptions/${reference(p.subscription_reference)}`,
        {
          plan_amount: decimal(p.amount_minor),
          start_date: p.start_date,
          paused_subscription: true,
        },
        "update_recurring_profile",
        "PUT",
      );
    },
    cancel_recurring_profile: (p) => {
      inputOnly(p, ["subscription_reference"]);
      route();
      return post(
        `/subscriptions/${reference(p.subscription_reference)}`,
        {},
        "cancel_recurring_profile",
        "DELETE",
      );
    },
    retrieve_subscription: async(p)=>{
      inputOnly(p,['subscription_reference','cancelled']);route();
      const r=await post(`/subscriptions/${reference(p.subscription_reference)}`,{},p.cancelled?'cancel_subscription_lookup':'subscription_status','GET');
      if(r.status==='cancelled')return {...r,provider_reference:p.subscription_reference};
      if(r.provider_reference!==p.subscription_reference)throw new NmiFailure('unknown','review');return r;
    },
    pause_recurring_profile: (p)=>{inputOnly(p,['subscription_reference']);route();return post(`/subscriptions/${reference(p.subscription_reference)}`,{paused_subscription:true},'pause_recurring_profile','PUT');},
    retrieve_settlement: async () => {
      fail("configuration_error");
    }, // No invented v5 settlement endpoint. Signed batch observations remain nullable until proved.
  });
}
export async function verifyNmiWebhook(
  raw,
  signature,
  key,
  cryptoApi = crypto,
) {
  if (
    typeof raw !== "string" ||
    new TextEncoder().encode(raw).length > 262144 ||
    typeof key !== "string" ||
    key.length < 16 ||
    typeof signature !== "string"
  )
    return false;
  // NMI gateway Webhook-Signature, not Merchant Signup Signature. Nonce need not be a timestamp in current docs.
  const match = /^t=([^,\r\n]{1,128}),s=([a-fA-F0-9]{64})$/.exec(signature);
  if (!match) return false;
  const k = await cryptoApi.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sig = Uint8Array.from(match[2].match(/../g), (x) => parseInt(x, 16));
  return cryptoApi.subtle.verify(
    "HMAC",
    k,
    sig,
    new TextEncoder().encode(match[1] + "." + raw),
  );
}
export function webhookProjection(raw) {
  let e;
  try {
    e = JSON.parse(raw);
  } catch {
    fail();
  }
  const event_id = reference(e.event_id),
    event_type = String(e.event_type || "");
  const types = {
    "transaction.sale.success": "captured",
    "transaction.auth.success": "authorized",
    "transaction.capture.success": "captured",
    "transaction.void.success": "voided",
    "transaction.refund.success": "refunded",
  };
  const body = e.event_body;
  if (!body || typeof body !== "object") fail();
  // Incoming provider details never become application records. Reject unexpected unmasked payment values.
  function scan(v, k = "") {
    if (/^(cvv|cvc|card_cvv)$/i.test(k) && v) fail("invalid_payment_method");
    if (
      /^(ccnumber|card_number|checkaccount|checkaba|account_number|routing_number|cvv|cvc|card_cvv)$/i.test(
        k,
      ) &&
      typeof v === "string" &&
      /^\d{8,}$/.test(v)
    )
      fail("invalid_payment_method");
    if (v && typeof v === "object")
      Object.entries(v).forEach(([key, x]) => scan(x, key));
  }
  scan(body);
  if (
    body.features?.is_test_mode !== true &&
    !event_type.startsWith("settlement.")
  )
    fail();
  const base = {
    event_id,
    merchant_reference: reference(String(body.merchant?.id || "")),
    status: types[event_type] || "review",
  };
  if (event_type.startsWith("transaction."))
    return {
      ...base,
      kind: "transaction",
      provider_reference: reference(String(body.transaction_id || "")),
      processor_id: reference(String(body.processor_id || "")),
    };
  if (event_type.startsWith("recurring.subscription."))
    return {
      ...base,
      kind: "subscription",
      provider_reference: reference(
        String(body.subscription?.id || body.id || ""),
      ),
      status: event_type.endsWith(".delete") ? "voided" : "pending",
    };
  if (event_type.startsWith("settlement.batch."))
    return {
      ...base,
      kind: "batch",
      provider_reference: reference(String(body.batch_id || "")),
      processor_id: reference(String(body.processor?.id || "")),
      gross_minor: body.amount === undefined ? null : decimalMinor(body.amount),
      transaction_count:
        Number.isInteger(body.count) && body.count >= 0 ? body.count : null,
      status: event_type.endsWith(".complete") ? "settled" : "review",
    };
  fail();
}
