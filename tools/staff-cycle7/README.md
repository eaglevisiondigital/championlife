# Cycle 7 exact-source test package

This directory is test-only. It does not compose a releasable site, install a hosted schema, grant access or enable a provider. Current-main public source and build outputs remain unchanged. Release remains **NO-GO**.

The three probes make different claims:

- People/registration serves exact reviewed HTML, JavaScript and CSS through the real pinned SDK, with fictional intercepted Auth/HTTP responses. It checks shell navigation and private UI lifetime. This is not genuine Auth, RLS or provider acceptance.
- Forms/Dream Team/Events loads exact source into disposable local PostgreSQL 17, without creating accounts, applications, people or tasks. It checks catalog compatibility, unchanged canonical task and authority definitions/ACL/triggers, failed replay rollback, and denied RPCs. It does not prove privileged cross-module workflows or PR105/106 campaign-bound writer compatibility.
- Communications detects incompatible host contracts. Expected blocker assertions are diagnostic successes, **not Communications integration acceptance**. No compatibility adapter, invented shell methods or runtime source rewrite is supplied.

## Exact source selection

`sources.json` pins 76 regular Git blobs by full commit, path, byte count and SHA256. The first 44 cover browser inputs and build/dependency inventories; 32 additional inputs cover the 26-migration current-main baseline, synthetic bootstrap/automatic RLS, accepted reader fixture and three module SQL files. It also records 90 shared-path observations (nine paths across ten heads), including absence rather than substituting another version.

| Source | Exact commit | Selected role |
| --- | --- | --- |
| Current main | `999f4a75eeb8e4a05580dc603dda39ba64eb0409` | Baseline, package/lock and build inventory |
| Shell #102 | `0bee5dc7beef8ad7b88e5aeb9e0567730c82fc53` | Home/People/registration HTML, shell, common helper and CSS |
| People/registration #72 | `6e04acaef569228dfac8e621ef4c1de5c558b889` | People, registration staff and registration form runtimes |
| Shared session #97 | `efcfa3af4b2b7920bf4c357d42deba9aee3cfa4a` | Auth and selected shared-session runtime |
| Communications #77 | `3f8b33da9ed769e1389f3a67b513922610412b2f` | Communications HTML/runtime, legacy shell and dependency controls |
| Dream Team #99 | `0b6bf2f44c206c7b42c11d4a8ce0323777533f30` | Reviewed UI and manual-follow-up SQL |
| Forms #98 | `32605a00753c8c60076c5aa6742a770c710b0354` | Reviewed UI/private-draft SQL and accepted reader fixture |
| Forms #95 | `7c186dd11a34ff5be277bc14b8ebf6f2b29414ee` | Shared-path comparison only |
| Events #96 | `e4058f70232f2adddd4328dd76aec47cef724c22` | Reviewed Events HTML/runtime |
| Guarded Events #103 | `1f03ad3cf1609fa3dc9525a1539b8e9dc1734815` | Exact guarded SQL |

`loadSource(id)` returns a verified UTF-8 string for an explicit manifest ID. `verifySources()` verifies all inputs and returns frozen metadata; `loadSources()` returns a frozen ID-to-text map. `sourceManifest` is deeply frozen. The loader pins the entire manifest digest, disables Git replacement refs, refuses nonregular blobs and never fetches missing objects, resolves moving branch names, writes files or installs SQL. Tests use an optional `STAFF_SOURCE_LOADER` only to locate this helper across isolated author worktrees; final composition uses the adjacent helper.

## Shared-file conflicts

Auth and `outreach-staff-common.js` are byte-identical across all ten heads. `staff-session.js` has three distinct present variants and is absent from Communications #77. The selected #97 session is different from the #102/#72 session. `staff-workspace.js` has three distinct variants; the selected #102 shell is not the #77 Communications shell. The site builder has two variants, and public-file inventories/package manifests differ. These are recorded, not reconciled by a broad merge.

Shell #102 contains no Communications HTML. The actual Communications #77 pages require DOM and `StaffWorkspace` methods not supplied by shell #102. They also reference floating `supabase-js@2` without the exact #102 SDK SRI and omit the #97 session script. The diagnostic browser test must preserve those facts; a legacy #77 control cannot establish shared-host compatibility. Module UI blobs for Forms, Dream Team and Events are inventoried but a positive multi-module browser journey is not claimed.

## Commands and prerequisites

Run from the repository root with the exact pinned commits already present locally. The loader fails closed if an object is missing. Dependencies use the unchanged `tools/backend-tests/package-lock.json`.

```sh
node --test tools/staff-cycle7/source.test.mjs
node tools/staff-cycle7/integrity.mjs
TEST_POSTGRES_BIN=/path/to/postgresql/17/bin node tools/staff-cycle7/modules.native.mjs
SUPABASE_SDK_PATH=/path/to/exact/supabase-sdk.js node tools/staff-cycle7/people-registration.browser.mjs
node tools/staff-cycle7/communications.browser.mjs
```

The People browser test verifies SDK SHA256 `bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af`; original HTML SRI remains active. It supports `TEST_BROWSER=chromium` or `webkit` and optional private `EVIDENCE_DIR`. All browser HTTP is intercepted; fictional responses do not establish server enforcement. The native helper accepts only its disposable Unix socket and optional local binary directory, never a database URL, remote host or password. PostgreSQL major 17 is asserted explicitly. Its synthetic bootstrap supplies accepted fixture roles and Storage catalog; no reader PDF is copied or accessed. Module SQL/catalog checks are not an installer or authority to replay migrations.

The native probe preserves actual errors and rolls back failed replay transactions. It checks SQLSTATE `42501` for missing/unbacked identities and requires the expected audited tables to exist when counting empty rows. It leaves guards enabled. It neither tests nor changes a successful campaign-bound write path. The previous interrupted historical composition is not resumed and is not counted as passing evidence.
