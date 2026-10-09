# Staff Workspace navigation

## Candidate and boundaries

This frontend package starts at accepted Phase F / PR #12 exact head `7b883ca226ebeaa993a43dcd3a58f15dd8cfc234` on dependent branch `codex/staff-workspace-consolidation`. No prerequisite is merged. No database migration, authorization semantic change, production deployment/configuration, message delivery, Bessemer activation, Huntsville publication or Phase G is included. Existing module controllers remain the authority for data clearing, permissions and mutations.

## Shared architecture

All ten staff pages opt in with `data-staff-workspace` and load `staff-workspace.js` after the established auth/common scripts. The shared script creates one sidebar/header around the existing main element and preserves module roots/controllers. Page HTML contains no sidebar/menu definition. One navigation configuration holds group, label, destination, capability key and pathname match. `.html` and clean route matching are equivalent. No framework or second authentication system is introduced.

`staff-workspace.css` is scoped to opted-in pages. It defines the dark 232px desktop sidebar, gold active parent/child, cream workspace, proportional headings, header, cards and states. A 272px bounded drawer replaces the sidebar below 1024px; the closed sidebar is inert. Opening focuses Close, traps keyboard focus, inerts the content and exposes `aria-expanded`; Escape/backdrop/Close return focus to Menu. Reduced motion and print layouts are supported. Long labels wrap at words. Primary sections use accessible buttons and `aria-controls`/`aria-expanded`. Optional local storage holds group expansion preferences only; the active group reopens on navigation/refresh. Users may explicitly collapse it while viewing the page. Storage failure does not affect access or navigation.

Current navigation: HOME / Staff Dashboard; OUTREACH / Outreach Overview, Opportunities & Pre-Event, Campaigns, Partner Intakes, People & Follow-Up; EVENT OPERATIONS / Team & Travel, Registration & Check-In, Prize Operations, Event Day Command Center. No authorized staff discipleship or administration page exists in this dependency checkout. Learner `my-discipleship.html` is not mislabeled as staff progress. COMMUNICATIONS has no implemented destination and remains absent.

## Permission projection

The shell uses the existing authenticated client and unchanged server APIs:

- `staff_workspace_context`: active/current organization grants. Partner Intakes requires organization-wide `outreach.view`; People requires organization-wide `people.read`. Department-limited grants do not imply organization-wide navigation.
- `outreach_campaign_workspace` context/list: explicit existing admin organizations and server-filtered campaigns.
- `outreach_team_access`: exact current team/travel view capabilities for each accessible campaign; discovery runs at most four requests concurrently.
- Existing registration/prize/Event Day `campaigns` projections: each returns only campaigns passing its module's explicit view capability.
- Phase F pre-event `campaigns`: server-filtered pre-event/host scope. Host-only users see the approved pre-event workspace, never internal legacy campaigns/travel/People/prizes by inference.

A selected campaign narrows tool navigation to that campaign. In-page campaign drill-down updates the shared selection without changing routing/backend behavior. Team & Travel links select an actually authorized campaign because its existing page requires a campaign. Every other module retains its existing campaign chooser. No user metadata, role title, account/email name or presentation label grants navigation. Missing/denied endpoints omit their metrics/tools rather than inventing counts; unexpected failures clear the shell projection. Backend/RLS remains authoritative even if JavaScript is bypassed.

Discovery uses read projections only and rechecks identity before publishing. Auth events discard obsolete requests. Focus, visible-page polling every 20 seconds and newly-rendered module denial refresh the shell projection. Existing protected module content still clears under its accepted guarded request/poll lifecycle; sidebar visibility is never used as a substitute for that clearing. No credentials, claims or private data are persisted by the shell. Only group expansion preferences use storage.

## Staff Home versus Outreach Overview

`staff-home.html` is the new personal workspace landing page. The existing `staff-people.html` remains People & Follow-Up; it is not recreated or redirected. Dashboard actions are permission-filtered. Your outreach work and Upcoming use actual scoped campaign projections. Campaign-level overdue counts are explicitly labeled as campaign tasks, not personal assignments.

`staff-outreach-overview.html` is the program view: campaigns/communities/countries, scoped preparation/readiness and existing decisions/follow-up/Grip progress summary. It does not copy the personal dashboard.

Unavailable metrics intentionally omitted: personally assigned follow-up counts, global approval inbox, aggregate document/training deadlines, unassigned follow-ups and organization-wide new decisions. No matching aggregate API exists in this accepted branch. Existing module pages provide their detailed authorized workflow. Zero is shown only for an available successful projection; endpoint absence is not treated as zero.

## Page inventory

