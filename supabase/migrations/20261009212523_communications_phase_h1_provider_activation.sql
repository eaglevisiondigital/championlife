-- H1 additive build candidate. No hosted application, bootstrap grant, provider secret or activation.
alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;
alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check(permission=any(array['people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage','staff.view','staff.manage','finance.read','finance.configure','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage','events.view','events.manage','registrations.view','registrations.manage','outreach.view','outreach.manage','courses.manage','forms.view','forms.manage','checkin.view','checkin.manage','registrations.restricted','registrations.override','dream_team.application.read','dream_team.application.manage','dream_team.application.restricted','dream_team.placement.manage','communications.send','communications.view','communications.bulk_send','communications.templates.view','communications.templates.manage','communications.delivery.view','communications.providers.view','communications.providers.manage','communications.providers.test','communications.providers.enable']::text[]));
create or replace function private.staff_permission_keys() returns text[] language sql immutable set search_path='' as $$
 select array['people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage','staff.view','staff.manage','finance.read','finance.configure','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage','events.view','events.manage','registrations.view','registrations.manage','outreach.view','outreach.manage','courses.manage','forms.view','forms.manage','checkin.view','checkin.manage','registrations.restricted','registrations.override','dream_team.application.read','dream_team.application.manage','dream_team.application.restricted','dream_team.placement.manage','communications.send','communications.view','communications.bulk_send','communications.templates.view','communications.templates.manage','communications.delivery.view','communications.providers.view','communications.providers.manage','communications.providers.test','communications.providers.enable']::text[]
$$;

