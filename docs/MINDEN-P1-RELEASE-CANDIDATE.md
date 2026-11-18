# Issue159 P1 release evidence — November 18, 2026

**Core isolated Team/Travel acceptance PASS. Production release NO-GO/HOLD.** The latest owner instruction prohibits production changes and additional staff grants. A read-only production preflight found the required Outreach Auth callback missing. No production P1 SQL/interface, named staff access or status messaging is activated. P0 remains live.

## Exact candidate and preservation

Draft PR162 continues reviewed checkpoint71b6da2f501f645d810d10555bb173755dae5389. Last runtime change is c5bda7925e7dddeb23a42f3379794811136c8227, including separate Person and Household adapters. P1 runtime SHA256:2cef780927fb398e6852971cfa91d306c60986551aac6825174556672d9c9625. Use the final exact PR head and private CI receipt; older CI at71b6da2 does not cover the new runtime.

| Input | SHA256 | Verified state |
|---|---|---|
| supabase/release/outreach-team-travel-v1-forward-candidate.sql | f6dd9b5bd0f316d105147f6de7a42a5fa694b55e48a0411b7867b72f8e3f90f2 | Installed/verified on disposable acceptance only; production absent |
| supabase/release/outreach-team-travel-v1-stop.sql | f8ef973ac80cbd47680fefcbc118454d1f01422a3495bc715b47948ebab2a1b0 | Native PASS; exact body exercised hosted inside independently pinned guards; production unapplied |
| docs/releases/minden-p1-publication.patch | e3bf2aca38d409856f19f04c6e21e760eb1f462baa93c169a97f02af952c5b8d | Unapplied; tested435-file build/426-file reversal |

All426 currently public files and the actual manifest remain byte-identical to production90657158d2c0d115d98b17c7be664f455b4b2cd0. Publication would add nine P1 files. Shared Auth/login/session, People, P0, Giving, DreamTrack and registration sources are unchanged. Selected PR6/35 recovery is narrow; PR149 attendee/bicycle activation remains held.

Production Netlify deploys remain current/ready: Champion Life 6afcb9ab44be6323ed723cd6 at the source above; SOWGO 6afcb9b79ca65025ad6035b0 at d068b3b90d79e9b355937a9702c18dcad24508d3. No P1 deploy ID exists. Public Minden application/SOWGO/DreamTrack return200; SOWGO event data retains the canonical Minden link. Production33 migrations, original31/function/RLS fingerprints, Auth 68/People 1/grants 72,140 DreamTrack questions, P0 enabled/revision4 and absent P1 are preserved.

## Genuine hosted acceptance

The owner-approved empty project used the27 reviewed persistent baseline, exact DreamTrack/P0 contracts and unchanged P1 SQL. Hosted/native P1 catalog matched11 functions/6 tables including definitions/owners/ACLs/RLS/columns/constraints/indexes. Acceptance-only P0 ledger overlays and empty-project provisioning were independently reviewed; production history/customer data were untouched.

Both approved accounts genuinely confirmed email and obtained provider sessions before the exact temporary fixture. Branded Resend SMTP delivered original-SOWGO-logo email; inspected Gmail headers reported SPF/DKIM pass. DMARC was not present, not a recorded failure. A genuine signup link reached the correct callback, scrubbed credentials and denied ungranted access. Owner code sign-in also worked. No Auth confirmation fields, JWTs or results were fabricated.

| Genuine check | Result |
|---|---|
| Canonical identity | Six protected owner UI Person creates, six private anchors/audits and separately verified application links; no auto-merge, account grant or companion parsing |
| Decisions/readiness | Under review/waitlist/decline/approve; approval, age and availability are separate gates |
| Guardian | Household/adult/child facts alone left travel blocked; separate guardian review required. Wrong-vehicle reassignment, occupied guardian removal and active-travel eligibility corrections refused |
| Drivers/vehicles | Driver-inclusive capacity; self-reported experience did not qualify a driver; explicit vehicle-specific review; occupied vehicle edits refused |
| Multi-staff final seat | Parallel genuine owner/travel-only requests: one reservation and one capacity denial, no overbooking |
| Atomic reassignment | Full target preserved original; successful replacement retained cancelled original and required fresh confirmation |
| Own itinerary/history | Unknown/edited/unconfirmed details withheld; confirmed self itinerary without other participants; synthetic check-in/attendance/reversal reflected |
| Manifest/CSV/print | Vehicle-filtered manifest view passed; actual campaign CSV downloaded five rows with formula-leading name escaped; actual Van A Chrome print preview cancelled without physical printing. No genuine single-vehicle CSV download is claimed |
| Mobile | Actual genuine staff/own 390px views without document overflow; prior Chrome/WebKit evidence retained |
| Revocation | Event grant, owner P1 permission and own-link revoked separately; existing sessions cleared views. Travel-only account denied shared People access |
| Hosted recovery | Four entry ACLs stopped/restored; P0 review retained. Same sessions recovered with row/audit/staff/Auth-count preservation and no installer replay |

