# Dream Track v1

Development/acceptance package, September 29, 2026. Starts at `1e9a4f610453336f24194f3758ea3b43aefb11b1` on `champion-sowgo-backend-v1`. Production release and hosted real-account acceptance are separate gates. PR #2 stays open, draft and unmerged.

## Existing content and layout

The seven original Dream Track HTML pages contained the following YouTube IDs. They are reused unchanged, with one new course metadata row per existing video; no media is uploaded or duplicated. Acceptance had no Dream Track course record before this package. Public YouTube metadata confirmed titles and durations. The old Lesson 6 page label “New Life” is corrected to the approved “Abundant Life,” retaining its video.

| Lesson | Title | Existing video | Duration (seconds) |
|---|---|---|---:|
| 1 | Dream Track Intro | https://www.youtube.com/watch?v=G2g3MhR7z2w | 1925 |
| 2 | God’s Dream | https://www.youtube.com/watch?v=rvY373QWI0w | 4350 |
| 3 | New Birth | https://www.youtube.com/watch?v=FQLZ4IU87_U | 3685 |
| 4 | Holy Spirit | https://www.youtube.com/watch?v=3a58NYEvaE4 | 5005 |
| 5 | Healing | https://www.youtube.com/watch?v=qc4-wikNlkM | 5580 |
| 6 | Abundant Life | https://www.youtube.com/watch?v=FzFSBOZUn5k | 5940 |
| 7 | Church Government | https://www.youtube.com/watch?v=jKlgOyyJXAQ | 3930 |

There is no eighth Vision video. Dream Track reuses the unmodified Grip stylesheet/workspace: sticky video on the left, questions, Scripture references and notes on the right. Tablet retains two columns; mobile stacks them and offers a minimized sticky player. Resizing does not rebuild fields or discard drafts. The existing screen-share/cast link and fullscreen controls are retained; external YouTube app playback cannot report watch credit to this page.

The approved structured question bank supplies exactly 20 active version-1 questions per lesson, 140 total. Prompts, canonical answers, explicit variants and review windows match the assignment. The supplied numbered order is preserved, including its overlapping/out-of-order review starts (for example Intro 9/10 and Abundant Life 5/6); no doctrine or approved wording is silently rewritten. No separate student guide was found; Scripture references already present in approved prompts are shown without adding outside teaching or long translation excerpts. Raw transcripts are not committed.

## Existing framework and progression

`courses`, `course_enrollments`, `lesson_progress`, `lesson_answers`, profiles and Supabase Auth identities are reused. Added lesson metadata, settings, attempts, completion and invitations are course-bound. There is no second learner identity or disconnected LMS.

Getting a Grip is unchanged. Its requested product rule remains **WATCH TO ADVANCE, ANSWER TO COMPLETE**; this audit found no actual watched-segment enforcement in its current frontend. This package does not retrofit or claim to have verified that Grip enforcement. Dream Track implements **WATCH + PASS TO ADVANCE**:

- At least **95% actual watched segments** AND **16/20 mastered answers** (80%) are required. Numeric range unions avoid duplicate/replayed segment credit. The comparison uses exact duration arithmetic, not a rounded display percentage.
- The next lesson unlocks only after both checks pass in PostgreSQL. Once passed, a lesson remains available. At 16, the remaining four answers may stay missed.
- The first submission and each subsequent missed-answer retry append immutable attempt rows with value, correctness, time, question version, mastery count and remediation interval. Mastered answers cannot be overwritten by a learner.
- Incorrect responses return the approved review window and a seek button, never the canonical key or accepted variants. Normalization ignores capitalization, whitespace and simple punctuation, then compares only canonical/explicit variants; no fuzzy/AI grading.
- Answers/notes autosave after a short debounce; Save now is available. Cloud state restores on reload/login. Progress, notes and attempts are account-scoped. Account changes clear the rendered data and player; old async responses cannot populate the new account.
- The embedded YouTube API records position every five seconds while playing. A server-issued per-lesson session, server elapsed time and bounded contiguous motion (up to 2x) reject simple seeks and stale sessions. Only actual interval unions count. The server stores resume position. Pause/rebuffer/seek can leave small uncredited intervals; learners may rewatch them. Client telemetry is bounded evidence, not DRM or proof of human attention. External casting apps are not synced; ordinary screen sharing is not blocked.
- Concurrent draft edits across devices are last-write-wins. One active telemetry session per account/lesson prevents parallel tabs multiplying credit. Offline browser drafts are not a new authoritative completion system; failed saves display an error and can be retried.

