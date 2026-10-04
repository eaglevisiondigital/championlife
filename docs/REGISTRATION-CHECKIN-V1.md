# Registration + Check-in v1

Implemented September 29, 2026 from development HEAD `17c646cdcae2d10a47273c6a727d72e4cbbc9603`. This is an acceptance-validated development module, not a production release. The explicit Registration assignment authorizes this package only. Communications, general Forms, Giving, volunteer scheduling and secure child pickup are not built here.

## Reuse and ownership

Global Propel owns the reusable registration, registrant/attendee, question/answer, capacity, attendance/check-in, permission/audit and payment-reference concepts. Champion Life is the first tenant and supplies event configuration, branding, questions and actual records. Existing organizations/departments, event_series/event_occurrences/effective schedule, organization_people/private human anchors, reviewed portal_account_links, staff grants and giving_destinations are reused. No separate event model, global email identity, .NET migration, cross-product database merger or merchant change is introduced.

## Database and API

Forward migration: `20260929131021_registration_checkin_v1.sql`. Seven new public tables:

| Table | Purpose |
| --- | --- |
| event_registration_settings | Event enablement, enrollment scope, max attendees, next steps, revision |
| event_registration_questions | Bounded field definitions, scope, sensitivity, order, active state |
| event_registrations | Registrant snapshot, optional person/account link, scope, lifecycle, payment hooks, idempotency |
| event_registration_attendees | Named individual participants and optional tenant People/future guardian link |
| event_registration_answers | Registrant/attendee values with restricted snapshot and revision |
| event_attendance | Unique attendee/occurrence participation, staff/time/method/note and reversal |
| registration_audit | Actor, meaningful action, event/registration, timestamp and non-answer metadata |

All seven have RLS and no direct anon/authenticated table grants or policies. Ten functions are added: public/private registration_public and registrations_workspace, plus six owner-only validation/identity/capacity/confirmation helpers. The existing canonical permission function is extended. Public wrappers are SECURITY INVOKER; private guarded endpoints are SECURITY DEFINER with empty fixed search_path and fully qualified references. Only the constrained registration_public endpoint adds anonymous private execution; helpers remain denied.

Public `registration_public(org_slug, action, data)` allows `form` and `submit`. Form returns safe event/configuration/available capacity and active question definitions, never existing answers. Submit accepts only explicit registration fields and returns a safe confirmation. There is no public registration search, reference lookup, attendee roster or audit endpoint.

Staff `registrations_workspace(org_uuid, action, data)` supports events, context, settings, question, list, detail, walk_in, check_in, undo, status, edit, link_person, answer, add_attendee and remove_attendee. Server authorization applies on every call, independently of UI controls. Lists use 50+1 pagination and name/phone/reference/status filtering. Event selection uses 100+1 pagination. Context bounds occurrence results to 400; RPC from/to parameters support historical/expanded schedule access, while the v1 selector uses the default recent/forward window. Detail audit history is bounded to the latest 100 actions; database audit remains durable.

## Identity, enrollment and lifecycle

Registrant means the person completing the form; attendee means an individual participating; Person means a tenant contact; portal account means an optional authenticated login. Guests need no portal account. Public registration requires first/last name and email or phone for the registrant, while each attendee needs only first/last name. A parent can register children without making each child an account or contact. The registrant may also be explicitly marked as an attendee.

Guest submissions remain unlinked snapshots. An active verified nonanonymous account with a reviewed tenant portal link can link the registrant and explicitly self-identified attendee to its contact. Other attendees stay independent. Email/phone equality never automatically merges records. Staff can review People and explicitly link a same-tenant accessible contact; the current UI takes the reviewed person UUID rather than doing an unsafe automatic match. Uncertain duplicates need human reconciliation.

Each event chooses occurrence or whole-series enrollment. Once any registration exists, including cancelled records, scope cannot change. Occurrence enrollment references a matching event occurrence; series enrollment has no occurrence FK and can be checked in separately at each eligible occurrence. Existing none/external/native_future modes remain; actual `native` is added. Choose Native in the event editor, then enable/configure enrollment in the Registration workspace.

