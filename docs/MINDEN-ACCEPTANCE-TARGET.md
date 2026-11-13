# Minden exact-target acceptance proposal — not installed

Source baseline: PR151 `fa4f607353fc555b471c4447f4f2fccbab2b45dd`.
This source correction does not install SQL, configure provider settings,
create a preview, grant access, publish Minden or activate registration.

## Exact proposed boundaries

| Setting | Required value / constraint |
| --- | --- |
| Isolated Supabase project | `apovvmvuljfspobribjv` only |
| Project URL | `https://apovvmvuljfspobribjv.supabase.co` |
| Proposed preview origin | `https://minden-acceptance--championlifechurch.netlify.app` |
| Preview status | **PROPOSED / UNCREATED**, not verified as protected or deployed |
| Existing Netlify site | `championlifechurch`, site ID `2b2af9ba-7001-4e96-9aef-44f012cc4397` |
| Build context | `branch-deploy` or `deploy-preview` only |
| Build `DEPLOY_PRIME_URL` | Exact proposed preview origin; no suffix, path or alternate origin |
| Browser publishable key | Must independently match this project; no real value included here |
| Gateway `OUTREACH_MODE` | `acceptance` only |
| Gateway `OUTREACH_ALLOWED_ORIGINS` | Exactly the one proposed origin, no additional origin or wildcard |
| Gateway `OUTREACH_TURNSTILE_HOSTNAMES` | Exactly `minden-acceptance--championlifechurch.netlify.app` |
| Gateway `OUTREACH_REGISTRATION_TURNSTILE_ACTION` | `outreach-registration` |
| Canonical gateway campaign | `minden-family-fun-day` only |

The new target rejects production mode even when an ordinary Turnstile secret
is configured. Wrong campaign, wrong origin, mismatched hostname/action and
malformed preview configuration cannot become an accepted target write. The
previous two acceptance profiles remain unchanged. Production build output
keeps its original source configuration; preview environment values cannot
replace it. Unknown preview projects and privileged browser keys still fail
closed. No source grants, RLS, runtime registration controls or SQL changed. The only
public source-byte change is the reader sign-in href described below.

## Public function JWT prerequisite

The actual existing public browser submission sends Content-Type and a CAPTCHA
payload, without an Auth JWT or API-key bearer workaround. Supabase's default
platform `verify_jwt=true` can reject it before the application handler runs.
The reviewed proposal is the **single-function**, target-specific template
`supabase/release/minden-acceptance-functions.toml`. It is not active
`supabase/config.toml`, does not execute, and must not be copied globally.

A separately approved deployment must set `verify_jwt=false` only for
`outreach-registration-submit` on the exact isolated target. The handler's
origin, size, CAPTCHA, action/hostname, trusted-ingress HMAC and dedicated
service-only canonical RPC safeguards remain mandatory. Neither CORS nor a
public publishable key is staff authorization. All staff/decision/People
permissions remain in their existing canonical contracts.

Current official references (inspected November 13):
- https://supabase.com/docs/guides/functions/auth-headers
- https://supabase.com/docs/guides/functions/cors
- https://supabase.com/docs/guides/functions/secrets
No SDK, CLI, server wrapper or dependency version was upgraded.

## Separate hosted prerequisites — all HOLD

1. Revalidate exact target identity and provider profile against the approved
   immutable installer. The coordinator's fresh read-only metadata records an
   empty application target with no Edge Functions/migration history and no
   required Minden contracts or private book bucket. This source change cannot
   make those absent contracts operational.
2. Obtain the separate exact-scope installation, recovery and cleanup approvals.
   Preserve sealed candidate hashes, UNKNOWN quarantine, USB/evidence custody
   and mandatory witnessing. No populated project may be substituted.
3. Approve an immutable reviewed preview source, protection layer, owner access,
   exact alias ownership and isolation from production. The alias above is an
   operator proposal, not proof that DNS or protection exists.
4. Separately approve only this target's Edge Function deployment/configuration,
   server-held credentials, network pepper, CAPTCHA setup and allowed origins.
   Real values belong only in approved private/provider custody, never GitHub,
   browser configuration or this document. No credential is supplied by this
   candidate. Verify actual trusted ingress before acceptance writes.
