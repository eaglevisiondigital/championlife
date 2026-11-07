# Communications staff session privacy correction

Source-only correction against PR #77 parent `1260684cc5d9f9d374158d88304d233f7d19c969`. This does not activate sending or replace Network Solutions.

Retained controls previously could submit a confirmation RPC after logout, and a delayed identity read could restore a former account's recipient preview. The backend remains the final authorization authority; no database bypass is claimed.

Controls, requests and DOM continuations now bind to the captured Auth client, principal, navigation generation and exact organization/campaign. Fresh identity is checked before RPC submission and after responses, with a separate active-binding check after every awaited helper. Logout, changed identity/client, explicit denial and page/history retirement clear protected content. Same-account refresh retains legitimate controls. Person-history authorization is rechecked during retained-view refresh.

Global `communications_workspace` context discovery has no organization/campaign input and requires a verified principal. Its explicit denial cannot be discarded merely because another same-principal refresh or selection completed first. A former principal's denial cannot retire a new account. Shared-shell discovery also calls this RPC; its current projection may only retire local access when the selected scope or existing permission is absent, never grant or restore access. No shared-shell source changes are included.

Permanent Chromium/WebKit desktop/mobile tests intercept all network traffic and use fictional identities. They cover the original exploits, retained controls, callbacks and silent account changes, microtask ordering, overlapping module and shared-shell discovery, different scopes/accounts, returned and thrown denials, history restoration, failed requests and legitimate queue confirmation. Simulated queue confirmation is not sending or genuine provider acceptance.

`session-integrity.mjs` compares every approved public file against the exact parent, except this runtime, and reproduces two identical builds. Existing native SQL, provider, receipt and UNKNOWN reconciliation CI checks remain intact. No SQL, credentials, provider configuration, outbox controls, consent rules, public HTML, CSS, artwork or financial paths change.

Genuine Auth/RLS and isolated provider acceptance, custody, independently networked recovery, cleanup, approved sender/account/host and activation remain separate gates. RELEASE NO-GO.
