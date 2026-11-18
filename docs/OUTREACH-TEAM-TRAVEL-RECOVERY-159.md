# Issue159 Team/Travel recovery candidate

Status: **backend, staff and read-only participant UI review candidate; UNINSTALLED and unpublished; no P1 release approval**. Draft PR162 is reconciled onto released P0 source `90657158d2c0d115d98b17c7be664f455b4b2cd0`; the original extraction began at `5ced10a0467199f8f0735884452c5bfd676af0e6`. P0 is already live and remains separate. This P1 package does not change the released public pages/runtime, public artifact manifest, deployment configuration, Giving, DreamTrack, Auth, attendee registration or production data. No account, grant, provider message or external resource is created by P1.

The current local correction adds the reviewed capability-constraint drift guard and narrow guardian/current-clock safeguards, including scoped review dependencies. Current candidate SHA256 is `f6dd9b5bd0f316d105147f6de7a42a5fa694b55e48a0411b7867b72f8e3f90f2`; the core guardian/owner-directory correction was `66aceaf6f9d4fbc6eac17935941f7b16ec53ce716086e2bbeefcbc59dbaacd84`. Earlier hashes below identify historical checkpoints, not current SQL. The parent independently owns isolated hosted execution and exact-source installation evidence.

The separate [status-notification preparation](OUTREACH-TEAM-NOTIFICATIONS.md) adds only proposed plaintext copy and a pure held/non-sendable review builder. It has no delivery activation, recipient resolution, durable outbox, runtime import or permission expansion. Existing P0 acknowledgement delivery remains unchanged; status-message policy and any future sending remain unapproved.

## Source and dependency map

| Source | Recovered contract | Excluded dependencies |
|---|---|---|
| PR6 head `79404bb5648af269bbaea1604aed4891c507e2c3`, original `20261006200021_outreach_phase_b_team_travel.sql` | Individual approval lifecycle; canonical Person/Household review; official-travel readiness; separate Team/Travel capabilities; campaign-row serialization; total/passenger seat limits; driver review; immutable audit; scoped manifest and formula-safe CSV | Original authenticated adult party intake, service-role assignment system, lodging/rooms, broader campaign workflow/events, reminders and staff provisioning |
| PR35 head `76c328c507460406218f4aff279d3ce3467c9710` | Reference for the integrated Team/Travel workspace contract and separation of operational modules | Four broad uninstalled migrations, old staff shell, communications, prize/Event Day dependencies and unrelated source changes |
| Current production | Existing organizations, canonical People/Households, verified Auth helpers, current active/dated staff permissions, campaign assignments, immutable audit and CSV helper | No historical migration is rewritten or reapplied |
| Current P0 `20261117190320_outreach_volunteer_applications_v1.sql` plus `20261117191223_outreach_volunteer_review_list_fix.sql` | Composite `(campaign_id,id)` application FK and immutable exact-answer intake; pending application remains distinct from Team decision | P1 never mutates P0 submitted answers, creates Auth/People/households, parses prospective passenger names into people, or infers verified identity from email |

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

