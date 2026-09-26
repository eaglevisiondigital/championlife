# Historical migration recovery

September 26, 2026. The original Supabase history was read again and matched the recovered evidence. All 17 entries contain one SQL statement string. The ten existing files match that history after trimming outer whitespace and were not modified. Seven missing files were restored byte-for-byte from their recorded SQL under original versions/names:

| Version | Name |
|---|---|
| 20260923114743 | create_course_progress_schema |
| 20260923114822 | harden_course_security_and_indexes |
| 20260923115114 | revoke_public_rls_helper_execution |
| 20260923115706 | grant_authenticated_course_api_access |
| 20260923115732 | restrict_authenticated_course_privileges |
| 20260923121707 | add_st_lucia_registration_and_account_linking |
| 20260923122017 | secure_st_lucia_registration_claim_after_login |

These are already-applied historical migrations, not new changes. Some early policies/functions are intentionally superseded by later hardening. Never deploy an intermediate prefix, edit historical SQL, replay against production or repair live history merely to align tooling.

## Repeatable local validation

```
npm ci --ignore-scripts --prefix tools/backend-tests
npm run test:migrations --prefix tools/backend-tests
npm test --prefix tools/backend-tests
```

No production credentials or running server required. PGlite creates a fresh in-memory PostgreSQL database and closes it after the run. `fixtures/supabase-test-bootstrap.sql` supplies minimal synthetic Auth roles/schema and the pre-existing platform rls_auto_enable helper referenced by historical migration 3. The helper definition was captured from metadata; it is a platform prerequisite, not invented migration history. No auto-RLS event trigger is installed, so missing explicit application RLS cannot be hidden by the fixture. This is not a blank managed Supabase/GoTrue/PostgREST emulator.

`fixtures/migration-baseline.json` contains only schema metadata: exact file hashes, table/RLS inventory, complete policy definitions and whitespace-normalized function hashes from the audited live catalog. It contains no user records or conversation transcripts. The test checks the exact migration inventory, unique versions and hashes, ordered replay, all 32 table names/RLS flags, all 60 policy definitions, all 35 function identities/definitions and important RPC/directory grants. Missing/renamed/changed migrations or schema drift fail loudly.

For a future reviewed migration, append its actual identity/hash, update expected final schema deliberately from an isolated replay and review the resulting diff. Never regenerate old hashes to make an accidental historical edit pass. Existing baseline hashes remain immutable. A newer migration that intentionally changes definitions requires an explicit expected-schema update and behavior tests. Do not make the test auto-approve its own generated output.

The historical chain includes original reference course/organization seed configuration. Those rows are part of applied SQL, not copied customer records. Synthetic behavior fixtures remain in the existing focused suites. These suites use minimal prior-schema fixtures for targeted behavior, while this new full-chain check independently validates reconstruction; neither substitutes for live Auth/browser acceptance.

CI runs the same test command without Supabase secrets. This package adds no db push, remote reset, migration repair, deployment or staff provisioning step.
