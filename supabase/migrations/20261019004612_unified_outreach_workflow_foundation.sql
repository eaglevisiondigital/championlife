-- Forward extraction from accepted source commits; production registration definitions are untouched.
alter table public.outreach_campaign_assignments drop constraint outreach_campaign_assignments_capabilities_check;
alter table public.outreach_campaign_assignments add constraint outreach_campaign_assignments_capabilities_check check(capabilities <@ array['checkin.manage','communications.bulk_send','communications.delivery.view','communications.send','communications.templates.manage','communications.templates.view','communications.view','decision.manage','decision.view','decisions','documents','draw','export','followup','host.respond','host.view','inventory.manage','inventory.view','issue.manage','ops.manage','ops.view','preevent.manage','preevent.view','prize.claim','prize.draw','prize.manage','prize.view','registration.export','registration.manage','registration.view','team.manage','team.view','travel.manage','travel.view','view','workflow']::text[] and cardinality(capabilities)>0 and array_position(capabilities,null) is null and (not(capabilities && array['registration.manage','registration.export','checkin.manage']) or 'registration.view'=any(capabilities)) and (not('decision.manage'=any(capabilities)) or 'decision.view'=any(capabilities)) and (not('team.manage'=any(capabilities)) or 'team.view'=any(capabilities)) and (not('travel.manage'=any(capabilities)) or 'travel.view'=any(capabilities)) and (not(capabilities && array['prize.manage','prize.draw','prize.claim']) or 'prize.view'=any(capabilities)) and (not('ops.manage'=any(capabilities)) or 'ops.view'=any(capabilities)) and (not('inventory.manage'=any(capabilities)) or 'inventory.view'=any(capabilities)) and (not('issue.manage'=any(capabilities)) or 'ops.view'=any(capabilities)) and (not('preevent.manage'=any(capabilities)) or 'preevent.view'=any(capabilities)) and (not('host.respond'=any(capabilities)) or 'host.view'=any(capabilities)) );
alter table public.outreach_campaign_events drop constraint outreach_campaign_events_kind_check;
alter table public.outreach_campaign_events add constraint outreach_campaign_events_kind_check check(kind in ('agreement.completed','campaign.approved','campaign.created','departure_reminder','document.requested','document.uploaded','drawing_number.assigned','drawing_reminder','event.completed','event.ready','followup.required','lodging.assigned','lodging.changed','outreach.agreement.completed','outreach.agreement.requested','outreach.attendee.checked_in','outreach.attendee.checkin_reversed','outreach.campaign.created','outreach.campaign.postponed','outreach.campaign.rescheduled','outreach.cost_impact_detected','outreach.document.approved','outreach.document.requested','outreach.document.uploaded','outreach.drawing.reminder','outreach.event_details.missing','outreach.final_readiness.changed','outreach.opportunity.approved','outreach.opportunity.submitted','outreach.ops.event_completed','outreach.ops.issue_opened','outreach.ops.issue_resolved','outreach.ops.ready','outreach.packet.generated','outreach.packet.ready','outreach.prize.claimed','outreach.prize.unclaimed','outreach.prize.winner_selected','outreach.registration.confirmed','outreach.registration.qr_requested','outreach.registration.submitted','outreach.registration.updated','outreach.task.due','outreach.task.escalated','outreach.task.overdue','outreach.training.assigned','outreach.training.completed','outreach.waiver.signed','outreach.walkup.registered','outreach.welcome.prepared','prize.unclaimed','prize.won','registration.opened','team.action_required','team.signup_opened','team_role.assigned','team_signup.approved','team_signup.not_selected','team_signup.submitted','team_signup.waitlisted','training.assigned','training.completed','trip_details.updated','vehicle.assigned','vehicle.changed','workflow.step_completed','workflow.step_due','workflow.step_overdue'));
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

alter table public.outreach_campaigns add column template_id uuid references public.outreach_workflow_templates(id), add column opportunity_id uuid unique;
alter table public.outreach_campaigns add constraint outreach_campaign_opportunity_fk foreign key(organization_id,opportunity_id) references public.outreach_opportunities(organization_id,id);

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

create function private.outreach_can(p_campaign uuid,p_cap text default 'view') returns boolean language sql stable security definer set search_path='' as $$
 select private.outreach_verified(auth.uid()) and exists(select 1 from public.outreach_campaigns c where c.id=p_campaign and
 ((p_cap<>'draw' and private.outreach_admin(c.organization_id,p_cap<>'view')) or exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c.id and a.user_id=auth.uid() and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and 'view'=any(a.capabilities) and p_cap=any(a.capabilities))))
$$;

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

-- Configurable snapshots and private document delivery; no scheduler/provider sends.
alter table public.outreach_workflow_templates add column organization_id uuid references public.organizations(id);

alter table public.outreach_workflow_templates drop constraint outreach_workflow_templates_template_key_version_key;

create unique index outreach_template_org_version_idx on public.outreach_workflow_templates(organization_id,template_key,version) where organization_id is not null;

create unique index outreach_template_global_version_idx on public.outreach_workflow_templates(template_key,version) where organization_id is null;

create table public.outreach_campaign_steps (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id),
 step_key text not null, definition jsonb not null, position integer not null, status text not null default 'pending' check(status in ('pending','completed','reopened')),
 assigned_user_id uuid references auth.users(id), assigned_role text, due_at timestamptz,
 completion_note text not null default '' check(length(completion_note)<=2000), completed_at timestamptz, completed_by uuid references auth.users(id),
 revision integer not null default 1, unique(campaign_id,step_key), unique(campaign_id,id)
);

