# Execution follow-up validation — October 18 CDT / 19 UTC 2026

Frozen foundation: `3a8317fb265c0cabb894133ac169100aaea83622`; current production Git main `e3157f0afa3f563ab6560ca64c9049448f02c806`. This follow-up is local synthetic engineering validation only. Actual hosted/browser/NMI provider acceptance **NOT RUN**. Public cutover **NO-GO** pending primary Gate 0, provider/finance proof, legal sender/delivery and separate release authorization.

| check | result |
|---|---|
| `npm test --prefix tools/backend-tests` | **PASS, 47 scripts**; complete migration replay, existing production/Huntsville/Bessemer/Outreach/Giving/Forms/provider/Operations security and DOM regressions retained. |
| New execution DB suite | **PASS, 34 checks**; anonymous canonical checkout, authoritative posting/immutable held receipt, idempotency, unknown/no-post, wrong scope/amount, recurring/vault/renewal tax snapshot, approval/revocation, refunds/voids, batches, bank arithmetic, Operations job leases/no blind retry, linked donor/household revocation and shutdown recovery. |
| HTTP orchestration + real synthetic SQL | **PASS**; mock sandbox sale/query/decline, response lost after provider handoff, original-order lookup with new charges OFF, one gift/held receipt, real HMAC synthetic event replay/tamper, no token/key persistence. All HTTP substituted, zero provider traffic. |
| Query/recovery security | **PASS**; exact cents/order/processor/currency, bounded hostile XML/DTD/entity rejection, scoped batch/unknown fee projection, active subscription/cancel GET; read-only refund/void/subscription/pause/cancel recovery with zero repeat mutations. |
| New donor/staff DOM | **PASS**; disabled fallback, no card-owned fields/storage, production guard, synthetic hosted callback, unchecked storage consent, double click, success/held receipt/pending recovery; Operations/reconciliation controls, same-session revocation and stale-response clearing. JSDOM/mocks, not actual hosted browser acceptance. |
| Native PostgreSQL races | **PASS, 51** eight-worker races: Giving/management/reports 11; Forms 6; provider 6; Operations 6; original NMI + observation bridge 6; new execution/refund 10; Huntsville 6. Separate coordinator, committed barrier, eight distinct backends, observed lock wait and overlapping server intervals for new/financial race cases. |
| Existing Outreach concurrency | **PASS**; 95 accepted + 40 changing-email/phone requests give exactly 120 accepted/15 rejected; 20 identical retries give one intake; independent normalized email/phone caps pass. |
| Native registration security/count/export | **PASS**; 95 Phase C and 56 Huntsville assertions, including Bessemer preservation, no inferred identity/consent, current-session revocation and CSV totals/security. |
| Offline staging | **PASS**; exact 25 primary-confirmed live SQL/version hashes, three aliases, one controlled final newline; 12 forward versions; all 37 committed source/staged hashes verified; wrong base/hash/inventory/order denied. |
| Production/source preservation | **PASS, all 449 protected blobs**; all nine accepted extracted SQL blobs unchanged; all 25 repository production migrations and both production functions unchanged. |
| Public artifact/isolation | **PASS, 468 allowlisted files**; no docs/SQL/tests/private evidence exposed. New source pin null/origins empty; preview backend BLOCKED without reviewed configuration; production Giving config null. |
| Type/syntax/component | **PASS**, seven Deno Edge entrypoints; 132 JS/MJS files parse; pinned official NMI SDK rebuild produces no bundle diff. |
| `git diff --check` | **PASS** after LF normalization of candidate CSV worksheets. |

Exact native commands (each exit 0): `test:giving-concurrency`, `test:forms-concurrency`, `test:payments-concurrency`, `test:payment-operations-concurrency`, `test:nmi-concurrency`, `test:nmi-execution-concurrency`, `test:huntsville-native`, `test:concurrency`, all through `npm run ... --prefix tools/backend-tests` with local PostgreSQL 17. The new CI workflow retains every command and adds the new execution races/two Deno entrypoints.

Raw local evidence: `/private/tmp/nmi-package-full-tests.log`; `/private/tmp/nmi-final-native-results.json` and `/private/tmp/nmi-final-native-{0..7}.log`; `/private/tmp/nmi-package-deno.log`. These use synthetic data only. Native macOS initdb required sandbox escalation for local shared memory; no hosted connection was used. Early fixture/guard regression failures were corrected before the final complete PASS; no check was removed or security assertion weakened.

The original overlap/permission diagnostic remains scoped to its fingerprinted earlier Outreach snapshot. Later sibling repairs and the separately authorized primary Gate 0 require their own combined validation; these child results do not declare shared integration safe. Final PR CI status and exact follow-up commit are attached to PR #34; offline `MANIFEST.json.candidate` pins the artifact. A successful default-disabled deploy preview is not provider acceptance.

No production migration/function/configuration/data write, target creation, live credential/payment, real donor message, GiveHub link change or recurring modification occurred.
