# Backend release log

## September 25, 2026: first foundation release

Active target: `exdocjbmylgxssanymjk` (original Champion Life Platform).

Applied successfully through Supabase migration tooling:
- `20260925200310_organization_foundation`
- `20260925200318_harden_outreach_claim`

Source implementation commit before deployment: `8f6b33ca72ebfdf432eba79aefd27e1318075b1f` on `champion-sowgo-backend-v1`. Follow-up commit aligns filenames to actual remote migration versions and records release evidence.

Verification:
- Champion Life Church and SowGo organization records exist.
- All four new tables have RLS enabled.
- No real staff permissions were seeded.
- Existing counts unchanged: profiles 1, courses 1, enrollments 1, lesson progress 1, answers 0, outreach registrations 0.
- Public claim wrapper is SECURITY INVOKER; anonymous execution denied.
- Anonymous outreach TRUNCATE permission removed; browser permission self-assignment denied.
- Read-only transaction simulating an unprovisioned authenticated identity returned zero organizations/people/permissions and false for registration claim. Transaction rolled back.
- Local PostgreSQL suite: 27 checks passed. Redirect regression suite: 10 cases passed and inline JavaScript parsed.
- Supabase security advisor now reports only disabled leaked-password protection. Review before introducing password-based staff auth: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Main remained `66591f22d5315d093091b99152c18d43bfcb3893`; no main merge or frontend production deployment performed.

Limits: no real email sent; no full browser registration/login/cross-device round trip performed. Redirect fix remains development-branch only. Account-scoped local drafts, blank-answer sync, cloud notes, staff management UI/API, staff assignment and full member/partner portals remain pending.

Next slice: isolate browser lesson drafts per account and fix answer clearing/notes persistence, then build permissioned staff onboarding and people workspace. Preserve the existing production project, St. Lucia route, and passwordless discipleship login.

## September 25, 2026: lesson persistence and first people workspace

Development source: account-scoped drafts, serialized lesson saves, explicit empty-answer writes, notes storage, and a permissioned staff people page with organization selection and contact edits. Additive migration: `lesson_notes`. Source saved before live database application. Production frontend remains unchanged; migration application and verification will be recorded below after completion.

Tests: existing organization/claim suite (27), redirect cases (11), auth persistence scenarios (6), simulated draft lifecycle scenarios, and private notes persistence/RLS. Browser acceptance, real email delivery, and initial staff provisioning are pending.

Deployment verified: `20260925202633_lesson_notes` applied to `exdocjbmylgxssanymjk`. Notes default to an empty string, are non-null, and remain covered by existing owner-only RLS. Existing lesson progress count remains 1; staff grant count remains 0. Main still points to `66591f22d5315d093091b99152c18d43bfcb3893`. Source implementation commit: `7e1053e4829c76bb8cb11f01133caa39311f2bfa`.

The local notes test initially selected an empty scratch migration left by a delayed CLI invocation. Its selection now ignores empty files. The duplicate was never committed or applied. Notes persistence/RLS checks then passed. Migration filename now matches the verified remote version.

## September 25, 2026: operational follow-up

Source implementation commit `87d9931c1dc96ede175b2b6a838ab137f29464b4` saved on `champion-sowgo-backend-v1` before live application. Applied `20260926000821_followup_tasks` to the original project `exdocjbmylgxssanymjk`. The source filename was reconciled to the server-recorded version after deployment.

Verified: both new tables enforce RLS; anonymous task reads, authenticated direct audit inserts and direct trigger-function calls are denied. Task/event counts are zero and no real staff permissions were granted. Pre/post counts remain profiles 1, enrollments 1, progress 1, answers 0, outreach registrations 0, staff grants 0. Existing website/main is not published by this slice.

Complete local suite passed: 27 foundation checks, 25 follow-up database checks, 11 redirect cases, lesson/draft/notes checks and two synthetic DOM workflows. No real account or email was used. Visual browser acceptance and authenticated live workflow testing remain pending. Staff access provisioning and the team-assignee picker remain future work.

Security advisors report no new findings. The existing disabled leaked-password protection warning remains; review before introducing password-based staff login: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Recovery: disable new frontend entry points if necessary and fix forward. Do not remove task/event tables after operational data has been created. The migration is additive to learner/outreach tables and does not change their ownership or policies.

## September 25, 2026: staff access, person creation and team assignment

Implementation commit `d176e8917bf18611abb7661072adb066bb80215a` saved to the development branch before applying `20260926022613_staff_access_and_people` to `exdocjbmylgxssanymjk`. Source migration filename reconciled to the returned remote version. New staff directory and administration event tables both have RLS. Anonymous staff-management RPC execution, direct browser directory access and direct audit inserts are denied. No real staff grants were added.

