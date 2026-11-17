# Minden volunteer application — Issue #159

Status: initial schema installed DISABLED in production; new Edge Function deployed fail-closed. The form and owner workspace were staged unlinked/noindex in deploy6afca94eee48caf607a88ab9 (source9c9b3a8038db1c84710ecb30aabed648818da748); public signup is NOT activated. The narrow owner-list alias correction is installed as a separate forward migration; genuine account and delivery acceptance remain pending. Genuine hosted submission, provider delivery, owner review and final activation remain required.

## Approved contract

One SOWGO-branded volunteer form at `/minden-serve.html`, shared by Champion Life and SOWGO Minden CTAs. Event: Saturday December 19, 2026, Minden Louisiana. Travel, meeting, lodging and final times will be confirmed by the outreach team. No volunteer travel times are inferred from the separate Family Fun Day attendee event.

The original JotForm `241095781841158` currently displays unavailable. Owner explicitly confirmed Issue #159's complete screenshot mapping and requiredness on November 17. No source questions beyond this mapping may be invented. Original SOWGO PNG is copied byte-for-byte from eaglevisiondigital/sowgo.

| Field | Contract | Required |
|---|---|---|
| Name | First Name, Last Name | Both |
| Email | Added email address | Yes |
| Phone Number | Optional; invalid text: `Please enter a valid phone number.` | No |
| I would like to attend the outreach | Yes / No | No |
| Do you have experience driving an RV or Big Rig? | Yes / No | No |
| Pick One | I would like to ride with the team / I will be driving myself | No |
| If driving yourself please list all who will be riding with you. | Single-line text; always visible | No |
| Any additional information? | Textarea | No |

All seven approved notices remain exact in the form and field-parity tests. No age, signature, waiver, marketing or membership questions added. Technical honeypot and Turnstile are abuse controls, not application answers. Text limits are 100 characters/name, 254/email, 40/phone, 1000/passengers, 4000/additional information. No local PII autosave.

## Canonical storage and authority

Additive migration `20261117190320_outreach_volunteer_applications_v1.sql` installs a single canonical SowGo campaign `minden_la_2026` plus separate volunteer settings/applications and private mail/rate records. Event date is a date; unknown campaign timestamps stay NULL. Volunteer intake starts disabled. No attendee registration settings, attendees, bike/prize workflow or waiver is enabled.

Applications are immutable submitted snapshots, status initially pending, with a separate private review note/revision/audit. Email and phone never create or merge People, households, portal links, Auth, membership, financial partners or staff grants. Free-text companions remain unverified text.

P0 review requires verified Auth plus current organization-wide `staff.manage` authority in the campaign organization. Owner approved reuse of the existing verified Platform Owner only, without new accounts/grants. Other named staff remain pending verified login addresses and exact duties. P0 allows pending, under review, waitlisted, not selected and cancelled. It has no approval or vehicle assignment command. P1 handles separate canonical individual review, age/guardian/availability checks and travel approval; public RV experience is not driver qualification.

Every new table has RLS and no anon/authenticated raw grants. Public service RPCs are executable only by service_role; workspace RPC is authenticated and revalidates current authority after blocking locks. Existing function definitions, policies and migration history are preserved. Hosted installation guards pin the observed 31-migration ledger, staff helper, all existing function definitions and RLS policy fingerprint; drift stops installation before DDL.

## Intake and confirmation

`outreach-volunteer-submit` is a separate Supabase Edge Function. It requires dedicated mode `MINDEN_VOLUNTEER_MODE=live` and server-only `MINDEN_RESEND_API_KEY`; existing network pepper and Turnstile secret are reused without changing their values. Sender is fixed to `SOWGO Outreach <outreach@auth.championlifefwb.com>`. Create a sending-only key restricted to verified `auth.championlifefwb.com`; enter secrets directly in the provider UI, never source/chat/build output.

