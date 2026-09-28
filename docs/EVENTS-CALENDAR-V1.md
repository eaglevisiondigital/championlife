# Global Propel Events + Calendar v1

Implemented September 28, 2026 in the existing Champion Life/Supabase runtime. Champion Life is the first tenant, not a hardcoded module boundary. This package is development and isolated acceptance work only; production release and real-account browser acceptance are separate gates.

## Reuse and ownership

Reuse organizations, organization_departments, verified staff assignments, explicit events.view/events.manage grants, reviewed portal_account_links, dated member relationships, ChampionLifeAuth, the staff workspace and explicit public build manifest. No new identity system, payment engine, database merger or historical .NET integration. Champion Life/SowGo remain separate organizations. Department, audience and type names are tenant configuration; no ministry names or actual events are seeded. Existing giving pages, URLs and merchant destinations are untouched.

Staff navigation links to staff-events.html. Native public routes are events.html (upcoming by default), events.html?view=calendar, and event.html?id=SERIES_UUID. org=ORGANIZATION_SLUG selects the tenant; the church site's default is champion-life. Shared module logic is organization-neutral. Existing church branding surrounds original green/cream/gold event layouts; no competitor artwork, styles or implementation was used.

## Database contract

Forward migration: `20260928183137_events_calendar_v1.sql`. The acceptance tool assigned this version; the SQL is byte-identical to the local migration (MD5 70a558b4a73cd8e39c1c26d90b40dfa2). All 18 earlier migrations remain unchanged.

| Table | Purpose |
| --- | --- |
| event_settings | Organization timezone, optional approval gate, revision |
| event_labels | Configurable audience/type labels, active state, revision |
| event_locations | Campus, room, public display name/address, capacity, timezone, private notes, active state, revision |
| event_series | Ownership, content, local recurrence rule, visibility/status, registration hooks and private operations |
| event_occurrences | Stable UUID and series/local-slot-date uniqueness, actual UTC instants, scheduled flag |
| event_exceptions | Independent per-occurrence cancellation/time/location override and private note, revision |
| event_audit | Immutable client-side administrative audit; actor, action, before/after state |

All seven tables have RLS enabled and no browser-role table grants or policies. Guarded RPCs are the only client access. Service-role/trusted server access remains privileged. No permissive policy was added to suppress advisor notices. Composite organization foreign keys protect series ownership, departments, locations, types, occurrences, exceptions and audit references; audience arrays receive explicit same-org/kind/active checks.

Two public SECURITY INVOKER wrappers delegate to fixed-search-path private implementations:

- events_workspace(p_org uuid, p_action text, p_data jsonb): authenticated explicit event staff only. Actions: context, list, detail, save, exception, settings, label, location. Lists return 50 items plus a next-page sentinel; page offset is bounded. Save accepts only defined editable fields and an expected revision. Settings/labels/locations require organization-wide events.manage.
- events_catalog(p_slug text, p_from date, p_to date, p_filters jsonb): anonymous or authenticated safe projection, with id/department_id/audience_id/type_id filters combined by AND. Dates and payload size are bounded. It never returns raw administrative rows.

Private owner-only helpers implement slots, materialization, membership and location overlaps; private.event_schedule is an ungranted invoker view of effective occurrences. Only private.events_catalog is intentionally executable anonymously, because its public wrapper is an invoker. Every other private function remains denied to anon. The regression assertion now explicitly permits that exact signature and continues denying all other private helpers. The private schema must remain outside the Data API exposed-schema list.

## Recurrence and time

Rules: once (including multi-day), daily/every N days, weekly/selected weekdays/every N weeks, monthly by start-day number/every N months, monthly first/second/third/fourth/last weekday, and yearly/every N years. Optional inclusive until-date and maximum occurrence count apply together; whichever limit is reached first wins. Empty weekly weekday selection uses the start weekday. Weeks anchor to Monday. Monthly dates absent from a month and February 29 in non-leap years are skipped, not clamped. The rule's first eligible match on or after local_start is occurrence one.

