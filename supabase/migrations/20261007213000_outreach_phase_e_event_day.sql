-- Phase E candidate: reusable campaign-scoped Event Day Command Center.
-- Extends Phase B team/vehicles, Phase C registration/check-in and Phase D prize operations.
-- No campaign is activated and no account, permission or production data is created here.

alter table public.outreach_campaign_assignments drop constraint outreach_campaign_assignments_capabilities_check;
alter table public.outreach_campaign_assignments add constraint outreach_campaign_assignments_capabilities_check check (
 capabilities <@ array['view','export','followup','decisions','workflow','documents','draw','team.view','team.manage','travel.view','travel.manage','registration.view','registration.manage','registration.export','checkin.manage','prize.view','prize.manage','prize.draw','prize.claim','ops.view','ops.manage','inventory.view','inventory.manage','issue.manage']::text[]
 and cardinality(capabilities)>0 and array_position(capabilities,null) is null
 and (not('team.manage'=any(capabilities)) or 'team.view'=any(capabilities))
 and (not('travel.manage'=any(capabilities)) or 'travel.view'=any(capabilities))
 and (not(capabilities && array['registration.manage','registration.export','checkin.manage']) or 'registration.view'=any(capabilities))
 and (not(capabilities && array['prize.manage','prize.draw','prize.claim']) or 'prize.view'=any(capabilities))
 and (not('ops.manage'=any(capabilities)) or 'ops.view'=any(capabilities))
 and (not('inventory.manage'=any(capabilities)) or 'inventory.view'=any(capabilities))
 and (not('issue.manage'=any(capabilities)) or 'ops.view'=any(capabilities)));

alter table public.outreach_campaign_events drop constraint outreach_campaign_events_kind_check;
alter table public.outreach_campaign_events add constraint outreach_campaign_events_kind_check check(kind in (
 'campaign.created','campaign.approved','workflow.step_due','workflow.step_overdue','workflow.step_completed','document.requested','document.uploaded','agreement.completed','training.assigned','training.completed','registration.opened','team.signup_opened','event.ready','event.completed','followup.required','drawing_number.assigned','drawing_reminder','prize.won','prize.unclaimed',
 'team_signup.submitted','team_signup.approved','team_signup.waitlisted','team_signup.not_selected','vehicle.assigned','vehicle.changed','lodging.assigned','lodging.changed','trip_details.updated','departure_reminder','team_role.assigned','team.action_required',
 'outreach.registration.submitted','outreach.registration.updated','outreach.waiver.signed','outreach.registration.confirmed','outreach.attendee.checked_in','outreach.attendee.checkin_reversed','outreach.walkup.registered',
 'outreach.drawing.reminder','outreach.prize.winner_selected','outreach.prize.claimed','outreach.prize.unclaimed',
 'outreach.ops.ready','outreach.ops.issue_opened','outreach.ops.issue_resolved','outreach.ops.event_completed'));

create table public.outreach_ops_templates (
 id uuid primary key default gen_random_uuid(), owner_organization_id uuid references public.organizations(id),
 name text not null check(length(btrim(name)) between 1 and 160), version integer not null check(version between 1 and 10000),
 status text not null default 'draft' check(status in ('draft','published','retired')),
 description text not null default '' check(length(description)<=2000), created_by uuid references auth.users(id),
 created_at timestamptz not null default now(), published_at timestamptz, unique(owner_organization_id,name,version), unique(id,version)
);
create table public.outreach_ops_template_areas (
 id uuid primary key default gen_random_uuid(), template_id uuid not null references public.outreach_ops_templates(id), area_key text not null check(area_key~'^[a-z0-9_-]{1,60}$'),
 title text not null check(length(btrim(title)) between 1 and 120), description text not null default '' check(length(description)<=1200),
 category text not null check(length(btrim(category)) between 1 and 80), display_order integer not null check(display_order between 1 and 10000),
 required_for_ready boolean not null default false, repeatable boolean not null default false, active boolean not null default true,
 unique(template_id,area_key), unique(template_id,id)
);
create table public.outreach_ops_template_checklists (
 id uuid primary key default gen_random_uuid(), template_id uuid not null references public.outreach_ops_templates(id), area_key text not null,
 item_key text not null check(item_key~'^[a-z0-9_-]{1,80}$'), text text not null check(length(btrim(text)) between 1 and 500),
 display_order integer not null check(display_order between 1 and 10000), required boolean not null default true,
 quantity_kind text not null default 'none' check(quantity_kind in ('none','count','text','verification')),
 dependency_key text, attachment_hook boolean not null default false, unique(template_id,area_key,item_key),
 foreign key(template_id,area_key) references public.outreach_ops_template_areas(template_id,area_key)
);
create table public.outreach_ops_template_inventory (
 id uuid primary key default gen_random_uuid(), template_id uuid not null references public.outreach_ops_templates(id), area_key text not null,
 item_key text not null check(item_key~'^[a-z0-9_-]{1,80}$'), item_name text not null check(length(btrim(item_name)) between 1 and 160),
 category text not null check(length(btrim(category)) between 1 and 80), required_quantity integer not null default 0 check(required_quantity between 0 and 100000),
 critical boolean not null default false, return_required boolean not null default true, source_owner text not null default '' check(length(source_owner)<=160),
 unique(template_id,area_key,item_key), foreign key(template_id,area_key) references public.outreach_ops_template_areas(template_id,area_key)
);
create table public.outreach_ops_template_timeline (
 id uuid primary key default gen_random_uuid(), template_id uuid not null references public.outreach_ops_templates(id), item_key text not null check(item_key~'^[a-z0-9_-]{1,80}$'),
 title text not null check(length(btrim(title)) between 1 and 160), display_order integer not null check(display_order between 1 and 10000),
 relative_minutes integer, required boolean not null default false, notes text not null default '' check(length(notes)<=1000), unique(template_id,item_key)
);