create or replace function private.comm_workspace(action text,c uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o uuid:=(p->>'organization_id')::uuid;camp public.outreach_campaigns;t public.communication_templates;b public.communication_batches;m public.communication_outbox;profile public.communication_sender_profiles;
 target_id uuid:=(p->>'id')::uuid;recipient jsonb;items jsonb;vars jsonb;result jsonb;key text;ch text;typ text;purp text;subj text;body text;addr text;block text;cfg public.communication_settings;needs text;at_time timestamptz;cnt integer;allowed text[]:=array['communications.view','communications.send','communications.bulk_send','communications.templates.view','communications.templates.manage','communications.delivery.view','communications.providers.view','communications.providers.manage','communications.providers.test','communications.providers.enable'];
begin
 if not private.outreach_verified(auth.uid()) then raise exception 'Verified identity required' using errcode='42501';end if;
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>32000 then raise exception 'Invalid request';end if;
 if action='context' then return jsonb_build_object(
 'organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'permissions',(select jsonb_agg(k) from unnest(allowed) k where private.comm_can(x.id,null,k)))),'[]') from public.organizations x where exists(select 1 from unnest(allowed) k where private.comm_can(x.id,null,k))),
 'campaigns',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'organization_id',x.organization_id,'name',x.name,'permissions',(select jsonb_agg(k) from unnest(allowed) k where private.comm_can(x.organization_id,x.id,k)))),'[]') from public.outreach_campaigns x where exists(select 1 from unnest(allowed) k where private.comm_can(x.organization_id,x.id,k))));end if;
 if c is not null then select * into camp from public.outreach_campaigns where id=c;if not found or (o is not null and o<>camp.organization_id) then raise exception 'Campaign denied' using errcode='42501';end if;o:=camp.organization_id;end if;
 if o is null then raise exception 'Organization required';end if;
 needs:=case when action in ('template_create','template_edit','template_publish','template_deactivate','route_save') then 'communications.templates.manage' when action in ('templates','template_preview') then 'communications.templates.view' when action in ('preview','confirm','cancel','retry','consent','preferences','suppress','external_action','senders') then 'communications.send' when action in ('activity','message','batch','history','external_history') then 'communications.delivery.view' else 'communications.view' end;
 if not private.comm_can(o,c,needs) then raise exception 'Communications access denied' using errcode='42501';end if;
 perform private.comm_lock(o);
 if not private.comm_can(o,c,needs) then raise exception 'Communications access revoked' using errcode='42501';end if;
 insert into public.communication_settings(organization_id) values(o) on conflict do nothing;
 select * into cfg from public.communication_settings where organization_id=o;
 if action='overview' then
  return jsonb_build_object('metrics',(select coalesce(jsonb_object_agg(status,n),'{}') from (select status,count(*) n from public.communication_outbox where organization_id=o and campaign_id is not distinct from c group by status) x),'delivery_mode',cfg.delivery_mode,'permissions',(select jsonb_agg(k) from unnest(allowed) k where private.comm_can(o,c,k)),
  'senders',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.communication_sender_profiles s where s.organization_id=o and s.active),'routes',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.communication_routes r where r.organization_id=o and r.campaign_id=c));
 elsif action='senders' then
  return coalesce((select jsonb_agg(to_jsonb(x)) from public.communication_sender_profiles x where x.organization_id=o and x.active),'[]');
 elsif action='templates' then
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.template_key,x.version desc) from public.communication_templates x where x.organization_id=o),'[]');
 elsif action in ('template_create','template_edit') then
  if action='template_edit' then select * into t from public.communication_templates where organization_id=o and communication_templates.id=target_id;if not found or t.state<>'draft' or t.revision<>(p->>'revision')::int then raise exception 'Current draft required';end if;
  else t.id:=gen_random_uuid();t.template_key:=p->>'template_key';t.channel:=p->>'channel';t.locale:=coalesce(p->>'locale','en');select coalesce(max(version),0)+1 into t.version from public.communication_templates where organization_id=o and template_key=t.template_key and channel=t.channel and locale=t.locale;end if;
  -- Validate token names without accepting arbitrary code. Preview supplies actual data later.
  perform private.comm_render(coalesce(p->>'subject','')||' '||(p->>'body'),'{"first_name":"sample","campaign_name":"sample","campaign_date":"sample","church_name":"sample","task_name":"sample","due_date":"sample","portal_link":"sample","registration_link":"sample","event_location":"sample","coordinator_name":"sample"}');
  if action='template_create' then insert into public.communication_templates(id,organization_id,template_key,channel,message_type,purpose,version,locale,subject,body,created_by) values(t.id,o,t.template_key,t.channel,p->>'message_type',p->>'purpose',t.version,t.locale,coalesce(p->>'subject',''),p->>'body',auth.uid()) returning * into t;
  else update public.communication_templates set subject=coalesce(p->>'subject',''),body=p->>'body',revision=revision+1 where communication_templates.id=t.id returning * into t;end if;
  perform private.comm_audit(o,c,action,t.id);return to_jsonb(t);
 elsif action in ('template_publish','template_deactivate','template_preview') then
  select * into t from public.communication_templates where organization_id=o and communication_templates.id=target_id;if not found then raise exception 'Template denied' using errcode='42501';end if;
  if action='template_preview' then return jsonb_build_object('subject',private.comm_render(t.subject,coalesce(p->'variables','{}')),'body',private.comm_render(t.body,coalesce(p->'variables','{}')));end if;
  if action='template_publish' and t.state='draft' then
   if t.revision<>(p->>'revision')::int then raise exception 'Draft revision changed';end if;
   update public.communication_templates set active=false where organization_id=o and template_key=t.template_key and channel=t.channel and locale=t.locale and active;
   update public.communication_templates set state='published',active=true,published_at=now() where communication_templates.id=target_id returning * into t;
  elsif action='template_deactivate' then update public.communication_templates set active=false where communication_templates.id=target_id returning * into t;end if;
  perform private.comm_audit(o,c,action,t.id);return to_jsonb(t);
 elsif action in ('consent','preferences','suppress','external_action') then
  select x into recipient from jsonb_array_elements(private.comm_audience(o,c,p->'audience')) x where x->>'key'=p->>'recipient_key';
  if recipient is null then raise exception 'Recipient denied' using errcode='42501';end if;
  ch:=p->>'channel';key:=recipient->>'key';addr:=private.comm_address(ch,recipient->>ch);
  if action='consent' then
   if coalesce(p->>'status','') not in ('granted','revoked') or length(coalesce(p->>'proof_reference',''))<5 or coalesce((p->>'explicitly_reviewed')::boolean,false)=false then raise exception 'Explicit reviewed consent proof required';end if;
   insert into public.communication_consents(organization_id,campaign_id,recipient_key,channel,purpose,status,source,proof_reference,recorded_by,revoked_at) values(o,c,key,ch,p->>'purpose',p->>'status',p->>'source',p->>'proof_reference',auth.uid(),case when p->>'status'='revoked' then now() end)
   on conflict(organization_id,coalesce(campaign_id,'00000000-0000-0000-0000-000000000000'::uuid),recipient_key,channel,purpose) do update set status=excluded.status,source=excluded.source,proof_reference=excluded.proof_reference,recorded_by=excluded.recorded_by,recorded_at=now(),revoked_at=excluded.revoked_at returning to_jsonb(communication_consents) into result;
  elsif action='preferences' then
   insert into public.communication_preferences(organization_id,recipient_key,email_allowed,sms_allowed,preferred_channel,timezone) values(o,key,(p->>'email_allowed')::boolean,(p->>'sms_allowed')::boolean,p->>'preferred_channel',coalesce(p->>'timezone','UTC')) on conflict(organization_id,recipient_key) do update set email_allowed=excluded.email_allowed,sms_allowed=excluded.sms_allowed,preferred_channel=excluded.preferred_channel,timezone=excluded.timezone returning to_jsonb(communication_preferences) into result;
  elsif action='suppress' then
   insert into public.communication_suppressions(organization_id,channel,address,reason) values(o,ch,addr,'admin') on conflict(organization_id,channel,address,reason) do update set active=true,cleared_at=null;result:=jsonb_build_object('suppressed',true);
  else if ch not in ('email','sms') then raise exception 'External channel required';end if;result:=jsonb_build_object('recorded_as','external_manual','delivered',false);end if;
  perform private.comm_audit(o,c,action,null,jsonb_build_object('recipient_key',key,'channel',ch,'status',p->>'status','purpose',p->>'purpose','external_manual',action='external_action'));return result;
 elsif action='preview' then
  select * into b from public.communication_batches where organization_id=o and request_key=(p->>'request_key')::uuid;
  if found then if b.request_snapshot<>p or b.created_by<>auth.uid() or b.campaign_id is distinct from c then raise exception 'Request key conflict';end if;return jsonb_build_object('batch',to_jsonb(b),'delivery_mode',cfg.delivery_mode);end if;
  ch:=p->>'channel';select * into profile from public.communication_sender_profiles where organization_id=o and communication_sender_profiles.id=(p->>'sender_profile_id')::uuid and active and channel=ch;
  if not found then raise exception 'Approved sender profile required';end if;
  if p->>'template_id' is not null then select * into t from public.communication_templates where organization_id=o and communication_templates.id=(p->>'template_id')::uuid and active and channel=ch;if not found then raise exception 'Published matching template required';end if;typ:=t.message_type;purp:=t.purpose;subj:=t.subject;body:=t.body;
  else typ:=p->>'message_type';purp:=p->>'purpose';subj:=coalesce(p->>'subject','');body:=p->>'body';if length(body) not between 1 and 12000 or length(subj)>240 or subj ~ E'[\r\n]' or typ='marketing' and purp<>'marketing' then raise exception 'Invalid composed content';end if;end if;
  items:='[]';for recipient in select x from jsonb_array_elements(private.comm_audience(o,c,p->'audience')) x loop
   addr:=private.comm_address(ch,recipient->>ch);vars:=private.comm_variables(o,c,recipient,coalesce(p->'variables','{}'));block:=private.comm_block(o,c,recipient->>'key',ch,addr,purp);
   begin
    result:=jsonb_build_object('subject',private.comm_render(subj,vars),'body',private.comm_render(body,vars)||case when profile.footer<>'' then E'\n\n'||profile.footer else '' end);
   exception when others then if SQLERRM like 'Missing template variable:%' then block:='missing_template_data';result:=jsonb_build_object('subject',subj,'body',body,'warning',SQLERRM);else raise;end if;end;
   items:=items||jsonb_build_array(recipient||result||jsonb_build_object('address',coalesce(addr,''),'blocked',block,'variables',vars));
  end loop;
  -- Canonical identity dedupe, deterministic ordering; also avoid duplicate destination within this intended send.
  select coalesce(jsonb_agg(x order by x->>'key'),'[]') into items from (select distinct on (coalesce(nullif(x->>'address',''),x->>'key')) x from jsonb_array_elements(items) x order by coalesce(nullif(x->>'address',''),x->>'key'),x->>'key') q;
  cnt:=jsonb_array_length(items);if cnt>1 and not private.comm_can(o,c,'communications.bulk_send') then raise exception 'Bulk send permission required' using errcode='42501';end if;
  at_time:=coalesce((p->>'scheduled_at')::timestamptz,now());
  insert into public.communication_batches(organization_id,campaign_id,request_key,created_by,request_snapshot,recipients,channel,message_type,purpose,template_id,sender_profile_id,subject,body,variables,campaign_revision,scheduled_at)
  values(o,c,(p->>'request_key')::uuid,auth.uid(),p,items,ch,typ,purp,t.id,profile.id,subj,body,coalesce(p->'variables','{}'),camp.revision,at_time) returning * into b;
  perform private.comm_audit(o,c,'audience.preview',b.id,jsonb_build_object('count',cnt));return jsonb_build_object('batch',to_jsonb(b),'delivery_mode',cfg.delivery_mode);
 elsif action='confirm' then
  select * into b from public.communication_batches where organization_id=o and communication_batches.id=target_id and campaign_id is not distinct from c;
  if not found or b.created_by<>auth.uid() then raise exception 'Batch denied' using errcode='42501';end if;
  if b.state='queued' then return jsonb_build_object('id',b.id,'state',b.state);end if;
  if b.state<>'draft' or not coalesce((p->>'confirmed')::boolean,false) or b.created_at<now()-interval '15 minutes' then raise exception 'Current explicit confirmation required';end if;
  if c is not null and b.campaign_revision<>camp.revision then raise exception 'Campaign changed; preview again';end if;
  if b.template_id is not null and not exists(select 1 from public.communication_templates where communication_templates.id=b.template_id and active) then raise exception 'Template changed; preview again';end if;
  if not exists(select 1 from public.communication_sender_profiles where communication_sender_profiles.id=b.sender_profile_id and active) then raise exception 'Sender inactive';end if;
  cnt:=jsonb_array_length(b.recipients);if cnt>1 and not private.comm_can(o,c,'communications.bulk_send') then raise exception 'Bulk send permission required' using errcode='42501';end if;
  -- All counts serialize with enqueue on the organization lock; legitimate limits are tenant-configurable.
  if (select count(*) from public.communication_outbox where organization_id=o and created_at>now()-make_interval(secs=>cfg.window_seconds))+cnt>cfg.organization_limit or
   (select count(*) from public.communication_outbox where organization_id=o and campaign_id is not distinct from c and created_at>now()-make_interval(secs=>cfg.window_seconds))+cnt>cfg.campaign_limit or
   (select count(*) from public.communication_outbox msg join public.communication_batches x on x.id=msg.batch_id where msg.organization_id=o and x.created_by=auth.uid() and msg.created_at>now()-make_interval(secs=>cfg.window_seconds))+cnt>cfg.user_limit then raise exception 'Communications rate limit' using errcode='54000';end if;
  for recipient in select x from jsonb_array_elements(b.recipients) x loop
   if not exists(select 1 from jsonb_array_elements(private.comm_audience(o,c,b.request_snapshot->'audience')) x where x->>'key'=recipient->>'key' and private.comm_address(b.channel,x->>b.channel)=recipient->>'address') then raise exception 'Audience changed; preview again';end if;
   if (select count(*) from public.communication_outbox where organization_id=o and recipient_key=recipient->>'key' and created_at>now()-make_interval(secs=>cfg.window_seconds))>=cfg.recipient_limit then raise exception 'Recipient rate limit' using errcode='54000';end if;
   if recipient->>'blocked'='missing_template_data' then continue;end if;
   perform private.comm_enqueue(o,c,recipient,b.channel,b.message_type,b.purpose,b.template_id,b.sender_profile_id,recipient->>'subject',recipient->>'body','batch:'||b.id||':'||(recipient->>'key')||':'||b.channel,b.scheduled_at,b.id);
  end loop;
  update public.communication_batches set state='queued',confirmed_at=now() where communication_batches.id=b.id;
  select count(*) into cnt from public.communication_outbox where batch_id=b.id;perform private.comm_audit(o,c,'bulk.confirmed',b.id,jsonb_build_object('count',cnt));return jsonb_build_object('id',b.id,'state','queued','count',cnt);
 elsif action='external_history' then
  if p->>'person_id' is null or not private.person_permission(o,(p->>'person_id')::uuid,'people.read') then raise exception 'People history access denied' using errcode='42501';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('channel',a.metadata->>'channel','created_at',a.created_at,'campaign_id',a.campaign_id,'status','external_manual')) from public.communication_audit a where a.organization_id=o and (c is null or a.campaign_id=c) and a.kind='external_action' and a.metadata->>'recipient_key'='person:'||(p->>'person_id')),'[]');
 elsif action in ('activity','history') then
  if action='history' then
   if p->>'person_id' is null or not private.person_permission(o,(p->>'person_id')::uuid,'people.read') then raise exception 'People history access denied' using errcode='42501';end if;
  end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select id,campaign_id,recipient_key,recipient_name,channel,message_type,template_id,status,provider,provider_message_id,failure_class,created_at,scheduled_at,sent_at,delivered_at,failed_at,attempts from public.communication_outbox where organization_id=o and (campaign_id is not distinct from c or (action='history' and c is null))
   and (action<>'history' or recipient_key='person:'||(p->>'person_id')) and (coalesce(p->>'channel','')='' or channel=p->>'channel') and (coalesce(p->>'status','')='' or status=p->>'status') and (coalesce(p->>'message_type','')='' or message_type=p->>'message_type') and (coalesce(p->>'provider','')='' or provider=p->>'provider') and (coalesce(p->>'recipient','')='' or recipient_name ilike '%'||(p->>'recipient')||'%') and (p->>'from' is null or created_at>=(p->>'from')::timestamptz) and (p->>'to' is null or created_at<(p->>'to')::timestamptz+interval '1 day') order by created_at desc limit 200) x),'[]');
 elsif action in ('message','batch','cancel','retry') then
  if action='batch' then select * into b from public.communication_batches where organization_id=o and communication_batches.id=target_id and campaign_id is not distinct from c;if not found then raise exception 'Batch denied' using errcode='42501';end if;return (to_jsonb(b)-'recipients'-'body'-'subject'-'variables'-'request_snapshot')||jsonb_build_object('messages',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.recipient_name,'status',x.status,'failure_class',x.failure_class)),'[]') from public.communication_outbox x where x.batch_id=b.id));end if;
  select * into m from public.communication_outbox where organization_id=o and communication_outbox.id=target_id and campaign_id is not distinct from c;if not found then raise exception 'Message denied' using errcode='42501';end if;
  if action='message' then if not private.comm_can(o,c,'communications.view') then raise exception 'Message body access denied' using errcode='42501';end if;return to_jsonb(m)-'lease_token';end if;
  if action='cancel' and m.status in ('draft','queued','scheduled') then update public.communication_outbox set status='cancelled',credits_released=credits_reserved,credits_reserved=0 where communication_outbox.id=target_id;
  elsif action='retry' and m.status='failed' and m.failure_class='transient' and m.attempts<cfg.max_attempts then update public.communication_outbox set status='queued',scheduled_at=now(),failure_class=null where communication_outbox.id=target_id;
  else raise exception 'Message state cannot be changed';end if;
  perform private.comm_audit(o,c,action,target_id);return jsonb_build_object('id',target_id,'action',action);
 elsif action='route_save' then
  if c is null or not private.comm_can(o,c,'communications.send') or not private.comm_can(o,c,'communications.bulk_send') or not coalesce((p->>'confirmed')::boolean,false) then raise exception 'Explicit automation approval required' using errcode='42501';end if;
  select * into t from public.communication_templates where organization_id=o and communication_templates.id=(p->>'template_id')::uuid and active;if not found then raise exception 'Published route template required';end if;
  select * into profile from public.communication_sender_profiles where organization_id=o and communication_sender_profiles.id=(p->>'sender_profile_id')::uuid and active and channel=t.channel;if not found then raise exception 'Matching approved sender required';end if;
  perform private.comm_audience(o,c,p->'audience');
  insert into public.communication_routes(organization_id,campaign_id,event_kind,template_id,sender_profile_id,audience,enabled,approved_by,approved_at) values(o,c,p->>'event_kind',t.id,(p->>'sender_profile_id')::uuid,p->'audience',coalesce((p->>'enabled')::boolean,false),auth.uid(),now()) on conflict(campaign_id,event_kind,template_id) do update set audience=excluded.audience,enabled=excluded.enabled,approved_by=excluded.approved_by,approved_at=excluded.approved_at returning to_jsonb(communication_routes) into result;
  perform private.comm_audit(o,c,'route.approved',(result->>'id')::uuid);return result;
 else raise exception 'Unknown communications action';end if;
