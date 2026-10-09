# Phase H1 — provider activation foundation

## Build boundary and dependency

Build-only dependent branch `codex/communications-phase-h1-provider-activation`, from accepted Phase G `10a15402f059c605d883ec8b4517d3dfdf9cd850`. H1 reuses the canonical Phase G outbox, attempts, receipts, consent, suppression, templates and audit. It does not create a second messaging or identity system.

Migration `20261009212523_communications_phase_h1_provider_activation.sql` is tested locally only. No hosted migration, secret, profile, permission grant, function deployment, DNS modification or real message is part of this build. Production and Auth SMTP are unchanged. All prerequisite PRs remain draft/unmerged; PR #10 remains parked. H2, SMS credits, text-to-give, bulk/automation activation, Huntsville publication and Bessemer activation are excluded.

## Auth email and Communications email

Supabase Auth owns login, OTP, magic links and existing invitation email. Its templates, SMTP settings and callbacks remain unchanged. Communications owns separately authorized business messages through the existing canonical outbox. The new Edge Functions do not intercept Auth mail. An underlying SMTP mailbox may be reused only after separate credential/volume approval, with independent Communications secrets and controls.

The existing user-approved metadata can be represented without disrupting Auth: Network Solutions SMTP, `netsol-smtp-oxcs.hostingplatform.com`, STARTTLS port 587, `office@championlifefwb.com`, display Champion Life. The reply-to still requires exact approval. No credential was retrieved or copied. No production profile was created. SowGo has a separate organization-owned profile capability and returns **PENDING SENDER CONFIGURATION** until its own sender is approved; Champion Life identity is never inherited.

## State and sender ownership

Non-secret controls are separate from sender metadata and from secrets. States: disabled, configured, verification_pending, verified, test_only, production_enabled, suspended. Configuration, credential verification, sender approval, enablement and individual message authorization are independent gates. All delivery switches default off; environment defaults unconfigured. A successful authentication check leaves health unknown, sender approval separate and the profile disabled. Metadata edits invalidate credential verification and disable sending.

Only a trusted, separately authorized operator can provision an approved From/reply-to, bind the environment, set structured-callback capability or approve production mode. Browser users can select profiles and update descriptive metadata/classes; they cannot enter From, credentials, provider routing, sender approval or production_allowed. Runtime secret bindings must match profile ID, organization, environment, project ref, provider, From and reply-to exactly. The service provisioning facade rejects mismatched channel/provider combinations. Each tenant has its own profile and sending domain/classes.

## Secret model and exact environment names

Use approved Supabase Edge secret storage, independently for acceptance and production. H1 does not set these values:

| Name | Responsibility |
|---|---|
| COMMUNICATIONS_RUNTIME_ENABLED | Explicit runtime gate; missing/false disables every H1 endpoint |
| COMMUNICATIONS_ENVIRONMENT | acceptance or production |
| COMMUNICATIONS_PROJECT_REF | Exact bound project; acceptance must be bkbmjisprwmkptywtmih, production must differ |
| COMMUNICATIONS_PROVIDER_SECRETS_JSON | Server-only registry keyed by profile UUID |
| COMMUNICATIONS_EXTERNAL_WORKER_SECRET | Independent server worker bearer, at least 32 characters |
| COMMUNICATIONS_ADMIN_ORIGINS_JSON | Exact approved HTTPS origins; no wildcard |
| SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY | Existing Edge runtime bindings; never expose the service-role value |

Each registry entry contains `profile_id`, `organization_id`, `environment`, `project_ref`, `provider`, approved `from`, nullable `reply_to`, `sender_approved`, and SMTP `host`, numeric `port`, `username`, `password`. Password is passed as an authentication value, not interpolated into a URI. Later SMS bindings must carry a selected provider's sender/service identifier and verifier secrets; no vendor is selected here. Never paste secret values into a command argument, audit, PR, database metadata or browser field. Use a protected operator secret file/input mechanism; never echo values or log provider error bodies. Rotate independently of Auth secrets.

## SMTP adapter

