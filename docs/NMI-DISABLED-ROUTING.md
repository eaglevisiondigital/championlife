# NMI boarding and disabled routing — local candidate, October 31

Based on production bfb7af214707db73a3a3164bc96ccafae7de8ccf, reusing PR59 a91ca567bc9b87ad902a4d3fd0e67a0ff1fe4f9e. Its boarding document, template and evaluator are preserved byte-for-byte. Only its workflow adds the new focused test.

`prepareDisabledRoute(document, routeName, receipt, now)` composes the existing pilot-readiness evaluator with a route-specific merchant evidence receipt. Every outcome is disabled and canSubmit=false, including a successful review result. There is no checkout transport, credential, provider connection, tokenization or activation function. This is a future integration boundary, not a live checkout.

## Four-MID boarding for November 2–3

Obtain the provider's four actual MID-to-gateway assignments privately. Keep MID-01–MID-04 as public aliases; five user-facing routes do not imply five MIDs. For each proposed route, independently reconcile legal merchant, settlement account ownership, receipt issuer, tax/transaction purpose and provider authorization. Main/Youth belong to Champion Life; Outreach belongs to SowGo; Events/Merch require explicit documented ownership. Do not infer ownership from a shared gateway or route label. Store actual MID numbers, tax/bank records and provider credentials only in the approved private custody system, never this repository.

The proposed evidence receipt contains only: route, midSlot, organization, purpose, gatewayGroupAlias, evidenceRef, legalMerchantAlias, settlementOwnerAlias, receiptOwnerAlias, verifiedBy, independentReviewer, verifiedAt, expiresAt, legalMerchantConfirmed, settlementOwnershipConfirmed, receiptOwnershipConfirmed, providerPurposeConfirmed. All confirmations must be literal true; reviewers must differ; times must be strict UTC ISO seconds and current. The receipt must match the selected reviewed route and gateway alias. The implementation verifies structure/binding, not the truth of legal documents; trusted operators must supply the receipt, never a browser.

Example fictional receipt for tests only:
```json
{"route":"Main","midSlot":"MID-01","organization":"Champion Life","purpose":"contribution","gatewayGroupAlias":"GatewayA","evidenceRef":"EvidenceA","legalMerchantAlias":"ChurchEntity","settlementOwnerAlias":"ChurchBankOwner","receiptOwnerAlias":"ChurchReceipt","verifiedBy":"VerifierA","independentReviewer":"ReviewerB","verifiedAt":"2026-11-02T12:00:00Z","expiresAt":"2026-11-03T12:00:00Z","legalMerchantConfirmed":true,"settlementOwnershipConfirmed":true,"receiptOwnershipConfirmed":true,"providerPurposeConfirmed":true}
```
Alias values above are not approved merchant facts. Unboarded template still returns HOLD. A one-time pilot does not assert that GiveHub recurring migration is complete; recurring remains separately blocked. Missing, mismatched, stale or malformed evidence yields no route plan. Success exposes only whitelisted nonsecret routing aliases.

## Validation and next package

30 new offline tests and 11 preserved PR59 assertions pass. Run `node --test tools/nmi/disabled-routing.test.mjs` and `node tools/nmi/mid-readiness.mjs --selftest`. The added CI step has not run remotely because this package is not pushed. Public build inputs, payment runtime, credentials, SQL and provider settings are unchanged.

Next: independently review this local planner; insert actual privately verified boarding evidence when available; reconcile into PR59 without importing PR34/Gate0 wholesale. Provider sandbox credentials, tokenization/charge/refund/webhook acceptance, four-MID legal review and a distinct payment activation approval remain required. This package cannot activate a payment even when all synthetic checks pass.

## Strict-boolean correction and independent review — November 1

Based on preserved fe20f735e9d7175eddc3211c6faf4644a1a0e0c1. The independent review found truthiness-based boarded_purpose_approved checks accepted strings, numbers and containers. The readiness evaluator now requires a boolean for every route's purpose approval; only exact true satisfies it, false holds it, and all other values (including missing) invalidate the whole document. Enabled-route checks and one-time pilot checks also require exact true. Existing eight global controls already distinguish invalid/nonboolean values from false and remain enforced. Four receipt confirmations now explicitly return INVALID_EVIDENCE_APPROVAL for nonbooleans, versus EVIDENCE_NOT_CONFIRMED for boolean false. Only true satisfies those confirmations.

Preserves the reviewed pilot scope: boolean false for GiveHub recurring inventory does not block an otherwise approved one-time pilot; it never authorizes recurring operations. Missing/nonboolean recurring approval is invalid even for a pilot. A boolean false on another disabled route does not approve that route or block a separately reviewed one-time pilot. Every result from prepareDisabledRoute still has canSubmit=false and mode=disabled; evaluate/evaluatePilot are offline classifiers, not payment executors.

The existing30 routing tests and11 original assertions remain byte-for-byte unchanged and pass. New strict-approval suite:238 cases pass across all5 routes,8 controls and4 receipt confirmations, with missing/null/empty/string/numeric/array/object inputs plus true/false positives. Before correction these tests produced108 failures (including invalid-versus-false receipt classification). An independently constructed fictional JSON/CLI/API matrix passes429 cases /2983 assertions, including130 real CLI invocations. No actual provider was contacted.

Small correction scope: two existing evaluator/planner files, one new regression file, existing CI command and this/state documentation. PR59 source/branch stays unchanged; this is a separate draft. Checkout, site allowlist, SQL and production configuration are untouched. Actual merchant identity, legal settlement ownership, independent evidence review and provider/payment release authorization remain required before any later activation; this offline change does not prove those facts.
