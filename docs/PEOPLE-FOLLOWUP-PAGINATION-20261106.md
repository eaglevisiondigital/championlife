# People follow-up task paging — November 6, 2026

Source-only correction based on PR72 `676abc58c3da3b082c1f95ef15c8c33c3aa91e33`.
The People detail screen previously loaded the newest 100 follow-up tasks and
provided no route to older tasks. An open task could therefore become unreachable
after 100 newer tasks were created. This is a display limitation, not a change to
the existing organization/person authority or task model.

The existing detail screen now shows at most 100 tasks per page, with **Older
tasks**, **Newer tasks**, and **Refresh latest tasks** controls. Each read requests
101 rows to determine whether an older page exists. Ordering uses descending
`created_at` and unique `id`; the next page selects rows strictly older than the
last displayed tuple. A newly inserted task or removal ahead of that cursor does
not shift the older page as an offset would. The timestamp is preserved verbatim,
including PostgreSQL microseconds and timezone; it is not rounded through a
JavaScript `Date`. Only strictly formatted timestamp/UUID boundary values can
become a query cursor. An invalid boundary reports unavailable older navigation.

The page cursor stack belongs to the current detail invocation. Opening another
person, changing organization/account, returning to People, or refreshing latest
starts a fresh traversal. A successful existing revision-guarded status update
reloads the current page. Creating a task returns to the latest page so staff can
see it. Optional due dates and the existing create/uncertain-save behavior are
unchanged. No new task write path, assignment, message, automatic retry or
idempotency claim is added.

Each page reuses fresh `staff_workspace_context`, the existing person detail RPC,
the exact organization/person task filters, and the existing post-read permission
check. Read-only follow-up staff can page without management controls. Existing
generation/session/shell checks reject retired page handlers and late results.
Task reads retain the same RLS and permissions; the only additional selected field
is the existing `created_at`. No SQL, migration, grant, public registration,
check-in eligibility, branding or shared shell source changes.

These are live reads, not a consistent historical snapshot or export. Newly
created tasks ahead of a cursor appear after refreshing latest; later changes can
affect a revisited page. The page label is a navigation position, not a total task
count. An emptied later page says that page is empty and offers newer/latest
navigation. A failed read never claims there are no tasks or that all tasks were
loaded. No task data or cursor history is stored in browser storage.

## Local verification

- Original runtime: 18 baseline checks across Chromium/WebKit at 390, 768 and
  1440 pixels confirm that 105 of 205 fictional open tasks were unreachable.
- Permanent focused regression: 264 assertions across the same six browser and
  viewport combinations. Covers stable tied-timestamp ordering; preserved
  microseconds; 0/100/101/200 boundaries; concurrent newer insertion/deletion;
  oldest-task completion; creation returning to latest; read-only paging;
  malformed cursor denial; failed/empty later pages; person, organization,
  account and protected-clear transitions; detached handlers; pre/post-read
  permission loss; no browser storage or exceptions.
- Existing affected suites, without test edits: 276 follow-up creation,
  222 People identity, 64 People navigation browser assertions and five People
  DOM scenarios pass. Unaffected registration/check-in suites were not rerun.
- A private compatibility check uses the exact Supabase 2.118.0 browser SDK bytes
  matching the staff page's SRI. Nine assertions confirm the composite `.or()`
  filter, ordering, limit and scoped fields serialize to one intercepted GET.
  This establishes SDK query construction, not hosted PostgREST/RLS acceptance.

Run the permanent focused test with:

```sh
node tools/outreach/people-followup-pagination.browser.mjs
```

`BASELINE_SOURCE` can point to the preserved original runtime for reproduction.
All browser transport is intercepted at a fictional origin; tests use no real
person, account, permission grant or hosted database. Existing native SQL is
unchanged and was not replayed for this browser-only correction.

Private evidence is held outside the checkout under
`audit/ecosystem-project-cycle-2026-11-06/church/`. Original browser-launch and
test-harness failures remain preserved alongside successful corrected runs.
Independent review, exact-head CI, genuine hosted acceptance and release approval
remain separate gates; local passing tests authorize no deployment.
