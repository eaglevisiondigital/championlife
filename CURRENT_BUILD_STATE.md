## 2026-10-29 — General prayer resource integration, LOCAL ONLY
Reconciled PR #54 with the accepted Resource Registrant and reader chain through 5c84a42. Reused the completed implementation; removed the duplicate draft general signup backend. Additive `/king-kind-signup.html` entry points to the accepted form; all 26 SDK pins and current Powered by Propel branding are preserved. General registrations remain separate from outreach decisions, membership, staff and financial authority. See docs/GENERAL-PRAYER-SIGNUP-LAUNCH-CHECKLIST.md for exact next gates. No hosted testing, migration, message, permission change, push or deployment authorized or performed. Original packages unchanged.

## 2026-10-28 — Final local privacy and dependency correction

Local final general-resource correction: all thirteen lesson privacy boundaries covered; lessons 5–13 now use verified-owner device-only notes. Supabase 2.118.0 is vendored with SRI across 26 entry points and enforced by build checks. Original candidate and sealed evidence preserved. Complete regression, focused notes/pin, native database and isolated browser checks pass; reproducible builds pass. No genuine hosted acceptance or production release. See docs/GENERAL-RESOURCE-FINAL-CORRECTIONS.md.

## 2026-10-28 — General King Kind resources (local candidate only)

New isolated candidate from 734c9811e92219509a25b174b0d5bfd5850c5315 adds /king-kind/ using the approved outreach layout and Champion Life black/charcoal/gold. Verified-identity registration is separate from all campaign decisions. Name/email/resource consent required; optional phone/prayer/interest and independent marketing opt-in. Private RLS tables, atomic identity-bound idempotency/audit, and a narrow reader eligibility extension are prepared, not applied. Existing reader runtime is unchanged apart from explanatory eligibility copy. No course enrollment/progress or staff grants are created.

Local: full repository regression PASS; 55 native PostgreSQL checks (including six-client concurrency and non-destructive containment), 53 PGlite equivalents, 108 Chrome/WebKit desktop/mobile assertions through actual SQL with synthetic Auth, 19 package/contract checks. Real provider Auth/email, hosted Storage and physical-device acceptance remain untested. No production or hosted changes. See docs/GENERAL-KING-KIND-RESOURCES.md for release/rollback requirements. Issue #50/#51 and recovery work remain separate.

## 2026-10-26 — King Kind neutral reader palette (owner approved)

Owner approved the near-black/charcoal/gray palette with gold after reviewing the local visual proof. The reader stylesheet now uses near-black, charcoal and neutral gray with the existing gold accents. Only color values and the primary-button hover colors change; layout, responsive breakpoints, JavaScript, authorization and approved PDF remain unchanged. 21 existing source/security checks and contrast checks pass. Prepared for PR49; production remains unchanged. Owner reports both phone reading/download tests work; independent device-session corroboration, desktop download and final sandbox cleanup remain release gates. The loopback visual preview is a static color proof, not a new authenticated acceptance result.

## 2026-10-23 — Staff portal presentation and current-session logout (local candidate)

Based on production source `97f2330c284dcda2108b8e1926bf9f3bd12979af`. People & Follow-up and Registration/Check-In share a scoped charcoal/gold shell; all three current staff HTML pages include authenticated email and visible Log Out. The existing Supabase client signs out only the current session, preserves unrelated storage, clears protected mounts before pending responses can return, and prevents back/forward-cache restoration. No permission, RPC, backend, public registration, theme-song, provider or deployment changes.

Local validation includes the complete repository suite, 282 focused session assertions, 156 operational browser assertions and 68 real-Supabase-SDK browser assertions with fictional sessions/fully controlled HTTP. Chrome/WebKit cover mobile/tablet/desktop. Actual owner email-link login remains unverified: an existing church-account session was visible. Website-only production approval and live account validation remain outstanding. See `docs/STAFF-PORTAL-POLISH.md`.

## 2026-10-22 — Explicit no-preference prize option (not released)

Owner requested three clear choices: Bicycle, Tablet, No preference. The third option replaces the ambiguous optional placeholder and remains selected by default; its empty value preserves the existing no-prize-selection payload and never blocks registration. Included in the undeployed PR #40 follow-up; no backend, legal, consent or eligibility change.

## 2026-10-22 — Final Huntsville simplification/error review (not released)

