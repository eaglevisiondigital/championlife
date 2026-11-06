-- TEST-ONLY transaction experiment. Load solely into createCampaignTaskFixture's
-- disposable Unix-socket database. NOT a migration, producer or operational ledger.
-- Ordinary fictional task controls only; no bound-task writer is introduced.
begin;
create schema task_intent_fixture;
revoke all on schema task_intent_fixture from public,anon,authenticated,service_role;
create table task_intent_fixture.intents (
 intent_id uuid primary key,
 actor_id uuid not null references auth.users(id),
 session_id uuid not null references auth.sessions(id),
 organization_id uuid not null references public.organizations(id),
 person_id uuid not null,
 task_id uuid not null references public.followup_tasks(id),
 expected_revision integer not null check(expected_revision>0),
 intent_status text not null check(intent_status in('open','completed','canceled')),
 intent_due_on date check(isfinite(intent_due_on)),
 captured_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id)
);
create table task_intent_fixture.receipts (
 intent_id uuid primary key references task_intent_fixture.intents(intent_id),
 event_id uuid not null unique references public.followup_task_events(id),
 recorded_at timestamptz not null default clock_timestamp(),
 fixture_result text not null default 'LAB_OBSERVED_COMMIT' check(fixture_result='LAB_OBSERVED_COMMIT')
);
-- The FK is referential integrity only. It does NOT prove same-transaction
-- coupling, event/request correspondence or terminal/no-pending authority.
alter table task_intent_fixture.intents enable row level security;
alter table task_intent_fixture.receipts enable row level security;
revoke all on all tables in schema task_intent_fixture from public,anon,authenticated,service_role;
create function task_intent_fixture.immutable() returns trigger
language plpgsql set search_path='' as $$begin
 raise exception 'Fixture intent and receipt history is immutable' using errcode='42501';
end$$;
create trigger intent_immutable before update or delete on task_intent_fixture.intents
 for each row execute function task_intent_fixture.immutable();
create trigger receipt_immutable before update or delete on task_intent_fixture.receipts
 for each row execute function task_intent_fixture.immutable();
create trigger intent_no_truncate before truncate on task_intent_fixture.intents
 for each statement execute function task_intent_fixture.immutable();
create trigger receipt_no_truncate before truncate on task_intent_fixture.receipts
 for each statement execute function task_intent_fixture.immutable();

-- Narrow lab capture only: no client actor/session fields, no canonical task DML,
-- and no receipt writer. Its immutable full-column comparison is not a hash proof.
-- Global intent UUID uniqueness is a conservative lab constraint, not a decision
-- about production idempotency scope, account-switching, retention or key reuse.
create function task_intent_fixture.capture(p_intent uuid,p_task uuid,p_revision integer,p_status text,p_due date)
returns jsonb language plpgsql volatile set search_path='' set lock_timeout='2s' as $$
declare t public.followup_tasks; actor uuid; sid uuid; prior task_intent_fixture.intents; inserted boolean;
begin
 if p_intent is null or p_task is null or p_revision is null or p_revision<=0
  or p_status is null or p_status not in('open','completed','canceled') or not coalesce(isfinite(p_due),true) then
  raise exception 'Exact finite fixture intent required' using errcode='22023';end if;
 -- Task first, then intent uniqueness. Full administrative lock ordering and a
 -- final authorization fence remain separate unimplemented production gates.
 select * into t from public.followup_tasks where id=p_task for update;
 actor:=private.campaign_foundation_session();sid:=(auth.jwt()->>'session_id')::uuid;
 if t.id is null or t.assigned_user_id is distinct from actor or t.title<>'Outreach follow-up'
  or t.workflow_run_id is not null or exists(select 1 from private.campaign_person_task_bindings where task_id=t.id)
  or not private.operational_followup_visible(t.organization_id,t.id)
  or not private.has_staff_permission(t.organization_id,'followup.manage') then
  raise exception 'Ordinary fixture task unavailable' using errcode='42501';end if;
 insert into task_intent_fixture.intents(intent_id,actor_id,session_id,organization_id,person_id,task_id,expected_revision,intent_status,intent_due_on)
 values(p_intent,actor,sid,t.organization_id,t.person_id,t.id,p_revision,p_status,p_due)
 on conflict(intent_id) do nothing;
 inserted:=found;
 select * into strict prior from task_intent_fixture.intents where intent_id=p_intent for share;
 if (prior.actor_id,prior.session_id,prior.organization_id,prior.person_id,prior.task_id,prior.expected_revision,prior.intent_status,prior.intent_due_on)
  is distinct from (actor,sid,t.organization_id,t.person_id,t.id,p_revision,p_status,p_due) then
  raise exception 'Fixture intent reuse conflict' using errcode='22023';end if;
 if inserted and t.revision<>p_revision then raise exception 'Fixture task revision changed' using errcode='40001';end if;
 perform private.campaign_foundation_session();
 return jsonb_build_object('state','UNKNOWN','can_authorize',false,'can_commit',false,'automatic_retry',false,
  'terminal_verified',false,'fixture_observation',case when inserted then 'CAPTURED_ONLY' else 'EXACT_INTENT_ONLY' end);
end$$;
revoke all on all functions in schema task_intent_fixture from public,anon,authenticated,service_role;
commit;
