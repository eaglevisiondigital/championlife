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

The original 42 focused tests cover five routes/four slots, digest mutation, malformed approvals, stale/revoked evidence, duplicate and missing entries, cross-organization ownership, raw extra-field rejection and no-output leakage. Their accepted baseline was 664 lane Node tests and 11 readiness assertions.

## Disabled gateway composition — November 1 successor

`probeFourMidGateway` in the existing `disabled-executor-probe.mjs` connects this full boarding handoff to the existing one-time pilot review and pinned PR78 gateway/executor. Previously these checks accepted independent receipt inputs. The composition now clones one input snapshot, validates every slot/route receipt against the document digest, and derives the selected receipt from that same validated collection. It accepts no separate receipt, cached ready flag, source override, runtime configuration, secret or transport port.

The existing pilot contract still checks the exact merchant/fund/intent, current fictional finance authority and prior-attempt journal. UNKNOWN and other prior attempts cannot reach execution. A selected or unused merchant review that is expired/revoked blocks this optional full-boarding composition. The existing single-route pilot remains unchanged and does not acquire an all-four boarding prerequisite.

Successful fictional review reaches the actual hash-checked PR78 source at `b59e1afcbe2978d16e27883750ce20adb7d3a23d` through its existing loader. The executor and gateway retain their fixed disabled configurations; the gateway exercises create/execute/job rejection. Zero prepare/claim/job RPCs, credential reads or network calls are permitted. Every output remains `canSubmit=false`, `canRetry=false`, `canPostLedger=false`, `providerVerified=false`. A captured snapshot is only historical offline review evidence: it cannot authorize later execution, establish live revocation freshness or prove provider acceptance.

35 additional integration tests cover Main/Outreach success through the disabled gateway, stale digest, source/gateway drift, unused-slot expiry/revocation, selected receipt/pilot mismatch, malformed approval, UNKNOWN, caller configuration/source/receipt injection and snapshot isolation. Existing CI static-contract selection: **699 PASS**; readiness self-test: **11 PASS**. No SQL or runtime source changed. Native PostgreSQL was not restarted on the Mac because its environment remains blocked; prior exact-base CI evidence is retained, and the unchanged native CI jobs remain required for a published successor. New-head remote CI and independent review are pending.

Actual merchant evidence remains **0/4 independently provider-verified**. GiveHub, recurring, PR59, PR78 and hosted systems are unchanged. No browser validation, real provider acceptance, production installation or release approval is claimed.
