# Shared Branded Outreach Partner Intake v1

Development authorization starts at `2e9bc50b8a08de2ae0dd61ccd1943bf90dad2ce4` and releases the previous development hold only. Dream Team is unchanged and remains production-unreleased. PR #2 stays draft/unmerged; no production change is authorized.

## Prior-path audit

At the starting HEAD, `assets/js/site.js` created the guest `outreach-partner` modal, URL-encoded its fields and full `source-page` URL, POSTed to `/` for Netlify Forms capture, and after an OK response navigated to `/outreach-giving.html`. `netlify-forms.html` supplied the static Netlify form definition. `README-OUTREACH-PARTNER-GIVING.txt` instructed configuration of an office email notification; that instruction is not proof of notification configuration/delivery.

The full branch search (application/scripts, Netlify functions/edge code/config, Supabase functions/migrations, workflows and docs) found no onward webhook, RPC, automation or Supabase persistence for this form. Netlify read-only form metadata independently confirms the existing form with honeypot protection. No real submissions were read. Out-of-repository third-party automation and notification configuration are not proved absent by a source audit; reconcile any such configuration before production cutover.

New development submissions go directly to one native RPC. The outreach Netlify detection form is removed, with no dual write/fallback. Existing production Netlify capture and historical submissions are untouched. Other Netlify forms are unchanged. Historical records are not imported or deleted by this package.

## Presentation and routes

- `/outreach-partner.html?brand=champion-life`: black/white/gold, existing Champion Life logo, **Submit & Continue to Give**.
- `/outreach-partner.html?brand=sowgo`: original `sowgo-logo-light.png` copied byte-for-byte from the approved `eaglevisiondigital/sowgo` source, navy `#062943`, orange `#ff4b00` with darker accessible action `#d83b00`, **Submit & Continue to Sow**.
- Unknown browser brand defaults to Champion Life; server rejects unknown brands. Branding/source is descriptive client attribution, not proof of the referring hostname and never tenant authority.
- The old Champion Life modal and standalone route mount the same renderer, fields, limits, validation and submit handler. Modal keeps Escape, close controls, focus return/trapping and mobile layout. Existing partner anchors have a usable direct-route fallback.
- Eleven fields: first/last name, email, street address, optional line 2, city, state/province, ZIP/postal code, phone, commitment amount and frequency. All except line 2 required. Amount 1–9,999,999,999.99, cents supported; Weekly/Bi-weekly/Monthly only. Explicit labels Commitment Amount/Commitment Frequency follow the approved assignment. All values remain editable before submitting.
- Both successful submissions continue to the **unchanged** `/outreach-giving.html`, with a visible fallback continuation link. GiveHub iframe, merchant routing, donation and church giving destinations are untouched. The native record is saved before navigation.
- A commitment is intended giving, **not payment, card/ACH authorization, recurring billing, receipt or stored credentials**. No marketing consent is inferred and no messages are sent.

Preview targets (not production releases):

https://deploy-preview-2--championlifechurch.netlify.app/outreach-partner.html?brand=champion-life

https://deploy-preview-2--championlifechurch.netlify.app/outreach-partner.html?brand=sowgo

Staff: https://deploy-preview-2--championlifechurch.netlify.app/staff-outreach-partners.html

These are implementation targets until hosted verification is recorded below. No production direct URL is claimed deployed.

## Storage and security

Forward migration `outreach_partner_intake_v1` adds public `outreach_partner_intakes` and private `outreach_partner_audit`, both explicitly RLS-enabled with **no direct browser table grants**. The raw field JSON is authoritative and immutable through the exposed API. Separate normalized email/phone support safe human review; normalization never destroys source values. Source path excludes URL query/fragment to avoid copying unrelated tokens.

`public.outreach_partner_submit(jsonb)` is an invoker wrapper for a fixed-empty-search-path guarded private implementation. It accepts known fields only, bounds total payload and individual strings, validates email/phone/amount/frequency, resolves the owner from server-side organization slug **sowgo**, and returns only `{accepted:true}`. No client organization/person/payment/consent fields are accepted. It never creates People, Auth accounts, affiliations, grants or payment records. Guests cannot list/read intakes or their audit. Private remains excluded from Data API exposure.

