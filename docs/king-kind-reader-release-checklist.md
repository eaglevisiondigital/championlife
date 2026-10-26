# King Kind registered reader - release checklist

STATUS: CANDIDATE ONLY. DO NOT MERGE BEFORE REVIEW + PRIVATE PDF UPLOAD + PERMISSIONED TESTS.

Source PDF: 83 pages, 396x612 pt, ~8.3 MB. Image-heavy; preserve original raster pages. PDF SHA-256 to be computed at upload for integrity.
Existing approved book cover: `/assets/images/king-kind-cover.svg`.

1. Review production SQL for registration eligibility: Bessemer/Huntsville decision form `outreach_registrations` under confirmed Auth email.
2. In staging, create private bucket `king-kind-books`, file-size limit 30 MB, PDF MIME only; do not make public.
3. Upload exact PDF to `king-kind/king-kind-english.pdf`; verify file size, SHA-256, PDF page count, and bucket private flag.
4. Verify only a confirmed Auth user with a matching Bessemer/Huntsville registration can obtain a 900-second signed URL.
5. Verify unauthenticated, unconfirmed, and unrelated confirmed users cannot create a signed URL, and no cross-campaign or private registration record leak.
6. On Safari iOS and Android Chrome, verify 83-page reading, pinch/browser zoom or +/− controls, page swipe, resume position, keyboard, fullscreen (when supported), load time, error states, rotated orientation.
7. Upload should occur before enabling public reader links on Bessemer/Huntsville (including Spanish) and My Discipleship.
8. Auth login link should return to king-kind-reader.html; registration success already triggers sign-in OTP for valid email.
9. Normal screen readers will not have a fully accessible text layer for the image-based PDF. Request the editable text/Word source for accessible edition later. Do not imply PDF text search.
10. This is a gift reader, not strong DRM: signed URLs can be shared within their brief validity and browser-readable bytes can be saved. Preserve copyright information in the PDF.
11. Verify deployment and roll back links if bucket or RLS fail. No existing records rewritten.
12. Do not deploy or backfill unrelated registration, finance, outreach recovery, Giving, or Gate 1C systems.
