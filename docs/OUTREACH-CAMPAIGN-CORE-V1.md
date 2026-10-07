# Global Propel Outreach Campaign Core v1

> Phase D extension: the accepted Phase C attendee/check-in model now has a dependent local prize-operations candidate with secure six-digit identities, configurable pools/inventory, explicit prize capabilities, server-side draw/claim serialization, household retrieval, number-only public display, held notification hooks and private backup. See [Outreach Phase D prizes](OUTREACH-PHASE-D-PRIZES.md). No campaign is enabled and no hosted/production change is included.

Status: Phase A implementation candidate, locally tested; not applied to acceptance or production. The isolated branch starts at Champion Life main `e1f75f917f9a1e6e16e0b8f9bc5d7b52fbf0a424`. PR #2 is not a dependency and must not be merged to release this package.

## Scope and ownership

Global Propel → Outreach → Outreach Campaign is the reusable model. Bessemer and Huntsville are records in that model. Organization ownership and explicit campaign assignments enforce access; names, cities, public slugs and tags never grant it. The schema has no fixed city/country list. It supports the intended 18 U.S. cities/five countries without schema changes, with explicit timezones and event instants.

Champion Life and SowGo retain separate organization identities, existing websites and financial boundaries. This does not move the application into the historical .NET repository or combine product databases. Reuse by other consumers is through the module contract, not exposure of Champion Life/SowGo records or intellectual property.

Phase A includes opportunities, campaign approval, immutable workflow versions/snapshots, assignments, private documents, training acknowledgements, scoped registrants/decisions/follow-up, existing Getting a Grip progress, dashboard/CSV/contact actions and Bessemer/Huntsville configuration. Team/travel, household waivers/check-in, operational prizes and event-day operations are later phases. Dormant prize integrity primitives satisfy the assignment's architecture tests; they have no application-role execution, browser API, operator UI or public wheel.

## Data and lifecycle

| Relation | Contract |
| --- | --- |
| `outreach_opportunities` | Organization-owned interest/review with revision and explicit approval. Records the 15 supplied opportunity concepts. Submission alone creates no campaign or authority. |
| `outreach_campaigns` | Owner, unique owner/code, location, timezone, host Organization reference, venue, dates, public page, status, opportunity and template identity, flexible bounded settings, created/approved/closed times. Identity and workflow version cannot change after creation. |
| `outreach_campaign_admins` | Explicit view/manage organization assignment, additionally requiring active existing staff assignment. No automatic bootstrap or conversion of an existing capability. |
| `outreach_campaign_assignments` | Campaign/user/role/capabilities, effective/expiry dates, revocation and reason. Local leaders need no organization People grant. |
| `outreach_campaign_contacts` | Reviewed canonical People references and host pastor/coordinator/internal/logistics roles. No copied contact database or email merge. |
| `outreach_campaign_sources` / `registrants` | Trusted legacy-source bridge or reviewed canonical Person reference. Unique legacy row; unique linked Person within a campaign. |
| `outreach_campaign_decisions` | Append-only configured decision, prayer/testimony context, timestamp, source and altar-care actor. No automatic Person creation. |
| `outreach_campaign_followups` | Campaign/registrant task, note, due date, assignee, open/completed/cancelled state and optimistic revision. |
| `outreach_campaign_audit` / `events` | Append-only operation history and held domain hooks; no answers, contact-message delivery claims or secrets. |

Opportunity stages: new, contacted, reviewing, tentative, approved, declined, future. Only the guarded `approve` action creates a campaign, atomically records approval and takes the template snapshot. Retry returns the same campaign. Setting stage to approved through ordinary edits is rejected. Declined/future interest must first be explicitly reviewed again.

Campaign states: draft, approved, preparing, registration_open, ready, completed, closed, cancelled. Required applicable preparation must be complete before `ready`. Existing Bessemer registration-open state is imported as fact, not proof that its preparation is complete. Unknown host/date/venue details stay unknown. Final event and operational details may be represented in venue/settings and category documents; this phase is not a native personnel/inventory/travel system.

## API and authorization

Authenticated invoker RPCs are `outreach_campaign_workspace(action, campaign, payload)` and `outreach_campaign_workflow(action, campaign, payload)`. Their private definer implementations have fixed empty search paths, qualified relations, verified non-anonymous identity checks and server-side campaign/organization checks. New tables have RLS and no direct anonymous/authenticated table privileges. Storage is the explicitly scoped exception described below.

