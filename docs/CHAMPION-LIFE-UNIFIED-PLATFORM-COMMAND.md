# Champion Life Unified Platform Command

Date: 2026-10-18

## Mission

Finish and release one unified operating platform for Champion Life Church, SowGo Outreach, ministry and financial partners, and future Global Propel tenants without restarting or discarding approved work.

Champion Life is tenant one. SowGo is the public-facing brand for Champion Life Outreach. Internally, SowGo is the Outreach module inside the same Champion Life backoffice, not a separate backend.

The platform uses one identity, one permission system, one People and Households foundation, one Events and Calendar engine, one Giving ledger, one Communications system, one Forms system, one audit model, and one staff shell.

## Permanent Architecture Rules

1. One login and one premium backoffice shell.
2. Champion Life and Outreach are contexts inside the same platform.
3. SowGo is the branded public side of Champion Life Outreach.
4. Bessemer, Huntsville, and future outreaches are campaign scopes, not separate applications.
5. Partner churches see only assigned campaigns and assigned people.
6. Each church or ministry owns its own merchant account, processor credentials, settlement account, data, and permissions. Propel never pools tenant funds.
7. NMI is the first production provider for the new Giving platform. Provider-neutral architecture remains required.
8. Champion Life, SowGo, Youth, Events, and Merch routes may use separate NMI gateways, MIDs, or settlement destinations.
9. GiveHub remains the rollback and legacy-recurring fallback until native NMI acceptance and reconciliation pass.
10. No raw card or CVV data enters the application database, logs, or browser code outside the approved hosted/tokenized NMI component.
11. All non-Lockliel platform areas use the approved Kingdom Propel attribution. Discipleship and shareable evangelism powered by Lockliel retain Powered by Lockliel attribution.
12. Champion Life branding remains original. Do not copy a competitor interface.
13. Global Propel owns reusable platform contracts. Champion Life consumes configured modules as tenant one.
14. Current Supabase and Netlify production continues until Global Propel has equivalent functionality and a separately accepted migration plan.
15. Kids Check-In, Serve Teams, and Worship with CCLI/SongSelect are the final major additions after Outreach, Giving, Partner, and core unification.

## Unified Product Map

### Champion Life Core

- Home and leadership dashboard
- People and Households
- Members, guests, affiliations, tags, and relationship history
- Staff, roles, departments, permissions, and audit
- Pastoral Care, prayer, cases, restricted notes, and follow-up
- Discipleship and Courses
- Groups and enrollment
- Events and Calendar
- Forms and registrations
- Giving and Finance
- Communications
- Family Hub
- Reports and Settings

### Discipleship and Courses

- Getting a Grip on the Basics
- Watch to advance, answer to complete
- Lesson progress, answers, notes, completion, and certificates where approved
- Next Steps and new-believer workflows
- Outreach decision to discipleship workflow
- Leader and teacher views
- Lockliel-powered discipleship and shareable evangelism where applicable
- Future reusable course builder and tenant course catalogs

### Outreach and SowGo

- Outreach dashboard
- Campaigns
- Bessemer 2026
- Huntsville / City Hangout 2026
- Future domestic and international outreaches
- Host church intake and onboarding
- Agreements, documents, training, readiness, and event packets
- Team signup, approvals, roles, travel, lodging, and logistics
- Family registration, waivers, attendees, and check-in
- Decisions, salvations, rededications, prayer, and follow-up
- Discipleship and local-church connection
- Partner churches and local pastor access
- Event Day Command Center
- Giveaways and prize operations
- Communications and follow-up sequences
- Outreach Giving and campaign funds
- Outreach Partners and commitments
- Reports, exports, audit, and campaign settings

### Partner Platform

- Partner Church profiles and campaign assignments
- Ministry Partner and Financial Partner CRM
- Individual, household, church, ministry, and business partner types
- Commitments, recurring gifts, one-time gifts, designations, and statements
- Assigned campaigns, resources, updates, communications, and tasks
- Partner portal and organization-scoped staff access
- Pastoral follow-up with private-note protections
- Campaign-level and organization-level reporting
- Immediate revocation and immutable audit

