# DreamTrack v1 recovery — release held

## Acceptance setup resumed under owner approval

The owner approved the current US$10/month compute quote (US$0.01344/hour, usage/tax additional), one empty project with no paid add-ons, and deletion after acceptance or within 24 hours. New isolated project `ugbxizchszdxpqpxzerp` contains the 27 exact persistent baseline SQL payloads plus the guarded DreamTrack recovery migration. Original files and production history were preserved; the connector assigned new acceptance-only ledger versions, with original filenames/hashes retained in private evidence.

Before DreamTrack, a fresh read-only comparison against actual production matched every captured application catalog field other than server version: 53 RLS tables, 76 function definitions/owners/ACLs, 64 policies, columns, constraints, indexes, triggers, schemas and automatic-RLS event trigger. The new project's broader public default grants were tightened only while empty and verified against the sealed baseline; managed Auth/Storage were not recreated. Private/app_private Data API profiles both return 406/PGRST106.

The guarded recovery SQL checks the absent course/partial tables, exact existing course policies and current staff-helper fingerprints before any change. Its question bank and progression rules are unchanged. The staff page now uses the current staff shell/session logout; permission-filtered course navigation is additive to People. Revoked RPC or invitation delivery access clears private staff content. The adapter defaults to the exact canonical production origin, while the isolated deployed entrypoint supplies only its protected acceptance origin. No production grants or Auth settings were changed; a current production metadata check found one effective existing course manager.

Local validation now includes the integrated existing suite plus all 67 Dream backend checks, 18 learner DOM/Auth checks, 16 staff integration/security assertions, enhanced invitation-adapter origin/identity tests, and native PostgreSQL replay of all 27 persistent migrations with 16 rollback assertions and independent-session meeting/claim races. The original sandbox shared-memory failure is retained; the authorized disposable local rerun passed and removed its cluster.

Hosted rollback checks passed after DreamTrack installation. Postflight: seven lessons, 140 active questions, eight new RLS tables, zero raw browser grants, and zero test Auth users/grants/attempts/invites before genuine login. The security advisor adds only the eight intentional RPC-only no-policy notices; the existing public registration-config definer notices are unchanged.

The static acceptance preview is on separate Netlify project `59f8c5db-099c-4764-bdae-c882c2ebadcd`, protected by team login for all deployments. Anonymous HTTPS returns 401. The first static deploy is `6afbcec01b5ab15a0b4848c1`; no Netlify functions or edge functions are deployed there. Its separately reviewed build overlay permits only the new project and never falls back to production. The isolated `dream-track-invite` function is ACTIVE version 1 with explicit Auth validation and manager RPC checks. Production is still unchanged.

Genuine sign-in was requested for the owner-supplied mailbox. Provider acceptance was observed, not assumed inbox delivery. The owner is completing sign-in directly in the preview; no code or credential is requested in chat. Genuine account/video/grade/save/invitation/staff acceptance and production release remain in progress.

The historical initial HOLD findings and original source recovery record below are retained as a chronological audit; the raw-parent baseline blocker has been resolved by the separately approved empty project.

Approved source: `5e6ecc3bf00de2b5284ff3fc9486e4381599918c`. Recovery branch: `codex/dream-track-recovery-20261116`, based on the verified production source `8a779d4f94f4114afb06c040c46737724c615eef`. The historical behavior contract is [DREAM-TRACK-V1.md](DREAM-TRACK-V1.md). PR #2 was not merged.

## Implemented locally

Recovered the seven lesson shells, original course/dashboard/staff scripts, CSS dependencies, invitation adapter, exact 140-question fixture and original SQL payload. The original SQL SHA-256 is `5dde77e16b2eeae07081640ff920d8e440a6b644e593b3889543b65323d0050d`. The SQL exists only as an **uninstalled, unapproved recovery candidate** in `supabase/release/dream-track-v1-forward-candidate.sql`; it is not a new historical migration and must not be executed against production.

My Discipleship retains the current production implementation with the DreamTrack mount/assets added. Current login, Auth client, Supabase public configuration, Giving, People/Outreach/registration assets, Netlify configuration and all 26 repository migration files remain byte-identical to the production source. No broad development ancestry is imported. The original invitation adapter still defaults to the old PR #2 origin; production origin/callback/permissions and current staff-shell integration remain release work, not verified behavior.

## Fresh checks

