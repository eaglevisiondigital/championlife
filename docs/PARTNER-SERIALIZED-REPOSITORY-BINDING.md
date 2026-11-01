# Partner server-derived association binding — source candidate

This source-only read adapter connects the narrow Partner projection to a trusted repository interface. It does not install a database adapter, table, RPC, grant, portal or second identity store. No network transport is present. Original P2 reader remains byte-identical. Partner uses the same verified principal as Church and Outreach.

## Inspected source, not assumed implementation

- `20261004055336_outreach_partner_intake_v1.sql`: canonical intake has `organization_id`, `person_id`, status and revision, but **no campaign association**. Its linked `person_id` is an organization-scoped Person, not a user ID. Financial intake fields must not enter this reader.
- `20260928172557_people_staff_v1.sql`: `organization_people.human_id` references `private.people`; `person_organization_relationships` and organization-person references are canonical. No copying or inferred name/email identity linkage.
- `20260926024742_household_records.sql`: explicit organization-scoped household membership; membership is neither adult verification nor guardian authority.
- Historical PR29 commit `350512a9401c6e783673af33f2f045d6ba04f62d`, `20261018133400_outreach_partner_audit_fix.sql`: existing draft partner-church workspace assigns campaign subjects and workers. It is **not** an installed general-intake campaign binding. No old migration or broad workspace imported.

A reviewed authoritative mapping from intake to campaign remains missing. This adapter models the required binding as an input contract from a future trusted repository. It never inserts or fabricates that association from a URL, category, email, tag or household.

## Executable API and trust boundary

`createSerializedPartnerReader({getPrincipal, repository, now}).read({organizationId, campaignId, intakeId}, {signal})` accepts exactly those three UUID selection fields. User/session/epoch derive from a server-verified principal, never the request. The repository receives the copied exact scope and derived principal.

`repository.withCurrentSnapshot(scope, synchronousCallback, {signal})` must:

1. Independently authenticate the same live session (including authoritative session retirement/revocation). JWT claims or cached role metadata alone are insufficient.
2. Serialize session, organization/campaign state, explicit worker assignment, canonical identity association, relationship and optional household membership dependencies with **all** update/revocation/replacement paths. Read all relevant rows in the same consistent transaction; no unconstrained select followed by a second unlocked permission check.
3. Supply only the exact selected intake and dependencies. Call the callback once while serialization is held; resolve only after transaction success. Throw on timeout/abort/serialization/audit failure; do not recover with cached snapshots. Returned repository values cannot forge an adapter result.
4. Normalize actual source columns into the contract described below. Null-ended canonical relationships need an explicit approved finite projection expiry. Do not manufacture active/verified evidence to satisfy this interface.

The adapter independently checks principal, active/current/expiry/revocation, exact scope, capability, assignment identity and revision, association UUID/revision and verification provenance, canonical Person/human anchor, organization relationship, linked intake and explicit household membership. It excludes global human IDs, verification/audit references, raw intake, contact, finances, tasks, pastoral notes and private lessons from its output. No lists or totals are generated.

The proposed normalized association has UUID, revision, current/conflicted/status flags, exact organization/campaign/intake, Person/human/relationship/optional household binding, `identityEvidenceId`, `reviewAuditId`, `verifiedBy`, `verifiedAt`, method `reviewed-canonical-binding`, finite effective/expiry and active/revoked state. **These are not claims that corresponding database columns or evidence already exist.** A later separately reviewed backend implementation must establish provenance, trusted verifier authority, immutable audit retention and compatible locking. Assignment references the exact current association UUID/revision and canonical subject; replacement invalidates it until explicitly reassigned. Association verification never grants worker permission or contact authority.

`authorityRevision` is a required positive provider coherence marker; it must change on any relevant dependency change, but a marker alone is not serialization. The adapter validates the current snapshot, not an earlier cached permit. Concurrent read-vs-revoke behavior is ordered by the repository transaction. If revocation commits first, no read may succeed; a read authorized and serialized first can finish before revocation. This source package does not establish that a real provider honors that contract.

## Response lifecycle

Each read invalidates prior pending reads. Synchronous `invalidate()` is required on logout, account/campaign changes, explicit denial and pagehide. Current principal and expiration are checked before and after the callback and repository completion; aborts and delayed completions fail closed. No retained state, browser storage, DOM, handler or write operation is installed. Previously delivered data cannot be erased remotely: eventual shell binding must clear protected DOM and invalidate retained references on revocation. The original reader's UI lifecycle tests remain relevant but do not substitute for provider authorization.

## Evidence and remaining gates

Run `node --test tools/partner-platform/*.test.mjs`. Tests use isolated fictional repository snapshots and promise scheduling. There is **no native SQL implementation to test in this slice**, and tests are not native RLS, genuine Auth or provider-locking proof.

Next implementation: review a canonical campaign/intake association storage/provenance design and implement a least-privilege provider transaction shared by read and all authority updates. Then native concurrency/RLS tests, shell invalidation integration, independently authorized provider authentication/revocation and cleanup acceptance. No finance RPC fallback; no import of historical broad permissions; no hosted change authorized by this package.
