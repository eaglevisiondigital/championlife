## Consolidated operations security release preparation — 2026-10-22

The existing security candidate now includes reproducible Outreach-only staff / Church-member scope tests alongside the dual-organization operator tests. Runtime UI and SQL bytes remain unchanged from `28bb772e663f2ce8de28d56bff659456184c38d8`; production baseline remains `53beb5d5c0d1ee259155128e4e282d18b4195623`. No account, invitation or permission is seeded. [Controlled release contract](docs/OPERATIONS-ADMIN-RELEASE.md). Production release, independent administrator custody, individual identity verification and access activation are separate gates.

# Operations Administrator security candidate — 2026-10-22

Local candidate based on production `53beb5d5c0d1ee259155128e4e282d18b4195623`; no merge, push, hosted migration, account, invitation or grant. Repairs financial Outreach leakage (including linked follow-up/relationship history), independent campaign permission administration, household audit validation and People creation compatibility. Existing 29-key registry retained. Two explicit organization assignments can project current/future campaign operations without campaign-admin authority. See [bounded contract and release gates](docs/OPERATIONS-ADMIN-SECURITY.md).

Validation: full backend/site regression; 94 focused upgrade/security assertions in PGlite and native PostgreSQL; 95 native registration + 56 native Huntsville assertions; six eight-worker races; 90 offline Chrome/WebKit checks at 390/768/1440px. Actual invitation/account/hosted-role acceptance remains unexecuted and requires approval. The accepted theme-song artwork, giving/public routes, Gate 1C and child packages are untouched.

---

# Gospel in the Streets static candidate — 2026-10-22

Draft PR #37 uses the exact approved artwork and original AAC on the Outreach page and `/outreach/theme-song`. One in-artwork control set provides play/pause, seeking, volume/mute, download, share and Give to Outreach; SOUL FUEL remains the campaign name. No duplicate visible controls.

The owner removed the play counter entirely. All counter displays, tracking, cookies, API, schema, database runtime dependencies and environment requirements are removed. No Neon or counter resources were provisioned. Earlier hosted-counter preparation is superseded and must not be executed. See [feature/release contract](docs/THEME-SONG.md).

Final local validation PASS: full backend/site suite, 43 focused static/privacy checks, 201 Chrome/WebKit browser assertions at 1440/847/768/390px, four native concurrency groups, and two identical 401-file public builds. Original media hashes and protected paths remain unchanged. Exact-head CI must pass before the separately authorized production release. Existing ministry backends, giving and registration behavior remain untouched. Production release must use the existing Netlify workflow and include public-site verification and rollback readiness.

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
