# Issue 56: disconnected progression evidence review

This source-only package does not change PR 57 or the public course. It uses the existing `getting-a-grip-on-the-basics` course identity, enrolled user ID and lesson number. No enrollment or learner store is added.

`reviewProgression` consumes a trusted backend port. `withCurrentEvidence` must verify the current Auth session, enrollment, provider-origin playback evidence and durable owned worksheet receipt, then serialize the callback with authority/evidence changes. Do not expose this interface to arbitrary client snapshots. A future database mutation must reevaluate inside its own transaction; this review result is never a transferable permission or completion token. `canCommit` is always false. No production port exists in this package.

Intervals are integer milliseconds, bound to the exact media revision and learner/lesson. Overlap and duplicate receipts receive no additional credit. Conflicting IDs, impossible elapsed time, unverified/client telemetry and seeks fail closed. At least 95 percent unique eligible playback is needed for advance evidence. This arithmetic cannot prove a person actually watched; provider collection, signatures, replay persistence and human-presence limitations require a separately reviewed implementation and genuine acceptance.

Completion additionally requires durable account/lesson-bound answer evidence. Actual cloud worksheets remain lessons 1–4. Private device notes for 5–13 do not count. Approved media for 11–13 is missing, so those lessons are unavailable even if a test port claims otherwise. No answers or notes leave the review result.

Next isolated work: design authenticated playback receipt ingestion and durable replay storage; define worksheet completion requirements and privacy-preserving optional device-note migration. Then independently review transactional progress writes, session revocation, browser playback and resume behavior. No new schema, hosted evidence, or progression enforcement is claimed here.

Run: `node --test tools/discipleship-progression/evidence-review.test.mjs`.
