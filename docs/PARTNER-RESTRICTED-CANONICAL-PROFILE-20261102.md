# Partner restricted canonical repository — unmounted source

Continuation from PR75 `c73488b985b45412c80d28373d2a0fa89d641de1`. This package connects the existing current-schema composition to the existing canonical identity repository without restoring historical application writer grants. It does not choose a deployment host, install a credential, expose a route, issue a grant or change any SQL.

## Exact contract

`createRestrictedCanonicalPartnerRoutineRepository` is an explicit source-selected factory. Its private verifier closure derives from the original `issue50-installed-provenance.json`, SHA256 `97dd8e074f8484e5e9770ccb2d1f517c78a36c749c499ef7a55f3e475da9ef07`. The only differences are required **absence** of authenticated EXECUTE on `private.city_decision_reconcile(uuid,jsonb)` and `private.city_care_workspace(uuid,text,jsonb)`. Restoring either grant denies the strict profile. All other function hashes/properties/privileges and complete relation pins are unchanged.

The historical verifier and both historical factories retain their original profile and behavior: historical broad fixture succeeds there, restricted composition fails there. The new factory rejects the historical broad fixture and accepts only the narrower reviewed profile. There is no fallback, environment selection, caller-supplied manifest, dynamic catalog blessing or profile parameter. The literal catalog query body is shared by an internal closure; existing diagnostic extraction remains byte-identical and its tests still pass.

The new factory always uses the existing mandatory NOLOGIN host envelope and exact fixed routine. It checks provenance and caller/host confinement before and after the locked read. Current account, source, receipt/review, Partner/campaign/record assignment and session checks remain authoritative. Callback/transaction failure discards the connection; canonical mapping stays null/unverified on denial. The existing adapter releases only verified Person ID, not contact details, notes, answers or financial data.

No historical manifest, source hash, SQL, RLS, capability, privilege, public file, SDK, production migration or deployment configuration changes. The test fixture's owner-issued fictional rows and SET ROLE do not constitute a usable server credential or genuine authentication.

## Validation and boundaries

- 66 new PGlite18/profile tests PASS: both cross-profile denials, all original function/relation pins, both omitted grants across PUBLIC/anon/authenticated/service_role, mandatory caller envelope, revocation/reassignment, provenance drift, post-read drift, private-content exclusion and rollback.
- Full affected Partner/shared-backend Node suite: **465 PASS**, zero failures, including unchanged catalog diagnostics and historical factory tests.
- Local native PostgreSQL17 checks verify historical-profile denial and incompatible-version denial. Positive/concurrency coverage is explicitly SKIPPED because the unchanged runtime relation pins require PostgreSQL18; no normalization or weakening is introduced.
- New native PostgreSQL18 CI suite requires 30 checks: exact current-schema canonical read, both withheld grants, lock-order outcomes, concurrent unrelated campaign writes, committed revocation, write-before-read timeout, cancellation/rollback and callback failure. Exact-head execution remains pending until independent review and draft publication. Existing native/browser suites remain in CI.

A native test's genuine separate database connections establish local serialization only. They do not establish real provider identity, a hosted service principal, session retirement or independently operable recovery.

## Remaining integration gates

An approved existing host must independently validate provider tokens and current sessions before supplying the repository's trusted principal. Restricted login-to-NOLOGIN custody/membership must be designed and reviewed; the current envelope deliberately rejects all membership and LOGIN properties. Actual Supabase Auth catalogs require exact reviewed provenance, not fictional fixture pins. Production composition/installation and capability vocabulary need their own reviewed forward plan. Those missing pieces remain blocked; this package neither restores broad grants nor assumes the public registration gateway's service authority. PR61, blocked PR57, real staff activation, giving, learner privacy and other systems remain separate.
