# Architecture — Outreach Campaign Core candidate

## Bessemer production release composition — October 7, 2026

The production candidate composes accepted Outreach Phase A, B and C on the exact production baseline. Bessemer stays a SowGo-owned campaign instance bridged by immutable legacy registration references; it is not rewritten into a second contact store. The staff dashboard reads decisions/contact data through campaign-scoped RPCs and reuses the existing Getting a Grip enrollment/progress projection. Phase B team/travel and Phase C preregistration/check-in ship as dormant reusable infrastructure without Huntsville publication or Bessemer configuration. Phase D operational prize code is absent; its distinct migration and UI are excluded. See [release runbook](docs/BESSEMER-PRODUCTION-RELEASE-CANDIDATE.md).

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
