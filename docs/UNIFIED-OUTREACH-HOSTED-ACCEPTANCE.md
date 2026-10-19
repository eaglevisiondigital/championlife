# Exact-stack hosted acceptance preparation

This reconciliation branch adopts final shared Gate0 source bbadd2b4adf75a4342b653d57c81fac8aa86e74a after frozen PR #35. Its offline package uses the explicit acceptance-migration-plan.json: unchanged four Outreach migrations plus the separately pinned Gate0 migration from3439e703ec5186e779f458ab5496afde611cc4aa. The shared-source chain and unchanged SQL provenance are recorded in UNIFIED-OUTREACH-GATE0-ADOPTION.md. A clean adopted head and explicit primary/owner authorization are required before any hosted use. Original PR #35 remains frozen.

Status: prepared offline; not installed or hosted-accepted. Primary coordination decisions and owner organization selection remain pending. Production changes remain none. Never use the old PR #29/shared Huntsville acceptance as proof of this five-forward-migration stack.

## Engineering package

Run only from the exact clean reviewed adopted candidate. Confirm PACKAGE.json has candidateWorktreeClean true and the expected candidateCommit/sourceCommits:

```sh
node tools/outreach-integration/prepare-acceptance.mjs /private/tmp/champion-unified-review-package-UNIQUE
```

The new output directory contains 25 migration files under their actual production ledger versions plus five explicitly pinned forward files and SHA-256 metadata. The builder verifies exact source commit/hash provenance, refuses any unreviewed SQL, checks all live SQL MD5s, handles the documented final-newline-only difference in the disposable copy and never connects to a database. It does not modify repository history or a production ledger.

After the owner selects the organization, create a fresh isolated project and record its exact reference. The creation tool requires owner organization choice and any nonzero cost approval. Keep production `exdocjbmylgxssanymjk` and existing acceptance `niyovbgoalulzkhbvebt` out of this installation. Do not share credentials in chat or Git.

Pin the new reference in `config/outreach/unified-acceptance.json` after primary review and extend the existing build allowlist/registration gateway acceptance guard to that one project only. Currently the candidate branch is deliberately blocked: no existing project is substituted. Configure only branch-scoped public browser URL/key. Preserve all production/default and other branch values.

Use supported Supabase CLI commands discovered with the installed version's help. CLI 2.121.0 exposes `init`, `db push --project-ref`, `--dry-run`, `--skip-vault` and `--workdir`. Initialize only the disposable package directory, restore the checked-in guarded automatic-RLS prerequisite if the fresh project requires it, then dry-run the explicit new project reference. Review all 30 versions/hashes before applying to that isolated project with `--skip-vault`. Never use migration repair, `--include-all` against production, seed replay or a default linked target. Verify the resulting catalog/ledger, exact registration function definitions, RPC ACLs, private Storage policies and advisors.

Deploy an unpublished preview for the exact candidate head, with an exact Auth callback allowlist and only the reviewed registration Edge gateway configured for the new project. Keep real Turnstile verification, exact allowed origin/hostname/action and rate controls. No communications/provider worker or cron activation. Record commit, deploy ID, project ID, reviewed migration hashes and `published_at: null`.

Create six confirmed synthetic Auth accounts through the isolated project's supported Auth administration, without email sends:

| Role | Required synthetic email | Expected authority |
|---|---|---|
| Full central leader | `leader-synthetic@example.test` | Champion Life + Outreach; both campaigns |
| Bessemer-only pastor | `bessemer-synthetic@example.test` | Assigned Bessemer church/records only |
| Huntsville-only pastor | `huntsville-synthetic@example.test` | Assigned Huntsville church/records only |
| Read-only staff | `readonly-synthetic@example.test` | Scoped viewing; no write/export inference |
| Follow-up staff | `followup-synthetic@example.test` | Separate workflow updates; original source immutable |
| Revocation test | `revoked-synthetic@example.test` | Open session first, then revoke current authority |

