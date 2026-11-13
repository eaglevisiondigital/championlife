-- Minden decision follow-up: source-specific, permission-scoped read-only RPC.
-- SOURCE ONLY. Independent security/production baseline review required before install.
-- The separate legacy decision intake has no campaign FK. The exact source tag
-- binds these entries only to the canonical Minden campaign, never Huntsville.
begin;

create function public.outreach_minden_decisions(p_campaign uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $minden_decisions$
declare
  v_count bigint;
  v_rows jsonb;
begin
  if auth.uid() is null
     or not coalesce(private.outreach_registration_can(p_campaign, 'registration.view'), false)
     or not exists (
       select 1 from public.outreach_campaigns c
       join public.organizations o on o.id=c.organization_id
       where c.id=p_campaign
         and c.code='minden_la_family_fun_day'
         and c.public_slug='minden-family-fun-day'
         and o.slug='sowgo'
     ) then
    raise exception 'Minden decision access denied' using errcode='42501';
  end if;

  select count(*) into v_count
    from public.outreach_registrations
    where source='minden_la_outreach';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'first_name', r.first_name,
      'last_name', r.last_name,
      'email', r.email,
      'phone', r.phone,
      'decision', r.decision,
      'prayer_request', r.prayer_request,
      'created_at', r.created_at
    ) order by r.created_at desc, r.id desc
  ), '[]'::jsonb) into v_rows
  from (
    select id, first_name, last_name, email, phone, decision,
           prayer_request, created_at
    from public.outreach_registrations
    where source='minden_la_outreach'
    order by created_at desc, id desc
    limit 250
  ) r;

  return jsonb_build_object(
    'campaign', 'minden-family-fun-day',
    'total', v_count,
    'shown', jsonb_array_length(v_rows),
    'decisions', v_rows
  );
end
$minden_decisions$;

revoke all on function public.outreach_minden_decisions(uuid)
  from public, anon, authenticated;
grant execute on function public.outreach_minden_decisions(uuid)
  to authenticated;

commit;
