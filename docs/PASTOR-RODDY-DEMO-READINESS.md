# Pastor Roddy demo readiness

Status: final presentation cleanup implemented. Both identities and the approved 20-record supplement are verified; the final hosted recheck and readiness recommendation are recorded in the private `FINAL-DEMO-CLEANUP.txt` handoff. Prior checkpoints below remain historical.

- Demo-only branch: `codex/pastor-roddy-demo`.
- Accepted source SHA: `ba1424b2faf9282c6b3cf5c5132e968576e1a2e6`.
- Intended demo URL: https://codex-pastor-roddy-demo--championlifechurch.netlify.app/staff-home.html (deployed; both identities verified).
- Acceptance project: `bkbmjisprwmkptywtmih` only.
- Persistent synthetic organization: `ba8bcf9a-4088-49af-a568-d63f518409c8` (`kp-demo-ba8bcf9a`).
- Walkthrough: [20–30 minute guide](PASTOR-RODDY-DEMO-WALKTHROUGH.md).
- Preferred browser size: 1440px desktop. Both role walkthroughs checked at 1440px, 768px and 390px.

## Login

Use the operations account and separate user-approved leadership account through the ordinary email sign-in screen in separate browsers. Enter each newest email code directly in its browser. Never put a code, password or secure login link in documentation. Leadership has the explicitly approved minimum demo-only read access; both final browser sessions are verified.

## Persistent scope

Synthetic People and Morgan household; Harbor Community Outreach and its preparation workflow, team/logistics, registration/check-in and prize inventory; 144 canonical synthetic ledger entries across 2025–2026, fund hierarchy, disabled merchant routes, pledge and non-executing recurring instruction, statement versions, and six draft forms. Held payment recovery examples include partial checkout, unknown outcome, independently approved refund, recurring expired-card observation and reconciliation states. No provider execution occurred. Detailed fixture manifests remain in the private audit workspace, never the public build.

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

Remaining gates: fresh operations and leadership sign-in; full walkthrough/link/console/responsive verification on the final deployed candidate; prize/statement interaction review. Recommendation remains NOT READY until these gates pass.

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

### Final walkthrough pass — approved scope applied, October 16

Current deployed application SHA: `764da6988eff29ffcb56564e0ba890c431b2932f`; Netlify branch deploy `6ad1c90586423e355100bf83` is READY with `published_at: null`. Leadership is now signed in and its hosted walkthrough is verified. The Chrome operations session is still at sign-in. Full two-identity acceptance and the operations screenshot remain pending; this checkpoint is not a readiness PASS.

The owner explicitly approved and Codex applied the minimum leadership reads in the isolated demo organization only. Organization permissions are exactly `finance.reports.read`, `people.read`, `households.read`, `followup.read`, `outreach.view`, and `forms.read`. The flagship campaign adds only `view`, `team.view`, `travel.view`, `registration.view`, `prize.view`, `ops.view`, `inventory.view`, and `preevent.view`. Account-only assignment and the existing November 15 expiry are preserved. No admin grant or write permission was added. Six local and six hosted read-versus-write capability checks pass. Hosted staff context exposes only the demo organization; campaign, team, event-day, prize, finance and six-form read APIs succeed. These checks do not replace browser sign-in or visible-control verification.

Exactly 20 approved synthetic records were applied once, adding $13,775: $12,375 prior-year history, $550 each for October 16 and 17, and $300 imported recurring history. All 20 have explicit demo/synthetic tags; zero payment-session/provider-leg associations. The existing 124 rows remain intact, producing 144 rows and $31,832 all-time. No recurring run, payment or provider call occurred.

At the common October 17 noon America/Chicago reporting boundary, Finance Overview, Reports, fund totals and chart series reconcile to $19,457 YTD; prior-year totals reconcile to $12,375. Recurring history is $300, Today is $550, and the annual eligible-contribution preview for Avery Morgan matches its ledger sum of $14,588 with delivery HELD. The $12,000 pledge remains a commitment, not a received gift. Payment Operations examples remain separate held observations, not additional ledger revenue.

The report-table date presentation fix retains calendar dates. All 271 focused report DOM/accessibility checks, site build, syntax and diff checks passed on the deployed code. No application code or migration changed while applying these two approvals.

Production Netlify deployment remains `6ad10b10f247de5c0b9b0b01`, main SHA `a9c8a73c228866749831f0df4236295c3791216f`. Production Supabase, GiveHub, Auth, SMTP, DNS and real processing were not modified. NMI hosted acceptance remains paused pending credentials. Continue only the final two-identity browser walkthrough, responsive checks and screenshots after sign-in.

### Leadership hosted walkthrough checkpoint — October 16