PR #39 was concurrently merged as `eb6a1bef1d819ba5a637a59866c4cf08005ebba5` and deployed as `6adad76db87e9aeee8b04d93` during this review. Its source tree exactly matches the original reviewed `86dc56b8`. This separate follow-up candidate is based on that new production commit and adds only existing-SQL field validation and controlled, actionable Huntsville rejection/retry messages; the two changed runtime assets are the registration form and public handler. HTTP 200 alone cannot render confirmation without accepted=true, a valid reference and matching attendee count. The original reviewed age/guardian, optional prize and explicit-false messaging changes remain. Approved legal/media requirements, backend, Turnstile, rate limits and idempotency are preserved.

109 hotfix checks pass in native PostgreSQL and PGlite through the actual Edge handler with injected synthetic Siteverify; 91 DOM checks and the complete repository suite pass. Local real-browser parent+two-children/blank-prize submission, safe contact validation, responsive confirmation and calendar download pass. No production submission or deployment; a revised exact-head release approval is required. See docs/HUNTSVILLE-FORM-HOTFIX-RELEASE.md.

## 2026-10-22 — Huntsville registration incident hotfix prepared (not released)

Based on production `2d0b6b4fc84322f216329db498840c272b392461` after PR #38. The Huntsville-only form now accepts age 0–120 in every attendee row, explicitly classifies 0–17 as children, projects one optional Bicycle/Tablet preference to the existing interest flags, and records removed messaging choices as false. Guardian and Self-signature checks mirror the existing SQL contract before API submission. Other campaigns retain their controls.

Native PostgreSQL and DOM submission/confirmation coverage passes for ages 0, 5, 12, 17, 18 and 40, mixed and adult-only households. Existing registration, CSV, check-in, audit/security and calendar tests pass. Real-browser local submission uses a disposable database and a synthetic challenge; it is not proof of live Siteverify or production incident recovery. See `docs/HUNTSVILLE-FORM-HOTFIX-RELEASE.md`. No hosted form changes or record writes performed. Separate production release approval required.

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

## 2026-10-26 — King Kind final mobile correction candidate

PR #49 remains a reader-only release. The cover now preserves its natural height,
mobile arrows/page count stay visible, and the reading viewport reserves measured
space above the controls. Controls remain hidden until book authorization succeeds.
Approved near-black/charcoal/gold styling, private PDF checksum, registration
eligibility, personal-use acknowledgment and existing entry links are preserved.
Local full regression and responsive browser checks pass. Final physical-device
acceptance and separately approved production Storage/website release remain gates.
Personal notes/highlights are being prepared on a separate branch and are not part
of this release. No production migration, upload, merge or deployment performed.


## 2026-10-28 — General resource release correction candidate

General-resource G1–G4 correction overlay implemented locally on sealed base 7be32edf540844a24583fee72fbe8cc106125a8c. Verified-user course drafts and asynchronous save fences; callback failures fail closed; persistent account email/switch; independent dashboard private-reader link. No page redesign, SQL/Storage/RLS/reader asset change, hosted execution, real sends, push/merge/deploy. Original application/recovery packages remain unchanged. Focused/security/full/browser/native evidence and new seal live only in the private outer audit workspace. Genuine provider/device acceptance and independently reviewed sandbox authorization remain required. See docs/GENERAL-RESOURCE-CORRECTIONS.md.


## 2026-10-28 — Local King Kind reader session correction

Separate successor to sealed 6d5730bf0034bbb138999ce8cab97ce150d525fe. Reader invalidates retained PDF/Blob/canvas/license state synchronously on Auth/storage/history/expiry changes; deferred authorization avoids SDK callback-lock deadlock. Generation-bound requests and detached rendering prevent stale completion from restoring prior-user content. Each personal-use download freshly checks identity and exact-object Storage eligibility. No design, SDK, PDF, SQL/RLS, general registration, lesson, recovery or Issue50/51 changes. Local regression and intercepted real-browser/real-renderer evidence are recorded privately; genuine-provider acceptance remains untested. See docs/KING-KIND-SESSION-CORRECTION.md. Stop at independent review; no hosted authorization, deployment or access grants.


## 2026-10-29 — Issue #53 latest PR54 integration, LOCAL ONLY

Reconciled PR54 373868a against accepted local a892b2b / Resource Registrant6d5730b /
reader5c84a42. Reused the single private registration contract, frozen reader, all13
lesson privacy and26 vendored SDK pins without runtime changes. Added native-backed
Chromium/WebKit journey acceptance and launch contract comparison. Automatic course
enrollment differs from accepted resource-only registration, and watch-to-advance
is not implemented by the current course. These remain explicit release decisions/
implementation gaps. Genuine provider, recovery, custody, maintenance and separate
hosted/release approval remain blocked. No hosted execution, messages or deployment.
See docs/GENERAL-PRAYER-SIGNUP-LAUNCH-CHECKLIST.md and private Issue53 evidence.
