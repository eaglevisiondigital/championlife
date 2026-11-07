# Canonical task history pagination — source only

The accepted People workspace showed only the latest 50 audit entries. Authorized staff can now use Older history, Newer history and Refresh latest history on the existing task card to reach older entries. Each read remains limited to 51 rows (50 displayed and one lookahead), with descending `occurred_at,id` keyset pagination. PostgreSQL microsecond precision is preserved. Every returned row, including lookahead, must be strictly older than the requested boundary and preceding row; replayed, duplicated, unordered or mismatched history fails closed.

This uses the existing canonical `followup_task_events` table and unchanged RLS, with exactly the existing status/due-date/revision projection. No historical titles, notes, actor IDs, assignment payloads or raw audit JSON are added. Before and after each read the original current-session and People/follow-up authority checks remain active; the task is rebound to its exact organization and Person. Pagination controls retire on hide, refresh, account/context change, revocation and card removal. Retained controls cannot issue reads. Failures do not retry automatically or mutate tasks/audit. History is live, not a snapshot or a claim of immutable pagination across changing access.

Task-list filters, task-list keyset pages, status/due-date revisions and creation controls are unchanged. No new schema, permissions, campaign-to-Person association, messaging, financial authority, shared Auth client, SDK or public route is introduced.

## Local acceptance and limits

- Actual accepted baseline: six browser assertions reproduce the 50-entry cutoff with 125 fictional entries.
- New author Chromium/WebKit: 76 assertions; independent Chromium/WebKit: 86 assertions.
- Existing history browser assertions retained; only the old truncation message expectation changes to the new truthful per-page message.
- Fifteen SQL checks exercise canonical migrations and unchanged RLS: 125 audit events across three pages, tied timestamps, no skip/duplicate, privacy, permission revocation and no data changes. Supplemental PGlite passed. Local native PostgreSQL initialization was blocked by macOS shared-memory exhaustion (`shmget`, ENOSPC); native acceptance must be separately reported from actual CI, not inferred from PGlite.
- Two reproducible builds contain 411 files. Only `assets/js/outreach-people.js` changes from accepted `4e29de51bbff57e4e3b3ccbdc750bd0edb960443`.

Independent source review and exact-head CI are separate gates. No hosted Auth/RLS acceptance, migration, deployment, real grants, identity linking or release authorization is implied. RELEASE NO-GO.
