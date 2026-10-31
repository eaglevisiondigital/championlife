# Unified staff shell — first local implementation

Local candidate from production main `bfb7af214707db73a3a3164bc96ccafae7de8ccf`, following Issue #58 and PR #60 at `ff08ec43f492362893cba9a0ae89a615dda98630`. No historical PR is merged. No SQL, permission catalog, deployment configuration or provider setting changes.

## Implemented slice

`staff-home.html` is the shared entry point. It uses the existing individual email-login page with a fixed local return destination. People & Follow-up and Registration & Check-In share current-user/logout, Church/Outreach context selection, scope selectors, permitted navigation and a keyboard-accessible mobile/tablet drawer. The approved Champion Life and Powered by Propel images, destination and desktop palette are retained.

Church selects an existing organization People workspace only with its existing organization-wide `people.read` grant. Department-limited grants are not broadened. Outreach selects only campaigns returned by the existing registration authorization RPC. The existing registration module continues enforcing its independent view, edit, export, check-in and administrator capabilities. A Financial Outreach Review link requires both existing `outreach.view` and `finance.read` for the selected organization; it remains the existing legacy review, not the unreleased NMI module. Missing modules are not advertised. The shared shell does not confer membership, staff access or financial authority.

The existing People and registration modules retain their search, household, waiver, history, export and check-in code. Their narrowly added hooks invalidate local state on shell loss and reject detached handlers. They are loaded only after fresh Auth verification and successful scope discovery. The previous People organization selector is hidden under the shell because the shared selector now performs that navigation.

## Authorization and session contract

- Reuse `ChampionLifeAuth` and `staff-session.js`; no second Auth client or alternate login system.
- Verify `client.auth.getUser()` and confirmed, non-anonymous identity; then read `staff_workspace_context()` and `outreach_registration_workspace('campaigns')`. Check current session identity again before mounting.
- No backend migration: `shared_platform_context()` from historical Gate 0 is **not** installed or assumed to exist.
- Every module RPC checks live local session identity and the shell generation before submission and ignores stale results. PostgreSQL authorization/RLS remains authoritative for each operation.
- Explicit server denial, module permission failure, logout, account change, pagehide, discovery failure or changed permission projection clears protected DOM, navigation, selected scope and module state. Retained controls cannot submit after this boundary.
- No asynchronous Auth methods run inside an Auth-state callback. Page restoration requires a fresh page authorization. A stopped shell does not automatically reopen on focus or a late successful response.
- Refresh discovery on focus/visibility and every 20 seconds while active; a 10-second verification timeout stops the shell. This is not instant push notification of a remote revocation: an unnoticed change is detected at the next refresh or explicit server denial. Backend checks apply throughout; requests submitted before a denial cannot be recalled by the UI.
- Existing current-session logout is preserved. Synthetic tests do not prove provider-side refresh-token retirement, and issued access JWT lifetime is unchanged.
- No private roster or permission snapshot is persisted by the shell. Existing unrelated storage and learner data are not cleared.

## SDK and preserved source

The three shell HTML entry points pin the previously accepted Supabase SDK 2.118.0 UMD artifact via exact jsDelivr path and SRI. SHA-256: `bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af`. SRI: `sha384-UagCvVPT5XXA0Hx+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT+39j5VfRjdP5Tp`. The test harness requires those exact bytes; it cannot silently substitute another SDK. Existing login and unrelated entry points are unchanged. No PR #57 migration, general registration schema, King Kind/lesson asset, NMI source or Global Propel source is copied or modified.

`docs/unified-staff-shell-overlap.json` records all 42 PR #60 overlap paths, each source blob and the disposition for this slice: 32 identical across reviewed sources, 10 divergent. Shared Gate 0 lifecycle/drawer/navigation patterns were adapted to the existing main RPCs; its broader backend composition and unavailable destinations are deferred. Existing main test/build manifests are extended, not replaced. Original accepted checkouts, reports and seals are untouched.

## Local acceptance commands

```sh
npm ci --ignore-scripts --prefix tools/backend-tests
npm test --prefix tools/backend-tests
npm run test:huntsville-native --prefix tools/backend-tests
npm run test:operations-member-native --prefix tools/backend-tests
npm run test:staff-workspace-native --prefix tools/backend-tests
SUPABASE_SDK_PATH=/absolute/path/to/accepted/supabase-js-2.118.0.js \
  EVIDENCE_DIR=/absolute/private/evidence/path \
  npm run test:staff-workspace-browser --prefix tools/backend-tests
node tools/site-build/build.mjs
```

Native tests start disposable PostgreSQL 17 on Unix sockets, apply existing migrations only to fictional local databases and remove those clusters. Browser tests use real Chromium/WebKit and the real SDK, intercept **all** HTTP and use fictional accounts. They test mobile/tablet/desktop, permitted editing, view-only denial, detached controls, delayed responses, account changes, cross-tab logout, return navigation, scope loss and unavailable discovery. They are not genuine-provider or physical-device acceptance.

## Recorded local results

- Full existing regression: all 24 programs passed, including 282 staff-session/account-switch assertions.
- New real-SDK shell browser suite: 268 checks passed in Chromium and WebKit at 390, 820 and 1440 CSS pixels. Includes intentional SDK-SRI rejection and disabled-preview behavior.
- Existing real-SDK staff-session browser suite: 68 checks passed after adapting only the new shell URL, remote-user mock and mobile-drawer expectations.
- Native PostgreSQL: 24 new shell-projection checks, 95 registration checks, 56 Huntsville checks and 54 operations/member-isolation checks passed; six independent registration concurrency scenarios passed.
- Two final builds: identical 411-file manifests. Five existing public files changed, three added, 403 existing public files unchanged. Manifest SHA-256: `aca2368dd78d0e89a04bcd9183f4ad8349a7c88242e65491301bfe632de9f22b`.
- Current GitHub main was checked again after implementation and remains the base SHA above. No live deployment assertion is inferred from that read-only Git check.

## Smallest next package and release gate

Independent local review of this exact shell composition first. The website-only runtime package is eight public files: `staff-home.html`, both existing staff HTML entry points, `staff-workspace.js`, `staff-workspace.css`, and the three amended existing JS files (`staff-session.js`, `outreach-people.js`, `outreach-registration-staff.js`). The allowlist and tests/docs accompany review. No database migration or staff grant belongs to this package.

After review, request a separately scoped isolated acceptance authorization with an explicitly verified nonproduction backend, legitimate test sessions, existing matching RPC/schema baseline, designated operators, applicable recovery/cleanup controls and approved test mailboxes. Check real email login/expiry/logout, actual permission revocation, supported devices and backend responses. No arbitrary/production backend may be substituted into a preview. The existing build still rejects unknown preview targets and disables sign-in when isolated configuration is missing.

Production approval must separately identify the reviewed website commit and build, applicable CI, current-main drift, real-session acceptance and rollback artifact. Rollback restores the prior website build; there is no SQL reversal or data cleanup for this shell. No push, merge, hosted acceptance, staff activation, deployment or messages were performed by local implementation.

NMI PR #59 remains independently ready for the planned November 2–3 four-MID boarding checks; this slice does not attest provider boarding or activate payments. Global Propel PR #3 remains independent. The blocked King Kind PR #57 migration and advanced Outreach/adult-evidence packages remain unchanged and unexecuted.
