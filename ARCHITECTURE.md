# Shared Platform Gate 0 — 2026-10-18

Bounded reconciliation from production `e3157f0afa3f563ab6560ca64c9049448f02c806`, frozen NMI PR #34 and Outreach PR #35. See [Gate 0 contract, evidence and adoption procedure](docs/SHARED-PLATFORM-GATE0.md) and [canonical scoped registry](config/platform/capabilities.json). This package adds one forward-only local migration, a shared context/navigation contract and upgrade/security/build regression tests. It does not merge the child business packages.

The historical 41-capability failure is reproduced and explained. The frozen Outreach candidate already uses additive lists; Gate 0 preserves and tests that correction in both orders with populated grants. No grant/template rows or existing authorization helpers are changed. Tests use local synthetic databases/browser transport; hosted acceptance and production release are not approved. Both frozen child versions of this document are preserved verbatim in `docs/gate0-source-continuity/`; the production history follows below.

No production change, GiveHub change, payment activation, hosted migration, real-user grant or deployment. Child adoption, later deltas, hosted/provider/operator acceptance and explicit release approval remain gates. Do not start unrelated platform modules.

---

# Huntsville isolated architecture

The production baseline remains intact. Public config is anonymous and minimized; guest mutations enter only through the protected Edge Function and service-only registration gateway. Staff operations use the registration workspace RPC with campaign-scoped active/dated authority. Canonical household registrations, explicit attendees and immutable legal snapshots drive counts and separate check-in state. Campaign locking protects idempotency and final-slot capacity.

Phase A identity/audit helpers and the dormant participant identity required by accepted check-in are isolated from generic workflows, travel and prize operations. Exact edges, columns, constraints, origins and exclusions are in [the dependency inventory](docs/HUNTSVILLE-MINIMAL-DEPENDENCIES.md). The current production staff return route is retained; no unpublished platform shell is imported.
