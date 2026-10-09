-- Phase G candidate: local/isolated acceptance only; no provider activation or grants.
alter table public.outreach_campaign_assignments drop constraint outreach_campaign_assignments_capabilities_check;
alter table public.outreach_campaign_assignments add constraint outreach_campaign_assignments_capabilities_check check (
 capabilities <@ array['view','export','followup','decisions','workflow','documents','draw','team.view','team.manage','travel.view','travel.manage','registration.view','registration.manage','registration.export','checkin.manage','prize.view','prize.manage','prize.draw','prize.claim','ops.view','ops.manage','inventory.view','inventory.manage','issue.manage','preevent.view','preevent.manage','host.view','host.respond','communications.view','communications.send','communications.bulk_send','communications.templates.view','communications.templates.manage','communications.delivery.view']::text[]
 and cardinality(capabilities)>0 and array_position(capabilities,null) is null
 and (not('team.manage'=any(capabilities)) or 'team.view'=any(capabilities))
 and (not('travel.manage'=any(capabilities)) or 'travel.view'=any(capabilities))
 and (not(capabilities && array['registration.manage','registration.export','checkin.manage']) or 'registration.view'=any(capabilities))
 and (not(capabilities && array['prize.manage','prize.draw','prize.claim']) or 'prize.view'=any(capabilities))
 and (not('ops.manage'=any(capabilities)) or 'ops.view'=any(capabilities))
 and (not('inventory.manage'=any(capabilities)) or 'inventory.view'=any(capabilities))
 and (not('preevent.manage'=any(capabilities)) or 'preevent.view'=any(capabilities))
 and (not('host.respond'=any(capabilities)) or 'host.view'=any(capabilities))
 and (not('issue.manage'=any(capabilities)) or 'ops.view'=any(capabilities)));


alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;
alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check(permission=any(array['people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage','staff.view','staff.manage','finance.read','finance.configure','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage','events.view','events.manage','registrations.view','registrations.manage','outreach.view','outreach.manage','courses.manage','forms.view','forms.manage','checkin.view','checkin.manage','registrations.restricted','registrations.override','dream_team.application.read','dream_team.application.manage','dream_team.application.restricted','dream_team.placement.manage','communications.send','communications.view','communications.bulk_send','communications.templates.view','communications.templates.manage','communications.delivery.view']::text[]));
create or replace function private.staff_permission_keys() returns text[] language sql immutable set search_path='' as $$
 select array['people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage','staff.view','staff.manage','finance.read','finance.configure','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage','events.view','events.manage','registrations.view','registrations.manage','outreach.view','outreach.manage','courses.manage','forms.view','forms.manage','checkin.view','checkin.manage','registrations.restricted','registrations.override','dream_team.application.read','dream_team.application.manage','dream_team.application.restricted','dream_team.placement.manage','communications.send','communications.view','communications.bulk_send','communications.templates.view','communications.templates.manage','communications.delivery.view']::text[]
$$;