Inventory covers all authenticated staff/admin HTML pages present in the exact dependency, plus the two new landing pages. Older staff pages outside this dependency (for example PR #2-only admin features) are not imported into the accepted Phase F tree.

| Page | Previous shell | Group / child | Retained secondary navigation | Authority | Migration |
|---|---|---|---|---|---|
| `staff-home.html` | New | HOME / Staff Dashboard | None | Any current staff grant/admin or scoped tool projection | Shared |
| `staff-outreach-overview.html` | New | OUTREACH / Outreach Overview | None | Current outreach projections/admin | Shared |
| `staff-outreach-pre-event.html` | Independent sidebar | OUTREACH / Opportunities & Pre-Event | Overview, Your tasks, Agreement, Documents, Training, Event information, Flyers & resources, Contacts, Event packet, Reminders, Onboarding; server-filtered | `preevent.view/manage` or `host.view/respond`; explicit admin for pipeline/templates | Shared |
| `staff-outreach-campaigns.html` | Independent sidebar | OUTREACH / Campaigns | People & follow-up, Preparation, Documents, Campaign setup, Leader access; capability-filtered | Existing campaign `view` and independent actions/admin | Shared |
| `staff-outreach-partners.html` | Older standalone layout | OUTREACH / Partner Intakes | Intake detail / return-to-list buttons | Organization-wide `outreach.view/manage`, independent People/follow-up capabilities | Shared |
| `staff-people.html` | Older standalone black layout | OUTREACH / People & Follow-Up | Contact search/detail/back/status actions | Organization-wide `people.read`, independent `followup.read/manage` | Shared |
| `staff-outreach-team.html` | Independent sidebar | EVENT OPERATIONS / Team & Travel | Applications, Vehicles, Lodging, Meetups & directions, Manifest, Signup setup, Team & travel access | Explicit `team.view/manage` or `travel.view/manage` | Shared |
| `staff-outreach-registration.html` | Independent sidebar; wrong active child | EVENT OPERATIONS / Registration & Check-In | Lookup, Walk-up, configuration/access, CSV/print actions | `registration.view/manage/export`, `checkin.manage` | Shared |
| `staff-outreach-prizes.html` | Independent sidebar | EVENT OPERATIONS / Prize Operations | Pool/session/operator configuration and guarded actions | `prize.view/manage/draw/claim` | Shared |
| `staff-outreach-event-day.html` | Independent sidebar | EVENT OPERATIONS / Event Day Command Center | Overview, Areas, Inventory, Issues, Timeline, Media, access/configuration; filtered | `ops.view/manage`, `inventory.view/manage`, `issue.manage` | Shared |

Pages still using a legacy **staff/admin** shell in this checkout: none. Learner, public registration, household/trip and local-host portal pages retain their distinct approved presentation and are not mislabeled as staff/admin pages.

## Primary, secondary and action classification

Removed all copied primary sidebars. Cross-module Team/Registration links formerly appended to Campaign tabs now live solely in the sidebar. Campaign overview and participant-trip links from Team are contextual actions, not a second primary menu. Module tabs above remain because they change views within one module/campaign. Search, create/review/approve, export/print and back buttons remain actions. No operational mutation or export authority changes.

Existing denial copy and 401/session destinations remain module-specific, with common card visuals. People uses the common Access unavailable panel while retaining its approved revocation message. Partner Intakes preserves the two exact accepted denial messages, title, and existing `staff-people.html` return behavior. Other staff-home denial links now target the actual dashboard. Empty/loading states share scoped card treatment while keeping module messages and authorized actions.

## Adding a future module

Add a legitimate published HTML destination, its allowlisted assets and one configuration entry; derive visibility from a current server permission projection. Extend discovery only with a bounded read projection. Add active-match, direct-URL denial/revocation, mobile keyboard and scoped-navigation tests. Never add a dead placeholder or infer capability from a role label. Preserve the existing module's guards and data-clearing lifecycle.

Phase G can later add COMMUNICATIONS / Inbox & Messages, Campaign Communications, Templates, Delivery & Activity through the same configuration **only when that package and its permissions are authorized**. No Phase G schema, page, provider or delivery behavior is implemented here.

## Verification / release gate

Verification passed: the standard 27-script backend/DOM/site suite; 102 focused Staff Workspace DOM checks; 94 Christmas regression checks; JavaScript syntax and diff checks; the 417-file allowlist build. Disconnected Chrome tests render all ten real HTML/controllers at 390/768/1440 using synthetic fixtures and intercept every request, with open/close/Escape drawer checks, fully-open bounds/inert assertions at phone/tablet, and readable phone Registration/Prize action widths. All 30 page/width combinations pass without horizontal overflow or JavaScript/console errors; 50 screenshots include the open drawers. This is build-stage browser verification, not real-account hosted acceptance. Screenshots/raw evidence remain in the private outer audit workspace and are not in `dist`.

Hosted operational acceptance, user visual approval and production release remain separate gates. Existing CI coverage is extended to the Phase F dependent PR target/new branch; no production build/publish settings are changed.
