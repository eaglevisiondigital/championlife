-- Prepare Huntsville team/travel settings without opening public team signup.
do $$
declare c uuid;
begin
  select id into strict c from public.outreach_campaigns where code='huntsville_al_2026';

  insert into public.outreach_team_settings(
    campaign_id,enabled,window_override,multiple_roles,participant_notes,coordination_name,coordination_phone
  ) values (
    c,false,'closed',true,
    'Champion Life team planning for the Huntsville / City Hangout outreach.',
    '',''
  )
  on conflict(campaign_id) do nothing;

  insert into public.outreach_team_roles(campaign_id,name,active) values
    (c,'Prayer Team',true),
    (c,'Registration & Check-In',true),
    (c,'Setup & Logistics',true),
    (c,'Giveaways & Family Support',true),
    (c,'Discipleship & Follow-Up',true),
    (c,'Serve Wherever Needed',true)
  on conflict(campaign_id,name) do nothing;
end $$;
