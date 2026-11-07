# Private device note view retirement

Source-only successor to Discipleship #76 at
`f6e0f4b0db6751b8912fad904b8be8056546d9ac`. Release remains NO-GO.

The accepted cloud worksheet retires removed controls permanently. Device notes
only checked that the textarea was currently connected. Removing and reinserting
that textarea during awaited identity verification allowed the retained handler
to save its captured private edit and report it saved. The baseline defect was
reproduced against actual Lesson 5 markup/runtime in Chromium with fictional Auth,
and the permanent DOM suite passed its nine live controls while failing all 25
retirement negatives on the original source.

The existing device-note runtime now binds its original notes wrapper, controls
and ancestry. Removal retires the view permanently, including same-task reinsertion
and extracted descendants of a removed ancestor. Handlers drain pending mutation
records before authentication. Retirement invalidates pending reads/writes, clears
captured live/default values and disables the textarea. Its status says the view
is closed and requires reloading. Auth, history and visibility callbacks cannot
revive it. A fresh page can still authenticate and restore the same owned notes.
No existing saved note is deleted, and unrelated DOM changes remain usable.

These remain private device notes, separate from private cloud worksheets.
Nothing changes lesson content, videos, worksheets, enrollment, SQL, SDK, identity
or authority. Trusted 95% viewing, multipart 6/8/9 and unavailable videos 11–13
remain held. No browser test certifies hosted Auth/RLS or completion. No request,
permission, resource, send, payment or deployment is enabled.

Validation commands:

```
node --test tools/discipleship-progression/notes-retirement.test.mjs
node tools/discipleship-progression/notes-retirement.browser.mjs
node --test tools/discipleship-progression/notes-retirement.integrity.test.mjs
node tools/discipleship-progression/notes-retirement.integrity.mjs
```

The 34 permanent DOM tests cover nine lesson positive controls, 24 combinations
of pending restore/save, two Auth await boundaries and six removal patterns,
plus same-task reinsertion. Independent browser tests exercise the actual runtime.

The additive integrity guard pins every unchanged file at the frozen #76 source,
exact new notes/workflow bytes, bounded additions and two actual candidate builds
with only `assets/js/grip-notes.js` changed publicly. Old integrity guards/tests
remain byte-identical. Workflow routes their exact-source assertions to detached
frozen #76 clones, clearly labeled historical, after current-source checks. All
existing behavior/browser/database commands continue testing actual candidate
source. The old integrity negative test runs in the frozen clone in `contracts`
mode; every other contract test, including new fixed negatives, runs current source.
No failed assertion is normalized, skipped or made optional.

Local validation recorded 34 corrected DOM tests, 225 affected privacy assertions,
168 affected Chromium/WebKit session assertions and the successor integrity
negatives. Two builds contain 415 public files with 414 unchanged. Independent
new browser coverage reached 120 assertions in segmented runs: 40 before a
preserved legitimate-save timeout, 10 in that one-case diagnostic run and 70 in
the seven previously unexecuted cases. This is not a clean full-matrix pass;
the timeout cause remains UNKNOWN and exact-head CI remains required. Independent
baseline browser reproduction recorded 36 assertions. No historical CI was retried.
