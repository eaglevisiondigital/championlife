# Execution follow-up to frozen PR #34

Do not restart the accepted source inventory below. The new implementation is described in `NMI-CUTOVER-CHILD-HANDOFF.md`; exact files since `3a8317f` and since production are in `NMI-CUTOVER-CHANGED-FILES.json`. Two new forward execution migrations extend the ten frozen candidate migrations. `NMI-CUTOVER-ACCEPTANCE-MIGRATIONS.json` gives exact staged order/source and staged hashes for all 25 primary-confirmed baseline + 12 forward files. New runtime hosts are `nmi-giving.html` and `staff-nmi-execution.html`; functions are `nmi-giving` and `nmi-giving-webhook` with source-pinned default-off orchestration/Query helpers. Existing protected production runtime and GiveHub are unchanged.

Anonymous execution, authoritative sandbox ledger posting, active recurring/cancel/pause, Operations executor, held receipts, transaction/batch lookup and recovery are implemented/tested locally in this follow-up. Real provider acceptance, complete merchant facts, primary shared integration, legal sender/delivery and release approval remain gates. Older no-execution statements below describe the frozen foundation only. No hosted target or live payment was used. Exact GiveHub normalized requirements are in `NMI-CUTOVER-GIVEHUB-CONTRACT.md`; no export contents are assumed.

---

# NMI Friday integration inventory — 2026-10-18

First deliverable; repository inspection, not a release authorization. Base and branch: `e3157f0afa3f563ab6560ca64c9049448f02c806`, `codex/nmi-giving-friday-cutover`. Command documents copied exactly from PR #31 head `b1c1e281ff8f085b3b2a0083b004054da4adaac1`; Issue #32 requires a separate GO package. No old dependent branch is merged.

## 1. Accepted sources and dependency edges

| PR | exact head | original dependency |
|---|---|---|
| #16 | `2eada4821e7b45a5f8221112a0982c36c33e9551` | `bce1926c6c91cfe3125c49506faf88ccaabc32eb` |
| #17 | `3803faf6f97116445614ba693cb841f21a7af519` | `2eada4821e7b45a5f8221112a0982c36c33e9551` |
| #18 | `13aecea202dc0378f25c1c8df6650b22a0329923` | `3803faf6f97116445614ba693cb841f21a7af519` |
| #19 | `edf82fb34e8db448a0d6c6465a3799c75993d5a2` | `13aecea202dc0378f25c1c8df6650b22a0329923` |
| #20 | `1410ebc824cdf0b9721c95db0cb41229b74a0274` | `edf82fb34e8db448a0d6c6465a3799c75993d5a2` |
| #21 | `1ea6971c2a0273b1a15c132d7793b12c2822901e` | `1410ebc824cdf0b9721c95db0cb41229b74a0274` |
| #23 | `ba1424b2faf9282c6b3cf5c5132e968576e1a2e6` | `1410ebc824cdf0b9721c95db0cb41229b74a0274` |

All commits within each dependent diff, including final correction commits, are enumerated in `NMI-CUTOVER-SOURCE-COMMITS.json`; extracted head trees and blob hashes are in `NMI-CUTOVER-EXTRACTION.json`. GIV-3B and GIV-3D are siblings, both extracted after GIV-3A. PR #23 body mentions an older final head; the current head includes three later accepted fixes and is used here. No Authorize.Net PR #22 extraction/activation. Current-main People, Households, permission registry and Huntsville campaign identity satisfy shared SQL dependencies. Forms uses campaign FKs already on main. Exclude old Outreach Phase A–H migration chain, operational pages, Bessemer seed/imports, Communications sender and staff shell backend expansion.

## 2. Forward migration order

Retain every one of the 25 migration files present at the exact production commit. Replay those first in timestamp order. The historical baseline test keeps its original 22+2 exports for historical isolation proof; `productionOrder` adds the current decision migration. New versions were allocated by installed Supabase CLI; no production history is renumbered. SQL is extracted byte-identically under new, unapplied forward versions.

