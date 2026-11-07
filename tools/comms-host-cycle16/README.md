# Communications lifetime policy in the selected staff host

This test-only composition starts from Staff115
`7fde897cdbb6ae423cfdeec434a3b548fbc5aa4d` and Communications77
`d88f8382e8fe0b5c4fbd40da254f9d6caf4a60d9`. Both prior candidates stay intact.

The old staff-host adaptation already uses the selected shared Auth client,
`StaffWorkspace.active()`, host-owned organization/campaign selection and terminal
`staff-protected-clear` events. Replacing that module wholesale with #77 would
reintroduce legacy workspace methods and a second scope selector. `source.mjs`
instead verifies both immutable input blobs and applies only the reviewed removal
history, observer retirement and current-control lifetime checks. No alternate
client or new authority is introduced. The host's existing denial card/event,
scope ownership and shared session remain unchanged.

The actual existing HTML, selected SHA256/SRI-verified SDK, Auth and shared host
execute in Chromium/WebKit at mobile/desktop widths. HTTP Auth and RPC responses
are entirely fictional. The test-only runtime overlay is explicit and the existing
public runtime is unchanged. Original same-task button/row/root/ancestor remounts
issue stale private-body reads; the composition rejects those retained handlers,
suppresses delayed bodies after retirement and preserves legitimate current reads,
organization navigation and same-account refresh. UNKNOWN has no Retry control.

```
node --test tools/comms-host-cycle16/source.test.mjs
SUPABASE_SDK_PATH=/path/to/accepted/artifact node tools/comms-host-cycle16/remount.browser.mjs
```

`REPRODUCE_HOST_REMOUNT=1` uses only the original immutable Staff115 runtime to
preserve the original defect. It is not candidate acceptance or a CI green path.
`ACTUAL_RUNTIME=1` instead requires the current on-disk runtime to equal the exact
reviewed composition and serves those current bytes. It cannot be combined with
reproduction mode. A separately reviewed runtime successor uses this mode; the
default remains the isolated test-only composition, never an implicit installation.
Prior strict source/build guards are unchanged. A later runtime adoption requires
independent source review, explicit inventory/build guards and exact-head CI.

No SQL, grants, account provisioning, sender configuration, consent/suppression
semantics, transport, retry, callback or actual sending is changed. Already submitted
requests are not claimed cancelled or rolled back by client retirement. The prior
PR110 WebKit error remains unresolved, and PR115's two runner shutdowns remain an
incomplete required CI result; this focused test does not clear either history.
Genuine Auth/RLS/provider and recovery acceptance, installation and release remain
separately gated. No hosted operation or release is authorized.


## Actual Cycle16 source adoption

This copy is included in the separate actual Staff integration candidate. The initial overlay work above is preserved as provenance; the four current application-file derivations, unchanged historical gates and actual-runtime tests are documented in `../staff-integration-cycle16/README.md`. This is source adoption only, not hosted installation or activation.
