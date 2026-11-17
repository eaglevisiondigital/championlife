# Issue159 Team/Travel recovery candidate

Status: **local backend candidate; UNINSTALLED; no release approval**. Base source is production `5ced10a0467199f8f0735884452c5bfd676af0e6`. This package does not change public pages, runtime JavaScript, the explicit public artifact manifest, deployment configuration, Giving, DreamTrack, Auth, attendee registration or production data. No account, grant, provider message or external resource is created.

## Source and dependency map

| Source | Recovered contract | Excluded dependencies |
|---|---|---|
| PR6 head `79404bb5648af269bbaea1604aed4891c507e2c3`, original `20261006200021_outreach_phase_b_team_travel.sql` | Individual approval lifecycle; canonical Person/Household review; official-travel readiness; separate Team/Travel capabilities; campaign-row serialization; total/passenger seat limits; driver review; immutable audit; scoped manifest and formula-safe CSV | Original public authenticated party intake, invented default age, service-role assignment system, lodging/rooms, broader campaign workflow/events, reminders and staff provisioning |
| PR35 head `76c328c507460406218f4aff279d3ce3467c9710` | Reference for the integrated Team/Travel workspace contract and separation of operational modules | Four broad uninstalled migrations, old staff shell, communications, prize/Event Day dependencies and unrelated source changes |
| Current production | Existing organizations, canonical People/Households, verified Auth helpers, current active/dated staff permissions, campaign assignments, immutable audit and CSV helper | No historical migration is rewritten or reapplied |
| Concurrent P0 `20261117182207_outreach_volunteer_applications_v1.sql` | Composite `(campaign_id,id)` application FK and immutable exact-answer intake; pending application remains distinct from Team decision | P1 never mutates P0 submitted answers, creates Auth/People/households, parses prospective passenger names into people, or infers verified identity from email |

PR149 Family Fun Day attendee/bicycle registration is excluded. No attendee registration settings or event times are seeded. No historical branch is merged.

The forward SQL is `supabase/release/outreach-team-travel-v1-forward-candidate.sql`, outside automatic migration replay. Installation requires the actual P0 application table and known current security-helper definitions. Missing dependencies, helper drift, partial Team schemas and repeat application fail before changing the candidate. Keep it uninstalled until an exact reviewed integration and hosted release are separately authorized.

## Implemented backend

Six RPC-only, RLS-enabled tables store event members, travel legs, vehicles, driver reviews, vehicle assignments and immutable history. Client table grants are revoked. No second Person/Household directory, public signup or role provisioning API is added.

`outreach_team_workspace(action,campaign,payload)` reuses the existing campaign identity. Team view/manage and Travel view/manage/export capabilities are checked against current verified active staff and the exact event assignment. The existing organization-wide `staff.manage` owner can review; no actual permission rows are seeded. Generic registration and Outreach authority alone grant no Team/Travel access. Private helpers are not browser callable. Post-lock authorization is rechecked before operational writes, including an observed blocked-request revocation test.

The explicit `enroll` adapter requires an active P0 application in the same event, a canonical Person in the same organization, current Person read/update permission and a recorded identity-review reason. It never guesses or creates a Person. Prospective companions remain immutable application text. Enrollment begins at `applied`; application receipt, individual approval, seat reservation, itinerary confirmation, check-in and attendance are independent states.

Official travel requires approval, separately reviewed availability and an explicitly reviewed age. Unknown age remains null. A minor additionally requires an explicit guardian-authority review, active canonical Household memberships and an approved adult guardian in the same vehicle/leg. Household labels alone do not establish legal authority. Source application cancellation/nonselection/waitlist and current Household revocation invalidate travel readiness; the original records/history remain available for review.

`driver_review` records a separate per-participant/per-vehicle qualification decision and reviewer. Applicant RV/big-rig experience never grants qualification. A reviewed adult is required for driver/co-driver seats. A qualified responsible driver is required before itinerary confirmation.

Every operational mutation locks the campaign row. A partial unique index permits one active seat per participant per travel leg. Assigned and confirmed seats both consume capacity. Total capacity includes the driver, reserves that seat before a driver is assigned, and counts a co-driver. Passenger capacity is a separate limit. Capacity changes require releasing occupants; vehicle changes invalidate prior qualification reviews. A return leg can use another vehicle.

Reassignment cancels the old record and inserts the replacement atomically; failure rolls back both operations. Cancellation and stale revisions preserve prior history. Dependent travel must be released before a guardian seat; confirmed passenger itineraries must be invalidated before removing their responsible driver. Changing leg details invalidates prior assignment confirmations. Unknown times remain null and unconfirmed. Current validity is projected separately from the historic assignment state.

