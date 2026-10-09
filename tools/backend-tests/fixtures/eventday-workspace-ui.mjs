// Synthetic presentation data; excluded from the public site artifact.
export const context={
  "campaign": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Synthetic Community Outreach",
    "code": "synthetic_2026",
    "city": "Synthetic City",
    "country": "USA",
    "event_start": "2026-10-10T15:00:00Z",
    "timezone": "America/Chicago"
  },
  "organization": {
    "name": "Champion Life",
    "slug": "champion-life",
    "logo_asset": "assets/images/logo-gold.png"
  },
  "operation": {
    "status": "active",
    "revision": 2
  },
  "summary": {
    "overall_readiness": 72,
    "areas_total": 13,
    "areas_ready": 9,
    "areas_with_issues": 1,
    "checklist_total": 40,
    "checklist_complete": 31,
    "volunteers_assigned": 26,
    "missing_leads": 1,
    "inventory_issues": 1,
    "open_alerts": 1,
    "current_stage": "Guest arrival",
    "registration_count": 150,
    "checkin_count": 84,
    "prize_ready": true,
    "prize_pools": 4
  },
  "capabilities": [
    "ops.view",
    "ops.manage",
    "inventory.view",
    "inventory.manage",
    "issue.manage"
  ],
  "areas": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "area_key": "registration",
      "title": "Registration",
      "description": "Welcome and check-in",
      "category": "guest_services",
      "display_order": 1,
      "required_for_ready": true,
      "status": "setup_in_progress",
      "location": "Front gate",
      "notes": "Synthetic private note",
      "issue_flag": true,
      "revision": 3,
      "readiness": 50,
      "required_missing": 1,
      "issues": 1,
      "members": [
        {
          "id": "a1",
          "member_id": "66666666-6666-4666-8666-666666666666",
          "name": "Synthetic Volunteer",
          "role": "lead",
          "arrival_status": "on_site",
          "notes": ""
        }
      ]
    }
  ],
  "checklists": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "campaign_id": "11111111-1111-4111-8111-111111111111",
      "area_id": "22222222-2222-4222-8222-222222222222",
      "item_key": "tables",
      "text": "Registration tables in place",
      "display_order": 1,
      "required": true,
      "quantity_kind": "count",
      "completed": false,
      "revision": 1
    }
  ],
  "inventory": [
    {
      "id": "44444444-4444-4444-8444-444444444444",
      "campaign_id": "11111111-1111-4111-8111-111111111111",
      "area_id": "22222222-2222-4222-8222-222222222222",
      "item_key": "tables",
      "item_name": "Folding tables",
      "category": "registration",
      "required_quantity": 4,
      "available_quantity": 4,
      "loaded_quantity": 4,
      "on_site_quantity": 3,
      "returned_quantity": 0,
      "missing_quantity": 1,
      "damaged_quantity": 0,
      "direct_delivery": false,
      "critical": true,
      "return_required": true,
      "source_owner": "Champion Life",
      "vehicle_id": null,
      "status": "missing",
      "notes": "Synthetic inventory note",
      "revision": 2,
      "area_title": "Registration",
      "vehicle_label": null
    }
  ],
  "issues": [
    {
      "id": "55555555-5555-4555-8555-555555555555",
      "campaign_id": "11111111-1111-4111-8111-111111111111",
      "area_id": "22222222-2222-4222-8222-222222222222",
      "severity": "urgent",
      "issue": "One table missing",
      "assigned_member_id": "66666666-6666-4666-8666-666666666666",
      "status": "open",
      "notes": "Find replacement",
      "resolution_note": "",
      "revision": 1,
      "area_title": "Registration",
      "assigned_name": "Synthetic Volunteer"
    }
  ],
  "timeline": [
    {
      "id": "77777777-7777-4777-8777-777777777777",
      "campaign_id": "11111111-1111-4111-8111-111111111111",
      "item_key": "guest-arrival",
      "title": "Guest arrival",
      "display_order": 4,
      "scheduled_at": "2026-10-10T16:00:00Z",
      "status": "current",
      "owner_member_id": "66666666-6666-4666-8666-666666666666",
      "owner_name": "Synthetic Volunteer",
      "notes": "Open gates",
      "revision": 1
    }
  ],
  "media": [],
  "team_members": [
    {
      "id": "66666666-6666-4666-8666-666666666666",
      "name": "Synthetic Volunteer",
      "status": "approved"
    }
  ],
  "vehicles": [
    {
      "id": "88888888-8888-4888-8888-888888888888",
      "label": "Box Truck",
      "vehicle_type": "truck"
    }
  ],
  "templates": []
};
