# Exact staff source composition — test-only

This package tests existing source together. It does not create a release branch
containing the complete staff suite, install SQL, add navigation links or alter
any public file. All 415 public files remain byte-identical to PR98.

## Immutable inputs

| Input | Exact reviewed commit | Use |
| --- | --- | --- |
| PR90 | `4f64fa14f03098e31ee8111c8ff1810fbc260542` | Frozen shell page, workspace and styles |
| PR94 | `1725d7138ab15cf09494fd6057e76d7b29194f80` | Original Dream Team manual page, runtime and SQL |
| PR95 | `7c186dd11a34ff5be277bc14b8ebf6f2b29414ee` | Canonical Forms SQL and accepted baseline |
| PR96 | `e4058f70232f2adddd4328dd76aec47cef724c22` | Events page/runtime and historical SQL fixture |
| PR97 | `efcfa3af4b2b7920bf4c357d42deba9aee3cfa4a` | Shared session return helper |
| PR98 | `32605a00753c8c60076c5aa6742a770c710b0354` | Forms route correction and public fallback assets |

The original 52 source bindings are verified unchanged. Supplemental SHA-256
bindings cover the shell and Dream Team inputs. Source selection is explicit;
shared Auth/common/style collisions must match, and every fallback public asset
is loaded from the exact PR98 Git tree and checked against its blob identifier.
No mutable runtime fallback or local candidate override is accepted. All five
module pages retain the accepted Supabase 2.118.0 URL/SRI. The SDK's transport and
identity are fictional in browser tests; the unchanged Auth wrapper and session
scripts execute normally. This is not genuine Supabase SDK/provider acceptance.

## New executable boundary

The browser fixture installs the accepted baseline and original Forms, Events and
Dream Team SQL into disposable PGlite. RPCs execute those functions under the
fictional authenticated role and exact user identity. The bridge serializes
requests to prevent role contamination; it does not prove native concurrency.
Actual staff and Outreach discovery powers the frozen shell. Real module RPCs
power restricted review, existing canonical follow-up task creation/update,
Forms lists and Events lists. Grants exist only in disposable fictional data.

New tests cover the six-source composition: shell/module privilege separation,
shared current account, Dream Team restricted denial and detached handlers,
delayed detail after a missed account callback, other-organization denial,
independent Forms/Events authority after Dream revocation, and cross-tab logout
with each original module route. They block all non-loopback traffic. Existing
Forms/Events two-order checks and accepted unrelated suites are not repeated.
Separate three-module SQL-order evidence must be accepted independently; the
single browser-fixture order alone is not migration-installation approval.

The frozen PR90 shell does **not** yet link to Forms or Dream Team. The test reports
that limitation explicitly and uses existing direct routes for cross-page
acceptance; it does not invent links or claim the fully integrated navigation is
complete. Original PR94 is used, so any separately reviewed Dream route successor
must be explicitly pinned in a future composition update.

## Run and release limits

```
node tools/staff-exact-composition/integrity.mjs
node tools/staff-exact-composition/browser.mjs
```

Use the existing `tools/backend-tests` dependencies. CI checks out the exact PR
head with full Git history and runs Chromium/WebKit desktop/mobile. All public
bytes are compared with PR98; its accepted reproducible build evidence remains
applicable without rebuilding unchanged output.

This package grants no production authority. Managed Auth owner privileges,
exact-target schema compatibility, genuine Auth/revocation, independent recovery
and cleanup, protected preview and separate release approval remain gates. Forms
publication/collection/payments, real assignments, real messages and provider
activation remain disabled. No historical financial dependency chain is imported.
