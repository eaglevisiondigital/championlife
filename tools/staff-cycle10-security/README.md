# Pending detail and history retirement

This focused test serves actual public files from `SOURCE_ROOT` (default repository root) and the exact Supabase SDK 2.118.0. Only configuration, fictional Auth/backend responses, and the authentication destination are synthetic. Application functions and SDK methods are not replaced. The original Cycle8 source pins and unload classifier are untouched.

Run with the existing locked Playwright dependencies installed under `tools/backend-tests`:

```sh
SUPABASE_SDK_PATH=/absolute/path/to/verified-supabase-sdk.js \
SOURCE_ROOT=/absolute/path/to/actual-checkout \
node tools/staff-cycle10-security/pending-detail.browser.mjs
```

`TEST_BROWSER=chromium` or `webkit` selects one engine; otherwise both run. Locally Chromium uses installed Chrome; CI uses the locked Playwright Chromium. Chromium uses a 390px viewport and WebKit uses 1440px. This is a focused boundary test, not a general responsive-layout matrix.

Each module (Events and Dream Team) holds one existing detail response before delivery and exercises four transitions:

- An old organization success cannot restore private detail or history after switching to another authorized organization.
- An old organization denial cannot retire the unrelated current organization; current detail remains usable.
- A current organization denial retires access even after its original detail ticket has been retired.
- A missed Auth callback with actual persisted SDK account replacement cannot accept the old account's pending detail response.

Each scenario also invokes the detached original detail button twice and requires no additional RPC, no mutation/task issuance, no unknown/provider request, and no page error. The fixture uses the accepted read-only module responses and changes only response delivery timing; denial cases use the existing fictional 42501 response. No permissions, identity relationships or task issuance are manufactured.

The output records hashes for every served public file, public manifest, SDK and fixture dependency. Served sources must remain stable across scenarios and at completion. The actual source baseline for author validation is PR110 `b41d8002b3d1a452b91fe086e376f694825a06b4`. Results prove these synthetic frontend boundaries only; they do not validate hosted Auth/RLS or establish release approval. The original Linux WebKit Forms98 failure remains a separate unresolved diagnostic, and this suite does not rerun the prior 440 checks.
