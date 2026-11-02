# Trusted lesson completion transaction — uninstalled source

This successor adds the missing atomic database boundary to PR76. It does not activate course gating, choose a provider, ingest real observations, expose a public RPC or change existing course screens. The forward migration was generated using installed Supabase CLI2.81.3 `migration new`; it has not been installed anywhere hosted.

## What now executes in fictional databases

`private.commit_trusted_lesson_completion(lesson, worksheet UUID, profile UUID, profile revision UUID, observation UUIDs)` reuses `owned_progression_snapshot` and therefore the accepted current verified Auth user/session, enrollment, opaque answer version and legacy worksheet mutation mutex. The caller cannot supply a learner/session/enrollment identity. All twenty required saved answers must be nonblank. Only lessons1–4 currently have cloud worksheets; no completion is manufactured for5–13.

Three private tables hold an empty-by-default observer profile registry, immutable eligible observation records with irreversible revocation, and immutable completion audits. They are evidence metadata, not another People, enrollment or answer registry. All have RLS enabled and no API table privileges. The new completion function is SECURITY INVOKER, has an empty search path and no EXECUTE grant to PUBLIC, anon, authenticated or service_role. There is no public wrapper or installed trusted writer. Owner-level fictional test setup is not a proposed production credential.

The observer profile has exact provider/key/source-review hashes, course lesson/media/version/policy, duration and finite effective/expiry bounds. Every profile update replaces its opaque revision. Receipt IDs and original envelope hashes are unique per profile. Receipt payloads cannot be altered or deleted; revocation cannot be reversed. Inserting a row is NOT cryptographic verification: the future server ingester must use the existing domain-separated Ed25519 verifier, independently approved observation provenance, exact profile binding, current session/enrollment and a reviewed lock lifetime. That ingester and its least-privileged provider-authenticated host are not configured here.

Completion reads only the specifically requested receipts. It checks current profile/revision, owner/session/enrollment, lesson/media/version/policy, observation timing, revocation and elapsed duration. Ordered interval union prevents duplicate/overlapping intervals from inflating watch time; `unique_ms *100 >= duration_ms *95` is exact integer arithmetic. No seek-to-end or answer-only fallback exists.

Within one transaction it upserts the existing `lesson_progress` compatibility row and appends an exact private audit containing actor/session/enrollment, worksheet UUID, profile/review/key/media/policy, interval totals and receipt UUID/hash/timing bindings. An audit failure rolls back the progress change. Session/profile/receipt expiry is checked again after any progress-row wait. An exact replay revalidates current proof and returns the original audit without another write. A later legacy progress edit is not overwritten by that retry. A changed receipt set for the same audited binding conflicts rather than rewriting evidence.

Existing browser-owned `lesson_progress` writes remain unchanged. They do NOT create a trusted completion audit and MUST NOT be consumed as verified completion. An audit records a historical transaction, not perpetual authorization: revocation, answer edits, media/policy replacement and enrollment/session changes must be freshly checked for subsequent gated actions. No course-level completion, unlock or 13-lesson certification is inferred.

## Serialization and retention

Lock order reuses Auth user/session rows → existing worksheet transaction mutex → course/enrollment/version → profile/receipt rows → progress row → audit. All profile/receipt DML and truncation acquire the same mutex before row locks. Thus a committed authority change cannot be bypassed with a pre-wait snapshot. Provider verification cannot occur outside this ordering and be declared still current later. Native CI exercises competing mutations; PGlite alone does not prove cross-process locking. Lock timeout is2seconds and failures abort the transaction.

No new trigger or policy is added to the existing progress/answer/Auth tables. The prior worksheet trigger source remains byte-identical. No broad table lock or live service-role privilege is introduced.

The audit and receipt rows deliberately do not cascade-delete with learner/enrollment deletion: historical evidence remains private, carries no raw answers, and cannot reauthorize a replacement enrollment. A separately approved retention/pseudonymization/erasure procedure and exact minimum storage lifetime are still required before installation. Do not ship indefinite retention as implicit policy or delete immutable evidence as ad-hoc cleanup. Disposable test databases are dropped in full; production rollback would disable the consuming host/profile and preserve records, not drop evidence or rewind completed progress.

## Actual media and provider gap

Current source uses YouTube embeds for lessons1–10; lessons6/8/9 include multiple video parts. Lessons11–13 have no approved videos. This narrow completion source supports only the current single-video/cloud-worksheet lessons1–4. Multi-part lesson policies and missing worksheets/media remain separate, explicit work.

The official [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference) exposes browser JavaScript state/time callbacks. Those are not signed server observations tied to a Champion Life learner/session. The official [YouTube Analytics metrics](https://developers.google.com/youtube/analytics/metrics) describe channel/video metrics such as average duration and estimated watched minutes; this reviewed interface does not establish the required per-learner signed eligible intervals. We have no accepted YouTube receipt integration. Do not wrap client events in a signature and call them independent proof. A valid signature authenticates bytes, not human attention or comprehension.

Owner/provider decision: retain YouTube for ungated viewing while selecting and independently reviewing an observation source/hosting arrangement that can bind eligible playback intervals to verified learner sessions and owned media. Do not purchase, move media, configure credentials or reduce the95% requirement without approval. A provider must supply exact source provenance, session binding, replay IDs, eligible playback/seek semantics, duration/media revision, revocation and verifiable receipt/lookup contracts. If unavailable, genuine watch gating remains NO-GO.

## Validation and remaining gates

`completion.database.mjs` executes the actual forward migration over fictional Supabase/Auth fixtures in PGlite or disposable native PostgreSQL. It covers default-disabled state, exact bindings, revoked/expired users/sessions/profile/receipts, stale answer UUID, incomplete durable answers, wrong account/lesson/media,95% boundary, overlapping intervals, audit rollback, immutable history, API denial and idempotency. Native mode additionally tests held locks, committed observer revocation and session expiry during a progress-row wait. Existing293 Node and36 snapshot SQL checks remain applicable. Exact current counts and independent review live in the private sprint evidence.

Before hosted acceptance: independent source/CI PASS, accepted real observation contract and ingestion, least-privileged current-authenticated host binding, scoped retention policy, native target compatibility, recovery/custody/maintenance gates, then separately approved installation and genuine provider tests. King Kind PR57 remains held. No public learner, financial, staff or outreach permission changes are included.

Supabase function/privilege reference: [Database functions](https://supabase.com/docs/guides/database/functions).