create index outreach_step_due_idx on public.outreach_campaign_steps(campaign_id,status,due_at);

create table public.outreach_campaign_step_comments (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, step_id uuid not null, actor_user_id uuid not null references auth.users(id),
 body text not null check(length(btrim(body)) between 1 and 2000), created_at timestamptz not null default now(),
 foreign key(campaign_id,step_id) references public.outreach_campaign_steps(campaign_id,id)
);

create table public.outreach_campaign_documents (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id),
 category text not null check(category in ('agreements','production_packet','event_packet','flyers','qr_graphics','site_layout','venue_map','permits','insurance','lodging','transportation','personnel','inventory','training','photos','videos','other')),
 title text not null check(length(btrim(title)) between 1 and 160), requested_from uuid references auth.users(id), due_at timestamptz,
 visibility text not null default 'restricted' check(visibility in ('restricted','internal','public')),
 status text not null default 'requested' check(status in ('requested','uploaded')), replaces_id uuid, version integer not null default 1,
 object_path text unique not null, mime_type text, byte_size bigint check(byte_size between 1 and 10485760),
 created_at timestamptz not null default now(), uploaded_at timestamptz,
 unique(campaign_id,id), unique(replaces_id), foreign key(campaign_id,replaces_id) references public.outreach_campaign_documents(campaign_id,id)
);

create index outreach_document_campaign_idx on public.outreach_campaign_documents(campaign_id,visibility,status);

create table public.outreach_campaign_resources (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id),
 resource_key text not null, title text not null, resource_type text not null check(resource_type in ('training','book','form','packet')),
 source_url text check(source_url ~ '^https://[^\s]+$'), document_id uuid, capture_state text not null check(capture_state in ('available','pending_field_capture','pending_asset')),
 field_schema jsonb, attribution text, unique(campaign_id,resource_key), unique(campaign_id,id),
 foreign key(campaign_id,document_id) references public.outreach_campaign_documents(campaign_id,id),
 check(capture_state<>'available' or source_url is not null or document_id is not null)
);

create table public.outreach_campaign_training (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, resource_id uuid not null, assigned_user_id uuid not null references auth.users(id),
 state text not null default 'assigned' check(state in ('assigned','viewed','completed')), viewed_at timestamptz, completed_at timestamptz,
 foreign key(campaign_id,resource_id) references public.outreach_campaign_resources(campaign_id,id), unique(resource_id,assigned_user_id)
);

create function private.outreach_template_valid(p jsonb) returns boolean language plpgsql set search_path='' as $$
declare s jsonb; d text; seen text[]:='{}'; previous integer:=-1;
begin
 if jsonb_typeof(p)<>'array' or jsonb_array_length(p) not between 1 and 100 or octet_length(p::text)>100000 then return false;end if;
 for s in select value from jsonb_array_elements(p) loop
  if jsonb_typeof(s)<>'object' or coalesce(s->>'key','') !~ '^[a-z0-9_]{1,80}$' or s->>'key'=any(seen) or length(coalesce(s->>'title','')) not between 1 and 160 or length(coalesce(s->>'instructions',''))>6000 or coalesce((s->>'order')::int,-1)<=previous then return false;end if;
  if coalesce(s->>'role','other')<>all(array['host_pastor','local_coordinator','outreach_coordinator','pastor_roddy','internal_team','logistics_lead','local_leader','other']) then return false;end if;
  if exists(select 1 from jsonb_each(s) x where x.key in ('active','required','signature_required','approval_required') and jsonb_typeof(x.value)<>'boolean') then return false;end if;
  if s ? 'completion_rule' and s->>'completion_rule' not in ('manual','assigned_training_complete') then return false;end if;
  if s ? 'due_days' and (s->>'due_days')::int not between -3650 and 3650 then return false;end if;
  if s ? 'reminder_days' and (s->>'reminder_days')::int not between 1 and 365 then return false;end if;
  if s ? 'depends_on' and jsonb_typeof(s->'depends_on')<>'array' then return false;end if;
  for d in select jsonb_array_elements_text(coalesce(s->'depends_on','[]')) loop if not d=any(seen) then return false;end if;end loop;
  if s ? 'condition' and (jsonb_typeof(s->'condition')<>'object' or coalesce(s->'condition'->>'field','') !~ '^[a-z0-9_]{1,80}$' or not (s->'condition' ? 'equals')) then return false;end if;
  previous:=(s->>'order')::int;seen:=array_append(seen,s->>'key');
 end loop;return true;
 exception when others then return false;
end $$;

create function private.outreach_template_guard() returns trigger language plpgsql set search_path='' as $$
 begin if not private.outreach_template_valid(new.steps) then raise exception 'Invalid ordered workflow definition';end if;return new;end
$$;

create trigger outreach_template_valid before insert on public.outreach_workflow_templates for each row execute function private.outreach_template_guard();

-- Persist due times from the campaign's explicit instant, not browser/local timezone.
create function private.outreach_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
declare t public.outreach_workflow_templates; s jsonb;
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Unknown timezone';end if;
 select * into t from public.outreach_workflow_templates where id=new.template_id;
 if t.organization_id is not null and t.organization_id<>new.organization_id then raise exception 'Template outside organization' using errcode='42501';end if;
 for s in select value from jsonb_array_elements(t.steps) loop
  insert into public.outreach_campaign_steps(campaign_id,step_key,definition,position,assigned_role,due_at)
  values(new.id,s->>'key',s,(s->>'order')::int,s->>'role',new.event_start+make_interval(days=>coalesce((s->>'due_days')::int,0)));
 end loop;
 perform private.outreach_audit(new.id,new.organization_id,'campaign.created',new.id,jsonb_build_object('template_id',t.id,'template_version',t.version));
 perform private.outreach_event(new.id,'campaign.created',new.id,new.id||':created');
 return new;
