# GIV-2B Reports, Statements and Leadership Finance

Build-only dependent package from accepted GIV-2A `3803faf6f97116445614ba693cb841f21a7af519`, branch `codex/giv-2b-reports-statements`. Acceptance/production migrations, real-account hosted validation, financial-policy approval, statement delivery and release are separate gates. GIV-2C (Form Builder) and GIV-3 (real checkout/provider activation) are not started. Preserve [future approved requirements](GIV-1-FUTURE-APPROVED-REQUIREMENTS.md).

## Reporting architecture and screens

One new authenticated invoker RPC, `giving_reports`, delegates to a fixed-search-path private guard above canonical GIV-1 ledger/routing/People/Households and accepted GIV-2A projections. No parallel donor identity or giving ledger is created. All raw helpers, views and new delivery-event rows deny browser and service-role access. The existing organization lock precedes current verified identity/capability checks.

Reports Center contains 24 working, permission-filtered report links. Leadership Finance retains the accepted Champion Life black/cream/gold shell and permanent Powered By Kingdom Propel attribution, with Today/Sunday/Month/YTD, recurring/pledge/outstanding/unreconciled cards, expandable fund totals, safe MID settlement summaries, comparisons and weekly/monthly/source/recurring charts. Aggregate-only data contain no donor names, household labels, payment profiles or credentials.

Eleven page entry points (ten required screens plus generic Report) share one controller/CSS: Pastor, Reports Home, Summary, Fund, Donor, Pledge, MID, Reconciliation, Statements, Statement Preview and generic Report. Catalog links carry current organization, period and filters; fixed-period dashboard cards override the period appropriately. Native fund expansion preserves direct-plus-child rollups without counting children again. Fund Detail includes frozen recorded merchant/gateway/MID totals and selected-fund trends. Charts use exact integer-based bar proportions, native tooltips and accessible data tables; no chart dependency or fabricated product data.

## Canonical periods and comparisons

- Today: organization civil midnight to next midnight, half-open.
- Past 24 Hours: elapsed rolling 24 hours.
- Week: accepted ISO Monday-to-Monday local reporting week.
- Month/Quarter: calendar-local boundaries.
- 6 Months: rolling six local calendar months to requested as-of time. This differs deliberately from the older calendar-half-year foundation key.
- YTD: local January 1 to as-of; prior-year YTD uses matching calendar elapsed range, not the full prior year.
- Annual: selected calendar year, including historical years.
- Custom: inclusive From/To local calendar dates, converted to an exclusive next-day end.

Historical date selection (`as_on`) is interpreted at **organization-local noon** by the server, including UTC+14, rather than assuming UTC noon belongs to the selected date. Absolute `as_of` remains supported for deterministic callers. Sunday/service periods use configured weekday and local boundary (accepted fixture Sunday 06:00); comparison navigation accepts any historical anchor date. Week/month/quarter/YTD comparisons expose current/prior/difference and exact numeric percentage; zero baselines return unavailable percentage. DST tests prove 23/25-hour civil days. Fiscal metadata is retained; no fiscal-policy change is introduced.

Weekly/monthly chart buckets fill missing intervals with actual zero matching ledger activity. Prior-year monthly data is displayed separately, preserving its real year labels. All report money is SQL numeric/integer serialized as decimal minor-unit strings. Browser arithmetic uses BigInt; approximate chart geometry never supplies displayed money. A table/tooltip supplies the exact value.

## Counting, refunds and corrections

Net Giving = original posted gross contributions − recorded refund ledger amounts + signed reversal/correction/reclassification entries. Gross, refunds, adjustments and net are explicit cards. Organization reclassification does not change its net total; wrong-amount correction changes it transparently. Gift/session counts use distinct canonical session IDs; manual gifts count individually. Financial legs/MIDs are grouped independently from donor sessions. Multi-line/MID gift values are summed once from ledger rows, never session intention or repeated leg principal.

Fund direct rows reconcile the selected net total. Parent rows roll up direct parent giving plus children; they are presentation aggregates, not additional ledger rows. Household reports/statements use **recorded household attribution**, retaining individual lineage, not surname/contact inference. Anonymous executive totals contain no hidden identity. Detailed finance users retain canonical internal donor authority. First Recorded Donors means first observed in available ledger history; it is explicitly not proven lifetime-first giving when historical imports are incomplete.

MID reports count each financial leg once for known fees/net proceeds, even when several designations or refund ledger entries refer to it. Unknown fees/net remain null. Fund-filtered views do not invent an allocated share of leg fees. Settlement summaries with missing net values remain unavailable rather than summing only the known part.

## Reports, filters and exports

Canonical reports cover fund/parent/fund detail, donor/household/first recorded donor, recurring and one-time, pledges, manual/online/payment, destination/gateway/MID, batch/settlement/reconciliation, refunds/failures, campaign/appeal/event/fundraiser and text-source foundation. No live GiveHub records are claimed without future canonical import. Text report remains an empty honest foundation until text-attributed ledger data exists; keyword attribution is not fabricated.

