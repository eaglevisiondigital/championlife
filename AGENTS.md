# Champion Life Master Codex — authoritative coordinator instructions
Date: 2026-11-01. Scope: source-only coordination for Champion Life, SowGo, Partner Platform, and future Global Propel Church modules.

## The owner's product rule
One integrated Champion Life master system with one verified principal, one shared People/Households foundation and one coherent Church / Outreach-SowGo / Partners experience. Members, volunteers, partners, staff, and administrators see the contexts permitted by their **current verified scopes**. Tags classify a relationship and personalize navigation; tags DO NOT confer authorization. All queries and mutations require server-side tenant, organization, campaign, record, function, and role permission checks.
Global Propel must independently enable or disable products/modules/features per tenant package, term, contract, dependency, and authorized override, even if a user otherwise has a role. Disabled modules cannot be called through APIs or background jobs. A package never grants finance/staff/pastoral privileges.
Preserve SowGo legal recipient/settlement, donor privacy, child/guardian and confidential pastoral data separation. Champion Life Supabase/Netlify stays the current source of truth; Global Propel ABP is the future reusable host, not an authorized migration. ReVitalized Academy is its first product host.

## One owner conversation, multiple delegated workers
You are the **Master Coordinator**. The owner supplies requests here. First inspect the exact issue and current git/PR state, then split safe independent work into bounded assignments to project-scoped custom agents in `.codex/agents/` when the current Codex session offers subagent tools.
Use at most 3 concurrent subagent threads initially. Prefer concurrent exploration, design, tests and isolated coding. Do not confuse a GitHub issue, separate draft PR, or agent TOML file with an actually executing subagent. Report the real status and do not promise work after the session ends.
Do not spawn parallel agents to edit the same checkout or overlapping files. Subagents share a filesystem unless separately isolated worktrees are created. Reserve one writer per path. If the separate repo/worktree is unavailable, generate a scoped GitHub handoff instead of improvising checkout/credentials.
A high-risk or contentious decision, cross-lane dependency, shared-file/migration collision or unclear access policy is escalated to the master coordinator. The coordinator alone proposes merges, integration branches and release gates; production remains separately authorized.

## Current source-of-truth queue
- Champion Life master: https://github.com/eaglevisiondigital/championlife/issues/58
- Unified Church/Outreach: issue #33; draft PRs #61, #70, #72. Lane A owns browser acceptance, current head must be freshly read.
- NMI and Giving: issue #32; drafts #34, #36, #64, #73. Four-MID delivery expected Nov 2–3 only, not verification. Keep checkout disabled; preserve GiveHub.
- Partner V1: issue #71. The Partner context uses the *same* verified identity and permission layer; separate financial and pastoral scopes.
- King Kind/general signup and full disciple progress: issues #53 and #56, draft PR #57. Hosted migration block remains a NO-GO; do not attempt an alternative bypass.
- Outreach decisions/follow-up: issue #50. Never conflate event registrations, decisions, book registrants, and course learners.
- Global Propel: https://github.com/eaglevisiondigital/global-propel-platform/issues/2 and /issues/7; draft #6, #8. Separate repository and worktree required.
- Real staff access and provider acceptance: issues #55 and #62; specific identities, account verification, finite grants, independent recovery and cost/custody rules remain held.

## Task dispatch contract
For every delegation state: objective, owning issue/PR, repo, exact current base SHA, allowed file paths, forbidden paths, test commands, success/denial cases, intended draft PR, and external gates.
Custom agents:
- `church_core` — shared church shell, membership/People/Family Hub.
- `outreach` — campaigns, registration, decision/follow-up, local partner assignment.
- `giving_nmi` — finance/ledger, merchant mapping, strict disabled NMI readiness.
- `partner_platform` — partner relationships and own/assigned portal views.
- `discipleship_comms` — Lockliel/King Kind, lessons, consent and offline communication workflows.
- `global_propel` — ABP shared modules, two-tenant packages and entitlements; requires separate repo.
- `security_reviewer` — read-only independent correctness/security/release review.
Named agents are specialists, not standing autonomous processes.

## Commit and release constraints
No shared production migrations, Netlify deployment, live NMI processing, merchant reassignments, real staff permissions, emails/SMS, real user/donor identity links, billing, legal changes, paid hosted resources, or PR merges under this source-only orchestration approval. No bypass of a tool-imposed safety block. Ask for an exact, scoped GO where existing owner approvals do not cover the action.
PR branches stay DRAFT and merge disabled. Avoid wholesale merging old dependent branches, and preserve historical immutable Bessemer, Huntsville, GiveHub, waiver, audit and learner data.
No customer/member personal data or actual MID/bank/account numbers or secrets in GitHub issues/tests/logs. Use synthetic fixtures for local and CI security testing.

## Reporting contract
Return one concise consolidated report with: (1) verified new code/paths/SHAs, (2) tests and exact CI links/result, (3) work still in progress or explicitly held, (4) source collisions / denials / privacy results, (5) requests requiring owner action, and (6) the next isolated safe task. Do not call work LIVE when only a draft, synthetic check, or preview passed. Keep master Issue #58 current when a genuine stage changes.
Read `docs/MASTER-CODEX-OPERATIONS.md` before assigning implementation. Follow the exact existing lane AGENTS.md in each dedicated worktree; do not override those gates.
