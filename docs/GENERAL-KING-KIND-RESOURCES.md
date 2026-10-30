# General King Kind resources — local candidate

Status: implemented and tested locally only. No hosted/production acceptance or approval.
Base: 734c9811e92219509a25b174b0d5bfd5850c5315. Separate from Issue #50/#51 and recovery candidates.

## Public experience

Proposed entry: https://sowgo.org/king-kind. New /king-kind/ site page uses the existing approved outreach layout, actual logo/book/Lockliel artwork and Champion Life charcoal/gold palette. No city or attendance requirement. Required: name, email and explicit resource-delivery consent. Phone, prayer, interest and separate ministry updates are optional and never prechecked. The existing course dashboard and private reader remain the destinations; no automatic enrollment, lesson progress, ministry decision, People link or staff permission is created.

The existing Supabase browser client requests verification only after a valid user submission. OTP verification is supported. A magic-link return validates the session; if no registration was saved, the user completes the short form again. Form/prayer/code data is not retained in browser storage. The provider's template must actually supply the selected link/code; no claim is made that current production OTP templates or redirects are configured for this route.

Signed-in email mismatch requires explicit local sign-out. Authoritative getUser is used before writes and after the response. Success requires both verified identity and the database receipt. Rejected, expired or uncertain responses never display accepted registration. Reload uses a safe own-status RPC. Logout and pageshow revalidate; no reader access is inferred from browser UI.

## Database boundary

Reviewed forward SQL candidate: supabase/release/general-king-kind-resources-candidate.sql. This is intentionally a release candidate, NOT an applied or ledger-numbered migration. Assign a new forward migration with the approved CLI/history procedure at release preparation; never replay existing production history.

New private RLS tables: app_private.general_resource_registrations and general_resource_audit. No direct anon/authenticated SELECT/write grants, including operational staff. Public RPC general_resource_registration delegates to a fixed-search-path security-definer helper. Only verified nonanonymous auth.uid identities can register or retrieve their own boolean/reference status. No target user/campaign parameter is accepted. Email must equal the independently verified Auth email. There is one row per Auth UUID and unique request key. Auth-row locking serializes same-identity retries; registration and actor-attributed audit insert are atomic. Audit update/delete is prohibited. A retry does not rewrite prior personal details or opt a person into marketing. Revoked registrations cannot self-restore.

The eligibility helper adds an OR branch for the verified general registrant UUID. The original Bessemer/Huntsville email/consent branch remains unchanged. The private bucket, single permitted PDF object, SELECT RLS policy, 900-second signed URLs, licensed PDF checksum and personal-use download acknowledgment are unchanged. Existing issued signed URLs can remain usable until expiry; downloaded personal-use copies cannot be remotely recalled. No claim of immediate byte revocation is made.

Optional prayer is not exposed to campaign staff, search, exports or course APIs. There is no new prayer-management or outbound messaging feature. Retention/erasure and any future staff ministry access require separate policy and implementation review; do not repurpose resource consent for marketing. Audit/data cleanup must preserve approved evidence and use a reviewed process, not cascade-delete accounts.

## Release prerequisites and sequence

1. Independently review source, SQL ACLs, privacy notice/retention, current baseline drift and candidate hashes. Confirm the current live helper/policy matches the assumed baseline before any replacement.
2. Choose an isolated acceptance target with exact project guard, current schema reconciliation, approved synthetic identities/mailboxes, credential custody, recovery and evidence-preserving cleanup. Existing recovery staffing/provider gates are not bypassed by this package. No hosted execution is presently authorized.
3. Separately approve bounded sandbox installation, synthetic real Auth/OTP delivery and actual private Storage tests. Verify anonymous/unverified denial, eligible general/legacy access, exact-object restriction, downloaded checksum, licensing, revocation, account-switch/expired-link behavior and real iPhone/Android checks. Do not send messages to real registrants or use the protected licensed PDF outside its approved custody workflow.
4. Resolve sowgo.org route ownership. Prefer its existing approved redirect approach to the Champion Life /king-kind/ route so Auth and My Discipleship remain on the existing origin. Do not assume cross-domain localStorage sessions transfer. Review exact Auth redirect allowlist and template changes; do not enable wildcards. Local _redirects does not by itself configure an independently hosted SowGo domain.
5. After hosted PASS, request separate exact production approval for the new forward SQL, minimal website assets/reader explanatory copy, domain route and any explicitly reviewed Auth redirect/template configuration. Existing deployment workflow only. No giving, campaigns, grants, recovery, registration or course migrations.
6. Apply reviewed forward SQL before exposing the form. Verify ACLs, baseline rows/policies, reader access and audit atomicity. Then deploy only reviewed website candidate; verify real public route without unauthorized test registrations.

## Containment / rollback

Do not auto-delete new records or immutable audits. Reviewed containment SQL revokes the two new RPC entry points and restores only the previous eligibility function. Tested locally: legacy readers still eligible, general access denied for new signed URLs, all records retained. Revert the new website/route through the reviewed deployment rollback without rolling back unrelated releases. Already issued 900-second URLs can expire naturally; an emergency requiring broader Storage containment needs its own approved procedure. Reopening registration must be separately reviewed, not accomplished by rerunning a creation migration.

## Tests and evidence limits

`npm ci --ignore-scripts --offline --prefix tools/backend-tests`
`npm test --prefix tools/backend-tests`
`npm run test:general-resources-native --prefix tools/backend-tests`
`SUPABASE_SDK_PATH=<verified cached SDK> EVIDENCE_DIR=<private output> npm run test:general-resources-browser --prefix tools/backend-tests`

Browser suite uses actual Chrome/WebKit, pinned actual Supabase SDK, synthetic intercepted Auth and real new SQL in disposable PGlite. Native PostgreSQL proves six-connection concurrency. These do not prove genuine provider emails, hosted sessions, actual Storage delivery or physical-device saved-profile autofill. Private evidence/screenshots/seals stay outside public repository/build.
