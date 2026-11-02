# Partner host integration: exact remaining dependency gap

Inspected base: PR75 `251ded71f95b43ed8d95f7415e97460bb9e73d74`. This is a source inventory and disposable replay result, not a new host, installation package, migration or permission decision. The existing restricted routine and canonical reader remain unchanged and unmounted. Public Partner metadata remains `personId=null`, `identityStatus=unverified`.

## Reproduced source graph

The complete historical compositions were reproduced byte-for-byte using their original source composers, rather than inferred from the selected canonical test fixture:

| Input or composition | Source | SHA256 |
| --- | --- | --- |
| Operations security | Current `supabase/migrations/20261022201357_operations_admin_security.sql` | `a5cb9ad66faf87db263414c80a89b76a7498025188661691e1d9e196b603304a` |
| Issue50 A | `f06c5a2673e93fc93a2fdbf886aaf165cf468b18:tools/issue50/roster-candidate.sql` | `05988babe65548f26f35001896e0f3859d534c8e7a34cf1392656a3e08d8e4d9` |
| Issue50 B | Same commit, `tools/issue50/package-b-candidate.sql` | `03c3f6b94aadbe4195ecd9cea30463918687518d3c0ed5a630d3c7071d6c0020` |
| Full B1 | Original `tools/issue50/b1/compose.mjs` at `53adb74df0b02c77784e5f00f2fb6b5a64e84baa`, applied to the three inputs above | `578fd9fa7eb6786eea79345039bc4eec0c11a2b779875759b770627eda727f6a` |
| Full B2 | Original `tools/issue50/b2/compose.mjs` at the same commit, applied to A and B | `46d29ac81d565f17b34e41571d47c2b016fe1b2f54242bf8c632562e5b9d7754` |

B1 composes the operations security correction, an explicitly reconciled shared capability constraint, A source mapping/projection/identity journal, and B review/care functions and tables. It also includes public roster, reconciliation and care wrappers with authenticated EXECUTE grants. B2 expects that complete installation and adds assigned-care scoping and replacements for roster, care, identity-admin and reconciliation functions. Therefore neither complete package is a narrow Partner reader installation.

The current Partner fixture replays the 26 migrations in `tools/backend-tests/migration-order.mjs` plus the existing Partner metadata boundary. Its operations security migration is already present. The full B1 package expects the older 36-migration shared baseline and includes guards for pre-correction function bodies. Reapplying that composition would duplicate the already-applied security package and broaden the change beyond the reserved Partner lane. Removing guards or replaying old authenticated wrappers is not an accepted reconciliation.

Fresh disposable PGlite replay confirms these six dependencies are absent before the selected fixture is added:

- `public.outreach_campaign_sources`
- `public.outreach_campaign_followups`
- `private.city_identity_requests`
- `private.city_identity_reviews`
- `private.city_care_requests`
- `private.city_followup_events`

Full B1 stops with SQLSTATE `P0001`, `Unreviewed shared capability boundary`. Full B2 stops with `42P01`, missing `public.outreach_campaign_followups`. Both transactions were rolled back; neither left the identity journal or assigned-care column installed. These are expected compatibility denials, not successful migration acceptance. The selected `fixtures/issue50-identity-source.sql` remains a hash-verified disposable subset, not a substitute deployable chain.

## Existing principal and operation paths

