# Existing executor integration: disconnected, source-only

This package composes PR #73's reviewed fictional pilot contract with the **actual** PR #34 `executeNmiGiving` function. It does not duplicate that executor, register an endpoint, import PR #34's migrations, or enable checkout. No public build path changes.

## Exact provenance

PR #34 was freshly resolved on November 1 to `4e463f792bf9a2af03345e8854433e2d00863729`. The previous local remote-tracking ref was stale. `tools/nmi/executor-source-pin.json` records the five exact source paths and SHA-256 values needed by the executor. The Node-only loader reads that commit from the Git object database, verifies every byte before importing, and removes its private temporary files after loading. CI fetches only that pinned commit; the loader has no fetch behavior or branch-tip fallback. Missing source or altered bytes fail closed.

## Implemented composition

`probeDisabledExecutor` accepts only the existing fictional review input. Merchant/MID alias, settlement owner, legal recipient, receipt, purpose, fund, one-time intent, scope, revision and independent finance review must pass the existing contract first. Soul Fuel remains SowGo; no aliases are mapped to real merchant IDs.

A reviewable plan invokes the unchanged executor with a closed, in-memory claim/release RPC, no payment token, `enabled=false`, `recoveryEnabled=false`, no project pin, and transports that throw. The only accepted result is **held**, no automatic retry, and exactly `claim → release`. Handoff, completion, secrets and network access are forbidden. There is no caller-supplied executor, configuration, RPC or transport override. Caller input is snapshotted before awaiting source loading.

The exact executor's existing claim-before-credential-check order is intentionally tested against fictional state only. **Do not replace the closed RPC with a database service:** even a disabled executor can claim/release an existing operation. This package cannot be used as a runtime payment endpoint.

Prior accepted, rejected or UNKNOWN attempts never reach the executor. They remain review-only with `canRetry=false` and `canPostLedger=false`. Concurrent duplicate probes create only isolated fictional calls, not durable operations, and are not evidence of database idempotency or provider recovery. Existing executor SQL remains authoritative in a future separately reviewed runtime integration.

## Tests and next boundary

The targeted suite imports the verified existing executor and exercises its default-disabled sale, authorize, capture, transaction lookup, refund, void, recurring-create/cancel/pause and unclaimed branches with closed fixtures. It also checks cross-merchant/fund/organization mismatch, malformed or injected execution configuration, prior uncertain outcomes, duplicate concurrent probes and unchanged input.

This is **local disconnected source evidence**, not provider acceptance. All four real MIDs remain unverified. A future runtime composition must bind the trusted finance identity, current merchant/settlement evidence and durable existing operation to the same authoritative scope, preserve compatible handoff/claim locking and cancellation/recovery, and pass separately authorized genuine provider tests before any source can be enabled. Actual merchant boarding, custody, independent recovery and one-time pilot approval remain required. GiveHub, its recurring schedules, PR #59, public checkout and production remain unchanged.
