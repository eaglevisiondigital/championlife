# Huntsville minimal production release candidate

2026-10-17: release branch `codex/huntsville-production-release` now combines current production main `f0d6fe9e07140dab6ed829ed5ccfdbb7af12e2fd` with validated minimal-package head `03d929d2a939f1e160ae12149effbf7480ecca83`. The only production-main change since the original package base is the approved Bessemer mobile registration flow, preserved unchanged. PR #24 ancestry is not imported.

The package remains two forward-only migrations plus the native public/staff registration slice and `outreach-registration-submit`. The approved Huntsville public header is frozen: no layout, imagery, colors, typography, wording, proportions or styling changes are authorized as part of backend integration.

Local proof remains PASS: migration/object/ACL safety, registration security, Huntsville legal/media/address/count/CSV/capacity behavior, public/staff DOM, gateway checks, site build and six eight-worker PostgreSQL races.

Exact-stack hosted acceptance also PASS on isolated project `niyovbgoalulzkhbvebt` (`champion-huntsville-minimal-acceptance`): exact 22 baseline migrations + 2 Huntsville migrations, reviewed registration Edge Function, public/staff behavior, totals, CSV, check-in separation, responsive layouts, same-session revocation and real Cloudflare Turnstile at 390px. Cleanup left zero active test registrations, check-ins or grants; closed synthetic records and immutable audit/signature history were intentionally preserved.

Production Champion Life Supabase `exdocjbmylgxssanymjk` was rechecked and remains at the original 22 migrations, without Huntsville campaign/registration objects or the registration gateway function. Production website remains live on the Bessemer mobile release and has not received the Huntsville native registration slice.

**Current gate:** draft production release PR + CI only. No merge, production migrations, Edge deployment, grants, waiver publication, registration activation, SowGo routing change or live message is authorized. Branded email remains a separate launch gate.

See [dependency graph](docs/HUNTSVILLE-MINIMAL-DEPENDENCIES.md) and [release/containment plan](docs/HUNTSVILLE-MINIMAL-RELEASE.md).
