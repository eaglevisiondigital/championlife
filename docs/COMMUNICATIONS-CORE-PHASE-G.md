# Communications Core — Phase G build contract

This candidate depends on accepted Staff Workspace PR #13 at `80d1c702679bff3a307f306ac952ac3252f53d9b`. Authorized isolated hosted acceptance passed on October 9. The corrected migration is applied only to acceptance `bkbmjisprwmkptywtmih` as `20261009174358`; sink-only worker/callback were tested there and disabled after cleanup. No production activation, real message, production permission bootstrap, prerequisite merge, billing or Phase H is included.

## One core and canonical boundaries

Email and SMS share one tenant-owned outbox, templates, batches, consent, preferences, suppression, attempts, callback ledger, event-consumption ledger and append-only metadata audit. Push/in-app remain future channel additions. Message classes are transactional, operational, reminder, follow_up, campaign, marketing, receipt and security. Purpose is separate: transactional, event_updates, follow_up, discipleship, marketing, donation_receipts.

References point to existing People, campaign contacts/registrants, registration household contacts, reviewed team guardians, course enrollments/progress and operational area assignments. No new identity, portal account, organization/campaign membership, LMS, follow-up task engine or payment authorization is created. Getting a Grip remains WATCH TO ADVANCE / ANSWER TO COMPLETE; answers are never included in a messaging audience.

## Staff surfaces and permissions

Four existing-shell pages: Communications Overview, Campaign Communications, Communication Templates and Delivery Activity. All links exist and are filtered by current server projections. Selected campaign is retained in navigation. Powered By Kingdom Propel and approved shared shell assets remain unchanged.

Permissions: `communications.view`, `.send`, `.bulk_send`, `.templates.view`, `.templates.manage`, `.delivery.view`. Campaign assignments confer only their named campaign capabilities; organization grants use current active staff assignments. Audience selection never confers People authority. Organization-level Person selection/history also requires existing People permission. Bodies require communications.view; delivery-only reads return metadata. Session changes discard pending responses; access denial clears protected content; current grants are rechecked on focus and periodic refresh.

People actions retain external/manual Call, Text and Email. Core-backed Compose Email/Text, Send Video (approved HTTPS link), and Person history appear only with explicit communications grants. Create Task uses canonical followup_tasks and existing followup.manage. Explicit external-action recording is labelled delivery unverified, never delivered.

## Preview, audience and batch

Audience filters are constrained: host/contacts, scoped Person, follow-up status, existing discipleship progress (not started/active/completed/inactive using an explicitly selected inactivity-day threshold), registered household contact, checked-in household, approved team and operational area. No arbitrary SQL or cross-campaign People search. Known team minors never receive direct messages; reviewed adult guardians/contact are projected instead.

Canonical identity and normalized destination deduplicate a single intended send. Missing destinations retain separate identity rows with invalid-address warnings. Preview creates only a draft batch; it resolves plain-text allowlisted variables and shows each recipient, rendered content, eligibility and missing-data warnings. Unknown expressions are rejected; missing data is blocked and never queued. Approved HTTPS origins constrain supplemental portal/registration/video links.

Confirmation requires an explicit checkbox, creator identity and a fresh preview (15 minutes), rechecks campaign revision, current audience/address, template and sender, consent and limits, then snapshots per-recipient jobs. Idempotent request/batch keys prevent duplicate confirmation. Batch progress comes from canonical outbox status. Browser code never loops over provider sends. Manual scheduling accepts explicit UTC; rendered campaign dates carry the canonical campaign IANA timezone.

## Consent, preference and suppression

Consent is recipient/channel/purpose/tenant, optionally campaign-specific, with explicit reviewed source/proof, timestamps and revocation. Campaign revocation overrides organization consent. No exceptions are inferred from a phone, email, registration or staff role; all initial channels/purposes require an explicit grant. Reviewed consent recording is an audit action, not proof manufactured from registration flags. Acceptance uses only synthetic proof.

