# Operations Administrator security candidate — 2026-10-22

LOCAL ONLY. Based on production main `53beb5d5c0d1ee259155128e4e282d18b4195623` (25 production migration sources, 49 public RLS tables and 29 organization keys). This package is not the 87-capability Unified Outreach candidate. It does not install or activate that candidate, NMI, communications, Event Day or a volunteer scheduling module.

## Forward migration and access contract

`20261022201357_operations_admin_security.sql` contains four reviewed function replacements, two private predicate helpers, three restrictive policies, two existing SELECT-policy corrections and an additive household audit CHECK correction. It seeds no users, role templates, assignments, campaigns or data. Existing capability lists, function owners/ACLs and historical migration files remain unchanged. Exact existing function-body sentinels stop before changes if another package has replaced this baseline. The migration is atomic and must not be reapplied or applied on top of PR #34/#35 without reconciliation.

The existing donation-commitment workspace now requires BOTH `outreach.view` and `finance.read` for every action. The queue's raw submission, amount, frequency, contact linkage and review history stay finance-restricted. General follow-up SELECT/UPDATE and event history additionally exclude tasks linked to donation intakes unless the caller has current finance permission. People list/detail/filter/mutation and relationship audit exclude financial-intake-linked partner relationships from nonfinancial readers. Ordinary contact details, volunteer/member relationships and nonfinancial partner relationships remain operational; matching an email does not merge identities. These records describe commitments, not proof of payments.

Organization-level campaign operations use existing keys, resolved against the exact campaign organization:

| Existing organization permissions | Campaign operation |
| --- | --- |
| `registrations.view` | `registration.view` |
| `registrations.view` + `people.export` | `registration.export` |
| `registrations.view` + `registrations.manage` | `registration.manage`, `checkin.manage` |

This requires a current active, verified staff assignment and current effective grants. It covers existing/future campaigns in each explicitly assigned organization, never arbitrary tenants. Existing per-campaign grants remain supported. Organization-level operations do not produce a campaign-admin row and cannot configure intake, publish waiver wording, enumerate assignments or manage permissions.

Campaign `assignments`/`access` require both an existing organization campaign manager and independent `staff.manage`. `access` explicitly rejects the actor as target. Context provides `can_manage_access`; the UI shows Access only when that flag is true. General People permission administration retains its existing self-grant, delegation, scope, audit and temporal controls. No operation can confer staff administration on this role.

Household audit now adds exactly `household_created`, `household_updated`, `household_member_added`, `household_member_updated` to the existing CHECK expression. Original kinds remain valid. Existing triggers, actor attribution and record immutability are preserved. Household audit SELECT requires both People and Households read; household IDs are no longer incorrectly evaluated as Person IDs. The already prepared People INSERT RETURNING SELECT correction is reconciled from the local `platform-contact-read-compatibility` package, without copying its Unified Outreach dependencies.

## Proposed role, not seeded

Separate explicit organization assignments are required for Champion Life Church and SowGo. The reviewed current-production subset is:

`people.read`, `people.create`, `people.update`, `people.export`, `households.read`, `households.manage`, `followup.read`, `followup.manage`, `registrations.view`, `registrations.manage`, `outreach.view`.

No `finance.*`, `staff.view/manage`, `outreach.manage`, `care.read`, `people.notes.*`, `portal.manage`, tags, courses, dormant event/form keys or `communications.send`. No wildcard new capabilities. The owner must separately accept effective/review/expiration policy and exact verified subject before grants. A role label alone grants nothing. An operator may not run approval/assignment steps against their own identity.

The simple production People UI supports contact review and task status; the existing backend supports more People/Household operations than this UI exposes. This package repairs those contracts without importing a replacement staff dashboard. Registration UI supports scoped reporting, CSV, walk-up management and check-in/reversal. Volunteer/member relationship labels are not volunteer scheduling. Communications and full Event Day remain separate acceptance work.

Children, guardian and signed-waiver evidence remain within explicit campaign registration authority; raw registration/attendee/signature tables remain denied. Signed evidence cannot be rewritten. No pastoral/private-note authority is granted. Operational free text must not be used for confidential pastoral notes or financial records.

GiveHub personal donor login is independent from staff permissions. This package neither inspects nor changes external provider roles; an owner/provider check must independently establish that the identity has no GiveHub/NMI administrator access. No donor/payment ledger is deployed in this production baseline, so these tests cannot claim hosted NMI ledger coverage.

## Release and activation gates

1. Review this exact candidate and forward migration. Inventory *all existing* `registrations.view/manage` and `people.export` grants: their new organization-level campaign projection is a semantic permission change even though no row is added. Review financial-intake staff who will now need separately approved `finance.read`; do not grant it automatically.
2. Revalidate exact deployed function sources, migration ledger, schema ACLs, policies and retained-record fingerprints. Stop on divergence. Preserve existing source-to-hosted ledger aliases; never bulk-push or replay historical migrations to reconcile their filenames. Apply only the new reviewed migration. Publish/merge/deploy/apply only after separate explicit production approval, with backup/rollback evidence and exact-head CI. Prefer removing the new role's grants to contain access; never roll back to financial leakage/self-escalation or disable auditing.
3. Only after independent identity confirmation and messaging approval, send the prepared existing-login invitation. No manual email verification override, shared credentials or new auth mechanism. Confirm actual Auth UUID, email-confirmed, nonanonymous, nonbanned/nondeleted status and reviewed organization-specific contact/portal links.
4. Separate exact activation approval must name both organizations, Auth UUID, 11 enumerated keys, dates and independent authorizer. Existing People Staff RPC can apply reviewed assignment + individual grants or a reviewed template in each organization. Do not insert broad database-role grants. Capture before/after and existing RPC audit evidence.
5. Verify actual signed-in allowed/denied paths after release under separately authorized supervised acceptance. On failure revoke assignment/grants first; retained JWTs must fail database checks. Retain immutable history. Do not use account deletion/ban alone as proof of authorization revocation.

Tests: complete backend/site suite; native PostgreSQL upgrade/security; existing native registration and Huntsville suites; six eight-worker database races; offline Chrome/WebKit at 390/768/1440px including delayed successful responses after denial. Offline browser fixtures are not hosted Auth/account acceptance. No message, user, real permission, hosted SQL, deployment or financial activity occurs during these tests.

Supabase RLS/ACL guidance reviewed: https://supabase.com/docs/guides/database/postgres/row-level-security . Changelog reviewed for relevant changes: https://supabase.com/changelog . No SDK/auth transport changes are introduced.
