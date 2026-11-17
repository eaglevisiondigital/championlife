# Issue #159 disabled backend stage — November 17, 2026

Initial migration installed at provider version20261117190320 with intake disabled and zero applications. New Edge Function version1 is deployed and fails closed without its dedicated mail configuration/mode. Existing production function and RLS fingerprints, Auth/People/staff counts and140DreamTrack questions match preflight. SQL-connected independent UI validation found an owner-list alias error before public activation; a separate forward-only correction is tested locally, with original applied SQL bytes preserved.56native tests now include actual valid owner list and delivery authorization. P0public routes/CTAs remain unmerged pending correction, credential setup and genuine acceptance.

# Issue159 volunteer isolation

Verified current org-wide staff.manage gates interim volunteer review; no additional account grants. RPC-only tables, fixed empty search paths, strict server inputs, current permission recheck after locks, immutable snapshots and audit, HMAC network limits and Turnstile hostname/action. Sending-only domain-restricted credential stays server-side; durable lease+provider idempotency prevents unsafe retries. P1 canonical identity/age/guardian and seat reviews remain separate. Production installation/public activation are pending required evidence.

## 2026-11-17 — Fresh acceptance/security gates passed; target deleted

All140 hosted questions match the approved fixture. Eight new RPC-only tables have RLS and zero raw browser grants; concrete Data API probes return401/42501 and private/app_private profiles406/PGRST106. The invitation adapter validates its fixed origin, real Auth identity and current manager RPC; live anonymous/wrong-origin probes return401/403. Actual staff revocation denied the next request and cleared the report. Logout left zero sessions and zero active temporary grants. Meeting mark/reverse/re-mark maintained one completion record and three immutable audit events; no badge existed at online-only completion. Real invitation delivery and verified-email claim/reload maintained one enrollment and one acceptance audit. All fixtures and the temporary project were deleted after credential-free evidence export, before the owner's deadline.

The isolated CLI initially changed omitted TOTP/throttle defaults; they were restored before any account was created. Confirmation stayed enabled, eight-digit OTP and one-minute throttle were retained, and production Auth/SMTP stayed untouched. Prior independent regression/recovery/concurrency evidence remains pinned to unchanged runtime/SQL. Exact production preflight passed read-only. Existing unrelated advisor notices remain documented; no raw answer key or audit data enters the public artifact.

## 2026-11-17 — Diagnose playback without weakening browser protections

Two controlled comparisons associate the black player with the agent debugger attachment; native-only initialization and actual playback succeed for approved lessons 3–7. No extension, network protection, certificate or Auth setting was disabled. Browser policy denied extension-settings access; no alternate inspection route was used. Only allowlisted iframe URL/status/timing/referrer fields were retained from a sanitized HAR, then the transient HAR was deleted. Diagnostic events contain no account credentials or production connection. No runtime source changed. Local playback does not satisfy authenticated progress or meeting/badge release gates; production remains held until those checks pass.

## 2026-11-17 — Preserve the release gate at genuine playback failure

Real browser tests confirmed missed-only retries, no unlock at 94.9%/16 or 95%/15, exact 95%/16 unlock, expired staff denial/clearing and recipient-bound invitation rotation/idempotency. Actual playback intervals were captured before labeled isolated threshold fixtures; three lessons passed with 70 immutable attempts and zero badges. Lesson 4 has no watch token/credit, and later lessons were not forged open. Production's exact guarded preflight passed in a read-only rollback transaction; migration bytes matched acceptance. No production schema/grant/Auth/SMTP change. The unverified iframe experiment was removed. All acceptance accounts/grants/data disappeared with the authorized project deletion before the deadline. Required all-seven playback and final-meeting/badge browser gates remain unmet. See [evidence and blocker](docs/DREAM-TRACK-RECOVERY-2026-11-16.md).

## 2026-11-16 — Genuine sign-in and player compatibility check