| Existing component | Actual responsibility | Missing connection |
| --- | --- | --- |
| Staff pages and `assets/js/staff-workspace.js` | Browser SDK 2.118.0, provider `auth.getUser()`, shared identity and session retirement | Browser verification cannot issue a trusted server principal for a privileged database connection |
| `assets/js/champion-life-auth.js` | Its convenience `getUser()` returns `getSession().user` | Cached user data is not a server authentication boundary |
| `tools/outreach/shared-staff-backend.mjs` | Source-only browser adapter verifies `client.auth.getUser(access_token)` before/after fixed RPC calls and retires changed tokens | Assigned portal discovery remains unavailable; this adapter never constructs a server principal or database connection |
| `supabase/functions/outreach-partner-submit` and `outreach-registration-submit` | Existing public submission gateways | Neither is an authenticated Partner read host; their service credentials cannot be reused to bypass the restricted reader |
| `netlify/edge-functions/dream-track-protect.js` | Existing unrelated cookie gate | Does not establish a Supabase Person, user or session |
| `canonical-identity-boundary.mjs` | Validates exact current provenance and principal lifetime; returns only verified Person ID | `getPrincipal` is a trusted dependency, currently supplied only by fictional tests |
| `canonical-pg-repository.mjs` | Fresh disposable local pg8.23.1 connection; private raw client, cancellation, transaction ownership, restricted role | Its owner connection and SET ROLE are fixture mechanics, not an approved login credential |
| `canonical-host-envelope.sql` and verifier | Fixed nonpublic routine; NOLOGIN caller with no members, direct data privileges or other application-definer execution | A real login/membership change deliberately fails current verification and requires separate review |

The existing canonical transaction already locks current actor/session, campaign, Partner/worker grants, exact assignment, source mapping, source consent, Person/account, reviews and immutable receipts/audits. No missing grant should be inferred from a partner label, intake role, email, donor status or verified user alone. The real provider Auth catalog also differs from the deliberately synthetic manifest; no fingerprint was changed to accommodate it.

Official [getUser documentation](https://supabase.com/docs/reference/javascript/auth-getuser) supports server verification of the presented token. [getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims) verifies token claims; it is not a replacement for current assignment/session checks. Supabase [session guidance](https://supabase.com/docs/guides/auth/sessions) documents the `session_id` binding and checking its current row after sign-out. The next implementation must validate one exact token at trusted ingress, derive user/session from that validated token, retain current-session checks and transaction locks, and retire work on token/request cancellation. It must never accept a browser-supplied `{verified:true,userId,sessionId}` as that proof. No new SDK call or provider behavior was implemented. Changelog markdown and HTML retrieval both failed in this review; no version-specific compatibility assertion is made.

## Validation and held work

New dependency investigation: 16 assertions PASS covering exact full-composition reconstruction, six missing baseline relations, both compatibility denials and rollback. Existing canonical repository and restricted-envelope suites: 101 tests PASS. Private reproducible probe and logs are retained in the coordinator audit workspace; they are excluded from publication. No Mac PostgreSQL cluster was launched, and no new native-concurrency, genuine-provider or hosted acceptance is claimed. Prior exact-head CI remains the evidence for unchanged native runtime behavior.

No runtime defect was established that justifies another source adapter, identity store or simulated provider. No implementation, SQL, grant, provenance pin, public manifest, website shell or dependency version changed. A host mount requires all of these independently reviewed inputs:

1. A complete current-base Issue50 installation plan that preserves already-applied security, reviews public-wrapper disposition, and reconciles capability and writer dependencies without replaying historical grants.
2. An authorized real provider catalog and token/session contract, without loosening the synthetic manifest merely to pass.
3. A selected existing server deployment target and restricted credential/membership/custody design; no owner/service-role connection or browser-controlled actor substitution.
4. Exact source review and isolated native/provider acceptance before separately authorized installation and release. PR61 stays schema-free and unchanged.

## Copy-and-paste continuation assignment

Recommended thinking level: HIGH. Inspect PR75 at the exact reviewed head and this dependency map. Reuse the canonical repository, fixed routine and current locks. Reconcile accepted Issue50 A/B/B1/B2 against the current migration order and existing operations-security correction, explicitly accounting for every public wrapper and grant; do not copy historical broad access or regenerate accepted fingerprints. Identify the existing approved private server target and actual provider token/session/catalog contract before coding its ingress or login-role binding. Return a reviewable current-base installation/host plan and the smallest source-only implementation it supports. Preserve Person/account ownership, independent reviewed identity, assigned campaign/record scopes, revocation and minimized output. No hosted queries/resources, credentials, real grants, messages, payments, migrations applied, public mount or deploy. If those inputs remain absent, return their precise owners and evidence requirements instead of a provider stub. No product-policy decision is requested by this source inventory.