end$$;
-- Trusted worker surface only. No browser worker credentials or arbitrary provider dispatch.
-- Global control is explicitly bootstrapped later by a trusted operator; no staff.manage inference.
create table public.communication_external_control (
 singleton boolean primary key default true check(singleton), external_enabled boolean not null default false,
 environment text not null default 'unconfigured' check(environment in ('unconfigured','acceptance','production')),
 project_ref text check(project_ref ~ '^[a-z]{20}$'), revision integer not null default 1,
 check((environment='unconfigured')=(project_ref is null))
);
insert into public.communication_external_control(singleton)values(true);
create table public.communication_super_admins (
 user_id uuid primary key references auth.users(id), active boolean not null default false,
 expires_at timestamptz not null, approved_by uuid references auth.users(id), reason text not null check(length(reason)>5)
);
create table public.communication_org_delivery (
 organization_id uuid primary key references public.organizations(id), enabled boolean not null default false,
 email_enabled boolean not null default false, sms_enabled boolean not null default false
);
create table public.communication_provider_controls (
 profile_id uuid primary key, organization_id uuid not null, environment text not null check(environment in ('acceptance','production')),
 project_ref text not null check(project_ref ~ '^[a-z]{20}$'), provider_name text not null check(length(provider_name) between 1 and 120),
 configured boolean not null default false, credentials_verified boolean not null default false, sender_approved boolean not null default false,
 mode text not null default 'disabled' check(mode in ('disabled','configured','verification_pending','verified','test_only','production_enabled','suspended')),
 enabled boolean not null default false, production_allowed boolean not null default false,
 sending_domain text, allowed_classes text[] not null default array['transactional']::text[] check(allowed_classes <@ array['transactional','operational','reminder','follow_up','campaign','marketing','receipt','security']::text[]),
 health text not null default 'unknown' check(health in ('healthy','degraded','disabled','configuration_error','provider_error','unknown')),
 last_success_at timestamptz, last_failure_at timestamptz,last_callback_at timestamptz,last_verified_at timestamptz,
 consecutive_failures integer not null default 0 check(consecutive_failures>=0), revision integer not null default 1,
 foreign key(organization_id,profile_id)references public.communication_sender_profiles(organization_id,id),
 check(not enabled or (configured and credentials_verified and sender_approved and mode in ('test_only','production_enabled'))),
 check(mode<>'production_enabled' or production_allowed)
);
create table public.communication_test_allowlist (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 channel text not null check(channel in ('email','sms')), recipient text not null check(recipient !~ '[*%\r\n]'),
 purpose text not null check(purpose='transactional'), enabled boolean not null default true,
 expires_at timestamptz not null, approved_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 constraint communication_test_allowlist_scope unique(organization_id,channel,recipient,purpose),check(private.comm_valid_address(channel,recipient))
);
create table public.communication_provider_tests (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 request_key uuid not null,profile_id uuid not null,person_id uuid not null,created_by uuid not null references auth.users(id),
 message_id uuid not null,authorized_at timestamptz not null default now(),
 unique(organization_id,request_key),unique(message_id),
 foreign key(organization_id,profile_id)references public.communication_sender_profiles(organization_id,id),
 foreign key(organization_id,person_id)references public.organization_people(organization_id,id),
 foreign key(organization_id,message_id)references public.communication_outbox(organization_id,id)
);
create function private.comm_external_lock(o uuid) returns void language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended('communications:external-control',0));
 perform private.comm_lock(o);
end$$;
create function private.comm_super_admin()returns boolean language sql volatile security definer set search_path='' as $$
 select private.outreach_verified(auth.uid()) and exists(select 1 from public.communication_super_admins where user_id=auth.uid() and active and expires_at>now() and approved_by is not null)
$$;
create function private.comm_external_gate(m public.communication_outbox) returns text language plpgsql security definer set search_path='' as $$
declare g public.communication_external_control;org public.communication_org_delivery;ctl public.communication_provider_controls;s public.communication_sender_profiles;t public.communication_provider_tests;begin
 select * into g from public.communication_external_control;
 select * into org from public.communication_org_delivery where organization_id=m.organization_id;
 select * into ctl from public.communication_provider_controls where profile_id=m.sender_profile_id and organization_id=m.organization_id;
 select * into s from public.communication_sender_profiles where id=m.sender_profile_id and organization_id=m.organization_id;
 select * into t from public.communication_provider_tests where message_id=m.id;
 if t.id is null then return 'message_activation_required';end if; -- G queues/automations cannot drain to external providers in H1.
 if not coalesce(g.external_enabled,false) then return 'global_disabled';end if;
 if not coalesce(org.enabled,false) or not coalesce(case when m.channel='email' then org.email_enabled else org.sms_enabled end,false) then return 'organization_channel_disabled';end if;
 if ctl.profile_id is null or ctl.environment<>g.environment or ctl.project_ref is distinct from g.project_ref then return 'environment_mismatch';end if;
 if not(ctl.configured and ctl.credentials_verified and ctl.sender_approved and ctl.enabled and ctl.mode in ('test_only','production_enabled')) or not s.active or s.channel<>m.channel or not(m.message_type=any(ctl.allowed_classes)) then return 'profile_disabled';end if;
 if ctl.mode='production_enabled' and not ctl.production_allowed then return 'production_activation_required';end if;
 if not exists(select 1 from public.communication_test_allowlist a where a.organization_id=m.organization_id and a.channel=m.channel and a.recipient=m.address_snapshot and a.purpose=m.purpose and a.enabled and a.expires_at>now()) then return 'test_recipient_not_allowlisted';end if;
 if not private.comm_actor_can(m.organization_id,null,'communications.providers.view',t.created_by) or not private.comm_actor_can(m.organization_id,null,'communications.providers.test',t.created_by) or not private.comm_actor_can(m.organization_id,null,'people.read',t.created_by) then return 'test_authority_revoked';end if;
 if not exists(select 1 from public.organization_people pp where pp.id=t.person_id and pp.organization_id=m.organization_id and private.comm_address(m.channel,case when m.channel='email' then pp.email else pp.phone end)=m.address_snapshot and not exists(select 1 from public.outreach_team_members child where child.person_id=pp.id and child.organization_id=m.organization_id and child.age<18)) then return 'recipient_changed_or_restricted';end if;
 return private.comm_block(m.organization_id,null,m.recipient_key,m.channel,m.address_snapshot,m.purpose);
