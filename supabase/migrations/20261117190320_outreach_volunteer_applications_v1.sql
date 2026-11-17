-- Issue159 P0: additive volunteer intake, separate from attendee registration.
-- Starts disabled. No Auth/People creation, staff grants or historical rewrites.
-- Fail on hosted contract drift; local synthetic replay has no provider migration ledger.
do $$declare n bigint; h text; f text; policies text;begin
 if (select md5(prosrc) from pg_proc where oid='private.has_staff_permission(uuid,text,uuid)'::regprocedure) is distinct from '347f5af5a57c5335d8e0f7c8f7513085' then raise exception 'Staff permission contract changed; reconcile before installation';end if;
 if to_regclass('supabase_migrations.schema_migrations') is not null then
 execute 'select count(*),md5(string_agg(version||coalesce(name,'''')::text,'','' order by version)) from supabase_migrations.schema_migrations' into n,h;
 if n<>31 or h<>'b2dcd5de4c28a286e653ee841f50d340' then raise exception 'Production migration ledger changed; reconcile before installation';end if;
 select md5(string_agg(pg_get_functiondef(p.oid),'' order by ns.nspname,p.proname,pg_get_function_identity_arguments(p.oid))) into f from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname in ('public','private') and p.prokind='f';
 select md5(string_agg(row(schemaname,tablename,policyname,roles,cmd,qual,with_check)::text,'' order by schemaname,tablename,policyname)) into policies from pg_policies where schemaname in ('public','private');
 if f<>'2237aaa9f60264a2831d9117060152d4' or policies<>'589f5711037c890258b48563a7c1d011' then raise exception 'Production function or RLS contracts changed; reconcile before installation';end if;
 end if;
end $$;
create table public.outreach_volunteer_settings (
 campaign_id uuid primary key references public.outreach_campaigns(id),
 event_date date not null, enabled boolean not null default false,
 revision integer not null default 1
);
create table public.outreach_volunteer_applications (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, organization_id uuid not null,
 request_key uuid not null, request_snapshot jsonb not null,
 reference text not null unique default ('V-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16))),
 first_name text not null check(length(btrim(first_name)) between 1 and 100),
 last_name text not null check(length(btrim(last_name)) between 1 and 100),
 email text not null check(length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 phone text not null default '' check(phone='' or (length(phone)<=40 and phone ~ '^[+0-9(). -]+$' and length(regexp_replace(phone,'[^0-9]','','g')) between 7 and 15)),
 attendance text check(attendance in ('Yes','No')), rv_experience text check(rv_experience in ('Yes','No')),
 travel_choice text check(travel_choice in ('ride_with_team','drive_self')),
 passenger_names text not null default '' check(length(passenger_names)<=1000),
 additional_information text not null default '' check(length(additional_information)<=4000),
 status text not null default 'pending' check(status in ('pending','under_review','waitlisted','not_selected','cancelled')),
 review_note text not null default '' check(length(review_note)<=2000), revision integer not null default 1,
 submitted_at timestamptz not null default now(),
 foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id),
 unique(campaign_id,request_key), unique(campaign_id,id)
);
create unique index outreach_volunteer_identity_idx on public.outreach_volunteer_applications(campaign_id,lower(btrim(email)),lower(btrim(first_name)),lower(btrim(last_name)));
create index outreach_volunteer_campaign_idx on public.outreach_volunteer_applications(campaign_id,submitted_at,id);
create table private.outreach_volunteer_limits (
 campaign_id uuid not null references public.outreach_campaigns(id), kind text not null check(kind in ('network','email')),
 fingerprint text not null, window_start timestamptz not null, attempts integer not null,
 primary key(campaign_id,kind,fingerprint,window_start)
);
create table private.outreach_volunteer_mail (
 application_id uuid primary key references public.outreach_volunteer_applications(id),
 payload jsonb not null, state text not null default 'pending' check(state in ('pending','sending','accepted','failed','held')),
 attempts integer not null default 0, first_attempt_at timestamptz, last_attempt_at timestamptz,
 lease uuid, leased_until timestamptz, provider_id uuid, provider_status text,
 last_error text, accepted_at timestamptz, updated_at timestamptz not null default now()
);
-- Preserve submitted answers and identity; review is an audited separate operation.
create function private.outreach_volunteer_preserve() returns trigger language plpgsql set search_path='' as $$
 begin
 if row(new.id,new.campaign_id,new.organization_id,new.request_key,new.request_snapshot,new.reference,new.first_name,new.last_name,new.email,new.phone,new.attendance,new.rv_experience,new.travel_choice,new.passenger_names,new.additional_information,new.submitted_at)
 is distinct from row(old.id,old.campaign_id,old.organization_id,old.request_key,old.request_snapshot,old.reference,old.first_name,old.last_name,old.email,old.phone,old.attendance,old.rv_experience,old.travel_choice,old.passenger_names,old.additional_information,old.submitted_at) then
 raise exception 'Submitted application is immutable' using errcode='42501'; end if; return new; end $$;
create trigger outreach_volunteer_preserve before update on public.outreach_volunteer_applications for each row execute function private.outreach_volunteer_preserve();
create trigger outreach_volunteer_no_delete before delete on public.outreach_volunteer_applications for each row execute function private.outreach_immutable();
create function private.outreach_volunteer_can(c uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.outreach_verified(auth.uid()) and exists(select 1 from public.outreach_campaigns x where x.id=c and private.has_staff_permission(x.organization_id,'staff.manage'))
$$;
create function private.outreach_volunteer_gateway(p_payload jsonb,p_network text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare c public.outreach_campaigns; a public.outreach_volunteer_applications; s public.outreach_volunteer_settings;
 k uuid; f text; l text; e text; ph text; at text; rv text; tr text; pn text; info text; snapshot jsonb; n integer; w timestamptz:=date_trunc('hour',now());
 begin
 if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>16000 or exists(select 1 from jsonb_object_keys(p_payload) key where key<>all(array['request_key','first_name','last_name','email','phone','attendance','rv_experience','travel_choice','passenger_names','additional_information'])) then raise exception 'Invalid application'; end if;
 if p_network is null or p_network !~ '^[a-f0-9]{64}$' then raise exception 'Invalid network'; end if;
 select x.* into strict c from public.outreach_campaigns x join public.organizations o on o.id=x.organization_id where o.slug='sowgo' and x.code='minden_la_2026' for update of x;
 select * into strict s from public.outreach_volunteer_settings where campaign_id=c.id;
 if not s.enabled or c.status in ('closed','cancelled','completed') then return jsonb_build_object('accepted',false,'reason','closed'); end if;
 if exists(select 1 from jsonb_each(p_payload) t where t.key<>'request_key' and jsonb_typeof(t.value) not in ('string','null')) then raise exception 'Text required';end if;
 k:=(p_payload->>'request_key')::uuid; if k is null then raise exception 'Request required'; end if;
 f:=btrim(coalesce(p_payload->>'first_name','')); l:=btrim(coalesce(p_payload->>'last_name','')); e:=lower(btrim(coalesce(p_payload->>'email',''))); ph:=btrim(coalesce(p_payload->>'phone',''));
 at:=nullif(p_payload->>'attendance','');rv:=nullif(p_payload->>'rv_experience','');tr:=nullif(p_payload->>'travel_choice','');pn:=btrim(coalesce(p_payload->>'passenger_names',''));info:=btrim(coalesce(p_payload->>'additional_information',''));
 if length(f) not between 1 and 100 or length(l) not between 1 and 100 or length(e)>254 or e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or (ph<>'' and (length(ph)>40 or ph !~ '^[+0-9(). -]+$' or length(regexp_replace(ph,'[^0-9]','','g')) not between 7 and 15)) or at not in ('Yes','No') or rv not in ('Yes','No') or tr not in ('ride_with_team','drive_self') or length(pn)>1000 or length(info)>4000 then raise exception 'Invalid application fields';end if;
 snapshot:=jsonb_build_object('first_name',f,'last_name',l,'email',e,'phone',ph,'attendance',at,'rv_experience',rv,'travel_choice',tr,'passenger_names',pn,'additional_information',info);
 -- Only short-lived, peppered network identifiers; no IP addresses.
 delete from private.outreach_volunteer_limits where campaign_id=c.id and window_start<now()-interval '2 days';
 -- Rate accounting before duplicate lookup; rejected results commit these counters.
 insert into private.outreach_volunteer_limits values(c.id,'network',p_network,w,1) on conflict(campaign_id,kind,fingerprint,window_start) do update set attempts=outreach_volunteer_limits.attempts+1 returning attempts into n;
 if n>30 then return jsonb_build_object('accepted',false,'reason','rate');end if;
 insert into private.outreach_volunteer_limits values(c.id,'email',md5(e),w,1) on conflict(campaign_id,kind,fingerprint,window_start) do update set attempts=outreach_volunteer_limits.attempts+1 returning attempts into n;
 if n>5 then return jsonb_build_object('accepted',false,'reason','rate');end if;
 select * into a from public.outreach_volunteer_applications where campaign_id=c.id and request_key=k;
 if found then if a.request_snapshot<>snapshot then return jsonb_build_object('accepted',false,'reason','conflict');end if;
 else
 select * into a from public.outreach_volunteer_applications where campaign_id=c.id and lower(btrim(email))=e and lower(btrim(first_name))=lower(f) and lower(btrim(last_name))=lower(l);
 if not found then
 insert into public.outreach_volunteer_applications(campaign_id,organization_id,request_key,request_snapshot,first_name,last_name,email,phone,attendance,rv_experience,travel_choice,passenger_names,additional_information)
 values(c.id,c.organization_id,k,snapshot,f,l,e,ph,at,rv,tr,pn,info) returning * into a;
 insert into private.outreach_volunteer_mail(application_id,payload) values(a.id,jsonb_build_object('version',1,'email',a.email,'first_name',a.first_name,'reference',a.reference));
 perform private.outreach_audit(c.id,c.organization_id,'volunteer.application.received',a.id,jsonb_build_object('reference',a.reference,'source','public','identity_linked',false));
 end if;end if;
 return jsonb_build_object('accepted',true,'application_id',a.id,'reference',a.reference);
 end $$;
create function public.outreach_volunteer_gateway(p_payload jsonb,p_network text) returns jsonb language sql security invoker set search_path='' as $$select private.outreach_volunteer_gateway(p_payload,p_network)$$;
create function private.outreach_volunteer_delivery(p_action text,p_id uuid,p_lease uuid default null,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
 declare m private.outreach_volunteer_mail; a public.outreach_volunteer_applications;
 begin
 select * into strict a from public.outreach_volunteer_applications where id=p_id;
 select * into strict m from private.outreach_volunteer_mail where application_id=p_id for update;
 if p_action='claim' then
 if m.state='accepted' then return jsonb_build_object('state','accepted');end if;
 if m.state in ('failed','held') or (m.leased_until is not null and m.leased_until>now()) then return jsonb_build_object('state',m.state);end if;
 if m.attempts>=3 then update private.outreach_volunteer_mail set state='held',last_error='Retry limit requires provider review',updated_at=now() where application_id=p_id;return jsonb_build_object('state','held');end if;
 if m.first_attempt_at<now()-interval '23 hours' then update private.outreach_volunteer_mail set state='held',last_error='Idempotency window requires provider review',updated_at=now() where application_id=p_id;return jsonb_build_object('state','held');end if;
 update private.outreach_volunteer_mail set state='sending',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),last_attempt_at=now(),lease=gen_random_uuid(),leased_until=now()+interval '2 minutes',updated_at=now() where application_id=p_id returning * into m;
 return jsonb_build_object('state','claimed','lease',m.lease,'payload',m.payload,'key','minden-volunteer-v1/'||a.id);
 elsif p_action='result' then
 if m.lease is distinct from p_lease or m.state<>'sending' then raise exception 'Stale delivery lease';end if;
 if p_data->>'state' not in ('accepted','pending','failed') then raise exception 'Invalid delivery state';end if;
 if p_data->>'state'='accepted' and nullif(p_data->>'provider_id','') is null then raise exception 'Provider receipt required';end if;
 update private.outreach_volunteer_mail set state=p_data->>'state',provider_id=(p_data->>'provider_id')::uuid,accepted_at=case when p_data->>'state'='accepted' then now() else null end,last_error=left(p_data->>'error',200),leased_until=null,updated_at=now() where application_id=p_id;
 perform private.outreach_audit(a.campaign_id,a.organization_id,'volunteer.confirmation.'||(p_data->>'state'),a.id,jsonb_build_object('attempt',m.attempts,'provider_id',p_data->>'provider_id'));
 return jsonb_build_object('state',p_data->>'state');
 elsif p_action='provider_receipt' then
 if m.provider_id is null or (p_data->>'provider_id')::uuid<>m.provider_id or p_data->>'status' not in ('sent','delivered','delivery_delayed','bounced','complained','failed') then raise exception 'Invalid receipt';end if;
 update private.outreach_volunteer_mail set provider_status=p_data->>'status',updated_at=now() where application_id=p_id;
 return jsonb_build_object('state',m.state,'delivery',p_data->>'status');
 end if;raise exception 'Unknown delivery action';end $$;
create function public.outreach_volunteer_delivery(p_action text,p_id uuid,p_lease uuid default null,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.outreach_volunteer_delivery(p_action,p_id,p_lease,p_data)$$;
create function private.outreach_volunteer_workspace(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
 declare c public.outreach_campaigns; a public.outreach_volunteer_applications; s public.outreach_volunteer_settings; result jsonb;
 begin
 select x.* into strict c from public.outreach_campaigns x join public.organizations o on o.id=x.organization_id where o.slug='sowgo' and x.code='minden_la_2026';
 if not private.outreach_volunteer_can(c.id) then raise exception 'Verified organization staff manager required' using errcode='42501';end if;
 if p_action='list' then return jsonb_build_object('campaign_id',c.id,'name',c.name,'settings',(select to_jsonb(v) from public.outreach_volunteer_settings v where campaign_id=c.id),'received',(select count(*) from public.outreach_volunteer_applications where campaign_id=c.id),'applications',(select coalesce(jsonb_agg(v order by v.submitted_at desc),'[]') from (select a.id,a.reference,a.first_name,a.last_name,a.status,a.submitted_at,a.revision,m.state confirmation_state,m.provider_status from public.outreach_volunteer_applications a join private.outreach_volunteer_mail m on m.application_id=a.id where a.campaign_id=c.id order by a.submitted_at desc,a.id limit 100 offset greatest(0,least(coalesce((p_data->>'offset')::int,0),100000))) v));end if;
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
create function public.outreach_volunteer_workspace(p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.outreach_volunteer_workspace(p_action,p_data)$$;
-- Explicitly lock every new table and function; no raw client grants or public policy.
alter table public.outreach_volunteer_settings enable row level security;
alter table public.outreach_volunteer_applications enable row level security;
alter table private.outreach_volunteer_limits enable row level security;
alter table private.outreach_volunteer_mail enable row level security;
revoke all on public.outreach_volunteer_settings,public.outreach_volunteer_applications,private.outreach_volunteer_limits,private.outreach_volunteer_mail from public,anon,authenticated;
do $$declare f regprocedure;begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like 'outreach_volunteer_%' loop execute format('revoke all on function %s from public,anon,authenticated',f);end loop;end $$;
grant execute on function public.outreach_volunteer_gateway(jsonb,text),private.outreach_volunteer_gateway(jsonb,text),public.outreach_volunteer_delivery(text,uuid,uuid,jsonb),private.outreach_volunteer_delivery(text,uuid,uuid,jsonb) to service_role;
grant execute on function public.outreach_volunteer_workspace(text,jsonb),private.outreach_volunteer_workspace(text,jsonb) to authenticated;
-- One canonical campaign, volunteer intake disabled; no Family Fun Day registration settings.
do $$declare org uuid; c uuid;begin
 select id into strict org from public.organizations where slug='sowgo';
 if exists(select 1 from public.outreach_campaigns where organization_id=org and (code='minden_la_2026' or public_slug='minden-2026')) then raise exception 'Minden campaign already exists: reconcile before installation';end if;
 insert into public.outreach_campaigns(organization_id,code,name,public_slug,city,state_province,country,timezone,status,public_page) values(org,'minden_la_2026','Minden, Louisiana — December 19, 2026','minden-2026','Minden','LA','US','America/Chicago','preparing','/minden-serve.html') returning id into c;
 insert into public.outreach_volunteer_settings(campaign_id,event_date) values(c,'2026-12-19');
end $$;
