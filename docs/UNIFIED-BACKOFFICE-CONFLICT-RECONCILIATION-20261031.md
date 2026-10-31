# Champion Life / SowGo unified backoffice — exact-current-main reconciliation

**Date:** October 31, 2026  
**Status:** Draft source inventory and integration instructions ONLY. No backend, browser runtime, migration, credential, staff grant, financial operation or published site was changed.

## The problem to resolve first

The previously accepted modules exist, but their development PRs are **not independent merge units**:

| Source | Latest checked head | Purpose | Relative state |
| --- | --- | --- | --- |
| Champion Life current main | `bfb7af214707db73a3a3164bc96ccafae7de8ccf` | Published website baseline, current existing staff and Huntsville operations | Production |
| PR #34 | `4e463f792bf9a2af03345e8854433e2d00863729` | Native NMI Giving/finance/payment operations | Draft, disabled |
| PR #35 | `76c328c507460406218f4aff279d3ce3467c9710` | Unified Outreach/campaign/team/partner/event-day operations | Draft |
| PR #36 | `bbadd2b4adf75a4342b653d57c81fac8aa86e74a` | Shared Gate 0 / additive permission vocabulary and authorized shell | Draft |
| PR #57 | `3f03fd4b46f405cb8d5926519a8fa573242a7d1b` | Independently reviewed King Kind/resource signup | Draft, **separate safety block** |

**Machine-readable inventory:** `docs/unified-backoffice-source-overlap-20261031.json`, generated from the exact changed-file lists, finds **42 paths touched by two or more of these four PRs**. This is a *path-level overlap inventory*, not proof that content conflicts on every one; do not overwrite a file just because it appears in two PRs.

## Actual highest-risk shared paths

- `assets/js/staff-workspace.js` and `assets/css/staff-workspace.css` occur across PRs #34/#35/#36. The final shell must combine **finance visibility, Outreach campaign navigation and current-user/logout/revocation**, without enabling a module simply because it appears in navigation.
- `config/platform/capabilities.json` and `supabase/migrations/20261019012735_shared_platform_gate0.sql` are shared across #34/#35/#36. Gate 0's **additive** vocabulary must never remove installed Giving, Forms, Payments, Church or Outreach keys. Installed permissions remain the source of truth; a catalog key is not an actual grant.
- `config/platform/acceptance-targets.json` and build/test manifests must fail closed if an exact acceptance project/preview isn't selected. Never substitute production or an old shared acceptance project.
- `tools/backend-tests/package.json`, `tools/site-build/build.mjs` and `tools/site-build/public-files.json` overlap **all four**. Merge allowlists and runnable suites deliberately, not by blanket choosing a branch.
- `staff-people.html` and `staff-outreach-registration.html` overlap #35/#57. Preserve the existing **Powered by Propel** logo/link, restricted staff protections, signed-in user and logout.
- `ARCHITECTURE.md`, `CURRENT_BUILD_STATE.md`, `DECISIONS.md`, `SECURITY_MODEL.md` overlap **all four**. Preserve dated decision history; current release status is a new note, not replacement of older evidence.

## First local implementation slice — P1 unified shell, not a full backend rewrite

1. **Freeze original inputs:** Pin current Git main and exact accepted PR heads plus all reviewed local Gate0/Outreach source manifests and tests. Preserve checked-out source, original evidence and historic SQL. Baseline evolved after the older #34/#35/#36 PRs; re-check actual migration ledger, private function source and current capability grants before forward SQL planning.
2. **Reconcile single shared shell on a new integration candidate** from the latest main, *without touching* PR #57. Use Gate0's reviewed composition instructions, review each overlapping shared file and apply the smallest required differences; do not run wholesale historical PR merges.
3. **Basic shell acceptance:** One login/current identity and Sign Out, Champion Life vs Outreach context, permitted campaign selector and responsive navigation. Denied user gets no module mount. After logout/revocation, clear private DOM and stale responses; no foreign organization/campaign read by guessed URL/UUID. Validate working back and mobile drawer.
4. **Registration unchanged:** Keep live Huntsville event registration/waivers/check-in intact and separate from Bessemer and Huntsville decisions/free-book registrants. Live counts last checked: **344 Huntsville event records, 14 Huntsville decision registrations and 48 Bessemer decisions**. These are observation baselines; re-query at acceptance.
5. **No authority expansion:** Aldo and Pastor Robert are approved conceptually for Huntsville event registration **view/manage/check-in/export**, but no authenticated identity-based audited assignments are active; never grant by name or copy another campaign's assignment. No donor, partner admin, private pastoral-note, learner answers or adult-evidence scope.
6. **Source review:** Build the known suite with all permitted child tests and an explicit manifest; run local Native PG + Chromium/WebKit, module visibility/permission negative tests, current-session revocation and responsive checks. Present one small first shell candidate and its independent review before any release.

**Stop if** the combined permission catalog removes active keys, signed-out staff can access pages, foreign-campaign rows or child waiver data leak, financial staff routes appear without finance authority, PR #57 client privacy/SRI fixes are overwritten, or published branding/routes change unintentionally.

## Subsequent reviewable slices

**P2 Event operations** — Huntsville registration/roster, check-in/reversal, exact-scoped exports, audit, user activation only with verified account and finite scoped grant. This is separate from advanced Decisions/Follow-Up.

**P3 Outreach campaign operations** — Bessemer source bridge, campaign dashboard, host intake, Team/Travel, Event Day checklists/inventory, giveaway/drawing control. Reuse PR #35 without blindly importing unused/sensitive features.

**P4 Partner Church workflow** — Approved church/campaign/worker assignments, staff-only outreach/follow-up view, guardian/minor and pastoral-note separation, revoke-and-test. No automatic general membership or partner/finance permissions.

**P5 Decisions & care** — Campaign-owned source decisions, assigned pastoral contact attempts/outcomes, consent and next action, exact book/course engagement truth. Preserve the unreleased adult-sensitive follow-up package as a **distinct gated feature**, not a blocker for basic event operations.

**P6 Communications & NMI** — Shared authorized shell for consent-checked email, SMS later with separate opt-in, and independently approved finance modules. NMI integration dependency belongs to [PR #34](https://github.com/eaglevisiondigital/championlife/pull/34) and the nonproduction [four-MID PR #59](https://github.com/eaglevisiondigital/championlife/pull/59).

## Acceptance checklist for the next Codex local review
- [ ] Pinned current-main SHA and exact child source hashes checked
- [ ] 42 overlap paths classified (identical vs conflicting vs documentation/test-only)
- [ ] Shared permission catalog monotonic, historic grants preserved
- [ ] One explicit reviewed shell/manifest owner with runtime scope narrowly identified
- [ ] Existing production login, staff pages and Huntsville event flows preserved
- [ ] Revoke/logout/account-switch and cross-campaign/finance-denial tests PASS
- [ ] Mobile/tablet/desktop shell PASS with no horizontal overflow or dead routes
- [ ] Independent code diff and minimal forward migration/rollback inventory provided
- [ ] No provider, production, real staff, payment or blocked King Kind migration execution

**This is a development handoff, not authorization to touch production.**
