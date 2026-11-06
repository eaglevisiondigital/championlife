-- DISPOSABLE LAB EXTENSION ONLY. Load after task-intent-fixture.sql.
-- No migration, API grant, production terminal state or bound-task writer.
-- Existing immutable intents are the admission rows; no parallel task system.
begin;
create table task_intent_fixture.executions (
 intent_id uuid not null references task_intent_fixture.intents(intent_id),
 observation_xid xid8 not null,
 task_id uuid not null references public.followup_tasks(id),
 before_state jsonb not null,
 after_state jsonb not null,
 primary key(intent_id,observation_xid),
 unique(task_id,observation_xid)
);
create table task_intent_fixture.settlements (
 intent_id uuid primary key references task_intent_fixture.intents(intent_id),
 observation text not null check(observation in('LAB_REJECTED','LAB_EVENT_OBSERVED')),
 event_id uuid unique references public.followup_task_events(id),
 check((observation='LAB_EVENT_OBSERVED')=(event_id is not null))
);
alter table task_intent_fixture.executions enable row level security;
alter table task_intent_fixture.settlements enable row level security;
revoke all on task_intent_fixture.executions,task_intent_fixture.settlements from public,anon,authenticated,service_role;
create trigger execution_immutable before update or delete on task_intent_fixture.executions
 for each row execute function task_intent_fixture.immutable();
create trigger execution_no_truncate before truncate on task_intent_fixture.executions
 for each statement execute function task_intent_fixture.immutable();
create trigger settlement_immutable before update or delete on task_intent_fixture.settlements
 for each row execute function task_intent_fixture.immutable();
create trigger settlement_no_truncate before truncate on task_intent_fixture.settlements
 for each statement execute function task_intent_fixture.immutable();

-- All fixture paths retain task -> intent order. The unlocked first read only
-- obtains immutable identity; it never grants execution or settles an outcome.
-- capture itself also takes task first, then uniqueness/intent SHARE lock.
create function task_intent_fixture.lock_admission(p_id uuid)
returns task_intent_fixture.intents language plpgsql volatile set search_path='' set lock_timeout='2s' as $$
declare i task_intent_fixture.intents;
begin
 select * into i from task_intent_fixture.intents where intent_id=p_id;
 if not found then raise exception 'Existing lab admission required' using errcode='22023';end if;
 perform task_intent_fixture.capture(i.intent_id,i.task_id,i.expected_revision,i.intent_status,i.intent_due_on);
 select * into strict i from task_intent_fixture.intents where intent_id=p_id for update;
 return i;
end$$;

-- Arms observation only. The native harness, not this function, updates an
-- ordinary canonical task through its unchanged guards and audit trigger.
create function task_intent_fixture.arm(p_id uuid) returns void
language plpgsql volatile set search_path='' set lock_timeout='2s' as $$
declare i task_intent_fixture.intents;t public.followup_tasks;
begin
 i:=task_intent_fixture.lock_admission(p_id);
 if exists(select 1 from task_intent_fixture.settlements where intent_id=p_id) then
  raise exception 'Lab admission already settled' using errcode='55000';end if;
 select * into strict t from public.followup_tasks where id=i.task_id;
 if t.revision<>i.expected_revision then raise exception 'Lab task revision changed' using errcode='40001';end if;
 insert into task_intent_fixture.executions(intent_id,observation_xid,task_id,before_state,after_state)
 values(i.intent_id,pg_current_xact_id(),i.task_id,
  jsonb_build_object('title',t.title,'status',t.status,'due_on',t.due_on,'assigned_user_id',t.assigned_user_id,'revision',t.revision),
  jsonb_build_object('title',t.title,'status',i.intent_status,'due_on',i.intent_due_on,'assigned_user_id',t.assigned_user_id,'revision',t.revision+1));
end$$;

