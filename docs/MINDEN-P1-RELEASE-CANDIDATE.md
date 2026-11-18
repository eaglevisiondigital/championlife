# Issue159 P1 release candidate — November 17, 2026

**NO-GO for production.** The reviewed Team/Travel implementation and independent corrections pass technical checks. Genuine hosted owner/multi-staff/participant acceptance remains incomplete. No production P1 SQL, interface, staff permission or status message is activated. P0 is still live and unchanged.

## Exact inputs and preservation

This continues draft PR162 from reviewed head `1b99a3eb7ae3d38ed8e9890fe63f30739f6aa3cb` on production source `90657158d2c0d115d98b17c7be664f455b4b2cd0`. Narrow PR6/35 recovery remains separate from PR149 attendee/bicycle work, which stays held. Existing P0, DreamTrack, Giving, People, registration and Auth source and the production migration history are unchanged.

| Reviewable input | SHA256 | State |
|---|---|---|
| `supabase/release/outreach-team-travel-v1-forward-candidate.sql` | `f6dd9b5bd0f316d105147f6de7a42a5fa694b55e48a0411b7867b72f8e3f90f2` | Verified on disposable acceptance only; UNINSTALLED in production |
| `supabase/release/outreach-team-travel-v1-stop.sql` | `f8ef973ac80cbd47680fefcbc118454d1f01422a3495bc715b47948ebab2a1b0` | Tested local incident access stop; UNAPPLIED hosted |
| `docs/releases/minden-p1-publication.patch` | `e3bf2aca38d409856f19f04c6e21e760eb1f462baa93c169a97f02af952c5b8d` | UNAPPLIED publication change |

The actual published artifact remains426 files. The publication patch now adds nine P1 HTML/JS/CSS files, including the dedicated Outreach login and P1-only session presentation. It applies and builds435 files in a disposable copy, preserving all426 existing public files byte-for-byte; reversing it restores the426-file manifest/build. It changes no P0 page/runtime or shared navigation. The staff workspace provides unified owner application review and explicit reviewed Person linking; other scoped staff need an authorized event link. The participant page likewise requires an explicit event link and the existing verified own-Person relationship. No account claiming or staff bootstrap interface is added.

## Independent corrections

The candidate now pins the existing campaign-capability constraint before replacing it. Missing/changed constraints fail before DDL, while repeat/partial installs retain their explicit refusal.

Independent review reproduced a guardian defect: a guardian change could leave a minor's seat marked confirmed but currently invalid, and reconfirmation could falsely report success. Guardian corrections now require releasing active dependent travel. Confirmation validates the complete existing itinerary/driver/guardian gate after a tentative update; refusal rolls back state, revision, timestamps and audit.

P1-only permission helpers retain every existing verified/staff/person-link/organization/department/revocation check and supplement directory, grant and Person-affiliation dates with the wall clock. Expiry during a campaign-lock wait denies the original request. Shared production helpers are unchanged. Future-effective authority can remain conservatively denied until a new transaction under the retained legacy gates; this does not expand access.

## Tested

| Check | Result and scope |
|---|---|
| Full existing regression suite and explicit public build | PASS;426 public files |
| Native lifecycle/security |64 PASS; synthetic local PostgreSQL |
| Two distinct staff identities, final seat/reassignment/revocation |14 PASS; independent native sessions with synthetic claims |
| Guardian/full confirmation |14 PASS in native PostgreSQL and PGlite |
| Owner grant and staff-directory expiry while blocked |10 PASS; observed lock wait and database-clock expiry |
| People/Household/dept/Person-affiliation dependency expiry |39 PASS; positive scope and outside-scope cases; no denied write/audit advance |
| Installation recovery guards |10 PASS |
| Reversible P1 access stop |7 PASS; records/audit, staff grants and P0 preserved |
| Independent actual-P0 list/detail/blocked-settings revocation |7 PASS |
| Staff Chrome/WebKit390px/1440px |40 PASS against actual disposable native RPCs; explicitly synthetic Auth |
| Participant DOM and prior browser evidence |43 DOM and48 browser PASS retained; unchanged source, synthetic Auth/RPC |
| Notification preparation |119 PASS; pure held drafts only |
| Actual hosted anonymous HTTP isolation |10 PASS; public key only, no genuine signed-in session |
| Hosted versus final native P1 catalog |Exact match:11 function definitions/owners/ACLs and6 tables with columns, constraints, indexes, RLS and ACLs |

The disposable hosted project uses the hash-verified27 persistent production baseline, excluding retired temporary installers, plus the exact DreamTrack/P0 contracts. Its original application function and RLS fingerprints match production. New-project default grants were tightened before replay and the missing automatic-RLS prerequisite was provisioned only there. Acceptance-specific P0 ledger guards pin the actual provider count/hash/name while retaining exact helper/function/RLS checks. Independently reviewed overlays and raw nonsecret receipts stay in the outer private audit workspace; no production history or original source payload was rewritten.

**No genuine authenticated P1 journey is claimed.** The first disposable project was deleted before the owner completed its confirmation link, making that link unusable. The owner separately approved the fresh replacement quote and full reviewed baseline. The replacement remains active within its approved24-hour window; branded email, SMTP and callback preparation must finish before any new sign-in message. A narrow first-confirmation callback correction is under review. No account was marked verified manually and no JWT or staff result was fabricated. Additional scoped test permissions remain approval-gated. These are release gates, not substitutes for green local tests.

## Notifications and remaining actions

[Notification preparation](OUTREACH-TEAM-NOTIFICATIONS.md) contains nine proposed status-specific plaintext messages, strict held-draft validation and the proposed Resend idempotency/outcome integration. There is no active recipient, sender, channel, queue, worker or provider call. The119 checks do not prove real delivery. Persistent status delivery/outcome integration is not implemented; approved transition/copy/recipient/consent/suppression/timing policy is required before that separate activation work. Existing live P0 confirmations are unchanged.

Before production release:

1. Complete genuine email-confirmed owner sign-in and the separately approved second-account fixture. Perform actual hosted identity review, statuses/readiness, driver/leg/vehicle/guardian, final-seat race, reassignment, CSV/print, own-history/confirmed-itinerary, revocation, mobile and access-stop acceptance. Never substitute synthetic claims or edited Auth confirmation fields.
2. Verify exact named staff login emails, duties, organization/event scope and dates before any real assignment or grant. Named accounts remain inactive; do not infer identity or duties. Preserve the registration-only scope of its existing grant API.
3. Retest the final exact source/catalog and obtain explicit P1 schema/publication/access release authority. Apply the publication patch only after its gates pass, then run exact-head CI and verify the resulting artifact. No candidate filename or green draft CI authorizes deployment.
4. Keep status messaging disabled pending its policy and delivery implementation. Keep PR149 attendee/bicycle registration held. Unknown itinerary details and unverified people remain unconfirmed.

Private receipts record the final source SHA/CI run, project cleanup and genuine-gate status. No new production deploy ID exists for P1.
