## 2026-10-09 — Phase G candidate implementation decisions

One Communications Core serves future modules. Initial email/SMS require explicit purpose consent with no inferred exceptions; service relationship exemptions await Chat policy. Channel/provider implementation is injected and sink-only for this build. Current source actor/recipient and campaign/task freshness are checked again at handoff, which is the revocation linearization point; uncertain handoff needs reconciliation, never blind requeue. Route approval starts future event consumption, with processed-event ledger. Inactive discipleship threshold is explicitly selected, not a platform policy default. Credits/retention/push/inbound donation are hooks, not activated products. Local tested, hosted unverified, release unapproved. See [Phase G contract](docs/COMMUNICATIONS-CORE-PHASE-G.md).

## 2026-10-09 — Staff Home acceptance gaps

The two hosted acceptance gaps are closed within the existing read architecture: compact Outreach Snapshot on Staff Home plus a personal preparation-task summary. Follow-up/approval totals are intentionally omitted until a separate canonical scoped aggregate is approved. Empty-state acceptance is preparation-only, not a claim of zero work in every system. No Phase G or release authorization.

## 2026-10-09 — permanent Kingdom Propel attribution

CUSTOM-BRANDED KINGDOM PROPEL IMPLEMENTATIONS RETAIN “POWERED BY KINGDOM PROPEL” ATTRIBUTION USING THE APPROVED KINGDOM PROPEL LOGO.

The ministry/church brand remains primary and may use custom colors/layout. A discreet approved logo attribution is permanent for custom/semi-white-label implementations; standard multi-tenant installations may use full Kingdom Propel branding. The first application is the shared Staff Workspace sidebar/drawer in PR #13: exact supplied PNG, native external link to KingdomPropel.com, safe new-tab attributes and accessible focus/label. Future shells can reuse the descriptor/asset; no full branding engine or unrelated product changes are included. Production and Phase G remain unchanged/not started.

## 2026-10-09 — authorized Staff Workspace consolidation

Phase F is accepted at PR #12 exact head `7b883ca226ebeaa993a43dcd3a58f15dd8cfc234`; its former acceptance hold is superseded only by the user's new dependent frontend build assignment. Staff Home becomes `staff-home.html`; `staff-people.html` continues to be People & Follow-Up. Navigation derives from current server-filtered capabilities, not role labels. Existing module/denial text and guards remain authoritative. Unsupported dashboard aggregates and absent staff discipleship/admin destinations are omitted rather than fabricated. Phase G navigation is extensible but absent. Prerequisite PRs remain draft/unmerged; production, parked PR #10 and campaign activation/publication are untouched. See [navigation contract](docs/STAFF-WORKSPACE-NAVIGATION.md).

# Decisions — Outreach Campaign Core v1

## 2026-10-08 — authorized Phase F build

Phase F branches from accepted Phase E `f41ab24dc256145fa37b9516c1aae2ef7a602a37`, targeting its unmerged draft branch; parked PR #10 and prayer PR #9 are excluded. Existing workflow steps are tasks. New host response permissions stay independent from People/registration/travel. Canonical host reuse needs explicit identity review; no email-based merge. Native exact agreement mapping/legal text remains pending instead of guessed. Production packet publication must use a reviewed version consistent with the permanent one-prize rule. Agreement/packet snapshots are immutable; date/venue changes preserve completion history and require reconfirmation. Reminders remain held/manual and require later Communications integration for delivery. Local build checks do not authorize migration/deployment, campaign activation, merge or Phase G.

## 2026-10-07 — authorized Phase E Event Day candidate

Phase E branches from accepted PR #8 head `d899616a81df2a62a2957db074966073310b02c0`; parked Bessemer PR #10 is excluded. Event Day is one reusable campaign module. Packet content is seeded as a versioned published template and campaign snapshot, not hardcoded city schema. Phase B team/vehicles, Phase C check-in and Phase D prizes stay authoritative. Area duty does not grant system authority. Campaign data defines required readiness; event closeout does not close follow-up or discipleship. Full offline sync is deferred, with print/guarded CSV as fallback. Huntsville is configuration-ready but unpublished; Bessemer stays postponed and inactive. Production, merges and Phase F require later authorization.

