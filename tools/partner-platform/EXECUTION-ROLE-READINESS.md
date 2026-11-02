# Canonical Partner execution-role source profile

2026-11-02 — unmounted source, not a provider installation or release approval.

The accepted signed ingress authenticated a JWT and then used an injected private
connection. The accepted envelope deliberately required a NOLOGIN reader with no
memberships. Its disposable fixture borrowed postgres and SET ROLE; that is not a
least-privilege hosted credential. This successor adds a separate, fixed profile
without changing that original profile or any schema/function fingerprint.

`createCanonicalPartnerExecutionIngress` uses the same SDK 2.118.0 signature
verification, immutable principal, account/session checks, canonical People
provenance, assigned-campaign query, transaction locks and cancellation path.
Its only difference is the explicit repository execution-role verifier. No input
can select an arbitrary role, profile, connection URL, SQL or fingerprint.

Required database identity:

- `session_user = partner_identity_host_login`, `current_user = partner_canonical_reader`.
- Login has no superuser, BYPASSRLS, role/database creation, replication or INHERIT.
  Reader remains NOLOGIN with the same negative attributes. Role settings or an
  expired login deny. The only membership is reader -> login, granted by postgres,
  with SET true, INHERIT false and ADMIN false. No incoming delegates or alternate
  edges are accepted.
- Both identities have no database CREATE/TEMP, schema CREATE, relation/column/
  sequence privileges or ownership. Checks include all non-system schemas and
  effective PUBLIC privileges, not just the 23 function / 17 relation pins.
  Only the literal reserved `pg_` prefix is excluded; ordinary `pgx` / `pgX`
  schemas cannot hide relations or owner-executing definers from these checks.
- Login cannot execute reachable security-definer routines; reader can execute
  only the exact accepted canonical snapshot envelope. RESET ROLE restores only
  the limited login. Actual native login tests deny SET ROLE postgres,
  authenticated and service_role, and SET SESSION AUTHORIZATION postgres.
- Original envelope body, accepted source manifest, current-schema composition,
  broad historical writer denials, frontend and migrations are unchanged.

## Actual provider prerequisites remain held

`execution-role-fixture.mjs` is **test setup only**. It creates a fictional login
without a password in a disposable Unix-socket database using trust authentication.
It is not an installer. No real login, credential, membership or endpoint exists.

PostgreSQL PUBLIC privileges cannot be negatively overridden for one role. The
fixture revokes PUBLIC TEMP only in that disposable database. A shared provider
with PUBLIC TEMP/CREATE/table privileges will fail this profile. **Do not copy
that global revocation into production.** Any provider proposal must identify
all affected workloads and independently approve an appropriate isolated
execution boundary or broader database privilege change. Neither is authorized.

A host installation still requires independently verified current provider
catalog and migration provenance (the exact accepted 23/17 pins, not regenerated
matches); approved credential custody and dedicated connection/session behavior;
verified issuer/JWKS/environment; the independently witnessed recovery/cleanup
gate; genuine isolated Supabase Auth acceptance; and separately approved rollout.
Production catalog freshness has not been established by local fixtures.

DDL/role owners remain trusted maintenance authorities. They must retire/drain
the host before changing role edges, schema, key/profile configuration or grants.
The source checks both before and after the canonical read, but does not claim
that a read can serialize arbitrary owner DDL or pg_auth_members changes.
Application session/account/assignment/People revocation still uses the accepted
row-locking protocol. No historical broad grants or inferred Person identity are
introduced; an ineligible or missing canonical relationship stays unverified.

## Evidence distinction

PGlite PG18 tests exercise the current-schema positive identity join and profile
drift denials. Native PostgreSQL tests use a genuinely separate dedicated LOGIN,
not SET ROLE from a postgres connection. On local PG17, role security checks pass
and exact catalog acceptance denies; positive current-schema/concurrency checks
are explicitly skipped. CI requires PostgreSQL18 for the complete native
positive and session/assignment/account revocation tests. Neither result proves
provider custody, real user authentication or deployment readiness.