create table public.outreach_event_operations (
 campaign_id uuid primary key references public.outreach_campaigns(id), template_id uuid not null, template_version integer not null,
 status text not null default 'planning' check(status in ('planning','setup','active','closeout','event_complete')),
 poll_seconds integer not null default 15 check(poll_seconds between 10 and 300), started_at timestamptz, completed_at timestamptz,
 completion_note text not null default '' check(length(completion_note)<=2000), revision integer not null default 1,
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
 foreign key(template_id,template_version) references public.outreach_ops_templates(id,version)
);
create table public.outreach_event_areas (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id), template_area_id uuid,
 area_key text not null check(area_key~'^[a-z0-9_-]{1,60}$'), instance_key text not null check(instance_key~'^[a-z0-9_-]{1,80}$'),
 title text not null check(length(btrim(title)) between 1 and 120), description text not null default '' check(length(description)<=1200),
 category text not null check(length(btrim(category)) between 1 and 80), display_order integer not null check(display_order between 1 and 10000),
 required_for_ready boolean not null default false, active boolean not null default true,
 status text not null default 'not_started' check(status in ('not_started','setup_in_progress','ready','active','issue','paused','closed','cleanup_in_progress','complete')),
 location text not null default '' check(length(location)<=500), notes text not null default '' check(length(notes)<=2000),
 issue_flag boolean not null default false, setup_started_at timestamptz, ready_at timestamptz, active_at timestamptz, closed_at timestamptz, completed_at timestamptz,
 revision integer not null default 1, updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
 unique(campaign_id,id), unique(campaign_id,instance_key)
);
create index outreach_event_areas_order_idx on public.outreach_event_areas(campaign_id,active,display_order);
create table public.outreach_event_area_members (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, area_id uuid not null, member_id uuid not null,
 role text not null check(role in ('lead','backup_lead','volunteer')), arrival_status text not null default 'not_arrived' check(arrival_status in ('not_arrived','arrived','assigned','released')),
 active boolean not null default true, notes text not null default '' check(length(notes)<=1000), assigned_at timestamptz not null default now(), assigned_by uuid references auth.users(id), released_at timestamptz,
 foreign key(campaign_id,area_id) references public.outreach_event_areas(campaign_id,id),
 foreign key(campaign_id,member_id) references public.outreach_team_members(campaign_id,id)
);
create unique index outreach_event_one_active_area_member on public.outreach_event_area_members(campaign_id,member_id) where active;
create unique index outreach_event_one_area_lead on public.outreach_event_area_members(area_id,role) where active and role in ('lead','backup_lead');
create index outreach_event_area_members_area_idx on public.outreach_event_area_members(area_id,active,role);
create table public.outreach_event_checklist_items (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, area_id uuid not null, template_item_id uuid,
 item_key text not null check(item_key~'^[a-z0-9_-]{1,80}$'), text text not null check(length(btrim(text)) between 1 and 500),
 display_order integer not null check(display_order between 1 and 10000), required boolean not null default true,
 quantity_kind text not null default 'none' check(quantity_kind in ('none','count','text','verification')), dependency_key text,
 attachment_hook boolean not null default false, completed boolean not null default false, completed_by uuid references auth.users(id), completed_at timestamptz,
 completion_note text not null default '' check(length(completion_note)<=1000), quantity_value text not null default '' check(length(quantity_value)<=200),
 issue_flag boolean not null default false, revision integer not null default 1, updated_at timestamptz not null default now(),
 foreign key(campaign_id,area_id) references public.outreach_event_areas(campaign_id,id), unique(area_id,item_key), unique(campaign_id,id),
 check((completed and completed_at is not null and completed_by is not null) or (not completed and completed_at is null and completed_by is null))
);
create index outreach_event_checklist_area_idx on public.outreach_event_checklist_items(area_id,display_order);
create table public.outreach_event_inventory (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, area_id uuid, template_item_id uuid,
 item_key text not null check(item_key~'^[a-z0-9_-]{1,80}$'), item_name text not null check(length(btrim(item_name)) between 1 and 160),
 category text not null check(length(btrim(category)) between 1 and 80), required_quantity integer not null default 0 check(required_quantity between 0 and 100000),
 available_quantity integer not null default 0 check(available_quantity between 0 and 100000), loaded_quantity integer not null default 0 check(loaded_quantity between 0 and 100000),
 on_site_quantity integer not null default 0 check(on_site_quantity between 0 and 100000), returned_quantity integer not null default 0 check(returned_quantity between 0 and 100000),
 missing_quantity integer not null default 0 check(missing_quantity between 0 and 100000), damaged_quantity integer not null default 0 check(damaged_quantity between 0 and 100000),
 direct_delivery boolean not null default false, critical boolean not null default false, return_required boolean not null default true,
 source_owner text not null default '' check(length(source_owner)<=160), vehicle_id uuid, verified_by uuid references auth.users(id), verified_at timestamptz,
 status text not null default 'needed' check(status in ('needed','committed','loaded','in_transit','on_site','in_use','packed','returned','missing','damaged')),
 notes text not null default '' check(length(notes)<=2000), revision integer not null default 1, updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
 foreign key(campaign_id,area_id) references public.outreach_event_areas(campaign_id,id), foreign key(campaign_id,vehicle_id) references public.outreach_team_vehicles(campaign_id,id),
 unique(campaign_id,id), unique(campaign_id,item_key),
 check(loaded_quantity<=available_quantity), check(direct_delivery or on_site_quantity<=loaded_quantity), check(returned_quantity<=on_site_quantity),
 check(missing_quantity+damaged_quantity<=on_site_quantity)
);
create index outreach_event_inventory_area_idx on public.outreach_event_inventory(campaign_id,area_id,status);
create index outreach_event_inventory_vehicle_idx on public.outreach_event_inventory(vehicle_id,status);
create table public.outreach_event_issues (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, area_id uuid,
 severity text not null check(severity in ('info','needs_attention','urgent')), issue text not null check(length(btrim(issue)) between 1 and 500),
 status text not null default 'open' check(status in ('open','resolved')), assigned_member_id uuid,
 opened_by uuid not null references auth.users(id), opened_at timestamptz not null default now(), resolved_by uuid references auth.users(id), resolved_at timestamptz,
 resolution_note text not null default '' check(length(resolution_note)<=2000), notes text not null default '' check(length(notes)<=2000), revision integer not null default 1,
 foreign key(campaign_id,area_id) references public.outreach_event_areas(campaign_id,id),
 foreign key(campaign_id,assigned_member_id) references public.outreach_team_members(campaign_id,id), unique(campaign_id,id),
 check((status='resolved' and resolved_at is not null and resolved_by is not null) or (status='open' and resolved_at is null and resolved_by is null))
);
create index outreach_event_issues_open_idx on public.outreach_event_issues(campaign_id,status,severity,opened_at);
create table public.outreach_event_timeline (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id), template_item_id uuid,
 item_key text not null check(item_key~'^[a-z0-9_-]{1,80}$'), title text not null check(length(btrim(title)) between 1 and 160),
 display_order integer not null check(display_order between 1 and 10000), scheduled_at timestamptz, actual_start timestamptz, actual_finish timestamptz,
 owner_member_id uuid, status text not null default 'upcoming' check(status in ('upcoming','current','delayed','complete','skipped')),
 notes text not null default '' check(length(notes)<=2000), issue_flag boolean not null default false, revision integer not null default 1,
 foreign key(campaign_id,owner_member_id) references public.outreach_team_members(campaign_id,id), unique(campaign_id,item_key), unique(campaign_id,id),
 check(actual_finish is null or actual_start is not null), check(actual_finish is null or actual_finish>=actual_start)
);
create index outreach_event_timeline_order_idx on public.outreach_event_timeline(campaign_id,display_order);
create table public.outreach_event_media_refs (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, area_id uuid, kind text not null check(kind in ('photo','video','testimony','document')),
 label text not null check(length(btrim(label)) between 1 and 160), reference_url text check(reference_url is null or (length(reference_url)<=2000 and reference_url~'^https://[^/@[:space:]]+(/[^[:cntrl:][:space:]]*)?$')),
 storage_reference text check(storage_reference is null or (length(storage_reference)<=500 and storage_reference~'^[a-zA-Z0-9/_+.-]+$')),
 notes text not null default '' check(length(notes)<=1000), created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 foreign key(campaign_id,area_id) references public.outreach_event_areas(campaign_id,id), unique(campaign_id,id),
 check(reference_url is not null or storage_reference is not null)
);
create table public.outreach_event_ops_history (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id), area_id uuid,
 actor_user_id uuid references auth.users(id), kind text not null check(length(btrim(kind)) between 1 and 100), subject_id uuid,
 snapshot jsonb not null default '{}' check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=10000), created_at timestamptz not null default now(),
 foreign key(campaign_id,area_id) references public.outreach_event_areas(campaign_id,id)
);
create index outreach_event_ops_history_idx on public.outreach_event_ops_history(campaign_id,created_at,id);

create function private.outreach_ops_template_guard() returns trigger language plpgsql set search_path='' as $$
declare s text;begin
 if tg_table_name='outreach_ops_templates' then s:=old.status;else select status into s from public.outreach_ops_templates where id=old.template_id;end if;
 if s='published' then raise exception 'Published event template is immutable' using errcode='42501';end if;return case when tg_op='DELETE' then old else new end;
end $$;
create trigger outreach_ops_template_immutable before update or delete on public.outreach_ops_templates for each row execute function private.outreach_ops_template_guard();
create trigger outreach_ops_template_area_immutable before update or delete on public.outreach_ops_template_areas for each row execute function private.outreach_ops_template_guard();
create trigger outreach_ops_template_checklist_immutable before update or delete on public.outreach_ops_template_checklists for each row execute function private.outreach_ops_template_guard();
create trigger outreach_ops_template_inventory_immutable before update or delete on public.outreach_ops_template_inventory for each row execute function private.outreach_ops_template_guard();
create trigger outreach_ops_template_timeline_immutable before update or delete on public.outreach_ops_template_timeline for each row execute function private.outreach_ops_template_guard();
create trigger outreach_event_ops_history_immutable before update or delete on public.outreach_event_ops_history for each row execute function private.outreach_immutable();

create function private.outreach_ops_can(c uuid,cap text) returns boolean language sql stable security definer set search_path='' as $$
 select cap in ('ops.view','ops.manage','inventory.view','inventory.manage','issue.manage') and private.outreach_verified(auth.uid()) and exists(
  select 1 from public.outreach_campaigns x where x.id=c and (
   private.outreach_admin(x.organization_id,cap not in ('ops.view','inventory.view')) or exists(
    select 1 from public.outreach_campaign_assignments a where a.campaign_id=c and a.user_id=auth.uid() and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and 'view'=any(a.capabilities) and cap=any(a.capabilities))))
