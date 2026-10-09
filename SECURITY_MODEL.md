## 2026-10-09 — Staff Home acceptance gaps

The preparation summary uses only authorized campaign IDs from the server projection and exact authenticated-user step assignments. No role inference; batch size at most four; identity/current campaign access rechecked before publishing. Failed/malformed reads omit counts; render epochs prevent stale results after sign-out. Other users, People, finance and internal operations remain governed by unchanged backend permissions.

## 2026-10-09 — Staff Workspace presentation boundary

Shared navigation reads existing live server capability projections; hidden links never authorize operations. Selected campaign scope, department-limited grants, host/participant denial and identity-change stale-response rejection are explicit. Poll/focus/denial rechecks refresh navigation; existing module request/poll guards still clear protected content. Group expansion is the only persisted shell preference. No RLS, permission semantics, grant, migration, session/Auth policy or production change. See [navigation contract](docs/STAFF-WORKSPACE-NAVIGATION.md).

# Security — Outreach Campaign Core candidate

## Phase F boundary

Pre-event and host view/respond capabilities are explicit and independent from legacy registration/People/travel/admin authority. Inquiry creates no identity or permission; reviewed conversion never silently merges churches/People. Narrow host event responses require approved agreement and cannot change internal readiness/security settings. Native workflow gates also cover legacy entry points. Signed agreements and generated packets remain immutable; document review and all canonical mutations serialize by campaign with revision/idempotency checks.

RPC-only RLS tables and exact-path private Storage recheck active/effective/expiry/revocation on every action. External projections omit internal tasks, reminders, events, lodging, finance, broad People and administration. Gateway origin/Turnstile/HMAC contact/network rate controls are service-only and disabled until separate activation. No new secret/client credential, hosted grant or Auth/provider configuration is added. Six local true-overlap races and scoped denial/revocation tests pass; hosted acceptance is a separate gate. See [Phase F contract](docs/OUTREACH-PHASE-F-PRE-EVENT-AUTOMATION.md).

## Phase E boundary

Event Day authority is explicit, current and campaign-scoped through `ops.view/manage`, `inventory.view/manage` and `issue.manage`; Phase A-D, pastor, participant and operational lead labels do not imply it. All Phase E relations use RLS and revoke raw browser access. The authenticated invoker workspace rechecks verified identity, effective/revoked assignment and exact capability on every call, then validates campaign ownership of every area, member, vehicle, item, issue and timeline ID. Same-session revocation clears browser state on the next guarded poll/focus check.

The UI omits inventory/vehicle detail without inventory view and never projects lodging, travel manifest, finance or unrelated contact data. Operational lead assignment creates no account, portal link or platform permission. Export requires ops management because it includes assigned-team emergency phone contacts; it is scoped, audited and formula-neutralized. Media hooks accept safe references only. Server constraints reject impossible counts and closeout gaps. Campaign advisory locks, revisions, immutable template/history triggers and true-overlap tests protect duplicate taps and competing devices. See [Phase E contract](docs/OUTREACH-PHASE-E-EVENT-DAY.md).

## Phase B security boundary

Explicit team.view/team.manage/travel.view/travel.manage are independent from Phase A follow-up and from existing People permissions. Manage requires corresponding view. Team-only users receive no hotel/vehicle/trip-setting records; travel-only users receive no applicant email/private notes or approval authority. Reviewed primary/dependent sharing additionally depends on current canonical membership, active Household and reviewed portal links. Secondary participant accounts receive only their own/reviewed dependent projections. Official travel/lodging requires approval and minor guardian review. All new tables deny raw client access; internal helpers are revoked. Capacity races, scoped CSV, direct-ID denial, revocation and local-pastor privacy are tested. No hosted/production grants or Auth settings are changed. See [Phase B contract](docs/OUTREACH-PHASE-B-TEAM-TRAVEL.md).

## Phase A foundations

All new public tables enable RLS and revoke direct PUBLIC/anon/authenticated access. Public RPCs are invokers; guarded private definers have empty search paths and qualified relations. Verified non-anonymous identity, explicit campaign/organization authority and current active/effective/expiry state are checked server-side. Campaign-only leaders receive no org-wide People grant. Organization admin capability additionally requires active existing staff assignment; no live account is seeded or provisioned.

Canonical linking/contact review additionally enforces existing People permission. Progress is limited to Getting a Grip enrollment and lesson status, through active reviewed portal links or the existing verified historical claim. Course answers/private notes/other modules never enter the projection or CSV. Export is scoped, audited and spreadsheet-formula neutralized. UI clears protected content on denial/session change and discards stale asynchronous data.

Documents are always private, including public-designated metadata. Storage INSERT/SELECT checks exact prescribed path/campaign/capability/restricted-admin access. No client overwrite/delete, no public signed URLs, actual metadata required to finalize and immutable replacement paths/history. File limits are 10 MB and approved MIME types. Scope/expiry applies to requested recipients and training/step assignees.

Prize primitives are owner-only, not callable through application roles or public RPC. Explicit draw assignment is required even for administrators. Campaign lock, pending reservation and immutable unique win ledger prevent multi-pool/multiple/concurrent wins. Eligibility changes cannot override a win. Unclaimed is not won; mandatory explicit policy governs later eligibility. Public future reveal projection contains no names/phone.

No provider messages, Auth/SMTP/DNS changes, new callbacks, production/acceptance migrations or production grants occur in this implementation. Preview build retains production-backend blocking/isolated configuration rules. Private audit/source evidence stays outside `dist/`. Remote rollout requires baseline reconciliation, isolated authenticated/Storage acceptance and separately authorized exact grants/callbacks/release.

## Phase C boundary

New tables have RLS and no direct client privileges. Guests can read only enabled campaign configuration and submit through a verified server gateway; no private helper or roster/search access. Staff registration view/manage/export/check-in require separate current campaign capabilities, never follow-up/People/travel inference. Immutable signatures snapshot explicit guardian coverage, version/text/name/time; corrections are appended and checked-in identities cannot be mutated. Idempotent campaign-serialized operations protect capacity, duplicate attendees/signatures/check-in. Contact similarity grants no identity, account or permission. Private export/print neutralizes formulas and excludes signatures/internal IDs. No production or hosted configuration changes. See [Phase C contract](docs/OUTREACH-PHASE-C-REGISTRATION-CHECKIN.md).

## Phase D boundary

Prize view/manage/draw/claim capabilities are explicit, current and campaign-scoped. Old draw, registration, People, pastor, follow-up, team and travel authority do not imply them; manage/draw/claim require prize.view. Every operational table remains RLS-enabled with no direct anon/authenticated table privileges. The authenticated workspace rechecks authority after campaign serialization. Direct RPC attempts cannot re-enable a claimed winner; immutable unique ledgers enforce the rule below the UI.

The anonymous display RPC is an intentional fixed-search-path projection and returns only campaign/organization branding, prize label, state, time and six-digit number. It never joins attendee/registration identity. Household access requires a verified account and exact normalized email match to the campaign registration; no public reference lookup is added. Operator contact and backup exports require prize authority, are campaign-scoped/audited, and CSV cells are formula-neutralized. Held hooks contain no provider credentials and claim no delivery. No acceptance/production grants or configuration are included. See [Phase D contract](docs/OUTREACH-PHASE-D-PRIZES.md).