Each series stores local start/end and an IANA timezone. Candidate dates are calculated in that local calendar; start/end are converted separately to timestamptz, so normal local meeting times remain fixed across DST. Multi-day local duration is preserved, even when elapsed UTC duration changes. PostgreSQL's documented standard-time interpretation handles ambiguous/nonexistent wall times; an interval inverted by a DST transition is rejected and must be adjusted. The UI asks staff to review generated dates. See [PostgreSQL datetime handling](https://www.postgresql.org/docs/17/datetime-invalid-input.html).

Champion Life's organization default is America/Chicago. Other organizations default to UTC until explicitly configured. Events inherit the default on creation unless overridden. Changing the default does not silently rewrite existing series. Location timezone is reusable metadata; it does not replace a series' explicitly chosen timezone. Registration windows entered without an offset use the event timezone; explicit UTC/offset inputs preserve their instant.

Generation is bounded: a save materializes approximately 366 upcoming days; staff detail may request at most 400 days; public reads allow at most 93 days per request, within one year behind/two years ahead of today. All rule expansion is capped at 7,305 days from the series start, interval 1–52, count 1–10,000, and event duration 31 days. Candidate scanning begins at the series start so count limits remain deterministic. Public reads look back 31 days for overlapping multi-day events. More than 200 eligible matching series returns an explicit narrow-filters error rather than silently dropping records.

Materialization is demand-driven, serialized per organization, and upserts by (series_id, slot_date), preserving occurrence UUIDs. It refreshes the bounded requested range on each request; this is not a precomputed global calendar or unlimited cron. Very high traffic or large tenant counts would require measured caching/rate-control optimization before expanding these bounds.

## Exceptions, editing and conflicts

The editor distinguishes **Edit entire series** and **Edit this occurrence only**. One occurrence can be cancelled, moved, retimed or relocated, including a custom public location. Clearing override times restores the series time. Overrides are stored separately; regeneration never clears cancellation or exception fields. Removed series dates with existing overrides remain explicitly retained and visible to staff; unoverridden obsolete dates become unscheduled. Staff can review retained overrides after changing a recurrence rule. Entire-series edits can rewrite unoverridden historical slot timing when that range is next materialized; audit preserves the prior series definition. There is no implicit historical split.

“This and future” is intentionally absent in v1; it requires a proper series split, not a misleading edit of the whole rule. Series and exception revisions reject stale editors. Exception mutation also increments the series revision. Per-org advisory locks and row locks serialize competing staff/catalog generation work. Cross-org reassignment is not an editable field.

Locations can be activated/deactivated, not deleted through the UI. Inactive locations cannot be selected on new saves; existing public schedules retain their display information. A series detail warns about same-location overlapping effective occurrence times across currently materialized schedules, excluding cancelled/archived series and cancelled occurrences. Only a count is returned, preventing disclosure of another department's event details. Warnings do not block publication. Setup/cleanup buffers, custom-text location matching, unmaterialized horizons, resource booking and reservation enforcement are outside this first version.

## Permissions, visibility and lifecycle

| Capability or visibility | Behavior |
| --- | --- |
| events.view | Read staff event details within explicit organization/department scope |
| events.manage | Create/edit/manage lifecycle and exceptions within explicit scope; includes event read |
| Organization-wide grant | All events in that organization; manage can configure labels, locations and defaults |
| Department grant | Only events owned by allowed departments; cannot create/reassign organization-wide or another department's event |
| public | Published safe projection for everyone |
| member | Published safe projection for verified, non-anonymous accounts with an active reviewed tenant link and an active dated member relationship; generic login is insufficient |
| staff | Published safe projection only for explicitly authorized event staff; full administrative detail still requires workspace RPC |
| hidden | Conservative v1 treatment: event staff only, even with a guessed/shared UUID; anonymous unlisted access is not implemented |

Draft/unpublished series never enter the catalog. Ordinary members, title holders, department participants, course learners and finance-only staff gain no event-management authority. Existing assignment, expiry, revocation and department scope rules are checked server-side, independent of frontend controls.

