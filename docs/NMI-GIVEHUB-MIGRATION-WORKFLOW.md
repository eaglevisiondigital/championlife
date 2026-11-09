# GiveHub migration and reconciliation — synthetic nonproduction workflow

An operator can now load the existing normalized GiveHub transition contract,
review donor/fund/receipt/statement mappings, reconcile recipient/fund/year/status
control totals, inspect exceptions and recurring next dates, and repeat staging
without duplicate gifts. This is an offline staging consumer, not a second ledger
or an import executor. GiveHub stays active. Nothing can post, charge, cancel,
refund, send a receipt, create a Person link or activate a schedule.

## Run

From this checkout:

```sh
node tools/nmi/givehub/cli.mjs demo /private/tmp/givehub-first-review
```

Open `report.html` in that private output directory. `report.json` contains the
review, `replay.json` proves zero new staged records on repetition, and
`synthetic-input.json` is the reproducible normalized fixture.

To load an edited **synthetic** bundle or replay its review:

```sh
node tools/nmi/givehub/cli.mjs synthetic /private/path/synthetic-input.json /private/tmp/givehub-second-review /private/path/report.json
```

The output directory must be new and outside the repository. Files are0600 and
directory0700. Reports contain no executable controls, external requests or scripts.
The demo uses only the two explicit fictional organization IDs in `fixture.mjs`.
The library requires an externally supplied current finance.read, finance.gifts.read AND
finance.reconciliation.read context for every recipient, including prior staged
records. This is NOT genuine hosted authorization or a public endpoint; a future
host must derive that context server-side. Do not infer authority from an export.

## Supported format and truthful limits

The supported input is **synthetic normalized JSON contract v1**, based on the
existing PR34 `docs/NMI-CUTOVER-GIVEHUB-CONTRACT.md`. Actual GiveHub CSV headers,
column semantics and supported vendor export behavior have NOT been supplied or
verified. This package does not claim to accept arbitrary raw GiveHub files.
A privately reviewed vendor-to-normalized mapping remains required before any real
data use. No names/emails/phone numbers are used to infer Person ownership.

Datasets: transactions, donors, funds, statements, recurring; nonsecret `boarding`
uses the unchanged four-MID readiness template. `control_totals` supplies independent
synthetic export-report groups (recipient/fund/year/currency/status, gift count,
gross, refunds and adjustments). Missing/disagreeing totals produce HOLD.
`adjustment_direction` explicitly distinguishes increase/decrease; no sign or
refund meaning is guessed from an ambiguous source amount. Correction rows carry
amount_minor="0" and the explicit correction_amount_minor_or_null; conflicting
principal and correction amounts are held. Dates require UTC with
explicit source timezone; year grouping uses that timezone. Money is integer minor
unit strings and BigInt arithmetic, never floating point. Unknown fee/net is not
zero; settlement remains unproven. Pending/failed/unknown rows never become gifts.

Same account+recipient+source transaction and same content deduplicate. Changed
content holds/excludes the identity; corrections require exact same-recipient,
account, donor, fund and currency original. Missing/ambiguous mappings, excess
negative corrections, invalid input, missing archives, statement discrepancies and
unverified recurring dates remain explicit. Replays revalidate current mappings and
scope; snapshot hashes are integrity checks, not evidence of identity or authority.
Donor links stay HELD. Statements retain original version/classification and never
resend. Recurring rows are inventory only, held in GiveHub; no vault data is used.

## Canonical integration established

`importProjection` maps an independently reviewed fictional Person/fund/batch to
EXISTING `giving_workspace('import', org, payload)` fields, including deterministic
request identity, original source account/transaction, timestamp and receipt.
It returns canPost=false and has no dispatcher. Native tests use the existing
PR73 hash-pinned canonical Giving SQL and disposable local PostgreSQL to prove
idempotency, concurrent uniqueness, immutable audit, recipient/Person/finance
isolation and tax/receipt preservation. No migrations or provider source change.
The historical private statement archive remains a separate preserved mapping;
imported donor history must not be exposed before actual identity verification.

A real dependency was confirmed: canonical `adjust` is reversal/replacement of an
existing unadjusted gift, not arbitrary delta history import. Refund requests need
an actual canonical payment leg; historical manual imports do not have one.
Historical refund/multiple-correction posting needs a separately reviewed canonical
import contract. The report reconciles those records but never mislabels them as
executable refunds or abuses adjustment to simulate refund history.

## PASS / HOLD and next evidence

Local PASS means the supplied synthetic staging/control/statement checks agree.
Release and execution remain HOLD even if all local checks pass. The existing
`prepareDisabledRoute` evaluates Main/Church, Youth, Outreach/Soul Fuel, Events
and Merch against four merchant slots with no receipt fabricated. All routes remain
disabled; actual merchant/settlement ownership, purpose, receipt entity and evidence
must agree. Soul Fuel belongs under independently verified SowGo legal recipient
and authorized SowGo settlement. Events versus merchandise tax treatment is not
inferred from a name.

Before a provider sandbox pilot: four actual private merchant evidence packages;
verified five-route purposes/funds/receipts/settlement; separately approved isolated
target and credential custody; real Auth/RLS/provider/UNKNOWN acceptance and explicit
owner pilot approval. Before real migration: authorized original exports and schema,
source control reports, stable IDs and privately verified fund/Person mappings,
original statements and refund/correction history, retention/finance review and
canonical target compatibility. Recurring requires source schedule/last/next-charge
inventory, vendor-to-vendor portability proof or approved re-enrollment, donor
consent and a separately approved schedule-by-schedule no-overlap transition.
No legacy cancellation, raw vault export or receipt sending is authorized here.

Current main is999f4a75eeb8e4a05580dc603dda39ba64eb0409. PR34 metadata head is
4e463f792bf9a2af03345e8854433e2d00863729 (its old body names an earlier checkpoint).
This candidate directly extends PR73 9fae30cc246de10768a78f5158a845ef101882b3 and
reuses its immutable NMI/ledger source pins. No wholesale draft-chain merge.
All existing public outputs, SQL, permissions, GiveHub links and provider guards
remain unchanged. RELEASE NO-GO.
