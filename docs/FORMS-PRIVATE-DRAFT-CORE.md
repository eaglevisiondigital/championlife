# Canonical private Forms draft core — source candidate

This current-main package recovers the existing GIV-2C form-definition editor and
canonical storage without installing its Giving/submission dependency closure.
It is not installed and does not replace `baptism-interest.html`, Netlify Forms,
Supabase Auth, the staff permission system or any accepted frozen staff shell.

## Exact source and scope

- Base: `999f4a75eeb8e4a05580dc603dda39ba64eb0409`.
- Canonical GIV-2C: `edf82fb34e8db448a0d6c6465a3799c75993d5a2`;
  original SQL SHA256 `d6be09498385749c9648cf8c40475c8f94533271bc45a2736b76881af15bb313`.
- Private editor/template corrections reused from PR92
  `1beaeaf7012b1d487c9cc3dd4020b9c66da3ed0a`.
- One forward migration: `20261104042117_forms_private_draft_core.sql`.
- Two module entry points: `staff-forms.html`, `staff-form-builder.html`, using
  existing Champion Life Auth and current-main staff session presentation.
- Both entry points pin Supabase 2.118.0 with the accepted SHA384 SRI. Existing
  pages, public baptism fields, logos, navigation and shared Auth remain unchanged.

`tools/forms-core/provenance.json` binds nine original table definitions byte for
byte: forms, versions, sections, fields, conditions, payments, instances, private
form grants and immutable audit. Payment/instance tables remain dormant. No
submission, answer, agreement, file, event or rate tables are fabricated. No
Giving tables, providers, financial grants or communication queues are imported.

## Executable capability and permission contract

The existing `forms_workspace(text,uuid,jsonb)` signature exposes exactly
`context`, `list`, `create`, `get`, `draft`, `save`. Every other action is denied
before dispatch. The explicit `private_draft_v1` capability response marks
publication, financial operations and response collection unavailable; list
submission counts are null, not an invented zero. The UI hides unsupported
operations and offers only blank private drafts or the approved baptism template.
The template has the same eight collection fields as the existing public source.
A preview never submits answers or enables a provider.

The permission registry gains only `forms.read`, `forms.create`, `forms.edit`.
Existing legacy `forms.view`/`forms.manage` do not silently gain these rights.
No real permission rows or users are inserted. Organization-wide directory
permission and existing exact-form/campaign grant semantics remain distinct.
Scoped form access does not grant organization-wide People or directory access.
There is no executable grant issuer in this package.

All raw tables have RLS and no direct PUBLIC, anon, authenticated or service-role
privileges, including inherited TRUNCATE/REFERENCES/TRIGGER/MAINTAIN. Private
helpers deny execution; authenticated receives only the guarded public workspace
wrapper and its private dispatcher. Installation requires the reviewed postgres
owner and exact fingerprints of existing authority helpers. Unknown registry,
partial/repeated Forms installations and incompatible authority definitions abort.
The registry explicitly accepts the original keys with or without the separately
reviewed Dream Team two-key extension and preserves that union.

## Transactions, privacy and audit

Mutation ordering uses existing organization/portal advisory locks, canonical
Forms serialization, target form/version row locks and shared authority-row locks.
Fresh wall-clock checks occur after blocking target locks and before writes.
Native CI exercises separate sessions: concurrent revisions, completed revocation
while blocked on the actual version row, expiry during the wait, revocation that
must follow an already serialized save, timeout rollback, scoped grant revocation
and audit failure. Single-connection PGlite results do not prove these races.

Create retries reuse only an identical original creator/slug/payload at revision1;
changed or another creator's requests conflict. Save requires an exact positive
JSON integer matching current revision. Failures roll back definitions, compiled
children, revision and audit. Successful audit records preserve actor, action,
form and subject version UUID. They are append-only, but **do not contain a full
before/after definition snapshot for every draft revision**. No stronger audit
history is claimed.

The module captures current account/client, organization and navigation generation.
Fresh Auth identity is checked before and after RPC, including transport failures.
Sign-out, account changes, explicit denial and navigation retirement clear drafts
and controls. Same-authority stale denial still clears current protected state;
old-account denial cannot invalidate a freshly authorized account. Detached
controls cannot submit. Refresh never restores content without authorization.

## Validation and release boundaries

`core.test.mjs` runs the accepted 27-source current-schema fixture (26 committed
migrations plus the separately applied accepted reader release), not the retired
installation scripts: 49 public tables, 76 application functions, 64 policies.
It checks source hashes, old catalog preservation, ACLs, authorization, input
rejection, idempotency, revision/audit rollback, unsupported capabilities and
non-destructive shutdown. It also runs against isolated native PostgreSQL in CI.
`native-concurrency.mjs` uses real separate sessions in a dedicated loopback CI
PostgreSQL17 container. No hosted connection is accepted by the harness.
`browser.test.mjs` uses fictional Auth/RPC fixtures with actual current-main page
scripts, Chromium/WebKit at 390/1440px; this is not genuine Auth/provider evidence.
`build-integrity.mjs` proves two identical public builds and preserves key current
production files and accepted SDK SRI.

A failed installation transaction rolls back to the old catalog. After any real
data exists, recovery must disable/revoke the workspace entry point while retaining
canonical drafts, IDs and audit; do not drop tables or replay the old installer.
A future full Forms extension requires its own reviewed additive migration and
exact dependency/record-preservation tests. This package does not certify that
unwritten upgrade or activate previously unavailable actions.

Remaining hosted gates: exact-target schema/owner/default ACL verification;
managed Supabase Auth owner row-lock authority and private-schema Data API exposure
confirmation; fresh genuine Auth, revocation and least-privilege acceptance;
independent recovery/custody/cleanup; separately authorized migration and website
release. No production policy, real account, grant, public form, message, payment
or hosted resource is changed by these local tests.

## Managed Auth execution-owner contract — November 4

`tools/forms-core/fixtures/managed-auth-catalog.sql` is a SELECT-only catalog
proposal: planned execution role, actual sensitive function owners, Auth table
owner/ACL/RLS, required-column SELECT and table/column UPDATE privileges. It
reads no Auth records, takes no row locks, invokes no workspace RPC and changes
no privileges. Its source presence does not authorize a hosted query. Positive
metadata is a prerequisite, not a claim that a managed provider accepted execution.

PostgreSQL requires UPDATE on at least one column for SELECT FOR SHARE, in
addition to the required SELECT privileges. The new disposable contract test
models SELECT-only failure and verifies zero draft/audit effects, then rolls back
all fictional role/ACL/owner changes. A separate synthetic column-UPDATE metadata
case checks detection only; it is not an instruction to grant UPDATE on production
Auth. Exact target provider guidance remains required. The original migration and
runtime stay unchanged; no weaker fallback or permission escalation is introduced.

The 15-check contract runs with PGlite locally and an independent empty PostgreSQL17
CI service. This does not replace native concurrency, genuine Supabase Auth,
managed-role/RLS acceptance or recovery evidence. Existing source and build checks
are reused when unchanged. Sources: [PostgreSQL SELECT privileges](https://www.postgresql.org/docs/17/sql-select.html)
and [Supabase function security](https://supabase.com/docs/guides/database/functions).
