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

## 2026-11-01 — Assigned Partner metadata backend candidate

Local source only: explicit campaign/Partner/worker assignment, locked active Auth session and metadata-only read RPC. No issuer or automatic People identity claim; `personId` remains null pending independently reviewed linkage. Existing financial intake authority and website PR61 are separate. See [implementation boundary and release gates](docs/PARTNER-ASSIGNED-METADATA-20261101.md). No migration, staff grant, public runtime activation or hosted acceptance has occurred.

## 2026-11-01 — Partner current-base integration and private revocation

Exact reviewed Outreach ancestry is reconciled into the Partner draft without changing accepted runtime bytes. A separate private-only revocation primitive prepares locked authority, expected revision, idempotency and immutable audit rollback; no application role can execute it and no Partner issuer policy is inferred. People linking remains null/unverified pending complete unreleased Issue50 receipt/review provenance. See [scope and gates](docs/PARTNER-PRIVATE-REVOCATION-20261101.md). Local source only; no production migration, grant, website activation or public endpoint.


## 2026-11-01 — Private Partner issuance and provenance continuation

The new private Partner preparation function requires current Auth/session, independent staff.manage AND campaign-admin authority and exact verified preassigned workers. Only partner.view can be created; no contact, pastoral, finance, export or campaign rights. Creation cannot overwrite existing rows; reassignment requires exact former worker/revision and immutable audit. Canonical identity remains unverified without the complete trusted provider.
## 2026-11-01 — Partner authority serialization acceptance

New acceptance exercises the existing metadata RPC against actual synthetic SQL rows. Native tests require explicit lock-timeout and serialization errors for both revocation orderings and retained snapshots across Auth/session, campaign/Partner authority, assigned-worker and source-association rows. Sequential PGlite checks pass; new native Linux CI remains pending. Verified B/B1/B2 file hashes do not establish installed provenance: current baseline lacks their receipt/review tables, and source-map/account writer reconciliation is still required before canonical identity can be exposed. No authorization or schema changes. See [prerequisite contract](docs/PARTNER-CANONICAL-BINDING-PREREQUISITES-20261101.md).
