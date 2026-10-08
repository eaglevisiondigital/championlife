# Outreach Phase E — Event Day Command Center

## Build boundary

Phase E extends the reusable `Global Propel → Outreach → Campaign` architecture from accepted Phase D head `d899616a81df2a62a2957db074966073310b02c0`. It is campaign-scoped event-day operations, not a project-management product and not a Bessemer- or Huntsville-specific system. The additive migrations were applied only to isolated acceptance project `bkbmjisprwmkptywtmih`; production is unchanged, and neither seeded campaign is activated.

Phase A remains the campaign/decision/follow-up authority; Phase B remains the Person, Household, team, travel, vehicle and lodging authority; Phase C remains the registration, waiver and check-in authority; Phase D remains the drawing-number, selection and claim authority. Phase E references those records and does not copy or replace them.

## Model and lifecycle

`outreach_ops_templates` and its area/checklist/inventory/timeline children form immutable published versions. A campaign instantiates a snapshot into its own operation, areas, checklist items, inventory requirements and timeline. Later template versions cannot rewrite active or completed campaign history. Campaigns may clone, customize and publish a new version without a schema change.

Areas are ordered, active/inactive and repeatable by data. Their lifecycle is `not_started → setup_in_progress → ready → active → closed → cleanup_in_progress → complete`, with explicit `issue` and `paused` paths. Every status transition is validated by the server. A required-area readiness score is calculated from required checklist snapshots; the event threshold comes from campaign template data.

Area assignments reuse Phase B `outreach_team_members`. Lead, backup lead and volunteer are operational labels only. One volunteer has at most one active area assignment, and an area has at most one active lead and one active backup. Assignment does not create a portal link, staff record, platform permission or Person.

Checklist items preserve requiredness, order, dependency, completion actor/time/note, quantity verification and a future attachment hook. Completion/reopen is revision-aware and audited. Media records store safe HTTPS/storage references for photos, videos and documents; Phase E does not build a DAM or store medical records.

Inventory tracks required, available, loaded, on-site, returned, missing and damaged counts, direct delivery, source/owner, critical/return flags, area and Phase B vehicle. Server checks reject negative values, over-loading, unsupported on-site counts, over-return and missing-plus-damaged counts above on-site. Statuses are `needed`, `committed`, `loaded`, `in_transit`, `on_site`, `in_use`, `packed`, `returned`, `missing` and `damaged`.

The issue model is deliberately small: information, needs-attention and urgent severity with open/resolved state, campaign/area, assignee, notes and immutable history. The timeline stores scheduled/actual start/finish, owner, status, notes and delay/issue markers.

Event closeout is distinct from campaign/follow-up closure. It requires required areas complete, required checklist items complete, no open urgent issue and critical inventory accounted for. Closeout writes the held `outreach.ops.event_completed` domain event but never closes discipleship or follow-up.

## Production-packet source mapping

The private Outreach Production Packet was used as the source for the published **SowGo / Champion Life Standard Outreach** template. The migration stores configuration data, not packet files or audit evidence. It seeds:

- 13 areas: Registration, Water / Food, First Aid, Inflatables, Face Painting, Games, Sound / Stage, Altar Care, Prize Area, Bike Area, Winner's Circle, Cleanup and Photos / Video;
- 42 checklist definitions covering setup, staffing, safety, prize handoff, load-out and cleanup;
- 25 inventory definitions covering tables, tents, chairs, coolers/water, first-aid supplies, inflatables/power/safety, face-paint/game/stage/altar/prize/bike supplies and cleanup/media needs;
- 11 configurable run-of-show items from team arrival through setup, registration, activities, message/prayer/prizes, closing and cleanup.

Counts in the source are campaign configuration. Multiple water stations, inflatables, games or other area instances use repeatable area records. The examples do not become universal schema rules. The initial packet's games are configurable checklist/timeline content rather than mandatory global activities.

