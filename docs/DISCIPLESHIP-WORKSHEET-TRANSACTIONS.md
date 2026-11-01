# Durable worksheet transaction candidate — local only

This successor to PR76 `0f8028f4af949c8ee788b9db0c64761c3a6d1be5` prepares an actual database transaction over the existing `course_enrollments` and `lesson_answers`. It neither replaces the answer store nor changes the frozen King Kind registration migration. Nothing is installed or mounted in the public website.

## Exact boundary

The new forward migration `20261101165620_prepare_owned_worksheet_transactions.sql` adds private `(enrollment_id, lesson_number, revision)` metadata, a private server-owned sequence, six DML triggers plus an answer truncate trigger, a private transaction function and an authenticated invoker wrapper. Only `getting-a-grip-on-the-basics`, lessons1–4, questions1–20 are accepted by the RPC. These IDs are compared with the actual HTML manifests by the existing automated manifest test. All13 course pages remain unchanged; lessons5–13 notes are not cloud worksheets. Media/provider watch proof and lessons11–13 media remain separate gaps.

`owned_worksheet_transaction(p_lesson,p_expected_revision,p_answers)` derives the learner from `auth.uid()` and locks the current confirmed, nonanonymous, nondeleted, nonbanned Auth user and their claimed `auth.sessions` row. Missing, foreign, deleted or expired sessions fail closed. It then locks worksheet mutation ordering, the actual course/enrollment and private version. A read returns only counts and the revision string. A write requires that exact revision and a nonempty, unique question list; it updates only supplied owned answers. Omitted answers and all lesson progress are preserved. No caller user ID, enrollment creation, playback claim or completion mutation exists.

A new revision is allocated on every legacy answer insert/update/delete, including updates with forged `updated_at`. Enrollment insertion creates fresh metadata and deletion removes only metadata through its FK. Recreating an enrollment cannot reuse an old revision. Enrollment and answer identity columns become immutable; ordinary existing owner answer upserts and progress writes remain supported. Legacy owner writes without enrollment still have the original RLS behavior but produce no transaction receipt. Existing table RLS and grants are not expanded. Private revisions and their sequence cannot be read or changed by application roles.

## Ordering and limitations

The RPC obtains user/session share locks, then a transaction-scoped worksheet mutex, course/enrollment locks and a version row lock. BEFORE STATEMENT triggers acquire the same mutex for existing answer/enrollment DML before those writes lock rows. This avoids the direct-answer-write versus RPC CAS lock inversion. The conservative mutex serializes worksheet/enrollment writes across courses; it is held only for the database transaction, never a browser interaction. Lock waits fail after2seconds in the new functions. This imposes a contention limit; performance refinement requires separate review. A caller that holds an explicit long transaction can cause contention, not gain authority or partially commit rejected work.

PostgreSQL provides the transaction boundary: failed answer batches roll back answers and metadata together. Concurrent same-version saves have one winner. Session revocation and save serialize through shared locks; an already authorized transaction may commit before a competing session deletion completes. A completed deletion cannot be ignored. Expiration is checked again before mutation and before return. Repeatable-read stale session snapshots fail serialization rather than reauthorize.

The new RPC enforces current sessions. It does not retroactively change the existing public worksheets' direct-write authentication model; public activation and integration remain a future package. Database-superuser trigger disabling or private metadata changes are trusted administration, not a supported application path.

## Client integration

`createIsolatedWorksheetTransactions` uses the existing Supabase2.118.0 client only, pinned Auth/REST endpoints, and refuses production. Every request independently checks the current verified account. The PostgREST request explicitly fixes the captured bearer using the accepted SDK's `setHeader`, with `.retry(false)`. The SDK therefore cannot substitute a newly signed-in user's token for an older user's draft. Source input is copied before awaits. Auth, history and disposal events clear display state and abort requests; late responses are discarded.

A transport failure after submission is `uncertain`, never success. A CAS conflict is `conflict`; reload the current receipt and let the learner reconcile. Do not retry an uncertain save automatically. Server-side completion of an already submitted request is not disproved by client cancellation. No draft, answer, token or raw provider response is returned or persisted by this adapter. A fresh read is needed after account changes. `canCommit:false` and `canComplete:false` refer to progression: a saved worksheet is not watch/completion proof.

## Review and release gates

New tests use fictional claims and isolated native PostgreSQL, plus real Chrome/WebKit and the pinned SDK with all network traffic intercepted. They establish local transaction and browser behavior, not real Supabase Auth/provider acceptance. Native tests include existing RLS, private direct-call parity, CAS/concurrent/legacy writes, ABA, rollback, current-session changes, expiration and lock timeout. Browser tests cover mobile/desktop switching, logout, stale results, actual bearer headers and uncertain delivery.

Independent security review is required before source publication. Any installation needs separate reviewed schema approval, exact isolated backend pin, custody/recovery prerequisites and genuine session revocation acceptance. No production activation, new grants, hosted resources, communications or held King Kind migration is authorized. Watch evidence ingestion and authorized advancement remain separate and disabled.
