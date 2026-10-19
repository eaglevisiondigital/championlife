# Unified Outreach integration inventory — 2026-10-18

Status: inventory completed before application extraction. Candidate only; no release authorization. Issue #33 and PR #31 command documents govern this assignment. Production and requested integration branch both resolved to `e3157f0afa3f563ab6560ca64c9049448f02c806` at preflight.

## 1. Exact sources

The machine-readable [source inventory](UNIFIED-OUTREACH-SOURCE-INVENTORY.json) records full commits, migration paths, pages, Edge Functions, differences from production and SHA-256 preservation requirements. It contains no customer records or credentials.

| Accepted source | Commit | Extraction decision |
|---|---|---|
| Campaign Core | `098a87b061e7ffad53ae86f76d750a5aacfbc935` | Add missing workflow objects only; existing production campaign/registration objects win. Exclude legacy bulk seed/import. |
| Team and Travel | `79404bb5648af269bbaea1604aed4891c507e2c3` | Use current-main adaptation in PR #29; retain source contract/tests for comparison. |
| Native Registration/Check-In | `2c57b1ec0e1407d750b052cc22bbe9b4dc86e418` | Already selectively released through Huntsville minimal package. Preserve production SQL, gateway and public UI. |
| Prize/Giveaway | `d899616a81df2a62a2957db074966073310b02c0` | Extract missing dormant integrity/operations after production attendee identity. No enablement. |
| Event Day | `f41ab24dc256145fa37b9516c1aae2ef7a602a37` | Forward extraction after workflow/prize dependencies. |
| Host/Pre-Event | `7b883ca226ebeaa993a43dcd3a58f15dd8cfc234` | Forward extraction after workflow/Event Day. No scheduler or public gateway activation. |
| Staff consolidation | `80d1c702679bff3a307f306ac952ac3252f53d9b` | Use PR #29 current-main shell adaptation, then complete required contexts/navigation and revocation tests. |
| Communications | `10a15402f059c605d883ec8b4517d3dfdf9cd850` | Held queue/consent/preview model; no worker activation. |
| Controlled provider foundation | `bce1926c6c91cfe3125c49506faf88ccaabc32eb` | Inventory accepted foundation; any extracted provider configuration remains disabled with no delivery path deployed. |
| Partner Pastoral PR #29 | `350512a9401c6e783673af33f2f045d6ba04f62d` | Explicit file extraction, not branch merge; exercise actual SQL under adversarial synthetic users. |
| Huntsville production release | `7e4976d33411230b63430086606ce9df7b43571d` | Already in production baseline. |
| Huntsville public page | `ed31eabe5dce418d750eecb342e18fdbc0ab89d0` | Preserve production bytes, including approved registration hero. |
| PR #31 commands | `b1c1e281ff8f085b3b2a0083b004054da4adaac1` | Copy the two primary command documents; no Giving implementation imported. |

Bessemer mobile and SowGo-routing references in the current production tree remain baseline-owned. SowGo is a separate website repository: this candidate makes no changes there. The command records current `/go` and `/register` destinations; this inventory does not claim a new live-browser validation of that repository.

## 2. Migrations and dependencies

Production tree contains 25 migration files: 22 historical baseline versions, the two Huntsville additions `20261016201932`/`20261016201933`, and `20261018121900` allowing Huntsville decisions. This is repository evidence, not a newly queried live migration ledger. Historical order and bytes must remain unchanged.

PR #29 adds eleven forward files `20261018124500` through `20261018133400`: decision-source bridge/follow-up, adapted Team/Travel, Huntsville team configuration, access/function repairs, then partner schema and four follow-on repairs. These can be consolidated into reviewed new forward files because they are not production history; their effective definitions, ACLs and constraints must be tested against the complete production baseline.

The older chain recreates campaign, registrant, prize-participant and registration objects already present in production. Workflow templates/opportunities/steps/documents/training and prize ledger tables are absent from the minimal production slice. Their dependencies must be added selectively before Event Day, Host and Communications. Never replay old CREATE TABLE statements against live objects; never import the old Bessemer seed/registration-import block or rewrite production registration functions.

