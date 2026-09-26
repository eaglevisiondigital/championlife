-- Participant content access is independent of staff, contact ownership and giving access.
alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;
alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check(permission in ('people.read','people.create','people.update','people.export','staff.manage','finance.read','finance.configure','portal.manage','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage'));
create table public.portal_areas (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 area_key text not null check(area_key in ('church_member','dream_team','sowgo_partner')),title text not null,organization_label text not null,
 unique(organization_id,id),unique(organization_id,area_key)
);
insert into public.portal_areas(organization_id,area_key,title,organization_label)
 select id,'church_member','Church member area',name from public.organizations where slug='champion-life';
insert into public.portal_areas(organization_id,area_key,title,organization_label)
 select id,'dream_team','Dream Team area',name from public.organizations where slug='champion-life';
insert into public.portal_areas(organization_id,area_key,title,organization_label)
 select id,'sowgo_partner','SowGo partner area',name from public.organizations where slug='sowgo';
create table public.portal_tag_rules (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),area_id uuid not null,tag_id uuid not null,
 enabled boolean not null default false,revision integer not null default 1,updated_at timestamptz not null default now(),
 foreign key(organization_id,area_id) references public.portal_areas(organization_id,id),foreign key(organization_id,tag_id) references public.organization_tags(organization_id,id),unique(area_id,tag_id)
);
create index portal_rules_org_tag_idx on public.portal_tag_rules(organization_id,tag_id);
create index portal_rules_org_area_idx on public.portal_tag_rules(organization_id,area_id);
create table public.portal_account_links (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),person_id uuid not null,user_id uuid not null references auth.users(id),
 active boolean not null default true,verification_note text not null check(length(btrim(verification_note)) between 10 and 500),
 revision integer not null default 1,updated_at timestamptz not null default now(),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),unique(organization_id,person_id),unique(organization_id,user_id)
);
create index portal_links_user_idx on public.portal_account_links(user_id,organization_id);
create table public.portal_resources (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),area_id uuid not null,
 title text not null check(length(btrim(title)) between 1 and 160),summary text not null default '' check(length(summary)<=500),
 body text not null check(length(btrim(body)) between 1 and 20000),status text not null default 'draft' check(status in ('draft','published','archived')),
 revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(organization_id,area_id) references public.portal_areas(organization_id,id)
);
create index portal_resources_list_idx on public.portal_resources(organization_id,area_id,status,updated_at desc,id);
create table public.portal_admin_events (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),actor_user_id uuid not null references auth.users(id),
 kind text not null check(kind in ('account_link','tag_rule','resource')),subject_id uuid not null,before_state jsonb,after_state jsonb not null,created_at timestamptz not null default now()
);
create index portal_admin_events_org_idx on public.portal_admin_events(organization_id,created_at desc,id);
create index portal_admin_events_actor_idx on public.portal_admin_events(actor_user_id);
create function private.portal_staff(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and not coalesce(is_anonymous,false))
 and (select count(*) from public.organization_staff_permissions where organization_id=p_org and user_id=auth.uid() and revoked_at is null and permission in ('people.read','tags.read','portal.manage'))=3
$$;
create function private.portal_has_access(p_org uuid,p_area uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and not coalesce(is_anonymous,false)) and exists(
  select 1 from public.portal_account_links l
  join public.organization_person_tags pt on pt.organization_id=l.organization_id and pt.person_id=l.person_id and pt.active
  join public.organization_tags t on t.organization_id=pt.organization_id and t.id=pt.tag_id and t.active
  join public.organization_departments d on d.organization_id=t.organization_id and d.id=t.department_id and d.active
  join public.portal_tag_rules r on r.organization_id=t.organization_id and r.tag_id=t.id and r.area_id=p_area and r.enabled
  where l.organization_id=p_org and l.user_id=auth.uid() and l.active
 )
