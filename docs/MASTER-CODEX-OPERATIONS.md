# Master Codex — Champion Life / SowGo / Partners / Global Propel

Updated 2026-11-01. Status: project-scoped source configuration, not a running unattended agent or a production release.

## Operating experience for the owner

Communicate through **one main Codex thread** with the Champion Life master coordinator. Give the desired outcome, requirements and approvals once. The coordinator reads `AGENTS.md`, `.codex/config.toml`, the reviewed development sources, and the current GitHub task queue; delegates nonoverlapping work to the relevant custom subagents when the session provides native multi-agent tools; collects evidence; and produces one consolidated response.

Codex's built-in delegation runs **during an active Codex session**. The TOML files do not themselves create standing agents, run sessions in the background, schedule jobs, or spawn a permanently independent worker. GitHub issues and separate draft PRs preserve progress **between sessions**, not a hidden always-on execution process.

## How to activate this configuration

1. Open the repository `eaglevisiondigital/championlife` in Codex; use a trusted project checkout of the exact draft branch `codex/master-orchestrator-20261101` (or a later separately reviewed release containing these same files). Verify the new `AGENTS.md` and `.codex/agents/` are visible locally. **Do not switch a dirty working checkout or overwrite uncommitted changes.**
2. Use the main Codex thread as the **Master Coordinator**. Ask it to inspect current Issue #58 and the live repository state, then dispatch the next source-only tasks. If the runtime has subagent tools disabled or unavailable, it must return explicit assignments/PR handoffs rather than imply workers were launched.
3. The coordinator creates separate git worktrees/branches before delegating any conflicting writes. It may delegate **read-only investigation** in one workspace, but never multiple writers to a shared path. Keep three active subagent threads initially.
4. The main Champion Life checkout must not be used as a shortcut to edit `eaglevisiondigital/global-propel-platform`; that is a separate repository/worktree with its own blocked production privileges.
5. Agents return exact SHA, diff, test results, reviewer findings and hold gates. The coordinator posts actual checkpoints to GitHub and hands off only the narrowly reviewed source for integration. No implicit merge/Netlify deploy/production migration.

## Initially prepared coding lanes

| Lane | Repo / current draft PR | Reserved source scope | Next review goal |
| --- | --- | --- | --- |
| A | Champion Life [#72](https://github.com/eaglevisiondigital/championlife/pull/72) | isolated staff/Outreach tests in `tools/outreach/` | pending campaign/account/revocation and browser validation |
| B | Champion Life [#73](https://github.com/eaglevisiondigital/championlife/pull/73) | `tools/nmi/` and its focused CI/docs | four-MID readiness, offline routing/settlement denials; real provider pending |
| C | Global Propel [#8](https://github.com/eaglevisiondigital/global-propel-platform/pull/8) | `tools/tenant-entitlements/` and its dedicated CI | feature/package entitlement & two-tenant negative tests |

These are independently reviewed **draft lanes**, not three separate Champion Life products or active permanent Codex conversations. PR heads move; never rely on a stale SHA without refetching it. Other queued tracks: Partner V1 issue #71, discipleship #53/#56, Outreach decisions #50.

## Recommended dispatch

In one active session, the coordinator can ask `church_core` or `outreach` to inspect the authorized shell and browser tests, `giving_nmi` to investigate NMI readiness, and `global_propel` to examine entitlement source with the separate repository available. Use `security_reviewer` for read-only independent verification of each completed package before calling it ready.

A specialist *may* implement source changes only if its task explicitly gives an isolated worktree, owned files and a source-only approval. Otherwise return a plan/diff recommendation. The next queued specialist does not write to overlapping staff/auth/migration files until released by the master.

## Normal task instruction to main Codex

> Continue the Champion Life master platform using Issue #58 and branch-root AGENTS.md. Inspect current PR heads. Divide my requested feature into bounded, nonoverlapping Church, Outreach, Partner, Giving, Discipleship and Global Propel tasks. Delegate eligible investigations to specialist subagents and code only in isolated assigned worktrees. Let a separate security reviewer check the result. Return actual code changes, passing or failing CI, and a single prioritized release-gate report. Do not merge, deploy, run hosted migrations, create real staff accounts, send communications, or activate financial processing without their separately approved exact scopes.

## Single master-user experience

- Shared verified human principal, scoped People/Households and relationships.
- Three connected contexts: Church, Outreach/SowGo, Partners. A member can also be volunteer, employee, partner or learner **without inferred powers**.
- Tags classify; current backend permissions and explicit campaign/record assignments authorize.
- Global Propel controls tenant-level package/module/subfeature entitlements **in addition to** human permissions and independent legal/merchant/processor requirements.
- SowGo branded public website does not imply separate Auth provider or pooled merchant settlement. Local pastors do not receive unrestricted church/finance/children access.

## Stop rules and accountability

No automated background task, cost-bearing new hosted resource, real MID/credentials, tax/merchant reassignment, money movement, live SMS/email, public deploy, tenant provisioning, real person grants, or bypass of a blocked tool/migration occurs from this orchestration configuration.
All source branches/drafts remain unmerged. If validation passes, that means syntax/source readiness only. Real Supabase, SMTP, NMI and second-tenant product acceptance require separate human-authorized reviews.
The coordinator maintains the accepted exact-file inventory, one-writer path reservations, draft PR state, release STOP/GO and rollback/recovery evidence. Preserve existing good production pages and 48 historical Bessemer decisions, Huntsville records/waivers, GiveHub and private learner data.

## Deployment boundary

This PR targets `main` for later configuration review, but **the configuration is usable by a Codex session only when its checkout includes the files**. Merely opening the GitHub PR or posting in ChatGPT does not activate or launch any worker.

For current Codex subagent configuration syntax, see https://learn.chatgpt.com/docs/agent-configuration/subagents.
