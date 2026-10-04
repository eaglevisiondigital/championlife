# Current build state

## Main sync + Outreach denied-access UI — October 4, 2026

From clean development HEAD `24d755bc9098847a8f70b42c120ce9571fbcaf6d`, normal merge `a76008f448eef710121fa9e2c1cf0b780b4d6ea3` integrates main `69407607bf58614fd8b7be67d7d02e7e95010de6`, including the assigned Christmas release `2ae636a6322d0adf76a1872c897b3a5230662eac` and main's subsequent Bessemer landing page. The sole conflict, `events.html`, retains released weekly/Christmas content alongside the native development calendar. Christmas registration HTML/CSS/JS and Bessemer remain byte-identical to integrated main; the explicit build manifest now includes them. The Christmas form definition coexists with development's native-only Outreach intake. Main advanced independently during verification through `e9227c3` (Bessemer QR), `3aded7e` (Bessemer theme), and `4af2bb9f9f0634850e6a6ad3f00193fe27d95a31` (clean-route redirects). Second merge `2c0a72c75b583e1f882338bc367c188efcf7d56d` included the routes. The initially misidentified QR/theme changes are restored unchanged from main in the follow-up correction, with the QR included in the public build manifest. No unrelated uncommitted Bessemer work was actually present; that earlier assessment was incorrect.

The focused staff Outreach fix handles active HTTP 401/403 at the RPC boundary, ends Loading, clears protected DOM and workspace state, and invalidates outstanding work. 403 shows the approved access-removed text and Return to Staff Home (`staff-people.html`); 401 reuses the existing workspace sign-in route. No raw backend error text is rendered. See [denial contract and evidence](docs/OUTREACH-PARTNER-INTAKE-V1.md#revoked-access-ui-repair--october-4-2026).

Local validation passed: mandatory clean dependency installation, all 44 regression scripts (including 13 new denied-access scenarios), all 94 Christmas checks, explicit-artifact build/isolation checks, JavaScript syntax and diff checks. Existing authorized review/link/follow-up and all previous module regressions remain intact. Hosted preview/CI and ending SHA are recorded in the private handoff after push; local tests alone do not establish hosted real-staff acceptance. No production, backend, Auth/SMTP/DNS, giving/merchant, grants or RLS changes. PR #2 must remain open/draft/unmerged; SowGo PR #1 and further packages are held.

## Shared Outreach Partner Intake v1 — October 4, 2026

The explicit assignment releases the prior Dream Team development hold for this package only. From `2e9bc50b8a08de2ae0dd61ccd1943bf90dad2ce4`, one server-owned SowGo intake supports the unchanged Champion Life modal plus Champion Life and SowGo direct presentations. Native submit replaces this form's Netlify capture in development. Reviewed People linking, partner relationship and existing follow-up are separately authorized; no identity/consent/payment/access inference. See [contract](docs/OUTREACH-PARTNER-INTAKE-V1.md). Full 44-script regression and hosted CI passed. Acceptance migration `20261004055336` matches local bytes; hosted rollback security/workflow assertions passed. Both branded direct forms and the existing modal saved synthetic intakes and continued to unchanged GiveHub; desktop/tablet/390px checks passed. Three browser test rows were cleaned. SowGo integration is isolated in draft PR #1 with its preview-only CTA verified. Production and Dream Team remain unreleased. No next package or PR merge.


## Dream Team protected PDF repair — October 3, 2026

The focused repair starts from `dc7058451e071c9d8fe4852f4a0c7254dfafcd60`. Hosted acceptance confirmed a CPUTime shutdown at 2,016 ms, not a memory limit. Repeated growing-prefix font shaping during line wrapping was the local CPU hotspot. Word-candidate wrapping with code-point-safe splitting removes redundant measurements; the original logo/font, all visible source content, signature, versions and exact UTF-8 attachment remain intact. Fixed stage/timing telemetry contains no submission data.

Only acceptance `dream-team-worker` was redeployed (version 3). The previously failed synthetic PDF job was requeued after proving that no document/object existed; the scheduler accepted it once. PDF save completed at 488 ms, upload at 687 ms; runtime shutdown recorded 680 ms CPU and 24,615,715 bytes memory. One 121,134-byte private object and a correctly bound protected-document/hash record now exist. Unauthenticated document access returns 401; the public Storage route returns 400 without a PDF. No migration, Auth/SMTP, document endpoint, permissions or production change.

Full 41-script regression passed, including focused layout/content/signature/Unicode/private-upload/hash/replay/download tests. Local generated PDF branding, metadata and signature were visually checked. Hosted authenticated download and visual review remain pending the submitting synthetic learner session; the approved unrelated account was denied by the deployed RPC without grant changes; hosted reviewer/ordinary-staff checks remain pending. No temporary staff grants were created. Preserve immutable submission/document/audit history. Next: complete only remaining PDF/mailbox/mobile/network acceptance; no new package and no PR merge.

## Dream Team Application v1 — October 2, 2026

The explicit assignment resumes this package only from `9be1ce0f87a88770307b43b4b4023d00d5f7ee78`. Native eight-page/52-field source-faithful application, cloud drafts/signature, immutable submission, protected PDF, restricted human review, separate ministry placement, safe events/alerts and Person communication hooks are implemented. See [contract and acceptance handoff](docs/DREAM-TEAM-APPLICATION-V1.md). All four approved source anomalies remain unchanged.

Acceptance received the two forward migrations `20261002063140` and `20261002063751`, private storage, and the two protected worker/document Edge Functions. Previous migrations and production remain untouched. Hosted rollback workflow/security tests passed and left zero applications/submissions/jobs/synthetic users. Full regression and focused Go email tests passed; synthetic browser checks covered all eight pages at 390/768/1440 px with no overflow. Real-account mailbox, eventual PDF delivery and hosted end-to-end acceptance remain pending with Work. Detailed runtime configuration and release gates are recorded in the contract; no claim of production release.

PR #2 must remain open/draft/unmerged. No production Auth/SMTP/DNS/giving/merchant changes or real staff grants. Next: hosted Dream Team acceptance only; no additional feature package.

## Dream Track invitation visual polish — October 1, 2026

The user reports that real invitation email and the hosted confirmation flow passed acceptance at `f43c542bace9041e634ba161db32c653a9131f5c`: Resume Dream Track opened Lesson 1, the existing learner note loaded, and progress/answers were unchanged. This supersedes the earlier open acceptance status for that verified flow.

Only two additional visual changes are implemented: the checked-in Dream Track email bodies reuse the unchanged website `assets/images/logo-gold.png` via its existing public HTTPS URL, and Go to My Discipleship is a white, black-bordered/text secondary button directly beneath and aligned with the unchanged gold action. Focused tests passed: 16 Go email render cases (including the exact logo), 18 invitation UX DOM scenarios, site build, 27 JS syntax checks, 16 redirects and diff check. Chrome desktop/mobile synthetic previews verified logo loading and button styling/equal widths with no overflow. No claim logic changed, so database claim tests were not repeated.

This assignment explicitly prohibits SMTP/Auth changes: the new email bodies are repository-ready only; hosted Auth templates were not changed and sent emails will retain their prior header until a separately authorized template-only application. No subject, callback, adapter, authentication, enrollment, progression, playback, Getting a Grip, question bank, production or giving changes. Development commit/push and hosted checks are recorded in the private completion handoff. Next: review this cosmetic change and authorize acceptance-only email-body application if desired; no new feature package.

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
