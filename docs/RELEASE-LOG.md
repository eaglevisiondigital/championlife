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
