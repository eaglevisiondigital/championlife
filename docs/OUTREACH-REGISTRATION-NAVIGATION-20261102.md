# Registration actions remain attached to the current household

This source-only increment builds on the existing Church/Outreach staff workspace. It does not change the frozen staff release, backend authorization, campaign capabilities, schema, branding or public registration flow.

## Confirmed problem and correction

Retaining a household's Save, Check-in, Add Attendee or Signature handler, navigating to another household and invoking the old handler submitted the original registration ID. Chromium and WebKit reproduced all four operations at both mobile and desktop dimensions. The database still enforced staff permissions; this was a wrong-subject client mutation defect, not a demonstrated database authorization bypass.

Controls now capture navigation generation, authenticated user ID, campaign, selected household, view and URL. A control must still belong to the workspace and match that binding before it executes. Independent duplicate-call protection also applies while a handler runs. Raw forms, walk-up callbacks, configuration and access controls use the same boundary.

RPC results and their callers check the captured binding before further requests, DOM changes, downloads or navigation. Stale errors cannot clear a newer view. Context/user lookups assign state only after their generation is confirmed. Page hiding clears protected content; history restoration and campaign navigation require fresh context loading. Existing session/permission checks remain authoritative at the server and shared staff shell.

The shared walk-up form treats a resolved callback as successful and clears its idempotency keys. A stale walk-up callback therefore rejects instead of returning empty success. Legitimate current form retry behavior remains unchanged. Requests already sent before navigation are not represented as cancelled or rolled back; their late results cannot reopen the previous subject.

## Local validation

- `node tools/outreach/registration-navigation.browser.mjs`: real Chromium/WebKit, fictional RPC responses, mobile and desktop. Exact stale handler replay, delayed mutation and CSV responses, post-RPC microtask invalidation, account/campaign/history changes, logout, denial and normal household actions.
- `node tools/backend-tests/outreach-registration.dom.mjs`: existing registration/check-in/forms regression.
- `node tools/backend-tests/staff-session.dom.mjs`: existing shared session/account-switching regression.
- `TEST_NATIVE_PG=1 node tools/backend-tests/outreach-registration.test.mjs`: existing campaign/registration authorization checks in disposable native PostgreSQL only.
- Existing Outreach view, entry and authentication-binding tests; two identical public builds.

The permanent browser test uses the locked Playwright dependency. Locally Chromium may use installed Chrome; CI installs the lockfile's Chromium and WebKit. All test data is fictional and all browser service requests are intercepted. These checks do not constitute genuine Supabase authentication or production acceptance.

## Release boundary

Draft source review only. This increment does not authorize any deployment, migration, staff grant, account activation or provider request. PR #61 remains unchanged. The reviewed stack must receive separate release reconciliation and genuine authentication/recovery acceptance before installation; this change alone does not authorize releasing other stacked components.
