# Current Communications controls

Filtering Delivery Activity replaces its message rows while preserving the current
staff identity and scope. Previously, a retained Cancel handler from a removed row
could still issue its cancellation RPC. The same lifetime gap affected View and
Retry controls. The original exact PR77 source reproduction is preserved privately.
This was a stale UI intent defect; the unchanged SQL still checks current
permissions, organization/campaign, message identity and allowed status.

Each button now captures its originating DOM control with the existing identity
and scope token. Its action passes that token to the existing RPC wrapper. Both
identity waits before an action RPC—the action guard and the RPC preflight—check
that the control still belongs to the Communications panel. The immediate RPC
boundary checks it again. This prevents a control removed during either await from
reading a message or mutating a previously displayed record. Post-response checks
also discard a result after its originating control disappears. An observed missing,
anonymous or changed identity still retires the current old scope even if that
control was removed during the identity wait; a detached control cannot hide that
revocation. The same rule preserves current-scope server denial handling.

The same binding follows existing preview confirmation, consent, route and template
buttons. Replacing a preview or rerendering templates retires their prior controls.
Scope discovery and periodic same-scope refresh remain usable without requiring a
button; the existing scope guard releases the busy state after an abandoned
operation. Current attached actions retain their exact existing RPC/payload.

`node tools/communications-policy/activity-controls.browser.mjs` runs the actual
Communications and staff shell sources in Chromium and WebKit at 390/1440 widths,
with fictional intercepted traffic. It covers retained filtered View/Cancel/Retry
handlers, removal at each pre-RPC identity wait, a late private-body result,
current actions and same-scope refresh, replaced confirmation/template controls,
and the absence of Retry on UNKNOWN rows. The existing Communications DOM and
session suites remain regression checks for the shared guard.

This browser guard cannot undo a mutation whose RPC was already issued, provide
transaction finalization, or authorize direct API calls. Server authority, explicit
consent, suppression, durable callback replay binding and immutable history remain
unchanged. No provider, SQL, SDK, Auth SMTP, Network Solutions, retry policy or
retention policy changes. External sending stays disabled; UNKNOWN outcomes remain
held without automatic resubmission. Genuine hosted/provider acceptance and release
approval are separate gates.
