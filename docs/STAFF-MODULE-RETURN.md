# Existing staff session: bounded module return

Source-only current-main successor. This changes the existing shared
`staff-session.js`, not the Auth provider, user/permission model or module mounts.
It addresses a reproduced separate-page workflow defect: after staff-page logout
or an Auth account change, the real shared session clears every module and always
redirects to People. Module-specific sign-in helpers never control that path.

The session now computes a fixed allowlisted return route when it leaves:

| Current page | Return page | Scope parameter |
| --- | --- | --- |
| Church Events | Church Events | `org` |
| Private Forms | Private Forms list | `organization` |
| Form builder | Private Forms list | `organization` |
| Dream Team manual review | Dream Team manual review list | `org` |
| Approved unified staff-shell page | Existing Staff home | none |
| Other existing staff page | Existing People fallback | none |

Only a single syntactically valid organization UUID is retained. A valid UUID
that the next account cannot access is retained so the target can reject it;
this is not a frontend authority check. Invalid or repeated scope parameters
become the fixed `unavailable` value, which the existing target page rejects
without silently opening its default organization. With no scope, existing
module defaults remain available. No record, Person, form, answer, draft, `next`
value or fragment is copied. A builder returns to the list, not a retained draft.
The existing login sanitizer is unchanged and accepts these fixed return URLs.

Existing immediate content clearing, local sign-out verification, failure retry,
account-switch handling and BFCache retirement remain unchanged. The already
approved PR90 `data-staff-workspace` → Staff home behavior is preserved when this
helper is later composed with that exact shell; PR90 itself is not modified or
released. No new menu link, dashboard, identity source or permission is added.

## Exact-source validation

The permanent browser harness loads the actual accepted HTML/module source from
PR90 `4f64fa14f03098e31ee8111c8ff1810fbc260542`, PR94
`1725d7138ab15cf09494fd6057e76d7b29194f80`, PR95
`7c186dd11a34ff5be277bc14b8ebf6f2b29414ee` and PR96
`e4058f70232f2adddd4328dd76aec47cef724c22`, overlaid with only this shared session.
It retains real module and session code; Auth/RPC are entirely fictional. It does
not replay migrations or establish provider acceptance. Exact-head CI fetches
history to obtain these reviewed Git objects; missing objects fail the test.
The previous shared-session DOM suite and two-build/source equality checks remain.

## Separate integration limits

Events explicitly updates its URL when the organization selector changes, and
this session reads that current URL at leave time. Forms and Dream Team currently
change their selected organization in memory without updating the route. Their
selector-to-route synchronization is a separate bounded module task; this helper
does not infer trusted organization state from arbitrary DOM text or controls.
Returning to the original explicit route remains subject to fresh target
permission checks, so that limitation is a workflow mismatch, not demonstrated
cross-organization disclosure or a database permission bypass.

These pages remain independently reviewed source candidates. New module SQL is
not installed, genuine Auth/provider acceptance remains separate, and PR90's
witnessed recovery/cleanup gate is unchanged. No public websites, hosted resources,
real staff permissions, messages, payments or deployment are activated here.