Preferences include email/sms allowed, preferred channel and recipient IANA timezone; preferences do not replace consent. Suppressions include STOP, unsubscribe, hard bounce, complaint, invalid address and administrator suppression. Check at enqueue, claim and immediately before provider handoff. Verified STOP/START/HELP/UNSUBSCRIBE events are deduplicated. START clears only STOP, never creates purpose or marketing consent; HELP has no sending/authority side effect. No conversational SMS or donation parsing exists.

## Templates and branding

Tenant-owned plain-text drafts support create/edit/preview/publish/deactivate, revision checks, locale/version hooks, and one active published version per key/channel/locale. Published content is immutable even to owner updates; activation may change. Historical outbox preserves rendered content and template version references.

Allowlisted variables: first_name, campaign_name, campaign_date, church_name, task_name, due_date, portal_link, registration_link, event_location, coordinator_name. Campaign/task values come from canonical state; supplied links must match separately approved origins. Email adapter escapes text into safe HTML, with approved profile display name/from/reply-to/footer/support metadata. Sender profiles are separately provisioned/approved by trusted configuration; staff cannot enter arbitrary From addresses or provider credentials. Tenant identity is not forced to Kingdom Propel in message bodies.

## Event integrations

Phase F emits held canonical events; Communications Core consumes only explicitly approved enabled routes, published templates and matching approved senders. Current approver send/bulk authority is checked. Route approval starts consumption at its approval timestamp, avoiding retroactive delivery of historical events. A route/event ledger prevents old consumed events starving later events; message keys include event, route, recipient and channel.

Due/overdue/escalation jobs reuse exact Phase F reminder keys, recipient roles, assigned accounts and due snapshots. Completed tasks, changed due dates, inactive scope and stale campaign revisions block future handoff. Postponement/rescheduling communications use current campaign values and require an approved route; obsolete workflow reminders cancel. Approval does not enable a real provider.

Existing A–F domain-event names provide prepared hooks for registration confirmation/reminder/check-in/follow-up, approved/waitlisted team, vehicle/lodging/trip notices, area/operations notices, prize follow-up and discipleship invitations/reminders. Generic templates intentionally contain no private travel/lodging records or public winner PII. Specialized private travel detail rendering, nurture sequences and live route activation remain separately reviewed consumers of this same core, not separate systems.

## Queue, retry and delivery

Statuses: draft batch, queued, scheduled, sending, sent, delivered, failed, suppressed, cancelled. Provider acceptance means sent; only a verified normalized delivery callback means delivered. Attempt/provider IDs, source workflow/event, scheduling and safe failure classifications are retained.

Tenant advisory transaction locks serialize enqueue, consent changes, confirmation, callbacks and handoff; row locks/leases provide atomic due claims. Claims create a unique numbered attempt and a two-minute token lease. Before handoff, current source actor, current canonical membership/address, consent/preferences/suppressions, reminder due/completion and campaign revision are rechecked. The authorization transaction is the linearization point: revocation effective before authorization prevents handoff. Already handed-off delivery cannot be recalled; documentation does not promise that impossible guarantee.

Transient failures receive bounded exponential backoff and configurable max attempts; definite permanent failures are dead-lettered. Lost pre-handoff leases recover with delay; lost post-handoff leases become uncertain and cannot blindly retry. Failed acknowledgement after a provider receipt is not resent by the worker. Transports receive the stable canonical idempotency key. Unknown outcome requires provider reconciliation before any future administrative requeue policy.

Limits: tenant, campaign, initiating user, recipient and time-window settings; configurable, transactionally checked for manual and automated jobs. SMS quiet-hour defer uses recipient, then campaign, then tenant IANA timezone. UTC timestamps are canonical; defer computes local quiet-window end (including overnight windows).

Credits are neutral estimate/reserve/consume/release fields. No carrier-price or fixed 10,000/$0.03 business rate, balance purchasing, billing or donation authorization is embedded. Pre-send cancellation/suppression releases reserved estimates. GIVE/MISSIONS/BUILDING/YOUTH/OUTREACH/SOWGO command parsing and stored-payment flows are Phase H boundaries only.

## Provider / callback contract

