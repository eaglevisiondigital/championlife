# Dream Team application review → canonical Person next steps

Source-only increment on historical PR #2 commit
`3f2316d4e575a538d7fb5866dc9c0390f66cc471`. This is not a current-main release
composition and does not reinstall its historical migrations or capabilities.

## Existing implementation reused

`docs/DREAM-TEAM-APPLICATION-V1.md` remains authoritative: its approved 52-field
application, reviewed active portal/Person association, restricted human review,
immutable submissions, separate placement, protected documents and existing audit.
The live `dream-team-signup.html` Netlify interest form is untouched. Interest
entries are not imported or matched by name/email; they are not authenticated
applications, course completion, age evidence or serving qualification.

The existing restricted application detail now displays the linked Person's
existing follow-up tasks. A reviewer also needs current organization-wide
`people.read` + `followup.read`, plus `followup.manage` for changes. The server's
existing `people_workspace`, `followup_tasks` RLS/guards and immutable
`followup_task_events` remain authoritative. No new table, SQL, grant or permission
key is introduced.

The panel can create either **Dream Team — review next steps** or **Dream Team —
review training requirements**, optionally due-dated and self-assigned. It can
update a task's status/due date with its observed revision and read bounded audit
history. These are administrative tasks, not permission to contact an applicant.
No restricted application answer, signature, health/safeguarding information or
third-party identity is copied into general task records. Task completion does
not mark Dream Track, training, age/guardian approval, placement or serving readiness.

## Identity, privacy and failure boundaries

The panel uses the RPC's actual application `person_id` only when `identity_ready`
is true, then checks current Person access. Before each write it reloads the
restricted application and rejects a changed/unready Person association. Each
task mutation filters the exact organization, Person, task ID and observed
revision. Existing backend checks prevent cross-organization assignees and edits.
The application-read and task-write calls are separate transactions: this is a
Person-task workflow, not atomic application-link issuance. A later identity-link
change never transfers existing Person tasks to another account.

A loaded open task with the same fixed title prevents a repeat create in that
view; concurrent browser submissions are not covered by a new durable duplicate
constraint. No automatic retry follows an uncertain write. Staff must inspect
current saved tasks before deciding whether another create is appropriate.

Controls bind to the original Auth/client, principal, organization, application,
view, route, navigation generation and connected DOM. Account changes, sign-out,
explicit denial, page retirement and unconfirmed requests clear protected state.
Late reads and detached controls cannot repopulate it. Fresh context checks after
history reads include People, follow-up and restricted application authority.
Protected-document downloads receive the same lifecycle binding; pending fetch or
Blob results cannot download after retirement, and explicit document 401/403
retires the workspace. Created object URLs are revoked after use.

Dream Team/Person links carry the exact organization. The existing People receiver
accepts only one valid, currently authorized organization hint before showing its
workspace. Duplicate, malformed or unauthorized hints fail closed; an omitted
hint retains its existing default. Query parameters never grant Person access.

## Validation and release dependencies

Focused fictional Chromium/WebKit tests exercise create, due date, revision,
history, missing identity, account/logout, permission loss during history,
delayed A→list→B, detached controls and UNKNOWN writes at 390px and 1440px.
Existing full-source PGlite replay verifies application boundaries and the same
canonical task permission/revision/audit behavior, including rollback on audit
failure. This is not native managed PostgreSQL, genuine Auth or provider evidence.

Historical PR #2 dependencies remain uninstalled in production. Its legacy SDK
entry points, full staff framework, Dream Track/application SQL, exact managed
catalog, PDF/worker custody and source/current-main composition need separate
review. The new source does not replace the corrected current-main SDK or frozen
PR #84/#90 candidates. A current-main merge, hosted recovery/Auth acceptance,
qualified reviewer grants, actual identity provenance, safeguarding/training
policy and exact production release require their separate gates. No messages,
applications, placements, permissions or resources were created by this work.
