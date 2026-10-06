-- Candidate only. RPC-only campaign boundary; never grants live users authority.
create table public.outreach_campaign_admins (
 organization_id uuid not null references public.organizations(id), user_id uuid not null references auth.users(id),
 capability text not null check(capability in ('view','manage')), active boolean not null default true,
 effective_at timestamptz not null default now(), expires_at timestamptz,
 reason text not null check(length(btrim(reason)) between 10 and 500),
 primary key(organization_id,user_id), check(expires_at is null or expires_at>effective_at)
);
create index outreach_admin_user_idx on public.outreach_campaign_admins(user_id);
create table public.outreach_opportunities (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 stage text not null default 'new' check(stage in ('new','contacted','reviewing','tentative','approved','declined','future')),
 details jsonb not null check(jsonb_typeof(details)='object' and octet_length(details::text)<=12000),
 revision integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 approved_at timestamptz, approved_by uuid references auth.users(id), unique(organization_id,id)
);
create index outreach_opportunity_org_idx on public.outreach_opportunities(organization_id,stage,created_at);
create table public.outreach_workflow_templates (
 id uuid primary key default gen_random_uuid(), template_key text not null check(template_key ~ '^[a-z0-9_]{1,80}$'),
 version integer not null check(version>0), title text not null check(length(title) between 1 and 160),
 steps jsonb not null check(jsonb_typeof(steps)='array'), published_at timestamptz not null default now(),
 unique(template_key,version)
);
create table public.outreach_campaigns (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 code text not null check(code ~ '^[a-z0-9_]{1,80}$'), name text not null check(length(btrim(name)) between 1 and 160),
 public_slug text unique check(public_slug ~ '^[a-z0-9-]{1,100}$'), city text not null check(length(city) between 1 and 100),
 state_province text not null default '' check(length(state_province)<=100), country text not null check(length(country) between 2 and 100),
 timezone text not null, host_organization_id uuid references public.organizations(id), venue jsonb not null default '{}' check(jsonb_typeof(venue)='object' and octet_length(venue::text)<=6000),
 event_start timestamptz, event_end timestamptz, registration_start timestamptz,
 status text not null default 'draft' check(status in ('draft','approved','preparing','registration_open','ready','completed','closed','cancelled')),
 opportunity_id uuid, template_id uuid not null references public.outreach_workflow_templates(id),
 settings jsonb not null default '{}' check(jsonb_typeof(settings)='object' and octet_length(settings::text)<=12000),
 public_page text check(public_page is null or public_page ~ '^/[a-zA-Z0-9/_-]+(\.html)?$'),
 created_at timestamptz not null default now(), approved_at timestamptz, closed_at timestamptz,
 revision integer not null default 1, unique(organization_id,code), unique(organization_id,id), unique(opportunity_id),
 foreign key(organization_id,opportunity_id) references public.outreach_opportunities(organization_id,id),
 check(event_end is null or (event_start is not null and event_end>=event_start))
);
create index outreach_campaign_location_idx on public.outreach_campaigns(organization_id,country,state_province,city,status);
create table public.outreach_campaign_assignments (
 campaign_id uuid not null references public.outreach_campaigns(id), user_id uuid not null references auth.users(id),
 role_key text not null check(role_key in ('host_pastor','local_coordinator','outreach_coordinator','pastor_roddy','internal_team','logistics_lead','local_leader','other')),
 capabilities text[] not null default array['view']::text[] check(capabilities <@ array['view','export','followup','decisions','workflow','documents','draw']::text[] and cardinality(capabilities)>0 and array_position(capabilities,null) is null),
 effective_at timestamptz not null default now(), expires_at timestamptz, active boolean not null default true,
 reason text not null check(length(btrim(reason)) between 10 and 500), revision integer not null default 1,
 primary key(campaign_id,user_id), check(expires_at is null or expires_at>effective_at)
);
create index outreach_campaign_assignment_user_idx on public.outreach_campaign_assignments(user_id,campaign_id);
create table public.outreach_campaign_contacts (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, organization_id uuid not null, person_id uuid not null,
 role_key text not null check(role_key in ('host_pastor','local_coordinator','outreach_coordinator','pastor_roddy','internal_team','logistics_lead','other')),
 active boolean not null default true, unique(campaign_id,person_id,role_key),
 foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id)
);
create index outreach_campaign_contact_person_idx on public.outreach_campaign_contacts(organization_id,person_id);
create table public.outreach_campaign_sources (
 source text primary key, campaign_id uuid not null references public.outreach_campaigns(id)
);
create index outreach_campaign_source_campaign_idx on public.outreach_campaign_sources(campaign_id);
-- A bridge, not a second contact database. Future attendee records remain individual.
create table public.outreach_campaign_registrants (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, organization_id uuid not null,
 legacy_registration_id uuid unique references public.outreach_registrations(id), person_id uuid,
 registered_at timestamptz not null default now(), revision integer not null default 1,
 foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),
 unique(campaign_id,id), check(legacy_registration_id is not null or person_id is not null)
);
create unique index outreach_campaign_person_registration_idx on public.outreach_campaign_registrants(campaign_id,person_id) where person_id is not null;
create index outreach_campaign_reg_person_idx on public.outreach_campaign_registrants(organization_id,person_id);
create table public.outreach_campaign_decisions (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, registrant_id uuid not null,
 decision text not null check(length(decision) between 1 and 80), notes text not null default '' check(length(notes)<=2000),
 captured_at timestamptz not null default now(), source text not null check(length(source) between 1 and 80), altar_staff uuid references auth.users(id),
 foreign key(campaign_id,registrant_id) references public.outreach_campaign_registrants(campaign_id,id)
);
create index outreach_decision_reg_idx on public.outreach_campaign_decisions(campaign_id,registrant_id,captured_at);
create table public.outreach_campaign_followups (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, registrant_id uuid not null,
 title text not null check(length(btrim(title)) between 1 and 160), note text not null default '' check(length(note)<=2000),
 status text not null default 'open' check(status in ('open','completed','cancelled')), due_on date, assigned_user_id uuid references auth.users(id),
 revision integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(campaign_id,registrant_id) references public.outreach_campaign_registrants(campaign_id,id)
);
create index outreach_campaign_followup_idx on public.outreach_campaign_followups(campaign_id,registrant_id,status);
create table public.outreach_campaign_audit (
 id uuid primary key default gen_random_uuid(), campaign_id uuid references public.outreach_campaigns(id), organization_id uuid not null references public.organizations(id),
 actor_user_id uuid references auth.users(id), kind text not null, subject_id uuid, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index outreach_campaign_audit_idx on public.outreach_campaign_audit(campaign_id,created_at,id);
create table public.outreach_campaign_events (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id), event_key text not null unique,
 kind text not null check(kind in ('campaign.created','campaign.approved','workflow.step_due','workflow.step_overdue','workflow.step_completed','document.requested','document.uploaded','agreement.completed','training.assigned','training.completed','registration.opened','team.signup_opened','event.ready','event.completed','followup.required','drawing_number.assigned','drawing_reminder','prize.won','prize.unclaimed')),
 subject_id uuid, delivery_state text not null default 'held' check(delivery_state='held'), acknowledged_at timestamptz, created_at timestamptz not null default now()
);
create index outreach_campaign_events_idx on public.outreach_campaign_events(campaign_id,created_at);
create function private.outreach_verified(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null and not coalesce(is_anonymous,false))
$$;
create function private.outreach_admin(p_org uuid,p_manage boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select private.staff_assignment_active(p_org,auth.uid()) and exists(select 1 from public.outreach_campaign_admins a where a.organization_id=p_org and a.user_id=auth.uid() and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and (not p_manage or a.capability='manage'))
$$;
create function private.outreach_can(p_campaign uuid,p_cap text default 'view') returns boolean language sql stable security definer set search_path='' as $$
 select private.outreach_verified(auth.uid()) and exists(select 1 from public.outreach_campaigns c where c.id=p_campaign and
 ((p_cap<>'draw' and private.outreach_admin(c.organization_id,p_cap<>'view')) or exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c.id and a.user_id=auth.uid() and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and 'view'=any(a.capabilities) and p_cap=any(a.capabilities))))
