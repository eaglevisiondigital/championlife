# Partner integration into the existing staff shell

Source-only, explicitly opt-in. `staff-intake-review.mjs` mounts inside the current `staff-main` and obtains the selected organization from the existing Church context. It uses the shared `ChampionLifeAuth` client and the current shell's intercepted RPC; it does not create a second login or change public navigation. The existing Powered by Propel shell is unchanged.

This slice integrates the **existing financial Partner intake reviewer**, not assigned ministry/pastoral access. Existing SQL requires separate `outreach.view` AND `finance.read`; registration-only campaign staff cannot list even the minimized intake metadata. The authoritative campaign association schema for the proposed assigned Partner portal remains absent and unavailable. Tags, donations, intake submissions and People relationships do not create permissions.

The fixed list request exposes only status/source/submission metadata in the view; the canonical Person ID remains in the minimal shared adapter result and is not rendered. No contact, household, finance, private notes, answers or relationship history is shown. The authorized link navigates through `StaffWorkspace.navigate` to the existing separately authorized review page. No direct table queries or mutations are added.

Sign-out, account/token changes, server denial, context changes, hidden/detached mounts, and pagehide synchronously remove protected state. Overlapping refresh results are generation-bound. Detached refresh/navigation handlers are inert. Ordinary errors close the module and require fresh authorization; no failed provider message is rendered. Server RPC checks remain authoritative, and prior requests cannot be physically canceled where the accepted shell returns a Promise.

## Exact dependency

This branch explicitly cherry-picks Staff commit `f2f518f` as `7d812df`: the four shared source/test/doc files are byte-identical. The shared CI command retains this branch's existing older test inventory instead of referring to an absent prior isolated-auth file. No historical staff chain is merged wholesale. Root coordinator will reconcile the shared dependency against the accepted Staff successor before publication/release.

## Acceptance and remaining gates

Node lifecycle tests and Chromium/WebKit at 390/768/1440 use fictional Auth/RPC responses with all network intercepted. The unchanged migration replay validates the exact existing RPC permissions in native PostgreSQL through shared backend integration tests. These results do not establish hosted email verification, provider session retirement or production release readiness. The actual assigned campaign Partner backend, genuine Auth/cleanup acceptance, public shell adoption and release authorization remain outstanding. No credentials, messages, paid resources, real account grants, migrations or deployment occur.
