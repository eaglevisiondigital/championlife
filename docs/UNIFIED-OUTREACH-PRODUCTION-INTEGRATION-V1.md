# Unified Outreach Production Integration V1

## Purpose

Release Bessemer, Huntsville, partner-church follow-up, Team and Travel, registration/check-in, and future Outreach workflows inside the real Champion Life staff backoffice.

This package must not look or behave like the temporary acceptance harness. It must use the same premium shell, authentication, navigation, permissions, and design language as the Champion Life platform.

## Product Experience

### Top-Level Context

- Champion Life
- Outreach / SowGo

### Outreach Context

- Outreach Home
- Campaigns
- Decisions and Follow-Up
- Registration and Check-In
- Team and Travel
- Partner Churches
- Event Day
- Communications
- Outreach Giving
- Reports
- Settings

### Campaign Context

- Bessemer 2026
- Huntsville / City Hangout 2026
- future campaigns

## Release Scope

### Unified Shell

- one login
- signed-in user display
- Sign Out
- permission-aware navigation
- Champion Life / Outreach context switch
- campaign selector
- desktop, tablet, and mobile
- no legacy black People page
- no acceptance-harness banner or styling

### Bessemer

- canonical campaign bridge
- preserve all 48 existing source decision records
- preserve source timestamps, decisions, prayer requests, and contact values
- campaign dashboard
- decision totals
- follow-up status
- assigned worker
- shared ministry notes
- private pastoral notes
- discipleship connection
- Pastor Chris Bessemer-only profile after real email approval

### Huntsville

- campaign dashboard
- family preregistration
- household attendees
- waiver/media status
- check-in
- decisions and follow-up
- Team and Travel
- local partner-church assignment
- Huntsville-only pastor profiles after real email approval
- exact approved public header and routes preserved

### Central Leadership

- Dave: full Champion Life and Outreach
- Pastor Roddy: full Champion Life and Outreach
- Tania: full Champion Life and Outreach
- Kelsea: full Outreach

### Partner-Church Access

- explicit central assignment of decisions/households
- partner church cannot browse or claim unassigned records
- partner sees only its campaign and assigned records
- local worker assignment inside that church only
- immediate revocation in current session
- no cross-campaign or cross-church access
- no general Champion Life People access
- no finance unless separately granted

### Privacy

- minor contact through registering adult/guardian only
- private pastoral notes excluded from ordinary staff, exports, and general audit text
- immutable source decisions and waivers
- scoped CSV exports only
- export actions audited

## Source Work to Reconcile

- Outreach Campaign Core
- Team and Travel
- Native Registration and Check-In
- Giveaway/Prize Operations
- Event Day Command Center
- Host Intake and Pre-Event Automation
- Staff Workspace Consolidation
- Communications Core
- Partner Pastoral V1
- current production Huntsville and Bessemer hotfixes

Do not merge the old dependent PR chain wholesale. Extract accepted code and migrations onto one current-main branch in dependency order.

## Production Acceptance

### Historical Integrity

- Bessemer count remains 48 before and after release
- 14 salvation
- 9 rededication
- 7 learn more
- 18 prayer/ministry follow-up
- no source field rewritten
- Bessemer public page remains live

### Huntsville

- public decision page remains live
- family preregistration remains live
- Turnstile passes
- one legitimate household submission reaches staff view
- attendee totals reconcile
- check-in remains separate from registration
- waiver and media snapshots remain immutable

### Authorization

- central leader sees both campaigns
- Bessemer partner sees Bessemer only
- Huntsville partner sees Huntsville only
- partner A cannot query partner B UUID
- read-only user cannot write
- follow-up user cannot edit original decision
- private pastoral note remains restricted
- revocation works without logout

### User Experience

- desktop, tablet, and mobile
- no horizontal overflow
- clear empty states
- campaign and context switching
- correct back navigation
- current user and role display
- Sign Out
- no dead links
- no developer-looking screens

## Release Order

1. current-main integration branch
2. reconcile migrations and tests
3. isolated database migration replay
4. isolated hosted acceptance
5. Dave full-access browser acceptance
6. synthetic Bessemer-only and Huntsville-only acceptance
7. production checkpoint
8. forward migrations
9. deploy unified shell and modules
10. create leadership identities and grants
11. verify Bessemer 48
12. verify Huntsville submission/check-in
13. add real local partner users only after exact approval
14. post-release audit and cleanup

## Stop Conditions

- Bessemer count or source data changes
- Huntsville public registration breaks
- partner scope is broader than assigned campaign/records
- private pastoral notes leak
- minor direct-contact data appears
- staff cannot Sign Out
- legacy People page remains the staff home
- incorrect campaign or organization context
- migration does not match reviewed hash
- production data fixtures or synthetic grants remain
