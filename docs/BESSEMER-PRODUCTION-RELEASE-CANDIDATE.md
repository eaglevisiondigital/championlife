# Bessemer Outreach production release candidate

Status: prepared and tested on an isolated branch; production remains unchanged. Production database, staff assignments, Auth, Netlify, SMTP, DNS, giving, merchant routing and SowGo were not modified.

## Composition

The release branch starts at production `e1f75f917f9a1e6e16e0b8f9bc5d7b52fbf0a424`. It intentionally cherry-picks the three accepted dependency commits in order:

1. Phase A `098a87b061e7ffad53ae86f76d750a5aacfbc935`
2. Phase B `79404bb5648af269bbaea1604aed4891c507e2c3`
3. Phase C `2c57b1ec0e1407d750b052cc22bbe9b4dc86e418`

Phase D commit `d899616a81df2a62a2957db074966073310b02c0` is not an ancestor and is not cherry-picked. The candidate excludes `20261007160000_outreach_phase_d_prize_operations.sql`, the prize operator/public UI and all Phase D JavaScript/CSS. Phase A's `20261006113322_outreach_prize_integrity_foundation.sql` remains because it is an accepted Phase A dependency: it creates dormant, RPC-inaccessible integrity primitives and does not provide drawing operations, operator UI, a public display or activation.

## Production migration inventory

Read-only production verification on October 7, 2026 found 22 ledger entries and none of the five candidate versions. Apply only these files, in this order, after explicit production-write authorization:

1. `20261006113255_outreach_campaign_core_v1.sql` — SHA-256 `c4131a7d0a5f6929b4586308018039e7f00644b2b7e0896b0285c615285e0b7a`
2. `20261006113311_outreach_campaign_workflow_v1.sql` — SHA-256 `15136d672a0ec2d3ae9a7ef6bb3020b5c9e4a159165255c95933228b0e7cd3f0`
3. `20261006113322_outreach_prize_integrity_foundation.sql` — SHA-256 `0e44cd6325b763cadea9319eb416b5e48a70cf94f3861b2bf04f0ca8ce769fed`
4. `20261006200021_outreach_phase_b_team_travel.sql` — SHA-256 `9536d0e5faa296a0e378a471562c7484c6a86055d7e9378c506cb0b5f17a7388`
5. `20261007073021_outreach_phase_c_registration_checkin.sql` — SHA-256 `859dc36d42bfc4f9dfb0721f917ad84bee338918dd45f1d28517cc432f046538`

The migrations add new Outreach relations, guarded RPCs, indexes, storage policies and source configuration. Phase B/C replace only their preceding capability/event check constraints with strict supersets. Runtime delete paths remove only user-requested team/travel assignments; migration execution does not delete Bessemer, People, Auth, course or follow-up records. The Bessemer backfill uses `ON CONFLICT DO NOTHING` and does not update or delete historical registrations.

## Bessemer mapping and preservation proof

`bessemer_al_2026` remains the source key and is mapped to the SowGo-owned `Bessemer 2026` campaign. The migration:

- creates one `outreach_campaign_sources` bridge for the existing source;
- inserts one campaign registrant reference per existing legacy registration;
- keeps the legacy row as the contact/decision source of truth until a reviewed Person link is explicitly made;
- adds an after-insert bridge so future submissions map once;
- creates no People, Auth accounts or course enrollments;
- preserves `/bessemer`, its current direct submission, QR, consent language, Getting a Grip and My Discipleship links.

The read-only production baseline contains 6 Bessemer registrations, 6 recorded decisions, 1 salvation, 1 rededication, 2 prayer/follow-up decisions and no claimed user links. Safe non-PII fingerprint: `258b416f51b55a5268ccf0564fa218ed`. Before production application, record the same count/fingerprint. After migration, require the legacy count/fingerprint to match exactly, require 6 unique bridge rows, and confirm zero implicit People/Auth/enrollment creation. Future public submission smoke must increase both legacy and bridge counts by exactly one; remove only the synthetic smoke row through an approved cleanup path after evidence is captured.

## Dashboard and access

