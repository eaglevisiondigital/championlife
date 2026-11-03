# Existing-Person follow-up rescheduling

Source-only successor to PR72 `eb7ad80c322fe3664273c38f56d176b1e28e1583`. The supported journey is People → existing Person → create follow-up task → reschedule or remove its due date → complete the task. No hosted installation, real staff activation, communication or deployment is included.

## Source and scope

The public homepage's “I'm New” link still uses the existing external GiveHub connection form. This change does not import that form, identify a visitor from a name/email, infer a canonical Person, or change member onboarding. It works only with an existing canonical organization Person returned by the authorized People workspace. The prior PR72 creation flow and status vocabulary remain intact.

The missing capability was changing the due date after task creation. Each task now has a date input, Save due date and Remove due date actions. Dates remain calendar dates without timezone conversion. Removal sends explicit SQL null. The explicit removal action avoids WebKit's observed transient invalid result after clearing a previously populated date control; ordinary date edits still use native validity checking. No-op date saves do not write an event. Existing status saves retain their prior behavior.

Backend preconditions are unchanged:

- `20260926000821_followup_tasks.sql`: authenticated column-limited UPDATE, organization/person composite identity, three-permission RLS, revision increments and actor-bound before/after events.
- `20260926034222_tag_workflows.sql`: existing authoritative identity guard and workflow separation. No workflow fields are submitted.
- `20260928172557_people_staff_v1.sql`: effective, dated, active organization-wide staff permissions; department-scoped grants do not confer task management.
- `20261022201357_operations_admin_security.sql`: restrictive finance-linked task and event visibility.

No SQL migration, assignment directory, new identity/permission store, campaign authority or Person access grant is introduced. PR80–83 issuance remains uninstalled and non-executable. PR61 and PR84 stay frozen.

## Mutation lifecycle

Date and status changes share one pending editor state. Every mutation captures the exact organization, Person, task revision, verified principal, route, generation, shared auth owner, client and client-auth object. Fresh People/follow-up permissions are required immediately before the existing table operation. The UPDATE includes organization, Person, task ID and expected revision; the payload contains only the single field being changed, and only the task ID is returned.

Repeated clicks cannot submit a second operation while either date or status is pending. Observed client/owner/client-auth replacement retires the editor permanently, clears its private input values and cannot revive old handlers after restoration. Account, organization, route, shell and Person transitions prevent unsent stale updates; a submitted update cannot be canceled, but its delayed result cannot repopulate a newer view.

A zero-row result is treated as a revision/access conflict. Transport loss, malformed identity or another uncertain submitted outcome removes the mutation controls and offers a read-only task refresh. Nothing automatically retries an UPDATE. Refresh reloads the server's actual date/status and revision before a new intentional action. Before-submission access-verification failure may be retried. Raw backend errors never enter the DOM. Existing append-only task history remains append-only to authenticated application callers, without claiming immutability against owner/service authority.

## Validation

Focused commands:

```sh
node tools/outreach/church-guest-followup.native.mjs
node tools/outreach/church-guest-followup.browser.mjs
```

Local results: **59 native assertions**, **330 focused browser assertions**, **276 creation regressions**, **222 identity-race regressions**, **64 navigation assertions** and **5 DOM scenarios PASS**. Two identical 411-file public builds preserve every baseline public byte except the People runtime. Exact-head CI has not run locally and is not claimed.

The native test uses the existing full migration order in a disposable PostgreSQL Unix-socket instance. It covers reschedule, null clearing, completion, exact audit state and actor, stale revisions, two simultaneous connections with one revision winner, cross-organization/Person/task predicates, revoked/missing/future/expired/department grants, inactive/unverified/anonymous actors, forged authoritative columns, invalid dates, denied audit rewrites and financial task/event restrictions. No notifications, registration, waiver, course or Person rows change through date/status updates.

Chromium and WebKit exercise the actual People script at 390, 768 and 1440 pixels using origin-locked fictional transport. The suite covers the complete create→reschedule→clear→complete journey, minimal payload/return and exact revision filters, concurrent edits, repeated and retired handlers, UNKNOWN response loss, malformed responses, permission loss, account/Person/route/shell/client transitions, late replies, raw-error privacy and no browser storage. This is synthetic browser acceptance, not genuine provider Auth acceptance.

The dedicated workflow `.github/workflows/church-guest-followup.yml` runs the focused native and browser tests. Existing creation, identity-race, navigation and People DOM suites are also checked locally. Private screenshots, logs and build hashes live outside the deployable repository under `audit/product-development-2026-11-03/people/`. The public allowlist stays unchanged; only `assets/js/outreach-people.js` differs publicly. Independent review, exact-head CI and source integration are coordinator gates; hosted acceptance and release remain separately held.

## Handoff

The coordinator owns shared CURRENT_BUILD_STATE/architecture/security continuity updates during integration. No new policy decision is needed for this existing-permission date-management workflow. Native visitor intake reconciliation remains a separate scope because the external Connect form has no accepted canonical identity bridge here. Recommended next work is independent review and integration of this bounded successor, without implying a release or automatic identity matching.
