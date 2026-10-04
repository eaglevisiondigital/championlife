# Acceptance preview configuration

This development package prepares a preview; it does not authorize production release, backend provisioning or changes to giving links.

## Public artifact

Netlify runs `node tools/site-build/build.mjs` and publishes `dist/`. The reviewed `tools/site-build/public-files.json` lists 372 public HTML, CSS, browser JS, image/font/media/PDF assets and `_redirects`, at their original URLs. New public files require an explicit manifest addition. Output is recreated, never copied wholesale from the repository. Symlinks, traversal, hidden files, administrative directories and unsupported file types are rejected.

The original root would also expose 88 tracked non-public/build files: source documentation/READMEs, SQL migrations, schema fixtures, tests, tools, workflow/configuration and image-construction text chunks. These are excluded. Server/edge function source stays outside the static artifact; Netlify still bundles existing functions from their original directories. The outer private audit workspace is not in this repository or artifact. No private credential patterns were found in the reviewed public file set; this is a scoped check, not a comprehensive security certification.

Production/local output preserves every manifest file byte-for-byte, including giving pages, redirects and Supabase configuration. Existing main deployment/configuration is untouched. Netlify's build/header/edge definitions remain in source configuration, not public static output. Preview-only noindex headers/robots discourage indexing but are not access control.

## Backend configuration

Source browser configuration remains `assets/js/supabase-config.js`: production URL and public publishable key, unchanged. No service-role/secret key belongs in browser output. Existing local direct-file serving and production builds keep those defaults.

For `CONTEXT=deploy-preview` or `branch-deploy`, the build replaces only the output copy of that file. Set these two variables in Netlify with **Builds scope and Deploy Previews context only**:

- `CHAMPION_PREVIEW_SUPABASE_URL`: canonical `https://<20-character-project-ref>.supabase.co` for an independently verified non-production project/branch.
- `CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY`: its `sb_publishable_...` browser key. This implementation deliberately accepts modern publishable keys only; legacy JWT anon/service-role keys and secret keys are rejected.

Production URL and production publishable key are explicitly rejected in previews. Custom domains, URL paths, credentials, query strings and non-HTTPS endpoints are rejected to prevent aliases concealing the production target. The prefix check does not prove key ownership: Work must verify both values belong to the intended isolated backend. Values are not logged by the build.

If settings are absent/invalid, the build still produces an inspectable preview, but `CHAMPION_LIFE_SUPABASE` is null and backend-dependent pages show an alert. The shared Auth layer returns before creating a client: no production fallback, session restoration or auth/database calls. Unknown Netlify contexts abort the build. No environment-wide variables or production defaults need changing. Rebuild the same preview after supplying valid settings.

Local isolated-output check: `CONTEXT=deploy-preview node tools/site-build/build.mjs`, then serve **dist**, not the source root. An unset/local context intentionally retains existing production defaults; it is not an isolated acceptance setup.

## Auth callbacks

Unchanged login source uses `location.origin + '/discipleship-login.html'` for email return. Typed six-digit OTP verifies in-page with type email. Post-login next is same-origin/route allowlisted, default `/my-discipleship.html`. Ministry resource links retain only valid area/resource UUIDs.

Once Netlify reports a real PR URL, allowlist the exact `https://deploy-preview-<PR-number>--championlifechurch.netlify.app/discipleship-login.html` in **preview Supabase Auth**, not production. Use the observed origin if different. Avoid broad wildcards. Production callback remains `https://championlifefwb.com/discipleship-login.html`. Work must verify preview Site URL, email templates, SMTP/test recipients and redirect settings before test emails. No Auth settings were changed by this package.

## Work acceptance prerequisites and assignment

Recommended thinking level: High.

Work: verify the draft PR remains DO NOT MERGE and its Netlify deployment matches the recorded development SHA. Verify production still shows main at 66591f22d5315d093091b99152c18d43bfcb3893. Check excluded paths such as /CURRENT_BUILD_STATE.md, /docs/PREVIEW-ACCEPTANCE.md, /supabase/migrations/, /tools/site-build/public-files.json, /.env and /netlify/functions/dream-track-auth.mjs cannot be downloaded as static files. Preserve Netlify server-function routes, headers, redirects and mobile asset loading.

Provisioning/costs/schema installation for a preview Supabase project or branch require a separately authorized environment assignment; this package does not create one. Never copy production customer data or use the synthetic PGlite bootstrap as a real Supabase migration. Use the recovered migration chain only within the approved fresh-environment plan; never replay production history.

Verify backend identity, schema/RLS/RPC deployment and synthetic fixtures before setting the two preview variables. Confirm private is absent from Data API exposed schemas; test explicit private Accept-Profile denial with anon/authenticated clients within approved scope. Then set/verify the exact callback and approved synthetic inboxes/accounts. Staff grants, portal account links/tags/resources and multi-organization fixtures must be explicitly provisioned in that isolated backend before privileged-flow acceptance. Production had zero staff grants/portal links at last audit; do not provision production administrators to unblock testing.

Test OTP/link return, invalid/expired codes, logout/account switch, safe next/deep links, discipleship dashboard, lessons 1–13 (worksheets especially 1–4), notes/progress/blank answers/draft isolation, staff permissions and denied finance access, portal eligibility/resources/search/pagination/revocation/history/publication review. Check desktop/mobile and keyboard interactions. Relevant routes: /discipleship-login.html, /my-discipleship.html, /getting-a-grip.html, /getting-a-grip-1.html through /getting-a-grip-13.html, /staff-people.html, /my-ministry.html and /stlucia/.

Backend isolation applies to Supabase, not every external integration. Existing giving URLs and Netlify Forms belong to existing services: do not submit donations, real forms, messages or other external actions. Dream Track retains existing server-side behavior and fallback access-code implementation; do not treat it as strong account authorization. No SDK upgrade/pin is included; actual-library browser acceptance remains necessary.

Return observed SHA/origin/callback, safe account labels, PASS/FAIL/BLOCKED per flow and redacted evidence. No production release/merge, DNS changes, live grants, production migrations or giving replacement. Stop after acceptance and report remaining gates.

## Validation and references

`npm test --prefix tools/backend-tests` runs all 24 existing scripts plus site-build tests. The added checks cover artifact equality/exclusions, unsafe hosts/keys, production fallback rejection, visible blocked state/no client creation, callback origins and symlink/traversal rejection. They use synthetic configuration and make no Supabase requests.

- [Netlify build configuration](https://docs.netlify.com/build/configure-builds/file-based-configuration/)
- [Netlify context environment variables](https://docs.netlify.com/build/configure-builds/environment-variables/)
- [Supabase browser-safe API keys](https://supabase.com/docs/guides/getting-started/api-keys)
