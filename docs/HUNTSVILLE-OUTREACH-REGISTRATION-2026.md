# Huntsville / Madison City Hangout registration — build candidate

**October 16, 2026: implemented and locally tested; stop at build review.** No hosted acceptance, remote migration/configuration, production deployment, live router cutover, or merge. The two focused branches are `codex/huntsville-registration-2026` (Champion Life) and `codex/huntsville-register-router` (SowGo).

## Canonical event and routes

| Setting | Value |
| --- | --- |
| Owner | Existing SowGo organization, separate from Champion Life financial boundaries |
| Existing draft campaign code | `huntsville_al_2026` |
| Internal name | Huntsville Outreach / City Hangout |
| Public title / slug | CITY HANGOUT / `huntsville-2026` |
| Date | Saturday, October 24, 2026 |
| On-site registration opens | 1:00 PM America/Chicago |
| Event | 2:00–4:00 PM America/Chicago (19:00–21:00 UTC) |
| Venue | Cornerstone Word of Life Church |
| Address | 3783 Sullivan St, Madison, AL 35758 |
| Permanent preregistration QR | `https://sowgo.org/register` |
| Native destination | `https://championlifefwb.com/outreach-register.html?campaign=huntsville-2026` |

`config/outreach/huntsville-2026.json` is the reviewable definition. Migration `20261016165316_huntsville_registration_release_candidate.sql` extends existing Phase C records and prepares that unused draft in place. It verifies the campaign belongs to SowGo, remains draft, and has no registrations or existing registration settings; otherwise it stops for review instead of overwriting work. It records event/venue/timezone, disabled structured registration settings and an audit event. No duplicate campaign, grants or published legal version are created. No existing migration is rewritten.

On-site opening is distinct from the online registration window. `opens_at`/`closes_at` and household capacity remain unset, and `enabled=false`; a real closing/capacity policy was not invented. Giveaway copy says to complete registration and check-in before the event team's announced cutoff. No guaranteed bicycle/tablet. Bessemer's October 17 date, church/address, and former close time do not become Huntsville settings.

The shared native renderer remains hidden from normal website navigation and retains `noindex,nofollow` and no-referrer. Approved existing SowGo logo is reused. The optional City Hangout flyer file was not supplied/located, so no artwork was fabricated or modified.

## Source wording and immutable signatures

Authoritative owner-supplied source: https://form.jotform.com/241026266712046 (same form as the team preregistration URL recorded in the definition). Captured October 16, 2026; source screenshot and field evidence remain in the private audit workspace, outside the public build.

The candidate retains the substantive RELEASE OF CLAIMS AND HOLD HARMLESS AGREEMENT and media paragraph. Only the approved event substitutions are made: October 17 → October 24, 2026; Rediscover Church in Birmingham, AL → Cornerstone Word of Life Church in Madison, AL. Whitespace and form blanks are mapped to native fields; no legal rights or clauses are added. Champion Life / Living Faith Christian Center, Inc. in Fort Walton Beach, FL is unchanged.

The reviewed source requires media initials and a household signature. This campaign therefore requires a separate media permission checkbox and typed initials, independently of liability acknowledgment. Neither is preselected. Requiredness is versioned configuration, not a global policy for other campaigns. The source's manual date maps to the authoritative server signature time. The exact candidate legal/media strings are in the JSON definition for review and later authorized publication as `city-hangout-family-2026`, version 1.

One waiver per family uses the existing immutable signature model: typed legal name, relationship/guardian authority, explicit selected attendee coverage, exact legal version/text, server time and campaign. New media text/choice/initials are snapshotted with that signature and cannot be changed even by privileged updates. Future versions do not rewrite history. Legacy versions with no media clause preserve their existing consent and signature retry behavior. No drawn/biometric signature.

## Fields and confirmation

Eight sections: Your information; Who is attending; Minors/household; Release/waiver; Media release; Emergency contact; Signature; Review/submit. Primary first/last name, email, mobile, street, optional address line 2, city, state, ZIP; individual adult/child rows with names, age, relationship and required minor guardian; private emergency telephone. Adults are age 18+, kids age 0–17. The head is entered once as an attendee when attending. Live counts derive from rows, never separate editable totals.

Structured address keys and lengths are validated server-side, as are emergency phone and media consent/initials. Optional ministry follow-up, event communications and marketing remain separate and unchecked. Registering creates no canonical Person or portal/staff authority and sends no messages.

Success replaces the form with **YOU’RE REGISTERED!**, approved thank-you text, safe receipt reference, attendees, date/opening/event times, venue/address and present-to-win reminder. It does not claim check-in, a prize, or a sent message. Calendar actions contain public event information only: Google TEMPLATE with `America/Chicago`; Apple `.ics` with UTC start/end, CRLF, escaped text, stable UID and 75-octet line folding. Calendar description mentions the 1 PM opening. Download uses an attached anchor and bounded Blob URL lifetime.

## Staff workflow and attendance reconciliation

