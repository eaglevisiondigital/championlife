## November 7 — historical test dependency setup correction

PR124's first automatic run passed current source tests but the immutable historical guard rejected a root `node_modules` symlink as an unexpected source addition. The wrapper now creates a real ignored dependency directory and links only its already-installed entries. A permanent actual-PR120-clone regression reproduces the original rejection, then proves the unchanged guard accepts the corrected setup. No inventory predicate, historical command, application runtime or browser test changes; original failed jobs and any unexecuted downstream checks remain recorded separately. No rerun or release acceptance is implied.

## November 7 — verified device draft ownership, source only

Lessons 1–4 now verify the current account and latest unexpired session before saving or clearing owner-scoped device drafts. Original source reproduced stale-account writes and deletion when Auth callbacks were missed. Pending writes use edit generations; clear retires older writes and cloud-save timers. Previously saved drafts remain intact when verification fails. Draft persistence is now asynchronous and unverified pending edits can be discarded on navigation/session change; verification runs per input without a provider/performance acceptance claim. Existing cloud/legacy activity behavior, all thirteen worksheets, trusted 95% watch requirements, multipart 6/8/9 holds and unavailable videos 11–13 remain unchanged. Exact tests, build integrity, independent review and CI are recorded separately; no hosted acceptance or release authorization. See tools/discipleship-progression/COURSE-DRAFT-SESSION.md.

## November 5 — multipart progression review guard (source only)

Actual verifier-to-adapter reproduction showed one valid fictional media receipt could yield advancement evidence for multipart Lessons 6/8/9 despite their unresolved complete-media binding. The disconnected evaluator now holds those lessons with `media_unavailable`; 95% unique eligible playback for single-media Lessons 1–5/7/10, completion evidence limited to 1–4, private answers, observer expiry and missing media 11–13 remain unchanged. All 276 affected contract tests pass, including 26 new permanent tests; 12 new assertions failed against the original source as expected. No public runtime, SQL, provider, completion writer, grants or hosted action changed. Independent review and exact-head CI remain separate; release is held. See docs/DISCIPLESHIP-PROGRESSION-EVIDENCE-CONTRACT.md.

## November 5 — bounded progression receipt projection (source only)

The all-thirteen worksheet composition exposed an existing integration defect: the metadata-only progression snapshot forwarded the lesson 5–13 reload response, including the current learner's private answers. A guarded, uninstalled forward migration now explicitly projects receipt metadata while preserving the exact verified account/session, enrollment, opaque revision and existing locks/ACLs. The worksheet UI, saved answers, all previous migrations, SDK, King Kind and public outputs remain unchanged. No watch/completion authority expands. Permanent all-13 SQL tests, native concurrency and the affected atomic completion regression are required; independent review, CI and hosted acceptance remain distinct. See docs/DISCIPLESHIP-OWNED-PROGRESSION-SNAPSHOT.md.

## November 5 — verified device-note persistence (source only)

Lessons 5–13 device notes now verify the current account and latest unexpired session before persisting an edit. A missed Auth callback previously allowed an edit under account B to overwrite account A's device namespace. New write generations retire superseded edits, navigation and detached controls; pinned Auth dependencies fail closed. Existing account-owned saved notes are preserved. Pending edits are not reported saved until verification succeeds and may be discarded on session/navigation retirement. The 13 cloud worksheets, enrollment, progress, reader, SDK and all SQL remain unchanged. No trusted playback, completion, hosted Auth or release acceptance is claimed.

## 2026-11-03 — Member course survives optional outreach lookup failure (source only)

My Discipleship now loads existing course activity when the optional St. Lucia resource lookup is denied or unavailable, after the unchanged shared helper freshly verifies the same account and the page checks its session. A truthful refresh notice distinguishes unavailable resources from confirmed absence; stale outreach continuations stop before requesting course data. Original failure reproduced with real pinned-SDK/shared-Auth intercepted Chromium/WebKit transport on mobile/desktop. No SQL, People/Auth system, enrollment, completion, worksheet or provider change. See docs/MEMBER-DASHBOARD-STATUS.md. Local validation: 306 new real-SDK browser assertions, 444 existing dashboard assertions, 20 SDK pin checks and site-build safety checks PASS; two identical 415-file builds change only the dashboard public file. Source-only local acceptance; independent review, exact-head CI, genuine hosted acceptance and release remain separate gates.

## 2026-11-02 — Truthful member dashboard activity (source only)

My Discipleship now describes the existing owner-writable progress projection as recorded activity instead of certified completion. Counts include only unique valid lessons 1–13; saved worksheets and watching remain explicitly distinct. All thirteen existing worksheet routes show correct save modes and videos 11–13 remain coming soon. No SQL, shared Auth, SDK, layout, artwork or stored history changed. The original page fails the focused regression; the correction passes 444 intercepted Chromium/WebKit assertions at mobile/tablet/desktop. See docs/MEMBER-DASHBOARD-STATUS.md. Independent pinned-SDK review passes 228 additional checks; two identical 415-file builds change only the dashboard public file. Exact-head CI and genuine hosted acceptance remain separate; no production release or blocked migration is implied.

