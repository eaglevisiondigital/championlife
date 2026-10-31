# NMI four-MID merchant onboarding: Week of November 2, 2026

**Status: PREPARED — 0/4 MIDs independently verified in this project. No financial activation.**

Owner expects **four real merchant IDs (MIDs)** to be available Monday, November 2, or Tuesday, November 3, 2026. That is a provider-boarding forecast, not four verified active accounts. The original [NMI PR #34](https://github.com/eaglevisiondigital/championlife/pull/34) catalogs **five logical checkout routes**: Main, Youth, Outreach, Events and Merch. A logical fund/route is NOT automatically a distinct MID. More than one approved route may use a MID under the same legal merchant and approved transaction purpose. Never infer five MIDs or pool legal recipient/settlement between organizations.

This additive package is intentionally independent of payment runtime, Supabase, Netlify, PR #57 and the existing Giving branches. No one should copy actual MID numbers, access keys, bank details, tax IDs, vault references or gateway credentials into GitHub.

## 1. Exact intake inventory

Create a confidential **owner-controlled** four-row merchant/MID worksheet, with only opaque safe aliases `MID-01` … `MID-04` here.

For EACH MID privately confirm:

- merchant legal entity, approved EIN/signatory and recipient status
- acquiring processor, gateway account grouping, the actual MID identity, and permitted industry/transaction purpose
- destination settlement bank ownership (especially SowGo); currencies and descriptor
- accepted payments (card/ACH/wallet), recurring/vault/payment token support, refunds and disputes
- sandbox and live merchant credentials, hosted field settings, webhook verification/replay, API roles and MFA
- account-specific merchant/vault reuse rules; DO NOT assume tokens transfer across gateways
- receipt/tax acknowledgment legal name and authorized organizational finance access
- support contact, processor statement reconciliation and emergency new-charge-disable path

Keep approval evidence **private** and store only `VERIFIED/PENDING/UNAVAILABLE` status and non-secret merchant aliases in `docs/nmi-four-mid-readiness.template.json`. Do not mark a route enabled until independent evidence exists.

## 2. Five routes must map to four actual MID slots

| Logical public route | Intended product/source | Required legal recipient proof | Classification |
| --- | --- | --- | --- |
| Main | Champion Life | Church merchant/bank authority | Charitable contribution |
| Youth | Champion Life Youth | Church or separately authorized approved legal payee | Charitable contribution unless an individual event fee |
| Outreach | SowGo / Outreach | **SowGo legal merchant + SowGo settlement bank** as boarded | Charitable contribution; Soul Fuel is an Outreach campaign |
| Events | Event registration and ministry events | Merchant depends on specific event recipient | Fees are not automatically charitable |
| Merch | Merchandise | Merchant with accepted product/purchase use | Purchase, not automatically charitable |

SowGo settlement must not be inferred from a fund label alone. If its merchant boarding or legal authority is unverified, **leave Outreach/Soul Fuel disabled** rather than route to another charity's MID. If four MIDs cannot support all five routes under signed agreements, HOLD the unsupported routes rather than invent a fifth MID.

## 3. Checkpoints: NMI → ledger → controlled production

1. **Before credential connection:** Verify current main, accepted NMI PR #34 (`4e463f792bf9a2af03345e8854433e2d00863729`) and Shared Platform Gate 0 PR #36 (`bbadd2b4adf75a4342b653d57c81fac8aa86e74a`) are reconciled for exact permissions and migration order; do not merge old child branches wholesale.
2. **Safe isolated test:** Configure only a reviewed test environment and authorized test secrets outside Git. Default-disabled flags must remain OFF except the specified single test route; prove provider signature/authoritative lookup, exact amount/processor, idempotency, failed/ambiguous payment, vaulted recurring, webhook replay and refund/void controls.
3. **Accounting:** Match canonical source → provider transaction → immutable ledger → authorized recipient and settlement, with receipts held until real sender/receipt ownership approved. Gift/fee/purchase/DAF soft credit classifications must remain separate.
4. **GiveHub transition:** Privately obtain actual active recurring inventory and provider portability statement; never assume old payment profiles can be silently migrated or double charge a recurring donor.
5. **Live release:** Deploy one verified merchant and route, run a controlled charge and refund/reconciliation, audit incident/kill-switch, then enable other proven routes. No broad payment cutover based on credential possession alone.

## 4. Readiness gate automation (local and CI only)

`node tools/nmi/mid-readiness.mjs --selftest`

`node tools/nmi/mid-readiness.mjs` prints a factual `HOLD_NOT_BOARDING_VERIFIED` status for the unboarded template.

`node tools/nmi/mid-readiness.mjs docs/nmi-four-mid-readiness.template.json --require-ready` validates **full five-route readiness** and remains held while any route is unverified.

`node tools/nmi/mid-readiness.mjs docs/nmi-four-mid-readiness.template.json --require-pilot-route=Main` validates a **single approved one-time checkout pilot**. Other unused routes and their MIDs can stay held, and an uncompleted GiveHub recurring-token migration does not block a separate new one-time gift. The selected route still needs validated merchant ownership, settled recipient, hosted checkout, webhook, financial release and rollback evidence; recurring functionality requires a separately verified vault/legacy inventory.

These are **static contract validations**, not proof the gateway/bank is connected. Production checkout remains disabled until genuine provider and financial acceptance.

## 5. Actions for Monday or Tuesday

**Owner / NMI/ISO:** Deliver four real MID assignments, legal recipient identities, processor/gateway grouping, approved settlement accounts and supported API/token/recurring capabilities into the **private custody worksheet** (not GitHub).

**Engineering / Codex:** Reconcile accepted PR #34 with Gate 0, adapt the single-route NMI sandbox test to the actual boarded account, retain fail-closed flags and produce a fresh exact-head source/migration/integration report. Do not use the older PR #34 assertions as proof of a new provider result.

**Finance approver:** Independently review each merchant-fund-routing association and disbursement/tax receipt classification before any real money moves.

**Note:** This NMI lane is independent of OpenAI Support's unrelated general King Kind signup migration block. Do not attempt that migration from this branch or reuse payment privileges to bypass it.
