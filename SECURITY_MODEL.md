# Security model and release gates

Updated September 26, 2026. Scoped engineering findings, not a security certification.

## Enforced application boundaries

- All 32 public application tables have RLS. Table grants, policies, column restrictions and RPC checks work together; authenticated alone does not authorize data access.
- Organization-scoped grants are checked in the database, allowing revocation without waiting for token refresh. Tags, applications, registrations, affiliations and portal links do not grant staff privileges.
- staff.manage does not imply finance access. Browser staff management cannot grant staff.manage, modify the actor or silently promote another administrator. Financial permissions require explicit grants.
- Public RPC wrappers are invokers; private privileged functions recheck identity/scope with fixed search paths and restricted execution. Never rely on user-editable Auth metadata for authorization.
- Verified-email St. Lucia claims reject anonymous/unverified users and preserve prior ownership. A matching contact email is not proof of ownership of CRM or donor records.
- Church/SowGo financial routing is separate. No browser service key, raw payment credentials or secrets. Consent is independent of membership and task creation.
- Revisions, immutable audit events and composite organization foreign keys protect stale writes and cross-organization references.

## Release findings

1. **Migration history: resolved in version control.** Full historical chain recovered and replayed locally. Production history untouched. See docs/MIGRATION-BASELINE.md.
2. **Leaked-password protection: deferred gate.** Advisor previously reports disabled. Current sign-in is email OTP; do not introduce password auth to clear the warning. Before any password rollout, verify protection and password policy, with approved real-account tests. [Official guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
3. **Directory no-policy notice: intentional.** organization_staff_directory denies direct client table access; scoped RPCs supply eligible staff. Full-chain tests assert no SELECT grant/policy. Do not add permissive policies to silence the advisor.
4. **Data API/private schema: UNVERIFIED.** Project metadata does not supply exposure settings; both session and role/database pgrst.db_schemas settings returned null on September 26. Null does not prove exclusion. Available connector tools do not expose the configuration. Acceptance: inspect the project's Integrations → Data API → Settings exposed-schema list and record it without keys; confirm private is absent. On an authorized isolated preview/test setup, request private via an explicit Accept-Profile header and confirm schema-not-exposed rejection for both anonymous and authenticated sessions, while intended public RPCs work. Never infer exclusion from an empty result or missing-function response. [API security guidance](https://supabase.com/docs/guides/api/securing-your-api).
5. **Composite FK indexes: reviewed, no change.** tag_workflow_notifications(organization_id,run_id) already has a unique run_id index, bounding a parent lookup to one candidate even without the composite prefix. tag_workflow_runs(organization_id,person_id) lacks a dedicated leading index; existing org/status and org/tag/person indexes are not equivalent. People deletion is not exposed; data is sparse. Before large imports/retention jobs, measure EXPLAIN on representative synthetic data and consider (organization_id,person_id) if scans/lock time justify it. No speculative production DDL or new migration added. [Index advisor](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
6. **Unused indexes: preserved.** Sparse/new workload observations do not justify removal. Fixed Auth connection allocation also needs workload-based review.
7. **main protection: recommended, not changed.** GitHub reports protected=false, reconfirmed September 26. Before routine releases, require pull requests, one approving reviewer, resolved conversations, the Backend validation / synthetic-regression status check, and up-to-date branches; block force pushes/deletion and control bypass permissions. Validate exact check name after its first hosted run. Governance changes need separate authorization.
8. **Live acceptance remains open.** Verify Auth URL allowlist, SMTP delivery, account isolation/revocation, mobile/desktop screens, deployment revision, backup restoration and rollback before publication. No initial staff grants were provisioned.

## Browser dependency decision

Nine HTML entry points use https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2. On September 26, jsDelivr's resolver and the npm registry both report **2.117.2**. Recommended candidate: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2 (same loader format). No loader was changed: existing DOM tests mock the client and do not prove actual browser SDK compatibility or which version a cached production browser loaded.

Pin plan: in a separate authorized development package, pin all nine references consistently, verify the downloaded UMD bundle/version and createClient API, run this regression suite, then test email OTP, callback/session restoration, sign-out, claim/progress/notes, RPC/RLS failures and both portals with approved test identities on an isolated preview. Record bundle integrity if adopting SRI. Merge only after browser acceptance; preserve giving links. No unrelated dependency upgrade is needed.

Test packages remain pinned to PGlite 0.5.8 and jsdom 26.1.0 with their existing lockfile. CI actions are pinned to immutable revisions. The latest official changelog was reviewed; current PostgreSQL minor-upgrade/extension advisories require a separate planned upgrade assessment, not a database upgrade in this assignment.