An advisory transaction lock serializes idempotency and rate checks. UUID request keys are unique; SHA-256 binds a key to the submitted source/brand/field content. Identical retries return the same generic acknowledgement without extra writes; changed content under the same key fails. Browser double clicks are disabled; a sessionStorage key/digest (no raw contact fields) retains replay identity through network retry/back/refresh. A new intentionally changed payload gets a new key. This does not merge different submissions or identify a person across sessions/devices.

The invisible honeypot remains. Server limits accepted new records to five per normalized email per hour and 100 globally per hour, under the same lock; safe exact replay still succeeds at the cap. These bounded quotas are basic abuse protection, not a CAPTCHA or proof of humanity. Monitor/review traffic before broad public launch; attackers could consume a global quota. No IP address or fingerprint is collected. Database/operator failure fails closed with a retry message rather than silently routing to giving.

## Staff review and existing People/follow-up

`outreach_partner_workspace` uses the existing active verified staff assignment and effective organization-wide permissions. `outreach.view` is required for list/detail; `outreach.manage` additionally for mutations. New queue navigation is available from People. Paginated lists show contact, source/date, intended commitment, link/review and permitted follow-up state. Details safely render text, original address and review history; request keys/hashes are excluded. Sign-out clears protected content.

Mark reviewed does not establish identity. Explicit link/create requires organization-wide people.read + people.update; create additionally requires people.create and rejects possible name/email/phone duplicates for human reconciliation. Existing contacts must belong to the same organization. A reviewed link uses existing People relationship logic/audit to establish **partner** only if absent. It grants no membership, portal ownership, staff, finance or marketing authority and creates no Auth affiliation. Cross-organization links are rejected. No automatic identity merge.

Follow-up requires linked contact and the existing people.read/followup.read/followup.manage permissions. It creates at most one existing `followup_tasks` record per intake and uses the existing trigger/audit. Staff can manage the task in the Person workspace. No new Communications system, email notification or partner portal is introduced. Revisions reject stale staff edits; audit appends action/actor/time/link without duplicating contact payloads.

## SowGo source integration

Standalone source is accessible in `eaglevisiondigital/sowgo`. Its current production Partner entry is an **interim page link** to Champion Life outreach, not a direct popup. An isolated `codex/shared-outreach-partner` development branch changes the five partnership/mission/contact anchors and `partnerUrl` to the shared **preview** SowGo route. Production `main` is unchanged. Do not merge that integration while it targets acceptance. A future production release must coordinate a verified production shared-form route and the SowGo link release. No second website/backend was recreated.

## Embed

Embed not yet supported/tested.

Existing SAMEORIGIN framing protection remains. No speculative iframe contract or cross-origin policy change.

## Verification and release gates

Focused backend tests exercise guest write/replay, validation, authority-field rejection, rate/honeypot behavior, tenant denial, review/create/link, duplicate-contact refusal, partner-only behavior and follow-up reuse. DOM tests cover both brands, fallback, exact fields/options, failure/retry/back replay, shared modal, safe text and staff workflow/sign-out. Full historical regression remains required, including migration replay, build isolation, syntax, redirects and all prior modules.

Acceptance-only migration, hosted parity/security/synthetic checks, browser responsive results and repository/CI status are recorded in the completion handoff after execution. No real staff grants, partner submissions, messages or payment actions are authorized. Production release and merge remain explicit separate gates; operational staff provisioning, historical Netlify reconciliation and production URL/link cutover also require review. No next package begins.

### Acceptance database verification

Acceptance assigned migration version `20261004055336`; the local filename follows that remote identity. SQL MD5 `16ea4420b2986cad1049a3067b6d331b` matches hosted content. All 23 previous migrations are unchanged. Both new tables have RLS and no anon/authenticated read grants. Wrapper/implementation ACLs and empty search paths were read back. Rollback-only hosted assertions passed for guest write/replay, ownership forgery rejection, guest read/admin denial, cross-org rejection, reviewed contact/partner linkage, one follow-up and no additional authority; all disposable synthetic users/grants/intakes rolled back. No existing accounts or permissions were altered.

Full existing regression plus 45 focused backend assertions and public/staff DOM workflows passed locally (44 scripts in the final test command); isolated bootstrap/replay passed for 24 migrations, 58 public RLS tables, 60 policies and 95 functions. Hosted browser/CI results follow after development push.
