# Current build state

## Dream Track invitation UX correction — October 1, 2026

Only the two explicitly authorized hosted UX fixes are implemented from `5e6ecc3bf00de2b5284ff3fc9486e4381599918c`: Dream Track-specific invitation email copy and a direct enrollment/start/resume/completed landing. See [the updated contract](docs/DREAM-TRACK-V1.md). General Auth template fallback content is preserved; only the exact acceptance invitation callback selects the new subject/body. Acceptance-only templates/allowlist and the existing email adapter support this flow. No SMTP, database/migration, grading, 95% watch, player or 140-question-bank changes.

Focused checks passed: 19 claim assertions, 18 invitation/login scenarios, 16 Go template render cases, the email adapter, existing 17 Dream DOM/auth checks, 16 redirect cases, JS syntax and site-build isolation. Visual checks use synthetic local Chrome screens. Inbox delivery/new hosted recipient acceptance remains with Work. Dave reports normal Chrome Lesson 1 playback after approximately 19 seconds of initial loading; the earlier cloud-browser black frame is not a confirmed application defect. No next feature package begins. Push/CI/preview details are recorded in the private completion report; PR #2 must stay open/draft/unmerged and production stays unchanged.


## Dream Track v1 — September 29, 2026

The explicit Dream Track assignment supersedes the prior next-package hold for this module only. Local and remote starting HEAD were both `1e9a4f610453336f24194f3758ea3b43aefb11b1`, with a clean checkout. Seven existing YouTube IDs are reused; 140 exact approved questions, the Grip workspace layout, server-authoritative 95% watched + 16/20 cumulative mastery, missed-only retries, immutable attempts, enrollment code/invitations, staff reporting and final-meeting-gated durable badge are implemented. Getting a Grip pages, CSS/engine and existing Auth behavior are preserved.

Acceptance received only `20260929221116_dream_track_v1.sql` and the acceptance-only invitation email adapter. Migration MD5 `124443fe7647a40ac739c4354a1e0574` is byte-identical hosted/local; SHA-256 `5dde77e16b2eeae07081640ff920d8e440a6b644e593b3889543b65323d0050d`. All 20 prior migration files are unchanged. Inventory: 21 migrations, 57 public RLS tables, 60 policies, 73 public/private functions, one acceptance Edge Function. All 16 hosted rollback assertions passed. Existing two Auth users, two Grip enrollments and 40 answers remain; contacts/grants and Dream attempts/invites/completions/guess counters are zero. Intentional Dream course/settings/seven lessons/140 questions persist, with no access code configured.

All 34 regression scripts passed, including 67 Dream backend checks, 17 DOM/auth checks and mocked invitation delivery checks. Native PostgreSQL 17 concurrent meeting/claim checks passed. Local SQL-backed desktop/tablet/mobile browser validation passed for grading/retries/unlock, save/refresh, no overflow, staff reports and failed-delivery fallback. In-app-browser YouTube embeds rendered black for both unchanged Grip and Dream Track; actual playback/casting remains unverified, not passed. See [Dream Track contract](docs/DREAM-TRACK-V1.md) for telemetry limits and release gates.

The invitation adapter is ACTIVE only on `bkbmjisprwmkptywtmih`; unauthenticated requests returned 401. It validates Auth identity and courses.manage itself, uses existing Auth email and permits only the exact PR #2 preview origin. No real emails, real grants, SMTP/Auth configuration or production changes occurred. Commit/push/CI are recorded in the private handoff. Next: hosted real-account Dream Track acceptance only; do not start Forms, Communications Core, Giving expansion or Text-to-Give.

## Registration + Check-in v1 — September 29, 2026

The explicit Registration assignment supersedes the Events next-package hold for this package only. Starting HEAD: `17c646cdcae2d10a47273c6a727d72e4cbbc9603`, including the hosted OTP compatibility fix. Native guest/group registration, optional trusted People/account links, occurrence/series enrollment, attendee capacity, bounded questions, restricted answers, lifecycle, individual/group check-in, reversal, walk-ins and scoped staff screens are implemented. Payment fields are hooks only; payment-required enrollment fails closed.

Acceptance received only `20260929131021_registration_checkin_v1`. Local SQL is byte-identical to the hosted migration (MD5 `5982c6e0d67725310a72c33e6607ab79`); all 19 prior local migration hashes remain unchanged. Inventory: 20 migrations, 49 public RLS tables, 60 policies, 62 public/private functions, plus the existing private human table/effective-schedule view. The seven new tables have no browser table grants or policies. Hosted fixed search paths, wrapper/implementation permissions and zero direct client table grants were verified. All 17 rollback-only hosted registration assertions passed. The two existing Auth users remain; contacts, staff grants, events, registrations and attendance are zero after rollback.

Validation: all 31 regression scripts passed; 74 focused Registration checks plus 17 rollback assertions; public/staff DOM tests; native PostgreSQL 17 independent-session final-slot, replay and cancellation/check-in races; actual local SQL-backed browser guest family registration, group check-in, reversal and contact-optional walk-in; mobile 390-pixel layout with no overflow and no browser console warnings/errors. Migration parity and DOM checks passed again after aligning the remote-assigned migration filename and correcting the optional-email walk-in label. See [Registration contract](docs/REGISTRATION-CHECKIN-V1.md).

