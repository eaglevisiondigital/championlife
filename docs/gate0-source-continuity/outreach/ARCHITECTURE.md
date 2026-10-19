# Unified Champion Life platform architecture

Champion Life is tenant one. Outreach is a module in the same staff platform, using the existing Auth, Supabase database, People/Households and permission foundation. SowGo is its public brand. Existing Champion Life/SowGo organization records and financial ownership boundaries remain intact; this package does not merge databases, move to .NET, pool funds or introduce a separate Outreach backend.

The staff shell obtains one server-derived context describing authorized contexts, campaigns and modules. A restricted church user receives only campaign metadata and assigned-record workflows. Central staff use campaign-wide operational RPCs. Every mutation rechecks current database authority. The context selector is a presentation control, never an authorization grant.

Original decision rows stay in `outreach_registrations`. The campaign bridge stores source references, not duplicate contacts. Shared follow-up/worker state lives separately from immutable original decisions. Existing production Huntsville registrations, explicit household attendees, legal snapshots and check-in remain canonical; their production function definitions and gateway files are preserved.

Partner churches are campaign-scoped records. Central staff explicitly assign original decisions or registered households. Church-local membership and capability checks govern assignment detail, local workers, shared history, private pastoral history and scoped CSV. No partner is granted general People or finance authority by its membership.

Missing workflow/prize/Host/Event Day/communications dependencies are added forward after the production foundation; overlapping CREATE TABLE statements and the legacy Bessemer seed were excluded. Templates are versioned; external delivery remains unconfigured/disabled. The provider-neutral accepted source is present as dormant code, not an activated service. Native Giving work stays on its separate release train and the original GiveHub destination remains.

Netlify continues to publish only the explicit `dist/` artifact. Docs, migration staging packages, fixtures, tests and private evidence are excluded. Production public pages, registration header, routing and protected assets remain exact. The standalone historical acceptance route stays separate from the product UI.

See [integration inventory](docs/UNIFIED-OUTREACH-INTEGRATION-INVENTORY.md), [source manifest](docs/UNIFIED-OUTREACH-SOURCE-INVENTORY.json), [production ledger mapping](docs/UNIFIED-OUTREACH-PRODUCTION-BASELINE.json) and [hosted gate](docs/UNIFIED-OUTREACH-HOSTED-ACCEPTANCE.md).
