# Browser-mounted Outreach summary — source-only Chrome/WebKit acceptance

**November 1, 2026**. Target chain: frozen PR #61 `fe0cc5b4219b17d18867c4d2a588f2f42ac82ae3` → reviewed nonpublic PR #63/#66/#67/#68 → PR #69 `272336860ca9b3330a2eebd26e1687ddc27fc79c`.

This separate integration draft adds **no public site assets** and does not modify `staff-home.html`, `staff-outreach-registration.html`, `staff-people.html`, any of the eight accepted PR61 runtime files, `tools/site-build/public-files.json`, Supabase schema, merchant settings, hosted environments or credentials. It is not a deployable live dashboard and contains no payment capability.

## Implementation

`tools/outreach/church-outreach-summary-staff-mount.mjs` is an explicit mounting boundary for a *currently active* existing `StaffWorkspace` and the corresponding existing `ChampionLifeAuth`. The selected Outreach campaign is read from PR61's own server-populated `#staff-context` campaign selector. The selector is a navigation hint, **not** an authorization grant; the underlying summary component always uses the current user's `outreach_registration_workspace` RPC with `context→list→context` checks. Only the five aggregate registration numbers are rendered. No PII, financial details, notes, raw attendees, exports or mutations.

The mounted view clears on permission loss, `staff-protected-clear`, pagehide, campaign navigation, signout, token refresh and session changes. It never creates another Supabase client. Non-UUID or foreign campaign values fail closed. The module is intentionally outside the public build; it can be mounted for testing by importing from the repository source only.

## Real-browser synthetic acceptance

`tools/outreach/church-outreach-summary-staff.browser.mjs` serves the **actual frozen PR61 staff-home HTML, CSS and JS** and mounts the candidate from a test-only module import. Chromium and WebKit are launched with real browser engines at mobile/desktop widths. All HTTP is intercepted and no external provider, real user, Supabase test project or live site is contacted. Only fictional Auth and campaign RPC responses are returned. The test covers authorized aggregate totals, no private fields, server denial, signout, protected clear, pagehide, token refresh, and foreign-city denial despite the campaign being offered as a UI option.

The GitHub workflow `.github/workflows/outreach-summary-browser-review.yml` installs Playwright's pinned browsers and runs these isolated checks; existing focused/native PostgreSQL CI for PR69 also remains available.

## Release boundaries and next step

A successful browser test is **synthetic**, not genuine hosted Supabase email OTP/session revocation or physical-device acceptance. It does **not** authorize production, real staff grants, a Netlify publish, a merchant activation or the blocked King Kind migration. Do not merge overlapping draft PRs independently; first independently review and reconcile source at an exact SHA. Only after actual trusted Auth acceptance and owner approval should a separate reviewed change add the public runtime file(s) to the site allowlist and connect the mount to the real staff page. Keep NMI PR #64 checkout disabled until provider legal/settlement evidence is verified and separate owner GO is obtained.
