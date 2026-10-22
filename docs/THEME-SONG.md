# Gospel in the Streets — implementation and release contract

Implemented locally on an isolated branch from production main `e3157f0afa3f563ab6560ca64c9049448f02c806`. Not merged, deployed, provisioned or activated. This feature does not use Supabase, Outreach permissions, registration data or payment APIs.

## Approved assets and presentation

The final owner attachment `ChatGPT Image Oct 22, 2026, 09_18_31 AM.png` is preserved byte-for-byte as `assets/images/theme-song/approved-artwork.png`:
`78bb4bc738205f0498a4dff4a2614c2eb595d745766bd11062f05d7458ffc89d`.
The lossless WebP has identical decoded RGB pixels. The 1200×630 JPEG contains the complete composition, scaled proportionally with narrow dark side margins, without cropping or replacement artwork.

Original `Gospel St.m4a` is preserved byte-for-byte:
`b844032d80a66f41743df01b22c2a7ab4f07d5dcd571467e34c4bbf2e2249c60`.
Its measured duration is 288.1 seconds (4:48), mono AAC, approximately 577 KiB. The functional player displays this actual duration instead of the illustrative 3:42 in the artwork. The download is honestly named M4A, not mislabeled MP3. No re-encoding or new artwork was performed.

Desktop controls cover the illustrated player/button areas, retaining their placement and gold/dark language. At widths ≤900px, transparent interactive controls align with the player and action areas pictured in the complete unaltered image. Play/pause, seeking, volume, mute, original-audio download, sharing and existing Outreach giving use the same audio element and actions as the larger controls retained below for touch usability. Current time, actual duration, play and mute states stay synchronized. Both control sets have keyboard semantics, labels and visible focus. Native audio controls and download/giving links remain available without JavaScript. No autoplay. Device-level volume controls apply where the browser does not support programmatic volume.

The identical feature appears immediately after the Outreach introduction and at `/outreach/theme-song`. The sharing page has canonical, Open Graph and Twitter metadata; it is public/unlisted, has no primary-navigation entry and uses `noindex,follow`. Share uses the native share sheet, then clipboard, then a selectable URL. Social crawlers cannot be validated against production until release.

SOUL FUEL / Help Fuel the Gospel in the Streets! / Give to Outreach links only to the unchanged `/outreach-giving.html`. Read-only browser validation on 2026-10-22 confirmed its existing GiveHub destination renders “SOW-GO OUTREACH GIVING” and “Partner With Outreach.” No fund, amount, payment or form was submitted.

The mentioned implementation ZIP was not present in the supplied attachments or located in Downloads/Desktop/workspace. This implementation uses the authoritative PNG, original audio and existing repository. An eventual ZIP must be reviewed rather than blindly overlaid.

## Counter: implemented, default-disabled, storage approval pending

`netlify/functions/theme-song.mjs` uses a dedicated PostgreSQL database through pinned `pg`, not Netlify Blobs, browser-local totals or any ministry/acceptance database. No auto-provisioning dependency or migration hook exists. `tools/theme-song/schema.sql` is review-only and outside the Supabase migration chain/public build.

The browser qualifies after five cumulative seconds of actual playback. Pause, buffering, seeking, rate changes and discontinuous samples are excluded. A signed, Secure, HttpOnly, SameSite=Strict host-only cookie identifies a two-hour listening session across both pages and refreshes. PostgreSQL independently enforces five seconds since session creation. Atomic unique `(session_id,kind)` events and transactional increments prevent duplicate/lost counts. Totals persist across function instances/deployments. Download/giving clicks are separate deduplicated aggregates; navigation is never delayed and those counts are best effort.

This is reasonable analytics abuse resistance, not proof that a human heard the sound. An intentionally modified client can wait five seconds and send a play event; server rate limits bound this. Shared IPs may hit limits. No historical plays are seeded. When unavailable/disabled, the UI says “Play count unavailable,” and all music/giving features continue.

