# Accepted household-search privacy in current Outreach registration

The current PR72 registration workspace could retain a household lookup after the account or campaign changed. Clearing the visible form did not clear the module's search variable: the next account's list request could resend that previous identifying query and display it in its search field.

This composition reuses the accepted six search resets from PR90 `4f64fa14f03098e31ee8111c8ff1810fbc260542`, whose private review records the preceding PR89 correction `db61caa31c3f274cd264bf3f846c8d7b8c5209dc`. The same resets are present in PR102 `0bee5dc7beef8ad7b88e5aeb9e0567730c82fc53`. Those historical candidates remain unchanged.

The current source base is PR72 `9f78e195115f55135d763e1e5373a494e817423b`. Only the registration runtime receives these resets:

- Access denial.
- A newly verified account differs from the previous account.
- Protected-content clearing.
- Auth account transition or logout.
- Page hiding, including the browser's page cache.
- History/campaign navigation.

Verified same-account focus keeps the current search. Existing generation checks reject late responses and retained form handlers. The change does not add authentication, permissions or identity matching. Staff continue using the current campaign-authorized workspace.

## Composition and evidence

`tools/outreach/registration-search-composition.browser.mjs` recovers the accepted PR90 browser regression and runs it against the current source. The original current-base reproduction fails at the Chromium mobile account-transition search-ownership assertion. The original failure is retained privately.

The permanent suite checks account callbacks and missed callbacks, logout/expiry, denial/recovery, protected clearing, campaign history, page-cache restoration, pending earlier list results, same-account focus and A-to-B-to-A transitions in Chromium/WebKit at 390 and 1280 widths. Requests use fictional identities and intercepted transport. Retained former forms must issue no requests, and all requests in this suite are read-only context/list operations.

Six source checks require the exact accepted reset sites. A seventh check removes only those additions and verifies that the result equals the entire current-base registration runtime hash. This binds the correction to the existing check-in eligibility, waiver, export-authorized roster, walk-up, revision, navigation and stale-result protections. Existing People paging and due-date editing are untouched. Test counts and independent review results are recorded in the private cycle report and exact-head CI.

No Event Day restoration, backoffice feature, SQL, grant, HTML, CSS, public registration form, SDK, branding or giving change is imported. Existing backend and earlier native evidence remain applicable; no new database operation is required.

## Release boundary

This is a source-only privacy composition with fictional browser validation. It does not establish genuine provider Auth/RLS acceptance. Exact-target genuine acceptance, independent recovery/cleanup and explicit release composition/approval remain separate gates. No hosted migration, real account/grant, campaign-to-Person association, message, payment, credential, provider operation or deployment is authorized by this work.
