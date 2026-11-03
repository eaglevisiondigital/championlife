# First backoffice composition — source only

Production base: `999f4a75eeb8e4a05580dc603dda39ba64eb0409`.
Frozen staff source: PR #61 `fe0cc5b4219b17d18867c4d2a588f2f42ac82ae3`.
Accepted Outreach source: PR #72 `eb7ad80c322fe3664273c38f56d176b1e28e1583`.

This separately identified website candidate integrates existing reviewed functionality; it does not change the frozen branch. It is not permission, hosted-test, or deployment authorization.

## Exact composition

- Copy the frozen shell CSS, `staff-session.js`, `staff-workspace.js`, `staff-home.html`, `staff-people.html`, and `staff-outreach-registration.html` byte-for-byte. They preserve one login, current user/logout, scoped Church/Outreach navigation, responsive layout and Powered by Propel branding.
- Select the two complete, later reviewed `outreach-people.js` and `outreach-registration-staff.js` blobs from PR #72, rather than splicing older handlers into them. This preserves current identity/generation guards, permission-denial cleanup, detached-control protection, safe walk-up retry, fresh export authorization before printing, and People task creation.
- The public allowlist adds exactly the three shell assets to the existing main allowlist. Main's PR #79 `site.js` and every other public source outside these eight runtime paths remain unchanged.
- No SQL, schema, grant, backend function, provider configuration, SDK or dependency-lock change. Existing source-matched PostgreSQL tests exercise the inherited 26-migration local test chain; this is not the separately sealed 27-migration hosted setup and must not substitute for it.
- Reuse the focused frozen-shell and PR #72 tests. A new composition manifest checks exact selected and preserved blobs. CI runs shell, People and registration browser suites in independent groups, plus native checks; existing full regression CI remains in place.

The machine-readable provenance is `tools/backoffice-composition/source-manifest.json`. Frozen PR #61's historical architecture/state/security notes are not copied over current main, nor are the unrelated PR #72 summary prototypes, issuer designs, or old branch ancestry merged.

## Authorization boundaries

Organization People/task access still requires the existing current, verified organization permissions enforced by the backend. Campaign-only registration access does not confer People, finance, decision, pastoral, export or messaging authority. This candidate contains no PR #80–83 campaign-decision API mounting, source mapping, assignment provisioning or migrations.

People tasks are operational titles and optional due dates tied to an existing organization Person. Creation sends no assignee or client actor; a lost/malformed write result retires the form and offers read-only refresh, never automatic replay. This is not a new assignment or an exactly-once backend guarantee. Already submitted requests cannot be canceled by later navigation, but their stale responses cannot restore an old view.

## Release and acceptance holds

Local mock Auth/browser and disposable PostgreSQL checks do not establish genuine Supabase authentication, provider session retirement, live schema compatibility or actual staff authority.

The witnessed independent recovery rehearsal remains required: actual independent device/network, MFA, scoped emergency/deletion authority, separately authorized disposable target and independent cleanup verifier. No resource operation is performed by this candidate.

Genuine Auth acceptance must name this new exact source, not silently reuse a frozen-source approval. The current build's protected-preview backend allowlist is unchanged and contains historical isolated project IDs only. A new isolated target requires its own reviewed exact backend pin and protected preview configuration; missing or invalid pin must keep access disabled without production fallback. Do not put credentials in Git or reuse production data.

After recovery and separately authorized genuine Auth/permissions/revocation/mobile acceptance and cleanup, request a website-only release of the exact reviewed commit. Preserve current production deployment for rollback. Website rollback does not undo already committed staff actions; existing database audits and records must remain intact. No SQL or staff grants belong in this release.
