# Partner draft integration and private revocation preparation

## Stack integration

The November 1 Partner branch had copied the reviewed shared-client files without inheriting the current Outreach head. Git reported two add/add conflicts, although Partner contained the complete current Outreach files plus its independently accepted fixed metadata reader and tests. A local two-parent integration incorporates exact Outreach commit `f2f518fbed16ed5e1d4a38a790cd95965fc1c635` into Partner `b74787a17dd17e5cbb992009df4696366b63f3e7`. Only the two conflicts were resolved to accepted Partner bytes. The integration commit's entire tree equals the prior accepted Partner tree. This is draft source-history reconciliation, not a PR/main merge or a production release. No rebase, force push or retarget is involved. Current-base PR CI remains necessary after publication.

## Private primitive; no operational issuer

`20261101164328_partner_private_revocation_preparation.sql` adds only `private.partner_revoke_assigned_access`. It has no public wrapper and denies EXECUTE to PUBLIC, anon, authenticated and service_role. No new endpoint can be called by an application role. The function can only reduce existing Partner access or revoke an existing exact assignment; it cannot create, grant, reassign, extend, link People or change campaign registration permissions.

The existing independent administrator contract is reused as a **required internal minimum**, not a declaration that this authority is sufficient for future Partner issuance. Specifically: verified active Auth user and owned current Auth session; active organization staff directory; any configured administrator Person/account link; organization-wide `staff.manage`; and current campaign administrator `manage`. Both authority sources are required. Financial permissions, arbitrary role labels, Partner tags, organization membership or registration operations cannot substitute. Self-target changes reject.

Source provenance for these dependencies is the existing operations administrator migration `20261022201357_operations_admin_security.sql` and its unchanged staff directory/permission and campaign administrator definitions. The primitive locks the mutable dependency rows `FOR SHARE` in fixed order before target `FOR UPDATE`, checks wall-clock expiry again after waits and before returning, and enforces explicit positive expected revision. Transaction aborts/deadlocks/timeouts must deny/retry; they cannot silently commit. It intentionally does not use an unprotected second boolean authorization check.

Revocation uses the existing immutable campaign audit. A request UUID is serialized through a transaction advisory lock and bound to actor, campaign, Partner, kind, target, expected revision and reason. Same-request replay requires the same still-current revoked state; changed replay, stale revision, missing target and self-target reject without successful audit. Audit failure rolls back the target change. No document, email, session token or source-person payload enters the audit; operational reason text must follow the existing private audit handling rules.

Synthetic tests invoke the private function only as the disposable migration owner and separately prove every application role is denied. That test mechanism is not an operational invocation design or permission to simulate real JWTs. A public wrapper or EXECUTE grant would require a separate reviewed policy, authority/issuance workflow and release approval. There is no service-only fallback.

## People identity contract remains held

The initial Issue50 A receipt is not sufficient by itself. The preserved B candidate `f06c5a2673e93fc93a2fdbf886aaf165cf468b18` adds `private.city_identity_reviews` and immutable `private.city_care_requests` alongside the A identity receipts. Review state binds campaign/source, linked/unlinked/keep-separate/deferred outcome, source hash, review revision and registrant revision; `decision.review_completed` audit binds the request and outcome. B also wraps the original reconciliation to reject unverified linked accounts. B2 candidate `53adb74df0b02c77784e5f00f2fb6b5a64e84baa` further binds assigned-only scope and independent identity administrator requirements.

Exact preserved source references:
- Package B SQL SHA256: `03c3f6b94aadbe4195ecd9cea30463918687518d3c0ed5a630d3c7071d6c0020`.
- B2 composed SQL SHA256: `46d29ac81d565f17b34e41571d47c2b016fe1b2f54242bf8c632562e5b9d7754`.

Those unreleased source dependencies are absent from the current accepted production-schema baseline. They are not copied, installed, dynamically trusted by table name or replaced with a new identity store. Before a Partner Person link can become trusted, reconcile the latest accepted A+B+B1+B2 and later security corrections, exact source fingerprint, current receipt/result/review/audit revisions, independent administrator, current source hash, active canonical account link and revocation behavior. An old receipt or non-null `outreach_campaign_registrants.person_id` cannot establish this.

Current Partner output therefore remains `personId: null`, `identityStatus: unverified`. People resources, contact actions, learner data, financial intake and pastoral information remain unavailable through this assigned-metadata route. Matching names/email/households never upgrades identity.

## Release separation

The new private primitive depends on the preceding assigned-metadata table migration. Neither migration belongs in frozen schema-free PR61. No runtime website mount, SDK, King Kind, Giving or production configuration changes are included. Source tests and current-base CI do not establish genuine Auth, reviewed Partner issuer policy, verified People linkage, independent provider recovery or deployment readiness.
