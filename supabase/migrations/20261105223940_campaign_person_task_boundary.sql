-- Source-only canonical-task enforcement. Empty proof store; NO association/task issuer.
-- Proof hashes are references to future independently accepted evidence, NOT verification.
-- There is no sanctioned producer, real reviewer designation or binding creation RPC.
-- All proof production and actual reviewer designation remain separately gated.
begin;
set local search_path=public;
do $$declare actual_catalog text;begin
 if to_regclass('private.campaign_person_task_bindings') is not null then raise exception 'Campaign task boundary already present; reconcile';end if;
 if to_regprocedure('private.campaign_foundation_session()') is null
 or to_regprocedure('private.operational_followup_visible(uuid,uuid)') is null
 or to_regprocedure('private.guard_followup_task()') is null
 or to_regclass('public.outreach_decision_followup') is null then raise exception 'Reviewed task/foundation prerequisites required';end if;
with rels as(select c.oid,n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) owner from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array['followup_tasks','followup_task_events','organization_people','portal_account_links','portal_admin_events','organization_staff_directory','organization_staff_permissions','outreach_campaigns','outreach_campaign_assignments','outreach_decision_campaign_sources','outreach_decision_followup','outreach_registrations','outreach_campaign_registrants','outreach_partner_intakes','tag_workflow_runs'])), fns as(select p.oid,n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_userbyid(p.proowner) owner,p.prosecdef,p.provolatile,p.proconfig,p.prosrc,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname=any(array['guard_followup_task','audit_followup_task','operational_followup_visible','campaign_foundation_session','has_staff_permission','staff_assignment_active','outreach_partner_workspace','outreach_immutable','set_portal_account_link'])) select jsonb_build_object('relations',(select jsonb_agg(jsonb_build_object('name',nspname||'.'||relname,'kind',relkind,'rls',relrowsecurity,'forced',relforcerowsecurity,'owner',owner,'columns',(select jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod),'notnull',attnotnull,'acl',attacl::text) order by attnum) from pg_attribute where attrelid=r.oid and attnum>0 and not attisdropped),'acl',(select relacl::text from pg_class where oid=r.oid),'constraints',(select jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid)) order by conname COLLATE "C") from pg_constraint where conrelid=r.oid),'policies',(select jsonb_agg(jsonb_build_object('name',polname,'permissive',polpermissive,'command',polcmd,'roles',(select jsonb_agg(case when x=0 then 'public' else pg_get_userbyid(x) end order by (case when x=0 then 'public' else pg_get_userbyid(x) end) COLLATE "C") from unnest(polroles)x),'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid)) order by polname COLLATE "C") from pg_policy where polrelid=r.oid),'triggers',(select jsonb_agg(jsonb_build_object('name',tgname,'enabled',tgenabled,'definition',pg_get_triggerdef(oid)) order by tgname COLLATE "C") from pg_trigger where tgrelid=r.oid and not tgisinternal)) order by nspname COLLATE "C",relname COLLATE "C") from rels r),'functions',(select jsonb_agg(to_jsonb(f)-'oid' order by nspname COLLATE "C",proname COLLATE "C",args COLLATE "C") from fns f))::text into actual_catalog;
 if encode(sha256(convert_to(actual_catalog,'UTF8')),'hex') <> 'caf383b0f0788d277449b0dd6ca3a19dcb0b4f818b5106b059be35848ad375d6' then raise exception 'Reviewed canonical task catalog drift; stop and reconcile';end if;
end$$;
create table private.campaign_person_task_bindings (
 id uuid primary key default gen_random_uuid(), task_id uuid not null unique references public.followup_tasks(id),
 organization_id uuid not null references public.organizations(id),campaign_id uuid not null,registration_id uuid not null unique,
 person_id uuid not null,account_id uuid not null references auth.users(id),
 portal_link_id uuid not null references public.portal_account_links(id),portal_link_revision integer not null check(portal_link_revision>0),
 campaign_registrant_id uuid not null references public.outreach_campaign_registrants(id),campaign_registrant_revision integer not null check(campaign_registrant_revision>0),
 source text not null,source_evidence_sha256 text not null check(source_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 identity_evidence_sha256 text not null check(identity_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 adult_evidence_sha256 text check(adult_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 reviewer_authority_sha256 text not null check(reviewer_authority_sha256 ~ '^[a-f0-9]{64}$'),
 requested_by uuid not null references auth.users(id),reviewed_by uuid not null references auth.users(id),
 reviewed_at timestamptz not null,valid_until timestamptz not null,
 eligibility text not null check(eligibility in('verified_adult','unknown','minor','conflict')),
 revision integer not null default 1 check(revision>0),revoked_at timestamptz,revocation_sha256 text,
 foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id),
 foreign key(campaign_id,registration_id) references public.outreach_decision_followup(campaign_id,registration_id),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),
 check(requested_by<>reviewed_by),check(isfinite(reviewed_at) and isfinite(valid_until) and reviewed_at<valid_until),
 check((revoked_at is null)=(revocation_sha256 is null)),check(revocation_sha256 is null or revocation_sha256 ~ '^[a-f0-9]{64}$')
);
create table private.campaign_person_task_binding_events (
 id uuid primary key default gen_random_uuid(),binding_id uuid not null references private.campaign_person_task_bindings(id),
 action text not null check(action in('reviewed_binding_recorded','binding_withdrawn')),
 revision integer not null,reviewed_by uuid not null references auth.users(id),recorded_by uuid not null references auth.users(id),evidence_sha256 text not null,
 recorded_at timestamptz not null default clock_timestamp()
);
alter table private.campaign_person_task_bindings enable row level security;
alter table private.campaign_person_task_binding_events enable row level security;
revoke all on private.campaign_person_task_bindings,private.campaign_person_task_binding_events from public,anon,authenticated,service_role;
create trigger campaign_task_binding_events_immutable before update or delete on private.campaign_person_task_binding_events
 for each row execute function private.outreach_immutable();
create trigger campaign_task_binding_events_no_truncate before truncate on private.campaign_person_task_binding_events
 for each statement execute function private.outreach_immutable();

-- Minimal existing task/event history must already be neutral; never rewrite history.
create function private.campaign_task_neutral_state(s jsonb,p_worker uuid) returns boolean
language sql immutable set search_path='' as $$
 select s is null or (jsonb_typeof(s)='object' and
  not exists(select 1 from jsonb_object_keys(s) k where k not in('title','status','due_on','assigned_user_id','revision'))
  and s->>'title'='Outreach follow-up' and s->>'status' in('open','completed','canceled')
  and s->>'assigned_user_id'=p_worker::text and jsonb_typeof(s->'revision')='number'
  and s->>'revision' ~ '^[1-9][0-9]*$'
  and (s->>'due_on' is null or s->>'due_on' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'))
$$;
create function private.campaign_task_binding_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare t public.followup_tasks;actor uuid;
begin
 actor:=private.campaign_foundation_session();
 if tg_op='INSERT' and actor is distinct from new.reviewed_by then raise exception 'Authenticated independent reviewer required' using errcode='42501';end if;
 if tg_op='DELETE' then raise exception 'Binding history cannot be removed' using errcode='42501';end if;
 if tg_op='UPDATE' then
  if (to_jsonb(new)-'revoked_at'-'revocation_sha256'-'revision') is distinct from (to_jsonb(old)-'revoked_at'-'revocation_sha256'-'revision')
   or old.revoked_at is not null or new.revoked_at is null or new.revocation_sha256 is null or not isfinite(new.revoked_at)
   or new.revoked_at>clock_timestamp() or new.revision<>old.revision+1 then
   raise exception 'Only irreversible audited binding withdrawal is supported' using errcode='42501';end if;
  return new;
 end if;
 if new.revision<>1 or new.revoked_at is not null then raise exception 'New reviewed binding required' using errcode='22023';end if;
 select * into t from public.followup_tasks where id=new.task_id for update;
 if t.id is null or t.organization_id<>new.organization_id or t.person_id<>new.person_id or t.title<>'Outreach follow-up'
  or t.assigned_user_id is distinct from new.requested_by or t.workflow_run_id is not null then
  raise exception 'Existing neutral canonical task required' using errcode='42501';end if;
 if exists(select 1 from public.followup_task_events e where e.task_id=t.id and
  (e.organization_id<>new.organization_id or e.action not in('created','updated')
   or private.campaign_task_neutral_state(e.before_state,new.requested_by) is distinct from true
   or private.campaign_task_neutral_state(e.after_state,new.requested_by) is distinct from true))
  or not exists(select 1 from public.followup_task_events e where e.task_id=t.id and e.action='created')
  or exists(select 1 from public.outreach_partner_intakes i where i.followup_task_id=t.id)
  or exists(select 1 from public.tag_workflow_runs r where r.task_id=t.id or r.reserved_task_id=t.id) then
  raise exception 'Historical task provenance is not neutral or separately scoped' using errcode='42501';end if;
 return new;
end$$;
create trigger campaign_task_binding_guard before insert or update or delete on private.campaign_person_task_bindings
 for each row execute function private.campaign_task_binding_guard();
create trigger campaign_task_bindings_no_truncate before truncate on private.campaign_person_task_bindings
 for each statement execute function private.outreach_immutable();
create function private.campaign_task_binding_audit() returns trigger
language plpgsql security definer set search_path='' as $$begin
 insert into private.campaign_person_task_binding_events(binding_id,action,revision,reviewed_by,recorded_by,evidence_sha256)
 values(new.id,case when tg_op='INSERT' then 'reviewed_binding_recorded' else 'binding_withdrawn' end,new.revision,new.reviewed_by,auth.uid(),
  case when tg_op='INSERT' then new.identity_evidence_sha256 else new.revocation_sha256 end);return new;
end$$;
create trigger campaign_task_binding_audit after insert or update on private.campaign_person_task_bindings
 for each row execute function private.campaign_task_binding_audit();

-- No role-name inference. These exact server-owned proofs have no API producer.
-- Current actor requires BOTH independent canonical and assigned campaign authority.
create function private.campaign_person_task_access(p_org uuid,p_task uuid,p_manage boolean default false) returns boolean
language plpgsql volatile security definer set search_path='' set lock_timeout='2s' as $$
declare b private.campaign_person_task_bindings;actor uuid;d public.organization_staff_directory;
 a public.outreach_campaign_assignments;f public.outreach_decision_followup;r public.outreach_registrations;
 needed text[]:=array['people.read','followup.read'];n integer;source_value text;found_link boolean;deadline timestamptz;
begin
 select * into b from private.campaign_person_task_bindings where task_id=p_task for share;
 if not found then return true;end if; -- Unrelated canonical tasks retain their existing RLS/guards.
 if p_manage then return false;end if; -- Read-only increment: no mandatory-CAS campaign task writer exists yet.
 if b.organization_id is distinct from p_org or b.revoked_at is not null or b.reviewed_at>clock_timestamp()
  or b.valid_until<=clock_timestamp() or b.eligibility<>'verified_adult' or b.adult_evidence_sha256 is null then return false;end if;
 actor:=private.campaign_foundation_session();
 if actor is distinct from b.requested_by then return false;end if;
 select * into d from public.organization_staff_directory where organization_id=p_org and user_id=actor for share;
 if d.user_id is null or not d.active or d.effective_at>clock_timestamp() or d.expires_at<=clock_timestamp() then return false;end if;
 if p_manage then needed:=needed||'followup.manage'::text;end if;
 perform 1 from public.organization_staff_permissions where organization_id=p_org and user_id=actor order by permission for share;
 select count(*),min(expires_at) into n,deadline from public.organization_staff_permissions where organization_id=p_org and user_id=actor
  and permission=any(needed) and department_ids is null and revoked_at is null and effective_at<=clock_timestamp()
  and (expires_at is null or expires_at>clock_timestamp());
 if n<>cardinality(needed) then return false;end if;
 deadline:=least(deadline,d.expires_at,b.valid_until);
 perform 1 from public.outreach_campaigns where id=b.campaign_id and organization_id=p_org for share;
 if not found then return false;end if;
 select * into a from public.outreach_campaign_assignments where campaign_id=b.campaign_id and user_id=actor for share;
 select source into source_value from public.outreach_decision_campaign_sources where campaign_id=b.campaign_id and active for share;
 if a.user_id is null or not a.active or a.effective_at>clock_timestamp() or a.expires_at<=clock_timestamp()
  or a.care_scope<>'assigned' or a.decision_effective_at is null or a.decision_expires_at is null
  or a.decision_effective_at>clock_timestamp() or a.decision_expires_at<=clock_timestamp()
  or not(array['view','decisions.read','followup.manage']::text[]<@a.capabilities)
  or source_value is distinct from b.source then return false;end if;
 deadline:=least(deadline,a.expires_at,a.decision_expires_at);
 select * into f from public.outreach_decision_followup where registration_id=b.registration_id for share;
 select * into r from public.outreach_registrations where id=b.registration_id for share;
 if f.registration_id is null or f.campaign_id<>b.campaign_id or f.assigned_user_id is distinct from actor
  or r.id is null or r.source is distinct from b.source or r.user_id is distinct from b.account_id or r.consent is distinct from true then return false;end if;
 select true into found_link from public.outreach_campaign_registrants cr
  join public.organization_people op on op.organization_id=cr.organization_id and op.id=cr.person_id
  join public.portal_account_links l on l.organization_id=op.organization_id and l.person_id=op.id and l.active
  join public.portal_admin_events current_e on current_e.organization_id=p_org and current_e.kind='account_link'
   and current_e.subject_id=l.id and current_e.after_state=to_jsonb(l)
  join public.portal_admin_events original_e on original_e.organization_id=p_org and original_e.kind='account_link'
   and original_e.subject_id=l.id and original_e.before_state is null
   and original_e.after_state->>'user_id'=l.user_id::text and original_e.after_state->>'person_id'=l.person_id::text
   and original_e.after_state->>'organization_id'=p_org::text
  join auth.users u on u.id=l.user_id and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
   and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp())
  join auth.users reviewer on reviewer.id=b.reviewed_by and reviewer.email_confirmed_at is not null
   and not coalesce(reviewer.is_anonymous,false) and reviewer.deleted_at is null
   and (reviewer.banned_until is null or reviewer.banned_until<=clock_timestamp())
  where cr.id=b.campaign_registrant_id and cr.revision=b.campaign_registrant_revision and cr.campaign_id=b.campaign_id
   and cr.organization_id=p_org and cr.legacy_registration_id=b.registration_id and cr.person_id=b.person_id
   and l.id=b.portal_link_id and l.revision=b.portal_link_revision and l.user_id=b.account_id
  for share of cr,op,l,u,reviewer,current_e,original_e;
 if found_link is distinct from true then return false;end if;
 perform private.campaign_foundation_session();
 return clock_timestamp()<deadline;
exception when insufficient_privilege then return false;
end$$;
revoke all on function private.campaign_person_task_access(uuid,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function private.campaign_person_task_access(uuid,uuid,boolean) to authenticated;
create policy campaign_task_scope on public.followup_tasks as restrictive for all to authenticated
 using(private.campaign_person_task_access(organization_id,id,false)) with check(private.campaign_person_task_access(organization_id,id,true));
create policy campaign_task_event_scope on public.followup_task_events as restrictive for select to authenticated
 using(private.campaign_person_task_access(organization_id,task_id,false));

create function private.guard_campaign_bound_task() returns trigger
language plpgsql security definer set search_path='' as $$
declare b private.campaign_person_task_bindings;
begin
 select * into b from private.campaign_person_task_bindings where task_id=coalesce(new.id,old.id) for share;
 if not found then return coalesce(new,old);end if;
 if tg_op<>'UPDATE' or new.organization_id<>b.organization_id or new.person_id<>b.person_id or new.title<>'Outreach follow-up'
  or new.assigned_user_id is distinct from b.requested_by or new.workflow_run_id is not null
  or private.campaign_person_task_access(b.organization_id,b.task_id,true) is distinct from true then
  raise exception 'Campaign-bound task update unavailable' using errcode='42501';end if;
 return new;
end$$;
create trigger guard_campaign_bound_task before insert or update or delete on public.followup_tasks
 for each row execute function private.guard_campaign_bound_task();
-- Deferred fence observes elapsed expiry after row/audit waits, immediately before commit.
create constraint trigger campaign_bound_task_commit_fence after insert or update on public.followup_tasks
 deferrable initially deferred for each row execute function private.guard_campaign_bound_task();
create function private.guard_campaign_task_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare b private.campaign_person_task_bindings;
begin
 perform 1 from public.followup_tasks where id in(new.task_id,old.task_id) order by id for update;
 select * into b from private.campaign_person_task_bindings where task_id in(new.task_id,old.task_id) order by task_id limit 1 for share;
 if not found then return coalesce(new,old);end if;
 if tg_op<>'INSERT' or new.organization_id<>b.organization_id or new.actor_user_id is distinct from auth.uid()
  or new.action<>'updated' or private.campaign_task_neutral_state(new.before_state,b.requested_by) is distinct from true
  or private.campaign_task_neutral_state(new.after_state,b.requested_by) is distinct from true
  or private.campaign_person_task_access(b.organization_id,b.task_id,true) is distinct from true then
  raise exception 'Bound task audit unavailable or immutable' using errcode='42501';end if;
 return new;
end$$;
create trigger guard_campaign_task_event before insert or update or delete on public.followup_task_events
 for each row execute function private.guard_campaign_task_event();
create function private.guard_campaign_task_history_truncate() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from private.campaign_person_task_bindings) then raise exception 'Bound task history cannot be truncated' using errcode='42501';end if;return null;end$$;
create trigger campaign_task_history_no_truncate before truncate on public.followup_task_events for each statement execute function private.guard_campaign_task_history_truncate();
-- A definer financial/tag view must never become an alternate disclosure route.
create function private.reject_campaign_task_attachment() returns trigger
language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.followup_tasks where id in ((to_jsonb(new)->>'followup_task_id')::uuid,(to_jsonb(new)->>'task_id')::uuid,(to_jsonb(new)->>'reserved_task_id')::uuid) order by id for update;
 if exists(select 1 from private.campaign_person_task_bindings b where b.task_id in
  ((to_jsonb(new)->>'followup_task_id')::uuid,(to_jsonb(new)->>'task_id')::uuid,(to_jsonb(new)->>'reserved_task_id')::uuid)) then
  raise exception 'Campaign task cannot enter financial/tag workflows' using errcode='42501';end if;return new;
end$$;
create trigger reject_campaign_task_financial_attachment before insert or update on public.outreach_partner_intakes
 for each row execute function private.reject_campaign_task_attachment();
create trigger reject_campaign_task_tag_attachment before insert or update on public.tag_workflow_runs
 for each row execute function private.reject_campaign_task_attachment();

create function private.campaign_person_task_context(p_org uuid,p_campaign uuid,p_registration uuid,p_payload jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' set lock_timeout='2s' as $$
declare b private.campaign_person_task_bindings;t public.followup_tasks;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>1000
  or (select count(*) from jsonb_object_keys(p_payload))<>3
  or not(p_payload ?& array['task_id','binding_id','binding_revision'])
  or jsonb_typeof(p_payload->'binding_revision') is distinct from 'number'
  or p_payload->>'binding_revision' !~ '^[1-9][0-9]{0,8}$' then raise exception 'Exact task binding required' using errcode='22023';end if;
 select * into b from private.campaign_person_task_bindings where id=(p_payload->>'binding_id')::uuid
  and task_id=(p_payload->>'task_id')::uuid and organization_id=p_org and campaign_id=p_campaign and registration_id=p_registration for share;
 if b.id is null or private.campaign_person_task_access(p_org,b.task_id,false) is distinct from true then raise exception 'Task unavailable' using errcode='42501';end if;
 if b.revision<>(p_payload->>'binding_revision')::integer then raise exception 'Reviewed binding changed' using errcode='40001';end if;
 select * into t from public.followup_tasks where id=b.task_id and organization_id=p_org and person_id=b.person_id;
 if t.id is null or t.title<>'Outreach follow-up' or t.assigned_user_id is distinct from b.requested_by
  or not private.operational_followup_visible(p_org,t.id)
  or private.campaign_person_task_access(p_org,t.id,false) is distinct from true then raise exception 'Task unavailable' using errcode='42501';end if;
 return jsonb_build_object('kind','campaign-person-task','actor_id',auth.uid(),'organization_id',p_org,'campaign_id',p_campaign,
  'registration_id',p_registration,'binding_id',b.id,'binding_revision',b.revision,
  'task',jsonb_build_object('id',t.id,'person_id',t.person_id,'title',t.title,'status',t.status,'due_on',t.due_on,'assigned_user_id',t.assigned_user_id,'revision',t.revision));
end$$;
create function public.campaign_person_task_context(p_org uuid,p_campaign uuid,p_registration uuid,p_payload jsonb) returns jsonb
language sql volatile security invoker set search_path='' as $$select private.campaign_person_task_context(p_org,p_campaign,p_registration,p_payload)$$;
revoke all on function private.campaign_task_neutral_state(jsonb,uuid),private.campaign_task_binding_guard(),private.campaign_task_binding_audit(),
 private.guard_campaign_bound_task(),private.guard_campaign_task_event(),private.guard_campaign_task_history_truncate(),private.reject_campaign_task_attachment(),
 private.campaign_person_task_context(uuid,uuid,uuid,jsonb),public.campaign_person_task_context(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.campaign_person_task_context(uuid,uuid,uuid,jsonb),public.campaign_person_task_context(uuid,uuid,uuid,jsonb) to authenticated;
commit;
