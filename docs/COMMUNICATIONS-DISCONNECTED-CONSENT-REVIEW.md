# Disconnected Core G/H1 consent and retry review

This additive tools-only adapter reuses the existing provider failure classifier and tests the existing disabled worker and synthetic acceptance sink. No new queue, recipient database, consent store, provider credential, sender or transport is introduced. No real delivery occurs.

The current-policy port is a trusted backend responsibility, not client input. It must authenticate the current actor and session, authorize the exact organization/campaign/recipient/message/channel/purpose, obtain authoritative current consent and suppression, and serialize the snapshot with consent/revocation/outbox changes. The existing consent proof reference maps to `consentEvidenceRef`; the revision is a proposed trusted aggregate snapshot version, not a claim that the present SQL already exposes a revision column. Port/schema integration is still outstanding.

The review deliberately requires exact campaign consent (including explicit null for an organization context). It does not silently broaden current Core G's existing organization-consent fallback. A future policy decision may map inherited consent explicitly; this package does not change the backend policy. Email, SMS, transactional, discipleship and marketing scopes remain separate. Missing suppression state denies. No private address/body or provider errors are returned.

Accepted/delivered attempts never retry. Unknown/ambiguous outcomes require authoritative provider reconciliation. Definitively rejected transient attempts can be reviewed only; `canSend`, `canAutomaticallyRetry` and `canChangeConsent` are always false. A later send must use existing backend dispatch authorization with fresh scope/consent/suppression and idempotency. Review output is not a dispatch permit and cannot recall messages already handed to a provider.

Before any genuine provider exercise: independent code/security review; exact provider/recipient mailbox approval; scoped custody and recovery; supported authoritative attempt reconciliation and consent-snapshot binding; race tests at the backend handoff; disabled-by-default configuration; separately approved synthetic hosted acceptance. No ministry or marketing sends are authorized.

Run: `node --test tools/communications-policy/disconnected-review.test.mjs`.
