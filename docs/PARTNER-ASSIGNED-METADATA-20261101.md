# Assigned Partner backend source candidate — 2026-11-01

This is a local source candidate, not an installed or enabled Partner portal. The website-only first staff release remains the exact frozen PR61 source and has no dependency on this migration. No public build allowlist, staff page, account, provider setting or existing migration changes here.

## Real backend boundary

The CLI-generated `20261101154618_partner_assigned_metadata_boundary.sql` reuses exactly three existing reviewed #29/#35 draft table contracts: Partner churches, explicit Partner users and explicit record assignments. The source commit/file/hash and omitted material are in `tools/partner-platform/assigned-backend-provenance.json`. It does not import the old broad central-administrator OR rule, issuer RPCs, seeds, raw-contact RLS, financial intake authority, contact mutations, export or pastoral notes. No old branch history is merged.

New `partner_assigned_metadata(campaign, assignment?)` derives the actor from Auth. It requires an exact current session ID owned by a confirmed, non-anonymous, non-deleted, non-banned user; an unexpired existing campaign `view` assignment; an unexpired explicit `partner.view` grant; and the exact assigned worker on a decision registration associated with that campaign. Event registration capability never suffices. Tables have RLS and no direct client or service-role table privileges; only authenticated fixed RPC execution is available. No exposed mutation or grant path exists.

The RPC locks security-dependent rows `FOR SHARE`, including Auth user/session, campaign, campaign assignment, Partner church/user/record assignment and campaign decision association. Revocation/delete conflicts serialize with these locks. Repeatable-read and serializable stale snapshots abort instead of using stale permission values. Effective dates use wall-clock time, and the earliest expiry is rechecked before returning metadata. PostgreSQL transaction errors must be treated as denied/retry-required; a retry must obtain fresh authority, never reuse a prior result.

Projection is limited to assignment ID, campaign ID, organization ID, Partner church ID, status, revision, `personId: null` and `identityStatus: unverified`. There are no names, contact details, prayer/decision content, household data, financial data, learner answers or notes. The existing campaign registrant `person_id` field does not prove independently reviewed decision-to-Person identity. Even an active Person-to-Auth portal link cannot establish that missing provenance. Person resource actions stay unavailable pending the separately reviewed existing Issue50 identity-linkage integration; no duplicate CRM or automatic matching is introduced.

The existing shared staff backend gains a fixed read method using the same pinned nonproduction Supabase client, fresh `getUser` checks and session-generation invalidation. It accepts only campaign and optional assignment IDs, validates/minimizes the response, clears on any denial, rejects stale responses and retired callbacks, and cannot invoke arbitrary RPCs. Discovery continues to report the assigned portal unavailable. This source method is not in the public website allowlist.

## Authority and operational gates

There is deliberately no public or service-only operational issuance fallback. A separately reviewed administrator mapping and immutable grant/reassignment/revocation audit workflow are required before any real Partner grant. The earlier broad permission rule is not accepted by this package. The read-only endpoint creates no successful-change audit; immutable existing audit history is untouched.

The existing financial Partner intake reviewer remains a separate route requiring both authorized organization finance and Outreach review permission. Campaign workers gain no financial intake access.

Genuine JWT signature verification, live session retirement, PostgREST runtime behavior, independently verified identity evidence, hosted RLS and cleanup remain untested. Local test sessions are fictional. Existing Issue62 custody, mailbox, maintenance and independent cleanup approvals remain controlling; no new paid environment is implied. Do not install this migration as part of the schema-free PR61 website release. A separately reviewed migration/rollback and genuine hosted acceptance package is required.

## Local verification

- `node --test tools/outreach/shared-staff-backend.test.mjs tools/partner-platform/*.test.mjs`
- `node tools/partner-platform/assigned-backend.native.mjs`
- `node tools/partner-platform/assigned-backend.browser.mjs`
- `node tools/partner-platform/staff-intake-review.browser.mjs`

The native harness creates an empty disposable Unix-socket PostgreSQL cluster and fictional rows, then stops/removes it in `finally`. The new migration is appended explicitly only by its dedicated test; accepted baseline migration ordering remains unchanged. The browser harnesses intercept all network traffic and perform no external authentication or communication.
