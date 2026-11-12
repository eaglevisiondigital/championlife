# Minden, Louisiana — Family Fun Day & Decision / Free Book (source-only)

**Status:** DRAFT. No hosted SQL, campaign activation, staff grants, checkout,
real submissions, messages, production merge or deployment have occurred.

## Public entry points

- /minden/ — Huntsville-derived decision registration, English, King Kind
  free reader, discipleship resources and prayer links.
- /minden/es/ — Spanish decision counterpart, same exact Minden source.
- /minden/register/ — native Family Fun Day pre-registration using the
  existing public campaign-config RPC, Cloudflare Turnstile, household
  signature/guardian handling, authoritative Edge submission and confirmation.
- /outreach.html — new Minden discovery card, should not publish until ready.

## Confirmed event facts (owner, November 12, 2026)

- Date: **Saturday, December 19, 2026** (America/Chicago, CST).
- Venue: **Victory Park**, Park Highway, Minden, Louisiana 71055.
- On-site registration/check-in opens: **11:00 AM CST**.
- Family Fun Day: **12:00–2:00 PM CST**.
- **100 bicycles will be given away**. No promise to any preregistered family.
- Online preregistration opening remains controlled by the separate disabled
  campaign setting; do **not** confuse 11 AM event-day registration with
  an online signup opening date.
- Owner did not supply bicycle age/sizing eligibility, allocation/drawing
  procedure, or the legal name of the local host. These remain approval gates.
- City recreation's official facility listing confirms Victory Park on Park
  Highway: https://mindenrec.recdesk.com/Community/Facility/Detail?facilityId=10

## Exact isolation bindings

- Campaign code: `minden_la_family_fun_day`
- Campaign slug: `minden-family-fun-day`
- Organization: `sowgo` (as in Huntsville, no new organization)
- Decision source: `minden_la_outreach`
- Registration tables and staff RPC: original
  `outreach_event_registrations`, `outreach_event_attendees`,
  `outreach_registration_workspace` with exact campaign UUID and assignment.
- Decision table: existing `public.outreach_registrations`, source-bound
  with unchanged length, consent and anonymous user-id restrictions.
- Minden decision desk: `/staff-minden-decisions.html`;
  source-specific readonly RPC and existing
  `private.outreach_registration_can(c,'registration.view')` authorization.
  No broad direct table SELECT/UPDATE/DELETE or staff grants.
- No automatic conflation of decision cards with Family Fun Day attendance.
  They are different submission journeys and reporting totals.
- No change to Huntsville records, active staff assignments, or GiveHub/NMI.

## Backend activation gate

The source migration `20261112120000_minden_family_fun_day_draft.sql`
prepares an **inert** Minden campaign: `status='draft'`, `enabled=false`,
the owner-confirmed Victory Park venue and December 19 event schedule, and
`waiver_required=true` with no published waiver.
The source Minden decision view is in
`20261112120001_minden_decision_followup_view.sql`.

Both source migrations require **independent schema/RLS review, immutable
hashes, exact project identification, a safe bounded transaction/recovery
procedure, and separate owner approval** before they may be applied to any
hosted target. They do not imply installation authority.

Before enabling pre-registration, owner must supply and approve:
1. Confirm local host's **legal** identity, approved exact check-in cutoff,
   park/event permissions, and any additional directions or accessibility details.
   Event date, hours and Park Highway location are already owner-confirmed.
2. Louisiana-specific signed household waiver and media release,
   consent/privacy recipients, minors/guardian rules, prize/eligibility
   details (including 100-bike eligibility) and approved local follow-up authority. Do not blindly reuse
   Cornerstone/Huntsville legal text.
3. Canonical Minden campaign placement, required privileges for authorized
   Minden-only staff, expiry, roster access and check-in/export acceptance.
4. Confirmed Turnstile site verification, allowed-origin requirements,
   actual Edge and native RLS/Auth behavior, and replay/UNKNOWN cases.
5. Actual test households (fictional) and decisions to verify segregation,
   count/attendee totals, legal snapshots, check-in, consent, book links,
   signed-in follow-up and denied cross-city reads.
6. Approve publication, monitor, and be able to disable the specific
   Minden route without changing Huntsville.

The legacy decision form follows Huntsville's immediate direct insert and
OTP sign-in approach. The new decision desk is an additive source-only
read-only reporting surface; it does **not** claim a Person or consented
messaging workflow. Do not promise automated follow-up, a sent SMS/email,
or account activation until genuine provider acceptance passes.

## Source-only checks

`node tools/backend-tests/minden-parity.test.mjs`

Passing static checks are **not** proof of real provider submissions,
hosted security, legal approval or release readiness.
