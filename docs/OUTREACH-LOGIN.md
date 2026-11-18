# Outreach sign-in — unpublished local candidate

This UI checkpoint starts at reviewed head `8715b0c0783b2b0458e4b66fc560959e14665be8`. `outreach-login.html` presents SOWGO and Champion Life Outreach with the original SOWGO logo. It has no course branding, published navigation entry or public-manifest entry. Only the unpublished P1 staff/participant entry and logout/account-switch destinations use it. No backend, Auth provider configuration, SMTP/template, account, grant, email, credential or hosted change occurs here. The parent separately owns replacement-project setup and branded Auth email work.

## Canonical behavior, explicit context only

`tools/outreach-login/generate.mjs` copies the existing canonical inline script exactly, with only these bounded substitutions:

| Context | Canonical | Outreach |
| --- | --- | --- |
| Email callback path | `/discipleship-login.html` | `/outreach-login.html` |
| Missing/unsafe next fallback | `/my-discipleship.html` | `/outreach.html` |
| Session-storage return hint | `championlife-auth-next` | `championlife-outreach-auth-next` |

The generated inline script preserves the exact6/8-digit OTP handling, same-origin redirect policy, SDK-owned session/implicit-fragment initialization, TokenHash verification, invalid/expired callback refusal, credential-history scrubbing, raw-callback-error redaction, storage failure tolerance, callback/auth-event race protection and single redirect. It uses the same shared SDK/client/config scripts. No second client, JWT parsing, course enrollment, identity claim or access grant is added. The existing canonical `shouldCreateUser: true` option is retained; this is not an account-provisioning operation or new policy decision. Signing in never grants Team/Travel authority; the existing verified/current canonical/server permission gates remain unchanged.

The shared staff-session file hardcodes a course login and People destination on logout/account switch. To complete the P1 branded return without affecting unrelated modules, `assets/js/outreach-staff-session.js` is generated from it with only two substitutions: login becomes `outreach-login.html?next=` plus the current page path/query encoded as one parameter; return-hint clearing uses the independent Outreach key. Only `staff-outreach-team-travel.html` selects this clone. Current-session logout, failed-signout locking, detached stale responses, account-switch clearing and BFCache clearing remain exactly canonical. The explicit event query survives the return; no campaign is guessed. Other staff screens keep their original shared file and login behavior.

These original files remain byte-identical to the reviewed base:

| Original file | SHA256 |
| --- | --- |
| `discipleship-login.html` | `7e783b81c580aad730c0ddceed5ef045d56e958d0192bffa2c58b0fb9b0d994b` |
| `assets/js/champion-life-auth.js` | `f1d277ea1cb5cf608de471b0a62f6ae41c9ecdc3b675960628083ee4e1df3cb4` |
| `assets/js/staff-session.js` | `3cdb0357988d022bd8f9a9ad8fb95f8ff3d44841444993b7f20eb2193e3656a4` |
| `assets/images/sowgo-logo.png` | `3cddfc935317290967f98e7697cee625756141706e7b46c72d96fba3af4d219c` |

Run `node tools/outreach-login/generate.mjs` to verify generated source/tests. `--write` regenerates only the new derived artifacts; it never edits canonical files. Generation asserts exact substitution counts; tests additionally pin the original hashes. Future canonical Auth changes require explicit review and regeneration, not an independently maintained behavioral fork.

## Tests and evidence boundary

`npm run test:outreach-login --prefix tools/backend-tests` passes the complete generated165-scenario canonical login matrix,94equivalent P1 staff logout/account-switch assertions and32preservation/branding/context checks. Tests include malformed/off-origin/encoded redirects, blocked storage,6/8-digit input, direct/implicit callback success/failure, duplicate/mixed callback fields, callback-race/old-session refusal, secret scrubbing, independent return storage, unchanged original files and explicit P1 event return links. No remote SDK or account is used.

`npm run test:outreach-login:browser --prefix tools/backend-tests` passes108checks in Chrome and WebKit at320px,390px and1440px: initial/OTP/expired-link states, original logo rendering, visible keyboard focus/skip link, labelled input and live feedback,44px touch targets, no horizontal overflow, keyboard submission, validation, callback URL cleanup and recovery through an8-digit synthetic OTP. Every page/SDK/Auth response is intercepted locally, every external request is refused, and screenshots visibly say **SYNTHETIC LOCAL AUTH PREVIEW · NO EMAIL SENT**. Twelve email/code/expired-state screenshots at390px/1440px remain only in the outer private audit workspace; representative mobile/desktop states were visually inspected. No genuine verification, provider delivery, real-session or hosted acceptance is claimed.

The complete existing regression suite passes with the new suite included; actual public manifest/build stays426files and excludes all P1/UI candidates. Full build/source preservation and logs are recorded privately outside the application. Parent-owned publication remains an unapplied patch, unchanged here. A later approved publication must reconcile its existing six P1 entries plus `outreach-login.html`, `assets/css/outreach-login.css` and `assets/js/outreach-staff-session.js`; source existence alone does not publish them.

## Remaining release gates and handoff

The parent must configure the replacement acceptance project's allowed callback URL for its exact authorized origin and `/outreach-login.html`, and validate its separately owned branded email/SMTP flow with genuine owner-approved accounts. This checkpoint neither modifies redirect allowlists nor tests a real confirmation email. Genuine owner/multi-staff/current-revocation/own-participant acceptance and existing P1 production release authority remain separate gates. Leave the actual manifest and runtime unpublished until those gates and the reconciled publication patch are reviewed. No change to Discipleship, Giving, DreamTrack, People, existing P0 receipts or status-message delivery is included.
