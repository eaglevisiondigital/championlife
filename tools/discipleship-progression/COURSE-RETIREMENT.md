# Private worksheet view lifetime — Lessons 1–4

Source-only successor to frozen PR118 `3bd5e6e0cf0ccfa10c15f9a8a8d6a32fcdcc52b1`. The accepted Lessons5–13 device-note correction and cloud-worksheet implementation remain unchanged.

The actual Lesson1–4 runtime previously reaccepted removed/reinserted forms and private controls. Pending print verification could publish private answers; a scheduled cloud-save timer could submit a new request after retirement; a pending submission could start its POST after the removed form was reinserted. No server permission bypass is claimed. The existing verified account and canonical data authorization remain necessary.

The correction binds the original form, form fields, private actions and their ownership ancestors. A removal, replacement or reparent permanently retires that view, including same-task remove/reinsert and descendants extracted from removed ancestors. Mutation records are drained before actions and asynchronous continuations. Retirement clears captured live/default private values (including an input already detached from the form), disables private controls, cancels queued saves, invalidates pending generations and prevents late loads from repopulating answers. Unrelated video layout changes retain normal use. Existing own device records remain available on a fresh authenticated page.

Requests already submitted before retirement are distinguished from new requests. Retirement does not prove server rollback or erase an already committed save. The UI must not submit additional writes or publish late success. No automatic retry is added.

## Validation and provenance

Permanent actual-markup DOM tests reproduce the old failure: initial25 cases had5 legitimate positives and20 retirement failures. The corrected suite extends to32 cases, including detached fields, late protected loads, already-submitted writes, benign video layout and document-root removal. Actual Chromium/WebKit390/1440 baseline checks independently reproduce print/timer behavior; the corrected72-assertion matrix preserves saved owner drafts, normal editing, responsive layout and zero page errors. Independent coordinator tests cover all four lessons and captured-field cleanup.

Original setup and test-fixture failures remain in private audit evidence. The first successor contracts wrapper unnecessarily replayed historical DOM behavior in a dependency-free frozen clone and failed its jsdom import after all550 actual-candidate contracts passed. The corrected wrapper keeps those current tests and executes only the two immutable historical integrity-negative tests at their exact118/f6 checkpoints; it neither installs dependencies in history nor omits current behavior. The first browser run was denied loopback by the sandbox; the next lacked the default browser cache; the existing pinned Playwright1.62.1 cache was then used. An early corrected DOM teardown closed JSDOM with a live observer; permanent fixtures now retire and flush before destroying their window and assert zero errors. An early corrected browser boot wrongly expected cloud text to override an intentionally preserved owner draft; the expectation now asserts that saved draft restores, with no runtime/acceptance weakening.

The additive `course-retirement.integrity.mjs` verifies the actual candidate before historical replay: exactly the course runtime, workflow and two-line existing DOM-fixture cleanup may differ from118, with five explicit new test/document paths. All other source blobs and all existing guards stay byte-identical. Current behavior tests run the new runtime. Immutable historical guard/negative suites run on their respective exact accepted checkpoints, never by replacing expected hashes. The existing 78-assertion resource DOM regression also receives that same explicit retire/flush cleanup before window destruction; every original assertion remains unchanged. The workflow retains its existing jobs, timeouts, browsers, lessons and assertions; it adds the new browser check and routes guards through the explicit successor binding.

Local commands:

```
node --test tools/discipleship-progression/course-retirement.test.mjs tools/discipleship-progression/course-retirement.integrity.test.mjs
node tools/discipleship-progression/course-retirement.browser.mjs
node tools/discipleship-progression/worksheet-export.browser.mjs
node tools/discipleship-progression/course-retirement.integrity.mjs
```

Local passing source/browser tests do not establish exact-head CI or genuine hosted Auth/RLS/provider acceptance. No SQL, migration, SDK, permission, identity link, media asset, course policy, grant or provider activation changes. Legacy learner progress/submission remains distinct from trusted completion; no certified completion, viewing evidence or serving eligibility is added. Trusted95%watch, multipart6/8/9 and missing videos11–13 remain held. All payment, messaging, host and recovery gates remain; release NO-GO.
