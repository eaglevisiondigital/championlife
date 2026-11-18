-- Deliberately installs NO attendee settings, waiver version, grant or anonymous insert policy.
-- Existing campaign is the approved canonical Minden event. Do not create another event.
-- Attendee intake remains disabled until local host/park/LA waiver/guardian/media/privacy/bike rules
-- and exact activation package receive separate owner approval. No Huntsville terms may be used.
do $$ begin
 if exists(select 1 from public.outreach_registration_settings where campaign_id='d26b8337-d215-42d3-ac3b-c771f7f07db7' and enabled) then
  raise exception 'Minden attendee intake unexpectedly enabled; stop for reconciliation';
 end if;
end $$;
