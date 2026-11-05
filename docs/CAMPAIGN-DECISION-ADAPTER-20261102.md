# Unmounted assigned-decision staff consumer

Source-only successor to PR80 `5a675eff43a37f3fba2425b834b084b22bb1e281`. The accepted SQL and public build are unchanged. This panel is not installed, publicly mounted or an authorization system. PR61 stays frozen.

## Exact integration contract

`createCampaignDecisionAdapter` accepts the existing verified `auth` shared client, current staff `workspace.active()`, browser lifecycle event target, a campaign-directory hint containing exact `{organizationId,campaignId}` pairs, and a pinned nonproduction `projectRef`. It does not construct an Auth client or sign anyone in. Client, Auth and PostgREST URLs must remain pinned throughout requests. Production project fallback is rejected.

Only the reviewed `campaign_decision_foundation` RPC is callable. `context`, `list`, `detail` and `followup_save` have fixed parameter shapes. Neither the directory hint nor a browser claim grants authority. PostgreSQL checks current verified user/session, finite campaign assignment, exact source mapping and record assignment. Context is checked before and after each read/write; current shared session identity and token are checked around every asynchronous response. Actual backend denial clears protected state. Late denials are processed before rejecting obsolete navigation results when their captured verified principal, token, organization and campaign still match the current workspace; denials from an old unrelated account or campaign do not clear newly authorized state. Supabase Auth callbacks perform synchronous invalidation only.

Selection and every read advance navigation generation. Logout, account/token change, protected-shell clear, access denial, storage events, pagehide/pageshow and history restoration invalidate retained controls and results. Session expiration also clears state. Requests use AbortSignal when supported; generation checks remain authoritative when cancellation is unavailable or late. Fresh explicit selection and authorization are required after invalidation.

The view mounts only into a caller-owned trusted DOM root. It uses textContent and existing `panel`/`btn` classes, approved staff-shell CSS and native labeled controls. Pagination uses the exact 50-record page contract, with Previous/Next controls and no invented totals. Retained list/back/pagination handlers check the exact current snapshot; Save handlers carry an opaque immutable ticket tied to the exact user/session, campaign, record, navigation and revision. Tokens stay in a private WeakMap, never snapshots, DOM, logs or storage.

## Data and mutation boundary

The client projects only assigned registration ID/name, workflow status/revision/date, consent flag and existing reviewed-identity classification. Email, phone, prayer, raw source payload, learner answers and notes are never passed into the view. No contact/history/export/messaging/People-edit/assignment controls exist. Book use is uninstrumented and course completion unavailable. Workflow status is not learner completion.

Saving supports only the existing follow-up status and next-contact date fields (displayed as next review date). The reviewed SQL requires `followup.manage`, current consent and current record assignment, then applies revision CAS and immutable audit. The adapter generates one canonical request UUID for a single submission. Double submissions and old tickets reject before mutation. No automatic retry exists. A missing/invalid post-submission response becomes an explicit uncertain outcome with controls removed. Confirmed post-save authorization denial instead shows access unavailable and removes controls. Neither path claims success or rollback; a request submitted before denial may have committed. After fresh authorization, an authoritative detail read can show the committed state. Reconciliation/retry through a stored receipt is not implemented in this package.

Browser state cannot erase previously seen information, revoke already-submitted transactions or detect an unannounced server change before the server communicates it. Backend authorization remains final for every request. Deployment must provide the shared shell's immediate invalidation events; no live subscription, polling or auth acceptance is claimed here.

## Local test commands

Install the existing pinned backend-test dependencies. With local PostgreSQL binaries and Chromium/WebKit installed:

```
node tools/outreach/campaign-decision-adapter.test.mjs
node tools/outreach/campaign-foundation-adapter.native.mjs
node tools/outreach/campaign-decision.browser.mjs
```

The browser suite mounts in the original staff-home document with its approved CSS/assets, using fictional shared Auth responses and real source-matched disposable PostgreSQL RPC calls. All remote network is denied. It is not genuine Supabase Auth/provider proof. `CAMPAIGN_EVIDENCE_DIR` optionally records screenshots. `CAMPAIGN_TEST_HOST` is a local cross-worktree test-only import override before integration.

## Gates preserved