$$;
create function private.outreach_ops_record(c uuid,a uuid,k text,s uuid,j jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
declare org uuid;begin select organization_id into org from public.outreach_campaigns where id=c;
 insert into public.outreach_event_ops_history(campaign_id,area_id,actor_user_id,kind,subject_id,snapshot) values(c,a,auth.uid(),k,s,j);
 perform private.outreach_audit(c,org,'ops.'||k,s,j);end $$;
create function private.outreach_ops_transition_ok(o text,n text) returns boolean language sql immutable set search_path='' as $$
 select o=n or (o,n) in (('not_started','setup_in_progress'),('not_started','issue'),('not_started','paused'),('setup_in_progress','ready'),('setup_in_progress','issue'),('setup_in_progress','paused'),('ready','active'),('ready','setup_in_progress'),('ready','issue'),('ready','paused'),('active','issue'),('active','paused'),('active','closed'),('issue','setup_in_progress'),('issue','ready'),('issue','active'),('issue','paused'),('issue','closed'),('paused','setup_in_progress'),('paused','ready'),('paused','active'),('paused','issue'),('paused','closed'),('closed','cleanup_in_progress'),('closed','issue'),('cleanup_in_progress','complete'),('cleanup_in_progress','issue'),('complete','cleanup_in_progress'))
$$;

create function private.outreach_ops_summary(c uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'overall_readiness',coalesce((select round(avg(case when total_required=0 then case when status in ('ready','active','closed','cleanup_in_progress','complete') then 100 else 0 end else completed_required*100.0/total_required end))::int from (select a.id,a.status,count(i.id) filter(where i.required) total_required,count(i.id) filter(where i.required and i.completed) completed_required from public.outreach_event_areas a left join public.outreach_event_checklist_items i on i.area_id=a.id where a.campaign_id=c and a.active and a.required_for_ready group by a.id) q),0),
  'areas_total',(select count(*) from public.outreach_event_areas where campaign_id=c and active),
  'areas_ready',(select count(*) from public.outreach_event_areas where campaign_id=c and active and status in ('ready','active','closed','cleanup_in_progress','complete')),
  'areas_with_issues',(select count(*) from public.outreach_event_areas where campaign_id=c and active and issue_flag),
  'checklist_total',(select count(*) from public.outreach_event_checklist_items where campaign_id=c),
  'checklist_complete',(select count(*) from public.outreach_event_checklist_items where campaign_id=c and completed),
  'volunteers_assigned',(select count(*) from public.outreach_event_area_members where campaign_id=c and active),
  'missing_leads',(select count(*) from public.outreach_event_areas a where a.campaign_id=c and a.active and not exists(select 1 from public.outreach_event_area_members m where m.area_id=a.id and m.active and m.role='lead')),
  'inventory_issues',(select count(*) from public.outreach_event_inventory where campaign_id=c and (status in ('missing','damaged') or available_quantity<required_quantity)),
  'open_alerts',(select count(*) from public.outreach_event_issues where campaign_id=c and status='open'),
  'current_stage',(select title from public.outreach_event_timeline where campaign_id=c and status in ('current','delayed') order by display_order limit 1),
  'registration_count',(select count(*) from public.outreach_event_registrations where campaign_id=c and status<>'cancelled'),
  'checkin_count',(select count(*) from public.outreach_event_attendees where campaign_id=c and checked_in_at is not null),
  'prize_ready',coalesce((select digital_enabled and drawing_enabled from public.outreach_prize_settings where campaign_id=c),false),
  'prize_pools',(select count(*) from public.outreach_prize_pools where campaign_id=c and active)
 )
$$;

create function private.outreach_ops_context(c uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'campaign',jsonb_build_object('id',x.id,'name',x.name,'code',x.code,'city',x.city,'country',x.country,'event_start',x.event_start,'timezone',x.timezone),
  'organization',jsonb_build_object('name',o.name,'slug',o.slug,'logo_asset',case o.slug when 'champion-life' then 'assets/images/logo-gold.png' when 'sowgo' then 'assets/images/sowgo-logo-light.png' else null end),
  'operation',to_jsonb(op),'summary',private.outreach_ops_summary(c),
  'capabilities',(select coalesce(jsonb_agg(k),'[]') from unnest(array['ops.view','ops.manage','inventory.view','inventory.manage','issue.manage']) k where private.outreach_ops_can(c,k)),
  'areas',(select coalesce(jsonb_agg(q.v order by q.display_order,q.title),'[]') from (select a.display_order,a.title,jsonb_build_object('id',a.id,'area_key',a.area_key,'instance_key',a.instance_key,'title',a.title,'description',a.description,'category',a.category,'display_order',a.display_order,'required_for_ready',a.required_for_ready,'status',a.status,'location',a.location,'notes',a.notes,'issue_flag',a.issue_flag,'revision',a.revision,'readiness',case when count(i.id) filter(where i.required)=0 then case when a.status in ('ready','active','closed','cleanup_in_progress','complete') then 100 else 0 end else round((count(i.id) filter(where i.required and i.completed))*100.0/(count(i.id) filter(where i.required)))::int end,'required_missing',count(i.id) filter(where i.required and not i.completed),'issues',(select count(*) from public.outreach_event_issues z where z.area_id=a.id and z.status='open'),'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'member_id',m.member_id,'name',tm.first_name||' '||tm.last_name,'role',m.role,'arrival_status',m.arrival_status,'notes',m.notes) order by case m.role when 'lead' then 1 when 'backup_lead' then 2 else 3 end,tm.first_name),'[]') from public.outreach_event_area_members m join public.outreach_team_members tm on tm.id=m.member_id where m.area_id=a.id and m.active)) v from public.outreach_event_areas a left join public.outreach_event_checklist_items i on i.area_id=a.id where a.campaign_id=c and a.active group by a.id) q),
  'checklists',(select coalesce(jsonb_agg(to_jsonb(i) order by a.display_order,i.display_order),'[]') from public.outreach_event_checklist_items i join public.outreach_event_areas a on a.id=i.area_id where i.campaign_id=c),
  'inventory',case when private.outreach_ops_can(c,'inventory.view') then (select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('area_title',a.title,'vehicle_label',v.label) order by i.category,i.item_name),'[]') from public.outreach_event_inventory i left join public.outreach_event_areas a on a.id=i.area_id left join public.outreach_team_vehicles v on v.id=i.vehicle_id where i.campaign_id=c) else '[]'::jsonb end,
  'issues',(select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('area_title',a.title,'assigned_name',m.first_name||' '||m.last_name) order by case i.status when 'open' then 0 else 1 end,case i.severity when 'urgent' then 0 when 'needs_attention' then 1 else 2 end,i.opened_at desc),'[]') from public.outreach_event_issues i left join public.outreach_event_areas a on a.id=i.area_id left join public.outreach_team_members m on m.id=i.assigned_member_id where i.campaign_id=c),
  'timeline',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('owner_name',m.first_name||' '||m.last_name) order by t.display_order),'[]') from public.outreach_event_timeline t left join public.outreach_team_members m on m.id=t.owner_member_id where t.campaign_id=c),
  'media',(select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc),'[]') from public.outreach_event_media_refs m where m.campaign_id=c),
  'team_members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.first_name||' '||m.last_name,'status',m.status) order by m.first_name,m.last_name),'[]') from public.outreach_team_members m where m.campaign_id=c and m.attending and m.volunteering and m.status in ('approved','self_traveling','guest')),
  'vehicles',case when private.outreach_ops_can(c,'inventory.view') then (select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'label',v.label,'vehicle_type',v.vehicle_type) order by v.label),'[]') from public.outreach_team_vehicles v where v.campaign_id=c and v.active) else '[]'::jsonb end,
  'templates',case when private.outreach_ops_can(c,'ops.manage') then (select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'version',t.version,'description',t.description) order by t.name,t.version desc),'[]') from public.outreach_ops_templates t where t.status='published' and (t.owner_organization_id is null or t.owner_organization_id=x.organization_id)) else '[]'::jsonb end
 ) from public.outreach_campaigns x join public.organizations o on o.id=x.organization_id left join public.outreach_event_operations op on op.campaign_id=x.id where x.id=c
