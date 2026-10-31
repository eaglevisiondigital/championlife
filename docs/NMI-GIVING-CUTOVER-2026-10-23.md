# NMI Giving Cutover Sprint

Target public cutover: Friday, 2026-10-23

## Scope Freeze

This sprint connects the already-built native Giving platform to NMI. It is not a redesign and not a restart.

### Required at Launch

- Champion Life public giving
- SowGo / Outreach public giving
- One-time gifts
- Recurring gifts
- Donor and household linkage
- Funds and designations
- Main, Youth, Outreach, Events, and Merch route readiness where configured
- NMI tokenized hosted payment entry
- Customer Vault
- Receipts
- Gift ledger
- Refund and void controls
- Reconciliation
- Payment issue and recovery queue
- Finance dashboard and reports
- Emergency payment shutdown
- GiveHub rollback

### Not Launch Blocking

- Authorize.Net activation
- Text-to-Give activation
- Kids Check-In
- Serve Teams
- Worship
- Global Propel migration
- broad Forms adoption outside launch Giving forms

## Consolidation Source Chain

Preserve and reconcile approved work from:

- GIV-1 Giving Core
- GIV-2A Finance Management
- GIV-2B Reports and Statements
- GIV-2C Forms and held checkout foundation
- GIV-3A Provider foundation
- GIV-3B NMI integration
- GIV-3D Payment operations and recovery

Do not merge the dependent chain one pull request at a time. Build one fresh candidate from current production main and extract the accepted migrations, functions, pages, permissions, tests, and documentation in dependency order.

## Route Matrix Required Before Live Activation

For each route record:

- Organization
- Public fund name
- Internal fund code
- Giving form
- NMI gateway/account
- Processor
- MID
- Settlement account
- Transaction type
- Recurring allowed
- Refund authority
- Receipt sender identity
- Finance visibility
- Emergency disable state

Minimum route review:

- Champion Life Main
- Champion Life Youth
- SowGo / Outreach
- Events
- Merch, if included at launch

## Credential and Capability Checklist

Keep all values private and server-side.

- NMI sandbox security key
- NMI live security key
- Gateway/account identifiers
- Customer Vault enabled
- Recurring/subscription capability enabled
- Webhook configuration access
- Transaction lookup access
- Settlement/batch lookup access
- Refund permission
- Void permission
- approved production domains/origins
- exact webhook signing/verification method

## Actual Provider Acceptance

Mocks are not sufficient for release.

### Sandbox

- Payment Component loads at 390, 768, and 1440 widths
- tokenization succeeds
- successful sale
- controlled decline
- duplicate-submit prevention
- timeout/unknown-outcome recovery
- Customer Vault creation
- recurring subscription creation
- recurring cancellation
- webhook success
- webhook duplicate
- refund
- authorization void
- transaction lookup
- settlement/batch lookup
- correct fund/MID route
- no PAN/CVV in application logs, browser storage, or database

### Controlled Live

- one approved small live gift per production route
- receipt received
- donor history updated
- gift ledger reconciles
- correct merchant descriptor
- correct settlement destination
- approved refund or void test where operationally permitted
- recurring schedule verified for at least one approved route

## GiveHub Transition

Do not disable or cancel legacy recurring gifts before the migration status is known.

Required inventory:

- donors
- historical gifts
- funds/designations
- active recurring gifts
- recurring amount and schedule
- next charge date
- payment method migration eligibility
- donor re-enrollment requirement
- statements and tax history

Friday cutover may route all new public giving to the native NMI platform while legacy GiveHub recurring gifts continue temporarily until migration or re-enrollment is complete.

## Release Gates

1. Exact current-main integration candidate
2. Migration replay on an isolated project matching production baseline
3. Full automated regression
4. Actual NMI sandbox acceptance
5. Finance/operator visual acceptance
6. Production schema installed with payments disabled
7. Production funds and routes verified
8. Controlled live route tests
9. Reconciliation pass
10. GiveHub rollback tested
11. Explicit owner GO for public cutover

## Stop Conditions

Stop and keep GiveHub primary if any of these occur:

- unknown NMI credential custody
- incorrect MID or settlement route
- raw card data exposure
- duplicate gift
- unrecoverable unknown transaction result
- webhook verification failure
- recurring creation/cancellation failure
- ledger mismatch
- receipt failure without controlled fallback
- inability to disable native checkout immediately
- unresolved impact to existing GiveHub recurring donors