The final candidate was checked in the signed-in leadership browser across Staff Dashboard, Outreach Overview, Harbor campaign, Pre-Event, Team/Travel, Registration, Event Day, Prizes, Partners, People, Finance Overview, Leadership Finance, Giving by Fund, Reports Center, Forms and Youth Camp conditional preview. All 16 views passed viewport-width checks at 1440/768/390 (48 renders; zero horizontal page overflow). The mobile drawer opens and Escape closes it. Captured console warnings/errors: zero. Finance periods expose selected state; YTD, report navigation and parent rollup work.

Visible current-period finance results agree: $18,907 YTD, $12,375 matching prior year, $300 recurring history, and $550 Today. The October 17 boundary proof above intentionally includes another $550. Leadership has no operational sidebar destinations or save/publish controls. Form preview exposes a read-only editor view: field-library actions are disabled and the existing forms.edit guard rejects changes; no new authority was granted. The six forms remain revision 1 drafts.

Presentation observations: Forms list columns wrap short words at desktop/mobile widths; a read-only preview still says “Return to editor.” These are presentation issues, not permission grants. Report navigation can briefly show the existing “Reporting access changed” placeholder while context initializes, then loads successfully without a console error. No code change was made in this approval/verification pass. Event Day's 5/9 display uses five checked-in attendees and nine household registrations; it is not a 5-of-10 attendee attendance ratio. Explain the different units during the walkthrough.

Fresh leadership screenshots and read-only browser evidence are saved privately under audit/pastor-roddy-demo-2026-10-15/ui/final in the outer workspace. They are not part of the public site. The operations sign-in, operations controls/builder/Payment Operations walkthrough and its fresh screenshot are still required before a complete READY recommendation. No new grant, financial row, processor call, message, migration, or production action was performed during these browser checks.


### Final two-identity assessment — October 16

This assessment supersedes the older sign-in checkpoints above. Both operations and leadership are verified on application SHA `764da6988eff29ffcb56564e0ba890c431b2932f`. Operations retained its existing People, Outreach, finance, builder and payment controls; leadership retained only the approved reads. No extra grants or financial rows were created in this final pass.

Final hosted evidence: 16 leadership and 20 operations views, each at 1440/768/390, totaling 108 renders with zero page overflow. Both mobile menus work with Escape. Captured application console warnings/errors: zero. The 78 private screenshots include every requested desktop subject. All 17 guide URLs previously returned HTTP 200. Current statement preview visibly includes Avery, contribution rows and $14,588, matching its canonical data; no statement was generated or sent during this verification.

Overall readiness remains **PARTIAL / NOT READY for the complete presentation**. The legacy seeded historical statement version 2 has a generic recipient and no displayed contribution rows beside a $13,188 total. `02-finance.sql` used the old Giving Core statement snapshot (`rows`), while the current renderer expects `contributions`/`recipient`; UTC boundaries also display December 31. Preserve the immutable versions. A new held snapshot through the current statement API is the smallest demo fixture remedy; legacy rendering compatibility should be assessed separately. The older total predates the $1,400 eligible supplement and is not itself a ledger discrepancy.

Remaining presentation findings: recurring/partial payment details show Unknown fund/route labels; settlement detail has empty observation/batch sections although a reconciliation audit action exists; raw operator UUIDs remain. Forms list wraps labels awkwardly and shows ISO Updated timestamps, and read-only preview uses editor wording. Event Day mixes attendee and household units in 5/9. Reports/Payment can flash an access-unavailable placeholder while loading. These findings do not demonstrate unauthorized mutations, but block an unqualified presentation-quality PASS.

No application code, migration, provider configuration, real processing, business messaging, production or GiveHub change was made. Normal read-audit events remain intact. Documentation is local and uncommitted in this verification pass; no new deployment. NMI hosted acceptance remains paused pending credentials. The complete final matrix and evidence gallery are private in `audit/pastor-roddy-demo-2026-10-15/FINAL-DEMO-READINESS.txt` and `ui/final/index.html` in the outer workspace. Next work must be limited to these documented presentation/fixture issues and their focused rechecks; do not restart the package.

### Final presentation cleanup — October 16

Legacy Giving Core statements store aggregate report rows and a total, without itemized contribution snapshots. The historical page now labels that format explicitly, preserves $13,188 and explains why the current $14,588 preview differs. Neither snapshot nor ledger is rewritten. Newer itemized snapshots retain their original rows.

Payment details prefer supplied canonical snapshot labels and resolve exposed fund IDs using the existing scoped options. Missing projected labels are explicit (`Not designated`, `Routing not assigned`); no relationship is inferred from amounts or purpose. Settlement status/batch/date and amounts use supplied values, with unavailable fields marked rather than fabricated. Forms show organization-timezone dates with exact timestamp attributes, natural label wrapping, and a read-only preview toolbar for leadership. Event Day's old ratio combined registered households with checked-in people; they now have separate cards, and volunteer assignments are labelled accurately.

Focused checks: 275 reporting, 84 payment operations, 88 Forms, 21 Event Day; build/syntax/diff pass. No backend, migration, role or data edits. Final hosted evidence remains outside the public artifact.
