# Lesson 5 workbook responses — source candidate only

The existing Lesson5 page now has a working private cloud worksheet for ten response groups: the nine numbered sections and the personal-application question in the already published chapter PDF. Each heading links to the original PDF page so learners can answer the section's full subquestions. This is not an invented twenty-question syllabus, grading engine or assertion that each subquestion is answered correctly. Exact heading/page mapping and original PDF SHA-256 live in `tools/discipleship-progression/lesson-five-content.json`. No PDF, video, title, media asset or license was changed.

The page uses the existing shared ChampionLifeAuth/Supabase2.118.0 client and `owned_worksheet_transaction` RPC. The narrow forward migration extends existing private version records and owner-only `lesson_answers` to lesson5, with ten valid question numbers. There is no second answer/enrollment store, new table, grant, RLS policy or progress mutation. Lessons1–4 retain their twenty-answer response contract. The existing private completion profile/observation/audit constraints still allow only1–4; lesson5 responses cannot become trusted completion through this change.

## Installation and reconciliation

This source migration is uninstalled. Apply only after its accepted antecedents: owned worksheet transactions, owned progression snapshot and trusted lesson completion. The migration checks exact accepted function-body SHA-256 values and the current version constraint before replacing functions. Any source/schema drift stops installation. It also refuses any existing lesson5 answers in this course because their question provenance is not established. Preserve such data and prepare independent mapping review; never delete it to force installation. No old migration or sealed evidence is rewritten.

The installation must use the supported transactional migration workflow in an explicitly reviewed environment. Target-managed Auth privileges, session semantics, current schema compatibility, custody/recovery and separate installation approval remain mandatory. Synthetic PostgreSQL Auth fixtures are not managed-provider acceptance. Prior lessons' public/client permissions are preserved, not presented as a new least-privilege host approval.

## Private learner experience

Learners explicitly load, edit and save their own responses. The server derives the actor from current Auth user/session and locks existing enrollment/version/answer state. A UUID compare-and-swap version prevents stale or concurrent overwrites. The current version is never supplied by a browser owner identity. Reads return raw answers only for the freshly authorized owner; existing direct answer RLS remains unchanged.

The browser pins the verified bearer token for each RPC, disables SDK retries, clears all fields/default values and invalidates pending results on identity/session/history/visibility changes. Callback cleanup is synchronous without an awaited Auth call, avoiding callback reentry deadlocks. Save responses are reauthorized before being displayed. An unknown outcome stops with an explicit reload/reconciliation path, never automatic resubmission. Load replaces unsaved edits, which is stated beside the form. No worksheet drafts are put in browser storage. Existing verified-owner device notes stay separate and untouched; no legacy or unowned notes are imported automatically. Cloud-saved answers are never deleted on sign-out.

Saving0,9or10 response groups does not grant watch credit, advancement or completion. The UI says this explicitly. Existing ungated navigation and legacy progress are not proof of95% viewing and remain separately unreleased work. Signed browser telemetry is not trustworthy playback evidence.

## What remains for the full course

Lessons6–13 still have private device notes and the original downloadable workbooks; their structured question mapping and cloud worksheets remain unfinished. Lesson5 is one complete, bounded learner save/load slice, not a claim that all thirteen worksheets now exist. Videos11–13 are still absent and clearly marked coming soon. Lessons6/8/9 have multiple video parts; their per-part policy must preserve at least95% unique eligible required viewing without substituting a total that hides a missing required part.

Before genuine progression acceptance, approve a provider/observer that can authenticate server-owned learner/session/media revision, unique eligible intervals, elapsed playback/seek semantics, replay identity, revocation and verifiable receipt/lookup. YouTube browser events and aggregate channel metrics do not satisfy that contract. Missing licensed video assets/configuration require the content owner. Required retention decisions cover durable answers, device notes, signed source evidence, derived receipts/audits, withdrawal/erasure, access and expiry; immutable audit retention must not become indefinite storage by accident. No provider, media purchase, retention schedule, live observer or credentials is selected here.

## Verification / rollback

Focused native PostgreSQL/PGlite tests exercise source/nonempty-data guards,0/9/10 groups, RLS, A/B, stale versions, invalid inputs, atomic failure, concurrency and session revocation. Actual Chromium/WebKit with fictional intercepted Auth/RPC cover mobile/desktop save/load, account changes, delayed responses, detached controls, conflict, unknown outcome, history, logout and deadlines. Existing worksheet/completion/privacy/dependency tests remain applicable. Test counts and screenshots are retained privately.

Rollback before release is withholding installation/publication. After a separately approved release, disable the new entry UI and stop new worksheet writes through the reviewed operational control; preserve all saved answers, versions and historical evidence. Do not drop data or restore a function that silently misinterprets lesson5 records. Any compatibility down-step requires its own reviewed forward correction. No deployment or hosted action is authorized by local PASS.
