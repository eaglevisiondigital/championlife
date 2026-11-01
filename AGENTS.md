# Codex work order — Lane A: Champion Life unified staff + Outreach
Date: 2026-11-01. Dedicated branch only. Current baseline: PR #70 @ 47dbaf7cdaf0f08267c5a83f60f26723e0720189 (stacked upon PR #69 and frozen PR #61).

## Immediate work
1. Read Champion Life master issue #58, unified staff #33, held genuine Auth #62, PR #61 and PR #70 before changes.
2. Extend **synthetic, real Chromium/WebKit** acceptance for the read-only 5-metric Outreach summary: concurrent campaign A->B, stale A returning after B authorization, stale account/session/token, revoked backend context between list and context, browser navigation and role/scope changes. Verify no private data, finance, tokens or raw errors escape to DOM/log.
3. Keep keyboard, mobile/tablet/desktop, official Powered by Propel sidebar/link and unified Church/Outreach contexts. Third Partner context is a separately scoped later integration, **same shared identity/shell**, not a new authentication subsystem.
4. Produce actual diff, exact-head CI evidence and independently reviewed next safe correction. Do not confuse synthetic Auth with genuine provider acceptance.

## File ownership
Own ONLY tools/outreach/church-outreach-summary-staff.browser.mjs, adjacent isolated tests and lane-specific docs. No edits to public staff HTML/JS, tools/site-build/public-files.json, SQL, Auth secrets, Giving/NMI, or Global Propel.
No two agents edit the same file/worktree concurrently.

## Mandatory boundaries
No public deploy, production migration, real staff grants, emails, payments, paid hosted test branch, or bypass of approved external Auth/recovery gate. PR remains DRAFT. Keep original PR #70 untouched and perform work on this lane branch; coordinator owns source reconciliation/release.

## Handoff
Return changed paths, commit SHA, CI run ID and actual result, security denial coverage, remaining external gates, and next source-only task. No claims of successful execution before workflow completion.
