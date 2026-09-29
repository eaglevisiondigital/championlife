# Durable decisions

## Dream Track v1 decisions — September 29, 2026

- Explicit assignment authorizes this course package, local testing, one forward acceptance migration, acceptance email adapter, development commit/push and CI. Prior module holds are superseded only for Dream Track. Production, merge, real grants/invites and other modules remain held.
- Reuse seven original video IDs and existing course/enrollment/progress/answers/Auth identity. No eighth Vision video, duplicate upload, LMS, .NET migration or database/IP merger. Fix only the old Lesson 6 label to the approved Abundant Life title.
- Keep Getting a Grip implementation unchanged. Dream implements WATCH + PASS TO ADVANCE with exact 95% numeric watched intervals and 16/20 cumulative mastery. Current Grip code lacks segment enforcement; do not invent a claim that it was implemented or change Grip in this package.
- Preserve the exact numbered approved bank, including overlapping/nonchronological review starts, rather than silently renumbering doctrine/questions. Use existing prompt Scripture references; no raw transcript or outside doctrine committed.
- Keep one inactive/unset access-code seed. Authorized course managers configure a real code later. Invitations are an explicitly approved alternate enrollment path, use verified matching Auth email, and never infer People/portal/member/staff authority. Retire legacy public fallback/cookie authority in development.
- Reuse existing Auth email with exact acceptance callback; no SMTP/template/redirect reconfiguration. Provider acceptance is distinct from delivery; failure has a one-time copy-link fallback. The acceptance-only adapter performs its own bearer/Auth and guarded course-manager validation. No real invitation is sent by this package.
- Record a durable final-meeting-gated achievement on the existing enrollment, with optional explicitly reviewed contact association; never merge contacts by email. Reversal preserves audit and revokes the badge, re-completion reactivates the same award. Staff filters live in the integrated course view without expanding generic People data exposure.
- Acceptance assigned migration version `20260929221116`, byte-identical to local SQL. All 20 prior migrations remain unchanged. Next gate is hosted real-account Dream Track acceptance (including playback/casting and actual Auth email), not another feature package.

## Registration/Check-in v1 decisions — September 29, 2026

- Explicit assignment authorizes this package and the acceptance-only forward migration. Previous Events hold is superseded for Registration only; production, merge and subsequent modules remain held.
- Reuse Events and People/Staff, with guest-origin registration separate from tenant People and optional portal accounts. No automatic email/phone identity merge; staff review or an existing verified reviewed account link establishes linkage.
- Configure one enrollment scope per event, immutable after the first registration. Count attendees in pending/confirmed registrations. Occurrence scope has one capacity bucket per date; series scope has one shared enrollment bucket. Cancelled/expired records release places. No actual waitlist or expiration worker.
- Use the Events organization advisory lock for atomic capacity and event/registration consistency, unique request keys/hashes for exact retry, and revisions for staff updates. Authorized override requires its separate key, explicit intent and a meaningful audited reason.
- Bounded event questions support ten types, registrant/attendee scope and general/restricted classification. Answered definitions cannot change type/scope/sensitivity/options; replace/deactivate instead. No full Forms engine or export is built.
- Check-in is separate from registration and requires checkin.manage. Undo preserves history. Cancellation is blocked while active attendance exists; remove an attendee only when it has no attendance history and is not the last attendee. Walk-ins create a confirmed enrollment and immediate attendance with separately authorized People linkage/creation.
- Add checkin.view/manage, registrations.restricted and registrations.override to the existing allowed-permission mechanism. No implicit grants or ministry names; department rules stay consistent with People/Staff. Sensitive-answer authority is separate from check-in authority.
- Payments remain explicit lifecycle/reference/destination hooks only; both public enrollment and staff enrollment fail closed for payment-required events. No provider return marks paid, no merchant routing inferred from hostnames, no actual messages or Text-to-Give.
- Acceptance assigned migration version `20260929131021`; local SQL matches exactly. Preserve all 19 prior migrations and existing acceptance users; rollback-only synthetic validation leaves no test records. See [Registration contract](docs/REGISTRATION-CHECKIN-V1.md). Chat reviews before the next module.

## Events/Calendar v1 decisions — September 28, 2026

