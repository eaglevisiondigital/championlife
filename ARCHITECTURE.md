## 2026-10-29 — General prayer resource integration, LOCAL ONLY
Reconciled PR #54 with the accepted Resource Registrant and reader chain through 5c84a42. Reused the completed implementation; removed the duplicate draft general signup backend. Additive `/king-kind-signup.html` entry points to the accepted form; all 26 SDK pins and current Powered by Propel branding are preserved. General registrations remain separate from outreach decisions, membership, staff and financial authority. See docs/GENERAL-PRAYER-SIGNUP-LAUNCH-CHECKLIST.md for exact next gates. No hosted testing, migration, message, permission change, push or deployment authorized or performed. Original packages unchanged.

## 2026-10-28 — Final local privacy and dependency correction

Lessons 5–13 reuse the existing verified-identity helper and add a shared device-only notes module keyed by Auth UUID/course/lesson. No new backend, enrollment, People or relationship writes. The site serves one version-pinned, integrity-checked Supabase UMD asset; build verification disallows floating entry-point tags. Lessons 1–4 remain the only cloud worksheets. See docs/GENERAL-RESOURCE-FINAL-CORRECTIONS.md.

## 2026-10-28 — Separate general-resource intake

The general /king-kind/ page reuses the existing Auth client, private reader and My Discipleship destinations. New verified-Auth UUID resource registrations live in app_private, not outreach_registrations, campaign registrants, People or course enrollment. The public status/register RPC exposes only the current user's boolean/reference receipt; duplicate requests do not overwrite fields or consent. Existing Storage object policy is preserved; its helper adds only an eligible verified general-user branch. No new infrastructure/provider/dependency. Proposed SowGo entry must redirect using reviewed domain ownership to the existing app origin; no assumption of cross-domain session sharing. Local candidate only; contract in docs/GENERAL-KING-KIND-RESOURCES.md.

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


## 2026-10-28 — General resource release correction candidate

General registration retains its distinct backend. The correction adds no runtime dependency or database object. Private worksheet state is keyed by verified Auth UUID/course/lesson, with epoch-bound view and save lifecycles. Shared client operations pin row ownership across awaits rather than reacquiring a new owner between profile/enrollment/answer writes. My Discipleship exposes the existing private reader independently of St Lucia; Storage remains authoritative. Existing public redirect files and course routes are unchanged.


## 2026-10-28 — Local King Kind reader session correction

Separate successor to sealed 6d5730bf0034bbb138999ce8cab97ce150d525fe. Reader invalidates retained PDF/Blob/canvas/license state synchronously on Auth/storage/history/expiry changes; deferred authorization avoids SDK callback-lock deadlock. Generation-bound requests and detached rendering prevent stale completion from restoring prior-user content. Each personal-use download freshly checks identity and exact-object Storage eligibility. No design, SDK, PDF, SQL/RLS, general registration, lesson, recovery or Issue50/51 changes. Local regression and intercepted real-browser/real-renderer evidence are recorded privately; genuine-provider acceptance remains untested. See docs/KING-KIND-SESSION-CORRECTION.md. Stop at independent review; no hosted authorization, deployment or access grants.