create function task_intent_fixture.reject_admission(p_id uuid) returns void
language plpgsql volatile set search_path='' set lock_timeout='2s' as $$
declare i task_intent_fixture.intents;s task_intent_fixture.settlements;
begin
 i:=task_intent_fixture.lock_admission(p_id);
 select * into s from task_intent_fixture.settlements where intent_id=p_id;
 if found then
  if s.observation='LAB_REJECTED' then return;end if;
  raise exception 'Observed lab event cannot become rejection' using errcode='55000';
 end if;
 insert into task_intent_fixture.settlements(intent_id,observation)values(i.intent_id,'LAB_REJECTED');
end$$;

-- Receipt insertion is now possible only from the lab observer nested beneath
-- the unchanged canonical task audit trigger. This depth check constrains the
-- reviewed fixture call graph; it is NOT protection against a schema owner who
-- installs different triggers. Full old/new identity is compared, not a hash.
create function task_intent_fixture.corresponding_receipt() returns trigger
language plpgsql set search_path='' as $$
declare i task_intent_fixture.intents;x task_intent_fixture.executions;e public.followup_task_events;
begin
 if pg_trigger_depth()<>3 then raise exception 'Canonical lab observer required' using errcode='42501';end if;
 select * into strict i from task_intent_fixture.intents where intent_id=new.intent_id;
 select * into x from task_intent_fixture.executions where intent_id=i.intent_id and observation_xid=pg_current_xact_id();
 select * into e from public.followup_task_events where id=new.event_id;
 if x.intent_id is null or e.id is null or exists(select 1 from task_intent_fixture.settlements where intent_id=i.intent_id)
  or (e.organization_id,e.task_id,e.actor_user_id,e.action,e.before_state,e.after_state)
   is distinct from (i.organization_id,i.task_id,i.actor_id,'updated'::text,x.before_state,x.after_state) then
  raise exception 'Exact current lab event required' using errcode='22023';end if;
 return new;
end$$;
create trigger corresponding_receipt before insert on task_intent_fixture.receipts
 for each row execute function task_intent_fixture.corresponding_receipt();

create function task_intent_fixture.consistent_settlement() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.observation='LAB_EVENT_OBSERVED' then
  if pg_trigger_depth()<>3 or not exists(select 1 from task_intent_fixture.receipts
   where intent_id=new.intent_id and event_id=new.event_id) then
   raise exception 'Corresponding observed lab receipt required' using errcode='42501';end if;
 elsif exists(select 1 from task_intent_fixture.receipts where intent_id=new.intent_id) then
  raise exception 'Existing lab receipt cannot become rejection' using errcode='55000';
 end if;
 return new;
end$$;
create trigger consistent_settlement before insert on task_intent_fixture.settlements
 for each row execute function task_intent_fixture.consistent_settlement();

create function task_intent_fixture.observe_canonical_event() returns trigger
language plpgsql set search_path='' as $$
declare x task_intent_fixture.executions;i task_intent_fixture.intents;
begin
 select * into x from task_intent_fixture.executions where task_id=new.task_id and observation_xid=pg_current_xact_id();
 if not found then return new;end if;
 if pg_trigger_depth()<>2 then raise exception 'Canonical task trigger required' using errcode='42501';end if;
 i:=task_intent_fixture.lock_admission(x.intent_id);
 if (new.organization_id,new.task_id,new.actor_user_id,new.action,new.before_state,new.after_state)
  is distinct from (i.organization_id,i.task_id,i.actor_id,'updated'::text,x.before_state,x.after_state) then
  raise exception 'Canonical event differs from admitted lab intent' using errcode='22023';end if;
 insert into task_intent_fixture.receipts(intent_id,event_id)values(i.intent_id,new.id);
 insert into task_intent_fixture.settlements(intent_id,observation,event_id)values(i.intent_id,'LAB_EVENT_OBSERVED',new.id);
 return new;
end$$;
-- Instrumentation only: existing task guard/audit functions and triggers stay.
create trigger task_admission_lab_observer after insert on public.followup_task_events
 for each row execute function task_intent_fixture.observe_canonical_event();
revoke all on all functions in schema task_intent_fixture from public,anon,authenticated,service_role;
commit;
