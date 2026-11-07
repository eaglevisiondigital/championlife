# Current-authority printable registration roster

Source-only correction on the PR72 baseline `7699d6cda6309e0d02e1d6058ca1406401a776bd`. Not deployed, not hosted acceptance and not an activation of real staff access. Issues #58/#55 authorize preparation of registration operations; decision/People access remains separate.

## Demonstrated defect and behavior

The existing backup-roster preview checked `registration.export` once before loading the household list and individual details. Its later Print button called `window.print()` without another backend request. A worker whose export permission was revoked while retaining `registration.view` could still invoke the app Print action. The exact baseline reproduces this in Chrome and WebKit at 390, 768 and 1440 pixels.

Each preview and explicit app Print action now starts with the existing fresh registration context and requires its current `registration.export` capability. It builds the six-column roster off-DOM from the existing campaign list and household details. The detail response supplies current household name, phone and status; a household closed/cancelled between list and detail is excluded. Active/attending attendee filtering, guardian/age, waiver coverage, check-in state and configured prize values are preserved. Printing refreshes these values instead of reusing the earlier preview.

After the detail loop, the existing `csv` action checks backend export authority immediately before the assembled roster becomes visible or `window.print()` is called. The CSV content is discarded; it does not replace or expand the six printed columns. No new RPC, SQL, grant, policy, migration or permission vocabulary is introduced. Existing generation, account, campaign, route, detached-control and protected-clear guards retire stale requests. Denial clears the roster; failures do not expose a partial table or trigger printing.

## Audit and limits

There is one existing `registration.exported` audit per successful preparation: one for preview, and one for each explicit print preparation. The old initial CSV check moves to the end of collection, rather than running twice. A denied export adds no successful export audit. The audit records authorized export preparation, not physical printer or dialog success.

These remain multiple independently authorized RPC reads, not an atomic database snapshot. A remote change after the last authorization check cannot be eliminated by browser code. Already disclosed data cannot be recalled; this governs app-triggered preparation/printing, not operating-system printing, screenshots or previously downloaded copies. Existing server authorization remains authoritative.

## Validation

- New permanent real-browser suite: **216 assertions PASS** across Chrome/WebKit at 390/768/1440. Covers current roster changes, cancelled detail, export-only revocation with view retained, revocation during detail collection, delayed navigation/account/campaign/logout/pagehide/protected-clear responses, post-RPC microtask invalidation, old print handles and detail/export failures. Actual browser print is replaced with an observation hook; no physical printing is claimed.
- Exact baseline reproduction: **18 assertions PASS**, confirming six unauthorized app-print reproductions. Run the new browser test with `BASELINE_SOURCE` pointing to the baseline registration script.
- New native PostgreSQL suite: **21 assertions PASS** through unchanged source-matched migrations/RPCs. Covers exact actor/campaign audit, one audit per successful preparation, other account/campaign, revoked export with retained view, expired/inactive assignment, zero audit on denial and byte-equivalent JSON for registration/attendee/signature/domain-event records.
- Existing registration navigation browser suite: **96 assertions PASS**. Existing registration DOM suite: **91 checks PASS**.
- Both new tests are included in the existing Outreach summary review workflow. Fresh exact-head GitHub CI and independent review are reported by the coordinator; local passing results are not substituted for CI.
- Coordinator verified two identical 411-file builds with only `assets/js/outreach-registration-staff.js` differing from the PR72 public baseline. Screenshots and raw logs remain in the private audit workspace, excluded from the website artifact.

Commands: `node tools/outreach/registration-print-roster.browser.mjs`, `node tools/outreach/registration-print-roster.native.mjs`, `node tools/outreach/registration-navigation.browser.mjs`, and `node tools/backend-tests/outreach-registration.dom.mjs`. Native tests accept only a disposable local Unix-socket PostgreSQL instance; synthetic browser routes reject external requests.

No production database, provider, real staff, historical registration/waiver/child record, GiveHub link, decision/free-book workflow, release or hosting configuration was changed. No new owner policy decision is needed for this correction. Real-session acceptance, permissions activation and production release keep their separate existing gates.
