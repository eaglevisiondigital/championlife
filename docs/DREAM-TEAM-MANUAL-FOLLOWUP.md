# Restricted Dream Team manual follow-up — source candidate

This current-main increment adds `staff-dream-team-manual.html` and one guarded migration. It reuses the existing organization staff directory, permissions, reviewed portal Account/Person links, People records, canonical follow-up tasks and immutable task events. It does not create an applicant intake, course system, serving qualification system or separate People store.

The exact original Dream Team form definition and application/form/audit columns come from PR #93 `461fd16fe4121c8df83e2bb56024ef09d297196d`, migration `20261002063140_dream_team_application_v1.sql`, itself inherited from reviewed PR #2. The new installer extracts only those three canonical private tables. Existing application audit receives additive request/task/binding columns. No historical course installation, six course-policy replacements, worker, document, placement or email-queue implementation is imported.

## Operational behavior

The workspace lists existing organization applications and allows separately authorized restricted reviewers to inspect exact approved answers. It does not ingest Netlify interest entries, create applications, infer Person identity from names/emails, or link accounts automatically. With no canonical applications, the list is empty. Availability of real reviewed canonical application data remains an acceptance dependency.

A reviewer can create one neutral manual next-step task for the exact currently reviewed application, verified Account/Person link and organization. It uses a fixed title and never copies restricted answers into ordinary tasks. Subsequent due-date/status/assignment edits preserve current assignment by default; only explicit self-assignment or unassignment is permitted. Completing a task does not certify course completion, training, age, serving eligibility or placement. The workspace explicitly says these remain unverified.

Every request requires current verified staff, active canonical staff assignment, and unscoped organization permissions `dream_team.application.read`, `dream_team.application.restricted`, `people.read`, `followup.read`. Writes additionally require `followup.manage`. The installer registers only the two Dream Team keys and never assigns them to any user. Outreach-only authority is not promoted to organization-wide People authority.

## Transaction and privacy boundary

The migration locks canonical staff/portal organization advisory gates, actor/subject Auth rows, directory/permission/link rows, the application, canonical Person and existing target task before validating wall-clock expiration and exact observed revisions. Writes and both canonical task audit and application journal commit together. Duplicate initial tasks, duplicate request IDs, stale application/link/task bindings and rejected audits fail without successful-change records. Deadlock or lock-timeout failures require a fresh review; no automatic retries occur.

The exact current-main authority helpers, task guard/audit functions and enabled trigger wiring are fingerprinted. Unknown target drift fails installation instead of replacing security logic. The registry accepts only the exact baseline, optionally with the separately reviewed Forms trio `forms.read/create/edit`, and preserves those keys. Installation of this source SQL is not authorized by its presence in the repository.

The browser checks the actual `client.auth.getUser()` result before and after requests, rather than treating the legacy helper's cached session as provider verification. Logout, account transition, protected navigation retirement and explicit denial clear review state and controls. Pending results and retained handlers cannot restore or mutate an old view. A denial for the same principal and organization also clears newer subject views. Mutations with uncertain outcomes retire the form and require inspection of task history before manual retry.

## Validation and release boundaries

Permanent local SQL and Chromium/WebKit tests use fictional fixtures only. The separate native PostgreSQL workflow uses real independent database sessions to exercise lock waits, completed revocation, expiration during target-task waits, portal revocation, lock timeout and concurrent duplicate creation. Local PGlite checks do not establish that native concurrency gate or genuine Auth acceptance.

This source candidate requires exact-head native/CI PASS, independent review, exact-target schema/ACL preflight and separately authorized isolated Auth/revocation acceptance before any installation. Current production and frozen PR #84/#90 are unchanged. Its new route is not added to the production staff navigation. Current-main HTML/CSS/branding are reused; only this new entry point uses accepted Supabase 2.118.0 URL/SRI. No claim is made that unrelated historical runtime paths have been upgraded.

The source-only installer deliberately creates an empty application domain, not live records. A future application availability/import procedure would require its own reviewed provenance and authorization; it is not implemented here. No real grants, document retention policy, applicant contacts, hosted SQL, messages, payments or production activation are included.

## Application provenance and transaction coverage — November 4

A verified email account and a current reviewed portal Account/Person link authorize an exact identity relationship; they do not prove where application answers originated or establish serving qualification. The application UUID, form version, original answers, submission history and source lineage must come from the separately reviewed canonical application source. Neither a Netlify interest entry nor a similar name/email is an acceptable substitute. The manual route has no import, application-creation, automatic linkage or certification operation.

The existing canonical portal administrator updates the same link UUID, increments its revision and prohibits changing its account identity. Revoke/reactivate therefore requires fresh review of the new revision. An application UUID replacement or Person/revision correction cannot silently redirect a previously prepared task request. Existing immutable application audit references also prevent deleting an already audited application to replace it.

New permanent provenance tests exercise these boundaries, including failure of the restricted-access audit, failure of the existing canonical task audit, and failure of the later application journal. In each case the whole transaction fails; rejected task writes leave answers, task state, revisions and successful audit history unchanged. A deliberately reissued request after a proven rollback can succeed once; this is not an automatic retry policy for UNKNOWN outcomes.

The native concurrency workflow additionally checks an application correction committing while a reviewer waits and two overlapping task updates against the same observed revision. These are separate-session native tests, not concurrency claims derived from PGlite. No browser/runtime or migration correction was necessary for these new cases. Real application provenance, target-managed Auth privileges, genuine authentication/revocation and authorized installation remain release requirements.
