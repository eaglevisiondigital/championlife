# Restore an accidentally removed household attendee

Source-only successor of PR72 `eb7ad80c322fe3664273c38f56d176b1e28e1583`, on `codex/church-operations-20261103`. No hosted SQL, release, account, grant, message or payment action. Frozen PR84 and PR61 remain unchanged. The coordinator owns shared continuity documentation and publication.

## Completed journey

An authorized registration manager opens an existing household, removes an attendee, reviews the collapsed **Removed attendees** section, and explicitly chooses **Restore attendee**. The same attendee returns to the active list, and fresh campaign totals reflect the existing attending/not-attending choice. The removed section uses existing responsive staff styles and is excluded from print. Existing registration, check-in, CSV and printable roster behavior is retained.

This fills an existing frontend gap: household detail already returned inactive attendees, and `attendee_update` already accepted `active:true`, but the staff screen filtered those records out. It does not introduce a Dream Team, scheduling, attendance or authorization subsystem. Those broader modules have no installed operational contract on this source base and remain separate work.

Restoration sends only `registration_id`, `attendee_id`, captured `revision` and `active:true` through `outreach_registration_workspace`. It preserves the same ID, client key, age, guardian relationship, attending choice, notes, prize settings and immutable signature snapshots. The existing coverage helper recomputes waiver validity: unchanged original coverage can qualify again; a corrected signature cannot. Restoration never records check-in, consent, pickup authority or prize eligibility.

## Authority, races and uncertain results

Only existing `registration.manage` shows restoration controls. Each action freshly verifies the user and campaign capabilities. It binds the rendered shared auth owner, client and client auth object; changes retire the action. Existing generation/route/view/household and attached-control guards reject stale handlers. Auth changes, shell retirement and navigation clear protected content, and delayed responses cannot restore it.

The backend remains authoritative for campaign/household scope, current permission, attendee revision and checked-in protection. An uncertain or rejected restoration leaves its button disabled and presents safe reload guidance without raw errors. Reload reads the current household; it does not automatically repeat the mutation. Requests already submitted cannot be recalled by navigation. This is not an exactly-once delivery claim.

## Necessary capacity correction

Isolated testing reproduced a pre-existing asymmetry: `attendee_add` rejected a 31st active member, but removing someone, adding a replacement and restoring the removed row could produce 31 active members. The coordinator explicitly authorized the smallest forward SQL correction before exposing restoration.

CLI-generated `20261103193001_church_operations_restore_capacity.sql` adds the same 30-active-attendee limit to inactive-to-active updates. All writes already take the campaign row lock, including attendee addition; the new check executes under that same lock. Concurrent add/restore and restore/restore therefore cannot both consume the same place. No new table, permission, policy, role, function or grant is created.

The migration preserves the existing function definition except one guarded insertion. It requires exact baseline `prosrc` MD5 `ad750e647756c6e45590932313cdd052`, one exact insertion anchor and the existing lock plus post-lock authorization check. MD5 here is an exact source compatibility identifier, not an authentication mechanism. An incompatible or already-modified definition fails closed for review. Native tests verify unchanged function owner, ACL, security-definer setting and search path. Older migrations are unchanged; the new test appends this migration explicitly without changing the shared historical test manifest.

**Release dependency:** this frontend action requires the reviewed capacity migration to be installed on the separately authorized target before website activation. This source package is not a website-only addition to frozen PR84. No migration was applied to any hosted database. Do not strip the guard or deploy the frontend alone. A rollback of the feature can restore the previous frontend; leave the capacity safety correction in place unless a separately reviewed database rollback is authorized.

## Validation

- **51 native PostgreSQL assertions PASS**, full existing 26-migration synthetic baseline plus the new migration in a disposable Unix-socket database. Includes actual original 31-active reproduction, corrected cap, actor/campaign/view-only denial, signature and identity preservation, not-attending choice, stale revision, observed two-connection lock waits, one-winner restore/restore and add/restore races, revocation while waiting, and transaction rollback of state/history.
- **216 Chromium/WebKit assertions PASS**, 390/768/1440px, actual runtime and existing four staff stylesheets. Covers remove/review/restore/fresh totals, exact mutation payload, current permissions, backend denial, keyboard focus/Enter, no horizontal overflow, safe conflict/unknown reconciliation, duplicate invocation, navigation, detached controls, account switch, silent identity replacement, owner/client/client-auth replacement and shell invalidation during authorization.
- Existing registration DOM suite: **91 checks PASS**; registration navigation: **96 browser assertions PASS**; printable roster: **216 browser assertions PASS**.
- Two identical **411-file** public builds. Only `assets/js/outreach-registration-staff.js` differs publicly from the starting PR72. Migration, tests, documentation and private evidence are excluded.
- Dedicated `church-operations-restore.yml` runs only the new native/browser suites. Exact-head CI and independent review remain coordinator-reported gates. Local synthetic HTTP/SQL is not genuine hosted Auth acceptance.

Commands: `node tools/outreach/church-operations-restore.native.mjs`; `node tools/outreach/church-operations-restore.browser.mjs`; `node tools/backend-tests/outreach-registration.dom.mjs`; `node tools/outreach/registration-navigation.browser.mjs`; `node tools/outreach/registration-print-roster.browser.mjs`. Linux native execution sets `TEST_POSTGRES_BIN` to the installed PostgreSQL binary directory. Browser screenshot output is optional via `EVIDENCE_DIR` and contains fictional data only.

Private audit: `audit/product-development-2026-11-03/operations/` in the outer private workspace. Initial sandbox failures and unstyled screenshots are retained as development evidence; `verified/` contains the final styled captures. No production readiness is claimed. Next: independent source review and exact-head CI, then separate target-bound migration/Auth/release gates when authorized.
