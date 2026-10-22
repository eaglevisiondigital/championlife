# Gospel in the Streets candidate — 2026-10-22

Isolated theme-song implementation from current main `e3157f0afa3f563ab6560ca64c9049448f02c806`. Exact final approved artwork and original AAC preserved. Shared player added after the Outreach introduction and at `/outreach/theme-song`, with SOUL FUEL, existing Outreach giving, social metadata and original download. New transactional play counter is implemented/default-disabled; its dedicated storage and all hosted activation await separate approval. No Supabase, payment or registration changes. See [feature/release contract](docs/THEME-SONG.md) for provenance, tests, configuration and release gates. Draft PR only, with `[skip netlify]` safeguards; no merge/deploy/provisioning.

2026-10-22 final UI cleanup: the artwork is now the only visible control set at every width. Duplicate player/action markup and the additional SOUL FUEL giving button are removed. Keyboard labels, pressed states, range semantics and focus remain intact. A headphones icon and the existing qualified-play total are integrated inside the player; unconfigured storage displays “Plays unavailable” on both pages without fabricated numbers. Exact approved image/audio bytes, counting backend, giving route and production remain unchanged. Private regression/browser evidence is in final-ui-cleanup. No deployment or counter activation.

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
