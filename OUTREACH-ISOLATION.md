# Outreach Partner isolated release candidate

Preparation and acceptance only. No production release or authorization to merge. Based on production commit 306d6b62124f51547b9a02171858400b31b9c6cc; selectively reuses approved source 3f2316d4e575a538d7fb5866dc9c0390f66cc471. Does not merge the development branch.

## Submission boundary

The public form calls only `outreach-partner-submit`, an unauthenticated HTTP Edge Function with custom Turnstile verification. It permits POST/OPTIONS, explicit configured HTTPS origins, JSON, at most 16 KiB, a five-second body read, a four-second Siteverify request and an eight-second database request. No submission data, credentials or raw request errors are logged by the implementation. Origin is defense in depth, not identity proof.

Honeypot requests receive an accepted-looking response after the bounded transport checks and before challenge/network/database work. All other submissions require Siteverify. Real keys require success, exact `outreach_partner` action and an explicitly allowed hostname. The browser contains only a public site key.

The old public submit RPC is removed. The private canonical implementation is unavailable to PUBLIC, anon, authenticated and service_role. The service role can execute only the guarded Outreach gateway RPC, which calls the canonical implementation internally as its definer. Neither browser role can execute that gateway. There are no new anonymous private-schema privileges and no Events migration dependency. Existing staff RPCs retain independent organization/permission checks.

## Hosted network identity and privacy

Only `CF-Connecting-IP` is used on the verified Supabase hosted ingress. The acceptance investigation found it present as one address on normal requests on both Supabase function aliases. Caller-supplied values were rejected by Cloudflare error 1000 before any Supabase execution. X-Forwarded-For, True-Client-IP and X-Supabase-Client-IP are never trusted; some were directly caller-controlled. Missing, malformed or the documented shared cross-zone Worker address fails closed.

This is a contract for that ingress, not a portable arbitrary-proxy assumption. Revalidate on any ingress/provider/custom-domain change. Evidence: Cloudflare HTTP-header and error-1000 documentation, Supabase API-log documentation, plus acceptance ingress probes. Raw addresses are held only in function memory and never passed to the database or written into intake. IPv4 is canonicalized; IPv4-mapped IPv6 collapses to IPv4; native IPv6 groups by /64. A protected pepper derives HMAC-SHA-256 of the network identity. Built-in platform infrastructure may separately retain its normal access logs; this package does not configure those logs.

The private RLS-protected counter table contains dimension, 64-character fingerprint, window end and bounded attempt count. Email (lowercase/trim) and phone (digits) use dimension-separated SHA-256; those are private pseudonymous hashes, not encryption. No client table grants. Network fingerprints use HMAC; no raw IP is stored. No marketing consent, payment authorization or staff authority is inferred from a submission.

## Limits and concurrency

Central SQL acceptance thresholds: network 30 attempts/hour; normalized email 5/hour; normalized phone 5/hour. These are proposed initial production values requiring operational review, especially shared church networks. No organization-wide circuit breaker or global 100/hour cap remains.

Windows start on the first attempt and last one hour. Valid challenges are required before counters. Expected validation failures and quota rejections retain counts without creating intake. Over-limit networks stop before creating counters for rotating contact values. Exact accepted request-key/payload retries return success without recounting; changed payload/key combinations are rejected and counted. Fixed lock order and row UPSERTs enforce concurrency; the per-request advisory lock protects replay. Unexpected DB errors roll back and fail closed.

Expiry index and owner-only cleanup remove up to 1,000 rows per five-minute run when they are approximately 24 hours old. Rows awaiting a backlogged cleanup can live longer: monitor job success/backlog and size; this is not an absolute wall-clock deletion guarantee. The migration uses pg_cron only if already installed and does not install it. An absent/nonworking cleanup schedule is a release blocker.

## Acceptance credentials