## Access and invitations

`course_settings` holds one current salted, 10,000-round SHA-256 access-code hash, never plaintext. Codes must be 12–128 characters. A manager can see presence/active state, rotate or deactivate. The initial seed has **no code and is inactive**; no secret is put in the repo or public artifact. Per-verified-account claims are bounded to ten per fifteen minutes, including failed guesses; oversized input is rejected. Rotation never revokes an existing enrollment. Operations require a verified, non-anonymous Auth account.

`courses.manage` is the existing canonical permission. Dream Track is an organization-wide course, so an active organization-wide grant is required; department-only grants do not confer course management. No staff grants are seeded. Optional Person selection additionally requires `people.read` in the picker; the backend validates the selected contact belongs to the same organization. Email does not merge contacts, create portal links or confer membership.

Invites store course/org binding, recipient, explicit optional Person selection, actor, expiry, status, accepted account/time, resend count and delivery state. The 64-hex-character token uses two cryptographically random UUIDs, is stored SHA-256 hashed, expires in seven days, and requires the same verified email. Acceptance is single-use and idempotent for the same account. Resending rotates the token, invalidates the old link, renews expiry and is rate-bounded. Cancel invalidates further acceptance. The raw link is returned once to the authorized inviter; later recovery requires resend. Query tokens are removed from visible history and retained only in tab session storage for login continuation.

The acceptance-only Supabase Edge Function `dream-track-invite` uses the existing Auth email/OTP service for both new and existing accounts. It validates the bearer against `/auth/v1/user`, then calls the guarded manager RPC to obtain the stored recipient and a delivery lease. Privileged service credentials stay in the Edge runtime and can only acknowledge delivery through a service-only receipt RPC. Browser clients cannot mark an email sent. Auth's successful HTTP response is **provider accepted**, not proof of inbox delivery; failure or unconfirmed receipt is reported honestly with Copy invite link fallback.

The email uses the existing exact acceptance callback `/discipleship-login.html`. After normal OTP/magic-link authentication, My Discipleship claims only active provider-accepted invitations for the verified recipient. The secure copied token is an alternate path for pending/failed mail. Existing accounts are reused; new recipients authenticate through the same Auth system. `safeNext` adds only the required Dream Track/staff paths; 6/8-digit OTP handling is unchanged. No SMTP/template/redirect configuration is modified.

The adapter accepts only the exact PR #2 preview origin. Gateway JWT verification is disabled only because explicit Auth-user validation plus the canonical guarded database permission check are implemented inside the handler; there is no anonymous send path. Production origin and activation require separate authorization. Tests mock email delivery; no invitation is sent to a real person in this package.

## Final meeting, badge and staff reports

Seven passed lessons set **ONLINE COURSEWORK COMPLETE – FINAL MEETING REQUIRED** on the course dashboard, My Discipleship and staff view. This does not award a badge. A course manager must explicitly record the final in-person meeting, with actor/time and optional private note. The enrollment row and optimistic completion revision serialize competing updates. Only then is one durable **Dream Track Completed** achievement recorded. Reversal clears current meeting completion, revokes the active badge and preserves the audit. Re-completion reactivates the same achievement without duplicate awards.

