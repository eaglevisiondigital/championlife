# Church Events staff source integration

Source-only successor to production main `999f4a75eeb8e4a05580dc603dda39ba64eb0409`. This recovers the existing Events v1 application from `5bfe40c0d2d3f82b2f7d0bbce9ed3b76e0e95e4e`; it does not create a second event or registration system.

The new `staff-events.html` uses the existing ChampionLifeAuth and staff-session modules, accepted staff navigation/Propel credit, and exact accepted Supabase 2.118.0 package URL/SRI. The original Events form, recurrence, schedule, exception, review and configuration controls remain backed by `events_workspace`. Current `events.html`, Christmas Dinner capture/pricing/GiveHub, registrations, People and all existing staff pages are unchanged. The public information link leads to the existing static page; this candidate does not mount a dynamic public event catalog or claim newly edited events appear there.

## Existing backend dependency — not installed by this package

The exact original `20260928183137_events_calendar_v1.sql` is preserved in `tools/church-events/fixtures/` for isolated compatibility tests, not in the production migration directory. It adds the previously approved seven Events tables and original `events_workspace`/`events_catalog` contracts. Current production-main source has neither this SQL nor the Events RPC. Exact production catalog reconciliation and a separately reviewed target-specific release are required before enabling this staff page. Historical acceptance described in EVENTS-CALENDAR-V1.md applies only to its historical package; it does not transfer to this composition.

Existing organization/department-scoped events.view/events.manage permissions remain authoritative. Staff status, People permissions, finance access or an Outreach campaign assignment cannot substitute. No grants are created. Publishing remains an existing server action for explicitly authorized event managers; there is no new permission vocabulary or invented second reviewer. No live event is published here. Native registration remains unavailable in this recovered Events-only contract; capacity is descriptive and no inventory promise, payment or booking is made.

## Privacy correction during integration

Old forms retained after navigation could obtain a fresh navigation token when submitted. Controls and form handlers now capture the original principal, organization and navigation generation when rendered. Detached controls fail before any RPC. Each RPC checks the current account before submission and again after the response. Late successful responses are discarded after retirement. A late explicit denial still clears current protected state for the same principal and organization; an old account/organization denial cannot clear separately authorized current scope. Explicit authentication/authorization denial clears all protected list, editor, organization and mutation state. Native Escape/close, account changes, logout, pagehide/back navigation, missed Auth callbacks detected on focus, and shared staff workspace clearing retire the view. Backend authorization remains the final authority.

## Verification and remaining gates

The source-matched current-main migration chain plus exact original Events SQL is replayed using disposable PGlite. Original Events checks and rollback assertions cover scope, publication visibility, revisions, recurrence/timezones, exceptions and audit behavior. Chromium/WebKit desktop/mobile tests cover draft creation, review submission, occurrence cancellation and adversarial session/navigation behavior. Browser Auth/RPC fixtures are fictional, not genuine provider evidence. Native PostgreSQL, real Auth, exact target/schema acceptance, protected preview, recovery/cleanup and separate release approval remain required. No production SQL, permissions, deployed page or provider configuration changes occur from these tests.

## Explicit organization handoff — November 4

The isolated Events route now honors one explicit `?org=<organization UUID>` only
when the existing staff context grants Events access to that exact organization.
Unknown, malformed or duplicate hints fail closed; they never silently open the
first alternative organization. No hint retains the existing authorized default.
Selecting another organization updates the route, so a same-account refresh keeps
that selection; account changes must independently authorize the requested scope.
The module's signed-out link returns through the existing shared login to the
fixed Events path and optional validated organization, never arbitrary `next`
parameters or fragments. Shared Auth, global logout, login validation and the
frozen backoffice sources are unchanged.

This fixes a demonstrated handoff defect: the previous editor ignored `org` and
opened the first granted organization even when another was explicitly requested.
Focused Chromium/WebKit desktop/mobile tests cover exact-scope requests, denied
hints, account changes, pending replies, retained controls, refresh and safe return
URLs. Existing Events navigation/session regressions remain applicable. The
original Events PR91 source is preserved; this is a separately reviewable source
successor, not a shared-menu mount, installation, real grant or provider acceptance.
Existing Events SQL, managed-target, recovery and genuine Auth gates still apply.

The same review also reproduced a transport-error privacy gap: if a detail request
rejected after the actual account changed without an Auth callback, the previous
account's list remained visible. The RPC rejection path now freshly verifies
identity, then rechecks the original principal/organization before clearing state.
Missing/changed identity, failed verification or replaced Auth/client retires the
protected view. A temporary error for the same valid account does not erase its
legitimate list; an old account's error cannot clear a newly authorized account.
This does not retry uncertain mutations or replace server permission enforcement.
