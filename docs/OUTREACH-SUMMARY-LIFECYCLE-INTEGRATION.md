# Outreach registration-summary lifecycle: next isolated integration slice

**Source composition:** stacked on independently reviewed [Outreach PR #63](https://github.com/eaglevisiondigital/championlife/pull/63) (`eebd61e730381ec040dbd8386037a6b8bbf5f872`). Existing accepted [staff shell PR #61](https://github.com/eaglevisiondigital/championlife/pull/61) remains **unchanged/frozen** at `fe0cc5b4219b17d18867c4d2a588f2f42ac82ae3`.

## Implemented, non-public

`tools/outreach/campaign-summary-lifecycle.mjs` is a synchronous-clear/async-read coordinator for the existing `createCampaignSummaryReader` contract. It is **not** included in the public site build, not mounted in the staff browser, not a Supabase service, not a provider adapter and not an ABP runtime API.

The consuming authorized integration must call:
- `select(exactCampaignUuid)` when a trusted current authorized campaign is selected; clears earlier summaries before retaining the new selection.
- `refresh()` only when the user has a fresh verified session and a trusted server-scoped underlying reader. The underlying PR #63 reader runs existing RLS-backed `outreach_registration_workspace` RPC sequence `context → list → context`; this wrapper is **not** authorization and cannot replace provider-side checks.
- `revoke()` synchronously on logout, user/session switch, campaign permission change, server denial and staff-shell `staff-protected-clear`; clears selected campaign, prior summary and pending result immediately.
- `close()` on navigation, pagehide or teardown; permanently disables further reads.
- `snapshot()` for the currently accepted **aggregate-only** DTO. `onSnapshot(null)` fires synchronously on select/refresh/invalidate before any new request result.

All return values are frozen/allowlisted: `campaignId`, `kind: event-registration-summary`, and five nonnegative safe integer attendance counts. Inconsistent headcounts and oversized/negative/malformed fields fail closed. No name, address, email, phone, notes, finance, contribution, waiver details, pastoral follow-up, minors' records or raw registration rows are passed to the subscriber. Unexpected provider errors return only stable status codes. Older A response cannot rehydrate a newly selected B, and a UI callback that revokes during a response cannot return protected information.

**Important timing qualification:** This boundary clears synchronously when its own invalidation is called or when a current read detects a denial; it does **not** receive independent notification when a backend right changes. The trusted consumer must wire the actual sign-out/session/permission and lifetime events, and the backend must enforce live RLS/permission on each call. A previously rendered summary cannot be erased by the reader alone unless the consumer actually invokes `revoke()` and clears its view.

## What this does *not* claim

- No real Supabase Auth, refresh-token retirement or provider-backed staff permission acceptance; the separate PR #61 hosted-auth gate remains incomplete pending independent cleanup operator availability.
- No new website route, button, DOM hookup, network endpoint, database migration, staff grant or production release.
- No backend aggregate-only optimization: PR #63's existing authorized RPC may internally read registration rows, but only the five aggregate metrics are passed outside the trusted adapter. This never broadens who may call that RPC.
- No decision/free-book engagement, financial donor data or partner profile exposure. Soul Fuel and NMI routing remain independent.
- No changes to approved PR #61 source. This is separately reviewable groundwork that can later be reconciled against the exact frozen shell source.

## Test and review

`tools/outreach/campaign-summary-lifecycle.test.mjs` tests selection, stale A/B results, concurrent refresh, logout/revocation and permanent close, reentrant callback invalidation, provider-error sanitization, exact field whitelist, malformed/count mismatches and non-authorization API surface. Existing `.github/workflows/outreach-summary-review.yml` adds this suite while continuing PR #63's focused and native PostgreSQL tests, with production and preview deployment disabled.

**Next approval gate:** Independent source review and passing GitHub CI of this stacked draft PR. After that, the smallest *separate* next package is a reviewable browser-side integration patch **based on frozen PR #61 + these accepted adapter contracts**, only after determining the genuine Supabase Auth session/context binding. Do not call the lifecycle itself a live registration dashboard or an authorization system.
