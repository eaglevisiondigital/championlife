# Minden protected source candidate — November 18, 2026

## COMPLETED

Source-only successor to PR #149, based on released Champion Life `c7e67f7d7fda2a834e423fc02bde755f3563837b`. The original PR #149 installers are excluded. No historical branch tree was merged. The sole event is `d26b8337-d215-42d3-ac3b-c771f7f07db7` (`minden_la_2026`, `minden-2026`, SowGo). Attendees, decisions, volunteers, consent, permissions and totals remain distinct.

The package contains protected EN/ES decision intake, assigned-only staff assignment/follow-up, receipt-based King Kind entitlement, reader session hardening, existing online discipleship links, and an inert Family Fun Day holding page. It creates no event, policy approval, source mapping, runtime activation, Auth user, staff grant, CRM Person link, notice intent or message.

## CHANGED

- `minden-decision-foundation-v2.sql` extends the current capability constraint while retaining every registration/Team/Travel key and prerequisite. `decisions.read`, `followup.manage`, and independent `decisions.assign` require finite, assigned-only campaign authority. Owner, registration, People and travel authority are not substitutes.
- `minden-decision-intake-v2.sql` allows service-only transactional writes after the new Turnstile gateway. It does not add Minden to anonymous `outreach_registrations` INSERT RLS. Exact consent version, separate resource/follow-up choices, adult self-attestation or explicitly permitted guardian authority, and receipt binding are validated server-side. No minor Auth account is created.
- Stable UUID plus a random 256-bit receipt secret serialize retries. Receipt binding is immutable, proof-spend digest is unique, and rejection rolls back registration/follow-up/audit together. Same-key changed payload conflicts. Email is not a deduplication/identity key: intentional separate decisions are not silently merged.
- Browser session storage retains only receipt ID, secret and state, never names, email, phone or prayer text. It freezes the in-memory payload before the first request. A lost response remains UNKNOWN and can be checked with the same receipt. Reload checks status only; it cannot invent a replacement submission. If the payload was lost and status remains UNKNOWN, stop and reconcile rather than resubmit. A complete recognized PostgREST transaction error may be reported as REJECTED; network ambiguity never is.
- The public no-argument configuration facade uses the existing registration-config SECURITY DEFINER pattern with an empty search path. It returns only approved public consent copy. It avoids granting anonymous USAGE on the private schema. Mutating intake remains service-only; the staff facade remains SECURITY INVOKER.
- Staff lists/details reveal only currently assigned names, decision, dates and follow-up state. They expose no email, phone, prayer, Person ID or learner record. The independent assignment queue exposes only unassigned IDs/timestamps. CAS, immutable request receipts, finite assignee bounds and current Auth/session/canonical staff-link checks apply. Follow-up updates require current, unwithdrawn consent; no contact sending is enabled.
- Minden book rights require a protected accepted receipt, verified current Auth session, exact current approved consent version, unexpired policy, active mapping and independent reader flag. Rotation/expiry or withdrawal denies new Minden access. Activation approval must define this duration; no perpetual entitlement is assumed. Existing Bessemer/Huntsville rights are preserved exactly. Legacy raw Minden rows grant no book rights.
- Only the reviewed reader lifecycle from the prior `5c84a42` source is recovered: no broader general-resource SQL is imported. Fresh Auth and Storage checks precede cached downloads; account/token/storage changes, expiry, hidden/history pages and focus trigger clearing/revalidation. Late loads/render work cannot paint an old account. Exact private object, approved SHA256, 83 pages and personal-use license remain enforced. Signed URLs must use the configured backend, exact path and no credentials/fragment; redirects are rejected. Sign-in returns remain on the current origin, including Spanish reader mode.

## TESTED

See the private engineering report and CI for exact run IDs and results. `npm test --prefix tools/backend-tests` includes existing P0/P1/notice/Auth/DreamTrack regression plus `test:minden`. `test:minden:native` runs actual PostgreSQL assigned-scope races, consent waits, duplicate/proof races and complete forward-body/recovery tests. Browser/DOM providers and local policy approvals are labelled synthetic. They are not genuine hosted Auth/RLS/CAPTCHA acceptance.