Use the existing Staff Workspace: Outreach Overview → relevant campaign → Registration & Check-In; Campaigns → open Huntsville → the campaign-scoped Registration sidebar link; or Registration → Huntsville. The destination is `staff-outreach-registration.html?campaign=<canonical UUID>`. Existing capability projections filter navigation and every RPC independently enforces campaign scope. Staff with only registration access can use its campaign picker; no unrelated campaign visibility is granted.

At the top of the registration list, **Campaign totals** shows four prominent cards: REGISTRATIONS, ADULTS, KIDS, TOTAL ATTENDING. Active accepted household statuses are `submitted`, `confirmed`, `checked_in`. `cancelled`, `no_show`, `closed` are excluded. Attendee totals additionally require `active=true` and `attending=true`; one row per attendee, so a head is not added twice. A still-active household whose attendees are all inactive counts as one accepted household and zero attending people.

Headline totals use the entire selected campaign and remain fixed during search. Search filters household results only. Separate expandable event-day metrics show checked-in adults, checked-in kids and total checked in; check-in never overwrites preregistration counts. Four columns at desktop, two at tablet/390px.

Detail includes source, timestamp in campaign timezone, structured address, emergency telephone, attendee age/guardian/waiver/check-in and immutable signed media. Existing check-in, reversal, walk-up, signature correction and no-silent-Person-link safeguards remain.

CSV uses exactly the same active population as the cards, regardless of search. Columns: reference, local date/time + timezone, primary names, phone/email, address/city/state/ZIP, attendee name, Adult/Minor, age, relationship, guardian, emergency phone, waiver status, media consent, check-in status, source. Formula neutralization is retained. No raw signature/initials/legal payload, internal UUID, idempotency key or token. If an accepted household has no attending member, it emits one blank-attendee row; only rows marked Adult/Minor count toward people totals. Thus distinct references = households, adult rows = adults, minor rows = kids, adults + kids = total attending. Staff CSV capability remains distinct from view.

## Security and build boundary

Reuses the existing dedicated gateway and narrow public configuration. Turnstile action, exact CORS policy, server-observed network/rate controls, bounded body, idempotency and safe errors remain unchanged. No new public lookup/list/detail endpoint. Emergency/address/media data remain campaign-scoped under existing RPC/RLS permissions. No service credentials or personal data in browser storage; only retry identity keys. Same-session revocation denies list/detail/export and clears the UI.

`tools/backend-tests/huntsville-registration-preview.mjs` is a localhost-only, in-memory synthetic database fixture with simulated Auth/Turnstile and CSP forbidding outbound connections. It is **not** a hosted acceptance harness and is excluded from the explicit public build. Local signatures are clearly non-binding synthetic tests. Production and acceptance infrastructure are untouched.

## Local validation and release gates

- Required `npm ci --ignore-scripts --prefix tools/backend-tests` and full `npm test --prefix tools/backend-tests`: pass (29 suites including new Huntsville database/DOM checks).
- Final focused checks: 56 Huntsville database, 25 Huntsville DOM/calendar, 93 Phase C database/security, 35 Phase C DOM; gateway checks retained in full suite.
- Five existing real PostgreSQL integrity races: 8 distinct overlapping workers plus separate coordinator; duplicate submit, check-in, attendee add, signature retry and final configured household capacity pass. Final slot yields one success/seven safe denials.
- Actual local Chrome submission saved to disposable database; staff detail, coverage/emergency, fixed search totals, separate check-in and downloaded CSV verified. Public/confirmation/staff at 390/768/1440: no horizontal overflow or application console errors. Actual ICS downloaded and independently parsed for correct Chicago time.
- SowGo router source tests pass; generated QR independently decodes to the exact permanent URL. Source `/go` rules and all unrelated public website files preserved.

**Build acceptance is not release approval.** Next requires separate hosted-acceptance assignment: inspect target migration ledger/draft state, apply only approved pending migration to acceptance, publish the reviewed legal version under an authorized administrator, configure appropriate registration/campaign state and exact gateway/Turnstile preview allowlists, then synthetic end-to-end acceptance including staff totals/export/revocation/calendar/QR. Do not enable arbitrary callback/origin wildcards. Production activation and SowGo merge/cutover require later explicit approval and coordinated order.

Keep the current JotForm available as reference/fallback until native hosted acceptance and cutover are approved. Permanent routers are independent: `/go` outreach decision/follow-up, `/register` preregistration. Future campaign changes update only approved temporary `/register` destinations, not QR bytes or `/go`. No giving, processor, SMS/email, Bessemer page or production changes in this build.

## Hosted acceptance correction — October 16, 2026

The live Cloudflare widget's default 300px width caused 15px horizontal overflow at the required 320px viewport. The guest registration entrypoint now requests Cloudflare's supported 150px compact widget. Challenge action, callbacks, expiry/reset, server verification and submission behavior are unchanged. A focused DOM regression checks the requested size; hosted 320/390/768/1440 checks must confirm the resulting layout. This is a draft acceptance correction, not production activation.

The hosted success path exposed a widget lifecycle warning: confirmation removed its DOM before the unconditional reset. Successful submission now removes the live Turnstile widget before showing confirmation; failed submissions still reset the attached widget for retry. Focused regressions cover both outcomes. This changes only client cleanup, not challenge verification, gateway policy or registration persistence.
