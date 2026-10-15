# Payment operations runbook — GIV-3D BUILD / held execution

This is an operational procedure foundation, not live activation authorization. No provider is connected. Actions record safe canonical requests and held work only. Never manually edit a financial record to make a screen look successful.

## Start with ownership and current access

Choose the financial organization explicitly. Champion Life and SowGo queues are distinct. Verify the session and original provider legs, donor and exact currency/amount. Reports-only leadership uses summaries; it does not gain method/refund/configuration authority. A staff account with both organization scopes must choose the intended owner. No fallback routes transfer payment ownership.

Use My Payment Work/Issue Queue to claim or assign an issue to current authorized finance staff. Ordinary declines use normal priority. Add safe internal notes without credentials, card/bank data, full provider payloads or donor-facing messages. Meaningful actions append an operator/time audit. Search supports safe identifiers and exact minor-unit amounts. Export is org/permission scoped and spreadsheet-formula neutralized; exported data remains private finance information.

## Unknown / duplicate / fraud

Do not retry an unknown payment. Read the attempt history and original leg. Use **Check Provider Status** to request original-account lookup. BUILD records held work only; a future trusted adapter must supply verified paid/failed/not_found/still_pending evidence. Observation is not financial posting. Paid or still-pending is not permission to charge again. A reviewed not_found/known retryable failure may permit an explicit held retry; current reconciliation is rechecked when work is claimed. Fraud, duplicate suspicion, invalid/expired method and configuration errors require remediation/manual review. Never treat a UI return, timeout, email or unsigned webhook as settlement proof.

## Partial checkout

Review the donor session separately from provider legs. State the amount processed, not processed and still unconfirmed. One donor-facing receipt may summarize only completed recorded financial activity; unresolved lines remain explicit. Do not label Main-success/Youth-failure/Outreach-success full success or retry successful legs. Resolve by reviewed leave-partial/contact-donor or a safe failed-leg retry request. Refund/void compensation requires its own original-leg eligibility, exact amount, permissions and approval; it is not automatic.

## Refund / void

Select original leg(s); each adjustment binds its immutable account/MID/transaction context. Enter full/partial exact amount and reason. The canonical remaining-principal reservation prevents over-refund. Current configuration cannot reroute a historical adjustment. Void is separate and unavailable after capture under the accepted canonical policy. Refund is required then. Maker/checker separation defaults on; a different currently authorized approver reviews the request. Only an explicitly configured policy may permit self-approval. Separate execute permission queues **execution_pending / held**. No payment is executed by GIV-3D. Rejections retain history and release reserved principal. A later trusted verified completion may produce a held refund-notice event; no donor message is sent here.

## Saved methods / recurring

Use provider-hosted entry only after a later provider activation gate. BUILD Add/Replace is held and collects no card/bank input. Display masked logical methods once, with explicit expiry/default/status. Expiry is through month end. Do not remove a method used by recurring work before reviewed compatible replacement mapping. Every original account/route must be covered; profile portability is never assumed.

Pause future Kingdom Propel execution without deleting the provider mapping. This does not stop an external subscription by itself: a future connected provider must acknowledge an update/cancel or receive a separately approved operational intervention. Resume requires current reviewed compatible method and resolved uncertainty. Cancel immediately or at the existing agreed end date. New amount/designation requests require effective date and a reviewed donor-authorization reference; BUILD stores a held versioned intent and preserves historical lines. Never silently alter the donor's agreement.

On failure, record one normalized idempotent failure event, increment the count, create an issue, and hold unsafe duplicate execution. Default policy is no automatic retry. Configured 1-day/3-day/custom offsets create held work only for retryable categories; a bounded maximum moves repeated failures to manual review/dead-letter. No infinite retry loop or developer database intervention is needed to see the issue/next action.

## Reconciliation / disputes / incidents

Compare canonical leg with safe provider observation and original batch: gross, fee, net, difference and state. Missing fees/net remain Unknown, never zero estimates. Handle missing transaction, amount/fee/net mismatch, duplicate mapping, unexpected MID, not-found and unmatched item as explicit exceptions. Authorized resolution requires type/reason/operator/time and preserves the mismatch. GIV-3D annotations cannot create ledger truth. Dispute queue captures known category/due date/route; full dispute-evidence submission is a later feature.

Record provider healthy/degraded/unavailable/maintenance/unknown with a safe reason. Unavailable/maintenance fail new checkout closed. Secret values never appear in incident UI. Missing/invalid/disabled gateway configuration creates a staff-only issue; resolving its annotation does not enable execution.

## Crash recovery

Work leases expire after five minutes. Recovering lookup can return held; uncertain retry/charge work enters review/dead-letter and requires lookup. Stale accepted provider operations retain the old token/history and create a new lookup task; do not clear the old token to allow recharging. Current staff permission and owner are checked before claim. No browser receives service lease tokens. These are local build contracts; a later hosted gate must prove real worker crash/restart, provider idempotency, account binding, lookup and cleanup with synthetic sandbox data.

## Notifications and tasks

Held owner-scoped finance events are compatible with later Communications Core consumption. Nothing sends automatically. Staff task intent must later resolve through the existing canonical task/work APIs and current explicit People/follow-up permissions; it never grants them. Never place internal finance notes or provider internals in donor messages. Live policies, sender routing, approval thresholds, retry offsets and consent sources require organization review.

## Review stop

BUILD tests do not authorize a merge, hosted acceptance, credential setup or live execution. GIV-3B NMI remains paused pending credentials; GIV-3C is accepted build and unchanged. Return to Chat for build review. See [implemented contracts](GIVING-GIV-3D-PAYMENT-OPERATIONS.md).
