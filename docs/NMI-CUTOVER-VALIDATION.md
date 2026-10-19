# Integration validation — local synthetic only

Base: `e3157f0afa3f563ab6560ca64c9049448f02c806`. Candidate identity: draft PR HEAD and offline bundle `MANIFEST.json`; no production release. No actual NMI network request or hosted deployment was made.

| check | result |
|---|---|
| `npm ci --ignore-scripts --prefix tools/backend-tests` | PASS; pinned dependencies, zero installation audit findings |
| `npm test --prefix tools/backend-tests` | PASS, 41 scripts: current-main regression plus all extracted Giving/Forms/NMI/Operations database, gateway, adapter and DOM suites; new preservation/integration and shell checks |
| `npm run test:giving-concurrency --prefix tools/backend-tests` | PASS, 11 race cases: eight GIV-1 plus rapid-batch replay and two statement cases |
| `npm run test:forms-concurrency --prefix tools/backend-tests` | PASS, six race cases |
| `npm run test:payments-concurrency --prefix tools/backend-tests` | PASS, six race cases |
| `npm run test:payment-operations-concurrency --prefix tools/backend-tests` | PASS, six race cases |
| `npm run test:nmi-concurrency --prefix tools/backend-tests` | PASS, six race cases |
| `npm run test:huntsville-native --prefix tools/backend-tests` | PASS, 95 registration + 56 Huntsville checks and six race cases; final slot one success/seven safe denials |
| `npm run test:concurrency --prefix tools/backend-tests` | PASS, existing independent PostgreSQL intake idempotency/rate-limit concurrency |
| Native race methodology | 41 Giving/Forms/provider/Operations/NMI/Huntsville cases, eight independent overlapping workers plus separate coordinator per case; synthetic temporary local clusters only |
| `npm ci --ignore-scripts --prefix tools/nmi-component` + `node tools/nmi-component/build.mjs` | PASS, pinned official SDK 1.1.1, reproducible bundle |
| `node --check` over assets JS, server MJS and package tool | PASS, 44 scripts |
| `deno check` new five Edge entrypoints | PASS: forms-submit, forms-file-access, payments-webhook, payments-nmi, payments-nmi-webhook |
| Source/preservation | PASS, nine extracted SQL source blobs; all 449 protected runtime/content/config/function/migration files match exact production base; 25 existing + 10 forward versions, no old chain |
| Bridge | PASS, unknown NMI result creates scoped Operations observation/issue; another charge denied; permission revocation denies; helper ACLs/RLS intact; zero real ledger posting |
| Public artifact | PASS, 462 explicit files; production bytes preserved, isolated preview blocks without config; docs/SQL/tests/private artifacts excluded; new page dependencies present |
| `git diff --check` | PASS |
| Hosted migration/advisors/browser/Auth/provider/receipt/settlement | NOT RUN; separate gates, no fresh hosted/browser proof claimed |

The first synthetic test run exposed missing Storage fixture metadata and a mistakenly listed test HTML fixture; both were fixed before successful full regression. The first native run was blocked by macOS sandbox shared-memory permissions; approved local-only rerun and final post-bridge rerun passed. No production database or network provider was involved.

Exact protected files and source lineage: `NMI-CUTOVER-PROTECTED-FILES.json`, `NMI-CUTOVER-SOURCE-COMMITS.json`, `NMI-CUTOVER-EXTRACTION.json`, `NMI-CUTOVER-MIGRATIONS.json`. Extraction manifest records original source hashes; migration-path references, installed staff return links, isolated shell discovery and build integration are deliberate candidate adaptations. Original NMI SDK asset remains reproducible.

Private local raw logs: `/private/tmp/nmi-friday-tests.log`, `/private/tmp/nmi-friday-races-final.log`, `/private/tmp/nmi-friday-deno.log`. These are not committed or publicly built. CI runs the same suite and races; remote CI is reported separately, never inferred from local results.
