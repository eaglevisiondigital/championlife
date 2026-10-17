-- Create only the canonical Huntsville draft. Activation, legal publication and staff grants remain release steps.
-- Transactional, fail closed on any conflicting code/slug/state. A successful migration
-- is applied once through the ledger; manual duplicate execution intentionally fails.
do $$declare o uuid;c uuid;begin
 lock table public.outreach_campaigns,public.outreach_registration_settings in share row exclusive mode;
 select id into strict o from public.organizations where slug='sowgo';
 if exists(select 1 from public.outreach_campaigns where code='huntsville_al_2026' or public_slug='huntsville-2026')
 or exists(select 1 from public.outreach_registration_settings where public_slug='huntsville-2026') then
  raise exception 'Huntsville campaign code or public slug already exists; review before release';
 end if;
 insert into public.outreach_campaigns(organization_id,code,name,public_slug,city,state_province,country,timezone,venue,event_start,event_end,registration_start,status)
 values(o,'huntsville_al_2026','Huntsville Outreach / City Hangout','huntsville-2026','Madison','AL','US','America/Chicago','{"name": "Cornerstone Word of Life Church", "address": "3783 Sullivan St, Madison, AL 35758"}'::jsonb,'2026-10-24T14:00:00-05:00','2026-10-24T16:00:00-05:00','2026-10-24T13:00:00-05:00','draft') returning id into c;
 insert into public.outreach_registration_settings(campaign_id,public_slug,enabled,address_required,structured_address,emergency_phone_required,waiver_required,instructions,event_profile)
 values(c,'huntsville-2026',false,true,true,true,true,'Please complete registration and check in before the giveaway eligibility cutoff announced by the event team. All ticket holders must be present to win. Giveaways are subject to eligibility and availability; preregistration does not guarantee a bicycle or tablet.','{"public_name": "CITY HANGOUT", "on_site_registration_at": "2026-10-24T13:00:00-05:00", "confirmation_message": "Thank you for registering for City Hangout. We look forward to seeing you Saturday, October 24 at Cornerstone Word of Life Church.", "highlights": "Music \u00b7 Games \u00b7 Inflatables \u00b7 Giveaways \u00b7 Free Bicycles \u00b7 Free Tablets \u00b7 All Free"}'::jsonb);
 perform private.outreach_audit(c,o,'registration.draft_prepared',c,jsonb_build_object('enabled',false));
end $$;
