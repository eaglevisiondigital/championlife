# NMI Giving sandbox execution follow-up — October 18 CDT / 19 UTC, 2026

Primary authority remains **Align Codex with Champion Life**. This is a bounded Giving follow-up to frozen draft PR #34 head `3a8317fb265c0cabb894133ac169100aaea83622`; no restart, merge or historical SQL rewrite. Production Git main is still `e3157f0afa3f563ab6560ca64c9049448f02c806`. Primary independently confirmed the live 25-row baseline; source attribution and all hashes are in `docs/NMI-CUTOVER-PRODUCTION-BASELINE.json`. No production inspection/write is claimed by this child.

COMPLETED / CHANGED: anonymous canonical NMI sandbox checkout, authoritative result executor and immutable gift posting; consent-bound vault/active recurring/pause/cancel; current maker/checker refund/void execution; Operations lookup jobs without blind retries; canonical SANDBOX receipts with immutable held outbox; bounded Query API transaction and settlement/batch projections with explicit statement reconciliation; scoped unknown recovery; donor success/decline/pending/recovery and current-session staff controls. New forward SQL versions `20261019010048` and `20261019010932`; no accepted source migration changed.

TESTED: complete standard/DOM/migration suite, native PostgreSQL races (including eleven new eight-worker execution/refund races), seven Deno entrypoints, source/build/449 protected-file checks. Exact final result belongs in `docs/NMI-CUTOVER-VALIDATION.md` and PR checks; no real provider/hosted acceptance.

SECURITY: source pin is null, origin allowlist empty, all execution switches OFF, sandbox endpoint only. New charges and safe recovery have separate controls; disabling charges does not stop existing provider subscriptions, so supervised cleanup must confirm pause/cancel. Financial route revisions and private merchant/MID/settlement proof fingerprints, current staff/donor authority and checkout expiry are rechecked before handoff; dispatch is audited before provider I/O. Secrets/tokens/raw provider payloads never enter application logs/storage.

DOCUMENTATION / UNRESOLVED: dedicated new-project baseline/order/hashes/functions/secret names/seed/cleanup/cost and full supervised procedure prepared. Main/Youth/Outreach/Events/Merch merchant facts and GiveHub export/portability/next dates remain UNVERIFIED. Exact normalized GiveHub contract prepared; nothing imported or cancelled. Primary owns Shared Platform Gate 0, shell/permissions/migration reconciliation and Communications delivery/legal sender. The earlier registry diagnostic describes only its fingerprinted snapshot; sibling repairs must be assessed by primary Gate 0, not that old verdict.

NEXT RECOMMENDED BUILD / CHAT HANDOFF: review this exact follow-up and primary Gate 0, obtain finance/NMI worksheet and owner-approved clean dedicated target, then authorize exact source pins and supervised sandbox acceptance. No target was created. Production/GiveHub/live credentials/money changes **NONE**; public cutover **NO-GO pending acceptance and primary approval**.

---

Historical frozen integration/earlier platform checkpoints follow; the execution follow-up above supersedes their held engineering status.

# NMI Friday integration candidate — 2026-10-18

Implemented on `codex/nmi-giving-friday-cutover`, direct production base `e3157f0afa3f563ab6560ca64c9049448f02c806`. This supersedes historical candidate status below only for this isolated Giving package. Production/live schema state has NOT been inspected or changed by this assignment.

COMPLETED / CHANGED: inventoried PRs #16–21 and #23 at exact heads; extracted accepted Giving/Forms/provider/NMI/Operations modules without merging their old prerequisite chain. Preserved all 25 current-main migration files; added nine byte-identical source extractions under unapplied forward versions and one new NMI observation-to-Operations bridge. Finance shell discovers installed Giving/Forms only; return paths use existing production staff entry. All 449 protected production runtime/content/config/function/migration files match the specified commit. Public allowlist is 462 files; no private documentation/test/SQL enters dist.

TESTED: 41 standard scripts; Giving/Forms/provider/NMI/Operations independent native PostgreSQL race groups; Huntsville native security/count/CSV and six races; existing Outreach concurrency; 44 JS/MJS syntax checks; five Deno Edge entrypoint checks; pinned NMI component rebuild; source/protection hashes; public artifact/isolation; diff checks. All local synthetic results, not hosted/browser/provider acceptance. See `docs/NMI-CUTOVER-VALIDATION.md` for exact commands/results.

SECURITY: NMI remains sandbox-only/default-off; raw card input belongs only to hosted fields, tokens remain transient, REST/webhook/service secrets stay server-only. Safe NMI sale/authorization/capture/transaction observations reach scoped Operations issues; no ledger posting or retry execution is enabled. Same-session revocation, duplicate prevention, cross-org boundaries and revoked private helper access are tested. No live key or money movement.

