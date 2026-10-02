# Dream Team Application v1

Implementation scope: native application, Dream Track next step, protected PDF, human review and separate placement, safe Person milestones and communication hooks. Development branch only; PR #2 remains draft. No production release is authorized.

## Source contract

Authoritative source: `Dream-Team-Application-Final-Source-Handoff.html`, supplied October 2, 2026. SHA-256: `8620cb3ec7c1bcf061996dddb6e6ac56c221b1368a765e714300b769378b3132`. The private handoff and screenshots are not published or committed. `assets/data/dream-team-form.json` is the versioned definition, excluded from the static public manifest and served to an eligible authenticated applicant through the guarded RPC. An independently extracted test fixture verifies all 52 fields, order, labels, choice/select options, requiredness, pages and sensitivity classifications.

There are eight source pages, 52 fields, 51 visible fields, 45 original required markers and seven optional fields. Form version: `dream-team-v1-20261002`; ethics version: `dream-team-ethics-20261001`. Source page prose and ethics agreements are retained. The native interface uses Champion Life branding, not JotForm styling.

Approved anomalies remain intentional:

- “Select up to three” permits four ministry selections.
- YES/NO checkbox questions permit both selections; radio controls remain single-select.
- The duplicate required quit-history field `id_33` remains permanently hidden. It cannot accept injected data and is exempt from visible-field submission validation.
- “Dream Track (6 week series)” remains unchanged.

Observed optional middle name/address line two and optional public-profile question/explanation remain optional. Birth-year choices retain the captured range, including 2026 through 1920. Dates use native date controls and normalized ISO storage; the available-start date defaults to the applicant's local day. Phone format is validated on the server. Unverified JotForm owner conditions, confirmation/email settings, integrations and PDF configuration are not inferred; this assignment supplies the native workflow.

## Identity, eligibility and lifecycle

Person, verified portal account, course enrollment, application, approval, ministry affiliation and staff/finance grants remain distinct. No email-based Person merge occurs. One application is maintained per organization/account. A reviewed active existing `portal_account_links` association is required for final submission; an eligible learner may begin a draft while staff reviews that association.

An AFTER trigger observes Dream Track online completion, creating availability, safe milestones and a single email job. Final meeting/badge completion remains a separate milestone. Existing online completers gain eligibility lazily on their next application read, avoiding an unsolicited historical email batch during migration. Lesson 7 and the dashboard immediately offer Start/Resume Application; email is not required to begin. Grading, the question bank, 95% watch rules and video implementation are unchanged.

An explicitly authorized administrator can enable or send an application before course completion. This never changes course progress/badges or grants authority. Sending additionally requires the existing `communications.send` capability and a verified reviewed recipient association. Replay/deduplication and resend throttling apply. Provider acceptance is distinct from actual mailbox delivery.

Durable states: available, invited, started, submitted, under_review, more_info_requested, approved_for_placement, declined, withdrawn. Server transitions and revisions govern all writes. Draft autosave uses cloud revisions and serial requests; stale saves fail visibly and require reload. Account changes clear form state and ignore late responses. No answers or signature persist in browser storage.

Submission validates visible required fields and drawn signature, creates an immutable snapshot including versioned prompts/options/answers, server timestamps, applicant identity and ethics version, and queues its PDF once. Repeated submit returns the original result. Submitted answers cannot be overwritten. More-information responses append a separate immutable submission version; private reviewer notes and applicant-facing request text are separate.

## Review, placement and People

New explicit organization-wide capabilities are registered, not granted: `dream_team.application.read`, `dream_team.application.manage`, `dream_team.application.restricted`, `dream_team.placement.manage`. Summary reads do not include restricted answers. Restricted detail/download requires read + restricted; decisions additionally require manage. Self-review is rejected. Existing active assignment/expiry/revocation checks are reused. Course managers, ordinary People staff, titles and ministry affiliations do not imply restricted access.

The staff workspace has status/placement/search filters, bounded pagination, manual enable/send, restricted responses/signature/PDF, applicant request/private notes, decisions and audit history. Person links open the existing People workspace. Placement is a separate operation after approval and reuses `person_department_affiliations`; department/team/title/effective-date/note are supported. The API supports an optional same-organization leader association. Placement history is immutable. No staff assignment or permission/finance grant is created.

The Person profile shows safe course/application/placement status and milestone history. Authorized users can open the dedicated workspace. The action bar uses existing capability checks: valid phone + `communications.send` offers a safe `tel:` link; `followup.read/manage` opens the existing task flow. Text, Email and Send video are explicitly disabled “not connected” hooks. No provider delivery is simulated.

## Private documents and signature

The required signature is normalized drawn stroke data with strict bounds/size validation, not a typed substitute. It is retained in the immutable submission with server `signed_at`, account identity, form and ethics version. Full answers, signature and the PDF are HIGHLY RESTRICTED.

`dream-team-worker` generates a PDF from the server snapshot using pinned pdf-lib/fontkit, the unchanged approved Champion Life logo and an embedded licensed font. The PDF contains all visible fields, answers, source sections, signature, submission/signing time and versions, with no account/database IDs or permissions. An attached UTF-8 `submitted-answers.json` preserves exact original text/signature, including characters unavailable in the embedded font; unsupported visible glyphs are marked with their Unicode code point. The attachment has the same restricted treatment as the PDF.

