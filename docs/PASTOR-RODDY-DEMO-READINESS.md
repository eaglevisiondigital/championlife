# Pastor Roddy demo readiness

Status: preparation in progress; hosted visual verification is not yet complete.

- Demo-only branch: `codex/pastor-roddy-demo`.
- Accepted source SHA: `ba1424b2faf9282c6b3cf5c5132e968576e1a2e6`.
- Intended demo URL: https://codex-pastor-roddy-demo--championlifechurch.netlify.app/staff-home.html (deployed; dedicated-alias sign-in verification pending).
- Acceptance project: `bkbmjisprwmkptywtmih` only.
- Persistent synthetic organization: `ba8bcf9a-4088-49af-a568-d63f518409c8` (`kp-demo-ba8bcf9a`).
- Walkthrough: [20–30 minute guide](PASTOR-RODDY-DEMO-WALKTHROUGH.md).
- Preferred browser size: 1440px desktop; 768px and 390px verification pending.

## Login

Use the existing synthetic operational acceptance account through the ordinary email sign-in screen. Enter its newest email code directly in the browser. Never put a code, password or secure login link in documentation. A separate leadership mailbox is awaiting user identification; its role will contain reporting permissions only.

## Persistent scope

Synthetic People and Morgan household; Harbor Community Outreach and its preparation workflow, team/logistics, registration/check-in and prize inventory; 124 canonical synthetic manual receipts across 2026, fund hierarchy, disabled merchant routes, pledge and non-executing recurring instruction, statement versions, and six draft forms. Held payment recovery examples include partial checkout, unknown outcome, independently approved refund, recurring expired-card observation and reconciliation states. No provider execution occurred. Detailed fixture manifests remain in the private audit workspace, never the public build.

Fixtures use an isolated `kp-demo-*` organization, synthetic identities and explicit `environment=demo; synthetic=true; persistent` role/manifest tags. They must never be copied into production reporting. Operational demo access expires after 30 days; temporary preparation grants were revoked after preparation; a read-back found zero remaining temporary grants.

## Safety and limitations

No provider connection, real payment or donor communication. All merchant routes remain disabled. GiveHub remains live and unchanged. The independent production 6 AM Prayer link update is preserved. GIV-3B NMI hosted acceptance remains paused pending sandbox credentials. This branch is presentation-only, not a new source of truth or release candidate.

## Rollback / cleanup

To retire the demonstration, revoke only its organization-scoped demo grants, disable its campaign registration/team settings and remove its branch deployment configuration. Preserve immutable financial/audit/waiver history. Do not run historical acceptance cleanup against this persistent organization. Do not delete or mutate production records. Remove the demo alias only after the presentation is no longer needed.

## Current verification checkpoint

Demo code SHA: `426bc1ced90ce1dd3692c010c0f0b65b24a192e3`. Deploy `6ad18f74a1d31a5a0f484c2d` was READY, branch-deploy, with no production publication. Later documentation commits may supersede this checkpoint; verify the hosted commit before the presentation.

167 focused Staff Workspace DOM checks passed, including canonical campaign status preservation. Syntax and diff checks passed. Private seed scripts were validated against the accepted schema locally before acceptance-only application. No remote migration was replayed.

Flagship campaign: `25284494-b0e5-4156-8aa5-11e9ba5a069b`. Nine registration households contain ten synthetic attendees (one minor); five are checked in and all ten have demonstration acknowledgment coverage. Jordan Morgan’s public family registration is explicitly reviewed against an existing People record, with a follow-up task; this is not automatic identity merging.

Existing authenticated GIV-3D session confirmed finance totals, registration, charts and conditional form preview against the new isolated organization. Leadership page had no horizontal overflow at 1440, 768 or 390 pixels. These checks do not replace final dedicated-demo-alias and reports-only-session verification.

Remaining gates: dedicated demo sign-in; separate reports-only synthetic mailbox; full walkthrough/link/console/responsive verification on the final deployed candidate; prize/statement interaction review. Recommendation remains NOT READY until these gates pass.

### Additional top-control polish — 2026-10-16

Navigation audit: Staff Home repeated all sidebar tools; Outreach repeated Program Tools; Payment Operations repeated five destinations; Reports Center repeated Leadership. These duplicates are consolidated into the shared sidebar. People receives a dedicated group; the saved-method management destination remains available under existing payment permissions. Quick actions offer at most Outreach, Leadership, Reports, and People, filtered by the existing capabilities. Reports-only leadership gains no operational routes.

Finance Overview and Leadership retain their period controls, organization context, print/export and other local actions. Compact period buttons retain `aria-pressed`, visible focus and a non-color selected indicator; overflow scrolls within the control group. Forms' Create, archive filter and editor actions remain local. No blanket button removal or shared authorization change.

Focused tests pass (170 shell, 237 finance, 267 reports, 78 operations). All seven named pages passed disconnected synthetic browser checks at 390/768/1440: 21 renders, zero horizontal page overflow and zero console errors/warnings. Hosted reports-only navigation, YTD selection, Reports routing and mobile drawer/Escape passed on `54894e4fedc6e87d17f245820ba32960d7949d24`, deploy `6ad1be891cd3598e24d017cd`. This verifies the scoped polish, not overall demo approval.

| Additional polish gate | Result |
| --- | --- |
| Top control cleanup | PASS |
| Sidebar organization | PASS |
| Redundant nav pills removed | PASS |
| Page header cleanup | PASS |
| Button hierarchy | PASS |
| Filter / period control polish | PASS |
| Mobile control layout | PASS |
