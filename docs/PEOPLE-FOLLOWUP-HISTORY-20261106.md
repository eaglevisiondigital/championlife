# Read-only task date and status history

Based on Outreach PR72 `6e04acaef569228dfac8e621ef4c1de5c558b889`, this source-only increment adds **View task history** and **Hide task history** to existing Person task cards. Previously staff could change a due date or status but could not inspect the existing audit records from that card. The original absence is reproduced in Chromium and WebKit before the change.

History loads only when requested. It displays creation, date rescheduling/removal, status transitions, revision and local timestamp. An update to other fields is described only as an update with unchanged status/date. Historical title, actor, assignment, raw before/after JSON and financial intake details are neither requested nor rendered. These are recorded task changes, not evidence of a message, payment, campaign eligibility or task completion outside the canonical record.

The view requests 51 events ordered by `occurred_at DESC, id DESC`, displays at most 50 and explicitly says **“Latest 50 changes. Earlier history is not shown.”** when a lookahead event exists. It is a recent-history view, not a complete export or consistent snapshot. Empty data says history is unavailable, not that no event could ever have existed. Hide removes history from the DOM; reopening refreshes it. Nothing is persisted in browser storage. Existing task page cursors, status/date editors, creation, registration search, branding and shared shell/session are unchanged.

## Existing authority and binding

No migration, RLS policy, RPC, grant or write is added. `followup_task_events` already permits the existing verified `people.read` plus `followup.read` authority and composes with the restrictive financial-task policy. Management permission is not required for history. Authenticated clients cannot update or delete audit events; this is not a claim of immutability against database owners or service authority.

Before reading events, the helper rechecks current permissions and binds the visible task to its organization, canonical Person and task ID through the existing `followup_tasks` SELECT. Task identity is immutable under the existing guard. The event query filters organization and task; returned identifiers must match exactly. Only typed status/date/revision projections are accepted. Created events require null prior state, revision 1 and open status. Updated events require adjacent positive integer revisions and known statuses. Invalid calendar dates, malformed timestamps, duplicate event IDs, mismatched scope or malformed rows withhold the entire result.

The history helper captures current account, client/auth objects, route, organization, Person/card and module generation. Fresh session checks surround the read and final permission refresh. A hidden, detached, retired, replaced-account/client or protected-clear response cannot publish history. A current denial clears access; an error presents a fixed message without raw server detail. Duplicate clicks while pending issue one read. This is a frontend publication boundary plus existing database authorization, not a new transaction-finalization guarantee. The older shared request implementation and unaccepted PR110 composition are not changed by this feature.

## Verification

The focused browser program serves actual PR72 HTML, scripts and styles with the pinned Supabase SDK 2.118.0 and its unchanged SRI. All Auth/backend traffic is fictional and intercepted. It verifies exact SDK query serialization, read-only visibility, canonical transitions, limits, malformed/mixed scope results, lost permission, missed-callback account replacement, hide/back/protected retirement, retained controls and zero writes or browser errors. Chromium uses 390px and WebKit 1440px; it is not a new full responsive matrix.

The native program replays the unchanged reviewed migration chain into a disposable Unix-socket PostgreSQL17 cluster. It verifies canonical audit shapes, exact Person/task binding, financial-task isolation with an independently scoped finance control, cross-organization/other-account/anonymous denial, revoked/expired read access, audit mutation denial and byte-equivalent task/event/intake rows after reads. No hosted database is contacted.

```sh
SUPABASE_SDK_PATH=/absolute/path/to/verified-supabase-sdk.js \
  node tools/outreach/people-followup-history.browser.mjs
TEST_POSTGRES_BIN=/absolute/path/to/postgresql17/bin \
  node tools/outreach/people-followup-history.native.mjs
```

`BASELINE_SOURCE` selects the preserved original People script only for the four-check absence reproduction; it is not a runtime overlay in normal acceptance. Existing affected task date/status/pagination tests run unchanged. Exact counts, original failures, source hashes, independent review and build evidence are held privately in `audit/ecosystem-cycle11-2026-11-06/church/` outside the publishable repository.

Passing local tests does not authorize release or establish genuine hosted Auth/RLS acceptance. PR110's historical Linux Forms failure remains separate and unresolved; this feature does not replace or bypass that gate. No deployment, real identity association, grant, campaign-bound task write, messaging, payment or provider action is included.
