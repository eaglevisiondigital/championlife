# NMI durable source integration — disabled, local only

This successor uses the existing Giving ledger, sessions, requests, transaction legs,
refund approvals, recovery jobs and receipt outbox. It does not add a database schema,
public endpoint, credential binding, payment transport or checkout activation.
GiveHub and all website entry points remain unchanged.

## Exact source composition

`tools/nmi/durable-source-pin.json` identifies each file, Git commit and SHA-256.
The loader refuses missing objects, changed hashes and incomplete current-main inventory.
There is no network fallback in the loader. CI fetches only the two explicit commits.

- Current main: `bfb7af214707db73a3a3164bc96ccafae7de8ccf`, all 26 committed migrations,
  the existing disposable Auth fixture and automatic-RLS bootstrap.
- Reviewed NMI/Gate 0: `84b2d9ab398bb8046570019da26a5db67fe77467`, thirteen additional
  existing migration sources and two fictional fixture modules. These reconcile
  PR34 `4e463f792bf9a2af03345e8854433e2d00863729` and PR36
  `bbadd2b4adf75a4342b653d57c81fac8aa86e74a` without merging their branches.
- The existing seven-file executor/gateway pin still points to that corrected PR78.
  Its strict disabled-before-claim implementation is exercised directly.

This **39-migration source composition is not a production migration plan**, not
an assertion about the 30-entry provider ledger, and not the separately approved
27-migration current-schema acceptance baseline. Private production release SQL,
including the separately reviewed King Kind Storage release, is not reconstructed
or imported here. The native harness supplies minimal fictional Storage tables
solely to load committed security SQL; it cannot establish real Storage acceptance.
Read-only comparison against that 27-migration baseline found 25 exact byte matches,
one Bessemer file differing only by trailing newline, and its private King Kind
Storage release absent here. The committed 26-file inventory also contains the
reviewed operations-admin security migration. No baseline evidence was changed.
A later staged deployment must reconcile the actual provider baseline and ledger
against approved provenance. Never replay this local historical list into production.

## Executable integration

`createDurablePilotReviewer` takes authenticated server ports and selection IDs.
Inside a required read-only transaction it verifies stored confirmed identity and
`payments.configure`, then resolves the existing canonical payment route, incident
state, fund, MID, legal recipient, settlement proof, receipt owner and route revision.
It admits only explicitly fictional, independently reviewed one-time evidence.
Church authority does not confer SowGo authority. Soul Fuel must use the distinct
SowGo organization, SowGo legal merchant, SowGo settlement account and SowGo receipt
identity. A changed account, session, evidence record or expiry invalidates the result.

The result is a non-authoritative review snapshot, **never an execution capability**:
`canSubmit`, `canRetry`, `canPostLedger` and `providerVerified` are always false.
Real credentials, custody records and provider evidence are intentionally unsupported.
Trusted Auth, evidence and read-only transaction ports still require later reviewed
server composition; this file is not attached to a live handler or public browser.
Revocation is checked on each review; a returned historical review result cannot
activate a payment, and cannot replace execution-time provider/DB authorization.

## Local verification and invocation

```sh
node --test tools/nmi/*.test.mjs
node tools/nmi/mid-readiness.mjs --selftest
TEST_POSTGRES_BIN="$(pg_config --bindir)" node tools/nmi/durable-pilot.native.mjs
```

Native tests create a unique disposable Unix-socket PostgreSQL cluster; no TCP host,
password or remote URL is accepted. Only synthetic fixture identities are created.
The default-off actual gateway and executor issue zero RPC, credential or network
calls. Separate SQL-state-machine scenarios enable **fictional local form/control
rows only** to exercise existing durable transitions with manually supplied fictional
outcomes. No executable provider transport exists; public runtime enablement and
recurring instructions remain disabled. Every test run closes and removes its own
cluster. Failed runs are retained privately, not hidden as passing evidence.

Checks cover concurrent preparation/claims/handoff/completion, checkout replay and
conflict, unknown outcomes (lookup required, no recharge), authoritative original
state before refund, independent refund/void approval, webhook replay/conflict,
emergency shutdown, held receipt outbox, authorization isolation and immutable
ledger/history. These are real PostgreSQL checks with **simulated provider outcomes**,
not provider acceptance, genuine Auth testing or live money movement.

## Four-MID private boarding and release gate

Reuse `NMI-FOUR-MID-ONBOARDING-2026-11-02.md`; no duplicate boarding system.
For each of four approved MID aliases, the provider and designated custodians must
privately verify gateway/account ownership, legal recipient, tax entity, settlement
bank, processor mapping, allowed funds, receipt identity, purpose and environment.
Five business routes may map to four MIDs only with explicit approved mapping; never
infer a shared merchant or bank. Soul Fuel/SowGo Outreach cannot fall back to Church.
Do not place actual MIDs, bank documents, keys or contact details in this repository.

Still required: independent source/security review; full actual-provider baseline
reconciliation; private credentials and accepted independent recovery/custody;
provider sandbox acceptance (approved/declined/timeout/UNKNOWN lookup, duplicate
webhooks, refund/void and emergency stop); four legitimate merchant/settlement
proofs; then separately approved bounded one-time pilot. Recurring and replacement
of GiveHub remain outside this source-only package. No production migration,
transaction, deployment or staff grant is authorized by local PASS.
