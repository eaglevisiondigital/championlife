# November18 status: drafts remain inert; separate delivery candidate exists

The nine templates and pure preparation helper below remain unchanged, unapproved and non-sendable. Issue159 separately authorized the additive default-disabled delivery implementation described in [OUTREACH-TEAM-NOTICE-DELIVERY.md](OUTREACH-TEAM-NOTICE-DELIVERY.md). It does not import/approve these drafts or infer recipient/consent/sender policy. No status message is authorized or sent. The historical preparation-only architecture below describes this helper package, not the subsequently implemented separate delivery system.

# P1 status notification preparation — review only

Status: **INERT LOCAL PREPARATION. NO SEND AUTHORITY OR ACTIVATION.** Based on reviewed PR162 head `1b99a3eb7ae3d38ed8e9890fe63f30739f6aa3cb`, reconciled onto live P0 source `90657158d2c0d115d98b17c7be664f455b4b2cd0`. This package changes no application/Edge runtime, database schema/function, staff/participant UI, provider configuration, public artifact or P0 confirmation behavior. No provider call, account, grant, message or hosted action occurs.

## Architecture and boundaries

`tools/outreach-team-notifications/catalog.mjs` contains nine proposed plaintext templates. `drafts.mjs` exposes only `prepareTeamNoticeDraft` and its validation error type. It accepts explicitly supplied event/member/state/revision observations and returns a deeply frozen review object. It performs no authorization or fresh database check and cannot persist, queue or deliver anything. It is not imported by browser, Supabase Edge or Netlify runtime. There is no HTTP endpoint, worker, schedule, environment toggle or enabled setting.

Every returned object has `state: held_for_policy_review`, `sendable: false`, `recipient: null`, `sender: null`, `delivery_channel: null`, `persistence: none`, `authorization: not_checked` and `freshness: not_revalidated`. Activation, recipient and sender input fields are rejected. A review key identifies a proposed template/snapshot/revision; it is **not** a provider idempotency key, delivery authorization or outbox task. Preparation never claims a message was queued, sent, accepted or delivered.

No durable draft/outbox table is justified for this preparation package: recipient/channel/consent/suppression/approval/timing/recovery policy remains unresolved, and no status message is authorized. Adding database rows or triggers now would expand the reviewed P1 schema/permissions and create ambiguous work for a future sender. This is not a decision against a future approved transactional outbox. That belongs to a separately reviewed delivery implementation once its policy and authority are concrete.

The live P0 `outreach-volunteer-submit` handler, frozen receipt payload, deterministic provider key, private confirmation outbox/lease/retry controls and installed initial+forward SQL remain byte-for-byte unchanged. P0 application-received acknowledgements are deliberately absent from this catalog. No marketing/subscription content or inferred recipient is introduced. The parent separately owns the P1 SQL guard reconciliation; this package does not edit or couple tests to its exact SQL hash.

## Preparation guards

- Event and organization UUIDs must explicitly agree with the participant; assignment/member/leg/event UUIDs must agree for travel proposals. No event/recipient guessing or identity lookup occurs.
- Required expected participant/assignment/leg revisions must match the supplied snapshot. This detects internally stale review selection; it does not prove database freshness. No timestamp-based send policy or expiry is invented.
- Team proposals must match the current effective state. Source cancellation/nonselection/waitlist takes precedence as in the reviewed participant UI; it cannot produce stale approval copy. The policy selecting which P0/P1 transitions should notify anyone remains open.
- Approval does not imply a seat or itinerary; a reserved seat remains unconfirmed; cancellation does not imply a replacement or invent the cancelling actor.
- Confirmed-itinerary copy requires approved/currently eligible participation, a matching confirmed assignment, a confirmed leg, explicit server validity and known timestamp/locations. Missing/unknown timing, invalidated confirmation, stale revisions, source cancellation or cross-event/person records reject preparation. Confirmation applies only to one travel leg.
- Travel review copy cannot be produced for a currently valid confirmation; seat cancellation copy requires a cancelled reservation. Current confirmation evidence conflicting with the supplied state is rejected.
- Event/leg labels are bounded single-line text. Private review notes, Person/contact/email fields and unknown properties are rejected. Address/time inputs used as confirmation evidence are not retained in the draft or copied into messages; only known/unknown proof flags remain. Templates expose no passenger manifest, other people's contacts, private review reasons, unpublished portal URL or invented itinerary.

Snapshot inputs are caller-supplied review facts, **not trusted authorization**. A future sender must obtain authoritative current facts within an approved authorization/transaction boundary and revalidate immediately before permitted delivery. Passing true booleans or matching revisions to this pure function never authorizes sending.

