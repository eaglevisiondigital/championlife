// Server-only sibling adapter. No registration changes to the held GIV-3A runtime.
import { executionGate, minor, normalizeError } from "./providers.mjs";
import { resolveCredential } from "./runtime.mjs";
export const ANET_SANDBOX_API =
  "https://apitest.authorize.net/xml/v1/request.api";
export const ANET_SANDBOX_FORM = "https://test.authorize.net/payment/payment";
export class AuthorizeNetFailure extends Error {
  constructor(category = "configuration_error", status = "failed") {
    super(normalizeError({ category }).message);
    this.category = category;
    this.status = status;
    this.retry_automatically = false;
  }
}
const fail = (category = "configuration_error", status = "failed") => {
  throw new AuthorizeNetFailure(category, status);
};
export function only(p, keys) {
  if (
    !p ||
    typeof p !== "object" ||
    Array.isArray(p) ||
    Object.keys(p).some((k) => !keys.includes(k))
  )
    fail("invalid_payment_method");
  return p;
}
export function exactDecimal(amount) {
  const n = BigInt(minor(amount));
  return `${n / 100n}.${String(n % 100n).padStart(2, "0")}`;
}
export function exactMinor(amount) {
  if (!/^(0|[1-9]\d{0,10})(\.\d{1,2})?$/.test(String(amount)))
    fail("unknown", "review");
  const [a, b = ""] = String(amount).split(".");
  return (BigInt(a) * 100n + BigInt(b.padEnd(2, "0"))).toString();
}
export function providerId(value) {
  if (
    typeof value !== "string" ||
    !/^\d{1,20}$/.test(value) ||
    /^0+$/.test(value)
  )
    fail();
  return value;
}
function canonicalRef(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,20}$/.test(value)) fail();
  return value;
}
export function opaqueData(value) {
  only(value, ["dataDescriptor", "dataValue"]);
  if (
    value.dataDescriptor !== "COMMON.ACCEPT.INAPP.PAYMENT" ||
    typeof value.dataValue !== "string" ||
    !/^[a-zA-Z0-9+/=_-]{20,4096}$/.test(value.dataValue) ||
    /^\d{13,19}$/.test(value.dataValue)
  )
    fail("invalid_payment_method");
  return { dataDescriptor: value.dataDescriptor, dataValue: value.dataValue };
}
export function scopedProfile(profile, scope) {
  only(profile, [
    "organization_id",
    "person_id",
    "gateway_id",
    "environment",
    "customer_id",
    "payment_profile_id",
    "active",
  ]);
  if (
    profile.active !== true ||
    ["organization_id", "person_id", "gateway_id", "environment"].some(
      (k) => profile[k] !== scope[k],
    )
  )
    fail("routing_error");
  return {
    customerProfileId: providerId(profile.customer_id),
    paymentProfile: {
      paymentProfileId: providerId(profile.payment_profile_id),
    },
  };
}
export function logicalMethodBinding(
  scope,
  profile,
  { logical_method_id, brand, last4 },
) {
  const p = scopedProfile(profile, scope);
  if (
    !/^[a-f0-9-]{36}$/.test(logical_method_id) ||
    !["Visa", "Mastercard", "American Express", "Discover", "Other"].includes(
      brand,
    ) ||
    !/^\d{4}$/.test(last4)
  )
    fail();
  return {
    organization_id: scope.organization_id,
    person_id: scope.person_id,
    gateway_id: scope.gateway_id,
    environment: scope.environment,
    logical_method_id,
    provider_customer_reference: p.customerProfileId,
    provider_payment_reference: p.paymentProfile.paymentProfileId,
    method: "card",
    descriptor: brand + " ending " + last4,
  };
}
function category(data) {
  const t = data.transactionResponse || {},
    code = String(
      t.errors?.[0]?.errorCode || data.messages?.message?.[0]?.code || "",
    );
  if (["11", "318", "E00039"].includes(code)) return "duplicate";
  if (code === "8") return "expired_card";
  if (["6", "7", "9", "10", "37", "78", "E00003"].includes(code))
    return "invalid_payment_method";
  if (
    [
      "13",
      "30",
      "31",
      "32",
      "E00005",
      "E00006",
      "E00007",
      "E00008",
      "E00010",
    ].includes(code)
  )
    return "configuration_error";
  if (["39"].includes(code)) return "routing_error";
  if (["901"].includes(code)) return "processor_unavailable";
  if (t.responseCode === "4" || ["193", "252", "253"].includes(code))
    return "fraud_review";
  if (t.responseCode === "2") return "declined";
  return "unknown";
}
export function normalizeAuthorizeNet(data, operation) {
  if (!data || typeof data !== "object")
    return {
      status: "review",
      category: "unknown",
      retry_automatically: false,
    };
  const t = data.transactionResponse,
    invalid =
      data.messages?.resultCode !== "Ok" ||
      (t && String(t.responseCode) !== "1");
  if (
    ["sale", "authorize", "capture", "refund", "void"].includes(operation) &&
    !t
  )
    return {
      status: "review",
      category: "unknown",
      retry_automatically: false,
    };
  if (invalid) {
    const c = category(data);
    return {
      status: ["unknown", "duplicate", "fraud_review"].includes(c)
        ? "review"
        : "failed",
      category: c,
      retry_automatically: false,
    };
  }
  const states = {
    sale: "captured",
    authorize: "authorized",
    capture: "captured",
    refund: "pending",
    void: "voided",
    create_customer: "tokenized",
    attach_payment_method: "tokenized",
    create_recurring_profile: "pending",
    update_recurring_profile: "pending",
    cancel_recurring_profile: "voided",
  };
  const r = {
    status: states[operation] || "review",
    category: null,
    retry_automatically: false,
  };
  if (t) {
    if (t.transId && t.transId !== "0")
      r.provider_reference = providerId(t.transId);
    else if (
      ["sale", "authorize", "capture", "refund", "void"].includes(operation)
    )
      return {
        status: "review",
        category: "unknown",
        retry_automatically: false,
      };
    // Retain only fraud decision, never raw CVV/AVS input or verbose provider diagnostics.
    if (
      t.cvvResultCode === "N" ||
      ["A", "E", "N", "R"].includes(t.avsResultCode)
    )
      r.risk_review = true;
    if (/^XXXX\d{4}$/.test(t.accountNumber || ""))
      r.last4 = t.accountNumber.slice(-4);
    if (
      ["Visa", "MasterCard", "AmericanExpress", "Discover"].includes(
        t.accountType,
      )
    )
      r.brand =
        { MasterCard: "Mastercard", AmericanExpress: "American Express" }[
          t.accountType
        ] || t.accountType;
  }
  if (data.customerProfileId)
    r.customer_reference = providerId(data.customerProfileId);
  const paymentId =
    data.customerPaymentProfileId || data.customerPaymentProfileIdList?.[0];
  if (paymentId) r.payment_profile_reference = providerId(paymentId);
  if (data.subscriptionId)
    r.subscription_reference = providerId(data.subscriptionId);
  if (
    (operation === "create_customer" &&
      (!r.customer_reference || !r.payment_profile_reference)) ||
    (operation === "attach_payment_method" && !r.payment_profile_reference) ||
    (operation === "create_recurring_profile" && !r.subscription_reference)
  )
    return {
      status: "review",
      category: "unknown",
      retry_automatically: false,
    };
  return r;
}
function date(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    fail();
  return value;
}
export function createAuthorizeNetAdapter({
  config = {},
  scope = {},
  binding = {},
  readSecret = () => "",
  transport = null,
  currentContext = () => null,
} = {}) {
  const keys = () => {
    let s;
    try {
      s = JSON.parse(resolveCredential(binding, scope, readSecret));
    } catch {
      fail();
    }
    only(s, ["apiLoginId", "transactionKey", "signatureKey"]);
    if (
      !/^[a-zA-Z0-9]{1,50}$/.test(s.apiLoginId || "") ||
      !/^[a-zA-Z0-9]{8,64}$/.test(s.transactionKey || "") ||
      (s.signatureKey !== undefined && !/^[a-f0-9]{128}$/i.test(s.signatureKey))
    )
      fail();
    return s;
  };
  const assertScope = () => {
    if (
      config.enabled !== true ||
      (config.endpoint !== undefined && config.endpoint !== ANET_SANDBOX_API) ||
      scope.provider !== "authorize_net" ||
      scope.environment !== "sandbox" ||
      config.environment !== "sandbox" ||
      config.organization_id !== scope.organization_id ||
      config.gateway_id !== scope.gateway_id ||
      config.currency !== scope.currency ||
      config.country !== scope.country ||
      !/^[A-Z]{3}$/.test(scope.currency || "") ||
      !/^[A-Z]{2}$/.test(scope.country || "")
    )
      fail("routing_error");
  };
  async function request(name, body, op) {
    assertScope();
    let context;
    try {
      context = await currentContext({
        organization_id: scope.organization_id,
        gateway_id: scope.gateway_id,
        operation: op,
      });
    } catch {
      fail();
    }
    if (!executionGate(context) || typeof transport !== "function") fail();
    const secret = keys();
    let res, data;
    try {
      res = await transport(ANET_SANDBOX_API, {
        method: "POST",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [name]: {
            merchantAuthentication: {
              name: secret.apiLoginId,
              transactionKey: secret.transactionKey,
            },
            ...body,
          },
        }),
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      fail("unknown", "review");
    }
    if (res.status === 401 || res.status === 403) fail("configuration_error");
    if (res.status >= 500) fail("processor_unavailable", "review");
    if (!res.ok) fail("unknown", "review");
    const reader = res.body?.getReader();
    if (!reader) fail("unknown", "review");
    let size = 0,
      chunks = [];
    try {
      for (;;) {
        const x = await reader.read();
        if (x.done) break;
        size += x.value.length;
        if (size > 262144) {
          await reader.cancel();
          fail("unknown", "review");
        }
        chunks.push(x.value);
      }
      const all = new Uint8Array(size);
      let at = 0;
      for (const x of chunks) {
        all.set(x, at);
        at += x.length;
      }
      data = JSON.parse(new TextDecoder().decode(all).replace(/^\uFEFF/, ""));
    } catch {
      fail("unknown", "review");
    }
    const normalized = normalizeAuthorizeNet(data, op);
    return { data, normalized };
  }
  function payment(p) {
    only(p, ["opaque", "opaque_scope", "profile"]);
    if (p.opaque && p.profile) fail("invalid_payment_method");
    if (p.opaque) {
      only(p.opaque_scope, [
        "organization_id",
        "gateway_id",
        "person_id",
        "environment",
        "expires_at",
      ]);
      if (
        ["organization_id", "gateway_id", "person_id", "environment"].some(
          (k) => p.opaque_scope[k] !== scope[k],
        ) ||
        !Number.isSafeInteger(p.opaque_scope.expires_at) ||
        p.opaque_scope.expires_at <= Date.now() ||
        p.opaque_scope.expires_at > Date.now() + 900000
      )
        fail("routing_error");
      return { payment: { opaqueData: opaqueData(p.opaque) } };
    }
    if (p.profile) return { profile: scopedProfile(p.profile, scope) };
    fail("invalid_payment_method");
  }
  function original(p, states) {
    only(p, [
      "organization_id",
      "gateway_id",
      "route_id",
      "environment",
      "transaction_reference",
      "status",
      "amount_minor",
      "refunded_minor",
      "last4",
      "currency",
    ]);
    if (
      [
        "organization_id",
        "gateway_id",
        "route_id",
        "environment",
        "currency",
      ].some((k) => p[k] !== scope[k]) ||
      !states.includes(p.status)
    )
      fail("routing_error");
    providerId(p.transaction_reference);
    minor(p.amount_minor);
    return p;
  }
  const transaction = async (type, p, op) => {
    const { normalized } = await request(
      "createTransactionRequest",
      {
        refId: canonicalRef(p.request_reference),
        transactionRequest: {
          transactionType: type,
          ...(p.body.amount ? { amount: p.body.amount } : {}),
          currencyCode: scope.currency,
          ...(p.body.payment ? { payment: p.body.payment } : {}),
          ...(p.body.profile ? { profile: p.body.profile } : {}),
          ...(p.body.refTransId ? { refTransId: p.body.refTransId } : {}),
          transactionSettings: {
            setting: [{ settingName: "emailCustomer", settingValue: "false" }],
          },
        },
      },
      op,
    );
    return normalized;
  };
  const charge = async (op, p) => {
    only(p, ["request_reference", "amount_minor", "method"]);
    return transaction(
      op === "sale" ? "authCaptureTransaction" : "authOnlyTransaction",
      {
        request_reference: p.request_reference,
        body: { amount: exactDecimal(p.amount_minor), ...payment(p.method) },
      },
      op,
    );
  };
  const api = {
    provider: "authorize_net",
    environment: "sandbox",
    mode: "disabled_until_all_canonical_gates",
    normalize_error: async (p) => normalizeError(p),
    create_tokenization_session: async (p) => {
      only(p, [
        "request_reference",
        "amount_minor",
        "return_url",
        "save_method",
      ]);
      if (
        typeof p.return_url !== "string" ||
        !(config.return_urls || []).includes(p.return_url) ||
        !/^https:\/\/[a-z0-9-]+--championlifechurch\.netlify\.app\/checkout\.html$/.test(
          p.return_url,
        )
      )
        fail();
      const setting = (settingName, value) => ({
        settingName,
        settingValue: JSON.stringify(value),
      });
      const { data, normalized } = await request(
        "getHostedPaymentPageRequest",
        {
          refId: canonicalRef(p.request_reference),
          transactionRequest: {
            transactionType: "authCaptureTransaction",
            amount: exactDecimal(p.amount_minor),
            currencyCode: scope.currency,
            transactionSettings: {
              setting: [
                { settingName: "emailCustomer", settingValue: "false" },
              ],
            },
          },
          hostedPaymentSettings: {
            setting: [
              setting("hostedPaymentReturnOptions", {
                showReceipt: true,
                url: p.return_url,
                urlText: "Return to checkout",
                cancelUrl: p.return_url,
                cancelUrlText: "Cancel",
              }),
              setting("hostedPaymentPaymentOptions", {
                cardCodeRequired: true,
                showCreditCard: true,
                showBankAccount: false,
              }),
              setting("hostedPaymentCustomerOptions", {
                showEmail: false,
                requiredEmail: false,
                addPaymentProfile: p.save_method === true,
              }),
              setting("hostedPaymentShippingAddressOptions", {
                show: false,
                required: false,
              }),
            ],
          },
        },
        "tokenization",
      );
      if (
        data.messages?.resultCode !== "Ok" ||
        typeof data.token !== "string" ||
        !/^[a-zA-Z0-9+/=_-]{20,4096}$/.test(data.token)
      )
        return normalized;
      return {
        status: "tokenized",
        form_url: ANET_SANDBOX_FORM,
        form_token: data.token,
        expires_in_seconds: 900,
        environment: "sandbox",
        gateway_id: scope.gateway_id,
        reconciliation_required: true,
      };
    },
    create_customer: async (p) => {
      only(p, ["request_reference", "merchant_customer_id", "method"]);
      if (!p.method?.opaque) fail();
      const id = canonicalRef(p.merchant_customer_id);
      return (
        await request(
          "createCustomerProfileRequest",
          {
            refId: canonicalRef(p.request_reference),
            profile: {
              merchantCustomerId: id,
              paymentProfiles: [
                { customerType: "individual", ...payment(p.method) },
              ],
            },
            validationMode: "testMode",
          },
          "create_customer",
        )
      ).normalized;
    },
    attach_payment_method: async (p) => {
      only(p, ["request_reference", "customer", "method"]);
      if (!p.method?.opaque) fail();
      only(p.customer, [
        "organization_id",
        "person_id",
        "gateway_id",
        "environment",
        "customer_id",
      ]);
      if (
        ["organization_id", "person_id", "gateway_id", "environment"].some(
          (k) => p.customer[k] !== scope[k],
        )
      )
        fail("routing_error");
      return (
        await request(
          "createCustomerPaymentProfileRequest",
          {
            refId: canonicalRef(p.request_reference),
            customerProfileId: providerId(p.customer.customer_id),
            paymentProfile: {
              customerType: "individual",
              ...payment(p.method),
            },
            validationMode: "testMode",
          },
          "attach_payment_method",
        )
      ).normalized;
    },
    sale: (p) => charge("sale", p),
    authorize: (p) => charge("authorize", p),
    capture: async (p) => {
      only(p, ["request_reference", "amount_minor", "original"]);
      const o = original(p.original, ["authorized"]);
      if (BigInt(minor(p.amount_minor)) > BigInt(o.amount_minor)) fail();
      return transaction(
        "priorAuthCaptureTransaction",
        {
          request_reference: p.request_reference,
          body: {
            amount: exactDecimal(p.amount_minor),
            refTransId: o.transaction_reference,
          },
        },
        "capture",
      );
    },
    void: async (p) => {
      only(p, ["request_reference", "original"]);
      const o = original(p.original, ["authorized"]);
      return transaction(
        "voidTransaction",
        {
          request_reference: p.request_reference,
          body: { refTransId: o.transaction_reference },
        },
        "void",
      );
    },
    refund: async (p) => {
      only(p, ["request_reference", "amount_minor", "original"]);
      const o = original(p.original, ["settled", "partially_refunded"]);
      if (
        !/^\d{4}$/.test(o.last4 || "") ||
        !/^\d{1,13}$/.test(o.refunded_minor || "0") ||
        BigInt(minor(p.amount_minor)) + BigInt(o.refunded_minor || "0") >
          BigInt(o.amount_minor)
      )
        fail();
      return transaction(
        "refundTransaction",
        {
          request_reference: p.request_reference,
          body: {
            amount: exactDecimal(p.amount_minor),
            refTransId: o.transaction_reference,
            payment: {
              creditCard: { cardNumber: o.last4, expirationDate: "XXXX" },
            },
          },
        },
        "refund",
      );
    },
    retrieve_transaction: async (p) => {
      only(p, ["request_reference", "original"]);
      const o = original(p.original, [
        "pending",
        "authorized",
        "captured",
        "settled",
        "partially_refunded",
        "refunded",
        "voided",
        "review",
        "failed",
      ]);
      const { data, normalized } = await request(
        "getTransactionDetailsRequest",
        { transId: o.transaction_reference },
        "retrieve_transaction",
      );
      if (data.messages?.resultCode !== "Ok") return normalized;
      const t = data.transaction;
      if (!t || String(t.transId) !== o.transaction_reference)
        fail("routing_error", "review");
      const states = {
        authorizedPendingCapture: "authorized",
        capturedPendingSettlement: "captured",
        settledSuccessfully: "settled",
        voided: "voided",
        refundPendingSettlement: "pending",
        refundSettledSuccessfully: "refunded",
        declined: "failed",
        underReview: "review",
        FDSPendingReview: "review",
        FDSAuthorizedPendingReview: "review",
      };
      return {
        status:
          exactMinor(t.settleAmount ?? t.authAmount) === o.amount_minor
            ? states[t.transactionStatus] || "review"
            : "review",
        provider_reference: o.transaction_reference,
        amount_minor: exactMinor(t.settleAmount ?? t.authAmount),
        currency: scope.currency,
        retry_automatically: false,
      };
    },
    create_recurring_profile: async (p) => {
      only(p, [
        "request_reference",
        "profile",
        "amount_minor",
        "frequency",
        "start_date",
        "occurrences",
      ]);
      const prof = scopedProfile(p.profile, scope),
        interval = {
          weekly: { length: 7, unit: "days" },
          biweekly: { length: 14, unit: "days" },
          monthly: { length: 1, unit: "months" },
          annual: { length: 12, unit: "months" },
        }[p.frequency];
      if (
        !interval ||
        !Number.isInteger(p.occurrences) ||
        p.occurrences < 1 ||
        p.occurrences > 9999
      )
        fail();
      return (
        await request(
          "ARBCreateSubscriptionRequest",
          {
            refId: canonicalRef(p.request_reference),
            subscription: {
              paymentSchedule: {
                interval,
                startDate: date(p.start_date),
                totalOccurrences: p.occurrences,
                trialOccurrences: 0,
              },
              amount: exactDecimal(p.amount_minor),
              profile: {
                customerProfileId: prof.customerProfileId,
                customerPaymentProfileId: prof.paymentProfile.paymentProfileId,
              },
            },
          },
          "create_recurring_profile",
        )
      ).normalized;
    },
    update_recurring_profile: async (p) => {
      only(p, ["subscription", "amount_minor"]);
      const id = subscription(p.subscription);
      return (
        await request(
          "ARBUpdateSubscriptionRequest",
          {
            subscriptionId: id,
            subscription: { amount: exactDecimal(p.amount_minor) },
          },
          "update_recurring_profile",
        )
      ).normalized;
    },
    cancel_recurring_profile: async (p) => {
      only(p, ["subscription"]);
      return (
        await request(
          "ARBCancelSubscriptionRequest",
          { subscriptionId: subscription(p.subscription) },
          "cancel_recurring_profile",
        )
      ).normalized;
    },
    retrieve_subscription: async (p) => {
      only(p, ["subscription"]);
      const { data, normalized } = await request(
        "ARBGetSubscriptionStatusRequest",
        { subscriptionId: subscription(p.subscription) },
        "retrieve_subscription",
      );
      return data.messages?.resultCode === "Ok"
        ? {
            status:
              {
                active: "pending",
                canceled: "voided",
                expired: "voided",
                suspended: "review",
                terminated: "review",
              }[data.status] || "review",
            provider_status: [
              "active",
              "canceled",
              "expired",
              "suspended",
              "terminated",
            ].includes(data.status)
              ? data.status
              : "unknown",
          }
        : normalized;
    },
    retrieve_settlement: async (p) => {
      only(p, ["first_date", "last_date", "batch_id"]);
      let data, normalized;
      if (p.batch_id) {
        ({ data, normalized } = await request(
          "getBatchStatisticsRequest",
          { batchId: providerId(p.batch_id) },
          "retrieve_settlement",
        ));
        if (data.messages?.resultCode !== "Ok") return normalized;
        if (String(data.batch?.batchId) !== p.batch_id)
          fail("routing_error", "review");
        return {
          status: "review",
          batch_reference: providerId(data.batch?.batchId),
          fee_minor: null,
          net_minor: null,
          statistics: (data.batch?.statistics || []).map((x) => ({
            account_type: [
              "Visa",
              "MasterCard",
              "AmericanExpress",
              "Discover",
              "eCheck",
            ].includes(x.accountType)
              ? x.accountType
              : "Other",
            gross_minor: exactMinor(x.chargeAmount ?? "0"),
            refund_minor: exactMinor(x.refundAmount ?? "0"),
            charge_count: nonnegative(x.chargeCount),
            refund_count: nonnegative(x.refundCount),
          })),
        };
      }
      const first = date(p.first_date),
        last = date(p.last_date),
        span = Date.parse(last) - Date.parse(first);
      if (span < 0 || span >= 31 * 86400000) fail();
      ({ data, normalized } = await request(
        "getSettledBatchListRequest",
        {
          includeStatistics: true,
          firstSettlementDate: first + "T00:00:00Z",
          lastSettlementDate: last + "T23:59:59Z",
        },
        "retrieve_settlement",
      ));
      if (data.messages?.resultCode !== "Ok") return normalized;
      return {
        status: "review",
        fee_minor: null,
        net_minor: null,
        batches: (data.batchList || []).map((b) => ({
          batch_reference: providerId(b.batchId),
          settlement_date_utc: /^\d{4}-\d\d-\d\dT[\d:]+Z?$/.test(
            b.settlementTimeUTC || "",
          )
            ? b.settlementTimeUTC
            : null,
          status: [
            "settledSuccessfully",
            "settlementError",
            "pendingSettlement",
          ].includes(b.settlementState)
            ? b.settlementState
            : "unknown",
        })),
      };
    },
    verify_webhook: async (p) => {
      only(p, ["body", "signature"]);
      assertScope();
      return {
        verified: await verifyAuthorizeNetSignature(
          p.body,
          p.signature,
          keys().signatureKey,
        ),
      };
    },
  };
  function subscription(s) {
    only(s, [
      "organization_id",
      "gateway_id",
      "environment",
      "instruction_id",
      "route_id",
      "subscription_reference",
    ]);
    if (
      ["organization_id", "gateway_id", "environment", "route_id"].some(
        (k) => s[k] !== scope[k],
      ) ||
      !/^[a-f0-9-]{36}$/.test(s.instruction_id || "")
    )
      fail("routing_error");
    return providerId(s.subscription_reference);
  }
  return Object.freeze(api);
}
function nonnegative(n) {
  if (!Number.isSafeInteger(n) || n < 0) fail("unknown", "review");
  return n;
}
export async function verifyAuthorizeNetSignature(body, signature, key) {
  try {
    if (
      typeof body !== "string" ||
      new TextEncoder().encode(body).length > 262144 ||
      !/^sha512=[a-f0-9]{128}$/i.test(signature || "") ||
      !/^[a-f0-9]{128}$/i.test(key || "")
    )
      return false;
    const bytes = Uint8Array.from(key.match(/../g), (x) => parseInt(x, 16)),
      k = await crypto.subtle.importKey(
        "raw",
        bytes,
        { name: "HMAC", hash: "SHA-512" },
        false,
        ["sign"],
      ),
      hash = new Uint8Array(
        await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body)),
      ),
      provided = Uint8Array.from(signature.slice(7).match(/../g), (x) =>
        parseInt(x, 16),
      );
    let diff = 0;
    for (let i = 0; i < 64; i++) diff |= hash[i] ^ provided[i];
    return diff === 0;
  } catch {
    return false;
  }
}
export async function normalizeAuthorizeNetWebhook(
  body,
  signature,
  key,
  scope,
) {
  if (!(await verifyAuthorizeNetSignature(body, signature, key)))
    fail("configuration_error");
  let d;
  try {
    d = JSON.parse(body);
  } catch {
    fail();
  }
  // Signature proves account origin; it does not grant authority or prove settlement. Safe metadata only.
  if (
    scope?.provider !== "authorize_net" ||
    scope.environment !== "sandbox" ||
    typeof d.notificationId !== "string" ||
    !/^[-a-f0-9]{36}$/i.test(d.notificationId)
  )
    fail();
  const tx = {
      "net.authorize.payment.authcapture.created": "captured",
      "net.authorize.payment.authorization.created": "authorized",
      "net.authorize.payment.capture.created": "captured",
      "net.authorize.payment.priorAuthCapture.created": "captured",
      "net.authorize.payment.refund.created": "refunded",
      "net.authorize.payment.void.created": "voided",
      "net.authorize.payment.fraud.held": "review",
      "net.authorize.payment.fraud.approved": "review",
      "net.authorize.payment.fraud.declined": "failed",
    },
    sub = [
      "created",
      "updated",
      "cancelled",
      "suspended",
      "terminated",
      "expired",
      "failed",
    ].map((x) => "net.authorize.customer.subscription." + x);
  const kind = tx[d.eventType]
    ? "transaction"
    : sub.includes(d.eventType)
      ? "subscription"
      : null;
  if (!kind || !d.payload) fail();
  const digest = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
  return {
    organization_id: scope.organization_id,
    gateway_id: scope.gateway_id,
    environment: "sandbox",
    event_reference: d.notificationId,
    body_digest: digest,
    kind,
    provider_reference: providerId(String(d.payload.id)),
    status: tx[d.eventType] || "review",
    requires_verified_lookup: true,
  };
}
// Undeployed handler factory: the future runtime must supply a canonical lookup and atomic dedupe store.
export function createAuthorizeNetWebhookHandler({
  enabled = false,
  scope,
  readSignatureKey = () => "",
  lookupCanonical = async () => null,
  recordEvent = async () => null,
} = {}) {
  return async (request) => {
    const reply = (status, result) =>
      new Response(JSON.stringify(result), {
        status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    if (
      !enabled ||
      scope?.environment !== "sandbox" ||
      scope?.provider !== "authorize_net"
    )
      return reply(503, { accepted: false });
    if (request.method !== "POST") return reply(405, { accepted: false });
    try {
      const reader = request.body?.getReader();
      if (!reader) return reply(403, { accepted: false });
      let count = 0,
        parts = [];
      for (;;) {
        const item = await reader.read();
        if (item.done) break;
        count += item.value.length;
        if (count > 262144) {
          await reader.cancel();
          return reply(413, { accepted: false });
        }
        parts.push(item.value);
      }
      const bytes = new Uint8Array(count);
      let at = 0;
      for (const part of parts) {
        bytes.set(part, at);
        at += part.length;
      }
      const event = await normalizeAuthorizeNetWebhook(
        new TextDecoder().decode(bytes),
        request.headers.get("X-ANET-Signature"),
        await readSignatureKey(scope),
        scope,
      );
      const binding = await lookupCanonical(event);
      if (
        !binding ||
        binding.organization_id !== scope.organization_id ||
        binding.gateway_id !== scope.gateway_id ||
        binding.environment !== "sandbox" ||
        binding.provider_reference !== event.provider_reference
      )
        return reply(403, { accepted: false });
      const result = await recordEvent(event, binding);
      if (!result?.accepted) return reply(409, { accepted: false });
      return reply(200, {
        accepted: true,
        duplicate: result.duplicate === true,
        reconciliation: "held",
      });
    } catch {
      return reply(403, { accepted: false });
    }
  };
}