end $$;

create trigger outreach_campaign_snapshot after insert on public.outreach_campaigns for each row execute function private.outreach_snapshot();

create function private.outreach_campaign_guard() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if new.organization_id<>old.organization_id or new.id<>old.id or new.code<>old.code or new.template_id<>old.template_id or new.opportunity_id is distinct from old.opportunity_id then raise exception 'Campaign identity and workflow snapshot cannot change';end if;
 if new.event_start is distinct from old.event_start then
  update public.outreach_campaign_steps set due_at=new.event_start+make_interval(days=>coalesce((definition->>'due_days')::int,0)),revision=revision+1 where campaign_id=old.id and status<>'completed';
 end if;return new;
 end
$$;

create trigger outreach_campaign_identity before update on public.outreach_campaigns for each row execute function private.outreach_campaign_guard();

create function private.outreach_step_guard() returns trigger language plpgsql set search_path='' as $$
 begin if new.campaign_id<>old.campaign_id or new.step_key<>old.step_key or new.definition<>old.definition or new.position<>old.position then raise exception 'Workflow snapshot is immutable';end if;return new;end
$$;

create trigger outreach_step_snapshot_guard before update on public.outreach_campaign_steps for each row execute function private.outreach_step_guard();

create trigger outreach_step_history_immutable before update or delete on public.outreach_campaign_step_comments for each row execute function private.outreach_immutable();

create function private.outreach_step_state(p_campaign uuid,p_key text) returns text language plpgsql stable security definer set search_path='' as $$
declare s public.outreach_campaign_steps; c public.outreach_campaigns; dep text; value jsonb;
begin
 select * into s from public.outreach_campaign_steps where campaign_id=p_campaign and step_key=p_key;
 if not found then return 'blocked';end if;
 if s.status='completed' then return 'completed';end if;
 select * into c from public.outreach_campaigns where id=p_campaign;
 if coalesce((s.definition->>'active')::boolean,true)=false then return 'not_applicable';end if;
 if s.definition ? 'condition' then
  value:=c.settings->'workflow_inputs'->(s.definition->'condition'->>'field');
  if value is null then return 'awaiting_configuration';end if;
  if value<>s.definition->'condition'->'equals' then return 'not_applicable';end if;
 end if;
 for dep in select jsonb_array_elements_text(coalesce(s.definition->'depends_on','[]')) loop
  if private.outreach_step_state(p_campaign,dep) not in ('completed','not_applicable') then return 'blocked';end if;
 end loop;
 return case when s.due_at<now() then 'overdue' else 'ready' end;
end $$;

create function private.outreach_bridge() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 insert into public.outreach_campaign_registrants(campaign_id,organization_id,legacy_registration_id,registered_at)
 select c.id,c.organization_id,new.id,new.created_at from public.outreach_campaign_sources s join public.outreach_campaigns c on c.id=s.campaign_id where s.source=new.source
 on conflict(legacy_registration_id) do nothing;return new;
 end
$$;

create trigger outreach_registration_campaign_bridge after insert on public.outreach_registrations for each row execute function private.outreach_bridge();

