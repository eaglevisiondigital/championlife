## 2026-11-03 — Scoped People task creation and uncertain-save handling

New task forms require fresh organization-wide people.read/followup.read/followup.manage and the existing verified session. Current person/org/route/generation plus shared auth-owner/client/client-auth bindings guard each asynchronous continuation. Observed binding replacement retires and clears only the captured editor; old forms and repeated submits cannot issue another insert. An uncertain submitted insert is never automatically replayed. Existing dated staff authority, RLS, finance restriction, composite person/org FK and column privileges remain unchanged. Native negative tests deny revoked/expired/future/scoped, other/unverified/anonymous actors and forged identity/status fields. Task history is append-only to authenticated callers, not claimed immutable against owner/service authority. See [evidence and limits](docs/PEOPLE-FOLLOWUP-CREATE-20261103.md).

## 2026-11-03 — App-triggered roster print reauthorization

A displayed preview no longer supplies continuing authority to print. Fresh context and a final existing backend `csv` export check gate each explicit print; observed denial clears protected roster content and stale account/campaign/navigation generations cannot publish or print late results. Exactly one existing export audit accompanies each successful preparation, not proof of physical printing. Browser/OS copies of previously disclosed data cannot be recalled. Unchanged native permission checks deny other campaigns/accounts, export-only revocation with view retained, expired and inactive assignments; failed export adds no successful audit. No child/waiver/registration/domain-event mutation occurs. See [evidence and limitations](docs/OUTREACH-PRINTABLE-ROSTER-20261103.md).

## Unified shell discovery correction — 2026-10-31

Process every discovery response independently: an explicit denial must immediately invalidate the workspace even if a concurrent discovery RPC remains pending. Late responses cannot reverse terminal invalidation. Canonical comparison treats organization, campaign, grant and department arrays as unordered sets; an actual change still retires access. No change to authoritative PostgreSQL authorization or session-retirement requirements. Synthetic browser proof is not provider-backed revocation evidence.

## 2026-10-31 — Unified shell authorization lifetime

Fresh remote user verification and existing server scope discovery precede module loading. Explicit denial, session identity change, logout and navigation retirement clear protected state and invalidate detached handlers; permission projections are refreshed on focus/visibility and every 20 seconds. Auth callbacks only invalidate synchronously, avoiding SDK lock reentry. Backend RLS/RPC checks remain authoritative; UI polling does not promise instantaneous remote revocation or cancellation of already submitted requests. No permission vocabulary, grant, SQL or private learner/King Kind policy changed. See [the complete contract and local/provider distinction](docs/UNIFIED-STAFF-SHELL.md).

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

## 2026-11-02 — People verification result publication

An asynchronous People boot must confirm its captured generation before publishing the verified user to module state. A retired account's delayed user/null result cannot overwrite the newer account or turn a permitted follow-up action into a false session expiry. Current-session checks, backend People/task permissions, task revision filters, denial clearing and logout remain authoritative and unchanged. The correction does not create campaign-assigned decision access; no decision mount may reuse event-registration permissions or broad organization People authority. Synthetic browser evidence and the exact source boundary are documented in [the focused contract](docs/OUTREACH-PEOPLE-IDENTITY-RACE-20261102.md).

## Event Day arrival triage — November 3, 2026

Source-only bounded arrival queues connect existing registration totals, household
review and authorized individual check-in/reversal. Existing campaign RPC/RLS,
waiver snapshots and audit are reused; no SQL/permission/export/contact change.
Private staged rows require fresh identity and registration.view; stale account,
campaign, history and revocation responses cannot restore the queue. Twenty
households per page and page-local filters are explicit. See
[scope and acceptance limits](docs/EVENT-DAY-ARRIVALS-20261103.md).
Local browser/DOM and reproducible-build evidence is recorded privately; native
PostgreSQL startup is blocked locally before assertions and remains a required
CI gate. This is not hosted acceptance or release approval.
