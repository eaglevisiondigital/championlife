# Staff / Outreach integration entry — source-only successor

Base: PR #72 `b2f16a2bb2255115c83d0d55009ce483e5185434`.
The public shell, public allowlist, SQL and existing Auth client are unchanged.

## Implemented

`tools/outreach/church-outreach-summary-entry.mjs` exports
`installStaffOutreachSummary({window})`. A future explicitly reviewed consumer can
call it once after importing this source module. It can be installed before the
accepted staff shell finishes discovery: it waits for `StaffWorkspace.active()`,
the visible protected main, and the actual authorized Outreach selector. It then
calls the existing reviewed staff mount. Duplicate installation in the same
document returns the existing handle and does not make duplicate requests.

The entrypoint adds no client, backend, permission, roster, mutation, exported
person data or browser storage. Five event-registration aggregates remain
separate from decisions, private notes and financial records. Church is unchanged;
Partners remains the third shared-principal context but is not fabricated or
advertised by this Outreach module. A future Partner adapter must have its own
reviewed backend permission binding before the shell exposes it.

On protected clear, signout, scope selection, logout click, pagehide, hidden or
removed protected main, teardown removes the owned section and subscriptions.
The optional AbortSignal added to the existing mount immediately invalidates its
consumer during a pending initial load; delayed results cannot start another RPC
or restore the view. This is local consumer invalidation, not proof a provider
request has been physically canceled or a hosted session retired. A stopped
installation cannot silently reacquire authority; the shell requires a fresh
page/session verification. Every count still passes the existing provider user
verification and server context → list → context authorization sequence.

## Local acceptance

The workflow runs the existing summary/unit/native suite plus new entry lifecycle
cases. Chromium and WebKit mount the actual frozen staff HTML at 390, 768 and
1440px with fully intercepted fictional Auth/RPC. New cases hold actual shell
discovery, prove zero premature summary calls, compose automatically, retain one
Auth client, abort initial authorization, and reject retained handlers after
teardown. No hosted Auth, real staff acceptance, or provider revocation is claimed.

## Genuine acceptance handoff — do not provision or execute yet

1. Preserve the existing Issue #62 decisions: the primary custodian, primary
   operator and maintenance owner have accepted; owner-controlled test mailboxes
   and conditional project cost approval are recorded privately. Do not repeat
   those questions or put mailbox addresses/credentials into source or PRs.
2. Independent recovery/cleanup rehearsal is deferred. Its operator must verify
   independent device/network authority, emergency shutdown, provider-backed
   session retirement, fixture cleanup and retained evidence before provisioning.
3. Pin this exact successor commit, the accepted PR #61 shell and reviewed
   27-migration current-schema baseline/seal in the owner-reviewed test manifest.
   Verify current tables/functions/policies and fingerprints in an EMPTY isolated
   project; do not replay retired installation scripts or copy production data.
4. Preview must have explicit isolated backend pinning and no production fallback.
   Current `tools/site-build/build.mjs` accepts only two historically named preview
   refs. A new approved empty project is NOT automatically covered. Coordinator
   must review the exact temporary project's binding separately before hosting;
   do not substitute the shared sandbox or change the allowlist in this package.
5. Review a minimal preview-only source inclusion of the entry module and its
   existing dependency closure. None are currently public allowlisted. Keep the
   production build unchanged; require access protection, no-store/noindex and a
   verified disable/delete procedure. Do not treat a hidden URL as protection.
6. Using approved mailboxes and fictional records, verify genuine email sign-in,
   account A → B, unverified/unassigned denial, campaign-specific results, original
   navigation/logout/branding, cross-tab logout, background/return, permission
   revocation during pending requests and supported phone/desktop layouts. Inspect
   provider requests and the backend denial, not just absence of DOM controls.
7. Provider signout/token events alone do not prove immediate server revocation:
   Supabase access JWTs may remain valid until expiry. Sensitive provider tests
   must observe authoritative session retirement and denial under the accepted
   backend contract. See https://supabase.com/docs/guides/auth/sessions . Do not
   weaken backend checks or silently add schema changes to achieve a test PASS.
8. Disable preview; retire fictional sessions/accounts/grants and delete only
   identified fixtures/resources through the independently reviewed procedure.
   Preserve immutable audits and independently verify deletion, remaining costs
   and inability to reuse sessions. Retain redacted evidence privately.

Publication of this source-only successor is not hosted acceptance, a staff grant,
production rollout, or activation of Partners/advanced follow-up. No blocked
King Kind migration, recovery package, NMI or GiveHub changes belong here.
