# Assigned decision campaign discovery and issuance boundary

Source-only successor to PR81 `4b6b37b031c42504c6a401a2c44700848e47afc9`, which is stacked on unchanged PR80 `5a675eff43a37f3fba2425b834b084b22bb1e281`. PR61 remains frozen. This package does not install source mappings, create assignments, mount public staff routes, or enable contacts, exports, communications or learner completion.

## Exact additive database API

CLI 2.81.3 generated `supabase/migrations/20261103114754_campaign_decision_directory.sql`. The one migration adds only `private.campaign_decision_directory()` and its `public.campaign_decision_directory()` invoker wrapper. It does not replace the foundation, add tables/columns, alter existing ACLs/RLS or expose raw decision tables.

The no-argument RPC returns:

```json
{"kind":"assigned-decision-campaign-directory","campaigns":[{"organization_id":"uuid","campaign_id":"uuid","campaign_name":"Approved name","scope":"assigned","capabilities":["decisions.read","followup.manage"]}]}
```

Only the authoritative `context` projection determines returned scope/capabilities. `followup.manage` is optional. The candidate scan uses the current server-verified actor and existing campaign assignment keys, in campaign UUID order. Each candidate is authorized by the unchanged PR80 function, which locks session/user, campaign, assignment and active source mapping. Names are read only after successful authorization. Every accepted context and the session are checked again after the final wait, so an earlier finite scope expiring during later lock acquisition rejects the result. An individual denied candidate is omitted; invalid/retired authentication denies the request. No client-supplied organization/campaign filter or authority claims are accepted.

A currently valid finite campaign decision assignment permits discovery of its campaign metadata even if no records are assigned. This deliberately preserves PR80 `context` semantics. The PR80 list/detail APIs still enforce record assignment and source matching: an empty record list is legitimate and is not proof of missing registrations. The directory contains no record count, source value, People information, contacts, event records or learner information. Registration-only, organization People, finance, Partner affiliation and historical campaign-admin authority do not substitute for a decision assignment.

The installer requires exact reviewed `pg_get_functiondef` hashes for all three existing foundation functions, their narrow effective execute privileges and protected raw-table ACL/RLS. Existing directory functions or drift cause a transaction failure, not replacement. Final ACL validation also rejects unknown custom roles inherited from default function privileges, rolling back both new functions. No Auth schema, default privileges or provider settings are modified. Function-definer authority remains internal; only authenticated callers can execute the public wrapper/internal directory, and the private session helper remains non-executable by them.

## Managed Auth and installation compatibility

The accepted 27-migration current-schema replay and exact PR80 migration are prerequisites. PR80 still requires the reviewed managed `auth.users` and `auth.sessions` column contract and trusted `auth.uid()`/`auth.jwt()`. This directory adds no managed Auth dependencies and reuses PR80 session validation. The disposable test bootstrap synthesizes those provider objects and runs as a local owner; it is **not** evidence that a real managed provider permits the installer role, internal definer reads or current ACLs.

Before any separately authorized hosted installation, review the target catalog, function hashes/owners/ACLs, current Auth read authority, table RLS, active source provenance and exact migration order. Fail if the managed provider's permissions do not support the reviewed design. Do not patch Auth ACLs, restore historical broad grants or use an unrelated privileged installer to make the test pass. Apply neither this migration nor PR80 merely because local replay passed.

Order: accepted current-schema baseline → unchanged PR80 foundation → this directory migration. PR81 contains no migration. Test-only default-privilege/bootstrap changes are never hosted installation instructions. Rollback for this additive directory consists of disabling its isolated consumer and, under separately reviewed migration authority, removing the two new functions; no history or registration data needs deletion. Do not drop the accepted foundation or its audit records.

## Issuance reconciliation: no executable grant path

The newest Issue58 assignment explicitly leaves the issuer, reviewer, attestation registry, source-mapping writer, issuance audit and maximum duration policy unapproved. Source inspection confirms these gaps:

