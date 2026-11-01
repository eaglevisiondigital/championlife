# H1 worker handoff correction — source only

The existing H1 worker now requires exact boolean `true` both to start and to
accept the existing database `authorize_external` decision. Non-booleans cannot
claim work, send, or convert resolver failures into successful authorization.
It keeps the existing `communication_outbox`, provider-test allowlist, consent,
`comm_external_lock`, leases, attempts and audit implementation. No migration,
new queue, automatic consent, callback verifier or live transport is installed.

An optional server-owned AbortSignal is checked before claiming, after resolving
a transport and after authorization, including the resolver-failure path.
Cancellation after an actual handoff cannot recall a message. The worker awaits
the adapter result, persists a valid receipt or explicit failure/UNKNOWN through
the existing result RPC without the cancelled signal, then stops before another
message. Failed acknowledgement propagates; there is no automatic resend.

A returned receipt must have the normalized `sent` status and a bounded nonempty
string provider ID without control characters. Malformed receipts stay UNKNOWN;
known accepted IDs remain unchanged. Adapters retain their existing explicit
transient/permanent classifications. Arbitrary failure labels cannot invent a
successful result. UNKNOWN requires separately reviewed reconciliation, never a
blind retry. Already-authorized but uncompleted handoffs also remain fail closed
under the existing expiry logic.

`external-worker.test.mjs` covers strict flags, cancellation across all awaits,
malformed receipts, lost acknowledgement and positive paths with fictional
adapters. `external-worker.native.mjs` replays the original schema and H1 fixture
in disposable PostgreSQL, uses actual H1 RPCs and tests durable consent denial,
UNKNOWN, lease expiry, accepted receipts and cancellation. No SMTP connection,
provider API, real credential, recipient or email is used.

The optional cancellation interface does not claim an off-device emergency stop
or provider-side cancellation. Existing global/organization/channel/profile
controls remain authoritative at the database handoff boundary. Genuine provider
acceptance, independent shutdown, custody, maintenance and explicit message
activation are still separate release gates.