| order | candidate file | accepted source file |
|---|---|---|
| 1 | `20261019002847_nmi_friday_giving_core_giv_1.sql` | `20261010202812_giving_core_giv_1.sql` |
| 2 | `20261019002848_nmi_friday_giving_finance_management_giv_2a.sql` | `20261011112210_giving_finance_management_giv_2a.sql` |
| 3 | `20261019002849_nmi_friday_giving_reports_statements_giv_2b.sql` | `20261012025915_giving_reports_statements_giv_2b.sql` |
| 4 | `20261019002850_nmi_friday_platform_forms_giv_2c.sql` | `20261012201849_platform_forms_giv_2c.sql` |
| 5 | `20261019002851_nmi_friday_forms_conflict_http_409.sql` | `20261013193553_forms_conflict_http_409.sql` |
| 6 | `20261019002853_nmi_friday_giving_provider_foundation_giv_3a.sql` | `20261014171912_giving_provider_foundation_giv_3a.sql` |
| 7 | `20261019002854_nmi_friday_giving_nmi_sandbox_giv_3b.sql` | `20261014213506_giving_nmi_sandbox_giv_3b.sql` |
| 8 | `20261019002855_nmi_friday_giving_payment_operations_giv_3d.sql` | `20261015142024_giving_payment_operations_giv_3d.sql` |
| 9 | `20261019002856_nmi_friday_giving_payment_ops_amount_filters.sql` | `20261015203814_giving_payment_ops_amount_filters.sql` |

10. `20261019003215_nmi_friday_operations_bridge.sql`: new integration-only trigger forwards safe NMI sale/authorization/capture/transaction observations to the accepted Operations service. No ledger posting, retry or payment execution.

Hosted-history correction: repository source order remains unchanged, but offline packages stage the three reported applied version aliases from `NMI-CUTOVER-PRODUCTION-BASELINE.json`; primary live-ledger confirmation is pending. See `NMI-CUTOVER-CHILD-HANDOFF.md`. Never apply the original repository-named package as an exact live-ledger rehearsal.

Exact source commits/blob hashes: `NMI-CUTOVER-MIGRATIONS.json`. Never use these new versions on a project where the old Giving chain was already applied; use a clean isolated project matching this production baseline.

## 3. Edge and server functions

- `supabase/functions/_shared/giving/adapters.mjs`
- `supabase/functions/_shared/payments/nmi.mjs`
- `supabase/functions/_shared/payments/operations.mjs`
- `supabase/functions/_shared/payments/providers.mjs`
- `supabase/functions/_shared/payments/runtime.mjs`
- `supabase/functions/forms-file-access/gateway.mjs`
- `supabase/functions/forms-file-access/index.ts`
- `supabase/functions/forms-submit/gateway.mjs`
- `supabase/functions/forms-submit/index.ts`
- `supabase/functions/payments-nmi-webhook/gateway.mjs`
- `supabase/functions/payments-nmi-webhook/index.ts`
- `supabase/functions/payments-nmi/gateway.mjs`
- `supabase/functions/payments-nmi/index.ts`
- `supabase/functions/payments-webhook/index.ts`

Public SQL entry points (private helpers and object definitions remain exact in the migration manifest):

- `public.forms_gateway(p_action text,p_org uuid,p_slug text,p_payload jsonb,p_network text)`
- `public.forms_public(p_org uuid,p_slug text)`
- `public.forms_public_file(p_org uuid,p_slug text,p_file uuid)`
- `public.forms_workspace(p_action text,p_org uuid default null,p_payload jsonb default '{}')`
- `public.giving_donor_history(p_org uuid)`
- `public.giving_reports(p_action text,p_org uuid default null,p_payload jsonb default '{}')`
- `public.giving_service(p_action text,p_org uuid,p_payload jsonb default '{}')`
- `public.giving_workspace(p_action text,p_org uuid default null,p_payload jsonb default '{}')`
- `public.payment_operations(p_action text,p_org uuid default null,p_payload jsonb default '{}')`
- `public.payment_operations_donor(p_action text,p_org uuid,p_payload jsonb default '{}')`
- `public.payment_operations_service(p_action text,p_org uuid,p_payload jsonb default '{}')`
- `public.payments_donor(p_action text,p_org uuid,p_payload jsonb default '{}')`
- `public.payments_nmi_service(p_action text,p_org uuid,p_payload jsonb default '{}')`
- `public.payments_nmi_workspace(p_action text,p_org uuid,p_payload jsonb default '{}')`
- `public.payments_service(p_action text,p_org uuid,p_payload jsonb default '{}')`
- `public.payments_workspace(p_action text,p_org uuid default null,p_payload jsonb default '{}')`

Existing `outreach-partner-submit` and `outreach-registration-submit` remain byte-identical. Generic `payments-webhook` stays held; only `payments-nmi-webhook` verifies NMI events. No worker is silently added for receipts, statement delivery or payment-operation jobs.

## 4. Public and staff pages

Public component hosts are `checkout.html`, `form.html`, and verified-donor `payment-history.html`. They are acceptance foundations, not a public Giving cutover. Existing GiveHub pages, links, redirects and SowGo routes are untouched. Checkout currently requires verified financial/sandbox authority; anonymous end-to-end NMI giving is a remaining launch gap.

Staff pages extracted:

- `staff-form-builder.html`
- `staff-form-submissions.html`
- `staff-forms.html`
- `staff-giving-batch.html`
- `staff-giving-batches.html`
- `staff-giving-donor-report.html`
- `staff-giving-donor.html`
- `staff-giving-donors.html`
- `staff-giving-fund-report.html`
- `staff-giving-funds.html`
- `staff-giving-gift.html`
- `staff-giving-gifts.html`
- `staff-giving-manual.html`
- `staff-giving-merchants.html`
- `staff-giving-mid-report.html`
- `staff-giving-overview.html`
- `staff-giving-pastor.html`
- `staff-giving-pledge-report.html`
- `staff-giving-pledge.html`
- `staff-giving-pledges.html`
- `staff-giving-reconciliation-report.html`
- `staff-giving-recurring.html`
- `staff-giving-recurringdetail.html`
- `staff-giving-report.html`
- `staff-giving-reports.html`
- `staff-giving-statement.html`
- `staff-giving-statements.html`
- `staff-giving-summary.html`
- `staff-payment-issues.html`
- `staff-payment-method-management.html`
- `staff-payment-methods.html`
- `staff-payment-operations.html`
- `staff-payment-providers.html`
- `staff-payment-reconciliation.html`
- `staff-payment-recurring.html`
- `staff-payment-refund.html`
- `staff-payment-routing.html`
- `staff-payment-session.html`
- `staff-payment-transaction-detail.html`
- `staff-payment-transactions.html`
- `staff-payment-work.html`

Shared shell is restricted to installed Giving/Forms destinations, using production `staff-people.html` as return entry. No unrelated shell/backend chain is imported. Existing production staff UI is unchanged. All added HTML/assets enter the explicit public allowlist; docs, SQL, tests and manifests cannot enter dist.

## 5. Exact secrets and nonsecret configuration

Never record values here or paste secrets into Chat. No secret is read or configured by this assignment.

| name | custody / use |
|---|---|
| `SUPABASE_URL` | Edge project identity; NMI accepts only reviewed isolated project |
| `SUPABASE_ANON_KEY` | Edge Auth/RPC client; browser uses existing publishable configuration |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge-only; canonical service RPC, never build/browser |
| `PAYMENTS_<GATEWAY_UUID_WITHOUT_HYPHENS_UPPERCASE>_SANDBOX_V<version>` | sandbox REST key in Edge Secrets; exact gateway credential version |
| `PAYMENTS_<GATEWAY_UUID_WITHOUT_HYPHENS_UPPERCASE>_SANDBOX_WEBHOOK_V1` | sandbox webhook HMAC secret in Edge Secrets |
| `FORMS_TURNSTILE_SECRET` | Forms challenge secret; verify exact runtime name below |
| `FORMS_NETWORK_PEPPER` | Forms rate hashing secret; verify exact runtime name below |

Forms nonsecret controls are `FORMS_MODE`, `FORMS_ALLOWED_ORIGINS` and `FORMS_TURNSTILE_HOSTNAMES`. No live key is consumed by the candidate. Future live custody requires a separately reviewed adapter/environment implementation; never place live credentials in this sandbox adapter.

NMI runtime flags: `NMI_SANDBOX_EXECUTION_ENABLED`, `NMI_SANDBOX_ALLOWED_ORIGINS`, `NMI_SANDBOX_WEBHOOK_ENABLED`, `NMI_SANDBOX_ORGANIZATION_ID`, `NMI_SANDBOX_GATEWAY_ID`, `NMI_SANDBOX_MERCHANT_REFERENCE`. All execution flags default off. Branch build only: `CHAMPION_PREVIEW_SUPABASE_URL`, `CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY`, `FORMS_PUBLIC_SITE_KEY`, `NMI_SANDBOX_COMPONENT_ENABLED`, `NMI_SANDBOX_ORGANIZATION_ID`, `NMI_SANDBOX_GATEWAY_ID`, `NMI_SANDBOX_PUBLIC_TOKENIZATION_KEY`, `NMI_SANDBOX_MERCHANT_REFERENCE`. Public tokenization key is intentionally public, never the REST security key. Existing production origins/configuration are protected.

## 6. NMI route/MID worksheet

See `NMI-CUTOVER-ROUTES.csv`. Every row is unverified/disabled. Actual organization IDs, canonical fund codes, forms, gateway/account, processor ID, MID and settlement destination must be supplied privately and reviewed by finance. No inference from Main/Youth/Outreach labels is permitted. Separate organization merchant ownership and settlement are mandatory; no pooled Propel funds. The Events/Merch tax/purpose distinction must be explicit. Recurring outside a verified gateway-default route remains held because the accepted subscription API does not expose processor selection.

## 7. GiveHub donor/history/recurring inventory