Pre/post counts match: profiles 1, enrollments 1, lesson progress 1, answers 0, registrations 0, organization people 0, staff grants 0, tasks 0. New directory/event counts are zero. Full local suite passes, including 30 new PostgreSQL staff/contact checks and integrated UI grant/create/assign/revoke checks. Main/frontend is unchanged. Visual browser and real-account acceptance remain open.

Advisors: existing leaked-password-protection warning remains (https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). New INFO `rls_enabled_no_policy` for `organization_staff_directory` is intentional: RLS denies all direct access, authenticated table grants are revoked, and scoped private functions return only authorized directory fields. Do not add a permissive policy to silence this notice. Explanation: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Initial administrators must be explicitly designated and provisioned through the trusted workflow in STAFF-ACCESS-OPERATIONS.md. No invitation emails, messages, real contact imports or consent changes were performed.

## September 25, 2026: person record and daily overview

Development-only UI expansion: individual contact/history/follow-up dialog and live, permissioned daily overview counts with five assigned tasks. Existing database schema and permissions are reused. No live records or Supabase settings were changed. Source is saved to champion-sowgo-backend-v1; main remains the production baseline.

Validation includes the person/overview DOM suite for organization/person filters, own-assignment count filters, safe text rendering and canceled late responses. Browser visual acceptance and designated real staff accounts remain pending.

## September 25, 2026: household records and relationship management

Source commit `ca2f6fe6a8bf0637e468cccf10b139e995dc61ef` saved before applying `20260926024742_household_records` to the original `exdocjbmylgxssanymjk` project. Source filename reconciled to the remote migration version. Household staff screens, member search/add/change/remove/restore, household archive/restore, person-record relationships, scoped role delegation and audit history are implemented on the development branch.

Verification: both new tables enforce RLS. Anonymous table reads, browser household deletion and direct trigger execution are denied. Existing counts remain profiles 1, enrollment 1, progress 1, organization people 0, staff grants 0; new households/members are 0. No real people, relationships or access grants were seeded.

The entire local suite passed, including 25 new household PostgreSQL checks and synthetic household workflow/person-record tests. Main remains unpublished. Real-account sign-in and desktop/mobile visual acceptance are still required. Family self-service and guardian/check-in authorization are not implemented by this release.

No new advisor findings. Prior intentional RPC-only staff directory INFO and disabled leaked-password protection warning remain documented above, with remediation links. No existing learning, auth, payment or outreach records were changed.

## Department and tag foundation, September 26 UTC / September 25 Chicago

Source implementation saved before live application in commit `e8fe14690f683434c768d9c59f68a43c32bb3f2c` on `champion-sowgo-backend-v1`. Applied migration `department_tags` to the original project `exdocjbmylgxssanymjk`; remote version `20260926032026`. Source filename aligned to that remote version afterward.

Added protected departments, tag configuration, person assignments and immutable assignment/configuration events. Staff screens support paginated configuration and assignments, leader selection, search, archive/restore, optimistic revisions and account/organization isolation. Staff access now includes explicit tag permissions and clearer restricted giving wording. User's giving-access requirement is recorded in the operations and identity specifications.

Validation: full existing suite passed plus 32 PostgreSQL tag/finance-permission checks and synthetic tag UI workflows. A module-card count assertion was updated for the additional module; tag dialog test now waits for the actual asynchronous department lookup before submitting. Actual browser visual and real-account acceptance remain outstanding.

Post-deployment: all four new tables have RLS. Anonymous tag reads, authenticated audit inserts and direct private guard execution are denied. New tables have zero records and existing staff grants remain zero. Profile count remains one. No real department leader, person tag, task or notification was created. Main remains `66591f22d5315d093091b99152c18d43bfcb3893`; no frontend publication.

Security advisor results unchanged: intentional RPC-only staff directory INFO and previously known leaked-password protection WARN. Remediation references: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . No new security findings from this migration.

Tag events are a foundation only. Automatic tasks/email, routing exceptions and workflow activation are not implemented. Do not replay historical assignment events automatically when a worker is added. Guest giving and statement modules remain pending the giving ledger and identity-claim work.

## Reviewed tag workflows, September 26 UTC / September 25 Chicago

Source saved before deployment in commit `64ec801999e198490249ebda31a84aaaa72e712d` on `champion-sowgo-backend-v1`. Applied `tag_workflows` to the original project `exdocjbmylgxssanymjk`; remote migration version `20260926034222`. Renamed the migration source to match after application.

Completed per-tag administrator activation, rule snapshots and timezone due dates, automatic task creation, repeat-assignment controls, held email requests, retry/dismiss/cancel operations, workflow action history, task navigation and the protected Workflows screen. Existing manual task permissions remain intact. Only matching server-created in-transaction runs authorize the automated task insertion path. Task status/assignee changes cancel stale held notifications.

