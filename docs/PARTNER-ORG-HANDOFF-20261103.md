# Partner financial intake organization handoff — source only

The existing staff shell and isolated Partner intake-review consumer link to `staff-outreach-partners.html?org=<selected organization>`. The destination previously ignored that parameter and selected its first authorized organization. A dual-organization reviewer could therefore open, review and update an intake in a different organization from the originating workspace. The backend correctly authorized the actor for that organization; the defect was an incorrect UI selection, not a database permission bypass.

The affected runtime is exactly Git blob `d8c567f7fd50adeb286d5a0342851f791ae3f357` at all three inspected sources: Partner PR75 `4d4344542135994384eaa96752eb5f73b4ba6087`, current main `999f4a75eeb8e4a05580dc603dda39ba64eb0409`, and preserved PR84 `40827da3a646a35165e5b3416568dbcc185ce83f`. This separate source correction starts from PR75 without changing the other source lanes or their accepted history.

## Corrected journey

An explicit organization hint must identify exactly one organization returned by the existing `staff_workspace_context` with both organization-wide `outreach.view` and `finance.read`. Empty, malformed, unknown, unauthorized or repeated hints show the existing denied state before any intake read. They never silently fall back to the first organization. The URL is a selector only; every list, detail and mutation still uses unchanged `outreach_partner_workspace` permission and organization/record checks.

With no hint, the existing first-authorized choice remains. A deliberate dropdown selection is reflected in the same local URL, so refresh retains that organization. The handler is bound to its original context, account and shared Auth client and must remain attached inside the active intake root. A retained old selector after account/context denial, client replacement or detachment cannot change the URL or issue a new request. Existing generation checks discard late prior-organization responses, and backend denial removes retained mutation controls.

The change is confined to the existing financial intake reviewer. It does not mount the held assigned-ministry Partner adapter, create a People relationship or identity link, grant finance/pastoral/child access, change Auth or permissions, or install any database objects. Global `CanAuthorize=false` and the existing host declaration gate remain intact. Partner managed-Auth fingerprint and inherited PUBLIC TEMP incompatibilities remain unresolved. This correction is independent of those blocked installation paths.

## Local validation

- Original-source JSDOM reproduction demonstrates a B handoff querying and reviewing organization A.
- 19 focused DOM cases cover exact selection, absent/duplicate/malformed/unauthorized hints, missing either permission, manual selection, account changes, stale responses, backend denial and retained selectors after account/denial/client/detachment.
- Existing Partner DOM regression passes its reviewed-contact workflow and 14 denial scenarios.
- 113 native PostgreSQL and Chromium/WebKit assertions at 390/1440 pixels exercise the actual page and unchanged RPCs with fictional Auth and fully intercepted transport. Four authorized B review operations create exactly four B audit rows; A remains unchanged. Native wrong-organization, foreign-record, missing-finance and post-revocation calls deny; denied/stale controls issue no new mutation. No Person or identity link is created.
- Site-build safety passes; two 411-file builds are identical, and only `assets/js/staff-outreach-partners.js` changes in the public artifact. CSS, HTML, logos and other runtime files are unchanged. Stable post-save screenshots preserve the approved page layout.

The dedicated `partner-org-handoff.yml` runs these checks on pull requests and pushes to the existing `codex/publish-partner-20261101` source branch. PR75 already has an outstanding conflict with its PR72 base; exact-source push CI does not resolve that conflict or establish integration readiness. No broad merge or dependency reconciliation is included here.

Browser identities are fictional; genuine Auth, provider configuration, independent recovery/cleanup and separately authorized website release remain untested/held. Local PASS is source readiness only. Root coordinator owns continuity reporting, independent review and any draft publication. No source push, hosted SQL, credentials, real accounts/grants, payment, message, resource creation, merge or deployment is part of this package.
