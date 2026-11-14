# General 6 AM prayer King Kind signup — narrow release candidate (NOT LIVE)

Target outcome: SowGo `/king-kind/` -> Champion Life `/king-kind-signup.html` -> verified email sign-in -> first/last name registration -> private King Kind reader -> existing 13-lesson course.

## Why this is separate
- No Huntsville event registration and no decision-for-Christ claim.
- No adult-ID or guardian evidence workflow.
- No donor, giving, staff, partner, church membership, or outreach campaign assignment.
- King Kind PDF remains in its private Storage bucket. Exact file/object restriction is unchanged; only the verified-user *eligibility* predicate gains an independent general-resource path.

## Candidate file scope
1. `supabase/migrations/20261029235955_general_king_kind_resource_registration.sql` (review-only)
2. `king-kind-signup.html`
3. `assets/js/general-king-kind-signup.js`
4. `tools/site-build/public-files.json`
5. `tools/backend-tests/general-kingkind.test.mjs`
6. `tools/backend-tests/package.json`
7. This document.

SowGo draft PR #6 has been prepared to link to the Champion Life signup page. Neither PR is eligible for deployment before the integrated flow passes acceptance.

## Required before any activation
- Reconcile with the previously accepted local Resource Registrant candidate `6d5730bf0034bbb138999ce8cab97ce150d525fe` and independent King Kind reader correction `5c84a42f25aadfbf526baf0dbf1c9bcf0b5ec89a`. Prefer the accepted implementation where it is available; do not deploy two overlapping registration schemas.
- Pin/vendored Supabase 2.118.0 client with independently confirmed SHA-256/SRI. The draft HTML has an exact version URL but SRI is not yet evidenced.
- Native disposable PostgreSQL RLS tests: anonymous/unverified deny; registered verified allow only exact book; outreach-qualified user still allowed; unrelated user deny; renamed email/changed account isolation; no unauthorized Storage list/write; no staff access.
- Real local Chromium/WebKit flow: email code and link callbacks, account switch, logout, form validation, duplicate signup, course enrollment, reader and download, mobile layouts.
- Verify database migration ancestry and the private Storage policy definition; do not overwrite unrelated changes.
- Confirm privacy notice, retention and anti-abuse controls; do not enable email/SMS marketing.
- Obtain exact release approval after independently reviewed preflight. No hosted acceptance, database migration, PR merge, deployment or live access is authorized by this draft alone.