$$;
create function private.outreach_audit(p_campaign uuid,p_org uuid,p_kind text,p_subject uuid default null,p_meta jsonb default '{}') returns void language sql security definer set search_path='' as $$
 insert into public.outreach_campaign_audit(campaign_id,organization_id,actor_user_id,kind,subject_id,metadata) values(p_campaign,p_org,auth.uid(),p_kind,p_subject,p_meta)
$$;
create function private.outreach_event(p_campaign uuid,p_kind text,p_subject uuid,p_key text) returns void language sql security definer set search_path='' as $$
 insert into public.outreach_campaign_events(campaign_id,kind,subject_id,event_key) values(p_campaign,p_kind,p_subject,p_key) on conflict(event_key) do nothing
$$;
create function private.outreach_immutable() returns trigger language plpgsql set search_path='' as $$
 begin raise exception 'Historical record is immutable' using errcode='42501'; end
$$;
create trigger outreach_audit_immutable before update or delete on public.outreach_campaign_audit for each row execute function private.outreach_immutable();
create trigger outreach_template_immutable before update or delete on public.outreach_workflow_templates for each row execute function private.outreach_immutable();
create trigger outreach_decision_immutable before update or delete on public.outreach_campaign_decisions for each row execute function private.outreach_immutable();
-- Server-side progress projection never joins lesson_answers, notes or other courses.
create function private.outreach_registrants(p_campaign uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',r.id,'first_name',coalesce(p.first_name,l.first_name),'last_name',coalesce(p.last_name,l.last_name),
 'email',coalesce(p.email,l.email),'phone',coalesce(p.phone,l.phone),'registered_at',r.registered_at,'person_linked',r.person_id is not null,
 'decision',coalesce(d.decision,l.decision),'notes',coalesce(d.notes,l.prayer_request,''),
 'discipleship_status',case when e.id is null then 'not_enrolled' when e.completed_at is not null then 'completed' when coalesce(lp.started,0)>0 then 'active' else 'not_started' end,
 'current_lesson',case when e.id is null or e.completed_at is not null then null else (select min(n) from generate_series(1,c.total_lessons) n where not exists(select 1 from public.lesson_progress x where x.user_id=e.user_id and x.course_id=c.id and x.lesson_number=n and x.status='completed')) end,
 'completed_lessons',coalesce(lp.completed,0),'last_activity',lp.activity,
 'followup_status',case when exists(select 1 from public.outreach_campaign_followups f where f.campaign_id=r.campaign_id and f.registrant_id=r.id and f.status='open') then 'open' when exists(select 1 from public.outreach_campaign_followups f where f.campaign_id=r.campaign_id and f.registrant_id=r.id and f.status='completed') then 'completed' else 'needed' end
 ) order by r.registered_at desc,r.id),'[]'::jsonb)
 from public.outreach_campaign_registrants r
 left join public.organization_people p on p.organization_id=r.organization_id and p.id=r.person_id
 left join public.outreach_registrations l on l.id=r.legacy_registration_id
 left join lateral(select x.decision,x.notes from public.outreach_campaign_decisions x where x.campaign_id=r.campaign_id and x.registrant_id=r.id order by x.captured_at desc,x.id desc limit 1) d on true
 left join public.portal_account_links link on link.organization_id=r.organization_id and link.person_id=r.person_id and link.active
 left join public.courses c on c.slug='getting-a-grip-on-the-basics'
 left join public.course_enrollments e on e.course_id=c.id and e.user_id=case when r.person_id is not null then link.user_id else l.user_id end and private.outreach_verified(e.user_id)
 left join lateral(select count(*) filter(where x.status='completed')::int completed,count(*) filter(where x.status<>'not_started')::int started,max(x.updated_at) activity from public.lesson_progress x where x.user_id=e.user_id and x.course_id=c.id) lp on true
 where r.campaign_id=p_campaign
