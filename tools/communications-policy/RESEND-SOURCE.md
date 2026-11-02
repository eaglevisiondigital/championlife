# Resend email adapter — source only, November 2

The owner authorized development, not provider selection or activation. Network
Solutions and Supabase Auth SMTP remain unchanged. No deployed function imports
this adapter. The runtime registry is unchanged; `RESEND_SOURCE_DEFAULTS` has
`enabled=false`, `structured_callbacks=false`. No API key, webhook secret, sender,
DNS record, endpoint or environment variable is installed. IO is injected; there
is no fetch, automatic retry, provider lookup by recipient, or fallback transport.

## Existing system integration

`resendAdapter` is consumed through the existing `runExternalWorker`, which still
claims and authorizes each H1 allowlisted test message through the existing RPC,
consent, suppression, current permission, lease and external-control locks. The
worker passes the successful authorization result to the adapter. A new forward
source migration stores an exact `resend_binding` on the existing attempt at that
handoff linearization point. The adapter compares its job and server profile to
that binding, including organization/project/environment/account/profile/sender,
recipient, purpose, canonical message/idempotency and subject/body SHA-256.
The field named `api_idempotency_key` inside this JSON is the public **idempotency header value**,
not a provider credential. It is SHA-256 derived from immutable request scope.
A changed body cannot obtain authority by inventing a second key. Lease changes
do not alter the key. The provider's 24-hour deduplication window never constitutes
indefinite rejection evidence. All timeouts, lost responses, 409 conflicts and
unclassified outcomes remain UNKNOWN, without automatic retry. Definitive API
400/401/403/404/422 responses remain permanently failed, not scheduled for retry.

The new `resend_email` discriminator is distinct from SMTP. Existing `provision`
still refuses it: a future reviewed server configuration/credential binding is
required. This source package does not create a second outbox, consent store,
People system, permission structure or provider installation workflow. Future
Global Propel may consume the contract with its own trusted host boundary; no
Champion Life identities, credentials or product records are transferred.

## Signed receipts and durable evidence

`verifyResendWebhook` requires a bounded Uint8Array and verifies HMAC-SHA256 over
`svix-id + '.' + svix-timestamp + '.' + unchanged raw bytes` using WebCrypto before
UTF-8 decoding/JSON parsing. It checks timestamp age/future skew (five minutes),
secret format, signatures, exact single recipient, sender and Resend email UUID.
The server-scoped secret and API transport must belong to the same reviewed
Resend account/profile. Provider payloads do not independently prove account IDs.
No callback tags, browser-supplied IDs, Message-ID headers or addresses establish
an attempt mapping. The trusted resolver must find an already persisted exact
Resend email ID; an UNKNOWN send without one remains held for manual review.

`resend_receipt` rechecks current control/profile and the original durable attempt
binding under `comm_external_lock`, then delegates to the existing H1 callback,
which owns history, suppression and immutable audit. Current account/profile,
content, reply-to, or environment drift fails closed even with a freshly generated
resolver result. A partial unique index prevents one Resend email ID from aliasing
multiple canonical messages in an organization. No authenticated/anonymous grant
is added, and the renamed helper is explicitly revoked from API roles.

The existing callback ledger retains Svix event ID, raw-body SHA-256, exact event
type/time, attempt and scope; raw payloads, signatures and secrets are not retained.
Duplicate identical events are idempotent; conflicting events reject. Audit failure
rolls back the receipt, delivery state and suppression in the same transaction.
`email.sent` means accepted, `email.delivered` recipient-server acceptance, never
reading. `email.delivery_delayed` preserves accepted state and its distinct event
history so a later delivered event can progress; it never schedules a resend.
Bounces and complaints use existing suppression, including complaints after
delivery. Late sent events cannot erase delivery/failure/suppression history.

## Tests and release boundaries

Local tests use fictional injected API responses/signing secrets only. Final local evidence: 349 Node tests (40 new), 59 new native PostgreSQL assertions, 18 existing receipt and 24 existing context PGlite assertions; full backend suite passed (1,268 PASS lines). The full suite initially exposed an older malformed callback fixture at unchanged base e0a677c; its profile/registry fixture now supplies the already-required exact context. No callback authorization rule was relaxed. The native
suite installs the existing approved test migration order, followed explicitly by
20261101214121, 20261101231457 and 20261102150100 in disposable PostgreSQL. These
source-only reconciliation migrations remain outside automatic historical replay;
no production migration ledger is rewritten. The CI job runs the same new native
suite plus existing receipt, H1 and Node regressions.

Before any activation: independent source acceptance and exact-head CI; current
schema/release-stack reconciliation; bounded hosted Auth/provider/callback tests;
verified organization-specific sending domains/identities and account ownership;
least-privilege sending API and endpoint-secret custody/rotation; trusted resolver
and endpoint installation; retry/receipt loss operations; maintenance, independent
shutdown/recovery/cleanup; billing and explicit provider-selection/migration/send
approval. No approval to migrate Network Solutions or Auth SMTP is implied.

## Primary protocol references

- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/webhooks/verify-webhooks-requests
- https://docs.svix.com/receiving/verifying-payloads/how-manual
- https://resend.com/docs/webhooks/event-types
- https://resend.com/docs/dashboard/emails/idempotency-keys

No new external dependency is added; WebCrypto is the runtime cryptographic
primitive. Tests independently use Node HMAC and frozen official Svix vectors.
