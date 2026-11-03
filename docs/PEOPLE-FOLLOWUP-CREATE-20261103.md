# Create an operational follow-up task from People

Source-only increment on accepted PR72 roster head `8c1c2f53f29f16cdec2f4fe5b859a78f87c8bcf6`. No deployment, hosted installation, real staff grant or outbound delivery. The completed registration/print roster source remains unchanged.

## Working journey and existing authority

People & Follow-up previously displayed tasks and allowed status updates, but had no task-creation control. An authorized staff member can now open an existing person, enter a task title and optional due date, create the task, then use the existing revision-guarded status control to complete it. Existing styles supply the responsive presentation.

The editor appears only with current organization-wide `people.read`, `followup.read` and `followup.manage`. Each submission refreshes permissions and verifies the session using the existing shared auth flow. Its sole insert payload contains `organization_id`, `person_id`, `title` and `due_on`; it requests only the resulting `id`. The database supplies creator, task identity, open status and revision. The title's 1–180-character bound follows the existing SQL constraint; the date remains a date without timezone conversion. No assignee is selected or inferred.

Source authority was checked against the existing migration chain, not assumed from a UI label:

- `20260926000821_followup_tasks.sql`: column-limited authenticated INSERT, three-permission RLS, organization/person composite foreign key, verified actor guard and task events.
- `20260926034222_tag_workflows.sql`: current guard's separate server-created workflow exception; this editor supplies no workflow fields.
- `20260928172557_people_staff_v1.sql`: effective/datetime/assignment permission rewrite and scoped permission visibility.
- `20261022201357_operations_admin_security.sql`: restrictive finance-linked task/event visibility.

The focused native test replays the complete existing 26-migration test chain. No SQL file changes or new migration are included. PR80–83 were inspected: their unmounted assigned-decision foundation, consumer, directory and non-executable assignment review contracts are separate. This feature neither mounts them nor reuses event authority for People/decision access.

## Stale controls and uncertain outcomes

The form binds the current person, organization, user, route, generation, shared auth owner, client and client auth object. A detached or retired form cannot create another task. Navigation/account changes prevent a pending permission response from submitting the old person's task. Observed auth binding replacement permanently retires the editor, blanks captured title/date values and replaces only its still-current card, without clearing a newer view. Existing shell invalidation and backend authorization remain authoritative.

An INSERT already submitted cannot be canceled by navigation. A successful response must contain a task UUID before the UI refreshes the person's tasks. Network loss, missing result identity or another uncertain save outcome retires that form and offers a read-only task refresh. No automatic INSERT retry occurs. The existing backend has no task-creation idempotency key: this is **not** an exactly-once guarantee, and an operator can intentionally create another task after reviewing the refreshed list. A failure before INSERT allows an access-verification retry. Raw backend errors are not displayed.

Task-event history is append-only to authenticated application callers. This does not claim immutability against database owners or service-role authority. Task creation does not enqueue a workflow notification or send a message, and it does not create or link People, decision, event, guardian, learner or donor records.

## Validation and release status

- New real Chrome/WebKit tests: **276 assertions PASS** at 390, 768 and 1440 pixels. Covers create-to-complete, exact four-field payload/minimal return, empty due date, repeated submit, prior form, missing permissions, late person/account/URL/shell/session changes, auth-owner/client/client-auth replacement and restoration, committed response loss, malformed response, backend rejection and safe refresh.
- Baseline browser comparison: **6 checks PASS**, confirming that the same fully authorized fixture has no create action on the accepted baseline.
- Full-chain disposable native PostgreSQL: **48 assertions PASS**. Covers creation/completion and exact actor-bound events; missing permissions, wrong organization/person, other/unverified/anonymous account, revoked/expired/future/department-scoped permission, inactive staff assignment, forbidden identity/status/workflow columns, invalid title/date and denied audit rewrite. Notifications and unrelated row counts remain unchanged.
- Affected existing regressions: **64 People navigation assertions**, **222 identity-race assertions** and **5 People DOM scenarios PASS**. Unchanged registration/roster suites were not repeated locally.
- Both new programs are added to the existing Outreach summary review CI workflow. Exact-head CI and independent review are coordinator-reported gates; local results are not hosted acceptance.
- Coordinator verified two identical **411-file** builds, with `assets/js/outreach-people.js` the only public delta from the accepted roster baseline. Private synthetic screenshots/logs are excluded from the website artifact.

Commands: `node tools/outreach/people-followup-create.browser.mjs`, `node tools/outreach/people-followup-create.native.mjs`, `node tools/outreach/people-navigation.browser.mjs`, `node tools/outreach/people-identity-race.browser.mjs`, `node tools/backend-tests/outreach-people.dom.mjs`. Browser transport is fictional and rejects external origins; PostgreSQL accepts only the disposable local Unix-socket helper.

No new owner policy is needed for this existing permission-bound workflow. Genuine hosted acceptance, real staff activation and deployment retain their separate release gates. PR61 remains frozen; no assignment issuer, governance policy, broad People grant, assigned-decision integration, provider or outbound communication is activated.
