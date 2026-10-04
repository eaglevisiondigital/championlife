# Champion Life engineering

This is the real `eaglevisiondigital/championlife` website/backend repository. Read CURRENT_BUILD_STATE.md, ARCHITECTURE.md, SECURITY_MODEL.md and DECISIONS.md before implementation. Existing module contracts in docs/ remain authoritative for detailed behavior; docs/RELEASE-LOG.md records historical deliveries.

Work on `champion-sowgo-backend-v1` unless explicitly assigned an isolated branch. `main` is production-controlled. Never merge, deploy, change production configuration/data, provision administrators or replace giving links without authorization for that action. Passing tests does not authorize release. Preserve unrelated working-tree changes and existing completed systems.

Champion Life is the church-facing brand; SowGo is its outreach arm with separate organization/financial boundaries. Discipleship and evangelistic tools use Powered by Lockliel; other modules use Powered by Kingdom Propel. Design reusable capabilities that Champion Life can consume from Global Propel when practical; no platform migration or cross-product identity/data merger is implied.

Migrations live in supabase/migrations. All 17 historical files through 20260926040812 are already applied remotely. Never reapply, renumber, rewrite or repair production history to accommodate local tooling. See docs/MIGRATION-BASELINE.md. Do not use a partial audit snapshot as an implementation checkout.

Run `npm ci --ignore-scripts --prefix tools/backend-tests`, then `npm test --prefix tools/backend-tests`. This includes full migration replay, existing database/redirect/persistence/DOM checks and application JS syntax. Tests use synthetic local data and need no production credentials. Add meaningful tests for permission/migration changes; retain all existing checks. Browser/Auth/SMTP/real-account acceptance is a separate release gate.

Never put credentials, raw audit evidence, private transcripts or customer records in this repository. Netlify publishes the explicit dist/ artifact; maintain tools/site-build/public-files.json and never add private/admin files to it. Keep local environment files and node_modules ignored. Do not change deployment behavior as part of documentation work.

After meaningful work, update current state and relevant contracts, record tests and unverified items, and provide the requested handoff report. Chat decides/coordinates; Work researches and validates external behavior; Codex implements/tests. Stop at an explicit review gate before starting the next package.
