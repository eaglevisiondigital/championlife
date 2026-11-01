# NMI disabled-executor preclaim correction — source only

November 1, 2026. Separate draft branch `codex/nmi-preclaim-disabled-guard-review-20261101` based on the **frozen** NMI Giving candidate PR #34 at `4e463f792bf9a2af03345e8854433e2d00863729`. PR #34 and the source-only pilot review PR #73 are deliberately unchanged.

## Why

The original `executeNmiGiving` invokes the durable `claim` RPC before determining whether the configuration is disabled. It can then `release` the claim after rejecting credentials. This means a disabled checkout may unnecessarily acquire and mutate an operation lease, even when no payment is sent.

## Narrow change

Before `rpc('claim',...)`, reject to `{status:'held',retry_automatically:false}` unless `config.enabled === true` or a **separately dedicated, project-pinned recovery path** has `recoveryEnabled === true` and passes the existing `dedicatedAcceptance` predicate. The already-existing after-claim per-operation recovery restriction is retained. Missing, false, string `'true'`, and non-dedicated recovery states fail closed before ANY RPC. This change does not enable any NMI route, sandbox provider request, recurring transaction or merchant account.

Tests exercise nine inactive/malformed/unapproved configurations, no claim/release/provider/secret activity, legitimate pinned-recovery preservation with fictional claim/release and deliberately missing secret, unclaimed recovery pending, and an injected-claim denial. Tests use no database, network, actual merchant details or credentials. A green source fixture does NOT prove real SQL lease behavior or hosted recovery.

## Important dependent integration

Existing disconnected PR #73 intentionally pinned the **old** PR #34 source and tested the old `claim→release` behavior when disabled. Once this correction is independently reviewed, the integrator must update **PR #73's source pin**, hash manifest and test expectations in a separate isolated successor. Never silently switch its imported source or misrepresent the old fixture as testing this new guard.

Before a real release, review gateway `operation_job` behavior and outer `prepare` / `operation_job` writes when disabled: those callers may still mutate durable state **before entering** `executeNmiGiving`. A truly disabled live endpoint must prevent those operations as well, with SQL/provider negative tests. Existing protected release gates for legal merchant, NMI four-MID boarding/settlement, genuine Auth, cleanup and recovery, real sandbox provider proof and exact owner GO remain.

No merges, production deploys/migrations, actual claims, payments, SMS, email or staff grants authorized.
