# Outreach Phase D — digital prize operations and drawing display

## Build and release status

Phase D is a dependent candidate based on the accepted Phase C head 2c57b1ec0e1407d750b052cc22bbe9b4dc86e418. Migration 20261007160000_outreach_phase_d_prize_operations.sql, staff/operator UI, signed-in household view and public display are local candidate changes. No Supabase project, live campaign, account, grant, Auth setting, provider, production build or domain was changed. PRs #7/#6/#5/#2 remain open, draft and unmerged.

## Permanent rule and identity

The campaign invariant is one attendee → one campaign prize participant → one securely generated six-digit drawing number → at most one claimed prize. Phase D reuses the unique attendee_id link created by Phase C; it does not create a second attendee identity. Six-digit codes use PostgreSQL cryptographic randomness with rejection sampling, are not derived from contact/demographic/internal IDs and are unique per campaign. Number rows and claimed-win rows are immutable.

Preregistration is not presence. Sync may prepare an identity and number, but default eligible selection also requires Phase C’s authoritative active check-in. Reversal before a win deactivates eligibility. Reversal after a committed win may clear current presence, but never changes or deletes the historical draw, claim or campaign-wide win ledger. A claimed winner’s entries are disabled across every pool; the unique win ledger and guarded RPC prevent later re-enable or another award.

## Configuration and unclaimed policy

Configuration supports digital, paper and hybrid modes; digital/drawing enable switches; present-to-win; configurable reminder lead time; public title/instruction; reusable pools; category/group label; prize type; registration eligibility key; age/size guidance; description; quantity; order; optional manual claim window; notes and active state. Bike group meanings are data, never schema enums. one_win_only is constrained true and is not exposed as a switch.

Every pool requires an explicit unclaimed policy:

- exclude_participant is the conservative UI default: a selected but unclaimed participant is removed from all remaining pools.
- exclude_pool removes the participant only from that pool.
- remain_eligible leaves the participant eligible for later pools.

Selection is provisional; a claim creates the permanent win. This lets the explicit unclaimed policy work without deleting or rewriting history. Claimed winners can never return under any policy.

## Event-day workflow and transaction safety

The staff route is /staff-outreach-prizes.html?campaign=&lt;campaign-uuid&gt;. Operators configure pools, sync eligible attendees, reconcile optional paper ticket references, start a draw session, lock a pool, review eligible/inventory counts, confirm the draw, verify the private attendee/guardian contact, claim or mark unclaimed, and continue. Pool locks prevent eligibility/category edits after drawing starts. A completed session preserves its locks and history.

Selection occurs only inside the server RPC under a campaign advisory transaction lock. It validates enabled settings, active session/lock, inventory, pool membership, check-in, exclusions, pending draws and existing wins. The database chooses with gen_random_uuid() ordering; browser animation never chooses. A simultaneous duplicate draw receives the existing committed pending result. Claims are idempotent and serialize inventory. Claimed count cannot exceed configured quantity.

Capabilities are explicit and campaign-scoped: prize.view, prize.manage, prize.draw, prize.claim; manage/draw/claim require view. Old draw, registration, pastor, volunteer, People, follow-up, team and travel permissions do not imply them. Administrator changes preserve unrelated capabilities and require current reviewed admin authority, assignment revision and reason.

## Participant and public surfaces

/outreach-drawing-numbers.html?campaign=&lt;public-slug&gt; requires a verified signed-in account whose normalized email matches that campaign registration. It returns only that registration’s active attendees, number, current categories and derived assigned/eligible/claimed state. It does not provide arbitrary reference lookup or cross-household enumeration.

/outreach-prize-display.html?campaign=&lt;public-slug&gt; is an intentionally anonymous, read-only big-screen projection. It includes organization/campaign branding, display title/instruction, current prize, state, selection time and six-digit number only. Names, email, phone, guardian, birth date and internal IDs are never joined into this RPC. It polls committed state and animates only after receiving the server-selected result; the operator can reopen it to redisplay.

## Hooks, audit, backup and failure procedure

Held domain hooks are prepared for outreach.drawing.reminder, outreach.prize.winner_selected, outreach.prize.claimed and outreach.prize.unclaimed; no SMS/email/push is claimed or delivered. Reminder timing is campaign-configurable and generates a held event for the future Communications Core.

Audit records cover configuration, identity sync/number assignment, eligibility changes, session start/complete, pool lock, selection, claim/unclaimed, reminder preparation, backup export and prize access changes. Draw/history/win/exclusion records are append-only or immutable.

Phase D deliberately does not expose a void/manual-correction action. An operator resolves a selection as claimed or unclaimed and starts a new append-only draw. A future correction workflow requires a separate product decision and must preserve the original history; staff cannot rewrite or delete a result in this build.

Authorized backup CSV/print contains drawing number, attendee, guardian, phone, pool, check-in/eligibility/winner state and optional manual ticket. It is campaign-scoped, audited and spreadsheet-formula neutralized. Before event day, staff should export and secure a printed roster. If the public display fails after selection, the operator screen remains canonical and the operator announces the committed number. If internet fails before a draw, staff use the most recent authorized backup and the campaign’s approved paper/manual process, then preserve those operational records for reconciliation. Phase D does not claim offline synchronization.

## Local verification

The final full backend/DOM command passed all 21 scripts, including 22 focused Phase D database/security checks and 19 Phase D DOM checks while preserving the Phase A/B/C suites. The separate Christmas Dinner regression passed all 94 checks. The site builder produced exactly 403 allowlisted files; Phase D JavaScript syntax and repository diff checks passed. DOM/CSS checks cover operator confirmation/claim/export/403/session loss, household retrieval, public display, no public PII and explicit responsive rules/viewport contracts for 390, 768, 1440 and large-screen display layouts. These are local structural checks; hosted visual acceptance remains a later gate.

A disposable socket-only PostgreSQL test proves genuine overlap with distinct backend IDs and server timestamp intervals: 16 concurrent number assignments produced 16 unique identities at peak overlap 16; a two-pool same-participant race produced 1 success and 1 safe denial at overlap 2; eight concurrent duplicate claims all returned the one canonical claim at overlap 8; eight operators drawing the same final prize all received one canonical result at overlap 8; eight concurrent final-unit claim attempts produced one award; and eight re-enable attempts produced 0 successes and 8 safe denials.

Local checks are build evidence, not hosted acceptance or production approval. The next gate is Champion Life Chat review followed by a separately authorized isolated Phase D acceptance assignment. Phase E is not started.