Guardian correction now requires explicit release of all active travel for that minor. A synthetic legacy fixture recreates the old invalid state (reviewed guardian B absent from the minor's vehicle); confirmation must fail and roll back its tentative state/revision/timestamps/audit. Legitimate current guardian confirmation and release/review/new-guardian reassignment remain supported. P1 authorization also retains all original helper checks and additionally verifies current wall-clock directory dates and the exact org-wide staff.manage grant date window; these checks run both before and after the campaign lock. A previously valid request cannot complete after those dates expire during its lock wait. No original production helper is rewritten.

P1-only private live permission/person wrappers apply the same wall-time protection to People/Household dependencies, including matching department grant and Person affiliation windows. Original helpers are still necessary gates and keep verified/canonical-link/org/department/revocation semantics. The wrappers have no client execution grants. A future-effective permission may remain conservatively denied until a new transaction because the original helper uses transaction-start time; expired authority cannot remain sufficient during a lock wait. The native dependency suite observes each expiry while event team.manage stays current and proves no successful mutation/audit.

Manifests require an explicit event/leg and may filter one vehicle. They expose names, vehicle, seat role and assignment/itinerary status; no email, application answers or prospective passenger text. CSV uses the existing formula-neutralization helper and audits export. Team viewers cannot see Travel review history without Travel view. The roster reports per-leg capacity and unassigned approved participants. The unpublished staff screen provides a scoped printable manifest after the same export authorization and audit.

`outreach_team_own(campaign)` requires a current verified canonical portal link. It returns only that individual's serving status/history and appropriate assigned itinerary, with confirmed travel details withheld when current validity fails. It releases no manifest, other household members, application answers or internal review evidence. Current link revocation removes access. An unpublished read-only participant presentation now consumes this same RPC; no new claiming/linking flow is included.

## Validation

All fixtures are clearly synthetic local records. Native PostgreSQL clusters use private Unix sockets, accept no remote URL/password and are stopped/deleted automatically. Controlled tests do not establish real-account, browser, provider or hosted acceptance.

Commands from the repository root:

```sh
npm ci --ignore-scripts --offline --prefix tools/backend-tests
npm test --prefix tools/backend-tests
npm run test:team-travel:native --prefix tools/backend-tests
```

After reconciliation onto current production source, the ordinary lifecycle/native/browser suite loads the actual installed P0 initial and forward migrations from this repository by default. Only prerequisite/recovery negative tests retain an explicitly labeled structural fixture. `MINDEN_P0_MIGRATION` optionally supplies an exact combined-file override for reproduction. The final integration uses the exact two current P0 payloads in order: initial SHA256 `1f512cfad5287d184bfa5117af7bc1508d810fe56e07ef8adc0b9f960028cdb3`, forward list fix SHA256 `c049d18a40f9cd2984e6ce4d3d103e60f69bc653ed481b00b3b5181bccb2c9f2`. Concatenating their bytes with one newline produces SHA256 `12406b24655d4d2f82428fe14e33d4e47dbc3629da54e0c5ee995be6eda14bb2`; `MINDEN_P0_MIGRATION` may point to that private combined file. The applied initial payload remains unchanged. The earlier backend checkpoint used the prior draft; it is not relabeled as final-source evidence.

Focused checks cover migration guards, lifecycle and stale revisions, unknown age/availability, driver qualification, prospective-name preservation, guardian review/revocation, failed reassignment rollback, source cancellation, time/confirmation boundaries, portal ownership/revocation, event scoping, anonymous/unverified denial, raw table/private helper denial and immutable audit.

Native concurrency checks use independent sessions for eight workers contesting one final seat; reserving the driver seat before driver assignment; duplicate participant/leg allocation; simultaneous reassignment; and permission revocation while an RPC is observed waiting on the campaign lock.

The independent P0 review harness `outreach-volunteer-p0-revocation.mjs` requires the actual P0 migration. Three native sessions observe a settings request blocked on its row lock, revoke the synthetic owner's permission, then prove denial with no enabled/revision/audit change. The discovered post-lock recheck, exhausted-mail-attempt state, NULL drift-guard comparison and actual owner-list alias ambiguity were reported to the P0 owner and corrected there. The alias failure was caught by actual SQL-connected UI acceptance; the forward correction is tested rather than rewriting the applied initial migration. No P0 source file was edited in this worktree.

The complete existing regression suite plus9 recovery guards,64 lifecycle/security and23 DOM/security assertions pass in PGlite/controlled DOM. Native actual-P0 integration passes64 lifecycle/security and10 independent-session race/revocation checks; independent actual-P0 list/detail/blocked-settings review passes7 checks. The original isolated branch passed its unchanged420-file public build; this integration preserves the426-file P0 public artifact, with no P1 publication entries. These results use the P0 bytes pinned above; later concurrent P0 changes require exact-source replay. Existing public/runtime bytes are preserved.

## Unpublished staff interface and browser acceptance

`staff-outreach-team-travel.html`, `assets/js/outreach-team-travel.js` and its scoped stylesheet provide Team review, Vehicles & travel and Manifests screens. The current owner reviews exact P0 answers, searches canonical People, explicitly verifies the selected Person, records availability/age/guardian decisions, approves/waitlists/declines/cancels individuals, records check-in/attendance, manages vehicles and travel legs, separately reviews driver qualifications, reserves/reassigns/cancels seats, confirms itineraries and exports/prints scoped manifests. Unknown answers/age/times retain explicit uncertainty. Person and seat choices start unselected. No account/permission provisioning or participant self-claiming is added.

The same source supports scoped Team/Travel read distinctions without activating them. Travel-only participant projections exclude canonical identity and review evidence. The P0 application panel is limited to the current owner and the exact Minden source binding. Current session changes, denied RPCs, pagehide and stale responses clear/detach protected content. Accessible controls have explicit associated labels; submitted text is rendered with text nodes. No new HTML/script/style is added to `tools/site-build/public-files.json`, the original isolated build remained420 files and the reconciled P0 build remains426 files.

Forty browser assertions pass in real Chromium/Chrome and WebKit at390px/1440px with **actual disposable native PostgreSQL RPCs and explicitly synthetic Auth**. Every browser request is intercepted locally. The flow exercises application→verified Person→age/availability/approval→vehicle/leg→separate driver review→driver/passenger seats→unknown-itinerary denial→explicit itinerary confirmation→formula-safe CSV download→audited scoped print→current permission revocation/data clearing. All four cases have no horizontal page overflow, script errors or external/provider requests. Screenshots were visually inspected. This proves the local UI/API contract; it is not genuine Supabase Auth, inbox delivery, physical-device, hosted RLS or production acceptance.

Run with the exact current P0 sequence:

```sh
MINDEN_P0_MIGRATION=/absolute/path/to/p0-in-order.sql npm run test:team-travel:browser --prefix tools/backend-tests
MINDEN_P0_MIGRATION=/absolute/path/to/p0-in-order.sql npm run test:volunteer-p0:revocation --prefix tools/backend-tests
```

Credential-free synthetic logs/screenshots/receipts are retained in the outer private audit workspace `audit/minden-team-travel-159-20261117/`, excluded from all public artifacts.

## Read-only participant view checkpoint

`outreach-team.html`, `assets/js/outreach-team-portal.js` and its scoped stylesheet narrowly adapt PR6's generation-guarded own-trip rendering, verified-session check, denial/refresh flow and account-change behavior. Historical public signup, party/family, lodging, meeting/training and write/claiming paths are excluded. The new page calls only the existing `outreach_team_own(p_campaign)` RPC. That participant-only checkpoint preserved SQL SHA256 `11514d029f1e0b542d6be6a665366f688e83ec14ad3e7df742aebd2d59bf67ba`; the active candidate hash including subsequent guard/guardian/date corrections is recorded above.

The outreach team must supply an event link containing exactly one valid campaign UUID. Missing, malformed or ambiguous values request the authorized event link; the UI never guesses IDs or passes null for all history. The existing verified Auth/current canonical portal link remains the server authority. The page shows only own serving/application status and recorded check-in/attendance history. It displays vehicle/departure/location/destination only when current approval, source application, travel readiness, assignment confirmation and server itinerary-validity flags agree. Other arrangements remain explicitly unconfirmed. It renders no member/other-person ID, manifest, private review, applicant answers or identity-claim controls.

Revalidation clears old content before reading current authority. Session/account changes, denied/empty own responses, visibility/pagehide and generation checks prevent stale private content from reappearing; failed current-session logout stays locked. Text fields use text nodes. The page has a main landmark, focusable skip link, visible focus styles, readable mobile cards and explicit time zones. No new page/script/style is added to the public manifest or existing navigation. This checkpoint adds no backend function, account, canonical link, permission, email or hosted action and does not edit the parent's integration worktree.

Forty-three controlled DOM/security checks and48 Chrome/WebKit checks at390px/1440px pass with **synthetic Auth/RPC responses only**. They cover required event links, current gate responses, own-only fields, confirmation withholding, no write controls, cross-event/malformed responses, XSS-safe text, account/late-response/logout/cache clearing, responsive overflow and focus styling. Normal mobile/desktop screenshots were visually inspected. These checks do not establish genuine Supabase Auth, actual canonical linking, physical-device or hosted acceptance. The existing full suite and unchanged420-file public build pass separately.

```sh
node tools/backend-tests/outreach-team-portal.dom.mjs
EVIDENCE_DIR=/private/synthetic/evidence node tools/backend-tests/outreach-team-portal.browser.mjs
```

Participant evidence is retained privately under `audit/minden-team-travel-159-20261117/participant/`. Parent integration must preserve its actual P0 fixtures/scripts and current-main history while reviewing this UI-only commit. Genuine verified-account acceptance and exact P1 activation/publication authority remain open.

## Remaining acceptance and decisions

Additional focused regressions are available with `npm run test:team-travel:guardian --prefix tools/backend-tests` (PGlite; use TEST_NATIVE_PG=1 for native) and `npm run test:team-travel:expiry --prefix tools/backend-tests` (native independent connections). Fourteen guardian/correction/rollback checks and ten observed lock-wait expiry checks pass; these are synthetic local evidence, not genuine hosted acceptance. The default Team suite includes guardian checks and the native suite includes both.

`npm run test:team-travel:dependencies --prefix tools/backend-tests` adds39 native scoped dependency/expiry checks, including positive/negative department scope and private-helper execution denial. It is included in the native aggregate. Preserve the parent's separately added access-stop regression when integrating package scripts.

- The P1 staff interface and print flow are implemented/tested locally and excluded from the public artifact. P1 hosted SQL, genuine Auth/account acceptance, public participant/staff publication and release remain incomplete. Existing P0 owner review and its release authority remain separate.
- Roddy, Kelsea and Danielle remain pending exact verified login emails, duties, event scopes, dates and explicit provisioning authority. No guessed account or broad grant is permitted.
- No departure/return/meeting times, lodging arrangements or additional status emails are invented. Lodging/communications remain outside this extraction.
- An authorized operator must verify each canonical Person, availability, age and any guardian authority before official travel. Do not treat explicit local synthetic reviews as operational verification.
- Before release, review the candidate independently, integrate into the approved staff/portal shell, complete genuine isolated acceptance with negative/revocation tests, verify current hosted helper/catalog parity, and obtain exact source/schema/access release approval. Do not install this file merely because local tests pass.

## Copy-and-paste continuation assignment

Recommended thinking level: HIGH.

Continue issue159 P1 from draft PR162, branch `codex/minden-team-travel-159-integration-20261117`, reconciled onto released production source9065715. Read AGENTS.md, continuity/security docs and this contract. Preserve the separately authorized P0 release and its exact current migration. Review the uninstalled Team/Travel candidate and actual P0 adapter; do not wholesale merge PR6/PR35 or activate PR149. Review the implemented unpublished staff screen for explicit canonical identity/availability/age/guardian review, individual approval, separate driver qualification, per-leg vehicle assignment/reassignment/cancellation, current validity, secure CSV and print. It reuses the current auth/logout shell and clears protected data on revocation/late responses; preserve these properties during integration. Review the implemented read-only own-portal presentation and preserve the explicit event-link/current verified canonical-link gates. Keep unknown times unconfirmed and prospective names unverified text. Do not grant named staff without exact verified accounts/duties and separate authority. Run complete regressions, actual-P0 native lifecycle/race/revocation checks and genuine isolated account/browser acceptance. No production SQL, deployment, messages, keys, paid resource or permission changes are authorized by this continuation prompt; obtain the relevant exact action authority before executing them.