5. Independently verify the target's nonsecret publishable-key binding, Auth URL
   and redirect allowlist, OTP/email restrictions, private Storage object and
   policy, and genuine current-session RLS. Those settings are not inferred
   from local fake transport tests.
6. Louisiana legal/guardian/media wording, local host consent and bicycle rules,
   reviewed decision source mapping, finite Minden-only staff assignments and
   any acceptance data creation remain separately held. Campaign stays draft
   and disabled for household preregistration. The draft/source migration also
   expands the anonymous decision INSERT source allowlist to Minden: a future
   installation approval must expressly cover that exposure. It is not an
   all-intake disabled switch. The unsafe original149 decision-view SQL must
   be excluded entirely from the proposed installation sequence. No real
   donor/learner/household information is authorized.

## Auth URL findings and exact proposed callbacks

The coordinator's authorized November 13 dashboard inspection found Site URL
`http://localhost:3000` and **zero** Redirect URLs. Email and signup are enabled,
email confirmation is enabled, and anonymous sign-ins/manual linking are off.
Those are observed settings, not approval to create users or send mail.

Only after separate approval, propose the Site URL as the exact protected alias
above and these concrete Redirect URLs (no wildcard):

- `https://minden-acceptance--championlifechurch.netlify.app/discipleship-login.html`
- `https://minden-acceptance--championlifechurch.netlify.app/discipleship-login.html?next=%2Fmy-discipleship.html`
- `https://minden-acceptance--championlifechurch.netlify.app/discipleship-login.html?next=%2Fking-kind-reader.html`
- `https://minden-acceptance--championlifechurch.netlify.app/discipleship-login.html?next=%2Fstaff-people.html`
- `https://minden-acceptance--championlifechurch.netlify.app/discipleship-login.html?next=%2Fstaff-outreach-registration.html`
- `https://minden-acceptance--championlifechurch.netlify.app/discipleship-login.html?next=%2Fstaff-minden-decisions.html`

The bare callback is emitted by both actual Minden public forms. The login page
constructs the encoded `next` query using `URL.searchParams`; its default is
`/my-discipleship.html`. The existing Staff logout uses `/staff-people.html`,
and the registration sign-in path encodes its current pathname/search. The
remaining fixed destinations are the proposed bounded operator test routes;
they do not grant those modules' permissions. If a target campaign query is
needed, approve that exact generated callback after the real target UUID is
known, without expanding to arbitrary queries or wildcard URLs.

The reader HTML's previous absolute production sign-in link was independently
identified as an isolation defect. This candidate changes only that href to
`/discipleship-login.html?next=%2Fking-kind-reader.html`: preview sign-in remains
on the protected preview, while its resolved production destination stays
exactly the same. Actual HTML URL-resolution regression checks cover both
origins. Do not authorize a production callback as a workaround. Turnstile's actual provider hostname
allowlist remains unverified; local handler hostname checks are not proof of
Cloudflare configuration.

### Remaining reader/login presentation and SDK dependency

The four Minden entry pages were previously pinned to Supabase 2.118.0/SRI in
PR151. The existing `king-kind-reader.html` and `discipleship-login.html` still
reference floating `@supabase/supabase-js@2`; this candidate does not claim an
entire source-pinned book/login SDK journey. Their exact SDK selection and
provider behavior must be reconciled before genuine journey acceptance. The
reader's legacy error copy also names only Bessemer/Huntsville; it is not proof
that Minden entitlement has been installed or verified.

The actual existing login `sanitizeNext` accepts the fixed same-origin Minden
decision, registration and book paths, and rejects absolute/protocol-relative
production return hints. This is a navigation policy, not a module grant.
No replacement identity system or permission expansion is introduced.

## Local verification

The new focused tests exercise exact target/origin/context selection, actual
build configuration, production preservation, gateway rejection before provider
or database calls, CAPTCHA failure, campaign isolation and response projection.
Existing build/security and registration gateway tests are retained. Transport
is fictional; successful synthetic responses are not hosted acceptance.

Shortest next action: independently review this source candidate and the
coordinator's exact installation ordering/metadata findings. Request the next
bounded owner approval only after installer/evidence custody and cleanup gates
are satisfied. **Installation HOLD; production release NO-GO.**
