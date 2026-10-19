# Shared Platform Gate 0 — 2026-10-18

Bounded reconciliation from production `e3157f0afa3f563ab6560ca64c9049448f02c806`, frozen NMI PR #34 and Outreach PR #35. See [Gate 0 contract, evidence and adoption procedure](docs/SHARED-PLATFORM-GATE0.md) and [canonical scoped registry](config/platform/capabilities.json). This package adds one forward-only local migration, a shared context/navigation contract and upgrade/security/build regression tests. It does not merge the child business packages.

The historical 41-capability failure is reproduced and explained. The frozen Outreach candidate already uses additive lists; Gate 0 preserves and tests that correction in both orders with populated grants. No grant/template rows or existing authorization helpers are changed. Tests use local synthetic databases/browser transport; hosted acceptance and production release are not approved. Both frozen child versions of this document are preserved verbatim in `docs/gate0-source-continuity/`; the production history follows below.

No production change, GiveHub change, payment activation, hosted migration, real-user grant or deployment. Child adoption, later deltas, hosted/provider/operator acceptance and explicit release approval remain gates. Do not start unrelated platform modules.

---

# Huntsville candidate security boundaries

All new tables have RLS and no raw anon/authenticated privileges. Scoped RPCs check verified identity and active/dated campaign authority. Private helper execution is revoked; security-definer functions use empty search paths. Registration administration requires existing active organization staff plus explicit campaign-admin authority. No actual grants are created by migrations.

Only the public gateway holds service authority. Exact origin, Turnstile hostname/action, bounded payload and hashed-network rate checks remain unchanged from accepted source. Audit/signature/version/correction records remain immutable. Events are held, with no send worker. Public submissions cannot create canonical People or portal/staff authority. CSV is scoped and formula-neutralized.

See [exact object ACLs](docs/HUNTSVILLE-REQUIRED-OBJECTS.json) and [release gates](docs/HUNTSVILLE-MINIMAL-RELEASE.md). No production credential, service key, private audit evidence or actual customer record is stored in this candidate. Local fixture auth/Turnstile simulation is test-only and excluded from the site artifact; it is not hosted proof.

The additional isolated Huntsville acceptance project is `niyovbgoalulzkhbvebt`. Only it and the pre-existing acceptance project qualify for test-key mode, and only with explicit `acceptance` mode. Production and all unknown projects fail closed. New-project credentials must remain outside repository/public artifacts; only its public publishable key belongs in the branch-scoped browser configuration.

## Isolated email-link callback handling

The login uses the same `ChampionLifeAuth` client with `detectSessionInUrl: true`. It waits on that client's shared initialization promise instead of implementing token parsing, JWT validation or session storage independently. Only the supported direct `email`/`magiclink` token-hash flow and observed implicit session flow are accepted; ambiguous/malformed callbacks fail closed. Callback errors cannot silently authorize a redirect using an older session. Sensitive parameters are scrubbed with `history.replaceState` before successful navigation and on failure, while the strict existing destination sanitizer remains unchanged. Initialization and verification events cannot race into duplicate navigation.

Authentication does not grant organization or campaign authority. Existing downstream authorization, including revoked Huntsville staff denial and scoped export checks, remains unchanged. Tests use fictional credentials/local databases; a new human email-link retest is still required before declaring hosted link acceptance complete.