$$;

create function private.outreach_ops_workspace(action text,c uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare x public.outreach_campaigns;op public.outreach_event_operations;area_row public.outreach_event_areas;check_row public.outreach_event_checklist_items;inv public.outreach_event_inventory;issue_row public.outreach_event_issues;timeline_row public.outreach_event_timeline;tmpl public.outreach_ops_templates;cap text;result_id uuid;csv text;begin
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>50000 then raise exception 'Invalid request';end if;
 cap:=case when action in ('context','campaigns','area') then 'ops.view' when action in ('inventory_save','inventory_count') then 'inventory.manage' when action='export' then 'ops.manage' when action in ('issue_save','issue_resolve') then 'issue.manage' else 'ops.manage' end;
 if action='campaigns' then return coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'name',q.name,'city',q.city,'event_start',q.event_start)) from public.outreach_campaigns q where private.outreach_ops_can(q.id,'ops.view')),'[]');end if;
 if not private.outreach_ops_can(c,cap) then raise exception 'Event day access denied' using errcode='42501';end if;
 select * into x from public.outreach_campaigns where id=c;if not found then raise exception 'Campaign unavailable' using errcode='42501';end if;
 if action='context' then return private.outreach_ops_context(c);end if;
 perform pg_advisory_xact_lock(hashtextextended(c::text,20261007));
 if not private.outreach_ops_can(c,cap) then raise exception 'Event day access denied' using errcode='42501';end if;
 if action='template_clone' then
  select * into tmpl from public.outreach_ops_templates where id=(p->>'template_id')::uuid and status='published' and (owner_organization_id is null or owner_organization_id=x.organization_id);if not found then raise exception 'Published template unavailable' using errcode='42501';end if;
  insert into public.outreach_ops_templates(owner_organization_id,name,version,status,description,created_by) values(x.organization_id,coalesce(nullif(p->>'name',''),tmpl.name),coalesce((select max(version)+1 from public.outreach_ops_templates where owner_organization_id=x.organization_id and name=coalesce(nullif(p->>'name',''),tmpl.name)),1),'draft',tmpl.description,auth.uid()) returning outreach_ops_templates.id into result_id;
  insert into public.outreach_ops_template_areas(template_id,area_key,title,description,category,display_order,required_for_ready,repeatable,active) select result_id,area_key,title,description,category,display_order,required_for_ready,repeatable,active from public.outreach_ops_template_areas where template_id=tmpl.id;
  insert into public.outreach_ops_template_checklists(template_id,area_key,item_key,text,display_order,required,quantity_kind,dependency_key,attachment_hook) select result_id,area_key,item_key,text,display_order,required,quantity_kind,dependency_key,attachment_hook from public.outreach_ops_template_checklists where template_id=tmpl.id;
  insert into public.outreach_ops_template_inventory(template_id,area_key,item_key,item_name,category,required_quantity,critical,return_required,source_owner) select result_id,area_key,item_key,item_name,category,required_quantity,critical,return_required,source_owner from public.outreach_ops_template_inventory where template_id=tmpl.id;
  insert into public.outreach_ops_template_timeline(template_id,item_key,title,display_order,relative_minutes,required,notes) select result_id,item_key,title,display_order,relative_minutes,required,notes from public.outreach_ops_template_timeline where template_id=tmpl.id;
  perform private.outreach_ops_record(c,null,'template_cloned',result_id,jsonb_build_object('source',tmpl.id));return jsonb_build_object('id',result_id);
 elsif action='template_area_save' then
  select * into tmpl from public.outreach_ops_templates where id=(p->>'template_id')::uuid and owner_organization_id=x.organization_id and status='draft';if not found then raise exception 'Editable template unavailable' using errcode='42501';end if;
  insert into public.outreach_ops_template_areas(template_id,area_key,title,description,category,display_order,required_for_ready,repeatable,active) values(tmpl.id,p->>'area_key',p->>'title',coalesce(p->>'description',''),p->>'category',(p->>'display_order')::int,coalesce((p->>'required_for_ready')::boolean,false),coalesce((p->>'repeatable')::boolean,false),coalesce((p->>'active')::boolean,true)) on conflict(template_id,area_key) do update set title=excluded.title,description=excluded.description,category=excluded.category,display_order=excluded.display_order,required_for_ready=excluded.required_for_ready,repeatable=excluded.repeatable,active=excluded.active returning id into result_id;return jsonb_build_object('id',result_id);
 elsif action='template_checklist_save' then
  select * into tmpl from public.outreach_ops_templates where id=(p->>'template_id')::uuid and owner_organization_id=x.organization_id and status='draft';if not found then raise exception 'Editable template unavailable' using errcode='42501';end if;
  insert into public.outreach_ops_template_checklists(template_id,area_key,item_key,text,display_order,required,quantity_kind,dependency_key,attachment_hook) values(tmpl.id,p->>'area_key',p->>'item_key',p->>'text',(p->>'display_order')::int,coalesce((p->>'required')::boolean,true),coalesce(p->>'quantity_kind','none'),p->>'dependency_key',coalesce((p->>'attachment_hook')::boolean,false)) on conflict(template_id,area_key,item_key) do update set text=excluded.text,display_order=excluded.display_order,required=excluded.required,quantity_kind=excluded.quantity_kind,dependency_key=excluded.dependency_key,attachment_hook=excluded.attachment_hook returning id into result_id;return jsonb_build_object('id',result_id);
 elsif action='template_inventory_save' then
  select * into tmpl from public.outreach_ops_templates where id=(p->>'template_id')::uuid and owner_organization_id=x.organization_id and status='draft';if not found then raise exception 'Editable template unavailable' using errcode='42501';end if;
  insert into public.outreach_ops_template_inventory(template_id,area_key,item_key,item_name,category,required_quantity,critical,return_required,source_owner) values(tmpl.id,p->>'area_key',p->>'item_key',p->>'item_name',p->>'category',coalesce((p->>'required_quantity')::int,0),coalesce((p->>'critical')::boolean,false),coalesce((p->>'return_required')::boolean,true),coalesce(p->>'source_owner','')) on conflict(template_id,area_key,item_key) do update set item_name=excluded.item_name,category=excluded.category,required_quantity=excluded.required_quantity,critical=excluded.critical,return_required=excluded.return_required,source_owner=excluded.source_owner returning id into result_id;return jsonb_build_object('id',result_id);
 elsif action='template_timeline_save' then
  select * into tmpl from public.outreach_ops_templates where id=(p->>'template_id')::uuid and owner_organization_id=x.organization_id and status='draft';if not found then raise exception 'Editable template unavailable' using errcode='42501';end if;
  insert into public.outreach_ops_template_timeline(template_id,item_key,title,display_order,relative_minutes,required,notes) values(tmpl.id,p->>'item_key',p->>'title',(p->>'display_order')::int,(p->>'relative_minutes')::int,coalesce((p->>'required')::boolean,false),coalesce(p->>'notes','')) on conflict(template_id,item_key) do update set title=excluded.title,display_order=excluded.display_order,relative_minutes=excluded.relative_minutes,required=excluded.required,notes=excluded.notes returning id into result_id;return jsonb_build_object('id',result_id);
 elsif action='template_publish' then
  select * into tmpl from public.outreach_ops_templates where id=(p->>'template_id')::uuid and owner_organization_id=x.organization_id and status='draft' for update;if not found or not exists(select 1 from public.outreach_ops_template_areas where template_id=tmpl.id and active) then raise exception 'Publishable template unavailable';end if;
  update public.outreach_ops_templates set status='published',published_at=clock_timestamp() where id=tmpl.id;perform private.outreach_ops_record(c,null,'template_published',tmpl.id,jsonb_build_object('version',tmpl.version));return jsonb_build_object('id',tmpl.id,'published',true);
 elsif action='instantiate' then
  if exists(select 1 from public.outreach_event_operations where campaign_id=c) then raise exception 'Event operations already instantiated';end if;
  select * into tmpl from public.outreach_ops_templates where id=(p->>'template_id')::uuid and status='published' and (owner_organization_id is null or owner_organization_id=x.organization_id);if not found then raise exception 'Published template unavailable' using errcode='42501';end if;
  insert into public.outreach_event_operations(campaign_id,template_id,template_version,updated_by) values(c,tmpl.id,tmpl.version,auth.uid());
  insert into public.outreach_event_areas(campaign_id,template_area_id,area_key,instance_key,title,description,category,display_order,required_for_ready)
   select c,a.id,a.area_key,a.area_key,a.title,a.description,a.category,a.display_order,a.required_for_ready from public.outreach_ops_template_areas a where a.template_id=tmpl.id and a.active;
  insert into public.outreach_event_checklist_items(campaign_id,area_id,template_item_id,item_key,text,display_order,required,quantity_kind,dependency_key,attachment_hook)
   select c,a.id,i.id,i.item_key,i.text,i.display_order,i.required,i.quantity_kind,i.dependency_key,i.attachment_hook from public.outreach_ops_template_checklists i join public.outreach_event_areas a on a.campaign_id=c and a.area_key=i.area_key where i.template_id=tmpl.id;
  insert into public.outreach_event_inventory(campaign_id,area_id,template_item_id,item_key,item_name,category,required_quantity,critical,return_required,source_owner)
   select c,a.id,i.id,a.instance_key||'-'||i.item_key,i.item_name,i.category,i.required_quantity,i.critical,i.return_required,i.source_owner from public.outreach_ops_template_inventory i join public.outreach_event_areas a on a.campaign_id=c and a.area_key=i.area_key where i.template_id=tmpl.id;
  insert into public.outreach_event_timeline(campaign_id,template_item_id,item_key,title,display_order,scheduled_at,notes)
   select c,i.id,i.item_key,i.title,i.display_order,case when x.event_start is null or i.relative_minutes is null then null else x.event_start+(i.relative_minutes||' minutes')::interval end,i.notes from public.outreach_ops_template_timeline i where i.template_id=tmpl.id;
  perform private.outreach_ops_record(c,null,'template_instantiated',c,jsonb_build_object('template_id',tmpl.id,'version',tmpl.version));return private.outreach_ops_context(c);
 elsif action='area_add' then
  if not (p->>'instance_key')~'^[a-z0-9_-]{1,80}$' then raise exception 'Invalid area key';end if;
  insert into public.outreach_event_areas(campaign_id,area_key,instance_key,title,description,category,display_order,required_for_ready,location,notes) values(c,coalesce(p->>'area_key',p->>'instance_key'),p->>'instance_key',p->>'title',coalesce(p->>'description',''),p->>'category',coalesce((p->>'display_order')::int,1000),coalesce((p->>'required_for_ready')::boolean,false),coalesce(p->>'location',''),coalesce(p->>'notes','')) returning * into area_row;
  perform private.outreach_ops_record(c,area_row.id,'area_created',area_row.id,to_jsonb(area_row));return to_jsonb(area_row);
 elsif action='area_status' then
  select * into area_row from public.outreach_event_areas where campaign_id=c and id=(p->>'area_id')::uuid for update;if not found then raise exception 'Area outside campaign' using errcode='42501';end if;
  if area_row.revision<>(p->>'revision')::int then raise exception 'Area changed';end if;if not private.outreach_ops_transition_ok(area_row.status,p->>'status') then raise exception 'Invalid area status transition';end if;
  update public.outreach_event_areas set status=p->>'status',location=coalesce(p->>'location',location),notes=coalesce(p->>'notes',notes),revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid(),setup_started_at=case when p->>'status'='setup_in_progress' then coalesce(setup_started_at,clock_timestamp()) else setup_started_at end,ready_at=case when p->>'status'='ready' then coalesce(ready_at,clock_timestamp()) else ready_at end,active_at=case when p->>'status'='active' then coalesce(active_at,clock_timestamp()) else active_at end,closed_at=case when p->>'status'='closed' then coalesce(closed_at,clock_timestamp()) else closed_at end,completed_at=case when p->>'status'='complete' then clock_timestamp() else completed_at end where id=area_row.id returning * into area_row;
  perform private.outreach_ops_record(c,area_row.id,'area_status_changed',area_row.id,jsonb_build_object('to',area_row.status,'revision',area_row.revision));return to_jsonb(area_row);
 elsif action='area_member_set' then
  if not exists(select 1 from public.outreach_event_areas where campaign_id=c and id=(p->>'area_id')::uuid) or not exists(select 1 from public.outreach_team_members where campaign_id=c and id=(p->>'member_id')::uuid and attending and volunteering and status in ('approved','self_traveling','guest')) then raise exception 'Area or volunteer outside campaign' using errcode='42501';end if;
  update public.outreach_event_area_members set active=false,released_at=clock_timestamp() where campaign_id=c and member_id=(p->>'member_id')::uuid and active;
  insert into public.outreach_event_area_members(campaign_id,area_id,member_id,role,arrival_status,notes,assigned_by) values(c,(p->>'area_id')::uuid,(p->>'member_id')::uuid,p->>'role',coalesce(p->>'arrival_status','assigned'),coalesce(p->>'notes',''),auth.uid()) returning id into result_id;
  perform private.outreach_ops_record(c,(p->>'area_id')::uuid,'volunteer_assigned',result_id,p);return jsonb_build_object('id',result_id);
 elsif action='area_member_status' then
  update public.outreach_event_area_members set arrival_status=p->>'arrival_status',notes=coalesce(p->>'notes',notes) where campaign_id=c and id=(p->>'id')::uuid and active returning area_id into result_id;if not found then raise exception 'Assignment outside campaign' using errcode='42501';end if;
  perform private.outreach_ops_record(c,result_id,'volunteer_arrival_changed',(p->>'id')::uuid,p);return jsonb_build_object('saved',true);
 elsif action in ('checklist_complete','checklist_reopen') then
  select * into check_row from public.outreach_event_checklist_items where campaign_id=c and id=(p->>'item_id')::uuid for update;if not found then raise exception 'Checklist outside campaign' using errcode='42501';end if;
  if check_row.revision<>(p->>'revision')::int then if action='checklist_complete' and check_row.completed then return to_jsonb(check_row);else raise exception 'Checklist item changed';end if;end if;
  if action='checklist_complete' and check_row.dependency_key is not null and not exists(select 1 from public.outreach_event_checklist_items d where d.area_id=check_row.area_id and d.item_key=check_row.dependency_key and d.completed) then raise exception 'Checklist dependency incomplete';end if;
  update public.outreach_event_checklist_items set completed=action='checklist_complete',completed_by=case when action='checklist_complete' then auth.uid() else null end,completed_at=case when action='checklist_complete' then clock_timestamp() else null end,completion_note=coalesce(p->>'note',''),quantity_value=coalesce(p->>'quantity',''),issue_flag=coalesce((p->>'issue_flag')::boolean,false),revision=revision+1,updated_at=clock_timestamp() where id=check_row.id returning * into check_row;
  perform private.outreach_ops_record(c,check_row.area_id,case when action='checklist_complete' then 'checklist_completed' else 'checklist_reopened' end,check_row.id,jsonb_build_object('text',check_row.text,'quantity',check_row.quantity_value,'issue',check_row.issue_flag));return to_jsonb(check_row);
 elsif action='inventory_save' then
  if p->>'id' is null then
   if p->>'area_id' is not null and not exists(select 1 from public.outreach_event_areas where campaign_id=c and id=(p->>'area_id')::uuid) then raise exception 'Area outside campaign' using errcode='42501';end if;
   if p->>'vehicle_id' is not null and not exists(select 1 from public.outreach_team_vehicles where campaign_id=c and id=(p->>'vehicle_id')::uuid and active) then raise exception 'Vehicle outside campaign' using errcode='42501';end if;
   insert into public.outreach_event_inventory(campaign_id,area_id,item_key,item_name,category,required_quantity,available_quantity,direct_delivery,critical,return_required,source_owner,vehicle_id,status,notes,updated_by) values(c,(p->>'area_id')::uuid,p->>'item_key',p->>'item_name',p->>'category',coalesce((p->>'required_quantity')::int,0),coalesce((p->>'available_quantity')::int,0),coalesce((p->>'direct_delivery')::boolean,false),coalesce((p->>'critical')::boolean,false),coalesce((p->>'return_required')::boolean,true),coalesce(p->>'source_owner',''),(p->>'vehicle_id')::uuid,coalesce(p->>'status','needed'),coalesce(p->>'notes',''),auth.uid()) returning * into inv;
  else
   select * into inv from public.outreach_event_inventory where campaign_id=c and id=(p->>'id')::uuid for update;if not found then raise exception 'Inventory outside campaign' using errcode='42501';end if;if inv.revision<>(p->>'revision')::int then raise exception 'Inventory changed';end if;
   if p->>'vehicle_id' is not null and not exists(select 1 from public.outreach_team_vehicles where campaign_id=c and id=(p->>'vehicle_id')::uuid and active) then raise exception 'Vehicle outside campaign' using errcode='42501';end if;
   update public.outreach_event_inventory set area_id=coalesce((p->>'area_id')::uuid,area_id),required_quantity=coalesce((p->>'required_quantity')::int,required_quantity),available_quantity=coalesce((p->>'available_quantity')::int,available_quantity),loaded_quantity=coalesce((p->>'loaded_quantity')::int,loaded_quantity),on_site_quantity=coalesce((p->>'on_site_quantity')::int,on_site_quantity),returned_quantity=coalesce((p->>'returned_quantity')::int,returned_quantity),missing_quantity=coalesce((p->>'missing_quantity')::int,missing_quantity),damaged_quantity=coalesce((p->>'damaged_quantity')::int,damaged_quantity),direct_delivery=coalesce((p->>'direct_delivery')::boolean,direct_delivery),critical=coalesce((p->>'critical')::boolean,critical),return_required=coalesce((p->>'return_required')::boolean,return_required),source_owner=coalesce(p->>'source_owner',source_owner),vehicle_id=case when p?'vehicle_id' then (p->>'vehicle_id')::uuid else vehicle_id end,status=coalesce(p->>'status',status),notes=coalesce(p->>'notes',notes),verified_by=auth.uid(),verified_at=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid() where id=inv.id returning * into inv;
  end if;
  perform private.outreach_ops_record(c,inv.area_id,'inventory_changed',inv.id,to_jsonb(inv)-'notes');return to_jsonb(inv);
 elsif action='issue_save' then
  if p->>'area_id' is not null and not exists(select 1 from public.outreach_event_areas where campaign_id=c and id=(p->>'area_id')::uuid) then raise exception 'Area outside campaign' using errcode='42501';end if;
  if p->>'assigned_member_id' is not null and not exists(select 1 from public.outreach_team_members where campaign_id=c and id=(p->>'assigned_member_id')::uuid) then raise exception 'Assignee outside campaign' using errcode='42501';end if;
  insert into public.outreach_event_issues(campaign_id,area_id,severity,issue,assigned_member_id,opened_by,notes) values(c,(p->>'area_id')::uuid,p->>'severity',p->>'issue',(p->>'assigned_member_id')::uuid,auth.uid(),coalesce(p->>'notes','')) returning * into issue_row;
  if issue_row.area_id is not null then update public.outreach_event_areas set issue_flag=true,revision=revision+1,updated_at=clock_timestamp() where id=issue_row.area_id;end if;
  perform private.outreach_ops_record(c,issue_row.area_id,'issue_opened',issue_row.id,jsonb_build_object('severity',issue_row.severity,'issue',issue_row.issue));perform private.outreach_event(c,'outreach.ops.issue_opened',issue_row.id,'ops-issue:'||issue_row.id);return to_jsonb(issue_row);
 elsif action='issue_resolve' then
  select * into issue_row from public.outreach_event_issues where campaign_id=c and id=(p->>'issue_id')::uuid for update;if not found then raise exception 'Issue outside campaign' using errcode='42501';end if;if issue_row.status='resolved' then return to_jsonb(issue_row);end if;if issue_row.revision<>(p->>'revision')::int then raise exception 'Issue changed';end if;
  update public.outreach_event_issues set status='resolved',resolved_by=auth.uid(),resolved_at=clock_timestamp(),resolution_note=p->>'resolution_note',revision=revision+1 where id=issue_row.id returning * into issue_row;
  if issue_row.area_id is not null and not exists(select 1 from public.outreach_event_issues where area_id=issue_row.area_id and status='open') then update public.outreach_event_areas set issue_flag=false,revision=revision+1,updated_at=clock_timestamp() where id=issue_row.area_id;end if;
  perform private.outreach_ops_record(c,issue_row.area_id,'issue_resolved',issue_row.id,jsonb_build_object('resolution',issue_row.resolution_note));perform private.outreach_event(c,'outreach.ops.issue_resolved',issue_row.id,'ops-issue-resolved:'||issue_row.id);return to_jsonb(issue_row);
 elsif action='timeline_save' then
  select * into timeline_row from public.outreach_event_timeline where campaign_id=c and id=(p->>'id')::uuid for update;if not found then raise exception 'Timeline item outside campaign' using errcode='42501';end if;if timeline_row.revision<>(p->>'revision')::int then raise exception 'Timeline changed';end if;
  if p->>'owner_member_id' is not null and not exists(select 1 from public.outreach_team_members where campaign_id=c and id=(p->>'owner_member_id')::uuid) then raise exception 'Owner outside campaign' using errcode='42501';end if;
  update public.outreach_event_timeline set status=coalesce(p->>'status',status),scheduled_at=coalesce((p->>'scheduled_at')::timestamptz,scheduled_at),actual_start=case when p->>'status'='current' then coalesce(actual_start,clock_timestamp()) else actual_start end,actual_finish=case when p->>'status'='complete' then clock_timestamp() else actual_finish end,owner_member_id=case when p?'owner_member_id' then (p->>'owner_member_id')::uuid else owner_member_id end,notes=coalesce(p->>'notes',notes),issue_flag=coalesce((p->>'issue_flag')::boolean,issue_flag),revision=revision+1 where id=timeline_row.id returning * into timeline_row;
  perform private.outreach_ops_record(c,null,'timeline_changed',timeline_row.id,jsonb_build_object('title',timeline_row.title,'status',timeline_row.status));return to_jsonb(timeline_row);
 elsif action='media_add' then
  insert into public.outreach_event_media_refs(campaign_id,area_id,kind,label,reference_url,storage_reference,notes,created_by) values(c,(p->>'area_id')::uuid,p->>'kind',p->>'label',p->>'reference_url',p->>'storage_reference',coalesce(p->>'notes',''),auth.uid()) returning id into result_id;
  perform private.outreach_ops_record(c,(p->>'area_id')::uuid,'media_reference_added',result_id,jsonb_build_object('kind',p->>'kind','label',p->>'label'));return jsonb_build_object('id',result_id);
 elsif action='start' then
  update public.outreach_event_operations set status=case when status='planning' then 'setup' else 'active' end,started_at=coalesce(started_at,clock_timestamp()),revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid() where campaign_id=c returning * into op;if not found then raise exception 'Instantiate event operations first';end if;
  perform private.outreach_ops_record(c,null,'event_started',c,to_jsonb(op));return to_jsonb(op);
 elsif action='closeout' then
  select * into op from public.outreach_event_operations where campaign_id=c for update;if not found then raise exception 'Event operations unavailable';end if;
  if exists(select 1 from public.outreach_event_areas where campaign_id=c and active and required_for_ready and status<>'complete') then raise exception 'Required areas must be complete';end if;
  if exists(select 1 from public.outreach_event_checklist_items i join public.outreach_event_areas a on a.id=i.area_id where i.campaign_id=c and a.active and i.required and not i.completed) then raise exception 'Required checklist items remain';end if;
  if exists(select 1 from public.outreach_event_issues where campaign_id=c and status='open' and severity='urgent') then raise exception 'Urgent issues remain open';end if;
  if exists(select 1 from public.outreach_event_inventory where campaign_id=c and critical and (status in ('missing','damaged') or (return_required and returned_quantity<>on_site_quantity))) then raise exception 'Critical inventory is not accounted for';end if;
  update public.outreach_event_operations set status='event_complete',completed_at=clock_timestamp(),completion_note=p->>'note',revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid() where campaign_id=c returning * into op;
  perform private.outreach_ops_record(c,null,'event_completed',c,jsonb_build_object('note',op.completion_note));perform private.outreach_event(c,'outreach.ops.event_completed',c,'ops-event-completed:'||c);return to_jsonb(op);
 elsif action='export' then
  csv:='Section,Area,Item,Owner or Vehicle,Status,Required,Available,Loaded,On Site,Returned,Notes'||chr(13)||chr(10);
  select csv||coalesce(string_agg(line,chr(13)||chr(10)),'') into csv from (
   select 'Timeline,'||private.outreach_csv_cell('')||','||private.outreach_csv_cell(title)||','||private.outreach_csv_cell(coalesce((select first_name||' '||last_name from public.outreach_team_members where id=owner_member_id),''))||','||private.outreach_csv_cell(status)||',,,,,'||private.outreach_csv_cell(notes) line,display_order o from public.outreach_event_timeline where campaign_id=c
   union all select 'Area,'||private.outreach_csv_cell(title)||','||private.outreach_csv_cell('Readiness')||','||private.outreach_csv_cell(coalesce((select tm.first_name||' '||tm.last_name from public.outreach_event_area_members m join public.outreach_team_members tm on tm.id=m.member_id where m.area_id=a.id and m.active and m.role='lead'),''))||','||private.outreach_csv_cell(status)||',,,,,,'||private.outreach_csv_cell(notes),10000+display_order from public.outreach_event_areas a where campaign_id=c and active
   union all select 'Volunteer,'||private.outreach_csv_cell(a.title)||','||private.outreach_csv_cell(replace(m.role,'_',' '))||','||private.outreach_csv_cell(tm.first_name||' '||tm.last_name)||','||private.outreach_csv_cell(m.arrival_status)||',,,,,,'||private.outreach_csv_cell(case when tm.phone is null then m.notes else 'Phone: '||tm.phone||case when m.notes='' then '' else ' · '||m.notes end end),15000+a.display_order*1000 from public.outreach_event_area_members m join public.outreach_event_areas a on a.id=m.area_id join public.outreach_team_members tm on tm.id=m.member_id where m.campaign_id=c and m.active
   union all select 'Emergency Contact,'||private.outreach_csv_cell(a.title)||','||private.outreach_csv_cell(replace(m.role,'_',' '))||','||private.outreach_csv_cell(tm.first_name||' '||tm.last_name)||','||private.outreach_csv_cell(m.arrival_status)||',,,,,,'||private.outreach_csv_cell(coalesce('Phone: '||tm.phone,'Phone unavailable')),18000+a.display_order*1000 from public.outreach_event_area_members m join public.outreach_event_areas a on a.id=m.area_id join public.outreach_team_members tm on tm.id=m.member_id where m.campaign_id=c and m.active and m.role in ('lead','backup_lead')
   union all select 'Checklist,'||private.outreach_csv_cell(a.title)||','||private.outreach_csv_cell(i.text)||','||private.outreach_csv_cell('')||','||private.outreach_csv_cell(case when i.completed then 'complete' else 'open' end)||','||private.outreach_csv_cell(case when i.required then 'yes' else 'no' end)||',,,,,'||private.outreach_csv_cell(i.completion_note),20000+a.display_order*1000+i.display_order from public.outreach_event_checklist_items i join public.outreach_event_areas a on a.id=i.area_id where i.campaign_id=c
   union all select 'Inventory,'||private.outreach_csv_cell(coalesce(a.title,''))||','||private.outreach_csv_cell(i.item_name)||','||private.outreach_csv_cell(coalesce(v.label,i.source_owner))||','||private.outreach_csv_cell(i.status)||','||i.required_quantity||','||i.available_quantity||','||i.loaded_quantity||','||i.on_site_quantity||','||i.returned_quantity||','||private.outreach_csv_cell(i.notes),30000 from public.outreach_event_inventory i left join public.outreach_event_areas a on a.id=i.area_id left join public.outreach_team_vehicles v on v.id=i.vehicle_id where i.campaign_id=c
   union all select 'Issue,'||private.outreach_csv_cell(coalesce(a.title,''))||','||private.outreach_csv_cell(i.issue)||','||private.outreach_csv_cell(coalesce(m.first_name||' '||m.last_name,''))||','||private.outreach_csv_cell(i.status||' / '||i.severity)||',,,,,,'||private.outreach_csv_cell(coalesce(nullif(i.resolution_note,''),i.notes)),40000 from public.outreach_event_issues i left join public.outreach_event_areas a on a.id=i.area_id left join public.outreach_team_members m on m.id=i.assigned_member_id where i.campaign_id=c
  ) z;
  perform private.outreach_ops_record(c,null,'backup_exported',c,jsonb_build_object('format','csv'));return jsonb_build_object('csv',csv,'filename',x.code||'-event-day-backup.csv');
 else raise exception 'Unsupported event day action';end if;