Cloudflare documented dummy keys are allowed only when mode is `acceptance` and backend is exactly project bkbmjisprwmkptywtmih. Live Siteverify on 2026-10-04 returned hostname `example.com`, no action, and `metadata.result_with_testing_key=true`, differing from its documentation example. Only this exact metadata/hostname shape plus the exact dummy token and configured dummy secret is accepted as an isolated test exception. Other responses still require configured action/hostname. Real production credentials cannot use this exception. Dummy keys do not prove production bot discrimination or real token single-use; error-response branches are tested independently.

Protected Edge configuration: OUTREACH_NETWORK_PEPPER (random 32+ characters), OUTREACH_TURNSTILE_SECRET, OUTREACH_ALLOWED_ORIGINS, OUTREACH_TURNSTILE_HOSTNAMES, OUTREACH_TURNSTILE_ACTION, OUTREACH_MODE. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are existing platform variables; never copy them to the browser. Acceptance origins must be exact reviewed preview URLs. Production's expected origin is https://championlifefwb.com; add www only if verified necessary. No wildcard CORS.

Public build configuration: existing CHAMPION_PREVIEW_SUPABASE_URL and CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY for previews, constrained to the acceptance project. Missing/unsafe configuration disables backend access visibly, with no production fallback. Production requires OUTREACH_PUBLIC_SITE_KEY and real protected challenge credentials at a separately approved release.

## Staff and publishing scope

Scoped staff files provide intake review, explicit create/link Person, affiliation and follow-up creation. A minimal People/follow-up page provides permission-checked contact review and task status updates, not the full development staff platform. Writes use current permissions and revision checks; revocation clears sensitive rendered data. No staff grants are created by this package.

The static site publishes only `dist` generated from `tools/site-build/public-files.json`; repository root, docs, tests, SQL and private audit material are not published. Existing production public routes/assets are retained, including Christmas Dinner, Bessemer and giving. Source main Auth and protected Dream Track edge function remain unchanged. No new Events, Dream Team, Communications, video, grading or question-bank implementation is imported. Existing production features remain present.

## Legacy Netlify reconciliation

The old hidden Outreach form declaration and browser form POST are removed in the candidate. New intake has one authority: Supabase. Existing historical Netlify submissions must be retained; no history is deleted or silently imported. Read-only inventory found two site-wide submission_created email hooks, so new native intakes will not trigger those Netlify emails. Notification expectations/ownership must be explicitly resolved before release. Other forms and notifications remain unchanged. No notification replacement is implemented here.

## Migration deployment and rollback

The repository carries the exact production baseline plus the selected People/Staff and Outreach migrations and one gateway patch. See the migration manifest for SHA-256 hashes and authoritative replay order. Only missing migrations may be applied to a target after verifying history; never replay the baseline. Acceptance already has People/Staff and Outreach, so only the new gateway patch is applicable there. Do not apply Events to fix a permission gap.

Release order requires protected function configuration/deployment, missing schema migrations with gateway revocation completed, permission/cleanup verification, then the reviewed static artifact. Do not expose an interim direct-anonymous SQL path. Production operations require separate authorization.

Rollback before release: withdraw the candidate preview; leave production and original branches unchanged. Rollback after a separately authorized release: restore the prior reviewed static deployment, disable this gateway if necessary, retain intake/counter/audit data, and reconcile any reopened legacy Netlify collection explicitly. Do not restore the vulnerable anonymous RPC, undo unrelated database history, or delete accepted intake. A restored legacy form and native intake must never both be treated as authoritative for the same submission.

## Validation and remaining gates

Automated coverage includes isolated migration replay, no Events/anon-private dependency, People/staff permissions, canonical intake/workflow, quota/privacy/idempotency, gateway boundary, UI denial states, public form/modal behavior, safe publish artifact, Christmas regression and real disposable PostgreSQL concurrency. Hosted and browser results are recorded separately in the completion report. A passing local suite is not release approval.

Before production: review exact candidate and migration delta; approve thresholds and notification transition; provision real Turnstile keys and exact host/origin configuration; verify trusted ingress and cleanup scheduler on the release target; finish hosted staff/browser acceptance; obtain explicit release approval. Do not merge development PR #2 or SowGo PR #1 as part of this candidate.
