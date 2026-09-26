alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;
alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check(permission in ('people.read','people.create','people.update','people.export','staff.manage','finance.read','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage'));
alter table public.organization_admin_events drop constraint organization_admin_events_kind_check;
alter table public.organization_admin_events add constraint organization_admin_events_kind_check check(kind in ('staff_access','person_created','person_updated','household_created','household_updated','household_member_added','household_member_updated'));
drop policy org_admin_events_read on public.organization_admin_events;
create policy org_admin_events_read on public.organization_admin_events for select to authenticated using (
 exists(select 1 from public.organization_staff_permissions p where p.organization_id=organization_admin_events.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission=case when kind='staff_access' then 'staff.manage' when kind like 'household_%' then 'households.read' else 'people.read' end)
 and (kind not like 'household_%' or exists(select 1 from public.organization_staff_permissions p where p.organization_id=organization_admin_events.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission='people.read'))
);
create table public.households (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 name text not null check(length(btrim(name)) between 1 and 150),status text not null default 'active' check(status in ('active','archived')),
 revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,id)
);
create table public.household_members (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),household_id uuid not null,person_id uuid not null,
 relationship text not null check(relationship in ('adult','child','other')),active boolean not null default true,
 revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(organization_id,household_id) references public.households(organization_id,id),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),unique(household_id,person_id)
);
create index households_org_status_name_idx on public.households(organization_id,status,name,id);
create index household_members_org_household_idx on public.household_members(organization_id,household_id);
create index household_members_org_person_idx on public.household_members(organization_id,person_id);
alter table public.households enable row level security;alter table public.household_members enable row level security;
revoke all on public.households,public.household_members from public,anon,authenticated;
grant select on public.households,public.household_members to authenticated;
grant insert(organization_id,name) on public.households to authenticated;
grant update(name,status) on public.households to authenticated;
grant insert(organization_id,household_id,person_id,relationship) on public.household_members to authenticated;
grant update(relationship,active) on public.household_members to authenticated;
grant all on public.households,public.household_members to service_role;
create policy households_read on public.households for select to authenticated using ((select count(*) from public.organization_staff_permissions p where p.organization_id=households.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','households.read'))=2);
create policy households_insert on public.households for insert to authenticated with check ((select count(*) from public.organization_staff_permissions p where p.organization_id=households.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','households.read','households.manage'))=3);
create policy households_update on public.households for update to authenticated using ((select count(*) from public.organization_staff_permissions p where p.organization_id=households.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','households.read','households.manage'))=3) with check ((select count(*) from public.organization_staff_permissions p where p.organization_id=households.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','households.read','households.manage'))=3);
create policy household_members_read on public.household_members for select to authenticated using ((select count(*) from public.organization_staff_permissions p where p.organization_id=household_members.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','households.read'))=2);
create policy household_members_insert on public.household_members for insert to authenticated with check ((select count(*) from public.organization_staff_permissions p where p.organization_id=household_members.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','households.read','households.manage'))=3);
create policy household_members_update on public.household_members for update to authenticated using ((select count(*) from public.organization_staff_permissions p where p.organization_id=household_members.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','households.read','households.manage'))=3) with check ((select count(*) from public.organization_staff_permissions p where p.organization_id=household_members.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','households.read','households.manage'))=3);
create function private.guard_household_write() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Verified staff required' using errcode='42501'; end if;
 if (select count(*) from public.organization_staff_permissions where organization_id=new.organization_id and user_id=actor and revoked_at is null and permission in ('people.read','households.read','households.manage'))<>3 then raise exception 'Household management required' using errcode='42501'; end if;
 if tg_op='UPDATE' and (new.organization_id<>old.organization_id or new.id<>old.id) then raise exception 'Identity cannot change' using errcode='42501'; end if;
 if tg_table_name='household_members' then
  if tg_op='UPDATE' and (new.person_id<>old.person_id or new.household_id<>old.household_id) then raise exception 'Membership identity cannot change' using errcode='42501'; end if;
  -- Lock the parent so archive and membership changes cannot race past each other.
  perform 1 from public.households where organization_id=new.organization_id and id=new.household_id and status='active' for update;
  if not found then raise exception 'Restore the household before changing members' using errcode='23514'; end if;
 else new.name:=btrim(new.name); end if;
 new.updated_at:=clock_timestamp();
 if tg_op='INSERT' then new.revision:=1;new.created_at:=new.updated_at;
 else new.revision:=old.revision+1;new.created_at:=old.created_at;end if;
 return new;
end $$;
create function private.audit_household_write() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); kind_name text;
begin
 if actor is null then raise exception 'Staff identity required' using errcode='42501'; end if;
 kind_name:=case when tg_table_name='households' then case when tg_op='INSERT' then 'household_created' else 'household_updated' end else case when tg_op='INSERT' then 'household_member_added' else 'household_member_updated' end end;
 insert into public.organization_admin_events(organization_id,actor_user_id,subject_id,kind,before_state,after_state) values(new.organization_id,actor,case when tg_table_name='households' then new.id else (to_jsonb(new)->>'household_id')::uuid end,kind_name,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function private.guard_household_write(),private.audit_household_write() from public,anon,authenticated;
create trigger guard_households before insert or update on public.households for each row execute function private.guard_household_write();
create trigger audit_households after insert or update on public.households for each row execute function private.audit_household_write();
create trigger guard_household_members before insert or update on public.household_members for each row execute function private.guard_household_write();
create trigger audit_household_members after insert or update on public.household_members for each row execute function private.audit_household_write();
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
 if (chosen && array['people.create','people.update','people.export','followup.read','followup.manage','households.read','households.manage']) and not ('people.read'=any(chosen)) then raise exception 'People read permission required' using errcode='22023'; end if;
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
