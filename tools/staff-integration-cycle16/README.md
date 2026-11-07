# Bounded actual Partner and Communications staff composition

This draft stacks on frozen Staff #115 `7fde897cdbb6ae423cfdeec434a3b548fbc5aa4d`. It preserves that head, Partner #116 `4cf2328caeec341b904a60bdd8c0889f66f77d55`, and Communications #77 `d88f8382e8fe0b5c4fbd40da254f9d6caf4a60d9` unchanged. It is an actual four-file runtime composition, independently tested after the initial exact-source test overlays.

## Explicit source derivation

- Partner HTML/runtime are selected from #116. The HTML corrects only the SDK URL to its existing exact-version package root, retaining the accepted SHA-256 and SRI. The runtime additionally retains only a single validated organization UUID through initial login; invalid or repeated hints remain unavailable and no Person/intake/private fields enter the return URL.
- Staff #115's session adds only the Partner route to its existing organization-only login return map. Account retirement/logout and shared client remain unchanged.
- Staff #115's Communications runtime retains its shared host API, scope ownership, denial event and Auth client. Only the reviewed #77 removed-control/root lifetime block is ported. A whole #77 file replacement would restore an incompatible legacy scope selector/API and is deliberately not used.

Canonical People/task runtime, its current-actor fence and history/filter features, registration, Forms, Events, Dream Team, SQL, all permission contracts, SDK configuration, branding, and the 430-file public allowlist remain byte-identical to #115. Financial intake retains separate outreach.view/finance.read checks; People handoff separately requires people.read. Independent review additionally reproduced a Partner control removed/reinserted during an Auth await issuing a new review RPC. The bounded successor carries the initiating control through mutation, People-search and verified-return requests, checks it after asynchronous responses and before caller publication/navigation, and retains 401/403 cleanup even when that control retires. Removed subtrees also permanently retire descendant controls, so moving an old button out of its former container cannot revive it. Both asynchronous-admission and descendant-reparent failures are retained. Requests already submitted are not claimed rolled back. No global mutable action binding or permission change is introduced. The original failed probe remains preserved.

No pastoral Partner authority, identity linking or task issuance is introduced. Sending/callbacks and payments remain disabled.

## Actual-source integrity before historical checks

`source.mjs` derives the four accepted runtime bytes directly from immutable Git blobs through the two independently reviewed composition recipes. It validates every original #115 file, three explicitly derived test/build routers, exact new-file inventory, regular files and protected directories. New test/workflow bytes are pinned separately from the generated provenance document. Updating that document cannot approve a changed recipe or runtime.

Three narrow routers preserve historical tests: the Cycle14 source reader first invokes the new actual-source verification, then provides immutable #115 bytes only for the four runtime and three router paths. Its new private tooling is excluded from the historical inventory only after validation. The historical actual-build comparison recognizes the four exact-derived outputs; the Cycle9 build reads actual new bytes. All original assertions and workflows, including strict WebKit cases and the original 20-minute job timeout, are unchanged. No test result is replaced by a copied historical PASS.

`build.mjs` separately builds the actual tree twice, verifies all 430 outputs against current source, and proves the 426 other public files unchanged from #115. There are no backend, deploy configuration or public allowlist changes.

## Validation and gates

New source/negative tests and actual-source Chromium/WebKit journeys cover independent permission combinations, organization hints/returns, account replacement, logout, permission denial, delayed requests, removed and reinserted controls, root retirement, same-account refresh and mobile navigation. The SRI test reproduces the known original URL/byte mismatch with hash-verified offline artifacts. Fictional HTTP is used with the actual selected SDK/Auth/session/runtime; no provider acceptance is inferred.

The original #110 WebKit cause remains UNKNOWN. Staff #115's two runner shutdowns and INCOMPLETE CI remain disclosed; this candidate neither retries those jobs nor establishes their cause. Exact-head CI for this distinct composition is a separate result. Native SQL and original suites remain in inherited workflows; no SQL or installation is changed.

Managed Auth/RLS/target compatibility, canonical provenance, genuine provider acceptance, independently witnessed recovery/cleanup, and separate release authorization remain required. The original runner support request remains unsent pending explicit approval. No merge, deployment, hosted SQL, grants, identity links, communications, payments, credentials, new infrastructure or recovery execution is authorized. RELEASE NO-GO.
