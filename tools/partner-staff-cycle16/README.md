# Partner intake within the accepted staff host

This source-only package begins with an exact-source test composition, not a merge of historical Partner or Staff branches. It preserves Staff #115 `7fde897cdbb6ae423cfdeec434a3b548fbc5aa4d` and Partner #116 `4cf2328caeec341b904a60bdd8c0889f66f77d55` unchanged.

The selected application derivations are explicit in `source.mjs`:

- `staff-outreach-partners.html` comes from Partner #116 with only its SDK URL corrected to the accepted exact-version package root. The version, SHA-256, SRI and SDK bytes stay unchanged.
- `assets/js/staff-outreach-partners.js` comes from Partner #116 with an organization-only sign-in return and explicit initiating-control checks across asynchronous Auth/RPC boundaries. Independent financial/outreach authority, current organization selection, RPC payloads and server authorization requirements are preserved.
- `assets/js/staff-session.js` comes from Staff #115 with one Partner route-map entry, reusing its existing organization-only login return validation. Repeated or malformed hints become `org=unavailable`; Person/intake/private query values are discarded.

Staff #115's canonical People/task current-actor fence, pagination, filters, task history, due-date/status handling, host navigation, permissions, shared Auth client, SDK configuration, SQL and 430-file public allowlist remain unchanged. No optional Partner adapter or historical backend installer is imported. Financial intake is not assigned pastoral Partner access. Its `outreach.view` and `finance.read` requirements are independent; People return additionally requires `people.read`.

## Reproduced dependencies

The historical Partner page requested direct `/dist/umd/supabase.js` bytes while carrying the SRI of the exact package-root artifact. The preserved November 3 evidence establishes that the direct bytes have SHA-256 `ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3`; the accepted root artifact is `bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af`. They differ by a 292-byte CDN comment. `sdk-sri.browser.mjs` verifies both exact byte hashes and proves the original URL/bytes fail SRI while the accepted root loads in both browsers. No CDN request is made by that test. Prior fixtures supplying root bytes for the direct URL are not proof of original production compatibility.

The existing Staff session map omitted Partner, so logout/account replacement defaulted to People; the module's initial sign-in link also lost its organization hint. The derived map preserves the Partner page and only a validated organization hint. That hint grants nothing: the destination repeats current server authorization. The existing public login page and its provider acceptance remain outside this source package; synthetic login boundary tests do not prove genuine email/Auth acceptance.

## Independently reproduced control-retirement gap

A retained Mark reviewed handler issued a new review RPC after its button was removed/reinserted during `getSession()`. The original button guard ran only before the await. The corrected derivation passes the initiating control explicitly through mutation, People search and verified return requests. It checks that control before RPC admission, after provider responses and final identity verification, and again before caller-side rendering/navigation. Removed subtrees also permanently retire their descendant buttons, selectors and anchors, so moving a previously removed child into a new connected parent cannot revive it. No global mutable action binding is introduced. Explicit 401/403 still clears protected state even when the initiating control has retired. A write already issued before retirement is distinguished from a forbidden new write; its delayed response must not trigger an automatic retry or resurrect details. Existing list/detail navigation keeps its generation contract because it intentionally removes its own navigation control.

## Executable tests

With the existing locked Playwright dependencies and exact cached SDK:

```
node --test tools/partner-staff-cycle16/source.test.mjs
PARTNER_TEST_COMPOSITION=1 SUPABASE_SDK_PATH=/path/to/accepted-sdk.js node tools/partner-staff-cycle16/journey.browser.mjs
PARTNER_TEST_COMPOSITION=1 SUPABASE_SDK_PATH=/path/to/accepted-sdk.js node tools/partner-staff-cycle16/independent.browser.mjs
PARTNER_TEST_COMPOSITION=1 SUPABASE_SDK_PATH=/path/to/accepted-sdk.js node tools/partner-staff-cycle16/login-return.browser.mjs
SUPABASE_SDK_PATH=/path/to/accepted-sdk.js node tools/partner-staff-cycle16/sdk-sri.browser.mjs
```

Omit `PARTNER_TEST_COMPOSITION` only on an independently verified runtime adoption. Default browser fixtures then read actual application files; test-only mode reads the explicit immutable sources and derivations. Every page request is intercepted at fictional origins. The actual shared Auth client, selected SDK, session, host, Partner and People sources execute. No dummy module replaces them. Local Chromium uses installed Chrome; CI uses locked Playwright Chromium. Both use Playwright WebKit, mobile 390 and desktop 1440 widths.

Tests distinguish pre-retirement requests already in flight from prohibited new operations, use independent permission combinations, reject unauthorized organization hints, and verify current authorized organization/Person navigation without creating identities or tasks. No SQL change or new database contract requires a new native replay in this bounded increment; previously passed native evidence remains separate.

The original Staff #110 WebKit cause remains UNKNOWN, and Staff #115 required CI remains INCOMPLETE after two runner shutdowns. New composition tests do not relabel either historical result. Genuine managed Auth/RLS, target/provenance, recovery/cleanup, provider acceptance and separate release authorization remain outstanding. Release NO-GO.


## Actual Cycle16 source adoption

This copy belongs to the separate actual Staff integration candidate. Initial test overlays are provenance; current application-file adoption, historical integrity checks and release gates are specified in `../staff-integration-cycle16/README.md`. Source adoption is not hosted installation or activation.
