# Financial review return navigation

Source-only successor to Staff123 bdecc592d1a0544330934ef2fc5a254a9b54d3d3.
Existing financial-only staff could enter home and Financial Outreach Review but
its home return incorrectly required people.read. The denial panel also sent its
Staff Home link to People, which independently denied that same user.

Home return now uses existing same-organization outreach.view AND finance.read;
People return also requires people.read. The existing fresh-context RPC, current
session/organization/generation and permanently retired control checks remain.
Denial recovery opens scope-neutral staff-home.html for fresh authorization.
There is no record, person or intake identifier in either home-return URL.

The permanent actual-page Chromium/WebKit suite uses accepted SDK2.118.0 and
fictional intercepted transport at390/1440. It covers full list/detail roundtrips,
People-independent authority, split organizations, department scope, revocation,
silent account replacement/logout, late responses and removed/reinserted controls.
REVIEW_BASE=bdecc592d1a0544330934ef2fc5a254a9b54d3d3 reproduces the original
failure at the first home-return assertion. Historical tests/assertions/workflows
remain exact through current-first source verification and frozen projections.
Only the Partner runtime changes among430 public outputs. Current build scripts
verify the actual candidate; historical evidence stays separate.

Staff123 required CI remains INCOMPLETE:21PASS/1runner shutdown, cause UNKNOWN.
No rerun, weakened assertion, timeout change, hosted Auth/RLS acceptance, SQL,
permission, identity link, messaging, payment, deployment or release approval.

## Staff check-in composition — 2026-11-08

Staff126 `95723fae9d4cbc16eb80e350191495b4d37d4498` retains its host, session, SDK, People, permissions, navigation and branding. The sole runtime delta is the byte-identical reviewed registration control-retirement correction from Registration134 `0c246a96ccd9e280dd423eb91c623559b7fdb064`; its parent runtime equals Staff126. No SQL, public HTML, deployment configuration or other runtime changes.

The existing exact derivation chain retains every historical assertion. Six build readers additionally require the exact reviewed registration bytes. The native journey and status tests are copied byte-identically from PR134, not historical runtime or workflow merges. The mounted-host test loads actual current source and pinned SDK, using fictional transport; `REVIEW_BASE=95723fae9d4cbc16eb80e350191495b4d37d4498 REPRO=1 TEST_BROWSER=chromium` reproduces the old reinsertion mutations. Normal runs deny retired handlers while fresh check-in and reversal remain available. Chromium/WebKit exercise mobile/desktop, session expiry, account replacement, campaign denial, navigation retirement and already-submitted requests. PostgreSQL fixtures are local/disposable only.

Historical Staff126 runner shutdown and earlier WebKit failures remain recorded, not reclassified. New CI is attached to the new exact candidate only. This is neither genuine Supabase Auth acceptance nor release authorization. RELEASE NO-GO.

### Actual check-in pre-dispatch boundary (PR135 successor)

`registration-predispatch.browser.mjs` holds both Staff session verification and
SDK token lookup using the pinned real SDK and actual Staff source. Retired controls,
ancestors, campaign/account replacement and access denial must produce zero new
HTTP mutations; unchanged authorized controls produce exactly one. Existing host
checks retain already-dispatched response semantics and native tests retain the
canonical household/check-in/audit contract. The transport veto is local denial
only; SQL authorization is unchanged. Missing callback or bearer fails closed.
Token refresh during the gap denies an unsent operation; no automatic retry occurs.
The original PR134 runtime and every historical derivation remain pinned as exact
inputs to the new bounded correction. Three runtime files change; no public HTML,
SQL, styles, assets, SDK pin or build allowlist changes.

### Household editing and attendee additions

`household-predispatch.browser.mjs` reuses the mounted-host/SDK fixture for both
`update` and `attendee_add` at Staff and SDK async boundaries. It covers current
positive actions, button/form/ancestor retirement, account/campaign replacement,
denial and retained handlers. `household-native.browser.mjs` serves actual Staff
modules with fictional Auth and routes registration HTTP to disposable PostgreSQL;
it verifies authorized saves, revision conflicts, immutable signatures/audits,
client-key duplicate/conflict behavior, child waiver coverage and denied scopes.
The accepted transport helper and existing check-in/reversal tests remain unchanged.


PR137 successor extends the existing dispatch veto to save/remove attendee,
signature recording and waiver correction, preserving legal payloads and SQL.
`attendee-waiver-predispatch.browser.mjs` runs all four actual-host journeys across
Staff-session/SDK-token gaps with fictional HTTP. `attendee-waiver-native.browser.mjs`
uses the unchanged canonical SQL in disposable PostgreSQL and verifies revisions,
request keys, guardian/acknowledgement rules, consent, immutable signatures,
append-only corrections, audits and already-submitted outcomes. `REVIEW_BASE` pins
original runtime bytes for negative reproduction; `REPRO=1` retains the final
strict zero-new-mutation assertion while collecting original failures. No hosted
activity or additional authority. All earlier tests remain intact.

### Walk-up registration through final reversal

The PR138 successor connects walk-up submission to the same permanent control
lifetime and final HTTP veto. The guard wraps the original form event before the
unchanged shared form disables submit; its callback retains existing legal
validation, immutable request payload and request-key behavior. No SQL/Auth helper
or public form changes. A request already dispatched is not retroactively cancelled
or automatically retried.