end $$;

create function public.outreach_event_day_workspace(p_action text,p_campaign uuid default null,p_payload jsonb default '{}') returns jsonb language sql security definer set search_path='' as $$select private.outreach_ops_workspace(p_action,p_campaign,p_payload)$$;

-- The source production packet is captured as versioned template data, not schema.
insert into public.outreach_ops_templates(id,name,version,status,description,published_at) values('e0000000-0000-4000-8000-000000000001','SowGo / Champion Life Standard Outreach',1,'published','Reusable event-day template mapped from the approved Outreach Production Packet.',now());
insert into public.outreach_ops_template_areas(template_id,area_key,title,description,category,display_order,required_for_ready,repeatable) values
('e0000000-0000-4000-8000-000000000001','registration','Registration','Guest welcome, waiver, ticket, wristband and check-in readiness.','guest_services',10,true,false),
('e0000000-0000-4000-8000-000000000001','water_food','Water / Food Stations','Configurable water, food and replenishment stations.','hospitality',20,false,true),
('e0000000-0000-4000-8000-000000000001','first_aid','First Aid','Readiness only; no medical record storage.','safety',30,true,false),
('e0000000-0000-4000-8000-000000000001','inflatables','Inflatables','Units, power, safety and entrance/exit staffing.','activities',40,true,true),
('e0000000-0000-4000-8000-000000000001','face_paint','Face Painting','Guest activity setup, timing and cleanup.','activities',50,false,false),
('e0000000-0000-4000-8000-000000000001','games','Games','Campaign-configurable stage games and activities.','program',60,false,true),
('e0000000-0000-4000-8000-000000000001','sound_stage','Sound / Stage','Sound check, power, equipment and stage readiness.','program',70,true,false),
('e0000000-0000-4000-8000-000000000001','altar_care','Altar Care','Bible, follow-up and decision readiness using the existing campaign follow-up system.','ministry',80,true,false),
('e0000000-0000-4000-8000-000000000001','prize_area','Prize Area','Phase D operator, configured prizes and backup readiness.','prizes',90,false,false),
('e0000000-0000-4000-8000-000000000001','bike_area','Bike Area','Restricted zones, categories, inventory and reference materials.','prizes',100,false,false),
('e0000000-0000-4000-8000-000000000001','winners_circle','Winner''s Circle','Verification and handoff readiness using Phase D claims.','prizes',110,false,false),
('e0000000-0000-4000-8000-000000000001','cleanup','Cleanup','Site, equipment, inventory and final sign-off.','closeout',120,true,false),
('e0000000-0000-4000-8000-000000000001','photos_video','Photos / Video','Operational capture checklist and reference hooks only.','media',130,false,false);

