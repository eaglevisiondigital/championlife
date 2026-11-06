## 2026-11-03 — People follow-up creation through existing permissions

Source-only PR72 successor adds the missing existing-person task creation step: title, optional due date, then existing status completion. Uses unchanged column-limited `followup_tasks` INSERT with fresh people/follow-up authority; no new SQL, assignment, People record, decision access or message. Uncertain saves retire the form and require task-list review; no automatic retry or exactly-once claim. New 276 browser + 48 native assertions, baseline 6, affected 64 navigation + 222 identity assertions and 5 DOM scenarios PASS. Coordinator verified identical 411-file builds with only People runtime changed publicly. Exact-head review/CI and hosted/release gates remain distinct. See [contract](docs/PEOPLE-FOLLOWUP-CREATE-20261103.md).

## 2026-11-03 — Fresh authority and data for printable registration rosters

Source-only PR72 successor corrects app printing after export permission revocation. Each preview/explicit print refreshes current context and household details, then uses the existing audited export check before publishing the six-column roster. Closed detail rows are excluded; current contact/check-in/waiver values replace stale preview data. No SQL, grants, provider or release changes. New 216 browser + 21 native assertions, baseline 18 reproduction, existing 96 navigation + 91 DOM checks PASS; two identical 411-file builds have one public runtime delta. Independent review/exact-head CI remain coordinator-reported gates, and genuine hosted acceptance is not claimed. See [contract and limits](docs/OUTREACH-PRINTABLE-ROSTER-20261103.md).

## 2026-10-31 — Unified shell independent review corrections

Fresh adversarial review of e18062467c8a2a2e6af7239f12e2a3ca7d035e1d found a parallel-discovery denial delay and order-sensitive permission comparison. The narrowly corrected shell processes each discovery failure before waiting for its sibling and compares canonical permission sets while preserving display order. A permanent independent browser regression covers both discovery directions, late responses, retained mutation attempts, network errors, true permission removal and fresh reauthorization. Original sealed evidence remains preserved. No SQL, grants, payment or provider configuration changes. Draft implementation review and GitHub CI are authorized; merge, deployment and hosted acceptance remain separate gates. See docs/UNIFIED-STAFF-SHELL.md.

## 2026-11-03 — Partner continuity merge-conflict correction

Relocated only existing Partner continuity blocks to avoid concurrent prepend/append conflicts with exact Outreach base `eb7ad80c322fe3664273c38f56d176b1e28e1583`. All runtime, SQL, permissions, deployment configuration and provider gates remain identical to Partner `6a82380396fb58b8821a22c224a3bfb7d10b7ad6`, including its organization-specific financial intake handoff. This is a documentation conflict correction, not a new feature or imported base history. A clean virtual composition must retain the base People/registration blobs and the Partner handoff blob; source review/build checks are distinct from genuine Auth acceptance and release approval.

## 2026-11-02 — Actual Partner provider installability

Actual bounded read-only provider metadata now establishes two concrete Partner installation blockers: managed Auth tables differ from the exact fictional fixture pins, and effective PUBLIC TEMP conflicts with the restricted execution role. Offline assessment reports NO_GO without changing pins or runtime; 19 new focused checks pass. No provider row reads, credentials, grants, installation or host mount. [Scope and next technical gate](tools/partner-platform/PROVIDER-INSTALLABILITY.md).

## 2026-11-02 — Partner execution-role composition (source only)

Separate fixed execution-role ingress connects the accepted signature/canonical People boundary to a least-privilege login profile. Original zero-membership reader behavior, 23 function/17 relation pins and all migrations remain unchanged. New 41 PGlite checks PASS; 17 native PostgreSQL17 role checks PASS with canonical-positive/concurrency explicitly skipped until PG18 CI. Independent review found a near-system schema wildcard gap in the initial successor; literal prefix handling and permanent malicious-schema tests correct it before publication. No hosted role, credential or mount. [Exact contract and held provider prerequisites](tools/partner-platform/EXECUTION-ROLE-READINESS.md).

## 2026-11-02 — Unmounted Partner signed-token ingress