States: pending, confirmed, cancelled, expired, waitlisted_future. Public successful free signup confirms immediately. Staff can move supported active/cancelled/expired states with a revision check. No queue, automatic waitlist placement, pending expiration worker or self-service cancellation is included. Status changes do not change payment status. Active attendance must be reversed before leaving confirmed status.

## Capacity and concurrency

Capacity is attendee count, never registration count. Null capacity is unlimited. Pending/confirmed attendees occupy places; cancelled/expired/future waitlisted records do not. Occurrence enrollment uses an independent bucket for each date. Series enrollment uses one shared series bucket for all enrolled attendees, regardless of which dates they later attend. Available places are clamped at zero. Lowering event capacity does not evict existing enrollments; it blocks further additions until places are available.

Every registration operation shares the existing Events per-organization transaction advisory lock, followed by row locks and optimistic revisions. This prevents simultaneous last-slot overbooking and coordinates event cancellation/editing with enrollment and check-in. New/reinstated enrollment and attendee additions check capacity in the same transaction. Override is available only with registrations.manage plus registrations.override, an explicit override request and a reason of at least five characters; it is audited. Public callers cannot override capacity.

A UUID request key is unique within an organization. The server stores a SHA-256 hash of canonical JSONB input and rejects key reuse with changed data or account identity. An exact retry returns the original safe confirmation. Opaque R- references contain random UUID entropy and do not grant lookup rights. Public UI freezes its submitted payload/key in memory for retry after ambiguous failure; it does not persist sensitive answers in browser storage. Reload discards the draft rather than promising recovery. Future charging must extend this same request chain rather than charge on a provider-return page.

## Questions and privacy

Ten types: short text, long text, email, phone, number, select, multi-select, yes/no, checkbox/consent and date. Definitions include label/help, required, order, active, registrant/attendee scope and general/restricted classification. Required consent must be checked. Both browser controls and SQL validate values, options and bounds. Maximum 60 question definitions per event, 30 choices, 30 attendees per signup (configurable default 10), 100 KB public submission, 500-character short text, 8,000-character long text, finite bounded numbers and safe 1900–2100 dates.

The public form exposes the question's intended prompt/options; submitted answers are never in confirmations or subsequent public reads. No answers appear in broad staff lists. Check-in-only staff see no answers, including general ones. Restricted answers require registration read/manage permission AND registrations.restricted for this event department. Editing also requires manage and the separate restricted permission when appropriate. Answer values do not enter audit metadata or browser persistence.

Once answers exist, a definition's kind, scope, sensitivity and choices cannot be reinterpreted; deactivate it and create a replacement. Existing restricted snapshots stay protected. Future Forms can absorb these bounded definitions/values without building another identity system. This is not a global drag-and-drop Forms engine or a claim of verified legal/medical consent.

## Permissions

| Capability | Scope and behavior |
| --- | --- |
| registrations.view | Read scoped lists/details and general answers |
| registrations.manage | Manage scoped settings/questions, records, answers, attendees and lifecycle |
| checkin.view | Read scoped roster/attendance; no response values |
| checkin.manage | Individual/group check-in and authorized reversal |
| registrations.restricted | Additional permission to view/edit restricted answers with registration authority |
| registrations.override | Additional permission for explicitly reasoned capacity overrides |

The last four are newly added keys; no grants are seeded. Existing People/Staff organization-or-department authorization, verified identity and active assignment/grant rules remain authoritative. An explicitly scoped Youth grant cannot operate on Kids, All Church or another organization. Staff titles, attendance, enrollment and portal membership grant no authority. Settings and permission UI visibility are conveniences, not authorization boundaries. Stale editor/revision changes and late auth/tenant responses are rejected or cleared.

## Check-in, walk-ins and durable attendance

Staff selects event and occurrence, searches registrant/attendee names, phone or reference, then checks in an individual or group. Only confirmed registrations can check in. Series enrollment still checks the selected occurrence belongs to the event and is retained/not cancelled. Cancelled/archived events reject enrollment/check-in. A unique attendee/occurrence row prevents duplicates. Attendance records actor, timestamp, method and optional note. Reversal retains that row and records actor/time; recheck updates current state while immutable audit records preserve transitions.

