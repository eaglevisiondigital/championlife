# Forms organization handoff and source composition

This source-only successor is based on Forms PR95 at
`7c186dd11a34ff5be277bc14b8ebf6f2b29414ee`. It changes only the Forms
organization-selector handler among runtime/public files. The selector now updates
its existing `organization` URL parameter before changing workspace scope, retaining
the path, other query parameters and fragment. If browser history replacement
fails, the protected workspace is retired; old controls cannot act with a new
organization variable. Reload and a separately reviewed login-return helper can
therefore recover the selected scope and reauthorize it normally.

The original defect was navigation inconsistency, not a database authorization
bypass: selecting B requested and displayed authorized B records, but the URL
continued to request A, so reload returned to independently authorized A. No new
permission or server behavior is introduced. Invalid or unauthorized organization
requests remain denied. Public baptism, collection, financial operations, SDK
pins and shared Auth remain unchanged.

## Executable integration evidence

`tools/staff-composition/sources.json` binds:

- Original Forms source above, including its accepted baseline fixture and SQL.
- Events PR96 `e4058f70232f2adddd4328dd76aec47cef724c22`, including the exact
  historical Events SQL as a **test fixture**, not an installed migration.
- Shared-session successor `efcfa3af4b2b7920bf4c357d42deba9aee3cfa4a` as an
  explicit browser-test overlay, not a runtime import into this candidate.
- Exactly one local SHA-256-bound candidate override: `assets/js/forms-admin.js`.

The test loader verifies original git-object hashes before considering the single
candidate override. Imported baseline fixtures must also match their pinned source.
Unknown drift fails closed. All 415 public files are compared with the Forms base;
only the selector runtime may differ. Three module pages retain the same accepted
Supabase 2.118.0 URL and SRI. Neither Events runtime nor the new shared-session
runtime is copied into this release branch.

Both SQL installation orders replay the accepted 27-source baseline plus exact
Forms/Events SQL in disposable data. They verify original and intermediate
catalog/ACL/function preservation, the exact declared permission registry union,
module-specific and organization-specific authorization, revocation and audit
behavior. Forms permission does not confer Events permission or vice versa.
The historical Events service-role ACL is observed as inherited source evidence;
it is not installation approval or a new grant in this package.

Browser tests use actual pinned HTML, Auth wrapper and staff-session scripts.
Only SDK identity/transport is fictional. RPC requests execute the original
functions in disposable PGlite under the fictional authenticated identity; they
are serialized to prevent fixture role cross-contamination. This is **not native
concurrency or genuine Supabase Auth evidence**. Every non-loopback request is
aborted. Cross-page identity, private draft save, independent revocation,
organization selection/reload, cross-tab logout, protected-state retirement and
module-specific return paths are tested without sending messages or contacting
providers. The separate shared-session successor must be installed only under
its own release approval before its new return behavior exists in production.

## Reproducible commands and gates

After the existing `tools/backend-tests` dependencies are installed:

```
node tools/staff-composition/integrity.mjs
node tools/staff-composition/database.mjs
node tools/staff-composition/browser.mjs
node tools/forms-core/build-integrity.mjs
```

The dedicated exact-head workflow fetches full history for the pinned source
objects. Each native PostgreSQL 17 matrix order receives a separate empty loopback
`forms_core_test` database; native results remain pending until those jobs finish.
No hosted connection is permitted by the inherited database harness.

The branch is source-only and does not compose or install the full staff release.
Remaining gates include exact managed target/schema/owner privileges, genuine Auth
and revocation, witnessed independent recovery/cleanup, and separately approved
migration and website releases. No grants, production data, provider resources,
payments, messages or published forms were changed.
