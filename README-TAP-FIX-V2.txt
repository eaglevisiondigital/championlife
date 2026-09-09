CHAMPION LIFE /TAP — MOBILE + BRAND FIX V2

UPDATE ONLY. Not a complete website replacement.

UPLOAD / REPLACE:
  tap/index.html
  tap/assets/champion-life-logo.png

Replace the existing tap/index.html with this file in the SAME tap folder.
Do not name it index-2.html or put the entire ZIP into GitHub.
Unzip first and preserve the folder structure. Do not delete unrelated site assets.

The page remains at https://championlifefwb.com/tap (or /tap/).
Existing NFC tags and QR codes pointing to that address do not need to change.

FIXES:
- Black and neutral grayscale backgrounds. Pure-white website button.
- No brown, beige, cream, gold glow, or gold-tinted panels.
- Gold restricted to the unchanged approved logo, small arrows, and thin accents.
- Header remains visible when scrolling but participates in normal page layout.
- Both logo copies preserve their natural proportions; no cropped crown on first load.
- Compact responsive cards, readable descriptions, consistent touch targets.
- Mobile section captions simplified to prevent crowding.
- Responsive menu includes Escape-to-close and keyboard focus indication.
- All 14 original quick-link destinations are preserved, including the sermon-notes anchor.

SCOPE:
- /tap uses its own styling and navigation so global fixed-header CSS cannot overlap the crown.
- The approved logo is copied byte-for-byte, not regenerated or recolored.
- No homepage, shared CSS/JavaScript, forms, giving flow, or other existing page is replaced.
- No new icons/logos, platform integration, or extra quick-link destinations added.

DEPLOYMENT:
This ZIP is ready to upload; it is not already deployed by creating it here.
After deployment, reload /tap to fetch the updated HTML.

LOCAL QA COMPLETED
22 Chromium viewport checks from 320 to 1920 CSS pixels wide, including landscape.
No page-width overflow or logo/header overlap on initial load in those checks.
Menus, 200% text sizing, and the no-JavaScript navigation fallback also checked.
These are local browser-emulated checks, not live deployment or physical-device tests.
External destinations were preserved exactly, not live-availability verified.