Implemented and acceptance database-validated does not mean production-released or hosted real-account browser-accepted. Commit/push/CI are recorded in the private delivery handoff. Main remains `66591f22d5315d093091b99152c18d43bfcb3893`; PR #2 remains open/draft/unmerged. No production Supabase/Auth, giving, merchant, DNS or staff-grant changes. Chat reviews this package before Communications, Forms or Giving expansion. Historical sections below retain their original counts and then-current holds.

## Events + Calendar v1 — September 28, 2026

The explicit Events assignment supersedes the earlier next-package hold for this package only. Starting HEAD: `b04a3de8bfcf44c709e556247e485bf6b12b04c1`. Implemented a reusable organization-scoped series/occurrence/exception model, bounded timezone-aware recurrence, tenant locations/audiences/types, scoped event staff editor, native public list/calendar/detail, optional approval, private audit and honest registration hooks. No native registration/check-in or real events were created.

Acceptance received only `20260928183137_events_calendar_v1`; SQL matches local bytes and all 18 prior migrations are unchanged. Inventory: 19 migrations, 42 public RLS tables, 60 policies, 52 functions plus private.people and the private effective-schedule view. Seven new tables are RPC-only with no client grants/policies. All 22 hosted rollback assertions passed; two existing Auth users and zero contacts/staff grants remain, and no synthetic event records remain. Only tenant timezone defaults persist.

Validation: 29 local scripts, 74 focused Events checks plus 22 rollback assertions, Events DOM tests and actual desktop/mobile browser interaction against isolated local SQL. See [Events contract](docs/EVENTS-CALENDAR-V1.md) for bounds, visibility, exception preservation, publication authority and advisor findings. This is implemented and acceptance database-validated, not production-released or hosted real-account browser-accepted. Commit/push/CI are reported in the delivery handoff. Main remains `66591f22d5315d093091b99152c18d43bfcb3893`; PR #2 stays open/draft/unmerged. Next gate: Chat reviews Events v1 before any Registration + Check-in implementation.

The dated sections below preserve historical state and superseded package holds.


## People + Staff Access v1 — September 28, 2026

The explicit People/Staff assignment supersedes the earlier next-package hold for this package only. Starting development HEAD: `5eb3d4576109b47a913a0f8c42fa79fca3f58acc`. Existing contact/account/organization/staff/department/audit groundwork is extended; completed modules and giving destinations are preserved.

Implemented: private permanent human anchors with tenant contacts; dated multiple contact relationships; configurable ministry affiliations; dated active staff assignments; explicit organization/department grants; configurable materialized role templates; separate financial grants; guarded RPCs/RLS and immutable access audit. The People list/detail/Staff Access UI extends the current workspace, with existing Add Person and related contact/household/follow-up tools retained. No real assignments, finance grants or default ministry names were invented.

Validated: 27 local test scripts, 56 new focused authorization checks plus 20 rollback-only assertions, integrated DOM tests and synthetic desktop/mobile browser sanity. Isolated acceptance received `20260928172557_people_staff_v1`; all 17 historical files are unchanged. Hosted SQL matches the migration and the 20 rollback assertions passed. Current acceptance inventory: 35 public RLS tables, 60 policies, 44 functions, plus a private RLS human table. After rollback, the existing 2 Auth users remain; grants, contacts and synthetic records are zero. See [People/Staff contract](docs/PEOPLE-STAFF-V1.md) for scope, naming, compatibility and advisor results.

This is implemented and database-validated on acceptance, not production-released or real-account browser-accepted. Commit/push and hosted CI are reported in the delivery handoff. Production main remains `66591f22d5315d093091b99152c18d43bfcb3893`; no production schema/data/Auth/giving/merchant/DNS or staff changes are authorized. PR #2 must remain open, draft and unmerged. Next: Champion Life Chat reviews People/Staff v1 before authorizing Events/Calendar; do not begin Events now.

The sections below record earlier delivery states and their then-current counts/gates.


## Acceptance initialization repair — September 27, 2026

Fresh branching exposed an omitted project-creation prerequisite: automatic-RLS helper/trigger setup was outside the 17-migration history. The repository now has a guarded, separately version-controlled provisioning script; the test-only helper injection was removed. Clean and failed-prefix replay both verify 17 unchanged migrations, 32 RLS tables, 60 policies and 35 identical function definitions. See docs/MIGRATION-BASELINE.md for provenance and the bootstrap → supported branch rebase procedure. Hosted push and PR CI passed for repair commit 9b6e032. The isolated acceptance branch was provisioned using the checked-in bootstrap and then the supported Supabase rebase operation; it now reports FUNCTIONS_DEPLOYED / ACTIVE_HEALTHY. All 17 versions and normalized historical SQL, 32 table/RLS definitions, 60 policies, 35 function definitions and public/private ACLs were verified. No Auth/user rows were copied; only the eight historical reference/configuration seed rows exist. Private is excluded from Data API exposure. The security advisor has only the expected informational RPC-only staff-directory notice. Browser/Auth acceptance remains with Work; preview variables and Auth redirects were not configured. No production change is part of this package.

