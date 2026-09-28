-- Extend existing tenant contacts and authority. No real staff/finance grants.
create table private.people (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now()
);
alter table private.people enable row level security;
revoke all on private.people from public,anon,authenticated;
grant all on private.people to service_role;
alter table public.organization_people add column human_id uuid references private.people(id);
-- No automatic identity matching across organizations.
insert into private.people(id) select id from public.organization_people;
alter table public.organization_people disable trigger guard_person_write;
alter table public.organization_people disable trigger audit_person_write;
update public.organization_people set human_id=id;
alter table public.organization_people enable trigger guard_person_write;
alter table public.organization_people enable trigger audit_person_write;
alter table public.organization_people alter column human_id set not null;
create index organization_people_human_idx on public.organization_people(human_id);
create function private.person_anchor() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' and new.human_id is null then insert into private.people default values returning id into new.human_id; end if;
 if tg_op='UPDATE' and new.human_id is distinct from old.human_id then raise exception 'Identity reconciliation requires trusted review' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function private.person_anchor() from public,anon,authenticated;
create trigger person_anchor before insert or update on public.organization_people for each row execute function private.person_anchor();

create table public.person_organization_relationships (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, person_id uuid not null,
 relationship text not null check(relationship in ('guest','attendee','member','volunteer','partner','outreach_participant','parent_guardian','youth_student','staff')),
 effective_at timestamptz not null default now(), expires_at timestamptz, active boolean not null default true,
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),
 check(expires_at is null or expires_at>effective_at)
);
create index person_relationship_lookup on public.person_organization_relationships(organization_id,person_id,relationship);
create table public.person_department_affiliations (
 organization_id uuid not null, person_id uuid not null, department_id uuid not null,
 active boolean not null default true, effective_at timestamptz not null default now(), expires_at timestamptz,
 primary key(organization_id,person_id,department_id),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),
 foreign key(organization_id,department_id) references public.organization_departments(organization_id,id),
 check(expires_at is null or expires_at>effective_at)
);
create index person_department_scope_idx on public.person_department_affiliations(organization_id,department_id,person_id);
create table public.staff_role_templates (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 name text not null check(length(btrim(name)) between 1 and 100), permissions text[] not null default '{}',
 active boolean not null default true, revision integer not null default 1, unique(organization_id,id), unique(organization_id,name)
);
alter table public.organization_staff_directory add column person_id uuid;
alter table public.organization_staff_directory add column active boolean not null default true;
alter table public.organization_staff_directory add column effective_at timestamptz not null default now();
alter table public.organization_staff_directory add column expires_at timestamptz;
alter table public.organization_staff_directory add column reason text not null default '' check(length(reason)<=500);
alter table public.organization_staff_directory add constraint staff_assignment_person_fk foreign key(organization_id,person_id) references public.organization_people(organization_id,id);
alter table public.organization_staff_directory add constraint staff_assignment_dates check(expires_at is null or expires_at>effective_at);
create unique index staff_assignment_person_unique on public.organization_staff_directory(organization_id,person_id);
-- Preserve previously explicit authority as assignments; never infer from membership.
insert into public.organization_staff_directory(organization_id,user_id,display_name)
 select distinct organization_id,user_id,'Existing staff' from public.organization_staff_permissions where revoked_at is null
 on conflict(organization_id,user_id) do nothing;
update public.organization_staff_directory d set person_id=l.person_id from public.portal_account_links l where l.organization_id=d.organization_id and l.user_id=d.user_id and l.active;
alter table public.organization_staff_permissions add column department_ids uuid[];
alter table public.organization_staff_permissions add column effective_at timestamptz not null default now();
alter table public.organization_staff_permissions add column expires_at timestamptz;
alter table public.organization_staff_permissions add column template_id uuid;
alter table public.organization_staff_permissions add constraint staff_grant_dates check(expires_at is null or expires_at>effective_at);
alter table public.organization_staff_permissions add constraint staff_grant_scope check(department_ids is null or (cardinality(department_ids)>0 and array_position(department_ids,null) is null));
alter table public.organization_staff_permissions add constraint staff_grant_template_fk foreign key(organization_id,template_id) references public.staff_role_templates(organization_id,id);
alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;
alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check(permission in (
 'people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage','staff.view','staff.manage',
 'finance.read','finance.configure','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage',
 'events.view','events.manage','registrations.view','registrations.manage','outreach.view','outreach.manage','courses.manage','forms.view','forms.manage','communications.send'));
