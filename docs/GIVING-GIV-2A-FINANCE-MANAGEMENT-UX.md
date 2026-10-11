# GIV-2A Finance Dashboard and Core Management UX

## Build scope and state

The October 11, 2026 assignment authorizes a dependent build from accepted GIV-1 SHA `2eada4821e7b45a5f8221112a0982c36c33e9551`, on `codex/giv-2a-finance-management-ux`. Its draft PR targets `codex/giv-1-giving-core`. No prerequisite is merged. GIV-1 isolated hosted acceptance was accepted by Chat; that is distinct from release approval.

GIV-2A is implemented and tested locally. Migration `20261011112210_giving_finance_management_giv_2a.sql` is **local-only, unapplied to acceptance and production**. No processor, grant, hosted fixture or credential is activated. GiveHub remains live. Auth, SMTP, DNS and production configuration are unchanged. Stop at build review, then obtain a separate isolated hosted acceptance assignment.

This package replaces ten GIV-1 management surfaces and adds Donor, Pledge, Recurring and Batch detail pages. GIV-1's legacy Reports page/component remains unchanged and is excluded from the new navigation. Full reports, charts, statement polish, exports and executive-report polish are GIV-2B; the reusable form builder is GIV-2C. Neither is started.

## Shared workspace and navigation

Champion Life stays primary: accepted black sidebar, cream workspace, white cards, gold accents and unchanged approved Powered By Kingdom Propel asset. The Giving / Finance group has Overview, Gifts, Donors, Funds, Pledges, Recurring Giving, Batches & Reconciliation, and Merchant Configuration. An entry-only operator receives a Manual Entry destination instead of being granted Gifts read permission. Authorized readers/administrators use the Record received gift action. Navigation never grants server authority.

| Surface | Explicit read capability | Mutations require |
| --- | --- | --- |
| Overview | `finance.reports.read` | None |
| Gifts / Gift / Donors / Donor | `finance.gifts.read` | Manual entry: `finance.gifts.create` |
| Funds | `finance.read` | `finance.configure` |
| Pledges / Pledge | `finance.pledges.read` | `finance.pledges.manage` |
| Recurring / Recurring detail | `finance.recurring.read` | `finance.recurring.manage` (drafts only) |
| Batches / Batch | `finance.reconciliation.read` | `finance.reconciliation.manage` |
| Merchant Configuration | `finance.merchant.configure` | Same explicit configuration capability |

Refund, statements, export, merchant, gifts, pledges and reconciliation permissions remain distinct. Report-only leadership can see Overview without any posting, merchant or refund control. No real leadership account or role is provisioned.

## Overview and financial period contract

Default is Today. Quick buttons are 24 Hours, Today, Week, Month, Quarter, 6 Months, Year and Custom. The existing GIV-1 canonical boundaries apply: rolling 24 elapsed hours; organization-local Today; ISO calendar Week; calendar Month/Quarter/Semiannual/Annual. Custom From/To are inclusive local dates converted server-side to a half-open timestamp range. DST conversion remains canonical; Sunday/service comparisons use the configured weekday and local service boundary. Reporting policy and fiscal-period enhancements remain release/product gates rather than implicit changes.

The selected period supplies Total Giving, gift count, average, recurring, manual and online amounts plus the same fund projection. Total is net immutable ledger entries, including signed refunds/corrections at their recorded ledger dates. Count is distinct original gifts/sessions, so multi-fund sessions are not counted once per line; average is rounded net total divided by that original-gift count and is unavailable when no gifts exist. Manual includes staff/manual imports; online includes other canonical sources. Values arrive as exact decimal minor-unit strings and use BigInt presentation arithmetic.

Outstanding active/paused pledge balances and unreconciled Open/Ready/Difference batches are **current stock metrics**, labeled as such rather than falsely period-limited. Failure/route attention uses canonical states, not provider requests. Unknown deposits/payment descriptors are unavailable, never fake zeros. Month/service-period comparison snapshots reuse GIV-1 reports; they do not build a full reporting center.

### Today / period by Fund

Fund breakdown appears on Overview without navigating to Reports. Parent rows equal their direct ledger amount plus immediate child totals; expansion explains children without counting them twice. Standalone funds are independent rows. Archived funds remain in historical projections. Dashboard scopes one authorized organization and its configured currency, with no hidden category/source exclusions. The sum of top-level rows must exactly equal the net Giving total; a mismatch fails closed instead of displaying partial totals. View All Funds opens management. Current GIV-1 supports two levels; deeper nesting is not enabled.

## Gifts, manual entry and rapid counting

Gifts has a 100-row server page and total count. Filters cover local dates, donor name or exact canonical Person ID, general donor/household/reference search, fund/parent, source, payment method, recurring/one-time, frozen destination/gateway/MID, campaign/event, integer amount range and canonical transaction status. Invalid date/amount ranges are rejected. Detail separates contribution, safe payment descriptor/frozen route/reference and receipt/batch/reconciliation/adjustment/refund/audit history. It never displays PAN, CVV, bank accounts or vault tokens.

Manual Entry searches existing canonical People and supports anonymous contributions and reviewed active Household attribution. Cash, check, external ACH, external card/reference and other approved received payments create accounting records only. No processor is called. Fields include fund, open same-currency batch, org-local received date/time, event/service reference and staff note/reference; the staff actor is recorded server-side.

