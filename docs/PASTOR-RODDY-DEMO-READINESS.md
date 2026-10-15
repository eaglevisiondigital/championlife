# Pastor Roddy demo readiness

Status: preparation in progress; hosted visual verification is not yet complete.

- Demo-only branch: `codex/pastor-roddy-demo`.
- Accepted source SHA: `ba1424b2faf9282c6b3cf5c5132e968576e1a2e6`.
- Intended demo URL: https://codex-pastor-roddy-demo--championlifechurch.netlify.app/staff-home.html (deployment pending).
- Acceptance project: `bkbmjisprwmkptywtmih` only.
- Persistent synthetic organization: `ba8bcf9a-4088-49af-a568-d63f518409c8` (`kp-demo-ba8bcf9a`).
- Walkthrough: [20–30 minute guide](PASTOR-RODDY-DEMO-WALKTHROUGH.md).
- Preferred browser size: 1440px desktop; 768px and 390px verification pending.

## Login

Use the existing synthetic operational acceptance account through the ordinary email sign-in screen. Enter its newest email code directly in the browser. Never put a code, password or secure login link in documentation. A separate leadership mailbox is awaiting user identification; its role will contain reporting permissions only.

## Persistent scope

Synthetic People and Morgan household; Harbor Community Outreach and its preparation workflow, team/logistics, registration/check-in and prize inventory; 124 canonical synthetic manual receipts across 2026, fund hierarchy, disabled merchant routes, pledge and non-executing recurring instruction, statement versions, and six draft forms. Payment recovery scenarios are in preparation. Detailed fixture manifests remain in the private audit workspace, never the public build.

Fixtures use an isolated `kp-demo-*` organization, synthetic identities and explicit `environment=demo; synthetic=true; persistent` role/manifest tags. They must never be copied into production reporting. Operational demo access expires after 30 days; temporary preparation grants must be revoked before handoff.

## Safety and limitations

No provider connection, real payment or donor communication. All merchant routes remain disabled. GiveHub remains live and unchanged. The independent production 6 AM Prayer link update is preserved. GIV-3B NMI hosted acceptance remains paused pending sandbox credentials. This branch is presentation-only, not a new source of truth or release candidate.

## Rollback / cleanup

To retire the demonstration, revoke only its organization-scoped demo grants, disable its campaign registration/team settings and remove its branch deployment configuration. Preserve immutable financial/audit/waiver history. Do not run historical acceptance cleanup against this persistent organization. Do not delete or mutate production records. Remove the demo alias only after the presentation is no longer needed.
