# Walk-up correction and denied-session cleanup

This narrow source-only increment updates the existing staff registration bridge. It does not change the shared registration form, backend schema, authorization, request identities, consent or waiver rules.

## Confirmed defects

The shared form intentionally preserves the original payload after an uncertain submission, allowing only an exact retry. The staff bridge discarded proof of a definite database validation rejection, so an invalid phone rejected by the database could not be corrected in the open form. Separately, explicit permission/session denial reached the shared form's generic error display without clearing the protected household fields. Chromium and WebKit reproduced both behaviors on mobile and desktop.

## Behavior

Only a walk-up RPC with explicit HTTP status400 and PostgreSQL check-violation code23514 is marked a definitive rejection. Native PostgreSQL tests prove both an initial phone violation and a later attendee violation roll back the complete transaction, including registration, attendee and audit/event changes. Staff can correct that rejected payload while preserving its original request and attendee identities.

P0001 (including changed retries of an already accepted request),23505, missing status, HTTP5xx, transport errors and unrecognized outcomes remain uncertain. They do not permit a changed payload or rotate request keys. An exact retry of an already accepted request remains idempotent. Errors from the later list/detail lookup cannot reclassify the earlier accepted registration as rejected.

The RPC wrapper now recognizes the actual response's top-level401/403 status as well as the existing42501/legacy status paths. The walk-up bridge sends current-session denials through the existing protected-workspace cleanup before rethrowing to the detached form. Previous generation/session responses still cannot clear or restore the newer workspace.

## Evidence and limits

Focused actual-runtime Chromium/WebKit checks cover known check rejection, uncertain outcomes, same-key retry and private-form removal after denial. Disposable native PostgreSQL exercises existing migrations, failed-write atomicity, accepted retry idempotency and revoked-worker denial. Existing registration/navigation regression tests are retained.

All identities and service responses are fictional; no real Auth or hosted acceptance is claimed. No production deployment, schema migration, account/grant, message or provider activation is authorized. PR61 and the prior People/navigation corrections remain unchanged. This is a reviewed draft successor, not a separate registration system or production release.
