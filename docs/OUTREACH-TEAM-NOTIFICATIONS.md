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
