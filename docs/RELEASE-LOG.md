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