### Family Hub

- Household dashboard
- Family members, tags, groups, registrations, discipleship, and serving history
- One shared calendar with filters for My Family, Services, Kids, Youth, Women, Men, Outreach, Groups, Classes, Special Events, and later Serving Schedule
- Family-member-specific views
- Registration, RSVP, forms, waivers, payments, reminders, and directions
- Guardian and household privacy boundaries

## Current Production Reality

### Live

- Champion Life website and Supabase production
- SowGo website and permanent QR routers
- Bessemer public decision and follow-up page
- 48 real Bessemer decisions stored under `bessemer_al_2026`
- Huntsville public decision page
- Huntsville native family preregistration, waiver, attendee, and check-in foundation
- Huntsville registration gateway and production Turnstile
- `sowgo.org/go` routed to Huntsville decision and follow-up
- `sowgo.org/register` routed to Huntsville family preregistration
- Champion Life and SowGo organization records
- Dave's current Champion Life and SowGo Outreach permissions
- Public GiveHub giving fallback
- Public Outreach Partner intake

### Built and Accepted in Draft or Isolated Environments

- Unified permission-aware staff shell
- Champion Life and Outreach navigation
- Campaign switching
- Bessemer and Huntsville decision workspace
- Team and Travel
- Registration and Check-In staff workspace
- Partner church assignments and campaign isolation
- Shared follow-up and private pastoral notes
- Minor and guardian protections
- Event Day Command Center
- Giveaway and prize operations
- Host church intake and pre-event automation
- Communications Core and controlled SMTP foundation
- Native Giving Core
- Finance dashboards, reports, statements, and Forms foundation
- NMI hosted tokenization, vault, recurring, webhook, reconciliation, and recovery foundation
- Authorize.Net adapter foundation for later use

### Not Production-Ready Yet

- Unified Champion Life backoffice release
- Real Roddy, Tania, and Kelsea staff onboarding
- Real Pastor Chris Bessemer-only access
- Real Huntsville local-pastor access
- Production partner-church schema and grants
- Native NMI credentials and actual provider acceptance
- Native public Giving cutover
- Giving historical import and recurring migration plan
- Financial Partner portal
- Global Propel Church and Partner product hosts
- Kids Check-In
- Serve Teams / Dream Team scheduling
- Worship / CCLI / SongSelect

## Release Train

## Train 1: NMI Giving Cutover

Target: Friday, 2026-10-23

### Launch Scope

- Champion Life public checkout
- SowGo / Outreach public checkout
- One-time gifts
- Recurring gifts
- Champion Life and SowGo organization separation
- Required funds and designations
- Main, Youth, Outreach, Events, and Merch route readiness as applicable
- NMI tokenization and Customer Vault
- Receipts
- Donor and household linkage
- Gift ledger
- Refund and void controls
- Reconciliation and payment recovery
- Finance dashboard and reporting
- Emergency shutdown and GiveHub rollback

### Mandatory Gates

- Sandbox tokenization
- Successful sale
- Controlled decline
- Duplicate-submit protection
- Customer Vault creation
- Recurring creation and cancellation
- Webhook verification and deduplication
- Refund
- Void
- Settlement and reconciliation lookup
- Correct fund, MID, and settlement routing
- No raw card data in logs or database
- One controlled live transaction per production route
- Existing GiveHub recurring gifts inventoried and protected

## Train 2: Unified Outreach Operations

Target: immediate, parallel with Giving where workstreams do not conflict

### Release Scope

- Real unified Champion Life staff shell
- Champion Life / Outreach context switch
- Campaign selector
- Bessemer campaign bridge preserving all 48 source records
- Huntsville campaign operations
- Decisions and follow-up
- Registration and check-in
- Team and Travel
- Partner churches and local worker assignment
- Pastoral-note privacy
- Leadership reports
- Staff and campaign permissions
- Sign Out and session revocation

### Real Leadership Profiles

