# Financial review return navigation

Source-only successor to Staff123 bdecc592d1a0544330934ef2fc5a254a9b54d3d3.
Existing financial-only staff could enter home and Financial Outreach Review but
its home return incorrectly required people.read. The denial panel also sent its
Staff Home link to People, which independently denied that same user.

Home return now uses existing same-organization outreach.view AND finance.read;
People return also requires people.read. The existing fresh-context RPC, current
session/organization/generation and permanently retired control checks remain.
Denial recovery opens scope-neutral staff-home.html for fresh authorization.
There is no record, person or intake identifier in either home-return URL.

The permanent actual-page Chromium/WebKit suite uses accepted SDK2.118.0 and
fictional intercepted transport at390/1440. It covers full list/detail roundtrips,
People-independent authority, split organizations, department scope, revocation,
silent account replacement/logout, late responses and removed/reinserted controls.
REVIEW_BASE=bdecc592d1a0544330934ef2fc5a254a9b54d3d3 reproduces the original
failure at the first home-return assertion. Historical tests/assertions/workflows
remain exact through current-first source verification and frozen projections.
Only the Partner runtime changes among430 public outputs. Current build scripts
verify the actual candidate; historical evidence stays separate.

Staff123 required CI remains INCOMPLETE:21PASS/1runner shutdown, cause UNKNOWN.
No rerun, weakened assertion, timeout change, hosted Auth/RLS acceptance, SQL,
permission, identity link, messaging, payment, deployment or release approval.

## Staff check-in composition — 2026-11-08

Staff126 `95723fae9d4cbc16eb80e350191495b4d37d4498` retains its host, session, SDK, People, permissions, navigation and branding. The sole runtime delta is the byte-identical reviewed registration control-retirement correction from Registration134 `0c246a96ccd9e280dd423eb91c623559b7fdb064`; its parent runtime equals Staff126. No SQL, public HTML, deployment configuration or other runtime changes.

The existing exact derivation chain retains every historical assertion. Six build readers additionally require the exact reviewed registration bytes. The native journey and status tests are copied byte-identically from PR134, not historical runtime or workflow merges. The mounted-host test loads actual current source and pinned SDK, using fictional transport; `REVIEW_BASE=95723fae9d4cbc16eb80e350191495b4d37d4498 REPRO=1 TEST_BROWSER=chromium` reproduces the old reinsertion mutations. Normal runs deny retired handlers while fresh check-in and reversal remain available. Chromium/WebKit exercise mobile/desktop, session expiry, account replacement, campaign denial, navigation retirement and already-submitted requests. PostgreSQL fixtures are local/disposable only.

Historical Staff126 runner shutdown and earlier WebKit failures remain recorded, not reclassified. New CI is attached to the new exact candidate only. This is neither genuine Supabase Auth acceptance nor release authorization. RELEASE NO-GO.
