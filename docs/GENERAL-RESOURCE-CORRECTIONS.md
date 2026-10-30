# General resource release corrections — local only

Base: `7be32edf540844a24583fee72fbe8cc106125a8c`. Original application and review seals are preserved. No SQL, Storage policy, registration eligibility, campaign data or permission change in this overlay.

## Identity and private worksheet lifecycle

`grip-course.js` requires a verified nonanonymous email identity before opening a private worksheet. New local draft keys include Auth UUID, `getting-a-grip-on-the-basics`, and lesson number. Payloads repeat those fields and are checked before restoring. Course completion cache is user/course scoped. Unassigned v1 browser drafts/learner IDs/progress are left untouched and never imported or assigned by guess. No legitimate cloud answer is deleted. Historical unassigned drafts need a separately reviewed owner-confirmed recovery path; this package does not invent ownership.

Auth changes synchronously cancel timers, invalidate request generations and AbortSignals, empty rendered fields/progress/completion state, and disable editing/export controls. Page hide clears before bfcache capture; page show, cross-tab Auth changes and visibility restoration require fresh verification. Expiry timers clear/revalidate. Remote failures fail closed while preserving existing scoped device drafts. Auth callbacks perform no asynchronous Supabase calls while the SDK holds its callback lock; revalidation is scheduled afterward.

The shared client retains existing `getUser` for unrelated callers and adds `getVerifiedUser` for these views. Private lesson saves must supply the displayed draft's expected UUID. One captured identity and epoch follows profile, enrollment, answer and progress operations, with checks after awaits and before mutations. Session UUID, expiry and caller abort state must match. Every row still carries that captured UUID and existing RLS enforces it. A network request already sent may complete for its originally authorized owner; cancellation does not claim provider session retirement or transactional rollback. It cannot be retargeted to the next account. Course metadata cache has no learner data. My Discipleship uses matching verified-identity checks and clears late results on transitions.

The pre-existing explicit lesson-submit Netlify Forms path remains, now gated by the verified worksheet owner and an abort/generation check. No automatic outbound messaging is added. Existing user-invoked print/download/mailto controls are disabled until the verified user's worksheet is ready. Device storage is origin-local browser storage, not encryption against someone with physical access to developer tools; the guarantees here concern app rendering, restoration and attribution across accounts.

## Verification and switching

The general page checks SDK initialization result and callback error markers before consulting returning-registration status. Supported implicit callbacks must match the session's access token; unsupported/malformed callbacks fail closed. Callback tokens/errors are removed from the URL. No callback evidence is inferred merely from an older verified session. The prior valid session is not silently signed out on a failed link; it is identified explicitly and the page offers fresh verification or an explicit account switch. Requesting email is not registration success. OTP success must return the current matching intended email/user before registration proceeds. Optional prayer/contact draft data is not browser-persisted.

The currently authenticated email and supported local sign-out control sit outside the form hidden by registration success. Logout clears sensitive state before the request; failure is reported without claiming logout succeeded. Account changes invalidate prior receipts and requests.

## Book and course availability

My Discipleship includes an independent private-reader entry, not a St Lucia-only link. It describes general, Huntsville and Bessemer eligibility and does not itself grant access. Existing reader code, approved 83-page PDF hash, bucket/object policies, signed-URL TTL, acknowledgment and no-distribution terms are byte-identical to the base. Unregistered/unverified/anonymous/revoked access remains denied by the existing reviewed backend.

All 13 course routes/workbooks remain. Interactive cloud worksheets are lessons 1–4; lessons 5–10 have video/workbook, and 11–13 display video-coming-soon. No claim of 13 functional cloud worksheets, no automatic course enrollment from resource registration, and no fabricated completion.

## Validation and remaining gates

Run `npm test --prefix tools/backend-tests`; focused correction tests are included. Run `test:general-resources-native` with a disposable local PostgreSQL and `test:general-resources-browser` / `test:resource-corrections-browser` using pinned SDK and intercepted fictional services. The general browser suite uses the actual SDK with locally intercepted Auth and disposable PGlite RPCs. The correction browser suite uses fictional client services in Chrome/WebKit desktop/mobile; helper fencing is separately tested directly. Neither is real provider acceptance.

Next: independent review of this exact overlay/seal, then bind genuine sandbox Auth/Storage tests to a reviewed environment, owner-controlled mailbox allowance, actual provider callback/template configuration, independent recovery, accepted operators, maintenance and immutable-audit retention. No production release until those tests and real iPhone/Android/desktop acceptance pass and a separate exact release is authorized. Do not merge the entire unreleased Issue51 package; needed dashboard behavior is implemented narrowly here.

Rollback: before release, capture current deployed commit and confirm no unrelated drift. Revert only this website overlay if necessary, understanding that reverting the privacy fix reintroduces the old shared-device weakness; prefer containing private worksheet access pending repair. No destructive cloud-answer cleanup. General intake containment remains the separately reviewed SQL in the base package, requiring separate execution authorization and preserving rows/audits and legacy readers. Existing signed URLs can persist for their original TTL. Routing remains a separate additive SowGo rule approval; current /go and /register are unchanged.