alter table public.organization_admin_events drop constraint organization_admin_events_kind_check;
alter table public.organization_admin_events add constraint organization_admin_events_kind_check check(kind in ('staff_access','person_created','person_updated','person_relationship','department_affiliation','role_template'));

create function private.staff_assignment_active(p_org uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_staff_directory d join auth.users u on u.id=d.user_id
 where d.organization_id=p_org and d.user_id=p_user and d.active and d.effective_at<=now() and (d.expires_at is null or d.expires_at>now())
 and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 and (d.person_id is null or exists(select 1 from public.portal_account_links l where l.organization_id=d.organization_id and l.person_id=d.person_id and l.user_id=d.user_id and l.active)))
$$;
-- Internal owner-only read projection: legacy modules must never interpret a
-- department grant as organization-wide. No browser view privileges.
create view private.effective_staff_permissions with (security_invoker=true) as
 select p.* from public.organization_staff_permissions p where p.revoked_at is null and p.department_ids is null
 and p.effective_at<=now() and (p.expires_at is null or p.expires_at>now()) and private.staff_assignment_active(p.organization_id,p.user_id);
revoke all on private.effective_staff_permissions from public,anon,authenticated;
-- Update existing privileged read paths, retaining their original guard logic and
-- writes. This is bounded to the historical private functions, before v1 creation.
do $$declare f record; definition text; begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.prokind='f' and p.proname<>'staff_assignment_active' loop
  definition:=pg_get_functiondef(f.oid);
  if definition ~* 'from public.organization_staff_permissions' then
   definition:=regexp_replace(definition,'from public\.organization_staff_permissions','from private.effective_staff_permissions','gi');
   execute definition;
  end if;
 end loop;