Core actions: context/list/detail/csv; opportunities/opportunity_save/approve; assignments/assignment; contacts/contact_set; reviewed register_person/link_person; decision/followups/followup; configure. Workflow actions: templates/template_publish; list/assign/comment/complete/reopen; document_request/document_uploaded; training_assign/training_status; reminders/acknowledge. Updates that require a revision reject omitted or stale revisions. Dates omitted by configuration writes are preserved; explicit null clears them. Native UI enters dates in the operator's device timezone and displays the campaign timezone.

Roles: host_pastor, local_coordinator, outreach_coordinator, pastor_roddy, internal_team, logistics_lead, local_leader, other. Roles label responsibility; explicit capabilities authorize actions: view, export, followup, decisions, workflow, documents, draw. Capability `view` is required alongside local action permissions. Admin manage grants Phase A management; it does **not** implicitly grant draw operations. Admin provisioning is owner-controlled and requires separate authorization before any remote assignment.

Assignment by email resolves an existing exact verified account only. It neither invites nor creates an account nor silently links People. Canonical Person linking/contact assignment additionally requires the existing independently scoped People read permission and an identity-review reason for registrants. Campaign-only leaders cannot read org-wide People, finance, staff administration, Dream Team, unrelated Dream Track or course answers. Every request checks effective/expiry/revocation; UI denies 401/403, clears protected content and discards late responses after session/access loss. Returning focus reloads current authority.

The campaign UI is `/staff-outreach-campaigns.html`; an optional campaign UUID query opens detail after authorization. It is a non-secret frontend shell, not a public data endpoint. Existing staff/home/public pages are unchanged. Login reuses the existing same-origin next sanitizer and Auth SDK. No Auth, SMTP or callback configuration is changed by this package.

## Workflow versions and forms

Templates are immutable published JSON versions, scoped to organization (with an immutable shared source template). Two organizations may use the same template key/version independently. Campaign steps snapshot the entire definition and order. Publish another version to add/remove/reorder future steps; active campaign snapshots remain intact.

Definitions support key/title/instructions/category/order/active/required/role, dependency keys, condition field/equals, event-relative due days, reminder cadence, escalation role, form reference, signature requirement, document categories, approval requirement and completion rule. Assignment to a person, comments, completion notes/actor/time and due state live on the campaign step. Dependencies must refer to earlier steps; cycles/unknown prerequisites and malformed definitions fail closed. Completion rules currently enforce manual completion or assigned-training completion; external signature/form review is handled by an agreement document plus authorized review attestation. This is **not** a native legally binding electronic-signature service.

The source-informed v1 has host setup, welcome/coordinator contact, agreement/pre-checklist, conditional flyer preparation, production packet, training, 30-day event information and final packet at least 14 days before event. The engine does not hardcode those eight steps. Unknown flyer choice awaits configuration; false skips flyer action; true requires flyer preparation. Bike/tablet quantities and host purchase versus Champion Life purchase/transport are configurable, nonnegative integer quantities; cost/time changes produce a held coordinator-review event. No prices/default quantities are invented.

Due dates are stored from the explicit event instant. Event changes recompute incomplete steps only, preserving completed historical due times. Reopen requires a reason. Readiness is rechecked against required steps. Document/approval/training gates are enforced on the server, not the UI. Role/person reassignment only targets currently active, verified campaign participants.

Native form compatibility is a campaign resource key and `field_schema` with `pending_field_capture` state. Exact JotForm form fields, signatures, consent and waiver text are not yet captured and are not fabricated. Phase A staff records supplied opportunity concepts; public interest submission is a later gateway, not anonymous execution of staff RPCs. See [field mapping](OUTREACH-FIELD-MAPPING.md).

## Documents and training

Campaign documents record category, requested account, due date, status, visibility, immutable object path, version/replaced document, size/type and upload time. Categories include agreements, production/event packet, flyers/QR/maps, permits/insurance, lodging/transport/personnel/inventory, training, photos/videos and other. Initial direct uploads accept PDF/PNG/JPEG/TXT/DOCX, 1 byte–10 MB. Video category can reference an accompanying document; video binary ingestion is not implemented. Training references the existing playlist rather than duplicating video files.