Rapid Sunday Entry provides add/remove keyboard-friendly rows, exact balance, review and confirmed Post Batch. A server-guarded action posts 1–100 rows in one transaction, requires one open same-currency batch, matching reviewed expected total and distinct stable row keys. All rows succeed together or none persist. One stable batch key and per-row keys make concurrent retries return the original result exactly once. Eight overlapping PostgreSQL callers prove exactly two ledger rows for the two-row race fixture, not sixteen rows.

## Donors and household lineage

Donor search projects canonical People names/contact, reviewed household labels, YTD ledger sum, last-gift timestamp and current pledge/recurring indicators. No donor database or private care/CRM projection is created. Detail contains finance-only giving, commitments, receipt/statement references, adjustments and refunds; individual contribution lineage is retained.

Household totals require the selected donor's current reviewed active membership and use recorded gift/pledge/recurring household attribution, never contact-name/email inference. Individual mode sums the selected donor's contributions. Money summaries remain in the configured currency; current recurring total excludes cancelled/completed and other-currency instructions and states that amounts are per occurrence, not annualized. Detailed pledge/recurring links require their independent permissions. Statement references do not authorize generation or delivery.

## Funds and independent routing

Native expandable hierarchy distinguishes parent/sub-fund relationships from merchant routing. Add Fund/Parent/Sub-Fund, Edit and Archive expose name, code, description, parent, public visibility, reporting/accounting categories, tax treatment, destination, dates, display order and status. Archive retains historical records.

Keyboard-friendly Move up/Move down swaps siblings with current revision checks; it normalizes tied old order positions and audits the change. No fund relationship or route is changed by reordering. Full drag/drop is deferred; the accessible fallback satisfies this package. Current destination → gateway → MID is shown separately. Posted gifts retain frozen routing snapshots.

## Pledges and recurring instructions

Pledge lists/detail include amount, received, remaining/overage, completion, frequency, dates, status, schedule, allocations, notes and history. Manage permits pause/cancel/close and revision-checked future expectation/note updates. Past expectations, posted gifts and allocations are not rewritten. Before/after metadata audit preserves the old future expectation.

Recurring lists/detail show one instruction with all fund lines, per-occurrence total, frequency, next org-local run, safe descriptor, independent gateway/MID routes, status, failure state, run history and audit. Draft creation supports multiple funds and converts next local date/time server-side. Provider update/activation controls remain disabled. Internal payment-profile IDs and provider schedule references are excluded from management JSON.

## Batches and merchants

Batches has Manual, Settlement and Reconciliation sections. Rows/detail show included canonical gifts, fund/method sums, expected ledger/deposit, actual recorded settlement/deposit, difference, reviewer, notes and history. Open → Ready freezes new entry; Ready may reopen, then guarded existing reconciliation produces Reconciled or Difference. Only reconciled batches may Close. Posted gifts are not edited to force balance; unknown actual deposits stay null.

Merchant Configuration has a simple gateway overview, assigned routes/funds, current routing matrix and an expandable advanced configuration area. It displays Authorize.Net single-merchant/many-funds, NMI multiple MID routes and multiple gateway accounts without conflating hierarchy with settlement. Setup creates disabled foundation records only. No secret field, gateway connection, bank change or provider activation is added.

## Server and browser protections

One public invoker RPC delegates old actions to accepted GIV-1 helpers and new actions to a fixed-search-path private guard. It verifies identity, current explicit organization capability after the existing organization lock, typed/bounded payloads, tenant bindings, current revisions and stable request keys. Private views/helpers deny direct browser access. No new client table grant or staff permission is introduced.

Browser session epochs discard stale async responses; denial/sign-out clears protected content and refreshes shared navigation. Focus and 20-second context polling recheck current authority. Navigation filtering complements server checks. Direct-ID, cross-org, ordinary/anonymous/report-only/entry-only/configuration boundaries remain enforced.

## Responsive and accessible presentation

At 390px the shared drawer is retained, summary cards stack, funds expand with native buttons, batch tabs stack and filters use a native disclosure. At 768px metrics use two columns and tables have isolated keyboard-focusable horizontal scrolling. At 1440px the persistent sidebar and four-column summaries use available workspace width. Tables never widen the document. Status uses text, all inputs have labels, column headings have scopes and financial confirmation dialogs initially focus Cancel and return focus. Date-only values preserve their calendar day; timestamps use the organization timezone.

## Build verification and next gate

Full standard platform regression passes, including accepted Staff Workspace/Communications/GIV-1 suites. Focused GIV-2A database/security and DOM checks, 94 Christmas checks, eight inherited financial races plus atomic rapid-batch replay, syntax/diff and a 447-file allowlist build pass. Forty-two disconnected Chrome screen/width combinations at 390/768/1440 have zero document overflow; desktop four-column and tablet two-column metrics are measured. Browser screenshots, synthetic instrumentation and runner logs remain in the private outer audit directory, excluded from public output.

Local SQL/DOM/browser checks do not certify hosted real-account behavior, applied migration state, real provider readiness or user visual approval. Chat build review is the next gate. Isolated hosted acceptance must verify the exact candidate with separately approved migration/temporary synthetic authority and cleanup; no real money, processor, message or production action is authorized here.
