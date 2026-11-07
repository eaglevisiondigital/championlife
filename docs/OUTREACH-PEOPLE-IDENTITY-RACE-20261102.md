# People account-switch continuity

Source-only successor of PR72 at `51bbc88e9956d85759424aa2295b16820d2dd07d`. No database or authorization contract changes.

## Reproduced defect and correction

An earlier People boot could still be waiting for `getUser()` when a new account signed in. The newer account loaded its permitted People list, but the old verification result subsequently replaced the module's current user before the navigation-generation check. The next legitimate search or follow-up operation then compared the current session with the old user and incorrectly cleared the workspace as expired.

Keep the verification result local until its boot generation is confirmed current. Only then assign the module's user. A stale user, null result, or rejection cannot replace current state. Current permission denial and logout still clear protected data; no older account may issue a service request or restore protected content.

The existing user-visible journey is preserved: an authorized organization People operator can search, review a Person, read permitted follow-up tasks, and update a task with the existing organization, Person, task and revision filters. This correction keeps that journey working after an overlapping account verification. It adds no campaign decision access.

## Decision-roster installation boundary

The current PR72 source and PR75 snapshot `4d4344542135994384eaa96752eb5f73b4ba6087` do not contain `public.outreach_decision_workspace(text,uuid,jsonb)` or `public.outreach_decision_access(text,uuid,jsonb)`. The assigned-only scope and record-ownership checks behind the local Issue50 candidates are also absent. Historical local implementation exists, with later evidence corrections; its existence is not permission to import the paused advanced follow-up chain.

The installed-source `people_workspace` and `followup_tasks` contracts use organization People/follow-up authority. The event workspace uses event-registration campaign authority. Neither is an accepted campaign-assigned decision/free-book roster primitive. Before any new decision mount, a separately reviewed source composition must supply the trusted campaign/record decision scope and its minimized source, timestamp, consent and identity projection; export and care actions must retain their separate authority. Missing or revoked authority must deny at the backend. Do not substitute broad organization People grants, registration capabilities or client-side filtering.

Issue55's registration management, check-in and registration export scope for Aldo/Robert does not confer decisions, People, care, learner or messaging access. Event registrations, decision/free-book records, People relationships and learner activity remain distinct. No historical data is linked or reclassified here. Adult-evidence and recovery work remain paused.

## Targeted evidence

Local result:222 focused assertions across24 browser scenarios,64 existing navigation assertions and5 existing DOM authorization modes passed. The initial harness had an exact-label selector mismatch and an asynchronous Save observation race; both were corrected without changing runtime. The first complete failed log was overwritten before preservation; its observed excerpt and that limitation are recorded in private sprint evidence. The second failure log is retained. Prior sealed evidence remains untouched.

- `REPRO=1 node tools/outreach/people-identity-race.browser.mjs` against the baseline: false expiration reproduced in Chromium/WebKit at390,768,1440px.
- `node tools/outreach/people-identity-race.browser.mjs`: current-account search and task save after stale user/null/error, logout cleanup, no stale-account requests, scoped revision filters, current denial and safe error handling.
- Existing `people-navigation.browser.mjs` and `outreach-people.dom.mjs` preserve search/detail navigation, account clearing and task authorization behavior.

All identities, responses and operations are synthetic and browser service traffic is intercepted. Backend bytes are unchanged; existing native PostgreSQL evidence is not rerun or relabeled as new acceptance. No genuine Auth, hosted installation or production validation is claimed. Local source review and exact-head CI precede any separate release decision. No merge, deploy, hosted SQL, grant, account, message, payment or provider activation is authorized.
