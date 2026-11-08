# Verified device drafts — source only

PR120 allowed Lessons 1–4 to write and clear the prior account's device draft using only the cached displayed owner after missed Auth callbacks. Eight original write negatives failed; independent review reproduced sixteen writes and sixteen clear deletions across account replacement, logout, expiry and anonymous identities. These are fictional local reproductions, not hosted acceptance.

Both mutations now require the pinned existing Auth helper, current verified owner and latest unexpired session. Save snapshots remain private in memory until validation. Edit generations retire superseded writes and navigation; Clear cancels the cloud timer and pending local writes before its asynchronous verification. A newer edit retires pending Clear. Verification failure clears displayed fields while preserving previously stored drafts. The existing final local activity projection follows final draft validation; no new completion authority is introduced.

Per-input verification is not coalesced. Pending unverified edits can be discarded on navigation, account changes or a newer edit. The UI states that verification is pending; device-storage failure still permits the existing verified cloud save. Real provider latency, rate limits and performance acceptance remain untested.

Existing lifecycle tests retain their assertions with explicit waits for newly asynchronous draft admission. The original failures are preserved privately. All content, thirteen worksheets, SQL, shared Auth, SDK/SRI, trusted 95% actual watching, multipart 6/8/9 and missing 11–13 media gates remain unchanged.

`course-draft-session.integrity.mjs` verifies the actual candidate against immutable PR120, checks explicit changed hashes and bounded additions, and builds actual current output twice. Current tests run before separately labeled historical PR120 recipes. Existing immutable source guards and their assertions are preserved byte-for-byte and executed only against their exact source. A historical success does not accept current runtime; historical failures and CI incidents are not reclassified or retried.

No accounts, grants, identity links, messages, payments, hosted SQL, provider resources, recovery, merge or deployment. Release remains NO-GO.

## Historical dependency setup correction

The initial PR124 automatic run exposed a test-wrapper defect: a root `node_modules` symlink is a source entry rather than a directory covered by the historical `node_modules/` ignore rule. The immutable guard correctly refused it. The wrapper now creates a real dependency directory with per-entry links to the same already-installed packages. A permanent actual-PR120-clone check first reproduces the original guard rejection, then verifies source acceptance with the unchanged guard and the corrected directory. No guard predicate, historical command, runtime, dependency version or workflow timeout changes. Original failed run evidence is retained; this correction does not classify checks that never ran as passed.
