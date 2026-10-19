# Unified Outreach validation — 2026-10-18

Candidate only, production base `e3157f0afa3f563ab6560ca64c9049448f02c806`. These results are local synthetic engineering evidence. No hosted stack, real Auth/Turnstile/provider acceptance or production GO is claimed.

| Check | Result |
|---|---|
| Clean pinned dependency installation, lifecycle scripts disabled | PASS; accepted Nodemailer 10.0.16 added for offline provider tests |
| `npm test --prefix tools/backend-tests` | PASS, 37 scripts: original production regressions plus integrated and extracted module suites |
| Final integrated preservation/replay | PASS, 458 checks: 426 protected public/runtime/config files, 25 live SQL bodies, preview target guard, original 48 synthetic source rows, registration function parity, bridge, no seeded grants and RLS |
| Unified roles on PGlite | PASS, 43 checks including central, both pastors, read-only/follow-up/revoked, cross-church/campaign, guardian/privacy/export/source/tenant-directory boundaries |
| Same role suite on native PostgreSQL | PASS, 43 checks; disposable Unix-socket database |
| Original production intake concurrency gate | PASS, four independent native PostgreSQL race groups, including the 120-request network cap and retry/contact caps |
| Registration concurrency on full candidate | PASS, six races with eight independent overlapping backends plus coordinator: household retry, check-in, attendee update, signature retry, coherent CSV and final slot (1 success/7 safe denials) |
| NMI/Outreach compatibility | PASS, 8 checks; NMI `3a8317fb265c0cabb894133ac169100aaea83622` applied before/after Outreach, populated capabilities/grants retained; not a merged UI/runtime approval |
| Local Chrome + actual disposable SQL | PASS, 35 checks, 18 screenshots; six roles at 390/768/1440, central product routes, menu/Escape, no overflow/page errors and current-session revocation |
| Hosted fixture preparation | PASS, 10 checks: deny pending/production/shared target, exact 48 synthetic Bessemer rows, two churches, nonempty-target refusal, cleanup/revocation with historical source preservation |
| Controlled provider foundation | PASS, 64 H1 SQL/security and 36 H1 adapter/runtime checks within the suite; transports synthetic/offline, no email/SMS |
| Communications adapter | PASS, 14 adapter checks; source tests retain consent, suppression, deduplication and held-delivery boundaries |
| Changed JavaScript/MJS parsing | PASS, 53 files |
| Deno 2.9.6 cached-only check | PASS, five new Communications Edge entrypoints: callback, provider-admin, provider-callback, provider-worker and worker |
| Offline exact baseline package | PASS, 29 files: 25 actual production versions + four reviewed forward versions; hashes recorded; applied false |
| Public artifact / diff | PASS; explicit 439-file allowlist, source/private fixture exclusion, blocked isolated configuration and clean whitespace checks |

The default suite includes 88 Team/Travel SQL checks, 25 Team DOM checks, 69 Host/pre-event checks, 38 Host DOM checks, 23 dormant prize-integrity checks, 22 prize-operations checks and 19 prize DOM checks, plus Event Day/Communications and all preserved production registration/login/security suites. Counts above are suite-specific; do not add overlapping checks into a fabricated single total.

The browser fixture replaces only Auth transport with synthetic local identities and routes RPCs into actual disposable SQL. It never contacts a Supabase project or real provider. It proves local authorization/shape/rendering, not hosted Auth sessions or the deployed Edge gateway. The hosted matrix still requires real isolated Auth/API/Storage/Turnstile/downloads, source/legal preservation and cleanup at the exact candidate head.

Local reproduction and hosted preparation: [runbook](UNIFIED-OUTREACH-HOSTED-ACCEPTANCE.md). Migration/source extraction and cross-workstream boundaries: [inventory](UNIFIED-OUTREACH-INTEGRATION-INVENTORY.md), [shared coordination](UNIFIED-OUTREACH-SHARED-COORDINATION.md). Raw evidence and screenshots stay in the private outer audit workspace; no customer records, credentials or private transcripts enter this repository or public artifact.

Release status: HOLD. Canonical shared-shell integration/final sequencing remain primary-owned; fresh isolated project selection and hosted acceptance remain pending. No merge, production migration/function deployment, provider activation, real grants, Giving change or public registration/header change was performed.