The official pinned Supabase Auth SDK now verifies an explicitly trusted public ES256 issuer key before binding subject/session to the existing strict canonical repository and People adapter. Request-local lifetimes, transport abort, expiry and permanent issuer retirement preserve current DB authority and private projection. 64 new / 529 affected Node checks and 22 authority denials PASS; native PostgreSQL17 verifies incompatible catalog denial. New 13-check native PostgreSQL18 CI and independent review remain pending. No SQL, pin, grant, host, provider, public mount or production change. [Contract and held installation dependencies](docs/PARTNER-SIGNED-HOST-INGRESS-20261102.md).

## 2026-11-02 — Explicit restricted Partner canonical profile

Added a fixed unmounted repository factory for the grant-free current-schema composition. All historical catalog pins/default factories remain behaviorally unchanged; only the new profile requires both application writer grants absent. 66 new / 465 total affected Node checks PASS. PostgreSQL17 verifies fail-closed catalog mismatch; new 30-check PG18 positive/concurrency suite awaits exact-head CI. No SQL, credentials, host mount or production authority. [Contract and gates](docs/PARTNER-RESTRICTED-CANONICAL-PROFILE-20261102.md).

## 2026-11-02 — Narrow Partner current-schema composition (test-only)

Implemented the six missing Issue50 dependencies and exact accepted private writers on a disposable 27-source current-main application replay plus existing Partner metadata. Preserves operations security, original B1/B2 guards, canonical pins and King Kind reader; no new migration or public wrapper. Two historical authenticated writer grants are deliberately omitted, so the unchanged canonical repository correctly stays null/unverified. 399 focused tests (23 new), 22 authority denials, 16 historical dependency assertions and 12 native PostgreSQL17 lock/revocation/cancellation checks PASS. Independent review reports no blocking findings with 48 additional checks PASS; PG18 exact-head CI remains pending. No host/provider/credential/production activation. [Exact composition, privilege conflict and next contract](docs/PARTNER-CURRENT-SCHEMA-COMPOSITION-20261102.md).

## 2026-11-02 — Partner full-source dependency reconciliation

Reproduced complete historical Issue50 B1/B2 compositions from their exact accepted inputs. Fresh current-base disposable replay confirms six missing relations; B1 rejects its capability baseline and B2 rejects the absent follow-up dependency, with clean rollback. 16 new dependency assertions PASS; the existing 101 canonical repository/envelope tests also pass. No runtime defect or valid existing server principal/credential binding was established, so this successor changes documentation only. No SQL, pins, grants, host mount or production action. [Exact graph, evidence and narrow continuation contract](docs/PARTNER-HOST-INTEGRATION-GAP-20261102.md).

## 2026-11-01 — Restricted Partner canonical host source envelope

Implemented a single nonpublic fixed-query routine and restricted NOLOGIN caller source contract, integrated with the existing canonical repository, disposable pg driver and PG18 native suite. Caller has no direct data grants; accepted provenance pins remain unchanged. 376 focused Partner/shared-backend checks (including 37 envelope checks) and 22 authority checks pass locally. Independent cross-review reports no material findings and 13 additional PGlite checks pass; exact-head native execution remains pending. No migration, hosted role, credential, provider, public mount or production change. Synthetic claims/owner SET ROLE are not deployed principal/credential proof. See [host boundary, dependencies and gates](docs/PARTNER-HOST-ENVELOPE-20261101.md).

## 2026-11-01 — Canonical native PostgreSQL version correction

Diagnostic CI `41362490783` confirmed PGlite PostgreSQL 18.3 versus native PostgreSQL 16.15. All 17 relation differences are standalone NOT NULL entries in `pg_constraint`; column nullability and function/ACL/policy/index contracts agree. The Partner workflow now explicitly installs/selects PostgreSQL 18 only for the canonical native suite, after the other native suites complete. Runtime verifier, SQL and all provenance pins remain byte-identical. Workflow syntax/static validation passes locally; corrected native execution remains pending CI. No Mac PostgreSQL, provider or production action.

## 2026-11-01 — Canonical native CI failure diagnostic

The canonical repository candidate `34197a6bc4acde93d192889534d9748a65058136` passed 322 local focused checks but native CI run `41362035208` failed its first positive read as null/unverified. Native serialization acceptance is FAILED/INCOMPLETE. The accepted PGlite fixture reports PostgreSQL 18.3; native version/catalog differences are not yet established. Added test-only version and catalog-field diagnostics before the boundary conceals the denial reason. Runtime source and committed provenance pins are unchanged; diagnostic mismatch remains a test failure. No native Mac server, provider action or runtime mount.

## 2026-11-01 — Unmounted canonical Partner repository

