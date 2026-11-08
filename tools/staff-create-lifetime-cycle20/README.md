# Canonical Person task-create control lifetime

Base: exact draft PR121 `4a7a04c3bb5f38c3e7571b42a3be6401d0a0bdf1`.

Only `addTaskEditor` in the actual Staff People runtime changes. A document
removal permanently retires the original create form, card, ancestor chain,
labels and controls, even if they are reinserted before pending permission
verification finishes. Live and default title/date values clear. Mutation
records are drained synchronously at every admission boundary.

A submitted INSERT is not claimed canceled or rolled back. Lost or malformed
responses retain the existing uncertain-outcome hold. The original submit
cannot replay; the only retained action is a current-account read-only refresh,
which permanently retires if removed. No new idempotency, identity association,
permission, campaign assignment, backend service or SQL is introduced.

The stronger Staff actor/client request fence and all existing task editing,
history, filtering, pagination, permissions, public files and branding remain
unchanged. Historical PR121/117 CI shutdown failures and original WebKit evidence
remain preserved; this source correction does not resolve them.

`source.mjs` verifies actual files against exact121 plus explicit fixed recipe
changes before any19/16/14/9 historical projection. Historical assertions,
workflows, source pins and timeouts remain unchanged. Build checks bind the
actual current runtime and all 430 public outputs. New additions are explicitly
listed and hashed. Only the guard itself is bound by independent source review
and exact commit, avoiding a circular self-hash.

Local fictional tests are not genuine Supabase Auth/RLS acceptance. Release,
hosted operations, real grants, messages, payments and recovery remain NO-GO.
