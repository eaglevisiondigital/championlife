# Church/Outreach composition candidate — current reviewed source, NO live UI

**November 1, 2026.** This draft composition branch starts from the exact, unchanged frozen Champion Life staff-shell [PR #61](https://github.com/eaglevisiondigital/championlife/pull/61) head `fe0cc5b4219b17d18867c4d2a588f2f42ac82ae3`. It copies the *source* of accepted campaign-scoped reader [PR #63](https://github.com/eaglevisiondigital/championlife/pull/63), lifecycle [PR #65](https://github.com/eaglevisiondigital/championlife/pull/65), and reviewer correction [PR #66](https://github.com/eaglevisiondigital/championlife/pull/66), without editing PR #61's eight public runtime files or any public build allowlist/asset.

## Implemented as source

- The existing PR #63 `createCampaignSummaryReader` executes the caller's server-authorized campaign RPC sequence `context → list → context`, revalidating live per-campaign `registration.view` before exposing five aggregate metrics.
- PR #65 / #66 lifecycle synchronously clears previous data on selection, logout/revoke, pagehide, late-response denial, or cancellation, and restricts outgoing data to a frozen five-count object.
- New `tools/outreach/church-outreach-summary-composition.mjs` combines those two layers with an explicitly **injected trusted, verified session/RPC provider** and an event subscription adapter. The existing PR #61 `staff-protected-clear` event and browser `pagehide` cause **permanent closure**, not silent remount. Registration rows, financial data, contact info, notes or donor data are never passed to the subscriber.
- New `tools/outreach/church-outreach-summary-composition.test.mjs` uses *fictional users and fake event transport* to validate the full sequence. Tests include cross-campaign denial, revoked permissions after list, unverified accounts, pending session identity change, stale A/B campaign responses, immediate clear/close and no export/grant/mutation API.
- The existing Outreach CI workflow runs all focused reader/lifecycle/composition checks and native disposable PostgreSQL assertions. The separate Champion Life `isolation` CI checks the unchanged public staff shell and full regressions as applicable.

## NOT authorized or claimed

This is a non-public **source composition seam**, NOT a live staff screen or hosted-auth PASS. Do **not** publish it as a usable dashboard, perform Auth calls from a service-role client, add it to the public build/Netlify deploy, use actual registrant records, enable any payment, import partner finance data, merge into main or give staff permissions on this work.

Before browser mounting: independently review this exact combined source tree against frozen PR #61 and PR #63/#66; prove the actual runtime verified Supabase `getUser` subject/session mapping and applicable RLS/permission denies in an isolated provider session (not merely synthetic `verified:true` fixture); validate clearing on user/auth event, campaign change, and any session refresh. The earlier protected staff-shell acceptance remains NO-GO until operational cleanup/custody rehearsals are complete. PR #57 King Kind blocked migration, NMI merchant boarding and Global Propel are separate.

**Merge ordering:** This is a separate candidate based on PR #61. PR #63/#65/#66 are stacked/draft and represented here as copied, reviewed source only. Do not merge multiple overlapping drafts separately into production. At release, compose an exact reviewed website-only source SHA with preserved site build, current main drift check, rollback and explicit owner GO.
