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
no venue or event dates, and `waiver_required=true` with no published waiver.
The source Minden decision view is in
`20261112120001_minden_decision_followup_view.sql`.

Both source migrations require **independent schema/RLS review, immutable
hashes, exact project identification, a safe bounded transaction/recovery
procedure, and separate owner approval** before they may be applied to any
hosted target. They do not imply installation authority.

Before enabling pre-registration, owner must supply and approve:
1. Event date, local time window, on-site registration/check-in cutoff,
   venue name/address, and local host's **legal** identity.
2. Louisiana-specific signed household waiver and media release,
   consent/privacy recipients, minors/guardian rules, prize/eligibility
   details and approved local follow-up authority. Do not blindly reuse
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
