# Worksheet reload safety — local source correction

Lessons 5–13 reuse the existing account-owned worksheet client. Previously, editing a saved response left the status saying “Saved”; clicking **Load saved worksheet** immediately replaced unsaved work without warning.

The client now compares current responses with the last verified cloud response in memory. Edits show an unsaved warning; returning to the exact saved values restores the accurate prior status. Loading over changes requires confirmation. Cancel keeps the current draft and makes no request. Confirming discards it and performs the existing fresh-authorization read, with no mutation or automatic retry.

Confirmation never grants authorization. A changed navigation/session generation, expired session or changed client binding cancels the reload. Sign-out, account switching, server denial, history restoration and visibility changes still clear the worksheet and the in-memory baseline immediately, without prompting. No new local storage, persistence, answer copy, enrollment, progress or completion writes were added. Pending saves keep fields disabled and use the submitted snapshot and verified server response, not subsequently modified DOM values.

This guards intentional reload only. Leaving, hiding or invalidating the page still clears unsaved answers under the existing privacy policy. The warning tells learners to save responses. It does not introduce autosave or promise recovery of discarded drafts.

Permanent Chromium/WebKit regression cases extend the existing lesson worksheet suite: truthful dirty status, undo to saved content, cancel/confirm reload, confirmation-time authentication invalidation, pending-save snapshot, account switching, stale responses, conflict/UNKNOWN handling and immediate logout/denial cleanup. Tests use fictional intercepted Auth/RPC responses; they are not genuine provider acceptance.

No SQL, content, course-media, permission, SDK, branding or shared authentication file changes. The accepted 95% watch and answer requirements and all genuine provider/recovery/retention release gates remain unchanged. All 13 worksheet flows are source complete; this change does not install them or extend trusted completion beyond its existing source scope.

## Shared-client lifecycle correction (November 3)

Independent source inspection and a fictional Chromium/WebKit reproduction found that the client pin checked the captured client's properties but not the current shared Auth object or its client identity. Replacing the shared client left retained worksheet handlers able to send through the previous client. A pending response whose captured client properties changed could also return without clearing the previously displayed answers. This was a frontend lifecycle defect; no database permission bypass was demonstrated.

The worksheet now pins both the shared Auth object and its client, in addition to the existing Auth/RPC/REST/backend bindings. Every request entry and asynchronous continuation rejects a changed binding. Detection immediately clears answer values, baseline and revision, aborts pending work and invalidates the generation. Retained handlers cannot submit through the previous client. The page instructs the learner to reload; it does not silently adopt a new client. Ordinary account/token events still clear synchronously without awaiting Auth from its callback. A write already sent before replacement may have committed: only a fresh authorized load can reconcile it, never an automatic retry.

This is detection at existing interaction, lifecycle and asynchronous boundaries, not interception of arbitrary JavaScript assignments to globals. It does not claim to protect against a hostile script executing in the page. Normal Auth events remain the immediate account-transition signal. Regression coverage includes replacement of the shared owner object and client, delayed reads/writes, changed captured RPC, retained Save/Load handlers, explicit reauthorization and A → B → A isolation in both browser engines and sizes.
