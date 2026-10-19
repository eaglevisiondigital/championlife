# Shared Platform Gate 0 — implementation and adoption contract

Status: bounded local reconciliation; no hosted or release approval. Base: `e3157f0afa3f563ab6560ca64c9049448f02c806`. Frozen NMI PR #34: `3a8317fb265c0cabb894133ac169100aaea83622`. Frozen Outreach PR #35: `bff9612ac9385cf963c5e7e41f9091da7af86cf0`. Later child work requires a new comparison and regression run.

## Proven root cause

The pre-additive Outreach Operations extraction contained two shared-list replacement blocks inherited from Communications G and H1. Each dropped/recreated `organization_staff_permissions_permission_check` with a narrower fixed list and replaced `private.staff_permission_keys()` accordingly. Neither preserved the already-installed Giving/Forms/Payments vocabulary. Exact full original SQL SHA-256: `69debbb2171c582782c820534c70c533ea79903977e08a144c0848b315186526`, 352254 bytes. Replaying that exact snapshot after NMI locally gives 70 before / 46 after / 41 removed (17 additions explain the net reduction of 24). With an existing `finance.gifts.read` grant, the check recreation raises SQLSTATE `23514` and aborts. This is destructive registry/constraint replacement, not a role-template or shell-projection root cause.

The original private SQL and replay output are preserved in the outer audit workspace. The committed focused regression retains the exact offending G/H statements. The final frozen PR #35 Operations SQL has SHA-256 `e6ebf423e395f65cac1d0e60913c6877c78bfdbbd193b714e7d9d56dc870ddfb` and already corrects those blocks additively. Gate 0 does not rewrite it or falsely label that final head as the old failure.

## Authoritative vocabulary and authority

`config/platform/capabilities.json` is the canonical scoped vocabulary: 87 organization keys, 36 campaign keys and 5 partner keys. Existing module authorizers remain authoritative for data access, prerequisites, dates, active state, organization, campaign and partner boundaries. Vocabulary is not a grant. No organization/campaign/partner scope translation, role expansion or automatic grants occurs.

The forward-only `20261019012735_shared_platform_gate0.sql` unions the organization vocabulary with the installed list, recreates the validated CHECK/function, and adds a non-public private catalog plus authenticated SECURITY INVOKER `shared_platform_context()`. That context delegates to existing authorized RPCs. It neither uses service-role identity nor creates business data, memberships or roles. Optional unavailable modules remain absent; denied optional contexts are null. All existing backend mutations/read authorizers and historical migrations are unchanged.

Future module migrations must preserve the installed union. Every candidate migration is checked for monotonic capability preservation during upgrade tests. This is a tested migration contract, not a claim that a database superuser cannot replace a constraint later. Legacy forms.view/manage does not imply newer Forms editing/payment capabilities.

## Ten overlapping files and final ownership

| Shared path | Gate 0 resolution |
|---|---|
| assets/js/staff-workspace.js | Primary composite shell: grouped NMI navigation/accessibility plus Outreach campaign/partner APIs. One shared authorized context, destination-specific permissions and build-manifest route availability; revocation clears protected content and rejects stale RPC results. |
| assets/css/staff-workspace.css | NMI common base, byte-preserved as the prefix of frozen Outreach CSS, with Outreach-scoped additions and minimal common control styles. Dark/gold active language retained. |
| tools/site-build/build.mjs | NMI config helpers plus primary candidate-target guard and explicit route injection. Three candidate branches cannot fall back to production or older shared acceptance. Targets remain null pending separate approval. Production configuration and public header bytes retained. |
| tools/site-build/public-files.json | Production plus common shell only in Gate 0. Child adoption uses explicit reviewed module lists; never filesystem discovery or private files. |
| tools/backend-tests/package.json | Production full default suite plus Gate 0. Frozen module scripts/dependencies retained in the contract and restored by explicit adoption tooling. No tests silently removed. |
| CURRENT_BUILD_STATE.md | Primary Gate 0 status prepended to production history. Both frozen child versions archived verbatim under docs/gate0-source-continuity. |
| ARCHITECTURE.md | Same preservation model; scope-separated context/registry and shared ownership documented here. No second identity, ledger or auth mechanism. |
| SECURITY_MODEL.md | Same preservation model; grants unchanged, backend enforcement primary, no privilege union. |
| DECISIONS.md | Same preservation model; bounded reconciliation is not module/release authorization. |
| docs/CHAMPION-LIFE-UNIFIED-PLATFORM-COMMAND.md | Identical approved source in both frozen candidates, retained once unchanged. |

