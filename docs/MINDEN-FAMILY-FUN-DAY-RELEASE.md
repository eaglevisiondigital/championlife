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
  canonical assigned-decision read authority through the existing
  `campaign_decision_foundation` contract. Registration access grants no
  decision access. Exact active source mapping and a current finite independent
  campaign assignment are mandatory. Only assigned records are returned; no
  email, phone, prayer, learner answers, People links, export or write access.
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

The original decision view alone is NOT an acceptable installation: it granted
registration workers excessive decision/contact access. Preserve its historical
source, but include `20261113120000_minden_decision_authority_correction.sql`
in the same separately reviewed installation transaction. The correction fails
closed without the approved canonical decision foundation and reviewed source
mapping. It creates neither the mapping nor any staff assignment. The canonical
foundation copy under `tools/backend-tests/fixtures/minden/` is a hash-pinned
LOCAL TEST FIXTURE ONLY, not an authorized migration.

All source migrations require **independent schema/RLS review, immutable
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

## November 13 source integration and exact remaining dependencies

The public build now contains the five previously omitted Minden HTML/runtime
files. Only those explicit public files were added; SQL, configuration, fixtures,
private evidence and documentation remain excluded. Four Minden pages reuse the
accepted Supabase 2.118.0 URL/SRI. Fictional browser transports do not constitute
SDK/provider login acceptance.

The Minden family page labels Victory Park as a venue, not an unapproved legal
host. Its confirmation does not invent a present-to-win eligibility rule.
Existing Huntsville copy and approved legal controls remain unchanged.

The new `supabase/release/minden-king-kind-reader-correction.sql` is a separate,
exact-baseline-guarded, uninstalled source contract. It extends only the existing
verified-email/consent private-book source allowlist to `minden_la_outreach`.
No bucket, policy, grant, Person identity or course eligibility is changed.

Local evidence: actual family page/form handler -> existing Edge submission
handler (fictional Siteverify and trusted ingress) -> disposable PostgreSQL
canonical gateway -> persisted receipt/confirmation. Actual EN/ES decision
handlers -> canonical anonymous INSERT with explicit rejection coverage; OTP
transport is intercepted and disabled. Separate native staff checks verify
roster, immutable waiver snapshot, scoped export, check-in and reversals. Real
Chromium/WebKit desktop/mobile tests cover assigned-decision denial, account
replacement, scope mismatch, stale responses, root retirement and refresh.
All local identities, assignments and legal text are fictional. Test fixtures
never confer real campaign authority and cannot approve Louisiana legal text.

No real Auth account creation or email, private Storage retrieval, Turnstile,
Edge deployment, source mapping, staff assignment, or hosted RLS acceptance has
occurred. Legacy public decision intake still has no operation receipt/client
key: a lost response cannot prove submission, and no automatic retry or identity
association is implemented. Its existing localStorage email behavior is not a
new authority. Production messaging and publication remain OFF.

Next operational prerequisite: approve the exact Louisiana household/media
text and local host/eligibility policy; separately approve target-specific
installation of reviewed foundations/corrections, explicit source mapping and
Minden-only finite assignments, then genuinely verify Auth/RLS/Storage/Edge.
The canonical desk intentionally shows the first assigned page (up to 50), not
campaign-wide totals or contact details. No unapproved bulk access is implied.
