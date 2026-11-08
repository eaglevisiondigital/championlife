# Isolated decision campaign workspace

This source-only successor composes PR80's unchanged assigned-record foundation and PR81's unchanged staff view. It adds no public route, public build input, login, grant writer or replacement backend. Frozen PR61 and approved staff HTML, CSS, logo and Powered by Propel link remain unchanged.

## Trusted discovery and existing UI reuse

`mountCampaignDecisionWorkspace({root, auth, workspace, eventTarget, projectRef})` accepts the existing shared staff client and a trusted caller-owned DOM root. It starts unavailable; `refresh()` obtains `campaign_decision_directory()` without caller-supplied organization, campaign, role or permission hints. The exact backend response is:

```json
{
  "kind": "assigned-decision-campaign-directory",
  "campaigns": [{
    "organization_id": "UUID",
    "campaign_id": "UUID",
    "campaign_name": "Approved campaign name",
    "scope": "assigned",
    "capabilities": ["decisions.read"]
  }]
}
```

The sole additional permitted capability is `followup.manage`. Unknown fields, duplicate campaign pairs, malformed identities and unsupported capability names fail closed. The UI projects only campaign identifiers and name. It exposes no record counts or source strings. A valid finite decision assignment may discover a campaign with zero assigned records; its list stays empty. Registration-only and organization People authority never substitute for decision access.

Selecting a campaign first retires the prior panel and repeats current-user verification and backend discovery. Only a currently returned campaign can mount. The existing `mountCampaignDecisionView` then performs its own unchanged foundation `context` checks before and after list/detail/save. The directory is discovery, not a substitute for record-level database authorization.

`select(organizationId,campaignId)` is constrained to the current server-returned directory. `snapshot()` exposes immutable minimized state; no tokens are projected. `close()` clears content, timers and subscriptions. The fixture uses the exact existing staff-home HTML/CSS and assets, native labeled selector and existing panel/button classes. It does not assert that the currently frozen public staff workspace discovers decision-only roles.

## Session and revocation boundary

Before and after asynchronous operations, the mount validates the same shared client, explicit nonproduction project pin, Auth and REST URLs, authenticated `getUser` identity, confirmed non-anonymous account, token equality and finite session expiration. Production project fallback is rejected. It never constructs a Supabase client or initiates login.

A stable local facade delegates RPC and Auth operations to that same client. It observes explicit foundation denials so campaign metadata disappears along with the child view. It does not alter the shared client, headers, credentials or permissions. Foundation responses are matched to their captured principal/token and campaign. A delayed denial for the same current principal/campaign invalidates a newly rendered panel; a retired account or unrelated campaign cannot clear an independently authorized new context. Directory denials apply to the current captured principal because discovery spans that principal's allowed campaigns.

Logout, token refresh, account updates, protected-shell clear, explicit denial, storage changes, pagehide/pageshow and back/forward events synchronously retire the directory and child panel. Auth callbacks do not await nested Auth calls. Every selector render has an immutable generation/directory binding; detached controls cannot select a new account's campaign. Existing immutable Save tickets remain protected by PR81. Generation checks remain authoritative when transport cancellation is unavailable.

Temporary network failures clear directory results without falsely claiming revocation. A missing directory RPC displays an explicit not-installed state and never falls back to event or People rights. Post-submission save uncertainty retains PR81's UNKNOWN behavior: no automatic retry or fabricated success/rollback. A previously submitted transaction may have committed; fresh authorization and authoritative read are required.

## Boundaries and honest limitations

No contact, email, phone, prayer, message, export, assignment, learner-answer or financial controls are added. Follow-up workflow status is not course completion. King Kind usage remains uninstrumented. There is no polling or live provider claim; an unannounced server permission change becomes observable when the server responds, while the backend remains authoritative for every request.

This source cannot establish real Supabase Auth catalog compatibility, actual administrator authority, source-map provenance or independently witnessed recovery. Existing provider and operational gates remain mandatory. Assignment requests remain non-executable until an approved authoritative issuer/reviewer, policy, evidence source and immutable issuance audit exist. No source mappings or staff assignments are created by the runtime.

## Reproducible local checks

Use the existing locked backend test dependencies and installed Chromium/WebKit:

```
node tools/outreach/campaign-workspace-mount.test.mjs
node tools/outreach/campaign-workspace.browser.mjs
```

The browser harness calls `createCampaignFoundationTestHost({directory:true})`, replaying the reviewed baseline, unchanged PR80 foundation and new read-only directory migration in disposable native PostgreSQL. It uses fictional shared Auth responses and allows no external browser requests. This is real PostgreSQL authorization with synthetic identities, not genuine Supabase email/Auth acceptance. `CAMPAIGN_TEST_HOST` is an optional local cross-worktree import for review; `CAMPAIGN_EVIDENCE_DIR` records private screenshots. Both are test-only environment inputs and not application configuration.

Coverage includes decision-only versus registration/People scopes, empty permitted campaigns, foreign campaign rejection, record-level assignment, expiration and revocation, same/old-principal delayed responses, session retirement, account changes, history, detached Save/selector controls, UNKNOWN saves, missing backend and desktop/mobile branding/overflow.

## 2026-11-08 — Follow-up desk

The existing view can filter its currently authorized page by literal name, follow-up status and ministry-follow-up consent, and displays the existing next-review date. Apply, clear and refresh repeat the same `context/list/context` read; no search parameters, broader directory, count RPC or new data authority are introduced. Counts describe the current page only; page navigation is based on the unfiltered maximum of 50 assigned records. Filters remain in memory, are never serialized into URLs/storage, and clear on account/scope retirement, denial and re-selection.

The adapter pins subsequent reads to its previously verified principal, including silent account/token replacement without an Auth callback. Re-selection starts a fresh authorized context. Existing owner-only learner APIs are not called. Follow-up status `completed` does not certify course completion; no book-usage or private contact information is inferred. Existing source assignment, campaign permission, identity provenance and hosted installation gates are unchanged.

The new desk actions are read-only. The existing separately authorized follow-up editor retains its original consent, revision, request-id, audit and uncertainty protections. The workspace remains unmounted in public output. Genuine scoped Auth/RLS acceptance, approved source/assignment provenance, protected host composition and operational recovery remain prerequisites to any release.
