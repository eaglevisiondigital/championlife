# NMI lane B — disconnected UNKNOWN lookup review

November 1, 2026. Local source/test slice based on PR #73 at `b90093621f6d38ff3454041e5e3b94caf0b44444`. **No actual MID or settlement evidence: 0/4 verified.**

## Confirmed source gap and reuse boundary

The current `tools/nmi/` lane already tests exact booleans, four-MID/five-route mapping, disabled checkout, merchant receipts, independent review and expiration. It does not contain an isolated duplicate/UNKNOWN lookup evidence contract bound to the new reviewed merchant aliases. This slice adds that disconnected test boundary without rebuilding its route planner.

The historical PR #34 source at `4e463f792bf9a2af03345e8854433e2d00863729` was inspected at `supabase/functions/_shared/payments/nmi-query.mjs`, `nmi-executor.mjs` and `tools/backend-tests/nmi-query.test.mjs`. It already has a provider-query/executor architecture and a rule that empty/ambiguous query results remain unknown, with read-only recovery rather than repeating mutations. None of those runtime files, migrations or provider clients are imported or changed here. This reducer is not a replacement provider implementation or a second payment ledger.

## New local behavior

`reviewFictionalLookup(attempt, observations, now)` accepts only explicit fictional, nonsecret fixtures. It recognizes a structurally consistent fictional accepted or rejected result for review, but every output remains:

- `mode: disabled`
- `canSubmit: false`
- `canRetry: false`
- `canPostLedger: false`
- `providerVerified: false`

It requires exact attempt/order/organization/MID-alias/gateway-alias/amount/currency/binding-revision equality. USD and positive safe-integer minor units are a bounded test contract, not a provider capability claim. It rejects non-boolean authority, missing or extra fields, invalid times and raw-provider payloads. Evidence must start after the recorded uncertainty, complete no later than the supplied review clock, and remain within its explicit fixture validity window.

An empty lookup does not prove that money did not move. Unknown observations, stale receipts, different transaction IDs, mixed accepted/rejected results, changed replay IDs and cross-merchant references all remain UNKNOWN. Identical observations are idempotent regardless of JSON key order. Duplicate suppression is limited to one supplied evidence set. The reducer has no persistent state, durable journal, distributed lock, retry scheduling or authority to settle/retry/post anything.

No caller can convert a passing fixture into real provider proof through this interface: output always explicitly says providerVerified=false. The `fictional` flag and `authoritative` field are test assertions, not signatures, verified credentials or trusted evidence. Source references, reviewed clocks and binding revisions still require a trusted production adapter and durable store in a separately reviewed future integration; this module must not be registered as a payment service or public endpoint.

## Validation

Run:

```
node tools/nmi/mid-readiness.mjs --selftest
node --test tools/nmi/disabled-routing.test.mjs tools/nmi/strict-approval.test.mjs tools/nmi/merchant-boundary.review.test.mjs tools/nmi/fictional-lookup-review.test.mjs
```

The new 57-case suite covers accepted/rejected/unknown/delayed outcomes, replay ordering, exact scope mismatches, stale binding revisions, malformed fields, timestamp freshness, immutable input, bounded fixtures and non-activation outputs. Existing 30 routing, 238 strict-boolean, 8 merchant-boundary tests and 11 original selftest assertions remain unchanged. The dedicated workflow includes the new suite; remote CI is not claimed for this local-only commit.

## Remaining boundary

Independent source review is required before any update to the existing draft lane. No push, production build input, SQL, environment, user grant, provider call, financial message or hosted resource is part of this package. No authentic webhook, settlement, refund/void or recurring lifecycle is tested here.

Real four-MID boarding must separately establish legal merchant, provider permission, settlement ownership, receipt issuer and transaction purpose using private evidence. Soul Fuel remains SowGo Outreach, legally boarded and settled to SowGo. GiveHub and recurring remain held and unchanged. A forecast for November 2–3 is not verified boarding. Existing provider acceptance, finance-owner review and explicit activation gates remain mandatory.