Lifecycle states: draft, submitted, approved, published, cancelled, archived. New records must begin draft/submitted. Draft/submitted may advance to approved/published or archive; approved can publish or return to draft; published can return to draft/cancel/archive; cancelled can return to draft/archive; archived can return to draft. Invalid transitions are rejected. Approval is optional per organization. When enabled, approved content must be published unchanged; approved/published content or occurrence edits must first return to draft. events.manage controls these actions in v1; no distinct approve/publish grant or two-person approval promise is introduced. Approval remains a workflow step rather than separation of duties.

Meaningful changes produce private before/after audit: creation, series edit, status changes, occurrence exception and configuration changes. Event-scoped staff history exposes only action, actor UUID and time, not raw before/after records. Configuration audit is stored for trusted administrative review.

## Public and staff experience

Upcoming is the preferred view: one card per series, next noncancelled current/upcoming occurrence within the next 90 days, optional image, recurrence description, summary, location, department, audiences/type and registration state. Calendar renders a 42-cell month grid, including multi-day spans and cancelled occurrence labels. Department/audience/type filters combine and remain in the URL when switching views. Calendar uses organization timezone; card/detail times use the event timezone explicitly.

Detail focuses on the next current/upcoming occurrence and lists available future dates. If the initial range has none it scans bounded windows up to two years ahead. A series without upcoming dates displays an honest empty state. Embedding uses the same native pages with embed=1 to omit site chrome; list/calendar/filters and event links preserve tenant context. No permanent third-party event iframe or copied static calendar exists. Embedders may link to events.html?org=SLUG&embed=1&view=calendar plus configured filter UUIDs. Host-site iframe sizing and CSP are the embedding site's responsibility; no DNS/header changes were made.

Public output is constructed from explicit safe fields: no internal/setup notes, private contact, audit, revision, actor, permission grants or administrative metadata. Public contact appears only when contact_public is enabled. Text renders with textContent, and external image/registration URLs require HTTPS. External registration uses noopener/noreferrer. Account/org changes invalidate late responses and clear stale staff/modal data. Unavailable backend configuration produces an explicit unavailable state.

Staff editor covers basics, local schedule/recurrence, ownership/audiences/type, location/format, visibility/lifecycle, opt-in public contact, registration hooks and private operations. Generated dates can be inspected in bounded windows with incremental display. Configuration and management controls appear only for authorized scopes; database enforcement is authoritative.

Registration stores none/external/native_future, required, opens/closes, capacity, URL, display cost and payment-required metadata. External links are available only in the configured registration window. native_future explicitly says registration is unavailable. Capacity is descriptive, not booking enforcement; no ticket, payment, refund, registration submission, attendance capture or check-in engine exists.

## Validation and release status

Local full regression: `npm ci --ignore-scripts --prefix tools/backend-tests`, then `npm test --prefix tools/backend-tests` (29 scripts). This includes clean/failed-prefix migration replay, full historical database/RLS checks, redirects, JavaScript syntax, public build, People/Staff, 74 focused Events checks, 22 rollback-only Events SQL assertions and Events DOM coverage. Tests use synthetic data, not production records.

The real browser used actual page assets against a temporary local PGlite database populated only with synthetic records. Verified upcoming/month/detail/embed, mobile 390px and desktop layout, third-Thursday creation October–May, single November cancellation with other occurrences retained, and empty console error/warning logs. This validates UI-to-database behavior locally; it does not replace hosted real-account Auth acceptance.

Acceptance ref bkbmjisprwmkptywtmih received only the new migration. SQL bytes, seven RLS tables, function ACL/search paths and inventory were verified: 19 migrations, 42 public RLS tables, 60 policies, 52 functions plus private.people and the internal schedule view. All 22 hosted rollback assertions passed. Before/after: two original Auth users, zero contacts/grants/human anchors; zero synthetic events/occurrences/locations/labels/audit remain. Only approved timezone defaults persist.

Security advisor: 12 intentional informational no-policy notices for RPC-only tables (seven new); existing leaked-password protection warning is unchanged. No new security warning. [RLS-only notice explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [existing Auth warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No Auth configuration change was made to silence it.

Production, main, giving/merchant routing, DNS and production Supabase remain unchanged. PR #2 remains a draft review vehicle. Commit/push/hosted CI identifiers are recorded in the delivery handoff. Chat should review Events v1 before authorizing Registration + Check-in; implementation of that next package has not begun.
