## 2026-11-03 — Existing-person task creation completes the People workflow

The People detail mounts a small title/date editor only under its existing three organization-wide read/manage grants. It reuses the current shared client and column-limited task INSERT, requests only `id`, and refreshes into the existing revision-guarded status editor. The server supplies actor/identity/status and audit; no campaign-assigned decision interface, new RPC, workflow, person merge or notification is involved. Ambiguous writes require a read-only review, since existing INSERT has no idempotency key. See [task creation contract](docs/PEOPLE-FOLLOWUP-CREATE-20261103.md).

## 2026-11-03 — Printable roster uses existing registration contracts

Roster preview and explicit Print share one refresh path: fresh context with export capability, existing campaign list/details, detached table assembly, then existing audited CSV authorization before publication/printing. CSV content is discarded; the original six columns and configured prize values remain. This adds no RPC or schema and is a sequence of current reads, not an atomic database snapshot. See [printable roster contract](docs/OUTREACH-PRINTABLE-ROSTER-20261103.md).

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

## Event Day arrival triage — November 3, 2026

Source-only bounded arrival queues connect existing registration totals, household
review and authorized individual check-in/reversal. Existing campaign RPC/RLS,
waiver snapshots and audit are reused; no SQL/permission/export/contact change.
Private staged rows require fresh identity and registration.view; stale account,
campaign, history and revocation responses cannot restore the queue. Twenty
households per page and page-local filters are explicit. See
[scope and acceptance limits](docs/EVENT-DAY-ARRIVALS-20261103.md).
Local browser/DOM and reproducible-build evidence is recorded privately; native
PostgreSQL startup is blocked locally before assertions and remains a required
CI gate. This is not hosted acceptance or release approval.

Independent integration review reproduced an inherited normal Household lookup
query leaking into a different authenticated account. The same scoped invalidation
hook now clears that normal query as well as arrival state; same-account refresh
is preserved. Six independent predecessor reproductions remain in private evidence.