Manifests require an explicit event/leg and may filter one vehicle. They expose names, vehicle, seat role and assignment/itinerary status; no email, application answers or prospective passenger text. CSV uses the existing formula-neutralization helper and audits export. Team viewers cannot see Travel review history without Travel view. The roster reports per-leg capacity and unassigned approved participants. The candidate has no print UI yet.

`outreach_team_own(campaign)` requires a current verified canonical portal link. It returns only that individual's serving status/history and appropriate assigned itinerary, with confirmed travel details withheld when current validity fails. It releases no manifest, other household members, application answers or internal review evidence. Current link revocation removes access. No public participant UI or new portal claiming flow is included.

## Validation

All fixtures are clearly synthetic local records. Native PostgreSQL clusters use private Unix sockets, accept no remote URL/password and are stopped/deleted automatically. Controlled tests do not establish real-account, browser, provider or hosted acceptance.

Commands from the repository root:

```sh
npm ci --ignore-scripts --offline --prefix tools/backend-tests
npm test --prefix tools/backend-tests
npm run test:team-travel:native --prefix tools/backend-tests
```

The ordinary suite uses an explicitly labeled structural P0 fixture for reproducibility on this isolated branch. To test the actual concurrent P0 migration, set `MINDEN_P0_MIGRATION` to its absolute path before the same commands. This was exercised against actual P0 SQL with SHA256 `caa05440f0f381dbcebeebecfb97ca45a940e835c47a16aef0f4714074fdc352` at the recorded checkpoint; a later P0 edit needs another exact-source run.

Focused checks cover migration guards, lifecycle and stale revisions, unknown age/availability, driver qualification, prospective-name preservation, guardian review/revocation, failed reassignment rollback, source cancellation, time/confirmation boundaries, portal ownership/revocation, event scoping, anonymous/unverified denial, raw table/private helper denial and immutable audit.

Native concurrency checks use independent sessions for eight workers contesting one final seat; reserving the driver seat before driver assignment; duplicate participant/leg allocation; simultaneous reassignment; and permission revocation while an RPC is observed waiting on the campaign lock.

The independent P0 review harness `outreach-volunteer-p0-revocation.mjs` requires the actual P0 migration. Three native sessions observe a settings request blocked on its row lock, revoke the synthetic owner's permission, then prove denial with no enabled/revision/audit change. The discovered post-lock recheck and exhausted-mail-attempt findings were reported to the P0 owner and corrected there. No P0 source file was edited in this worktree.

The complete existing regression suite plus9 recovery guards and60 lifecycle/security assertions pass in PGlite. Native actual-P0 integration passes60 lifecycle/security and10 independent-session race/revocation checks; the independent P0 review passes5 checks. The unchanged420-file public build passes. These results use the P0 bytes pinned above; later concurrent P0 changes require exact-source replay. Existing public/runtime bytes are preserved.

## Remaining acceptance and decisions

- No P1 staff or participant interface, print integration, hosted SQL, browser/account acceptance or release is complete. The existing P0 owner review remains separate and can launch independently under its own authority.
- Roddy, Kelsey and Danielle remain pending exact verified login emails, duties, event scopes, dates and explicit provisioning authority. No guessed account or broad grant is permitted.
- No departure/return/meeting times, lodging arrangements or additional status emails are invented. Lodging/communications remain outside this extraction.
- An authorized operator must verify each canonical Person, availability, age and any guardian authority before official travel. Do not treat explicit local synthetic reviews as operational verification.
- Before release, review the candidate independently, integrate into the approved staff/portal shell, complete genuine isolated acceptance with negative/revocation tests, verify current hosted helper/catalog parity, and obtain exact source/schema/access release approval. Do not install this file merely because local tests pass.

## Copy-and-paste continuation assignment

Recommended thinking level: HIGH.

Continue issue159 P1 from branch `codex/minden-team-travel-159-20261117` on production source5ced10a. Read AGENTS.md, continuity/security docs and this contract. Preserve the separately authorized P0 release and its exact current migration. Review the uninstalled Team/Travel candidate and actual P0 adapter; do not wholesale merge PR6/PR35 or activate PR149. Integrate a staff screen for explicit canonical identity/availability/age/guardian review, individual approval, separate driver qualification, per-leg vehicle assignment/reassignment/cancellation, current validity, secure CSV and print. Reuse the current auth/logout shell and deny/clear private data on revocation or late responses. Add appropriate verified own-portal presentation. Keep unknown times unconfirmed and prospective names unverified text. Do not grant named staff without exact verified accounts/duties and separate authority. Run complete regressions, actual-P0 native lifecycle/race/revocation checks and genuine isolated account/browser acceptance. No production SQL, deployment, messages, keys, paid resource or permission changes are authorized by this continuation prompt; obtain the relevant exact action authority before executing them.
