# Staff portal UI and logout release

Local candidate based on `97f2330c284dcda2108b8e1926bf9f3bd12979af`. No production release has occurred.

## Runtime scope

- `staff-people.html`: branded shell, organization/search bar, results and helpful empty state.
- `staff-outreach-registration.html`: same shell around unchanged registration/check-in/CSV/roster module.
- `staff-outreach-partners.html`: shared identity/logout header; existing Partner Review functionality retained.
- `assets/css/staff-portal.css`: scoped responsive charcoal/gold components, focus/skip-link, touch targets and print styling.
- `assets/js/staff-session.js`: current email, current-session logout, safe retry, account-change clearing, bfcache protection.
- `assets/js/outreach-people.js`: presentation classes, labels and empty-state copy only; request/permission logic preserved.
- `tools/site-build/public-files.json`: adds only shared stylesheet/session script (403 public files).

The approved logo and theme-song artwork are unchanged. Hidden financial navigation remains permission-controlled. Protected application content still requires the existing server authorization. No migration, grant, invitation, provider, registration-intake or configuration change is needed.

## Verification

Run `npm test --prefix tools/backend-tests` for the full regression, including the new 282-assertion session DOM suite. Run `npm run test:operations-browser --prefix tools/backend-tests` for 156 Chrome/WebKit operational assertions at 390/768/1440px. This suite isolates application-module behavior; the session header is covered separately.

Run `SUPABASE_SDK_PATH=/absolute/path/to/reviewed/supabase-sdk.js npm run test:staff-session-browser --prefix tools/backend-tests` for 68 Chrome/WebKit assertions at 390/1440px. The harness requires SDK SHA-256 `bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af`. Set `EVIDENCE_DIR` to a private directory for screenshots/results. It runs the real SDK with fictional sessions and strictly stubbed HTTP; no production authentication or data is used. The requested email labels are fixtures, not verified live account sessions.

Checks include supported local sign-out, SDK auth-storage removal, unrelated storage preservation, account switching and new-permission rendering, safe failure/retry, delayed-response protection, Back navigation, hidden financial navigation, CSV/print regression, keyboard focus and responsive layouts. Live email-link login and hosted session retirement remain unverified.

## Release and rollback

1. Obtain exact candidate approval for website-only merge/deployment. Reconfirm main and review any drift; never overwrite unrelated work.
2. Run exact-head CI and build the explicit public manifest. Confirm only the seven runtime/build-manifest paths above differ. Keep private evidence/tests out of the artifact.
3. Record the current production commit and immutable Netlify deployment as rollback target; use the existing production workflow only after approval.
4. Verify served CSS/JS and all three staff pages, signed-out gates, desktop/mobile layouts, real owner email display, Log Out and Back protection. A human must use their own secure sign-in link; do not collect codes or links. Verify CSV/roster readability without exporting private data into reports or changing attendance.
5. If verification fails, stop and restore the recorded website deployment only if no intervening unrelated production change would be lost. No SQL rollback, permissions change, provider action or account creation is included.

## Known boundaries

Logout uses `scope: local`: other devices remain signed in. SDK success retires the targeted refresh session; issued access JWTs may remain valid until expiry, under unchanged server authorization. The header clears visible protected content immediately, including failed logout and cached navigation. It does not promise a new server-side JWT revocation mechanism.

People/Registration visual refresh and common logout are complete locally. Partner Review retains its existing content styling beneath the shared header; future page migrations should reuse scoped components after their own functional acceptance. Unreleased staff modules are excluded.