DOCUMENTATION: complete 11-part inventory, source commit/blob manifests, route/MID worksheet, GiveHub export inventory and supervised provider acceptance/cleanup procedure are in `docs/NMI-CUTOVER-*`. Offline bundle builder: `node tools/nmi-acceptance/package.mjs`, from clean committed candidate only; generates private bundle with blocked preview and hashes.

UNRESOLVED: actual merchant/MID/settlement and GiveHub export data are not supplied; no actual NMI sandbox calls/tokenization or hosted stack installation. Original NMI exact-project guard points to shared acceptance with incompatible schema; require new clean target and reviewed exact pin. Accepted source still holds anonymous public payment completion, active recurring, live ledger posting, receipt/statement delivery, Operations executor integration and full settlement lookup. This candidate is NO-GO for public cutover. Do not count sandbox metadata as financial ledger truth or mocks as provider acceptance.

NEXT RECOMMENDED BUILD: close mandatory product execution gaps on this candidate, pin an approved clean isolated target, then run actual sandbox/finance acceptance. Keep GiveHub primary until all launch gates and separate owner GO pass. No merge, production migration/function deployment, public link change, GiveHub recurring modification, Authorize.Net/Text-to-Give activation or unrelated redesign is authorized.

CHAT HANDOFF: review `docs/NMI-CUTOVER-INVENTORY.md` and validation. Draft PR is an integration/build review candidate only. Use the complete Work assignment in `docs/NMI-CUTOVER-HOSTED-ACCEPTANCE.md` after engineering blockers are resolved and isolated target authorization is explicit.

---

# Isolated Huntsville email-link acceptance fix — 2026-10-17

PR #26 only, based on release head `c083447559d698a44ea7d63aeab2ea310b61f877`. The actual isolated branded template uses Supabase `ConfirmationURL`: `/auth/v1/verify?token=…&type=magiclink&redirect_to=…`, followed by an implicit session/error fragment at the login page. It does not currently use a custom `token_hash` callback or PKCE.

The login now waits for initialization of the existing Supabase client, checks callback errors before trusting a previously stored session, removes callback credentials/errors from the visible URL, and performs one redirect to the existing strictly sanitized destination. The initial PR's direct token-hash handler is retained and hardened. Invalid/expired links fail visibly and safely; the existing manual OTP flow remains available. This cannot restore an expired or consumed provider token; the reason for the previously observed `otp_expired` is unproven.

Local validation: 165 login scenarios; full backend/site suite; existing backend concurrency suite; native Huntsville security/count/CSV checks and six eight-worker PostgreSQL races PASS. The downloaded Supabase browser SDK was also exercised against fictional valid, invalid and expired implicit callbacks with mocked network responses. These are local tests, not fresh inbox-to-browser acceptance. Fresh isolated human secure-link validation remains a release gate. No registration authority or login-time grants are created.

Production, release PR #25, branded template, SMTP credentials, registration activation, SowGo routing and Netlify Forms are outside this fix.

---

# Huntsville minimal production release candidate

2026-10-17: release branch `codex/huntsville-production-release` now combines current production main `f0d6fe9e07140dab6ed829ed5ccfdbb7af12e2fd` with validated minimal-package head `03d929d2a939f1e160ae12149effbf7480ecca83`. The only production-main change since the original package base is the approved Bessemer mobile registration flow, preserved unchanged. PR #24 ancestry is not imported.

The package remains two forward-only migrations plus the native public/staff registration slice and `outreach-registration-submit`. The approved Huntsville public header is frozen: no layout, imagery, colors, typography, wording, proportions or styling changes are authorized as part of backend integration.

Local proof remains PASS: migration/object/ACL safety, registration security, Huntsville legal/media/address/count/CSV/capacity behavior, public/staff DOM, gateway checks, site build and six eight-worker PostgreSQL races.

Exact-stack hosted acceptance also PASS on isolated project `niyovbgoalulzkhbvebt` (`champion-huntsville-minimal-acceptance`): exact 22 baseline migrations + 2 Huntsville migrations, reviewed registration Edge Function, public/staff behavior, totals, CSV, check-in separation, responsive layouts, same-session revocation and real Cloudflare Turnstile at 390px. Cleanup left zero active test registrations, check-ins or grants; closed synthetic records and immutable audit/signature history were intentionally preserved.

Production Champion Life Supabase `exdocjbmylgxssanymjk` was rechecked and remains at the original 22 migrations, without Huntsville campaign/registration objects or the registration gateway function. Production website remains live on the Bessemer mobile release and has not received the Huntsville native registration slice.

**Current gate:** draft production release PR + CI only. No merge, production migrations, Edge deployment, grants, waiver publication, registration activation, SowGo routing change or live message is authorized. Branded email remains a separate launch gate.

See [dependency graph](docs/HUNTSVILLE-MINIMAL-DEPENDENCIES.md) and [release/containment plan](docs/HUNTSVILLE-MINIMAL-RELEASE.md).
