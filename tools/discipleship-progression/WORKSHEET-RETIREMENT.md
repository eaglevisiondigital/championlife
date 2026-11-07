# Private worksheet view retirement

Baseline: `40f319487164c9314de7bea64d41cf412b184306` (Discipleship PR #76).

The existing owner-bound worksheets for Lessons 5–13 checked identity, SDK binding,
revision and navigation epochs, but did not bind their retained controls to the
live lesson DOM. Removing a loaded worksheet and invoking its captured form still
issued an additional `owned_worksheet_transaction` request; the removed fields also
retained private responses. Eight baseline reproduction checks demonstrate both
behaviors in Chromium and WebKit at 390 and 1440 pixels. This is a client lifecycle
defect, not a demonstrated database authorization bypass.

The existing runtime now retires its captured view when the worksheet, form,
fieldset, answer fields, status or load control is removed or replaced. Synchronous
ownership checks deny retained handlers before authentication or RPC, while a DOM
observer also clears inactive removed controls. Retirement aborts pending work,
advances the generation, clears values/defaults/binding/revision and disables the
captured controls. Reattaching those controls cannot revive the old view; a fresh
page runtime and explicit authorized load are required. Delayed responses cannot
restore retired private content. Unrelated DOM changes and attached authorized
saves retain their existing behavior.

This changes no SQL, identity, consent, enrollment, lesson content, media, SDK,
public allowlist or completion authority. All 13 worksheet routes and source
content remain unchanged. The 95% trusted-watch requirement, multipart Lessons
6/8/9, missing videos 11–13, provider acceptance and completion holds remain.
Requests already issued before retirement may complete on the server; this client
correction does not claim rollback or erase data already disclosed. No retry is
introduced. The server remains the final authorization authority.

Run the new current-source browser checks:

```
node tools/discipleship-progression/worksheet-retirement.browser.mjs
node tools/discipleship-progression/worksheet-retirement-independent.browser.mjs
```

The first suite checks all nine affected routes and retained controls, delayed
loads/saves, valid saves, Auth clearing and unrelated DOM updates (120 assertions).
Its explicit `REPRODUCE_RETIREMENT=1` mode is for the original baseline only; it is
never a corrected-candidate acceptance mode. Existing worksheet browser and SQL
checks remain in the workflow without assertion changes.

The successor integrity gate first checks every unchanged baseline source,
exact reviewed runtime SHA256, bounded tracked additions and two deterministic
actual public builds. Only `assets/js/grip-worksheet.js` may differ publicly.
It then optionally executes either original integrity guard, unchanged, in a
separate detached exact-baseline clone. This is labeled historical verification;
all new and existing browser checks run the actual candidate source. Neither
historical integrity baseline nor protected-file assertion is relaxed.

```
node tools/discipleship-progression/worksheet-retirement.integrity.mjs notes-session
node tools/discipleship-progression/worksheet-retirement.integrity.mjs worksheet-export
```

Local fictional browser/source acceptance is not genuine Supabase Auth/RLS,
hosted provider acceptance, or release approval. Source-only; release remains NO-GO.
