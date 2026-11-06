# Bounded legacy Forms request initiation

This test-only increment observes the exact original Forms98/shared97/SDK2.118.0 journey retained by PR111. It does not fix or supersede PR110's original failed Linux job. No application, source manifest, classifier, permission, transport response, provider or dependency change.

`legacy.browser.mjs` is the PR111 driver with only its observer import and explanatory comment changed. `verify.mjs` compares those bytes and the unchanged Cycle10 observer to exact PR111, and runs the existing four-input/eight-adaptation verifier. The original strict assertions, journey, fixture and narrow error classifier remain intact. `HOST_SOURCE_ROOT` supplies only the shell, not corrected Cycle9 Forms.

`observe.mjs` retains the Cycle10 response/route observer and adds a separate bounded initiation artifact. The browser wrapper records only the two fictional backend paths, HTTP method, fixed account A/B/other label, safe source locations and document/root state. It performs no Auth I/O or storage reads, changes no options, and returns the exact original fetch result without then/catch/finally/await. Source stack locations are limited to synthetic application JS and the pinned SDK. The wrapper still changes function identity and adds synchronous work, which can perturb timing; this is not a transparent browser instrument.

Document IDs and per-document sequence distinguish initiation from lifecycle. `fixtureActorAtObservation` is Node receipt-time state, not necessarily browser initiation-time state. Request principal comes from the fixed synthetic request header, not a new session query. Existing lifecycle logs separately report actual SDK events. Concurrent same-path starts cannot always be matched one-to-one to Playwright request IDs; no request header is injected merely for correlation. Missing stack frames or dispatch events must remain UNKNOWN.

Run once after review, with existing installed Playwright and the exact SDK artifact:

```sh
node tools/staff-cycle11/verify.mjs
node --test tools/staff-cycle11/initiation.test.mjs
node tools/staff-cycle11/negative-control.browser.mjs
HOST_SOURCE_ROOT="$PWD" DIAGNOSTIC_OBSERVATIONS=1 DIAGNOSTIC_DIR=/tmp/staff-cycle11-diagnostic node tools/staff-cycle11/legacy.browser.mjs
```

Set `PLAYWRIGHT_MODULE` to an existing Playwright module if dependencies are outside this worktree, and `SUPABASE_SDK_PATH` to the existing pinned SDK file. The legacy driver verifies the SDK SHA256. The negative control is one wrapped and one unwrapped static-page fetch, intentionally aborted by fictional routing; it requires the original unhandled browser error in both cases. It creates no unload/Auth callback and proves only observer error visibility, not historical cause. The four Node tests additionally check exact result/argument/this forwarding, unchanged synchronous/rejected results and privacy.

Both observation artifacts are written on page close/process exit, including failures. No retry-to-green or new exception filter. If the one observation lacks the original error or a defensible initiating chain, preserve UNKNOWN and rotate to independent work. No release acceptance or hosted Auth/RLS evidence is implied.
