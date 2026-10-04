# Tag workflow implementation and recovery

## Available behavior

- Administrator-reviewed per-tag activation; disabled by default.
- Source-event identity, assignment generation and rule snapshot retained on every new run.
- One reserved task identity and one notification record per run.
- Organization-scoped runs, notifications and append-only workflow action history.
- Automatic task creation under the reviewed rule, including when a tag operator lacks manual task-management permission.
- Human recovery for configuration failures with revision checks and visible outcomes.
- Email requests persist as held or canceled. No sender or scheduled worker exists yet.

## State transitions

| Starting state | Condition or action | Result |
| --- | --- | --- |
| No run | Rule disabled or historical assignment predates activation | No run or task is created |
| Pending | Eligible active assignment, rule and leader | Task created; email request held |
| Pending or needs review | Missing/ineligible leader, paused workflow, changed department | Needs review with reason |
| Pending or needs review | Assignment removed/superseded or repeat suppressed | Skipped with reason |
| Needs review | Authorized retry succeeds | One task and held email request; attempt history retained |
| Needs review | Authorized dismissal | Dismissed; no task created |
| Task created | Authorized email cancellation | Task retained; email canceled |
| Task created | Task completed/canceled or assigned to a different person | Task change retained; held email canceled |

The internal building state exists only within the transactional task-creation attempt and must not be committed as a normal endpoint. Unexpected creation failures roll back task and task audit, then set the run to needs review. The run retains the same reserved task ID on retry.

## Permission boundaries

Read requires people.read, tags.read and followup.read in the same organization. Recover/cancel requires tags.manage and followup.manage in addition. Activation further requires staff.manage. Staff.manage alone does not grant contact, workflow, care or giving access. Tags and department leadership never create grants.

The new security-definer executor is private and not callable by browser roles. Invoker RPC wrappers expose only checked configuration and resolution functions. The task guard accepts automated insertion only when the task ID, workflow ID, organization, person, title, due date, current execution actor and assigned leader exactly match a server-created building run. Browser insert grants omit both task ID and workflow provenance. Manual task guards and audits remain in force. The private schema must remain unexposed in PostgREST.

## Recovery semantics

Retries use the original event's instruction, timezone-derived due date and repeat-assignment policy. The current eligible leader is selected within the original department. Moving the tag to a new department requires a deliberate decision for the old exception; retry does not silently adopt that move. The repeat-once policy means once after a successful workflow task, even if that task was later canceled. To intentionally generate another task, configure each-assignment mode before a new removal/restoration or create a manual task.

An old run cannot be revived after its assignment was removed and restored, because its assignment revision is superseded. Existing tasks are not automatically canceled by tag removal. Staff decide whether those tasks are still relevant.

## Next delivery phase

Select and configure the outbound provider and verified sender. Build a worker with leases, independent notification attempt tracking, rate limiting, retry/backoff, provider idempotency and ambiguous-outcome reconciliation. Before delivery, verify the current task is open, assigned to the intended recipient, and that the recipient still has a verified address and organization contact/follow-up access. Department-leader changes and historical held requests need explicit reconciliation. Resolve the recipient address server-side, with minimal email content and a protected task link. Never use general tag visibility as permission to reveal giving or private care details.

Do not convert all held rows into sendable jobs automatically. No messages are authorized to be sent from development tests. Use synthetic test recipients/providers until delivery configuration and recipient review are complete.

## Verification

Run `npm test --prefix tools/backend-tests`. The workflow database suite injects a notification-storage failure after task insertion and verifies rollback of both task and task audit, then successful recovery without duplicate notifications. DOM tests exercise configuration, retry/conflict, history, task opening, cancellation, restricted controls and late-response clearing. These are synthetic tests; they do not replace live sign-in, actual browser visual acceptance or provider-delivery testing.
