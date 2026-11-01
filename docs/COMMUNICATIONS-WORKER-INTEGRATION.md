# Existing worker safety integration

The existing CoreG/H1 runWorker implementation now requires exact boolean true before consume_events or claim. authorize_dispatch must return exact boolean true before transport handoff. All nonbooleans fail closed. Database consent, scoped authority, suppression, lease and provider controls remain authoritative; this is additional client/server-worker defense, not a replacement for them.

Optional cancellation stops new consumption, claims and handoffs, including after awaited authorization. Cancellation does not undo a request already handed to a provider. The worker persists that completed or uncertain outcome through the existing result RPC without propagating a cancelled signal, then stops before another job. Failed acknowledgement stops the worker and never resends; existing lease expiry/reconciliation handles unresolved outcome. UNKNOWN stays uncertain, and the existing outbox review cannot auto-retry or bind an unknown provider ID.

Tests call the actual worker with the existing acceptanceSink and fictional RPC responses; no network transport, real address, credential or provider is used. The original provider regression is preserved and added to dedicated CI. This correction changes existing executable source without enabling any worker, settings or provider configuration. Fourteen existing provider checks plus focused malformed flags/cancellation/outcome tests accompany the current consent/outbox suites. Real callback authentication, durable provider-state reconciliation and activation still require independently reviewed provider implementations and separate release authorization. Email consent never grants SMS consent; STOP cannot be overridden by this worker.

## Durable worker integration acceptance

`tools/communications-policy/worker-durable.native.mjs` runs the actual worker
through the existing RPCs in a fresh native PostgreSQL cluster. It replays the
unchanged migration inventory and fictional fixture, listens only on its temporary
Unix socket, and destroys that cluster in `finally`. It accepts no database URL,
provider credentials or external transport. CI runs this alongside the existing
Node and provider checks; no deployed schema or runtime source changes.

The 35 checks distinguish a lost response before result persistence from a lost
response after commit. A post-handoff lease without a receipt becomes uncertain
and cannot be automatically or manually retried; a committed result survives a
lost acknowledgement and is not resent. Known callbacks deduplicate; unknown and
cross-organization receipts cannot manufacture delivery. Cancellation after a
handoff still records its actual result but never hands off another claimed job.
Consent revoked between claim and dispatch blocks the fictional sink. Rejected
or unresolved operations create no successful provider-result audit.

The test is real database/worker integration with fictional provider outcomes,
not proof of external delivery, provider signatures or genuine Auth. Unknown
provider-ID attachment still needs a separately reviewed reconciliation operation;
these checks deliberately prove it remains blocked. Provider-specific definitive
rejection and idempotency guarantees must be established before enabling any
retrying transport. Existing sender and worker activation gates remain unchanged.