Shared filters cover period/custom dates, fund/parent, authorized donor/household, source/payment, merchant/gateway/MID, campaign/event and amount; compatible tables and charts use the same dataset. Commitment reports allow overlapping schedule date range/status/fund/donor/household. Batch reports allow date/type/status. Unsupported filter combinations fail rather than silently applying only to a chart. Refund/failure detail filters bind the underlying transaction, donor and fund lines. UI choices come from the current scoped server projection and hide unauthorized donor or merchant options.

CSV is generated only from a fresh authorized export projection. Major report exports preserve server-selected filters/range, include report/currency/timezone/half-open bounds and readable headers with explicit minor-unit units. User-controlled formula-leading cells are neutralized with the accepted CSV helper. No token/raw provider payload/credentials are included. Normal hosted downloaded-file verification remains an isolated acceptance gate; construction/content and server boundaries are build-tested.

Native Print / Save PDF and scoped print styles provide the requested document-editor-free foundation. Navigation/operators/forms are omitted; monetary tables/chart alternatives and generated statement content remain printable. This does not claim a separate PDF-generation service or a hosted PDF acceptance result.

## Permissions and prepared Pastor profile

| Capability | Required current explicit permissions |
|---|---|
| Executive dashboard / aggregate fund/source/comparisons | `finance.reports.read` |
| Donor/household/first donor/recurring/pledge/refund/failure detail or donor filters | reports read **and** `finance.gifts.read` (accepted detailed-finance equivalent) |
| Detailed destination/gateway/MID/batch/reconciliation report | reports read **and** new `finance.reports.merchant` |
| Statement choices/history/preview/generation/dry-run | `finance.statements.generate` |
| Detailed report CSV | relevant report access **and** `finance.export` |
| Selected summary CSV | reports read **and** new `finance.reports.export` |

Prepared Pastor/leadership profile: `finance.reports.read`, optionally `finance.reports.export`. It grants safe overview/fund/comparison/recurring-mix/source summaries and aggregate settlement/MID cards. No Manual Entry, Gift Adjustment, Refund, Merchant Configuration or Staff Administration. Detailed donor reports, detailed merchant report and Statements remain separately authorized. No real account or grant is created by this migration. Existing explicit finance keys are preserved; two narrow keys are additive.

Sensitive report reads, exports, statement preview/generation/regeneration and bulk dry-run are audited without raw data/payloads. Ordinary dashboard reads are not audited unnecessarily. Current-session polling/focus checks compare effective user/organization/permissions, discard stale responses, remove protected content on revocation and refresh navigation. Unchanged context refresh preserves pending reads; it does not cancel them. Anonymous/ordinary/cross-org/direct-ID/private-helper/export escalation tests fail closed.

## Statements and Communications boundary

The Statements screen offers Individual/Household, Tax Year/Custom Range, optional fund summary, preview before generation and immutable history/version links. Snapshots use posted tax-eligible canonical signed ledger contributions, retain donor/household identity, date/designation/amount/kind/total, organization identity, configured tax language and generation/version. Payment method details, MID routing internals and token data are omitted. A household snapshot retains each contributing individual. No approved mailing address currently exists in the finance identity projection; the statement says so rather than inferring private CRM data. Approved tax wording/address and legal financial treatment must be reviewed before real delivery.

`statement_preview` writes no financial snapshot. `statement_generate` uses a stable request key and organization lock: identical retry returns the same snapshot; intentional regeneration creates the next version and retains prior content. A unique identity/range/currency/version index plus immutable statement triggers protect history. Real eight-backend races prove one retry artifact and eight distinct regeneration versions.

Append-only `giving_statement_delivery_events` support Generated/Held/Queued/Delivered/Failed metadata with future Communications reference. This build writes only Generated then Held. Raw writes/updates and live queue/delivery actions are unavailable to application roles. Future Communications Core integration must recheck tenant/statement ownership, current initiating authority, canonical recipient, purpose consent/suppression and provider gates before queueing. A statement ID/reference is not delivery authority. No SMTP/Auth change or notification/outbox write occurs.

Annual bulk foundation is a guarded dry-run recipient count; no mass generation or sending job is activated. Real statement delivery, provider activation, form builder and production remain separate packages/gates.

## Build validation and review boundary

Focused database/security tests cover periods/DST/YTD/timezone, all catalog projections, exact canonical filters, refund/adjustment/session/fee counting, identity/version/permissions/revocation and no raw access. DOM tests cover every entry screen, labels/tables, period/deep links, role filtering, chart data alternatives, print/CSV construction, held previews and clearing. Full standard regression preserves GIV-1/GIV-2A, Staff Workspace, Communications, Outreach, Auth and site-build protection; Christmas tests remain separate standard checks. Native inherited Giving races plus statement retry/versioning are local synthetic only. Disconnected Chrome checks cover ten required screens at390/768/1440, keyboard, drawer and console. Private evidence is never in the public allowlist.

Migration `20261012025915_giving_reports_statements_giv_2b.sql` is **local-only, not applied hosted**. Stop at GIV-2B build review. Hosted acceptance, user visual approval, real CSV/print results and production release are not implied by a build PASS.
