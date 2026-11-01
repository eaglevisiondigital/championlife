## 2026-10-31 — Incremental staff shell composition

The first local shell composes existing staff-workspace and campaign-registration authorization responses instead of importing historical shared-platform SQL. One existing Auth client and logout component serve staff home, People and registration. Context navigation reloads an allowlisted existing destination and reauthorizes it. Unreleased NMI, advanced decisions and provider modules are not loaded. Exact source overlaps and future composition boundaries are documented in [UNIFIED-STAFF-SHELL.md](docs/UNIFIED-STAFF-SHELL.md).

## 2026-10-23 — Reusable staff presentation and session header

`staff-portal.css` is opt-in through `body.staff-portal`; it does not restyle public pages. `staff-session.js` adds the same email/logout header to People, Registration/Check-In and Partner Review, using the existing ChampionLifeAuth client. It owns no authorization, RPC or data model. Existing modules retain their permission checks and async generation guards. Protected module mounts are detached before sign-out and before bfcache snapshots, so late responses cannot repopulate the visible workspace. See `docs/STAFF-PORTAL-POLISH.md`.

## Consolidated operational scope contracts — 2026-10-22

The same existing eleven-key role supports separately assigned Church/Outreach operations or Outreach-only operations with ordinary Church membership. Membership confers no Church staff permissions and no donor/household ownership. Generic portable tests now cover both compositions; no second permission system or new migration. Preserve child-specific shell and additive test manifests per [release reconciliation](docs/OPERATIONS-ADMIN-RELEASE.md).

# Huntsville isolated architecture

The production baseline remains intact. Public config is anonymous and minimized; guest mutations enter only through the protected Edge Function and service-only registration gateway. Staff operations use the registration workspace RPC with campaign-scoped active/dated authority. Canonical household registrations, explicit attendees and immutable legal snapshots drive counts and separate check-in state. Campaign locking protects idempotency and final-slot capacity.

Phase A identity/audit helpers and the dormant participant identity required by accepted check-in are isolated from generic workflows, travel and prize operations. Exact edges, columns, constraints, origins and exclusions are in [the dependency inventory](docs/HUNTSVILLE-MINIMAL-DEPENDENCIES.md). The current production staff return route is retained; no unpublished platform shell is imported.

## Isolated theme-song feature

The Outreach feature and dedicated sharing page use one static HTML audio player and shared control script. No counter service, database, cookie, environment variable or tracking request is required. The exact artwork/audio and existing Outreach giving destination remain unchanged. The public manifest includes only the player, pages and approved media. See [contract](docs/THEME-SONG.md).


## Organization operations candidate — 2026-10-22

The bounded production-baseline security package projects existing registrations.view/manage and people.export into campaign operations only, using each campaign's exact organization. It preserves the per-campaign model and separates staff.manage from campaign configuration/operations. Financial intake, linked follow-up and relationship history have additional server-side finance boundaries. Two tenant assignments remain separate; no all-organization role or unaccepted unified module is introduced. See docs/OPERATIONS-ADMIN-SECURITY.md. Local only; full child-package integration remains separately reviewed.

## 2026-11-01 — Assigned Partner metadata backend candidate

Local source only: explicit campaign/Partner/worker assignment, locked active Auth session and metadata-only read RPC. No issuer or automatic People identity claim; `personId` remains null pending independently reviewed linkage. Existing financial intake authority and website PR61 are separate. See [implementation boundary and release gates](docs/PARTNER-ASSIGNED-METADATA-20261101.md). No migration, staff grant, public runtime activation or hosted acceptance has occurred.

## 2026-11-01 — Partner current-base integration and private revocation

Exact reviewed Outreach ancestry is reconciled into the Partner draft without changing accepted runtime bytes. A separate private-only revocation primitive prepares locked authority, expected revision, idempotency and immutable audit rollback; no application role can execute it and no Partner issuer policy is inferred. People linking remains null/unverified pending complete unreleased Issue50 receipt/review provenance. See [scope and gates](docs/PARTNER-PRIVATE-REVOCATION-20261101.md). Local source only; no production migration, grant, website activation or public endpoint.


## 2026-11-01 — Private Partner issuance and provenance continuation

Partner assignment preparation reuses existing three Partner tables and campaign audit; it adds no Person/account store and no public issuer. The optional canonical identity adapter jointly validates current source, receipt, review, audit and account binding through a trusted serialized repository that is not yet installed. Source fingerprint pins are dependency provenance, not deployed proof.