## 2026-11-02 — Isolated worksheet CAS integration compatibility (source only)

The existing isolated read/save adapter now consumes the exact approved Lesson5–13 catalogs alongside unchanged Lessons1–4. It enforces each lesson’s response identifiers/count and5–13 worksheet discriminator, while projecting no raw answers or completion authority. This closes an actual adapter-to-existing-RPC mismatch without changing SQL, public runtime, content or SDK. Local pinned-SDK browser, native PostgreSQL and independent adversarial checks are recorded privately. See docs/DISCIPLESHIP-WORKSHEET-TRANSACTION-COMPATIBILITY.md. Trusted completion remains1–4 source-only; media, provider, retention, recovery and release gates remain held.

## 2026-11-02 — Course overview availability copy (source only)

The overview now describes all 13 implemented worksheet flows, distinguishing automatic drafts in Lessons 1–4 from explicit load/save in Lessons 5–13. Missing videos 11–13 remain clearly marked. It no longer promises completion tools or says additional worksheets await conversion. Routes, assets, layout, runtime, SQL and accepted content are unchanged. This describes the reviewed candidate after a separately approved installation; it is not a claim that the 13-lesson suite is currently live. Trusted playback, multipart binding, retention and genuine acceptance gates remain held.

## 2026-11-02 — Private worksheet reload safety (local source only)

Lessons 5–13 now show unsaved changes accurately and require confirmation before an intentional reload replaces them. Cancel issues no RPC. Confirmation rechecks the current session/generation; privacy invalidations still clear immediately without prompting or persistence. Existing owner/revision transaction, content, SQL, SDK, enrollment and completion controls are unchanged. See docs/DISCIPLESHIP-WORKSHEET-RELOAD-SAFETY.md. Isolated Chromium/WebKit regression evidence is recorded separately; no hosted release or provider acceptance is implied.

## 2026-11-02 — Lesson5 cloud workbook response groups, source only

Added an actual private save/load worksheet using ten source-exact groups from the existing Lesson5 PDF and the existing owner-bound RPC/answer store. Guarded forward migration refuses source drift or unmapped existing Lesson5 answers; no new tables, grants, RLS or progress/completion writes. Other device notes and approved media preserved. Lesson6–13 structured worksheets, videos11–13 and genuine95% watch evidence remain unfinished. See docs/DISCIPLESHIP-LESSON-FIVE-WORKSHEET.md; tests/evidence are local, no hosted installation or release.

## 2026-11-01 — Owned progression snapshot, source only

New forward migration `20261101231330_owned_progression_snapshot.sql` derives the existing opaque worksheet evidence binding inside the actual owned worksheet transaction. Auth user/session, enrollment and revision come from locked database records; no browser wrapper supplies ownership. There is no additional answer or learner store, watch provider, completion writer, public mounting or hosted migration. Lessons1–4 only; `observer_unconfigured`, `canComplete:false`, `canCommit:false` remain explicit. Focused PGlite36 checks and existing Node293 tests PASS. Independent reviewer18 additional SQL checks PASS. Native session/legacy-write contention tests are wired to CI but not run on the IPC-exhausted Mac. See docs/DISCIPLESHIP-OWNED-PROGRESSION-SNAPSHOT.md. Exact-head CI, real provider, hosted/release acceptance remain pending.

## 2026-10-29 — Atomic general-resource enrollment correction, LOCAL ONLY
The existing private Resource Registrant RPC now creates/preserves the authenticated user's Getting a Grip enrollment in the same transaction as registration and its immutable audit. No browser enrollment mutation or new schema. Existing enrollment timestamps/completion, answers and progress are never overwritten. Status is read-only and reports enrollment explicitly; the page requires both facts before success. Start Course remains dashboard navigation. This supersedes older "no automatic enrollment" descriptions below and in historical correction reports. Issue #56 watch/answer progression is unchanged and not claimed complete. Targeted native PostgreSQL and intercepted Chromium/WebKit tests, fresh independent review and private integrity evidence accompany the local successor. No provider acceptance or release authorization is implied.

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


## 2026-11-01 — Durable worksheet transaction preparation

Implemented a separate, uninstalled durable worksheet transaction candidate for PR76. Existing answer/enrollment tables are reused; private server-owned revision metadata enables owner/current-session CAS saves. Public pages and the King Kind hold remain unchanged. Native and intercepted SDK/browser tests are local evidence only; independent source review and separately authorized genuine acceptance remain required.


## 2026-11-01 — Playback verifier source preparation

