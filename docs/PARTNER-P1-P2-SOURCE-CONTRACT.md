# Partner P1/P2 — source-only relationship reader

Status: implemented nonpublic synthetic-port candidate. Not a deployed Partner portal or permission grant. Partner remains the third context of the existing shared Church/Outreach login. No new identity store, table, permission registry entry, RPC, provider configuration, transport or public asset is introduced.

## Existing source / permission matrix

| Concept | Existing authoritative source | Boundary / P2 treatment |
| --- | --- | --- |
| Verified portal principal | Shared Auth principal; staff shell session invalidation | Trusted `getPrincipal` port, verified active exact user/session/epoch; no JWT user-metadata trust |
| Person | `private.people` canonical anchor; scoped `public.organization_people.human_id` | Project organization-person ID only after independently verified binding; no global person enumeration |
| Household | `public.households`, `public.household_members` | Explicitly authorized canonical reference or null; no members/guardian/contact inference |
| Ministry relationship | `public.person_organization_relationships` | Exact scoped relationship reference; tags/name/email never authorize or link |
| Partner interest | `public.outreach_partner_intakes` | Preserve origin/status/revision and canonical `person_id`; original raw intake stays private |
| Organization / campaign | `public.organizations`, `public.outreach_campaigns` | Require exact organization and campaign, no wildcard or Bessemer fallback |
| Worker assignment | Existing campaign authorization and separately reviewed decision-assignment drafts | No existing generic Partner record grant assumed. Proposed trusted `authorize` port must establish exact principal/org/campaign/intake assignment |
| Financial partner | Existing financial outreach review and Giving drafts | **Excluded:** no donations, commitments, settled gifts, receipts, statements, balances, MID or bank data |
| Contact / tasks / pastoral / learners | Existing independently restricted systems | **Excluded:** no contact fields/actions, task titles/notes, pastoral records, child data or lesson answers |

Inspected migrations: `20260926024742_household_records.sql`, `20260928172557_people_staff_v1.sql`, `20261004055336_outreach_partner_intake_v1.sql`, `20261004230453_outreach_partner_gateway.sql`, `20261022201357_operations_admin_security.sql` and campaign foundation `20261016201932_huntsville_registration_foundation.sql`.

The installed-source `outreach_partner_workspace` requires `outreach.view` AND `finance.read`, and returns contacts, raw submissions and commitments. It has organization-level financial review semantics. **It is not a safe ministry Partner reader and is not called by this package.** Intakes have no campaign column; the future authorized provider must establish a separately reviewed authoritative campaign association. Do not infer campaign from URL, tags, contact details or context selection. The existing finance review remains unchanged.

## Executable contract

`tools/partner-platform/relationship-reader.mjs` exports a dependency-injected, read-only controller. `proposed.partner.assigned-relationship.read` identifies a proposed port capability, not an installed Supabase permission. Trusted provider inputs must be bound server-side to the shared authenticated user; never construct grants from browser/caller JSON. The public caller supplies only three selection UUIDs.

The provider must independently establish current user/session, effective/expiry/revocation, exact organization/campaign/intake assignment and revision, verified identity evidence, organization-person/relationship and optional household bindings. `readProjection` must itself enforce authoritative database authorization before retrieving any record. `authorize` must read current authoritative state, not cached JWT claims or client assertions. The second authorization after projection retrieval verifies the assignment/bindings remain identical and valid. This does not replace database/RLS transaction guarantees or immediate server session revocation.

The allowlist returns only canonical scoped references, linked status, revision, source site and submission timestamp. It never loads a directory or computes totals over unassigned records. Unknown linkage fails closed; names and emails are neither input nor output. References remain protected data despite absence of names.

Every `open` invalidates/aborts earlier work. Stale promises return `unavailable` rather than another selected record. Snapshot copies prevent mutable provider results and caller selection changes redirecting an in-flight operation. Provider errors are sanitized. No console logging, persistence, mutation API or network transport exists.

## Future shell and provider requirements — not yet implemented

- Read state through `getState`; call `invalidate` synchronously on logout, account/campaign/context changes, explicit authorization denial/revocation and pagehide. Clear mounted/detached protected DOM immediately. Abort is advisory; generation/principal checks remain authoritative against late promises.
- Do not retain returned records elsewhere. This nonpublic controller cannot erase copies retained by another component; future DOM integration needs independent cross-tab, bfcache and retained-handler browser tests.
- Bind principal events to the existing shared shell, not a second sign-in. Authorization cache invalidation and expiry timers belong to that separately reviewed integration.
- Review and implement least-privilege, assigned-record-only backend projection and association provenance separately. No fake permission names or broad finance RPC fallback.
- Test genuine provider Auth, RLS, expiry/reassignment/revocation, two campaigns/organizations and independent cleanup only under separate authorization.
- No production rollout or real-person processing follows from synthetic tests. No child/guardian or pastoral contact access is authorized.

Run: `node --test tools/partner-platform/relationship-reader.test.mjs`.
