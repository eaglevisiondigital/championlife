# Resend delivery-event correction (source only)

The existing Resend host, outbox, authorization, consent, suppression and audit system remain canonical. Neither sending nor callback ingress is activated. This successor adds one guarded forward migration after `20261102154214`; historical migration bytes are unchanged.

| Verified event | Durable meaning | Retry / recipient effects |
| --- | --- | --- |
| `email.suppressed` | `provider_suppressed` receipt and organization/email/address hold; outbox `suppressed` unless prior delivery is already recorded | No retry. Distinct from consent withdrawal, complaint or hard bounce; never clear another suppression or consent. |
| `email.delivery_delayed` | Existing `sent` means API acceptance only, with signed event type in receipt plus `delivery.delayed` audit | Temporary, not delivered or permanently failed. Never schedules retry or downgrades a terminal status. |
| `email.failed` | Known canonical accepted attempt has provider failure; outbox failed unless delivered/suppressed already recorded | No automatic retry. Does not infer a recipient complaint/bounce or create consent. |

All events still require the unchanged raw-body MAC, exact account/profile/organization/sender/recipient/message/attempt binding, accepted persisted provider ID, current envelope and serialized organization lock. A lost API response without a known durable ID remains UNKNOWN; no heuristic adoption. Duplicate event IDs require identical body hash and canonical binding. Callback, hold, state and all audits commit atomically. Host ACK follows the committed RPC. A failure after submission can finish later, so replay remains idempotent.

Suppression is intentionally conservative across providers inside the existing organization/email/address suppression boundary. Future removal requires a separately authorized reviewed suppression process; `suppression.removed`, `sent`, `delivered` or a new consent does not automatically clear it. Raw provider prose is not retained or interpreted as permission. Late contradictory delivery is retained as a receipt without overriding a suppressed/failed message; operational investigation is required rather than resending.

## Primary provider evidence (read 2026-11-02)

- [Suppressed event](https://resend.com/docs/webhooks/emails/suppressed): account-level provider suppression, not proof of a new bounce or an unsubscribe.
- [Delayed event](https://resend.com/docs/webhooks/emails/delivery-delayed): temporary delivery issue.
- [Failed event](https://resend.com/docs/webhooks/emails/failed): failure to send, including sender/account/quota errors; not necessarily recipient fault.
- [Provider test addresses](https://resend.com/docs/dashboard/emails/send-test-emails): `suppressed@resend.dev` is documented and does not support labels. The example JSON dates in provider docs are examples, not observations of real events.

The previous acceptance checklist's unsupported-suppressed gap is addressed **locally**, not provider-certified. A separately authorized bounded acceptance plan may now include the documented suppressed simulator within its approved ceiling. Genuine delayed/failed event induction still needs a safe provider-supported method; do not invent one or report those cases witnessed. No email was sent, webhook registered, key installed or sender selected by this package.