Injected email/sms transport adapters expose send receipt and status normalization; no live transport is configured. `acceptanceSink()` performs no network send and returns deterministic sink receipts. Runtime database modes permit only disabled or acceptance_sink. Edge functions additionally require explicit acceptance enablement and **exact** acceptance project URL `bkbmjisprwmkptywtmih`; this candidate cannot enable production delivery.

Worker endpoint requires a separate server bearer. Callback requires HMAC-SHA256 over `timestamp + '.' + raw_body`, timestamp within five minutes, fixed normalized acceptance provider, unique event ID, and bounded 8 KiB streaming input. Secret is server-only. Verified delivery/preference events enter service-only RPCs; raw credentials/upstream errors/webhook payloads are not logged/returned. Callback JWT gateway configuration must be reviewed at acceptance deployment (`--no-verify-jwt` only for the HMAC-protected callback/own-bearer worker); it is not changed by this build.

Provider outcomes: sent, delivered, soft_bounce, hard_bounce, complaint, rejected, undelivered, failed. Callback dedupe yields one delivered audit transition; hard bounce/complaint suppress future sends. No raw provider secret reaches browser assets.

## Privacy, testing and acceptance gates

RLS on every communication relation; raw table and private helper execution denied to anonymous/authenticated/service clients except narrow workspace/service facades. Tenant-composite foreign keys bind sender/template/batch/campaign. Audit is append-only metadata; bodies require explicit read authority. retention_days is a configuration hook; no unreviewed destructive retention job is installed.

Local evidence: complete standard regression, focused database/security/adapter/DOM tests, allowlist site build/syntax/diff checks, six native PostgreSQL races A–F. Every race uses eight independent overlapping worker backends plus separate coordinator, committed server barrier, lock-active query evidence and server interval timestamps. Retry race starts from a genuine transient first attempt and proves one second lease.

Disconnected browser fixtures are private test assets excluded from dist. Responsive checks cover overview, compose, audience/message preview, templates, activity and Person history at 390/768/1440. These checks validate actual UI assets with synthetic projections, **not hosted backend acceptance**.

Hosted evidence at functional application SHA `4b9f57a48de28c06332f754ca9972041bcc43875`: 227 guarded acceptance database/security/source/sink checks and all six races PASS. Each race proved 12 distinct independent worker backends, separate coordinator, server barrier and 12 overlapping active RPC queries/intervals. Reminder/bulk/callback/template races retained canonical results; effective consent revocation blocked handoff; retry race retained one second lease without duplicate transport. Existing 34-entry migration ledger remained intact (35 entries after Phase G).

Authenticated hosted UI PASS: shared navigation/Kingdom attribution; canonical six-state metrics; individual and bulk preview/confirmation/progress; explicit suppressed recipients; literal escaped markup; draft/edit/preview/publish/deactivate; combined date/channel/status/type/recipient/provider filters; scoped email/SMS/failure/manual-action Person history; keyboard focus/labels and 390/768/1440 layouts. Same-session removal cleared protected content, removed Communications navigation and denied direct pages/send/template/history without logout. Additional rolled-back synthetic checks verified disabled-provider safety, future-not-early/due-once scheduling and transient retry through eventual success.

Cleanup PASS: all three synthetic campaigns closed, temporary grants/assignments/portal links neutralized, synthetic templates/senders/routes disabled, active jobs/batches cancelled, immutable message/audit history retained. Other tenant grants are unchanged. Acceptance enablement is false; the new worker/callback secrets were removed and both functions return 503 Disabled. Private evidence/screenshots remain outside the public repository and build. Recommend Chat accept Phase G hosted acceptance; do not start Phase H or activate production. Specialized private travel rendering, nurture sequences and real provider certification remain future separately approved consumers, as described above.

Production activation requires separate approval of provider, sender ownership, consent/exemptions, opt-out/support policy, delivery reconciliation, limits/timezones/quiet hours, retention and transport secret deployment. No production Auth/SMTP/DNS/giving/merchant/SowGo /go, campaigns, PR merges or real messages changed here. Phase H is not started.

Hosted upgrade correction: preserve the eight existing Check-In, Registration and Dream Team permission keys when extending the constraint/registry. A regression seeds those accepted baseline grants before Phase G; the upgrade and original grants remain valid. No old migration or existing grant is rewritten.