create table public.communication_settings (
 organization_id uuid primary key references public.organizations(id),
 delivery_mode text not null default 'disabled' check(delivery_mode in ('disabled','acceptance_sink')),
 timezone text not null default 'UTC', quiet_start integer check(quiet_start between 0 and 23), quiet_end integer check(quiet_end between 0 and 23),
 window_seconds integer not null default 3600 check(window_seconds between 60 and 86400),
 organization_limit integer not null default 10000 check(organization_limit>0), campaign_limit integer not null default 5000 check(campaign_limit>0), user_limit integer not null default 2000 check(user_limit>0), recipient_limit integer not null default 20 check(recipient_limit>0),
 max_attempts integer not null default 4 check(max_attempts between 1 and 10), retention_days integer not null default 180 check(retention_days>=1),
 approved_link_origins text[] not null default '{}', check((quiet_start is null)=(quiet_end is null)), check(quiet_start is null or quiet_start<>quiet_end)
);
create table public.communication_sender_profiles (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 channel text not null check(channel in ('email','sms')), provider text not null check(provider in ('acceptance_sink','smtp_transport','sms_transport')),
 display_name text not null check(length(display_name) between 1 and 120), from_address text not null check(length(from_address) between 1 and 320 and from_address !~ E'[\r\n]'),
 reply_to text check(reply_to is null or (length(reply_to)<=320 and reply_to !~ E'[\r\n]')), footer text not null default '' check(length(footer)<=1000), support_contact text not null default '' check(length(support_contact)<=320),
 active boolean not null default false, approved_at timestamptz, unique(organization_id,id), check(not active or approved_at is not null)
);
create table public.communication_templates (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), template_key text not null check(template_key ~ '^[a-z0-9_]{1,80}$'),
 channel text not null check(channel in ('email','sms')), message_type text not null check(message_type in ('transactional','operational','reminder','follow_up','campaign','marketing','receipt','security')),
 purpose text not null check(purpose in ('transactional','event_updates','follow_up','discipleship','marketing','donation_receipts')),
 version integer not null check(version>0), locale text not null default 'en' check(locale ~ '^[a-zA-Z-]{2,15}$'),
 subject text not null default '' check(length(subject)<=240 and subject !~ E'[\r\n]'), body text not null check(length(body) between 1 and 12000),
 state text not null default 'draft' check(state in ('draft','published')), active boolean not null default false, revision integer not null default 1,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), published_at timestamptz,
 unique(organization_id,id), unique(organization_id,template_key,channel,locale,version), check(not active or state='published'), check(message_type<>'marketing' or purpose='marketing')
);
create unique index communication_one_active_template on public.communication_templates(organization_id,template_key,channel,locale) where active;
create table public.communication_consents (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), campaign_id uuid,
 recipient_key text not null, channel text not null check(channel in ('email','sms')), purpose text not null check(purpose in ('transactional','event_updates','follow_up','discipleship','marketing','donation_receipts')),
 status text not null check(status in ('granted','revoked')), source text not null check(length(source) between 1 and 100), proof_reference text not null check(length(proof_reference) between 5 and 500),
 recorded_by uuid references auth.users(id), recorded_at timestamptz not null default now(), revoked_at timestamptz,
 foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id)
);
create unique index communication_consent_scope on public.communication_consents(organization_id,coalesce(campaign_id,'00000000-0000-0000-0000-000000000000'::uuid),recipient_key,channel,purpose);
create table public.communication_preferences (
 organization_id uuid not null references public.organizations(id), recipient_key text not null,
 email_allowed boolean not null default true, sms_allowed boolean not null default true, preferred_channel text check(preferred_channel in ('email','sms')), timezone text not null default 'UTC',
 primary key(organization_id,recipient_key)
);
create table public.communication_suppressions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), channel text not null check(channel in ('email','sms')), address text not null,
 reason text not null check(reason in ('stop','unsubscribe','hard_bounce','complaint','admin','invalid_address')), active boolean not null default true, created_at timestamptz not null default now(), cleared_at timestamptz,
 unique(organization_id,channel,address,reason)
);
create table public.communication_batches (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), campaign_id uuid,
 request_key uuid not null, created_by uuid not null references auth.users(id), request_snapshot jsonb not null, recipients jsonb not null,
 channel text not null check(channel in ('email','sms')), message_type text not null, purpose text not null,
 template_id uuid, sender_profile_id uuid not null, subject text not null, body text not null, variables jsonb not null default '{}',
 campaign_revision integer, state text not null default 'draft' check(state in ('draft','queued','cancelled')), created_at timestamptz not null default now(), confirmed_at timestamptz,
 scheduled_at timestamptz not null default now(), unique(organization_id,request_key), unique(organization_id,id),
 foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id),
 foreign key(organization_id,template_id) references public.communication_templates(organization_id,id), foreign key(organization_id,sender_profile_id) references public.communication_sender_profiles(organization_id,id)
);
create table public.communication_outbox (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), campaign_id uuid, batch_id uuid,
 recipient_key text not null, recipient_name text not null, address_snapshot text not null, channel text not null check(channel in ('email','sms')),
 message_type text not null check(message_type in ('transactional','operational','reminder','follow_up','campaign','marketing','receipt','security')), purpose text not null,
 template_id uuid, sender_profile_id uuid not null, subject text not null, rendered_body text not null,
 status text not null default 'queued' check(status in ('draft','queued','scheduled','sending','sent','delivered','failed','suppressed','cancelled')),
 scheduled_at timestamptz not null default now(), created_at timestamptz not null default now(), sent_at timestamptz, delivered_at timestamptz, failed_at timestamptz,
 attempts integer not null default 0, provider text, provider_message_id text, failure_class text, lease_token uuid, lease_until timestamptz, dispatch_authorized_at timestamptz,
 source_event_id uuid references public.outreach_campaign_events(id), source_reminder_id uuid references public.outreach_task_reminders(id), source_step_id uuid references public.outreach_campaign_steps(id), source_due_at timestamptz, source_campaign_revision integer,
 idempotency_key text not null check(length(idempotency_key) between 1 and 500), audit_reference uuid not null default gen_random_uuid(),
 credits_estimated integer not null default 0 check(credits_estimated>=0), credits_reserved integer not null default 0 check(credits_reserved>=0), credits_consumed integer not null default 0 check(credits_consumed>=0), credits_released integer not null default 0 check(credits_released>=0),
 unique(organization_id,idempotency_key), unique(organization_id,id),
 foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id), foreign key(organization_id,batch_id) references public.communication_batches(organization_id,id),
 foreign key(organization_id,template_id) references public.communication_templates(organization_id,id), foreign key(organization_id,sender_profile_id) references public.communication_sender_profiles(organization_id,id)
);
create index communication_due_idx on public.communication_outbox(organization_id,status,scheduled_at);
create index communication_history_idx on public.communication_outbox(organization_id,recipient_key,created_at desc);
create unique index communication_provider_id_idx on public.communication_outbox(organization_id,provider,provider_message_id) where provider_message_id is not null;
create table public.communication_attempts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, message_id uuid not null, attempt integer not null, lease_token uuid not null unique,
 started_at timestamptz not null default now(), finished_at timestamptz, outcome text, failure_class text,
 foreign key(organization_id,message_id) references public.communication_outbox(organization_id,id), unique(message_id,attempt)
);
create table public.communication_callbacks (
 organization_id uuid not null, provider text not null, event_id text not null check(length(event_id) between 1 and 200), message_id uuid not null, outcome text not null, received_at timestamptz not null default now(),
 primary key(organization_id,provider,event_id), foreign key(organization_id,message_id) references public.communication_outbox(organization_id,id)
);
create table public.communication_keyword_events(organization_id uuid not null references public.organizations(id),event_id text not null,keyword text not null,created_at timestamptz not null default now(),primary key(organization_id,event_id));
create table public.communication_routes (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, campaign_id uuid not null, event_kind text not null check(length(event_kind)<=100), template_id uuid not null, sender_profile_id uuid not null,
 audience jsonb not null, enabled boolean not null default false, approved_by uuid references auth.users(id), approved_at timestamptz,
 unique(campaign_id,event_kind,template_id), foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id),
 foreign key(organization_id,template_id) references public.communication_templates(organization_id,id), foreign key(organization_id,sender_profile_id) references public.communication_sender_profiles(organization_id,id), check(not enabled or approved_at is not null)
);
create table public.communication_event_consumption (
 organization_id uuid not null references public.organizations(id), route_id uuid not null references public.communication_routes(id), event_id uuid not null references public.outreach_campaign_events(id), consumed_at timestamptz not null default now(), primary key(organization_id,route_id,event_id)
);
create table public.communication_audit (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), campaign_id uuid, actor uuid references auth.users(id), kind text not null,
 subject_id uuid, metadata jsonb not null default '{}', created_at timestamptz not null default now(), foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id)
);
-- Append-only audit and immutable published message content. No provider secrets in these relations.
create function private.comm_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_TABLE_NAME='communication_audit' then raise exception 'Immutable communications audit'; end if;
 if old.state='published' and (TG_OP='DELETE' or (to_jsonb(new)-'active') is distinct from (to_jsonb(old)-'active')) then raise exception 'Published template is immutable';end if;
 if TG_OP='DELETE' then return old;end if;return new;
