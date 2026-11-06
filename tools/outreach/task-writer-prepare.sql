-- DISPOSABLE-LOCAL CONTRACT PROTOTYPE ONLY. Not a migration or release installer.
-- No public wrapper, runtime mount, grants, producer, UPDATE, or enablement flag.
-- PR105 protections are retained unchanged. HELD is not write authorization.
begin;
create function private.task_writer_prepare(p_request jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' set lock_timeout='2s' as $$
declare b private.campaign_person_task_bindings;t public.followup_tasks;
 f public.outreach_decision_followup; actor uuid; sid uuid; intent jsonb; expected jsonb;
 uuid_keys text[]:=array['actor_id','session_id','organization_id','campaign_id','registration_id','person_id','account_id','task_id','binding_id','intent_id'];
 keys text[]:=array['actor_id','session_id','organization_id','campaign_id','registration_id','person_id','account_id','task_id','binding_id','intent_id','source','expected','intent'];
 revisions text[]:=array['task_revision','binding_revision','campaign_registrant_revision','portal_link_revision','followup_revision'];k text;due date;
begin
 if jsonb_typeof(p_request) is distinct from 'object' or octet_length(p_request::text)>3000
  or not(p_request ?& keys) or (select count(*) from jsonb_object_keys(p_request))<>cardinality(keys) then
  raise exception 'Exact task intent required' using errcode='22023';end if;
 foreach k in array uuid_keys loop
  if jsonb_typeof(p_request->k) is distinct from 'string' or p_request->>k !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then
   raise exception 'Exact task intent required' using errcode='22023';end if;
 end loop;
 if jsonb_typeof(p_request->'source') is distinct from 'string' or length(p_request->>'source') not between 1 and 200 then
  raise exception 'Exact source required' using errcode='22023';end if;
 expected:=p_request->'expected';intent:=p_request->'intent';
 if jsonb_typeof(expected) is distinct from 'object' or not(expected ?& revisions)
  or (select count(*) from jsonb_object_keys(expected))<>cardinality(revisions) then
  raise exception 'Exact revisions required' using errcode='22023';end if;
 foreach k in array revisions loop
  if jsonb_typeof(expected->k) is distinct from 'number' or expected->>k !~ '^[1-9][0-9]{0,8}$' then
   raise exception 'Exact revisions required' using errcode='22023';end if;
 end loop;
 if jsonb_typeof(intent) is distinct from 'object' or not(intent ?& array['status','due_on'])
  or (select count(*) from jsonb_object_keys(intent))<>2
  or jsonb_typeof(intent->'status') is distinct from 'string' or intent->>'status' not in('open','completed','canceled')
  or (intent->'due_on'<>'null'::jsonb and (jsonb_typeof(intent->'due_on') is distinct from 'string' or intent->>'due_on' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')) then
  raise exception 'Neutral task intent required' using errcode='22023';end if;
 begin due:=(intent->>'due_on')::date;exception when datetime_field_overflow or invalid_datetime_format then
  raise exception 'Valid due date required' using errcode='22023';end;
 intent:=jsonb_build_object('status',intent->>'status','due_on',due);
 -- Task first matches PR105 binding, event and financial/tag attachment fencing.
 -- Never upgrade a SHARE task lock after acquiring binding/authority locks.
 select * into t from public.followup_tasks where id=(p_request->>'task_id')::uuid for update;
 select * into b from private.campaign_person_task_bindings where id=(p_request->>'binding_id')::uuid and task_id=t.id for share;
 if b.id is null or t.id is null then raise exception 'Task unavailable' using errcode='42501';end if;
 actor:=private.campaign_foundation_session();sid:=(auth.jwt()->>'session_id')::uuid;
 if actor is distinct from (p_request->>'actor_id')::uuid or sid is distinct from (p_request->>'session_id')::uuid
  or b.organization_id is distinct from (p_request->>'organization_id')::uuid
  or b.campaign_id is distinct from (p_request->>'campaign_id')::uuid
  or b.registration_id is distinct from (p_request->>'registration_id')::uuid
  or b.person_id is distinct from (p_request->>'person_id')::uuid
  or b.account_id is distinct from (p_request->>'account_id')::uuid
  or b.source is distinct from p_request->>'source'
  or private.campaign_person_task_access(b.organization_id,t.id,false) is distinct from true
  or not private.operational_followup_visible(b.organization_id,t.id) then
  raise exception 'Task unavailable' using errcode='42501';end if;
 -- Existing access helper locks session, directory, all permission rows, campaign,
 -- assignment, source mapping, followup, registration, registrant/person/link/users
 -- and their portal audit evidence. Add current organization-wide manage authority.
 if not exists(select 1 from public.organization_staff_permissions where organization_id=b.organization_id and user_id=actor
  and permission='followup.manage' and department_ids is null and revoked_at is null
  and effective_at<=clock_timestamp() and (expires_at is null or expires_at>clock_timestamp())) then
  raise exception 'Task unavailable' using errcode='42501';end if;
 select * into f from public.outreach_decision_followup where registration_id=b.registration_id for share;
 if t.organization_id<>b.organization_id or t.person_id<>b.person_id or t.title<>'Outreach follow-up'
  or t.assigned_user_id is distinct from actor or t.workflow_run_id is not null then
  raise exception 'Task unavailable' using errcode='42501';end if;
 if t.revision<>(expected->>'task_revision')::integer or b.revision<>(expected->>'binding_revision')::integer
  or b.campaign_registrant_revision<>(expected->>'campaign_registrant_revision')::integer
  or b.portal_link_revision<>(expected->>'portal_link_revision')::integer
  or f.revision<>(expected->>'followup_revision')::integer then
  raise exception 'Task dependencies changed' using errcode='40001';end if;
 -- Recheck time-sensitive authority after every potentially blocking acquisition.
 if private.campaign_person_task_access(b.organization_id,t.id,false) is distinct from true
  or not exists(select 1 from public.organization_staff_permissions where organization_id=b.organization_id and user_id=actor
   and permission='followup.manage' and department_ids is null and revoked_at is null
   and effective_at<=clock_timestamp() and (expires_at is null or expires_at>clock_timestamp())) then
  raise exception 'Task unavailable' using errcode='42501';end if;
 perform private.campaign_foundation_session();
 return jsonb_build_object('state','HELD','can_authorize',false,'can_commit',false,'automatic_retry',false,
  'reason','INDEPENDENT_PROVENANCE_AND_REVIEWER_NOT_ACCEPTED','actor_id',actor,'session_id',sid,
  'intent_id',p_request->>'intent_id','task_id',t.id,'binding_id',b.id,'expected',expected,'intent',intent,
  'intent_sha256',encode(sha256(convert_to(p_request::text,'UTF8')),'hex'));
end$$;
revoke all on function private.task_writer_prepare(jsonb) from public,anon,authenticated,service_role;
commit;