end $$;
create function private.has_staff_permission(p_org uuid,p_key text,p_department uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.staff_assignment_active(p_org,auth.uid()) and exists(
 select 1 from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=auth.uid() and g.permission=p_key
 and g.revoked_at is null and g.effective_at<=now() and (g.expires_at is null or g.expires_at>now())
 and (g.department_ids is null or (p_department is not null and p_department=any(g.department_ids) and exists(select 1 from public.organization_departments d where d.organization_id=p_org and d.id=p_department and d.active))))
$$;
create function private.person_permission(p_org uuid,p_person uuid,p_key text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_people p where p.organization_id=p_org and p.id=p_person) and
 (private.has_staff_permission(p_org,p_key) or exists(select 1 from public.person_department_affiliations a where a.organization_id=p_org and a.person_id=p_person and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and private.has_staff_permission(p_org,p_key,a.department_id)))
$$;
revoke all on function private.staff_assignment_active(uuid,uuid),private.has_staff_permission(uuid,text,uuid),private.person_permission(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.staff_assignment_active(uuid,uuid),private.has_staff_permission(uuid,text,uuid),private.person_permission(uuid,uuid,text) to authenticated;
-- Existing RLS subqueries read only effective organization-wide permissions.
alter policy staff_permissions_read_own on public.organization_staff_permissions using(user_id=(select auth.uid()) and revoked_at is null and department_ids is null and effective_at<=now() and (expires_at is null or expires_at>now()) and private.staff_assignment_active(organization_id,(select auth.uid())));
-- People row checks additionally admit correctly scoped staff, preserving self read.
alter policy organization_people_read on public.organization_people using(user_id=(select auth.uid()) or private.person_permission(organization_id,id,'people.read'));
alter policy organization_people_update on public.organization_people using(private.person_permission(organization_id,id,'people.read') and private.person_permission(organization_id,id,'people.update')) with check(private.person_permission(organization_id,id,'people.read') and private.person_permission(organization_id,id,'people.update'));
create or replace function private.guard_person_write() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  if not(private.has_staff_permission(new.organization_id,'people.read') and private.has_staff_permission(new.organization_id,'people.create')) then raise exception 'Access denied' using errcode='42501'; end if;
 else
  if not(private.person_permission(old.organization_id,old.id,'people.read') and private.person_permission(old.organization_id,old.id,'people.update')) then raise exception 'Access denied' using errcode='42501'; end if;
  if new.organization_id<>old.organization_id or new.user_id is distinct from old.user_id or new.id<>old.id then raise exception 'Identity cannot change' using errcode='42501'; end if;
 end if;
 new.first_name:=btrim(new.first_name);new.last_name:=btrim(new.last_name);new.updated_at:=clock_timestamp();return new;
end $$;
-- Scoped read of operational contact history, staff audit remains separately gated.
alter policy org_admin_events_read on public.organization_admin_events using(
 case when kind in ('staff_access','role_template') then private.has_staff_permission(organization_id,'staff.view') or private.has_staff_permission(organization_id,'staff.manage')
 else private.person_permission(organization_id,subject_id,'people.read') end);

alter table public.person_organization_relationships enable row level security;
alter table public.person_department_affiliations enable row level security;
alter table public.staff_role_templates enable row level security;
revoke all on public.person_organization_relationships,public.person_department_affiliations,public.staff_role_templates from public,anon,authenticated;
grant all on public.person_organization_relationships,public.person_department_affiliations,public.staff_role_templates to service_role;
-- RPC-only tables intentionally have no client SELECT or mutation policy.
create function private.staff_permission_keys() returns text[] language sql immutable set search_path='' as $$
 select array['people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage','staff.view','staff.manage','finance.read','finance.configure','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage','events.view','events.manage','registrations.view','registrations.manage','outreach.view','outreach.manage','courses.manage','forms.view','forms.manage','communications.send']::text[]
$$;
revoke all on function private.staff_permission_keys() from public,anon,authenticated;
create function private.people_workspace(p_org uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); person uuid:=(p_payload->>'person_id')::uuid; target uuid; dept uuid; template uuid;
 contact public.organization_people; assignment public.organization_staff_directory;
 prior jsonb; result jsonb; item jsonb; grants_json jsonb; scopes uuid[]; key text; keys text[];
 starts timestamptz; ends timestamptz; actor_grant public.organization_staff_permissions;
 row_id uuid; changed integer; event_kind text; global_manager boolean;
begin
 if actor is null or not private.staff_assignment_active(p_org,actor) then raise exception 'Active verified staff assignment required' using errcode='42501'; end if;
 global_manager:=private.has_staff_permission(p_org,'staff.manage');
 if p_action='context' then
  select coalesce(jsonb_agg(to_jsonb(g)-'user_id'),'[]') into grants_json from public.organization_staff_permissions g
   where g.organization_id=p_org and g.user_id=actor and g.revoked_at is null and g.effective_at<=now() and (g.expires_at is null or g.expires_at>now());
  return jsonb_build_object('grants',grants_json,'permission_keys',private.staff_permission_keys(),
   'departments',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name) order by d.name),'[]') from public.organization_departments d where d.organization_id=p_org and d.active and (private.has_staff_permission(p_org,'people.read',d.id) or private.has_staff_permission(p_org,'staff.manage',d.id) or private.has_staff_permission(p_org,'staff.view',d.id))),
   'templates',(select coalesce(jsonb_agg(to_jsonb(t) order by t.name),'[]') from public.staff_role_templates t where t.organization_id=p_org and t.active and (global_manager or private.has_staff_permission(p_org,'staff.view') or exists(select 1 from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=actor and g.permission='staff.manage' and g.revoked_at is null and g.effective_at<=now() and (g.expires_at is null or g.expires_at>now())))));
 elsif p_action='list' then
  if not exists(select 1 from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=actor and g.permission='people.read' and g.revoked_at is null and g.effective_at<=now() and (g.expires_at is null or g.expires_at>now())) then raise exception 'People read required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(row_data order by last_name,id),'[]') into result from (
   select p.id,p.last_name,jsonb_build_object('id',p.id,'first_name',p.first_name,'last_name',p.last_name,'email',p.email,'phone',p.phone,'updated_at',p.updated_at,
    'relationships',(select coalesce(jsonb_agg(r.relationship),'[]') from public.person_organization_relationships r where r.organization_id=p_org and r.person_id=p.id and r.active and r.effective_at<=now() and (r.expires_at is null or r.expires_at>now())),
    'departments',(select coalesce(jsonb_agg(d.name),'[]') from public.person_department_affiliations a join public.organization_departments d on d.organization_id=a.organization_id and d.id=a.department_id where a.organization_id=p_org and a.person_id=p.id and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and d.active and private.has_staff_permission(p_org,'people.read',d.id)),
    'portal_active',exists(select 1 from public.portal_account_links l where l.organization_id=p_org and l.person_id=p.id and l.active),
    'staff_active',exists(select 1 from public.organization_staff_directory s where s.organization_id=p_org and s.person_id=p.id and private.staff_assignment_active(p_org,s.user_id))) as row_data
   from public.organization_people p where p.organization_id=p_org and private.person_permission(p_org,p.id,'people.read')
   and (coalesce(p_payload->>'search','')='' or position(lower(p_payload->>'search') in lower(concat_ws(' ',p.first_name,p.last_name,p.email,p.phone)))>0)
   and (coalesce(p_payload->>'relationship','')='' or exists(select 1 from public.person_organization_relationships r where r.organization_id=p_org and r.person_id=p.id and r.relationship=p_payload->>'relationship' and r.active and r.effective_at<=now() and (r.expires_at is null or r.expires_at>now())))
   and (coalesce(p_payload->>'department_id','')='' or exists(select 1 from public.person_department_affiliations a where a.organization_id=p_org and a.person_id=p.id and a.department_id=(p_payload->>'department_id')::uuid and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and private.has_staff_permission(p_org,'people.read',a.department_id)))
   and (coalesce(p_payload->>'portal','')='' or (p_payload->>'portal'='active')=exists(select 1 from public.portal_account_links l where l.organization_id=p_org and l.person_id=p.id and l.active))
   and (coalesce(p_payload->>'staff','')='' or (p_payload->>'staff'='active')=exists(select 1 from public.organization_staff_directory s where s.organization_id=p_org and s.person_id=p.id and private.staff_assignment_active(p_org,s.user_id)))
   and (coalesce(p_payload->>'course','')='' or (private.person_permission(p_org,p.id,'discipleship.read') and exists(select 1 from public.portal_account_links l join public.course_enrollments e on e.user_id=l.user_id where l.organization_id=p_org and l.person_id=p.id and l.active)))
   order by p.last_name,p.id limit 26 offset greatest(0,least(coalesce((p_payload->>'page')::integer,0),10000))*25
  ) q;
  return result;
 elsif p_action='template' then
  perform pg_advisory_xact_lock(hashtextextended(p_org::text,0));
  if not private.has_staff_permission(p_org,'staff.manage') then raise exception 'Organization staff manager required' using errcode='42501'; end if;
  select array_agg(value) into keys from jsonb_array_elements_text(p_payload->'permissions');
  keys:=coalesce(keys,'{}');
  if not(keys <@ private.staff_permission_keys()) or 'staff.manage'=any(keys) then raise exception 'Invalid template capabilities' using errcode='22023'; end if;
  foreach key in array keys loop if not private.has_staff_permission(p_org,key) then raise exception 'Cannot bundle unowned capability' using errcode='42501'; end if; end loop;
  template:=(p_payload->>'id')::uuid;
  if template is null then
   insert into public.staff_role_templates(organization_id,name,permissions) values(p_org,p_payload->>'name',keys) returning id into template;
  else
   select to_jsonb(t) into prior from public.staff_role_templates t where organization_id=p_org and id=template;
   update public.staff_role_templates set name=p_payload->>'name',permissions=keys,active=coalesce((p_payload->>'active')::boolean,true),revision=revision+1 where organization_id=p_org and id=template and revision=(p_payload->>'revision')::integer;
   if not found then raise exception 'Template changed; reload' using errcode='40001'; end if;
  end if;
  select to_jsonb(t) into result from public.staff_role_templates t where organization_id=p_org and id=template;
  insert into public.organization_admin_events(organization_id,actor_user_id,subject_id,kind,before_state,after_state) values(p_org,actor,template,'role_template',prior,result);
  return result;
 end if;
 select * into contact from public.organization_people where organization_id=p_org and id=person;
 if not found or not private.person_permission(p_org,person,'people.read') then raise exception 'Person unavailable' using errcode='42501'; end if;
 select l.user_id into target from public.portal_account_links l where l.organization_id=p_org and l.person_id=person and l.active;
 select * into assignment from public.organization_staff_directory where organization_id=p_org and person_id=person;
 if p_action='detail' then
  result:=jsonb_build_object('person',to_jsonb(contact)-'human_id'-'user_id',
   'can_edit',private.person_permission(p_org,person,'people.update'),
   'can_staff',private.person_permission(p_org,person,'staff.view') or private.person_permission(p_org,person,'staff.manage'),
   'can_manage_staff',private.person_permission(p_org,person,'staff.manage') and target is not null and target<>actor and not exists(select 1 from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=target and g.permission='staff.manage' and g.revoked_at is null),
   'relationships',(select coalesce(jsonb_agg(to_jsonb(r) order by r.effective_at desc),'[]') from public.person_organization_relationships r where organization_id=p_org and person_id=person),
   'departments',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'active',a.active)),'[]') from public.person_department_affiliations a join public.organization_departments d on d.organization_id=a.organization_id and d.id=a.department_id where a.organization_id=p_org and a.person_id=person and private.has_staff_permission(p_org,'people.read',d.id)),
   'account_relationships',(select coalesce(jsonb_agg(a.affiliation),'[]') from public.organization_affiliations a where a.organization_id=p_org and a.user_id=target),
   'portal_active',target is not null,
   'activity',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]') from (select kind,created_at from public.organization_admin_events where organization_id=p_org and subject_id=person and kind in ('person_created','person_updated','person_relationship','department_affiliation') order by created_at desc limit 30)e));
  if private.person_permission(p_org,person,'discipleship.read') and target is not null then
   result:=result||jsonb_build_object('discipleship',(select coalesce(jsonb_agg(jsonb_build_object('title',c.title,'started_at',e.started_at,'completed_at',e.completed_at,'total_lessons',c.total_lessons,'lessons',(select coalesce(jsonb_agg(jsonb_build_object('number',lp.lesson_number,'status',lp.status) order by lp.lesson_number),'[]') from public.lesson_progress lp where lp.user_id=target and lp.course_id=e.course_id))),'[]') from public.course_enrollments e join public.courses c on c.id=e.course_id where e.user_id=target));
  end if;
  if private.person_permission(p_org,person,'staff.view') or private.person_permission(p_org,person,'staff.manage') then
   result:=result||jsonb_build_object('assignment',case when assignment.user_id is null then null else case when global_manager or private.has_staff_permission(p_org,'staff.view') then to_jsonb(assignment) else to_jsonb(assignment)-'reason' end end,
    'grants',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=assignment.user_id and (private.has_staff_permission(p_org,'staff.view') or global_manager or (g.department_ids is not null and not exists(select 1 from unnest(g.department_ids) d where not(private.has_staff_permission(p_org,'staff.view',d) or private.has_staff_permission(p_org,'staff.manage',d)))))),
    'audit',(select coalesce(jsonb_agg(case when global_manager or private.has_staff_permission(p_org,'staff.view') then to_jsonb(e) else jsonb_build_object('id',e.id,'actor_user_id',e.actor_user_id,'created_at',e.created_at,'after_state',jsonb_build_object('operation',e.after_state->>'operation')) end order by e.created_at desc),'[]') from (select id,actor_user_id,kind,before_state,after_state,created_at from public.organization_admin_events where organization_id=p_org and subject_id=person and kind='staff_access' order by created_at desc limit 30)e));
  end if;
  return result;
 elsif p_action='update' then
  if not private.person_permission(p_org,person,'people.update') then raise exception 'Edit denied' using errcode='42501'; end if;
  if (p_payload-'person_id'-'updated_at'-'first_name'-'last_name'-'email'-'phone')<>'{}'::jsonb then raise exception 'Unsupported contact field' using errcode='22023'; end if;
  update public.organization_people set first_name=p_payload->>'first_name',last_name=p_payload->>'last_name',email=nullif(p_payload->>'email',''),phone=nullif(p_payload->>'phone','') where organization_id=p_org and id=person and updated_at=(p_payload->>'updated_at')::timestamptz;
  if not found then raise exception 'Contact changed; reload' using errcode='40001'; end if;
  return jsonb_build_object('saved',true);
 elsif p_action in ('relationship','affiliation') then
  -- Contact relationship/scope membership is not a delegated way to expand access.
  if not(private.has_staff_permission(p_org,'people.update') and private.has_staff_permission(p_org,'people.read')) then raise exception 'Organization contact editor required' using errcode='42501'; end if;
  if p_action='relationship' then
   row_id:=(p_payload->>'id')::uuid;
   if row_id is null then
    insert into public.person_organization_relationships(organization_id,person_id,relationship,effective_at,expires_at) values(p_org,person,p_payload->>'relationship',coalesce((p_payload->>'effective_at')::timestamptz,now()),(p_payload->>'expires_at')::timestamptz) returning id into row_id;
   else
    select to_jsonb(r) into prior from public.person_organization_relationships r where organization_id=p_org and person_id=person and id=row_id for update;
    if not found then raise exception 'Relationship unavailable'; end if;
    update public.person_organization_relationships set active=(p_payload->>'active')::boolean where organization_id=p_org and person_id=person and id=row_id;
   end if;
   select to_jsonb(r) into result from public.person_organization_relationships r where id=row_id; event_kind:='person_relationship';
  else
   dept:=(p_payload->>'department_id')::uuid;
   if not exists(select 1 from public.organization_departments where organization_id=p_org and id=dept and active) then raise exception 'Department unavailable'; end if;
   select to_jsonb(a) into prior from public.person_department_affiliations a where organization_id=p_org and person_id=person and department_id=dept for update;
   insert into public.person_department_affiliations(organization_id,person_id,department_id,active) values(p_org,person,dept,coalesce((p_payload->>'active')::boolean,true)) on conflict(organization_id,person_id,department_id) do update set active=excluded.active;
   select to_jsonb(a) into result from public.person_department_affiliations a where organization_id=p_org and person_id=person and department_id=dept; event_kind:='department_affiliation';
  end if;
  insert into public.organization_admin_events(organization_id,actor_user_id,subject_id,kind,before_state,after_state) values(p_org,actor,person,event_kind,prior,result);return result;
 elsif p_action in ('assignment','grant','role','remove_role') then
  perform pg_advisory_xact_lock(hashtextextended(p_org::text,0));
  -- Re-evaluate after serialization. Never change self or a provisioned administrator.
  if not private.person_permission(p_org,person,'staff.manage') or target is null or target=actor or exists(select 1 from public.organization_staff_permissions where organization_id=p_org and user_id=target and permission='staff.manage' and revoked_at is null) then raise exception 'Staff change denied; reviewed account link required' using errcode='42501'; end if;
  if not exists(select 1 from auth.users where id=target and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Verified account required' using errcode='42501'; end if;
  select * into assignment from public.organization_staff_directory where organization_id=p_org and user_id=target for update;
  if coalesce(assignment.revision,0)<>coalesce((p_payload->>'revision')::integer,-1) then raise exception 'Staff changed; reload' using errcode='40001'; end if;
  if assignment.person_id is not null and assignment.person_id<>person then raise exception 'Staff identity mismatch' using errcode='42501'; end if;
  select jsonb_build_object('assignment',to_jsonb(assignment),'grants',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=target)) into prior;
  if p_action='assignment' then
   if not private.has_staff_permission(p_org,'staff.manage') then raise exception 'Organization-wide manager required for assignment changes' using errcode='42501'; end if;
   starts:=coalesce((p_payload->>'effective_at')::timestamptz,now());ends:=(p_payload->>'expires_at')::timestamptz;
   insert into public.organization_staff_directory(organization_id,user_id,person_id,display_name,active,effective_at,expires_at,reason) values(p_org,target,person,concat_ws(' ',contact.first_name,contact.last_name),coalesce((p_payload->>'active')::boolean,false),starts,ends,coalesce(p_payload->>'reason',''))
   on conflict(organization_id,user_id) do update set person_id=excluded.person_id,active=excluded.active,effective_at=excluded.effective_at,expires_at=excluded.expires_at,reason=excluded.reason,revision=organization_staff_directory.revision+1,updated_at=clock_timestamp();
   -- Disabling revokes grants: later re-enabling alone cannot restore authority.
   if not coalesce((p_payload->>'active')::boolean,false) then update public.organization_staff_permissions set revoked_at=clock_timestamp() where organization_id=p_org and user_id=target and revoked_at is null; end if;
  else
   if assignment.user_id is null then raise exception 'Create the staff assignment first'; end if;
   if p_payload->'department_ids' is not null and p_payload->'department_ids'<>'null'::jsonb then select array_agg(value::uuid) into scopes from jsonb_array_elements_text(p_payload->'department_ids');if scopes is null then raise exception 'Choose departments or organization-wide';end if;end if;
   if scopes is null then
    if not private.has_staff_permission(p_org,'staff.manage') then raise exception 'Organization scope denied' using errcode='42501'; end if;
   else
    foreach dept in array scopes loop if not private.has_staff_permission(p_org,'staff.manage',dept) or not exists(select 1 from public.organization_departments where organization_id=p_org and id=dept and active) then raise exception 'Department scope denied' using errcode='42501';end if;end loop;
   end if;
   starts:=coalesce((p_payload->>'effective_at')::timestamptz,now());ends:=(p_payload->>'expires_at')::timestamptz;
   if p_action in ('role','remove_role') then
    template:=(p_payload->>'template_id')::uuid;
    select permissions into keys from public.staff_role_templates where organization_id=p_org and id=template and active;
    if not found then raise exception 'Template unavailable'; end if;
    if p_action='remove_role' then select coalesce(array_agg(permission),'{}') into keys from public.organization_staff_permissions where organization_id=p_org and user_id=target and template_id=template and revoked_at is null;end if;
   else keys:=array[p_payload->>'permission'];end if;
   foreach key in array keys loop
    if key='staff.manage' or not(key=any(private.staff_permission_keys())) then raise exception 'Cannot delegate this capability' using errcode='42501'; end if;
    -- Existing broader grants cannot be edited or revoked by a narrower manager.
    if exists(select 1 from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=target and g.permission=key and g.revoked_at is null and ((g.department_ids is null and not private.has_staff_permission(p_org,'staff.manage')) or exists(select 1 from unnest(g.department_ids) d where not private.has_staff_permission(p_org,'staff.manage',d)))) then raise exception 'Existing grant exceeds manager scope' using errcode='42501';end if;
    select * into actor_grant from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=actor and g.permission=key and g.revoked_at is null and g.effective_at<=now() and (g.expires_at is null or g.expires_at>now());
    if actor_grant.user_id is null or (actor_grant.department_ids is not null and (scopes is null or not(scopes <@ actor_grant.department_ids))) then raise exception 'Cannot delegate unowned capability/scope' using errcode='42501';end if;
    if p_action='remove_role' or coalesce((p_payload->>'revoke')::boolean,false) then
     update public.organization_staff_permissions set revoked_at=clock_timestamp() where organization_id=p_org and user_id=target and permission=key;
    else
     if starts<actor_grant.effective_at or (actor_grant.expires_at is not null and (ends is null or ends>actor_grant.expires_at)) or exists(select 1 from public.organization_staff_directory s where s.organization_id=p_org and s.user_id=actor and s.expires_at is not null and (ends is null or ends>s.expires_at)) or exists(select 1 from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=actor and g.permission='staff.manage' and g.expires_at is not null and (ends is null or ends>g.expires_at)) then raise exception 'Delegation exceeds authority dates' using errcode='42501';end if;
     insert into public.organization_staff_permissions(organization_id,user_id,permission,department_ids,effective_at,expires_at,template_id) values(p_org,target,key,scopes,starts,ends,template)
     on conflict(organization_id,user_id,permission) do update set department_ids=excluded.department_ids,effective_at=excluded.effective_at,expires_at=excluded.expires_at,template_id=excluded.template_id,revoked_at=null,granted_at=clock_timestamp();
    end if;
   end loop;
   update public.organization_staff_directory set revision=revision+1,updated_at=clock_timestamp() where organization_id=p_org and user_id=target;
  end if;
  select jsonb_build_object('assignment',to_jsonb(s),'grants',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=target)) into result from public.organization_staff_directory s where s.organization_id=p_org and s.user_id=target;
  insert into public.organization_admin_events(organization_id,actor_user_id,subject_id,kind,before_state,after_state) values(p_org,actor,person,'staff_access',prior,result||jsonb_build_object('operation',p_action,'reason',left(coalesce(p_payload->>'reason',''),500)));
  return jsonb_build_object('saved',true);
 end if;
 raise exception 'Unknown People operation' using errcode='22023';
