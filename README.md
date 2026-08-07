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
