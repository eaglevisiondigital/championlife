# NMI Giving sandbox execution follow-up — October 18 CDT / 19 UTC, 2026

Primary authority remains **Align Codex with Champion Life**. This is a bounded Giving follow-up to frozen draft PR #34 head `3a8317fb265c0cabb894133ac169100aaea83622`; no restart, merge or historical SQL rewrite. Production Git main is still `e3157f0afa3f563ab6560ca64c9049448f02c806`. Primary independently confirmed the live 25-row baseline; source attribution and all hashes are in `docs/NMI-CUTOVER-PRODUCTION-BASELINE.json`. No production inspection/write is claimed by this child.

The execution layer reuses canonical Giving sessions, immutable lines/legs, ledger, recurring instructions, receipts, People/Households and Payment Operations. It adds private RPC-only checkout capabilities, single-use attempt leases/results, scoped vault/subscription bindings, recurring-charge dedupe, held receipt outbox and batch/evidence projections; no parallel donor or money ledger. Verified donor household links extend the existing private account link. Guest recurring permits a NULL canonical Person only with an explicit guest checkout FK. Original contribution tax classification is frozen for recurring renewal gifts.

`nmi-giving` supplies anonymous checkout plus Auth-verified staff execution; `nmi-giving-webhook` verifies raw gateway HMAC then requests independent Query lookup. V5 mutations/subscription GET and Classic Query transport use fixed sandbox hosts. Browser/sale/webhook status never authorizes a gift by itself. A frozen private merchant/MID/settlement proof fingerprint binds each prepared checkout in addition to canonical revisions. Staff, verified-donor and checkout-capability authority are tracked separately and rechecked before handoff. Unknown/stale outcomes stay pending; transaction/order lookup resolves the original intent without a second charge. Recurring creation posts zero gifts; an independently matched subscription charge posts to the same ledger. Actual next charge dates are not guessed.

The new page is a module host, not a replacement unified staff shell or a separate SowGo application. This package leaves shell/CSS bytes at the frozen checkpoint. Primary must integrate the common shell, permission union, Forms, build guards/manifest, Communications held delivery and release order. The offline bundle stages the confirmed applied baseline names/hashes plus 12 forward files; it does not repair repository or hosted history.

---

Historical frozen integration/earlier platform checkpoints follow; the execution follow-up above supersedes their held engineering status.

# Current-main Giving integration — 2026-10-18

Production main at `e3157f0` supplies canonical People/Households, active staff permission registry, campaign identity and native Huntsville registration. Giving SQL requires only those existing shared objects; the old Outreach/Communications migration ancestry is excluded. Dependency extraction and exact forward order are in `docs/NMI-CUTOVER-INVENTORY.md`.

GIV-3B NMI and GIV-3D Operations remain provider-neutral siblings over GIV-3A and one immutable Giving ledger. A new private after-insert observation trigger maps NMI sale/authorization/capture/transaction results to the accepted Operations service, scoped to the original operation and leg. It never finalizes ledger entries or authorizes a retry. Vault/subscription/refund/void results are excluded from new-gift outcome projection. Generic webhook stays held; NMI uses its separate signed verifier. All accepted execution/production holds remain intact.

The extracted shell discovers only installed Giving/Forms/provider context; production shell/pages remain unchanged. Build adds only explicit module assets and original approved attribution logo. Offline acceptance packaging includes separately scoped SQL/functions/docs and a fail-closed static preview; never publish the bundle root. Existing production Supabase/Netlify and GiveHub remain authoritative until a separately approved release.

This is an integration foundation, not a completed production money path. Public anonymous execution, active recurring, delivered receipts, live posting and full reconciliation/executor wiring remain blockers described in the inventory. Hosted execution requires an approved clean target and reviewed exact guard pin; old shared/Huntsville targets must not be overwritten.

---

# Huntsville isolated architecture

The production baseline remains intact. Public config is anonymous and minimized; guest mutations enter only through the protected Edge Function and service-only registration gateway. Staff operations use the registration workspace RPC with campaign-scoped active/dated authority. Canonical household registrations, explicit attendees and immutable legal snapshots drive counts and separate check-in state. Campaign locking protects idempotency and final-slot capacity.

Phase A identity/audit helpers and the dormant participant identity required by accepted check-in are isolated from generic workflows, travel and prize operations. Exact edges, columns, constraints, origins and exclusions are in [the dependency inventory](docs/HUNTSVILLE-MINIMAL-DEPENDENCIES.md). The current production staff return route is retained; no unpublished platform shell is imported.