$$;
revoke all on function private.portal_staff(uuid),private.portal_has_access(uuid,uuid) from public,anon,authenticated;
grant execute on function private.portal_staff(uuid),private.portal_has_access(uuid,uuid) to authenticated;
alter table public.portal_areas enable row level security;
revoke all on public.portal_areas from public,anon,authenticated;
grant select on public.portal_areas to authenticated;
grant all on public.portal_areas to service_role;
create policy portal_areas_read on public.portal_areas for select to authenticated using (private.portal_staff(portal_areas.organization_id) or private.portal_has_access(portal_areas.organization_id,portal_areas.id));
alter table public.portal_tag_rules enable row level security;
revoke all on public.portal_tag_rules from public,anon,authenticated;
grant select on public.portal_tag_rules to authenticated;
grant all on public.portal_tag_rules to service_role;
create policy portal_tag_rules_read on public.portal_tag_rules for select to authenticated using (private.portal_staff(portal_tag_rules.organization_id));
alter table public.portal_account_links enable row level security;
revoke all on public.portal_account_links from public,anon,authenticated;
grant select on public.portal_account_links to authenticated;
grant all on public.portal_account_links to service_role;
create policy portal_account_links_read on public.portal_account_links for select to authenticated using (private.portal_staff(portal_account_links.organization_id));
alter table public.portal_resources enable row level security;
revoke all on public.portal_resources from public,anon,authenticated;
grant select on public.portal_resources to authenticated;
grant all on public.portal_resources to service_role;
create policy portal_resources_read on public.portal_resources for select to authenticated using (private.portal_staff(portal_resources.organization_id) or (status='published' and private.portal_has_access(portal_resources.organization_id,portal_resources.area_id)));
alter table public.portal_admin_events enable row level security;
revoke all on public.portal_admin_events from public,anon,authenticated;
grant select on public.portal_admin_events to authenticated;
grant all on public.portal_admin_events to service_role;
create policy portal_admin_events_read on public.portal_admin_events for select to authenticated using (private.portal_staff(portal_admin_events.organization_id));
grant insert(organization_id,area_id,title,summary,body) on public.portal_resources to authenticated;
grant update(title,summary,body,status) on public.portal_resources to authenticated;
create policy portal_resources_insert on public.portal_resources for insert to authenticated with check(private.portal_staff(organization_id));
create policy portal_resources_update on public.portal_resources for update to authenticated using(private.portal_staff(organization_id)) with check(private.portal_staff(organization_id));
create function private.guard_portal_resource() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not private.portal_staff(new.organization_id) then raise exception 'Portal management required' using errcode='42501'; end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.organization_id<>old.organization_id or new.area_id<>old.area_id) then raise exception 'Resource owner and area cannot change' using errcode='42501'; end if;
 new.title:=btrim(new.title);new.updated_at:=clock_timestamp();
 if tg_op='INSERT' then new.revision:=1;new.created_at:=new.updated_at;new.status:='draft';else new.revision:=old.revision+1;new.created_at:=old.created_at;end if;
 return new;
end $$;
create function private.audit_portal_resource() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.portal_admin_events(organization_id,actor_user_id,kind,subject_id,before_state,after_state)
 values(new.organization_id,auth.uid(),'resource',new.id,case when tg_op='UPDATE' then jsonb_build_object('title',old.title,'status',old.status,'revision',old.revision) else null end,jsonb_build_object('title',new.title,'status',new.status,'revision',new.revision,'area_id',new.area_id));
 return new;
end $$;
create trigger guard_portal_resource before insert or update on public.portal_resources for each row execute function private.guard_portal_resource();
create trigger audit_portal_resource after insert or update on public.portal_resources for each row execute function private.audit_portal_resource();
-- Protected access tags require portal authority as well as the ordinary tag permission.
create function private.guard_portal_access_tag() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.portal_tag_rules where organization_id=new.organization_id and tag_id=new.tag_id and enabled) and not private.portal_staff(new.organization_id) then raise exception 'Portal authority required for this access tag' using errcode='42501'; end if;
 return new;
end $$;
create trigger portal_access_tag_guard before insert or update on public.organization_person_tags for each row execute function private.guard_portal_access_tag();

