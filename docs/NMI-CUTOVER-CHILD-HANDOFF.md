# NMI Giving execution follow-up — primary handoff

**Completed locally; actual provider acceptance NOT RUN; public cutover NO-GO.** This continues the accepted PR #34 foundation rather than restarting it. Primary authority remains **Align Codex with Champion Life** for architecture, canonical identity/permissions, migration order, shared platform reconciliation, release and payment authorization. Its separately authorized Shared Platform Gate 0 is not implemented or declared passed by this child.

## 1. Production base and immutable checkpoint

Production Git main reverified via GitHub remote = `e3157f0afa3f563ab6560ca64c9049448f02c806`, October 18 CDT / 19 UTC 2026. Frozen PR #34 integration head remains in ancestry: `3a8317fb265c0cabb894133ac169100aaea83622`. No history rewrite, branch merge or rebuild of accepted source inventory. Primary independently confirmed deployed source and all 25 live SQL/version/name MD5 rows; `NMI-CUTOVER-PRODUCTION-BASELINE.json` attributes that evidence. This child made no live Supabase query or write.

## 2. Exact accepted source commits and dependency order

| source | exact head | historical dependency (extracted, not merged) |
|---|---|---|
| #16 GIV-1 | `2eada4821e7b45a5f8221112a0982c36c33e9551` | `bce1926c6c91cfe3125c49506faf88ccaabc32eb` |
| #17 GIV-2A | `3803faf6f97116445614ba693cb841f21a7af519` | `2eada4821e7b45a5f8221112a0982c36c33e9551` |
| #18 GIV-2B | `13aecea202dc0378f25c1c8df6650b22a0329923` | `3803faf6f97116445614ba693cb841f21a7af519` |
| #19 GIV-2C | `edf82fb34e8db448a0d6c6465a3799c75993d5a2` | `13aecea202dc0378f25c1c8df6650b22a0329923` |
| #20 GIV-3A | `1410ebc824cdf0b9721c95db0cb41229b74a0274` | `edf82fb34e8db448a0d6c6465a3799c75993d5a2` |
| #21 GIV-3B | `1ea6971c2a0273b1a15c132d7793b12c2822901e` | `1410ebc824cdf0b9721c95db0cb41229b74a0274` |
| #23 GIV-3D | `ba1424b2faf9282c6b3cf5c5132e968576e1a2e6` | `1410ebc824cdf0b9721c95db0cb41229b74a0274` |

`NMI-CUTOVER-SOURCE-COMMITS.json` lists every accepted commit within each PR, not just heads. `NMI-CUTOVER-EXTRACTION.json` and `NMI-CUTOVER-MIGRATIONS.json` retain exact source blobs. GIV-3B and GIV-3D are siblings on GIV-3A, both retained; the observation bridge reconciles them. Historical prerequisite Outreach ancestry was not imported wholesale.

## 3. Migrations and engineering changes since frozen PR #34

The ten frozen forward files remain byte-identical. The proposed additions are:

| migration | exact source SHA-256 |
|---|---|
| `20261019010048_nmi_sandbox_execution.sql` | `17e4e3f3eddd8666304bfe793c72e9bbb69819e38093541a7eb80c0ec548717f` |
| `20261019010932_nmi_sandbox_recovery_reconciliation.sql` | `181d3e4463f38d00d09dbb057d22a2541195203a82eb573b805650274ab2c707` |

Exact **37-file** hosted staging order/hashes: `NMI-CUTOVER-ACCEPTANCE-MIGRATIONS.json` (25 confirmed production baseline + nine accepted Giving extractions + frozen bridge + two new execution files). Three baseline version aliases and one controlled final-newline normalization apply only in offline staging. Repository historical migrations are unchanged. No migration applied remotely. Both new version allocations are proposals subject to primary's combined release order/collision check.

The new private service layer reuses canonical sessions/legs/lines, immutable ledger, recurring instructions, receipts and Payment Operations. Forward canonical extensions: verified household on the existing donor account link; guest-session identity constraint for recurring; frozen recurring tax classification; `recurring_pause` operation kind. No new identity store, pooled recipient or parallel gift ledger.