end $$;
create function public.people_workspace(p_org uuid,p_action text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.people_workspace(p_org,p_action,p_payload)$$;
revoke all on function private.people_workspace(uuid,text,jsonb),public.people_workspace(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.people_workspace(uuid,text,jsonb),public.people_workspace(uuid,text,jsonb) to authenticated;
create function private.staff_workspace_context() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug)),'[]') from public.organizations o where auth.uid() is not null and private.staff_assignment_active(o.id,auth.uid())),
 'grants',(select coalesce(jsonb_agg(jsonb_build_object('organization_id',g.organization_id,'permission',g.permission,'department_ids',g.department_ids)),'[]') from public.organization_staff_permissions g where auth.uid() is not null and g.user_id=auth.uid() and g.revoked_at is null and g.effective_at<=now() and (g.expires_at is null or g.expires_at>now()) and private.staff_assignment_active(g.organization_id,auth.uid())))
$$;
create function public.staff_workspace_context() returns jsonb language sql stable security invoker set search_path='' as $$select private.staff_workspace_context()$$;
revoke all on function private.staff_workspace_context(),public.staff_workspace_context() from public,anon,authenticated;
grant execute on function private.staff_workspace_context(),public.staff_workspace_context() to authenticated;
-- Only authorization helpers intended for RLS are callable by browser roles.
alter policy staff_permissions_read_own on public.organization_staff_permissions using(user_id=(select auth.uid()) and department_ids is null and private.has_staff_permission(organization_id,permission));
revoke execute on function private.staff_assignment_active(uuid,uuid) from authenticated;
-- Scope affiliation audit just as strictly as the affiliation itself.
alter policy org_admin_events_read on public.organization_admin_events using(
 case when kind in ('staff_access','role_template') then private.has_staff_permission(organization_id,'staff.view') or private.has_staff_permission(organization_id,'staff.manage')
 when kind='department_affiliation' then private.person_permission(organization_id,subject_id,'people.read') and private.has_staff_permission(organization_id,'people.read',(after_state->>'department_id')::uuid)
 else private.person_permission(organization_id,subject_id,'people.read') end);
