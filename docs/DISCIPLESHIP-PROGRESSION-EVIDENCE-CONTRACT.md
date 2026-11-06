# Issue 56: disconnected progression evidence review

This source-only package does not change PR 57 or the public course. It uses the existing `getting-a-grip-on-the-basics` course identity, enrolled user ID and lesson number. No enrollment or learner store is added.

`reviewProgression` consumes a trusted backend port. `withCurrentEvidence` must verify the current Auth session, enrollment, provider-origin playback evidence and durable owned worksheet receipt, then serialize the callback with authority/evidence changes. Do not expose this interface to arbitrary client snapshots. A future database mutation must reevaluate inside its own transaction; this review result is never a transferable permission or completion token. `canCommit` is always false. No production port exists in this package.

Intervals are integer milliseconds, bound to the exact media revision and learner/lesson. Overlap and duplicate receipts receive no additional credit. Conflicting IDs, impossible elapsed time, unverified/client telemetry and seeks fail closed. At least 95 percent unique eligible playback is needed for advance evidence. This arithmetic cannot prove a person actually watched; provider collection, signatures, replay persistence and human-presence limitations require a separately reviewed implementation and genuine acceptance.

Completion additionally requires durable account/lesson-bound answer evidence. This evaluator's completion contract remains lessons 1–4; the separately implemented cloud worksheets for 5–13 do not extend that authority. Private device notes never count. Approved media for 11–13 is missing, so those lessons are unavailable even if a test port claims otherwise. No answers or notes leave the review result.

## November 5 — unresolved multipart media fails closed

Lessons 6, 8 and 9 contain multiple videos, but this evaluator accepts only one media revision and duration. It now returns `media_unavailable` with all evidence flags false for those lessons, including when an individually valid signed receipt covers 95% or 100% of one video. Duplicating that receipt cannot supply a complete required media set. The current course owner's exact required-part/order/duration binding remains unresolved; this guard does not infer it from embed labels or create a multipart provider contract.

Single-media review for lessons 1–5, 7 and 10 retains the exact 95% unique eligible-interval requirement. Completion evidence remains limited to 1–4 and `canCommit` remains false everywhere. The cryptographic verifier may still authenticate an individual receipt for lessons 6/8/9; that receipt alone cannot establish whole-lesson advancement. No public course navigation, saved worksheet, SQL, provider registry or installed authority changes.

Permanent regression `multipart-evidence.test.mjs` reproduces the original positive review with the real Ed25519 verifier and adapter over fictional source fixtures. It checks the existing multi-video HTML, both direct and composed denial, 95%/100%/duplicate single-part claims, unaffected single-media lessons, missing 11–13 media and observer expiry. Fictional signatures prove neither actual viewing nor genuine provider acceptance.

Next isolated work: design authenticated playback receipt ingestion and durable replay storage; define worksheet completion requirements and privacy-preserving optional device-note migration. Then independently review transactional progress writes, session revocation, browser playback and resume behavior. No new schema, hosted evidence, or progression enforcement is claimed here.

Run: `node --test tools/discipleship-progression/evidence-review.test.mjs`.
