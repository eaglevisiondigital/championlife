# Accepted Person follow-up with task pagination

This source composition brings the already accepted due-date workflow into the current People task pages. Staff with the existing permissions can reschedule or remove a task's date, then complete or cancel it, while remaining on the page containing that task. It does not add a task-title editor, another task system, permission, or identity association.

## Exact source provenance

- PR72 `8fad1b0e98292543a9be27a7960c4ff81521efa3` supplies the current People runtime, search, identity guards, and bounded keyset task pagination. Its People script SHA256 is `0c54b97fc6c4ac204de5bb62cffc2876eedcbd38f265384c88d2ea2762c9ab42`.
- PR85 `a9dc5260765bcaea8ad18af34ae91270c10b7cfb`, reused by PR86 `da658ea4c0fd9590e969bbc6ad772f02b3a99b12`, supplies `addTaskActions`. Those two accepted People scripts are byte-identical, SHA256 `0e3311916834e3dd1c5e1ae7840063cfd21d35c3da1672d3b782ca30065d8d07`.
- The accepted helper SHA256 is `8e67f1056799b5f7b4a7cbb580c420672b61e23b50cdd9949b2260d18ef0e374`. The only helper adaptations are the `taskCursors` argument and its two `detail(personId,taskCursors)` return paths. A permanent test reverses precisely those adaptations and verifies the accepted helper hash.

The textual conflict is confined to the task-card status controls: the current inline status handler is replaced by the accepted date/status helper. The current detail query, 101-row lookahead, 100 visible rows, creation-time/UUID ordering, typed cursor, older/newer navigation, post-read permission checks and new-task workflow remain intact. Creating a new task still returns to the latest page. Date/status updates and read-only reconciliation return to the current page.

## Existing authority and uncertain outcomes

Each mutation uses the current organization, Person, task and expected revision. Only the chosen `due_on` or `status` field is sent. Existing database grants, RLS, task revisions and audit triggers remain authoritative and unchanged. A date save does not send a message or establish campaign eligibility.

The accepted helper refreshes permissions before mutation and blocks stale identity, client, organization, route, detached card and inactive Staff shell contexts. Concurrent submissions are suppressed. A missing saved row is a conflict or access change; an ambiguous response may have succeeded. Both retire the save controls and offer a read-only refresh without replaying the write. These browser controls do not provide transaction finalization or cross-session idempotency.

## Focused validation

`tools/outreach/people-followup-composition.browser.mjs` runs the actual common and People scripts in Chromium and WebKit at 390, 768 and 1440 widths using fictional origin-locked transport. It covers older-page date reschedule/removal/status, exact revision predicates, unchanged/invalid dates, concurrent inserts/deletes, duplicate/uncertain/stale saves, detached handlers, identity/client replacement, revocation, read-only access, and late responses. It records the two source provenances above. Existing SQL and accepted native evidence are reused; no new SQL was necessary.

The baseline reproduction confirms that PR72 has task paging and static dates but no existing-task due-date controls. This is an integration gap between accepted branches, not a newly designed workflow. Test counts and independent review results are recorded in the private cycle report and CI logs.

## Release boundary

This is source and fictional-browser validation only. Genuine provider Auth/RLS acceptance, independent recovery/cleanup, the approved exact release composition and explicit website release approval remain separate gates. No hosted SQL, real accounts or grants, campaign identity association, outbound message, payment, frozen backoffice change, or deployment is included. Existing branding, session code, public navigation and giving links are unchanged.