Added a server-only transactional reader that reuses exact accepted Issue50 A/B/B2 identity receipts/reviews and the existing canonical adapter. Positive reads lock existing source/map, review/receipt/audit, Person/account and authority rows; missing/changed provenance remains unverified. The disposable fixture generates evidence through the accepted writer. No migration, connection/role or public mount; current metadata stays null. Synthetic Auth catalog pins deliberately prevent claiming real-provider readiness. PGlite and focused Node validation are recorded in [the source contract](docs/PARTNER-CANONICAL-REPOSITORY-20261101.md); native Linux contention CI and independent review remain gates.

## 2026-11-01 — Assigned Partner metadata backend candidate

Local source only: explicit campaign/Partner/worker assignment, locked active Auth session and metadata-only read RPC. No issuer or automatic People identity claim; `personId` remains null pending independently reviewed linkage. Existing financial intake authority and website PR61 are separate. See [implementation boundary and release gates](docs/PARTNER-ASSIGNED-METADATA-20261101.md). No migration, staff grant, public runtime activation or hosted acceptance has occurred.

## 2026-11-01 — Partner current-base integration and private revocation

Exact reviewed Outreach ancestry is reconciled into the Partner draft without changing accepted runtime bytes. A separate private-only revocation primitive prepares locked authority, expected revision, idempotency and immutable audit rollback; no application role can execute it and no Partner issuer policy is inferred. People linking remains null/unverified pending complete unreleased Issue50 receipt/review provenance. See [scope and gates](docs/PARTNER-PRIVATE-REVOCATION-20261101.md). Local source only; no production migration, grant, website activation or public endpoint.


## 2026-11-01 — Private Partner issuance and provenance continuation

Prepared private-only Partner access issuance and exact decision assignment/reassignment with current authority locks, CAS and immutable audit. No application role can execute it. Added an unwired server-only canonical provenance adapter; absent accepted Issue50 provider keeps current metadata null/unverified. Native Mac launch is blocked by IPC capacity; actual disposable SQL tests are delegated to existing GitHub CI before security acceptance. See docs/PARTNER-ISSUANCE-PROVENANCE-20261101.md.
## 2026-11-01 — Partner canonical binding prerequisite verification

Preserved accepted issuance and identity adapter; added actual-schema sequential denial and native authority serialization coverage. The replayed baseline lacks Issue50 identity request/review/care tables, so canonical repository wiring remains held and metadata stays null/unverified. Local 22 PGlite checks and 255 Partner/shared-backend Node tests PASS. Native concurrency is prepared for independent review and Linux CI, not executed on the IPC-limited Mac. No runtime, migration, grant, public or hosted changes. See [source mapping and remaining gates](docs/PARTNER-CANONICAL-BINDING-PREREQUISITES-20261101.md).

## 2026-11-01 — Partner owned PostgreSQL acceptance connection

Source-only follow-on to c6026cb6. New unmounted disposable-socket pg8.23.1 binding
owns one fresh idle connection per identity read and closes it on every outcome;
caller transactions, pooled identity reuse and late abort results cannot survive
that lifetime. 16 new local checks plus 64 existing repository checks pass; 14
native driver/session checks prepared for the existing PG18 CI harness. Runtime
SQL, provenance manifests, website and shared staff source unchanged. Hosted
least-privilege execution remains held: row locks require more than SELECT, and
broad private-table owner/grants are not an acceptable binding. No live role,
provider, migration or PR61 change. See canonical repository documentation.

## 2026-10-31 — First unified staff shell (local, not released)

Implemented from production main bfb7af214707db73a3a3164bc96ccafae7de8ccf: staff home, Church/Outreach context, server-filtered organization/campaign selection, shared identity/logout, permission-aware navigation and responsive drawer. Reuses current People and registration RPCs; no migration or grant. Existing brand assets and unrelated systems unchanged. All 42 PR #60 overlaps have explicit source/disposition records. See [implementation and acceptance contract](docs/UNIFIED-STAFF-SHELL.md). Local acceptance passed all 24 existing regression programs, 336 real-SDK browser checks, 229 native PostgreSQL checks and six concurrency scenarios. Two identical 411-file builds preserve 403 existing public files byte-for-byte. Local synthetic acceptance is distinct from independent review, genuine-provider acceptance and production authorization. Original NMI/Gate 0/Outreach/King Kind packages are preserved; PR #57 migration remains blocked.

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