Per network: 20 session-start requests and 120 event requests per minute, atomically enforced in PostgreSQL. Only daily HMAC network digests are retained, never raw IP, name, account, user agent or referrer. Session/event rows expire after two hours and old rate windows after ten minutes; cleanup occurs on subsequent writes. Aggregate totals persist. No individual-level reporting endpoint exists. Administrative reporting is `SELECT kind,total FROM theme_song.totals ORDER BY kind` using an approved operator connection. Public responses contain only the aggregate play total. No account creation or messaging.

### Proposed activation configuration (names only)

Before release, separately approve a **dedicated** counter database and any cost/provider choice. A preview must have its own database, installation UUID, credentials and session key; never reuse production credentials. All table names live in private `theme_song`, without Data API exposure. Apply the review-only SQL once as database owner. Create a non-owner TLS login inheriting only `theme_song_counter`; no unrelated database privileges. Install a reviewed UUID/environment row in `theme_song.installation`, initially disabled. Do not use an existing Champion Life/SowGo/Supabase/financial database.

Functions-scoped Netlify variables, separately configured per deployment context:

- `THEME_SONG_COUNTER_ENABLED` — default absent/OFF; explicit `true` only after acceptance.
- `THEME_SONG_ORIGIN` — one exact HTTPS origin, no slash/path/wildcard; production proposal `https://championlifefwb.com`.
- `THEME_SONG_SITE_ID` — exact approved Netlify site UUID; checked against platform-provided context.
- `THEME_SONG_CONTEXT` — `production` or `deploy-preview`; checked against platform-provided context.
- `THEME_SONG_INSTALLATION_ID` — exact UUID matched against the dedicated database marker.
- `THEME_SONG_DATABASE_HOST` — exact reviewed database host.
- `THEME_SONG_DATABASE_URL` — secret, no query parameters; database must be `champion_theme_song` or `champion_theme_song_preview` matching context. Supabase hosts/URLs are rejected. TLS certificate verification is mandatory.
- `THEME_SONG_SESSION_KEY` — independent random secret of at least 32 bytes (43+ base64url characters); never client-side or in this repository.

Missing/mismatched site, context, origin, database marker or disabled state fails closed. No CORS allow-origin headers. JSON POST only with exact same-origin Origin, bounded 64-byte payload and approved event kind. Function errors never return/log credentials or raw database errors. The runtime cannot update installation state or schema. All five tables have RLS; PUBLIC access is revoked.

Emergency disable: owner sets `theme_song.installation.enabled=false` (immediate for subsequent requests), then disables the Netlify variable and redeploys only after release authorization. Keep aggregate history/backups during rollback. Revert the website feature by reverting its reviewed commit through the normal release process; never replace giving routes. No automatic cleanup of hosted storage/destruction is authorized.

## Validation and release gates

Local: existing full backend/site regression; focused HTTP, qualification and asset tests; native PostgreSQL with a non-owner runtime role and concurrent dedup/increment/rate races; Chrome and WebKit at 1440, 847, 768 and 390 px with real supplied AAC, seeking, volume, byte-identical download, clipboard/manual share fallback, error handling and no unexpected external requests. Screenshots and logs remain private in the outer audit workspace, excluded from all builds.

Commands:

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix tools/backend-tests
npm test --prefix tools/backend-tests
TEST_POSTGRES_BIN=/path/to/postgresql/bin npm run test:theme-song-native --prefix tools/backend-tests
node tools/site-build/build.mjs
node tools/theme-song/preview.mjs
# Separate terminal, after Playwright's Chrome/WebKit engines are available:
EVIDENCE_DIR=/private/local/evidence npm run test:theme-song-browser --prefix tools/backend-tests
```

No physical iOS/Android device or hosted counter acceptance is claimed. Chromium/WebKit viewport checks are browser emulation. Browser analytics use a mock transport for timing; persistent concurrency is separately proven using native PostgreSQL. No real participant/financial fixtures are used.

**Next approval:** approve the exact draft PR for isolated counter-storage provisioning/configuration and a nonproduction hosted acceptance deployment (named target/cost/hostname required). Verify cookies, runtime scope, TLS, totals across redeploys, mobile devices, asset ranges and social fetches. Then separately approve merge and production deployment of the accepted exact commit, plus the production counter configuration. Until then keep deployment skipped and the counter OFF. GiveHub, NMI, registration routes and restricted Gate 1C environments remain unchanged.
