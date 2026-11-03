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