create function private.outreach_workflow(p_action text,p_campaign uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.outreach_campaigns; s public.outreach_campaign_steps; doc public.outreach_campaign_documents; previous_doc public.outreach_campaign_documents;
 target_id uuid; item jsonb; dep text; missing integer; step_state text; result jsonb; t public.outreach_workflow_templates;
begin
 if not private.outreach_verified(auth.uid()) then raise exception 'Verified identity required' using errcode='42501';end if;
 if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>125000 then raise exception 'Invalid request';end if;
 if p_action in ('templates','template_publish') then
  if not private.outreach_admin((p_payload->>'organization_id')::uuid,p_action='template_publish') then raise exception 'Campaign administrator required' using errcode='42501';end if;
  if p_action='templates' then return coalesce((select jsonb_agg(to_jsonb(x) order by template_key,version) from public.outreach_workflow_templates x where x.organization_id is null or x.organization_id=(p_payload->>'organization_id')::uuid),'[]');end if;
  insert into public.outreach_workflow_templates(organization_id,template_key,version,title,steps) values((p_payload->>'organization_id')::uuid,p_payload->>'template_key',(p_payload->>'version')::int,p_payload->>'title',p_payload->'steps') returning * into t;return to_jsonb(t);
 end if;
 select * into c from public.outreach_campaigns where outreach_campaigns.id=p_campaign;
 if not found or not private.outreach_can(c.id) then raise exception 'Campaign access denied' using errcode='42501';end if;
 if p_action='list' then
  return jsonb_build_object('assignees',case when private.outreach_can(c.id,'workflow') then (select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'email',u.email,'role',a.role_key)),'[]') from public.outreach_campaign_assignments a join auth.users u on u.id=a.user_id where a.campaign_id=c.id and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and private.outreach_verified(a.user_id)) else '[]'::jsonb end, 'comments',(select coalesce(jsonb_agg(jsonb_build_object('step_id',step_id,'body',body,'created_at',created_at) order by created_at),'[]') from public.outreach_campaign_step_comments where campaign_id=c.id and private.outreach_can(c.id,'workflow')), 'steps',(select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('state',private.outreach_step_state(c.id,x.step_key)) order by position),'[]') from public.outreach_campaign_steps x where campaign_id=c.id),
   'resources',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.outreach_campaign_resources x where campaign_id=c.id),
   'documents',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at),'[]') from public.outreach_campaign_documents x where campaign_id=c.id and private.outreach_can(c.id,'documents') and (visibility<>'restricted' or private.outreach_admin(c.organization_id,true))),
   'training',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.outreach_campaign_training x where campaign_id=c.id and (assigned_user_id=auth.uid() or private.outreach_can(c.id,'workflow'))),
   'events',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'delivery_state',delivery_state,'created_at',created_at,'acknowledged_at',acknowledged_at)),'[]') from public.outreach_campaign_events where campaign_id=c.id and private.outreach_can(c.id,'workflow')));
 elsif p_action='document_request' then
  if not private.outreach_can(c.id,'documents') then raise exception 'Document access denied' using errcode='42501';end if;
  if coalesce(p_payload->>'visibility','restricted')='restricted' and not private.outreach_admin(c.organization_id,true) then raise exception 'Restricted document requires administrator' using errcode='42501';end if;
  if p_payload->>'requested_from' is not null and not exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c.id and a.user_id=(p_payload->>'requested_from')::uuid and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and private.outreach_verified(a.user_id)) then raise exception 'Requested account outside campaign';end if;
  target_id:=gen_random_uuid();
  if p_payload->>'replaces_id' is not null then select * into previous_doc from public.outreach_campaign_documents where campaign_id=c.id and outreach_campaign_documents.id=(p_payload->>'replaces_id')::uuid;
   if not found or previous_doc.visibility='restricted' and not private.outreach_admin(c.organization_id,true) then raise exception 'Prior version unavailable';end if;
  end if;
  insert into public.outreach_campaign_documents(id,campaign_id,category,title,requested_from,due_at,visibility,replaces_id,version,object_path)
  values(target_id,c.id,p_payload->>'category',p_payload->>'title',(p_payload->>'requested_from')::uuid,(p_payload->>'due_at')::timestamptz,coalesce(previous_doc.visibility,p_payload->>'visibility','restricted'),previous_doc.id,coalesce(previous_doc.version+1,1),c.id||'/'||target_id||'/file') returning * into doc;
  perform private.outreach_audit(c.id,c.organization_id,'document.requested',target_id);perform private.outreach_event(c.id,'document.requested',target_id,'document:'||target_id||':requested');return to_jsonb(doc);
 elsif p_action='document_uploaded' then
  if not private.outreach_can(c.id,'documents') then raise exception 'Document access denied' using errcode='42501';end if;
  select * into doc from public.outreach_campaign_documents where campaign_id=c.id and outreach_campaign_documents.id=(p_payload->>'id')::uuid for update;
  if not found or doc.visibility='restricted' and not private.outreach_admin(c.organization_id,true) then raise exception 'Document access denied' using errcode='42501';end if;
  -- Storage metadata is trusted only after the independently authorized object INSERT.
  select metadata into item from storage.objects where bucket_id='outreach-campaign-documents' and name=doc.object_path;
  if item is null or coalesce((item->>'size')::bigint,0) not between 1 and 10485760 or coalesce(item->>'mimetype','')<>all(array['application/pdf','image/png','image/jpeg','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) then raise exception 'Uploaded file unavailable or invalid';end if;
  if doc.status='uploaded' then return to_jsonb(doc);end if;
  update public.outreach_campaign_documents set status='uploaded',byte_size=(item->>'size')::bigint,mime_type=item->>'mimetype',uploaded_at=now() where outreach_campaign_documents.id=doc.id returning * into doc;
  perform private.outreach_audit(c.id,c.organization_id,'document.uploaded',doc.id);perform private.outreach_event(c.id,'document.uploaded',doc.id,'document:'||doc.id||':uploaded');return to_jsonb(doc);
 elsif p_action in ('training_assign','training_status') then
  if p_action='training_assign' then
   if not private.outreach_can(c.id,'workflow') then raise exception 'Workflow access denied' using errcode='42501';end if;
   if not exists(select 1 from public.outreach_campaign_resources x where x.campaign_id=c.id and x.id=(p_payload->>'resource_id')::uuid and x.resource_type='training' and x.capture_state='available') or not exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c.id and a.user_id=(p_payload->>'user_id')::uuid and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and private.outreach_verified(a.user_id)) then raise exception 'Training resource or assignee unavailable';end if;
   insert into public.outreach_campaign_training(campaign_id,resource_id,assigned_user_id) values(c.id,(p_payload->>'resource_id')::uuid,(p_payload->>'user_id')::uuid) on conflict(resource_id,assigned_user_id) do nothing returning outreach_campaign_training.id into target_id;
   if target_id is not null then perform private.outreach_event(c.id,'training.assigned',target_id,'training:'||target_id||':assigned');end if;return jsonb_build_object('saved',true);
  end if;
  if p_payload->>'state' not in ('viewed','completed') then raise exception 'Invalid training state';end if;
  update public.outreach_campaign_training set state=p_payload->>'state',viewed_at=coalesce(viewed_at,now()),completed_at=case when p_payload->>'state'='completed' then now() else completed_at end where campaign_id=c.id and outreach_campaign_training.id=(p_payload->>'id')::uuid and assigned_user_id=auth.uid() and state<>'completed' returning outreach_campaign_training.id into target_id;
  if target_id is null then raise exception 'Training assignment unavailable';end if;
  perform private.outreach_audit(c.id,c.organization_id,'training.'||(p_payload->>'state'),target_id);
  if p_payload->>'state'='completed' then perform private.outreach_event(c.id,'training.completed',target_id,'training:'||target_id||':completed');end if;return jsonb_build_object('saved',true);
 end if;
 if not private.outreach_can(c.id,'workflow') then raise exception 'Workflow access denied' using errcode='42501';end if;
 if p_action='reminders' then
  for s in select * from public.outreach_campaign_steps where campaign_id=c.id and status<>'completed' and due_at<=now() loop
   step_state:=private.outreach_step_state(c.id,s.step_key);
   if step_state='overdue' then perform private.outreach_event(c.id,'workflow.step_overdue',s.id,'overdue:'||s.id||':'||floor(extract(epoch from(now()-s.due_at))/(86400*coalesce((s.definition->>'reminder_days')::int,7)))||':'||s.revision);end if;
  end loop;
  for s in select * from public.outreach_campaign_steps where campaign_id=c.id and status<>'completed' and due_at between now() and now()+interval '1 day' loop
   if private.outreach_step_state(c.id,s.step_key)='ready' then perform private.outreach_event(c.id,'workflow.step_due',s.id,'due:'||s.id||':'||s.revision);end if;
  end loop;return jsonb_build_object('state','held','provider_connected',false);
 elsif p_action='acknowledge' then
  update public.outreach_campaign_events set acknowledged_at=now() where campaign_id=c.id and outreach_campaign_events.id=(p_payload->>'id')::uuid;return jsonb_build_object('saved',found);
 end if;
 perform 1 from public.outreach_campaigns where outreach_campaigns.id=c.id for update;
 select * into s from public.outreach_campaign_steps where campaign_id=c.id and outreach_campaign_steps.id=(p_payload->>'id')::uuid for update;
 if not found or s.revision is distinct from (p_payload->>'revision')::int then raise exception 'Step changed or unavailable';end if;
 if p_action='comment' then
  insert into public.outreach_campaign_step_comments(campaign_id,step_id,actor_user_id,body) values(c.id,s.id,auth.uid(),p_payload->>'body');
 elsif p_action='assign' then
  if p_payload->>'user_id' is not null and not exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c.id and a.user_id=(p_payload->>'user_id')::uuid and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and private.outreach_verified(a.user_id)) then raise exception 'Assignee outside campaign';end if;
  update public.outreach_campaign_steps set assigned_user_id=(p_payload->>'user_id')::uuid,assigned_role=coalesce(p_payload->>'role',assigned_role),revision=revision+1 where outreach_campaign_steps.id=s.id;
 elsif p_action='complete' then
  -- Serialize configuration/dependency changes with completion of the campaign.
  perform 1 from public.outreach_campaigns where outreach_campaigns.id=c.id for update;
  step_state:=private.outreach_step_state(c.id,s.step_key);
  if step_state not in ('ready','overdue') then raise exception 'Prerequisite or condition not satisfied';end if;
  if coalesce((s.definition->>'approval_required')::boolean,false) and not private.outreach_admin(c.organization_id,true) then raise exception 'Administrator approval required' using errcode='42501';end if;
  if coalesce((s.definition->>'signature_required')::boolean,false) and (length(btrim(coalesce(p_payload->>'note','')))<10 or not exists(select 1 from public.outreach_campaign_documents where campaign_id=c.id and category='agreements' and status='uploaded')) then raise exception 'Signed external agreement and review attestation required';end if;
  for dep in select jsonb_array_elements_text(coalesce(s.definition->'required_documents','[]')) loop
   if not exists(select 1 from public.outreach_campaign_documents where campaign_id=c.id and category=dep and status='uploaded') then raise exception 'Required document missing: %',dep;end if;
  end loop;
  if s.definition->>'completion_rule'='assigned_training_complete' and (not exists(select 1 from public.outreach_campaign_training where campaign_id=c.id) or exists(select 1 from public.outreach_campaign_training where campaign_id=c.id and state<>'completed')) then raise exception 'Assigned training is incomplete';end if;
  update public.outreach_campaign_steps set status='completed',completed_at=now(),completed_by=auth.uid(),completion_note=coalesce(p_payload->>'note',''),revision=revision+1 where outreach_campaign_steps.id=s.id;
  perform private.outreach_event(c.id,'workflow.step_completed',s.id,'completed:'||s.id||':'||(s.revision+1));
  if s.definition->>'category'='agreement' then perform private.outreach_event(c.id,'agreement.completed',s.id,'agreement:'||s.id||':'||(s.revision+1));end if;
 elsif p_action='reopen' then
  if length(btrim(coalesce(p_payload->>'note','')))<10 then raise exception 'Reopen reason required';end if;
  update public.outreach_campaign_steps set status='reopened',completed_at=null,completed_by=null,completion_note='',revision=revision+1 where outreach_campaign_steps.id=s.id;
 else raise exception 'Unsupported workflow action';end if;
 perform private.outreach_audit(c.id,c.organization_id,'workflow.'||p_action,s.id,jsonb_build_object('revision',s.revision+1));return jsonb_build_object('saved',true);
