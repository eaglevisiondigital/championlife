# Outreach Partner isolated release candidate

Preparation and acceptance only. No production release or authorization to merge. Based on production commit 306d6b62124f51547b9a02171858400b31b9c6cc; selectively reuses approved source 3f2316d4e575a538d7fb5866dc9c0390f66cc471. Does not merge the development branch.

## Final candidate hardening — October 5, 2026

Chat approved network **120/hour**, email **5/hour**, phone **5/hour**. Forward migration `20261005161946_outreach_network_limit_120.sql` changes only `private.outreach_abuse_limit(text)`; already-applied migration bytes remain unchanged. No shared/global quota. This migration is locally replayed/tested, **not applied to production or acceptance in this task**.

Read-only production catalog confirms pg_cron **SUPPORTED**: available 1.6.4, preloaded, managed privileged-extension allowlist includes pg_cron, cron database `postgres`, host `localhost`, and the postgres role has BYPASSRLS. The extension and cron schema are absent. No additional scheduler service or restart is needed for the observed configuration. See [Supabase installation](https://supabase.com/docs/guides/cron/install) and [named-job behavior](https://supabase.com/docs/guides/cron/quickstart). A repeated `cron.schedule` name can overwrite a job, so the prepared command checks the existing contract first.

### Prepared production cleanup procedure — NOT APPLIED

Activation still requires **explicit production release authorization**. These are manual release files under `supabase/release/`, deliberately outside automatic migrations and the public artifact. Do not run them against acceptance. Verify the authenticated dashboard/connection is project **exdocjbmylgxssanymjk**, database/user **postgres**; never put connection secrets in commands, reports or chat.

1. Re-read migration history and extension/job state immediately before the authorized release. The earlier gateway migration conditionally schedules if pg_cron is installed. For the observed production path, **keep pg_cron absent until the gateway and policy migrations finish**. If pg_cron/cron schema has appeared since preflight, stop before applying that gateway migration and review all jobs/owners; do not let its historical conditional overwrite a named job. Preserve applied history. Coordinate the release so no concurrent extension/job administration occurs.
2. Apply only the four missing candidate migrations in the authoritative dependency order from `tools/backend-tests/migration-order.mjs`: People/Staff, Outreach intake, gateway, then `20261005161946_outreach_network_limit_120.sql`. Follow the existing gated sequence preventing intermediate anonymous RPC exposure. Do not replay the 18 production baseline migrations.
3. In the verified production postgres SQL session, explicitly acknowledge the target:

   ```sql
   select set_config('champion.outreach_release_target','exdocjbmylgxssanymjk',false);
   ```

   This is an operator interlock, not automatic project-identity verification. In that same session execute the exact contents of **`supabase/release/outreach-cron-enable.sql`**. For an already authenticated, verified psql session, the file command is:

   ```text
   \i supabase/release/outreach-cron-enable.sql
   ```

   The transaction checks target acknowledgement, database/role, extension support/preload, local cron destination, approved policy and cleanup ownership/API-role execution denial. It executes `CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog`, plus Supabase's documented cron schema/table management grants **to postgres only**. No browser/private-function grant is added. It locks `cron.job`, examines all owners, and schedules only `select private.outreach_abuse_cleanup()` as **`outreach-abuse-cleanup`**, **`*/5 * * * *`**. One exact active existing job is retained, including its id/history. Duplicate names or unexpected command, schedule, owner, database, host, port or inactive state abort the whole transaction. Other jobs are preserved.
4. Execute **`supabase/release/outreach-cron-verify.sql`** in the same verified postgres session. Require exactly one row with `expected_contract=true`, all three API execution privileges false, then an actual scheduled successful run in `cron.job_run_details`. Watch expired-window backlog and failures; job presence alone is insufficient. No production worker execution is claimed by local tests.
5. If explicitly authorized to stop cleanup, acknowledge the same verified target and execute **`supabase/release/outreach-cron-unschedule.sql`** (`\i` in psql). It validates the exact contract, then calls **`cron.unschedule(existing.jobid)`** only for that job; absence is an idempotent no-op and conflicts abort. Verify zero rows for the cleanup name and compare the other jobs to the pre-release inventory. Do **not** drop pg_cron, schema, cleanup function, counters, intake, audit or People data. Unscheduling suspends retention cleanup; record/resolve the backlog before resuming.

Focused validation covers the 120/121 boundary, separate contact caps, no global cap, exact retries, real PostgreSQL concurrent counter updates, 1,000+1 cleanup batches, active/recent-window retention, unchanged intake/audit/People snapshots and API cleanup denial. Scheduler transaction/verification/rollback SQL executes against a synthetic local cron API/catalog; hosted extension installation and real worker execution remain release-time checks. No public UX, ingress, Turnstile, Auth, permissions or remote database configuration changes.

Current release gates supersede historical pending items below: exact new candidate review/release authorization; real production challenge/build/Edge configuration and gateway deployment; four missing migrations; scheduled cleanup success and production ingress proof; explicitly authorized operator grants; minimal manual phone/tablet check. Hosted staff/login/People acceptance and the native-new-intake/historical-Netlify notification decision are already complete/approved. No new production Auth callback is inherently required under the verified same-origin Site URL rule. SowGo's production Partner-link cutover is a separate follow-on gate after Champion Life passes. No PR merge is authorized here.

## Acceptance login repair — October 5, 2026

The login accepts exactly six or eight ASCII digits through the existing email `verifyOtp` mechanism. One `sanitizeNext` policy controls storage, callback construction and every successful-session navigation. Paths must begin with exactly one slash, remain on the current HTTP(S) origin after URL normalization, and fit within 2,048 characters. External/scheme-relative URLs, backslashes, whitespace/controls, malformed escapes, encoded slashes/backslashes and nested percent encoding are rejected. Safe query/hash values remain intact. Invalid or missing values fall back to `/my-discipleship.html`; explicit invalid query values cannot inherit a stale stored destination. Storage failure does not prevent sign-in or navigation.

The requested callback is the browser's current origin plus `/discipleship-login.html?next=<encoded-sanitized-path>`. The URL carries the destination across tabs independently of session storage. Existing Supabase `detectSessionInUrl`, session restoration and auth events remain unchanged; no new token parser, identity mechanism or permission grant is introduced.

Read-only acceptance inspection found Site URL `https://deploy-preview-2--championlifechurch.netlify.app` and four PR #2 callbacks, with no PR #4 callback. The dashboard explicitly describes Site URL fallback for disallowed callbacks. Both ordinary confirmation and magic-link templates use `ConfirmationURL`, not a hardcoded PR #2 sign-in destination. The previous PR #4 request omitted `next` and was not permitted by acceptance Auth.

**AUTH CONFIG CHANGE REQUIRED BEFORE HOSTED LINK ACCEPTANCE.** Separately authorize adding only `https://deploy-preview-4--championlifechurch.netlify.app/discipleship-login.html?next=%2Fstaff-outreach-partners.html` to acceptance project `bkbmjisprwmkptywtmih`. Keep Site URL and all existing entries/templates/SMTP unchanged. No configuration was changed by this repair. Other direct login destinations (People or default dashboard) require their own exact callback entries if separately approved; no wildcard is needed for the assigned staff flow. Generic same-origin application routing cannot override the provider's allowlist. Production release also requires a separate callback review before deployment.

Focused local validation: 87 login DOM scenarios, inline JS syntax, existing SDK URL-session options, and site-build/public-artifact isolation tests pass. Real OTP/email-link acceptance remains with Work after the configuration gate. Public Outreach, gateway, staff pages, Christmas Dinner, Bessemer, giving, Supabase schema/functions and production are unchanged by the login repair. The existing ordinary email fallback still describes a six-digit code; its copy is outside this read-only Auth assignment and was left unchanged.

## Submission boundary

The public form calls only `outreach-partner-submit`, an unauthenticated HTTP Edge Function with custom Turnstile verification. It permits POST/OPTIONS, explicit configured HTTPS origins, JSON, at most 16 KiB, a five-second body read, a four-second Siteverify request and an eight-second database request. No submission data, credentials or raw request errors are logged by the implementation. Origin is defense in depth, not identity proof.

Honeypot requests receive an accepted-looking response after the bounded transport checks and before challenge/network/database work. All other submissions require Siteverify. Real keys require success, exact `outreach_partner` action and an explicitly allowed hostname. The browser contains only a public site key.

The old public submit RPC is removed. The private canonical implementation is unavailable to PUBLIC, anon, authenticated and service_role. The service role can execute only the guarded Outreach gateway RPC, which calls the canonical implementation internally as its definer. Neither browser role can execute that gateway. There are no new anonymous private-schema privileges and no Events migration dependency. Existing staff RPCs retain independent organization/permission checks.

## Hosted network identity and privacy

Only `CF-Connecting-IP` is used on the verified Supabase hosted ingress. The acceptance investigation found it present as one address on normal requests on both Supabase function aliases. Caller-supplied values were rejected by Cloudflare error 1000 before any Supabase execution. X-Forwarded-For, True-Client-IP and X-Supabase-Client-IP are never trusted; some were directly caller-controlled. Missing, malformed or the documented shared cross-zone Worker address fails closed.

This is a contract for that ingress, not a portable arbitrary-proxy assumption. Revalidate on any ingress/provider/custom-domain change. Evidence: Cloudflare HTTP-header and error-1000 documentation, Supabase API-log documentation, plus acceptance ingress probes. Raw addresses are held only in function memory and never passed to the database or written into intake. IPv4 is canonicalized; IPv4-mapped IPv6 collapses to IPv4; native IPv6 groups by /64. A protected pepper derives HMAC-SHA-256 of the network identity. Built-in platform infrastructure may separately retain its normal access logs; this package does not configure those logs.

The private RLS-protected counter table contains dimension, 64-character fingerprint, window end and bounded attempt count. Email (lowercase/trim) and phone (digits) use dimension-separated SHA-256; those are private pseudonymous hashes, not encryption. No client table grants. Network fingerprints use HMAC; no raw IP is stored. No marketing consent, payment authorization or staff authority is inferred from a submission.

## Limits and concurrency

Central SQL candidate thresholds: network 120 attempts/hour; normalized email 5/hour; normalized phone 5/hour, approved by Chat. Acceptance keeps its already-applied 30/hour network policy until the new forward migration is separately applied. No organization-wide circuit breaker or global 100/hour cap remains.

Windows start on the first attempt and last one hour. Valid challenges are required before counters. Expected validation failures and quota rejections retain counts without creating intake. Over-limit networks stop before creating counters for rotating contact values. Exact accepted request-key/payload retries return success without recounting; changed payload/key combinations are rejected and counted. Fixed lock order and row UPSERTs enforce concurrency; the per-request advisory lock protects replay. Unexpected DB errors roll back and fail closed.

Expiry index and owner-only cleanup remove up to 1,000 rows per five-minute run where window end is more than 23 hours old (approximately 24 hours from window start). Active and recently expired windows survive. Rows awaiting a backlogged cleanup can live longer: monitor job success/backlog and size; this is not an absolute wall-clock deletion guarantee. The historical gateway migration only schedules if pg_cron already exists; use the guarded production procedure above, enabling it after that migration. An absent/nonworking cleanup schedule remains a release blocker.

## Acceptance credentials

Cloudflare documented dummy keys are allowed only when mode is `acceptance` and backend is exactly project bkbmjisprwmkptywtmih. Live Siteverify on 2026-10-04 returned hostname `example.com`, no action, and `metadata.result_with_testing_key=true`, differing from its documentation example. Only this exact metadata/hostname shape plus the exact dummy token and configured dummy secret is accepted as an isolated test exception. Other responses still require configured action/hostname. Real production credentials cannot use this exception. Dummy keys do not prove production bot discrimination or real token single-use; error-response branches are tested independently.

Protected Edge configuration: OUTREACH_NETWORK_PEPPER (random 32+ characters), OUTREACH_TURNSTILE_SECRET, OUTREACH_ALLOWED_ORIGINS, OUTREACH_TURNSTILE_HOSTNAMES, OUTREACH_TURNSTILE_ACTION, OUTREACH_MODE. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are existing platform variables; never copy them to the browser. Acceptance origins must be exact reviewed preview URLs. Production's expected origin is https://championlifefwb.com; add www only if verified necessary. No wildcard CORS.

Public build configuration: existing CHAMPION_PREVIEW_SUPABASE_URL and CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY for previews, constrained to the acceptance project. Missing/unsafe configuration disables backend access visibly, with no production fallback. Production requires OUTREACH_PUBLIC_SITE_KEY and real protected challenge credentials at a separately approved release.

## Staff and publishing scope

Scoped staff files provide intake review, explicit create/link Person, affiliation and follow-up creation. A minimal People/follow-up page provides permission-checked contact review and task status updates, not the full development staff platform. Writes use current permissions and revision checks; revocation clears sensitive rendered data. No staff grants are created by this package.

The static site publishes only `dist` generated from `tools/site-build/public-files.json`; repository root, docs, tests, SQL and private audit material are not published. Existing production public routes/assets are retained, including Christmas Dinner, Bessemer and giving. Source main Auth and protected Dream Track edge function remain unchanged. No new Events, Dream Team, Communications, video, grading or question-bank implementation is imported. Existing production features remain present.

## Legacy Netlify reconciliation

The old hidden Outreach form declaration and browser form POST are removed in the candidate. New intake has one authority: Supabase. Existing historical Netlify submissions must be retained; no history is deleted or silently imported. Read-only inventory found two site-wide submission_created email hooks, so new native intakes will not trigger those Netlify emails. Chat approved this transition with no replacement email/SMS requirement for this release. Other forms and notifications remain unchanged. No notification replacement is implemented here.

## Migration deployment and rollback

The repository carries the exact 18-migration production baseline plus the selected People/Staff, Outreach, gateway and approved rate-policy migrations. See `tools/backend-tests/migration-order.mjs` for authoritative replay order. Only missing migrations may be applied after verifying target history; never replay the baseline. Acceptance already has People/Staff, Outreach and gateway; only the new rate-policy migration remains there. Production lacks all four. No remote migration is applied in this hardening task. Do not apply Events to fix a permission gap.

Release order requires protected function configuration/deployment, missing schema migrations with gateway revocation completed, permission/cleanup verification, then the reviewed static artifact. Do not expose an interim direct-anonymous SQL path. Production operations require separate authorization.

Rollback before release: withdraw the candidate preview; leave production and original branches unchanged. Rollback after a separately authorized release: restore the prior reviewed static deployment, disable this gateway if necessary, retain intake/counter/audit data, and reconcile any reopened legacy Netlify collection explicitly. Do not restore the vulnerable anonymous RPC, undo unrelated database history, or delete accepted intake. A restored legacy form and native intake must never both be treated as authoritative for the same submission.

## Validation and remaining gates

Automated coverage includes isolated migration replay, no Events/anon-private dependency, People/staff permissions, canonical intake/workflow, quota/privacy/idempotency, gateway boundary, UI denial states, public form/modal behavior, safe publish artifact, Christmas regression and real disposable PostgreSQL concurrency. Hosted and browser results are recorded separately in the completion report. A passing local suite is not release approval.

Before production: complete only the current release gates listed above. Thresholds and notification transition are approved; hosted staff/login/People acceptance is complete. Do not repeat them. Do not merge development PR #2 or SowGo PR #1 as part of this candidate.
