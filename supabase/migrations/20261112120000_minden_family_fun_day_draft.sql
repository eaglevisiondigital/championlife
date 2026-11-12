-- Minden, Louisiana Family Fun Day: inert city-scoped campaign + decision source.
-- SOURCE ONLY. Do not apply until independent target/RLS review, date/venue,
-- legal waiver approval, operator custody and separate hosted authorization.
-- Clones the Huntsville dual-intake contract; no accounts, access grants to
-- staff, activation, provider calls, or historical record mutation.
begin;
do $minden$
declare
  v_org uuid;
  v_campaign uuid;
begin
  lock table public.outreach_campaigns, public.outreach_registration_settings
    in share row exclusive mode;

  select id into strict v_org
    from public.organizations where slug = 'sowgo';

  if exists(
    select 1 from public.outreach_campaigns
    where code = 'minden_la_family_fun_day' or public_slug = 'minden-family-fun-day'
  ) or exists(
    select 1 from public.outreach_registration_settings
    where public_slug = 'minden-family-fun-day'
  ) then
    raise exception 'Minden campaign already exists; stop and inspect before install';
  end if;

  insert into public.outreach_campaigns (
    organization_id, code, name, public_slug, city, state_province, country,
    timezone, venue, event_start, event_end, registration_start, status
  ) values (
    v_org, 'minden_la_family_fun_day', 'Minden Family Fun Day Outreach',
    'minden-family-fun-day', 'Minden', 'LA', 'US', 'America/Chicago',
    '{}'::jsonb, null, null, null, 'draft'
  ) returning id into v_campaign;

  insert into public.outreach_registration_settings (
    campaign_id, public_slug, enabled, opens_at, closes_at,
    address_required, structured_address, emergency_phone_required,
    waiver_required, instructions, event_profile
  ) values (
    v_campaign, 'minden-family-fun-day', false, null, null,
    true, true, true, true,
    'Family Fun Day details, eligibility rules and check-in instructions will be confirmed by the event team. Pre-registration does not constitute event-day check-in or guarantee any prize.',
    jsonb_build_object(
      'public_name', 'FAMILY FUN DAY',
      'confirmation_message', 'Thank you for pre-registering your household for Minden Family Fun Day. Please follow the event team''s final check-in instructions.',
      'highlights', 'Family Fun Day · Community Outreach · Free Family Activities'
    )
  );

  perform private.outreach_audit(
    v_campaign, v_org, 'registration.draft_prepared',
    v_campaign, jsonb_build_object('enabled', false, 'waiver_published', false)
  );
end
$minden$;

-- Existing legacy decision-card intake is separate from household preregistration.
-- Maintain the Huntsville-approved bounded anonymous INSERT predicates and
-- extend only the accepted source allowlist. No SELECT/UPDATE/DELETE grant.
alter policy outreach_insert_public
  on public.outreach_registrations
  with check (
    user_id is null
    and source = any (array[
      'st_lucia_2026'::text,
      'bessemer_al_2026'::text,
      'huntsville_al_2026'::text,
      'minden_la_outreach'::text
    ])
    and length(btrim(first_name)) between 1 and 100
    and length(btrim(last_name)) between 1 and 100
    and length(btrim(email)) between 5 and 320
    and length(btrim(phone)) between 7 and 40
    and consent = true
  );
commit;
