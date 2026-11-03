# Campaign foundation: replay and integration contract

Source-only candidate for Issues 58/50, based on PR72 `7699d6cda6309e0d02e1d6058ca1406401a776bd`. No UI mount, hosted install, real grant or release is authorized by these tests. The new RPC is deliberately named `campaign_decision_foundation(text,uuid,uuid,jsonb)`; it is not a drop-in implementation of the old `outreach_decision_workspace` or the absent `outreach_decision_access` contracts.

## Reproducible current-schema prerequisite

`tools/outreach/campaign-foundation-baseline.json` pins the reviewed 27 persistent SQL sources underlying the 49-table current public schema. Twenty-six existing repository migrations and the exact released `supabase/release/king-kind-reader-private-storage-candidate.sql` are reused. The three production version aliases are recorded explicitly. The Bessemer allow-source file has one additional final newline in the repository; both repository and original production SHA256 values are checked. No SQL content is normalized otherwise.

The independently reviewed Oct31 private acceptance manifest is provenance, not a CI dependency. The new Nov2 read-only ledger capture has exactly the same 30 version/name entries, including three retired installers. Those installers and their production guards are not executed or altered. Version/name parity does not claim a fresh fetch/comparison of applied SQL bytes.

The disposable native runner imports the existing Unix-socket-only `local-postgres.mjs`; it accepts no remote URL, host or credentials and removes its cluster in `finally`. The test verifies 49 public tables, zero Auth accounts and absence of historical decision RPCs before candidate installation. Existing function definitions are compared byte-for-byte after installation; the candidate creates three empty decision tables and no identities or authority grants.

`campaign-foundation-fixture.sql` contains the reviewed local Storage/default-ACL stand-ins from the Oct31 replay and the exact synthetic session extension from PR75's `tools/partner-platform/assigned-backend.native.mjs`. Required Auth names/types are present in the Nov2 provider catalog. This fixture is not the full managed Auth schema (for example, fixture email is text versus provider varchar(255)); it does not prove issuer verification, actual logout/revocation or provider ACL compatibility. No Partner migration is imported.

## Existing boundaries and outward contract

| Source | Meaning and handling |
| --- | --- |
| `outreach_registrations` | Original decision/free-book submission. Remains immutable under this API. Source mapping and exact assigned follow-up record are required. |
| `outreach_event_registrations` | Separate event/household registration. Nonempty synthetic rows are preserved and cannot be queried as decisions. Registration grant administration cannot issue new decision rights. |
| `organization_people` / `private.people` | Existing canonical person and human anchor. No duplicate person or matching by email/name is introduced. |
| `portal_account_links` / `portal_admin_events` | Existing reviewed account-link workflow. Tests invoke the actual `set_portal_account_link` RPC to create link and journal. Candidate metadata requires existing campaign registrant linkage, matching registration user, active verified account and exact link journal. Metadata is not a contact route or staff authorization. |
| `outreach_campaign_assignments` | Current active assignment plus separate finite `decisions.read`, assigned care scope and exact source/record assignment. Old event, organization People/finance, campaign administrator or partner affiliation rights cannot substitute. |
| Partner PR75 | Separate held assigned-record/session/provenance installation. This package does not install its tables, bridge its permissions, or claim Partner integration complete. |
| Course enrollment / legacy lesson progress | Owner-writable activity only. Own-user `learner_status` explicitly reports completion authority unavailable and book not instrumented; no raw answers, completion flags or arbitrary user lookup. |
| Trusted discipleship PR76 | Accepted trusted evaluator remains lessons 1–4, playback envelope at most 10. This package does not import it, infer completion for 5–13, or certify book reading. |

The sole new public RPC takes `p_action`, `p_org`, `p_campaign`, `p_payload`:

- `context`: current exact assigned campaign scope and permitted read/manage capabilities.
- `list`: assigned records only, page size 50, no broad total/search/export, no contact/prayer/worksheet fields.
- `detail`: exact assigned decision metadata and conditional existing account-link metadata. Contact is explicitly unavailable; course summary requires separate authority.
- `followup_save`: existing assigned record only, explicit `followup.manage` and ministry consent, expected revision, bounded status/date, UUID request ID. Matching retry returns the receipt only while its state remains current; changed payload or stale state is rejected. Mutation and minimal audit commit together.
- `learner_status`: `p_org=null`, `p_campaign=null`, empty payload, current session owner's existing enrolled activity only.

No assignment issuance, contact-route resolution, actual contact-history recording, notes, export, communications, staff-wide learner summary or trusted progress API is implemented. Follow-up status is workflow metadata, not evidence that an external contact happened. The API creates no email/SMS opt-in from ministry consent.

## Validation and execution

```sh
npm ci --ignore-scripts --prefix tools/backend-tests
TEST_POSTGRES_BIN="$(pg_config --bindir)" node tools/outreach/campaign-foundation.native.mjs
```

During isolated writer integration, `CAMPAIGN_FOUNDATION_SQL_ROOT` may identify the local backend worktree. The runner requires exactly one candidate migration by suffix, prints its SHA256 and applies it only to its disposable cluster. Final integrated CI uses the checkout itself. The focused workflow is `.github/workflows/campaign-foundation-review.yml` and requires no secrets or hosted services.

Latest author native execution: **95 checks PASS on PostgreSQL 17**, with source SHA recorded in private `contracts/native-final.log`. Checks cover current-schema replay, preservation, exact organization/campaign/assigned record/source scope, missing/foreign/expired sessions, unverified/anonymous/banned/deleted accounts, missing/expired/revoked assignments, link withdrawal, concurrent service-role mutation of distinct original/current account-link journals (observed PostgreSQL lock waits and subsequent metadata denial), unsupported export/summary/send actions, registration capability injection denial and preservation, revisions/retry/audit, private raw ACL denial including service_role, own activity minimization, and nonempty event preservation. Two earlier runs stopped at test-fixture adaptations (new journal requirement, explicit consent default); their logs remain preserved. CI and independent review results must be recorded separately by the coordinator.

The ACL tests deliberately include inherited default privileges. RLS does not remove table grants; the candidate revokes raw table rights in addition to enabling RLS. See official [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

Remaining gates: independent exact-source review; integrated exact-head CI; source/record/identity provenance approval; actual provider/Auth/Partner host compatibility and recovery acceptance; separately authorized install and UI integration. All production, contacts, grants, messages and payment systems remain untouched.