Only `https://championlifefwb.com` is accepted as an Origin. Turnstile must return actual hostname championlifefwb.com and action minden_volunteer; no dummy-key exception. Bounded JSON/body read, strict fields, server validation, HMAC network identity, 30/hour/network and 5/hour/email reduce abuse. Network fingerprints expire after 2 days. No raw IP persisted.

Campaign serialization and uniqueness protect native concurrent duplicates. Same request+changed answers is rejected. A new request matching normalized event+first+last+email returns the original immutable application without replacing answers or creating another confirmation. Names may differ while sharing one household mailbox. Matching does not prove identity or confer access. Public response contains only receipt/reference/outcome, no internal ID, roster or account information.

The application and frozen confirmation payload are committed together. One private mail record per application, lease token, deterministic provider idempotency key and fixed template v1 prevent ambiguous-send duplication. Provider acceptance needs a real provider UUID. No database success means no send. Mail failure never loses the application or falsely reports delivery. Staff can retry pending confirmation under the current owner gate; accepted mail is never resent. At most 3 attempts, a 2 minute lease, and 23 hour retry window; exhausted/ambiguous old items are held for provider review. Permanent provider errors are failed, visible for staff triage. No automatic resend after provider idempotency expires.

Sending-only keys cannot retrieve Resend emails. P0 owner uses the restricted application's Resend log link for delivered/bounced status and explicit provider review of failed/held items. Provider acceptance is distinct from inbox delivery. Independent acceptance uses the connected provider and approved owner-controlled mailbox; no marketing contacts/subscription or other messages.

## Staged release and recovery

1. Pin source, migration SHA256 and dependency fingerprints. Pass local native PostgreSQL, concurrency, gateway, DOM, independent review, full existing regression and CI. No historical migration replay or PR #6/#35/#149 wholesale merge.
2. Install only the guarded initial migration, disabled, followed by the separately guarded owner-list alias correction `20261117191223_outreach_volunteer_review_list_fix.sql`. Deploy only the new Edge Function, preserving the other three functions. Secure key must be configured by owner; leave mode off until this stage is verified.
3. Publish the unlinked form and owner review page from verified Git source. Keep public Minden CTAs unchanged during genuine acceptance; new form initially noindex. Set dedicated mode live, verify current owner access, temporarily enable intake for the authorized labeled test and verify genuine submission+provider delivery+review. Test record is not a real volunteer/seat request and is cancelled with an audit note afterward.
4. Only after all gates pass, publish the Minden CTA activation on both sites and remove temporary noindex. Verify canonical URLs, both published Git SHAs and actual Netlify deploy IDs and deployed bytes.
5. Rollback is feature-disable/fix-forward: owner Pause public intake, dedicated mode off, then a forward source change removing Minden CTAs. Preserve received applications/outbox/audit and all migration history. Do not restore an older production deploy or drop tables. No paid acceptance resource created.

Public build is explicit allowlist `dist/`; private SQL/docs/tests/audit never published. SOWGO publishes only public/. SOWGO Phenix City/Natchitoches outdated dates are replaced with approved rescheduled/TBA messaging, with no invented new dates. General partners, giving and other registrations retain existing targets.

## Validation status

Passed locally:60 native database/security/concurrency checks;29 gateway/email unit checks;17 field-parity/public DOM checks;14 staff DOM/security checks; complete preexisting regression suite. Independently: blocked-settings revocation race denies42501 without changing settings/audit; P1 actual-P0 integration and capacity races pass. Mobile 390 px rendering has no horizontal overflow and original logo/visible passenger field; local security config fails closed. These are local tests, not genuine provider delivery proof.

Passed hosted: original31-migration history fingerprint preserved; old function/RLS fingerprints unchanged; new tables RLS with no raw browser grants; intake disabled/zero applications; endpoint503 and untrusted-origin403.

Required remaining: final source CI, real captcha and genuine owned-mailbox receipt/provider delivery, existing owner browser review, pause/re-enable recovery, both live Minden links and deploy receipts. No release claims until recorded.