See `NMI-CUTOVER-GIVEHUB-INVENTORY.csv` for the export field specification and reconciliation rules. No GiveHub account/export data is supplied or accessed, so donor totals, gifts, active schedules, next dates, fees, balance and portability are UNKNOWN. Do not treat absence of data as zero. Keep exports private. Legacy recurring gifts continue unchanged pending source-to-canonical mapping and provider-approved portability or explicit donor re-enrollment. Source-system/external-transaction uniqueness supports historical import; do not import as new money or issue duplicate receipts. Preserve legal recipient, tax classification, original receipt/statement and correction history.

## 8. Conflicts with current production main

- Old migration dates precede current production history and old prerequisites duplicate campaign objects: use nine extracted forward versions plus one integration bridge after all 25 current-main files. Do not copy the old migration-order file or old campaign chain.
- Both NMI and Operations change common provider assets/tests. Use NMI's latest checkout/payments assets and Operations' additive queue/UI/services. Combined lifecycle compatibility is tested on the integrated schema, never assumed from separate PR tests.
- Old branch build code omits the current Huntsville isolated project guard: merge NMI build additions into current main while retaining its allowlist. NMI execution still accepts only its explicit original acceptance project; do not reuse the Huntsville acceptance stack.
- Old staff shell discovers unpublished modules and links missing pages: restrict only the newly extracted shell to Giving/Forms and current production return entry.
- Current test bootstrap lacks synthetic Storage metadata required by Forms: extract the accepted local-only Storage fixture; no remote Storage change.
- Existing Huntsville/Auth/Bessemer files and production Edge functions cannot be replaced by older branch copies.
- Source build claims are held/sandbox foundations. Production posting, delivered receipts, anonymous public sale, recurring activation, job execution and settlement lookup completion are not proven launch capabilities. They remain blockers, not hidden activation switches.

## 9. Byte-identical preservation

`NMI-CUTOVER-PROTECTED-FILES.json` enumerates exact Git blob hashes for every protected production runtime/content/migration/function/config file (449 files). It includes all existing public pages/assets, GiveHub links, registration/legal/Auth files, redirects, Netlify configuration and 25 migrations. Only build tooling/allowlist, tests/CI and continuity documentation may change among baseline files. Automated guard checks every protected byte against the specified production commit. Other working copies and their modifications remain untouched.

## 10. Minimum safe Friday scope

GO requires all launch requirements in the command document: Champion Life + SowGo new public giving, one-time + recurring, verified organization/fund/MID routing, canonical ledger/donor linkage, usable finance/report/statement workflows, receipt delivery, adjustment/recovery, verified webhooks, transaction/settlement reconciliation, immediate disable and GiveHub rollback. Optional Events/Merch routes stay disabled unless configured and accepted; Main/Youth/Outreach may not silently inherit another MID. Existing GiveHub recurring can continue with a documented reconciliation/re-enrollment plan. If any mandatory gate fails, GiveHub remains primary on Friday. This candidate alone is NO-GO for public money.

## 11. Safe deferrals

Authorize.Net activation, Text-to-Give, broad Forms adoption, Kids Check-In, Serve Teams, Worship/CCLI, Global Propel migration, optional unconfigured Events/Merch routes, legacy recurring migration (while GiveHub continues and finance reconciles) may be deferred. Do not defer one-time/recurring acceptance, receipts, authoritative unknown-result lookup, route verification, reconciliation, audit, revocation or rollback.

## Configuration appendix

Verbatim environment references in extracted Edge entrypoints:

- `supabase/functions/forms-file-access/index.ts`: `FORMS_ALLOWED_ORIGINS`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`
- `supabase/functions/forms-submit/index.ts`: `FORMS_MODE`, `FORMS_NETWORK_PEPPER`, `FORMS_TURNSTILE_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`
- `supabase/functions/payments-nmi-webhook/index.ts`: `NMI_SANDBOX_GATEWAY_ID`, `NMI_SANDBOX_MERCHANT_REFERENCE`, `NMI_SANDBOX_ORGANIZATION_ID`, `NMI_SANDBOX_WEBHOOK_ENABLED`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`
- `supabase/functions/payments-nmi/index.ts`: `NMI_SANDBOX_ALLOWED_ORIGINS`, `NMI_SANDBOX_EXECUTION_ENABLED`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`
- `supabase/functions/payments-webhook/index.ts`: 

## Primary-thread coordination checkpoint

The current primary handoff is `NMI-CUTOVER-CHILD-HANDOFF.md`. Exact shared-path fingerprints, SQL permission incompatibilities and full changed-file list are in the associated JSON artifacts. The primary owns shared models, migration order and final shell integration. No combined release authority is delegated to this child.
