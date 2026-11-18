# Minden v2 local foundation fixtures

Synthetic local source-contract proof only. No remote URL, provider credential, hosted Auth/JWT, real contact or permission activation is accepted. Native mode uses independent connections on a temporary local Unix socket; PGlite mode checks the same source contract without claiming native lock semantics.

`minden-decision-v2.fixture.mjs` replays the current reviewed migration/P0/P1/disabled-notice source, installs local provider session primitives, and replaces the empty synthetic P0 event with the owner-selected fixed Minden UUID. It then applies the exact new foundation candidate. All fixture identities, finite staff scopes, active source mapping and consent rows are explicitly synthetic. The source candidate itself seeds none of them. Existing PostgreSQL function bodies are fingerprinted before/after; current registration/Team/Travel capability implications are tested as preserved.

An optional trusted local `beforeCandidate({db,q,org,campaign,candidate})` callback can prepare and execute the separately composed installer; return `true` to skip standalone foundation installation. It accepts no hosted target or credentials. Default tests have no callback. Synthetic `private.minden_decision_followup_consent` is installed only by tests which need to control current-consent races; it is not application SQL and must never be deployed. The production helper belongs to the separately reviewed protected-intake fragment.

Foundation intake contract: service transaction inserts the existing legacy registration with exact `minden_la_outreach`, inserts `outreach_decision_followup` with unassigned/null staff attribution, statusnew/revision1, and calls service-only `private.minden_decision_record_intake(campaign,registration,request)` atomically. The immutable audit explicitly records service_intake with NULL actor, versus verified_staff for current-session staff operations. Missing/invalid current-consent helper returns followup_allowedfalse and denies followup writes.

Staff API is the invoker wrapper `campaign_decision_foundation(action,organization,campaign,payload)`. Context may discover the organization for the fixed approved campaign; every other action requires exact organization. `queue` reveals only unassigned/expired/revoked-authority references/timestamps, `assignees` only current finite reader UUIDs/expiry, `assignment_get` only the binding/revision/expiry, and assignment_save performs explicit finite assign/reassign/revoke. Assigned list/detail returns minimal decision/name/status and no contacts, prayer, Person or learner data. Followup_save is own-assignment/current-consent only. No RPC grants staff capabilities, links identities, creates accounts, sends messages or exports data. New tables are RLS with no raw client or service grants; internal/session helpers have no client EXECUTE.

Focused commands (run from repository root):

- `node tools/backend-tests/minden-decision-v2.test.mjs`
- `TEST_NATIVE_PG=1 node tools/backend-tests/minden-decision-v2.test.mjs`
- `node tools/backend-tests/minden-decision-v2.concurrent.mjs`
- `node tools/backend-tests/minden-decision-v2.dom.mjs`

The concurrency suite observes real `pg_stat_activity` lock waits before allowing expiry/revocation, and proves no revision/audit advance on refusal. It also races durable duplicate requests and conflicting target choices. Browser/hosted Auth/SMTP/Storage/CAPTCHA acceptance, exact legal/guardian/100-bike/privacy terms, staff duties/scopes and release remain separate mandatory gates. No source commit, merge, hosted write, grant or deployment is implied by local PASS.
