# People and Staff Access v1

## Mapping before implementation

| Concept | Reuse / extension |
| --- | --- |
| Human | New private identity anchor; existing organization_people remains the tenant contact projection, not a second directory |
| Learner profile | Existing profiles, course_enrollments and lesson_progress; no copying learner answers/notes |
| Account link | Existing reviewed portal_account_links; no email-based automatic CRM linking |
| Organization | Existing organizations; Champion Life and SowGo remain separate |
| Relationships | Existing Auth-bound organization_affiliations retained; add dated contact relationships for people without accounts |
| Ministry | Existing organization_departments; add direct contact affiliations independent of tags |
| Staff assignment | Extend organization_staff_directory with contact, active and effective/expiration fields |
| Grants | Extend organization_staff_permissions with dates, department scopes and template provenance |
| Templates | New organization-scoped data; materialized grants, no authority from role titles |
| Audit | Extend organization_admin_events; immutable actor/before/after events |
| UI | Extend the existing staff workspace; preserve unrelated module screens |

## Authorization contract

Existing permission naming stays: people.read/update map to people.view/edit; finance.read/configure map to finance.view/manage; discipleship.read maps to courses.view. New reserved capabilities do not imply those future modules exist. Active verified account, active staff assignment and active explicit grant are required. Null department scope means organization-wide; a nonempty UUID array means those departments only. No inheritance or explicit-deny overrides in v1: absence, revocation, inactivity or expiry denies. Legacy modules accept organization-wide grants only until they implement resource-specific scope checks.

staff.manage remains non-delegable, trusted-provisioned authority. Managers cannot edit themselves or administrator targets. Delegated permissions must be within the actor's own capability, department set and effective interval. Organization-wide staff management controls assignment activation; department managers can change grants only within their department scope. Financial permissions require separate explicit grants and possession of those same finance capabilities by the grantor.

Human anchors contain no cross-tenant personal data. Existing contacts receive separate anchors rather than guessing identity by email. Trusted identity reconciliation can reuse an anchor across organizations; ordinary staff cannot discover or merge another organization's humans. Organization contact edits never overwrite another tenant's contact projection. Portal links remain organization-scoped and reviewed.

## Operations and scope

`staff_workspace_context()` exposes only the caller's effective organizations/grants. `people_workspace(org, action, payload)` uses a public invoker wrapper and a guarded private implementation. Actions: context, list, detail, update, relationship, affiliation, assignment, grant, role, remove_role, template. New tables have RLS and no direct authenticated DML or SELECT privileges; access goes through these operations. Contact columns retain their existing restricted RLS grants.

People visibility follows an organization-wide `people.read` grant or an active affiliation in a permitted department. Person-level edits require the corresponding `people.update`. Only organization-wide contact editors may change relationships or department affiliations, preventing a department editor from moving people into their own scope. Department lists and affiliations omit departments outside the caller's scope. Staff details need `staff.view` or `staff.manage`; private assignment reasons and full before/after access snapshots require organization-wide staff authority. Department viewers receive limited audit metadata. Audit writes record actor, target, before/after assignment/grants, scope, operation and time. Clients cannot mutate audit records.

All staff mutations serialize by organization and check the assignment revision. Contact edits use the existing updated_at concurrency check; templates have their own revision. Turning an assignment off revokes existing grants; turning it back on does not restore them. Expired grants/assignments and revoked reviewed account links cease authorizing calls without waiting for a JWT refresh.

The original grant primary key remains `(organization_id, user_id, permission)`: one explicit grant per capability, optionally covering several departments. Applying another template or explicit grant for the same capability replaces that row's scope/dates/provenance. Removing a template revokes only rows still attributed to it. This is deliberately not additive role inheritance. Editing a template never changes existing grants. The interface labels templates containing finance; the database also requires the grantor to hold every delegated capability and the requested scope/duration. No role templates, department names, real staff assignments or financial grants are seeded by this migration.

