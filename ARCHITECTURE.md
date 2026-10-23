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
