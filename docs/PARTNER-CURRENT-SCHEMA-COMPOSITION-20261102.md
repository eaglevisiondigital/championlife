# Partner current-schema composition — test-only, no host activation

Source base: PR75 `3cf0a144c357c5294972e23beada68910a61efef`. This continuation adds a working disposable composition of the six missing Issue50 relations and their accepted private writer dependencies. It does not install a migration, publish a host, provide a login credential, or authorize a Person response. The unchanged canonical repository deliberately returns `personId=null`, `identityStatus=unverified` against this narrower privilege profile.

## Exact baseline and migration plan

The previous Partner fixture replayed 26 checkout migrations plus the existing Partner metadata candidate. The independently reviewed October 31 current-schema baseline contains **27 persistent application SQL sources**: those same 26 SQL contents (three historical applied-version aliases) plus the already-released King Kind private reader. Its three retired temporary installers remain excluded; production's original 30-entry ledger is unchanged.

The new `current-schema-source-fixture.mjs` adds the exact existing `supabase/release/king-kind-reader-private-storage-candidate.sql` (`aac5ec4ee74a8b59b8b8bb1bd5ec1f4254fd6f0585fcc2fe1f63942c8dce4fb1`) using explicitly fictional Storage prerequisites. Auth remains the existing fictional platform fixture. The separate Partner metadata candidate is still an additional test dependency, not part of those 27 production source records. A read-only local comparison found 26 byte-identical source hashes. The Bessemer registration SQL differs only by one checkout trailing newline absent from the accepted archive (checkout `9919250f…`, archive `9bb2d910…`); its outer-whitespace-trimmed hash matches. Historical SQL was not rewritten. No live catalog query was made.

This is **source reconciliation**, not an assertion that the synthetic Auth/Storage catalog, defaults or role ownership equal production. The new preflight rejects the old 26-only fixture. No platform stand-in belongs in a hosted migration.

The executable test-only installation order is:

1. Existing fictional Auth, automatic-RLS bootstrap, unchanged 26 current checkout migrations, and existing Partner metadata boundary.
2. Fictional Storage prerequisites and exact already-released King Kind reader SQL. No PDF or real data is copied.
3. Begin one transaction; verify the committed selected catalog baseline; install the bounded composition; check preservation and exact permitted assignment shape; commit. Any drift, partial installation, repeat attempt or postcondition failure rolls back.
4. Generate fictional review/receipt/audit data through the original accepted writer using the disposable owner. A fictional administrator, existing Person/account link and explicit campaign/record assignments are test data, never an installation grant.
5. Install the unchanged NOLOGIN envelope only in the native/isolated tests. Its original caller restrictions and runtime provenance verification remain intact.

There is no `supabase/migrations/` addition. A future installable package must be separately reconciled to an authorized target and created through the supported CLI; this module is not a migration runner. Historical B1/B2 SQL and their guards remain unchanged and still fail closed on this 27-source test baseline: B1 `P0001` (unreviewed capability boundary), B2 `42P01` (missing follow-up dependency), with rollback.

## Included dependencies and grant disposition

The composer verifies the sealed selected-source SHA256 `b1785df783554eb27a9160a941c2599f4e9ec515839f4857d8deebb3fdb0f4e3` before reading any SQL. It preserves all selected function bodies and constraints. It omits exactly the two authenticated EXECUTE statements, then explicitly closes application access on every new relation, function and sequence. It never executes those grants even transiently.

| Objects | Reason included | Resulting application access |
| --- | --- | --- |
| `outreach_campaign_sources` | Exact source-to-campaign provenance | RLS; no PUBLIC/anon/authenticated/service_role table privileges |
| `outreach_campaign_followups`, `city_followup_events` | Existing care writer row types, assigned visibility and immutable event dependency | Same denial; sequence access revoked; no care endpoint |
| `city_identity_requests`, `city_identity_reviews`, `city_care_requests` | Original identity/review/idempotency receipts | Same denial; original immutable request triggers retained |
| `city_decision_project`, `city_decision_reconcile_a`, `city_decision_reconcile` | Original source projection and independently reviewed canonical Person linkage | No application EXECUTE |
| `city_roster_can`, `city_identity_admin` | Original verified campaign and independent reviewer checks | No application EXECUTE |
| `city_followup_assignee`, `city_care_assigned`, `city_source_visible` | Original assigned-care helper dependencies | No application EXECUTE |
| `city_care_workspace` | Exact accepted atomic identity receipt/review writer, including its original care branches | No application EXECUTE; original body retained, not exposed |
| `city_decision_ingress` | Original selected helper definition | No application EXECUTE and no new source-ingress trigger installed |

