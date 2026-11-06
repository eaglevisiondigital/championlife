# Communications shared-host compatibility

Source-only successor to staff shell `0bee5dc7beef8ad7b88e5aeb9e0567730c82fc53`.
Reuses Communications `3f8b33da9ed769e1389f3a67b513922610412b2f`, exact shared session
`efcfa3af4b2b7920bf4c357d42deba9aee3cfa4a`, and SDK 2.118.0 with its accepted SHA-256/SRI.

The four Communications pages now use the existing shell roots, verified navigation,
single Auth client and dynamic module lifecycle. Optional server discovery grants
only Communications destinations; it never implies People, registration or financial
authority. Explicit denial retires the host. History-only access remains available
within its exact authorized scope; scope changes discard Person URL hints.

No SQL, provider transport, credentials, callbacks or delivery activation are included.
The server remains authoritative. Missing optional Communications RPCs hide the module.
Sending and provider acceptance remain separately gated.

## Integrity and test boundaries

`overrides.json` binds six existing overrides and six added public files. Historical
manifests are unchanged. Current bytes are verified before historical checkpoint
comparisons; current public output is separately rebuilt twice and compared bytewise.
The build has 417 files: 409 unchanged existing files, two changed runtime files and
six additions. Tests and private evidence are excluded from the public allowlist.

The three copied Cycle7 test helpers remain exact at
`f927eb060dce08dfd56f4eff37bc5627e8ed4c6a`, including its 76 pinned blobs.
The additive module tests use two separately pinned original CSS files.
`HOST_SOURCE_ROOT` selects the candidate shell; CI first verifies its exact override
hashes. Forms/Events/Dream Team use actual pinned standalone pages and full-page
navigation, not an injected replacement dashboard.

People/registration tests overlay accepted PR72 module source for compatibility.
This candidate's shipped People/registration files remain those of PR102. These
tests do not constitute a release composition of PR72 or the standalone modules.
No direct Dream Team-to-Person navigation or task issuance is invented.

Run `integrity.test.mjs`, historical source/negative checks, and the current build
verifier. Browser suites require the hash-verified `SUPABASE_SDK_PATH` artifact and
installed Chromium/WebKit. `tools/staff-cycle8` suites use fictional intercepted HTTP;
they do not prove hosted Auth or database RLS. Strictly correlated WebKit SDK unload
diagnostics during Forms account replacement remain explicitly counted, not fixed.
The first Linux CI run additionally emitted Forms/Auth access-control errors without
observed cancellation. Those errors remain rejected and that run remains failed.
An observation-only diagnostic successor records document/request/Auth-event timing;
22 adversarial classifier tests preserve the original acceptance boundary. This
does not establish Linux acceptance or justify ignoring errors without evidence.

Genuine Auth/RLS, installed backend compatibility, independent recovery/cleanup and
separate release authorization remain required. Production release is NO-GO.
