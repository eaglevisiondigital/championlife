# Giving provider adapters and activation gates

GIV-1 provides provider-neutral operation contracts and default-disabled Authorize.Net/NMI foundations. `attachPaymentProfile`, `authorize`, `capture`, `sale`, `refund`, `void`, `createCustomer`, `recurringCharge`, `lookupTransaction`, `normalizeWebhook` and `lookupSettlement` all fail closed without network I/O. No secrets, live endpoints, tokenization UI or transport are configured. Capability metadata describes the architectural shape, not verified merchant boarding. Future gateways are extension labels, not implemented adapters.

One checkout can require multiple independently authorized transactions. Plan legs by frozen merchant destination/gateway/MID, with currency-separated exact principal. Repeated provider events must match gateway, bound leg, digest and outcome. Canonical gateway/MID/provider transaction identity cannot post twice. Partial failure retains successful legs, accurate partial session state and one receipt for actual principal; no blind retry or silent compensating refund. Verified sandbox service outcomes test normalization/ledger independently of provider connectivity.

## Primary references and future implementation boundary

- [Authorize.Net transaction API](https://developer.authorize.net/api/reference/index.html): server merchant authentication and transaction operations; processor-specific refund/void eligibility must be verified against actual state.
- [Authorize.Net hosted customer profiles](https://developer.authorize.net/api/reference/features/customer-profiles.html): a provider-hosted path for future method collection, not raw server card entry.
- [Authorize.Net Webhooks](https://developer.authorize.net/api/reference/features/webhooks.html): verify the raw notification's HMAC-SHA512 `X-ANET-Signature` with the securely held Signature Key before normalization. A payload-provided digest is **not** proof of vendor authentication; GIV-1 has no public callback endpoint.
- [NMI transaction processing](https://docs.nmi.com/reference/transactions), [processing](https://docs.nmi.com/docs/processing), [transaction events](https://docs.nmi.com/reference/transaction-events) and [vault transaction use](https://docs.nmi.com/docs/using-for-transactions): future implementation must use the boarded gateway's supported API/capabilities and verified processor identity. Documentation does not establish this customer's multi-MID split, vault portability or settlement agreement.

## Exact activation prerequisites

Before any external sandbox/live processor work: separately approved assignment/environment; verified organization/legal-owner/merchant/deposit/gateway/MID mapping; explicit currency/minor-unit rules; current server finance/merchant/refund permissions; provider sandbox accounts and official SDK/API versions; secure server-only credential binding (never Chat/browser); hosted/tokenized collection and PCI scope review; signed callback verification, account/amount/currency/session binding, replay protection and canonical transaction lookup; capture/settlement/refund/void/chargeback rules; uncertain-outcome reconciliation; multi-leg partial-failure and retry authorization; fee/net metadata and deposit reconciliation; recurring/vault portability; tax/receipt language and Communications consent/delivery; masked logs, revocation, monitoring/kill controls; all eight races and approved isolated hosted acceptance. Live activation also needs explicit production authorization, approved real merchant boarding and controlled financial verification. GIV-1 permits none of this activation.

Authorize.Net needs the correct account-specific API Login ID/Transaction Key, Signature Key, hosted profile configuration, permitted payment types and transaction eligibility, supplied later through the secure secret mechanism. NMI needs account-specific secure authentication, explicit processor selection, verified webhook authentication and account-specific vault/recurring/settlement contracts. No secrets are requested or generated in this build. ACH manual records are not processing authorization.

## Six unresolved NMI questions for the representative

1. Can one NMI gateway account contain multiple MIDs for Main, Youth, Outreach, Events, etc.?
2. Can API explicitly choose processor/MID per transaction?
3. For one donor checkout containing multiple funds mapped to different MIDs, should Kingdom Propel submit separate transactions or does their configuration provide a native multi-MID split?
4. Can the same vaulted customer/payment method be used across the multiple MIDs in our boarded setup?
5. How are refunds, recurring transactions and chargebacks scoped across those MIDs?
6. Is reporting consolidated while settlement remains MID-specific?

These do not block the disabled core architecture; they block assumptions about actual activation. Preserve [routing](GIVING-MERCHANT-ROUTING.md), [ledger](GIVING-LEDGER.md) and [future approved requirements](GIV-1-FUTURE-APPROVED-REQUIREMENTS.md). GIV-2 and real adapters remain unstarted/unactivated respectively.
