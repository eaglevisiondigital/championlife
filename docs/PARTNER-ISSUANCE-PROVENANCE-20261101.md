# Partner issuance and canonical-identity boundary — source only

Base: accepted PR75 `fc7cbe5ec7e09b3e4319b20eb00ca1746d5cb8f2`. This package adds no public portal, staff login, financial intake capability, canonical Person record or live grant. Frozen PR61 remains the independent website release candidate.

## Private assignment preparation

The CLI-generated `20261101214027_prepare_private_partner_assignment_issuance.sql` adds only `private.partner_prepare_assignment`. PUBLIC, anon, authenticated and service_role have no EXECUTE permission; no public wrapper or fallback issuer is provided. Disposable tests invoke it as the local migration owner with fictional claims. That mechanism must never become the operational authorization procedure.

The existing revocation primitive's independent authority contract is reused as a necessary minimum: current verified Auth user/session, active staff directory and its configured account link, organization-wide `staff.manage` AND active campaign administrator `manage`. These checks are not a newly approved production Partner issuer policy. Financial/intake authority, tags, email matching, membership and registration operations cannot substitute. The Partner church must be active.

Three operations are prepared:

- `issue_access`: create only `partner.view`, for an already verified nonanonymous account with explicit current campaign `view`; requires finite explicit expiry bounded by all current authority/session/worker expirations. Creation revision must be zero. Existing access cannot be overwritten, reactivated or extended.
- `assign`: create one exact decision assignment under existing Partner access. It requires a distinct assignment UUID, current campaign–decision association and revision zero. Event registrations and invented Person links are excluded. Existing/duplicate active assignments cannot be overwritten.
- `reassign`: requires exact assignment, campaign, Partner, decision, former worker and positive observed revision. Both workers must remain independently eligible under current campaign/Partner grants; completed or revoked assignments cannot reopen. If the former worker is already revoked/expired, use a separately reviewed explicit revoke/new-assignment procedure instead of silently weakening this primitive. No contact/pastoral/export capability is issued.

The actor cannot target themselves or reassign their own record. Authority and target eligibility rows are locked `FOR SHARE` in consistent order; assignment/access target rows use `FOR UPDATE`. Request and absent-target advisory locks serialize idempotency/creation; explicit CAS protects updates. Reassignment cannot resume after a completed authority revocation. A revocation competing with an already authorized transaction waits or safely times out; it cannot partially commit either transaction. Expiry is rechecked after lock waits and after audit.

`partner.private_prepared` uses existing immutable campaign audit with actor, exact scope, request hash and committed before/after revisions. Identical replay requires unchanged committed state; altered/stale replay fails. Audit failure rolls back the permission/assignment transaction. Current assigned metadata still returns `personId:null` and `identityStatus:unverified`.

## Canonical Person provenance adapter

`canonical-identity-boundary.mjs` is a server-only dependency adapter, not an installed repository, endpoint or SQL provider. It validates actual Issue50 B/B1/B2 receipt/review/audit field contracts: exact source hash, current registrant and review revisions, common immutable request/actor, both identity/review audits, current canonical organization Person and active verified account binding. Explicit current campaign/Partner/assigned-worker rows and Auth/session are required. Unreviewed source fingerprints, missing receipts, conflicting accounts, stale revisions, revoked grants, changed accounts and absent provider all return null/unverified. Matching names, emails or households are never evidence. It returns no contact, audit detail, learner or finance data.

Preserved provenance pins:
- B SQL `03c3f6b94aadbe4195ecd9cea30463918687518d3c0ed5a630d3c7071d6c0020`.
- B1 composition `578fd9fa7eb6786eea79345039bc4eec0c11a2b779875759b770627eda727f6a`.
- B2 composition `46d29ac81d565f17b34e41571d47c2b016fe1b2f54242bf8c632562e5b9d7754`.

These are exact known source dependencies, not sufficient proof of an installed, current, accepted identity stack. A future trusted repository must independently reconcile the complete A/B/B1/B2 and later accepted corrections, verify current installed function fingerprints and read/lock all mutable source/authority/account dependencies in the same transaction. `withCurrentIdentity` is a required server binding, never browser-supplied snapshots. The new adapter is deliberately not wired into current Partner metadata until that provider and its genuine acceptance exist. Historical receipts alone cannot upgrade current identities.

## Acceptance and remaining gates

Node tests and existing intercepted Chrome/WebKit staff/Partner tests run locally. The Mac's native PostgreSQL launch was blocked before schema execution by exhausted shared-memory IDs; no unrelated processes or IPC were removed. The new actual SQL/native tests are wired into the existing public GitHub CI workflow, using disposable fictional PostgreSQL only. Source publication is conditional, not native security acceptance, until those tests and independent adversarial review pass.

No original SQL, staff runtime, SDK, King Kind migration, NMI or Giving code is modified. No production/live SQL, staff grant, account, contact attempt, message or deployment occurs. Remaining gates include explicit operational issuer policy, independently accepted canonical provider implementation, reviewed migration release order, genuine Auth/revocation/cleanup acceptance and separate owner release approval.
