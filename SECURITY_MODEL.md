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
