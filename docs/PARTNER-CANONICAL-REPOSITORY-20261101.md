# Partner canonical repository candidate

Source-only successor to `5232db6b1afaf830a9f4251d539d142a71f0871e`. The existing canonical identity adapter now has an **unmounted server-only database repository**. The website and metadata RPC still return null/unverified; no migration, role, connection, endpoint or public mount is installed.

## Accepted source reuse

The disposable fixture selects only the necessary Issue50 definitions from Package B (`f06c5a2673e93fc93a2fdbf886aaf165cf468b18`), preserved B1 composition (`578fd9fa7eb6786eea79345039bc4eec0c11a2b779875759b770627eda727f6a`) and B2 (`53adb74df0b02c77784e5f00f2fb6b5a64e84baa`, composition `46d29ac81d565f17b34e41571d47c2b016fe1b2f54242bf8c632562e5b9d7754`). Section hashes and original source hashes are recorded in `fixtures/issue50-identity-source.json`. No historical branch chain or seed data is imported. Original sections and execute boundaries remain unchanged.

The fixture calls the actual accepted `private.city_care_workspace(...,'identity_save',...)`. This generates the identity request, care request, review and two immutable audits through A/B2 reconciliation. Tests never construct these proofs by inserting invented receipt rows. The canonical People and portal account tables are the existing shared tables.

## Read and authority lifetime

The repository accepts only organization/campaign/assignment and the trusted principal's user/session UUIDs. It calls the exact accepted Partner metadata function before obtaining its canonical snapshot. Source and campaign map, registrant, current review, matching immutable receipts/audits, canonical Person/human, exact active account link, actor/subject Auth, session, and campaign/Partner/worker assignments are held `FOR SHARE` until the synchronous adapter projection and commit complete. Missing or ambiguous rows deny. The adapter still independently checks all state, revision, audit and account bindings and discards a result if current principal/generation/expiry changed.

Positive eligibility always requires an existing exact row. `portal_account_links` has unique organization/Person and organization/user constraints; the source map has a source primary key. Consequently replacement requires changing/deleting a locked row or conflicts with its existing unique key. No table-wide locks or new writer advisory-lock protocol is introduced. Independent rows remain writable. Deadlocks, lock/statement timeouts and query failures deny; no retry converts an uncertain result into verified identity.

The trusted host must supply an **exclusive idle connection**. The repository owns BEGIN/COMMIT/ROLLBACK, fixed search path and transaction-local identity settings. It must never receive a connection already inside a caller transaction. Failed operations discard the connection; no pool/role or runtime credential binding is provided here. A later host needs a separately reviewed least-privilege execution design; this candidate does not authorize broad private-table access.

## Provenance and limitations

The server-owned manifest pins 23 function source/security/search-path/language/owner/effective-execute contracts and 17 relation column/constraint/index/trigger/RLS/policy/owner/table-and-column ACL contracts. Checks run before and after the row read. This includes unique-key validity and immutable audit trigger attachment, plus attached trigger functions and named private helpers. Runtime callers cannot supply fingerprint booleans or snapshots.

**The Auth table fingerprints intentionally describe the disposable test schema.** They are not represented as genuine provider schema acceptance. A real provider shape, missing Issue50 installation or changed contract fails closed. The manifest must not be relaxed or regenerated from a target just to obtain a PASS. Complete approved identity-stack reconciliation and independently reviewed actual provider catalog are still prerequisites to any mount.

Normal application writers cannot alter schema/functions. Database owners and maintenance DDL remain a trusted administrative boundary; start/end fingerprints do not defend against a hostile owner changing and restoring function definitions between checks, nor do current fingerprints retrospectively attest every historical writer installation. No such threat is represented as solved.

## Validation and gates

Local result: **322 Partner/shared-backend Node tests PASS**, including 64 canonical repository tests; syntax and diff checks PASS. PGlite covers accepted-writer positive integration, baseline missing-schema denial, source-map/content/account/consent/revision and authority changes, every pinned function, table ACLs, column ACL drift, unique-key removal, immutable trigger drift, callback failure and minimized snapshot output. UUID input rejects trailing newlines.

`canonical-repository.native.mjs` adds independent native read-before-write and write-before-read checks, account and source-map delete/reinsert blocking, receipt/audit row locks and unrelated account/campaign writes. Native execution is **pending Linux CI**; the Mac PostgreSQL server was not started and IPC settings were not changed. PGlite is sequential SQL evidence, not contention proof. CI adds the native suite to the existing Partner workflow.

No browser/public runtime changed. No real-provider, hosted or production acceptance is claimed. No source push, merge, deploy, accounts/grants, messages, payments or historical seal changes are part of authoring. Next: independent exact-diff review and native CI, then the separately scoped real identity-stack/provider and least-privilege host reconciliation. The frozen schema-free PR61 remains independent.