$$;
create function private.outreach_csv_cell(p_value text) returns text language sql immutable set search_path='' as $$
 select '"'||replace(case when ltrim(coalesce(p_value,''),E' \t\r\n') ~ '^[=+@-]' then ''''||coalesce(p_value,'') else coalesce(p_value,'') end,'"','""')||'"'
$$;
-- Opportunity validation is explicit; this is not the future public guest gateway.
create function private.outreach_opportunity_valid(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select jsonb_typeof(p)='object' and octet_length(p::text)<=12000 and not exists(select 1 from jsonb_object_keys(p) k where k<>all(array['church_name','pastor_name','city','state_province','country','primary_contact','submitter_is_pastor','submitter_role','phone','email','website','preferred_months','previous_experience','prior_outreach','notes'])) and
 length(btrim(coalesce(p->>'church_name',''))) between 1 and 160 and length(btrim(coalesce(p->>'city',''))) between 1 and 100 and length(btrim(coalesce(p->>'country',''))) between 2 and 100
$$;
create function private.outreach_core(p_action text,p_campaign uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.outreach_campaigns; o public.outreach_opportunities; r public.outreach_campaign_registrants; f public.outreach_campaign_followups;
 org uuid:=(p_payload->>'organization_id')::uuid; rid uuid:=(p_payload->>'registrant_id')::uuid; target_id uuid; target_user uuid; result jsonb; rows jsonb; item jsonb; csv text; caps text[];
begin
 if not private.outreach_verified(auth.uid()) then raise exception 'Verified identity required' using errcode='42501'; end if;
 if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>25000 then raise exception 'Invalid request'; end if;
 if p_action='context' then
  return jsonb_build_object('organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'manage',private.outreach_admin(x.id,true))),'[]'::jsonb) from public.organizations x where private.outreach_admin(x.id)));
 elsif p_action='list' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'code',x.code,'city',x.city,'state_province',x.state_province,'country',x.country,'status',x.status,'event_start',x.event_start,'manage',private.outreach_admin(x.organization_id,true),'summary',private.outreach_summary(x.id)) order by x.country,x.city,x.code) from public.outreach_campaigns x where private.outreach_can(x.id) and
  (coalesce(p_payload->>'country','')='' or x.country=p_payload->>'country') and (coalesce(p_payload->>'state_province','')='' or x.state_province=p_payload->>'state_province') and (coalesce(p_payload->>'city','')='' or x.city=p_payload->>'city') and (coalesce(p_payload->>'status','')='' or x.status=p_payload->>'status') and (org is null or x.organization_id=org)),'[]'::jsonb);
 elsif p_action in ('opportunities','opportunity_save','approve') then
  if not private.outreach_admin(org,p_action<>'opportunities') then raise exception 'Campaign administrator required' using errcode='42501'; end if;
  if p_action='opportunities' then return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.outreach_opportunities x where x.organization_id=org),'[]'::jsonb); end if;
  if p_action='opportunity_save' then
   if not private.outreach_opportunity_valid(p_payload->'details') or coalesce(p_payload->>'stage','new')='approved' then raise exception 'Invalid opportunity; explicit approval required'; end if;
   target_id:=(p_payload->>'id')::uuid;
   if target_id is null then insert into public.outreach_opportunities(organization_id,details) values(org,p_payload->'details') returning * into o;
   else select * into o from public.outreach_opportunities where organization_id=org and outreach_opportunities.id=target_id for update;
    if not found or o.stage='approved' or o.revision is distinct from (p_payload->>'revision')::int then raise exception 'Opportunity changed or unavailable'; end if;
    update public.outreach_opportunities set details=p_payload->'details',stage=coalesce(p_payload->>'stage',stage),revision=revision+1,updated_at=clock_timestamp() where outreach_opportunities.id=target_id returning * into o;
   end if;
   perform private.outreach_audit(null,org,'opportunity.saved',o.id);return to_jsonb(o);
  end if;
  select * into o from public.outreach_opportunities where organization_id=org and outreach_opportunities.id=(p_payload->>'id')::uuid for update;
  if not found then raise exception 'Opportunity unavailable' using errcode='42501'; end if;
  if o.stage='approved' then select * into c from public.outreach_campaigns where opportunity_id=o.id;return to_jsonb(c);end if;
  if o.revision is distinct from (p_payload->>'revision')::int or o.stage in ('declined','future') then raise exception 'Review current opportunity before approval'; end if;
  insert into public.outreach_campaigns(organization_id,code,name,public_slug,city,state_province,country,timezone,template_id,opportunity_id,status,approved_at,settings)
  values(org,p_payload->>'code',p_payload->>'name',nullif(p_payload->>'public_slug',''),o.details->>'city',coalesce(o.details->>'state_province',''),o.details->>'country',p_payload->>'timezone',(p_payload->>'template_id')::uuid,o.id,'approved',now(),jsonb_build_object('decision_types',jsonb_build_array('salvation','rededication','healing','prayer_followup','learn_more'))) returning * into c;
  update public.outreach_opportunities set stage='approved',approved_at=now(),approved_by=auth.uid(),revision=revision+1,updated_at=now() where outreach_opportunities.id=o.id;
  perform private.outreach_audit(c.id,org,'opportunity.approved',o.id);perform private.outreach_event(c.id,'campaign.approved',c.id,c.id||':approved');return to_jsonb(c);
 end if;
 select * into c from public.outreach_campaigns where outreach_campaigns.id=p_campaign;
 if not found or not private.outreach_can(c.id) then raise exception 'Campaign access denied' using errcode='42501'; end if;
 if p_action='detail' then
  select array_agg(k) into caps from unnest(array['view','export','followup','decisions','workflow','documents','draw']) k where private.outreach_can(c.id,k);
  return jsonb_build_object('campaign',jsonb_build_object('id',c.id,'organization_id',c.organization_id,'name',c.name,'code',c.code,'city',c.city,'state_province',c.state_province,'country',c.country,'timezone',c.timezone,'event_start',c.event_start,'event_end',c.event_end,'registration_start',c.registration_start,'venue',c.venue,'status',c.status,'revision',c.revision,'public_page',c.public_page,'decision_types',c.settings->'decision_types'), 'settings',case when private.outreach_admin(c.organization_id,true) then c.settings else null end,
   'manage',private.outreach_admin(c.organization_id,true),'capabilities',to_jsonb(caps),'registrants',private.outreach_registrants(c.id),'summary',private.outreach_summary(c.id));
 elsif p_action='csv' then
  if not private.outreach_can(c.id,'export') then raise exception 'Campaign export denied' using errcode='42501'; end if;
  csv:='First Name,Last Name,Phone,Email,Decision,Registration Date,Discipleship Status,Current Lesson,Last Activity,Follow-Up Status'||E'\r\n';
  for item in select value from jsonb_array_elements(private.outreach_registrants(c.id)) loop
   csv:=csv||private.outreach_csv_cell(item->>'first_name')||','||private.outreach_csv_cell(item->>'last_name')||','||private.outreach_csv_cell(item->>'phone')||','||private.outreach_csv_cell(item->>'email')||','||private.outreach_csv_cell(item->>'decision')||','||private.outreach_csv_cell(item->>'registered_at')||','||private.outreach_csv_cell(item->>'discipleship_status')||','||private.outreach_csv_cell(item->>'current_lesson')||','||private.outreach_csv_cell(item->>'last_activity')||','||private.outreach_csv_cell(item->>'followup_status')||E'\r\n';
  end loop;
  perform private.outreach_audit(c.id,c.organization_id,'registrants.exported',c.id,jsonb_build_object('rows',jsonb_array_length(private.outreach_registrants(c.id))));return jsonb_build_object('csv',csv,'filename',c.code||'-followup.csv');
 elsif p_action='assignments' then
  if not private.outreach_admin(c.organization_id,true) then raise exception 'Campaign administrator required' using errcode='42501';end if;
  return coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('email',u.email)) from public.outreach_campaign_assignments a join auth.users u on u.id=a.user_id where a.campaign_id=c.id),'[]'::jsonb);
 elsif p_action='assignment' then
  if not private.outreach_admin(c.organization_id,true) then raise exception 'Campaign administrator required' using errcode='42501'; end if;
  target_user:=(p_payload->>'user_id')::uuid;
  if target_user is null then select u.id into target_user from auth.users u where lower(btrim(u.email))=lower(btrim(p_payload->>'email')) and private.outreach_verified(u.id);end if;
  if not private.outreach_verified(target_user) then raise exception 'Verified account required'; end if;
  insert into public.outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,effective_at,expires_at,active,reason)
  values(c.id,target_user,p_payload->>'role_key',array(select jsonb_array_elements_text(p_payload->'capabilities')),coalesce((p_payload->>'effective_at')::timestamptz,now()),(p_payload->>'expires_at')::timestamptz,coalesce((p_payload->>'active')::boolean,true),p_payload->>'reason')
  on conflict(campaign_id,user_id) do update set role_key=excluded.role_key,capabilities=excluded.capabilities,effective_at=excluded.effective_at,expires_at=excluded.expires_at,active=excluded.active,reason=excluded.reason,revision=outreach_campaign_assignments.revision+1;
  perform private.outreach_audit(c.id,c.organization_id,'leader.assignment',target_user,jsonb_build_object('active',coalesce((p_payload->>'active')::boolean,true)));return jsonb_build_object('saved',true);
 elsif p_action='contact_set' then
  if not private.outreach_admin(c.organization_id,true) or not private.person_permission(c.organization_id,(p_payload->>'person_id')::uuid,'people.read') then raise exception 'Reviewed campaign contact access required' using errcode='42501';end if;
  insert into public.outreach_campaign_contacts(campaign_id,organization_id,person_id,role_key,active) values(c.id,c.organization_id,(p_payload->>'person_id')::uuid,p_payload->>'role_key',coalesce((p_payload->>'active')::boolean,true)) on conflict(campaign_id,person_id,role_key) do update set active=excluded.active;
  perform private.outreach_audit(c.id,c.organization_id,'contact.role_changed',(p_payload->>'person_id')::uuid);return jsonb_build_object('saved',true);
 elsif p_action='contacts' then
  return coalesce((select jsonb_agg(jsonb_build_object('role',x.role_key,'name',p.first_name||' '||p.last_name,'email',p.email,'phone',p.phone)) from public.outreach_campaign_contacts x join public.organization_people p on p.organization_id=x.organization_id and p.id=x.person_id where x.campaign_id=c.id and x.active),'[]'::jsonb);
 elsif p_action='register_person' or p_action='link_person' then
  if not private.outreach_admin(c.organization_id,true) then raise exception 'Reviewed identity requires campaign administrator' using errcode='42501'; end if;
  if length(btrim(coalesce(p_payload->>'reason','')))<10 then raise exception 'Identity review reason required';end if;
  if not private.person_permission(c.organization_id,(p_payload->>'person_id')::uuid,'people.read') then raise exception 'Person outside campaign organization' using errcode='42501';end if;
  if p_action='register_person' then
   insert into public.outreach_campaign_registrants(campaign_id,organization_id,person_id) values(c.id,c.organization_id,(p_payload->>'person_id')::uuid) returning * into r;
  else
   select * into r from public.outreach_campaign_registrants where campaign_id=c.id and outreach_campaign_registrants.id=rid for update;
   if not found or r.person_id is not null or r.revision is distinct from (p_payload->>'revision')::int then raise exception 'Registration changed or already linked';end if;
   update public.outreach_campaign_registrants set person_id=(p_payload->>'person_id')::uuid,revision=revision+1 where outreach_campaign_registrants.id=rid returning * into r;
  end if;
  perform private.outreach_audit(c.id,c.organization_id,'registrant.identity_linked',r.id);return jsonb_build_object('id',r.id);
 elsif p_action in ('decision','followup','followups') then
  if not private.outreach_can(c.id,case when p_action='decision' then 'decisions' else 'followup' end) then raise exception 'Campaign action denied' using errcode='42501';end if;
  select * into r from public.outreach_campaign_registrants where campaign_id=c.id and outreach_campaign_registrants.id=rid;
  if not found then raise exception 'Registrant outside campaign' using errcode='42501';end if;
  if p_action='followups' then return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.outreach_campaign_followups x where x.campaign_id=c.id and x.registrant_id=r.id),'[]'::jsonb);end if;
  if p_action='decision' then
   if not coalesce((c.settings->'decision_types') ? (p_payload->>'decision'),false) then raise exception 'Decision not configured';end if;
   insert into public.outreach_campaign_decisions(campaign_id,registrant_id,decision,notes,source,altar_staff) values(c.id,r.id,p_payload->>'decision',coalesce(p_payload->>'notes',''),'staff',auth.uid()) returning outreach_campaign_decisions.id into target_id;
   perform private.outreach_audit(c.id,c.organization_id,'decision.captured',target_id);perform private.outreach_event(c.id,'followup.required',r.id,'decision:'||target_id);return jsonb_build_object('id',target_id);
  end if;
  if p_payload->>'assigned_user_id' is not null and not exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c.id and a.user_id=(p_payload->>'assigned_user_id')::uuid and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and 'followup'=any(a.capabilities) and private.outreach_verified(a.user_id)) and not exists(select 1 from public.outreach_campaign_admins a where a.organization_id=c.organization_id and a.user_id=(p_payload->>'assigned_user_id')::uuid and a.active and private.staff_assignment_active(a.organization_id,a.user_id) and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now())) then raise exception 'Assignee outside campaign';end if;
  target_id:=(p_payload->>'id')::uuid;
  if target_id is null then insert into public.outreach_campaign_followups(campaign_id,registrant_id,title,note,due_on,assigned_user_id) values(c.id,r.id,p_payload->>'title',coalesce(p_payload->>'note',''),(p_payload->>'due_on')::date,(p_payload->>'assigned_user_id')::uuid) returning * into f;
  else select * into f from public.outreach_campaign_followups where campaign_id=c.id and registrant_id=r.id and outreach_campaign_followups.id=target_id for update;
   if not found or f.revision is distinct from (p_payload->>'revision')::int then raise exception 'Follow-up changed';end if;
   update public.outreach_campaign_followups set title=coalesce(p_payload->>'title',title),note=coalesce(p_payload->>'note',note),status=coalesce(p_payload->>'status',status),due_on=(p_payload->>'due_on')::date,assigned_user_id=(p_payload->>'assigned_user_id')::uuid,revision=revision+1,updated_at=now() where outreach_campaign_followups.id=target_id returning * into f;
  end if;
  perform private.outreach_audit(c.id,c.organization_id,'followup.changed',f.id,jsonb_build_object('status',f.status));perform private.outreach_event(c.id,'followup.required',f.id,'followup:'||f.id||':'||f.revision);return to_jsonb(f);
 elsif p_action='configure' then
  select * into c from public.outreach_campaigns where outreach_campaigns.id=p_campaign for update;
  if not private.outreach_admin(c.organization_id,true) then raise exception 'Campaign administrator required' using errcode='42501';end if;
  if c.revision is distinct from (p_payload->>'revision')::int then raise exception 'Campaign changed';end if;
  if p_payload ? 'settings' then
   if jsonb_typeof(p_payload->'settings')<>'object' or (p_payload->'settings' ? 'workflow_inputs' and jsonb_typeof(p_payload->'settings'->'workflow_inputs')<>'object') then raise exception 'Invalid campaign settings';end if;
   if p_payload->'settings'->'workflow_inputs' ? 'flyers' and jsonb_typeof(p_payload->'settings'->'workflow_inputs'->'flyers')<>'boolean' then raise exception 'Flyer choice must be explicit';end if;
   for item in select value from jsonb_each(coalesce(p_payload->'settings'->'workflow_inputs','{}')) where key in ('bikes_quantity','tablets_quantity') loop if jsonb_typeof(item)<>'number' or item::text !~ '^[0-9]+$' then raise exception 'Quantity must be a nonnegative integer';end if;end loop;
  end if;
  if p_payload->>'status'='ready' and exists(select 1 from public.outreach_campaign_steps s where s.campaign_id=c.id and coalesce((s.definition->>'required')::boolean,true) and private.outreach_step_state(c.id,s.step_key) not in ('completed','not_applicable')) then raise exception 'Complete required campaign preparation before readiness';end if;
  if p_payload ? 'settings' and (p_payload->'settings'->'workflow_inputs') is distinct from (c.settings->'workflow_inputs') then perform private.outreach_event(c.id,'followup.required',c.id,c.id||':coordinator-review:'||(c.revision+1));end if;
  update public.outreach_campaigns set event_start=case when p_payload ? 'event_start' then (p_payload->>'event_start')::timestamptz else event_start end,event_end=case when p_payload ? 'event_end' then (p_payload->>'event_end')::timestamptz else event_end end,registration_start=case when p_payload ? 'registration_start' then (p_payload->>'registration_start')::timestamptz else registration_start end,venue=coalesce(p_payload->'venue',venue),settings=coalesce(p_payload->'settings',settings),status=coalesce(p_payload->>'status',status),closed_at=case when p_payload->>'status'='closed' then now() else closed_at end,revision=revision+1 where outreach_campaigns.id=c.id returning * into c;
  perform private.outreach_audit(c.id,c.organization_id,'campaign.configured',c.id);
  if c.status in ('registration_open','ready','completed') then perform private.outreach_event(c.id,case c.status when 'registration_open' then 'registration.opened' when 'ready' then 'event.ready' else 'event.completed' end,c.id,c.id||':status:'||c.status||':'||c.revision);end if;
  return to_jsonb(c);
 end if;
 raise exception 'Unsupported campaign action';
end $$;
create function private.outreach_summary(p_campaign uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('registrations',count(*),'decisions',count(*) filter(where value->>'decision' is not null),'salvations',count(*) filter(where value->>'decision'='salvation'),'rededications',count(*) filter(where value->>'decision'='rededication'),'prayer_followup',count(*) filter(where value->>'decision'='prayer_followup'),'discipleship_enrolled',count(*) filter(where value->>'discipleship_status'<>'not_enrolled'),'discipleship_active',count(*) filter(where value->>'discipleship_status'='active'),'discipleship_completed',count(*) filter(where value->>'discipleship_status'='completed'),'discipleship_not_started',count(*) filter(where value->>'discipleship_status' in ('not_enrolled','not_started')),'followup_needed',count(*) filter(where value->>'followup_status' in ('needed','open'))) from jsonb_array_elements(private.outreach_registrants(p_campaign))
$$;
create function public.outreach_campaign_workspace(p_action text,p_campaign uuid default null,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.outreach_core(p_action,p_campaign,p_payload)$$;
-- Lock down every new relation, even where the platform auto-RLS trigger is absent.
do $$declare n text;begin
 foreach n in array array['outreach_campaign_admins','outreach_opportunities','outreach_workflow_templates','outreach_campaigns','outreach_campaign_assignments','outreach_campaign_contacts','outreach_campaign_sources','outreach_campaign_registrants','outreach_campaign_decisions','outreach_campaign_followups','outreach_campaign_audit','outreach_campaign_events'] loop
  execute format('alter table public.%I enable row level security',n);execute format('revoke all on public.%I from public,anon,authenticated',n);execute format('grant all on public.%I to service_role',n);
 end loop;
end $$;
revoke all on function private.outreach_verified(uuid),private.outreach_admin(uuid,boolean),private.outreach_can(uuid,text),private.outreach_audit(uuid,uuid,text,uuid,jsonb),private.outreach_event(uuid,text,uuid,text),private.outreach_immutable(),private.outreach_registrants(uuid),private.outreach_csv_cell(text),private.outreach_opportunity_valid(jsonb),private.outreach_core(text,uuid,jsonb),private.outreach_summary(uuid),public.outreach_campaign_workspace(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.outreach_core(text,uuid,jsonb),public.outreach_campaign_workspace(text,uuid,jsonb) to authenticated;
