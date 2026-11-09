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

## 2026-11-02 — Nested public resource links (source only)

The shared public script generated relative Supplements and service-time Sermon
Notes links. On nested Bessemer, St Lucia and Outreach giving routes these could
resolve to nonexistent nested resources. Two destination constants now use the
existing root-relative resource URLs; no styles, route rewrites, giving targets,
registration code, authentication or database behavior changes.

Actual local Chromium/WebKit page tests at 390px and 1440px reproduced 20 broken
link resolutions and local 404 responses before correction. The focused test
checks navigation to the existing resources with external requests blocked and
no form submissions. Source acceptance and draft CI do not authorize deployment.

## 2026-11-02 — Public mobile navigation keyboard/state correction

The existing menu disclosure now announces its expanded/collapsed state and the
navigation it controls. English and Spanish open/close labels remain localized.
Escape from the open navigation returns focus to its toggle; other controls and
modal focus are not intercepted. Delegated link closure also covers Supplements,
which the same shared script inserts after initializing the menu. No focus trap,
CSS, imagery, public destinations, staff shell, authentication or payment changes.

The original defect was reproduced in actual local Chromium/WebKit pages at
390px/768px. Isolated regression covers desktop navigation and pointer/keyboard
activation, ordinary link navigation and existing partner interception. All
provider/network interactions are blocked in these fixtures. Source review and
CI remain separate from production approval.


## November 3: first backoffice composition (local source candidate)
Current main plus frozen PR #61 shell and exact PR #72 eb7ad80 People/registration runtimes are composed on a separate branch. PR #61 remains frozen. Current PR #79 public navigation and all SQL/provider configuration remain unchanged. New selected-source verification and parallel focused CI accompany existing regression coverage. No hosted authentication, recovery rehearsal or release is claimed. See docs/FIRST-BACKOFFICE-COMPOSITION-20261103.md.


## November 3: isolated backoffice household-search privacy successor
Frozen PR #84 `40827da3a646a35165e5b3416568dbcc185ce83f` remains unchanged. This successor extracts only the proven normal household-search reset from PR #89 `db61caa31c3f274cd264bf3f846c8d7b8c5209dc`; Event Day arrivals, attendee restoration and its SQL are excluded. The registration runtime clears search on account transition, explicit denial, protected-state cleanup and history/page restoration; verified same-account refresh retains its search. Existing generation guards and authoritative RPC permissions remain unchanged. Permanent Chromium/WebKit coverage is added to existing composition CI, with the selected-source hash rebound only for this runtime. Local and independent checks are recorded in the separate private audit package. Genuine Auth/recovery and website release remain unaccepted and separately gated.

## 2026-11-04 — Permission-aware staff module navigation (source successor)

Frozen PR #90 remains unchanged. A separate successor adds existing Events,
private Forms and restricted Dream Team links to the approved shell using exact
current organization/campaign permissions. Module-only authority does not confer
People, household, financial or course authority. Forms scoped access uses its
canonical private context; no form identifiers are retained in navigation.

The narrow integration also closes a reproduced delayed People RPC response leak
after an account changes without a callback. Protected content and the old account
label retire before stale data can reach the module. Fresh navigation/discovery
checks preserve current local-session fencing. Module pages/SQL remain explicit
composition dependencies; this source branch is not a standalone release package.
No production installation, account, grant, SDK, styling or provider changes.

A second independently reproduced gap affected direct Person task INSERT responses,
which bypass the shell RPC adapter. The existing People request wrapper now fences
returned and thrown/error outcomes against current local identity/client before
old-account private review or uncertain-save controls can return. Same-account
uncertain writes retain the original no-retry handling; no records are rolled back
or replayed by this browser correction.


## November 7 — Financial review return navigation (source only)

Financial-only staff already admitted by Staff123 can return from Partner review to the same organization's Staff home using the existing outreach.view AND finance.read permissions. People return separately requires people.read. Denial recovery now opens the actual Staff home. Local synthetic original reproduction and current positive/negative browser checks are recorded in tools/partner-home-cycle22; hosted acceptance is not performed. Existing Staff123 required CI remains INCOMPLETE (21 PASS/1 runner shutdown, cause UNKNOWN), without retry. No SQL, grants, SDK, branding, provider or release change.

## Source-only Staff check-in composition — 2026-11-08

