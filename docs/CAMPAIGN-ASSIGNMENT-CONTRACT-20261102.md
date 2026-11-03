# Campaign/record assignment review contract — unmounted source only

This package consumes the exact PR80 foundation `5a675eff43a37f3fba2425b834b084b22bb1e281`. Its unchanged migration SHA256 is `c042c3fd96463c095b69d44bb390b40ea92172db841636c73e8f28833c357854`. No migration, permission writer, contact route or real assignment is added. Frozen PR61, existing registration authority and public build inputs are unchanged.

## Review request, never execution authority

`prepareAssignmentReview` accepts one exact JSON object. It validates canonical UUIDs, the accepted migration hash, a single organization/campaign/decision-registration/source/worker binding, finite ordered UTC dates, observed campaign and record revisions, five evidence/snapshot hashes, a bounded reason and distinct proposed worker/requester/reviewer identities. Requested decision capabilities must be `view` + `decisions.read`, optionally `followup.manage`. Contact, export, messaging, event-registration, People administration and financial capabilities cannot appear. Unknown or missing fields, malformed revisions, duplicate capabilities and self-review are rejected.

The output is always an **unverified assignment review request**, `executable=false`, `authority=unverified`. Valid syntax does not establish a verified worker, source mapping, consent, issuer authority, independent reviewer authority or owner approval. Evidence hashes are references to material still needing independent inspection; they are not trusted attestations. The module performs no lookup, database call, grant, SQL generation or mutation. It cannot turn a role label or a caller-supplied boolean into authority.

The deterministic request hash covers every accepted field. Capability/object order is canonical; any changed subject, scope, evidence, dates or revision produces a different hash requiring new review. A future authoritative request registry must reject a reused request ID with changed canonical bytes and bind reviewer approval to the complete immutable request hash. This package does not implement that registry. `reason=revoke` describes a requested review of withdrawal, not a revocation executor; submitted capabilities/dates remain review context and are never installed.

Observed revision `0` means the proposer asserts absence; actual PR80 follow-up records initialize at revision `1` and all existing rows require their current positive revision. It is not permission to overwrite or reset an existing row. Missing/null/negative/string revisions are rejected. No maximum grant duration policy is invented: finite ordered dates are necessary, and a separately approved duration policy remains a future issuer requirement.

## Exact future issuer prerequisites (not implemented)

A separately reviewed trusted issuer must establish all of the following from authoritative current server data, inside a transaction with the same compatible authorization locking used for revocation:

1. Confirm the current verified issuer/session and independent review authority from an approved campaign-specific administrator source. The foundation intentionally defines **no such issuer role**. Organization-wide People, registration, campaign-admin labels, Partner affiliation or possession of a database credential cannot substitute. Identify an authorized issuer and approve its exact narrow privileges before implementation/installation.
2. Re-read organization/campaign/source/registration binding. The only decision source here is `public.outreach_registrations`; event/waiver/check-in records are separate. `outreach_decision_campaign_sources` is one-to-one by campaign and source and has no revision column. Review its exact snapshot and lock the actual mapping plus registration/campaign rows. Reject changed/inactive/conflicting mappings; never silently redirect or infer a mapping from an email, name or event label. Absent mapping/assignment creation needs a serialized absence check or unique-key transaction, not a blind upsert.
3. Verify the worker's actual current Auth identity/session and exact finite campaign scope; compare observed campaign-assignment and record revisions after locks. Preserve existing nondecision capability keys, dates and unrelated campaign authority. Record reassignment must check the previous assignment snapshot and invalidate former ownership. Expiry, revocation and concurrent changes must serialize with authority checks. No unprotected second check alone.
4. Apply only the reviewed record-specific effect. No automatic Person creation/linking, account matching, learner credit, event/decision conversion or broad registration/finance grant. An existing verified People link remains a projection under the accepted foundation; this request cannot establish that link.
5. Write an immutable, accurate issuance audit atomically with the actual mutation and resulting revisions. Audit failure must roll back. Existing `outreach_decision_audit.action` only permits `followup.updated`: **it is not an administrative issuance audit**. A separate narrowly reviewed audit dependency or extension is required before any issuer exists. Record request digest, authoritative actor/reviewer, exact affected scope, before/after/revisions and outcome without contact, prayer, answers or source documents. Rejected requests must not create successful-grant audit events.
6. Recheck consent for permitted workflow changes. Existing ministry consent permits only the accepted workflow-state save; it is not email/SMS consent, adult verification or a contact route. Contact authority remains unavailable, including for an adult or a verified account. Do not import the paused adult/guardian package or enable contact/export/messages.

Identity evidence, source provenance, authority approval and audit/retention custody need independent review. No live identity or authority is asserted in this package. Source evidence itself may contain personal data: keep it private, minimize metadata, and apply the approved retention/access process rather than placing material in a public PR.

## Source-matched disposable integration

`campaign-foundation-test-host.mjs` reuses the existing Unix-socket-only `localPostgres` runner and `installCampaignBaseline`. It verifies and replays the accepted 27-file current-schema prerequisite, checks the exact PR80 migration hash and installs only into that disposable cluster. It accepts no database URL, provider credentials or hosted target. A loopback-only random-port HTTP endpoint exposes only the five accepted RPC actions and executes each request under the fictional user's `authenticated` role/current synthetic session. Unknown tokens and external browser origins are denied.

Opaque random fixture tokens map to fictional identities on the test server. They are **not genuine JWT verification or provider authentication evidence**. SQL authorization is real in the isolated PostgreSQL process. Fixture setup/methods are test-only owner operations and must never be mounted as a hosted service or promoted to an issuance path. The browser adapter routes its mocked Auth transport into this exact SQL endpoint and can hold/reorder responses outside the host. Test-host request logs contain only fictional IDs/payloads and distinguish attempted requests from committed SQL audit records.

`reset()` restores fixture access, source consent and ownership only. It deliberately preserves immutable audit rows, follow-up status and revision, so tests must reload the current record. Closing the fixture stops the loopback server and removes its local cluster. The host is outside the public allowlist and has no runtime mount.

Run:

```sh
node tools/outreach/campaign-assignment-contract.test.mjs
npm ci --ignore-scripts --prefix tools/backend-tests
TEST_POSTGRES_BIN="$(pg_config --bindir)" node tools/outreach/campaign-foundation-adapter.native.mjs
```

These focused tests add declaration-binding/malformed-input checks and exact HTTP-to-SQL consent, ownership, source, session and audit boundaries. They do not replace PR80's accepted broader native concurrency tests or genuine Auth/recovery acceptance. The independent reviewer and exact-head CI provide separate evidence. No hosted installation, staff activation, messaging, export, contact authority or production release is authorized.