- Explicit assignment authorizes Events/Calendar implementation, isolated acceptance forward migration/testing, development commit/push and CI. The earlier People/Staff next-package hold is superseded only for this module. Production and Registration + Check-in remain held.
- Reuse current tenant/department/verified-staff grants and account-link architecture. Champion Life is the first tenant with America/Chicago default; other tenant defaults are configurable, initially UTC. No real events, ministry labels or staff grants are seeded.
- Persist series, stable local-date occurrences and separate overrides. Bounded, demand-driven UTC materialization preserves local time across DST and independent cancellations. Missing month dates are skipped. Explicit whole-series and one-occurrence editing only; proper series splitting is deferred.
- events.manage controls create/edit/approve/publish within explicit scope. Optional approval validates workflow and unchanged approved content, but is not two-person separation of duties. No inferred title/member/finance authority or new approval keys.
- Use conservative member/hidden handling: reviewed verified linked current members can see published member events; hidden events remain authorized-event-staff-only even by UUID. Public unlisted-link access is deferred rather than silently treating a URL as authorization.
- Public tables remain RLS-enabled RPC-only. events_catalog is the exact sole anonymous private safe-projection exception behind an invoker wrapper; private helpers and all raw event tables remain denied. Tests explicitly enumerate this exception instead of weakening general access checks.
- Location overlaps are warnings over effective materialized occurrence times; setup/cleanup buffers, full booking and custom-text matching are deferred. Native registration/check-in/payment settings are honest future hooks only.
- New migration takes the acceptance tool's assigned version 20260928183137, byte-identical locally/remotely. Preserve all 18 prior versions/hashes, existing acceptance users/state and production boundaries. Review [Events contract](docs/EVENTS-CALENDAR-V1.md) before expanding v1 bounds or starting the next package.


## People/Staff v1 decisions — September 28, 2026

- The explicit user assignment authorizes this forward People/Staff package, isolated acceptance migration/testing, development commit/push and CI observation. Earlier feature holds do not block it. Production, merge and real staff provisioning remain prohibited; Chat review precedes Events/Calendar.
- Reuse tenant contacts, Auth profiles, reviewed portal links, organizations, departments, directory, grant key and admin audit; add only minimal human anchors, accountless dated relationships, affiliations and role templates. Do not guess cross-tenant identity from email.
- Preserve stored naming: people.read/update, discipleship.read and finance.read/configure map the requested view/edit/course/finance concepts. Future module and restricted-note keys are reserved capabilities, not claims that those modules exist.
- Scope is null for organization-wide or a nonempty department UUID set. No explicit-deny hierarchy in v1: missing, inactive, revoked, future or expired authority denies. Legacy modules only accept organization-wide effective grants until resource-specific scope support is implemented.
- Templates are explicit materialized bundles. One grant row per capability means later explicit/template application replaces scope, dates and provenance; removing a template revokes only grants still attributed to it. Template edits never silently change current authority. Finance must be expressly selected and owned by the grantor.
- Keep staff.manage trusted-provisioned and non-delegable. New staff assignments require reviewed verified account links. Retain compatibility assignments for pre-existing explicitly authorized staff; never infer authority from membership, ministry, course or outreach records. No real/default grants are seeded.
- Record new migration under the acceptance tool's assigned version `20260928172557`, matching local SQL exactly. Preserve all 17 historical migration identities/hashes; do not rewrite history or reset the branch.


- September 26 resume authorization completed the exact reviewed development push and hosted CI. No preview configuration or PR publication was performed: branch deploys are disabled and previews are public. Next gate is Work preview/configuration and authorized-account browser acceptance, not a new feature package. Main and production remain held.

- main is production-controlled. Development occurs on champion-sowgo-backend-v1; passing tests is not release permission.
- Extend working course/outreach/auth/staff/portal systems instead of recreating them.
- Champion Life is the church-facing brand; SowGo is its outreach arm. Preserve separate organization and financial boundaries. One participant may qualify for both portals without broader staff access.
- Discipleship/evangelism attribution uses Lockliel; other platform functions use Kingdom Propel. Reusable capabilities may later be supplied by Global Propel. Runtime/contracts remain unresolved; no .NET migration is authorized here.
- Competitive products inform requirements; their distinctive UI/layout, artwork and copy must not be reproduced. Champion Life uses its own branding and focused navigation. Exact earlier mockup visuals still need recovery before detailed design replacement.
- GiveHub remains operational wherever currently used. Existing giving URLs stay until explicit replacement authorization following testing; completion of this package does not authorize switching.
- All 17 historical migration identities/SQL are preserved. Recovery adds seven existing historical files, not seven new database changes. Production history is not repaired or replayed.
- Browser Supabase pinning is deferred to actual-library/browser acceptance; exact candidate 2.117.2 and test plan are in SECURITY_MODEL.md.
- Events/calendar, payments, administrators, new auth architecture, shared payment engine and app integrations are outside this hardening package. Documented future scope is not permission to activate it.
- Review the hardening report in Champion Life Chat before starting the next package.

- The subsequent explicit preview-readiness assignment authorizes safe artifact/config changes, development push and a draft development-to-main PR solely for Netlify acceptance preview generation. Missing backend config must block preview access. No merge, production release, production Auth change or backend provisioning is implied.

- September 27: classify rls_auto_enable as project-owned provisioning state generated by the explicitly selected Supabase automatic-RLS option (B), not an omitted migration or guaranteed core object. Preserve all 17 historical SQL files and restore the captured prerequisite using guarded bootstrap before supported branch rebase. No fake backdated/forward history entry, production rewrite, or speculative helper implementation. Browser acceptance remains a separate Work task.
