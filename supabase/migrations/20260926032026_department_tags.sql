-- Department/tag configuration and auditable assignment events. No mail or task worker is activated.
alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;
alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check(permission in ('people.read','people.create','people.update','people.export','staff.manage','finance.read','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage'));
create table public.organization_departments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 name text not null check(length(btrim(name)) between 1 and 100), leader_user_id uuid references auth.users(id),
 active boolean not null default true, revision integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id)
);
create unique index department_name_unique on public.organization_departments(organization_id,lower(btrim(name)));
create index department_list_idx on public.organization_departments(organization_id,active,name,id);
create index department_leader_idx on public.organization_departments(leader_user_id);
create table public.organization_tags (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 department_id uuid not null, name text not null check(length(btrim(name)) between 1 and 100),
 task_title text not null default 'Connect with this person' check(length(btrim(task_title)) between 1 and 200),
 due_after_days integer check(due_after_days between 0 and 365),
 active boolean not null default true, revision integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id),
 foreign key(organization_id,department_id) references public.organization_departments(organization_id,id)
);
create unique index tag_name_unique on public.organization_tags(organization_id,lower(btrim(name)));
create index tag_list_idx on public.organization_tags(organization_id,active,name,id);
create index tag_department_idx on public.organization_tags(organization_id,department_id);
create table public.organization_person_tags (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 person_id uuid not null, tag_id uuid not null, active boolean not null default true, revision integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),
 foreign key(organization_id,tag_id) references public.organization_tags(organization_id,id), unique(person_id,tag_id)
);
create index person_tags_person_idx on public.organization_person_tags(organization_id,person_id,created_at,id);
create index person_tags_tag_idx on public.organization_person_tags(organization_id,tag_id);
create table public.organization_tag_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 actor_user_id uuid not null references auth.users(id), subject_id uuid not null,
 kind text not null check(kind in ('department_created','department_updated','tag_created','tag_updated','tag_assigned','tag_removed')),
 before_state jsonb, after_state jsonb not null, created_at timestamptz not null default now()
);
create index tag_events_org_time_idx on public.organization_tag_events(organization_id,created_at desc,id);
create index tag_events_subject_idx on public.organization_tag_events(organization_id,subject_id,created_at desc);
create index tag_events_actor_idx on public.organization_tag_events(actor_user_id);
alter table public.organization_departments enable row level security;
revoke all on public.organization_departments from public,anon,authenticated;
grant select on public.organization_departments to authenticated;
grant insert(organization_id,name,leader_user_id) on public.organization_departments to authenticated;
grant update(name,leader_user_id,active) on public.organization_departments to authenticated;
grant all on public.organization_departments to service_role;
create policy organization_departments_read on public.organization_departments for select to authenticated using ((select count(*) from public.organization_staff_permissions p where p.organization_id=organization_departments.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','tags.read'))=2);
create policy organization_departments_insert on public.organization_departments for insert to authenticated with check ((select count(*) from public.organization_staff_permissions p where p.organization_id=organization_departments.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','tags.read','tags.manage'))=3);
create policy organization_departments_update on public.organization_departments for update to authenticated using ((select count(*) from public.organization_staff_permissions p where p.organization_id=organization_departments.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','tags.read','tags.manage'))=3) with check ((select count(*) from public.organization_staff_permissions p where p.organization_id=organization_departments.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','tags.read','tags.manage'))=3);
alter table public.organization_tags enable row level security;
revoke all on public.organization_tags from public,anon,authenticated;
grant select on public.organization_tags to authenticated;
grant insert(organization_id,department_id,name,task_title,due_after_days) on public.organization_tags to authenticated;
grant update(department_id,name,task_title,due_after_days,active) on public.organization_tags to authenticated;
grant all on public.organization_tags to service_role;
create policy organization_tags_read on public.organization_tags for select to authenticated using ((select count(*) from public.organization_staff_permissions p where p.organization_id=organization_tags.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','tags.read'))=2);
create policy organization_tags_insert on public.organization_tags for insert to authenticated with check ((select count(*) from public.organization_staff_permissions p where p.organization_id=organization_tags.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','tags.read','tags.manage'))=3);
create policy organization_tags_update on public.organization_tags for update to authenticated using ((select count(*) from public.organization_staff_permissions p where p.organization_id=organization_tags.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','tags.read','tags.manage'))=3) with check ((select count(*) from public.organization_staff_permissions p where p.organization_id=organization_tags.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','tags.read','tags.manage'))=3);
alter table public.organization_person_tags enable row level security;
revoke all on public.organization_person_tags from public,anon,authenticated;
grant select on public.organization_person_tags to authenticated;
grant insert(organization_id,person_id,tag_id) on public.organization_person_tags to authenticated;
grant update(active) on public.organization_person_tags to authenticated;
grant all on public.organization_person_tags to service_role;
create policy organization_person_tags_read on public.organization_person_tags for select to authenticated using ((select count(*) from public.organization_staff_permissions p where p.organization_id=organization_person_tags.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','tags.read'))=2);
create policy organization_person_tags_insert on public.organization_person_tags for insert to authenticated with check ((select count(*) from public.organization_staff_permissions p where p.organization_id=organization_person_tags.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','tags.read','tags.manage'))=3);
create policy organization_person_tags_update on public.organization_person_tags for update to authenticated using ((select count(*) from public.organization_staff_permissions p where p.organization_id=organization_person_tags.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','tags.read','tags.manage'))=3) with check ((select count(*) from public.organization_staff_permissions p where p.organization_id=organization_person_tags.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','tags.read','tags.manage'))=3);
alter table public.organization_tag_events enable row level security;
revoke all on public.organization_tag_events from public,anon,authenticated;
grant select on public.organization_tag_events to authenticated;
grant all on public.organization_tag_events to service_role;
create policy tag_events_read on public.organization_tag_events for select to authenticated using (
 (select count(*) from public.organization_staff_permissions p where p.organization_id=organization_tag_events.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','tags.read'))=2
);
create function private.guard_tag_write() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); dept uuid;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Verified staff required' using errcode='42501'; end if;
 if (select count(*) from public.organization_staff_permissions where organization_id=new.organization_id and user_id=actor and revoked_at is null and permission in ('people.read','tags.read','tags.manage'))<>3 then raise exception 'Tag management required' using errcode='42501'; end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.organization_id<>old.organization_id) then raise exception 'Identity cannot change' using errcode='42501'; end if;
 if tg_table_name='organization_departments' then
  new.name:=btrim(new.name);
  if new.leader_user_id is not null then
   if not exists(select 1 from auth.users where id=new.leader_user_id and email_confirmed_at is not null and not coalesce(is_anonymous,false)) or
    (select count(*) from public.organization_staff_permissions where organization_id=new.organization_id and user_id=new.leader_user_id and revoked_at is null and permission in ('people.read','followup.read'))<>2 then
    raise exception 'Choose an eligible verified department leader' using errcode='23514';
   end if;
  end if;
 elsif tg_table_name='organization_tags' then
  new.name:=btrim(new.name);new.task_title:=btrim(new.task_title);
  -- Active tag changes serialize with department archival.
  if new.active then
   perform 1 from public.organization_departments where organization_id=new.organization_id and id=new.department_id and active for update;
   if not found then raise exception 'Active department required' using errcode='23514'; end if;
  end if;
 else
  if tg_op='UPDATE' then
   if new.person_id<>old.person_id or new.tag_id<>old.tag_id then raise exception 'Assignment identity cannot change' using errcode='42501'; end if;
   if new.active=old.active then return null; end if; -- unchanged assignment produces no event
  end if;
  if new.active then
   select department_id into dept from public.organization_tags where organization_id=new.organization_id and id=new.tag_id and active for update;
   if not found then raise exception 'Active tag required' using errcode='23514'; end if;
   perform 1 from public.organization_departments where organization_id=new.organization_id and id=dept and active for update;
   if not found then raise exception 'Active department required' using errcode='23514'; end if;
  end if;
 end if;
 new.updated_at:=clock_timestamp();
 if tg_op='INSERT' then new.created_at:=new.updated_at;new.revision:=1;
 else new.created_at:=old.created_at;new.revision:=old.revision+1;end if;
 return new;
end $$;
create function private.audit_tag_write() returns trigger language plpgsql security definer set search_path='' as $$
declare event_kind text;
begin
 event_kind:=case tg_table_name
 when 'organization_departments' then case when tg_op='INSERT' then 'department_created' else 'department_updated' end
 when 'organization_tags' then case when tg_op='INSERT' then 'tag_created' else 'tag_updated' end
 else case when new.active then 'tag_assigned' else 'tag_removed' end end;
 insert into public.organization_tag_events(organization_id,actor_user_id,subject_id,kind,before_state,after_state)
 values(new.organization_id,auth.uid(),new.id,event_kind,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function private.guard_tag_write(),private.audit_tag_write() from public,anon,authenticated;
create trigger guard_organization_departments before insert or update on public.organization_departments for each row execute function private.guard_tag_write();
create trigger audit_organization_departments after insert or update on public.organization_departments for each row execute function private.audit_tag_write();
create trigger guard_organization_tags before insert or update on public.organization_tags for each row execute function private.guard_tag_write();
create trigger audit_organization_tags after insert or update on public.organization_tags for each row execute function private.audit_tag_write();
create trigger guard_organization_person_tags before insert or update on public.organization_person_tags for each row execute function private.guard_tag_write();
create trigger audit_organization_person_tags after insert or update on public.organization_person_tags for each row execute function private.audit_tag_write();
create or replace function private.set_staff_access(p_org uuid,p_target uuid,p_email text,p_name text,p_permissions text[],p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid:=p_target; current_revision integer; match_count integer; previous jsonb; chosen text[];
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Verified administrator required' using errcode='42501'; end if;
 -- Serialize changes for this organization and recheck authority after waiting.
 perform pg_advisory_xact_lock(hashtextextended(p_org::text,0));
 if not exists(select 1 from public.organization_staff_permissions where organization_id=p_org and user_id=actor and permission='staff.manage' and revoked_at is null) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 150 or p_permissions is null then raise exception 'Name and permissions required' using errcode='22023'; end if;
 if exists(select 1 from unnest(p_permissions) x where x is null) then raise exception 'Invalid permission' using errcode='22023'; end if;
 select coalesce(array_agg(distinct x),'{}'::text[]) into chosen from unnest(p_permissions) x;
 if exists(select 1 from unnest(chosen) x where x='staff.manage' or not exists(select 1 from public.organization_staff_permissions where organization_id=p_org and user_id=actor and permission=x and revoked_at is null)) then raise exception 'Cannot delegate this permission' using errcode='42501'; end if;
 if (chosen && array['people.create','people.update','people.export','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage']) and not ('people.read'=any(chosen)) then raise exception 'People read permission required' using errcode='22023'; end if;
 if 'tags.manage'=any(chosen) and not ('tags.read'=any(chosen)) then raise exception 'Tag read permission required' using errcode='22023'; end if;
 if 'households.manage'=any(chosen) and not ('households.read'=any(chosen)) then raise exception 'Household read permission required' using errcode='22023'; end if;
 if 'followup.manage'=any(chosen) and not ('followup.read'=any(chosen)) then raise exception 'Follow-up read permission required' using errcode='22023'; end if;
 if target is null then
  select count(*),min(id::text)::uuid into match_count,target from auth.users where lower(btrim(email))=lower(btrim(p_email)) and email_confirmed_at is not null and not coalesce(is_anonymous,false);
  if match_count<>1 then raise exception 'No eligible verified account. Ask the staff member to sign in first.' using errcode='22023'; end if;
 else
  if not exists(select 1 from public.organization_staff_directory where organization_id=p_org and user_id=target) then raise exception 'Staff record unavailable' using errcode='42501'; end if;
 end if;
 if cardinality(chosen)>0 and not exists(select 1 from auth.users where id=target and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Verified staff account required' using errcode='42501'; end if;
 if target=actor or exists(select 1 from public.organization_staff_permissions where organization_id=p_org and user_id=target and permission='staff.manage' and revoked_at is null) then raise exception 'Administrator access requires trusted provisioning' using errcode='42501'; end if;
 select revision into current_revision from public.organization_staff_directory where organization_id=p_org and user_id=target;
 if coalesce(current_revision,0) is distinct from p_revision then raise exception 'Staff access changed. Reload before saving.' using errcode='40001'; end if;
 select coalesce(jsonb_agg(permission order by permission),'[]'::jsonb) into previous from public.organization_staff_permissions where organization_id=p_org and user_id=target and revoked_at is null;
 update public.organization_staff_permissions set revoked_at=clock_timestamp() where organization_id=p_org and user_id=target and revoked_at is null and not(permission=any(chosen));
 insert into public.organization_staff_permissions(organization_id,user_id,permission,granted_at,revoked_at) select p_org,target,x,clock_timestamp(),null from unnest(chosen) x
 on conflict(organization_id,user_id,permission) do update set revoked_at=null,granted_at=case when organization_staff_permissions.revoked_at is not null then excluded.granted_at else organization_staff_permissions.granted_at end;
 insert into public.organization_staff_directory(organization_id,user_id,display_name,revision,updated_at) values(p_org,target,btrim(p_name),coalesce(current_revision,0)+1,clock_timestamp()) on conflict(organization_id,user_id) do update set display_name=excluded.display_name,revision=excluded.revision,updated_at=excluded.updated_at;
 insert into public.organization_admin_events(organization_id,actor_user_id,subject_id,kind,before_state,after_state) values(p_org,actor,target,'staff_access',jsonb_build_object('permissions',previous,'revision',coalesce(current_revision,0)),jsonb_build_object('permissions',to_jsonb(chosen),'display_name',btrim(p_name),'revision',coalesce(current_revision,0)+1));
 return jsonb_build_object('user_id',target,'revision',coalesce(current_revision,0)+1);
end $$;
