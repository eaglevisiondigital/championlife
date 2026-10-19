# Gate 0 visible revocation recovery — 2026-10-18

Current-head adoption exposed a shared-shell UX regression: clearing protected content detached module mounts, so module denial messages could render outside the live document. The shared shell now renders a non-sensitive accessible “Access changed” state and dashboard recovery link after clearing. Detached mounts and response-epoch rejection remain intact; stale responses cannot restore protected data. No permission, SQL or module business behavior is widened. Focused shared-shell regression: 80 checks PASS, including visible recovery and late-response denial.

---

# Gate 0 current-head adoption correction — 2026-10-18

NMI adoption now targets owner-specified `d82ed7fdb049389ae43d50a2ceb1ac300665a7cc`; Outreach remains `bff9612ac9385cf963c5e7e41f9091da7af86cf0`. Earlier3a8317/e39b832 results are historical, not current adoption certification. All newer NMI business work is preserved in source contracts. Independent adoption found missing-Auth, identity/role, branch-pin bypass and composer contamination defects; the bounded shared correction and current-head evidence are detailed in [Gate 0](docs/SHARED-PLATFORM-GATE0.md). Module-owned offline migration plans must explicitly include Gate0; no automatic widening or hosted application. No production/GiveHub/NMI execution/real grants or deployment changes.

---

# Shared Platform Gate 0 — 2026-10-18

Bounded reconciliation from production `e3157f0afa3f563ab6560ca64c9049448f02c806`, frozen NMI PR #34 and Outreach PR #35. See [Gate 0 contract, evidence and adoption procedure](docs/SHARED-PLATFORM-GATE0.md) and [canonical scoped registry](config/platform/capabilities.json). This package adds one forward-only local migration, a shared context/navigation contract and upgrade/security/build regression tests. It does not merge the child business packages.

The historical 41-capability failure is reproduced and explained. The frozen Outreach candidate already uses additive lists; Gate 0 preserves and tests that correction in both orders with populated grants. No grant/template rows or existing authorization helpers are changed. Tests use local synthetic databases/browser transport; hosted acceptance and production release are not approved. Both frozen child versions of this document are preserved verbatim in `docs/gate0-source-continuity/`; the production history follows below.

No production change, GiveHub change, payment activation, hosted migration, real-user grant or deployment. Child adoption, later deltas, hosted/provider/operator acceptance and explicit release approval remain gates. Do not start unrelated platform modules.

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
