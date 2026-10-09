# Outreach Campaign Phase F — pre-event automation build candidate

## Scope and release state

Phase F starts from accepted Phase E commit `f41ab24dc256145fa37b9516c1aae2ef7a602a37` on dependent branch `codex/outreach-phase-f-pre-event-automation`, targeting `codex/outreach-phase-e-event-day`. It completes the reusable campaign front half rather than creating a city CRM, separate checklist, document portal or LMS.

Migration `20261008134746_outreach_phase_f_pre_event_automation.sql` is additive and tested locally only. No Phase F migration, Edge Function, Storage configuration, grant, Auth callback, channel activation or provider has been applied to acceptance or production. Passing build tests does not authorize hosted acceptance, a merge or release. Phase G is NOT STARTED.

Production main stays `e1f75f917f9a1e6e16e0b8f9bc5d7b52fbf0a424`. Bessemer stays postponed/inactive, Huntsville stays unpublished, PR #10 stays parked, and the prerequisite draft PRs remain unmerged. No historical campaign workflow snapshot is upgraded automatically.

## Opportunity lifecycle and reviewed identity

Public interest and manual leadership creation converge on `outreach_opportunities`. Stages are new, contacted, reviewing, tentative, approved, future, declined and converted; owner, next action, target month, notes and disposition reason are retained. Existing approval metadata/history remains authoritative. Future/declined require a reason; approved/converted cannot be forged through ordinary opportunity edits.

`outreach-interest.html?brand=sowgo` and `?brand=champion-life` use the dedicated `outreach-interest-submit` gateway. The trusted disabled-by-default channel supplies organization/source website, never a browser-supplied owner. Required church/pastor/submitter/contact/location/month information is bounded and validated. Source time is server-owned. Submission creates no campaign, Person, account or authority.

The gateway requires exact HTTPS origins, Turnstile hostname/action verification, a trusted network fingerprint, bounded JSON/body time and a honeypot. Network and normalized contact rate keys are HMAC values rather than raw IP/contact logs. Exact request-key retries are idempotent; changed retries reject. Dummy Turnstile handling is restricted to the existing acceptance project/mode. Public roles cannot call the service-only database intake RPC directly. No channel is activated by this build. Later public Edge deployment must use the established no-JWT-verification gateway contract (the public caller carries no user JWT); exact-origin/Turnstile/service-only database checks remain mandatory. Such deployment is not performed here.

Explicit authorized conversion locks the opportunity, requires a reviewed host decision, uses an existing owner-reviewed host Organization or a deliberately confirmed new canonical church, and creates one campaign. It never matches/merges People or churches from email similarity. A host profile is reusable across campaigns under the owning organization. Coordinator must be active staff. Conversion snapshots a published native workflow, records source/history, and prepares welcome/agreement hooks without sending messages or granting access.

## Host portal and contacts

`staff-outreach-pre-event.html` supplies internal campaign and opportunity views; `outreach-host.html?campaign=<id>` supplies the assigned host's reduced projection. Both use the established staff branding and Auth client. `preevent.view/manage` and `host.view/respond` are independent current campaign capabilities; manage/respond require their view counterpart. Host labels and contact assignment alone confer no authority.

Host context includes visible/assigned tasks, agreement, requested host documents, own training, event information, resources, permitted coordination contacts and sanitized packet. It omits internal events/reminders/settings/assignments, internal tasks, lodging, manifests, broad People, finance and administration. Follow-up still requires the existing separate authority. Contacts reuse reviewed canonical People through the existing contact action, which retains its People authorization checks; call/text/email actions are manual.

After current agreement approval, host.respond may submit a bounded subset of event/venue, flyer, procurement and access information. It cannot change event date, agreement version, training policy, staff authority, final personnel/inventory approval or internal configuration. Explicit host account assignment is an existing guarded administrative action, not an automatic consequence of inquiry or conversion. The welcome task and portal link prepare access; provider delivery remains pending/manual.

## Versioned workflow and agreement

