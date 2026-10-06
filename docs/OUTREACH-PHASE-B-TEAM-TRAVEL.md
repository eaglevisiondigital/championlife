# Outreach Campaign Phase B — Team & Travel candidate

## Implementation and release state

Phase A was accepted by Champion Life Chat at `098a87b061e7ffad53ae86f76d750a5aacfbc935`. Phase B uses the dependent branch `codex/outreach-phase-b-team-travel`, based on that exact commit, with a draft PR targeting `codex/outreach-campaign-core-v1`. It does not import PR #2, change PR #5's head, or target production main directly. Both phases remain unmerged. Production main is protected at `e1f75f917f9a1e6e16e0b8f9bc5d7b52fbf0a424`.

CLI-generated migration `20261006200021_outreach_phase_b_team_travel.sql` is a candidate, replayed locally only. No hosted migration, account, capability, Auth setting, callback, SMTP, DNS, giving destination, merchant or scheduler was changed. New signup settings default disabled; the migration enables no real signup and changes no Bessemer/Huntsville campaign record.

## Campaign and canonical identity

The existing Organization → Outreach → Campaign model remains authoritative. A team signup belongs to one existing campaign and one verified applicant account. Party/member rows are campaign intake snapshots awaiting reviewed canonical identity, not a separate Person directory. Canonical People and Households remain the source of identity and family membership. A primary can be linked automatically only through an existing active reviewed portal link. Name, email and phone matches never silently merge; staff see candidates and explicitly link. New Person creation requires independent existing `people.read`, `people.create` and `people.update`, a review reason, and no possible duplicate. It creates neither a portal link nor a staff grant.

The primary adult submits one party, with up to 19 spouse/child/dependent/family members. Age, attending versus volunteering, role preferences, transport/lodging preferences, optional available-vehicle details and notes are recorded individually. Attendee-only members cannot receive volunteer preferences or final volunteer roles. Duplicate submit retries return the existing signup.

Family labels grant no authority. Canonical Household linking requires independent People/Household read, explicit reason, active membership for every linked party Person, and the current signup revision. Scoped family review exposes only this party's eligible existing Households. Member guardian review and shared-trip review are separate from canonical membership. An explicit campaign primary/dependent authority record, active canonical Household membership, active Household and current reviewed portal link are required to reuse or share existing dependent data. Household changes and authority revocation remove that access immediately. A separately linked spouse account sees its own member projection, not the family's roster or notes.

## Individual approval and service roles

Lifecycle: `applied`, `under_review`, `approved`, `waitlisted`, `not_selected`, `self_traveling`, `guest`, `cancelled`. Signup never approves. Each review is an explicit single-member operation with reason and revision; cancelled applicants must reopen as applied before approval. Waitlisted/not-selected applicants may also reopen. Official approval requires linked canonical identity, attending, and reviewed guardian context for minors. Staff must release operational assignments/dependent approvals before invalidating approval. Changes have immutable audit history.

Official capacity is a nullable planning target: counts and remaining slots are shown, but no automatic rejection or hard approval limit is imposed. Signup opening/closing and scheduled/open/closed overrides are campaign-specific; there is no global 60-day rule. Existing parties can find their trip after signup closes.

Configurable active roles support preferred, secondary and anywhere preferences. Leadership assigns final roles separately, with optional lead, notes and timestamp. Multiple final roles are configurable; existing multiples must be resolved before restricting the campaign. Approved and appropriately reviewed independent/guest/not-selected volunteers can help without official travel approval. Service roles never grant software permissions.

## Transportation and lodging integrity

Vehicles have custom labels/types, total capacity **including drivers**, passenger capacity **excluding drivers**, active/passenger-carrying/equipment/towing flags, departure, destination and separate participant/internal notes. Driver/co-driver are approved canonical adults with explicit qualification review. License/insurance/certification evidence is a later extension, not a Phase B compliance system. Equipment-only vehicles reject passengers. One primary vehicle assignment per participant/campaign is enforced by a unique key. Total and passenger limits both apply.

Family splits and separate minor supervision require explicit leadership review, retained on the assignment. Removing a guardian cannot strand dependent passengers without reviewed alternate supervision. Independent/self-driving/riding-with-participant/local/not-traveling modes remain available without a vehicle. Applicants cannot spoof an official vehicle mode.

Lodgings hold address/phone, stay window, safe HTTPS map, participant instructions, restricted booking/reference notes and assigned-only or staff-only visibility. Lightweight rooms hold nullable capacity and private notes. Official approval governs assigned lodging. Room count and overlapping `[check-in, check-out)` stays are enforced server-side; occupied locations cannot shift stay windows or deactivate to evade those checks. Removing a guardian room requires dependent release or previously reviewed alternate supervision. No booking/payment engine is introduced.