Registration readiness references Phase C check-in totals. Prize/Bike/Winner's Circle readiness summarizes Phase D configuration and preserves the Phase D claim ledger. Altar Care links operational readiness to the existing Phase A decision/follow-up architecture. Photos/video are reference hooks only.

## Command Center

`/staff-outreach-event-day.html?campaign=<uuid>` is a mobile-first staff shell. It provides:

- readiness, area, checklist, staffing, registration/check-in, prize and alert summaries;
- area cards with lead, lifecycle, required-missing count, issue count and completion percentage;
- area detail with status/location/notes, team arrival state, lead/backup/volunteer assignment, checklist completion/reopen and media references;
- equipment cards with touch-friendly load-in/load-out counts, status and vehicle assignment;
- issue creation/resolution and campaign timeline status;
- print view and a guarded campaign CSV backup containing timeline, areas, leads/volunteers, emergency phone contacts, checklists, inventory/vehicles and issues.

The client polls through the guarded workspace every 20 seconds while visible and not editing. Returning focus rechecks authority. A 401/403 or session change immediately clears protected content. The browser receives no raw table access. At 390px the five command sections use a visible multi-row grid; tablet and desktop retain the horizontal tab row.

## Authorization and privacy

Capabilities are explicit and campaign-scoped: `ops.view`, `ops.manage`, `inventory.view`, `inventory.manage`, `issue.manage`. Manage requires its corresponding view. Existing registration, prize, team, travel, pastor, participant or People roles do not imply Event Day authority. Local host access can be limited to operational areas without exposing travel/lodging manifests, unrelated contacts, staff administration or finances.

Every table has RLS and raw anon/authenticated table privileges are revoked. The public RPC is an invoker wrapper over fixed-search-path private helpers. Every action rechecks the current verified account, assignment effective dates/revocation and campaign capability. Direct/guessed/cross-campaign IDs fail closed. The protected export requires `ops.manage`, is campaign-scoped, audited and formula-neutralized because it contains team contact data.

Audit/history covers template instantiation/publish, area creation/status, volunteer assignment/arrival, checklist complete/reopen, inventory/vehicle changes, issue open/resolve, timeline changes, media references, export, event start and closeout. Historical operation records cannot be updated or deleted. Snapshots avoid unnecessary personal data.

## Concurrency and fallback

The workspace serializes campaign mutations with a transaction advisory lock and uses optimistic revisions for editable records. Real disposable PostgreSQL tests use eight independent overlapping backends plus a separate coordinator. They prove one checklist history transition under duplicate taps, one winner among competing inventory revisions, one issue-resolution transition, one active area for a reassigned volunteer and rejection of every impossible final-count attempt.

Full offline synchronization is intentionally outside Phase E. The supported degraded-connectivity fallback is the printable view plus authorized CSV packet. A future package may add carefully reconciled offline capture; it must retain canonical server revisions, audit and campaign scope.

## Release gate and Phase F boundary

Huntsville can instantiate and customize this template without schema changes, but remains unpublished. Bessemer remains postponed and no operation is instantiated or activated by the migration. No production, Auth, SMTP, DNS, giving, merchant, SowGo `/go` or PR #10 change is part of Phase E.

Isolated hosted acceptance passed against acceptance-only migration ledger versions `20261007220413` and `20261007221722`. It covered the command UI and all configured area categories, local-host privacy, campaign isolation, same-session revocation, scoped formula-safe export/print fallback, closeout/history, multi-tab refresh, 390/768/1440 layouts and five real overlapping-session race groups. The 390px tab clipping found during acceptance was fixed with a mobile-only grid rule and a focused DOM regression. Cleanup restored the operator's prior inactive assignment, removed all active synthetic campaign/area authority, released synthetic area assignments, resolved synthetic issues, inactivated synthetic vehicles/members and retained operational history/checklist/timeline/inventory records.

Phase F is not started. Opportunity/intake, host agreements, pre-checklist/document automation, training assignment, timed communications, final packet automation and campaign communications remain a separately authorized future package.