All People, ages, qualifications, guardianship, locations, travel and attendance facts were explicitly synthetic. The own-Person relationship was an approved privileged synthetic precondition; this does not claim genuine acceptance of the shared portal-admin link-creation RPC. Actual application-to-Person UI creation/link review was tested separately.

An initial artificial20-second lock caused both HTTP seat actions to time out safely; preserved as stress evidence, not a successful race. A separate normal parallel genuine race passed. Actual print preview included an extra blank page; scoped privacy/content passed, with that cosmetic limitation retained.

## Preserved checks and independent review

Full regressions and426-file build pass on integrated runtime. New81 Person/84 Household controlled DOM/security checks pass; prior23 Team DOM,43 participant DOM/48 browser,40 SQL-connected staff Chrome/WebKit,109 signup DOM/224 focused browser and original login/session checks remain preserved. Native evidence retains64 lifecycle/security,14 concurrency,14 guardian,10 expiry,39 dependency,10 install recovery,7 access-stop and7 actual-P0 revocation passes. Ten actual hosted anonymous HTTP denials pass; nine inert notification drafts pass119 checks.

Independent source/current-catalog review found no blocker in bounded Team/Travel scope. Hosted recovery used exact source/owner/ACL/table/policy/non-P1 and ledger guards with27 native mechanics/13 migration-lineage checks. Provider recovery entries appended 33/34 without changing original 32 acceptance entries. The stop affects four P1 RPC entry ACLs, not shared canonical APIs or already-running transactions. Shared authorization/time semantics remain unchanged.

Health was clear. Intended RPC-only RLS/no-policy information, existing public registration-config warnings and the empty target's unused password-protection advisory were recorded without broadening permissions or unrelated settings.

## Cleanup and remaining release actions

Read-only production Auth preflight at2026-11-18T10:47:42Z found Site URL https://championlifefwb.com and exactly one allowed redirect: https://championlifefwb.com/discipleship-login.html. The dedicated https://championlifefwb.com/outreach-login.html callback is absent. This is a concrete production secure-link compatibility blocker; isolated callback success does not prove production compatibility. Save was disabled and nothing was changed. Preserve the existing DreamTrack callback, SMTP and templates; do not copy the isolated global SOWGO email configuration into production. Any exact additional Outreach callback rules and production email presentation require reviewed scope and explicit authority before release.

Temporary grants/directory windows/own-link were revoked; real local sign-out passed. Two obsolete owner sessions from earlier attempts remained until project deletion, so global-session-revocation is not claimed. The disposable project was independently absent by 2026-11-18T10:37:45Z, before November 18, 9:02 PM Central. The owner separately confirmed deletion of only the temporary SMTP key; provider removal/absence and live P0 key presence were verified. Local server and completed acceptance tabs closed. Nonsecret receipts/screenshots/delivery metadata/hashes/failed probes remain private outside the repository.

Production remains held. Before release:

1. Resolve and explicitly authorize the exact missing production Outreach callback rules while preserving existing Auth/DreamTrack configuration. Obtain exact P1 schema/publication release authority, fresh compatibility preflight and final exact-head CI; apply only the reviewed package, then verify production source/deploy/URLs and genuine callback behavior.
2. Verify exact named staff login emails, duties, organization/event scope and dates before grants. No Roddy/Kelsey/Danielle account was created or granted.
3. Keep status messaging disabled. [Notification preparation](OUTREACH-TEAM-NOTIFICATIONS.md) has nine held drafts and an integration design. Durable outbox, sending worker and provider outcome reporting are unimplemented. Approved transitions/copy/recipient/consent/suppression/timing and a reviewed delivery implementation remain outstanding. No P1 status email was sent.
4. Preserve PR149 attendee/bicycle hold and distinctions between received applications, approved volunteers and confirmed assignments. Real unverified details remain unconfirmed.