end$$;
create trigger communication_template_immutable before update or delete on public.communication_templates for each row execute function private.comm_immutable();
create trigger communication_audit_immutable before update or delete on public.communication_audit for each row execute function private.comm_immutable();
create function private.comm_lock(o uuid) returns void language sql security definer set search_path='' as $$ select pg_advisory_xact_lock(hashtextextended('communications:'||o::text,0)) $$;
create function private.comm_can(o uuid,c uuid,k text) returns boolean language sql volatile security definer set search_path='' as $$
 select private.outreach_verified(auth.uid()) and (c is null or exists(select 1 from public.outreach_campaigns where id=c and organization_id=o)) and
 (private.has_staff_permission(o,k) or (c is not null and exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c and a.user_id=auth.uid() and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and k=any(a.capabilities))))
$$;
create function private.comm_audit(o uuid,c uuid,k text,s uuid default null,m jsonb default '{}') returns void language sql security definer set search_path='' as $$
 insert into public.communication_audit(organization_id,campaign_id,actor,kind,subject_id,metadata) values(o,c,auth.uid(),k,s,m)
$$;
create function private.comm_address(ch text,a text) returns text language sql immutable set search_path='' as $$
 select case when ch='email' then lower(btrim(a)) else regexp_replace(btrim(a),'[ ()-]','','g') end
