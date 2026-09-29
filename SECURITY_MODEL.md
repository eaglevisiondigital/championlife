# Security model and release gates

## Registration/Check-in v1 security — September 29, 2026

Seven new tables use RLS with no direct browser grants/policies. Acceptance now has 49 public RLS tables, 60 policies and 62 functions. Anon can execute only the existing Events safe endpoint and the new exact registration_public safe endpoint in private; all registration helpers remain owner-only. Public wrappers are invokers and both guarded private implementations have fixed empty search_path. Hosted ACL/search-path checks passed.

Registration permission is explicit and department-scoped. `registrations.view/manage` are reused; `checkin.view/manage`, `registrations.restricted` and `registrations.override` are added to the canonical allowlist without granting them to anyone. Restricted answers require registration read authority plus the separate restricted key; check-in-only staff see no answers. Lists/public confirmations omit answers, internal account links, audit and routing data. Question sensitivity/type/scope/options cannot change after answers exist. Response edits and capacity overrides are audited without raw answer values.

Anonymous submissions cannot select person IDs, grant access, set status/payment/routing or enumerate registrations. Optional verified reviewed portal identity links only the current registrant; matching email/phone alone never establishes identity. Walk-in People creation needs separate organization-wide people.read/create authority and rejects possible name/email/phone duplicates for manual review. Same-tenant FKs, exact input allowlists, bounded payloads, UUID idempotency, shared Events locks and optimistic revisions protect cross-tenant, overbooking, replay and stale edits. Attendance history prevents attendee deletion; cancellation requires active attendance to be reversed first.

All 31 local regression scripts, 74 Registration checks, DOM flows and native PostgreSQL independent-session races passed. All 17 hosted rollback assertions passed; two pre-existing Auth users and zero contacts/grants/events/registrations/attendance remain. Browser verification used isolated local SQL and synthetic identities, not real hosted Auth. No production or Auth settings changed.

Acceptance security advisor: 19 intentional INFO RLS-without-policy notices (seven new RPC-only tables, twelve existing) and the unchanged leaked-password-protection WARN. Keep deny-by-default tables; do not add permissive policies to silence [the no-policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Password rollout remains gated by the existing [password-security finding](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Public launch still requires hosted account/browser acceptance and operational abuse/retention review; this package does not claim a completed production security release.

## Events/Calendar v1 security — September 28, 2026

Seven new event tables deny direct anon/authenticated access and have RLS with no client policies. Guarded RPCs enforce active explicit events.view/events.manage and organization/department scope. Shared configuration requires organization-wide management. Composite foreign keys, allowlisted save fields, expected revisions and serialized writes prevent tenant reassignment and stale changes. Administrative history remains private.

Only the explicit events_catalog safe projection is callable anonymously (public invoker plus exact private implementation). The prior blanket anonymous-private-function regression assertion now permits only that signature, continuing to reject every other private helper. Private schema exclusion remains required. Published public fields are constructed explicitly; notes, operations, permissions, private contacts and raw audits are never serialized. Linked member eligibility requires a verified account, active reviewed tenant link and current member relationship. Hidden UUID knowledge does not confer access. Staff scope is enforced independently of visibility.

Acceptance SQL and all 22 rollback checks passed; 42 public RLS tables, 60 policies, 52 functions, fixed definer search paths and table/function ACLs verified. Local full regression, 74 focused Events checks, DOM isolation tests and synthetic browser flows passed. No test events, contacts or grants remain. Advisor shows 12 intentional RPC-only no-policy INFO findings and the unchanged leaked-password WARN; [notice rationale](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). No Auth changes. See [Events contract](docs/EVENTS-CALENDAR-V1.md). Hosted real-account acceptance and production release remain separate gates.


## People/Staff v1 security — September 28, 2026

The new accepted development scope uses active verified staff assignments plus explicit current grants, with organization/department checks in RLS and guarded RPCs. Ordinary relationships, ministry participation, registrations, course enrollment and portal links never grant authority. Staff/finance defaults remain deny. `staff.manage` remains non-delegable; neither actor access nor administrator targets can be changed through the UI. Delegation is bounded by the grantor's owned capability, scope and expiry. Assignment disable revokes grants; re-enable does not resurrect them. Reviewed account-link revocation stops person-bound authority.

New RPC-only relationship/affiliation/template tables and private human anchors have RLS with no client policies or direct table access. Historical direct reads and privileged helpers now require effective organization-wide grants, so department grants cannot escape via older modules. Scoped audit/details redact unrelated grants and internal reasons. Audit writes are immutable to clients. No learner notes/answers are added to staff summaries.

The isolated acceptance migration and 20 rollback-only SQL checks passed. Local tests add 56 focused authorization cases, full historical regression and DOM clearing/isolation tests. Verified 35 public RLS tables, private.people RLS, 60 policies, 44 functions, zero anon private execution and fixed private definer search paths. No test staff/grants remain. [Contract and evidence](docs/PEOPLE-STAFF-V1.md).

Advisor results: five intentional INFO notices for RLS-enabled RPC-only/private tables; existing leaked-password-protection WARN remains. [Notice explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Auth settings were not changed. Local browser validation used synthetic mocked data; authenticated hosted People UI acceptance and production release remain separate. Earlier security findings below retain their historical dates and are not new work authorizations.


September 26 publish follow-up: hosted synthetic-regression passed on 3fd026acd27940e9b5e9c2d09e136a27bd55200a. Auth URL allowlist and private Data API exclusion remain unverified. Netlify previews are public; branch deploys currently disabled. Frontend preview hosting would not isolate the configured live Supabase backend. Approve test accounts/data scope before login or mutation acceptance. Root publishing requires artifact review before preview exposure. Existing Dream Track functions contain a fallback access code; review that protection without changing production in this package. No Netlify/Auth/grant/schema settings were changed.

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

## Preview-readiness follow-up

The explicit public manifest and dist/ output now exclude source docs, migrations, tests, tooling and server source. Preview builds reject the production URL/key, require canonical non-production Supabase URLs and modern publishable keys, and visibly block the client otherwise. This prevents fallback; Work must still verify key/project identity and provision only approved isolated fixtures. Production Auth, data/schema and deployment settings remain unchanged. See docs/PREVIEW-ACCEPTANCE.md.

## September 27 bootstrap correction

Historical migration recovery alone did not prove fresh managed initialization: the synthetic fixture silently provided the optional automatic-RLS helper. Tests now start without it, execute the checked-in bootstrap, reproduce/recover SQLSTATE 42883, and verify exact function/policy parity under managed-like defaults. Bootstrap revokes all client/PUBLIC/service-role execution immediately, keeps the captured fixed search path, rejects drift and populated/initialized targets, and changes no production history. A separate replay without the event trigger proves explicit application RLS. See docs/MIGRATION-BASELINE.md for provenance, operational guards and hosted verification requirements.
