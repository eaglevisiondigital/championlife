-- Draft finance configuration only. No checkout endpoint, credentials or public giving links are changed.
alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;
alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check(permission in ('people.read','people.create','people.update','people.export','staff.manage','finance.read','finance.configure','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage'));
create table public.giving_destinations (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 purpose text not null check(purpose in ('church_giving','outreach_giving')),
 provider text not null default 'authorize_net' check(provider='authorize_net'),
 checkout_label text not null,merchant_label text not null,
 rollout_state text not null default 'draft' check(rollout_state='draft'),
 created_at timestamptz not null default now(),unique(organization_id,id),unique(organization_id,purpose)
);
-- These are destination plans, not connected or verified merchant accounts.
insert into public.giving_destinations(organization_id,purpose,checkout_label,merchant_label)
 select id,'church_giving','Champion Life online checkout','Champion Life Church merchant account' from public.organizations where slug='champion-life';
insert into public.giving_destinations(organization_id,purpose,checkout_label,merchant_label)
 select id,'outreach_giving','SowGo checkout','SowGo merchant account' from public.organizations where slug='sowgo';
create table public.giving_funds (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),destination_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 120),code text not null check(code ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(code)<=60),
 description text not null default '' check(length(description)<=500),status text not null default 'active' check(status in ('active','archived')),
 revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(organization_id,destination_id) references public.giving_destinations(organization_id,id),
 unique(organization_id,id),unique(organization_id,destination_id,id),unique(organization_id,code)
);
create index giving_funds_list_idx on public.giving_funds(organization_id,status,name,id);
create index giving_funds_destination_idx on public.giving_funds(organization_id,destination_id);
create table public.giving_form_routes (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),destination_id uuid not null,fund_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 120),form_key text not null check(form_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(form_key)<=80),
 status text not null default 'draft' check(status in ('draft','archived')),
 revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(organization_id,destination_id) references public.giving_destinations(organization_id,id),
 foreign key(organization_id,destination_id,fund_id) references public.giving_funds(organization_id,destination_id,id),
 unique(organization_id,form_key)
);
create index giving_routes_list_idx on public.giving_form_routes(organization_id,status,name,id);
create index giving_routes_fund_idx on public.giving_form_routes(organization_id,destination_id,fund_id);
create table public.giving_configuration_events (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 actor_user_id uuid not null references auth.users(id),entity_type text not null check(entity_type in ('fund','form_route')),subject_id uuid not null,
 action text not null check(action in ('created','updated')),before_state jsonb,after_state jsonb not null,created_at timestamptz not null default now()
);
create index giving_config_events_org_idx on public.giving_configuration_events(organization_id,created_at desc,id);
create index giving_config_events_subject_idx on public.giving_configuration_events(organization_id,subject_id,created_at desc);
create index giving_config_events_actor_idx on public.giving_configuration_events(actor_user_id);
alter table public.giving_destinations enable row level security;
revoke all on public.giving_destinations from public,anon,authenticated;
grant select on public.giving_destinations to authenticated;
grant all on public.giving_destinations to service_role;
create policy giving_destinations_read on public.giving_destinations for select to authenticated using (exists(select 1 from public.organization_staff_permissions p where p.organization_id=giving_destinations.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission='finance.read'));
alter table public.giving_funds enable row level security;
revoke all on public.giving_funds from public,anon,authenticated;
grant select on public.giving_funds to authenticated;
grant all on public.giving_funds to service_role;
create policy giving_funds_read on public.giving_funds for select to authenticated using (exists(select 1 from public.organization_staff_permissions p where p.organization_id=giving_funds.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission='finance.read'));
grant insert(organization_id,destination_id,name,code,description) on public.giving_funds to authenticated;
grant update(name,description,status) on public.giving_funds to authenticated;
create policy giving_funds_insert on public.giving_funds for insert to authenticated with check ((select count(*) from public.organization_staff_permissions p where p.organization_id=giving_funds.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('finance.read','finance.configure','staff.manage'))=3);
create policy giving_funds_update on public.giving_funds for update to authenticated using ((select count(*) from public.organization_staff_permissions p where p.organization_id=giving_funds.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('finance.read','finance.configure','staff.manage'))=3) with check ((select count(*) from public.organization_staff_permissions p where p.organization_id=giving_funds.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('finance.read','finance.configure','staff.manage'))=3);
alter table public.giving_form_routes enable row level security;
revoke all on public.giving_form_routes from public,anon,authenticated;
grant select on public.giving_form_routes to authenticated;
grant all on public.giving_form_routes to service_role;
create policy giving_form_routes_read on public.giving_form_routes for select to authenticated using (exists(select 1 from public.organization_staff_permissions p where p.organization_id=giving_form_routes.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission='finance.read'));
grant insert(organization_id,destination_id,fund_id,name,form_key) on public.giving_form_routes to authenticated;
grant update(fund_id,name,status) on public.giving_form_routes to authenticated;
create policy giving_form_routes_insert on public.giving_form_routes for insert to authenticated with check ((select count(*) from public.organization_staff_permissions p where p.organization_id=giving_form_routes.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('finance.read','finance.configure','staff.manage'))=3);
create policy giving_form_routes_update on public.giving_form_routes for update to authenticated using ((select count(*) from public.organization_staff_permissions p where p.organization_id=giving_form_routes.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('finance.read','finance.configure','staff.manage'))=3) with check ((select count(*) from public.organization_staff_permissions p where p.organization_id=giving_form_routes.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('finance.read','finance.configure','staff.manage'))=3);
alter table public.giving_configuration_events enable row level security;
revoke all on public.giving_configuration_events from public,anon,authenticated;
grant select on public.giving_configuration_events to authenticated;
grant all on public.giving_configuration_events to service_role;
create policy giving_configuration_events_read on public.giving_configuration_events for select to authenticated using (exists(select 1 from public.organization_staff_permissions p where p.organization_id=giving_configuration_events.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission='finance.read'));
create function private.guard_giving_configuration() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Verified finance administrator required' using errcode='42501'; end if;
 if (select count(*) from public.organization_staff_permissions where organization_id=new.organization_id and user_id=actor and revoked_at is null and permission in ('finance.read','finance.configure','staff.manage'))<>3 then raise exception 'Finance configuration authority required' using errcode='42501'; end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.organization_id<>old.organization_id or new.destination_id<>old.destination_id) then raise exception 'Organization and merchant destination cannot change' using errcode='42501'; end if;
 if tg_table_name='giving_funds' then
  if tg_op='UPDATE' and new.code<>old.code then raise exception 'Fund code cannot change' using errcode='42501'; end if;
 else
  if tg_op='UPDATE' and new.form_key<>old.form_key then raise exception 'Form key cannot change' using errcode='42501'; end if;
  if new.status='draft' then
   perform 1 from public.giving_funds where organization_id=new.organization_id and destination_id=new.destination_id and id=new.fund_id and status='active' for update;
   if not found then raise exception 'Choose an active fund owned by this merchant destination' using errcode='23514'; end if;
  end if;
 end if;
 new.name:=btrim(new.name);new.updated_at:=clock_timestamp();
 if tg_op='INSERT' then new.created_at:=new.updated_at;new.revision:=1;
 else new.created_at:=old.created_at;new.revision:=old.revision+1;end if;
 return new;
end $$;
create function private.audit_giving_configuration() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.giving_configuration_events(organization_id,actor_user_id,entity_type,subject_id,action,before_state,after_state)
 values(new.organization_id,auth.uid(),case when tg_table_name='giving_funds' then 'fund' else 'form_route' end,new.id,case when tg_op='INSERT' then 'created' else 'updated' end,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function private.guard_giving_configuration(),private.audit_giving_configuration() from public,anon,authenticated;
create trigger guard_giving_funds before insert or update on public.giving_funds for each row execute function private.guard_giving_configuration();
create trigger audit_giving_funds after insert or update on public.giving_funds for each row execute function private.audit_giving_configuration();
create trigger guard_giving_routes before insert or update on public.giving_form_routes for each row execute function private.guard_giving_configuration();
create trigger audit_giving_routes after insert or update on public.giving_form_routes for each row execute function private.audit_giving_configuration();
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
 if 'finance.configure'=any(chosen) and not ('finance.read'=any(chosen)) then raise exception 'Finance read permission required' using errcode='22023'; end if;
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
