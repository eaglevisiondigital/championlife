# Current-main Giving integration — 2026-10-18

Production main at `e3157f0` supplies canonical People/Households, active staff permission registry, campaign identity and native Huntsville registration. Giving SQL requires only those existing shared objects; the old Outreach/Communications migration ancestry is excluded. Dependency extraction and exact forward order are in `docs/NMI-CUTOVER-INVENTORY.md`.

GIV-3B NMI and GIV-3D Operations remain provider-neutral siblings over GIV-3A and one immutable Giving ledger. A new private after-insert observation trigger maps NMI sale/authorization/capture/transaction results to the accepted Operations service, scoped to the original operation and leg. It never finalizes ledger entries or authorizes a retry. Vault/subscription/refund/void results are excluded from new-gift outcome projection. Generic webhook stays held; NMI uses its separate signed verifier. All accepted execution/production holds remain intact.

The extracted shell discovers only installed Giving/Forms/provider context; production shell/pages remain unchanged. Build adds only explicit module assets and original approved attribution logo. Offline acceptance packaging includes separately scoped SQL/functions/docs and a fail-closed static preview; never publish the bundle root. Existing production Supabase/Netlify and GiveHub remain authoritative until a separately approved release.

This is an integration foundation, not a completed production money path. Public anonymous execution, active recurring, delivered receipts, live posting and full reconciliation/executor wiring remain blockers described in the inventory. Hosted execution requires an approved clean target and reviewed exact guard pin; old shared/Huntsville targets must not be overwritten.

---

# Huntsville isolated architecture

The production baseline remains intact. Public config is anonymous and minimized; guest mutations enter only through the protected Edge Function and service-only registration gateway. Staff operations use the registration workspace RPC with campaign-scoped active/dated authority. Canonical household registrations, explicit attendees and immutable legal snapshots drive counts and separate check-in state. Campaign locking protects idempotency and final-slot capacity.

Phase A identity/audit helpers and the dormant participant identity required by accepted check-in are isolated from generic workflows, travel and prize operations. Exact edges, columns, constraints, origins and exclusions are in [the dependency inventory](docs/HUNTSVILLE-MINIMAL-DEPENDENCIES.md). The current production staff return route is retained; no unpublished platform shell is imported.