The immutable global `outreach_source_workflow` version 2 has 18 configurable source-informed steps: host setup, welcome, agreement/pre-checklist, procurement, production packet, training, event details, venue, permits, insurance, flyers, registration/QR, team/travel, personnel/inventory, final packet, final readiness, event day and post-event follow-up. Existing template versions/campaign snapshots remain intact.

Definitions carry category, order, instructions, role/assignee, active/required, relative due date, dependencies/conditions, required fields/documents/form/signature, approval/completion rule, visibility, reconfirmation, reminder offsets and escalation roles. New published versions do not rewrite previous snapshots. The native completion rules cannot be bypassed through legacy workspace entry points. Workflow steps are the task records, not a second disconnected task table: assignee, priority, comments, completion, reopen and audit reuse them.

Native agreement versions preserve reviewed text, exact configurable field schema/source and creator/time. Campaign submissions retain an immutable version/text/answers/signature-name/acknowledgment/actor/time snapshot. Only review state/history changes. Submit retries cannot alter signed responses. Current-version approved agreement gates configured downstream tasks; changing the configured version requires reconfirmation without rewriting old signatures. Typed-name acknowledgment is not a claim of notarized or verified legal identity.

Exact JotForm agreement source questions, wording/options/conditions/requiredness/validation and real legal text remain pending mapping. No guessed agreement or real template is seeded. Synthetic test text verifies architecture only; source mapping is a gate for real campaign activation.

## Conditional production and promotion

Flyers false makes the configured flyer task not applicable; true surfaces the resource/design/status workflow. Bikes/tablets use independent enabled flags, quantities and host versus Champion Life/SowGo procurement responsibility. Champion Life/SowGo responsibility generates a held cost-impact hook and coordinator procurement task comment, with unknown cost/resolution pending. No accounting/payment engine is added. Canonical inputs and task completion preserve responsibility and resolution history; transportation/inventory readiness remains downstream.

Flyer configuration records requested/design selection, details/QR pending, approval and delivered/downloaded operational state. Versioned available resources can reference an approved private document or safe HTTPS resource. The campaign-specific registration URL/site/start produces a QR-generation request hook; it does not change the universal SowGo `/go` destination or claim that an external asset was generated.

The existing production packet is supported as a private versioned resource, with assigned/read/training acknowledgment. Original Word source remains in the private requirements workspace. It contains an older bike-winner/tablet rule superseded by the permanent Phase D one-prize-total rule, so a reviewed current packet must be published before real use; no contradictory source copy is publicly seeded.

## Documents and training

Document requests retain title, flexible category, recipient, instructions, due date, status, immutable path/version/replacement history, creator/reviewer/time, expiry and visibility. Categories include agreement, site layout, venue, permits, insurance, lodging, parking, flyer, production/event packet, personnel/inventory, media and other; the schema does not freeze the category list.

Visibility is internal, host_church, campaign_team, public_resource or restricted; even public_resource uses authorized private Storage. Upload/read requires the exact prescribed private path and live campaign permission. No arbitrary path, overwrite, delete or enumeration is granted. Upload completion checks actual Storage metadata. File limits remain 10 MB and allowed MIME types. Review uses an optimistic revision under campaign serialization, yielding one winner for conflicting approvals. Expired required documents block readiness.

Permits/insurance track unknown/yes/no requirement, request/submission/review, document/owner/due/expiry. Unknown is an explicit blocker. Parking/semi/box-truck/bus-RV confirmations, load-in notes, map, international address, event start/end/registration/setup and IANA timezone are canonical campaign inputs. Source defaults use approximately 30-day information/document deadlines and a 14-day final packet target; published definitions/campaign settings make timing configurable.

Training reuses versioned campaign resources and existing assignments: role/account, assigned/viewed/completed, timestamps and required flag. The existing playlist is available as a source reference. A host can update only own assigned training with response authority. Required versus warning-only policy is explicit campaign configuration; required incomplete training blocks final readiness. This is acknowledgment tracking, not a duplicate LMS or playback verification.

