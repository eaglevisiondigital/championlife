# General 6 a.m. prayer resources — reconciled LOCAL candidate

PR #54 reviewed input: 373868a0d8f13251a553b3c3006689d6c12280af.
Accepted local composition reused: a892b2be6421b2cfcb3a330012bdc4591d73310e.
Production main: bfb7af214707db73a3a3164bc96ccafae7de8ccf.
Reuse accepted Resource Registrant chain 7be32ed → a9bed1e → 6d5730b and reader 5c84a42. No new backend schema or authentication implementation.

## One registration flow
SowGo PR #6 `/king-kind/` links to Champion Life `/king-kind-signup.html`, an additive compatibility entry to `/king-kind/`. The accepted form collects name, email and required resource-delivery consent, with separate optional ministry updates, phone, prayer and interests. The current approved charcoal/gold design remains. General registration never asserts a ministry decision or event attendance and creates no church, partner, staff or People relationship.

The draft `general_king_kind_registrants` migration, draft JavaScript and its superficial test are removed locally. Only `supabase/release/general-king-kind-resources-candidate.sql` is proposed for a later reviewed forward migration; it has not been applied. Its containment companion preserves records and audits. Existing private Storage exact-object RLS remains unchanged. Verified registration atomically creates/preserves the same account’s existing Getting a Grip course enrollment; progress remains separate. all 13 routes remain, cloud worksheets are lessons 1–4, device notes are lessons 5–13, and videos 11–13 are forthcoming.

All accepted account-isolation, reader session clearing and same-origin Supabase 2.118.0 SRI bytes are reused. The production Powered by Propel CSS/logo/sidebar markup is retained. No advanced Huntsville follow-up, adult-evidence or recovery package is imported.

## Local evidence
Full repository regression, 55 native general-resource checks, Chromium/WebKit signup/account/privacy/reader suites and paired-site 390/768/1440 browser acceptance. All Auth/email/Storage responses are intercepted fictional services; reader download bytes match the private approved PDF. Separate private audit workspace contains logs, screenshots, exact changed-file inventory and deterministic build hashes. No real emails, provider accounts or live permission changes.

## Remaining release gates
1. Independently review this exact composition and the small entry-point/copy changes; original accepted components remain sealed.
2. Bind a genuine nonproduction Auth/Storage environment, allowed redirect URLs, approved test mailboxes/message budget, fixtures, operators/custody, independently demonstrated recovery/session retirement, maintenance and retained-audit cleanup. Existing operational recovery blockers remain; this task does not restart recovery work.
3. Pair the SowGo test CTA/login/course URLs with the exact accepted Champion preview. Current SowGo source targets production and is NOT an isolated hosted acceptance route. Do not use it for test signup as-is.
4. Obtain separate bounded hosted-acceptance approval. Exercise fresh/returning general signup, consumed/expired verification with old session, A→B→A, RLS deny cases, exact private book/download, real course save and physical iPhone/Android/desktop. No genuine-provider PASS is claimed.
5. Recheck production schema/main; generate and independently review a single forward migration from the accepted SQL using installed CLI. Do not deploy the removed PR #54 draft migration or merge older unrelated PR chains.
6. Only after acceptance, obtain exact migration + Champion website + SowGo website release approval with retained-data containment and rollback. No broad grant or financial change.

## Rollback
Retain deployment IDs and database baseline at release. Contain general intake/eligibility using the separately reviewed containment SQL, preserving existing registrations/audits and legacy book readers. Website rollback must preserve the accepted privacy/SDK/reader security fixes; do not blindly restore the older vulnerable client. Preserve current `/go`, `/register`, event and giving routes. Signed URLs retain their issued TTL. Revalidate the smallest corrected known-good artifact before any rollback execution.

## Issue #53 latest-head reconciliation (October 29)

This successor is based on PR #54 `373868a` and reuses the accepted local composition,
including the frozen reader correction, rather than deploying the competing public
`general_king_kind_registrants` schema. All application, SQL, design and SDK bytes
remain identical to the accepted local composition. New work is an integrated local
native-PostgreSQL/real-SDK/PDF.js browser acceptance harness and reconciliation records.

Historical integration review (superseded for enrollment by the correction below):

- Remote registration atomically enrolls the user in Getting a Grip. Accepted local
  registration records resource delivery consent and keeps course enrollment separate;
  the first cloud worksheet save creates the learner's own enrollment. Decide this
  product/consent behavior before a release; any atomic enrollment port must extend
  the existing private RPC, not introduce the competing table or replace its audit,
  consent, idempotency and revocation protections.
- Issue #53 calls for watch-to-advance / answer-to-complete. Existing lesson links
  permit navigation without verified viewing. Lessons 1–4 have cloud worksheets;
  5–13 have private device notes, and 11–13 videos are forthcoming. This is a release
  requirement gap, not a regression introduced by this composition. Do not advertise
  complete 13-lesson cloud completion or an enforced viewing gate. Course-policy
  implementation requires its own reviewed scope and objective watch evidence.

The remote CDN UMD is a different artifact from the accepted vendored build, despite
both reporting SDK version 2.118.0. Keep the accepted 26-entry vendored SHA-256
`bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af`
and existing SRI; do not substitute remote `ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3`
or mix its SRI with vendored bytes. Existing build verifier rejects tampering.

`npm run test:issue53-journey --prefix tools/backend-tests` requires approved local
PDF ZIP, cached exact PDF.js 4.10.38 and a new private EVIDENCE_DIR. It uses disposable
Unix-socket PostgreSQL and intercepts every browser request: Auth, Storage signing
and lesson form receipt are fictional. No provider, hosted session retirement,
mailbox delivery, Netlify form notification or physical phone acceptance is implied.

## Issue #53 automatic enrollment correction (October 29)

Owner resolved the enrollment decision above. The same private Resource Registrant RPC now validates and locks the actual Auth identity, locks any current registration, inserts/preserves the fixed course enrollment using its existing unique constraint, and records the new-registration audit in one transaction. No caller-selected course/user or second schema. Existing enrollment timestamps, completion, lesson answers/progress and consents remain unchanged on retries. Read-only status reports both registered and enrolled; incomplete old records can use the same verified registration retry. Rejected or failed registration does not produce a new enrollment, registration or successful audit. A missing course fails closed. Success is displayed only on an explicit complete response followed by same-account verification. Start Course stays a navigation link.

The earlier enrollment product decision is closed; independent local review of this correction and the operational/provider gates above remain mandatory. Issue #56's 95% actual-watch/answer-to-complete implementation is separately tracked and unchanged. Do not advertise it as enforced, all 13 lessons as completed, or 13 working cloud worksheets. This limitation does not block separate review of general signup/private-book readiness.

Local tests must cover atomic rollback (including enrollment and audit failures), duplicate/concurrent retries, existing progress, missing enrollment repair, wrong/unverified/revoked identity, delayed UI responses and account switches. Native SQL tests use disposable PostgreSQL; browser tests intercept synthetic Auth/Storage. They do not establish genuine-provider token retirement or successful email delivery.

Containment and rollback preserve enrollment as well as registration/audit and legitimate learner progress. Never delete enrollments to undo a website release. Keep accepted reader/privacy/SDK fixes in any rollback artifact. Production preflight must inspect actual course schema/unique key/seed and any enrollment triggers before generating the reviewed forward migration. No historical migration is rewritten or applied by this package.