end$$;
create function private.comm_provider_workspace(action text,o uuid,p jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare s public.communication_sender_profiles;ctl public.communication_provider_controls;person public.organization_people;
 m public.communication_outbox;mid uuid;id uuid:=(p->>'id')::uuid;need text;g public.communication_external_control;org public.communication_org_delivery;
 recipient text;subj text;body text;block text;req uuid;existing public.communication_provider_tests;cnt integer;begin
 if not private.outreach_verified(auth.uid()) or jsonb_typeof(p)<>'object' or octet_length(p::text)>8000 then raise exception 'Provider access denied' using errcode='42501';end if;
 if action='context' then return jsonb_build_object('super_admin',private.comm_super_admin(),'organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'permissions',(select jsonb_agg(k)from unnest(array['communications.providers.view','communications.providers.manage','communications.providers.test','communications.providers.enable'])k where private.comm_can(x.id,null,k)))),'[]')from public.organizations x where private.comm_can(x.id,null,'communications.providers.view')));end if;
 need:=case when action in ('configure','allowlist_add','allowlist_remove') then 'manage' when action in ('test_preview','test_confirm','dry_run','verify_request','test_dispatch_request','test_recipients')then 'test' when action in ('enable','disable','suspend','org_delivery','global_delivery')then 'enable' else 'view' end;
 if o is null or not private.comm_can(o,null,'communications.providers.'||need) or not private.comm_can(o,null,'communications.providers.view') then raise exception 'Provider access denied' using errcode='42501';end if;
 perform private.comm_external_lock(o);
 if not private.comm_can(o,null,'communications.providers.'||need) then raise exception 'Provider access revoked' using errcode='42501';end if;
 select * into g from public.communication_external_control;
 insert into public.communication_org_delivery(organization_id)values(o)on conflict do nothing;
 select * into org from public.communication_org_delivery where organization_id=o;
 if action='overview' then return jsonb_build_object('global_enabled',g.external_enabled,'environment',g.environment,'super_admin',private.comm_super_admin(),'organization',to_jsonb(org),'profiles',(select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('sender',to_jsonb(ss))),'[]')from public.communication_provider_controls c join public.communication_sender_profiles ss on ss.id=c.profile_id where c.organization_id=o),'allowlist',(select coalesce(jsonb_agg(to_jsonb(a)),'[]')from public.communication_test_allowlist a where a.organization_id=o),'email_status',case when exists(select 1 from public.communication_provider_controls c join public.communication_sender_profiles ss on ss.id=c.profile_id where c.organization_id=o and ss.channel='email')then 'SENDER PROFILE CONFIGURED'else 'PENDING SENDER CONFIGURATION'end,'sms_status',case when exists(select 1 from public.communication_provider_controls c join public.communication_sender_profiles ss on ss.id=c.profile_id where c.organization_id=o and ss.channel='sms' and c.configured)then 'CONFIGURED'else 'NOT CONFIGURED / PROVIDER SELECTION REQUIRED'end);
 elsif action='test_recipients' then
  if not private.comm_can(o,null,'people.read')then raise exception 'Scoped People read required' using errcode='42501';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',pp.id,'name',pp.first_name||' '||pp.last_name,'address',aa.recipient,'channel',aa.channel))from public.communication_test_allowlist aa join public.organization_people pp on pp.organization_id=aa.organization_id and aa.recipient=private.comm_address(aa.channel,case when aa.channel='email'then pp.email else pp.phone end)where aa.organization_id=o and aa.enabled and aa.expires_at>now()and not exists(select 1 from public.outreach_team_members child where child.person_id=pp.id and child.organization_id=o and child.age<18)),'[]');
 elsif action='global_delivery' then
  if not private.comm_super_admin() then raise exception 'Explicit Super Admin required' using errcode='42501';end if;
  if p->>'enabled'='true' and g.environment='unconfigured' then raise exception 'Environment bootstrap required';end if;
  update public.communication_external_control set external_enabled=(p->>'enabled')::boolean,revision=revision+1;
 elsif action='org_delivery' then
  update public.communication_org_delivery set enabled=(p->>'enabled')::boolean,email_enabled=(p->>'email_enabled')::boolean,sms_enabled=(p->>'sms_enabled')::boolean where organization_id=o;
 elsif action='allowlist_add' then
  recipient:=private.comm_address(p->>'channel',p->>'recipient');
  if (p->>'expires_at')::timestamptz<=now() or (p->>'expires_at')::timestamptz>now()+interval '30 days' then raise exception 'Allowlist expiry required within 30 days';end if;
  insert into public.communication_test_allowlist(organization_id,channel,recipient,purpose,expires_at,approved_by)values(o,p->>'channel',recipient,'transactional',(p->>'expires_at')::timestamptz,auth.uid())on conflict on constraint communication_test_allowlist_scope do update set enabled=true,expires_at=excluded.expires_at,approved_by=auth.uid();
 elsif action='allowlist_remove' then
  update public.communication_test_allowlist set enabled=false where organization_id=o and communication_test_allowlist.id=id;if not found then raise exception 'Allowlist denied' using errcode='42501';end if;
 else
  select * into s from public.communication_sender_profiles where organization_id=o and communication_sender_profiles.id=id;
  select * into ctl from public.communication_provider_controls where profile_id=id and organization_id=o;
  if s.id is null or ctl.profile_id is null then raise exception 'Provider profile denied' using errcode='42501';end if;
  if action='configure' then
   update public.communication_provider_controls set provider_name=p->>'provider_name',allowed_classes=array(select jsonb_array_elements_text(p->'allowed_classes')),credentials_verified=false,last_verified_at=null,enabled=false,mode='verification_pending',health='unknown',revision=revision+1 where profile_id=id;
  elsif action='verify_request' then
   perform private.comm_audit(o,null,'provider.verify_requested',id);
   return jsonb_build_object('id',id,'revision',ctl.revision,'environment',ctl.environment,'project_ref',ctl.project_ref,'sender',to_jsonb(s));
  elsif action in ('enable','disable','suspend')then
   if action='enable' and (not(ctl.configured and ctl.credentials_verified and ctl.sender_approved) or ctl.environment<>g.environment or ctl.project_ref is distinct from g.project_ref or p->>'mode' not in ('test_only','production_enabled') or (p->>'mode'='production_enabled' and not ctl.production_allowed)) then raise exception 'Verified sender and explicit activation required';end if;
   if action='enable' and ctl.enabled and ctl.mode=p->>'mode' then return jsonb_build_object('unchanged',true);end if;
   update public.communication_provider_controls set enabled=action='enable',mode=case when action='enable' then p->>'mode' when action='suspend'then 'suspended'else 'disabled'end,health=case when action='enable'then 'unknown'else 'disabled'end,consecutive_failures=case when action='enable'then 0 else consecutive_failures end,revision=revision+1 where profile_id=id;
   update public.communication_sender_profiles set active=action='enable' where communication_sender_profiles.id=id;
  elsif action in ('test_preview','test_confirm','dry_run')then
   if not private.comm_can(o,null,'people.read') then raise exception 'Scoped People read required' using errcode='42501';end if;
   select * into person from public.organization_people where organization_id=o and organization_people.id=(p->>'person_id')::uuid;
   if person.id is null then raise exception 'Test recipient denied' using errcode='42501';end if;
   recipient:=private.comm_address(s.channel,case when s.channel='email'then person.email else person.phone end);
   subj:=case when s.channel='email'then s.display_name||' Communications Test'else ''end;
   body:='This is an authorized test of the Global Propel Communications Core for '||s.display_name||'.';
   m.organization_id:=o;m.sender_profile_id:=id;m.channel:=s.channel;m.message_type:='transactional';m.purpose:='transactional';m.address_snapshot:=recipient;m.recipient_key:='person:'||person.id;
   block:=private.comm_block(o,null,m.recipient_key,s.channel,recipient,'transactional');
   if exists(select 1 from public.outreach_team_members child where child.person_id=person.id and child.organization_id=o and child.age<18)then block:='restricted_minor';end if;
   if not exists(select 1 from public.communication_test_allowlist a where a.organization_id=o and a.channel=s.channel and a.recipient=recipient and a.enabled and a.expires_at>now())then block:=coalesce(block,'test_recipient_not_allowlisted');end if;
   if action<>'test_confirm'then return jsonb_build_object('subject',subj,'body',body,'recipient',recipient,'mode',ctl.mode,'counts',jsonb_build_object('eligible',case when block is null then 1 else 0 end,'suppressed',case when block in ('suppression','preference','consent_required')then 1 else 0 end,'invalid',case when block in ('invalid_address','restricted_minor')then 1 else 0 end,'held',case when block is not null or not(g.external_enabled and org.enabled and ctl.enabled and ctl.credentials_verified and ctl.sender_approved and ctl.environment=g.environment and ctl.project_ref=g.project_ref and 'transactional'=any(ctl.allowed_classes) and case when s.channel='email'then org.email_enabled else org.sms_enabled end)then 1 else 0 end,'would_send',case when block is null and g.external_enabled and org.enabled and ctl.enabled and ctl.credentials_verified and ctl.sender_approved and ctl.environment=g.environment and ctl.project_ref=g.project_ref and 'transactional'=any(ctl.allowed_classes) and case when s.channel='email'then org.email_enabled else org.sms_enabled end then 1 else 0 end),'reason',block);end if;
   if p->>'confirmed' is distinct from 'true' or p->>'preview_subject' is distinct from subj or p->>'preview_body' is distinct from body or p->>'preview_recipient' is distinct from recipient then raise exception 'Exact reviewed test confirmation required';end if;
   req:=(p->>'request_key')::uuid;if req is null then raise exception 'Idempotency key required';end if;
   select * into existing from public.communication_provider_tests where organization_id=o and request_key=req;
   if found then
    if existing.profile_id<>id or existing.person_id<>person.id then raise exception 'Idempotency key content mismatch';end if;
    return jsonb_build_object('message_id',existing.message_id,'duplicate',true);
   end if;
   if block is not null then raise exception 'Test blocked: %',block;end if;
   insert into public.communication_settings(organization_id)values(o)on conflict do nothing;
   mid:=private.comm_enqueue(o,null,jsonb_build_object('key',m.recipient_key,'name',person.first_name||' '||person.last_name,s.channel,recipient),s.channel,'transactional','transactional',null,id,subj,body,'provider-test:'||req,now());
   insert into public.communication_provider_tests(organization_id,request_key,profile_id,person_id,created_by,message_id)values(o,req,id,person.id,auth.uid(),mid);
   select * into m from public.communication_outbox where communication_outbox.id=mid;
   block:=private.comm_external_gate(m);if block is not null then raise exception 'Test held: %',block;end if;
   perform private.comm_audit(o,null,'provider.test_authorized',mid,jsonb_build_object('profile',id));return jsonb_build_object('message_id',mid,'status','queued');
  elsif action in ('test_result','test_dispatch_request')then
   return coalesce((select jsonb_build_object('message_id',mm.id,'status',mm.status,'attempts',mm.attempts,'provider_message_id',mm.provider_message_id,'failure_class',mm.failure_class)from public.communication_outbox mm join public.communication_provider_tests tt on tt.message_id=mm.id where mm.organization_id=o and tt.profile_id=id and mm.id=(p->>'message_id')::uuid),'{}');
  else raise exception 'Unknown provider action';end if;
 end if;
 perform private.comm_audit(o,null,'provider.'||action,id);return jsonb_build_object('updated',true);