Full source file hashes (180 NMI / 116 Outreach) are pinned in `config/platform/gate0-sources.json`. Core Auth/login, canonical People/Household code, Supabase connection configuration, public giving links and live Huntsville header are not changed. No business migrations/functions/pages from either child are added to this package. Disposable test composition is not a merged release candidate.

## Upgrade and regression evidence

- Exact old full snapshot reproduces both 41-key loss and populated-grant rejection; focused fixture runs in the normal suite.
- 82 upgrade assertions across seven Gate-first/between/last orders and both child orders, on PGlite and native PostgreSQL. Each individual child migration must preserve previous capabilities. All production-vocabulary synthetic grants and an existing role template remain JSON-identical. All 87 organization and 36 campaign keys validate in their proper scope; unknown and cross-scope keys fail.
- Read-only production grant census showed 7 organization key types across 14 grant rows and 5 campaign key types. The synthetic replay covers every baseline-valid organization key, a superset of that census, without copying real identities or modifying grants.
- 43 unchanged frozen Outreach role checks plus 14 combined finance/Outreach checks, on both engines: dual authority, tenant/campaign isolation, partner boundaries, pastoral denial, Bessemer/Huntsville separation and same-session revocation.
- 53 shared-shell DOM assertions: permission-filtered routes, safe campaign selection, late-response suppression and sign-out/revocation.
- 37 composition/build assertions: three module combinations, idempotent adoption manifests, 25 byte-identical historical migrations, explicit public files, private-manifest rejection, unchanged Auth/public header/config, candidate target fail-closed.
- Full baseline backend/site suite plus Gate 0 passed. Native upgrade is separately wired into CI; baseline CI still runs the existing native concurrency suite.
- Local Chromium: 42 checks and 16 screenshots at 390/768/1440, five synthetic permission profiles, real local SQL context with fictional Auth transport, keyboard drawer and actual SQL revocation. No console errors or horizontal overflow. This is not hosted acceptance or a fresh real login.

## Effect on children and exact adoption procedure

Both draft PRs remain untouched. Gate 0 is a dependency to reconcile, not permission to merge business packages. Pin the final Gate 0 commit recorded in the PR/handoff as GATE_SHA; do not use a moving branch tip. Before adoption require clean child checkout, the approved production base, exact frozen source checkpoint or a reviewed follow-up delta, and no production deployment hooks firing.

For NMI set MODULE=nmi; for Outreach set MODULE=outreach. On a temporary reconciliation branch from the child's reviewed head:

1. Fetch the exact Gate 0 commit, then `git cherry-pick --no-commit "$GATE_SHA"`.
2. Resolve the ten shared paths using Gate 0's versions, **only those paths**. Retain each child's non-overlapping module code/migrations/tests. Review any additional conflict; never blanket-select one side. The four frozen child continuity documents are preserved verbatim in Gate 0's archive; preserve later child deltas separately before resolution.
3. Run `node tools/platform/reconcile-manifests.mjs "$MODULE"`. This restores only the explicit module's public entries and scripts/dependencies. Run `npm install --package-lock-only --ignore-scripts --prefix tools/backend-tests`, review the lock diff, then `npm ci --ignore-scripts --prefix tools/backend-tests`.
4. Run `npm test --prefix tools/backend-tests`, `npm run test:gate0:native --prefix tools/backend-tests`, and the retained `test:frozen:nmi` or `test:frozen:outreach` suite. Existing module-specific security/race/Edge tests remain required. A frozen shared-shell/source-inventory assertion may identify an intentional Gate 0 delta: review and replace that exact expectation with the Gate 0 contract, preserving module/security assertions; do not skip the suite or broadly relax it. Gate 0 does not claim these adopted-child suites already passed.
5. Recheck protected-file hashes, SQL history, source inventory, organization/campaign/partner negatives, current-session revocation and responsive shell. Return exact reconciliation commit/diff/test evidence to primary before updating the child checkpoint. Do not deploy, migrate remotely, merge, activate payments or grant access.

