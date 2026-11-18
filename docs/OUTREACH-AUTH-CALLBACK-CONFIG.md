# Outreach callback configuration preparation — November 18, 2026

Issue159 [comment6976832205](https://github.com/eaglevisiondigital/championlife/issues/159#issuecomment-6976832205) authorizes implementation/testing from `d526c259e5d19a1f56b99e3e4eb7473330f0e4ae`. It does not authorize production configuration, deployment, accounts/grants, messages or a paid resource. This package prepares an exact change and guarded rollback; it performs neither. The callback page, generator, canonical originals and all published files remain byte-identical.

## Corrected provider interpretation

The November18 read-only dashboard receipt establishes Site URL `https://championlifefwb.com`, one explicit redirect `https://championlifefwb.com/discipleship-login.html`, and absence of the explicit Outreach entry. **Absence alone does not establish a provider rejection or broken production callback.** The earlier release report overstated that inference; the observed configuration and original receipt remain preserved.

Current upstream [Supabase Auth redirect validation](https://github.com/supabase/auth/blob/26adce254d2119a59e72454364a079d88b43a00f/internal/utilities/request.go) accepts a redirect sharing the Site URL's scheme, hostname and port before consulting explicit entries. For other origins, its matcher removes fragments but retains queries. The corresponding [provider tests](https://github.com/supabase/auth/blob/26adce254d2119a59e72454364a079d88b43a00f/internal/utilities/request_test.go) and [redirect guide](https://supabase.com/docs/guides/auth/redirect-urls) are primary references. The changelog was checked; no relevant newer redirect breaking change was found. Provenance, source SHA256 and scope are pinned in `tools/outreach-login/provider-policy-provenance.json`; the deployed production Auth version was not probed or verified.

The actual generated `emailRedirectTo` is:

```text
https://championlifefwb.com/outreach-login.html?next=%2Foutreach-team.html%3Fcampaign%3D11111111-1111-4111-8111-111111111111
```

The campaign above is synthetic. Under the pinned upstream policy, that URL is accepted with the recorded production Site URL both before and after the proposed addition. The bare exact allowlist entry would not itself match this query if the Site URL origin differed. Do not generalize the production fixture to preview/custom domains. No wildcard, new query pattern, Site URL change or destination-stripping workaround is justified here. Preserve the tested event query and blocked-storage/cross-browser return behavior. Adding the exact entry is the expressly requested configuration package; it does not constrain the provider's broader same-Site-URL acceptance and is not an application authorization boundary.

This is a bounded policy fixture using actual generated page code, not a running GoTrue instance, deployed-version measurement, email delivery or genuine production secure-link acceptance. Prior genuine isolated signup/code acceptance remains separate. Production template construction, delivered links and effective provider behavior still require separately authorized validation; neither the source fixture nor the explicit entry proves those outcomes.

## Exact additive diff and rollback

Target: production project `exdocjbmylgxssanymjk`. [The generated proposal](releases/outreach-auth-callback-config.json) is executable-review output from:

```sh
node tools/outreach-login/callback-config.mjs --plan
```

The sole proposed provider payload for `PATCH /v1/projects/exdocjbmylgxssanymjk/config/auth` is:

```json
{"uri_allow_list":"https://championlifefwb.com/discipleship-login.html,https://championlifefwb.com/outreach-login.html"}
```

The sole rollback payload is:

```json
{"uri_allow_list":"https://championlifefwb.com/discipleship-login.html"}
```

The module contains no HTTP/provider client or write command. The currently exposed Supabase connector has no Auth-configuration mutation tool. After separate exact-target approval, an authorized operator can use Dashboard → Authentication → URL Configuration to add only `https://championlifefwb.com/outreach-login.html`, leaving Site URL and the existing entry intact. Alternatively a separately reviewed Management API caller can submit only the payload above; [the official API endpoint](https://supabase.com/docs/reference/api/v1-update-auth-service-config) documents PATCH. This task supplies no authenticated caller and requests no new credential. Never use SQL/migrations to bypass Auth configuration, copy isolated global SMTP/templates, or replace the allowlist with only Outreach.

Before any future save, read the fresh target and record the nonsecret configuration privately. Require the exact recorded Site URL and sole original redirect, no wildcard, extra entry or concurrent drift. Inspect the same URL Configuration save to ensure only one additional exact entry. Preserve SMTP/sender/template/Auth/DreamTrack settings; do not retrieve hidden credentials. Record safe visible values or existing authorized change receipts for fields that are redacted. A comparison can prove equality only for the fields supplied to it; redaction is not byte-level proof of an unseen credential. The proposed one-field patch never transmits SMTP/template/credential fields.

`callback-config.mjs` exports pure checks for before, after, rollback-preflight and restored snapshots. A private JSON input has `mode`, `projectRef`, `baseline` and, except before, `current`. The snapshots use provider keys `site_url` and comma-separated `uri_allow_list`, plus every safely observed retained field. Run:

```sh
node tools/outreach-login/callback-config.mjs --check /absolute/private/nonsecret-review.json
```

Modes are `before`, `after`, `rollback` and `restored`. Success returns only mode/target/PASS/no-provider-write. Failures return a fixed refusal code, never raw comparison values or provider errors. Wrong/obsolete project, baseline drift, duplicates, wildcard/replaced/missing/unexpected redirects and changes to any supplied retained/unknown field refuse. Rollback requires the exact original baseline and its sole addition; any later list or supplied-setting change stops rollback for fresh review. The tools never restore an entire stale configuration, and no claim of provider CAS/atomicity is made: an authorized future operator must check fresh state immediately around save and stop on drift. Removing the explicit entry does not revoke same-origin redirect acceptance, sessions or already issued links.

## Validation and preserved contracts

`npm run test:outreach-callback --prefix tools/backend-tests` checks exact change/rollback, drift refusals, immutable inputs and redacted CLI failures. Its bounded regular-HTTP/literal-entry policy fixture is linked to the pinned source, including the distinction between same-Site-URL acceptance and query-sensitive literal matching. It executes the actual unchanged generated inline page at the production origin with synthetic SDK/session facts and blocked storage: signup/email/magiclink callback round trips, manual6/8-digit codes, event destination preservation, auth-event races, duplicate token/type/query/fragment combinations, missing session, initialization/provider errors and history credential scrubbing. It performs no provider request.

The existing equivalent165-scenario login matrix,94staff-session assertions,32branding/preservation checks,109focused signup checks and16email-template checks remain in `test:outreach-login`. The existing Chrome/WebKit visual and focused signup runners remain unchanged and intercepted, with all real provider traffic refused. This package adds no new runtime behavior; the earlier named single signup-fragment predicate delta remains the only Auth behavioral difference from canonical login. The original canonical login/shared Auth/session/SOWGO logo hashes, P0 confirmation contracts, P1 SQL, manifest and publication patch stay pinned.

Final local result:159 new assertions across30 generated-page scenarios PASS; all prior login/session/signup/email checks above PASS; Chrome/WebKit224focused signup and108visual checks PASS; complete `npm test --prefix tools/backend-tests` exit0;426-file public build PASS. All426 public source bytes and the unchanged callback/generator/canonical/SQL/publication preservation paths were compared against the reviewed base. Initial headless launches failed under the filesystem sandbox before any scenario; the same unchanged runners passed after authorized local browser-process escalation. Both failure and successful logs remain private. These results do not claim exact-head CI or a hosted production test.

## Handoff and remaining authority

Implementation/testing preparation is complete when the recorded local suites pass. Production configuration is UNAPPLIED; no new project, account, grant, key or message was created. No production compatibility success, config application, deployment or CI result is implied by local tests. The parent records complete integration/exact-head CI separately and independently owns the new disabled notification implementation. Notification policy/send activation remains a separate decision. Roddy, **Kelsea**, Danielle remain future planning only until exact verified login identities/duties/scopes are approved.

The single next owner action is review the integrated exact callback/disabled-delivery engineering package. Any later production change requires separate exact-target release authority and a fresh effective-configuration preflight; do not request credentials in chat or repeat paid acceptance without explicit cost/recipient approval.
