-- Additive operational follow-up. No learner or outreach records are reclassified.
alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;
alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check (permission in ('people.read','people.update','people.export','staff.manage','finance.read','care.read','discipleship.read','followup.read','followup.manage'));
alter table public.organization_people add constraint organization_people_org_id_unique unique(organization_id,id);
create table public.followup_tasks (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 person_id uuid not null,
 title text not null check(length(btrim(title)) between 1 and 180),
 status text not null default 'open' check(status in ('open','completed','canceled')),
 due_on date,
 assigned_user_id uuid references auth.users(id),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revision integer not null default 1 check(revision>0),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id)
);
create index followup_tasks_org_status_due_idx on public.followup_tasks(organization_id,status,due_on,id);
create index followup_tasks_person_idx on public.followup_tasks(organization_id,person_id);
create index followup_tasks_assignee_idx on public.followup_tasks(assigned_user_id);
create index followup_tasks_creator_idx on public.followup_tasks(created_by);
create table public.followup_task_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 task_id uuid not null references public.followup_tasks(id),
 actor_user_id uuid not null references auth.users(id),
 action text not null check(action in ('created','updated')),
 before_state jsonb,
 after_state jsonb not null,
 occurred_at timestamptz not null default now()
);
create index followup_events_org_task_idx on public.followup_task_events(organization_id,task_id,occurred_at);
create index followup_events_task_idx on public.followup_task_events(task_id);
create index followup_events_actor_idx on public.followup_task_events(actor_user_id);
alter table public.followup_tasks enable row level security;
alter table public.followup_task_events enable row level security;
revoke all on public.followup_tasks,public.followup_task_events from public,anon,authenticated;
grant select on public.followup_tasks,public.followup_task_events to authenticated;
grant insert(organization_id,person_id,title,due_on,assigned_user_id) on public.followup_tasks to authenticated;
grant update(title,status,due_on,assigned_user_id) on public.followup_tasks to authenticated;
grant all on public.followup_tasks,public.followup_task_events to service_role;
create policy followup_tasks_read on public.followup_tasks for select to authenticated using (
 (select count(*) from public.organization_staff_permissions p where p.organization_id=followup_tasks.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','followup.read'))=2
);
create policy followup_tasks_insert on public.followup_tasks for insert to authenticated with check (
 created_by=(select auth.uid()) and
 (select count(*) from public.organization_staff_permissions p where p.organization_id=followup_tasks.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','followup.read','followup.manage'))=3
);
create policy followup_tasks_update on public.followup_tasks for update to authenticated using (
 (select count(*) from public.organization_staff_permissions p where p.organization_id=followup_tasks.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','followup.read','followup.manage'))=3
) with check (
 (select count(*) from public.organization_staff_permissions p where p.organization_id=followup_tasks.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','followup.read','followup.manage'))=3
);
create policy followup_events_read on public.followup_task_events for select to authenticated using (
 (select count(*) from public.organization_staff_permissions p where p.organization_id=followup_task_events.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','followup.read'))=2
);
create schema if not exists private;
-- Privileged only to validate assignee grants hidden by own-grant RLS, and append
-- immutable events. Not exposed as an RPC. Actor permissions are independently checked.
create function private.guard_followup_task() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then
  raise exception 'Verified staff identity required' using errcode='42501';
 end if;
 if (select count(*) from public.organization_staff_permissions where organization_id=new.organization_id and user_id=actor and revoked_at is null and permission in ('people.read','followup.read','followup.manage'))<>3 then
  raise exception 'Follow-up management permission required' using errcode='42501';
 end if;
 if tg_op='UPDATE' and (new.organization_id<>old.organization_id or new.person_id<>old.person_id or new.created_by<>old.created_by or new.id<>old.id) then
  raise exception 'Task identity cannot be changed' using errcode='42501';
 end if;
 if new.assigned_user_id is not null and (tg_op='INSERT' or new.assigned_user_id is distinct from old.assigned_user_id) then
  if (select count(*) from public.organization_staff_permissions where organization_id=new.organization_id and user_id=new.assigned_user_id and revoked_at is null and permission in ('people.read','followup.read'))<>2 then
   raise exception 'Assignee lacks access to this organization' using errcode='42501';
  end if;
 end if;
 new.title:=btrim(new.title); new.updated_at:=clock_timestamp();
 if tg_op='INSERT' then new.created_by:=actor; new.created_at:=new.updated_at; new.revision:=1; new.status:='open';
 else new.revision:=old.revision+1; new.created_at:=old.created_at; end if;
 return new;
end $$;
create function private.audit_followup_task() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
 if actor is null then raise exception 'Staff identity required' using errcode='42501'; end if;
 insert into public.followup_task_events(organization_id,task_id,actor_user_id,action,before_state,after_state)
 values(new.organization_id,new.id,actor,case when tg_op='INSERT' then 'created' else 'updated' end,
 case when tg_op='UPDATE' then jsonb_build_object('title',old.title,'status',old.status,'due_on',old.due_on,'assigned_user_id',old.assigned_user_id,'revision',old.revision) else null end,
 jsonb_build_object('title',new.title,'status',new.status,'due_on',new.due_on,'assigned_user_id',new.assigned_user_id,'revision',new.revision));
 return new;
end $$;
revoke all on function private.guard_followup_task(),private.audit_followup_task() from public,anon,authenticated;
create trigger guard_followup_task before insert or update on public.followup_tasks for each row execute function private.guard_followup_task();
create trigger audit_followup_task after insert or update on public.followup_tasks for each row execute function private.audit_followup_task();
-- No staff grants or participant data are seeded by this migration.
