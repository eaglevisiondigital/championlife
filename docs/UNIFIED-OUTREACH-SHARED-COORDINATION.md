# Shared-file coordination checkpoint — 2026-10-18

The primary Codex chat **Align Codex with Champion Life** remains authoritative for shared architecture, shell, permissions, migration order and release decisions. This branch is a bounded candidate only. This checkpoint documents overlap before further shared-file edits under the user's coordination rule. Earlier edits preceded that rule; they remain isolated and reviewable here.

Fresh remote verification: production `main` is still `e3157f0afa3f563ab6560ca64c9049448f02c806`. NMI candidate inspected read-only at `3a8317fb265c0cabb894133ac169100aaea83622`, branch `codex/nmi-giving-friday-cutover`. No other worktree was edited. [Exact overlap/hashes](UNIFIED-OUTREACH-SHARED-OVERLAP.json).

| Shared surface | Outreach proposal | NMI proposal | Primary integration requirement |
|---|---|---|---|
| `assets/js/staff-workspace.js` | PR #29-derived Champion Life/Outreach context, campaigns, partner scoping and revocation | Finance shell discovering installed Giving/Forms | Choose one shared shell contract and compose both navigation/capability projections. Do not overwrite either file wholesale. This branch does not establish a second approved shell. |
| `assets/css/staff-workspace.css` | Scoped Outreach product layer and responsive contexts | Finance shell style layer | One shared design owner; reconcile base tokens/layout and retain module-scoped additions. |
| `tools/site-build/build.mjs` | Pending exact isolated-target guard for this branch | NMI-specific build additions | Preserve both build paths; no default production fallback or public provider configuration. |
| `tools/site-build/public-files.json` | Additive staff/Outreach artifacts; original public surfaces preserved | Giving/Forms/NMI artifacts | Set union with path/credential isolation checks, not file replacement. |
| `tools/backend-tests/package.json` | Existing production + Outreach replay/security/module suites | Existing production + Giving/Forms/NMI suites | Union scripts and pinned dependencies; do not lose either regression gate. |
| Four continuity files | Outreach candidate facts | NMI candidate facts | Primary maintains combined truth; child reports remain package-scoped. |
| PR #31 command document | Exact accepted source | Same command source | Identical bytes; preserve once. |
| `private.staff_permission_keys` and permission CHECK | Accepted Communications source adds its capability registry | Giving/Forms/payments source adds its registry | The older Outreach extraction initially replaced the registry; NMI already uses an additive union. Outreach now adopts that accepted pattern. Both upgrade orders retain populated grants in local SQL; primary still reviews the final vocabulary/order and combined product integration. |

Auth/login pages, production Supabase browser config, People/Household implementation, logos, Giving routes and NMI configuration remain byte-identical to production in this branch. Outreach Giving links to the existing documented destination; it does not replace Giving or finance navigation. No Forms engine is imported here.

Migration namespaces do not collide: NMI's ten additions currently span `20261019002847`–`20261019003215`; this candidate's four are `20261019004611`–`20261019004614`. Chronological ordering alone is not integration proof because shared contracts and release order remain primary-owned. The actual 25-version production mapping is separately documented, with no history repair.

Primary decisions still required: canonical shared-shell API/design; review of the additive permission-registry adaptation and broader combined runtime acceptance; final migration/release order; whether hosted projects are separate or a later combined candidate receives a new exact-stack target. Neither candidate's independent tests authorize combined release.

Continue only bounded Outreach work/tests/docs here. No NMI worktree edit, primary-register overwrite, production mutation or release is authorized. Final child handoff will include exact source commits, candidate file manifest, four migration hashes/order, tests/browser evidence, draft PR and hosted blockers.


## Post-checkpoint bounded compatibility proof

Outreach's two registry definitions and two CHECK additions now append to the currently installed registry using the accepted NMI pattern. No NMI source, grant or worktree was changed. At exact NMI commit `3a8317fb265c0cabb894133ac169100aaea83622`, both NMI→Outreach and Outreach→NMI replays preserve every pre-existing capability and populated synthetic grant (8 checks PASS). This is optional local migration compatibility evidence, not a merged application or hosted release. Existing legacy `forms.view/manage` and native `forms.read/edit/...` remain distinct; no permission alias or policy was invented.

People/Households: existing foundation and production RPCs are preserved; no second People database. This branch's only identity UI is the existing Auth plus scoped campaign/partner workflows. Forms: no builder imported or altered; Host agreement schemas remain the accepted Host feature. Communications/receipts: Outreach's held `communication_*` model and NMI's `giving_receipts`/statement communication references still require the primary delivery/receipt contract; no bridge or duplicate send worker is activated here. Edge function additions use `communications-*` names and `_shared/communications/`, with no collision against NMI's `payments-*`, `forms-*`, `_shared/payments/` and `_shared/giving/`; both existing Outreach gateways are protected. Global Propel: preserve existing organization/identity/Person/Household/campaign/audit contracts, with no database/runtime migration or cross-product data pooling.

The two differing staff-shell implementations remain a release blocker owned by the primary thread. The candidate shell here is a review proposal for the same shared platform path, not a second approved product. No production authorization follows from this compatibility proof.