Genuine delivered-email OTP sign-in reached the protected isolated DreamTrack dashboard. Incorrect/correct access code, direct lesson lock, authenticated autosave/reload, 15/20 first grade with mastered fields retained and five remediation windows, and disabled premature staff meeting were observed. The embedded player remained blank; the recovered lesson pages suppressed HTTP referrers. The seven lesson pages now use YouTube’s recommended strict-origin-when-cross-origin policy; invitation/access pages retain no-referrer. This sends only the site origin across sites, not paths or query tokens. Live player recheck and remaining course/invitation/staff gates are still pending; production unchanged.

## 2026-11-16 — Hosted DreamTrack security evidence; production still held

Before the course addition, fresh acceptance/production catalog fingerprints matched across all captured tables, columns, policies, functions/ACLs, triggers, constraints, indexes and schema grants. After addition, all existing definitions/ACLs remain unchanged except the six intentionally tightened course self-write policies. Eight new RPC-only tables have RLS and zero raw client grants; private schemas reject Data API profiles. Hosted rollback assertions, native independent-session badge/invitation races and live invitation origin/anonymous/invalid-token denials pass. Staff denial clears private content and links; failed saves retain drafts and late responses cannot restore departed-account data. Genuine Auth/video/stateful-browser acceptance remains pending. No production grant/Auth/schema change. See [current evidence](docs/DREAM-TRACK-RECOVERY-2026-11-16.md).

## 2026-11-16 — DreamTrack release HOLD

Local synthetic tests cover95% watch / 16-of-20 mastery enforcement, direct-write denial, account/org boundaries, immutable attempts, missed-only retries, invitation token/email/expiry/cancel/replay and final-meeting badge reversal. Current production Auth/client/login, operational boundaries and historical migrations are unchanged. No hosted DreamTrack or real-account evidence exists for this recovered candidate; origin/callback/current staff-session integration and independent security/recovery signoff remain pending. The failed empty recovery branch was deleted; no production write/grant/email or deployment. Do not weaken retired-installer guards or falsify migration history. See [exact blocker and gates](docs/DREAM-TRACK-RECOVERY-2026-11-16.md).

## 2026-10-23 — Staff logout boundary

The staff header calls the existing Supabase client's supported `auth.signOut({scope:'local'})`, then confirms the local session is absent before replacing navigation with the fixed staff login. It never clears all browser storage; SDK session cleanup and the application return hint are the only removals. A failed logout leaves protected content detached and displays a safe retry state, without claiming server retirement succeeded. Account changes and external sign-out clear the workspace. Pagehide clears protected snapshots; persisted pageshow reloads while hidden.

Local tests cover delayed responses, account switching, failed logout, stale initial callbacks, bfcache and storage isolation. They use fictional sessions, including the two owner-requested email labels. They do not establish actual inbox-to-browser login or hosted refresh-token retirement. Supabase-issued access JWTs may remain cryptographically valid until expiry; this UI change does not alter JWT lifetime, RLS, permission revocation or backend protections.

## 2026-10-22 — Safe Huntsville submission feedback

Frontend validation mirrors existing SQL constraints only. Huntsville errors never display arbitrary backend/network text. A 400 remains ambiguous between failed security verification and household validation; wording does not invent a specific rejection cause. Interrupted/5xx/malformed responses keep the frozen request identity and require an unchanged retry. Success additionally checks the reference and attendee count. No backend, RLS, ACL, challenge, rate-limit, waiver or marketing-consent policy changes.

## 2026-10-22 — Huntsville form validation alignment (local candidate)

The Huntsville UI mirrors existing server requirements: minors require Child/Dependent plus a guardian relationship; a signature covering a minor requires Parent/Legal guardian; Self covers one matching signer. No legal authority is selected or acknowledged automatically. Server validation, RLS, ACLs, immutable signatures, idempotency, Turnstile and rate limits remain authoritative and unchanged. Removing optional messaging controls explicitly submits `ministry_followup=false`, `communications=false`, `marketing=false`; the approved separate media release and initials remain explicit.

