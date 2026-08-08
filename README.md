# Champion Life Church — Phase 1 Netlify Site

## Deploy
Drag this entire folder into Netlify Drop or connect it to a Git repository. The site is fully static and requires no build command.

## Included
- Responsive homepage and core public pages
- About, Watch, Ministries, Kids, Youth, Outreach, Events, Next Steps, Give, Prayer, Visit and Contact
- Dream Track landing page plus 7 hidden lesson pages
- GiveHub, Jotform, YouTube and social integrations
- Privacy and giving terms

## Next enhancements
- Real event calendar and event detail pages
- Kids check-in
- Course grading and completion tracking
- Getting a Grip on the Basics course
- Partner and Dream Team portals
- Replace staff placeholders with approved photos and bios

## Notes
The YouTube embedded live channel iframe is a placeholder because YouTube requires a channel ID rather than the public handle. The visible button links correctly to the Champion Life streams page.

## Dream Team form notification
The `dream-team-signup` form uses Netlify Forms. After deployment, open Netlify → Forms → Form notifications and send new submission notifications to `office@championlifefwb.com`.

## NFC / DOT URL
Program the seat-back NFC dots to the final domain path `/dot` (for example, `https://championlifefwb.com/dot`).


## Water Baptism Form Email Notification
The baptism form is configured as a native Netlify Form named `water-baptism-interest`. After deploying, enable the email notification one time in Netlify: Site configuration → Forms → Form notifications → Add notification → Email notification → `office@championlifefwb.com`. Netlify will then email each new submission to the church office while retaining a secure copy in the Forms dashboard.


August 7, 2026 update:
- Rebuilt the Next Steps page as a lighter polished pathway grid with 7 cards.
- Added the Discipleship card for Getting a Grip on the Basics with Beth Jones.
- Added getting-a-grip.html plus 13 lesson pages mirroring the Dream Track structure.
- Added full workbook PDF and chapter-specific lesson PDF downloads under assets/downloads/grip/.
- Video embed placeholders are in place pending the final approved lesson video list.

- Added the 14 supplied Getting a Grip videos: intro on the course page; lessons 1–10 populated; lessons 11–13 remain Coming Soon. Lessons 6, 8, and 9 contain multiple current video parts where supplied.

August 7, 2026 — Consolidated complete build:
- Includes web-optimized image assets and all prior complete-site pages/content.
- Includes the rebuilt 7-card Next Steps pathway.
- Includes Getting a Grip on the Basics with Beth Jones: 13 lesson pages, current 14 video embeds, full workbook, lesson PDFs, and notes areas.
- Includes final Champion Kids mobile age-group treatment with three clean stacked cards; desktop remains the approved combined card treatment.
- Includes Dream Team mobile submit button centering.
- Dream Team form submits through Netlify and redirects directly to /dream-track.html.
- Includes Dream Track root redirects and all Dream Track lesson pages at the site root.

## Dream Track secure access — August 7, 2026
Dream Track now uses a server-side shared access-code gate.

Required Netlify environment variable:
- Key: `DREAM_TRACK_ACCESS_CODE`
- Value: `DT26CL`

Set it in Netlify Site configuration → Environment variables, then trigger a new deploy. The access code is intentionally not hard-coded into the public website source.

All public Dream Track links route to `dream-track-access.html`. The Dream Track overview and lessons 1–7 are protected by a Netlify Edge Function, so direct bookmarked URLs also require authorization. Successful access creates an HttpOnly session cookie for that browser session.


## Dream Track access
Default shared access code: DT26CL. Netlify environment variable DREAM_TRACK_ACCESS_CODE can override the default later without changing page HTML.