## 2026-10-06 — authorized Phase B candidate

Phase B branches from the exact accepted PR #5 head and targets its branch as a dependent draft PR; PR #5, PR #2, production main and QR work remain untouched. Party intake is not a second Person/household system, preferences are not approval/final roles, service roles are not platform permissions, and a Household label is not guardian authority. Nullable official capacity is a planning target without automatic rejection. Total vehicle seats include drivers; passenger seats exclude them. Family splitting/separate minor supervision requires explicit reviewed operations. Lodging windows cannot change beneath occupancy. New signup defaults disabled, native consent remains Phase C pending, and communications remain held. The additive migration repairs a pre-existing Household audit-kind omission needed for canonical family reuse. Exact Huntsville mapping and isolated hosted acceptance are later gates, with no JotForm replacement, production deployment or Phase C authorization.

## Phase A foundations

- The current assignment authorizes Phase A implementation on an isolated branch. Production deployment/merging and remote configuration/provisioning remain separate gates. PR #2 is not wholesale imported.
- Bessemer/Huntsville are campaign data owned by existing canonical SowGo, not separate systems. Unknown dates/host facts stay unset. The source bridge never rewrites historical registrations or creates People.
- Explicit campaign assignments, not tags, grant local-leader authority. Campaign administration is a new explicit owner-reviewed authority plus active staff assignment; existing generic privileges do not automatically establish it.
- Workflow JSON versions/snapshots preserve source terminology and future configurability. Signed agreement completion uses an uploaded external agreement plus administrator review; no native signature/legal policy is fabricated. Exact JotForm capture is pending.
- Training uses existing playlist/manual acknowledgment. Reminders/events are held manual hooks until approved Communications delivery; no fake sends or cron installation.
- The user's one-prize-total rule supersedes paper bike-winner/tablet eligibility. Unclaimed/not-present is not won, with mandatory explicit remain-eligible/exclude policy and no silent default. Dormant owner-only integrity primitives satisfy architecture testing now; operational Phase D stays unimplemented.
- King Kind remains pending/Coming Soon until the actual approved final PDF arrives. Future household/attendee, travel/official-team and offline drawing policies require their planned phases and review.

See the detailed [module contract](docs/OUTREACH-CAMPAIGN-CORE-V1.md) for implemented, candidate-only and later-phase distinctions.

## 2026-10-07 — authorized Phase C build

Chat accepts Phase B at the exact PR #6 head and authorizes a dependent Phase C build, leaving all prerequisite PRs unmerged. Submitted household identities are event records, not canonical identity merges; minors require explicitly asserted parent/legal guardian coverage. Typed-name signatures are practical acknowledgments, not notarized/verified legal identity. No waiver/consent/source wording is invented: native public configurations default disabled until exact mapping and reviewed text. Scoped registration/check-in permissions are separate from pastor follow-up/travel; public reference is only a staff lookup hint. Stable client keys and server campaign serialization enforce retry integrity; the dormant existing prize identity is reused, with no operational drawing. Print/CSV provide private degraded-connectivity backup; offline synchronization is deferred. Bessemer decision intake and current JotForms remain. Passing local checks authorizes neither hosted application nor production release nor Phase D.

## 2026-10-07 — authorized Phase D build

Phase D branches from exact accepted PR #7 head and remains a dependent draft candidate. One attendee has one campaign drawing identity/number and at most one claimed prize. Selection is provisional; claim writes the immutable campaign-wide win. This preserves the user-required explicit unclaimed options while ensuring a claimed winner can never return. The conservative UI default is exclude_participant, but every pool persists an explicit choice. Present-to-win defaults true and comes only from Phase C check-in. Pool locks freeze relevant event-day eligibility; the database selects under a campaign lock and the public animation is presentation only.

Prize permissions are independent. Public display is number-only; signed-in household retrieval uses verified registration email and adds no arbitrary public lookup. Digital/paper/hybrid are supported, with optional manual ticket reconciliation, private audited export and a documented manual fallback rather than an offline-sync claim. Reminder/winner events remain held for the future Communications Core. No campaign is enabled, no real permissions are granted, no provider or production setting changes, and Phase E is not authorized.
