## 2026-10-09 — Phase G shared Communications Core

A single tenant/campaign-scoped core consumes existing domain events, with canonical audience projections, versioned plain-text templates, approved sender profiles, explicit preview/confirmation batches, due-only lease/attempt worker and verified callback normalization. The service adapter is separate from workflow/People and can run only disabled or acceptance sink in this candidate. Native external actions remain explicitly unverified. No identity/task/LMS/payment duplication. See [Phase G contract](docs/COMMUNICATIONS-CORE-PHASE-G.md).

## 2026-10-09 — Staff Home acceptance gaps

Staff Home now adds a compact executive outreach snapshot and a preparation-only personal summary using existing canonical guarded Phase F context reads. No backend aggregate, task store, RPC or migration is added. Overview remains the deeper program projection.

## 2026-10-09 — shared Staff Workspace candidate

One opt-in static JS/CSS shell wraps the unchanged module roots/controllers. One nav configuration reads existing current staff/campaign capability projections; no role inference or new backend permission API. A dedicated personal dashboard and separate program overview use existing scoped data, omitting unavailable aggregates. Drawer/expansion, active-route matching, title/page-width and shared state visuals apply to all ten staff pages. See [navigation contract and inventory](docs/STAFF-WORKSPACE-NAVIGATION.md). No framework, Auth/database changes, production deployment or Phase G.

# Architecture — Outreach Campaign Core candidate

## Phase F pre-event extension

The opportunity model now feeds reviewed canonical host Organizations and campaign profiles, the existing immutable workflow/task snapshots, native versioned agreement responses, private document/resource versions, training and held reminder/escalation hooks. Canonical Event Packet projections join existing Phase B travel and Phase E operations; host packets omit those internal sections. One guarded pre-event workspace supports internal and host shells plus a service-gated disabled-by-default interest intake. No separate city CRM/task engine/LMS is created. Migration is local-only; Phase G is not started. See [Phase F contract](docs/OUTREACH-PHASE-F-PRE-EVENT-AUTOMATION.md).

## Phase E Event Day extension

Phase E adds a campaign-scoped operations aggregate beneath the existing Global Propel Outreach Campaign. Immutable published area/checklist/inventory/timeline templates instantiate campaign snapshots, so future packet versions never rewrite event history. Area assignments reference Phase B team members and inventory vehicles; summaries project Phase C registration/check-in and Phase D prize readiness without duplicating their ledgers. Issues, timeline actuals, media references, closeout and immutable history remain within the campaign boundary.

One guarded workspace supplies separate capability-filtered projections and serialized mutations to a responsive staff shell. There is no city-specific schema, general project-management subsystem, medical record store, DAM, duplicate follow-up system or offline sync. Print/CSV is the degraded-connectivity fallback. See [Phase E contract](docs/OUTREACH-PHASE-E-EVENT-DAY.md).

## Phase B Team & Travel extension

Campaign signup/member intake extends existing Outreach Campaigns and references canonical People/Households, reviewed portal identities and existing scoped assignments. Twelve additive RLS tables and narrow workspace/portal RPCs provide approval, roles, travel/lodging and manifests. Campaign row serialization protects both assignments and capacity/status edits. Staff UI and participant own-trip projections use the existing manifest-only site build. See [Phase B contract](docs/OUTREACH-PHASE-B-TEAM-TRAVEL.md).

## Phase A foundations

This isolated branch adds a reusable campaign module to the current released Champion Life/SowGo shared backend. It intentionally does not import the full PR #2 development tree.

Organization → campaign → explicit account assignments is the authorization path. Opportunities become campaigns only through approved atomic action. Canonical People/Organizations and reviewed portal links remain identity foundations; historical Bessemer registrations are linked by references without rewriting data. Existing Getting a Grip enrollment/progress is projected, never duplicated or joined to answers.

Published template versions are immutable; campaigns keep step snapshots, dependencies/conditions/event-relative due rules and history. Documents use a separate private Storage bucket with campaign-derived prescribed object paths. Domain events are held manual hooks, not provider sends. Non-secret staff shell is published through the existing manifest-only `dist/` build.

Future team/travel, household/check-in, prize operations and event areas/inventory must extend campaign scope. Dormant prize ledger/locks establish global-per-campaign one-win integrity without granting client execution. Other products may consume the module contract while preserving owner boundaries; no .NET move, identity merger or database combination occurs.

Detailed relations/API/roadmap and release gate: [Outreach Campaign Core v1](docs/OUTREACH-CAMPAIGN-CORE-V1.md).

## Phase C registration extension

Existing campaign ownership/assignments/audit/held events now host native event household submissions, distinct adult/minor attendees, exact versioned signatures/coverage and individual check-in. Canonical People/Households remain reviewed identities; public intake grants no authority or identity merge. The existing dormant prize participant receives a unique attendee link only at check-in; no second prize identity or drawing operation. New public config is a bounded read-only projection; server-gated guest submission and private staff workspace are separate surfaces. See [Phase C contract](docs/OUTREACH-PHASE-C-REGISTRATION-CHECKIN.md).

## Phase D prize operations extension

Phase D activates the existing owner-only prize integrity ledger through one guarded campaign workspace. Phase C attendee/check-in remains authoritative; the attendee-to-prize participant link is extended with one immutable six-digit identity. Campaign settings, reusable inventory pools, active pool entries, draw sessions and pool locks sit above the original draw/history/win/exclusion tables. Selection and claim serialize on the campaign, the browser never chooses a result, and the campaign-wide win ledger is the permanent one-prize constraint.

Staff, signed-in household and anonymous public display are separate projections. The staff projection carries minimum operational identity/contact; the household projection is limited to the matching verified registration email; the anonymous projection never joins private identity. Held events remain delivery-neutral. See [Phase D contract](docs/OUTREACH-PHASE-D-PRIZES.md).
