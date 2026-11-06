# Partner canonical host execution prerequisite

Source-only successor to `fa183e2ade21d4e92b9c6cc993d98f023e1495cd`, PR75. No production/hosted change, migration, login role, connection secret, membership grant, website mount or public endpoint is included.

## Implemented boundary

`tools/partner-platform/canonical-host-envelope.sql` is a source installation contract used only by disposable fixtures. It creates one `NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS` caller role with no members and one function in a dedicated unexposed schema. The caller receives schema USAGE for catalog-name resolution and EXECUTE on that one function. It receives no direct table, column or sequence privilege, schema CREATE permission or execution of another application security-definer function.

The routine is owned by the existing trusted `postgres` DDL/function owner, uses an empty search path, contains no dynamic SQL or mutation, checks claim/parameter consistency, calls the exact accepted `private.partner_assigned_metadata` authorization function, and executes the existing `canonical-repository.sql` bytes unchanged. The owner has broad privileges and bypasses RLS; this is deliberately confined to a fixed nonpublic routine that applies existing explicit authority checks. It is not a claim that the owner is least privileged. The caller cannot invoke the accepted metadata helper directly. `anon`, `authenticated` and `service_role` cannot invoke the new routine.

`createCanonicalPartnerRoutineRepository` reuses the current transaction, exact installed-source verification, synchronous adapter callback, rollback, and connection release implementation. It checks the new routine body, owner, language, volatility, search path, return shape, exact EXECUTE ACL, schema owner/ACL, caller attributes/membership, lack of direct data privileges and lack of other security-definer execution before and after reading. No accepted provenance fingerprint was relaxed, replaced or regenerated. All 23 existing function and 17 relation pins still apply.

The routine returns only the existing minimized internal snapshot to the trusted repository. It does not itself turn that snapshot into verified People identity. The existing canonical adapter independently validates consent, current source hash, review/receipt/audit provenance, account binding and principal lifetime before returning only `identityStatus` and `personId`. Neither the raw routine nor repository callback is a public API. The trusted host must always use the complete repository/adapter path; exposing raw snapshots is prohibited.

The existing disposable pg driver now enters the restricted caller role before repository queries. The existing native canonical contention suite exercises that same routine/role path, and still tests the prior authority, account/source replacement, immutable receipt/audit and unrelated-write cases. It adds actual table/helper denials and rollback release of authority/account locks.

## Principal and connection limitations

Claim equality inside SQL is a consistency check, **not independent principal verification**. Any database connection can set custom JWT GUCs; the trusted ingress must authenticate the real caller and bind the verified user/session independently of browser parameters. The fixture still uses synthetic Auth and fictional principals. No actual Supabase JWT verification, provider session retirement, transport/cancellation custody or deployed server ingress is established.

The disposable native harness connects as its local fixture owner and uses SET ROLE. Its session owner could reset that role; it proves operation permissions under `current_user`, not a restricted login credential. The driver keeps its raw client private and does not accept caller SQL, URLs, credentials, pools or clients. NOLOGIN/no-members is intentional here: any future login membership or role change fails the envelope verifier and requires a separately reviewed source/credential contract. Do not deploy this fixture connection pattern.

The new SQL file is outside `supabase/migrations`; it must not be installed on any hosted target as a shortcut. The release migration and actual login-role custody require complete identity-stack/provider reconciliation and independent review first.

## Validation

Local PGlite envelope suite: 37 checks PASS, including accepted-writer positive linkage, unchanged provenance, direct data/helper/DDL denials, all public-role denials, claim mismatch, current authority/consent/session/account failures, cross-organization/campaign denial, callback rollback, principal retirement and envelope privilege/configuration drift. The complete focused Partner/shared-backend suite passes 376 checks, and the unchanged authority denial suite passes 22 checks. Independent Global agent cross-review reports no material findings and 13 additional PGlite denial checks pass. PGlite supplies sequential SQL evidence only.

Existing PostgreSQL18 CI runs the updated native suite; execution on this exact commit is pending. No Mac PostgreSQL cluster was started/stopped and no IPC setting changed. No browser/runtime/UI changes require another PR61 rehearsal packet.

Relevant source documentation checked: [PostgreSQL SELECT permissions](https://www.postgresql.org/docs/18/sql-select.html) confirms row locks require UPDATE privilege; [Supabase function security](https://supabase.com/docs/guides/database/functions) documents definer/search-path and EXECUTE controls. Current [Supabase changelog](https://supabase.com/changelog) was inspected; no release in this source task changes the pinned PostgreSQL18 fixture contract. The markdown endpoints were unavailable through the browser tool, so the official HTML pages were used.

## Operational gate map and next assignment

| Prerequisite | Current evidence | Required before real host |
| --- | --- | --- |
| Restricted operation permissions | Implemented and PGlite tested; native suite pending | Exact-head PostgreSQL18 CI and independent review |
| Accepted Issue50 installation | Exact selected source and accepted-writer fictional receipts | Review complete deployable Issue50 A/B/B2 installation/dependencies; do not install selected fixture as a production migration |
| Real Auth catalog | Existing pins intentionally describe synthetic Auth | Independently obtain/review authorized provider catalog and compatibility; never regenerate pins merely to pass |
| Verified principal ingress | Existing adapter and SQL consistency checks, synthetic principals | Real server verification/current-session binding and retirement, with safe cancellation and no browser-supplied actor |
| Role/credential custody | NOLOGIN, no members, no credentials | Approved dedicated login/execution membership contract, connection isolation, least-privilege role review, independent recovery/custody |
| Exposure and release | No public wrapper/mount/migration | Private schema exclusion, exact source review, separately authorized migration/grants and release |

No new product policy or automatic identity merge is introduced. No production decision is requested by this source package.

Copy-and-paste next source assignment (high reasoning): Review PR75's exact canonical repository and host-envelope candidate, accepted Issue50 source inventory, and real server ingress architecture. Reconcile a complete source-installable Issue50 dependency chain without historical seed data. Specify how an existing verified Supabase principal/session reaches a dedicated private database execution role without caller-controlled user/session substitution. Identify required provider metadata evidence and role/credential custody gates; do not obtain secrets, create paid resources, grant real roles, deploy, install hosted SQL, replace accepted fingerprints or change the public metadata null/unverified response. Return exact source hashes, unresolved technical dependencies and a narrow authorized acceptance plan for coordinator review.