`staff-dream-track.html` extends the current staff architecture and is linked from People. It supports organization selection, search, completed-only filter, pagination, seven lesson statuses/watch/current/best scores/first submission/pass/activity, immutable attempt history, completion history, final-meeting mark/reverse, code management and invite send/resend/cancel. Contact association is explicit; an unlinked learner's badge stays attached to their account/enrollment. No generic People identity matching is introduced. Private meeting note/actor/Person metadata is absent from learner completion responses.

Person, portal account, enrollment, badge, staff assignment and permission grant remain distinct. The badge/enrollment/invitation grants **no membership, staff, department, finance, leadership or portal authority**.

## Security and data contract

Eight new public tables are RLS-enabled and RPC-only, with no browser table grants or policies. Three original self-write policy pairs additionally exclude Dream Track in both USING and WITH CHECK, blocking direct enrollment/progress/mastery forgery and moving a Grip row into Dream Track. Existing own-account read policies and Grip self-service behavior remain. Answer keys never enter public HTML/JS or learner RPC results.

`dream_track` and `dream_track_admin` invoker wrappers delegate to fixed-search-path private implementations. Verified identity, canonical permission and course/org selection are server-enforced. Helpers are owner-only; the delivery wrapper/private implementation are service-role-only. Attempts and audit reject UPDATE/DELETE. Input size/type, lesson sequence, token expiry, code bounds and optimistic revisions are checked in PostgreSQL. No permissive policies are added to silence RLS advisor notices.

The site build adds only explicit public UI assets/shells; migrations, bank fixtures, tests, docs, private evidence and Edge service code remain outside `dist/`. Public staff HTML is a shell, not authorization. Legacy Dream Track cookie/fallback-code handling is retired in development: the old auth function redirects to the account entry page and the edge shell handler passes through. A legacy cookie cannot grant backend enrollment.

## Validation and release gates

Local validation includes all 34 regression scripts, 67 focused Dream Track backend checks, 17 DOM/auth checks, mocked email-adapter security/delivery tests, and native PostgreSQL 17 independent-session final-meeting and invitation races. Rollback SQL has 16 assertions and creates only temporary synthetic identities/grants/configuration. Existing production and acceptance people remain untouched; intentional course/reference rows persist.

Actual local SQL-backed browser checks verified 14/20 to 16/20 missed-only retry, next-lesson unlock, 95% state, retained mastered fields, save/refresh, desktop sticky position, 820px tablet and 390px mobile without horizontal overflow, staff result/history, locked premature meeting and honest failed-email copy-link fallback. The in-app browser rendered **both unchanged Grip and Dream Track YouTube embeds black**, without console errors, so normal live playback/casting is **not browser-accepted** here. Watch segment rules and resume are automated-tested. Native browser/device playback, real Auth login/resume, email delivery and two-account hosted persistence remain the next acceptance assignment.

No real code is configured and no real staff is bootstrapped. Operational abuse/retention review and any production permission/code setup require separate authorization. No Forms, Communications Core, Giving expansion or Text-to-Give begins automatically.

## Acceptance application record

Migration `20260929221116_dream_track_v1.sql` applied only to `bkbmjisprwmkptywtmih`. Hosted/local MD5 is `124443fe7647a40ac739c4354a1e0574`; local SHA-256 is `5dde77e16b2eeae07081640ff920d8e440a6b644e593b3889543b65323d0050d`. All 20 earlier migration hashes remain unchanged. Acceptance now has 21 migrations, 57 public RLS tables, 60 policies and 73 public/private functions. The invitation adapter is ACTIVE version 1; its unauthenticated POST returned 401. Fixed function search paths/ACLs and zero anon/authenticated table grants were verified.

All 16 rollback assertions passed. Before/after: two existing Auth users, two Grip enrollments, 40 answers, zero contacts/staff grants. After rollback: zero Dream invitations, attempts, completion rows or claim counters. Only intentional course/settings/seven lesson/140 question reference rows remain; access code is unset/inactive. No real email was sent.

Security advisor reports 27 intentional [RLS-without-policy INFO notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), including eight new RPC-only tables, and the existing [leaked-password-protection WARN](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No new permissive policy or Auth configuration change was made.
