# Communications control retirement

Exact starting source: `3f8b33da9ed769e1389f3a67b513922610412b2f` (draft #77).

The existing permission/current-account guards correctly rejected detached controls,
but checked current containment only. Removing and reinserting a captured Publish
version button, its row or the whole Communications root in the same task revived
the old handler and issued another template mutation. A removed scope selector also
retained its navigation handler. The original fictional browser reproduction has
40 assertions across Chromium/WebKit and desktop/mobile. This demonstrates stale
client intent, not a database authorization bypass or an actual email send.

The existing runtime now records removed control identity. Pending DOM removal
records are consumed synchronously before Auth or RPC checks, so a same-task
reinsertion cannot revive a captured handler. Removing the entire root or an
ancestor permanently retires that runtime, clears its protected view and requires
a fresh runtime/authorization. Individual retired controls cannot act, while new
current controls and ordinary refresh remain usable. The scope selector uses the
same current-control binding as action buttons.

Retirement does not cancel or roll back a mutation already submitted to the
server. Tests distinguish already issued reads from new operations, suppress stale
returned content and preserve the server's final authority. No retry is introduced.

Run:

```
node tools/communications-policy/control-remount.browser.mjs
node tools/communications-policy/control-remount-independent.browser.mjs
node tools/communications-policy/session-integrity.mjs
```

The explicit `REPRODUCE_REMOUNT=1 COMM_SOURCE=<original-runtime>` mode is only for
recording the original defect; it is never used by candidate acceptance or CI.
Existing activity/session/browser and database tests remain unchanged. The original
integrity guard still checks every other public file and two deterministic builds.

No HTML, SDK, SQL, consent, suppression, delivery semantics, provider transport,
permissions or financial behavior is changed. UNKNOWN delivery holds, disabled
external sending, callback activation and separate genuine provider/host acceptance
remain unchanged. Source/CI acceptance is not release authorization.
