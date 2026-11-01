# Four-MID private evidence handoff — source only

This adds `prepareFourMidHandoff` to the existing disabled routing evaluator. It validates exactly four merchant-slot reviews and five existing logical routes, binds reviews to a canonical digest of the current alias-only boarding document, and rejects stale, duplicate, revoked, contradictory or malformed records. Every route must remain disabled. It calls the accepted `prepareDisabledRoute`; it does not replace the planner or executor.

All results have `canSubmit=false` and `providerVerified=false`. `readyForPrivateReview` means the supplied alias records are internally consistent, not that signed merchant documents are authentic, provider credentials work, or money may move. No runtime imports this handoff as an authorization service. There is no transport, credential lookup, tokenization, persistence, activation or secret output.

Legal merchant, settlement-owner and receipt-owner aliases cannot cross organizational boundaries. Soul Fuel continues to use Outreach under SowGo's independently verified merchant and bank. Five purpose routes do not imply five merchant accounts. Sharing one gateway requires the existing exact MID binding and separate token/vault portability evidence. A changed document requires fresh independent review; a hash is an integrity binding, not a signature or external source verification.

## Private boarding procedure

1. The authorized owner/ISO supplies documents and credential material directly through the approved private custody channel. Never put MID, bank, EIN, passwords, contract scans or real account identifiers in source, tests, issues or this tool's inputs.
2. Finance verifier checks provider contract, legal recipient, authorized purpose and descriptor, settlement-bank ownership, receipt issuer, currency/payment features, gateway/MID topology and authorized signer. A distinct reviewer checks that evidence. Record secure evidence references, timestamps, expiry and correction/revocation history privately.
3. Create the existing alias-only document and its digest after the route mapping is reviewed. Each of the four slot reviews binds that digest, the independent reviewers and the legal/settlement/receipt aliases. The five route receipts must match those same reviews. No route can borrow a receipt from another MID or legal owner.
4. Evaluate locally. Any unknown fact remains PENDING/HOLD. Original template remains 0/4 verified. Explicitly record which provider facts are still missing; do not mark a forecast as boarded.
5. Independently review an exact, bounded one-time provider pilot separately: route/fund/merchant/amount, hosted tokenization, durable claim, authenticated callback/query, unknown outcomes, ledger and settlement evidence, incident stop and custody. New-charge and recurring activation stay off. GiveHub remains operational.

This all-four handoff does not change the existing ability to prepare a narrowly authorized one-route pilot while unused routes remain held. Provider acceptance, merchant authenticity and production-ledger parity still need actual evidence. No new finance policy is inferred by validation.

## Validation

42 new focused tests cover five routes/four slots, digest mutation, malformed approvals, stale/revoked evidence, duplicate and missing entries, cross-organization ownership, raw extra-field rejection and no-output leakage. Full lane Node suite:664 PASS; existing readiness self-test:11 PASS. SQL/executor/public runtime are unchanged; prior accepted native evidence is reused and CI retains its native jobs. No provider contacted.