- Dave: full Champion Life and full Outreach
- Pastor Roddy: full Champion Life and full Outreach
- Tania: full Champion Life and full Outreach
- Kelsea: full Outreach
- Pastor Chris: Bessemer-only after email approval
- Huntsville pastors: Huntsville-only after email approval

## Train 3: Future Outreach Workflow

- Host church intake
- Outreach opportunity review and approval
- Agreement and document workflow
- Training and readiness
- Event Information Packet
- Event Day Command Center
- Giveaway operations
- Communications and reminders
- Post-event decisions, discipleship, and local-church handoff
- Reusable campaign templates

## Train 4: Partner Platform

- Canonical Partner CRM
- Partner commitments and Giving
- Partner statements
- Partner communications and resources
- Partner portal
- Church, ministry, business, household, and individual partner relationships
- Campaign assignment and reporting
- Global Propel tenant-partner foundation

## Train 5: Core Church Completion

- Events and Calendar production integration
- Family Hub and family-tag calendar filters
- Groups
- Forms
- Pastoral Care
- Communications
- Courses and discipleship integration
- Member and guest journeys

## Final Additions

1. Kids Check-In
2. Serve Teams / Dream Team scheduling
3. Worship with CCLI / SongSelect

These remain architecturally planned but do not interrupt the immediate Outreach, Giving, Partner, and platform-unification releases.

## Global Propel Direction

Global Propel remains the reusable multi-tenant product foundation.

Champion Life is tenant one, not a duplicated product. The current Champion Life Supabase system remains the operational production platform while Global Propel matures.

Stable contracts to preserve across both systems:

- Identity and Access
- Organization and Tenant
- Person and Household
- Relationships and Affiliations
- Programs, Enrollment, Membership, and Entitlements
- Events and Calendar
- Forms and Secure Documents
- Tasks, Workflow, and Automation
- Communications
- Campaign and Outreach
- Giving, Payments, Allocations, Recurring, Refunds, and Reconciliation
- Partner relationships and portals
- Audit and Activity

Do not rewrite urgent Champion Life production workflows inside Global Propel during the Friday Giving sprint or immediate Outreach release. Build adapters and migration plans only after the current production workflows are stable and accepted.

## Integration Rules

1. Start every integration branch from current production main.
2. Never merge old dependent PR chains wholesale.
3. Extract accepted modules with their tests, migrations, permissions, and documentation.
4. Preserve current Bessemer and Huntsville production behavior byte-for-byte unless the release explicitly changes it.
5. Use forward-only migrations.
6. Rehearse every migration in an isolated project matching the production migration baseline.
7. Require exact route, fund, MID, and settlement documentation for Giving.
8. Require current-session revocation tests for staff and partner access.
9. Keep acceptance fixtures and synthetic data out of production.
10. Keep the temporary acceptance harness separate from the real product UI.
11. No production release is implied by this command document. Every migration, merge, deployment, payment activation, or real access grant requires its own explicit release authorization.

## Immediate Execution Order

1. Freeze the NMI Friday scope and exact merchant/fund route matrix.
2. Create one current-main NMI consolidation candidate from the accepted Giving branches.
3. Prepare isolated NMI hosted acceptance with real sandbox credentials.
4. In parallel, create one current-main Unified Outreach candidate from the accepted Outreach modules.
5. Update continuity documentation to match current production migrations, routes, functions, and deployed pages.
6. Run isolated hosted acceptance for both candidates.
7. Present separate GO / NO-GO packages:
   - NMI Giving production cutover
   - Unified Outreach production release
8. Continue Partner Platform and Future Outreach workflow immediately after those controlled releases.

## Definition of Done

The platform is moving in the correct direction when:

- Staff sign in once and move between Champion Life and Outreach in one premium shell.
- Bessemer, Huntsville, and future campaigns use one campaign engine.
- Champion Life and SowGo Giving use the native NMI platform with correct tenant and MID routing.
- Partners have one relationship and portal model with scoped permissions.
- Courses, discipleship, people, households, events, communications, forms, giving, and outreach share canonical services.
- Global Propel can reuse the same contracts for additional tenants without copying Champion Life-specific data or branding.
