// Synthetic presentation data; excluded from the public site artifact.
export const context={
  "campaign": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Synthetic Community Outreach"
  },
  "organization": {
    "name": "Champion Life",
    "slug": "champion-life",
    "logo_asset": "assets/images/logo-gold.png"
  },
  "registration_slug": "synthetic-outreach",
  "settings": {
    "digital_enabled": true,
    "drawing_enabled": true,
    "operation_mode": "hybrid",
    "present_to_win": true,
    "one_win_only": true,
    "reminder_minutes": 30,
    "public_title": "Community Prize Drawing",
    "public_instruction": "Please come to Winner's Circle"
  },
  "admin": true,
  "capabilities": [
    "prize.view",
    "prize.manage",
    "prize.draw",
    "prize.claim"
  ],
  "session": {
    "id": "session",
    "status": "active"
  },
  "pools": [
    {
      "id": "pool",
      "name": "Bike Group C",
      "display_name": "Bike Group C",
      "pool_key": "bike-c",
      "prize_type": "bike",
      "category": "C",
      "age_guidance": "Ages 8–10",
      "size_guidance": "20 inch",
      "description": "Configured group",
      "quantity": 6,
      "draw_order": 1,
      "unclaimed_policy": "exclude_participant",
      "revision": 1,
      "active": true,
      "eligible_count": 84,
      "claimed_count": 0,
      "drawn_count": 0,
      "remaining": 6,
      "locked": true
    }
  ],
  "current": {
    "id": "22222222-2222-4222-8222-222222222222",
    "pool_id": "pool",
    "prize": "Bike Group C",
    "number": "381742",
    "state": "selected",
    "selected_at": "2026-10-09T07:09:57.555Z",
    "participant": {
      "name": "Synthetic Child",
      "guardian": "Synthetic Parent",
      "phone": "+15555550100",
      "email": "private@example.test"
    }
  },
  "history": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "prize": "Bike Group C",
      "number": "381742",
      "state": "selected",
      "selected_at": "2026-10-09T07:09:57.557Z"
    }
  ],
  "assignments": [
    {
      "user_id": "user",
      "email": "operator@example.test",
      "role_key": "other",
      "capabilities": [
        "view",
        "prize.view",
        "prize.draw"
      ],
      "revision": 1,
      "active": true
    }
  ]
};