The single optional prize selector maps Bicycle to `prize_participation/bike_interest`, Tablet to `prize_participation/tablet_only`, and blank to all false. It does not create catalog choices, award eligibility, allocation, or check-in. Existing rows are not rewritten. This candidate changes no database, Edge Function, authentication, staff permission or deployment configuration.

## Release preparation and identity separation — 2026-10-22

Outreach-only operations remain financially excluded and cannot enumerate Church People/Households, grant permissions or alter another learner. Revoking Outreach authority preserves the independently owned personal learning records. No activation occurs without verified individual identity, canonical scope binding and independent permission administration. Current local tests and private migration-order evidence do not establish live Auth acceptance. See [release and rollback gates](docs/OPERATIONS-ADMIN-RELEASE.md).

# Huntsville candidate security boundaries

All new tables have RLS and no raw anon/authenticated privileges. Scoped RPCs check verified identity and active/dated campaign authority. Private helper execution is revoked; security-definer functions use empty search paths. Registration administration requires existing active organization staff plus explicit campaign-admin authority. No actual grants are created by migrations.

Only the public gateway holds service authority. Exact origin, Turnstile hostname/action, bounded payload and hashed-network rate checks remain unchanged from accepted source. Audit/signature/version/correction records remain immutable. Events are held, with no send worker. Public submissions cannot create canonical People or portal/staff authority. CSV is scoped and formula-neutralized.

See [exact object ACLs](docs/HUNTSVILLE-REQUIRED-OBJECTS.json) and [release gates](docs/HUNTSVILLE-MINIMAL-RELEASE.md). No production credential, service key, private audit evidence or actual customer record is stored in this candidate. Local fixture auth/Turnstile simulation is test-only and excluded from the site artifact; it is not hosted proof.

The additional isolated Huntsville acceptance project is `niyovbgoalulzkhbvebt`. Only it and the pre-existing acceptance project qualify for test-key mode, and only with explicit `acceptance` mode. Production and all unknown projects fail closed. New-project credentials must remain outside repository/public artifacts; only its public publishable key belongs in the branch-scoped browser configuration.

## Isolated email-link callback handling

The login uses the same `ChampionLifeAuth` client with `detectSessionInUrl: true`. It waits on that client's shared initialization promise instead of implementing token parsing, JWT validation or session storage independently. Only the supported direct `email`/`magiclink` token-hash flow and observed implicit session flow are accepted; ambiguous/malformed callbacks fail closed. Callback errors cannot silently authorize a redirect using an older session. Sensitive parameters are scrubbed with `history.replaceState` before successful navigation and on failure, while the strict existing destination sanitizer remains unchanged. Initialization and verification events cannot race into duplicate navigation.

Authentication does not grant organization or campaign authority. Existing downstream authorization, including revoked Huntsville staff denial and scoped export checks, remains unchanged. Tests use fictional credentials/local databases; a new human email-link retest is still required before declaring hosted link acceptance complete.

## Static theme-song boundary

The theme-song script performs no analytics/API/database requests, sets no cookies or storage, and tracks neither listening nor download/giving clicks. Sharing is user initiated. Counter backend/schema/configuration and runtime database dependencies are removed. No counter resources or secrets were installed. Original media, existing giving page, Supabase permissions and registration/payment integrations remain unchanged. Private audit and obsolete counter-preparation evidence stay outside the public build. See [release contract](docs/THEME-SONG.md).


## Operations Administrator candidate — local only, 2026-10-22

Donation-intake access requires outreach.view AND finance.read. Restrictive RLS protects linked follow-up tasks/events and financial partner relationship audit; People RPC projections and filters enforce the same boundary. Permission management requires independent staff.manage plus campaign admin; self-target changes are denied. Organization registration operations never confer admin/configuration or finance privileges. Household audit kinds extend the original check and retain actor/history. Existing registry, policies for other domains and function ACLs remain intact. Exact baseline guards reject incompatible child functions. See docs/OPERATIONS-ADMIN-SECURITY.md for release impact, withheld capabilities, account verification and revocation.