All operational writes acquire the existing campaign row lock and recheck current capability. Assignment, capacity editing and status changes serialize together; stale revisions fail. Client table writes are never allowed. Real PostgreSQL concurrency tests exercise independent connections rather than mocked or single-connection promises.

## Workspace, portal, directions and exports

`staff-outreach-team.html?campaign=<id>` extends the Phase A workspace with Applications, individual approval, safe identity/family review, final roles, Vehicles, Lodging, Meetups, Manifest, Signup setup and explicit access management. The Phase A overview shows its Team & travel link only after an explicit capability projection. Missing optional Phase B RPC schema leaves Phase A navigation operational.

`outreach-team.html?campaign=<id>` provides signed-in signup and own trip information; without a campaign it lists open opportunities and the user's existing parties. Existing linked members land on their own trip. Shared trip includes permitted venue/host, event time, coordinator, arrival, reviewed own/shared assignments, meetups and existing training status. Approved, self-traveling, guest and independently helping not-selected members receive allowed participant directions. Official meetups are limited to an approved own/authorized member; another approved member in a party cannot elevate a waitlisted viewer. Private booking notes, internal vehicle/room notes, other rosters and unapproved venue keys are omitted.

Meeting points have configurable kinds, time, address, instructions and `participants`/`official`/`staff` visibility. Map URLs require absolute HTTPS without embedded credentials. There is no automatic route planner. Staff manifests group travel parties and filter campaign-side by status, party/canonical Household, role, vehicle, lodging and travel. Team, travel and needs-action CSVs are scoped, formula neutralized and audited; no unrelated People records enter an export.

## Permissions and privacy

Exact scoped capabilities are `team.view`, `team.manage`, `travel.view`, `travel.manage` on existing campaign assignments. Manage requires its corresponding view. Existing verified organization Outreach admins retain appropriate authority. Local pastor/follow-up/view grants do **not** imply any Phase B access. The access editor preserves prior Phase A capabilities, dates and role assignments. It changes no independent People grant.

Team-only views omit travel, hotels and shared trip settings; travel-only views omit applicant email/private intake notes and cannot change approval. A travel manager can inspect a safe traveler projection and assign travel without team-private intake access. Editing shared trip settings additionally requires travel management. All twelve new tables have RLS, direct anonymous/authenticated table access revoked, and internal helper execution revoked. Narrow guarded RPCs derive identity and scope on the server, with current revocation/expiry checks and empty definer search paths. Denial/session loss clears UI content and invalidates late responses.

## Communications and Phase C boundaries

Signup/approval/waitlist/not-selected, vehicle, lodging, role and trip changes prepare existing held domain hooks. Manual reminders cover pending approval, missing vehicle, unresolved rides, missing lodging/role and upcoming departure, using stable deduplication keys. There is no provider integration, cron installation or claimed send.

Every member has an explicit `phase_c_pending` consent integration state. No waiver text, signature, public-event waiver, prize browser operations, event-day command center or Communications Core is built. Existing dormant Phase A prize foundations are only regression-tested.

## Huntsville readiness and next gate

The reusable system supports Huntsville-like operations locally. Exact field capture/mapping for <https://form.jotform.com/241095919780163> remains pending approval. No questions were invented; the JotForm is not replaced and Huntsville is not published. Native infrastructure readiness is distinct from exact form/release readiness.

After Chat review, a separately authorized acceptance package must verify the exact Phase A lineage and applied migration ledger, then apply only this migration to isolated acceptance, provision synthetic campaign/roles/People/Household fixtures without real grants, and run real hosted account/privacy/CSV/revocation/travel tests. Check exact return callbacks only if the established login mechanism requires them; do not broaden Auth redirects or change production. Do not reapply accepted migrations, merge either PR or start Phase C. Production release requires its own later explicit gate.

## Local verification

Full declared backend regression command includes the existing fourteen scripts plus Phase B database and DOM suites. The Phase B suites cover signup, reviewed creation/matching, family authority, individual transitions, explicit capability boundaries, capacity and conflict rules, maps, scoped manifests/exports and held events. Real PostgreSQL tests run 16 independent callers against the final vehicle seat and room space: one success and 15 safe denials each, with 16 overlapping vehicle requests and 14 overlapping room requests in the final local run; same-traveler concurrent room retries yield one row; exactly three successful immutable assignment audits remain. The temporary database is dropped after testing; unrelated databases/servers remain intact.

Chrome visual checks use only the manifest-backed loopback synthetic harness, labeled visibly as disconnected from any backend. Signup, Applications, Detail, Vehicle assignment, Lodging assignment, Manifest and Trip were checked at 390/768/1440; no horizontal overflow or clipped controls and no browser errors. Screenshots/metrics stay in the outer private audit workspace. Local visual/testing evidence does not claim hosted acceptance or release approval.
