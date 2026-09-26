# Implemented architecture

Static HTML/CSS/JavaScript is served through GitHub/Netlify. netlify.toml publishes the repository root and configures existing Dream Track edge protection; existing Netlify helpers also support media. Browser clients use a publishable Supabase key and authenticated sessions. Never put privileged credentials in frontend code.

Supabase owns Auth, PostgreSQL application records, RLS and RPCs. The audited project has 32 public tables, 60 policies and 35 public/private functions; no Edge Functions or storage buckets were present in the onboarding audit. This is not a claim that all platform configuration is validated.

## Identity and courses

Passwordless email OTP powers discipleship login. Auth identity, learner profile and course enrollment/progress/answers are distinct. St. Lucia registration starts without an account; the public claim RPC delegates to a private implementation that checks verified non-anonymous email, protects existing ownership and serializes claims. Contact email alone is not authorization. Account-specific local drafts, blank-answer sync and cloud notes extend the existing course foundation.

## Organizations and relationships

Champion Life and SowGo are separate organizations. A person may have overlapping church, outreach, learner, donor, partner and volunteer relationships. Organization people/households/affiliations are not interchangeable with Auth accounts or global identity. Explicit organization staff grants govern operations. Reviewed portal account links plus configured tags grant participant content access, not staff or finance access. Household descriptions are not guardianship verification.

Staff workflows use RLS, composite organization foreign keys, database revisions and audit events. Tag workflow tasks exist; notification requests remain held/canceled, with no sender. Giving configuration is draft routing only, with separate church/SowGo merchant destinations. No new checkout engine exists.

## RPC pattern

Public application RPC wrappers are invokers. Privileged implementations and authorization helpers live in private with fixed search paths, explicit identity/permission checks and restricted EXECUTE grants. The platform rls_auto_enable helper is the public SECURITY DEFINER exception and is not executable by browser roles. Private must remain outside Data API exposed schemas; configuration verification is still open. Directory reads are scoped RPC-only.

## Reuse boundary

Broadly reusable church/ministry capabilities should be designed so Champion Life can consume Global Propel platform capabilities rather than permanently hardcoding Champion Life-specific logic when practical. This does not select a shared runtime or authorize migrating to the historical Global Propel .NET repository. Product data/IP, organization identity, merchant accounts and deployment boundaries remain separate until an explicit architecture decision defines integration contracts.

Historical migration recovery and the synthetic platform prerequisites are documented in docs/MIGRATION-BASELINE.md. Module documents remain the detailed source of implementation contracts.