The production review route is `/staff-outreach-campaigns.html`. The staff People page links to **Global Propel / Outreach**. Authorized users open **Bessemer 2026** and receive:

- totals for registrations, decisions, salvation, rededication, wants to know more, prayer/follow-up, discipleship state and needs follow-up;
- contact, decision, registration date, allowed Getting a Grip projection, last activity and follow-up state;
- a detailed Bessemer registration panel, allowed prayer/follow-up context, history and task creation;
- server-scoped ten-column CSV with formula neutralization;
- validated `tel:`, `sms:` and encoded `mailto:` actions, with no delivery claim.

Course answers and learner notes are never joined into the campaign projection. The projection reuses only the existing Getting a Grip enrollment and lesson-progress records. Person creation, registration and enrollment never grant staff or portal authority.

For Pastor Roddy, Tanya and Kelsey, wait for exact verified emails and separate authorization. The minimum Bessemer-only assignment is an existing verified account plus one active `outreach_campaign_assignments` row for the Bessemer campaign with role `pastor_roddy` for Pastor Roddy or `internal_team` for Tanya/Kelsey, and capabilities `view`, `export`, `followup`, `decisions`. This grants no finance, staff administration, organization-wide People, workflow/document management, travel/lodging or course-answer access. Add campaign-admin management only if Chat separately approves setup/access administration.

A future Bessemer local pastor uses role `host_pastor` or `local_leader` with the same campaign-only capability set. Server checks bind every list/detail/export/write to the assigned campaign UUID and current effective, unexpired, unrevoked account. It does not require or imply organization-wide People access.

## Exact release sequence

1. **Preflight:** confirm main remains the approved starting SHA; candidate checks and hosted CI pass; PR remains draft; production backup/recovery and prior deploy are identifiable.
2. **Ledger:** read the production migration ledger and require the same 22-entry baseline with all five candidate versions absent. Stop on drift.
3. **Baseline:** record safe Bessemer counts/fingerprint, People/Auth/enrollment totals, current public-page hash, and current staff grants.
4. **Migrations:** apply the five byte-verified migrations in order. Do not apply Phase D.
5. **Mapping:** verify the Bessemer seed, source bridge, six unique bridge rows, unchanged legacy fingerprint and zero implicit identity/access records. Confirm Huntsville remains draft/unpublished and Phase B/C settings remain disabled unless explicitly configured.
6. **Staff capabilities:** after exact email and scope approval, resolve existing verified accounts and add only approved Bessemer campaign assignments. Do not invite/create accounts in this step.
7. **Frontend:** deploy the exact reviewed candidate SHA to production without changing environment, Auth, SMTP, DNS, giving or merchant configuration.
8. **Authenticated smoke:** verify list/detail, cross-campaign denial, direct-ID denial, revocation, no organization-wide People, no finance/admin, no answers and no Phase D routes.
9. **Public smoke:** submit one clearly synthetic Bessemer entry through the unchanged live page; confirm one legacy row and one bridge row, then use the approved cleanup path.
10. **Dashboard smoke:** verify summary, person detail, follow-up task/history, CSV fields/formula safety and Call/Text/Email actions.
11. **Responsive review:** leadership checks production at 390px, 768px and desktop. Confirm Christmas Dinner, giving, Outreach Partner, SowGo links, `/go` and Auth.

## Containment and rollback

- Frontend problem: restore the exact prior Netlify production deploy. Do not revert by editing main in place.
- Permission problem: revoke/deactivate only the new campaign assignment rows; existing staff grants remain untouched.
- Campaign configuration problem: revoke assignments and disable the new admin surface by access removal while retaining campaign, bridge, audit and registrations.
- Migration problem: stop before frontend/grants, preserve new additive tables and all history, and ship a separately reviewed forward corrective migration. Never drop tables, delete production history or rewrite the migration ledger.
- Public submission problem: restore the prior frontend deploy; the legacy Bessemer endpoint/data remain authoritative. Reconcile unknown submissions before retrying.

Production writes, migration application, real staff grants and production deployment require a separate explicit authorization.
