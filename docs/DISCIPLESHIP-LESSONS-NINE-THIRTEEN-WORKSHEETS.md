# Lessons 9–13 private worksheet source extension

Source-only successor to PR #76 at `9cf512fcd6c25892c6cfba8f97edc0ddf0c82f98`.
The existing course, account-owned answer store, opaque revision transaction and
single worksheet client are reused. No migration is installed by this package.

## Exact content and collection boundary

- Lessons 9 and 10: five response groups each, the exact A–E study-section headings
  and original PDF pages. Personal application and group exercises stay in the PDF.
  A response group is not an invented quiz question or grading rubric.
- Lesson 11: four A–D Scripture-study sections; no collection of health, financial,
  hardship, prayer or third-party details.
- Lesson 12: three A–C Scripture-study sections; no cloud confession or group record.
- Lesson 13: four selected printed Scripture questions from B.1, C.1, D.1 and E.2,
  explicitly not a complete transcription. Friend lists, personal finances, prayer
  and church commitments are excluded. See the separate 11–13 content contract.

Per-lesson `lesson-N-content.json` catalogs bind exact original PDF SHA-256, selected
prompts, page fragments and sequential response IDs. The earlier 9–13 source map
is preserved as its historical mapped-only checkpoint; these new per-lesson
contracts describe the implemented source. No PDF or existing video is replaced.

## Transaction and privacy invariants

CLI-generated `20261102210907_lessons_nine_thirteen_owned_worksheets.sql` follows
`20261102200549_lessons_six_to_eight_owned_worksheets.sql`. Execute the whole file
in one transaction only after separate release approval. It takes the existing
legacy-writer advisory mutex before verifying the accepted RPC/trigger hashes,
constraint and absence of unmapped prior answers for the new lessons. Existing
answers in 9–13 stop installation for explicit provenance review, not deletion or
silent adoption. Previous lesson answers and history stay intact.

The extension changes only supported lesson ranges and exact response counts:
9=5, 10=5, 11=4, 12=3, 13=4. Existing confirmed Auth/session ownership checks,
row locks, fresh expiration checks, opaque UUID compare-and-swap, legacy-write
revision invalidation, transaction rollback and enrollment-recreation protection
remain authoritative. No new table, public RPC, role, RLS policy or grant is added.

The same client derives current account identity, retains a generation-bound
bearer, clears state on session/account/history changes and never persists cloud
answers in browser storage. Load replaces unsaved edits only after explicit action.
Stale or uncertain saves require reload; no automatic retry can overwrite data.
Device notes remain independently private and are never silently imported.

## Completion and remaining acceptance

Saving is never verified viewing, advancement or lesson completion. The existing
trusted completion function remains limited to its accepted 1–4 contract and
requires independent playback evidence; this package does not alter it. Videos
11–13 remain unavailable. Accepted 95% unique eligible-watch requirements remain
unchanged. Multipart identity/duration/required-part binding and trustworthy
provider receipt provenance still need the existing content/provider decisions.
No browser callback, time spent or synthetic test proves genuine viewing.

Targeted synthetic PostgreSQL/PGlite and Chromium/WebKit tests verify owner-only
save/reload, foreign/stale revisions, current session, concurrent writes, legacy
migration races, rollback, account switching, logout, delayed requests and no
completion credit. Independent source review, hosted Auth/database acceptance,
finite retention/access/deletion policy, recovery and release approval remain
separate gates. Source publication does not activate the worksheets on production.
