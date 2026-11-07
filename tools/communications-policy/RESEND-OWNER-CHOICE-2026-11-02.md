# Resend isolated acceptance — owner choice, November 2

**NO-GO for execution; source remains accepted and disabled.** This is the decision
delta for source `02279e969c5d87e00eea70963c27c5835e11aa98`, not a new platform,
provider selection, installation approval or another runtime implementation.
Use the existing [host source boundary](RESEND-HOST-SOURCE.md) and
[acceptance procedure](RESEND-PROVIDER-ACCEPTANCE.md); do not repeat source approval.

## What new evidence resolves

Read-only connected Resend `get_usage` and complete `list_domains` results establish:

- Account limits currently show **50,000 emails/month, no daily cap, 10 domains**.
  The proposed 12-message maximum fits the observed unused email quota. Capacity
  must be rechecked immediately before an approved rehearsal; it is not reserved.
- `auth.championlifefwb.com` is verified, sending-enabled, receiving-disabled in
  `us-east-1`, with open/click tracking disabled. It is an existing **authentication
  domain**, not an approved general communications sender. Do not reuse it.
- The proposed `notifications.sowgo.org` is absent. The other existing domains serve
  unrelated authentication systems and are excluded from this rehearsal.
- The tools **do not identify the legal account owner/team, named plan, actual
  invoice/charge, overage setting or available webhook capacity**. Limits alone do
  not prove an executed Pro upgrade or a $20 charge. No key/webhook-secret, email
  content, contacts or campaign records were read. Private quota evidence is kept
  in the local operational-readiness audit, not published here.

Thus existing provider capacity is plausible; dedicated sender readiness and
actual billing/custody remain unproved. The published pricing reference remains a
comparison, not an account quote: [Resend pricing](https://resend.com/pricing).
No new subscription, paid resource, add-on or overage is approved by this document.
Network Solutions delivery-reconciliation support remains **unverified**, not
conclusively unsupported. It and Supabase Auth SMTP remain unchanged.

## Smallest proposed rehearsal decision

Choose **one existing organization and one dedicated sender** for the initial
rehearsal; no Global Propel tenant or second organization receives authority.
Recommended first scope: SowGo Outreach, if the owner confirms its account/domain
ownership and existing organization identity. This is a proposal, not a selection.

| Organization candidate | Proposed sender (not created/verified/approved) | Required independent binding |
| --- | --- | --- |
| SowGo Outreach | `outreach@notifications.sowgo.org` | Exact existing organization UUID, new exact H1 sender-profile UUID, owned sending domain and account/team ID |
| Champion Life Church, if selected instead | `outreach@notifications.championlifefwb.com` | Its own existing organization/profile, account/team custody and owned domain; no automatic reuse of SowGo authority |

Record the actual private From/Reply-To, verified mailbox ownership and brand
approval. Do not infer identity or consent from these proposed addresses. Each
later organization needs its own binding and review even if the provider account
is shared. Authentication senders, existing inbound MX and mail delivery remain
untouched. DNS records must come from the selected account after separate approval.

**Owner choices still required for a concrete execution approval:**

1. Select only the initial organization/sender above (or an exact owned alternative),
   and designate its account/billing owner. Confirm actual plan/charge, overage-off
   setting and an unused webhook slot privately; do not replace an existing hook.
2. Name the exact isolated database project, separately approved HTTPS host/route,
   accepted source/build/SQL baseline and expiration. None is assigned by this
   packet. The historical H1 project pin is not approval; a different target needs
   its own reviewed binding. PR #61's project/cost approval does not automatically
   authorize installing these additional communications migrations.
3. Record send-key, callback-secret and server-RPC custodians and secret-manager
   references/versions privately. Verify domain-restricted sending access; never
   place a full account key or database service key in a browser, CI artifact or
   public issue. The current service-role boundary has not proved a new limited
   database login. Exact host access and current schema must pass review first.
4. Name the test operator, independent shutdown operator on independent connectivity
   and a **separate cleanup verifier**, plus exact window and escalation contact.
   Proposed people are not accepted operators. Reuse existing witnessed capability
   only if it covers this actual host, provider key and callback shutdown path.
5. Approve a specific bounded send allowance only after the above evidence passes:
   **at most 12 explicit synthetic test messages, presently NOT AUTHORIZED**. Name
   the approved provider test addresses and at most two owner-controlled mailboxes
   in private custody. No ministry list, marketing batch, SMS or Auth email. Prior
   mailbox choices do not by themselves authorize this new communications test.
6. Fix incremental cost at **$0 unless an exact nonzero quote is separately approved**.
   Current invoice and unused host capacity are unknown; do not promise a free
   rehearsal. No plan upgrade, additional paid host, overage or auto-renewing resource
   may be created by relying on the proposed ceiling.

## Acceptance and stop criteria to bind to that decision

Use the already reviewed H1 dependency inventory plus the four uninstalled forward
communications corrections through `20261102154214`; compare actual schema/grants
first. The current provisioning path intentionally refuses Resend. Approved sender
installation therefore still needs a separately reviewed, exact procedure, not a
fixture UPDATE or a relaxed provision guard. Source presence is not hosted readiness.

The approved provider rehearsal must prove raw-byte MAC validation through the real
proxy, exact persisted provider UUID/account/org/profile/recipient/idempotency binding,
durable receipt-before-ACK, bounce/complaint suppression and duplicate replay.
Delivered means recipient-server delivery; owned inbox observation is separate;
neither demonstrates a person read the email. Do not claim vendor-simulated bounce
or delivery proves human inbox placement. Signed callbacks cannot reconstruct a
lost provider-ID binding; UNKNOWN stays held with no automatic send/requeue.

Stop immediately for scope/context/signature drift, missing commit evidence, lost
result, unbounded cost, unexpected recipient or inability to reach shutdown. First
stop new claims/handoffs and revoke only the isolated send key. Authentic receipts
for already handed-off messages may reconcile through their separately controlled
path; full ingress retirement returns no ACK. A submitted database transaction can
commit after HTTP timeout; replay must deduplicate rather than delete history.

Cleanup disables the isolated sender/allowlist/grants and scheduled work, removes
only rehearsal credentials/webhook/host resources, and verifies unchanged Network
Solutions, Auth SMTP, production and unrelated domains. Preserve UNKNOWN, attempts,
suppression and immutable audits under the approved retention rule. Provider body
retention is not erased by deleting an endpoint. The independent verifier records
remaining resources, cost and unresolved outcomes before acceptance is called PASS.

**Decision now:** approve or revise the single organization/sender and custodian
selection; complete actual billing, host and witnessed shutdown evidence. Then
review one hash-bound execution statement containing every value above. This is
not yet a runnable authorization and does not reopen already approved source work.
