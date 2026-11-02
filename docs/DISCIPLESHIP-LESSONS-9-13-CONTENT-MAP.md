# Lessons 9–13: approved-source worksheet map

Source checkpoint: `7eb671e0c8d1467446814f642de4dab2f363e46e` (PR #76). This catalog maps existing course materials; it does not mount worksheets, change permissions, install SQL, enable progression or invent questions. `tools/discipleship-progression/lessons-nine-thirteen-content.json` binds each chapter and its mirror to SHA-256, chapter/full-workbook page locations, exact section headings and existing video IDs. The catalog remains outside the public build.

## Verified material available for the next worksheet increments

| Lesson | Existing chapter | Chapter pages | Full-workbook PDF pages | Printed pages | Sections |
| --- | --- | --- | --- | --- | --- |
| 9 | How to Be Sure You Are Filled with the Spirit | 1–7 | 67–73 | 73–79 | A–G |
| 10 | How to Grow and Develop Your Faith | 1–6 | 74–79 | 81–86 | A–G |
| 11 | How to Experience the Abundant Life | 1–8 | 80–87 | 87–94 | A–F |
| 12 | How to Be an Overcomer | 1–10 | 88–97 | 95–104 | A–E |
| 13 | How to Serve God | 1–8 | 98–105 | 105–112 | A–H |

PDF page numbers are one-based file indices. Printed page numbers must not be used as PDF fragment offsets. The 39 chapter pages have identical extracted page text to the indicated full-workbook pages, and both copies of each chapter have matching bytes. Original source typography is visually checked where the extraction corrupts headings; for example, “BENEFITS,” “VERY,” “RECEIVING,” “CONTENT,” “HEALING,” “THERE,” and “THEIR” are not copied from OCR misspellings.

Each section range includes the page on which the next section starts when sections share a page. A section can contain several numbered prompts, several blanks, scripture study or instructions rather than a question. Section count is **not** answer count. This map is not a grading rubric or proof of a completed cloud worksheet. A future worksheet must disclose any response-group presentation and link to the full section/subquestions, as the Lesson 5 implementation does. Never pad a lesson to twenty invented questions to fit the current lessons 1–4 completion contract.

The existing chapters have sufficient source material for further worksheet implementation without waiting for a playback provider. Keep chapter increments independently testable. Reuse the existing owner-bound answer store, opaque revision transaction and logout/account-transition cleanup. Do not create another answer or enrollment store. Cloud answer saving must remain separate from watch credit and advancement.

## Privacy-sensitive source instructions

- Lesson 9 E is explanatory question-and-answer material, not a learner quiz with ten new answer blanks. F contains personal reflection; G is a group exercise. Do not grade doctrine or infer verified viewing from responses.
- Lesson 10 F describes an individual faith exercise; G suggests reading books. These are not evidence of watched minutes or automatically verified completion.
- Lesson 11 E is optional further scripture study. F concerns prayer involving hardship, sickness and other private circumstances. Do not collect third-party health, financial or prayer details as required worksheet answers or expose them to staff.
- Lesson 12 D concerns private personal reflection and prayer; E is a group exercise. Do not require a cloud confession or infer attendance, spiritual status or a verified outcome.
- Lesson 13 F is optional prayer instruction. G asks readers to make lists of friends; H describes local-church participation. Keep these source instructions in the workbook, not as compulsory collection of third-party identities, a People import, membership enrollment, staff permission, ministry-contact consent or proof of church service. E includes stewardship/financial reflection; learner responses remain private and must not flow into Giving.

These distinctions preserve the existing private learner boundary; this catalog does not authorize a new sensitive-data collection or retention policy.

## Existing media and the multipart decision still needed

The catalog records the existing HTML, not current remote availability, duration or media-owner rights.

- Lesson 6 has `enGySOvV4jg` (“WEEK 6”) and `TjuLVCy4gnQ` (“WEEK 7 (Lesson 6 PT1)”). The labels do not unambiguously establish Part 1/Part 2. A course-content owner must confirm the intended pair/order and whether both are required; do not silently rename or drop either.
- Lesson 8 lists `2VDVveA4RUQ` and `g8b964SWekE`, labeled Parts 1 and 2.
- Lesson 9 lists `HY1OyDdODL8` and `vjY2BTUzxGU`, labeled Parts 1 and 2.
- Lesson 10 lists `5-1B6IouUNk`.
- Lessons 11–13 have “Video coming soon” and no embed. Approved videos, media identity/version, rights and verified duration are missing. The available PDFs are not substitutes for viewing evidence.

For lessons 6/8/9, the content owner must approve the exact required parts, order if relevant, canonical media revisions and durations, and how the accepted 95% unique eligible-watch rule applies to the required set. No rule is implemented here. Do not let a watched short part stand in for an unwatched required part, count overlaps/replays twice, or infer a lesson policy from the “Video 1/2” labels. Each approved part needs its own binding and eligible-interval evidence before any aggregate gate can be independently accepted.

## Exact provider and retention gaps

The [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference) provides browser JavaScript controls and player callbacks; the [Analytics metrics](https://developers.google.com/youtube/analytics/metrics) describe channel/video watch measurements. Neither reviewed interface establishes the required signed, Champion Life learner/session-bound eligible-interval receipt. This is a limitation of the reviewed interfaces, not a claim about every possible provider product. Browser callbacks, elapsed timers and signatures added to browser reports are not independent actual-watch evidence.

The approved source contracts already exist; do not create another verifier prototype. Before wiring an actual source, the provider/content owner and security reviewer must supply and accept:

1. Exact authorized media, version, duration and approved multipart policy; media hosting/measurement rights.
2. Independently trustworthy observation semantics: verified learner/session binding, eligible intervals, seek/replay/speed/background treatment, receipt uniqueness and server timing. A signature alone does not prove the underlying observation or human attention.
3. Verified raw receipt/envelope format, key identity/custody/rotation, replay and late-receipt behavior, source review hash, revocation and authoritative reconciliation; no client-provided source-approval flag.
4. Least-privilege ingester/host binding and fresh serialized session/enrollment/answer/profile validation through the existing completion transaction. Existing provider registry stays empty and completion unsupported outside its reviewed scope.
5. Owner-approved finite receipt/audit retention, permitted readers, correction/revocation, learner deletion/pseudonymization and immutable-evidence preservation. Current evidence intentionally does not cascade-delete; an indefinite lifetime is not an approved policy. Keep raw answers out of watch receipts and audits.

Selecting a provider, setting durations, installing credentials, moving media, enabling a host or granting completion still requires the separate existing approval and genuine acceptance gates. Saved worksheet answers alone confer none of those capabilities.

## Validation

`node --test tools/discipleship-progression/lessons-nine-thirteen-content.test.mjs` verifies source hashes/mirrors, the five chapter maps and their structural ranges, exact existing media IDs/titles, missing-video truth, preserved private-notes binding and public-build exclusion. Private audit evidence preserves PDF extraction, rendered pages and the 39-page full-workbook comparison. These are source-readiness checks, not learner/provider acceptance.
