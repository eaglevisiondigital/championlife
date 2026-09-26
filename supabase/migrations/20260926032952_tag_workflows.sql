-- Reviewed activation is per tag. No historical backfill and no email sender is enabled.
alter table public.organization_tags add column workflow_enabled boolean not null default false;
alter table public.organization_tags add column workflow_timezone text not null default 'UTC';
alter table public.organization_tags add column workflow_reentry text not null default 'once_per_person' check(workflow_reentry in ('once_per_person','each_assignment'));
create table public.tag_workflow_runs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 event_id uuid not null unique references public.organization_tag_events(id), assignment_id uuid not null references public.organization_person_tags(id),
 tag_id uuid not null, person_id uuid not null, department_id uuid not null,
 rule_snapshot jsonb not null, source_actor_user_id uuid not null references auth.users(id), execution_actor_user_id uuid references auth.users(id),
 leader_user_id uuid references auth.users(id), due_on date, task_title text not null,
 reserved_task_id uuid not null unique default gen_random_uuid(), task_id uuid references public.followup_tasks(id),
 status text not null default 'pending' check(status in ('pending','building','task_created','needs_review','skipped','dismissed')),
 reason text, attempts integer not null default 0, revision integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id),
 foreign key(organization_id,tag_id) references public.organization_tags(organization_id,id),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),
 foreign key(organization_id,department_id) references public.organization_departments(organization_id,id)
);
create index workflow_runs_status_idx on public.tag_workflow_runs(organization_id,status,created_at desc,id);
create index workflow_runs_tag_person_idx on public.tag_workflow_runs(organization_id,tag_id,person_id);
create index workflow_runs_assignment_idx on public.tag_workflow_runs(assignment_id);
create index workflow_runs_department_idx on public.tag_workflow_runs(organization_id,department_id);
create index workflow_runs_source_actor_idx on public.tag_workflow_runs(source_actor_user_id);
create index workflow_runs_execution_actor_idx on public.tag_workflow_runs(execution_actor_user_id);
create index workflow_runs_leader_idx on public.tag_workflow_runs(leader_user_id);
create index workflow_runs_task_idx on public.tag_workflow_runs(task_id);
alter table public.followup_tasks add column workflow_run_id uuid unique references public.tag_workflow_runs(id);
create table public.tag_workflow_notifications (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 run_id uuid not null unique, recipient_user_id uuid not null references auth.users(id),
 status text not null default 'held' check(status in ('held','canceled')),
 template_key text not null default 'department_followup_v1' check(template_key='department_followup_v1'),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),revision integer not null default 1,
 foreign key(organization_id,run_id) references public.tag_workflow_runs(organization_id,id)
);
create index workflow_notifications_org_status_idx on public.tag_workflow_notifications(organization_id,status,created_at,id);
create index workflow_notifications_recipient_idx on public.tag_workflow_notifications(recipient_user_id);
create table public.tag_workflow_events (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),run_id uuid not null,
 actor_user_id uuid not null references auth.users(id),action text not null,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),
 foreign key(organization_id,run_id) references public.tag_workflow_runs(organization_id,id)
);
create index workflow_events_run_idx on public.tag_workflow_events(organization_id,run_id,created_at,id);
create index workflow_events_actor_idx on public.tag_workflow_events(actor_user_id);
alter table public.tag_workflow_runs enable row level security;
revoke all on public.tag_workflow_runs from public,anon,authenticated;
grant select on public.tag_workflow_runs to authenticated;
grant all on public.tag_workflow_runs to service_role;
create policy tag_workflow_runs_read on public.tag_workflow_runs for select to authenticated using ((select count(*) from public.organization_staff_permissions p where p.organization_id=tag_workflow_runs.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','tags.read','followup.read'))=3);
alter table public.tag_workflow_notifications enable row level security;
revoke all on public.tag_workflow_notifications from public,anon,authenticated;
grant select on public.tag_workflow_notifications to authenticated;
grant all on public.tag_workflow_notifications to service_role;
create policy tag_workflow_notifications_read on public.tag_workflow_notifications for select to authenticated using ((select count(*) from public.organization_staff_permissions p where p.organization_id=tag_workflow_notifications.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','tags.read','followup.read'))=3);
alter table public.tag_workflow_events enable row level security;
revoke all on public.tag_workflow_events from public,anon,authenticated;
grant select on public.tag_workflow_events to authenticated;
grant all on public.tag_workflow_events to service_role;
create policy tag_workflow_events_read on public.tag_workflow_events for select to authenticated using ((select count(*) from public.organization_staff_permissions p where p.organization_id=tag_workflow_events.organization_id and p.user_id=(select auth.uid()) and p.revoked_at is null and p.permission in ('people.read','tags.read','followup.read'))=3);
create or replace function private.guard_followup_task() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then
  raise exception 'Verified staff identity required' using errcode='42501';
 end if;
 -- Only a matching, server-created in-transaction run can authorize automated insertion.
 if not (tg_op='INSERT' and new.workflow_run_id is not null and exists(
  select 1 from public.tag_workflow_runs r where r.id=new.workflow_run_id and r.organization_id=new.organization_id
   and r.status='building' and r.execution_actor_user_id=actor and r.reserved_task_id=new.id
   and r.person_id=new.person_id and r.task_title=new.title and r.leader_user_id=new.assigned_user_id and r.due_on is not distinct from new.due_on
 )) and (select count(*) from public.organization_staff_permissions where organization_id=new.organization_id and user_id=actor and revoked_at is null and permission in ('people.read','followup.read','followup.manage'))<>3 then
  raise exception 'Follow-up management permission required' using errcode='42501';
 end if;
 if tg_op='UPDATE' and (new.organization_id<>old.organization_id or new.person_id<>old.person_id or new.created_by<>old.created_by or new.id<>old.id or new.workflow_run_id is distinct from old.workflow_run_id) then
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
create function private.pause_changed_tag_workflow() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.department_id is distinct from old.department_id or new.task_title is distinct from old.task_title or new.due_after_days is distinct from old.due_after_days or not new.active then
  new.workflow_enabled:=false;
 end if;
 return new;
end $$;
create trigger workflow_rule_guard before update on public.organization_tags for each row execute function private.pause_changed_tag_workflow();

create function private.configure_tag_workflow(p_org uuid,p_tag uuid,p_revision integer,p_enabled boolean,p_timezone text,p_reentry text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); t public.organization_tags; d public.organization_departments;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Verified administrator required' using errcode='42501'; end if;
 if (select count(*) from public.organization_staff_permissions where organization_id=p_org and user_id=actor and revoked_at is null and permission in ('staff.manage','people.read','tags.read','tags.manage','followup.read','followup.manage'))<>6 then raise exception 'Workflow administrator authority required' using errcode='42501'; end if;
 select * into t from public.organization_tags where organization_id=p_org and id=p_tag for update;
 if not found then raise exception 'Tag unavailable' using errcode='42501'; end if;
 if t.revision is distinct from p_revision then raise exception 'Tag changed. Refresh before saving.' using errcode='40001'; end if;
 if p_enabled is null or p_reentry is null or p_reentry not in ('once_per_person','each_assignment') or p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Valid workflow settings required' using errcode='22023'; end if;
 select * into d from public.organization_departments where organization_id=p_org and id=t.department_id for update;
 if p_enabled then
  if not t.active or not d.active or length(btrim(t.task_title))>180 then raise exception 'Active tag and department with task title of at most 180 characters required' using errcode='23514'; end if;
  if d.leader_user_id is null or not exists(select 1 from auth.users where id=d.leader_user_id and email_confirmed_at is not null and not coalesce(is_anonymous,false)) or
   (select count(*) from public.organization_staff_permissions where organization_id=p_org and user_id=d.leader_user_id and revoked_at is null and permission in ('people.read','followup.read'))<>2 then raise exception 'Eligible department leader required' using errcode='23514'; end if;
 end if;
 update public.organization_tags set workflow_enabled=p_enabled,workflow_timezone=p_timezone,workflow_reentry=p_reentry where id=t.id returning * into t;
 return jsonb_build_object('revision',t.revision,'enabled',t.workflow_enabled);
end $$;

-- Private executor. All callers are privileged trigger code or the independently authorized recovery RPC.
create function private.execute_tag_workflow(p_run uuid,p_actor uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.tag_workflow_runs; a public.organization_person_tags; t public.organization_tags; d public.organization_departments; problem text;
begin
 if p_actor is null or p_actor is distinct from auth.uid() then raise exception 'Actor mismatch' using errcode='42501'; end if;
 select * into r from public.tag_workflow_runs where id=p_run;
 if not found then raise exception 'Run unavailable' using errcode='42501'; end if;
 -- Same parent lock order as tag assignment; row lock serializes retries.
 select * into a from public.organization_person_tags where id=r.assignment_id for update;
 select * into t from public.organization_tags where id=r.tag_id for update;
 select * into d from public.organization_departments where id=r.department_id for update;
 select * into r from public.tag_workflow_runs where id=p_run for update;
 if r.status not in ('pending','needs_review') then return; end if;
 if not a.active then problem:='assignment_removed';
 elsif a.revision<>(r.rule_snapshot->>'assignment_revision')::integer then problem:='assignment_superseded';
 elsif not t.active or not d.active or not t.workflow_enabled then problem:='workflow_paused';
 elsif t.department_id<>r.department_id then problem:='department_changed';
 elsif (r.rule_snapshot->>'reentry')='once_per_person' and exists(select 1 from public.tag_workflow_runs x where x.organization_id=r.organization_id and x.tag_id=r.tag_id and x.person_id=r.person_id and x.id<>r.id and x.status='task_created') then problem:='already_processed';
 elsif d.leader_user_id is null or not exists(select 1 from auth.users where id=d.leader_user_id and email_confirmed_at is not null and not coalesce(is_anonymous,false)) or
  (select count(*) from public.organization_staff_permissions where organization_id=r.organization_id and user_id=d.leader_user_id and revoked_at is null and permission in ('people.read','followup.read'))<>2 then problem:='leader_unavailable';
 end if;
 update public.tag_workflow_runs set attempts=attempts+1,execution_actor_user_id=p_actor,updated_at=clock_timestamp(),revision=revision+1 where id=r.id;
 if problem is not null then
  update public.tag_workflow_runs set status=case when problem in ('assignment_removed','assignment_superseded','already_processed') then 'skipped' else 'needs_review' end,reason=problem where id=r.id;
 else
  -- Savepoint: failed task creation rolls back its audit and leaves a reviewable run.
  begin
   update public.tag_workflow_runs set status='building',leader_user_id=d.leader_user_id,reason=null where id=r.id;
   insert into public.followup_tasks(id,organization_id,person_id,title,due_on,assigned_user_id,workflow_run_id)
    values(r.reserved_task_id,r.organization_id,r.person_id,r.task_title,r.due_on,d.leader_user_id,r.id);
   insert into public.tag_workflow_notifications(organization_id,run_id,recipient_user_id) values(r.organization_id,r.id,d.leader_user_id);
   update public.tag_workflow_runs set status='task_created',task_id=r.reserved_task_id where id=r.id;
  exception when others then
   update public.tag_workflow_runs set status='needs_review',reason='task_creation_failed' where id=r.id;
  end;
 end if;
 insert into public.tag_workflow_events(organization_id,run_id,actor_user_id,action,details)
 select organization_id,id,p_actor,'processed',jsonb_build_object('status',status,'reason',reason,'attempt',attempts,'leader_user_id',leader_user_id,'task_id',task_id) from public.tag_workflow_runs where id=r.id;
end $$;

create function private.enqueue_tag_workflow() returns trigger language plpgsql security definer set search_path='' as $$
declare t public.organization_tags; d public.organization_departments; run_id uuid;
begin
 if new.kind<>'tag_assigned' then return new; end if;
 select * into t from public.organization_tags where organization_id=new.organization_id and id=(new.after_state->>'tag_id')::uuid;
 if not t.workflow_enabled then return new; end if;
 select * into d from public.organization_departments where organization_id=new.organization_id and id=t.department_id;
 insert into public.tag_workflow_runs(organization_id,event_id,assignment_id,tag_id,person_id,department_id,source_actor_user_id,rule_snapshot,task_title,due_on)
 values(new.organization_id,new.id,new.subject_id,t.id,(new.after_state->>'person_id')::uuid,t.department_id,new.actor_user_id,
  jsonb_build_object('assignment_revision',(new.after_state->>'revision')::integer,'tag_name',t.name,'tag_revision',t.revision,'department_name',d.name,'department_revision',d.revision,'leader_user_id',d.leader_user_id,'title',t.task_title,'due_after_days',t.due_after_days,'timezone',t.workflow_timezone,'reentry',t.workflow_reentry),
  t.task_title,case when t.due_after_days is null then null else (new.created_at at time zone t.workflow_timezone)::date+t.due_after_days end)
 on conflict(event_id) do nothing returning id into run_id;
 if run_id is not null then perform private.execute_tag_workflow(run_id,auth.uid()); end if;
 return new;
end $$;
create trigger enqueue_tag_workflow after insert on public.organization_tag_events for each row execute function private.enqueue_tag_workflow();

create function private.resolve_tag_workflow(p_org uuid,p_run uuid,p_revision integer,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();r public.tag_workflow_runs;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Verified staff required' using errcode='42501'; end if;
 if (select count(*) from public.organization_staff_permissions where organization_id=p_org and user_id=actor and revoked_at is null and permission in ('people.read','tags.read','tags.manage','followup.read','followup.manage'))<>5 then raise exception 'Workflow management required' using errcode='42501'; end if;
 select * into r from public.tag_workflow_runs where organization_id=p_org and id=p_run;
 if not found then raise exception 'Run unavailable' using errcode='42501'; end if;
 perform 1 from public.organization_person_tags where id=r.assignment_id for update;
 perform 1 from public.organization_tags where id=r.tag_id for update;
 perform 1 from public.organization_departments where id=r.department_id for update;
 select * into r from public.tag_workflow_runs where id=p_run for update;
 if r.revision is distinct from p_revision then raise exception 'Workflow changed. Refresh.' using errcode='40001'; end if;
 if p_action='retry' and r.status='needs_review' then perform private.execute_tag_workflow(r.id,actor);
 elsif p_action='dismiss' and r.status='needs_review' then
  update public.tag_workflow_runs set status='dismissed',reason='staff_dismissed',revision=revision+1,updated_at=clock_timestamp() where id=r.id;
  insert into public.tag_workflow_events(organization_id,run_id,actor_user_id,action) values(p_org,r.id,actor,'dismissed');
 elsif p_action='cancel_email' and r.status='task_created' then
  update public.tag_workflow_notifications set status='canceled',revision=revision+1,updated_at=clock_timestamp() where run_id=r.id and status='held';
  if not found then raise exception 'No held email request' using errcode='22023'; end if;
  update public.tag_workflow_runs set revision=revision+1,updated_at=clock_timestamp() where id=r.id;
  insert into public.tag_workflow_events(organization_id,run_id,actor_user_id,action) values(p_org,r.id,actor,'email_canceled');
 else raise exception 'Action unavailable for this workflow' using errcode='22023'; end if;
 select * into r from public.tag_workflow_runs where id=p_run;
 return jsonb_build_object('id',r.id,'status',r.status,'revision',r.revision);
end $$;

create function public.configure_tag_workflow(p_org uuid,p_tag uuid,p_revision integer,p_enabled boolean,p_timezone text,p_reentry text) returns jsonb language sql security invoker set search_path='' as $$select private.configure_tag_workflow(p_org,p_tag,p_revision,p_enabled,p_timezone,p_reentry)$$;
create function public.resolve_tag_workflow(p_org uuid,p_run uuid,p_revision integer,p_action text) returns jsonb language sql security invoker set search_path='' as $$select private.resolve_tag_workflow(p_org,p_run,p_revision,p_action)$$;
revoke all on function private.pause_changed_tag_workflow(),private.execute_tag_workflow(uuid,uuid),private.enqueue_tag_workflow() from public,anon,authenticated;
revoke all on function private.configure_tag_workflow(uuid,uuid,integer,boolean,text,text),private.resolve_tag_workflow(uuid,uuid,integer,text),public.configure_tag_workflow(uuid,uuid,integer,boolean,text,text),public.resolve_tag_workflow(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function private.configure_tag_workflow(uuid,uuid,integer,boolean,text,text),private.resolve_tag_workflow(uuid,uuid,integer,text),public.configure_tag_workflow(uuid,uuid,integer,boolean,text,text),public.resolve_tag_workflow(uuid,uuid,integer,text) to authenticated;

-- A held notification must not outlive the task assignment it describes.
create function private.cancel_changed_workflow_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.workflow_run_id is not null and (new.assigned_user_id is distinct from old.assigned_user_id or new.status<>'open') then
  perform 1 from public.tag_workflow_runs where id=new.workflow_run_id for update;
  update public.tag_workflow_notifications set status='canceled',revision=revision+1,updated_at=clock_timestamp() where run_id=new.workflow_run_id and status='held';
  if found then
   update public.tag_workflow_runs set revision=revision+1,updated_at=clock_timestamp() where id=new.workflow_run_id;
   insert into public.tag_workflow_events(organization_id,run_id,actor_user_id,action) values(new.organization_id,new.workflow_run_id,auth.uid(),'email_canceled_task_changed');
  end if;
 end if;
 return new;
end $$;
revoke all on function private.cancel_changed_workflow_notification() from public,anon,authenticated;
create trigger cancel_changed_workflow_notification after update on public.followup_tasks for each row execute function private.cancel_changed_workflow_notification();