| Existing source | What it establishes | Why it cannot issue this decision scope |
|---|---|---|
| `20261016201932_huntsville_registration_foundation.sql`: `outreach_campaign_admins`, `private.outreach_admin` | Organization-scoped historical event administration, alongside active staff assignment | Not an independently approved campaign-specific decision issuer/reviewer registry; historical role labels and organization scope are not new decision authority |
| Same migration: registration workspace `access` action | Updates only existing event-registration/check-in capability keys and preserves unrelated keys | Explicitly rejects decision/follow-up keys; cannot create decision mappings or record assignments |
| Same migration: `outreach_campaign_audit` | Immutable event/registration administrative journal | No reviewed canonical request-hash uniqueness, exact independent approval binding or decision-issuance procedure; its generic metadata is not approval authority |
| PR80: `outreach_decision_campaign_sources` | One-to-one campaign/source mapping with active flag | Empty by installation; no approved mapping writer/revision registry; a matching source string alone is not provenance |
| PR80: `outreach_decision_followup` | Assigned record with revision and status | Empty by installation; direct insertion is not an audited authorized issuance workflow |
| PR80: `outreach_decision_audit` | Atomic immutable `followup.updated` history | Constraint allows only workflow updates, not grant issuance or independent review |
| PR81: `prepareAssignmentReview` | Canonical exact-scope/evidence request hash | Remains `executable=false`, `authority=unverified`; no lookup or authority attestation |

The smallest next owner decision is approval of a **separate narrowly scoped issuance package**, specifying all of the following together:

1. The authoritative campaign-specific source for a current verified issuer and an independent reviewer, with no self-grant/review or role-name inference. Proposed privilege names `decision_assignment.issue` and `decision_assignment.review` are a design proposal only, not installed permissions. Choose the accountable policy owner and who may approve the registry; no real people are granted access by approving source development.
2. The maximum finite grant/review validity period and permitted renewal/revocation process. The existing contract only validates finite ordered dates; it does not invent an upper bound.
3. A trusted source-provenance owner and evidence rule for the exact campaign/source/decision-registration mapping, distinct from event attendance or name/email matching. A source-map change must invalidate earlier review; absent rows require serialized absence handling rather than blind upsert.
4. An immutable decision-issuance audit/review dependency with canonical request hash, verified issuer/reviewer, campaign/record/worker binding, before/after revisions, finite dates, independent approval expiry and private evidence references, plus approved access/retention custody. Minimize evidence content; never store contact, prayer, learner answers or source documents in GitHub.

After that decision, the narrow implementation would add only the approved registry/audit dependency and one transaction-bound review/issue/revoke path. It must lock authoritative issuer/reviewer/current-user and campaign/source/record/assignment dependencies in compatible order, revalidate after waits, preserve unrelated capabilities, reject changed approval hashes/revisions, prevent duplicate issue, and roll back mutation if audit fails. Existing registration administrator labels or service-role possession must never substitute. This sprint intentionally adds **no executable issuance code** and leaves the original contract byte-identical.

Contact remains unavailable even after a future record assignment: existing ministry consent authorizes only the accepted workflow-state mutation, not email/SMS consent, verified adult age, guardianship or permission to disclose phone/email. Canonical People links remain existing separately audited projections. A status named `completed` describes care workflow, never book reading or course completion.

## Local acceptance

`campaign-directory.native.mjs` replays the exact 27-file baseline, checks PR80 migration bytes, installs this additive migration, and tests provenance/ACL drift refusal, no overwrite, narrow metadata, event/People denial, zero-record campaign scope, inactive/revoked/expired authority, invalid sessions, revocation during a campaign-lock wait, and earlier authority expiring while a later campaign is blocked. Existing functions and ACLs are compared byte-for-byte. Fixture setup uses fictional users only; directory execution creates no records, assignments or audit events.

`createCampaignFoundationTestHost({directory:true})` is a fixed optional disposable fixture. It adds the exact hash-pinned directory SQL, `/directory` POST `{}`, and fictional registration-only/People-only/empty-worker identities. The default PR81 host behavior stays unchanged. No remote DB URL, installer injection, provider credentials, production fallback or arbitrary SQL endpoint is accepted. The loopback bridge is test-only and must not become a hosted service.

Run local native acceptance with existing pinned `tools/backend-tests` dependencies:

```sh
node tools/outreach/campaign-directory.native.mjs
node tools/outreach/campaign-foundation-adapter.native.mjs
```

Chromium/WebKit tests drive the isolated staff consumer through this exact SQL. Synthetic Auth and local database proof do not satisfy genuine Supabase authentication, managed-provider privileges, independent recovery/cleanup, staff issuance approval, or production release gates.