The worker uploads without overwrite to private `dream-team-private` (PDF only, 10 MiB limit). A protected-document row references application/submission/Person and stores content hash. There are no client bucket policies or public URLs. The document Edge Function validates the bearer with Auth, calls the guarded user RPC, audits access, then streams the private file with no-store/attachment headers. Applicants can download their own copy; reviewers require explicit restricted authority. The endpoint is fenced to the exact acceptance project and preview origin. Gateway JWT verification is disabled because the function performs explicit Auth verification; this does not make documents public.

## Events, jobs, alerts and operations

Private immutable domain events contain only scalar organization/Person/actor/type/source/correlation/time values, never answers, private notes, signature or PDF content. Events include online/full Dream Track completion, application availability/invitation/start/submission/more-information/approval/decline and assignment. Correlations make replay idempotent. Person milestones use the same safe events; events recorded before a reviewed Person association exists are not retroactively reassigned.

The action center filters completion alerts to authorized course managers, submission alerts to reviewers and approval alerts to placement staff. It is a bounded current action feed, not an external notification provider or full read/unread inbox.

Queue claims use row locking/SKIP LOCKED, leases and unique dedup keys. Only service_role may claim or record delivery/document receipts. The worker requires its separate random secret, held in acceptance Edge secrets and Vault; the scheduler never embeds a service-role credential. One job is processed per minute. The email worker reuses existing Auth OTP delivery with `create_user:false`; two exact preview callbacks select online-completion versus manual-invitation templates. The previous Dream Track and ordinary Auth fallback branches are preserved. SMTP is unchanged.

Delivery states are queued, processing, accepted, failed and unknown. Ambiguous network outcomes are never blindly resent. Operational recovery requires an authorized operator to inspect restricted job/provider/storage evidence, reconcile an accepted upload/message, then deliberately repair the receipt or requeue only after proving no delivery occurred. There is no automated retry of unknown/stale processing jobs in v1. Do not delete immutable submissions/audit to recover jobs. Monitor failed/unknown jobs and stale processing leases; production operational rollout is a separate gate.

## Acceptance deployment and validation — October 2, 2026

Only `bkbmjisprwmkptywtmih` was changed. New migrations:

- `20261002063140_dream_team_application_v1.sql` (hosted/local content MD5 `b3924b3ca821933282c8b7d783d1c3ff`). Eight private RLS tables, guarded RPCs, permission registry, completion hook and private bucket.
- `20261002063751_dream_team_acceptance_scheduler_support.sql` installs pg_cron only when available on the managed platform. Scheduler/Vault runtime configuration is acceptance-only, outside application migrations.

Acceptance Auth subjects/bodies and the two exact application callbacks were applied through the official CLI with only those properties declared. A subsequent comparison reported Auth up to date, including body file content; 19 unrelated remote properties were left unchanged. The dashboard's 255-character subject validation cannot edit these longer conditional subjects; use the scoped CLI/API mechanism. Both existing ordinary-login and Dream Track callbacks remain allowlisted, without wildcards. The acceptance cron worker is enabled once per minute.

All 21 earlier migrations remain unchanged. Acceptance has 23 migrations. Both new Edge Functions are ACTIVE. Unauthenticated endpoint calls were denied; an authorized worker invocation returned idle. No real messages, applications or grants were created. `tools/backend-tests/dream-team.acceptance.sql` exercises synthetic hosted workflow/security in a transaction and rolls everything back; read-back confirmed zero applications/submissions/jobs and zero synthetic users.

Full repository regression passed, including 63 application database checks, seven worker/document scenarios and an 11-page generated PDF, 15 learner DOM scenarios, 22 email/redirect checks and 12 staff/Person DOM scenarios. Actual Go template rendering passed 28 contexts, including ordinary Auth and hostile redirects. Browser checks used synthetic local service responses with real UI code: all eight pages had no horizontal overflow at 390, 768 and 1440 px; mobile restricted review and signature rendering were inspected. This is not a claim of hosted real-account or real-mailbox acceptance.

Security advisor: 35 intentional [RLS-without-policy informational findings](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), including the eight deny-by-default private tables, and the unchanged [leaked-password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No permissive policies were added to silence them.

## Remaining release gate / Work assignment

Use PR #2 preview and isolated acceptance only, with approved synthetic accounts and synthetic answers. Verify online Lesson 7 completion versus final meeting; immediate application CTA and actual delivered online/manual email including logo; reviewed Person association; all eight pages, refresh/sign-out/cross-device resume and stale-device conflict; drawn signature; immutable submit and eventual protected PDF; authorized review/more-information/approve/decline; separate placement and unchanged permissions; ordinary/wrong-account/cross-org denial; Person timeline/action hooks; desktop/tablet/390px mobile; PDF prompt/answer/ethics/signature fidelity. Verify actual job receipt/storage/download, not merely a queued state. Preserve existing User A/User B progress and notes. Do not submit real sensitive information or create real staff grants. Preserve immutable synthetic audit where cleanup cannot safely delete it. Return evidence and exact defects only. Do not merge, change production or start another package.
