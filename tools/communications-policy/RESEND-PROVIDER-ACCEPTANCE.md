# Resend provider acceptance packet — held, November 2, 2026

This separate packet reviews source at `2fd5d95ca177938a4ca2b6ece81ebcec539bd94a`
and specifies the evidence needed before a separately authorized provider rehearsal.
It does not select Resend, install a host, grant access, authorize DNS/credentials,
send messages, or approve a paid resource. Source development is already authorized.
Network Solutions, Supabase Auth SMTP and production remain unchanged.

## 1. Source review and the exact remaining host boundary

The existing H1 outbox, attempts, consent, suppression, test allowlist and audit
remain authoritative. No second communications platform or configuration validator
is needed for this documentation package. A validator over self-attested account
fields would not prove real account custody, DNS or hosted acceptance.

| Layer reviewed | Existing behavior | Remaining acceptance evidence |
| --- | --- | --- |
| `activation.mjs` / H1 SQL | Explicit test confirmation; current actor, consent, suppression and allowlist checked at claim and handoff; cancellation and UNKNOWN holds | Actual authorized isolated host and exact test identities; no production records copied |
| `resend.mjs` send | Injected POST `/emails`; exact account/profile/From/Reply-To/recipient/body binding; stable API idempotency header; no network default/retries | Fixed HTTPS `api.resend.com` transport, account-scoped key custody, redirect denial, bounded responses/timeouts and genuine API evidence |
| `20261102150100` | Captures `resend_binding` on current attempt under `comm_external_lock`; original scope/content must still match on receipt | Complete current-schema release-stack reconciliation and separately approved forward installation |
| `resend.mjs` receipt | Raw Uint8Array, 8192-byte cap, Svix MAC before JSON, five-minute timestamp window; exact one recipient and known Resend UUID | Real endpoint, clock, unchanged raw bytes across hosting/proxy, genuine signatures and account-to-endpoint custody |
| Receipt SQL chain | Unique provider ID per org; current accepted attempt; exact account/context; atomic callback/suppression/audit; duplicate/conflict checks | Genuine end-to-end persistence and failure/rollback/replay evidence |
| Existing runtime | `resolve()` accepts SMTP only; callback verifier map empty; `provision` rejects `resend_email` | A separately reviewed host composition/configuration change; source adapter presence is insufficient |

The existing callback endpoint reads bounded UTF-8 **text** and invokes the generic
`verifiedProviderEvent` contract (`callback_external` / `reconcile_external`).
Resend requires bounded **bytes**, `resendReceipt(...)`, then the specific
`resend_receipt` RPC action. Generic Resend callback actions deliberately reject in
SQL. Merely adding a verifier to the existing map or setting flags cannot compose
the accepted Resend path. The future host must wire this explicitly, preserving
the byte cap before parsing and committing SQL before any successful HTTP ACK.
No fire-and-forget ACK, raw-event logging or extra queue is proposed.

The trusted resolver must select the exact organization/profile/provider/email-ID
and current accepted attempt from existing server storage, returning the required
scope, recipient, sender, purpose and canonical idempotency fields. It must reject
zero/ambiguous matches, never search by recipient/subject/time or trust payload
tags. SQL remains the final authority under its lock even after a correct lookup.
No current public RPC supplies this Resend resolver; source tests use fixture
storage. The least-privilege server access design must be reviewed before a host
is installed; do not grant browser/raw-table access to make a lookup work.

The existing runtime and SQL pin acceptance to `bkbmjisprwmkptywtmih`. This historical
pin is not authorization to use that target. The owner must name an authorized
isolated target; if different, a separately reviewed exact binding change is needed.
Do not label another target production to bypass the acceptance guard.

## 2. Owner evidence register — all values pending unless separately recorded

Record real values and evidence references only in approved private custody, not
this public repository, issue comments or chat. A blank or unverified item is NO-GO.

