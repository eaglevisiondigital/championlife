# Implemented architecture

## Dream Track invitation UX — October 1, 2026

The existing Auth email adapter now selects an exact invitation-specific login callback. Conditional Auth templates preserve general signup/sign-in content and use the existing Auth secure link/code; no separate invitation sender or identity system is introduced. After Auth, the dedicated invitation page calls existing `claim_pending` (provider-accepted verified-email invitations) or `claim_invite` (copied token), then renders start/resume/completed state from the existing course snapshot. No database or progression change. See [Dream Track](docs/DREAM-TRACK-V1.md).


## Dream Track v1 extension — September 29, 2026

Current acceptance/development inventory is 57 public RLS tables, 60 policies and 73 functions, plus the existing private identity/schedule structures. Eight new course-bound tables extend existing enrollment/progress/answer/account identities; no disconnected LMS or product database merge is introduced. [Dream Track contract](docs/DREAM-TRACK-V1.md) covers the seven existing videos, exact question bank, guarded RPCs, invites, code and final-meeting badge.

Learner mutations serialize on the existing enrollment row. Numeric watched-segment unions, server-time bounds and per-lesson video-session tokens support exact watch thresholds and resume. Mastered answers survive missed-only retries; immutable attempts retain submitted value/version/result/remediation. Staff final-meeting updates additionally check completion revision; one durable badge can be revoked/reactivated with audit. Enrollment/badge never creates staff, member or portal authority.

The existing Grip stylesheet/layout is reused without changing its engine. My Discipleship adds a separate Dream section. Explicit public shell/assets are included in the manifest, while question keys, service code and private artifacts stay excluded. Old Dream cookie gating/fallback is retired in development; authenticated course RPCs provide access authority. The acceptance-only Edge email adapter uses existing Supabase Auth email with exact preview callback and verified-email continuation; no new SMTP provider or production activation is introduced.

## Registration/Check-in v1 extension — September 29, 2026

Current development/acceptance inventory: 49 public RLS tables, 60 policies and 62 public/private functions, plus existing private people/schedule structures. [Registration contract](docs/REGISTRATION-CHECKIN-V1.md) describes seven added tables and ten added functions. Events, organizations, departments, staff grants, People/account links, payment destination references and the static public build are reused.

A registration is a registrant contact snapshot and lifecycle; attendees are separate named participants with optional tenant People links. Attendance is a durable attendee/occurrence record, independently reversed and audited. Enrollment scope is selected per event and frozen after its first registration. Occurrence enrollment consumes that date's attendee capacity; series enrollment consumes one shared series bucket and permits separate attendance on each retained date. Pending and confirmed enrollments occupy places. All operations serialize with the existing Events per-organization advisory lock, then use row/revision checks; event edits and registration/check-in mutations share the lock.

Public `registration_public` and staff `registrations_workspace` invoker wrappers delegate to fixed-path guarded private implementations. Alongside existing events_catalog, registration_public is an intentional anonymous private safe-endpoint exception. Other new helpers and raw tables remain inaccessible to browser roles. A UUID request key and payload hash enforce exact submission replay; a random reference is confirmation, not a registration lookup credential. Department grants and separate restricted-answer/override permissions are checked server-side.

Native pages extend existing Champion Life/Kingdom Propel styling and Events navigation. Question controls are bounded reusable primitives, not a general Forms engine. Payment state/destination/intent references remain server-controlled future hooks; no charge or message provider is connected. Champion Life supplies branding/configuration/data; reusable Global Propel concepts stay in this repository without a product database or IP merger.

## Events/Calendar v1 extension — September 28, 2026

Current development/acceptance inventory: 42 public RLS tables, 60 policies and 52 functions, plus private.people and private.event_schedule. [Events contract](docs/EVENTS-CALENDAR-V1.md) defines the eight added functions and seven tables. Existing organizations, departments, People/Staff grants, reviewed account links, Auth and public build are reused unchanged.

Series store local calendar rules and event timezone. Persisted occurrences use UTC instants and a stable series/local-date key; separate exceptions survive regeneration. Owner-only bounded expansion supports daily/weekly/selected-weekday/monthly-date/ordinal-weekday/yearly schedules, inclusive end/count limits and multi-day spans. Demand-driven materialization serializes per organization and preserves overridden removed dates. Native list/month/detail pages and the staff editor share the same guarded data source. Original layouts extend existing Champion Life/Propel styling.

Public invoker RPCs delegate to fixed-path private functions. events_catalog is the sole intentionally anonymous safe-projection private implementation; all administrative tables and other private helpers remain inaccessible to anon. events_workspace enforces existing organization/department grant semantics, revisions and audited lifecycle/exception writes. No permanent provider iframe, second static event model, new runtime, payment processing or product database merge is introduced.


