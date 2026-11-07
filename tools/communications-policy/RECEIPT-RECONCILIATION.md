# Authenticated receipt reconciliation — local source candidate

This package extends the existing H1 outbox and service RPC; it does not install
a vendor verifier, activate any provider, create a second queue or resend a message.
Only the existing service-role boundary can submit a reconciled receipt.

A selected vendor's separately reviewed verifier must authenticate the complete
raw envelope, its provider-account binding, timestamp/replay window and fields.
The current endpoint's verifier registry remains empty. Caller flags such as
`verified:true` establish nothing. SMTP supplies no authenticated reconciliation
API by default: its UNKNOWN records stay held until an approved authoritative
mechanism exists. The fictional HMAC test verifier is not a production adapter.

A reconciliation event binds environment/project, sender profile/provider,
message ID, current attempt ID and the original idempotency key. The database
requires a previously authorized, finished UNKNOWN attempt on an existing H1
test outbox row. It accepts a new provider ID only from definitive authenticated
acceptance evidence with that complete request binding. Arbitrary receipt IDs,
older attempts, another profile/organization and contradictory resolved states
fail closed. Explicit `rejected` stays failed; `uncertain` stays UNKNOWN. Neither
is automatically resent, and reconciliation never issues a provider request.

The existing external-control/organization advisory lock serializes reconciliation,
callbacks, dispatch and consent changes. Callback event IDs now reject changed
message/outcome replays. A nullable `receipt_binding` column on the existing
callbacks table retains exact reconciliation provenance without storing raw
payloads, message text, addresses, keys or signatures. Historical records stay
unchanged. Existing append-only audit records and transaction rollback apply.
No anonymous/authenticated execute privilege or data access is added; the renamed
historical private service helper is revoked from API roles to prevent bypass.

Receipt processing records an already completed handoff even if consent was
subsequently revoked; it never grants consent, removes suppression or authorizes
another send. Cancellation cannot recall an accepted external message.

## Registry-to-profile callback binding correction — November 1 successor

The existing callback helper previously passed a registry binding to the verifier
without first matching its profile, organization and provider to the SQL profile.
A disconnected reproducer with all three mismatched still produced a reconciliation
payload. `verifiedProviderEvent` now checks the registry against the SQL control
and sender identity, environment/project, channel/provider, From and Reply-To
before invoking verification. It snapshots the context and rejects local identity,
callback-capability or registry changes while verification is pending. The verifier
receives an isolated binding copy; changing that copy also rejects the receipt.

These in-process checks are not durable provider authority or a substitute for
the vendor's actual account-bound signature/replay verification. The existing
final service RPC remains authoritative under `comm_external_lock`: it rechecks
current profile/environment/provider, canonical message/current attempt and
idempotency key, then records the receipt/audit atomically. No SQL changed.

Outbound enablement, sender activity and consent are intentionally not prerequisites
for recording genuine previously handed-off receipts. A disabled sender can still
reconcile UNKNOWN, and revoked consent is never restored by receipt processing.
No new outbound action, provider selection or verifier installation is introduced.
The real verifier registry remains empty and callbacks remain unavailable by default.

55 new tests cover registry/control/sender mismatches, missing identity, changes
during verification, isolated verifier input, disabled-send receipt processing and
the existing delivery/STOP mappings. Local Node suite: **297 PASS**; separate
Phase G adapter regression: **14 PASS**; unchanged PGlite receipt transaction checks:
**18 PASS** (not native concurrency). Initial missing local Nodemailer dependency
failure is preserved privately; the matching accepted lockfile's installed modules
were reused read-only for the passing run. Native PostgreSQL was not started on
the blocked Mac; its prior 110-check evidence and unchanged CI jobs are preserved.
New-head CI, independent source review and real provider acceptance remain pending.

## Dependency security correction

Nodemailer is pinned to **10.1.4**, the minimum patched release for the three
reported address-parser advisories, in both the Deno runtime import and exact
npm test lock. No unrelated dependency is updated. Official evidence:

- https://github.com/nodemailer/nodemailer/releases/tag/v10.1.4
- https://github.com/advisories/GHSA-8c8m-p3m8-cjg8
- https://github.com/advisories/GHSA-m943-m63m-w62w

The package requires Node20+, already satisfied by the Node22 CI workflow.
Registry integrity and signatures are checked separately from functional tests.
No dependency review establishes real delivery acceptance.

## Release gates and rollback

The new forward migration is local only and follows the existing H1 migration.
It is deliberately not added to automatic historical migration replay. A release
must reconcile the complete current schema, independently review this source,
prove vendor-bound signatures and UNKNOWN lookup behavior, establish credential
custody/recovery/maintenance and explicitly authorize any provider configuration.

To stop an eventual release, disable worker/endpoint ingress using the reviewed
runtime and database controls. Preserve UNKNOWN holds, original attempts,
callbacks and immutable audit records. Do not remove receipt metadata or recreate
historical evidence. Any database rollback is a separately reviewed forward
correction; do not reinstall the bypassable historical service or drop history.
