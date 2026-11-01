# Lane A — bounded synthetic browser acceptance, November 1, 2026

Base: PR #72 `09c2d0cfc5f72ca917791fccc64ab95337ade241`.
Scope: existing browser harness and this evidence index only. No staff runtime,
public allowlist, SQL, SDK, authentication implementation or production change.

## New evidence

The existing harness already exercised tablet 768px, Refresh keyboard operation,
logo presence and exact outbound `context → list → context` calls. Those checks
were preserved; this package adds:

- In-page A → B → A selection through the actual summary renderer, with A's list
  held until B renders. Different checked-in values distinguish the responses.
  A rejects as stale; B remains visible; returning to A freshly authorizes.
- Held list responses during account change, token replacement and explicit
  server denial. Synchronous clear precedes response release. Retained Refresh
  handles and detached button handlers issue **zero new RPCs** after invalidation.
- Revocation between list and the final authorization context blocks rendering.
- Mobile/tablet keyboard drawer opening and Escape focus restoration; official
  Propel logo geometry inside the sidebar, native aspect ratio and no horizontal
  document overflow; browser log exclusion of fictional sensitive rows/tokens.
- Optional actual screenshots of authorized sidebar, closed-drawer summary and
  denied workspace at all six browser/viewport configurations.

Final result: **254 assertions PASS, zero final failures**, Chrome and WebKit,
390, 768 and 1440 CSS-pixel widths. This preserves 168 existing assertions and
adds 86. Playwright 1.62.1 uses the unchanged locked backend-tests dependencies.

All HTTP is intercepted. The existing actual staff HTML, CSS, JS and summary
modules execute in real browsers; Auth and RPC results are fictional. This does
not prove genuine Supabase identity, JWT retirement, OTP delivery or physical
mobile-device behavior. The in-page selection scenario tests the renderer API;
it does not pretend the current shell uses same-document campaign navigation.

## Run

```sh
LANE_A_EVIDENCE_DIR=/absolute/private/evidence-directory \
  node tools/outreach/church-outreach-summary-staff.browser.mjs
```

The evidence directory is optional. Keep generated private screenshots/logs out
of the published website. No new package install or dependency update required.

A first browser launch failed in the local execution sandbox before any test.
A development harness attempt then tried to inspect a page after the shell's
correct account-change login redirect. The harness now captures synchronous
invalidation and queued promise completion in one evaluation before that
zero-delay redirect; runtime source was not changed. Both attempt logs remain
in the private coordinator evidence.

## Gates retained

No hosted resource, production change, real staff grant, outbound message,
GitHub publication or CI run occurred in this package. Existing PR #61 is frozen.
Next: independent test/source review; coordinator may later authorize publishing
this test-only change to the existing draft #72. Actual provider authentication,
independent cleanup rehearsal and separately reviewed exact-project preview
remain required before hosted acceptance. Recorded operator/mailbox/billing
approvals are not reopened. No Aldo or Pastor Robert activation.