## Review object example

```js
import {prepareTeamNoticeDraft} from '../tools/outreach-team-notifications/drafts.mjs';

const draft = prepareTeamNoticeDraft({
  kind: 'team_approved',
  observed_at: '2026-11-17T23:00:00Z',
  campaign: {
    id: '22222222-2222-4222-8222-222222222222',
    organization_id: '11111111-1111-4111-8111-111111111111',
    name: 'Synthetic outreach'
  },
  member: {
    id: '33333333-3333-4333-8333-333333333333',
    campaign_id: '22222222-2222-4222-8222-222222222222',
    organization_id: '11111111-1111-4111-8111-111111111111',
    status: 'approved', source_application_status: 'pending',
    revision: 5, travel_ready: false
  },
  expected: {member_revision: 5}
});
// draft.sendable === false; recipient/sender/channel remain null.
// draft.content is proposed plaintext for review, not a provider payload.
```

## Validation and limits

`node tools/backend-tests/outreach-team-notifications.test.mjs` runs synthetic preparation checks for every proposal, matching and stale states/revisions, cross-organization/event/person/leg input, source precedence, unknown travel times/locations, private-data/header injection, immutable held state, rejected activation/recipient overrides and deterministic review keys. The complete preparation graph is also executed with network, timer and secret access blocked, proving zero use. Runtime-import and public-artifact checks prove no activation hook. Existing P0/P1 regression checks and the unchanged426-file public build are separate preservation evidence.

These are local pure-module checks. They do not establish message-copy approval, recipient verification, consent/suppression rules, provider delivery, hosted acceptance or activation. No new database or native concurrency test is needed because this package changes no persistence or operational mutation.

## Proposed Resend delivery and outcome integration — unimplemented

This section prepares a technical review for a future authorized delivery package. **Only the catalog and pure held-review builder exist today.** There is no persistent P1 intent/outbox, delivery worker, provider idempotency integration, receipt ingestion or staff outcome report. The119 preparation checks prove none of those delivery capabilities. No setting, provider call, credential change, recipient selection or status-message activation is introduced here.

### Separate immutable intent and durable duplicate protection

A future P1 implementation should adapt P0's frozen-payload, deterministic-key, row-lock/lease and guarded-result pattern into a **separate private P1 outbox**. It must not insert status notices into the existing application-received outbox or change its payload, key, worker or contract. P0 currently holds attempts after its23-hour retry boundary for provider review; this is useful recovery precedent, not an approved P1 retry/timing policy.

An approved intent would bind an immutable intent UUID and logical business event to organization, campaign, participant, notice kind, authoritative source change/revision, explicitly approved recipient identity/contact/channel, sender/reply-to, template version, policy version, exact rendered provider payload and its digest. Recipient verification and authorization evidence must be recorded without embedding secrets or private review content. A changed recipient or payload cannot reuse that intent's provider key. Template or policy version changes must not silently manufacture another send for the same business event; any replacement/resend needs separately approved intent semantics.

Two database constraints are needed: one durable uniqueness rule for the approved logical intent, and one for its provider key. Producers racing on the same event must resolve to the same recorded intent. A dedupe record/tombstone must survive beyond the provider window and any permitted retry/replay period; privacy/retention rules and the exact logical-event key remain decisions before schema implementation. Deleting an outbox row must not silently reopen permission to deliver its old intent. The current `review_key` is a preparation fingerprint only and cannot supply this persistence or delivery guarantee.