No public HTML/allowlist, shared Auth, SDK, existing migration or approved branding changes. No assignment execution, real grants, contact activation, hosted SQL, messages or production deployment. Assignment provisioning still needs separately approved operator/authority and execution controls. Native provider compatibility and independently witnessed recovery, protected genuine Auth acceptance and production approval remain separate gates.

The existing staff directory is still based on Church People and event-registration authority. It does not yet discover decision-only campaigns for a decision-only worker. A separately reviewed scoped discovery/mount step is required before this consumer is usable in the shared staff shell; event-registration capabilities never substitute for decision authority. The existing shared RPC wrapper can return a Promise without AbortSignal support, so generation and verified-session checks are required regardless of cancellation.

## 2026-11-05 — Rejected request denial retirement

A shared RPC boundary can reject with a structured server error instead of returning an error response. The adapter now applies the same current-principal/token/organization/campaign denial retirement to both forms before obsolete navigation results are discarded. An explicit late denial removes newer same-scope details and retained Save tickets. Old-account denials and ordinary late transport failures do not retire independently authorized current state. Other exception behavior and all server authorization remain unchanged.

Permanent tests cover the six supported denial representations and actual disposable PostgreSQL revocation delivered through a rejecting boundary in Chromium/WebKit desktop/mobile. These are synthetic Auth/local SQL tests, not genuine Supabase provider acceptance. The existing PR82 discovery/mount remains source-only; public deployment, hosted installation and assignment issuance remain separately gated.

## 2026-11-05 — Immutable follow-up save intent

A reusable consumer caller could mutate its update object while the adapter awaited current Auth/context checks. Validation read the initial status/date, but payload construction read the later values. The adapter now requires own `status` and `nextContactOn` fields, captures each exactly once, and validates those scalar values before awaiting. Dates accept only null or primitive date strings; mutable coercible objects are rejected. The original values remain bound to the same existing opaque record/revision ticket and newly generated request UUID. A caller change cannot silently turn an in-progress follow-up into completed or replace its next review date. Authorized fresh submissions still work, and logout/revocation/stale controls remain denied.

Permanent checks reproduce the original fault and test delayed context verification, changing accessors, malformed/inherited values, double submissions and logout. Chromium/WebKit at desktop/mobile sizes use fictional Auth and the exact disposable PostgreSQL RPC; saved state and immutable audit must reflect the original intent. This was a consumer-integrity gap, not a demonstrated database authorization bypass or production incident. No public mount, SQL, RLS, permission or existing branding changes.

### Canonical task integration remains separately bounded

The accepted foundation's `detail` action reports only an existing reviewed Person-link classification to this view. Its supported campaign mutations remain `followup_save` status/date updates; no canonical `followup_tasks` action exists. Existing canonical task RLS/guards independently require organization-scoped People/follow-up permissions and authorized assignees. Campaign `followup.manage` does not confer those permissions. Therefore this correction does not wire campaign controls into the generic People task API, create identity/source mappings, copy restricted fields, or activate assignment issuance. A separately approved exact campaign-to-Person task contract and source/issuance governance are prerequisites for that connection. Existing Forms, Events, check-in and shared staff source remain byte-identical; this focused consumer acceptance does not claim full system composition or genuine Auth acceptance.

## 2026-11-05 — Reentrant caller lifecycle fence

Independent post-publication review of the first immutable-intent successor found that an update getter/proxy could reselect a campaign during validation before the adapter captured its navigation generation. Save now captures original scope, generation and verified principal alongside the original snapshot before touching caller properties. After capturing scalar intent, it checks the original guard and exact current snapshot/busy state before entering saving. Reselection, revocation, close, logout, history and account changes cannot promote an old ticket into a new navigation scope. If a getter legitimately begins another Save first, the retired outer operation rejects without overriding or clearing that nested operation.

The original one-shot getter fault also reproduces on the preceding PR104 parent; an always-reselect getter happened to reject there on its second read. Both observations are retained. Permanent unit checks cover status/date accessors and own-key/property-descriptor proxy traps, callbackless account changes and nested saves. Native-SQL Chromium/WebKit checks verify zero stale submissions and zero new successful audit entries after reentrant reselection, followed by successful fresh authorization. No SQL or backend authority changes are involved.
