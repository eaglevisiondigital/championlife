# Isolated staff summary backend binding — source only

This successor reuses the accepted shell, Auth client, summary and existing
`outreach_registration_workspace` RPC. It does not introduce a new session,
permission, table, endpoint or public mount. All additions remain outside the
public site allowlist. Church and Partners continue using the same principal.

A future separately reviewed acceptance consumer calls
`installStaffOutreachSummary({window, isolatedBackend: {projectRef, supabaseUrl}})`.
The configuration must come from its reviewed isolated deployment manifest,
never query parameters, browser storage or user input. The exact canonical HTTPS
project URL must match the already-created client's Supabase, Auth and REST
endpoints. Missing/malformed pin values and the production project are rejected.
The entry copies configuration before waiting on shell readiness; every Auth and
RPC phase rechecks endpoints. This is an accidental-misconfiguration boundary,
not protection against arbitrary same-origin script execution or a malicious SDK.
The existing unpinned source entry is unchanged for compatibility and is not a
hosted acceptance configuration. No fallback project is provided here.

The narrow client facade verifies the captured token with `getUser(token)` and
checks the current session before releasing results. Only `context` and `list`
with an exact campaign UUID and empty payload may call the existing intercepted
RPC. No client user ID, export, mutation, or other RPC is accepted. The server
remains the authority for `registration.view`, effective campaign assignments,
verified identity and RLS. The existing context → list → context sequence remains.
Returned list records are discarded by the existing aggregate projector; this
package does not claim the existing list RPC transfers only aggregates.

Cancellation uses SDK `.abortSignal(signal)` when a builder is available. The
frozen staff shell intercepts RPCs with an async Promise; that interception must
not be bypassed to obtain a builder. For that path, navigation/denial cancellation
invalidates publication, while an already-dispatched read may finish remotely.
This is not proof of physical provider cancellation or immediate JWT retirement.
The adapter makes no writes. A completed server denial wins over DOM scope hints.

Local evidence: 37 new Node cases (145 total), 302 actual Chromium/WebKit checks
at 390/768/1440 widths (18 new), and 11 existing native PostgreSQL authorization
checks passed. Browser/provider responses are fictional and intercepted. An
additional no-network construction check used the accepted vendored SDK 2.118.0
to verify its actual endpoint properties. No live Auth/Storage/session acceptance
is claimed. Native checks used disposable Unix-socket PostgreSQL only.

References checked November 1, 2026:
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal
- https://supabase.com/docs/guides/auth/sessions

Remaining gates: independent source review, reviewed isolated project/preview
configuration and source inclusion, Issue #62 custody and independent cleanup
rehearsal, genuine mailbox/session/revocation evidence, maintenance and teardown.
Do not provision or deploy under this source-only package. Existing SDK, shell,
SQL, public build, King Kind, Giving and historical audit packages are unchanged.
