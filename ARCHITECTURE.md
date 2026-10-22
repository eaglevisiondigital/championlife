# Huntsville isolated architecture

The production baseline remains intact. Public config is anonymous and minimized; guest mutations enter only through the protected Edge Function and service-only registration gateway. Staff operations use the registration workspace RPC with campaign-scoped active/dated authority. Canonical household registrations, explicit attendees and immutable legal snapshots drive counts and separate check-in state. Campaign locking protects idempotency and final-slot capacity.

Phase A identity/audit helpers and the dormant participant identity required by accepted check-in are isolated from generic workflows, travel and prize operations. Exact edges, columns, constraints, origins and exclusions are in [the dependency inventory](docs/HUNTSVILLE-MINIMAL-DEPENDENCIES.md). The current production staff return route is retained; no unpublished platform shell is imported.

## Isolated theme-song feature

The static Outreach feature and unlisted sharing page use one shared player implementation. A separate default-disabled Netlify Function performs transactional analytics in a proposed dedicated PostgreSQL counter database. No Supabase client, ministry records, auth/permission grants, registration or payment API is involved. Provisioning is manual and separately gated, never part of the site build. See [contract](docs/THEME-SONG.md).