Bucket `outreach-campaign-documents` is private, including files marked public. A public visibility designation is classification only; public delivery needs a separately reviewed future route. Restricted files require campaign administrator management; internal/public-designated files require explicit campaign document capability. Object paths are prescribed by document request. Storage policies permit only scoped INSERT/SELECT; no browser overwrite/delete. Uploaded status requires actual Storage metadata, never a client's claim. Replacements use new UUID paths, preserve prior visibility and create one successor per version; prior objects/history remain. Download uses normal authenticated Storage and rechecks campaign authority before exposing a browser blob. No signed public URLs are generated.

Training assignments target active verified campaign accounts. Each records assigned/viewed/completed and timestamps. Learners acknowledge their own training; workflow actors assign it. No video telemetry or LMS grading is added. King Kind remains Coming Soon with Pastor Roddy Shaffer attribution until the approved final PDF is supplied and registered. No resource file or delivery entitlement is invented.

## Decisions, discipleship, dashboard and CSV

Bessemer decisions/prayer context project from the existing registration until a later native decision is captured. Native decision codes are configured per campaign; initial codes are salvation, rededication, healing, prayer_followup, learn_more. Decisions do not enroll, merge or provision anyone.

A reviewed Person uses only its active reviewed portal-account link. The historical bridge may use its existing verified claimed user until a Person is reviewed. There is no email-based enrollment match. Projection joins only the existing Getting a Grip course/enrollment/lesson progress: not_enrolled/not_started/active/completed, earliest incomplete lesson, completed count and last activity. A revoked link removes progress. Completed enrollment has no current lesson. It never includes answers, private learner notes or another course. Existing WATCH TO ADVANCE, ANSWER TO COMPLETE behavior remains unchanged.

Dashboard lists only allowed campaigns with country/state/city/status filtering, campaign detail, registration/decision/salvation/rededication/prayer counts, enrollment/not-started/active/completed and needed follow-up. Global summary means the actor's allowed campaign set, never an implicit platform superuser view.

CSV is generated and authorized server-side for the chosen campaign. Exactly: First Name, Last Name, Phone, Email, Decision, Registration Date, Discipleship Status, Current Lesson, Last Activity, Follow-Up Status. Quoting/escaping and spreadsheet-formula neutralization apply. No unrestricted IDs, prayer notes, answers or financial fields. Export is audited. Filter/UUID manipulation cannot widen it.

Call/Text/Email use validated `tel:`, `sms:` and encoded `mailto:` links opening the operator's own apps. They do not send provider messages or fabricate delivery history. Held event hooks include campaign.created/approved, workflow.step_due/overdue/completed, document.requested/uploaded, agreement.completed, training.assigned/completed, registration.opened, team.signup_opened, event.ready/completed, followup.required, drawing_number.assigned, drawing_reminder, prize.won/unclaimed. Manual reminder refresh deduplicates cadence buckets; acknowledgment is manual. No scheduler, SMTP/SMS integration or provider sends are installed.

## Bessemer bridge and Huntsville

Candidate seeds use existing canonical SowGo ownership. Bessemer code/source `bessemer_al_2026`, public page `/bessemer`, existing registration-open state; Huntsville code `huntsville_al_2026`, draft and exact-field-capture pending. Both use the same template/resources. Date, host, venue and publication facts not supplied remain unset.

Migration backfill inserts bridge references to existing `outreach_registrations`; it does not rewrite/delete registrations, ownership, contact data, decisions or user claims. A trusted fixed source mapping bridges future Bessemer inserts exactly once. It does not create People or a second Bessemer database. Existing page, QR, registration endpoint, presentation and King Kind Coming Soon are unchanged. Before remote application, reconcile migration history/source ownership and compare real before/after counts and content hashes; local synthetic replay is not live mapping proof.

Huntsville is configuration-ready, **not event-ready or published**. Set confirmed dates/venue/host contacts, explicitly assign operators, complete actual agreement/training/documents, capture exact source forms, then separately approve later-phase team/preregistration/public features. Team signup opens approximately 60 days before event as configuration for Phase B; there is no automated signup opening in Phase A.

## Dormant prize integrity contract

