## 2026-10-29 — General prayer resource integration, LOCAL ONLY
Reconciled PR #54 with the accepted Resource Registrant and reader chain through 5c84a42. Reused the completed implementation; removed the duplicate draft general signup backend. Additive `/king-kind-signup.html` entry points to the accepted form; all 26 SDK pins and current Powered by Propel branding are preserved. General registrations remain separate from outreach decisions, membership, staff and financial authority. See docs/GENERAL-PRAYER-SIGNUP-LAUNCH-CHECKLIST.md for exact next gates. No hosted testing, migration, message, permission change, push or deployment authorized or performed. Original packages unchanged.

## 2026-10-28 — Final local privacy and dependency correction

Known local notes-isolation findings corrected: initially locked fields, verified owner/session checks, immediate UI invalidation and generation guards across account changes, expiry, tabs and history. Unowned legacy notes are never attributed. Browser storage is not encrypted and is not protected from device/profile administrators. No SQL/RLS or cloud data deletion. Exact Supabase 2.118.0 bytes and per-page SRI are enforced by builds/browser; actual provider Auth/Storage/recovery remains unverified. See docs/GENERAL-RESOURCE-FINAL-CORRECTIONS.md.

## 2026-10-28 — General-resource candidate security boundary

No anonymous resource writes; verified nonanonymous Auth UUID plus matching verified email required. RLS tables have no direct authenticated/anonymous grants, including operational staff. Fixed-search-path RPC, immutable actor-attributed audit and identity-row locking serialize retries. Reject caller-supplied campaign/actor fields and implicit/string consents. Optional prayer stays private and never flows to campaign staff or course reporting. No broad Storage policies or staff grants; private PDF checksum/licensing and 900-second signed URLs unchanged. Existing signed URLs can remain valid until expiry after revocation. Prepared containment preserves all rows/audits and restores only legacy eligibility. Local simulated Auth is not hosted proof; provider mailbox/redirect, private Storage and independently authorized acceptance remain gates.

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


## 2026-10-28 — General resource release correction candidate

General-resource correction: stale callback sessions cannot imply link verification; explicit SDK/callback failure and token matching gates precede success. Learner drafts cannot migrate between users; legacy unowned local records are quarantined intact. Auth/logout/expiry/Back transitions clear private UI and invalidate pending work. Saves require expected owner and retain RLS-owned UUID throughout. No cloud-answer deletion or RLS relaxation. Simulated provider tests do not establish genuine hosted token retirement or Storage access.


## 2026-10-28 — Local King Kind reader session correction

Separate successor to sealed 6d5730bf0034bbb138999ce8cab97ce150d525fe. Reader invalidates retained PDF/Blob/canvas/license state synchronously on Auth/storage/history/expiry changes; deferred authorization avoids SDK callback-lock deadlock. Generation-bound requests and detached rendering prevent stale completion from restoring prior-user content. Each personal-use download freshly checks identity and exact-object Storage eligibility. No design, SDK, PDF, SQL/RLS, general registration, lesson, recovery or Issue50/51 changes. Local regression and intercepted real-browser/real-renderer evidence are recorded privately; genuine-provider acceptance remains untested. See docs/KING-KIND-SESSION-CORRECTION.md. Stop at independent review; no hosted authorization, deployment or access grants.