Registration alone creates no attendance. A registration with attendance cannot be cancelled until active participation is reversed. Staff may add separately named attendees with validated answers and capacity checks. Removal is permitted only before any attendance history exists and while at least one attendee remains. Removed pre-attendance answer rows are deleted, with an opaque attendee-ID audit entry. There is no broad registration/attendance delete endpoint.

Walk-in requires registrations.manage and checkin.manage, minimum first/last name and optional email/phone. It creates a confirmed walk-in-origin registration and immediate attendance. It explicitly links a reviewed contact accessible through People permissions, or creates one only with separate organization-wide people.read and people.create authority. Possible existing name/email/phone matches stop contact creation for manual review. No staff grant or portal account is created. V1 entry adds one walk-in at a time; additional attendees can be added in registration detail and checked in. Series-configured walk-ins enroll in the whole series; the UI states this before submission.

Nullable person/guardian linkage leaves room for future household/pickup work. No verified guardianship, security code, pickup authorization, room assignment, label printing or child-safety guarantee is implemented. Restricted question storage is not a secure-pickup system.

## Payment and communications boundary

Separate payment states are not_required, pending, authorized, paid, failed, refunded and partially_refunded_future. Stored intent reference and same-organization giving_destination FK are server-owned hooks. Public and staff enrollment reject payment-required events because this package has no safe active processor flow. Browser payloads cannot mark paid or select destinations. No charge/refund, payment token, ticketing or merchant connection is built. Champion Life/SowGo destinations and all giving links are unchanged; routing is never inferred from the frontend hostname.

Confirmation shows reference, event, date/scope, attendees and configured next steps. It explicitly does not promise email or SMS. Future Communications can use tenant/contact/event/status/audit references for confirmations/reminders/cancellations. Consent remains explicit question data, not a broad messaging opt-in. Text-to-Give must reuse tenant People/mobile/payment routing boundaries under its own authorization; no provider-specific messaging or giving code is included.

## Screens and validation

`event-register.html` provides contact → attendees → questions/consents → confirmation, including clear closed/full/payment-unavailable states. Events list/detail links lead to native signup, including each upcoming occurrence. External registration remains intact. `staff-registrations.html` provides scoped event/date selection, totals, search/status filters, detail, lifecycle, settings/questions, attendee changes, check-in and walk-in. Existing People and Events workspaces link to it. Styling extends this project's existing palette/layout rather than copying competitor screens.

Validation completed:

- Full standard regression: 31 scripts via `npm test --prefix tools/backend-tests`, including migration parity, site artifact/redirect behavior, prior modules and JS syntax.
- Registration SQL: 74 focused checks plus 17 rollback assertions; DOM tests cover public steps/retry/confirmation, staff detail/configuration/check-in/walk-in, permissions and stale/auth response clearing.
- Optional native PostgreSQL 17 test: `npm run test:registration:concurrency --prefix tools/backend-tests` with initdb/pg_ctl/psql on PATH. It creates/stops its own disposable Unix-socket cluster, replays the complete chain and runs independent-session final-slot, exact-replay and cancellation/check-in races. No remote connection parameters are accepted.
- Acceptance bkbmjisprwmkptywtmih: only the new forward migration applied; MD5 `5982c6e0d67725310a72c33e6607ab79` matches local bytes. All 17 rollback assertions passed; 20 migrations, 49 public RLS tables, 60 policies, 62 functions. Hosted ACL/search-path checks passed. Two pre-existing Auth users remain; zero contacts/grants/events/registrations/attendance after rollback. No reset/history replay.
- Actual browser against isolated local SQL with synthetic identity adapter: guest two-attendee signup, confirmation, group check-in, individual reversal, contact-optional walk-in, desktop/mobile sanity, no console warnings/errors. Mobile 390px viewport has no horizontal overflow. Browser evidence stays in the private outer audit workspace, outside the website build.

Native independent-session concurrency was tested locally, not through hosted browser sessions. Local PGlite/browser adapters do not prove Supabase Auth delivery, real-account sessions or deployed end-to-end behavior. Hosted real-account/browser acceptance remains a release gate. Acceptance advisor has 19 expected INFO no-policy notices and one unchanged leaked-password protection WARN; see SECURITY_MODEL.md. Production data/schema/Auth, main deployment, giving, merchants and DNS were untouched. PR #2 remains draft/unmerged; Chat review precedes subsequent module expansion.
