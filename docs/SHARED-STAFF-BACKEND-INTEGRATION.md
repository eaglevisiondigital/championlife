# Shared staff backend integration (source only)

One existing `ChampionLifeAuth` client and `StaffWorkspace` lifecycle serve Church, Outreach and Partner intake review. `tools/outreach/shared-staff-backend.mjs` actually calls the installed `staff_workspace_context`, `outreach_registration_workspace(campaigns)` and fixed `outreach_partner_workspace(list)` RPCs; it does not define a new identity/grant store or an invented RPC.

The source is excluded from the public allowlist. It requires an explicitly pinned nonproduction project, matching Auth/REST endpoints, verified current user/token before and after work, and current server scope. Do not replace the existing intercepted `client.rpc`: its revocation checks remain in force. Auth events synchronously retire the binding; no awaited Auth calls run inside the callback. Each failed parallel discovery clears the consumer immediately even if its sibling hangs. All errors close the binding; recovery requires creating a fresh binding under a newly authorized shell. Any RPC builder that supports abortSignal receives cancellation; an existing Promise wrapper is only logically invalidated and cannot be physically canceled.

## Exact capability separation

- Church choices require current organization-wide `people.read`.
- Outreach choices come from the existing server-filtered campaign-discovery action, never tags or People relationships.
- The existing Partner intake review requires BOTH organization-wide `outreach.view` and `finance.read`. Its read returns only intake ID, organization, canonical Person ID, status, source and submission time. Raw contacts, commitment amounts, notes and answers never leave this adapter.
- This is NOT the proposed assigned-only ministry Partner portal. The current schema has no installed authoritative campaign/intake association contract for that portal. `partnerAssignedPortal.available` is always false. It cannot use an event registration grant or a financial permission as a workaround.
- No new `people_workspace` endpoint, household lookup, worker assignment, export, permission mutation or financial operation is callable through this module. Existing People/Households remain their original system of record.

## Validation and release

Focused source tests use fictional sessions. Native PostgreSQL replays unchanged accepted migrations, then uses authenticated role and READ ONLY transactions for the actual RPCs. Synthetic fixture setup is separate from application execution. Tests cover foreign organizations, registration-only staff, unverified identity, permission expiration/revocation, sensitive-field projection, immutable record/audit preservation and fresh reauthorization. Chromium/WebKit existing mounted-shell tests remain applicable; Partner's separate composition exercises this binding in the same shell.

This is not hosted Auth, provider session retirement, independent recovery or live authorization proof. Public installation, preview configuration, genuine Auth/cleanup, deployment and real staff permissions remain separately approved gates. No migration is added or run on a hosted database.