## 3. Pages and functions

PR #29: staff home, Outreach overview, decisions, team/travel, partner church administration, partner follow-up, staff access; adapts staff registration/People. New RPCs include decision/access/team and partner/admin workspaces. The source inventory enumerates every page and Edge Function for every source commit.

Current production public registration uses `outreach-registration-submit` and production registration config/gateway/workspace RPCs. Preserve these definitions and files. Existing partner-intake gateway is also preserved. Future Host, communications delivery and prize-display sources require independent protection/enablement checks; they do not inherit release permission.

## 4. Current-main conflicts and required corrections

- PR #29 was based on earlier main `3cb3d97…`; production has since added the temporary acceptance harness. Preserve the harness as a separate route and build artifact; do not adapt it into the staff shell.
- Old core/Phase C DDL collides with the live minimal registration foundation. Adapt only missing objects and additive constraints/columns; registration function definitions remain exact.
- PR #29 navigation lacks the required top-level context selector and several module destinations. Finish the actual product shell.
- Its existing partner tests largely inspect source strings. Add real database allow/deny/export/revocation tests before relying on its security claims.
- Its access workflow can create real grants when invoked. This assignment creates profile models and synthetic local fixtures only; no real provisioning or invitations.
- Old source documents describe SowGo as a separate backend or still claim Huntsville is unreleased. Current command makes Outreach one module in one platform while preserving current organization/financial records.

## 5. Files and definitions that must remain exact

`protectedFiles` in the source inventory is the byte-level contract (124 focused files at preflight; expanded to 426 complete public/runtime/config files during final verification). It includes all 25 production migrations, both production Edge Functions, public Bessemer/Huntsville assets, existing public application code, Supabase production config, Netlify routing/protection and preserved public website/course/event surfaces. Additions to the explicit public manifest may publish new staff assets only. No customer records are exported to Git.

Database acceptance also compares production registration function definitions before/after candidate migrations. Bessemer source rows are fingerprinted before/after using synthetic equivalents locally; actual 48-row production verification is a read-only release checkpoint, not permission to copy private records.

## 6. Stale continuity

Production CURRENT_BUILD_STATE, ARCHITECTURE, SECURITY_MODEL and DECISIONS still lead with October 16–17 Huntsville release holds and 22-version inventory. PR #29 carries these stale documents unchanged. Outer audit continuity also predates later releases and must be treated as historical. Update candidate continuity to the 25-file repository baseline and distinguish implemented, locally tested, hosted, production-applied and release-approved states. Do not rewrite historical evidence.

## 7. Proposed forward order

1. Preserve/fingerprint 25-file baseline; extract PR #29 effective decision/team/partner slice.
2. Add missing campaign workflow prerequisites without recreating existing tables or importing real records.
3. Add dormant prize ledger and operations using the existing attendee identity.
4. Add Event Day, then Host/pre-event, then held Communications/provider foundation; keep all activations disabled.
5. Add security corrections, leadership profile descriptions, staff context/navigation and product pages.
6. Replay full chain in isolated local PostgreSQL; compare preserved definitions, data, ACLs and source bytes.
7. Draft PR and exact-head isolated hosting preparation. No production operation follows automatically.

Final exact new version order/hashes will be recorded with implementation evidence; this is the pre-implementation sequence.

## 8. Rollback and disable

Before any separately authorized production release: capture deployment ID, migration ledger hashes, Bessemer aggregate/source fingerprint, Huntsville legal/version/count state and configuration. Deploy only the reviewed artifact. Disable the staff entry/navigation or return to the previous deployment to contain UI problems. Revoke affected campaign/partner/admin grants in the database to invalidate current-session RPC authority. Keep immutable notes/audit/waivers and all source registrations. Forward DDL is retained; do not drop tables, reverse applied history, replay submissions or restore a whole database over new public registrations. Disable held workers/provider configuration and new campaign operations independently; preserve public registration and Giving routes. A data-repair migration requires separate review.