Dedicated successor of Staff126; only registration runtime delta from reviewed Registration134. Removed/reinserted check-in controls permanently retire; current authorized check-in/reversal and household status remain unchanged. No new backend authority, SQL, SDK, host navigation or branding. Existing source/build guards extended with exact reviewed bytes and permanent mounted-host/native regression tests. Local and exact-head CI evidence is recorded in the private `audit/staff-checkin-integration-2026-11-08/` package; historical failures remain preserved. No genuine hosted acceptance or production action. RELEASE NO-GO.

## 2026-11-08 — Check-in actual pre-dispatch veto (source only)

Successor based solely on Staff PR135 `773d32ef4a3d86819931fd1a76700e5d1457a6fe`.
The original Chromium/WebKit reproduction issued a new check-in HTTP request after
control removal/reinsertion while Staff session verification was held. The pinned
SDK performs a second asynchronous token lookup; a session can also change there
without an Auth callback. The existing client now uses its supported custom fetch
hook and a private one-shot signal-bound veto immediately before native fetch.
Check-in/reversal bind permanent control lifetime, campaign/view, Staff epoch/client
and exact preflight bearer. No await follows the final veto before dispatch; no
abort is issued after dispatch. Existing canonical SQL, grants, UI and audits are
unchanged. No new Auth client, permissions, retry or server authority is introduced.

Source/browser/native validation and independent review evidence are recorded in
private audit/staff-checkin-predispatch-2026-11-08. Historical PR135 failures remain
preserved; no run is retried. Genuine Auth/RLS/recovery and production approval remain
separate. RELEASE NO-GO.

## 2026-11-08 — Household and attendee dispatch continuity (source only)

Direct successor of PR136 `8691d618f29e8988c51928132aa4a622276c5e8d`.
Actual Staff household updates and attendee additions reproduced new HTTP mutations
after initiating controls retired during either Staff session preflight or SDK token
lookup. Reuse the accepted dispatch veto for these two existing RPC actions, and bind
attendee submission to its actual submit button so removal/reinsertion retires it.
No new Auth client, token mechanism, SQL, permissions, client-key or revision policy.
Existing check-in/reversal protection remains unchanged. Native tests verify current
household state, revision conflicts, client-key duplicates, waivers and immutable audit.
Private evidence: audit/staff-household-workflows-2026-11-08/.

The bounded local shell investigation completed after cross-tab sign-out in Chromium
and WebKit390; it did not reproduce the prior CI stall. Preserve UNKNOWN and original
15-minute cancellation; no historical CI retry or timeout change. Source, new-head CI
and genuine hosted acceptance remain separate. RELEASE NO-GO.

## 2026-11-08 — Attendee and waiver dispatch continuity (source only)

Direct successor of PR137 `7adeec04d466937b85fce15b998242a4075b5037`.
Actual Staff save/remove attendee, signature recording and waiver correction each
reproduced new HTTP and canonical database changes after controls retired during
Staff session verification or SDK token lookup. Extend the same accepted final
pre-dispatch veto to attendee_update, sign and waiver_correct. Bind signature form
submission to its actual submit button, preserving permanent retirement.

Payloads, request keys, attendee revisions, guardian and signer requirements,
consent, immutable waiver/correction history and canonical audits are unchanged.
No SQL, grants, Auth-client/helper, SDK/SRI, UI or deployment change. Existing
household/add-attendee and check-in/reversal protections remain intact. Focused
browser/native regression and one bounded independent security review are recorded
in private audit/staff-attendee-waiver-2026-11-08. Genuine hosted acceptance remains
separate; historical failures preserved. RELEASE NO-GO.

## 2026-11-08 — Complete walk-up dispatch and attendance journey (source only)

Direct successor of PR138 `3d03a59f2fbd5c235d5761f6a59b9fdaaa202a72`.
Walk-up registration reproduced NEW HTTP after initiating controls retired during
Staff-session verification and SDK-token lookup. Bind the existing shared form's
submit event to its actual submit control before that form disables the button,
and pass the existing permanent-lifetime veto through the accepted Staff transport.
No shared form, legal payload, SQL, permissions, request keys, Auth helper or SDK changes.
All previous attendee/waiver/household/check-in dispatch protections remain intact.

Focused real-host browser and disposable native PostgreSQL tests cover the adult/
minor/guardian and media-consent workflow, canonical roster, check-in, partial/final
reversal, exact totals and audit history, duplicate/conflicting request keys,
expired/revoked authority and already-submitted responses. Fictional Auth is not
hosted acceptance. Private evidence: audit/staff-walkup-journey-2026-11-08/.
Historical CI failures remain preserved. Independent review and exact-head CI are
reported separately; genuine Auth/RLS/recovery and release approval remain held.
RELEASE NO-GO.

