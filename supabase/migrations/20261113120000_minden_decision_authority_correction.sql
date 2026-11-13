-- SOURCE-ONLY correction to the uninstalled PR149 decision desk.
-- Registration/check-in authority is never ministry-decision authority.
-- No source mapping, staff assignment, identity association or foundation import.
begin;
create or replace function public.outreach_minden_decisions(p_campaign uuid)
returns jsonb language plpgsql volatile security definer set search_path=''
as $minden_scoped$
declare c record; result jsonb; rows jsonb;
begin
 if auth.uid() is null then
  raise exception 'Minden decision access denied' using errcode='42501';
 end if;
 if to_regprocedure('public.campaign_decision_foundation(text,uuid,uuid,jsonb)') is null
 or to_regclass('public.outreach_decision_campaign_sources') is null then
  raise exception 'Reviewed campaign decision foundation required' using errcode='55000';
 end if;
 select campaign.id, campaign.organization_id into strict c
 from public.outreach_campaigns campaign join public.organizations org on org.id=campaign.organization_id
 join public.outreach_decision_campaign_sources source on source.campaign_id=campaign.id
 where campaign.code='minden_la_family_fun_day' and campaign.public_slug='minden-family-fun-day'
 and org.slug='sowgo' and source.source='minden_la_outreach' and source.active;
 if p_campaign is not null and p_campaign<>c.id then
  raise exception 'Minden decision access denied' using errcode='42501';
 end if;
 -- The unchanged canonical foundation rechecks current Auth session, exact org,
 -- finite campaign authority and exact assigned records; never registration.view.
 result:=public.campaign_decision_foundation(case when p_campaign is null then 'context' else 'list' end,
   c.organization_id,c.id,'{}'::jsonb);
 -- Revalidate exact provenance AFTER canonical authority acquired its ordered
 -- campaign/assignment/source locks. Never lock source before that authority.
 if not exists(select 1 from public.outreach_campaigns campaign
  join public.organizations org on org.id=campaign.organization_id
  join public.outreach_decision_campaign_sources source on source.campaign_id=campaign.id
  where campaign.id=c.id and campaign.organization_id=c.organization_id
   and campaign.code='minden_la_family_fun_day' and campaign.public_slug='minden-family-fun-day'
   and org.slug='sowgo' and source.source='minden_la_outreach' and source.active) then
  raise exception 'Reviewed Minden source mapping required' using errcode='42501';
 end if;
 if result->>'organization_id' is distinct from c.organization_id::text
 or result->>'campaign_id' is distinct from c.id::text then
  raise exception 'Decision scope mismatch' using errcode='42501';
 end if;
 if p_campaign is null then
  return jsonb_build_object('kind','minden-decision-context','organization_id',c.organization_id,'campaign_id',c.id,'scope','assigned');
 end if;
 if jsonb_typeof(result->'registrations') is distinct from 'array' then
  raise exception 'Invalid decision response' using errcode='55000';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'registration_id',r->'registration_id','kind',r->'kind','name',r->'name',
  'decision',r->'decision','registered_at',r->'registered_at','consent',r->'consent',
  'status',r->'status','revision',r->'revision','next_contact_on',r->'next_contact_on',
  'contact_allowed',false)), '[]'::jsonb) into rows
 from jsonb_array_elements(result->'registrations') r;
 return jsonb_build_object('kind','minden-assigned-decisions','organization_id',c.organization_id,
  'campaign_id',c.id,'page',0,'registrations',rows);
exception when no_data_found or too_many_rows then
 raise exception 'Reviewed Minden source mapping required' using errcode='42501';
end
$minden_scoped$;
revoke all on function public.outreach_minden_decisions(uuid) from public,anon,authenticated,service_role;
grant execute on function public.outreach_minden_decisions(uuid) to authenticated;
commit;
