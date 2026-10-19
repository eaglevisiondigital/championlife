# Giving ledger and financial history

`giving_sessions` record donor intention; `giving_session_lines` retain exact designations; `giving_transaction_legs` retain independently routed outcomes. Only captured/settled principal posts `giving_ledger` gifts, once per line. A failed leg never becomes a gift. Session status is pending/processing/completed/partially-completed/failed; partial failure does not silently refund successful legs or claim the intended total was received. Gateway/MID/provider transaction identity and callback event identities prevent duplicate posting.

Ledger amounts are signed integer minor units, each bounded to 1e12, in an explicit three-letter currency. Aggregate arithmetic uses PostgreSQL exact numeric/string results and JavaScript BigInt, not floating-point money. Session limits and per-leg sums prevent overflow. Provider/platform/donor-covered fees and net settlement are separate nullable leg metadata; immutable normalized provider event snapshots preserve their reported history. No rate, fee-free claim or unknown net value is fabricated.

## Manual and historical records

Cash/check/external ACH/other/external card-reference records require an open same-currency service/deposit batch, received time, fund and reviewed optional donor/household. Check/ACH/external records require a received-payment reference. ACH is a historical/manual record, **never a bank debit**. No PAN/CVV/bank credentials field exists. Anonymous presentation does not erase authorized internal donor identity. Input creation cannot grant portal/staff authority.

Import reuses that guarded entry path with source system + external transaction ID, historical date, fund/donor mapping and optional historical receipt reference. The unique source identity prevents repeat import; changed principal/date/currency/donor/household/fund/payment/receipt/attribution metadata under the same identity is rejected. GiveHub exports must be supplied, reviewed and mapped; no scraping, live modification or migration/cutover is performed. Historical receipt references are preserved, not newly issued claims about imported receipts.

## Corrections, refunds and voids

Posted records, session lines, audit, requests, statements, receipts, allocation history, provider events and batch membership are append-only. Adjustments append a signed reversal plus optional correction/reclassification linked to the original. Reason, actor and retained original are mandatory. An already-adjusted/allocated gift or reconciled batch requires explicit reviewed remediation; the API fails closed rather than rewriting allocation or reconciliation history. The initial correction UI offers full reversal; the guarded API supports amount/fund/person/household replacement. Reclassification preserves original settlement route: changing accounting designation never reroutes settled money.

Refund requests reserve partial/full principal against the originating leg. Trusted synthetic **sandbox-only** refund outcomes append negative ledger entries against original gift principal and unique immutable gateway refund references, with replay checks. They cannot erase prior gifts, refund twice, exceed unallocated/uncorrected principal or erase refund state on late settlement. Void is distinct, full and pre-posting; it records a voided authorization without a gift. Dispute state is an operational hook, not dispute-management or a guessed chargeback amount. No operation calls a provider. Actual provider eligibility/settlement rules are checked by a future verified adapter.

## Batches and reconciliation

Manual gifts have a batch when posted. Immutable `giving_batch_entries` link existing online ledger records into processor settlement batches without changing those records. A record belongs to at most one such batch. Reconciliation stores original ledger, settlement, deposit, signed difference, actor, time, notes and balanced/attention state, once per batch. Mismatches stay visible; no force-balance edits. Fees remain distinct metadata, so a legitimate gross/net difference must be explained by actual provider/deposit evidence during later operational reconciliation, not hidden by mutating gifts. Reconciled/attention batches reject late manual gifts and new membership.

## Receipts, statements and privacy

One held consolidated receipt per finalized session includes only successful gift lines, actual total, intended total/partial status, organization, donor, fund breakdown, tax language, receipt number/version, generated date, delivery state and email-reference hook. Individual legs remain available internally. Refund/adjustment ledger history is separate from the original receipt; reissue/correction delivery UX is gated later.

Annual/custom-range statements use tax-eligible ledger snapshots and include reversals/refunds in the selected range. Successive generations preserve immutable versioned records and exact currency; configurable tax language is not legal/tax advice. Future Communications Core delivery consumes those immutable versions through approved consent/sender/authority gates. GIV-1 never sends donor email/SMS.

Authorized finance donor history joins canonical gifts/adjustments/refunds, pledges, recurring, receipts and statements. The future donor read model requires separate reviewed financial ownership and exposes own records/payment descriptors only, never other donors, provider tokens, route metadata or internal notes. See [Core security and report contract](GIVING-CORE-GIV-1.md).