## Reminders, escalation, staleness and schedule changes

Reminder rows refer to the existing step. Configurable offsets create upcoming, due, overdue, repeated-overdue and escalation manual actions. Default source offsets are 14/7/3/1/0 days before plus 1/7 days overdue; escalation roles/delays are template data. Due hooks are idempotent and held; no fake sent/delivered state. A guarded refresh materializes scheduled actions; no new scheduler/provider deployment occurs in this build. Manual acknowledgment is audited.

Expired approved documents and completed steps needing reconfirmation generate stale hooks. Event/registration/end/setup timeline or venue changes preserve completed history, recalculate relative due dates, mark configured completed steps for reconfirmation, supersede outdated pending reminders and invalidate current packet readiness. Reconfirmation blocks dependency progress until explicit current review. Final personnel/inventory flags must be true, not merely present fields.

Postponement/cancellation retain campaign data and registrations, supersede pending reminders and block packet readiness. Reschedule records reason/date history, restores scheduling and recomputes due work. Weather is a reason/event hook, not a monitoring engine. Legacy scheduled/preparing/rescheduled/postponed/cancelled/closed/completed states coexist without rewriting historical campaign data.

## Dashboards and canonical event packet

Campaign home presents countdown, visible workflow progress, agreement, documents/training, event/registration readiness, team/Event Day summaries, blockers and deadlines. Host home is simplified. Internal home includes opportunities, responsible coordinator, cost hooks and readiness. Multi-campaign filters cover year, country, region, status, coordinator, host, readiness, overdue and upcoming, supporting many cities/countries rather than a city schema.

Packet preview is built from canonical campaign/host/location/timeline/registration, approved document references, permits/insurance, contacts and production notes, plus existing Phase E personnel/inventory and Phase B meetup/travel/lodging data. An external host packet omits internal personnel/inventory/travel/lodging. Packet generation requires readiness, serializes by campaign, and creates one immutable version per generation key. Date/config changes make earlier snapshots historical rather than overwriting them. Preview, generated time/version, current/historical state and private print fallback are native; no external document editor is required. Print-to-PDF uses the browser, not a deployed PDF service.

## Security and verification

New relations have RLS and deny raw anonymous/authenticated table access. Narrow authenticated invoker workspaces delegate to guarded private helpers with empty search paths; renamed legacy helpers are revoked. Every action rechecks verified identity, active/effective/expiry assignment, campaign ownership and exact capabilities. UI clears protected state on denial/sign-out and discards stale asynchronous responses. No user-editable Auth metadata grants access.

Local verification: full 26-script backend/DOM regression command; 69 Phase F database/security, 30 interest gateway and 35 DOM checks; all 94 Christmas checks; allowlist build (412 files), JavaScript syntax and whitespace. Local disconnected Chrome renders cover 13 screens at each of 390/768/1440 (39 combinations), without overflow or page errors. This is synthetic rendering, not hosted operational acceptance.

Six real disposable PostgreSQL races each use 8 independent worker backends plus a separate coordinator, a server barrier and server-timestamp intervals. All eight function calls are active concurrently before lock release. Duplicate conversion/agreement/task/packet actions yield one canonical result/history; document conflict yields 1 success/7 safe conflicts; reschedule/reminder competition leaves current due dates and unique pending reminders. No serialized requests are counted as concurrency. Local fixtures/cluster are discarded without touching other databases. The existing isolation CI workflow includes the dependent Phase E base/Phase F branch and the new six-race command.

## Remaining gates and Phase G boundary

Next: Chat Phase F build review, then a separately authorized acceptance-only migration/Edge/Storage/configuration and hosted browser/race assignment. Work source capture/Chat wording-policy approval is needed before activating the real agreement/pre-checklist or replacing existing JotForms. Approved current production-packet publication is also pending. Huntsville is schema/configuration-ready, unpublished; Bessemer/parked PR #10 stay unchanged.

Phase G may later integrate Communications Core, real transactional email/SMS, templates and delivery logs. No such work, production rollout or new package begins here.