Existing explicitly granted staff without a contact link retain their prior authority through a compatibility assignment. This is migration compatibility, not a new provisioning path. New UI assignments require a reviewed link to a verified, non-anonymous Auth account. The legacy staff editor remains a guarded adapter for reviewed unscoped grants and rejects scoped/dated/template records so it cannot erase their restrictions. `staff.manage` remains trusted-provisioned and cannot be delegated through either editor.

## UI and capability boundaries

The existing Champion Life staff page loads `staff-people-v1.js`; list/search/pagination and person sections extend its green/cream design. Filters cover contact name/email/phone, dated contact relationship (including outreach participant), permitted department, portal status, staff status and authorized course enrollment. Existing account affiliations are displayed in Connections; they are not automatically converted into new contact relationships. The enrollment filter and progress summaries require a reviewed link and `discipleship.read`; only course/lesson status is exposed, never worksheet answers or private notes.

Add Person and contact history/household/follow-up entry points remain available with their existing organization-wide permissions. Legacy modules intentionally reject department-only grants until they implement resource-specific checks. The People UI supports department scopes now; accepting a reserved permission key does not build a future module.

Requested capability mapping:

| Requested concept | Stored key |
| --- | --- |
| people.view / people.edit | people.read / people.update |
| courses.view | discipleship.read |
| finance.view / finance.manage | finance.read / finance.configure |
| people.notes.view / people.notes.manage | Same keys, reserved for a future restricted-notes feature |
| staff.view / staff.manage | Same keys; staff.manage is non-delegable |
| events, registrations, outreach, forms view/manage; courses.manage; communications.send | Same keys, reserved; no new event, messaging or form engine |

The minimal human anchor is reusable across tenant relationships, but an identity reconciliation/merge workflow is not part of v1. No automatic cross-organization matching, global human directory, shared database or historical .NET integration is added. Departments and template labels are organization data. Champion Life/SowGo branding, configured organizations and future reviewed assignments stay separate from reusable authorization logic.

## Validation — September 28, 2026

- `npm test --prefix tools/backend-tests`: 27 scripts, including the unchanged historical suites, two full migration replay modes, syntax, redirects, site build and new People tests.
- New database suite: 56 focused checks plus 20 rollback-only acceptance assertions. Includes active assignment, explicit permissions, department/organization isolation, self-elevation, finance, templates, expiry/revocation, direct RLS, legacy helper compatibility, audit immutability and portal-link protections.
- New DOM suite: list/search/filters, details/sections, grant scope/revision updates, restricted Staff Access, finance separation, access-loss clearing, stale responses and actual main-workspace navigation with retained creation/related tools.
- Local synthetic browser sanity at 1280×900 and 390×844: People/detail/Staff Access render, mobile overflow corrected, no warning/error console entries. Browser data was mocked; this is not an authenticated hosted UI acceptance claim.
- Isolated acceptance branch `bkbmjisprwmkptywtmih`: supported connected migration applied as `20260928172557_people_staff_v1`. The uncommitted local filename was aligned with the assigned remote version; all 17 historical files stayed unchanged. Stored SQL matches the file (MD5 `a26a3063333816fb70feb8a9406369f2`). No history repair/reset/rebase was needed.
- Hosted database: 35 public tables, all RLS enabled; private human table also RLS; 60 policies, 44 public/private functions; zero anonymous private-function execution and zero unsafe private definer search paths. The same 20 acceptance assertions passed using authenticated/anon roles in a rollback transaction. Before/after: 2 existing Auth users, zero grants, zero contacts; no synthetic organizations or human anchors remain.
- Security advisor: five intentional RLS-without-policy INFO notices for RPC-only/private tables. Existing leaked-password-protection WARN remains outside this package's Auth scope. [RLS notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy); [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

The test SQL is `tools/backend-tests/people-staff.acceptance.sql`; it is not a migration or production seed. Run it only on an explicitly authorized isolated environment. Real-user staff provisioning, Auth/browser integration acceptance, release approval and production migration remain separate gates. Chat should review this package before authorizing Events/Calendar.
