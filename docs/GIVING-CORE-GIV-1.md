# GIV-1 Giving Core — build candidate

Dependent branch `codex/giv-1-giving-core` begins at accepted H1 `bce1926c6c91cfe3125c49506faf88ccaabc32eb`. The complete approved GIV-1 assignment controls this build. Preserve the byte-exact [future approved requirements](GIV-1-FUTURE-APPROVED-REQUIREMENTS.md); the later full assignment explicitly includes hierarchy, staff finance and reporting foundations in GIV-1. The full form editor, finished dashboard/statement UX and executive analytics remain later packages.

## State and deployment boundary

Implemented and tested locally; **not applied to acceptance or production**, not hosted-accepted or approved for release. Migration `20261010202812_giving_core_giv_1.sql` evolves the existing Giving Configuration migration, preserves prior permission keys and introduces no real grants. Apply only after separately authorized isolated acceptance and prerequisite migration verification; do not replay historical migrations into a populated project. No processor transport is installed. Gateway accounts cannot become enabled/verified in this migration; organization online giving, donor portal and text execution cannot become enabled. Recurring instructions are drafts, claims are held, receipts are held. GiveHub remains live and its pages/URLs are unchanged.

## Canonical boundaries

Organization → fund designation → merchant destination → gateway account → processor/MID route. Every concept has independent organization-scoped identity; many funds can use one MID, one gateway can have multiple MID routes, one organization can have multiple gateways, and one donor session can contain multiple transactions. See [routing](GIVING-MERCHANT-ROUTING.md), [ledger](GIVING-LEDGER.md), [pledges](GIVING-PLEDGES.md), [text foundation](GIVING-TEXT-TO-GIVE-ARCHITECTURE.md) and [adapters/gates](GIVING-PROVIDER-ADAPTERS.md).

Canonical `organization_people` and reviewed `households` are referenced, never copied into a new CRM. Giving creates no Person, portal ownership, household membership, staff account or permission. Anonymous public presentation is a separate flag from internal finance identity. A reviewed private donor-account link, not an email/portal match, controls the future donor read model. Only one reviewed Person binding per account/organization is admitted in this foundation; future family authority requires a separate approved contract.

## Guarded API

`giving_workspace(p_action,p_org,p_payload)` exposes current authenticated finance context, typed read projections, configuration and audited financial operations. `giving_service` is service-only, supports synthetic sandbox outcome normalization and held claims, and is **not an HTTP webhook endpoint or signature verifier**. A future verified adapter must authenticate vendor callbacks before invoking it. `giving_donor_history` permits only independently reviewed own-donor projections.

Every financial table has RLS and revoked direct browser/service table access. Security-definer helpers use an empty search path; only guarded entry functions are executable. Writes acquire one organization advisory transaction lock before checking current verified identity and active explicit permissions. This deliberately coarse GIV-1 ordering favors correctness; narrower locks require measured design and the same invariants. Unrelated organizations use separate locks. Tenant composite FKs and route binding prevent cross-organization attribution/settlement.

Finance capabilities are separate: `finance.read`, `finance.configure`, `finance.gifts.read/create/adjust`, `finance.pledges.read/manage`, `finance.recurring.read/manage`, `finance.reconciliation.read/manage`, `finance.reports.read`, `finance.statements.generate`, `finance.refunds.manage`, `finance.merchant.configure`, `finance.export`. Reporting does not confer posting, merchant settings, refunds, export or staff administration. No title, local pastor, campaign role or frontend origin grants finance access.

## Finance UI foundation

Eleven opt-in pages extend the accepted Staff Workspace: Overview, Gifts, Gift Detail, Manual Entry, Funds, Pledges, Recurring, Batches/Reconciliation, Reports, Merchant Configuration and Donors. The shared permission projection filters the expandable Giving group; Champion Life remains primary with the exact Kingdom Propel attribution. Real server reads supply all product values; synthetic fixtures are test-only and excluded from `dist`.

Manual creation has a narrow fund/open-batch choices projection that needs only gifts-create authority. Date/time is interpreted server-side in the configured organization timezone. Exact decimal input becomes integer minor units. Financial confirmations are native labeled dialogs, begin on Cancel and restore focus. Same-session denial/sign-out clears protected records; server checks remain authoritative. Tables have keyboard-focusable scroll containers, labels and textual status. The editor is intentionally a foundation: reviewed donor IDs and guarded RPC contracts are used; finished donor selection/statement UX belongs to GIV-2, hosted checkout/processor input to GIV-3/4.

## Reporting contract for build review

Only canonical ledger amounts are summed, never session intentions. Totals and comparison arithmetic return decimal strings, grouped by one currency. Per-entry values are bounded integer minor units. Read models support day/week/month/quarter/half-year/year, fund/parent/category, donor/household, source/method, campaign/event, merchant/gateway/MID, recurring/one-time, manual/online and entry kind. Supplements expose actual pledges/payments, refunds, failures, fees and reconciliation. Unknown provider fees stay null, with unreported-leg counts; rates and net proceeds are never invented.

Current reviewable defaults: Today is the organization’s local civil day; Past 24 Hours is rolling elapsed time; Past 7 Days is seven local days; Week is ISO Monday-to-Monday; Month/Quarter/Semiannual/Annual use calendar boundaries; YTD ends at the requested as-of time with prior-year comparable elapsed calendar range. Service/Sunday comparison uses configurable weekday and local boundary. Endpoints use half-open ranges and DST-aware conversion. Fiscal start month is retained metadata; fiscal-period UX is later work, not an implicit change to calendar filters. Chat approval of final financial reporting policy remains a release gate.

CSV export requires reports-read plus export, uses the server-scoped audited report and neutralizes formula-leading user cells. Charts consume grouped canonical rows; no chart-design package or nonfinancial dashboard is built. Future executive analytics must independently authorize finance reads, preserve currency/tenant scope and join other ministry projections without broad finance permissions.

## Future form boundary

Published form versions bind organization, permitted designation IDs and server-resolved merchant routes. Client amounts, fund IDs and conditions remain untrusted. Provider-hosted/tokenized input crosses only the separately gated adapter, never a raw card/bank field in the form server. Draft/publish/version, reusable fields, sections, requiredness, conditional rules, desktop/mobile editor and drag/reorder belong to a separately approved reusable builder; event registration reuses that schema boundary, not Giving ledger ownership.

## Local build verification

174 database/security checks, 48 disabled adapter/exact-money/CSV checks and 184 finance DOM checks; full existing backend regression; fresh migration replay and eight native PostgreSQL races. Each race has eight independent backends, separate coordinator, committed server barrier, simultaneous active lock waits and overlapping server timestamps. A macOS shared-memory limit blocked a new cluster; the local fallback created/dropped only a disposable database on the existing local PostgreSQL 17 server, reused existing test roles unchanged and substituted its verified local superuser only in the isolated test bootstrap. CI uses a fresh cluster, not that fallback.

All ten required pages were rendered at 390/768/1440px against disconnected synthetic projections; labeled forms, scrollable tables, drawer/keyboard and confirmation behavior checked. Private screenshots/logs remain outside the application repository. CSV scope, exact content and attached download construction pass automated tests; the in-app browser did not expose a completed download event, so normal-browser downloaded-file verification remains a hosted acceptance gate. Hosted real-account/database acceptance, visual approval, migrations, live processor boarding, financial policy and release are separate gates. GIV-2 is not started.