`tools/minden/package.mjs` deterministically seals component hashes in `MINDEN-SOURCE-PACKAGE.json` and assembles one forward transaction. The production read-only preflight matches 119 application functions including owners/ACLs, 64 policies including PERMISSIVE/RESTRICTIVE, 85 table security/shape contracts including Auth session dependencies/Storage, and all 37 migration statement hashes. Production history is checked, never rewritten. Future unrelated drift requires re-review, not a relaxed guard.

## SECURITY

Every new table has RLS and no browser raw-table grants. Policies and receipt binding are immutable; permission withdrawals are monotonic with immutable actor evidence. All new function EXECUTE grants are explicit, security-definer search paths empty, and no metadata claim grants authority. Source/runtime/provider configuration each default closed. The new Edge Function has no email, SMS or outbox capability and cannot activate P0 or P1 notifications.

Turnstile requires exact origin, hostname/action, current vendor timestamp, bounded body/token and strict JSON parsing. Production binding is fixed; an acceptance binding must name a different canonical project and exact approved origin. Dummy keys and production fallback from previews are denied. Network rate identity is HMAC-only; raw IP is not sent to the database.

Residual limits: a previously issued signed URL can remain usable until its provider expiry; an already downloaded PDF cannot be recalled. In-flight requests may complete before a stop obtains its locks. No source code can guarantee instant recall of already released content. Genuine provider ingress, Turnstile, email callback/session behavior and Storage revocation need isolated hosted acceptance.

## DOCUMENTATION

`MINDEN-SOURCE-PACKAGE.json` identifies the exact artifacts. `MINDEN-EXPECTED-PRODUCTION-CATALOG.json` contains only nonsecret catalog fingerprints. `MINDEN-ACCEPTANCE-PLAN-V2.md` records gates and the separate billing/activation requirements. No private audit, SQL, tools or PDF bytes enter the explicit 443-file publication allowlist; its original 435 entries retain their order. Only the reader JS/HTML change among those 435.

## UNRESOLVED

**PUBLIC RELEASE NO-GO.** Family attendee intake has no settings, waiver, anonymous route or enabled form installed by this package. Host legal identity and authority, park consent, Louisiana waiver/guardian/media/privacy rules, decision consent/age/guardian/retention copy in both languages, book/follow-up duration, and 100-bike eligibility/sizing/allocation/check-in/presence/claim procedures need exact approval. No Huntsville waiver is reused.

There are no decision staff grants. Existing owner-only P1 authority remains unchanged. Named recipients, verified identities, exact decision duties and finite scopes require explicit approval before any grant. Status notifications remain disabled and unapproved.

## NEXT RECOMMENDED BUILD

After policy input and fresh cost consent, create one empty isolated acceptance project, replay only the reviewed 27 persistent baseline migrations plus the exact current approved forward components, and apply the single protected candidate. Copy no production customers or grants. Configure an exact isolated origin, real Turnstile binding and owner-entered SMTP only after approval. Complete the genuine journeys and stop/recovery matrix before proposing an exact production release package. Never replay retired temporary installers.

## CHAT HANDOFF

No merge, deployment, production SQL/Auth/SMTP change, staff grant, message or paid resource is authorized by this source package. Preserve PR #149 and SOWGO #7 as draft/unmerged; use the current-main successor candidate for source review. SOWGO's existing Huntsville QR routing remains live until Champion Life destinations and backend genuinely pass and exact cutover approval is supplied.

Future ordered release: fresh catalog/CI/security/genuine hosted acceptance → exact owner source+SQL+activation approval → Champion Life backend/pages validation → separate SOWGO active `sowgosite` cutover and physical printed QR/302 validation. `/registration`, `/register` and slash variants must then point to `https://championlifefwb.com/minden/register/`; `/go` and slash variant to `https://championlifefwb.com/minden/`; campaign aliases match. Do not deploy the unused `sowgo` site.

Recovery is a forward change: stop only the new decision runtime/source map via owner-only `private.minden_decision_stop(reference)`, retain receipt status, audit, history and all other modules. Restore requires the exact stop ID and unmodified stopped state; it cannot invent activation. Frontend recovery uses a reviewed new revert commit based on current production, never an old historical Netlify deploy. After a future Minden cutover, a stop must show an honest Minden holding page, not silently send Minden families into Huntsville.