A later combined disposable test can use `node tools/platform/compose-gate0.mjs /tmp/gate0-REVIEW nmi,outreach`. It requires a fresh directory and frozen hashes. This is a local test artifact only. Public preview targets are deliberately unpinned: target selection/configuration and hosted acceptance require separate authorization. No production auto-deploy is permitted by this contract.

## Newer NMI head detected at closeout

PR #34 advanced independently to `e39b83205d3086efa86a40d9a68e5306fc7eae8e`. Compared with the accepted checkpoint, it adds `20261019010048_nmi_sandbox_execution.sql` and `20261019010932_nmi_sandbox_recovery_reconciliation.sql` and changes the test package, public manifest and build script. Gate 0 results above are for the frozen checkpoint only. The adoption CLI refuses a newer HEAD rather than dropping its new entries. Reconcile this later delta before adopting on the current NMI branch; do not reset/rewrite that branch to force the guard. Outreach remains at the tested frozen head.

## Remaining gates

Fresh child adoption and CI at exact heads; later NMI engineering delta reconciliation; separately approved clean hosted target and functional hosted acceptance; real provider/merchant/settlement and finance/operator acceptance; receipts/recurring/cutover readiness; live header/Bessemer/GiveHub preservation checks immediately before release; owner-approved rollback and production actions. Gate 0 local passing does not convert either package into a releasable candidate.

Production, GiveHub, NMI execution, real user grants, public routes, hosted migrations and deployments: unchanged by this package. Kids Check-In, Serve Teams and Worship/CCLI are not started.

## Complete registry

### organization

`care.read`, `checkin.manage`, `checkin.view`, `communications.bulk_send`, `communications.delivery.view`, `communications.providers.enable`, `communications.providers.manage`, `communications.providers.test`, `communications.providers.view`, `communications.send`, `communications.templates.manage`, `communications.templates.view`, `communications.view`, `courses.manage`, `discipleship.read`, `dream_team.application.manage`, `dream_team.application.read`, `dream_team.application.restricted`, `dream_team.placement.manage`, `events.manage`, `events.view`, `finance.configure`, `finance.export`, `finance.gifts.adjust`, `finance.gifts.create`, `finance.gifts.read`, `finance.merchant.configure`, `finance.pledges.manage`, `finance.pledges.read`, `finance.read`, `finance.reconciliation.manage`, `finance.reconciliation.read`, `finance.recurring.manage`, `finance.recurring.read`, `finance.refunds.manage`, `finance.reports.export`, `finance.reports.merchant`, `finance.reports.read`, `finance.statements.generate`, `followup.manage`, `followup.read`, `forms.archive`, `forms.create`, `forms.edit`, `forms.manage`, `forms.payment.configure`, `forms.publish`, `forms.read`, `forms.submissions.export`, `forms.submissions.read`, `forms.view`, `households.manage`, `households.read`, `outreach.manage`, `outreach.view`, `payments.configure`, `payments.issue.assign`, `payments.manage`, `payments.method.manage`, `payments.provider.activate`, `payments.reconcile`, `payments.recurring.manage`, `payments.refund`, `payments.refund.approve`, `payments.refund.execute`, `payments.refund.request`, `payments.route`, `payments.view`, `payments.void`, `payments.void.approve`, `payments.void.execute`, `payments.void.request`, `people.create`, `people.export`, `people.notes.manage`, `people.notes.view`, `people.read`, `people.update`, `portal.manage`, `registrations.manage`, `registrations.override`, `registrations.restricted`, `registrations.view`, `staff.manage`, `staff.view`, `tags.manage`, `tags.read`.

### campaign

`checkin.manage`, `communications.bulk_send`, `communications.delivery.view`, `communications.send`, `communications.templates.manage`, `communications.templates.view`, `communications.view`, `decision.manage`, `decision.view`, `decisions`, `documents`, `draw`, `export`, `followup`, `host.respond`, `host.view`, `inventory.manage`, `inventory.view`, `issue.manage`, `ops.manage`, `ops.view`, `preevent.manage`, `preevent.view`, `prize.claim`, `prize.draw`, `prize.manage`, `prize.view`, `registration.export`, `registration.manage`, `registration.view`, `team.manage`, `team.view`, `travel.manage`, `travel.view`, `view`, `workflow`.

### partner

`partner.view`, `partner.followup`, `partner.assign_local`, `partner.export`, `partner.pastoral_notes`.
