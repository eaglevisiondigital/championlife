# Bounded retirement ordering experiment

H1: original Forms98 refresh must complete its Auth await before pagehide to
admit a subsequent Forms context RPC. The detached Auth cancellation observed in
Cycle11 alone does not establish the original PR110 two-error cause.

This is an explicit timing intervention, not passive observation or a proposed
application correction. `legacy.browser.mjs` is byte-identical to Cycle11; its
relative observer import selects this package. Source verification retains
Forms98/shared97, the original fixture, classifier and every strict assertion.
The exact SDK2.118.0 SHA remains enforced by the driver. No source rebind.

The gate intercepts only the first zero-delay function named `leave` scheduled
from the exact synthetic staff-session.js location on the Forms document. It
retains the original callback, arguments and native timer receiver, and records
selection/readiness/release. All other timers are forwarded. A six-second watchdog
records failure and releases for cleanup; it can never count as acceptance.
This changes scheduling and function identity. It is not observationally neutral.

One fixed run contains three arms, once each, with no retries:

1. `auth-after-pagehide`: hold the second account-B Auth route (the first belongs
   to SDK setSession), release original navigation, wait for the selected
   document's real pagehide, then fulfill the original response. Require no
   detached Forms RPC initiation and one cancelled Auth request.
2. `rpc-across-pagehide`: let that Auth complete; hold the natural Forms context
   RPC, release navigation, wait for pagehide, then fulfill. Require a detached
   Forms RPC initiation and its cancellation.
3. `settled-before-pagehide`: let Auth, Forms context and final identity
   verification complete, observe the real Forms context commit for account B,
   then release navigation. Require a detached RPC and no failed backend request.

All response payloads, statuses and CORS headers come from the unchanged original
fixture. No extra Auth call, application refresh, SDK callback, request abort or
forged lifecycle event is injected. Gate ordering is recorded independently of
Cycle11 start/stack observation and Cycle10 route/response observation. Their
document IDs differ; only each observer's own IDs bind events. The second-B-Auth
selection is explicit and must have the original detached identity/refresh stack
in the resulting evidence; ambiguous matching remains a limitation.

```sh
node tools/staff-cycle12/verify.mjs
node --test tools/staff-cycle12/gate.test.mjs
HOST_SOURCE_ROOT="$PWD" DIAGNOSTIC_DIR=/tmp/staff-cycle12-unique node tools/staff-cycle12/run.mjs
```

Set `PLAYWRIGHT_MODULE` to installed locked Playwright and `SUPABASE_SDK_PATH` to
the pinned SDK artifact. Review source and gate controls before browser execution.
The run lock prevents overwriting evidence. Every arm preserves its strict exit,
stdout/stderr, lifecycle/requests/initiation, intervention and analysis, including
failures. Any strict failure makes the runner fail; no classifier is broadened.
Do not rerun to obtain green. Root owns any separately reviewed Linux workflow.

Even a complete ordering result establishes only the constructed mechanism.
The original PR110 Linux two-error cause remains UNKNOWN absent its exact pair,
attributable request chains and independently reviewed control discrimination.
No genuine Auth/RLS, provider, deployment or release acceptance is implied.

Current official Supabase documentation confirms that getUser performs a network
request and describes non-async auth callbacks. These general contracts do not prove a pinned SDK/browser incident:
https://supabase.com/docs/reference/javascript/auth-getuser
https://supabase.com/docs/reference/javascript/auth-onauthstatechange

## Local result, 2026-11-06

One actual three-arm execution passed the predeclared ordering predicates and all
three unchanged 19-check journeys. Initial sandbox startup attempts aborted before
any page/context execution; those failures remain preserved separately.

- Auth held through pagehide: one cancelled Auth request, no detached Forms RPC,
  no pageerror.
- Forms RPC held through navigation: one cancelled Forms RPC; a second detached
  Auth initiation has `refresh:37 → verify:15 → identity:11 → getUser` in its
  captured stack, after beforeunload and before pagehide. No corresponding Auth
  network dispatch was observed. One Auth access-control pageerror matched the
  original narrow `knownUnload` predicate; it is retained, not suppressed anew.
- Refresh completed before navigation: detached Auth/context/verification requests
  complete, with no failed request or pageerror.

The original Linux pair also contained a Forms RPC access-control exception and
had no recorded cancellation; its Auth request41 finished after beforeunload.
This experiment does not reproduce that pair or establish its missing dispatch
chain. Original cause remains UNKNOWN. Stop this hypothesis; rotate independent
product/integration review. No additional broad observation or runtime fix is
justified by this result. Linux execution of this new experiment is not claimed.