end $$;

create function public.outreach_campaign_workflow(p_action text,p_campaign uuid default null,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.outreach_workflow(p_action,p_campaign,p_payload)$$;

-- Private bucket, prescribed paths, no overwrite/delete by clients. New version = new path.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('outreach-campaign-documents','outreach-campaign-documents',false,10485760,array['application/pdf','image/png','image/jpeg','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

create function private.outreach_document_can(p_name text,p_write boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.outreach_campaign_documents d join public.outreach_campaigns c on c.id=d.campaign_id where d.object_path=p_name and private.outreach_can(c.id,'documents') and (d.visibility<>'restricted' or private.outreach_admin(c.organization_id,true)) and (not p_write or d.status='requested'))
$$;

create policy outreach_document_insert on storage.objects for insert to authenticated with check(bucket_id='outreach-campaign-documents' and private.outreach_document_can(name,true));

create policy outreach_document_read on storage.objects for select to authenticated using(bucket_id='outreach-campaign-documents' and private.outreach_document_can(name,false));

do $$declare n text;begin
 foreach n in array array['outreach_campaign_steps','outreach_campaign_step_comments','outreach_campaign_documents','outreach_campaign_resources','outreach_campaign_training'] loop
 execute format('alter table public.%I enable row level security',n);execute format('revoke all on public.%I from public,anon,authenticated',n);execute format('grant all on public.%I to service_role',n);end loop;
end $$;

revoke all on function private.outreach_template_valid(jsonb),private.outreach_template_guard(),private.outreach_snapshot(),private.outreach_campaign_guard(),private.outreach_step_guard(),private.outreach_step_state(uuid,text),private.outreach_bridge(),private.outreach_workflow(text,uuid,jsonb),private.outreach_document_can(text,boolean),public.outreach_campaign_workflow(text,uuid,jsonb) from public,anon,authenticated;

grant execute on function private.outreach_workflow(text,uuid,jsonb),private.outreach_document_can(text,boolean),public.outreach_campaign_workflow(text,uuid,jsonb) to authenticated;

-- Six source-informed stages plus conditional preparations. Exact JotForm fields pending.
insert into public.outreach_workflow_templates(template_key,version,title,steps) values('outreach_source_workflow',1,'Outreach Website Flow',
'[
 {"key":"host_setup","title":"Host Church Contact Information","instructions":"Confirm church, pastor, address, phone, outreach contact and event details. Link reviewed canonical contacts; never merge by email.","category":"host_setup","order":10,"role":"local_coordinator","required":true},
 {"key":"welcome","title":"Welcome / Outreach Coordinator Contact","instructions":"Provide the welcome/sign link and Champion Life outreach coordinator contact.","category":"welcome","order":20,"role":"outreach_coordinator","required":true,"depends_on":["host_setup"]},
 {"key":"agreement","title":"Outreach Agreement and Pre-Checklist","instructions":"Exact JotForm fields await capture. Review an externally completed, signed agreement before dependent preparation. Record flyer choice and bike/tablet quantity/purchase/transport decisions in campaign configuration; time/cost decisions require coordinator review.","category":"agreement","order":30,"role":"host_pastor","required":true,"depends_on":["welcome"],"signature_required":true,"approval_required":true,"required_documents":["agreements"],"required_form":"agreement"},
 {"key":"flyers","title":"Flyer Packet / Design Options","instructions":"Prepare flyer packet/design options only when flyers are requested.","category":"promotion","order":40,"role":"outreach_coordinator","required":true,"depends_on":["agreement"],"condition":{"field":"flyers","equals":true},"required_documents":["flyers"]},
 {"key":"production","title":"Event Production Packet / General Setup Instructions","instructions":"Provide source production packet; confirm bicycles/tablets purchase and transportation responsibilities with coordinator. No native team/travel or inventory operations in Phase A.","category":"production","order":50,"role":"logistics_lead","required":true,"depends_on":["agreement"],"required_documents":["production_packet"]},
 {"key":"training","title":"Outreach Training Videos","instructions":"Assign the existing playlist. Confirm all entered/acquired information before progressing to final event information. Completion is manually acknowledged, not LMS watch telemetry.","category":"training","order":60,"role":"internal_team","required":true,"depends_on":["production"],"completion_rule":"assigned_training_complete"},
 {"key":"event_information","title":"Final Event Information / 30-Day Readiness","instructions":"Confirm site/address, registration/start/estimated end, QR, setup map, permits, semi parking/access, insurance, personnel, inventory, meetup times/locations, lodging and directions. Team/travel details remain a later phase.","category":"event_information","order":70,"role":"outreach_coordinator","required":true,"depends_on":["training"],"due_days":-30,"reminder_days":7,"escalation_role":"outreach_coordinator"},
 {"key":"final_packet","title":"Final Event Information Packet","instructions":"Provide event-specific packet at least 14 days before the outreach. Include confirmed event information, map, permits/insurance and final personnel/inventory/travel references.","category":"final_packet","order":80,"role":"outreach_coordinator","required":true,"depends_on":["event_information"],"due_days":-14,"reminder_days":3,"required_documents":["event_packet"],"approval_required":true}
]'::jsonb);

create function private.outreach_seed_resources(p_campaign uuid) returns void language sql security definer set search_path='' as $$
insert into public.outreach_campaign_resources(campaign_id,resource_key,title,resource_type,source_url,capture_state,attribution)
select p_campaign,x.key,x.title,x.type,x.url,x.state,x.attribution from (select 1) c cross join(values
 ('training','Outreach Training Videos Playlist','training','https://youtube.com/playlist?list=PLdk3bsaqcsSk&si=OKTS4IFfsmduegfz','available','Champion Life'),
 ('agreement','Outreach Agreement and Pre-Checklist','form','https://form.jotform.com/261614615089157','pending_field_capture','Champion Life'),
 ('preregistration','Outreach Preregistration','form','https://form.jotform.com/team/223471619444054/preregistration-form-outreach','pending_field_capture','Champion Life'),
 ('team_signup','Join an Outreach Team','form','https://form.jotform.com/241095919780163','pending_field_capture','Champion Life'),
 ('king_kind','King Kind','book',null,'pending_asset','Pastor Roddy Shaffer')) x(key,title,type,url,state,attribution);

$$;

revoke all on function private.outreach_seed_resources(uuid) from public,anon,authenticated;

select private.outreach_seed_resources(id) from public.outreach_campaigns;

create function private.outreach_resource_snapshot() returns trigger language plpgsql security definer set search_path='' as $$begin perform private.outreach_seed_resources(new.id);return new;end$$;

revoke all on function private.outreach_resource_snapshot() from public,anon,authenticated;

create trigger outreach_campaign_resource_snapshot after insert on public.outreach_campaigns for each row execute function private.outreach_resource_snapshot();

create table public.outreach_drawing_numbers (
 campaign_id uuid not null, participant_id uuid not null, number text not null check(number ~ '^[1-9][0-9]{5}$'),
 primary key(campaign_id,participant_id), unique(campaign_id,number), foreign key(campaign_id,participant_id) references public.outreach_prize_participants(campaign_id,id)
);

create table public.outreach_prize_pools (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id),
 name text not null check(length(name) between 1 and 160), policy jsonb not null default '{}', active boolean not null default true,
 -- Explicit choice required. No silent policy for an unclaimed selection.
 unclaimed_policy text not null check(unclaimed_policy in ('remain_eligible','exclude_participant')),
 unique(campaign_id,id)
);

create table public.outreach_prize_pool_entries (
 campaign_id uuid not null, pool_id uuid not null, participant_id uuid not null,
 primary key(pool_id,participant_id), foreign key(campaign_id,pool_id) references public.outreach_prize_pools(campaign_id,id), foreign key(campaign_id,participant_id) references public.outreach_prize_participants(campaign_id,id)
);

create table public.outreach_prize_draws (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, pool_id uuid not null, participant_id uuid not null,
 prize_label text not null check(length(prize_label) between 1 and 160), operator_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 foreign key(campaign_id,pool_id) references public.outreach_prize_pools(campaign_id,id), foreign key(campaign_id,participant_id) references public.outreach_prize_participants(campaign_id,id),unique(campaign_id,id)
);

create table public.outreach_prize_draw_history (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, draw_id uuid not null,
 kind text not null check(kind in ('selected','claimed','unclaimed')), actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 foreign key(campaign_id,draw_id) references public.outreach_prize_draws(campaign_id,id), unique(draw_id,kind)
);

-- Unique immutable ledger is the one-win constraint across ALL pools/categories.
create table public.outreach_prize_wins (
 campaign_id uuid not null, participant_id uuid not null, draw_id uuid not null unique, won_at timestamptz not null default now(),
 primary key(campaign_id,participant_id), foreign key(campaign_id,participant_id) references public.outreach_prize_participants(campaign_id,id), foreign key(campaign_id,draw_id) references public.outreach_prize_draws(campaign_id,id)
);

create table public.outreach_prize_exclusions (
 campaign_id uuid not null, participant_id uuid not null, draw_id uuid not null,
 primary key(campaign_id,participant_id), foreign key(campaign_id,participant_id) references public.outreach_prize_participants(campaign_id,id), foreign key(campaign_id,draw_id) references public.outreach_prize_draws(campaign_id,id)
);

create index outreach_prize_entry_campaign_idx on public.outreach_prize_pool_entries(campaign_id,participant_id);

create index outreach_prize_draw_participant_idx on public.outreach_prize_draws(campaign_id,participant_id);

create index outreach_prize_history_campaign_idx on public.outreach_prize_draw_history(campaign_id,draw_id);

create function private.outreach_draw_operator(p_campaign uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.outreach_verified(auth.uid()) and exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=p_campaign and a.user_id=auth.uid() and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and 'view'=any(a.capabilities) and 'draw'=any(a.capabilities))
$$;

create function private.outreach_drawing_number(p_campaign uuid,p_participant uuid) returns text language plpgsql security definer set search_path='' as $$
declare n text; bits bigint; i integer;
begin
 if not private.outreach_draw_operator(p_campaign) then raise exception 'Explicit campaign draw permission required' using errcode='42501';end if;
 perform 1 from public.outreach_prize_participants where campaign_id=p_campaign and id=p_participant for update;
 if not found then raise exception 'Participant outside campaign';end if;
 select number into n from public.outreach_drawing_numbers where campaign_id=p_campaign and participant_id=p_participant;if found then return n;end if;
 for i in 1..1000 loop
  bits:=('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint;
  if bits>=4294800000 then continue;end if; -- rejection sampling, no modulo bias
  n:=(100000+(bits%900000))::text;
  begin insert into public.outreach_drawing_numbers(campaign_id,participant_id,number) values(p_campaign,p_participant,n);
   perform private.outreach_event(p_campaign,'drawing_number.assigned',p_participant,'drawing_number:'||p_campaign||':'||p_participant);return n;
  exception when unique_violation then null;end;
 end loop;raise exception 'Number space unavailable';
end $$;

create function private.outreach_prize_select(p_campaign uuid,p_pool uuid,p_prize text) returns jsonb language plpgsql security definer set search_path='' as $$
declare participant uuid; draw uuid; n text; org uuid;
begin
 if not private.outreach_draw_operator(p_campaign) then raise exception 'Explicit campaign draw permission required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_campaign::text,726));
 if not exists(select 1 from public.outreach_prize_pools where campaign_id=p_campaign and id=p_pool and active) then raise exception 'Pool unavailable';end if;
 select p.id into participant from public.outreach_prize_participants p join public.outreach_prize_pool_entries e on e.campaign_id=p.campaign_id and e.participant_id=p.id
 join public.outreach_drawing_numbers d on d.campaign_id=p.campaign_id and d.participant_id=p.id
 where p.campaign_id=p_campaign and e.pool_id=p_pool and p.active and p.checked_in_at is not null
 and not exists(select 1 from public.outreach_prize_wins w where w.campaign_id=p_campaign and w.participant_id=p.id)
 and not exists(select 1 from public.outreach_prize_exclusions x where x.campaign_id=p_campaign and x.participant_id=p.id)
 and not exists(select 1 from public.outreach_prize_draws x where x.campaign_id=p_campaign and x.participant_id=p.id and not exists(select 1 from public.outreach_prize_draw_history h where h.draw_id=x.id and h.kind in ('claimed','unclaimed')))
 order by gen_random_uuid() limit 1 for update of p;
 if participant is null then raise exception 'No eligible checked-in participant';end if;
 insert into public.outreach_prize_draws(campaign_id,pool_id,participant_id,prize_label,operator_id) values(p_campaign,p_pool,participant,p_prize,auth.uid()) returning id into draw;
 insert into public.outreach_prize_draw_history(campaign_id,draw_id,kind,actor_id) values(p_campaign,draw,'selected',auth.uid());
 select organization_id into org from public.outreach_campaigns where id=p_campaign;perform private.outreach_audit(p_campaign,org,'draw.selected',draw);
 select number into n from public.outreach_drawing_numbers where campaign_id=p_campaign and participant_id=participant;
 -- Deliberately no participant/name/phone in presentation projection.
 return jsonb_build_object('draw_id',draw,'number',n,'prize',p_prize);
end $$;

create function private.outreach_prize_resolve(p_campaign uuid,p_draw uuid,p_outcome text) returns void language plpgsql security definer set search_path='' as $$
declare d public.outreach_prize_draws; policy text; org uuid;
begin
 if not private.outreach_draw_operator(p_campaign) then raise exception 'Explicit campaign draw permission required' using errcode='42501';end if;
 if p_outcome not in ('claimed','unclaimed') then raise exception 'Invalid outcome';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_campaign::text,726));
 select * into d from public.outreach_prize_draws where campaign_id=p_campaign and id=p_draw for update;
 if not found then raise exception 'Draw outside campaign';end if;
 if exists(select 1 from public.outreach_prize_draw_history where draw_id=d.id and kind in ('claimed','unclaimed')) then raise exception 'Draw already resolved';end if;
 if p_outcome='claimed' then
  if not exists(select 1 from public.outreach_prize_participants where campaign_id=p_campaign and id=d.participant_id and active and checked_in_at is not null) then raise exception 'Checked-in participant required';end if;
  insert into public.outreach_prize_wins(campaign_id,participant_id,draw_id) values(p_campaign,d.participant_id,d.id);
  perform private.outreach_event(p_campaign,'prize.won',d.participant_id,'prize.won:'||d.id);
 else
  select unclaimed_policy into policy from public.outreach_prize_pools where id=d.pool_id;
  if policy='exclude_participant' then insert into public.outreach_prize_exclusions(campaign_id,participant_id,draw_id) values(p_campaign,d.participant_id,d.id) on conflict do nothing;end if;
  perform private.outreach_event(p_campaign,'prize.unclaimed',d.participant_id,'prize.unclaimed:'||d.id);
 end if;
 insert into public.outreach_prize_draw_history(campaign_id,draw_id,kind,actor_id) values(p_campaign,d.id,p_outcome,auth.uid());
 select organization_id into org from public.outreach_campaigns where id=p_campaign;perform private.outreach_audit(p_campaign,org,'prize.'||p_outcome,d.id);
end $$;

do $$declare n text;begin
 foreach n in array array['outreach_prize_participants','outreach_drawing_numbers','outreach_prize_pools','outreach_prize_pool_entries','outreach_prize_draws','outreach_prize_draw_history','outreach_prize_wins','outreach_prize_exclusions'] loop
 execute format('alter table public.%I enable row level security',n);execute format('revoke all on public.%I from public,anon,authenticated',n);execute format('grant all on public.%I to service_role',n);end loop;
 foreach n in array array['outreach_drawing_numbers','outreach_prize_draws','outreach_prize_draw_history','outreach_prize_wins','outreach_prize_exclusions'] loop
 execute format('create trigger %I before update or delete on public.%I for each row execute function private.outreach_immutable()',n||'_immutable',n);end loop;
end $$;

revoke all on function private.outreach_draw_operator(uuid),private.outreach_drawing_number(uuid,uuid),private.outreach_prize_select(uuid,uuid,text),private.outreach_prize_resolve(uuid,uuid,text) from public,anon,authenticated,service_role;

insert into public.outreach_campaign_sources(source,campaign_id) select source,campaign_id from public.outreach_decision_campaign_sources where active;
insert into public.outreach_campaign_registrants(campaign_id,organization_id,legacy_registration_id,registered_at) select c.id,c.organization_id,r.id,r.created_at from public.outreach_registrations r join public.outreach_campaign_sources s on s.source=r.source join public.outreach_campaigns c on c.id=s.campaign_id on conflict(legacy_registration_id) do nothing;
