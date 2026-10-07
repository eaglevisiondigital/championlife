# Current build state — Phase C registration/check-in candidate

## Bessemer production release candidate — October 7, 2026

Isolated branch `codex/bessemer-production-release` starts at production `e1f75f917f9a1e6e16e0b8f9bc5d7b52fbf0a424` and intentionally cherry-picks accepted Phase A/B/C only. Phase D, Phase E, PR #2, acceptance configuration and synthetic fixtures are excluded from release behavior. The accepted Bessemer bridge, scoped dashboard, existing Getting a Grip projection, follow-up, exact ten-column CSV and native contact actions are retained. Release polish surfaces Wants to Know More, registration date, last activity and a detailed Bessemer follow-up/task panel, and adds a Global Propel / Outreach link from Staff People. See [release candidate runbook](docs/BESSEMER-PRODUCTION-RELEASE-CANDIDATE.md).

Read-only production verification found the five A/B/C migration versions absent and preserved a safe baseline of six existing Bessemer rows. No production migration, mapping, account, grant, deployment, Auth, SMTP, DNS, giving, merchant or SowGo change has been made. Exact staff emails and explicit production-write authorization remain required.

Chat explicitly accepted Phase A and Phase B and authorized Phase C build only. This branch, `codex/outreach-phase-c-registration-checkin`, starts at PR #6 exact head `79404bb5648af269bbaea1604aed4891c507e2c3` and targets its branch as a dependent draft PR. No prerequisite merge, production change or Phase D work is authorized.

Implemented: configurable native guest household registration, idempotent individual adults/minors, immutable versioned family waiver/signatures/coverage, separate consent, safe reference, scoped staff lookup/edit/walk-up/per-attendee check-in/reversal, private CSV/print backup and dormant prize/held event hooks. Migration `20261007073021_outreach_phase_c_registration_checkin.sql` is CLI-generated, additive and local-only; no acceptance/production application or Edge deployment. No real campaign is enabled or Huntsville published. Bessemer decisions, JotForms, SowGo /go, Auth/SMTP/DNS, giving/merchants and production remain unchanged.

Local verification: all 19 backend scripts, 92 final Phase C database/security checks, 29 gateway checks, 35 DOM checks and 94 Christmas Dinner checks passed. Five local PostgreSQL race groups each proved 8 independent overlapping workers plus coordinator; final capacity was 1 success / 7 safe denials. All 24 Chrome screen/width combinations at 390/768/1440 passed. Syntax/diff checks and the 396-file allowlist build passed.

Local verification results and the exact source mapping/release gates are recorded in [Phase C contract](docs/OUTREACH-PHASE-C-REGISTRATION-CHECKIN.md). Exact JotForm wording/options and approved real waiver/consent text are pending before campaign activation. Next gate is Chat Phase C build review, then separately authorized isolated hosted acceptance. Phase D remains NOT STARTED.

## Historical Phase B candidate snapshot

The following is retained as build-stage history; its pending Phase B acceptance hold is superseded by Chat's explicit acceptance and Phase C assignment.

# Current build state — Phase B Team & Travel candidate

Phase A is **accepted by Chat** at `098a87b061e7ffad53ae86f76d750a5aacfbc935`; PR #5 remains open/draft/unmerged. The authorized Phase B implementation uses dependent branch `codex/outreach-phase-b-team-travel`, targeting `codex/outreach-campaign-core-v1`, with that exact starting commit. Production main stays `e1f75f917f9a1e6e16e0b8f9bc5d7b52fbf0a424`; PR #2 and the SowGo QR candidate are untouched.

Implemented: verified campaign signup, family intake with canonical reviewed People/Household reuse, individual approval/independent states, role catalog/final assignments, configurable signup window/planning capacity, vehicles/drivers/passengers, rooms/lodging, meetups/directions, scoped manifests/CSV, own/authorized party trip portal, held events/manual action queue and explicit team/travel capabilities. No Phase C implementation.

Migration `20261006200021_outreach_phase_b_team_travel.sql` is CLI-generated and **locally tested, not applied to acceptance or production**. It also restores existing Household audit kinds omitted by a baseline check constraint. Native signup defaults disabled; no real campaign/account/grant/provider/Auth/DNS/giving/merchant change is made. Exact Huntsville JotForm field capture remains pending; Huntsville is not published.

Local verification: all 16 declared backend scripts passed, including 88 Phase B database/security, 25 Phase B DOM, 102 Phase A campaign, 21 campaign DOM and 23 dormant prize checks. Two real PostgreSQL races used 16 independent callers each (1 success/15 safe denials, vehicle overlap 16, room overlap 14); same-traveler retries produced one row and successful operations exactly three audit entries. The manifest build published 390 allowlisted files; syntax and diff checks passed. Chrome synthetic checks covered 21 screen/width combinations at 390/768/1440 with no overflow, clipped controls or browser errors. Browser evidence is a disconnected synthetic visual harness, not hosted acceptance. The next gate is Chat review followed by a separately authorized isolated Phase B acceptance assignment; do not merge, deploy production or start Phase C.

See [Phase B contract](docs/OUTREACH-PHASE-B-TEAM-TRAVEL.md), [security](SECURITY_MODEL.md) and [decisions](DECISIONS.md).

## Historical Phase A build-stage snapshot

The following records the original Phase A implementation snapshot; its original pending-review gate was superseded by Chat's Phase A acceptance and the explicit Phase B assignment.


Phase A is implemented on `codex/outreach-campaign-core-v1`, based on main `e1f75f917f9a1e6e16e0b8f9bc5d7b52fbf0a424`. This is an isolated production-baseline checkout, not the full development PR #2 branch. Existing released Outreach Partner, Bessemer, Christmas Dinner, giving and Auth code are preserved.

New candidate: campaign/opportunity approval, scoped local access, immutable configurable workflow snapshots, private documents, training acknowledgements, decisions/follow-up, existing Grip progress projection, dashboard/CSV/native contact actions and Bessemer/Huntsville seeds. Owner-only dormant prize integrity is tested; no Phase D browser operations are enabled.

Migrations `20261006113255`, `20261006113311`, `20261006113322` are **candidate files only**, locally replayed. No acceptance/production migration, grant, bucket, Auth, SMTP, DNS, giving/merchant or scheduler change has been performed. No PR merge/production deployment is authorized. Local Chrome synthetic design review is distinct from hosted acceptance.

See [module contract](docs/OUTREACH-CAMPAIGN-CORE-V1.md), [source mapping](docs/OUTREACH-FIELD-MAPPING.md), [security](SECURITY_MODEL.md) and [decisions](DECISIONS.md). Next gate: Chat Phase A review and separately scoped isolated acceptance authorization. After successful acceptance, recommend Phase B team/travel; do not begin it now.

Local verification on 2026-10-06: the full 14-script backend test command passed, including 102 campaign, 23 dormant prize-integrity and 18 campaign DOM checks. Four real PostgreSQL campaign race groups and four existing gateway race groups passed. All 94 existing Christmas Dinner checks passed using the same declared jsdom 26.1.0 dependency from the backend test installation. Manifest/build isolation, JavaScript syntax and whitespace checks passed. Chrome synthetic design review passed at 1440px desktop, 768px tablet and 390px phone without horizontal overflow; this is not hosted operational acceptance. No source packet, private fixture or audit evidence is published.