create function private.set_portal_tag_rule(p_org uuid,p_area uuid,p_tag uuid,p_enabled boolean,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();old_row public.portal_tag_rules;r public.portal_tag_rules;
begin
 if not private.portal_staff(p_org) or not exists(select 1 from public.organization_staff_permissions where organization_id=p_org and user_id=actor and permission='staff.manage' and revoked_at is null) then raise exception 'Portal administrator required' using errcode='42501'; end if;
 if p_enabled is null then raise exception 'Enabled state required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':portal',0));
 if not private.portal_staff(p_org) or not exists(select 1 from public.organization_staff_permissions where organization_id=p_org and user_id=actor and permission='staff.manage' and revoked_at is null) then raise exception 'Portal administrator required' using errcode='42501'; end if;
 -- Lock the tag to serialize activation with tag assignments.
 perform 1 from public.organization_tags where organization_id=p_org and id=p_tag for update;
 if not found or not exists(select 1 from public.portal_areas where organization_id=p_org and id=p_area) then raise exception 'Tag and area must belong to this organization' using errcode='23514'; end if;
 if p_enabled and not exists(select 1 from public.organization_tags t join public.organization_departments d on d.organization_id=t.organization_id and d.id=t.department_id where t.organization_id=p_org and t.id=p_tag and t.active and d.active) then raise exception 'Active tag and department required' using errcode='23514'; end if;
 select * into old_row from public.portal_tag_rules where organization_id=p_org and area_id=p_area and tag_id=p_tag for update;
 if coalesce(old_row.revision,0) is distinct from p_revision then raise exception 'Rule changed. Refresh.' using errcode='40001'; end if;
 insert into public.portal_tag_rules(organization_id,area_id,tag_id,enabled,revision) values(p_org,p_area,p_tag,p_enabled,1)
 on conflict(area_id,tag_id) do update set enabled=excluded.enabled,revision=portal_tag_rules.revision+1,updated_at=clock_timestamp() returning * into r;
 insert into public.portal_admin_events(organization_id,actor_user_id,kind,subject_id,before_state,after_state) values(p_org,actor,'tag_rule',r.id,case when old_row.id is null then null else to_jsonb(old_row) end,to_jsonb(r));
 return jsonb_build_object('id',r.id,'revision',r.revision,'enabled',r.enabled);
end $$;

create function private.set_portal_account_link(p_org uuid,p_person uuid,p_email text,p_active boolean,p_note text,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();target uuid;matches integer;old_row public.portal_account_links;r public.portal_account_links;
begin
 if not private.portal_staff(p_org) or not exists(select 1 from public.organization_staff_permissions where organization_id=p_org and user_id=actor and permission='staff.manage' and revoked_at is null) then raise exception 'Portal administrator required' using errcode='42501'; end if;
 if p_active is null or p_note is null or length(btrim(p_note)) not between 10 and 500 then raise exception 'Record the identity verification or revocation reason' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':portal',0));
 if not private.portal_staff(p_org) or not exists(select 1 from public.organization_staff_permissions where organization_id=p_org and user_id=actor and permission='staff.manage' and revoked_at is null) then raise exception 'Portal administrator required' using errcode='42501'; end if;
 if not exists(select 1 from public.organization_people where organization_id=p_org and id=p_person) then raise exception 'Contact unavailable' using errcode='42501'; end if;
 select * into old_row from public.portal_account_links where organization_id=p_org and person_id=p_person for update;
 if coalesce(old_row.revision,0) is distinct from p_revision then raise exception 'Link changed. Refresh.' using errcode='40001'; end if;
 if old_row.id is null then
  if not p_active then raise exception 'No link to revoke' using errcode='22023'; end if;
  select count(*),min(id::text)::uuid into matches,target from auth.users where lower(btrim(email))=lower(btrim(p_email)) and email_confirmed_at is not null and not coalesce(is_anonymous,false);
  if matches<>1 then raise exception 'Exactly one verified account is required' using errcode='22023'; end if;
 else
  if nullif(btrim(p_email),'') is not null then raise exception 'Existing account identity cannot be reassigned' using errcode='22023'; end if;
  target:=old_row.user_id;
 end if;
 if p_active and not exists(select 1 from auth.users where id=target and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Verified account required' using errcode='23514'; end if;
 insert into public.portal_account_links(organization_id,person_id,user_id,active,verification_note,revision) values(p_org,p_person,target,p_active,btrim(p_note),1)
 on conflict(organization_id,person_id) do update set active=excluded.active,verification_note=excluded.verification_note,revision=portal_account_links.revision+1,updated_at=clock_timestamp() returning * into r;
 insert into public.portal_admin_events(organization_id,actor_user_id,kind,subject_id,before_state,after_state) values(p_org,actor,'account_link',r.id,case when old_row.id is null then null else to_jsonb(old_row) end,to_jsonb(r));
 return jsonb_build_object('id',r.id,'revision',r.revision,'active',r.active);
end $$;
create function public.set_portal_tag_rule(p_org uuid,p_area uuid,p_tag uuid,p_enabled boolean,p_revision integer) returns jsonb language sql security invoker set search_path='' as $$select private.set_portal_tag_rule(p_org,p_area,p_tag,p_enabled,p_revision)$$;
create function public.set_portal_account_link(p_org uuid,p_person uuid,p_email text,p_active boolean,p_note text,p_revision integer) returns jsonb language sql security invoker set search_path='' as $$select private.set_portal_account_link(p_org,p_person,p_email,p_active,p_note,p_revision)$$;
revoke all on function private.guard_portal_resource(),private.audit_portal_resource(),private.guard_portal_access_tag() from public,anon,authenticated;
revoke all on function private.set_portal_tag_rule(uuid,uuid,uuid,boolean,integer),private.set_portal_account_link(uuid,uuid,text,boolean,text,integer),public.set_portal_tag_rule(uuid,uuid,uuid,boolean,integer),public.set_portal_account_link(uuid,uuid,text,boolean,text,integer) from public,anon,authenticated;
grant execute on function private.set_portal_tag_rule(uuid,uuid,uuid,boolean,integer),private.set_portal_account_link(uuid,uuid,text,boolean,text,integer),public.set_portal_tag_rule(uuid,uuid,uuid,boolean,integer),public.set_portal_account_link(uuid,uuid,text,boolean,text,integer) to authenticated;
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
 if (chosen && array['people.create','people.update','people.export','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage']) and not ('people.read'=any(chosen)) then raise exception 'People read permission required' using errcode='22023'; end if;
 if 'portal.manage'=any(chosen) and not ('tags.read'=any(chosen)) then raise exception 'Tag read permission required for portal management' using errcode='22023'; end if;
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

-- Restoring an access tag or its department can restore portal access, so protect those paths too.
create function private.guard_portal_access_configuration() returns trigger language plpgsql security definer set search_path='' as $$
declare protected boolean:=false;
begin
 if tg_table_name='organization_tags' then
  if new.active is distinct from old.active or new.department_id is distinct from old.department_id then
   select exists(select 1 from public.portal_tag_rules where organization_id=new.organization_id and tag_id=new.id and enabled) into protected;
  end if;
 else
  if new.active is distinct from old.active then
   select exists(select 1 from public.portal_tag_rules r join public.organization_tags t on t.organization_id=r.organization_id and t.id=r.tag_id where t.organization_id=new.organization_id and t.department_id=new.id and r.enabled) into protected;
  end if;
 end if;
 if protected and not private.portal_staff(new.organization_id) then raise exception 'Portal authority required for this access configuration' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function private.guard_portal_access_configuration() from public,anon,authenticated;
create trigger portal_tag_configuration_guard before update on public.organization_tags for each row execute function private.guard_portal_access_configuration();
create trigger portal_department_configuration_guard before update on public.organization_departments for each row execute function private.guard_portal_access_configuration();