| Required decision/evidence | Exact record required | Responsible owner |
| --- | --- | --- |
| Provider scope | Resend rehearsal only / later production choice; specific organization and purpose; Network Solutions/Auth unchanged | Product owner / Chat |
| Account/team custody | Exact Resend team/account identifier matching `account_id`; legal owner; billing owner; MFA administrator and independent recovery custodian | Account owner |
| Isolation | Existing account usage/domain/webhook inventory reviewed privately; separate acceptance resources and no access to other product records | Account owner + security reviewer |
| Sender | Exact bare From mailbox and optional Reply-To; approved organization/profile UUIDs; displayed brand approval; receiving mailbox owner | Ministry owner |
| Domain | Exact owned sending subdomain, Resend domain ID/region, authorized DNS operator, SPF/DKIM status and DMARC review | Domain owner |
| Host | Exact isolated project, endpoint HTTPS URL and callback path, source SHA/build digest, provider webhook ID, approved test window | Host operator |
| Key references | Secret-manager references and versions only; domain-scoped sending permission; endpoint signing secret; no key values | Secret custodian |
| Permissions | Exact existing communications provider view/test/manage/enable assignments and global-control operator, with expiry; separate callback service custody | Security owner |
| Rehearsal | Named test operator, witness, independent shutdown/recovery operator, separate cleanup verifier and documented reachable paths | Coordinator |
| Budget | Plan, monthly ceiling, test-send ceiling, overage setting, host cost, expiration and person accountable for billing cleanup | Billing owner |
| Evidence retention | Private metadata location, retention/deletion decision, access list; provider retention/contents exposure accepted | Data owner |

No values above have been inferred from the site's brand/domain or historical
one-off Resend use. Champion Life and SowGo need separate approved identity/scope
records; neither inherits another product's account, recipients or IP/data rights.

