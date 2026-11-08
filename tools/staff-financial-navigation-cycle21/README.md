# Existing financial review navigation

Source-only successor to Staff122 `0b7af2b1bed98a3944fdd714f21b9017cf0d1d0b`.
A financial-only worker with existing organization-wide `outreach.view` AND
`finance.read` could open Partner review directly but Staff home rejected every
organization because its module inventory omitted the existing financial link.

The existing exact predicate and route now participate in that inventory. The
same entry supplies the home card and existing sidebar ID/label. Other modules,
People authority, finance/outreach separation and current-session reauthorization
are unchanged. No new backend permission or operation is introduced.

Permanent tests use actual pages and hash-verified SDK2.118.0, intercept all HTTP,
and cover both browser engines at mobile/desktop widths. Missing, split-org and
department-scoped grants remain denied; revocation/account replacement block the
existing reauthorized navigation. `REVIEW_BASE=0b7af2b1bed98a3944fdd714f21b9017cf0d1d0b`
runs the same first expected-success assertion against original source and fails.

The exact-source verifier binds the complete prior tree and the narrow recipe;
historical guards retain their original assertions through validated immutable
projections. Builds compare all430 public outputs and only the shell changes.

Original Staff122 CI16PASS/1shutdownFAIL remains INCOMPLETE, cause UNKNOWN. No CI
retry, genuine hosted Auth/RLS/target acceptance, recovery, deployment or release
is implied. Global/Partner provenance and campaign dual-authority writer gates,
Communications sending OFF and separate release authorization remain unchanged.
