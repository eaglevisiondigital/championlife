# Disconnected Resend host composition — November 2, 2026

This source successor composes the accepted adapter with the existing H1 worker,
provider service RPC, outbox, attempts, consent, suppression and immutable audit.
It is not installed, registered or configured. Both factory flags default false;
there is no ambient fetch, environment-secret read, Deno.serve listener or active
provider registry entry. Network Solutions and Supabase Auth SMTP are unchanged.

## Exact dependency and execution boundary

`resend-host-dependencies.json` pins accepted baseline
`2d01b986d4e87180a290513dcfbbcd0ac895b1cf`, the complete existing migration-order
source files, automatic-RLS bootstrap, H1/reconciliation/context/Resend migrations,
worker, adapter and existing RPC transport. Tests verify their original hashes.
These are source dependencies, not proof of installation in any hosted project.

The CLI-generated forward migration
`20261102154214_communications_resend_host_lookup.sql` changes only the private
service dispatch wrapper, adds one `resend_lookup` action, and revokes direct
execution of its renamed predecessor. It creates no table, account, sender,
provider configuration or browser grant. A guard verifies the exact accepted H1,
receipt, context, Resend and public-wrapper function sources, public wrapper
invoker behavior and denied browser execution, and valid known-ID uniqueness.
Installation drift fails, rather than regenerating pins or restoring historical
grants. Historical migrations and original accepted code remain unchanged.

The new lookup requires one exact trusted organization/profile/account/environment/
project/provider and known Resend UUID. It takes the existing external-authority
lock and requires exactly one current accepted attempt with an unchanged persisted
send snapshot. Unknown IDs, UNKNOWN attempts, ambiguous rows, body/sender drift and
wrong scope reject. The return projection contains only the metadata necessary for
`resendReceipt`; no subject, body, unrelated Person record, raw event or secret.
The final existing `resend_receipt` independently rechecks every binding under its
own lock. Lookup does not confer permission to commit stale data later.

The existing service-role RPC is a privileged server boundary, not a demonstrated
new least-privilege database login. The future host must hold that capability
privately and expose only its exact route/method/profile, never an arbitrary-action
RPC proxy. Browser callers cannot submit this service action. Actual host role,
credential custody, schema/catalog verification and installation remain held.

## Fixed send transport and callback

`fixedResendTransport` accepts only the adapter's POST `/emails` request, a matching
private account and canonical idempotency key. It always targets
`https://api.resend.com/emails`; redirects, credentials/cookies, arbitrary paths,
auth-header overrides and ambient fetch are denied. The host supplies a private
send key and injectable fetch. Request body is capped at 65536 UTF-8 bytes;
response bytes at 8192. Timeout/abort/redirect/malformed response is UNKNOWN, never
an automatic resend. Only the existing adapter classifies definitive API errors.
No response body or key is logged or returned to H1.

The callback consumes bounded original bytes before any JSON parse. The accepted
Svix verifier runs before storage lookup. Incoming request cancellation, deadline
and host retirement stop new RPC submissions and cannot restore access. Only the
exact `resend_lookup` and `resend_receipt` actions are called, with organization
from trusted configuration. A 200 ACK requires a committed `recorded:true` or
`duplicate:true` result and `retry_allowed:false`; all failures produce non-ACK.
The caller must map this unmounted function to a separately approved exact route.

Cancellation is not proof that a provider request or submitted database transaction
was stopped. An already submitted receipt transaction may commit after an HTTP
timeout/retirement; the host returns 503 and the existing durable event ledger
makes later provider replay idempotent. It never deletes that evidence or invents
an UNKNOWN UUID. Outbound stop is independent of receipt ingress: accepted
receipts can still reconcile while new claims/sends are stopped. Full retirement
stops both paths. Neither stop can recall a provider request already handed off.

## Local verification and remaining release gates

Focused Node tests cover actual raw-byte MAC verification, fixed URL/no redirect,
strict flags, body bounds, abort, late completion, exact lookup/ACK actions,
independent receipt and outbound stops, and accepted source hashes. Disposable
native PostgreSQL tests replay existing SQL without production data, run the
existing H1 worker through injected fictional API responses, and prove lookup,
final receipt, audit rollback, separate-session duplicate callbacks, authority-lock
revocation, and late database commit/replay behavior. Synthetic signatures and fake
HTTP acceptance are not Resend evidence.

[Provider acceptance packet](RESEND-PROVIDER-ACCEPTANCE.md) still governs account,
provider-selection, sender/domain, endpoint, key custody, cost and independent
recovery/cleanup. Its previous missing transport/lookup source is now implemented
here but remains uninstalled and unaccepted by a real provider. No source-only PASS
approves credentials, DNS, email, hosted SQL, sender provisioning or Network
Solutions migration. `provision` still refuses Resend. The exact historical target
pin is not authorization to use that target. Genuine provider delivery and UNKNOWN
recovery remain unproved. Preserve UNKNOWN holds and all audit evidence.

Official protocol references reviewed November 2, 2026:
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/webhooks/verify-webhooks-requests
- https://supabase.com/docs/guides/database/functions

The email skill's example ACK-before-processing / reserialized-body pattern was
not used: the accepted project requires unchanged bytes and durable commit before
ACK. No raw-event logging or second queue was introduced.
