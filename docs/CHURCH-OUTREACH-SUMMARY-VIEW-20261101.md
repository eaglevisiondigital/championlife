# Outreach registration summary browser renderer — test-only source package

**November 1, 2026.** Source-only, **not mounted** into Champion Life public website. Stacked on reviewed non-public [PR #68](https://github.com/eaglevisiondigital/championlife/pull/68) exact head `ec2a09ef6528b317bfe1a49fce04ddbd1fde6680`, which in turn includes source from frozen PR #61 and vetted PR #63/#66/#67. No changes to the eight accepted public shell files or site allowlist.

## What is now implemented

- `tools/outreach/church-outreach-summary-view.mjs` provides a small, accessible native DOM summary card using the existing PR #68 binding. It takes an injected trusted `ChampionLifeAuth`, active staff workspace, authorized **UI** campaign list, and event target.
- Uses `textContent` and native DOM nodes only, never `innerHTML`. Only five aggregate counts render: registered households, adults, children, total attending, and checked in. No names, contact details, notes, waiver values, donations, financial access, staff permissions, CSV, export or mutation operations are exposed.
- A campaign selection calls PR #68's existing `select()`. The binding verifies provider Auth `getUser()`, a matching current session subject, and backend campaign `registration.view` through the existing RLS-backed registration RPC's `context → list → context`; the UI campaign list never grants access.
- Results clear immediately when the bound snapshot becomes null (on logout, token change, protected clear, pagehide, campaign denial, permission loss or other invalidation). The refresh control is disabled while private data is cleared. Stale campaign A responses cannot overwrite B. Provider error detail cannot reach the DOM.
- The view is a **renderer** only; it has no direct network client and no module capability to activate NMI or introduce real staff grants.

## Verified scope and evidence

- `tools/outreach/church-outreach-summary-view.test.mjs` exercises the renderer through jsdom with fictional Supabase-style Auth responses, synthetic campaign RPC, account switching, denied campaign, revoked permission after list, pending A/B response, unconfirmed user, synchronous signout, protected-clear/pagehide, and XSS/private/financial field exclusion.
- The existing Actions `outreach-summary-review.yml` now runs reader, lifecycle, correction, composition, binding and browser renderer tests alongside native disposable PostgreSQL authorization tests.
- **No real OTP, SMTP, session revocation, real mobile browser or hosted Supabase Auth acceptance has been claimed.** The separate staff-shell gate still requires supervised independent cleanup after the backup operator is available.
- **Not deployed and not in public site:** Code lives exclusively in `tools/outreach/`; no `staff-home.html`, `staff-outreach-registration.html`, `assets/js`, `tools/site-build/public-files.json`, Supabase migration, Netlify configuration or real data is changed.
- Existing PR #61 public source is preserved exactly. The source stacked PRs overlap: do not merge PR #61/#63/#65/#66/#67/#68/#69 independently into production.

## Next bounded task

After independent review of this new renderer, prepare a **separate reviewed preview/browser mount** and real-browser synthetic acceptance based on frozen PR #61 using the exact preapproved host/Auth config and site build. Hosted genuine Auth still requires its own operational rehearsal and explicit owner website-only release authorization. Do not confuse a synthetic DOM PASS with hosted authentication or production-readiness.

## Independent source review correction: strict UUID length

Review found that JavaScript's dollar end anchor can match immediately before a final line break. Consequently a 36-character ID followed by LF/CRLF could be accepted by an otherwise anchored regex in the PR #68 Auth/selection contract. The draft **preserves original PR #68** and additionally checks `value.length===36` for each provider identity UUID and campaign UUID before accepting the regex, both in the Auth binding and in the renderer. Added malicious UI hint and matched provider/session newline regressions. The check is structural only; the actual authorization still belongs to the provider and registration RPC.

This change must be included in independent review of the stacked draft; it is NOT a retrofit to frozen PR #61 or a production release.
