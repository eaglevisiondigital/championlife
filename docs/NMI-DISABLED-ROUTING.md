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