`walkup-predispatch.browser.mjs` exercises actual Staff, shared form and pinned SDK
at both async boundaries, including button/form/root removal, account/campaign
replacement, revocation and retained callbacks in Chromium/WebKit desktop/mobile.
`walkup-native.browser.mjs` uses the existing canonical SQL with fictional Auth and
disposable PostgreSQL: authorized adult/minor walk-up, guardian/waiver/media rules,
request-key concurrency, atomic denial, legal history, roster, check-in, partial
and final reversal, totals and audit. REVIEW_BASE/REPRO preserve strict original
failure evidence. All earlier tests, historical derivations and CI limits remain.
No hosted acceptance, provider operations, new permissions or release authority.

### Event-day lookup, attendance and private output

The PR139 successor retains the existing event-day journey and adds only a final
initiating-control lifetime check before publishing a delayed CSV. The existing
button guard supplies the callback; no shared Auth/SQL or export projection changes.
An authorized request already completed may retain its audit, while the retired
UI intent must not initiate a download. Files already downloaded cannot be recalled.

`eventday-export.browser.mjs` serves the actual Staff host and pinned SDK with
fictional transport; it covers button/ancestor/root removal, replacement, account,
campaign, expiration, denial, pagehide, current positive downloads and old handlers.
`eventday-native.browser.mjs` uses unchanged canonical SQL in disposable PostgreSQL
for household name/phone/email/reference lookup, unfiltered campaign totals,
adult/minor/waiver/nonattending rules, arrival and partial/final reversal, immutable
history, scoped CSV/private print, denied export and account/campaign/session loss.
Both engines run mobile/desktop. No new realtime mechanism or permission exists.


### Interrupted attendance recovery (PR140 successor)

`attendance-recovery.browser.mjs` reuses the existing actual-Staff event-day fixture and disposable canonical PostgreSQL. It covers confirmed check-in/reversal; explicit validation and permission denial; lost responses with/without commitment; malformed success; concurrent authorized changes; account/campaign replacement; retired mutation and recovery controls; and fresh read-permission revocation. Both Chromium/WebKit at 390/1280. No mutation is automatically retried. Reconciliation calls only `context` and exact-ID `detail`; no name/date matching or request-attribution claim.

`REVIEW_BASE=f31a7829be6ad46047d0556bdcd46934e4c12a75 REPRO=1` preserves strict original failure evidence. One original local candidate test fixture violated the existing capability check by retaining checkin.manage without registration.view; it was corrected to revoke both, without changing SQL or guards.

Backend dependency: checkin/reverse returns saved/already flags but accepts no caller operation key and exposes no durable actor/request-bound terminal receipt. Current attendance and immutable audit history cannot establish causation for an interrupted request. This package adds no backend authority or receipts. Hosted acceptance and release remain unapproved.


### Household/attendee edit recovery

`edit-recovery.browser.mjs` reuses the actual Staff/SDK and disposable canonical PostgreSQL fixture. Both engines at390/1280 cover confirmed edits, exact revision conflicts, validation/permission denial, lost and malformed responses, fresh read-only inspection without draft overwrite, explicit discard, simultaneous revision writers, revoked management, account/campaign changes, page/DOM retirement and late reads. No new database/receipt/authority. Existing PR141 attendance recovery and all prior suites remain unchanged.

`REVIEW_BASE=5e1dcbfccbc5751b2131ffb7cb4fe09e5ecee54a REPRO=1` reproduces missing conflict/UNKNOWN inspection and observes original captured-draft retention. Draft preservation is limited to the current view; navigation/focus reauthorization teardown discards it rather than persisting private data. The new inspection compares only fields already submitted by this editor, never raw record payloads. No read is presented as request-causation proof.

The first new WebKit fixture advanced to the next navigation while campaign-denial Auth work was still unsettled. Preserved diagnostic evidence records the denial link absent at that boundary. The fixture now asserts the actual denied Staff state before moving on, retaining the strict empty pageerror assertion. No SDK/Auth runtime cancellation change or historical WebKit root-cause claim is made.


### Attendee removal and connected roster recovery

`removal-recovery.browser.mjs` reuses the accepted actual-Staff/native PostgreSQL fixture. It verifies exact active=false tombstones and revisions, two canonical removal audit events, immutable signature/coverage/correction history, concurrent revision writers and checked-in removal denial. Conflict/UNKNOWN offers the same existing context/detail inspection; retained removal and inspection controls cannot retry or publish late data. Management revocation clears drafts even when view permission remains. Account/campaign/page retirement preserves already-submitted request semantics.

Both engines at390/1280 also follow removal -> remaining attendee check-in -> current totals -> scoped CSV/private roster -> final reversal. The test uses synthetic waivers, not legally accepted documents. No actual messages, printing or hosted data. `REVIEW_BASE=6a0c1bc121eb8dbf7873046c6485d37e72ce91d8 REPRO=1` preserves original missing recovery failures. `JOURNEY_ONLY=1` runs only the additional connected journey for focused local verification; CI has neither override and runs all cases. The initial fixture incorrectly expected check-in to leave the attendee revision unchanged; its preserved failure was corrected to assert the actual revision conflict and separately prove current-revision checked-in rejection.

Existing SQL provides row revisions/audits but no durable actor/request-bound terminal receipt. Current active state is not proof of which uncertain request committed. This is a current-view recovery, not an across-device exactly-once guarantee. All historical guards and workflows remain mandatory.
