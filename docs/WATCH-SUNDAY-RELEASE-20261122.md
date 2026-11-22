# Sunday public LIVE release candidate

Prepared from production commit `9b8641e53c3d0ab2ae5fe20582f9acc36ac4b150`, deployment `6b027d7aef4a77dcea62ce5e`, for Champion Life Church (`2b2af9ba-7001-4e96-9aef-44f012cc4397`). This is a local candidate, not a deployment or release approval.

The public Watch page reuses the reviewed LIVE player/layout from runtime `fbcec8f304452c55c1fb7024dd983fe9e0af3cdf`, including landscape geometry and YouTube player retirement. It does not publish the protected QA package or its fixed recordings. The existing production YouTube discovery function remains unchanged. Polling is bounded, stale receipts retire their iframe, and status failures use the original channel player only during the existing worship windows, labelled as unconfirmed availability.

Owner-confirmed Central schedule: Monday–Friday prayer 6 AM; Sunday prayer 7 AM; Sunday worship 10:30 AM; Wednesday worship 6:30 PM. Prayer never displays worship booklets. Published Sunday/Wednesday archives retain their actual November 15/18 dates. No November 22 booklet is invented. The existing Current Sermon Notes destination remains linked and unchanged.

Anonymous Watch Only, temporary page-memory notes and the local public-domain Bible require no Church account. Original provider conversations remain provider-controlled. Facebook has an explicit visible original-page handoff instead of an unverified inline player. No claim of physical-iPhone Facebook embed success, native mobile chat, verified casting, saved member notes or automatic Publisher activation is made.

Only `watch.html` changes among the 435 baseline public files; 75 reviewed Watch module, stylesheet and Scripture assets are added. All other public bytes, the YouTube function, Dream Track function/edge protection and redirects remain unchanged. The build permits the exact new module/JSON paths, not arbitrary JSON/modules. CSP and cache headers apply only to Watch and its assets. There are no new credentials, database permissions or application APIs.

Focused acceptance covers Chromium/WebKit desktop, phone portrait and landscape; live/offline/error/invalid discovery, expiry, stale responses, original-provider handoffs, notes/Bible retention, dated archives and prayer isolation. Test results distinguish intercepted provider responses from actual anonymous booklet readback and prior owner physical-device evidence. Build regression and release isolation tests are in `tools/watch-public-release/` and `tools/backend-tests/site-build.test.mjs`. Private evidence is outside the repository in the audit workspace.

## Release and recovery boundary

No partial static upload: it could drop existing functions or edge protection. Release requires separate owner approval for the exact reviewed source commit through the existing Git-connected main build, preserving both functions and the Dream Track edge. Reconfirm production is still the stated baseline before any publication; if it changed, stop and reconcile the new diff.

After approved publication, verify anonymous `/watch.html` and `/watch`, exact bytes/headers, both functions and edge protection, desktop/mobile notes/Bible/layout and original-provider handoffs. An actual live service and physical device remain provider-dependent; synthetic fixtures do not prove real playback. A new Sunday booklet requires its own reviewed publication/binding.

Recovery is a reviewed fix-forward source revert of this bounded release, preserving unrelated later commits, followed by the normal complete build. Do not restore an arbitrary old Netlify deploy or upload the protected QA bundle. A failed or ambiguous release is HOLD until its actual published state is reconciled; no blind retries.