Pinned Nodemailer 10.0.16 runs inside the existing Supabase Edge architecture. [Supabase's official SMTP example](https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/send-email-smtp/index.ts) uses this architecture. The adapter requires validated TLS 1.2+, STARTTLS on 587 or implicit TLS on 465, authenticated credentials, bounded DNS/connect/greeting/socket timeouts, no debug logging, no file/URL access and exactly one envelope recipient. Approved profile display/From/reply-to and subject reject header control characters. Plain text is retained and HTML is escaped; no scripts or template expressions execute. Automated tests include the actual pinned Nodemailer MIME composer, using local stream transport without network delivery.

The RFC Message-ID is a stable hash of organization and canonical idempotency key; it is not a promise that SMTP deduplicates resends. A definitive 4xx rejection is transient; 5xx/auth/envelope failures are permanent. Socket/timeouts or acknowledgement loss after possible acceptance are uncertain and require reconciliation, never blind retry. SMTP acceptance records **sent**, not delivered. Authentication verification uses `transport.verify()` without sending; [Nodemailer documents](https://nodemailer.com/smtp) that this does not prove an arbitrary From will be accepted.

## SMS boundary

Repository discovery found no configured real SMS transport. **SMS PROVIDER: SELECTION REQUIRED**. The adapter contract requires send, verification, vendor callback verification, sender number/service ID, canonical provider reference, normalized failure/delivery results and STOP/START/HELP handoff. Text is NFC/newline normalized, never silently truncated; optional segment and cost metadata are preserved by the contract. Missing vendor returns NOT CONFIGURED / PROVIDER SELECTION REQUIRED, never a fake health pass. No purchase, credit ledger, payment/donation keyword parser or vendor credential provisioning occurs.

## Controls, allowlist and message authorization

Global external control requires both current organization provider-enable authority and an explicitly active, unexpired entry in the separate Super Admin registry. No existing staff.manage or campaign role implies Super Admin; the registry starts empty and must be bootstrapped under a later exact authorization. Organization, email, SMS and provider switches override queued work and preserve records/history.

An exact test-recipient allowlist records organization/channel/purpose/enabled/expiry/approver/creation. Browser expiry is bounded to 30 days. No domain patterns or wildcard addresses. Allowlisting does not create consent or permission to send. A dedicated transactional test uses an existing adult canonical Person, current address, separate purpose consent and no suppression. Exact preview subject/body/address plus explicit confirmation and a request UUID authorize one canonical test record. Repeated requests reuse the same record; content mismatch rejects. Every claim and handoff rechecks the initiating actor's provider-view/test and People-read authority, address, minor restriction, consent and allowlist expiry. H1 requires the exact allowlist even for its tests in production-enabled mode.

The Provider Test screen has organization/profile/channel-labelled approved recipient selection, no bulk audience, exact preview, five counts, keyboard confirmation and canonical result. Its dedicated email subject is `<approved display name> Communications Test`; body is `This is an authorized test of the Global Propel Communications Core for <approved display name>.` No marketing language. Selection and template approval alone are not live-send authorization.

## Dry-run and accepted Phase G preservation

`communications_workspace('dry_run', campaign, payload)` evaluates the existing scoped audience, consent/suppression, template interpolation, approved sender and external readiness, returning rendered recipients and eligible/suppressed/invalid/held/would_send counts. It creates no batch/outbox and makes no provider request. H1 normal/bulk/automated delivery plans have would_send=0 and eligible recipients held under message_activation_required. A separately authorized single-recipient provider preview can have would_send=1 only when its complete gate set is satisfied; preview still makes no network delivery.

Existing G previews, batches, event consumption and sink behavior remain. The G sink excludes H1 tests from claim, suppression and expired-lease recovery. The external worker selects only rows linked to explicit provider-test authorization, never older batches or Phase F/G events. Staff Overview/Activity expose a disabled/test-mode banner. Configuring or enabling a transport cannot drain automated/bulk work.

## Worker lifecycle and failure safety

`communications-provider-worker` uses a server-only bearer; `communications-provider-admin` verifies the normal signed-in identity and exact origin and rechecks current organization permissions for verify/send-test. Both are runtime-default-off. Admin dispatch targets exactly the confirmed canonical message. Claims serialize using global then organization advisory locks, canonical leases/attempts and bounded selection. Immediately before transport, a separate authorize_external transaction rechecks every gate. This committed handoff is the linearization point: a disable or opt-out effective before it prevents send; a message already handed to SMTP cannot be recalled. Do not claim stronger physical recall semantics.

A stale lease before handoff can have one new owner. A stale lease after handoff becomes uncertain/failed and never automatically resends. Replay of a handed-off lease is rejected. Known transient rejection schedules bounded retry under existing max-attempt/rate architecture; permanent/uncertain failures retain the message and audit. Three consecutive transport failures suspend the profile and mark provider_error. Successful acceptance resets failures and records last success; failure/callback/verification timestamps and health states are non-secret. Unverified profiles are unknown/configuration_error, disabled/suspended profiles are clearly identified. No scheduler or live provider worker is activated in this build.

## Callback security and telemetry authority

`communications-provider-callback` is a bounded 8 KiB, default-off server endpoint. Routing begins with a server registry/profile, never a callback-supplied organization. A selected provider's audited verifier must validate its exact signature/token and timestamp/replay contract before returning a normalized event. The canonical binding is profile → organization → provider reference → outbox → successful attempt. Browser raw tables/functions cannot promote delivered, hard_bounce, complaint or undelivered. Duplicate event IDs produce one canonical transition; STOP/START/HELP reuse G preference protections, and START does not manufacture consent.

The runtime verifier registry is intentionally empty because no SMS vendor is selected and no Network Solutions structured callback contract is established. Unsigned/unimplemented callbacks fail closed and record a fixed validation_failed audit without body/secrets. Fake signed fixtures prove the contract, body bound, tamper rejection and canonical replay/race handling; they do not certify a real vendor webhook. Future provider integration must add a vendor-specific verifier, secret mapping and hosted signed acceptance before structured_callbacks can be enabled. No generic SMTP webhook is fabricated.

## Network Solutions review — October 9

| Requirement | Classification and evidence |
|---|---|
| TLS/authenticated SMTP | SUPPORTED as transport; existing metadata comes from the authorized assignment; separate Communications connectivity/From acceptance not executed |
| Communications transactional volume | UNKNOWN / REQUIRES PROVIDER CONFIRMATION for the actual mailbox SKU, permitted workload and rate/recipient limits |
| Provider message IDs | Stable RFC Message-ID supported by the client; Network Solutions queue/reference semantics UNKNOWN / REQUIRES PROVIDER CONFIRMATION |
| Structured delivery callbacks | UNKNOWN / REQUIRES PROVIDER CONFIRMATION; no validated webhook contract integrated |
| Bounces | Mailbox bouncebacks documented; machine-readable, signed callback support UNKNOWN |
| Complaints | Structured complaint telemetry UNKNOWN / REQUIRES PROVIDER CONFIRMATION |

[Cloud Mail FAQs](https://www.networksolutions.com/help/article/cloud-mail-upgrade-faqs) and [bounceback guidance](https://www.networksolutions.com/help/article/pbns-common-email-bouncebacks) do not establish bulk-business authorization or a signed delivery webhook for this exact account. The separate [Email Marketing app](https://www.networksolutions.com/help/article/email-marketing-app) is not evidence that this mailbox permits its volume. Overall review is PARTIAL / REQUIRES PROVIDER CONFIRMATION. Until authoritative telemetry exists, accepted SMTP messages remain sent.

## DNS readiness — no writes

Actual current account/domain alignment has not been certified. Obtain the account-specific SPF, DKIM selector/key and DMARC policy/alignment requirements and compare existing records before any separately authorized DNS edit. [Provider Cloud Mail DNS guidance](https://www.networksolutions.com/help/article/cloud-mail-dns-settings) lists SPF includes `spf.registeredsite.com` and `spf.cloudus.oxcs.net`; do not overwrite/duplicate an existing SPF record or assume that example applies to the current SKU. [DKIM guidance](https://www.networksolutions.com/help/article/adjust-dkim-settings) describes managed Cloud Mail DKIM; exact selector/current alignment still require account evidence. No invented TXT/key/DMARC policy or DNS change is supplied. Pending requirement: confirm exact approved From/reply-to, actual mailbox workload limits, existing SPF/DKIM and DMARC alignment. Auth mail must remain working.

## Future activation runbook — not executed

1. Obtain Chat approval for the exact environment/release and dependent migration chain; confirm current ledger and backups. Do not merge prerequisite PRs or replay already-applied migrations as a shortcut.
2. Apply only the reviewed new migration to the authorized environment. Confirm all previous grants/ledger preserved, every raw table/helper denied, global/org/channel switches off and no unexpected active Super Admin.
3. Bind the exact environment using the trusted service `bind_environment` action while globally disabled. Provision each exact approved sender metadata via trusted `provision`, disabled, with configured/sender_approved/structured_callbacks reflecting real evidence. Production_allowed remains false.
4. Under separate explicit authorization, grant only named provider capabilities on active, scoped staff assignments and bootstrap the exact Super Admin identity/expiry if required. Test revocation; do not infer grants from existing roles.
5. Configure the independent environment secret names above through approved secret storage. Runtime-enabled remains false. Never reuse an acceptance registry in production or copy Auth SMTP secrets implicitly.
6. Deploy only the reviewed H1 Edge Functions to the exact approved project. They perform their own worker, user/origin or vendor-signature validation; use `--no-verify-jwt` only for these reviewed endpoints so the platform legacy-JWT gate does not intercept their own validation. Do not change existing Auth or G endpoint deployment. No scheduler required for one test.
7. Separately approve the exact staff-preview HTTPS origin; configure its exact CORS entry. Turn on only the H1 runtime gate with global/profile sends still off. Perform backend-only SMTP verify. Recheck current authority, environment/revision, credential result and separate sender/domain ownership. Auth SMTP remains untouched.
8. Resolve provider limits, From/reply-to/domain authentication and consent policy. Obtain explicit Chat authorization of **exact sender, exact recipient and exact test template** for exactly one live email. Without it, stop with all sends off. SMS requires vendor selection/integration first.
9. Record existing canonical Person/purpose consent separately; add the exact approved expiring recipient. Enable organization/email and verified profile TEST ONLY, then global external control using explicit Super Admin. Normal G work remains held.
10. Preview the exact dedicated test, confirm once, dispatch its canonical request ID. Check outbox/attempt/provider acceptance and actual mailbox. If uncertain, reconcile rather than resend. A second message requires separate authorization; no test command loops over recipients.
11. If a selected vendor supports verified callbacks, run its separately approved signed/replay/tenant-binding acceptance. SMTP without such telemetry stays sent; actual mailbox delivery is external evidence, not a browser status write.
12. Disable global/profile/channel controls, remove/expire temporary allowlist entries, revoke temporary authority, disable runtime/remove temporary worker secrets as appropriate; preserve all message/attempt/audit history. Leave automations/bulk disabled.
13. Only a later exact production activation decision may authorize production_allowed and production_enabled for approved profiles. H1 still permits only explicitly authorized tests; broader message/automation authorization is another package/decision. Do not begin H2 here.

## Emergency shutoff and controlled resume

Explicit Super Admin: set global external delivery OFF immediately. Suspend the affected profile, then turn its organization/channel off and set COMMUNICATIONS_RUNTIME_ENABLED false if the endpoint/runtime is compromised. No queued record/audit is deleted. Inspect bounded status/attempt metadata and provider activity; preserve uncertain handoffs for reconciliation. Reverify credentials/sender under current permissions, diagnose limits/signature/consent causes, rotate only Communications secrets if needed, and obtain exact controlled-resume authorization. Restore only TEST ONLY for an approved single recipient first; leave automation/bulk off. Never reset Auth SMTP or delete immutable history to recover.

## Build validation and pending gates

Local full standard suite includes 30 inherited scripts plus H1 database/security, adapter/MIME/runtime and DOM suites. Six native PostgreSQL races use eight genuine overlapping worker backends plus a distinct coordinator/server barrier: duplicate test request, disable vs claim, consent revocation vs claim, concurrent enable, duplicate verified callback and stale pre-handoff lease recovery. Automated transport receipts are synthetic only. Deno checks all three Edge entry points. Public build uses the explicit manifest; tests, SQL, Edge secrets and private audit are excluded.

Disconnected real-browser renders cover Overview, Provider Settings, Test Send and Delivery Activity in disabled and test modes at 390/768/1440. Labeled controls, readable statuses, confirmation keyboard/Escape and focus restoration are checked. These are build evidence, not authenticated hosted or real-provider acceptance. Private screenshots/raw evidence stay outside the checkout.

Pending activation gates: Chat build review; isolated hosted migration/authenticated/API/race acceptance; independent secret/profile/permission approval; actual SMTP connectivity/approved From/domain/volume evidence; exact sender-recipient-template live-email authorization; real mailbox result; selected vendor signature contract if telemetry is required; SowGo sender approval; SMS vendor selection and later isolated integration. No real email/SMS/bulk sent. Production unchanged. H2 not started.