Full suite passed, including 50 new workflow database checks and synthetic workflow UI checks. Failure injection confirmed that a notification-storage error rolls back task and task audit before leaving a needs-review run; retry creates one complete task/notification pair. Tests also cover removed/superseded assignments, revoked leaders, replacement leaders, duplicate suppression, stale revisions, no historical backfill, cross-organization denial, activation authority and manual-task compatibility.

Post-deployment verified RLS on all three workflow tables. Anonymous reads/configuration, direct authenticated run/notification writes and authenticated access to the private executor are denied. Profiles, course enrollments and lesson progress remain one each; organization contacts, staff grants, tasks, runs, held notifications and enabled rules remain zero. No actual leader/recipient has been provisioned, no message was sent, and no sender, worker or schedule is enabled.

Security advisor findings unchanged: intentional RPC-only staff-directory INFO and known disabled leaked-password protection WARN. References: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . No new security findings.

Main remains `66591f22d5315d093091b99152c18d43bfcb3893`. Frontend publication, actual browser visual acceptance, real-account acceptance and email delivery testing are still pending. See TAG-WORKFLOW-OPERATIONS.md for activation, recovery semantics and the remaining delivery work.

## Draft giving destination configuration, September 26 UTC / September 25 Chicago

Dave confirmed separate Authorize.Net/gateway merchant destinations: outreach to SowGo checkout and SowGo merchant account; church giving to Champion Life online checkout and Champion Life Church merchant account. Existing giving links remain untouched until tested replacement checkout receives explicit approval.

Source saved before deployment in commit `87546ff42abbf4f0e674b4c870956f44c363a541` on `champion-sowgo-backend-v1`. Applied `giving_configuration` to `exdocjbmylgxssanymjk`; remote version `20260926035410`. Source filename aligned afterward.

Added two non-secret draft destination plans plus protected fund/form-route setup and finance configuration audits. Added finance.configure permission dependent on finance.read; actual configuration also requires verified staff.manage authority. The staff Giving setup screen supports scoped configuration, routing preview, search, revisions and archival. Composite keys reject cross-organization/cross-destination fund routing. No public giving page/link/checkout URL was edited, and no payment endpoint, credentials, webhook or merchant integration was introduced.

Full regression suite passed, including 33 new database checks and synthetic fund/route/preview UI checks. Live verification confirms four new tables have RLS; anonymous destination reads, authenticated destination updates and audit inserts are denied. Two destination rows are draft plans only. Funds, routes, finance audit events and staff grants remain zero. Profiles, course enrollments and lesson progress remain one each.

Security advisor findings unchanged: intentional RPC-only staff-directory INFO and known leaked-password protection WARN. References: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . No new security findings.

Main remains `66591f22d5315d093091b99152c18d43bfcb3893`; staff UI remains on the development branch. Payment integration, merchant association verification, real-account/browser acceptance and explicit go-live approval remain required. See GIVING-ROUTING-AND-ROLLOUT.md.

## Partner and church participant portals, September 26 UTC

Recorded independent SowGo partner, Champion Life church member and Dream Team areas. One verified login can access all applicable areas across both organizations. Source saved before deployment in commit `551539d6ee610d2b249b7620d9554b6975587e8f` on `champion-sowgo-backend-v1`. Applied `participant_portals` to `exdocjbmylgxssanymjk`; remote version `20260926040812`. Source filename aligned afterward.

Added reviewed portal-only account links, administrator-approved tag mappings, protected resources with draft/published/archived states, and administration audits. Added portal.manage with required people.read and tags.read. Mapped access tags and their activation paths require portal authority; tags never grant staff or finance permissions. Staff resource/configuration screens and the participant My ministry areas screen remain on development. Account linking does not claim gifts or modify CRM account ownership.

Full regression suite passed, including 32 portal database checks, participant/staff DOM checks and 12 safe-redirect cases. Coverage includes overlapping organization access, independent revocation, unpublished resource isolation, unauthorized access/configuration denial, protected tag mutation and fixed existing account-link identity. Actual browser visual and real-account acceptance remain pending.

Live verification: all five portal tables have RLS. Three area definitions seeded; account links, tag rules, resources, portal audits, organization contacts and staff grants remain zero. Profiles, course enrollments and lesson progress remain one each. Anonymous resource reads and account-link RPC execution, direct authenticated account-link insertion and rule updates are denied. No real participant access or messages were created.

Security advisor findings unchanged: intentional RPC-only staff-directory INFO and known leaked-password protection WARN. References: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . No new security findings.

Main remains `66591f22d5315d093091b99152c18d43bfcb3893`. Existing giving links remain unchanged. Broader partnership benefits, media/files, events, messaging and self-service identity claims are future work. See PARTNER-AND-CHURCH-PORTALS.md for access semantics and acceptance steps.
