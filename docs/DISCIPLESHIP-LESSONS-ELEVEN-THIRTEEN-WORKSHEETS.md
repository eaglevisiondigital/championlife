# Lessons 11–13: limited private study responses

This source-only increment reuses the existing account-owned worksheet store and opaque revision transaction. It is composed with the Lessons 9–13 runtime/SQL extension before publication. This page-only commit is not a standalone deployable release: the shared runtime and installed RPC must agree on the exact lesson and field count. No hosted installation, permission change or completion activation is authorized.

| Lesson | Selected existing content | Cloud fields | Explicitly omitted |
| --- | --- | --- | --- |
| 11 | Exact A–D Scripture-study headings, linked to chapter pages 1, 3, 4 and 5 | 4 | E optional further study and F group prayer; personal health, financial, hardship and prayer details |
| 12 | Exact A–C Scripture-study headings, linked to chapter pages 1, 3 and 4 | 3 | D personal application and E group exercise; confessions, personal trials and third-party details |
| 13 | Four exact printed Scripture questions: B.1, C.1, D.1 and E.2 on chapter pages 1, 1, 4 and 6 | 4 | All other questions/reflections, prayer, friend lists, financial disclosures and church commitments |

Lesson 13 deliberately uses selected printed questions instead of collecting full-section responses. Sections B–E mix Scripture questions with personal willingness, lifestyle, financial and future-service reflections. Its page explicitly describes a selected study, not a full chapter transcription or a completion rubric. The fourth question is only “Who has received gifts?” from 1 Peter 4:10; no stewardship or financial questionnaire is mounted. The original PDFs are preserved and remain available.

The catalogs `lesson-11-content.json`, `lesson-12-content.json` and `lesson-13-content.json` pin the approved chapter hashes, exact prompts, source sections and one-based PDF page anchors. The preexisting `lessons-nine-thirteen-content.json` is preserved as the historical source map, including its original mapped-not-implemented status; the new per-lesson catalogs and this document describe the subsequent implementation. No question is generated to satisfy a fixed twenty-answer contract.

Fields start disabled. Existing verified-account load, exact response identity validation, revision-bound save, logout/account/expiry cleanup, stale-request cancellation and separate device-note handling are required from the shared runtime. No legacy unowned notes are imported. Empty/partial answers remain possible; answering is not consent, membership, a staff grant, ministry contact authority, proof of watching or completion credit. Private cloud answers never feed People, communications or Giving.

## Remaining genuine course dependencies

Lessons 11–13 still say **Video coming soon**. No media URL, duration or trustworthy observer has been invented. Approved videos, media identities/revisions, rights and verified durations are still required. Existing multipart Lessons 6, 8 and 9 require the course owner's exact required-part/order/duration binding; Lesson 6's existing labels remain ambiguous. The already accepted 95% unique eligible-watch threshold remains unchanged. Worksheet saves cannot substitute for missing media or eligible viewing evidence.

The existing trusted completion scope is not extended by this increment. Before enabling completion, independently accepted provider observation, current learner/session/media binding, replay/seek/background semantics, least-privilege ingestion, revocation and an approved profile must be composed with durable answers. Browser playback callbacks and synthetic tests are not provider proof.

The content owner must still approve finite retention and permitted access for private answers and playback receipts, correction/deletion handling, and preservation or pseudonymization of immutable audit evidence. This increment neither implements a new retention policy nor expands collection to sensitive source exercises. Hosted Auth, account-isolation, recovery and release gates remain separate.

## Validation

`node --test tools/discipleship-progression/lessons-eleven-thirteen.test.mjs` verifies the approved PDF/mirror hashes, exact selected questions/section headings, disabled accessible fields, preserved account-scoped notes and SDK integrity, omitted sensitive prompts and missing-video/no-credit truth. Functional database/browser tests must exercise the final composed shared runtime/SQL in isolation. Static page checks alone do not establish functional or genuine-provider acceptance.
