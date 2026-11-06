# Independent Cycle9 security checks

These tests serve the actual candidate's protected HTML and dependencies from its public-file manifest. Missing shipping files fail; no historical runtime overlay, replacement Auth implementation or compatibility shim is supplied. The pinned Supabase JS 2.118.0 bytes and original HTML SRI execute against fictional intercepted HTTP. Configuration, session seeding and the login destination are explicit test boundaries. No genuine Auth/RLS, provider, consent-database or production acceptance is claimed.

With the existing backend-test dependencies and pinned SDK available:

```sh
SOURCE_ROOT=/absolute/candidate SUPABASE_SDK_PATH=/absolute/supabase-js-2.118.0.js node tools/staff-cycle9-security/journey.browser.mjs
SOURCE_ROOT=/absolute/candidate SUPABASE_SDK_PATH=/absolute/supabase-js-2.118.0.js node tools/staff-cycle9-security/direct-response.browser.mjs
SOURCE_ROOT=/absolute/candidate SUPABASE_SDK_PATH=/absolute/supabase-js-2.118.0.js node tools/staff-cycle9-security/forms-retirement.browser.mjs
```

The journey defaults to Chromium/WebKit at 390, 768 and 1440 pixels. `TEST_BROWSER`, `TEST_WIDTH`, `TEST_SCENARIO` and `TEST_MODULE` are focused diagnosis filters, not the acceptance matrix. `EVIDENCE_DIR` optionally records the served source hashes. Source bytes must remain stable during each run. All page errors fail; the historical Cycle8 diagnostic classifier is neither widened nor used to suppress these errors.

The journey checks actual SDK account A→B→A, Church/Outreach transitions, campaign-only direct denials, expired/revoked/late People responses, retired controls, Forms/Events/Dream scope denial, duplicate selectors, current-authority Home return and delivery-only Communications without sending. Persisted lifecycle events are deliberately dispatched to the real handlers; this is not a claim of an actual browser back/forward-cache restoration. Completed authorization is awaited for negative route checks so transient loading/denial text cannot falsely pass.

The direct-response regression holds a fictional failure of an existing task PATCH, changes persisted SDK identity without a callback, and requires old Person/task data and retained controls to retire without retry. The fixture performs no task mutation. It reproduces the loss of PR109's request fence when importing the otherwise accepted PR72 file, and verifies its retention in the composition.

The Forms retirement regression first invokes the actual shared-session pagehide handlers, then calls the existing context refresh API. A detached context must not start another Auth request. This establishes a distinct obsolete-context invariant. It does not establish the root cause of the preserved Linux Forms/Auth errors, and a later successful matrix is not proof that the intermittent SDK/unload diagnostic is fixed.

All runtime corrections are owned and reviewed in the composition lane. These files only supply tests. Release remains NO-GO.
