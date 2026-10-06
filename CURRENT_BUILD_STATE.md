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