The historical public `city_decision_roster`, `city_decision_reconcile` and `city_care_workspace` wrappers are **not installed**. The historical roster reader body and its grants are excluded. The already-present operations security functions, existing public wrappers, existing table/column ACLs, policies, role properties/memberships and schema ACLs are preserved; the old operations migration is not reapplied. No user, staff permission, Partner assignment, service credential or role membership is created by the composer.

The accepted selected SQL also changes `outreach_campaign_assignments`: it adds `care_scope` (default `campaign`, restricted to `campaign`/`assigned`), the assigned-scope capability check, and the accepted expanded capability constraint. This is explicitly more than six table definitions. The complete resulting assignment catalog is independently pinned as the only allowed existing relation-shape change. Current public registration access administration still permits only its four registration capability keys: tests deny decisions/follow-up/contact/communications/staff/discipleship/legacy team/travel keys, deny direct authenticated assignment writes, and show injected `care_scope` cannot widen an assigned record. Original service_role assignment DML already exists and is retained; a trusted owner/service role can populate the expanded vocabulary. Therefore this test-only composition must not be called an approved production permission installation. No relationship label or tag becomes authority.

## Preserved fail-closed runtime contract

The original canonical manifest requires authenticated EXECUTE on `private.city_decision_reconcile(uuid,jsonb)` and `private.city_care_workspace(uuid,text,jsonb)`. The new composition intentionally withholds both. On PostgreSQL 18 PGlite, the exact existing catalog diagnostic finds **only these two privilege differences**; all original pinned definitions and relation contracts agree. The repository refuses the result. Neither original manifest nor verifier has been edited, and no alternate success path/profile was introduced.

A future continuation should independently design a stricter provenance profile for the selected host and minimally required private execution surface. Restoring historical broad grants merely to satisfy old pins is not the recommended remedy. This package makes that concrete dependency visible without deciding a new host or granting permission.

The new guard covers selected application/Auth/Storage functions, relation shapes/ACLs/RLS/policies/indexes/triggers, defaults, the five namespace ACLs, and four existing role properties/memberships. It excludes PostgreSQL-18 standalone NOT NULL constraint rows because it already records every column's nullability; this affects only the new test preflight. **The original runtime PG18 catalog pins are untouched.** This is not a complete hosted-platform catalog attestation or protection from trusted DDL owners.

## Host and authority still missing

Current repository inspection identifies no approved existing authenticated Partner server ingress or restricted login credential. The existing public submission Edge Functions hold unrelated service authority; browser `getUser()`/cached sessions do not mint a trusted database principal. The existing canonical pg binding accepts only a disposable socket and owner SET ROLE mechanics. The current NOLOGIN envelope rejects login, membership and broader privileges by design.

The missing source contract belongs to the project architecture/security owner and host operator: identify the existing deployment target, exact trusted server token/session validation, restricted credential custody and membership design, and independently reviewed real Auth catalog. No secret should enter chat or Git. No owner decision to restore the omitted grants is requested. Until an authorized contract exists, no public mount, real login/NOLOGIN binding, actual staff grant or provider acceptance is claimed.

## Validation

- 399 focused Partner/shared-backend Node tests PASS, including **23 new composition tests**. Coverage includes the accepted writer, only-two-grant discrepancy, RLS/ACL denial, public admin scope, exact existing objects, baseline drift and atomic rollback after interruption/shape/function mutation.
- Existing 22 authority denial checks PASS.
- 27 accepted persistent sources reconciled: 26 byte-identical and one trailing-newline-only difference explicitly recorded; original full-composition reconstruction and compatibility/rollback probe: 16 assertions PASS.
- **12 native PostgreSQL 17.11 checks PASS** on disposable Unix sockets: actual accepted receipt join, account/review/source/receipt/assignment lock contention, unrelated campaign concurrency, committed Partner revocation, actual blocked-query cancellation/rollback, and unchanged repository denial. Direct fixed-routine calls in this suite test mechanics only and never replace the failing runtime verifier.
- Independent source review reports no blocking findings; 48 additional adversarial checks and an independent rerun of the 23-test composition suite PASS. The review also corrected source attribution for the one trailing-newline difference before commit.
- Existing canonical PG18 native acceptance remains unchanged. CI now also runs this new native composition suite under PG18; exact-head CI execution and independent review status must be recorded separately, not inferred from the local run.

Private raw source reconciliation, baseline catalog, historical replay probe and test logs remain outside the repository/public artifact under `audit/integration-continuation-2026-11-02/partner/`. No hosted SQL, resources, deployment, messages, payments, source pin rewrite or production data access occurred. PR61, PR57, NMI, People ownership and learner/financial/child-data boundaries remain held and unchanged.
