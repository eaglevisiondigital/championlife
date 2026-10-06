# Current build state — isolated Outreach Campaign candidate

Phase A is implemented on `codex/outreach-campaign-core-v1`, based on main `e1f75f917f9a1e6e16e0b8f9bc5d7b52fbf0a424`. This is an isolated production-baseline checkout, not the full development PR #2 branch. Existing released Outreach Partner, Bessemer, Christmas Dinner, giving and Auth code are preserved.

New candidate: campaign/opportunity approval, scoped local access, immutable configurable workflow snapshots, private documents, training acknowledgements, decisions/follow-up, existing Grip progress projection, dashboard/CSV/native contact actions and Bessemer/Huntsville seeds. Owner-only dormant prize integrity is tested; no Phase D browser operations are enabled.

Migrations `20261006113255`, `20261006113311`, `20261006113322` are **candidate files only**, locally replayed. No acceptance/production migration, grant, bucket, Auth, SMTP, DNS, giving/merchant or scheduler change has been performed. No PR merge/production deployment is authorized. Local Chrome synthetic design review is distinct from hosted acceptance.

See [module contract](docs/OUTREACH-CAMPAIGN-CORE-V1.md), [source mapping](docs/OUTREACH-FIELD-MAPPING.md), [security](SECURITY_MODEL.md) and [decisions](DECISIONS.md). Next gate: Chat Phase A review and separately scoped isolated acceptance authorization. After successful acceptance, recommend Phase B team/travel; do not begin it now.

Local verification on 2026-10-06: the full 14-script backend test command passed, including 102 campaign, 23 dormant prize-integrity and 18 campaign DOM checks. Four real PostgreSQL campaign race groups and four existing gateway race groups passed. All 94 existing Christmas Dinner checks passed using the same declared jsdom 26.1.0 dependency from the backend test installation. Manifest/build isolation, JavaScript syntax and whitespace checks passed. Chrome synthetic design review passed at 1440px desktop, 768px tablet and 390px phone without horizontal overflow; this is not hosted operational acceptance. No source packet, private fixture or audit evidence is published.
