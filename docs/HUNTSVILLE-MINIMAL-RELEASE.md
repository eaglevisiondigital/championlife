# Huntsville minimal package — release review

Status: **isolated hosted validation PASS; candidate reconciled onto current production main. READY FOR CONTROLLED PRODUCTION RELEASE REVIEW, but NOT AUTHORIZED to merge, deploy, migrate, grant access, publish or activate registration.** Branded email remains a separate launch gate.

## Candidate

- Current production main: `f0d6fe9e07140dab6ed829ed5ccfdbb7af12e2fd` (`Release Bessemer mobile registration flow`). The validated Huntsville slice originated from prior main `a9c8a73c228866749831f0df4236295c3791216f`; the current release branch preserves the Bessemer change unchanged.
- Accepted Huntsville reference: `dba68735cd68ddfc00ddbc16109a01e2794027dc`.
- Release branch: `codex/huntsville-production-release`. It combines current production main with validated minimal-package head `03d929d2a939f1e160ae12149effbf7480ecca83` without importing PR #24 ancestry.
- New migrations, in order: `20261016201932_huntsville_registration_foundation.sql`; `20261016201933_huntsville_registration_draft.sql`.
- Exact objects, dependency graph, files and exclusions: [dependency review](HUNTSVILLE-MINIMAL-DEPENDENCIES.md), [statement classification](HUNTSVILLE-INHERITED-STATEMENTS.json), [object catalog](HUNTSVILLE-REQUIRED-OBJECTS.json), [source manifest](HUNTSVILLE-SOURCE-MANIFEST.json).
- SowGo accepted reference remains `3a01f00556250cd2d02777e842cc2c1b23901638`; no SowGo changes. Do not merge Champion PR #24 ancestry or SowGo PR #4 as part of this task.

## Reproducible local evidence

`npm ci --ignore-scripts --prefix tools/backend-tests`, then `npm test --prefix tools/backend-tests` runs the existing baseline suite plus the focused additions below. No remote credentials required. Native races use `npm run test:huntsville-native --prefix tools/backend-tests`; `TEST_POSTGRES_BIN` may identify a local PostgreSQL installation. The default is Homebrew PostgreSQL 17. The native helper never accepts a remote connection URL, host, password or port; it uses a private temporary Unix socket, disables TCP listening and removes the disposable cluster afterward.

| Check | Result |
|---|---|
| All 22 production migration files match exact main bytes | PASS |
| Apply exactly baseline 22 + candidate 2, no inherited Phase A–F preload | PASS (PGlite and native PostgreSQL 17) |
| Migration/object/ACL/data-preservation safety | 66 PASS |
| Registration database/security | 95 PASS (PGlite and native; includes new scoped assignment checks) |
| Huntsville legal/media/address/count/CSV/capacity/ownership regression | 56 PASS (PGlite and native) |
| Huntsville DOM/calendar | 25 PASS |
| Registration DOM/state/revocation | 38 PASS |
| Registration gateway HTTP/security | 29 PASS |
| Existing baseline test scripts | PASS |
| Site build | PASS, 389 explicit public files, docs/tests/config/SQL excluded |
| Browser | Local public submission/confirmation, staff list/detail/check-in, fixed totals during search and access screen PASS; zero warnings/errors |
| Responsive | Local public 320/390/768/1440 and staff 390/768/1440 DOM width checks PASS; staff desktop/mobile screenshots reviewed |
| Real mobile Turnstile on new minimal hosted stack | PASS at 390px; real widget reached `Success!` with no overflow or console errors |
| Native browser ICS download | UNVERIFIED: browser download event timed out; ICS generation/calendar DOM assertions pass |
| Hosted minimal-stack Auth/Edge/browser/races | PASS on isolated project `niyovbgoalulzkhbvebt`; staff totals/CSV/check-in separation/responsive layouts/same-session revocation passed |

### Six real independent-session races

Each race used eight independent worker backend IDs plus a separate coordinator, a server advisory barrier, eight active SQL requests, and server timestamp intervals proving eight-way overlap. Mutating requests reached the native database lock before the coordinator released the campaign row. These are actual overlapping PostgreSQL requests, not serialized JavaScript simulations.

| Race | Invariant/result |
|---|---|
| Duplicate household | Eight callers, one canonical household/reference |
| Duplicate check-in | Eight callers, one check-in event and one participant identity |
| Duplicate attendee | Eight callers, one canonical added attendee |
| Signature retry | Eight callers, one immutable signature for the key |
| CSV with concurrent registrations | One repeatable-read exporter plus seven submitters; exported attendee/household counts reconcile with the same database snapshot |
| Final slot | Eight overlapping workers; exactly one success, seven safe denials; capacity preserved |

Native evidence remains local evidence. The exact reduced 22+2 stack was subsequently installed and validated on isolated hosted Supabase project `niyovbgoalulzkhbvebt`, including Auth/Edge/public/staff behavior and the real 390px Turnstile check.

Private evidence is in the outer workspace `audit/huntsville-minimal-package-2026-10-16/`: `schema-inventory.json` (full before/after), `final-suite.log`, `safety.log`, `final-native/` logs and interval evidence, browser summary and screenshots. It is excluded from this repository and every publish artifact.

