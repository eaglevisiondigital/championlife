-- Forward-only correction for owner review list alias ambiguity (42702).
-- Original applied migration and data remain unchanged; no permission expansion.
do $$declare n bigint; h text; f text; policies text;begin
 if (select md5(prosrc) from pg_proc where oid='private.outreach_volunteer_workspace(text,jsonb)'::regprocedure) is distinct from '17ebe2f2ec19b7b18948dadf55034b40' then raise exception 'Volunteer workspace changed; reconcile before correction';end if;
 if (select md5(prosrc) from pg_proc where oid='private.has_staff_permission(uuid,text,uuid)'::regprocedure) is distinct from '347f5af5a57c5335d8e0f7c8f7513085' then raise exception 'Staff permission contract changed';end if;
 if to_regclass('supabase_migrations.schema_migrations') is not null then
 execute 'select count(*),md5(string_agg(version||coalesce(name,'''')::text,'','' order by version)) from supabase_migrations.schema_migrations where name<>''outreach_volunteer_applications_v1''' into n,h;
 if n is distinct from 31 or h is distinct from 'b2dcd5de4c28a286e653ee841f50d340' then raise exception 'Historical production migration ledger changed';end if;
 select md5(string_agg(pg_get_functiondef(p.oid),'' order by ns.nspname,p.proname,pg_get_function_identity_arguments(p.oid))) into f from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname in ('public','private') and p.prokind='f' and p.proname not like 'outreach_volunteer_%';
 select md5(string_agg(row(schemaname,tablename,policyname,roles,cmd,qual,with_check)::text,'' order by schemaname,tablename,policyname)) into policies from pg_policies where schemaname in ('public','private');
 if f is distinct from '2237aaa9f60264a2831d9117060152d4' or policies is distinct from '589f5711037c890258b48563a7c1d011' then raise exception 'Production function or RLS contracts changed';end if;
 end if;
end $$;
create or replace function private.outreach_volunteer_workspace(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
 declare c public.outreach_campaigns; a public.outreach_volunteer_applications; s public.outreach_volunteer_settings; result jsonb;
 begin
 select x.* into strict c from public.outreach_campaigns x join public.organizations o on o.id=x.organization_id where o.slug='sowgo' and x.code='minden_la_2026';
 if not private.outreach_volunteer_can(c.id) then raise exception 'Verified organization staff manager required' using errcode='42501';end if;
 if p_action='list' then return jsonb_build_object('campaign_id',c.id,'name',c.name,'settings',(select to_jsonb(v) from public.outreach_volunteer_settings v where campaign_id=c.id),'received',(select count(*) from public.outreach_volunteer_applications where campaign_id=c.id),'applications',(select coalesce(jsonb_agg(v order by v.submitted_at desc),'[]') from (select app_row.id,app_row.reference,app_row.first_name,app_row.last_name,app_row.status,app_row.submitted_at,app_row.revision,m.state confirmation_state,m.provider_status from public.outreach_volunteer_applications app_row join private.outreach_volunteer_mail m on m.application_id=app_row.id where app_row.campaign_id=c.id order by app_row.submitted_at desc,app_row.id limit 100 offset greatest(0,least(coalesce((p_data->>'offset')::int,0),100000))) v));end if;
 if p_action='settings' then
 select * into strict s from public.outreach_volunteer_settings where campaign_id=c.id for update;
 if not private.outreach_volunteer_can(c.id) then raise exception 'Access revoked' using errcode='42501';end if;
 if s.revision is distinct from (p_data->>'revision')::int or jsonb_typeof(p_data->'enabled')<>'boolean' then raise exception 'Refresh settings';end if;
 update public.outreach_volunteer_settings set enabled=(p_data->>'enabled')::boolean,revision=revision+1 where campaign_id=c.id;
 perform private.outreach_audit(c.id,c.organization_id,'volunteer.intake.settings',c.id,jsonb_build_object('enabled',p_data->'enabled'));
 return jsonb_build_object('saved',true);end if;
 select * into strict a from public.outreach_volunteer_applications where id=(p_data->>'id')::uuid and campaign_id=c.id for update;
 -- Recheck after lock, so expired/revoked permissions cannot complete a stale write.
 if not private.outreach_volunteer_can(c.id) then raise exception 'Access revoked' using errcode='42501';end if;
 if p_action='review' then
 if a.revision is distinct from (p_data->>'revision')::int or p_data->>'status' not in ('pending','under_review','waitlisted','not_selected','cancelled') or length(coalesce(p_data->>'note',''))>2000 then raise exception 'Invalid or stale review';end if;
 update public.outreach_volunteer_applications set status=p_data->>'status',review_note=coalesce(p_data->>'note',''),revision=revision+1 where id=a.id;
 perform private.outreach_audit(c.id,c.organization_id,'volunteer.application.review',a.id,jsonb_build_object('before',a.status,'after',p_data->>'status','note',p_data->>'note'));
 elsif p_action='mail_authorize' then
 return jsonb_build_object('id',a.id,'provider_id',(select provider_id from private.outreach_volunteer_mail where application_id=a.id));
 elsif p_action<>'detail' then raise exception 'Unknown workspace action';end if;
 select to_jsonb(v) into result from public.outreach_volunteer_applications v where id=a.id;
 return (result-'request_snapshot'-'request_key')||jsonb_build_object('confirmation',(select jsonb_build_object('state',m.state,'attempts',m.attempts,'provider_id',m.provider_id,'provider_status',m.provider_status,'last_error',m.last_error,'accepted_at',m.accepted_at) from private.outreach_volunteer_mail m where application_id=a.id),'history',(select coalesce(jsonb_agg(v order by v.created_at),'[]') from (select kind,actor_user_id,metadata,created_at from public.outreach_campaign_audit where campaign_id=c.id and subject_id=a.id) v));
 end $$;