end$$;
create function public.communications_provider_workspace(p_action text,p_organization uuid default null,p_payload jsonb default '{}')returns jsonb language sql security invoker set search_path='' as $$select private.comm_provider_workspace(p_action,p_organization,p_payload)$$;
alter table public.communication_provider_controls add column structured_callbacks boolean not null default false;
create function private.comm_provider_service(action text,o uuid,p jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare g public.communication_external_control;ctl public.communication_provider_controls;s public.communication_sender_profiles;m public.communication_outbox;
 lease uuid;block text;ids jsonb:='[]';cfg public.communication_settings;id uuid:=(p->>'id')::uuid;ans jsonb;begin
 perform private.comm_external_lock(o);select * into g from public.communication_external_control;
 if action='bind_environment' then
  if g.external_enabled or (p->>'environment') not in ('acceptance','production') or (p->>'project_ref') !~ '^[a-z]{20}$' or ((p->>'environment'='acceptance') is distinct from (p->>'project_ref'='bkbmjisprwmkptywtmih'))then raise exception 'Disabled exact environment binding required';end if;
  update public.communication_external_control set environment=p->>'environment',project_ref=p->>'project_ref',revision=revision+1;return jsonb_build_object('bound',true);
 elsif action='provision' then
  if g.environment='unconfigured' or g.external_enabled then raise exception 'Disabled environment bootstrap required';end if;
  if p->>'provider' not in ('smtp_transport','sms_transport') or (p->>'channel',p->>'provider') not in (('email','smtp_transport'),('sms','sms_transport')) or (p->>'channel'='email' and not private.comm_valid_address('email',p->>'from_address')) or (p->>'reply_to' is not null and not private.comm_valid_address('email',p->>'reply_to')) then raise exception 'Approved sender metadata required';end if;
  insert into public.communication_sender_profiles(id,organization_id,channel,provider,display_name,from_address,reply_to,approved_at)values(id,o,p->>'channel',p->>'provider',p->>'display_name',p->>'from_address',p->>'reply_to',now());
  insert into public.communication_provider_controls(profile_id,organization_id,environment,project_ref,provider_name,configured,sender_approved,mode,sending_domain,structured_callbacks)values(id,o,g.environment,g.project_ref,p->>'provider_name',coalesce((p->>'configured')::boolean,false),coalesce((p->>'sender_approved')::boolean,false),'configured',case when p->>'channel'='email'then split_part(p->>'from_address','@',2)end,coalesce((p->>'structured_callbacks')::boolean,false));
  perform private.comm_audit(o,null,'provider.provision',id);return jsonb_build_object('id',id,'mode','configured');
 elsif action='claim_external' then
  if not g.external_enabled then return jsonb_build_object('messages','[]'::jsonb,'mode','disabled','environment',g.environment,'project_ref',g.project_ref);end if;
  select * into cfg from public.communication_settings where organization_id=o;
  -- Only test outbox records, never older G batches or automated events.
  update public.communication_attempts a set finished_at=now(),outcome='lease_expired',failure_class=case when mm.dispatch_authorized_at is null then 'transient'else 'uncertain'end from public.communication_outbox mm join public.communication_provider_tests tt on tt.message_id=mm.id where mm.organization_id=o and mm.status='sending' and mm.lease_until<now() and a.lease_token=mm.lease_token;
  update public.communication_outbox mm set status=case when dispatch_authorized_at is null then 'queued'else 'failed'end,failure_class=case when dispatch_authorized_at is null then 'transient'else 'uncertain'end,lease_token=null,lease_until=null where mm.organization_id=o and mm.status='sending' and mm.lease_until<now() and exists(select 1 from public.communication_provider_tests tt where tt.message_id=mm.id);
  for m in select mm.* from public.communication_outbox mm join public.communication_provider_tests tt on tt.message_id=mm.id where mm.organization_id=o and mm.status in ('queued','scheduled')and mm.scheduled_at<=now() and (p->>'message_id' is null or mm.id=(p->>'message_id')::uuid)order by mm.scheduled_at,mm.id limit 5 for update of mm skip locked loop
   block:=private.comm_external_gate(m);
   if block in ('consent_required','suppression','preference','invalid_address','test_authority_revoked','recipient_changed_or_restricted')then
    update public.communication_outbox set status='suppressed',failure_class=block where communication_outbox.id=m.id;perform private.comm_audit(o,null,'provider.dispatch_blocked',m.id,jsonb_build_object('reason',block));continue;
   end if;
   if block is not null then continue;end if;
   if m.attempts>=cfg.max_attempts then update public.communication_outbox set status='failed',failure_class='attempts_exhausted'where communication_outbox.id=m.id;continue;end if;
   select * into s from public.communication_sender_profiles where communication_sender_profiles.id=m.sender_profile_id;
   lease:=gen_random_uuid();update public.communication_outbox set status='sending',attempts=attempts+1,lease_token=lease,lease_until=now()+interval '2 minutes',dispatch_authorized_at=null,provider=s.provider where communication_outbox.id=m.id returning * into m;
   insert into public.communication_attempts(organization_id,message_id,attempt,lease_token)values(o,m.id,m.attempts,lease);
   ids:=ids||jsonb_build_array(to_jsonb(m)||jsonb_build_object('sender',to_jsonb(s)));
   perform private.comm_audit(o,null,'provider.attempt_claimed',m.id);
  end loop;return jsonb_build_object('messages',ids,'mode','external_tests','environment',g.environment,'project_ref',g.project_ref);
 end if;
 select * into ctl from public.communication_provider_controls where profile_id=id and organization_id=o;
 select * into s from public.communication_sender_profiles where communication_sender_profiles.id=id and organization_id=o;
 if action in ('verify_result','profile')then
  if ctl.profile_id is null then raise exception 'Profile denied';end if;
  if action='profile'then return to_jsonb(ctl)||jsonb_build_object('sender',to_jsonb(s));end if;
  if ctl.revision<>(p->>'revision')::int or ctl.environment is distinct from p->>'environment' or ctl.project_ref is distinct from p->>'project_ref' or not private.comm_actor_can(o,null,'communications.providers.view',(p->>'actor')::uuid) or not private.comm_actor_can(o,null,'communications.providers.test',(p->>'actor')::uuid) then raise exception 'Verification authority/config changed';end if;
  update public.communication_provider_controls set configured=coalesce((p->>'configured')::boolean,false),credentials_verified=p->>'verified'='true',mode=case when p->>'verified'='true'then 'verified'else 'verification_pending'end,enabled=false,last_verified_at=case when p->>'verified'='true'then now()end,health=case when p->>'verified'='true'then 'unknown'else 'configuration_error'end,revision=revision+1 where profile_id=id;
  update public.communication_sender_profiles set active=false where communication_sender_profiles.id=id;
  perform private.comm_audit(o,null,'provider.verification_result',id,jsonb_build_object('verified',p->>'verified'='true'));return jsonb_build_object('verified',p->>'verified'='true','sender_approved',ctl.sender_approved);
 elsif action='callback_rejected'then
  if ctl.profile_id is not null then perform private.comm_audit(o,null,'provider.callback_rejected',id,'{"reason":"validation_failed"}');end if;return '{}';
 elsif action in ('callback_external','keyword_external')then
  if ctl.profile_id is null or not ctl.structured_callbacks or ctl.environment<>g.environment or ctl.project_ref is distinct from g.project_ref or p->>'provider' is distinct from s.provider then raise exception 'Verified callback profile required';end if;
  if action='keyword_external'then
   if s.channel<>'sms' or p->>'keyword' not in ('STOP','START','HELP')then raise exception 'SMS preference required';end if;
   ans:=private.comm_service('keyword',o,p||jsonb_build_object('channel','sms'));
  else
   select * into m from public.communication_outbox where organization_id=o and sender_profile_id=id and provider=s.provider and provider_message_id=p->>'provider_message_id';
   if m.id is null or not exists(select 1 from public.communication_attempts a where a.message_id=m.id and a.id=(p->>'attempt_id')::uuid and a.outcome='sent')then raise exception 'Callback receipt/attempt binding required';end if;
   ans:=private.comm_service('callback',o,p||jsonb_build_object('provider',s.provider));
  end if;
  update public.communication_provider_controls set last_callback_at=now()where profile_id=id;return ans;
 elsif action in ('authorize_external','result_external')then
  select * into m from public.communication_outbox where organization_id=o and communication_outbox.id=(p->>'message_id')::uuid and status='sending' and lease_token=(p->>'lease_token')::uuid and lease_until>now();
  if m.id is null or not exists(select 1 from public.communication_provider_tests where message_id=m.id)then raise exception 'Current test lease required';end if;
  if action='authorize_external'then
   if m.dispatch_authorized_at is not null then raise exception 'Lease already handed off';end if;
   block:=private.comm_external_gate(m);
   if block is not null then
    update public.communication_outbox set status=case when block in ('consent_required','suppression','preference','test_authority_revoked','recipient_changed_or_restricted')then 'suppressed'else 'queued'end,failure_class=block,lease_token=null,lease_until=null where communication_outbox.id=m.id;
    update public.communication_attempts set finished_at=now(),outcome='held',failure_class=block where lease_token=m.lease_token;
    perform private.comm_audit(o,null,'provider.dispatch_blocked',m.id,jsonb_build_object('reason',block));return jsonb_build_object('authorized',false,'reason',block);
   end if;
   update public.communication_outbox set dispatch_authorized_at=now() where communication_outbox.id=m.id;
   perform private.comm_audit(o,null,'provider.dispatch_authorized',m.id);return jsonb_build_object('authorized',true,'environment',g.environment,'project_ref',g.project_ref);
  end if;
  ans:=private.comm_service('result',o,p||jsonb_build_object('id',m.id));
  update public.communication_provider_controls set last_success_at=case when p->>'outcome'='sent'then now()else last_success_at end,last_failure_at=case when p->>'outcome'<>'sent'then now()else last_failure_at end,consecutive_failures=case when p->>'outcome'='sent'then 0 else consecutive_failures+1 end,health=case when p->>'outcome'='sent'then 'healthy'else 'degraded'end where profile_id=m.sender_profile_id;
  update public.communication_provider_controls set enabled=false,mode='suspended',health='provider_error',revision=revision+1 where profile_id=m.sender_profile_id and consecutive_failures>=3;
  if found then perform private.comm_audit(o,null,'provider.circuit_suspended',m.sender_profile_id);end if;
  return ans;
 else raise exception 'Unknown provider service action';end if;
end$$;
create function public.communications_provider_service(p_action text,p_organization uuid,p_payload jsonb default '{}')returns jsonb language sql security invoker set search_path='' as $$select private.comm_provider_service(p_action,p_organization,p_payload)$$;
-- Existing staff pages expose only the delivery boundary, not provider administration metadata.
alter function private.comm_workspace(text,uuid,jsonb) rename to comm_workspace_phase_g;
create function private.comm_workspace(action text,c uuid,p jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;o uuid:=(p->>'organization_id')::uuid;sender public.communication_sender_profiles;t public.communication_templates;
 recipient jsonb;vars jsonb;items jsonb:='[]';block text;address text;subject text;body text;rendered jsonb;
 eligible integer:=0;suppressed integer:=0;invalid integer:=0;
begin
 if action='dry_run' then
  if not private.outreach_verified(auth.uid()) or jsonb_typeof(p)<>'object' or octet_length(p::text)>32000 then raise exception 'Verified dry-run access required' using errcode='42501';end if;
  if c is not null then select organization_id into o from public.outreach_campaigns where id=c and (o is null or organization_id=o);end if;
  if o is null or not private.comm_can(o,c,'communications.send') then raise exception 'Scoped dry-run access required' using errcode='42501';end if;
  perform private.comm_lock(o);
  if not private.comm_can(o,c,'communications.send') then raise exception 'Access revoked' using errcode='42501';end if;
  select * into sender from public.communication_sender_profiles where organization_id=o and id=(p->>'sender_profile_id')::uuid and channel=p->>'channel';
  if sender.id is null then raise exception 'Approved organization sender required';end if;
  if p->>'template_id' is not null then
   select * into t from public.communication_templates where organization_id=o and id=(p->>'template_id')::uuid and active and channel=sender.channel;
   if t.id is null then raise exception 'Published matching template required';end if;subject:=t.subject;body:=t.body;
  else
   subject:=coalesce(p->>'subject','');body:=p->>'body';
   if length(body) not between 1 and 12000 or body is null or length(subject)>240 or subject ~ E'[\r\n]' or p->>'purpose' not in ('transactional','event_updates','follow_up','discipleship','marketing','donation_receipts') then raise exception 'Invalid dry-run content';end if;
  end if;
  for recipient in select x from jsonb_array_elements(private.comm_audience(o,c,p->'audience'))x loop
   address:=private.comm_address(sender.channel,recipient->>sender.channel);
   block:=private.comm_block(o,c,recipient->>'key',sender.channel,address,coalesce(t.purpose,p->>'purpose'));
   begin
    vars:=private.comm_variables(o,c,recipient,coalesce(p->'variables','{}'));
    rendered:=jsonb_build_object('subject',private.comm_render(subject,vars),'body',private.comm_render(body,vars)||case when sender.footer<>''then E'\n\n'||sender.footer else ''end);
   exception when others then block:='missing_template_data';rendered:='{}';end;
   if block in ('invalid_address','missing_template_data')then invalid:=invalid+1;
   elsif block is not null then suppressed:=suppressed+1;else eligible:=eligible+1;end if;
   items:=items||jsonb_build_array(recipient||rendered||jsonb_build_object('address',address,'blocked',block,'delivery_gate','message_activation_required'));
  end loop;
  -- H1 never authorizes a normal/bulk/automation audience for external delivery.
  return jsonb_build_object('mode','dry_run','counts',jsonb_build_object('eligible',eligible,'suppressed',suppressed,'invalid',invalid,'held',eligible,'would_send',0),'recipients',items,'sender',to_jsonb(sender),'sender_external_ready',coalesce((select configured and credentials_verified and sender_approved and enabled from public.communication_provider_controls where profile_id=sender.id),false),'reason','message_activation_required');
 end if;
 result:=private.comm_workspace_phase_g(action,c,p);
 if action in ('overview','context')then result:=result||jsonb_build_object('external_delivery_enabled',(select external_enabled from public.communication_external_control),'external_boundary','Only separately authorized provider tests; automated and bulk external delivery held');end if;
 return result;
end$$;
-- Grants stay narrow. Tables and helper functions are never browser/service-role raw APIs.
do $$declare x record;begin
 for x in select tablename from pg_tables where schemaname='public' and tablename in ('communication_external_control','communication_super_admins','communication_org_delivery','communication_provider_controls','communication_test_allowlist','communication_provider_tests')loop execute format('alter table public.%I enable row level security',x.tablename);execute format('revoke all on public.%I from public,anon,authenticated,service_role',x.tablename);end loop;
 for x in select oid::regprocedure f from pg_proc where pronamespace='private'::regnamespace and proname in ('comm_external_lock','comm_super_admin','comm_external_gate','comm_provider_workspace','comm_provider_service','comm_workspace','comm_workspace_phase_g')loop execute format('revoke all on function %s from public,anon,authenticated,service_role',x.f);end loop;
end$$;
revoke all on function public.communications_provider_workspace(text,uuid,jsonb)from public,anon,service_role;
revoke all on function public.communications_provider_service(text,uuid,jsonb)from public,anon,authenticated;
grant execute on function public.communications_provider_workspace(text,uuid,jsonb),private.comm_provider_workspace(text,uuid,jsonb),private.comm_workspace(text,uuid,jsonb)to authenticated;
grant execute on function public.communications_provider_service(text,uuid,jsonb),private.comm_provider_service(text,uuid,jsonb)to service_role;

-- The sink worker cannot claim or suppress external provider tests.
create or replace function private.comm_service(action text,o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare cfg public.communication_settings;m public.communication_outbox;profile public.communication_sender_profiles;lease uuid;block text;localhour integer;zone text;outcome text;route public.communication_routes;e public.outreach_campaign_events;t public.communication_templates;camp public.outreach_campaigns;r jsonb;v jsonb;rem public.outreach_task_reminders;step public.outreach_campaign_steps;ids jsonb:='[]';mid uuid;begin
 perform private.comm_lock(o);select * into cfg from public.communication_settings where organization_id=o;
 if not found then raise exception 'Communication settings missing';end if;
 if action='consume_events' then
  for route in select * from public.communication_routes where organization_id=o and enabled loop
   -- Current approver authority, not a permanent grant copied at route creation.
   if not exists(select 1 from public.organization_staff_permissions g where g.organization_id=o and g.user_id=route.approved_by and g.permission='communications.send' and g.revoked_at is null and g.department_ids is null and g.effective_at<=now() and (g.expires_at is null or g.expires_at>now()) and private.staff_assignment_active(o,g.user_id)) and not exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=route.campaign_id and a.user_id=route.approved_by and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and a.capabilities @> array['communications.send','communications.bulk_send']) then continue;end if;
   select * into t from public.communication_templates where id=route.template_id and organization_id=o and active;if not found then continue;end if;
   select * into camp from public.outreach_campaigns where id=route.campaign_id and organization_id=o;
   if camp.status in ('cancelled','closed','completed') then continue;end if;
   select * into profile from public.communication_sender_profiles where id=route.sender_profile_id and active;if not found then continue;end if;
   for e in select ev.* from public.outreach_campaign_events ev where ev.campaign_id=route.campaign_id and ev.kind=route.event_kind and ev.created_at>=route.approved_at and not exists(select 1 from public.communication_event_consumption done where done.organization_id=o and done.route_id=route.id and done.event_id=ev.id) order by ev.created_at limit 100 loop
    rem:=null;step:=null;
    if e.event_key like 'reminder:%' then select * into rem from public.outreach_task_reminders where id=e.subject_id and campaign_id=camp.id;
     -- Phase F events use step subject IDs; match exact reminder key when appropriate.
     if not found then select * into rem from public.outreach_task_reminders where campaign_id=camp.id and ('reminder:'||id)=e.event_key;end if;
     if rem.id is null or rem.state<>'pending' then insert into public.communication_event_consumption(organization_id,route_id,event_id) values(o,route.id,e.id) on conflict do nothing;continue;end if;
     if rem.scheduled_at>now() or camp.status='postponed' then continue;end if;
     select * into step from public.outreach_campaign_steps where id=rem.step_id and campaign_id=camp.id;
     if step.status='completed' or step.due_at is distinct from rem.due_snapshot then insert into public.communication_event_consumption(organization_id,route_id,event_id) values(o,route.id,e.id) on conflict do nothing;continue;end if;
    end if;
    for r in select x from jsonb_array_elements(private.comm_audience(o,camp.id,route.audience)) x loop
     -- Reminder recipient roles come from Phase F, never a newly invented escalation roster.
     if rem.id is not null and not exists(select 1 from public.outreach_campaign_contacts x where x.campaign_id=camp.id and 'person:'||x.person_id=r->>'key' and x.active and (rem.recipient_roles ? x.role_key)) and not exists(select 1 from public.organization_people pp where 'person:'||pp.id=r->>'key' and pp.organization_id=o and pp.user_id=rem.assigned_user_id) then continue;end if;
     v:=private.comm_variables(o,camp.id,r,'{}',step.id);
     mid:=private.comm_enqueue(o,camp.id,r,t.channel,t.message_type,t.purpose,t.id,profile.id,private.comm_render(t.subject,v),private.comm_render(t.body,v)||case when profile.footer<>'' then E'\n\n'||profile.footer else '' end,'event:'||e.id||':route:'||route.id||':'||(r->>'key')||':'||t.channel,now(),null,e.id,rem.id,step.id,step.due_at);ids:=ids||jsonb_build_array(mid);
    end loop;
    insert into public.communication_event_consumption(organization_id,route_id,event_id) values(o,route.id,e.id) on conflict do nothing;
   end loop;
  end loop;return jsonb_build_object('messages',ids);
 elsif action='claim' then
  if cfg.delivery_mode<>'acceptance_sink' then return jsonb_build_object('messages','[]'::jsonb,'mode','disabled');end if;
  -- A lost post-handoff lease is uncertain and must reconcile, never blindly resend.
  update public.communication_attempts a set finished_at=now(),outcome='lease_expired',failure_class=case when m.dispatch_authorized_at is null then 'transient' else 'uncertain' end from public.communication_outbox m where m.organization_id=o and m.status='sending' and m.lease_until<now() and a.lease_token=m.lease_token and not exists(select 1 from public.communication_provider_tests h1 where h1.message_id=m.id);
  update public.communication_outbox set status=case when dispatch_authorized_at is null then 'scheduled' else 'failed' end,scheduled_at=case when dispatch_authorized_at is null then now()+interval '30 seconds' else scheduled_at end,failure_class=case when dispatch_authorized_at is null then 'transient' else 'uncertain' end,failed_at=now(),lease_token=null,lease_until=null where organization_id=o and status='sending' and lease_until<now() and not exists(select 1 from public.communication_provider_tests h1 where h1.message_id=communication_outbox.id);
  for m in select * from public.communication_outbox where organization_id=o and status in ('queued','scheduled') and scheduled_at<=now() and not exists(select 1 from public.communication_provider_tests tt where tt.message_id=communication_outbox.id) order by scheduled_at,id limit 25 for update skip locked loop
   profile:=null;select * into profile from public.communication_sender_profiles where id=m.sender_profile_id and organization_id=o and active;
   block:=private.comm_block(o,m.campaign_id,m.recipient_key,m.channel,m.address_snapshot,m.purpose);
   if not private.comm_source_authorized(m) then block:='source_authority_revoked';end if;
   if profile.id is null or (profile.provider<>'acceptance_sink' or profile.channel<>m.channel) then block:='provider_disabled';end if;
   if m.source_reminder_id is not null and not exists(select 1 from public.outreach_task_reminders rr join public.outreach_campaign_steps ss on ss.id=rr.step_id join public.outreach_campaigns cc on cc.id=rr.campaign_id where rr.id=m.source_reminder_id and rr.state='pending' and ss.status<>'completed' and ss.due_at is not distinct from m.source_due_at and cc.status not in ('postponed','completed','cancelled','closed')) then block:='stale_workflow';end if;
   if m.campaign_id is not null and not exists(select 1 from public.outreach_campaigns cc where cc.id=m.campaign_id and cc.revision=m.source_campaign_revision and cc.status not in ('cancelled','closed','completed')) then block:='stale_campaign';end if;
   if m.attempts>=cfg.max_attempts then block:='attempts_exhausted';end if;
   if block is not null then update public.communication_outbox set status=case when block='stale_workflow' then 'cancelled' else 'suppressed' end,failure_class=block,credits_released=credits_reserved,credits_reserved=0 where id=m.id;perform private.comm_audit(o,m.campaign_id,'dispatch.blocked',m.id,jsonb_build_object('reason',block));continue;end if;
   if m.channel='sms' and cfg.quiet_start is not null then
    zone:=coalesce((select timezone from public.communication_preferences where organization_id=o and recipient_key=m.recipient_key),(select timezone from public.outreach_campaigns where id=m.campaign_id),cfg.timezone);
    localhour:=extract(hour from now() at time zone zone);
    if (cfg.quiet_start<cfg.quiet_end and localhour>=cfg.quiet_start and localhour<cfg.quiet_end) or (cfg.quiet_start>cfg.quiet_end and (localhour>=cfg.quiet_start or localhour<cfg.quiet_end)) then
     update public.communication_outbox set status='scheduled',scheduled_at=(((now() at time zone zone)::date + case when cfg.quiet_start>cfg.quiet_end and localhour>=cfg.quiet_start then 1 else 0 end)+make_interval(hours=>cfg.quiet_end)) at time zone zone where id=m.id;continue;
    end if;
   end if;
   lease:=gen_random_uuid();update public.communication_outbox set status='sending',attempts=attempts+1,lease_token=lease,lease_until=now()+interval '2 minutes',dispatch_authorized_at=null,provider=profile.provider where id=m.id returning * into m;
   insert into public.communication_attempts(organization_id,message_id,attempt,lease_token) values(o,m.id,m.attempts,lease);
   ids:=ids||jsonb_build_array(to_jsonb(m)||jsonb_build_object('sender',to_jsonb(profile)));perform private.comm_audit(o,m.campaign_id,'attempt.claimed',m.id,jsonb_build_object('attempt',m.attempts));
  end loop;return jsonb_build_object('messages',ids,'mode',cfg.delivery_mode);
 elsif action in ('authorize_dispatch','result') then
  select * into m from public.communication_outbox where organization_id=o and id=(p->>'id')::uuid and status='sending' and lease_token=(p->>'lease_token')::uuid and lease_until>now();if not found then raise exception 'Current lease required';end if;
  if action='authorize_dispatch' then
   block:=private.comm_block(o,m.campaign_id,m.recipient_key,m.channel,m.address_snapshot,m.purpose);
   if not private.comm_source_authorized(m) then block:='source_authority_revoked';end if;
   if m.source_reminder_id is not null and not exists(select 1 from public.outreach_task_reminders rr join public.outreach_campaign_steps ss on ss.id=rr.step_id join public.outreach_campaigns cc on cc.id=rr.campaign_id where rr.id=m.source_reminder_id and rr.state='pending' and ss.status<>'completed' and ss.due_at is not distinct from m.source_due_at and cc.status not in ('postponed','completed','cancelled','closed')) then block:='stale_workflow';end if;
   if m.campaign_id is not null and not exists(select 1 from public.outreach_campaigns cc where cc.id=m.campaign_id and cc.revision=m.source_campaign_revision and cc.status not in ('cancelled','closed','completed')) then block:='stale_campaign';end if;
   if cfg.delivery_mode<>'acceptance_sink' or not exists(select 1 from public.communication_sender_profiles where id=m.sender_profile_id and active and provider='acceptance_sink') then block:='provider_disabled';end if;
   if block is not null then update public.communication_outbox set status='suppressed',failure_class=block,credits_released=credits_reserved,credits_reserved=0 where id=m.id;perform private.comm_audit(o,m.campaign_id,'dispatch.blocked',m.id,jsonb_build_object('reason',block));return jsonb_build_object('authorized',false,'reason',block);end if;
   update public.communication_outbox set dispatch_authorized_at=now() where id=m.id;perform private.comm_audit(o,m.campaign_id,'dispatch.authorized',m.id);return jsonb_build_object('authorized',true);
  end if;
  if m.dispatch_authorized_at is null then raise exception 'Dispatch authorization required';end if;
  outcome:=p->>'outcome';if outcome not in ('sent','transient','permanent','uncertain') then raise exception 'Invalid provider result';end if;
  if outcome='sent' and (coalesce(p->>'provider_message_id','')='' or length(p->>'provider_message_id')>200) then raise exception 'Provider receipt required';end if;
  update public.communication_outbox set status=case when outcome='sent' then 'sent' when outcome='transient' and attempts<cfg.max_attempts then 'scheduled' else 'failed' end,scheduled_at=case when outcome='transient' then now()+make_interval(secs=>least(3600,30*(2^attempts)::int)) else scheduled_at end,sent_at=case when outcome='sent' then now() else sent_at end,failed_at=case when outcome<>'sent' then now() else null end,provider_message_id=p->>'provider_message_id',failure_class=case when outcome='sent' then null else outcome end,lease_token=null,lease_until=null,credits_consumed=case when outcome='sent' then credits_reserved else credits_consumed end,credits_reserved=case when outcome='sent' then 0 else credits_reserved end where id=m.id;
  update public.communication_attempts set finished_at=now(),outcome=outcome,failure_class=case when outcome='sent' then null else outcome end where lease_token=m.lease_token;perform private.comm_audit(o,m.campaign_id,'provider.result',m.id,jsonb_build_object('outcome',outcome));return jsonb_build_object('id',m.id,'outcome',outcome);
 elsif action='callback' then
  outcome:=p->>'outcome';if outcome not in ('delivered','soft_bounce','hard_bounce','complaint','rejected','undelivered','failed','sent') then raise exception 'Invalid normalized callback';end if;
  select * into m from public.communication_outbox where organization_id=o and provider=p->>'provider' and provider_message_id=p->>'provider_message_id';if not found then raise exception 'Provider receipt not found';end if;
  insert into public.communication_callbacks(organization_id,provider,event_id,message_id,outcome) values(o,m.provider,p->>'event_id',m.id,outcome) on conflict do nothing;
  if not found then return jsonb_build_object('duplicate',true);end if;
  if outcome='delivered' and m.status='sent' then update public.communication_outbox set status='delivered',delivered_at=now(),failure_class=null where id=m.id;perform private.comm_audit(o,m.campaign_id,'delivery.delivered',m.id);
  elsif outcome in ('hard_bounce','complaint','rejected','undelivered','failed','soft_bounce') then
   if m.status<>'delivered' then update public.communication_outbox set status='failed',failure_class=case when outcome='soft_bounce' then 'transient' else outcome end,failed_at=now() where id=m.id;end if;
   if outcome in ('hard_bounce','complaint') then insert into public.communication_suppressions(organization_id,channel,address,reason) values(o,m.channel,m.address_snapshot,outcome) on conflict(organization_id,channel,address,reason) do update set active=true,cleared_at=null;end if;
   perform private.comm_audit(o,m.campaign_id,'delivery.'||outcome,m.id);
  end if;return jsonb_build_object('recorded',true);
 elsif action='keyword' then
  if length(coalesce(p->>'event_id','')) not between 1 and 200 then raise exception 'Preference event ID required';end if;
  insert into public.communication_keyword_events(organization_id,event_id,keyword) values(o,p->>'event_id',p->>'keyword') on conflict do nothing;if not found then return jsonb_build_object('duplicate',true);end if;
  if p->>'keyword' not in ('STOP','START','HELP','UNSUBSCRIBE') then raise exception 'Unknown preference keyword';end if;
  if p->>'keyword' in ('STOP','UNSUBSCRIBE') then insert into public.communication_suppressions(organization_id,channel,address,reason) values(o,p->>'channel',private.comm_address(p->>'channel',p->>'address'),case when p->>'keyword'='STOP' then 'stop' else 'unsubscribe' end) on conflict(organization_id,channel,address,reason) do update set active=true,cleared_at=null;
  elsif p->>'keyword'='START' then update public.communication_suppressions set active=false,cleared_at=now() where organization_id=o and channel='sms' and address=private.comm_address('sms',p->>'address') and reason='stop';end if;
  -- START clears only STOP. It never manufactures marketing/purpose consent.
  perform private.comm_audit(o,null,'preference.keyword',null,jsonb_build_object('keyword',p->>'keyword','channel',p->>'channel'));return jsonb_build_object('keyword',p->>'keyword','consent_granted',false);
 else raise exception 'Unknown worker action';end if;
end$$;
