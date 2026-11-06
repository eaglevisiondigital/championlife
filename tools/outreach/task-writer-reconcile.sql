-- DISPOSABLE-LOCAL SOURCE CONTRACT ONLY. No migration, API, grants or DML.
-- An observation cannot identify an intent or prove that no transaction is pending.
begin;
create function private.task_writer_reconcile(p_request jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' set lock_timeout='2s' as $$
declare held jsonb;t public.followup_tasks;current_state jsonb;history_consistent boolean;
begin
 -- Reuse exact actor/session/scope/intent parsing, all five revision comparisons,
 -- task-first locking, fresh dual authority, consent and finite binding checks.
 held:=private.task_writer_prepare(p_request);
 select * into strict t from public.followup_tasks where id=(held->>'task_id')::uuid;
 current_state:=jsonb_build_object('title',t.title,'status',t.status,'due_on',t.due_on,
  'assigned_user_id',t.assigned_user_id,'revision',t.revision);
 -- PR105 event insertion/attachment guards acquire the task UPDATE lock first.
 -- The held task lock therefore stabilizes this history without a reverse lock.
 -- Require exactly one event for each revision, exact predecessor state, the
 -- canonical current state, and the server actor on the initial creation event.
 -- This is consistency evidence only: the event schema contains no intent UUID.
 with history as (
  select e.*,row_number() over(order by (e.after_state->>'revision')::integer,e.id) ordinal,
   lag(e.after_state) over(order by (e.after_state->>'revision')::integer,e.id) previous_state
  from public.followup_task_events e where e.task_id=t.id
 ) select count(*)=t.revision and coalesce(bool_and((
  organization_id=t.organization_id
  and (after_state->>'revision')::integer=ordinal
  and private.campaign_task_neutral_state(after_state,t.assigned_user_id)
  and case when ordinal=1 then action='created' and before_state is null and actor_user_id=t.created_by
   else action='updated' and before_state=previous_state end
  and (ordinal<>t.revision or after_state=current_state)
 ) is true),false) into history_consistent from history;
 -- Recheck wall-clock/session validity after history work. This remains an
 -- observation inside this transaction, never a deferred commit-time fence.
 perform private.task_writer_prepare(p_request);
 if history_consistent is distinct from true then
  return jsonb_build_object('state','UNKNOWN','can_authorize',false,'can_commit',false,
   'automatic_retry',false,'terminal_verified',false,'observation','CANONICAL_HISTORY_INCONSISTENT');
 end if;
 return jsonb_build_object('state','UNKNOWN','can_authorize',false,'can_commit',false,
  'automatic_retry',false,'terminal_verified',false,'observation','EXPECTED_REVISIONS_CURRENT',
  'task',jsonb_build_object('id',t.id,'status',t.status,'due_on',t.due_on,'revision',t.revision),
  'expected',held->'expected','canonical_history','ONE_EVENT_PER_REVISION',
  'intent_outcome','UNPROVEN');
end$$;
revoke all on function private.task_writer_reconcile(jsonb) from public,anon,authenticated,service_role;
commit;