Resend documents verified owned domains and recommends separate sending
subdomains. After approval, obtain **exact records from the selected account**,
check SPF/DKIM and DMARC alignment, and preserve existing mail MX/SMTP/Auth records.
Do not invent DNS strings, add a second root SPF record, or replace inbound mail.
The adapter sends bare addresses; display-name formatting and automatic Reply-To
normalization must be witnessed against actual event values before acceptance.
[Verified domains](https://resend.com/docs/dashboard/domains/introduction)

## 3. Credential, endpoint and maintenance custody

Use a `sending_access` key restricted to the approved sending domain if supported
and verified in the selected account. Pin the final restriction in private evidence.
The current API reference exposes `full_access` and `sending_access`; the latter
does not establish email-retrieval/admin authority. Never put a full-access key in
the send worker to make diagnostics easier. A separately approved operator may use
the dashboard or a separately held management credential for account lookup and
webhook maintenance. Do not claim a read-only API scope that has not been proved.
[API key permissions](https://resend.com/docs/api-reference/api-keys/create-api-key),
[domain restrictions](https://resend.com/docs/dashboard/api-keys/introduction)

Separate the send credential, per-endpoint signing secret, host worker credential
and database service credential. Browser code, application rows, CI artifacts and
logs receive none. The endpoint uses the signing secret, not the send API key, to
authenticate callbacks. Host service access stays server-only and limited to the
existing RPC boundary. The current implementation uses a privileged service-role
boundary; it does not demonstrate a new dedicated least-privilege database login.

Bind the selected secret reference to the same account/profile/environment as the
send key in trusted configuration. A payload has no independently trustworthy
account ID. A secret accidentally installed for another account cannot be repaired
by trusting tags. Review domain/account/endpoint identity and custody together.
Resend webhook create/get/list responses can include signing secrets: redact at
collection, before any diagnostic output or screenshots.
[Webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests)

Rotation rehearsal after separate authorization: stop new sends; record current
secret version and pending receipt counts; rotate only the acceptance endpoint;
install the new version through private custody; confirm a genuine event signed
under the new version; remove the old local version and verify denial of old-only
signatures. Resend documents a 24-hour dual-signature overlap. The adapter accepts
multiple `v1` signatures against one configured secret, not an indefinite old-key
keyring. Do not rely on this overlap for a compromised secret: isolate ingress and
follow the account incident process. Never rewrite old account/profile attempt
bindings during key replacement.
[Signing-secret rotation](https://resend.com/docs/api-reference/webhooks/rotate-signing-secret)

For send-key rotation, stop claims, install a replacement restricted key from the
same account, privately prove its restriction, then revoke the old key. Lost send
responses still stay UNKNOWN. Changing account or sender is a new reviewed profile
transition, not routine credential rotation.

Assign an operator to callback failures, clock skew, quota exhaustion, stale
UNKNOWN, credential/domain expiry and suppression discrepancies. The vendor retries
callbacks and can disable a repeatedly failing endpoint; replay availability and
retention must be checked on the selected plan. Callback retry is not an outbound
send retry. After an outage, replay events through verification and the durable
ledger, never recreate sends.
[Retries and replay](https://resend.com/docs/webhooks/retries-and-replays)

## 4. Lookup and UNKNOWN: precise limits

Resend's `GET /emails/:email_id` retrieves a **known** email UUID and `last_event`.
It does not establish the canonical message/attempt link by itself. Retrieval may
expose addresses and body content; retain only approved metadata, not a response
dump. This source package has no retrieval client or trusted reconciliation route
for an UNKNOWN Resend attempt.
[Retrieve sent email](https://resend.com/docs/api-reference/emails/retrieve-email)

If the API response is lost, no durable provider ID exists; even a genuine signed
callback cannot invent the missing binding. If result acknowledgement is lost or
the lease expires after handoff, preserve the hold. Do not search by address or
SMTP Message-ID, overwrite an attempt, patch rows to `sent`, or invoke the generic
reconciliation bypass. Account support evidence may inform later review; it is not
automatically consumable by the current source. No accepted/rejected lookup by our
canonical request ID has been demonstrated for Network Solutions either.

The API's 24-hour idempotency window does not authorize resending UNKNOWN, within
or after that window. Missing retrieval results, expired vendor retention, HTTP
409/429/5xx and timeouts are not definitive non-delivery. New policy/code for a
genuine fully bound recovery mechanism would require its own review.
[Idempotency contract](https://resend.com/docs/dashboard/emails/idempotency-keys)

## 5. Cost comparison for a decision, not a purchase

Public pricing checked November 2, 2026; selected-account eligibility, taxes and
actual invoice remain unverified. The observed transactional tiers are Free
$0/month (3,000/month, 100/day), Pro $20/month (50,000/month), Scale $90/month
(100,000/month); paid extra emails are listed at $0.90/1,000. Free has one webhook
endpoint; Pro five. Listed standard retention is 30 days. Test messages consume
quota. Confirm the current account plan and available endpoint before deciding;
never replace an existing webhook to fit the free allowance. No discount assumed.
[Pricing](https://resend.com/pricing),
[test-message quota](https://resend.com/docs/dashboard/emails/send-test-emails)

| Option | Decision value | Held limitation/cost |
| --- | --- | --- |
| Preserve Network Solutions | Existing mail remains unchanged; no vendor migration | Authoritative per-attempt UNKNOWN recovery unproved; existing contract cost not inspected |
| Resend bounded acceptance | Existing source supports signed receipts for known IDs | Account/sender/host installation and genuine tests pending; free quota may fit only if isolated capacity is available |
| Resend later production | Separate decision after complete acceptance | Volume, purpose, opt-out implementation, plan/billing and operational staffing need approval |

Proposed rehearsal ceiling: at most **12 distinct sends**, no automatic retries,
only approved provider test addresses and at most two specifically owned mailboxes;
zero paid upgrade/add-on/overage authorization. This is a proposed bound, not an
authorization. Hosted resources and DNS work require their own exact approval.
Keep pay-as-you-go disabled for the rehearsal unless an explicit different ceiling
is approved. Do not infer a hosted Supabase budget from a Resend free plan.

## 6. Genuine acceptance sequence — not executed

1. Close the evidence register and host-composition review; seal source SHA, exact
   schema baseline, config metadata and an explicit isolated rehearsal approval.
   Witness recovery/shutdown access before installing secrets or enabling ingress.
2. Install only the reviewed forward stack in the authorized isolated target:
   existing approved H1 dependencies, then `20261101214121`, `20261101231457`,
   `20261102150100`. Compare actual schema/grants first; do not replay production
   history, use direct fixture updates as provisioning, or copy production people.
3. With outbound flags false, validate exact host binding, unsupported provider
   refusal, missing/wrong secrets, invalid MAC, stale/future timestamp, wrong
   account/profile/org, altered BOM/bytes, malformed UTF-8 and >8192 bytes. Verify
   no successful audit/delivery change and no outbound call for each denial.
4. Authorize only the named synthetic adult test records and exact expiring H1
   allowlist. Explicitly preview/confirm each test. Verify consent, suppression,
   authority revocation and kill controls deny before a provider call. Test
   credentials alone do not imply consent or test permission.
5. Under the approved send window, send separate fictional payloads to the vendor's
   `delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev` test addresses
   (unique labels when supported). Correlate API UUID to the persisted current
   attempt; receive real signed events through the exact endpoint and final SQL.
   Confirm sent vs delivered semantics and durable bounce/complaint suppression.
   These are provider simulations, not proof of a human recipient or inbox placement.
   [Provider test addresses](https://resend.com/docs/dashboard/emails/send-test-emails)
6. Witness one optional approved owned-mailbox delivery only if explicitly in the
   12-send allowance. Record recipient-server delivery and operator observation
   separately. No event proves a person read the message. No contact list import,
   ministry recipient, marketing campaign, SMS or Auth message is authorized.
7. Replay one genuine event; require one durable callback/audit transition. Submit
   an altered copy and require rejection. Exercise callback-before-API-result
   persistence: initially reject unknown mapping, then vendor replay can succeed
   once the accepted result is durable. Never ACK an uncommitted event as success.
8. Using only approved isolated fault injection, lose the API response, lose result
   acknowledgement, and fail receipt persistence. Verify UNKNOWN stays held with
   no second outbound request and no forced UUID binding; SQL failure produces no
   partial receipt/audit/suppression. Provider callback retry may follow; sending
   never follows automatically. Stop if the host cannot safely inject these faults.
9. Prove disabled outbound delivery still permits authentic previously accepted
   receipts through the independently controlled receipt path. The present generic
   endpoint's shared `enabled()` gate does not demonstrate this host capability;
   the future composition must explicitly validate it. A security incident may
   intentionally stop ingress too, with receipt loss/replay handled by the operator.
10. Rehearse approved key rotation, operator shutdown and independent cleanup below.
    Report every unexercised genuine delayed/failed event and vendor-suppressed event
    as unverified. Current adapter supports only sent/delivered/delayed/bounced/
    complained/failed; it intentionally rejects opened/clicked and other types.

Current consent is purpose-specific and rechecked at handoff. It is not a complete
public marketing unsubscribe journey. The plain-text adapter adds no one-click
unsubscribe headers/endpoint. Bulk/marketing activation remains held for a separate
review of visible opt-out, purpose preference persistence, complaints and current
requirements; calling `/emails` does not change a message's purpose.

## 7. Stop, cleanup and evidence acceptance

The independently reachable operator must stop new claims using reviewed host and
database controls, revoke the acceptance send key, then disable/remove only the
acceptance webhook and remove its installed secret. Preserve unresolved outcomes
and canonical attempts. Record any callback delivery intentionally interrupted and
its private metadata disposition. Never clear UNKNOWN or suppression to obtain a
clean dashboard. Revoke synthetic allowlists/grants, disable synthetic profiles and
routes, remove acceptance credentials, and cancel any separately approved temporary
billing resources according to that resource's own cleanup plan.

The separate verifier confirms zero active rehearsal send paths, keys, webhook
endpoints, privileged sessions and scheduled jobs; quota/cost bounded; unchanged
Network Solutions/Auth SMTP, production deployment and unrelated domains/accounts.
Only specifically created acceptance DNS records may be removed under the approved
DNS plan. Preserve immutable metadata/audit per the owner's retention decision;
provider-held message bodies may persist under provider retention and are not
claimed deleted merely because a webhook/key was removed. No indefinite private
raw-payload collection is authorized.

Evidence must distinguish source tested, SQL installed, provider simulated,
owned-mailbox observed, cleanup independently verified and production approved.
Record SHA/build/config references, scenario outcomes, event/body hashes, redacted
provider/attempt linkage, counts, timestamps, operators and remaining holds in the
private evidence packet. Never store raw payload, content, secrets or addresses in
this repository. No production release is authorized by a rehearsal PASS.

## 8. Copy-and-paste assignments

**Chat / owner decision:** Review this held Resend provider-acceptance packet and
the unchanged accepted source at `2fd5d95ca177938a4ca2b6ece81ebcec539bd94a`. Source
development is already approved. Decide only the provider rehearsal scope/account,
organization-specific sender/domain, private custodians, exact isolated host/target,
operator/witness/shutdown/cleanup roles and cost/send ceilings in section 2. Keep
Network Solutions/Auth SMTP unchanged and production unapproved. Do not request
secrets in chat. Return an explicit bounded rehearsal decision only after the
uninstalled host composition and independent recovery gates are actually closed.

**Work / read-only provider validation:** Using only the owner's approved account
metadata access, verify exact team ownership, domain status, plan/available webhook
capacity, domain-restricted sending-key capability, maintenance/rotation behavior
and a genuine authoritative lookup contract. Capture only redacted metadata and
official source links in private custody. Do not create keys, alter DNS/webhooks,
read customer message contents, send mail, purchase resources or switch providers.
Separate documented vendor behavior from account-specific witnessed evidence.

**Future Codex host task, separately scoped:** Compose the accepted adapter with
the approved existing host, bounded byte ingress, persisted-ID resolver, account
transport and exact H1 RPCs after those choices exist. Keep activation false and
test with synthetic injected IO first. Review permissions, endpoint ACK behavior,
receipt independence from outbound kill, migration stack and genuine acceptance
matrix before requesting any hosted action. Do not relax UNKNOWN, repurpose the
generic callback route or implement a parallel queue/configuration platform.