## 9. Exact isolated acceptance matrix

Use a dedicated non-production project with the exact 25-file production baseline and candidate chain. No copied production PII; label every fixture synthetic. Separate synthetic Auth users for full leader, Bessemer pastor, Huntsville pastor, read-only, follow-up, revoked, church-B worker and cross-tenant attacker. Do not reuse Dave/Roddy/Tania/Kelsea/Chris identities for permission fixtures.

| Profile/scenario | Required success | Required denial |
|---|---|---|
| Full leader | Both contexts/campaigns, staff operations, assigned partner reporting | No implicit payment/provider activation |
| Bessemer pastor | Own active church's assigned Bessemer decisions, local worker, permitted private notes/export | Huntsville, unassigned Bessemer, other church UUIDs, People/finance |
| Huntsville pastor | Own assigned Huntsville decisions/households, guardian-safe contact | Bessemer, unassigned families, other church UUIDs, People/finance |
| Read-only | Scoped lists/detail/counts | Follow-up writes, assignments, notes, exports without explicit capability |
| Follow-up | Scoped status/shared-note/disciple workflow | Original decision/contact/timestamp edits, pastoral notes without capability |
| Revoked | Public pages and Sign Out remain usable | Next RPC fails in existing session; protected UI/export/download state clears |
| Source integrity | Synthetic 48 = 14 salvation + 9 rededication + 7 learn_more + 18 prayer_followup; fingerprint exact | Mutation through every new RPC and migration |
| Registration | 1+0, 2+3, 3+5 families = 3 households/6 adults/8 kids/14 people; separate check-in | Waiver mutation, final-slot oversubscription, cross-campaign attendee UUID |
| Partner privacy | Shared follow-up visible only where assigned; explicit central routing | Claim unassigned records, cross-church workers, pastoral text in exports/audit, minor direct contact |
| UI | 390/768/1440 px; keyboard context/campaign switching, back navigation, identity/role, Sign Out, no overflow/dead destinations | Legacy staff home or acceptance harness as product |
| Held workflows | Scoped configuration/preview and honest empty states | Provider sends, schedulers, legal publication or production mutations |

Hosted evidence must record exact commit/deploy/project, Auth/API/RLS behavior, actual downloads, responsive screenshots and revocation without logout. Clean up active fixtures/grants/intake while preserving immutable synthetic history. Local tests do not count as hosted acceptance.

## 10. Minimum production release scope

Separate GO package: unified shell/context/campaign selection; canonical source-preserving Bessemer view and totals; current Huntsville registration/check-in; decisions/follow-up; Team/Travel; explicit partner assignment, local workers, pastoral/minor/export protections; profile models; scoped reports/settings and Sign Out/revocation. Future workflow/Event Day/communications foundations can be present but disabled until their individual gates pass. Real leadership/local-pastor grants require exact separately approved identities. Giving, public brands/routes/header, Christmas, Grip and deferred modules are outside this release. No merge, production migration/deploy, live test submission, real grant or send is authorized here.


## Implementation reconciliation checkpoint

The effective PR #29 SQL is consolidated into `20261019004611_unified_outreach_staff_partner.sql`, followed by `20261019004612_unified_outreach_workflow_foundation.sql`, `20261019004613_unified_outreach_operations.sql` and `20261019004614_unified_outreach_security.sql`. Historical files are unchanged. Full candidate file/migration hashes are frozen in the final handoff manifests.

Read-only live inspection verified 25 actual production migration versions and SQL bodies; three versions differ from repository filenames and one older SQL differs only by its final newline. The production baseline mapping and offline package preserve this without repair or production replay. Production Bessemer aggregate remains 48/14/9/7/18.

NMI overlap and primary-owned integration decisions are in UNIFIED-OUTREACH-SHARED-COORDINATION.md. Outreach's extracted older Communications registry replacement was adapted to the accepted NMI additive union pattern; both application orders retain populated grants in disposable local SQL. This is migration compatibility evidence, not approval of combined UI, payment/receipt delivery or release sequencing. The primary thread remains authoritative.
