# P1 manual Person creation — unpublished local candidate

Base: `71b6da2`. Genuine acceptance exposed a source gap: Team application review sent staff to People & Follow-up to create a missing Person, but the current shared People UI offers list/detail only. This narrow P1 application-review change uses the existing protected canonical contact insert. It does not change shared People, SQL/RLS/triggers, Auth, grants, P0 applications, notification delivery or the426-file public manifest. The parent owns genuine browser acceptance and any later publication.

## Explicit review flow

1. Open an unlinked application. Search People explicitly by a reviewed name, email or phone; no source answer automatically becomes a lookup or identity match. Search terms are required and bounded to100characters. A full26-result page requires a narrower search before creation; missing/malformed/failed results never enable it.
2. Inspect possible matches. Existing candidate selection still opens the separate independent identity confirmation. Names/emails alone never prove identity. An authorized reviewer may instead choose **Create a new Person after match review**.
3. Enter reviewed first/last name and optional email/phone into initially blank fields. Public application values, companion names, Auth identities, age and Household information are never copied into the new contact automatically. Required names are trimmed and bounded to100characters; email/phone are bounded to320/40, reject control characters, and remain null when blank. Email also uses the existing browser email validity contract. Each field has an explicit label and existing responsive form styling.
4. Check **I reviewed possible matches and confirmed a separate Person is needed**, then explicitly submit **Create canonical Person**. An unchecked review or invalid field causes no insert. No automatic match, merge or source-application write occurs.
5. On confirmed success, the interface states that the application remains unlinked. **Review created Person for linking** opens the existing **Link verified Person** form. Its independent verification checkbox and reason are still required. Creation alone neither opens that form automatically nor calls `enroll`, approves participation, establishes age/guardian/driver eligibility, creates an account or grants access.

This is manual possible-match review, not a database uniqueness guarantee. Different people can share contacts; simultaneous reviewers can still create separate canonical records under the existing schema. Do not silently merge them or invent new dedupe policy. Existing trusted identity reconciliation remains separate.

## Current permission and insert contract

Creation presentation and submission require a fresh `staff_workspace_context` response containing the exact campaign organization in `organizations` and both organization-wide `people.read` and `people.create` grants for it (`department_ids` must be null/absent). Department arrays, another organization or partial/missing grants do not qualify. The current session's user must still match the bound reviewer. Context is checked after the match search, before opening the form, immediately before insert and again before rendering a successful result/link-review action. Losing the session or required permission denies the action and clears protected presentation. The existing event/application review gates remain in force.

The only direct write is:

```js
client.from('organization_people').insert({
  organization_id, first_name, last_name, email, phone
}).select('id,organization_id,first_name,last_name,email,phone').single();
```

The client supplies no `id`, `user_id`, `human_id`, portal/account link, affiliation, grant or application-link field. Extra/injected form fields cannot enter this explicit payload. The existing authenticated column grant, insert RLS and `guard_person_write` remain authoritative. Existing server defaults/`person_anchor` establish canonical identifiers; existing audit triggers retain their behavior. A UI context check is presentation defense, not a replacement for database permission enforcement or an atomic authorization promise across network requests. No service client or privileged RPC is added.

Application review binds its generation, reviewer and organization. Match searches also bind a version/query: editing the query invalidates results, creation review and pending responses. Application/view/account changes, logout, pagehide or detached mounts make late responses stale. A late insert response cannot restore protected information, offer linking or automatically reconcile an identity.

## Failure and retry boundary

Forms prevent concurrent double submission. Before the insert starts, the create form and its review authorization are consumed. Every attempted insert requires a new explicit search/review before another creation attempt. A timeout/network failure may have committed, so the UI never automatically retries or asserts that no Person exists. It shows **Person creation could not be confirmed. Search People again before creating or linking anything.** Unexpected/missing/cross-organization responses receive the same treatment. RLS/401/403 denial clears the view; search/context/insert provider messages are never rendered raw.

Current permission is checked again before showing saved contact details or the separate link action. This cannot undo an insert already accepted by the protected API; a session/view change or late permission loss withholds presentation and requires fresh review. No browser rollback, duplicate deletion or automatic retry is attempted.

## Verification and limits

`npm run test:team-person-create --prefix tools/backend-tests` passes81controlled DOM/security checks: explicit search and checkbox, no source-prefill, labelled/bounded inputs, exact five-column payload and minimal return projection, injected identity-field exclusion, no automatic linking, separate unchanged identity confirmation, global versus department/other-org/missing permissions, session loss and permission rechecks, stale search/form/account/view/insert responses, private-error redaction, malformed results, double submission, ambiguous-failure retry lockout, null optional contacts and text-only rendering.

The existing23Team/Travel DOM checks, complete regression suite and426-file source-preserving public build also pass. This package's local tests use synthetic context/insert responses; they create no hosted/database Person, Auth user, portal link, grant or message and do not establish genuine acceptance. Full regression logs and public-source preservation are recorded privately. The parent will exercise the protected insert, empty People/application journey and remaining actual browser/session/revocation/mobile gates using its already approved isolated accounts/permissions. No extra grants or production action are authorized by this source checkpoint.
