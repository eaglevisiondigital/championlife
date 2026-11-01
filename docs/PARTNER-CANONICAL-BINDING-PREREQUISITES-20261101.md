# Partner canonical binding prerequisites and authority serialization

Source-only continuation of PR75 at `92f533d6ed89d116371d7c0cc3623dbd4aa3b1f1`. The private issuance and canonical adapter already exist and are preserved. This package adds real-schema denial/serialization acceptance; it does not install a repository provider or change runtime behavior.

## Why the canonical repository remains unwired

Inspection verified the exact existing pins against preserved source bytes:

| Dependency | Reviewed source | SHA256 |
| --- | --- | --- |
| B | `f06c5a2673e93fc93a2fdbf886aaf165cf468b18:tools/issue50/package-b-candidate.sql` | `03c3f6b94aadbe4195ecd9cea30463918687518d3c0ed5a630d3c7071d6c0020` |
| B1 | preserved `composed-review-only.sql` | `578fd9fa7eb6786eea79345039bc4eec0c11a2b779875759b770627eda727f6a` |
| B2 | preserved `composed-b2.sql` | `46d29ac81d565f17b34e41571d47c2b016fe1b2f54242bf8c632562e5b9d7754` |

The actual accepted Partner replay baseline lacks `private.city_identity_requests`, `private.city_identity_reviews` and `private.city_care_requests`. The new PGlite test verifies that absence in the replayed catalog. Installing those historical packages or adding a replacement registry would exceed this bounded authority test package. Source hashes prove file identity, not installed function provenance or acceptance of the complete combined stack.

The source contract is concrete:

| Identity dependency | Existing source contract and required reconciliation |
| --- | --- |
| Decision source | A reconciliation and B2 care writer join `outreach_registrations` to `outreach_campaign_sources`, require consent, hash `to_jsonb(source)` and lock the source row. The source-map row itself is not included in `FOR SHARE OF x`; a future read must protect the current source/campaign mapping too. |
| Registrant | `outreach_campaign_registrants` must match organization, campaign, legacy source and reviewed revision. Reconciliation writes it under `FOR UPDATE`. A non-null `person_id` is insufficient. |
| Review | B/B2 use `private.city_identity_reviews` keyed by campaign/source, current source hash and registrant revision, with linked outcome and review revision. Review writers use request/source advisory locks and `FOR UPDATE`; no equivalent store is introduced here. |
| Receipts and audit | The A identity request and B care request must agree on immutable request, actor and results, backed by both `decision.identity_reviewed` and `decision.review_completed` audit events. |
| Person/account | Canonical `organization_people` and active `portal_account_links` must match the verified source account. Existing A/B2 writers use account/Person permission predicates without locking every account/Auth dependency. The complete writer and account-replacement protocol still needs reconciliation before claiming transaction-wide current identity. |
| Current worker authority | Actor/session, campaign, explicit campaign grant, active Partner church, Partner grant, assigned worker and exact registrant association are already locked by the accepted metadata RPC. This package exercises those actual locks. |

The next identity implementation must reconcile the entire accepted A/B/B1/B2 and later correction inventory, verify installed function/schema fingerprints independently, and implement a current read transaction with a compatible lock order. No browser-supplied snapshot, stored receipt alone, guessed schema, email, tag, or null-to-Person fallback can satisfy that requirement.

## Implemented acceptance

`authority-fixture.mjs` replays the accepted migration order and existing Partner metadata migration in a disposable database, then creates fictional data using the existing tables. It introduces no schema, identity model or runtime API.

`authority-denials.pglite.mjs` verifies committed revocation of actor confirmation/ban, session, campaign grant, Partner grant/church, assigned worker and registrant association. It also proves that missing review provenance and changed subject/account state never upgrade metadata to a canonical Person. PGlite proves sequential SQL behavior only.

`authority-serialization.native.mjs` adds real independent PostgreSQL transaction checks. For each authority dependency it verifies read-before-write contention (`55P03`), committed revocation denial (`42501`), stale repeatable-read and serializable snapshots (`40001`), and write-before-read contention followed by denial. A campaign-row update separately proves that organization context is held through read commit. Lock-timeout errors are required; merely sleeping while an operation is unfinished is not accepted as proof of a lock.

Local result: 22 PGlite assertions and 255 existing Partner/shared-backend Node tests PASS. Native file syntax and diff checks PASS. Mac PostgreSQL was not launched and no IPC objects were touched. New native execution is pending independent review and Linux CI; it is not counted as passing. No browser/runtime changes require a new browser acceptance claim.

## Release boundary

No old or new migration, grants, API exposure, account creation, real staff access, public mount, hosted database, message, payment, deployment or merge. All current metadata remains null/unverified. Independent source review, exact-head Linux native CI, complete identity-stack provenance, genuine Auth/revocation acceptance and separately authorized release remain gates.

## Subsequent source candidate

The [unmounted canonical repository](PARTNER-CANONICAL-REPOSITORY-20261101.md) now exercises an exact selected Issue50 fixture and positive existing-row locking, using existing account/source uniqueness to prevent replacement. It does not install the historical stack or approve a runtime mount. The original current-baseline missing-schema observation and provider/release gates remain valid.
