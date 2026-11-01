# Playback envelope verification — source only

This successor to `280120fbfe1e077320926e17e755af6715029d33` implements the previously abstract cryptographic playback verification step. It does not install a provider, key registry, receipt-ingestion service, browser telemetry collector, or completion writer.

## Implemented boundary

`createPlaybackEnvelopeVerifier` verifies a version-1 envelope with Node's Ed25519 implementation. Its exact fields are `version`, `keyId`, canonical base64url UTF-8 JSON `payload`, and base64url `signature`. The signed bytes are `championlife.playback-observation.v1\n` followed by the original payload bytes. The payload has an exact field inventory in source: receipt, learner/session, course/lesson, media/version, provider/policy, observation/validity times, eligible flag, interval and elapsed milliseconds. Unknown fields, invalid encodings, malformed claims, non-Ed25519 keys, mismatched key fingerprints and signatures fail closed. No HTTP/JWKS URL or caller key is accepted. Public keys and independent source-review metadata must come from the injected server repository.

The repository's `withCurrentObserver` must read current authoritative observer/key/policy records and serialize its callback and transaction completion with revocation. The observer must already have separately accepted independent observation provenance. Its exact public-key SHA-256, active revision, effective/expiry bounds and course/lesson/media/policy scope are checked. The verifier does not itself establish that the provenance review is legitimate; no production repository or approved observer exists here.

`reviewTrustedProgression` now re-verifies every envelope after entering the current-ledger callback, compares the whole proof including observer revision, and rejects changed ledger state during that await. Thus authority revoked while the review waits cannot reuse its earlier proof. The actual future backend must use a reviewed compatible lock order covering session, enrollment, media, receipts, answers AND observer keys/policies. An unprotected second check is not a substitute for those locks. These source adapters perform no progress transaction.

The existing 95% union-of-eligible-intervals rule is unchanged. Duplicate receipt replay cannot add unique time, conflicting replay rejects, and learner/session/media/policy mismatch rejects. A valid signature authenticates bytes and signer only: it does not prove actual watch behavior, human attention, or comprehension. Fictional key tests are not provider acceptance.

## Integration and release gates

1. Select and independently accept an observation source that actually measures eligible playback. A signature over browser-supplied telemetry is insufficient. No real provider/configuration decision is implied by the sample envelope contract.
2. Implement and review the current observer-key/provenance repository plus durable unique receipt ingestion and revocation semantics. Install no browser-owned approval flags or arbitrary remote key URLs.
3. Implement live session authentication, owner-bound ledger reads, and compatible serialization of all authority/evidence sources. Perform genuine provider acceptance separately.
4. Resolve the existing worksheet receipt bridge: the accepted owned worksheet RPC returns an opaque UUID revision, while the older disconnected progression answer-receipt contract expects a numeric revision. This package deliberately does not coerce the UUID into a counter or claim completion. The next narrow bridge must prove current same-owner/session/enrollment/lesson binding and exact saved-answer receipt under the completion transaction.
5. Only then implement/review an atomic 95%-watch plus valid-answer completion transaction. Every current review still returns `canCommit:false`. Lessons 5–13 lack cloud worksheets and videos 11–13 are unavailable; neither is fabricated.

No SQL, RLS, public site, SDK, existing worksheet transaction, learner answer, King Kind PR57, or production configuration is changed. Existing native database checks remain in CI; no new database claim is made by this crypto-only package. Real provider acceptance, cleanup/recovery and a separately authorized release remain mandatory.
