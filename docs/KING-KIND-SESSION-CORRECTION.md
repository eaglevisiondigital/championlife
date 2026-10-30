# King Kind reader session-state correction

Local successor to `6d5730bf0034bbb138999ce8cab97ce150d525fe`; no hosted release authority.

The reader previously verified identity and private Storage eligibility only on initial load. Retained PDF/Blob state and the download listener survived subsequent logout or account changes. The original local reproduction remains in private audit evidence.

The existing reader now binds each load/render/download to a generation and verified session. Auth callbacks invalidate synchronously and schedule verification in a later task; they never call or await the Auth client while its callback lock is held. Persisted session identity/token/expiry is an immediate invalidation hint, not an authorization source. Provider `getUser()` and the existing exact-object Storage policy still authorize access.

Invalidation resets the acknowledgment, disables download and controls, hides/clears canvas state, drops retained document/Blob/identity references, aborts PDF fetch, requests PDF.js loading-task destruction and render cancellation, and revokes tracked object URLs. Generation checks reject late Auth, signed-URL, bytes, import, document and render completions. Rendering occurs in a detached canvas and commits only under the current binding, so even a renderer that finishes after cancellation cannot repaint the visible book. Pagehide suspends re-opening until pageshow; visibility changes and cross-tab storage/Auth notifications invalidate. Expiry clears no later than the current token deadline or a 900-second reader lease. A fresh load is required afterward.

A personal-use download rechecks verified identity and current Storage eligibility, then verifies the same session again before issuing the Blob URL. Pending verification times out closed at 15 seconds; initial loading times out closed at 60 seconds. Unsupported request cancellation does not imply server cancellation: obsolete Auth/Storage responses are ignored. No database mutation is added. Existing local reading positions and unrelated browser storage are preserved.

The UI layout, copy/license, PDF bytes/hash, source separation, SDK 2.118.0/SRI on 26 entry points, lesson privacy, SQL and Storage policies are unchanged. No new PDF, private audit material or test fixture is added to public output. There are no new pages, dependencies or migrations.

## Evidence and limits

Run the default local suite with `npm test --prefix tools/backend-tests`. It includes `king-kind-session.test.mjs` (synthetic Auth/Storage/renderer/hash).

Run focused Chromium/WebKit desktop/mobile lifecycle tests with `TEST_PDF_ZIP=<private approved release ZIP> node tools/backend-tests/king-kind-session.browser.mjs`. These use the actual vendored SDK, intercepted fictional provider responses, actual approved PDF bytes and a controlled renderer which deliberately ignores cancellation. Covers logout in same/other tab, independently eligible/ineligible identities, delayed fetch/document/render, delayed download verification, stale completion after new-account authorization, timeout, provider denial, expired lease, and history suspension/restoration.

`king-kind-session-render.browser.mjs` also uses actual PDF.js 4.10.38, supplied through `TEST_PDFJS_DIR` with hardcoded SHA-256 checks for its module and worker, and the private `TEST_PDF_ZIP`. All provider traffic is intercepted. Actual page pixels, turning, zoom, Fit Width, personal-use download hash and session clearing are checked. `TEST_SCREENSHOT_DIR` may point only to private local evidence. The approved absolute cover URL is fulfilled with the unchanged local asset; no production fetch is performed.

These are local tests, not genuine provider, physical-device or independently witnessed recovery acceptance. Provider-side remote revocation without an event cannot be observed instantaneously: current access is rechecked on download and fresh load/resume, and the reader lease is bounded. Existing unexpired signed URLs, browser-managed downloads already started, and personal-use copies already saved cannot be retroactively erased. No DRM or backend token-retirement guarantee is claimed.

Stop for independent review of this exact successor. Recovery operator/custodian/verifier acceptance, provider-backed retirement evidence, maintenance and exact sandbox bindings remain separate unmet gates. No hosted acceptance request follows merely from these tests passing.
