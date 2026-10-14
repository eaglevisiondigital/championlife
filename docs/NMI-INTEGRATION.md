# NMI integration — GIV-3B sandbox build

NMI is an implementation of the accepted provider-neutral contract, using the existing Giving sessions, frozen line/MID routing, legs, requests, logical methods, refund and recurring instructions. GIV-3A is accepted at `1410ebc824cdf0b9721c95db0cb41229b74a0274`. No second financial ledger is introduced. No hosted sandbox acceptance is claimed by this document.

## Verified documentation and dependencies

Reviewed official NMI documentation October 14, 2026. Prefer [Payment Component](https://docs.nmi.com/docs/payment-component) and [REST v5](https://docs.nmi.com/reference/create-sale-v5). The frontend docs currently expose unresolved `USER.*` package placeholders; the actual official [sandbox guide](https://guide.nmi.com/) identifies `@nmipayments/nmi-pay`. Version 1.1.1 is pinned, with transitive integrity in `tools/nmi-component/package-lock.json`; `mountNmiPayments` and `createNmiToken` exports were inspected. The bundled SDK is reproducible via `npm ci --ignore-scripts --prefix tools/nmi-component` followed by `node tools/nmi-component/build.mjs`. SDK license: MIT. No Collect.js architecture/fallback was introduced.

The SDK contains hosted secure field frames and automatically loads Gateway.js. Before mounting, our host verifies its initialization response `testMode === true`, exact configured merchant ID and supported currency. Only `event.token` and `event.complete` are read from callbacks; `lookupData` is discarded, never spread into an application request or log. No application PAN/CVV/ACH/routing input is rendered. Save-method choice is explicit and defaults off; vault creation and persistence require that recorded choice. Payment tokens remain only in request/browser memory, are single-use, and are cleared on submission, invalidation, context change and destruction.

## Exact provider operations

Only fixed `https://sandbox.nmi.com/api/v5` is used. No client-supplied base/URL. Redirect following is disabled; private Authorization header goes only to that host. Numeric REST amounts are emitted directly from validated exact decimal/minor-unit strings, without float arithmetic. Provider receipt delivery is explicitly false.

| Operation | Current official reference / request |
|---|---|
| Sale | [POST /payments/sale](https://docs.nmi.com/reference/create-sale-v5); payment token or scoped vault, exact amount/currency, explicit `processor_id` |
| Authorization | [POST /payments/auth](https://docs.nmi.com/reference/create-auth-v5); distinct authorization state |
| Capture | [POST /payments/{payment_id}/capture](https://docs.nmi.com/reference/capture-payment-v5); original bound payment ID, exact amount |
| Void | [POST /payments/{payment_id}/void](https://docs.nmi.com/reference/void-payment-v5); eligible unsettled original transaction, empty JSON |
| Refund | [POST /payments/{payment_id}/refund](https://docs.nmi.com/reference/refund-payment-v5); canonical original request/remaining amount, confirmed settled/partially refunded leg |
| Vault creation | [POST /customers](https://docs.nmi.com/reference/create-customer-v5); stable canonical customer ID and token-only billing details |
| Lookup | [GET /payments/{payment_id}](https://docs.nmi.com/reference/get-payment-v5); original gateway/route/payment identity, safe projection |
| Subscription creation | [POST /subscriptions](https://docs.nmi.com/reference/create-subscription-v5); verified canonical plan binding, vault/token, explicit date, initially paused |
| Subscription update | [PUT /subscriptions/{subscription_id}](https://docs.nmi.com/reference/update-subscription-v5); exact amount/date, stays paused |
| Cancellation | [DELETE /subscriptions/{subscription_id}](https://docs.nmi.com/reference/delete-subscription-v5); original canonical instruction/route binding |

No `processor_id` is invented for capture/void/refund or subscription APIs where the current schema does not expose it. Original transaction ID/account determines adjustment routing. The subscription schema does not currently document a route selector; creation/update remain held unless the account's actual default route and gateway timezone have separately been verified, and the canonical route matches that default. A plan registry must match canonical amount, currency and frequency. Multiple canonical routes retain separate child provider subscription bindings, never one falsely shared subscription.

[CIT/MIT guidance](https://docs.nmi.com/docs/credential-on-file) is applied at the adapter boundary: initial storage is customer-initiated/stored; subsequent saved-method use includes the original initial transaction ID and customer/merchant distinction. Merchant-initiated use without that original reference fails closed. No unsupported network credential flag is invented.

## Security and operation lifecycle

The new `payments-nmi` Edge Function is undeployed and default off. It requires exact acceptance project URL, explicit isolated-origin allowlist, current verified user from Auth, existing active financial authority, enabled scoped sandbox account/route/session and frozen canonical amount. No live account/production project is accepted. Browser cannot supply amount, processor ID, actor, gateway override or raw card fields. Streaming input limit is 1.5 KiB; provider response is bounded to 64 KiB; HTTP timeout has no blind retry.

Authenticated intent prepares one existing provider operation. Token never enters SQL. A service-only claim and separate handoff recheck current actor, permissions, route, method status, expiry and lease. Handoff is committed before external I/O, once only. Database transactions are not held across NMI calls. Unknown/dispatched outcomes block another charge, including different client keys. Same refund, customer creation and subscription contexts cannot create uncontrolled duplicate operations. Completion is lease-bound, append-only in observations/journal and keeps the initiating audit actor. Approved sandbox states update canonical legs/session metadata but cannot reach the real ledger finalizer. Partial/unknown checkout does not issue a success receipt. A timeout without a returned provider ID requires manual gateway investigation/reconciliation; absence of a result is never proof no charge occurred.

Private NMI tables contain only sandbox controls and safe provider identifiers/observations linked to canonical IDs. They have RLS, revoked raw privileges and invoker public wrappers over guarded private functions. Vault references, signing keys and REST credentials never reach donor/finance browser projections. Logical methods display brand/last4; removal revokes active NMI vault use. Vault scope is exact owner/account/route. Initial route authorization is a sandbox test allowance, not portability proof. `verified_at` remains NULL until a successful saved-vault transaction on that route is observed. Additional processor scopes require an explicitly authorized experiment; never automatic cross-MID reuse.

## Webhooks and settlement

New undeployed `payments-nmi-webhook` is separate from the still-held GIV-3A generic endpoint. Use [gateway Webhook-Signature](https://docs.nmi.com/reference/overview), `t=nonce,s=hex`, HMAC-SHA256 of nonce + dot + exact raw JSON. This is different from merchant-signup `Signature`; those headers are not interchangeable. Verify before JSON parsing or any database call. Raw body/header/key is never logged or persisted; only safe projection plus digest. Request body is bounded to 256 KiB. Unexpected unmasked payment fields are rejected.

[Transaction](https://docs.nmi.com/reference/transaction-events), [recurring](https://docs.nmi.com/reference/recurring-events) and [batch](https://docs.nmi.com/reference/settlement-events) events use exact merchant/gateway/processor/canonical identity. Unknown IDs cannot create authority or financial records. Event identity/digest dedupes and altered replay conflicts. They record reconciliation observations, not real ledger postings. Repeated batch identity compares normalized content independently from event identity and rejects conflicts. Batch metadata keeps unavailable fees, net and date NULL; no undocumented settlement REST endpoint is called. Actual event availability, subscription scope and reconciliation data require later provider acceptance.

## Origins and build isolation

Only an explicitly enabled acceptance build can generate public component configuration. Private REST/webhook keys are never build/browser variables. Public tokenization key must match the documented tokenization-key shape; private-looking keys fail build. Production output preserves default null component configuration. The isolated checkout-only CSP adds SDK-inspected exact origins: `https://secure.nmi.com` for tokenization/frames and `https://secure.networkmerchants.com` for Gateway.js. Existing `https://cdn.jsdelivr.net` and exact acceptance Supabase host serve approved client/auth calls. No wildcard or global CSP weakening. `style-src 'unsafe-inline'` is limited to checkout because SDK injects its own styles. Both `.html` and pretty checkout routes are covered. Actual provider iframe/CSP/accessibility behavior remains hosted-only.

## Protected credential handoff — only after build review

No NMI secret has been configured or inspected in this build. After explicit hosted acceptance authorization, the user enters sandbox-only private keys in the acceptance Supabase Edge Secrets interface or another protected hidden prompt. Never paste a key/token/card/connection string in Chat or save it in repo/audit logs.

REST secret: `PAYMENTS_<gateway UUID without hyphens, uppercase>_SANDBOX_V<version>`.
Gateway signing secret: `PAYMENTS_<gateway UUID without hyphens, uppercase>_SANDBOX_WEBHOOK_V1`.
Execution and webhook runtime flags default false. Both functions validate `SUPABASE_URL` equals `https://bkbmjisprwmkptywtmih.supabase.co`. Explicit branch/immutable origin, canonical organization/gateway and merchant metadata must be verified before enabling isolated test controls. Public-only build variables are `NMI_SANDBOX_COMPONENT_ENABLED`, `NMI_SANDBOX_ORGANIZATION_ID`, `NMI_SANDBOX_GATEWAY_ID`, `NMI_SANDBOX_PUBLIC_TOKENIZATION_KEY`, `NMI_SANDBOX_MERCHANT_REFERENCE`; they must be scoped to the reviewed isolated branch. No secret read-back/printing.

Actual sandbox processor IDs, default routing, key/account binding, gateway timezone, vault portability, Customer Vault response shapes, subscription behavior, webhook samples, settlement data and real token/card/log tests are unresolved hosted gates. No real card, live key, live gateway, automatic donor email, production checkout or GiveHub cutover is authorized.