| requested engineering blocker | implementation and local verification |
|---|---|
| Anonymous public execution | New `nmi-giving.html`; Turnstile, bounded/hashed checkout capability, canonical server-selected fund/form/routing, no forced donor login/Person creation; tokenized single-use provider handoff. |
| Authoritative results / gift posting | Sale/browser/webhook result alone cannot post. Independent Query evidence checks original order/reference, processor, currency and amount; one immutable gift per canonical line. Unknown/mismatch stays pending. |
| Active recurring / cancellation | Explicit consent, verified plan/default processor/timezone/future date, active sandbox creation + independent GET, private vault binding, pause/cancel + authoritative GET. Subscription creation is not a gift; charge event requests subscription-bound independent Query before ledger. Original tax classification retained. Actual next-date evidence is explicitly required, never guessed. |
| Operations executor | Same canonical guarded executor handles current approved maker/checker refund/void; existing held lookup jobs use the same lease/result. Retry/method/recurring retry never blindly charge. Current permission and approver revocation rechecked at handoff. |
| Receipts | Canonical immutable SANDBOX receipt plus exactly one private immutable held outbox item; donor sees safe receipt projection. No sends; primary Communications/legal sender and real delivery acceptance still required for public GO. |
| Transaction / settlement lookup | Fixed sandbox Classic Query transport with bounded XML/rows/pages; exact original identity and route. Batch gross matched to canonical legs; missing fees/net remain NULL; explicit statement evidence and arithmetic required for balanced reconciliation. No invented settlement endpoint. |
| Unknown recovery | Stable server order identity, original attempt linkage, no second financial mutation; authoritative transaction/refund/void/known subscription lookup resolves only supported facts. Missing/ambiguous evidence, unknown subscription ID and provider action ambiguity remain held for NMI/finance matching, never permission to retry. |
| Shutdown / GiveHub fallback | Current scoped finance shutdown disables new org charges and audits. Separate narrowly scoped recovery permits lookup/refund/void/pause/cancel after new-charge disable. Provider subscriptions must be explicitly confirmed stopped. Existing church/Outreach GiveHub host pages and links stay unchanged. |
| Donor/staff states | Success/declined/pending/partial/held receipt/recovery; explicit storage consent defaults unchecked, duplicate clicks blocked. Finance jobs, adjustment lookup, batches, reconciliation and shutdown inside same staff platform; current-session revocation clears protected content and stale responses cannot restore it. |
| Boundaries/defaults | Same organization/fund/destination/gateway/processor snapshot rechecked before charge handoff; explicit MID/settlement/merchant proof. Source pin null, origins empty, flags OFF, fixed sandbox host; no live/production path enabled. |

## 4. Edge/server components

New: `supabase/functions/nmi-giving/{index.ts,gateway.mjs}`, `nmi-giving-webhook/{index.ts,gateway.mjs}`; `_shared/payments/{acceptance-pin,nmi-query,nmi-executor,nmi-executor-batch}.mjs`; extended `_shared/payments/nmi.mjs`. Public RPC remains one service-only invoker wrapper `nmi_giving_service(p_action text,p_org uuid,p_payload jsonb)` backed by revoked private helpers/tables. Raw private grants remain denied, including service_role direct table access.

Frozen extracted functions remain `forms-submit`, `forms-file-access`, `payments-nmi`, `payments-nmi-webhook`, `payments-webhook`; old/generic provider paths stay held for this new target. Original production `outreach-partner-submit` and `outreach-registration-submit` remain byte-identical. No function deployment occurred.

## 5. Exact file inventory

`NMI-CUTOVER-CHANGED-FILES.json` enumerates paths/status/SHA-256 both **since frozen `3a8317f`** and **against production main**; its own checksum is in the offline bundle manifest. No production files deleted. All **449** protected runtime/content/config/function/migration files remain byte-identical.

New public hosts: `nmi-giving.html`, `staff-nmi-execution.html`; four new JS assets: `nmi-giving-{config,client}.js`, `nmi-public-giving.js`, `nmi-staff-execution.js`. Existing candidate `staff-payment-operations.html` gains a staff-only module execution link. Shared site-build config/manifest and candidate CI/tests are extended. Build allowlist is 468 files; private docs/SQL/tests never enter the static artifact.

## 6. Shared-file overlap / primary reconciliation

Frozen overlap evidence: `NMI-CUTOVER-SHARED-OVERLAP.json` was written before shared configuration/continuity changes. Ten overlap paths, nine differed: `assets/js/staff-workspace.js`, `assets/css/staff-workspace.css`, `tools/site-build/build.mjs`, `tools/site-build/public-files.json`, `tools/backend-tests/package.json`, four root continuity docs, and the identical unified command document. **This follow-up does not change the shell JS/CSS from frozen PR #34.** Primary must reconcile one shell and retain both module suites, exact-target build guards/CSP and asset union.

Semantic shared changes: existing donor link/Households, canonical recurring/ledger/receipt/Operations, Forms, current permissions, Edge gateway Auth, held transactional Communications and baseline/migration ordering. New tables/endpoints do not grant real staff permissions. Primary must assess candidate SQL together with Outreach and any Gate 0 changes; child-local PASS is insufficient.

`NMI-CUTOVER-COMPATIBILITY-DIAGNOSTIC.json` documents the **earlier fingerprinted** Outreach fixed registry snapshot that dropped 41 Giving keys and failed with synthetic existing grants. Subsequent sibling additive repairs are not judged by that old result. Primary owns present Gate 0 validation and final registry/constraint union. No primary/sibling file, integration register or working tree was edited by this child.

