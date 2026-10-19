# NMI Giving sandbox execution follow-up — October 18 CDT / 19 UTC, 2026

Primary authority remains **Align Codex with Champion Life**. This is a bounded Giving follow-up to frozen draft PR #34 head `3a8317fb265c0cabb894133ac169100aaea83622`; no restart, merge or historical SQL rewrite. Production Git main is still `e3157f0afa3f563ab6560ca64c9049448f02c806`. Primary independently confirmed the live 25-row baseline; source attribution and all hashes are in `docs/NMI-CUTOVER-PRODUCTION-BASELINE.json`. No production inspection/write is claimed by this child.

All new private tables have RLS and no raw browser/service grants; one guarded service RPC owns execution. Anonymous capability hashes expire after 30 minutes, Turnstile and bounded fingerprint limits protect creation, and idempotency plus unresolved-leg/financial-action locks prevent duplicate handoff. No PAN/CVV-owned field, browser token persistence, raw response logging, live key or live host. Private results store whitelisted financial scalars only.

New-charge handoff rechecks original organization/fund/destination/gateway/processor route snapshot and frozen private merchant/MID/settlement proof fingerprint, current donor/household linkage and finance/approver permission. Unknown result, mismatched amount/currency/processor, missing/ambiguous query and stale lease never imply absence or permit blind retry. Original financial actions remain audited. Refund principal is reserved/append-only; void has zero captured gift. Subscription creation is not a donation.

New-charge shutdown and narrowly scoped lookup/refund/void/pause/cancel recovery are distinct. Provider subscriptions require separately verified pause/cancel; GiveHub fallback/public links remain intact. Dedicated acceptance source pin remains null/empty with every flag OFF; no target or credentials were configured. Primary-confirmed baseline evidence fixes offline staging only. Shared Platform Gate 0 and actual hosted/provider acceptance remain mandatory; old fingerprinted registry diagnostics are historical evidence, not a verdict on subsequent sibling repairs.

---

Historical frozen integration/earlier platform checkpoints follow; the execution follow-up above supersedes their held engineering status.

# NMI integration security review — 2026-10-18

All 449 protected production source files, including all 25 migrations, existing Edge functions, Supabase configuration, public registration/Auth/legal pages, GiveHub links and redirects, are checked against Git blob hashes at exact base `e3157f0`. No production access or remote configuration/migration was performed.

Extracted SQL retains RLS, revoked direct financial/private-table access, guarded private definers with empty search paths and invoker public wrappers. New bridge is private, not executable by anon/authenticated/service_role, and runs only on immutable NMI observation insertion through the existing service boundary. It verifies original organization/operation scope and calls Operations' service-only safe observation path. It does not store provider payloads, credentials or payment tokens; it does not post financial truth, approve adjustment or run payment retries. Local combined-schema tests prove unknown-result queue visibility, duplicate-charge denial, current-session permission revocation and zero ledger posting.

NMI entry/adapter/browser remain default-off sandbox-only with exact acceptance project and origin guards. Production and Huntsville component configurations fail closed. No PAN/CVV in app storage/database/logging is allowed; hosted-field behavior must still be proven with actual sandbox provider acceptance. No live credentials, real payment, donor communication or production release has occurred. No claim of hosted advisors or fresh provider/browser acceptance is made.

Provider sandbox verification, receipt delivery, authoritative settlement lookup and merchant routing are mandatory release blockers. Unknown results require authoritative original-account lookup; absence of a result never authorizes another sale. Preserve GiveHub primary and all legacy recurring until separately approved transition/reconciliation. See `docs/NMI-CUTOVER-HOSTED-ACCEPTANCE.md` for supervised evidence/cleanup and stop conditions.

---

# Huntsville candidate security boundaries

All new tables have RLS and no raw anon/authenticated privileges. Scoped RPCs check verified identity and active/dated campaign authority. Private helper execution is revoked; security-definer functions use empty search paths. Registration administration requires existing active organization staff plus explicit campaign-admin authority. No actual grants are created by migrations.

Only the public gateway holds service authority. Exact origin, Turnstile hostname/action, bounded payload and hashed-network rate checks remain unchanged from accepted source. Audit/signature/version/correction records remain immutable. Events are held, with no send worker. Public submissions cannot create canonical People or portal/staff authority. CSV is scoped and formula-neutralized.

See [exact object ACLs](docs/HUNTSVILLE-REQUIRED-OBJECTS.json) and [release gates](docs/HUNTSVILLE-MINIMAL-RELEASE.md). No production credential, service key, private audit evidence or actual customer record is stored in this candidate. Local fixture auth/Turnstile simulation is test-only and excluded from the site artifact; it is not hosted proof.

The additional isolated Huntsville acceptance project is `niyovbgoalulzkhbvebt`. Only it and the pre-existing acceptance project qualify for test-key mode, and only with explicit `acceptance` mode. Production and all unknown projects fail closed. New-project credentials must remain outside repository/public artifacts; only its public publishable key belongs in the branch-scoped browser configuration.

## Isolated email-link callback handling

The login uses the same `ChampionLifeAuth` client with `detectSessionInUrl: true`. It waits on that client's shared initialization promise instead of implementing token parsing, JWT validation or session storage independently. Only the supported direct `email`/`magiclink` token-hash flow and observed implicit session flow are accepted; ambiguous/malformed callbacks fail closed. Callback errors cannot silently authorize a redirect using an older session. Sensitive parameters are scrubbed with `history.replaceState` before successful navigation and on failure, while the strict existing destination sanitizer remains unchanged. Initialization and verification events cannot race into duplicate navigation.

Authentication does not grant organization or campaign authority. Existing downstream authorization, including revoked Huntsville staff denial and scoped export checks, remains unchanged. Tests use fictional credentials/local databases; a new human email-link retest is still required before declaring hosted link acceptance complete.