Resend documents retry deduplication for the same key and payload within24 hours, and retains keys for24 hours. A future stable key such as `outreach-team-v1/<intent_uuid>` would therefore be bound to one frozen request; local durable uniqueness is still needed after that provider window expires. A worker must never rotate the key or issue a new intent merely because a timeout occurred or24 hours elapsed. [Resend engineering details](https://resend.com/blog/engineering-idempotency-keys), [Resend idempotency release](https://resend.com/changelog/idempotency-keys).

### Claim, authorization and ambiguous results

Future preparation/authorization/claim operations must use authoritative database state and current permission checks, not the booleans supplied to this pure helper. They must recheck approved actor authority, recipient binding/verification, consent/suppression rules and current canonical links at each approved boundary and immediately before a provider attempt. Member/source precedence, availability/age/guardian review, assignment and leg revisions, driver qualification, same-vehicle guardian and complete current-confirmation validity must still support the selected copy. Expired/revoked staff, changed recipients, stale/invalidated trips or missing policy must leave work held or superseded, without sending an obsolete approval or travel confirmation. Existing Team permissions and P0's sending domain/key imply no status-message authority.

Intent creation and claim should be atomic database operations with unique constraints, bounded leases and compare-and-set result recording. A stale worker cannot overwrite a newer lease/result. Commit the claim before networking; do not hold the campaign capacity lock across a provider call. Record attempt start and stable payload/key before the request so a crash cannot erase knowledge that sending may have begun.

There is no transaction spanning PostgreSQL and Resend. Timeout/disconnect, process death after provider acceptance, failed local result persistence, or an uncertain response must enter reconciliation hold. A changed-payload/key conflict is an integrity failure requiring review. No failure path may label an ambiguous attempt definitely unsent or create a fresh key to bypass deduplication. Any permitted retry must retain the same intent/key/payload and satisfy approved freshness, lease and provider-window rules. Once the dedupe window is uncertain/expired, reconcile with authorized provider evidence before any separately approved next action. A provider POST already in flight cannot be atomically revoked or recalled; record this boundary, stop subsequent attempts when authority/state changes, and never promise exactly-once delivery or unsending.

### Accepted, delivered and negative outcomes

Future reporting should keep local work state separate from provider outcomes:

| Evidence | Permitted meaning |
| --- | --- |
| Held/authorized/leased local intent | Preparation or attempt state only; no provider acceptance claim. |
| Valid successful send response bound to this intent's provider email ID | Provider accepted the request; delivery remains unproven. |
| Verified `email.delivered` receipt | Delivered to the recipient's mail server; not proof that the person read it. |
| Verified delayed, failed, bounced, complained or suppressed receipt | Preserve that specific outcome and its time; no generic success label or automatic fresh send. |
| Ambiguous response or conflicting/unmatched evidence | Reconciliation required; no inferred delivery or retry authority. |

Resend distinguishes successful API requests (`email.sent`) from recipient-mail-server delivery, and supplies separate failure/delay/bounce/complaint/suppression events. Opening/click tracking must not become attendance, identity verification or travel confirmation evidence. [Resend event meanings](https://resend.com/docs/webhooks/event-types).

A future webhook endpoint must verify the signature and timestamp against the raw request body with the correct environment's signing secret **before** parsing/trusting an outcome; Resend's SDK supports this verification. Then dedupe receipt IDs durably and bind account/environment/provider email ID to the recorded intent. Preserve received/provider times and append-only redacted evidence; out-of-order, duplicate or conflicting events cannot erase a negative outcome or turn an unrelated email into this intent's success. Receipt data must never grant access, change a person's team/travel status or trigger an unapproved message. [Resend webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests).

Authorized reconciliation could retrieve the specific recorded provider email ID using `GET /emails/:email_id` and retain only necessary receipt fields and a redacted evidence reference. GET can report `last_event`; it does not replace durable local intent history. The existing P0 sending-only credential cannot retrieve emails: that requires separately authorized provider read access, which this package neither requests nor configures. An authorized dashboard receipt may support manual reconciliation, with the same intent binding and audit requirements. Unknown provider IDs or unavailable evidence remain held. [Retrieve sent email](https://resend.com/docs/api-reference/emails/retrieve-email), [Resend key permission scopes](https://resend.com/docs/api-reference/api-keys/create-api-key).

### Scoped reporting, inactive default and future proof

A future report should expose event-scoped counts and authorized per-intent state/timestamps, notice/version, attempt count and redacted outcome/reconciliation reason. Separate report authority is still undecided. Do not expose raw provider responses, bodies, recipient lists, keys/tokens, webhook secrets, private reviews, passenger manifests or another person's IDs. Enforce current organization/campaign permissions on every read/export and clear late responses after revocation as existing P1 views do. Provider-dashboard access is independent authority.

Any future worker/channel must default inactive and fail closed when approval, current authority, approved recipient binding, immutable payload, configuration or receipt verification is missing. No trigger, schedule or enabled setting is prepared now. Before release, meaningful independent-connection tests must cover duplicate producers/workers and stale leases; replay beyond24 hours; accepted-response/persistence crashes and timeouts; expiry/revocation or recipient/itinerary drift after claim; invalid/replayed/out-of-order/wrong-email receipts and unavailable GET evidence; scoped redacted reporting; and unchanged P0 receipt behavior. Real provider delivery/outcome acceptance needs separate explicit authorization and approved test recipients. These tests and the delivery implementation remain unimplemented; exact copy, recipient/consent, transition/timing, sender, duties and retention decisions below remain open.

## Decisions required before delivery implementation

1. Which of the nine proposed notice types, if any, are approved? Approve exact copy and status-authority rules, including precedence between intake review and Team decisions. The existing P0 receipt remains independently authorized.
2. Who may prepare, approve and release each message? Choose explicit event-scoped duties, independent review requirements and whether any future automation is allowed. Current Team/Travel permissions are not notification-send grants.
3. Which recipient identity/contact/channel is permitted, including shared email addresses, minors/guardians, unlinked applicants, opt-outs, suppression and changed canonical links? No email fallback or automatic match is chosen here.
4. Which sender and monitored reply-to are approved? The existing P0 sending domain/key does not by itself authorize status messaging. No new credentials or provider access are requested by this package.
5. What timing, cancellation/coalescing, obsolete-draft invalidation, duplicate/retry window, recovery audit and retention rules apply? A later outbox must distinguish held drafts from send-authorized work and recheck current authorization/state.
6. May a message include an authenticated event link or actual itinerary details? The participant UI remains unpublished and genuine P1 hosted/account acceptance is incomplete; no link or travel detail is included here.

### Complete Chat handoff

Recommended thinking level: HIGH.

Review the inert P1 status-notification preparation for Champion Life/SOWGO issue159. P0 application receipts are live and must remain unchanged. Draft PR162 contains uninstalled Team/Travel source with individual approval, canonical identity/availability/age/guardian review, separate driver qualification, seat/itinerary states and unpublished own/staff views. The new local helper proposes nine plaintext messages and returns immutable held/non-sendable review objects only; it has no recipient, sender, channel, authorization, persistent outbox, runtime import, provider call or activation hook. No status messaging is authorized.

Decide which message types and exact copy below are approved; authoritative P0/P1 transition/precedence rules; exact event-scoped preparer/approver/releaser duties; recipient identity/channel rules including shared contacts, minors/guardians, opt-outs and revoked links; sender/reply-to; manual versus automated timing, duplicate/coalescing/obsolete-state/retry/recovery/retention rules; and whether future authenticated event links or itinerary details are allowed after genuine P1 acceptance. Viable first release options are (a) continue preparation only, (b) separately authorize per-message owner-reviewed delivery, or (c) design an explicit event-scoped outbox/worker after all policy and isolated acceptance gates pass. Manual review can bound the initial audience but still needs verified recipients and current-state checks; automation requires stronger atomic event capture, obsolescence and retry controls. Do not infer send authority from current Team permissions or P0's domain/key. Return explicit approved rules and unchanged HOLDs before any delivery implementation or production action.

## Proposed copy — unapproved, version1

Event/leg placeholders are explicit reviewed labels. No wording below is authorization to send.

### team_under_review

Subject: SOWGO: {{event_name}} — application under review

Your volunteer application for {{event_name}} is under review.

This update does not confirm team selection, a vehicle seat or a travel itinerary.

### team_approved

Subject: SOWGO: {{event_name}} — volunteer application approved

The outreach team has approved your volunteer application for {{event_name}}.

A vehicle seat and confirmed travel itinerary are separate. This approval does not confirm either.

### team_waitlisted

Subject: SOWGO: {{event_name}} — volunteer application waitlisted

Your volunteer application for {{event_name}} is waitlisted.

This update does not confirm a place on the team, a vehicle seat or a travel itinerary.

### team_declined

Subject: SOWGO: {{event_name}} — volunteer application decision

The outreach team has not selected your volunteer application for {{event_name}}.

This update does not confirm attendance or travel.

### team_cancelled

Subject: SOWGO: {{event_name}} — volunteer participation cancelled

Your volunteer participation record for {{event_name}} is marked cancelled.

This update does not confirm attendance or travel.

### vehicle_seat_reserved

Subject: SOWGO: {{event_name}} — seat reserved, itinerary unconfirmed

A vehicle seat has been reserved for your {{leg_label}} travel arrangement for {{event_name}}.

Your itinerary is not confirmed. Departure and meeting details remain subject to outreach team confirmation.

### vehicle_seat_cancelled

Subject: SOWGO: {{event_name}} — vehicle seat reservation cancelled

Your vehicle seat reservation for {{leg_label}} at {{event_name}} is marked cancelled.

This update does not confirm another seat or a replacement itinerary.

### itinerary_confirmed

Subject: SOWGO: {{event_name}} — itinerary confirmed

The outreach team has confirmed your {{leg_label}} itinerary for {{event_name}}.

This confirmation applies only to this travel leg. Other travel arrangements require their own confirmation.

### itinerary_needs_review

Subject: SOWGO: {{event_name}} — travel confirmation needs review

Your {{leg_label}} travel arrangement for {{event_name}} is not currently confirmed.

Earlier itinerary details should not be treated as current confirmation. The outreach team must review and confirm the arrangement.