## 2026-11-08 — Event-day roster and export continuity (source only)

Direct successor of PR139 `1d5d884259d49f4bf3c6e644341a5167a0bf4b2e`.
Existing household lookup, waiver-aware arrival/reversal, separate campaign totals,
CSV and private roster are reused. Actual-host tests reproduced a delayed CSV
publishing after its initiating button or ancestor retired. Pass the existing
permanent-control lifetime callback into Export CSV and recheck immediately before
download. A completed authorized export request/audit is preserved; this does not
recall an already downloaded file or invent new server authority.

Only the registration Staff runtime changes. SQL, export payload/projection,
permissions, legal history, session/Auth helpers, SDK, UI and previous dispatch
corrections remain unchanged. Existing guard recipes append exact reviewed source.
Focused browser/native tests cover search, attending versus checked-in totals,
waivers, partial/final reversal, scoped CSV/print, child-data denial, session loss
and mobile/desktop navigation. Private evidence: audit/staff-eventday-2026-11-08/.
Synthetic local acceptance is separate from exact-head CI and genuine hosted
Auth/RLS/recovery. Historical failures preserved. RELEASE NO-GO.


## 2026-11-08 — Interrupted attendance recovery (source only)

Direct successor to PR140 `f31a7829be6ad46047d0556bdcd46934e4c12a75`. Check-in/reversal now require exact `saved:true`; lost or malformed replies retire the old detail controls and offer a separate, freshly authorized read of current attendance. No automatic write retry. Explicit canonical validation rejections remain distinct, while permission/session denial still clears protected content. A refreshed state is explicitly not proof of which request changed attendance.

Existing SQL/audit/waiver history, permissions, SDK/shared Auth and all public pages remain unchanged. The canonical attendance RPC lacks a caller-bound durable operation receipt; detail and audit cannot attribute an uncertain request, especially under another authorized operator's changes. Local fictional Auth/PG17/browser evidence is not genuine hosted Auth/RLS acceptance. RELEASE NO-GO; no hosted action, grant, deployment or sending authorized.


## 2026-11-09 — Household and attendee edit recovery (source only)

Direct successor to PR141 `5e1dcbfccbc5751b2131ffb7cb4fe09e5ecee54a`. Existing canonical revision checks remain authoritative. The two edit saves now distinguish exact schema-bound stale-revision rejection, explicit validation rejection, and UNKNOWN/lost or malformed responses. Confirmed success requires `saved:true`. Conflict/UNKNOWN retires old mutation controls, retains current local edit fields read-only, and offers fresh permission-scoped current-record inspection. No retry, revision rebasing, inferred operation receipt or overwrite. Explicit discard reloads current data for a deliberate new edit.

Drafts are view-lifetime DOM state only, not persisted. Removal, navigation, account/scope retirement and permission denial clear retained edit fields and inspection content using the existing permanent-control observer. Inspection requires fresh registration.view and registration.manage; it grants no other domain authority. No SQL, shared Auth, consent/guardian/waiver/audit, SDK, deployment or public form change. Local synthetic verification and exact-head CI remain separate from hosted acceptance. RELEASE NO-GO.


## 2026-11-09 — Attendee removal recovery (source only)

Direct successor to PR142 `6a0c1bc121eb8dbf7873046c6485d37e72ce91d8`. Removal now reuses the existing attendee save/revision recovery helper with the unchanged attendee_update payload. Conflicts and UNKNOWN replies retire old mutation buttons, preserve current local fields read-only and offer fresh authorized exact-ID inspection/discard. No automatic retry, revision rebasing, identity inference or operation-receipt claim. Native active=false tombstones, revisions, consent, guardian requirements and immutable legal/audit history remain unchanged.

Focused actual-Staff/SDK tests cover successful removal, lost/malformed replies with and without commitment, concurrent edits/check-in, revocation, foreign campaign/account denial, retired controls and read-only reconciliation. Connected event-day coverage verifies remaining-attendee check-in, current totals, authorized CSV/private roster and final reversal after removal. No SQL/shared Auth/SDK/public form or permission changes. Synthetic local and exact-head CI results do not constitute genuine Auth/RLS acceptance. RELEASE NO-GO.