$$;
create function private.comm_valid_address(ch text,a text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(case when ch='email' then length(a)<=320 and a ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' else a ~ '^\+[1-9][0-9]{7,14}$' end,false)
$$;
create function private.comm_timezone_guard() returns trigger language plpgsql set search_path='' as $$begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'IANA timezone required';end if;return new;end$$;
create trigger communication_settings_timezone before insert or update on public.communication_settings for each row execute function private.comm_timezone_guard();
create trigger communication_preferences_timezone before insert or update on public.communication_preferences for each row execute function private.comm_timezone_guard();
-- Canonical identity references only. No duplicate People table, no contact similarity merge.
create function private.comm_audience(o uuid,c uuid,f jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a jsonb:='[]';k text:=f->>'kind';begin
 if jsonb_typeof(f)<>'object' or exists(select 1 from jsonb_object_keys(f) x where x<>all(array['kind','role','status','person_id','area_id','progress','inactive_days'])) then raise exception 'Unsupported audience filter';end if;
 if k='discipleship' and f->>'progress'='inactive' and coalesce((f->>'inactive_days')::int,0) not between 1 and 3650 then raise exception 'Explicit inactive day threshold required';end if;
 if c is null then
  if k<>'person' or not private.person_permission(o,(f->>'person_id')::uuid,'people.read') then raise exception 'Scoped People access required' using errcode='42501';end if;
  select coalesce(jsonb_agg(jsonb_build_object('key','person:'||p.id,'name',p.first_name||' '||p.last_name,'first_name',p.first_name,'email',p.email,'sms',p.phone)),'[]') into a from public.organization_people p where p.organization_id=o and p.id=(f->>'person_id')::uuid and not exists(select 1 from public.outreach_team_members child where child.person_id=p.id and child.organization_id=o and child.age<18);
 elsif k in ('host','contacts','person','follow_up','discipleship') then
  select coalesce(jsonb_agg(jsonb_build_object('key','person:'||p.id,'name',p.first_name||' '||p.last_name,'first_name',p.first_name,'email',p.email,'sms',p.phone)),'[]') into a from public.organization_people p where p.organization_id=o and
  (exists(select 1 from public.outreach_campaign_contacts x where x.campaign_id=c and x.person_id=p.id and x.active and (coalesce(f->>'role','')='' or x.role_key=f->>'role') and (k<>'host' or x.role_key in ('host_pastor','local_coordinator'))) or
   exists(select 1 from public.outreach_campaign_registrants x where x.campaign_id=c and x.person_id=p.id and (k not in ('host','contacts'))))
  and (k<>'person' or p.id=(f->>'person_id')::uuid) and not exists(select 1 from public.outreach_team_members child where child.person_id=p.id and child.campaign_id=c and child.age<18)
  and (k<>'follow_up' or exists(select 1 from public.outreach_campaign_followups t join public.outreach_campaign_registrants r on r.id=t.registrant_id where t.campaign_id=c and r.person_id=p.id and t.status=coalesce(f->>'status','open')))
  and (k<>'discipleship' or exists(select 1 from public.portal_account_links l join public.course_enrollments e on e.user_id=l.user_id join public.courses cc on cc.id=e.course_id where l.organization_id=o and l.person_id=p.id and l.active and private.outreach_verified(l.user_id) and cc.slug='getting-a-grip-on-the-basics' and (case when e.completed_at is not null then 'completed' when f->>'progress'='inactive' and coalesce((select max(lp.updated_at) from public.lesson_progress lp where lp.user_id=e.user_id and lp.course_id=e.course_id),e.started_at)<now()-make_interval(days=>(f->>'inactive_days')::int) then 'inactive' when exists(select 1 from public.lesson_progress lp where lp.user_id=e.user_id and lp.course_id=e.course_id and lp.status<>'not_started') then 'active' else 'not_started' end)=coalesce(f->>'progress','active')));
 elsif k in ('registrations','checked_in') then
  select coalesce(jsonb_agg(jsonb_build_object('key','registration:'||r.id,'name',r.first_name||' '||r.last_name,'first_name',r.first_name,'email',r.email,'sms',r.phone)),'[]') into a from public.outreach_event_registrations r where r.campaign_id=c and r.organization_id=o and r.status not in ('cancelled','closed') and (coalesce(f->>'status','')='' or r.status=f->>'status') and (k<>'checked_in' or exists(select 1 from public.outreach_event_attendees t where t.registration_id=r.id and t.active and t.checked_in_at is not null));
 elsif k in ('team','area') then
  -- Minors always project their explicitly reviewed adult guardian; no minor address.
  select coalesce(jsonb_agg(distinct jsonb_build_object('key',case when p.person_id is not null then 'person:'||p.person_id else 'team:'||p.id end,'name',p.first_name||' '||p.last_name,'first_name',p.first_name,'email',p.email,'sms',p.phone)),'[]') into a
  from public.outreach_team_members t join public.outreach_team_members p on p.campaign_id=t.campaign_id and p.id=case when t.age<18 and t.guardian_reviewed then t.guardian_member_id when t.age>=18 then t.id else null end
  where t.campaign_id=c and t.organization_id=o and t.attending and p.age>=18 and p.status not in ('cancelled','not_selected') and t.status=coalesce(f->>'status','approved')
   and (k<>'area' or exists(select 1 from public.outreach_event_area_members x where x.campaign_id=c and x.member_id=t.id and x.area_id=(f->>'area_id')::uuid and x.active and (coalesce(f->>'role','')='' or x.role=f->>'role')));
 else raise exception 'Unsupported audience kind';end if;
 if k='person' and jsonb_array_length(a)=0 then raise exception 'Recipient denied' using errcode='42501';end if;
 return a;
end$$;
create function private.comm_block(o uuid,c uuid,r text,ch text,a text,purpose text) returns text language plpgsql security definer set search_path='' as $$
declare pref public.communication_preferences;begin
 if not private.comm_valid_address(ch,a) then return 'invalid_address';end if;
 if exists(select 1 from public.communication_suppressions s where s.organization_id=o and s.channel=ch and s.address=a and s.active) then return 'suppression';end if;
 select * into pref from public.communication_preferences where organization_id=o and recipient_key=r;
 if (ch='email' and not pref.email_allowed) or (ch='sms' and not pref.sms_allowed) then return 'preference';end if;
 -- A campaign-specific revocation overrides an organization-wide grant. No inferred exemptions.
 if not coalesce((select status='granted' from public.communication_consents x where x.organization_id=o and x.recipient_key=r and x.channel=ch and x.purpose=comm_block.purpose and (x.campaign_id=c or x.campaign_id is null) order by (x.campaign_id is not null) desc limit 1),false) then return 'consent_required';end if;
 return null;
end$$;
create function private.comm_render(t text,v jsonb) returns text language plpgsql immutable set search_path='' as $$
declare x text;result text:=t;allowed text[]:=array['first_name','campaign_name','campaign_date','church_name','task_name','due_date','portal_link','registration_link','event_location','coordinator_name'];begin
 if exists(select 1 from jsonb_object_keys(v) k where k<>all(allowed)) then raise exception 'Unknown template variable';end if;
 for x in select (regexp_matches(t,'\{\{([a-z_]+)\}\}','g'))[1] loop
  if x<>all(allowed) then raise exception 'Unknown template variable';end if;
  if not(v?x) or coalesce(v->>x,'')='' then raise exception 'Missing template variable: %',x;end if;
  result:=replace(result,'{{'||x||'}}',v->>x);
 end loop;
 if result ~ '\{\{|\}\}' then raise exception 'Invalid template expression';end if;
 return result;
end$$;
create function private.comm_actor_can(o uuid,c uuid,k text,u uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select private.outreach_verified(u) and (exists(select 1 from public.organization_staff_permissions g where g.organization_id=o and g.user_id=u and g.permission=k and g.department_ids is null and g.revoked_at is null and g.effective_at<=now() and (g.expires_at is null or g.expires_at>now()) and private.staff_assignment_active(o,u)) or exists(select 1 from public.outreach_campaign_assignments a join public.outreach_campaigns cc on cc.id=a.campaign_id where cc.organization_id=o and a.campaign_id=c and a.user_id=u and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and k=any(a.capabilities)))
$$;
-- Recheck canonical recipient membership/address and the initiating actor at both lease and handoff.
create function private.comm_recipient_current(m public.communication_outbox,f jsonb,u uuid) returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
 if m.campaign_id is null then
  return private.comm_actor_can(m.organization_id,null,'people.read',u) and exists(select 1 from public.organization_people p where p.organization_id=m.organization_id and 'person:'||p.id=m.recipient_key and private.comm_address(m.channel,case when m.channel='email' then p.email else p.phone end)=m.address_snapshot and not exists(select 1 from public.outreach_team_members child where child.person_id=p.id and child.organization_id=m.organization_id and child.age<18));
 end if;
 return exists(select 1 from jsonb_array_elements(private.comm_audience(m.organization_id,m.campaign_id,f)) r where r->>'key'=m.recipient_key and private.comm_address(m.channel,r->>m.channel)=m.address_snapshot);
exception when others then return false;
end$$;
create function private.comm_source_authorized(m public.communication_outbox) returns boolean language sql volatile security definer set search_path='' as $$
 select case when m.batch_id is not null then exists(select 1 from public.communication_batches b where b.id=m.batch_id and private.comm_actor_can(m.organization_id,m.campaign_id,'communications.send',b.created_by) and (jsonb_array_length(b.recipients)<=1 or private.comm_actor_can(m.organization_id,m.campaign_id,'communications.bulk_send',b.created_by)) and private.comm_recipient_current(m,b.request_snapshot->'audience',b.created_by))
 when m.source_event_id is not null then exists(select 1 from public.communication_routes r where r.campaign_id=m.campaign_id and r.enabled and r.template_id=m.template_id and m.idempotency_key like 'event:'||m.source_event_id||':route:'||r.id||':%' and private.comm_actor_can(m.organization_id,m.campaign_id,'communications.send',r.approved_by) and private.comm_actor_can(m.organization_id,m.campaign_id,'communications.bulk_send',r.approved_by) and private.comm_recipient_current(m,r.audience,r.approved_by)) else false end
$$;
create function private.comm_variables(o uuid,c uuid,r jsonb,extra jsonb default '{}',step_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;camp public.outreach_campaigns;s public.outreach_campaign_steps;x text;begin
 if jsonb_typeof(extra)<>'object' or exists(select 1 from jsonb_object_keys(extra) k where k not in ('portal_link','registration_link','coordinator_name')) then raise exception 'Only approved supplemental variables allowed';end if;
 for x in select value from jsonb_each_text(extra) where key in ('portal_link','registration_link') loop
  if x !~ '^https://[^/]+/' or not exists(select 1 from public.communication_settings cfg,unnest(cfg.approved_link_origins) z where cfg.organization_id=o and split_part(x,'/',1)||'//'||split_part(x,'/',3)=z) then raise exception 'Approved HTTPS link origin required';end if;
 end loop;
 select * into camp from public.outreach_campaigns where id=c and organization_id=o;
 select * into s from public.outreach_campaign_steps where id=step_id and campaign_id=c;
 v:=jsonb_build_object('first_name',r->>'first_name','church_name',(select name from public.organizations where id=o),'campaign_name',camp.name,'campaign_date',case when camp.event_start is not null then to_char(camp.event_start at time zone camp.timezone,'YYYY-MM-DD HH24:MI')||' '||camp.timezone else null end,'event_location',camp.venue->>'site_name','task_name',s.definition->>'title','due_date',case when s.due_at is not null then to_char(s.due_at at time zone camp.timezone,'YYYY-MM-DD HH24:MI')||' '||camp.timezone else null end);
 return v||extra;
end$$;
create function private.comm_enqueue(o uuid,c uuid,r jsonb,ch text,typ text,purp text,t uuid,sender uuid,subj text,body text,key text,at_time timestamptz,batch uuid default null,event uuid default null,reminder uuid default null,step uuid default null,due timestamptz default null) returns uuid language plpgsql security definer set search_path='' as $$
declare mid uuid;block text;actor_id uuid;cfg public.communication_settings;addr text:=private.comm_address(ch,r->>ch);begin
 select id into mid from public.communication_outbox where organization_id=o and idempotency_key=key;if found then return mid;end if;
 select * into cfg from public.communication_settings where organization_id=o;
 if (select count(*) from public.communication_outbox where organization_id=o and created_at>now()-make_interval(secs=>cfg.window_seconds))>=cfg.organization_limit or (select count(*) from public.communication_outbox where organization_id=o and campaign_id is not distinct from c and created_at>now()-make_interval(secs=>cfg.window_seconds))>=cfg.campaign_limit or (select count(*) from public.communication_outbox where organization_id=o and recipient_key=r->>'key' and created_at>now()-make_interval(secs=>cfg.window_seconds))>=cfg.recipient_limit then raise exception 'Communications rate limit' using errcode='54000';end if;
 select created_by into actor_id from public.communication_batches where id=batch;
 if actor_id is null and event is not null then select approved_by into actor_id from public.communication_routes route where key like 'event:'||event||':route:'||route.id||':%';end if;
 if actor_id is not null and (select count(*) from public.communication_outbox msg left join public.communication_batches bb on bb.id=msg.batch_id where msg.organization_id=o and msg.created_at>now()-make_interval(secs=>cfg.window_seconds) and (bb.created_by=actor_id or exists(select 1 from public.communication_routes rr where rr.approved_by=actor_id and msg.idempotency_key like 'event:'||msg.source_event_id||':route:'||rr.id||':%')))>=cfg.user_limit then raise exception 'User communications rate limit' using errcode='54000';end if;
 block:=private.comm_block(o,c,r->>'key',ch,addr,purp);
 insert into public.communication_outbox(organization_id,campaign_id,batch_id,recipient_key,recipient_name,address_snapshot,channel,message_type,purpose,template_id,sender_profile_id,subject,rendered_body,status,scheduled_at,idempotency_key,source_event_id,source_reminder_id,source_step_id,source_due_at,credits_estimated,credits_reserved)
 values(o,c,batch,r->>'key',r->>'name',coalesce(addr,''),ch,typ,purp,t,sender,subj,body,case when block is not null then 'suppressed' when at_time>now() then 'scheduled' else 'queued' end,at_time,key,event,reminder,step,due,case when ch='sms' then 1 else 0 end,case when ch='sms' and block is null then 1 else 0 end)
 on conflict(organization_id,idempotency_key) do nothing returning id into mid;
 if mid is null then select id into mid from public.communication_outbox where organization_id=o and idempotency_key=key;return mid;end if;
 update public.communication_outbox set failure_class=block,source_campaign_revision=(select revision from public.outreach_campaigns where id=c) where id=mid;
 perform private.comm_audit(o,c,'queue.created',mid,jsonb_build_object('channel',ch,'suppressed',block is not null));return mid;
end$$;
create function private.comm_workspace(action text,c uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o uuid:=(p->>'organization_id')::uuid;camp public.outreach_campaigns;t public.communication_templates;b public.communication_batches;m public.communication_outbox;profile public.communication_sender_profiles;
 target_id uuid:=(p->>'id')::uuid;recipient jsonb;items jsonb;vars jsonb;result jsonb;key text;ch text;typ text;purp text;subj text;body text;addr text;block text;cfg public.communication_settings;needs text;at_time timestamptz;cnt integer;allowed text[]:=array['communications.view','communications.send','communications.bulk_send','communications.templates.view','communications.templates.manage','communications.delivery.view'];
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
create function private.comm_service(action text,o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
  update public.communication_attempts a set finished_at=now(),outcome='lease_expired',failure_class=case when m.dispatch_authorized_at is null then 'transient' else 'uncertain' end from public.communication_outbox m where m.organization_id=o and m.status='sending' and m.lease_until<now() and a.lease_token=m.lease_token;
  update public.communication_outbox set status=case when dispatch_authorized_at is null then 'scheduled' else 'failed' end,scheduled_at=case when dispatch_authorized_at is null then now()+interval '30 seconds' else scheduled_at end,failure_class=case when dispatch_authorized_at is null then 'transient' else 'uncertain' end,failed_at=now(),lease_token=null,lease_until=null where organization_id=o and status='sending' and lease_until<now();
  for m in select * from public.communication_outbox where organization_id=o and status in ('queued','scheduled') and scheduled_at<=now() order by scheduled_at,id limit 25 for update skip locked loop
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
create function public.communications_workspace(p_action text,p_campaign uuid default null,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.comm_workspace(p_action,p_campaign,p_payload)$$;
create function public.communications_service(p_action text,p_organization uuid,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.comm_service(p_action,p_organization,p_payload)$$;
revoke all on function public.communications_workspace(text,uuid,jsonb) from public,anon,service_role;
grant execute on function public.communications_workspace(text,uuid,jsonb) to authenticated;
revoke all on function public.communications_service(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.communications_service(text,uuid,jsonb) to service_role;
do $$declare x record;begin
 for x in select tablename from pg_tables where schemaname='public' and tablename like 'communication_%' loop execute format('alter table public.%I enable row level security',x.tablename);execute format('revoke all on public.%I from public,anon,authenticated,service_role',x.tablename);end loop;
 for x in select oid::regprocedure f from pg_proc where pronamespace='private'::regnamespace and proname like 'comm_%' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',x.f);end loop;
end$$;
grant execute on function private.comm_workspace(text,uuid,jsonb) to authenticated;
grant execute on function private.comm_service(text,uuid,jsonb) to service_role;
