# Current build state

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
