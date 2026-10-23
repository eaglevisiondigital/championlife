# Huntsville registration hotfix — release gate

Status: locally validated; production execution requires separate owner approval.
Follow-up base: `eb6a1bef1d819ba5a637a59866c4cf08005ebba5` (PR #39 original hotfix, concurrently released during review). Original incident baseline: `2d0b6b4fc84322f216329db498840c272b392461`.

PR #39 merged at the original `86dc56b8dcad7526396e74aec68da9dcfc21f709`, without this follow-up. The deployed form hash was independently verified. This candidate contains only the additional contact-format validation, safe rejection/retry handling, tests and documentation; it must not be described as already deployed.
Campaign: `338d0b6c-596e-43ea-9878-5b9baeb8aa24`, public slug `huntsville-2026`.

## Proven defects and scope

- The initial/Add adult row used `min=18`, blocking a child placed in that row before the API call. Huntsville now uses the server's 0–120 bounds on all rows; 0–17 are children, 18+ are adults. Primary contact labels remain explicitly adult.
- A valid child household could reach the API with the default Self signer. SQL correctly rejects it with `Minor requires parent or legal guardian`. The UI now explains the required signer relationship before submission and focuses that control.
- Self signing for multiple adults or a different named attendee is also rejected before the API, matching the unchanged server contract. Authorized adult-only households still work.
- One optional Prize Preference maps Bicycle/Tablet to the existing interest flags. Blank means no prize participation. Catalog, age eligibility, present-to-win, allocation and check-in rules are unchanged.
- Optional messaging controls are removed for Huntsville and their payload values explicitly false. Liability waiver, coverage, guardian authority, signature, media release and initials remain required as configured.
- Final simplification review adds safe, field-focused checks for the existing SQL name, email, phone, address, guardian-text and signing constraints. No new registration, prize or consent requirement is added. Phone formatting accepts the existing supported punctuation and explains unsupported extensions before any request.
- Huntsville submission errors use controlled frontend text: 400 asks for a fresh security check and review of the required household/legal fields without claiming which server check failed; 429 explains waiting; interrupted/5xx/malformed responses preserve exact-payload retry. Raw server/network details are not displayed. Confirmation requires accepted=true, a valid reference and the expected attendee count.

The individual reported failures are not conclusively correlated. Production returns generic HTTP 400 for multiple causes. No private participant payload or challenge token was collected. No backend/Turnstile defect is asserted solely from those responses.

## Narrow incident trace (read-only, private evidence retained)

The 2026-10-22 22:15:43 CDT function POST 400 is correlated to its database gateway RPC using the normalized Edge request ID and database trace ID. That RPC returned HTTP 200, so the function had passed Siteverify and reached SQL. In the byte-verified deployed handler, a database `reason=rate` would produce 429 and database HTTP/transport failure would produce 503; this 400 is consistent with the gateway's caught validation rejection. SQL intentionally collapses all caught exceptions to `accepted=false, reason=invalid` without logging the precise constraint or failed payload. The exact constraint for that person's failed request cannot be recovered from the preserved logs.

At 22:16:19 CDT, the function POST 200 correlates to a second database RPC and a persisted `submitted` registration at 22:16:19.856 with one adult, no children and one waiver signature. The deployed code's sole 200 branch requires `accepted=true`, a valid reference and integer attendee count. The original response body was not logged, so this is code/trace/persistence corroboration, not a captured response body or proof of that owner's three-person household success. No raw participant data, tokens or request bodies were retrieved.

## Changed deployed asset

Only `assets/js/outreach-registration-form.js` and `assets/js/outreach-registration-public.js` change in the 401-file production build. HTML, CSS, public config, Edge Functions, SQL/migrations, reporting, CSV, check-in and Theme Song assets remain byte-identical to the base. Other campaigns retain their existing error handling and form controls. Tests and continuity/release documents are not public build artifacts.

## Validation

- Complete repository suite, including 109 DOM-to-HTTP-handler-to-database hotfix checks and 91 guest/staff DOM checks.
- Native PostgreSQL: 109 revised hotfix checks; prior 56 existing Huntsville registration/reporting/check-in checks retained and unaffected. Disposable databases removed; shared local roles and existing databases unchanged.
- Baseline native reproduction confirms the two original rejection paths without partial records.
- Ages 0/5/12/17/18/40, no preference/Bicycle/Tablet, mixed family and two adults; counts, immutable waiver coverage, duplicate idempotency and confirmation.
- Guest handler: missing/expired/error challenge, network interruption, timeout, retry with exact keys, changed-payload refusal after ambiguous delivery, no false confirmation and submit-button recovery.
- Gateway: expired/replayed/invalid Siteverify response rejected before database; exact origin/action/hostname rules, generic error privacy and production test-key rejection unchanged. Siteverify responses are local fixtures, not a new live Cloudflare challenge.
- Real browser at 390px and 1440px against disposable PostgreSQL: parent plus newborn submission, visible guardian error, correct reference and attendee summary, no overflow/errors, Google Calendar destination and actual Apple Calendar download. The local browser challenge is explicitly synthetic.
- Hosted checks are read-only: live SowGo redirect, existing form bytes, exact-origin OPTIONS, deployed Edge source and production database counts/security. They do not prove the corrected form is already live.
- Final real-browser rehearsal confirms the focused phone error, successful parent plus two children with every prize preference blank, reference/counts and Google/Apple Calendar at desktop and 390px. It uses local synthetic challenge fixtures, not live Siteverify.

## Required-field review

The live campaign has no extra mapped questions and no prize catalog requirement. Required contact/address and emergency telephone, individual attendee identity/age, guardian relationship for minors, explicit coverage, adult signing authority, approved waiver acknowledgment and attributable signature remain. The current published legal version explicitly requires a separate media release and initials; these are preserved, not treated as optional marketing consent. Removing an approved legal requirement would need a separate legal/configuration decision and is outside this website-only repair. Optional messaging is false, optional address line 2 and all prize preferences may be blank.

## Exact release sequence after approval

1. Pin the reviewed hotfix head and passing exact-head CI. Verify main and Netlify published deployment still correspond to the reviewed base; reconcile and stop on drift. Preserve rollback deployment `6adad76db87e9aeee8b04d93` and base commit.
2. Reverify public redirect resolves to `https://championlifefwb.com/outreach-register.html?campaign=huntsville-2026`. Record fresh, read-only campaign status/settings, all existing registration/attendee/signature row fingerprints, migration/RLS/ACL/function definitions and reporting access. Keep evidence private. Concurrent legitimate additions are allowed; existing-row changes are not attributable to this website release.
3. Confirm the deployment diff contains only the two reviewed registration JavaScript assets. No database, configuration, function, grant, secret or route change is permitted.
4. Remove the hotfix PR's Netlify skip safeguard only under release approval, then merge only this PR with a production-triggering merge message through the existing Champion Life Netlify workflow. Do not merge #34/#35 or trigger another site.
5. Wait for the exact merge-commit deployment to become ready/published. Compare both live registration asset hashes, verify the actual SowGo redirect, HTML/header integrity and desktop/mobile rendering. Inspect age bounds, prize selector and missing optional consents without submitting a real registration.
6. Verify live gateway CORS and public configuration read-only; preserve existing campaign intake, guardian/waiver rules and reporting. Recheck prior row fingerprints, RLS and migrations. Use status-only telemetry to observe recovery; do not equate a generic HTTP 400 with a specific cause or expose records.
7. A genuine human registration/Turnstile submission is not included in automated release verification. Owner/staff can confirm a legitimately intended registration; otherwise report production end-to-end recovery as unconfirmed even when the asset is live.

## Stop and rollback

Stop on source/head drift, unexpected artifact changes, configuration/permission changes, loss of required legal fields, wrong destination, missing assets, newly observed API errors or record-integrity discrepancy. Do not improvise a backend repair.

For a website regression after publication, republish the preserved production Netlify deployment `6adad76db87e9aeee8b04d93` using the existing deployment rollback workflow, if included in the owner's release approval. Verify its form asset and public routes. No database rollback or record rewrite is needed or authorized. This restores the prior website and also removes the new contact-validation and error-message improvements; report the incident as unresolved, not recovered.

## Owner authorization requested

Approve only the reviewed Huntsville form hotfix head, removal of its deployment skip, merge of its isolated PR, one existing Champion Life production Netlify deployment, read-only post-release verification, and website-only rollback to the preserved deployment if verification fails. No SQL/migration, Edge Function deployment, secret, role/grant, record mutation, live synthetic submission, NMI, GiveHub, Gate 1C, #34/#35 or other campaign change is requested.
