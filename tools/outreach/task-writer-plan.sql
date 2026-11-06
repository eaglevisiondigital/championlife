-- DISPOSABLE-LOCAL HELD DESIGN ONLY. No application DML, migration or API.
-- Captures an audit specification; it is neither an audit event nor authority.
begin;
create function private.task_writer_plan(p_request jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' set lock_timeout='2s' as $$
declare held jsonb;observation jsonb;t public.followup_tasks;before_state jsonb;after_state jsonb;
begin
 -- Existing preparation owns strict input validation, server actor/session,
 -- exact scope/five revisions and task-first current dual-authority locks.
 held:=private.task_writer_prepare(p_request);
 select * into strict t from public.followup_tasks where id=(held->>'task_id')::uuid;
 before_state:=jsonb_build_object('title',t.title,'status',t.status,'due_on',t.due_on,
  'assigned_user_id',t.assigned_user_id,'revision',t.revision);
 after_state:=jsonb_build_object('title',t.title,'status',held->'intent'->>'status',
  'due_on',held->'intent'->'due_on','assigned_user_id',t.assigned_user_id,'revision',t.revision+1);
 -- Reconciliation reuses current checks before AND after exact canonical history
 -- validation. Nothing trusts a previous prepare response or caller snapshot.
 observation:=private.task_writer_reconcile(p_request);
 if observation->>'observation' is distinct from 'EXPECTED_REVISIONS_CURRENT' then
  raise exception 'Canonical task history unavailable' using errcode='40001';
 end if;
 return jsonb_build_object('state','HELD','can_authorize',false,'can_commit',false,
  'automatic_retry',false,'terminal_verified',false,
  'reason','BOUND_WRITER_AND_FINAL_FENCE_NOT_ACCEPTED',
  'observation_transaction',pg_current_xact_id()::text,
  'actor_id',held->'actor_id','session_id',held->'session_id',
  'intent_id',held->'intent_id','intent_sha256',held->'intent_sha256',
  'expected',held->'expected','expected_event_count',1,
  'audit_specification',jsonb_build_object('organization_id',t.organization_id,'task_id',t.id,
   'actor_user_id',held->'actor_id','action','updated','before_state',before_state,'after_state',after_state));
end$$;
revoke all on function private.task_writer_plan(jsonb) from public,anon,authenticated,service_role;
commit;
