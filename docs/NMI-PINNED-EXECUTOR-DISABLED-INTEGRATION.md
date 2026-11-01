# Existing gateway/executor integration: disconnected, source-only

This successor composes PR #73's reviewed fictional pilot contract with the actual PR #78 gateway and executor correction, descended from PR #34. It does not duplicate those implementations, register an endpoint, import migrations, configure a merchant, or enable checkout.

## Exact provenance and reconciliation

`tools/nmi/executor-source-pin.json` pins PR #78's gateway successor `84b2d9ab398bb8046570019da26a5db67fe77467`, its PR #34 base `4e463f792bf9a2af03345e8854433e2d00863729`, and the existing shared Gate 0 source PR #36 `bbadd2b4adf75a4342b653d57c81fac8aa86e74a`. Seven exact source files are SHA-256 verified before import. CI fetches only the exact reviewed commit. The loader uses Git's object database, validates an exact path allowlist, writes private temporary source and removes it after module loading. It has no network, credential, branch-tip or hash-mismatch fallback.

The original PR #73 source deliberately demonstrated PR #34's disabled `claim -> release` behavior. Those historical commits and evidence remain unchanged. The new guard rejects **before claim**. This successor updates the expected behavior to **zero RPCs**, rather than representing old results as tests of corrected source. No historical PR chain is merged.

## Closed integration

`probeDisabledExecutor` and `probeDisabledGateway` accept only the existing fictional review input. Merchant/MID alias, settlement, legal recipient, receipt owner, fund/purpose, one-time intent, scope, revision and independent finance review must pass first. Soul Fuel and SowGo Outreach remain under the SowGo legal recipient and SowGo settlement owner. No alias is mapped to real merchant details.

The gateway probe invokes the real corrected handler for `create`, `execute` and `job` with fixed `enabled=false`, `recoveryEnabled=false` and an explicitly fictional dedicated target. Every transport/secret callback throws. No request reaches authentication, preparation, job claim or provider IO. The executor probe likewise accepts only a held response, no automatic retry and zero RPCs. Callers cannot supply configuration, RPC, fetch, secret, token or enable overrides.

Prior accepted, rejected and UNKNOWN attempts never reach source execution. Concurrent duplicate probes remain isolated read-only fixtures. All outputs keep `canSubmit`, `canRetry`, `canPostLedger` and `providerVerified` false. This is not a deployable payment endpoint and cannot be replaced by a live database transport without separate reviewed integration.

## Gateway correction and recovery limitation

PR #78's new gateway enforces strict server booleans before any IO and again before `create`, `prepare` and `operation_job`. Recovery-only mode cannot claim an opaque job: its operation is unknown until after that durable claim. It must instead use the existing explicit recovery operation path. Existing status, shutdown, batch and reconciliation paths preserve their server authorization. A request already sent is not claimed to be canceled by a later configuration change.

Provider-independent tests execute actual gateway/executor code and the existing disposable SQL pipeline, including accepted/declined/UNKNOWN outcomes, lookup-only recovery, webhook replay, idempotency, ledger and receipt holds. Native concurrency uses separate local PostgreSQL backends. These checks do not establish genuine merchant/provider acceptance.

## Remaining controlled activation

All four real MIDs remain unverified. Private boarding must independently establish the legal merchant, settlement bank owner, purpose/descriptor and processor route for each alias; SowGo/Soul Fuel cannot use a Champion Life settlement identity. The reviewed onboarding checklist remains authoritative. GiveHub and its recurring schedules remain operational and unchanged.

Trusted finance identity, current routing evidence, existing durable operation authorization, genuine provider sandbox/recovery tests, credential custody, independent cleanup, maintenance and exact one-time pilot approval remain required before any execution can be armed. The blocked King Kind migration and unrelated staff/Outreach systems are not dependencies of this source test.
