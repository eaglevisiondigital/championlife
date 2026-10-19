# Current build state — Unified Outreach candidate

2026-10-18. Repository `eaglevisiondigital/championlife`, branch `codex/unified-outreach-production-v1`, exact starting production commit `e3157f0afa3f563ab6560ca64c9049448f02c806`. Issue #33 and the two PR #31 command documents govern this package. Earlier Huntsville-only release holds in these continuity files were stale; historical release evidence remains in Git and the private audit workspace.

Implemented in this candidate: one branded Champion Life/Outreach staff shell, context/campaign selection, source-preserving Bessemer campaign bridge and totals, decisions/shared follow-up/worker assignment, existing Huntsville family registration/check-in integration, Team/Travel, central partner assignment, church-local workers, pastoral notes, guardian-safe contact, scoped audited CSV, reports/settings, profile models, Sign Out and current-session clearing. No temporary acceptance-harness UI is reused as the product shell.

Accepted workflow, giveaway, Event Day, Host/pre-event and Communications/provider foundations were selectively extracted with their tests. Delivery controls remain disabled/unconfigured; no worker is deployed or scheduled. Leadership profiles are models only; the candidate's staff provisioning RPC rejects writes. Partner administration uses existing verified accounts and sends no invitation.

Four new forward migrations, in order:

1. `20261019004611_unified_outreach_staff_partner.sql`
2. `20261019004612_unified_outreach_workflow_foundation.sql`
3. `20261019004613_unified_outreach_operations.sql`
4. `20261019004614_unified_outreach_security.sql`

The 25 production migration files remain unchanged. Read-only live SQL checks confirm all 25 source SQL bodies: 24 raw MD5 matches and one historical final-newline difference. Three production ledger versions differ from repository filenames; preserve the live versions rather than repairing history. [Baseline mapping](docs/UNIFIED-OUTREACH-PRODUCTION-BASELINE.json) and the offline package builder stage 25 exact live versions plus four additions without connecting to any project.

Locally tested: complete production regression suite plus extracted module suites, integrated preservation/replay, six synthetic role boundaries, native PostgreSQL authorization and six genuine eight-worker registration races. Browser automation uses synthetic Auth transport and actual disposable SQL; 390/768/1440 layouts, 18 screenshots, product routes and current-session revocation were exercised. Detailed final results are recorded in the completion report. These are local results, not hosted Auth/Edge/Turnstile acceptance.

Primary coordination: the two child candidates overlap in shared shell/CSS, build/manifest/test files and continuity. The Outreach registry now uses the accepted NMI additive pattern; both local application orders preserve populated grants. Canonical shared-shell integration and final release sequencing remain primary-owned blockers. See docs/UNIFIED-OUTREACH-SHARED-COORDINATION.md. No sibling or primary outer continuity file was edited.

Hosted status: pending owner organization selection for a fresh isolated project. Existing Huntsville acceptance contains PR #29 under different migration versions and is unsuitable for exact-stack replay. No shared-acceptance change was made. The candidate branch's preview build fails closed until its exact isolated target is configured; it cannot silently use production or the old shared target. [Hosted runbook](docs/UNIFIED-OUTREACH-HOSTED-ACCEPTANCE.md).

Production-applied: none of this candidate. Production writes/deployments, merge, provider activation, real leadership/pastor grants and public/Giving changes: none. Read-only production Bessemer checkpoint remains 48 = 14 salvation + 9 rededication + 7 learn more + 18 prayer/ministry follow-up. All protected public/registration source bytes and registration function definitions remain unchanged in local integrated replay.

Approval: no production GO. Next action is the isolated hosted gate for this same candidate, then Chat review and a separate production GO package. Do not start Kids Check-In, Serve Teams, Worship or another release train here.
