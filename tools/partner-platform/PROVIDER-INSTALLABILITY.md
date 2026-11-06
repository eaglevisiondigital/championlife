# Partner provider installability — November 2, 2026

**NO-GO for installation or mounting.** This successor adds an offline assessment,
not another runtime adapter, database profile, identity store or authorization path.
It preserves the original 23-function / 17-relation fingerprints and all accepted
signed-ingress/execution-role behavior.

## Uncertainty resolved by actual evidence

One explicitly bounded metadata-only transaction was run against the existing
Champion Life provider: READ ONLY, 5-second statement timeout, 500-ms lock timeout,
only pg_catalog for two Auth relation definitions, database PUBLIC privileges and
server version. No Auth/customer rows, tokens, credentials, functions, migration
writes or data were read or changed. The exact query and returned raw catalog are
retained in private audit evidence, not this public repository.

| Observation | Frozen fictional local fixture | Actual provider metadata |
| --- | --- | --- |
| auth.users column count | 7 | 35 |
| auth.sessions column count | 3 | 15 |
| Auth owner / RLS | postgres / disabled | managed Auth owner / enabled |
| Database PUBLIC TEMP | removed in disposable role test | granted |
| Database PUBLIC CREATE | denied | denied |

Columns, constraints, indexes, owner and RLS differ. Current managed Auth cannot
satisfy the existing exact fixture pins. This is a concrete installability blocker,
not proof of a weakness in the provider's Auth schema. The provider has additional
managed fields and protections; do not replace its tables with our fixture.

`fixtures/auth-local-catalog.json` records only the already accepted fictional
local definitions. Each definition's hash must equal its original runtime pin at
module load. `provider-catalog-readiness.mjs` compares a private metadata capture
against these frozen definitions, emits only hashes/structural differences and
cannot return installation or mount approval. Matching the sampled fields still
leaves full provenance and genuine provider behavior unverified. The capture omits
Auth triggers/effective caller privileges and does not establish the other 15
relations, 23 function definitions or Issue50 installation in production.

## Dedicated environment feasibility

1. **Existing shared production database:** current PUBLIC TEMP conflicts with
   the strict execution profile. PostgreSQL privileges are additive; a per-login
   REVOKE cannot remove PUBLIC rights. No shared database ACL change is authorized.
2. **Separate application database alone:** can isolate database TEMP/CREATE ACLs,
   but cannot simply use a local copy of the provider's Auth tables. The accepted
   canonical query requires live Auth/assignment/People rows in one transaction
   and locks them through the decision. A mirror, stale copied session or remote
   proxy is not that authority. No replication/FDW workaround is proposed.
3. **Dedicated complete acceptance project:** conditionally feasible for fictional
   identities with its own genuine managed Auth and application schema. Its own
   database ACLs can be separately reviewed without changing shared production.
   It still will not automatically match the fictional Auth pins. An exact,
   independently reviewed provider Auth profile and live session/revocation tests
   are prerequisites, along with approved custody, cleanup, budget and maintenance.
   No new resource has been created or cost approved by this assessment.
4. **Broad service-role/owner credential:** not an acceptable execution-role fix.
   No historical grants are restored, and no Person identity is inferred.

A separate project is an isolated acceptance environment, **not** approval to
split production identity or create a second Church/Outreach/Partner login.
Production architecture remains the existing shared principal and canonical
People relationships.

## Smallest next technical package

Preserve original pins. Independently review the privately captured managed Auth
structure with its exact provider migration lineage, relevant triggers, grants,
protected functions and actual supported session-retirement behavior. Only then
propose a separately named provider-specific profile tied to the intended isolated
target. Keep all existing application/People provenance checks, and independently
validate any exact managed-Auth differences; do not automatically generate new
trusted pins from a current catalog dump. Full app provenance, least-privilege
host custody, independent recovery/cleanup and genuine Auth remain separate gates.

The existing PR61 recovery rehearsal remains first in the operational queue. This
source assessment does not provision that target or combine Partner installation
with the website-only PR61 release.

References reviewed November 2, 2026:
- https://www.postgresql.org/docs/current/ddl-priv.html
- https://supabase.com/docs/guides/auth/managing-user-data
- https://supabase.com/docs/guides/auth/sessions