create unique index organization_people_human_unique on public.organization_people(organization_id,human_id);
-- Compatibility adapter for old clients: only reviewed, unscoped explicit grants
-- can be edited here; scoped/datable/template access uses the v1 editor.
create or replace function private.set_staff_access(p_org uuid,p_target uuid,p_email text,p_name text,p_permissions text[],p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid; person uuid; rev integer; chosen text[]; key text; existing public.organization_staff_directory;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_org::text,0));
 if auth.uid() is null or not private.has_staff_permission(p_org,'staff.manage') then raise exception 'Access denied' using errcode='42501';end if;
 if p_permissions is null or array_position(p_permissions,null) is not null then raise exception 'Explicit permissions required';end if;
 select array_agg(distinct x) into chosen from unnest(p_permissions) x;chosen:=coalesce(chosen,'{}');
 select l.user_id,l.person_id into target,person from public.portal_account_links l join auth.users u on u.id=l.user_id where l.organization_id=p_org and l.active and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and ((p_target is not null and l.user_id=p_target) or (p_target is null and lower(btrim(u.email))=lower(btrim(p_email))));
 if target is null then raise exception 'Reviewed portal account link required' using errcode='42501';end if;
 select * into existing from public.organization_staff_directory where organization_id=p_org and user_id=target;
 if existing.expires_at is not null or existing.effective_at>now() or exists(select 1 from public.organization_staff_permissions where organization_id=p_org and user_id=target and revoked_at is null and (department_ids is not null or template_id is not null or expires_at is not null or effective_at>now())) then raise exception 'Use People Staff Access to preserve scopes, dates and templates' using errcode='42501';end if;
 if (chosen && array['people.create','people.update','people.export','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage']) and not('people.read'=any(chosen)) then raise exception 'People read required';end if;
 if ('followup.manage'=any(chosen) and not('followup.read'=any(chosen))) or ('tags.manage'=any(chosen) and not('tags.read'=any(chosen))) or ('households.manage'=any(chosen) and not('households.read'=any(chosen))) or ('portal.manage'=any(chosen) and not('tags.read'=any(chosen))) or ('finance.configure'=any(chosen) and not('finance.read'=any(chosen))) then raise exception 'Required supporting permission missing';end if;
 perform private.people_workspace(p_org,'assignment',jsonb_build_object('person_id',person,'revision',p_revision,'active',cardinality(chosen)>0,'effective_at',coalesce(existing.effective_at,now()),'reason','Reviewed legacy staff editor'));
 for key in select permission from public.organization_staff_permissions where organization_id=p_org and user_id=target and revoked_at is null and not(permission=any(chosen)) loop
  select revision into rev from public.organization_staff_directory where organization_id=p_org and user_id=target;
  perform private.people_workspace(p_org,'grant',jsonb_build_object('person_id',person,'revision',rev,'permission',key,'revoke',true));
 end loop;
 foreach key in array chosen loop
  select revision into rev from public.organization_staff_directory where organization_id=p_org and user_id=target;
  perform private.people_workspace(p_org,'grant',jsonb_build_object('person_id',person,'revision',rev,'permission',key));
 end loop;
 select revision into rev from public.organization_staff_directory where organization_id=p_org and user_id=target;
 return jsonb_build_object('user_id',target,'revision',rev);
end $$;