Owner-only tested relations cover participants, immutable unique campaign six-digit numbers, configurable pools/entries, immutable selections/history, immutable campaign-wide wins and unclaimed exclusions. No application roles may call the draw functions and no public wrapper exists. Do not enable them as a Phase A operational shortcut.

Cryptographic UUID randomness with rejection sampling generates unbiased six-digit numbers independent of identity/contact data. One participant has one number, unique within campaign. Checked-in active status, explicit pool membership and explicit campaign draw permission are required for selection. Backend selection creates history before any future animation. A campaign transaction advisory lock serializes cross-pool selection and resolution; pending selection reserves the participant across all pools. A claimed win inserts a unique `(campaign, participant)` ledger checked by all later selections. Updating eligibility, deleting entries or direct API manipulation cannot undo the immutable win. Public reveal projection contains prize and number plus opaque draw handle, no participant name/phone.

Unclaimed/not-present is NOT WON. Pool policy is mandatory with **no default**: `remain_eligible` allows a later selection; `exclude_participant` records an immutable campaign exclusion. Historical selection remains; redraw is new history. No silent policy choice is made. The existing paper packet's bike-winner/tablet eligibility is explicitly superseded by the user's permanent one-prize-total rule.

Phase C must establish one reviewed campaign participant per individual attendee, including each child independently; never create duplicate participant identities to bypass the ledger. Phase D must add guarded household/guardian views, eligibility/category configuration, inventory/prize units, operator claim/redraw workflow, wheel reveal, provider-independent backup roster and offline reconciliation before activation. Offline claims must be reconciled into the same permanent win ledger before resuming digital draws; do not allow independent paper/digital draws that could award twice. This package supplies architecture/integrity tests, not those operational features.

## Verification and release gate

Candidate migrations: `20261006113255` core, `20261006113311` workflow/storage, `20261006113322` dormant prize integrity. Existing 22 baseline migration files are unchanged. Replay uses disposable synthetic PGlite/PostgreSQL, never a remote DSN.

Focused coverage includes assigned/unassigned/guessed/cross-org/revoked/expired access; independent administrator scope; no People/answers; Bessemer old/future row preservation; reviewed Person and portal revocation; progress gaps/completion; filters/summaries/CSV; conditional prerequisites/due/reassignment/reopen; document Storage policy/version/visibility; training; readiness/revision and malformed inputs. Real PostgreSQL tests race 16 number requests, 16 cross-pool selections and 12 claims, proving one number, one reservation and one win. Existing gateway concurrency/regressions are retained.

Local results on 2026-10-06: full 14-script backend command passed, including 102 campaign checks, 23 dormant prize-integrity checks and 18 campaign DOM checks. Four campaign race groups and four existing gateway race groups passed in real disposable PostgreSQL. Existing Christmas Dinner regression passed all 94 checks, using the same declared jsdom 26.1.0 installation already available to backend tests. JavaScript syntax and diff checks passed. No remote database or production configuration was involved.

The manifest adds only the new staff shell/CSS/JS. Docs, migrations, fixtures, source packets and private audit evidence are excluded from `dist/`. Existing public files remain byte-for-byte intact. Chrome local synthetic screens are checked at 1440, 768 and 390px; those screenshots are visual evidence, not hosted database/Storage/mailbox acceptance.

Required next gate: Chat reviews Phase A and authorizes a specifically named isolated acceptance database baseline, only the three candidate migrations and exact synthetic campaign assignments. Reconcile that environment's history first; do not replay already-applied historical migrations or apply unrelated PR #2 work. Then Work validates real authenticated campaign access/revocation, document upload/download, Bessemer bridge/progress/CSV, and phone/tablet visuals. Any new exact Auth callback needs separate authorization; no wildcards or production changes. Production deployment/merge/grants require a later explicit release decision.

Recommended next implementation after Phase A acceptance: Phase B native outreach team signup, reviewed official-participant approval, travel/family/vehicles/lodging/manifests. Preserve the distinction between official team/transport approval and independently traveling helpers. Do not start it under this assignment.

## Phase C build extension

Chat accepted Phase A/B and authorized dependent native event registration, household waiver/signature and check-in. Those former roadmap entries now have a local implementation candidate; see [Phase C contract](OUTREACH-PHASE-C-REGISTRATION-CHECKIN.md). Phase D drawing and live rollout remain separate gates. Bessemer decisions and canonical reviewed identity remain existing workflows.