## Preview readiness — September 26, 2026

The authorized follow-up adds a 372-file explicit public artifact, excludes administrative/development files, and generates isolated preview Supabase configuration with a visible no-client state when absent or invalid. Production/local defaults and callback UX remain unchanged. All 24 existing scripts passed; the new site-build suite covers deployment isolation and artifact safety. Hosted CI and draft PR results are reported separately after push. See docs/PREVIEW-ACCEPTANCE.md for exact variable names and gated Work assignment. No backend provisioning, production release or giving changes are authorized here.

## Publish update — September 26, 2026

Reviewed hardening commit 3fd026acd27940e9b5e9c2d09e136a27bd55200a is now pushed to champion-sowgo-backend-v1; remote HEAD matches exactly. Main remains 66591f22d5315d093091b99152c18d43bfcb3893. Hosted [Backend validation / synthetic-regression](https://github.com/eaglevisiondigital/championlife/actions/runs/36276319163) passed all 24 scripts; no steps skipped.

Live Netlify settings verified: production main, branch deploys disabled, PR previews enabled, no project environment variables or build hooks listed, publish root with no build command. After push, production still shows the September 24 main deployment. No preview exists for this commit; enabling a preview remains a separate approval/configuration gate. Auth allowlist and Data API exposure remain unverified. Preview source would still use live Supabase, so test accounts/data authorization is required before acceptance. No production/backend/giving changes occurred. Next is gated Work acceptance, not feature implementation. That result refers to the earlier reviewed commit; the accurate continuity notes are incorporated in the preview-readiness package.

Verified September 26, 2026. This file summarizes current state; dated sections in docs/ are historical and may describe later-resolved gaps.

## Targets and hold

- Repository: eaglevisiondigital/championlife; development: champion-sowgo-backend-v1.
- Hardening starting HEAD: 63a775fb66e9c721691eace0121e81ce5572f385 (26 ahead / 0 behind main).
- Production main: 66591f22d5315d093091b99152c18d43bfcb3893; unchanged by hardening.
- Supabase: Champion Life Platform, exdocjbmylgxssanymjk, ACTIVE_HEALTHY, PostgreSQL 17.6.1.166, us-west-2.
- Exact read-only counts reconfirmed: zero active staff permission grants; zero total portal account links.
- Frontend development has not been approved for release. Current giving links/operations stay until explicit switch authorization, even after tests pass.

## Implemented

Email OTP auth, learner profiles, 13-lesson course/enrollment/progress framework, lessons 1–4 interactive worksheets, cloud answers/notes, account-isolated drafts and St. Lucia verified-email registration claiming. Cloud concurrency remains last-write-wins across devices.

Organization-scoped people/affiliations, explicit staff permissions, focused staff workspace, contact creation/edit/history, follow-up tasks/history, households, departments/tags, held tag workflow notifications, draft fund/form routing and participant portal access/resources. Staff access management already exists; initial administrator provisioning is separate and remains unperformed. Portal resource publishing review, search, links, histories and independent draft copies exist on development.

Detailed contracts: docs/BACKEND-FOUNDATION-STATUS.md, STAFF-ACCESS-OPERATIONS.md, TAG-WORKFLOW-OPERATIONS.md, GIVING-ROUTING-AND-ROLLOUT.md and PARTNER-AND-CHURCH-PORTALS.md.

## Reproducibility and validation

All 17 applied migrations now exist under their original versions/names. Seven historical files were recovered from read-only history; the ten existing files were unchanged. Full local replay verifies 32 public RLS tables, 60 policies and 35 function definitions, plus key access restrictions. No migration was applied remotely.

`npm test --prefix tools/backend-tests` runs the prior 22 scripts plus full-chain and syntax checks. Eight existing database suites report 254 checks; redirects report 16 cases. DOM/persistence checks also run. Counts from individual log lines are not a universal assertion total. See the hardening report/release log for the final run result. CI has the same credential-free command; a local pass is not a hosted CI run.

Unverified: real email sign-in/SMTP/callbacks, designated staff accounts, browser/mobile acceptance, deployed revision, Data API private-schema exclusion, backup restoration and rollback exercise. PGlite is not a complete Supabase stack.

## Pending scope and next package

Ledger/payments/manual gifts/receipts/statements/DAF/Kingdom Raise, general forms, events/calendar, Family Hub, serving/check-in/groups, full partner benefits and actual notifications are unfinished. Event requirements include card listings, alternate calendars, ministry filters, embeds and recurrence; no event module was built here.

Security/release findings and the exact dependency pin candidate are in SECURITY_MODEL.md. No cross-product Global Propel runtime decision is implemented.

Next recommendation: Work isolated preview/backend configuration and browser acceptance after the preview-readiness package; no new feature build. No admins, payments or production rollout are authorized by this hardening assignment.
