# Church/Outreach Auth-to-summary binding — isolated implementation

**November 1, 2026.** This source-only package is stacked on draft [Church/Outreach composition PR #67](https://github.com/eaglevisiondigital/championlife/pull/67) at `4203f67694d88b686aff5daadd4a9af7b1fe67d0`, which itself preserves the exact published staff-shell PR #61. **No public runtime or deployment change.**

## Added boundary

`tools/outreach/church-outreach-auth-binding.mjs` composes PR #67's read-only campaign summary with the **existing injected** `ChampionLifeAuth` and `StaffWorkspace.active()` interfaces. It neither instantiates a second Supabase client nor implements a service-role route or permission store.

It enforces:
1. `client.auth.getUser()` — a fresh provider-verified user, nonanonymous and confirmed, UUID ID. Does not trust client `user_metadata` for authority.
2. `auth.getSession()` — current session subject must equal the provider-verified user, and the bearer token must be present. The token remains inside a transient in-memory reader fingerprint; is never persisted, returned, logged or included in the summary.
3. A selected campaign must exist in an injected **current staff UI scope list**. This list controls navigation only; it does **not** authorize data. Server-side `outreach_registration_workspace` RPC with caller's Auth continues enforcing `registration.view` before and after each list.
4. Existing `staff-protected-clear` and `pagehide` events permanently close the binding and unsubscribe Auth listeners, preventing a retained handler from reviving old data.
5. Supabase `SIGNED_OUT` permanently closes the binding. `TOKEN_REFRESHED`, `SIGNED_IN`, `USER_UPDATED` and `PASSWORD_RECOVERY` synchronously clear selected campaign and data, requiring fresh selection and server verification. No Auth APIs are awaited in `onAuthStateChange`.
6. Exact field projection: only campaign ID and five non-sensitive aggregate attendance counts. No individual attendees, household details, donor, finance, payments, notes, pastoral follow-up or learner records escape. No mutations, exports or staff grants exist on this interface.

The trust inputs `getAllowedCampaigns` and `workspace.active()` are **not** permission or identity proofs; they are supplementary UI-scope checks. Future browser integration must provide them from the current validated staff shell, never caller URL claims. RLS and server RPC authorization remain mandatory.

## Validation and limitations

A new `church-outreach-auth-binding.test.mjs` exercises fictional Supabase-like provider results, verified user/subject agreement, absent/anonymous/unconfirmed accounts, provider failures, session and token refreshes, campaign selection denial, server role revocation after list, late session switch, `staff-protected-clear` and pagehide teardown. The existing review workflow runs the complete reader, lifecycle, composition, Auth binding and 11 disposable PostgreSQL checks.

**This is not genuine hosted Supabase Auth acceptance.** The mocks model the trusted contract; they do not prove real OTP delivery, refresh-token retirement, network isolation, live grant revocation or deletion custody. The separately approved short-lived Auth acceptance project remains blocked by the independent cleanup rehearsal while Danny is unavailable. This package does **not** create that project or send mail.

**Not mounted:** The new code remains in `tools/outreach/`, excluded from `tools/site-build/public-files.json`. PR #61's eight public runtime files are unchanged, as are the Netlify settings and production source. This is specifically a reviewable Auth-binding seam, not the final dashboard rendering.

## Next scoped step

Independently review this exact source and CI, then prepare an optional **separate public UI mount** based on frozen PR #61 without merging overlapping PR #63/#65/#66/#67 blindly. Final live rollout still needs genuine Auth acceptance, current-main drift/rollback and owner signoff. NMI PR #64 and blocked King Kind PR #57 remain separate.
