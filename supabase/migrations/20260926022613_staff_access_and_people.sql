alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;
alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check(permission in ('people.read','people.create','people.update','people.export','staff.manage','finance.read','care.read','discipleship.read','followup.read','followup.manage'));
create table public.organization_staff_directory (
 organization_id uuid not null references public.organizations(id),
 user_id uuid not null references auth.users(id),
 display_name text not null check(length(btrim(display_name)) between 1 and 150),
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 primary key(organization_id,user_id)
);
create index staff_directory_user_idx on public.organization_staff_directory(user_id);
create table public.organization_admin_events (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 actor_user_id uuid not null references auth.users(id),subject_id uuid not null,
 kind text not null check(kind in ('staff_access','person_created','person_updated')),
 before_state jsonb,after_state jsonb not null,created_at timestamptz not null default now()
);
create index org_admin_events_org_idx on public.organization_admin_events(organization_id,created_at desc);
create index org_admin_events_actor_idx on public.organization_admin_events(actor_user_id);
alter table public.organization_staff_directory enable row level security;
alter table public.organization_admin_events enable row level security;
revoke all on public.organization_staff_directory,public.organization_admin_events from public,anon,authenticated;
grant select on public.organization_admin_events to authenticated;
grant all on public.organization_staff_directory,public.organization_admin_events to service_role;
create policy org_admin_events_read on public.organization_admin_events for select to authenticated using (
 exists(select 1 from public.organization_staff_permissions p where p.organization_id=organization_admin_events.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission=case when kind='staff_access' then 'staff.manage' else 'people.read' end)
);
-- Directory is available only through explicitly scoped RPCs. No table access policy is intended.
create function private.list_staff_directory(p_org uuid,p_for_assignment boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_for_assignment then
  if (select count(*) from public.organization_staff_permissions where organization_id=p_org and user_id=actor and permission in ('people.read','followup.read') and revoked_at is null)<>2 then raise exception 'Access denied' using errcode='42501'; end if;
 else
  if not exists(select 1 from public.organization_staff_permissions where organization_id=p_org and user_id=actor and permission='staff.manage' and revoked_at is null) then raise exception 'Access denied' using errcode='42501'; end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('user_id',d.user_id,'display_name',d.display_name,'revision',d.revision,'permissions',case when p_for_assignment then '[]'::jsonb else (select coalesce(jsonb_agg(p.permission order by p.permission),'[]'::jsonb) from public.organization_staff_permissions p where p.organization_id=p_org and p.user_id=d.user_id and p.revoked_at is null) end) order by d.display_name,d.user_id),'[]'::jsonb) into result
 from public.organization_staff_directory d where d.organization_id=p_org and (not p_for_assignment or (select count(*) from public.organization_staff_permissions p where p.organization_id=p_org and p.user_id=d.user_id and p.revoked_at is null and p.permission in ('people.read','followup.read'))=2);
 return result;
end $$;
create function public.list_staff_directory(p_org uuid,p_for_assignment boolean default true) returns jsonb language sql stable security invoker set search_path='' as $$select private.list_staff_directory(p_org,p_for_assignment)$$;

create function private.set_staff_access(p_org uuid,p_target uuid,p_email text,p_name text,p_permissions text[],p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if (chosen && array['people.create','people.update','people.export','followup.read','followup.manage']) and not ('people.read'=any(chosen)) then raise exception 'People read permission required' using errcode='22023'; end if;
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
create function public.set_staff_access(p_org uuid,p_target uuid,p_email text,p_name text,p_permissions text[],p_revision integer) returns jsonb language sql security invoker set search_path='' as $$select private.set_staff_access(p_org,p_target,p_email,p_name,p_permissions,p_revision)$$;
revoke all on function private.list_staff_directory(uuid,boolean),public.list_staff_directory(uuid,boolean),private.set_staff_access(uuid,uuid,text,text,text[],integer),public.set_staff_access(uuid,uuid,text,text,text[],integer) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.list_staff_directory(uuid,boolean),public.list_staff_directory(uuid,boolean),private.set_staff_access(uuid,uuid,text,text,text[],integer),public.set_staff_access(uuid,uuid,text,text,text[],integer) to authenticated;
-- private remains outside PostgREST's exposed schemas. Public wrappers are invokers.

grant insert(first_name,last_name,email,phone,organization_id) on public.organization_people to authenticated;
create policy organization_people_insert on public.organization_people for insert to authenticated with check (
 user_id is null and (select count(*) from public.organization_staff_permissions p where p.organization_id=organization_people.organization_id and p.user_id=(select auth.uid()) and p.permission in ('people.read','people.create') and p.revoked_at is null)=2
);
create function private.guard_person_write() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); required_permission text:=case when tg_op='INSERT' then 'people.create' else 'people.update' end;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Verified staff required' using errcode='42501'; end if;
 if (select count(*) from public.organization_staff_permissions where organization_id=new.organization_id and user_id=actor and permission in ('people.read',required_permission) and revoked_at is null)<>2 then raise exception 'Access denied' using errcode='42501'; end if;
 if tg_op='UPDATE' and (new.organization_id<>old.organization_id or new.user_id is distinct from old.user_id or new.id<>old.id) then raise exception 'Identity cannot change' using errcode='42501'; end if;
 new.first_name:=btrim(new.first_name);new.last_name:=btrim(new.last_name);new.updated_at:=clock_timestamp();
 return new;
end $$;
create function private.audit_person_write() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Staff identity required' using errcode='42501'; end if;
 insert into public.organization_admin_events(organization_id,actor_user_id,subject_id,kind,before_state,after_state) values(new.organization_id,actor,new.id,case when tg_op='INSERT' then 'person_created' else 'person_updated' end,case when tg_op='UPDATE' then jsonb_build_object('first_name',old.first_name,'last_name',old.last_name,'email',old.email,'phone',old.phone) else null end,jsonb_build_object('first_name',new.first_name,'last_name',new.last_name,'email',new.email,'phone',new.phone));
 return new;
end $$;
revoke all on function private.guard_person_write(),private.audit_person_write() from public,anon,authenticated;
create trigger guard_person_write before insert or update on public.organization_people for each row execute function private.guard_person_write();
create trigger audit_person_write after insert or update on public.organization_people for each row execute function private.audit_person_write();