Keep temporary passwords/session material private. No Dave/Roddy/Tania/Kelsea/Chris identity is used as a permission fixture. Save only the six UUIDs in a private JSON mapping keyed `leader`, `bessemer`, `huntsville`, `readonly`, `followup`, `revoked`, then generate the fixture SQL:

```sh
node tools/outreach-integration/acceptance-fixtures.mjs /private/path/auth-user-ids.json /private/path/unified-fixtures.sql
```

This generator refuses an unpinned/production/shared target and emits SQL only. SQL requires fresh operational tables plus the exact verified synthetic Auth emails before creating any fixture. It creates an explicit 48-record synthetic Bessemer dataset, one synthetic Huntsville decision, scoped church assignments and test grants. No production data is copied. Review and apply only through an independently verified connector/CLI target. The companion cleanup SQL revokes the six synthetic identities; reverse test check-ins and close registrations using normal scoped RPCs before final cleanup. Preserve immutable synthetic source/legal/audit history.

## Required matrix and evidence

Use the [inventory matrix](UNIFIED-OUTREACH-INTEGRATION-INVENTORY.md#9-exact-isolated-acceptance-matrix). Required: 390/768/1440 px, current user/role, context/campaign switching and back navigation, keyboard/menu/Sign Out, no overflow/dead links; actual API/raw-table/RLS/Storage denials; cross-church/campaign UUIDs; unassigned-pool denial; local worker restriction; private pastoral omission from ordinary staff/CSV/audit; guardian-only contact; real scoped/formula-safe CSV download; current-session revocation and late-response clearing.

Publish only the reviewed legal snapshots in the isolated synthetic campaign. Submit 1+0, 2+3 and 3+5 synthetic families through real hosted Turnstile. Reconcile 3 households/6 adults/8 kids/14 people with staff totals and CSV; check in one adult and one child independently. Verify immutable waiver/media snapshots, final-slot concurrency, retry idempotency and separation of registration/check-in. Route selected household(s) centrally to the Huntsville test church and prove unassigned households remain invisible.

No fixture or production grant is created by this runbook itself. Hosted evidence must be collected from the exact installed candidate, not inferred from local SQL/browser fixtures. Cleanup must leave zero active synthetic grants and check-ins, intake closed, no active provider/worker/scheduler; keep immutable evidence. A separate production GO package is still required.

## Local reproduction

```sh
npm ci --ignore-scripts --prefix tools/backend-tests
npm test --prefix tools/backend-tests
npm run test:unified:native --prefix tools/backend-tests
npm run test:unified:browser --prefix tools/backend-tests
```

The browser command requires installed Playwright/Chrome; `TEST_PLAYWRIGHT_MODULE` may point at the bundled module. It uses local synthetic Auth transport and real disposable SQL, never a remote project. These local tests are not hosted Auth/Edge/Turnstile proof.

## Copyable Work assignment after the prerequisite gates

RECOMMENDED THINKING LEVEL: EXTRA HIGH

Validate Unified Outreach Production Candidate on its exact reviewed commit/draft PR and unpublished preview. Use only the newly approved isolated Supabase project and the exact 25 production baseline versions plus five reviewed forward migrations from PACKAGE.json. Stop if the commit, deployment, project or migration hashes differ. Use the six synthetic role accounts above; keep credentials private. Execute every historical-integrity, registration, authorization and UX row in the linked matrix on mobile/tablet/desktop, including actual Auth/API/Storage/Turnstile/downloads and revocation without logout. Record exact URLs, commit/deploy/project, evidence and pass/fail per row. Check that Bessemer synthetic originals remain exact, household counts reconcile and pastoral/minor data cannot leak. Close test intake, reverse check-ins, revoke synthetic authority and preserve immutable history. Do not change production, public routes/header, Giving, providers, real grants or other workstreams. Return PASS/PARTIAL/FAIL with blockers; hosted success does not authorize release.