## 7. Secret / capability inventory (names only)

New path: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; `PAYMENTS_<GATEWAY_UUID_WITHOUT_HYPHENS_UPPERCASE>_SANDBOX_V<version>`; `PAYMENTS_<GATEWAY_UUID_WITHOUT_HYPHENS_UPPERCASE>_SANDBOX_WEBHOOK_V1`; `NMI_GIVING_TURNSTILE_SECRET`; `NMI_GIVING_NETWORK_PEPPER`. Controls: `NMI_GIVING_SANDBOX_ENABLED`, `NMI_GIVING_SANDBOX_RECOVERY_ENABLED`, `NMI_GIVING_SANDBOX_WEBHOOK_ENABLED`, `NMI_GIVING_ALLOWED_ORIGINS`. Public build key/config names and legacy Forms/NMI names are in the acceptance runbook; no secret values were read/configured.

Provider/finance proof still required for hosted tokenization, sale/decline/auth/capture, Customer Vault, active recurring/default processor/timezone/plan/next dates, cancellation, actual HMAC events/dedupe, Query access and response shape, refund/void authority and action identity, actual settlement/bank evidence, distinct account/MID/settlement ownership. Documentation/mocks do not prove any account entitlement. All merchant facts UNVERIFIED.

## 8. Routing worksheet

`NMI-CUTOVER-ROUTES.csv`: Champion Life Main, Youth, SowGo/Outreach, optional Events and Merch. Required org/fund/form, NMI account/gateway, processor, MID, private settlement reference, purpose/tax classification, recurring eligibility, refund and void authority, receipt identity, finance visibility, emergency control and signoff are explicit fields. **No real value supplied; every route disabled.** No inferred shared MID or pooled Propel funds.

## 9. GiveHub transition findings

`NMI-CUTOVER-GIVEHUB-CONTRACT.md` defines exact normalized manifests/fields/types/uniqueness/ownership/control totals and dry-run/reconciliation procedures for donors, households, historical gifts, funds, recurring schedules, next dates, profile portability and statements/tax history. `NMI-CUTOVER-GIVEHUB-INVENTORY.csv` records received=NO, counts=UNKNOWN. These are required import fields, not invented vendor export contents. No import, private customer access, message, profile transfer or recurring cancellation occurred; existing schedules/history remain at GiveHub.

## 10. Automated tests / races

See `NMI-CUTOVER-VALIDATION.md` and PR CI for complete final results. Standard suite includes **47 scripts**, full source migration replay, 34 new execution database assertions, real synthetic SQL + mocked HTTP orchestration, Query/hostile XML/recovery checks, donor UI double-click and staff revocation DOM tests, and exact baseline staging/protected-file checks. Native suite includes prior 41 eight-worker race cases plus **10 new execution/refund races** (51 total), and existing Outreach concurrency. Seven Deno entrypoints, 132 JS/MJS syntax checks, pinned component rebuild and public artifact/protection checks are separate. All data is synthetic and all provider HTTP/SDK callbacks are mocked; this is not browser/hosted/provider proof.

## 11. Dedicated target and actual acceptance still required

`NMI-CUTOVER-HOSTED-ACCEPTANCE.md` prepares exact baseline/order/hashes/functions/secret names/origin/pin changes/seed/cleanup/cost and supervised tokenization/sale/decline/vault/active recurring/cancel/webhook/refund/void/lookup/settlement/wrong-route/duplicate/recovery/shutdown procedure. Proposed **champion-life-nmi-giving-acceptance** remains uncreated/unselected. Source pin `project:null, origins:[]`; allowed origins now NONE. Do not use production, Huntsville, Outreach/shared acceptance or incompatible ancestry. Primary baseline metadata confirmation is complete; it does not authorize provisioning or release.

## 12. Branch / draft PR / exact artifact

Branch `codex/nmi-giving-friday-cutover`; draft https://github.com/eaglevisiondigital/championlife/pull/34. Frozen checkpoint `3a8317fb265c0cabb894133ac169100aaea83622` remains immutable in ancestry. Follow-up exact SHA is the PR head and offline bundle `MANIFEST.json.candidate`; final completion report supplies the full commit and artifact path without a self-referential commit hash inside its own source. No force push/merge.

## 13. Production changes / exact next human action

**Production changes NONE.** No hosted writes/target creation, production deployment/function/migration, real permission grant, live credential, money movement, public GiveHub link change, GiveHub recurring change, Authorize.Net/Text-to-Give activation or unrelated redesign.

**Next human action:** primary reviews this exact follow-up diff/order and reconciles Shared Platform Gate 0; finance/NMI owner completes the UNVERIFIED route/capability worksheet and privately approves a clean dedicated target, exact preview and sandbox secret custody. Then separately authorize the source-pin/provisioning follow-up and supervised matrix. Legal receipt sender/delivery and actual provider/bank/recurring proof must pass before separately controlled public GO.