## 2026-11-02 — People stale identity verification correction

A delayed earlier `getUser()` result could overwrite the current People module user after an account switch and falsely expire the newer user's next search/task operation. The result is now assigned only after the boot generation remains current. Chromium/WebKit reproduce the baseline defect; the focused source-only suite covers stale user/null/error/logout, current-account search/task continuity and current denial. See [People identity race contract](docs/OUTREACH-PEOPLE-IDENTITY-RACE-20261102.md). Decision/free-book mounting remains stopped: the current PR72/75 source lacks the accepted campaign/assigned-record decision RPC composition. Existing organization People/follow-up authority and event registration authority are not substitutes. No SQL/Auth/shell permissions, grants, hosted data or release changed; advanced evidence/recovery work remains paused.

## Outreach check-in status compatibility — November 5, 2026

Source-only correction on exact PR72 `eb7ad80c322fe3664273c38f56d176b1e28e1583`: cancelled, no-show and closed household details previously displayed enabled check-in actions although the existing campaign RPC rejects them. The unchanged authoritative SQL remains final; the staff UI now permits check-in only for submitted, confirmed or checked-in households and explains the existing authorized reopening requirement. Unknown statuses fail closed. Waiver, attendance, permission and reversal controls remain unchanged. No SQL, grants, public registration form, branding or release composition change.

Original unnecessary mutation reproduced in Chromium/WebKit at mobile/desktop dimensions. Focused acceptance:108 browser and31 disposable native PostgreSQL checks; affected regressions:96 navigation,216 printable roster and91 DOM checks PASS. Two411-file builds identical, with only the reviewed staff runtime changed publicly. Both permanent new tests join the existing CI without removing coverage. Independent review and exact-head CI remain separate gates. PR102 and its newer privacy protections remain unchanged; this PR72 successor is not full-system or genuine Auth acceptance. Hosted release remains NO-GO.


## November 6, 2026 — Reach older authorized Person follow-up tasks

The existing Person detail workspace now offers stable created_at/id keyset pages, newer/older navigation and explicit latest refresh. Status changes preserve the current page; creation returns to the latest page. The prior newest-100-only limit left older open tasks unreachable. Only existing canonical task reads/status updates are used. No SQL, permission, campaign authority, identity association, public layout or branding changes.

Protected cursors and handlers remain generation-scoped; current session and followup.read/manage authorization are rechecked. A malformed cursor fails closed without constructing a filter. Rows remain live rather than a claimed snapshot. Focused author acceptance:264 browser assertions; unchanged affected People suites:276 creation,222 identity,64 navigation and5 DOM scenarios. Independent Chromium/WebKit review adds56 passing adversarial assertions; exact-head CI is separately recorded. See docs/PEOPLE-FOLLOWUP-PAGINATION-20261106.md. Source-only, not deployed.

## 2026-11-06 — Reviewed task editor composed with current paging

Reuses the accepted PR86 due-date/status editor from da658ea4c0fd9590e969bbc6ad772f02b3a99b12 in PR72's 8fad1b0e98292543a9be27a7960c4ff81521efa3 People runtime. Only the helper's page-return parameter is adapted: older tasks can be rescheduled, cleared and completed while preserving their page. Existing create behavior, paging, search/session cleanup, SDK, backend and public navigation remain unchanged. Exact helper provenance, independent adversarial browser checks and reproducible public builds are required; see docs/PEOPLE-FOLLOWUP-COMPOSITION-20261106.md. Source-only successor; frozen backoffice candidates remain unchanged. Genuine Auth/RLS/recovery and a separate release approval are still required.

## 2026-11-06 — Registration household-search privacy composition

The current PR72 registration branch was missing the six accepted PR90 household-search lifecycle resets. The previous account's identifying search could be sent and displayed after a transition. Recovered only those six resets onto the current check-in/print-roster runtime; all other runtime bytes are checked against exact base 9f78e195115f55135d763e1e5373a494e817423b. Frozen PR90/102, People task paging/editor, SQL, SDK, public registrations and branding remain unchanged. The recovered permanent Chromium/WebKit regression covers callback and missed-callback account changes, denial, logout, history, page cache, stale results and legitimate same-account refresh. See docs/REGISTRATION-SEARCH-COMPOSITION-20261106.md. Independent review, exact-head CI and genuine provider acceptance are distinct gates; source-only, release NO-GO.