- Clean `npm ci --ignore-scripts --prefix tools/backend-tests` and all 24 existing production regression scripts pass.
- All 67 approved DreamTrack backend checks pass against the current repository's production migration chain plus the candidate SQL. These are local PGlite tests with synthetic users, not the complete hosted production catalog or genuine Auth sessions.
- All 18 recovered/adapted DOM/Auth checks pass. The test uses the newer unchanged production sanitizer rather than replacing login with the older September implementation. Its initial stale OTP-source assertion failure is retained privately; the corrected assertion and existing functional login suite pass.
- Invitation adapter origin/identity/permission/provider-failure mocks pass; no email was sent.
- Local explicit-artifact build passes with 416 files. No private path is in the public manifest. Historical migrations/protected runtime preservation checks and `git diff --check` pass.
- Production metadata confirms the expected generic course policies and verified, active, dated organization-wide staff helper. Production security advisors report existing RPC-only no-policy notices, public registration-config definer notices and disabled leaked-password protection; health advisors report no findings. These observations are not independent DreamTrack release signoff.

## Exact isolated-host blocker and recovery

A fresh branch initially stopped after migration `20260923114743`: missing `public.rls_auto_enable()`, SQLSTATE `42883`. Production's normalized helper fingerprint matched the repository's guarded bootstrap (`58249bb7e7ad29ddb07a33b2d61f4a16`). That bootstrap was applied only to the empty isolated branch, and one supported rebase proceeded through `20261022201357_operations_admin_security`.

The next retired production installer rejected with **`Campaign baseline mismatch`, SQLSTATE `P0001`**. The branch never received DreamTrack and had zero Auth users. It was deleted; a fresh branch-list read confirms removal. The two pre-existing projects/branches were preserved. No production write, grant, Auth/SMTP change, invitation, push, merge or deployment occurred.

This is the already documented October 31 parent-history replay limitation. The accepted current-schema baseline consists of 27 persistent migrations with exact applied-version provenance, excluding three retired staff installers while preserving all 30 production ledger entries as historical evidence. Its manifest SHA-256 is `383e452225907117ec5c5c980b8e3299078da48b013c68c8b68eecf098f42e62`. Do not create/rebase another raw-parent branch, weaken installer guards, fabricate production UUIDs, mark excluded installers applied or repair production history.

## Remaining release gates

Use the existing independently reviewed 27-file baseline on an approved empty isolated destination that does not auto-replay retired installers. Confirm target organization, quoted cost/lifetime, provider prerequisites/default ACLs, private preview and cleanup responsibility before provisioning. Preserve the existing baseline and independent review rather than recreating them. Owner-supplied controlled acceptance mailbox is recorded only in private evidence.

Then complete a guarded forward DreamTrack migration reconciled with the fresh production catalog; production-safe invitation origin/callback using existing Auth; current staff session integration; genuine account login/save/refresh/account separation, all seven video players, grade/missed-only retry/watch boundary/unlock, invitation/access-code/staff report/final-meeting mark/reverse and cleanup/recovery checks. Synthetic seeded watch ranges must be labeled as such, not actual watched-video evidence. Obtain independent security/recovery review of the exact package, then execute the owner's release authorization with exact commit/artifact binding and post-deploy verification. The current authorization is not being rejected or re-requested; its prerequisite gates have not passed.

The request describes chronological questions, while the approved contract explicitly preserves overlapping/out-of-order review starts (including Intro 9/10 and Abundant Life 5/6). The recovered bank is unchanged. Any strictly chronological reorder needs a Chat decision; no doctrine or wording has been rewritten.

## Actual production identity

No new deploy was made. The published source remains `8a779d4f94f4114afb06c040c46737724c615eef`, Netlify deploy `6af78f3bbc4b537efbe071b1`, site `championlifechurch`, public domain `https://championlifefwb.com`. Supabase production `exdocjbmylgxssanymjk` still has 30 ledger entries and no DreamTrack migration. These are the existing deployment identifiers, not a DreamTrack release. All seven live DreamTrack behavioral checks, real-account acceptance and independent release signoff remain **NOT RUN / HOLD**.

Private raw evidence is outside this repository under the outer workspace's `audit/dream-track-recovery-2026-11-16/`; never publish it.

Public HTTPS HEAD checks on November 16: homepage returned 200; the overview and all seven lesson URLs returned 302 to the existing legacy access page. This confirms reachability and the old gate, not functioning DreamTrack v1.
