Champion Life /watch livestream update

UPLOAD THESE ITEMS TO THE ROOT OF THE EXISTING WEBSITE REPOSITORY:

1. Replace watch.html
2. Add/replace:
   assets/images/watch-join-us-approved.png
   assets/images/watch-starts-shortly-approved.png
3. Add:
   netlify/functions/youtube-live.js

Behavior:
- Offline: approved Join Us image
- 5 minutes before Sunday 10:30 AM or Wednesday 6:30 PM America/Chicago: approved Service Starts Shortly image
- When YouTube is live: live video replaces image automatically
- Desktop (981px+): live YouTube chat appears beside video when live video ID is detected
- Mobile: button opens the active YouTube stream/chat
- Giving invitation sits directly below the player and links to giving-portal.html
- Polls live status every 60 seconds

No YouTube Data API key is required by this version.
