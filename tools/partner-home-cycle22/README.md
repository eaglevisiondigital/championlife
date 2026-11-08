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
