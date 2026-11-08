# Registration and check-in lifecycle correction

Source baseline: Outreach PR72 `91ebfeea001babf5851690076e9ef6d71e91b19a`. The registration runtime is also unchanged in Staff126; no historical branch is merged or modified by this successor.

The existing campaign-only journey supports a registered adult/minor household, per-attendee roster and check-in, reasoned reversal, and authoritative status refresh. Checking any attendee in sets household `checked_in`; reversing one of several retains it; reversing the final attendee restores `confirmed`. No client-side status inference is added.

Native browser reproduction showed the old containment check became true again after a removed button/card/root was reinserted, allowing a retained handler to submit a new check-in. Track each guarded control's lifetime using removal records from the document. Removed nodes or ancestors permanently retire the bound handler; drain records synchronously before invocation so same-turn reinsertion cannot revive it. No MutationObserver means guarded actions fail closed. Existing generation/account/campaign/URL/permission and busy checks remain. No new authority is created and already-submitted requests are not claimed cancelled. A fresh authorized focus/navigation reload produces new controls.

Tests use exact runtime and unchanged migration order in disposable PostgreSQL, with fictional Auth and records. Original-source exploits and corrected desktop/mobile Chromium/WebKit journeys are retained. Check-in-only staff retain no registration-management grant; expired/revoked and cross-campaign checks remain in the existing native suite. Positive saves and reversals retain canonical audit. No learner, People, financial or decision permission is introduced.

Historical search/privacy source hashes remain checked by reversing only the exact new guard delta. Original baseline hashes, six search resets, protected SQL/public files, build manifest and all browser assertions are unchanged. The existing workflow gains one focused native-browser step. Public output changes only `assets/js/outreach-registration-staff.js`.

No hosted installation, actual account/grant, production data, merge or deployment. Parent PR72 and frozen Staff sources remain unchanged. Genuine exact-target Auth/RLS, operational recovery and separate release authorization remain required. RELEASE NO-GO.
