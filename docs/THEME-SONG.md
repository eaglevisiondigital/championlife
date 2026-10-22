# Gospel in the Streets — implementation and release contract

Implemented locally on an isolated branch from production main `e3157f0afa3f563ab6560ca64c9049448f02c806`. Not merged, deployed, provisioned or activated. This feature does not use Supabase, Outreach permissions, registration data or payment APIs.

## Approved assets and presentation

The final owner attachment `ChatGPT Image Oct 22, 2026, 09_18_31 AM.png` is preserved byte-for-byte as `assets/images/theme-song/approved-artwork.png`:
`78bb4bc738205f0498a4dff4a2614c2eb595d745766bd11062f05d7458ffc89d`.
The lossless WebP has identical decoded RGB pixels. The 1200×630 JPEG contains the complete composition, scaled proportionally with narrow dark side margins, without cropping or replacement artwork.

Original `Gospel St.m4a` is preserved byte-for-byte:
`b844032d80a66f41743df01b22c2a7ab4f07d5dcd571467e34c4bbf2e2249c60`.
Its measured duration is 288.1 seconds (4:48), mono AAC, approximately 577 KiB. The functional player displays this actual duration instead of the illustrative 3:42 in the artwork. The download is honestly named M4A, not mislabeled MP3. No re-encoding or new artwork was performed.

A single keyboard-accessible set of transparent controls aligns with the illustrated player/buttons at every width. Play/pause, seeking, volume, mute, original-audio download, sharing and existing Outreach giving use one audio element; no duplicate visible or hidden action set remains below the artwork. Labels, pressed states, range value text and visible focus remain available to assistive technology. The SOUL FUEL wording is preserved without an extra giving button. Native audio controls remain available in the same player area without JavaScript, alongside the existing download/giving links. No autoplay. Device-level volume controls apply where the browser does not support programmatic volume.

The owner removed the play counter entirely on 2026-10-22. There is no visible count, placeholder, playback qualification, event tracking, counter cookie, counter API, database schema, runtime database dependency or counter environment configuration. Playback/error/share announcements remain accessible within the artwork.

The identical feature appears immediately after the Outreach introduction and at `/outreach/theme-song`. The sharing page has canonical, Open Graph and Twitter metadata; it is public/unlisted, has no primary-navigation entry and uses `noindex,follow`. Share uses the native share sheet, then clipboard, then a selectable URL. Social crawlers cannot be validated against production until release.

SOUL FUEL / Help Fuel the Gospel in the Streets! / Give to Outreach links only to the unchanged `/outreach-giving.html`. Read-only browser validation on 2026-10-22 confirmed its existing GiveHub destination renders “SOW-GO OUTREACH GIVING” and “Partner With Outreach.” No fund, amount, payment or form was submitted.

The mentioned implementation ZIP was not present in the supplied attachments or located in Downloads/Desktop/workspace. This implementation uses the authoritative PNG, original audio and existing repository. An eventual ZIP must be reviewed rather than blindly overlaid.

## Static implementation and privacy

`assets/js/theme-song.js` operates the existing HTML audio element and local controls only. It makes no fetch, beacon, database or analytics requests and creates no cookies or browser storage. Download and giving are ordinary links without tracking handlers. Share uses the user's share sheet or clipboard only when requested.

The removed backend, schema, qualification module, root database dependency/lockfile and counter-only tests are absent from the repository and public build. Existing PostgreSQL tooling under `tools/backend-tests` supports unrelated pre-existing local security/concurrency tests and remains unchanged. No Neon project, counter database, hosted credentials or counter environment variables were provisioned. The previously prepared private hosted-counter packages are historical evidence only and must not be executed.

## Validation

Run the full backend/site regression suite and existing native concurrency suite, plus the focused static feature checks and Chrome/WebKit player suite:

```sh
npm ci --ignore-scripts --prefix tools/backend-tests
npm test --prefix tools/backend-tests
TEST_POSTGRES_BIN=/path/to/postgresql/bin npm run test:concurrency --prefix tools/backend-tests
node tools/site-build/build.mjs
node tools/theme-song/preview.mjs
EVIDENCE_DIR=/private/local/evidence npm run test:theme-song-browser --prefix tools/backend-tests
```

2026-10-22 local results: full backend/site suite PASS; 43 focused static/privacy checks PASS; 201 Chrome/WebKit assertions PASS at 1440/847/768/390px; four native concurrency groups PASS; two identical 401-file builds PASS. Original artwork/audio hashes and protected backend/configuration files match the baseline.

Browser coverage includes both routes, desktop/tablet/mobile widths, actual AAC playback past five seconds, pointer/keyboard controls, mute, exact-byte downloads, native share contract and clipboard/manual fallbacks, accessible labels/focus, no duplicate controls, no counter/analytics requests or storage, giving navigation and no-JavaScript fallback. Public-build/private-file isolation, unchanged asset hashes and unrelated protected files are checked separately.

## Release and rollback

Owner authorization on 2026-10-22 permits this static feature's production release only after final checks pass. No database or counter activation gate remains. Verify the finalized PR contains only this feature, preserve the existing Netlify configuration, then remove the PR's deployment-skip restriction and merge through the existing production workflow. Record the exact merge/deploy commits and deployment ID. After deployment, verify both public routes, audio playback/range/download integrity, sharing metadata, controls and the existing giving destination.

On a release failure, stop further changes and preserve or republish the recorded last working production deployment through Netlify's existing rollback control. Do not change Supabase, Gate 1C, registration, NMI, GiveHub, payment processing or public ministry routing. A public social crawler's cache refresh is external to the release; metadata and image delivery must be verified on the actual public site.