insert into public.outreach_ops_template_checklists(template_id,area_key,item_key,text,display_order,required,quantity_kind,attachment_hook) values
('e0000000-0000-4000-8000-000000000001','registration','tables_chairs','Tables and chairs positioned',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','registration','tents_tote','Tents and registration tote ready',20,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','registration','line_team','Line attendants and registration workers assigned',30,true,'count',false),
('e0000000-0000-4000-8000-000000000001','registration','waiver_checkin','Waiver and check-in devices/process verified',40,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','registration','wristbands_tickets','Wristbands and ticket workflow available',50,true,'count',false),
('e0000000-0000-4000-8000-000000000001','water_food','station_setup','Station table, tent, cooler and trash ready',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','water_food','water_ice','Water, ice and cups stocked',20,true,'count',false),
('e0000000-0000-4000-8000-000000000001','water_food','replenishment','Replenishment owner confirmed',30,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','first_aid','location','Station location communicated',10,true,'text',false),
('e0000000-0000-4000-8000-000000000001','first_aid','supplies','First aid kit, cooler and snacks/juice verified',20,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','first_aid','staff','Lead and team assigned',30,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','inflatables','units_power','Units, blowers, generators, fuel and cords verified',10,true,'count',false),
('e0000000-0000-4000-8000-000000000001','inflatables','mats_safety','Foam mats and safety checklist complete',20,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','inflatables','entrance_exit','Entrance and exit staff assigned',30,true,'count',false),
('e0000000-0000-4000-8000-000000000001','inflatables','wristbands','Wristband requirement confirmed',40,false,'verification',false),
('e0000000-0000-4000-8000-000000000001','face_paint','setup','Tents, tables, chairs and kits ready',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','face_paint','staff_water','Staff and team water ready',20,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','face_paint','cleanup','Cleanup complete',30,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','games','activities','Activities, order and hosts confirmed',10,true,'text',false),
('e0000000-0000-4000-8000-000000000001','games','supplies','Game supplies and prize notes ready',20,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','sound_stage','power','Generator and power verified',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','sound_stage','sound_check','Sound check complete',20,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','sound_stage','stage_ready','Stage, chairs and team water ready',30,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','altar_care','tent_table','Tent, table and chairs ready',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','altar_care','ministry_supplies','Bibles, pens and clipboards ready',20,true,'count',false),
('e0000000-0000-4000-8000-000000000001','altar_care','followup','Existing decision/follow-up process and devices ready',30,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','prize_area','phase_d','Phase D configuration and operator readiness verified',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','prize_area','tablets_backup','Tablets, prize cards and backup roster ready',20,true,'count',false),
('e0000000-0000-4000-8000-000000000001','bike_area','restricted_zones','Restricted area and category zones marked',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','bike_area','inventory_twice','Bike inventory counted and reverified',20,true,'count',false),
('e0000000-0000-4000-8000-000000000001','bike_area','cards_labels','Category labels and prize cards ready',30,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','winners_circle','location_team','Location and team ready',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','winners_circle','verification','Ticket/number verification and Phase D handoff process ready',20,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','cleanup','equipment','Equipment and supplies packed',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','cleanup','inventory','Inventory exceptions recorded',20,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','cleanup','site','Trash collected, facilities checked and site clean',30,true,'verification',true),
('e0000000-0000-4000-8000-000000000001','cleanup','borrowed','Borrowed equipment returned',40,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','cleanup','signoff','Final area sign-off',50,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','photos_video','winner_photos','Prize winner photos captured',10,false,'count',true),
('e0000000-0000-4000-8000-000000000001','photos_video','group_photo','Volunteer group photo captured',20,false,'verification',true),
('e0000000-0000-4000-8000-000000000001','photos_video','event_video','Event video/reference recorded',30,false,'verification',true),
('e0000000-0000-4000-8000-000000000001','photos_video','testimonies','Testimony/media notes recorded',40,false,'text',true);

insert into public.outreach_ops_template_inventory(template_id,area_key,item_key,item_name,category,required_quantity,critical,return_required) values
('e0000000-0000-4000-8000-000000000001','registration','tables_8','8-foot tables','furniture',4,false,true),('e0000000-0000-4000-8000-000000000001','registration','table_6','6-foot table','furniture',1,false,true),('e0000000-0000-4000-8000-000000000001','registration','chairs','Chairs','furniture',16,false,true),('e0000000-0000-4000-8000-000000000001','registration','tents','Tents','shelter',4,true,true),('e0000000-0000-4000-8000-000000000001','registration','wristbands','Paper wristbands','registration',0,true,false),
('e0000000-0000-4000-8000-000000000001','water_food','tables','6-foot tables','furniture',3,false,true),('e0000000-0000-4000-8000-000000000001','water_food','tents','Tents','shelter',3,false,true),('e0000000-0000-4000-8000-000000000001','water_food','coolers','Orange coolers','hospitality',5,false,true),('e0000000-0000-4000-8000-000000000001','water_food','water','Water','consumable',0,true,false),('e0000000-0000-4000-8000-000000000001','water_food','ice','Ice','consumable',0,false,false),
('e0000000-0000-4000-8000-000000000001','first_aid','kit','First aid kit','safety',1,true,true),('e0000000-0000-4000-8000-000000000001','first_aid','red_tent','Red tent','shelter',1,true,true),('e0000000-0000-4000-8000-000000000001','first_aid','cooler','Red cooler','hospitality',1,false,true),
('e0000000-0000-4000-8000-000000000001','inflatables','units','Inflatable units','activities',0,true,true),('e0000000-0000-4000-8000-000000000001','inflatables','blowers','Blowers','power',0,true,true),('e0000000-0000-4000-8000-000000000001','inflatables','generators','Generators','power',0,true,true),('e0000000-0000-4000-8000-000000000001','inflatables','fuel','Generator fuel','consumable',0,true,false),
('e0000000-0000-4000-8000-000000000001','face_paint','kits','Face paint kits','activities',3,false,true),('e0000000-0000-4000-8000-000000000001','sound_stage','sound','Sound equipment','av',1,true,true),('e0000000-0000-4000-8000-000000000001','sound_stage','generator','Stage generator','power',1,true,true),
('e0000000-0000-4000-8000-000000000001','altar_care','bibles','Bibles','ministry',0,true,true),('e0000000-0000-4000-8000-000000000001','altar_care','devices','Follow-up forms or digital devices','ministry',0,true,true),
('e0000000-0000-4000-8000-000000000001','prize_area','tablets','Tablets','prizes',0,false,true),('e0000000-0000-4000-8000-000000000001','bike_area','bikes','Bikes','prizes',0,true,true),('e0000000-0000-4000-8000-000000000001','cleanup','trash_bags','Trash bags','cleanup',0,false,false);

insert into public.outreach_ops_template_timeline(template_id,item_key,title,display_order,relative_minutes,required) values
('e0000000-0000-4000-8000-000000000001','team_arrival','Team arrival',10,-180,true),('e0000000-0000-4000-8000-000000000001','setup','Setup',20,-150,true),('e0000000-0000-4000-8000-000000000001','registration','Registration opens',30,-60,true),('e0000000-0000-4000-8000-000000000001','activities','Inflatables / face paint / music',40,-60,false),('e0000000-0000-4000-8000-000000000001','games','Games',50,0,false),('e0000000-0000-4000-8000-000000000001','concert','Concert',60,45,false),('e0000000-0000-4000-8000-000000000001','message','Message',70,75,true),('e0000000-0000-4000-8000-000000000001','prayer','Prayer / altar call',80,100,true),('e0000000-0000-4000-8000-000000000001','prizes','Prizes',90,120,false),('e0000000-0000-4000-8000-000000000001','closing','Closing',100,180,true),('e0000000-0000-4000-8000-000000000001','cleanup','Cleanup',110,190,true);

do $$declare n text;begin foreach n in array array['outreach_ops_templates','outreach_ops_template_areas','outreach_ops_template_checklists','outreach_ops_template_inventory','outreach_ops_template_timeline','outreach_event_operations','outreach_event_areas','outreach_event_area_members','outreach_event_checklist_items','outreach_event_inventory','outreach_event_issues','outreach_event_timeline','outreach_event_media_refs','outreach_event_ops_history'] loop execute format('alter table public.%I enable row level security',n);execute format('revoke all on public.%I from public,anon,authenticated',n);end loop;end $$;
revoke all on function private.outreach_ops_template_guard(),private.outreach_ops_can(uuid,text),private.outreach_ops_record(uuid,uuid,text,uuid,jsonb),private.outreach_ops_transition_ok(text,text),private.outreach_ops_summary(uuid),private.outreach_ops_context(uuid),private.outreach_ops_workspace(text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.outreach_event_day_workspace(text,uuid,jsonb) from public,anon;
grant execute on function public.outreach_event_day_workspace(text,uuid,jsonb) to authenticated;