## People/Staff v1 extension — September 28, 2026

Current development/acceptance inventory is 35 public RLS tables, 60 policies and 44 functions, plus private.people with RLS; older counts below describe the earlier baseline. See [People/Staff v1](docs/PEOPLE-STAFF-V1.md) for the audited reuse mapping and RPC contract.

`private.people` supplies a permanent minimal identity anchor; `organization_people` remains the tenant contact projection. Existing contacts receive independent anchors, never inferred email matches. New dated contact relationships and department affiliations work without Auth accounts; existing Auth-bound affiliations remain intact. Staff assignment extends organization_staff_directory and grants extend organization_staff_permissions. Reviewed portal links bind new assignments to verified accounts. Financial permissions are explicit and independent of titles/membership.

Public invoker RPCs delegate to guarded private implementations. Organization-wide grants or active permitted department affiliations govern contact access. Historical modules read an internal effective organization-wide grant projection, preventing scope/expiry/assignment bypass through old helpers. Role templates materialize explicit grants with provenance; one row per capability preserves the existing key. There is no role inheritance or automatic propagation after template edits. Staff mutation revisions, serialization and before/after audit record changes.

These are reusable organization-neutral capabilities in the current Supabase runtime. Champion Life/SowGo organizations, labels, branding and later approved assignments are configuration; no product database consolidation or .NET runtime migration occurs.


Static HTML/CSS/JavaScript is served through GitHub/Netlify. netlify.toml builds an explicit public-file manifest into dist/ and configures existing Dream Track edge protection; existing Netlify helpers also support media. Browser clients use a publishable Supabase key and authenticated sessions. Never put privileged credentials in frontend code.

Supabase owns Auth, PostgreSQL application records, RLS and RPCs. The audited project has 32 public tables, 60 policies and 35 public/private functions; no Edge Functions or storage buckets were present in the onboarding audit. This is not a claim that all platform configuration is validated.

## Identity and courses

Passwordless email OTP powers discipleship login. Auth identity, learner profile and course enrollment/progress/answers are distinct. St. Lucia registration starts without an account; the public claim RPC delegates to a private implementation that checks verified non-anonymous email, protects existing ownership and serializes claims. Contact email alone is not authorization. Account-specific local drafts, blank-answer sync and cloud notes extend the existing course foundation.

## Organizations and relationships

Champion Life and SowGo are separate organizations. A person may have overlapping church, outreach, learner, donor, partner and volunteer relationships. Organization people/households/affiliations are not interchangeable with Auth accounts or global identity. Explicit organization staff grants govern operations. Reviewed portal account links plus configured tags grant participant content access, not staff or finance access. Household descriptions are not guardianship verification.

Staff workflows use RLS, composite organization foreign keys, database revisions and audit events. Tag workflow tasks exist; notification requests remain held/canceled, with no sender. Giving configuration is draft routing only, with separate church/SowGo merchant destinations. No new checkout engine exists.

## RPC pattern

Public application RPC wrappers are invokers. Privileged implementations and authorization helpers live in private with fixed search paths, explicit identity/permission checks and restricted EXECUTE grants. The optional project-bootstrap rls_auto_enable helper is the public SECURITY DEFINER exception and is not executable by browser roles. Private must remain outside Data API exposed schemas; configuration verification is still open. Directory reads are scoped RPC-only.

## Reuse boundary

Broadly reusable church/ministry capabilities should be designed so Champion Life can consume Global Propel platform capabilities rather than permanently hardcoding Champion Life-specific logic when practical. This does not select a shared runtime or authorize migrating to the historical Global Propel .NET repository. Product data/IP, organization identity, merchant accounts and deployment boundaries remain separate until an explicit architecture decision defines integration contracts.

Historical migration recovery and the synthetic platform prerequisites are documented in docs/MIGRATION-BASELINE.md. Module documents remain the detailed source of implementation contracts.

## Preview environment separation

See docs/PREVIEW-ACCEPTANCE.md. Production browser defaults remain unchanged. Deploy previews/branch deploys generate a separate public config from two preview-scoped variables; missing/invalid/production-target values produce a visible blocked state with no Supabase client. Only the static artifact is published; source docs, migrations, tests and server-function source are excluded. No preview backend is provisioned by the build.

The optional automatic-RLS project creation setting is not inherited as migration SQL by fresh branches. Isolated provisioning must run supabase/bootstrap/automatic-rls.sql before resuming the unchanged historical chain. See docs/MIGRATION-BASELINE.md; this is a separate guarded provisioning stage, not an eighteenth historical migration.
