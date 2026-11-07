# Existing People task controls: permanent view retirement

Source-only successor to People #72 `91ebfeea001babf5851690076e9ef6d71e91b19a`. No SQL, identity, task-issuance or permission change.

The existing status/due editor admitted a new canonical task update after its button/card/ownership ancestor had been removed and reinserted while permission verification awaited. This is stale UI intent admission with a still-authorized actor, not a demonstrated server RLS bypass. The original `organization_id`, `person_id`, task ID and expected revision filters remain unchanged.

The correction records original controls, labels, card and ownership ancestry. Removing/reparenting any captured owner permanently retires that mutation view, clears private editor values, disables controls and denies retained callbacks. Mutation records are drained synchronously at admission, covering same-task remove/reinsert before observer delivery. Initial card insertion is allowed. Already submitted writes are not rolled back or falsely described as canceled; retirement prevents late UI publication and any new request from the retired controls.

A conflict or uncertain result deliberately retires mutation intent while preserving the existing read-only **Refresh follow-up tasks** action. That distinct action is itself ownership-bound and cannot revive after removal. Unknown writes are not automatically retried. Fresh current-account/org/People/follow-up checks and canonical revisions remain required.

Tests use fictional Auth and disposable local state. The actual People runtime is tested, not an extracted reimplementation. Original failure logs are preserved privately. Permanent DOM and independently authored Chromium/WebKit coverage includes removed controls/ancestors, held verification, captured handlers, current-user/org changes, revocation, legitimate edits and read-only reconciliation.

The original accepted PR85/86 helper-hash assertion remains. A hash-bound, reversible derivation removes only the reviewed lifetime additions before that historical assertion; browser behavior still executes the actual successor. The additive frozen72 source/build guard binds every other baseline file, four explicitly modified paths and five bounded additions. Negative tests reject runtime/workflow/historical-test/SQL/public drift and unlisted sources. All existing workflows/assertions remain required; no timeout increase or test removal. New lifetime checks run in an additive independent job, leaving the existing summary job command list and time budget unchanged.

Run:

```
node --test tools/outreach/people-task-lifetime.test.mjs tools/outreach/people-task-lifetime.integrity.test.mjs
node tools/outreach/people-task-lifetime-independent.browser.mjs
node tools/outreach/people-task-lifetime.integrity.mjs
```

Source checks do not establish genuine Supabase Auth/RLS or hosted recovery. Frozen Staff #117 failures remain independently unresolved. Release NO-GO.