## Migration safety and failure handling

Each migration must be applied transactionally through the migration ledger. Foundation creates new names without replacing baseline objects. If a conflicting prerequisite object already exists, application aborts; no partial campaign prefix remains after rollback. Draft creation obtains table locks and requires exactly one existing `sowgo` organization. Any duplicate/conflicting campaign code, campaign public slug or registration slug aborts. It never creates a substitute organization or silently updates an existing campaign.

A successful ledger migration is applied once. Manual duplicate foundation/draft execution deliberately fails closed; do not mark an unrun version as applied or modify historical files to force a retry. If foundation succeeds but draft fails as a separate migration, leave the inert foundation in place, investigate the specific conflict and obtain approval for a forward correction. Do not replay old workflow seeds.

The new campaign is `draft`, settings `enabled=false`, no staff grants, no published waiver and no registration fixture. Exact approved legal/media text remains in the accepted JSON file, ready for a reviewed publication by an explicitly approved real staff identity. It is not silently published under a fabricated actor.

## Hosted gate completed — 2026-10-16

The owner authorized isolated project `niyovbgoalulzkhbvebt` (`champion-huntsville-minimal-acceptance`). It received the exact 22 production baseline migrations plus only the two Huntsville migrations, and the reviewed `outreach-registration-submit` Edge Function with platform JWT verification disabled for this guest gateway only.

Hosted validation passed registration/staff behavior, campaign totals, CSV, check-in separation, responsive layouts, same-session revocation, cleanup and the real Cloudflare Turnstile widget at 390px. The real widget displayed `Success!` with no overflow or console errors.

Cleanup left **zero active test registrations, check-ins or grants**. Closed synthetic registrations and immutable audit/signature history were intentionally preserved. The form was disabled again. Production was unchanged.

The current production database was rechecked before this release refresh and still has exactly the original 22 migrations and none of the Huntsville campaign/registration objects or gateway RPCs. Current production main differs from the original minimal-package base only by the approved Bessemer mobile registration-flow commit; that file is preserved unchanged on this release branch.

## Forward release order — proposal only

1. Review this exact release branch and CI results. Verify production still has the same 22-migration ledger and current main remains `f0d6fe9e07140dab6ed829ed5ccfdbb7af12e2fd` (or reconcile any newer production-only change before writes). Confirm the approved Huntsville public header bytes remain unchanged.
2. Obtain a separate controlled-production authorization identifying the exact candidate, database project and approved staff bootstrap identities/capabilities. No grant is implied by this package.
3. Take the approved production backup/checkpoint. Apply only the two new migrations in order, transactionally, preserving the 22 historical ledger entries. Verify only the documented object delta, disabled draft, existing org and zero Bessemer/data/grant changes.
4. Deploy only `outreach-registration-submit` plus its existing fingerprint dependency through the supported function workflow. It is a public guest endpoint and requires platform JWT verification disabled for this endpoint only, matching accepted gateway architecture; application origin/Turnstile/rate controls remain mandatory. Review deployment metadata explicitly. Set only the approved exact production origins/hostnames, action `outreach-registration`, real Turnstile configuration and server-held existing secret dependencies through the approved secret mechanism. Preserve shared partner allowlist entries. Never print values or enable acceptance test-key behavior in production.
5. Publish only this main-based site's allowlisted artifact after exact-head review. Keep campaign disabled until normal staff Auth and least-privilege registration access are verified. No new staff-home/shared-shell dependency is required; return route is current `staff-people.html`.
6. Through the approved staff identity, publish the exact JSON waiver/media version, verify byte-for-byte read-back, configure event and required fields, approve the campaign and enable registration only under explicit activation authorization. Verify the approved source date, venue/timezone, household counts, security and calendar details.
7. Release the already accepted SowGo `/register` integration only after Champion Life is proven ready. Leave `/go` and Bessemer unchanged. Verify exact alias/route and QR externally. No live test household or binding signature is implied; any final live probe must have its own approved safe procedure.

## Rollback / containment

Before any activation, keep `enabled=false` and the campaign draft. If an issue appears after an authorized activation, disable registration for the exact Huntsville campaign, preserve submitted records/signatures/audit and return the public entry to its prior closed state. Restore the prior site artifact and disable the new function if needed; do not modify existing partner functions or broaden auth. Keep SowGo `/register` unreleased or revert only that newly authorized route; `/go` stays untouched.

Do not drop populated tables, delete signed evidence, rewrite applied migrations or remove ledger entries. Contain with disabled config/revoked temporary grants, record the incident and prepare a reviewed forward fix. In a transaction failure, PostgreSQL rolls back that migration; after a committed schema change, application rollback plus inert additive schema is the safe default. Any destructive database rollback requires a separate reviewed recovery plan.

## Stop point

No production database migration, production Edge deployment, production registration activation, production grant, message, payment or SowGo route change is authorized by this review. The release branch is prepared only for CI/release review. The exact minimal hosted gate is complete and passed; production remains on the 22-migration baseline. Recommendation: **GO for controlled production release review; NO-GO for merge/production activation until separately authorized.** Branded email remains a separate launch gate.
