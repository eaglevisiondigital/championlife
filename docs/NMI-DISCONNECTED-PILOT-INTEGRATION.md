# Disconnected one-time NMI pilot review

November 1, 2026. Source-only successor to PR #73 `5ceb91fbf9cbf35d9011b4411696cf4d956024ad`. **0/4 actual merchant accounts verified. Checkout remains disabled.**

## Implemented boundary

`tools/nmi/fictional-pilot-review.mjs` composes the existing disabled route planner and fictional UNKNOWN lookup reducer. It does not import the historical NMI executor, create another ledger, change GiveHub, or add any public runtime, SQL or provider endpoint.

The review requires one exact route/fund/pilot/revision/organization/MID-alias/gateway binding; the current independently reviewed legal merchant, settlement owner and receipt issuer aliases; and an explicitly fictional, verified finance-review principal scoped to that same pilot, organization and binding revision. Every checkout route must remain disabled. All approvals remain exact JSON booleans. Revoked/expired/future evidence or finance authority blocks the review.

One-time intent binds its idempotency/order references, USD positive integer amount and the same route/fund/pilot revision. Recurring, refunds and voids remain separate workflows. Soul Fuel is an Outreach purpose under SowGo's independently boarded merchant and bank; changing it to Church routing, swapping only one side of the legal/settlement/gateway evidence, or reusing a stale intent holds the review.

A supplied fictional attempt journal is checked before review: identical duplicates collapse within the evidence set; changed replay content, different order/idempotency/merchant/amount/revision, or multiple attempts hold it. Once an attempt exists, lookup evidence is evaluated by the accepted reducer. Missing, delayed, expired or contradictory observations stay UNKNOWN. Even an explicitly rejected fictional attempt does not authorize another attempt. Accepted/rejected conclusions are historical review classifications, not execution instructions.

Every output is immutable and includes `mode: disabled`, `canSubmit: false`, `canRetry: false`, `canPostLedger: false`, and `providerVerified: false`. No customer, merchant credential or raw provider data is returned.

## Trust and persistence limits

This function is a deterministic fixture evaluator. Caller-supplied aliases, `fictional`, `verified`, receipt booleans and lookup claims are not signatures or genuine provider proof. It cannot establish that an alias is the real SowGo bank. It cannot detect an omitted journal entry or enforce locking across processes. An empty supplied journal means only that the fictional plan can be reviewed; it never means payment is safe to send.

Production integration must obtain authority, clock, versioned merchant binding and complete attempt history from trusted server-side sources, enforce durable idempotency and locking before any I/O, retain audit/UNKNOWN recovery evidence, independently query the correct provider, and serialize emergency disable/revocation against dispatch. Do not mount this review function as a payment service, webhook consumer, ledger writer or activation gate. Existing PR #34 provider/runtime work stays separate and disabled; its full current-main/Gate 0 adoption is not completed by this composition.

## Confidential boarding handoff

Use a private owner-controlled store, not a GitHub issue, commit, log or chat. Four rows correspond to `MID-01` through `MID-04`; the five logical routes are a separate mapping. Required evidence reference categories:

1. Provider/ISO-confirmed processing MID and gateway relationship, permitted currency and transaction types, sandbox/live separation, emergency support contact and disable procedure.
2. Legal merchant, signer and receipt issuer; bank settlement ownership; signed fund/purpose mapping. Church and SowGo require their own proven recipient/settlement mapping. Soul Fuel must never be pooled into a Church account because its name resembles an outreach fund.
3. Authorized finance reviewer and separate checker; verified-at, expiry, revocation/correction history and binding revision. A changed bank, legal merchant, gateway or purpose invalidates old review evidence and pending intents.
4. Provider-hosted tokenization, webhook verification/duplicate behavior, authoritative query consistency and UNKNOWN reconciliation, refund/void permissions, statement settlement and receipt evidence, each marked PENDING until genuinely tested.
5. One exact merchant/route/fund and bounded one-time test scope; safe new-charge disable; custody, recovery operator and cleanup evidence; separately reviewed live pilot approval. No broad four-account activation.
6. GiveHub recurring inventory, consent and token/vault portability statement. Leave GiveHub and recurring operating as they do now; no inferred portability or silent migration.

Keep real MID/bank/EIN numbers, statements, contracts and credentials only in that private store. Public source may contain safe aliases, placeholder references and verification status. This sprint provides a private **blank** handoff checklist, not newly verified merchant evidence.

## Validation and remaining work

The new suite has 170 fictional cases. Run `node --test tools/nmi/*.test.mjs` plus `node tools/nmi/mid-readiness.mjs --selftest`. Existing strict approvals, routing and lookup tests remain unchanged. Tests cover both organizations, Soul Fuel/Church mismatch, authority expiry/revocation, stale binding revisions, duplicate/reordered/conflicting history, malformed approvals, unknown provider outcomes, input immutability and all output permissions staying false.

Remaining: independent source review; exact-head CI; current-main/Gate 0 runtime reconciliation; secure real four-account custody; genuine tokenization/query/webhook/ledger/refund/recovery/settlement acceptance; finance-owner one-time pilot authorization; separate recurring proof and approval. No hosted execution, money movement or release readiness is claimed by a fixture PASS.