Implemented an Ed25519 envelope verifier against a server-owned current observer registry and repeated verification inside serialized ledger review. Fictional crypto/authorization tests only; no observer is installed and canCommit remains false. The opaque UUID worksheet receipt versus legacy numeric progression receipt bridge remains an explicit next integration task. See docs/DISCIPLESHIP-PLAYBACK-ENVELOPE-VERIFIER.md.

## 2026-11-01 — Uninstalled atomic completion source

PR76 now prepares an owner-only completion transaction over the existing current Auth/worksheet snapshot and existing lesson_progress. Empty disabled observer configuration, exact private receipts and immutable audit bind95%unique eligible intervals plus twenty saved answers. Local fictional SQL tests pass; no genuine provider is installed, no API grants/public wrapper exist, and legacy progress is not trusted proof. Native concurrency remains exact-head CI pending at this checkpoint. See docs/DISCIPLESHIP-ATOMIC-COMPLETION.md. Existing King Kind hold, public course design and all historical packages remain unchanged.

## 2026-11-02 — Lessons 6–8 private worksheet source extension

Added exact existing workbook section responses for Lessons 6 (7 groups), 7 (7 groups) and 8 (6 groups) using the accepted owner-only worksheet transaction and answer store. Lesson 7's destroy-on-paper personal exercise is intentionally not collected. The guarded forward migration serializes provenance review/version initialization with legacy writes; it is uninstalled. No completion/watch credit, new identity/answer schema, RLS/grant, media, King Kind or hosted change. Targeted local database/browser evidence and independent review are required before draft publication. See docs/DISCIPLESHIP-LESSONS-SIX-EIGHT-WORKSHEETS.md.


## 2026-11-02 — Lessons 9–13 private worksheet source

Added private source worksheets9–13 using exact selected original material and the existing account-owned transaction. New uninstalled forward migration preserves Auth/CAS/legacy-writer serialization and does not grant completion. Videos11–13 and genuine playback/hosted acceptance remain unavailable. See docs/DISCIPLESHIP-LESSONS-NINE-THIRTEEN-WORKSHEETS.md.


## 2026-11-04 — Existing worksheet export account fence, source only

A narrow PR76 successor corrects Lessons1–4 private Download/Print/email-copy
controls retaining the prior loaded principal after a missed Auth callback. Exports
now verify current identity/session/client and view lifetime before reading private
fields. Existing thirteen worksheet save/load flows, artwork, shared Auth, SQL and
completion semantics are unchanged. Local fictional-browser tests and reproducible
builds are recorded privately; genuine provider/release acceptance remains gated.
See docs/DISCIPLESHIP-PRIVATE-EXPORT-IDENTITY.md.
## November 5 — playback authority deadline propagation (source only)

The real signed-envelope verifier and progression adapter now preserve the earliest receipt/observer deadline across the complete ledger review. A reproduced delayed transaction previously returned positive review evidence after observer expiry when the envelope itself remained valid. The verifier supplies `authorityValidUntil` from trusted registry metadata; the adapter requires it, compares fresh exact proofs and checks it at every wait boundary and final return. Invalid clocks fail closed. This is disconnected review evidence only, always `canCommit:false`; no observer, completion or serving authority is activated. SQL, private answer projections, all13 worksheets, SDK, public output and Dream Team source remain unchanged. Provider-backed playback, videos11–13, multipart6/8/9 bindings and finite retention remain unresolved gates.


## 2026-11-07 — Device draft reload and deletion feedback, source only

Exact PR124 reproduced Lessons1–4 intentional blank drafts being overwritten by older cloud answers on reload, and failed storage deletion clearing the display without reporting failure. The narrow successor preserves restored field presence (including blank strings), truthful draft-restored status, and displayed answers on failed deletion. Successful Clear and missing-field cloud fallback remain. All owner/session/control fences and Lessons5–13/media/completion restrictions stay unchanged. Local fictional regression/source/build results are recorded privately; independent review and exact-head CI are separate gates. No hosted, permission, SQL, send, payment or release action. See tools/discipleship-progression/COURSE-DRAFT-RELOAD.md.

## 2026-11-08 — Truthful unconfirmed lesson submission feedback, source only

Lessons1–4 could claim current answers were saved on this device after local storage denied a write and the explicit submission failed or its response was lost. The narrow successor changes only the error message: submission is unconfirmed, keep the page open, and a device copy is not promised. Existing successful cloud fallback, verified-owner/session and control retirement, all data requests, thirteen worksheets, trusted95%watch/multipart/media gates and manual submission behavior remain unchanged. No duplicate-retry safety, combined provider receipt, completion authority or hosted acceptance is invented. Permanent positive/negative tests append to existing reload/clear suites; original failures, independent review, source/build integrity and exact-head CI are recorded separately. No SQL, permissions, provider activation or release. See tools/discipleship-progression/COURSE-DRAFT-RELOAD.md.
