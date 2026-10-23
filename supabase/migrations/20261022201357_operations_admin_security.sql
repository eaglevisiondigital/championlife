-- Operations Administrator security boundary. Forward-only; no role/user/data seed.
-- Based on production main 53beb5d5c0d1ee259155128e4e282d18b4195623.
-- Existing capability vocabulary and all original grants remain unchanged.
begin;

-- Refuse another child package or an unreviewed production function baseline.
-- MD5 is used only as a database drift sentinel; release artifacts use SHA-256.
do $$begin
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.outreach_partner_workspace(uuid,text,jsonb)')) is distinct from '399c73d0931d6cf8ac70d81f4e2c1e50' then raise exception 'Unreviewed baseline: private.outreach_partner_workspace; stop for reconciliation';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.people_workspace(uuid,text,jsonb)')) is distinct from '16f60068992376b02193a56c53518d41' then raise exception 'Unreviewed baseline: private.people_workspace; stop for reconciliation';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.outreach_registration_can(uuid,text)')) is distinct from '57e9ee9f64157511a576491e22a208a5' then raise exception 'Unreviewed baseline: private.outreach_registration_can; stop for reconciliation';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.outreach_registration_workspace(text,uuid,jsonb)')) is distinct from '308c44a317c3f2167bd47b675b6c677d' then raise exception 'Unreviewed baseline: private.outreach_registration_workspace; stop for reconciliation';end if;
end $$;

-- Donation-intake follow-ups and relationship labels must not leak financial intent
-- through general People/follow-up surfaces. No client access to intake tables.
create function private.operational_relationship_visible(org uuid,person uuid,relationship text)
returns boolean language sql stable security definer set search_path='' as $$
 select private.person_permission(org,person,'people.read') and (
  private.has_staff_permission(org,'finance.read') or
  (relationship<>'partner' or not exists(
   select 1 from public.outreach_partner_intakes i where i.organization_id=org and i.person_id=person)))
$$;
create function private.operational_followup_visible(org uuid,task uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.has_staff_permission(org,'people.read') and private.has_staff_permission(org,'followup.read') and (
  private.has_staff_permission(org,'finance.read') or not exists(
   select 1 from public.outreach_partner_intakes i where i.organization_id=org and i.followup_task_id=task))
$$;
revoke all on function private.operational_relationship_visible(uuid,uuid,text),private.operational_followup_visible(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.operational_relationship_visible(uuid,uuid,text),private.operational_followup_visible(uuid,uuid) to authenticated;
-- Restrictive policies compose with, and cannot replace, existing permission RLS.
create policy followup_financial_boundary on public.followup_tasks as restrictive for all to authenticated
 using(private.operational_followup_visible(organization_id,id))
 with check(private.operational_followup_visible(organization_id,id));
create policy followup_event_financial_boundary on public.followup_task_events as restrictive for select to authenticated
 using(private.operational_followup_visible(organization_id,task_id));
create policy people_relationship_financial_boundary on public.organization_admin_events as restrictive for select to authenticated
 using(kind<>'person_relationship' or private.operational_relationship_visible(organization_id,subject_id,after_state->>'relationship'));

-- Existing plural organization keys project only operational campaign actions.
-- No campaign admin, intake configuration, waiver publication or access management.
create or replace function private.outreach_registration_can(c uuid,cap text) returns boolean language sql stable security definer set search_path='' as $$
 select cap in ('registration.view','registration.manage','registration.export','checkin.manage') and private.outreach_verified(auth.uid()) and exists(select 1 from public.outreach_campaigns x where x.id=c and (
  (private.has_staff_permission(x.organization_id,'registrations.view') and (
   cap='registration.view' or (cap='registration.export' and private.has_staff_permission(x.organization_id,'people.export')) or
   (cap in ('registration.manage','checkin.manage') and private.has_staff_permission(x.organization_id,'registrations.manage'))))
  or private.outreach_admin(x.organization_id,cap<>'registration.view')
  or exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c and a.user_id=auth.uid() and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and 'view'=any(a.capabilities) and 'registration.view'=any(a.capabilities) and cap=any(a.capabilities))))
$$;

-- Extend, never replace with a narrower audit vocabulary. Preserve all prior kinds.
do $$declare prior text;begin
 select pg_get_expr(conbin,conrelid) into strict prior from pg_constraint
 where conrelid='public.organization_admin_events'::regclass and conname='organization_admin_events_kind_check';
 if prior is null then raise exception 'Expected audit constraint missing';end if;
 alter table public.organization_admin_events drop constraint organization_admin_events_kind_check;
 execute format('alter table public.organization_admin_events add constraint organization_admin_events_kind_check check ((%s) or kind in (''household_created'',''household_updated'',''household_member_added'',''household_member_updated''))',prior);
end $$;

-- Forward-only compatibility for the existing People and Household contracts.
-- INSERT ... RETURNING evaluates SELECT policies before a STABLE helper can see
-- the new row. An effective organization-wide read grant already authorizes
-- every contact in that organization; test that grant without re-reading it.
-- Existing self-read and department/person-scoped predicates remain unchanged.
alter policy organization_people_read on public.organization_people using (
  user_id = (select auth.uid())
  or private.has_staff_permission(organization_id, 'people.read')
  or private.person_permission(organization_id, id, 'people.read')
);

-- Household audit subjects are household UUIDs, not Person UUIDs. Restore the
-- original combined People + Households read boundary with current effective
-- grants; preserve the existing predicates for every non-household audit kind.
alter policy org_admin_events_read on public.organization_admin_events using (
  case
    when kind in ('staff_access', 'role_template') then
      private.has_staff_permission(organization_id, 'staff.view')
      or private.has_staff_permission(organization_id, 'staff.manage')
    when kind in ('household_created', 'household_updated',
                  'household_member_added', 'household_member_updated') then
      private.has_staff_permission(organization_id, 'people.read')
      and private.has_staff_permission(organization_id, 'households.read')
    when kind = 'department_affiliation' then
      private.person_permission(organization_id, subject_id, 'people.read')
      and private.has_staff_permission(organization_id, 'people.read', (after_state->>'department_id')::uuid)
    else private.person_permission(organization_id, subject_id, 'people.read')
  end
);


create or replace function private.outreach_partner_workspace(p_org uuid,p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.outreach_partner_intakes; person uuid; task uuid; result jsonb; fields jsonb;
begin
 if not (private.has_staff_permission(p_org,'outreach.view') and private.has_staff_permission(p_org,'finance.read')) then raise exception 'Financial outreach review permission required' using errcode='42501'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>2000 or (p_data-array['id','revision','person_id','search','offset'])<>'{}'::jsonb then raise exception 'Unsupported request'; end if;
 if p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (
   select i.id,i.source_site,i.submitted_at,i.status,i.person_id,i.commitment_amount,i.commitment_frequency,
    i.raw_submission->>'first-name' first_name,i.raw_submission->>'last-name' last_name,i.raw_submission->>'email' email,i.raw_submission->>'phone' phone,
    case when private.has_staff_permission(p_org,'followup.read') and private.has_staff_permission(p_org,'people.read') then t.status else null end followup_status
   from public.outreach_partner_intakes i left join public.followup_tasks t on t.id=i.followup_task_id
   where i.organization_id=p_org order by i.submitted_at desc,i.id limit 50 offset greatest(0,least(coalesce((p_data->>'offset')::int,0),100000))
  )x; return result;
 end if;
 select * into r from public.outreach_partner_intakes where organization_id=p_org and id=(p_data->>'id')::uuid for update;
 if not found then raise exception 'Intake unavailable'; end if;
 if p_action='detail' then
  return (to_jsonb(r)-'request_key'-'payload_hash'-'email_normalized'-'phone_normalized') || jsonb_build_object('history',(select coalesce(jsonb_agg(jsonb_build_object('action',action,'occurred_at',occurred_at) order by occurred_at),'[]') from private.outreach_partner_audit where intake_id=r.id));
 end if;
 if not private.has_staff_permission(p_org,'outreach.manage') then raise exception 'Outreach management required' using errcode='42501'; end if;
 if (p_data->>'revision')::int is distinct from r.revision then raise exception 'Intake changed; reload' using errcode='40001'; end if;
 if p_action='review' then
  update public.outreach_partner_intakes set status=case when person_id is null then 'reviewed' else 'linked' end,reviewed_at=coalesce(reviewed_at,now()),updated_at=now(),revision=revision+1 where id=r.id;
 elsif p_action in ('link','create_contact') then
  if r.person_id is not null then raise exception 'Intake already linked'; end if;
  if not(private.has_staff_permission(p_org,'people.read') and private.has_staff_permission(p_org,'people.update')) then raise exception 'Organization contact review permission required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('outreach-contact:'||p_org::text,0));
  fields:=r.raw_submission;
  if p_action='create_contact' then
   if not private.has_staff_permission(p_org,'people.create') then raise exception 'Contact creation denied' using errcode='42501'; end if;
   if exists(select 1 from public.organization_people p where p.organization_id=p_org and (lower(btrim(p.email))=r.email_normalized or regexp_replace(p.phone,'[^0-9+]','','g')=r.phone_normalized or (lower(p.first_name)=lower(btrim(fields->>'first-name')) and lower(p.last_name)=lower(btrim(fields->>'last-name'))))) then raise exception 'Possible existing contact; search and review before linking'; end if;
   insert into public.organization_people(organization_id,first_name,last_name,email,phone) values(p_org,fields->>'first-name',fields->>'last-name',r.email_normalized,fields->>'phone') returning id into person;
  else person:=(p_data->>'person_id')::uuid;
  end if;
  if not exists(select 1 from public.organization_people where organization_id=p_org and id=person) then raise exception 'Contact unavailable'; end if;
  if not exists(select 1 from public.person_organization_relationships where organization_id=p_org and person_id=person and relationship='partner' and active and effective_at<=now() and (expires_at is null or expires_at>now())) then
   perform private.people_workspace(p_org,'relationship',jsonb_build_object('person_id',person,'relationship','partner'));
  end if;
  update public.outreach_partner_intakes set person_id=person,status='linked',reviewed_at=coalesce(reviewed_at,now()),linked_at=now(),updated_at=now(),revision=revision+1 where id=r.id;
 elsif p_action='followup' then
  if r.person_id is null then raise exception 'Review and link a contact first'; end if;
  if not(private.has_staff_permission(p_org,'people.read') and private.has_staff_permission(p_org,'followup.read') and private.has_staff_permission(p_org,'followup.manage')) then raise exception 'Follow-up permission required' using errcode='42501'; end if;
  if r.followup_task_id is not null then return jsonb_build_object('saved',true); end if;
  insert into public.followup_tasks(organization_id,person_id,title) values(p_org,r.person_id,'Follow up on outreach partnership commitment') returning id into task;
  update public.outreach_partner_intakes set followup_task_id=task,updated_at=now(),revision=revision+1 where id=r.id;
 else raise exception 'Unsupported action'; end if;
 insert into private.outreach_partner_audit(intake_id,actor_id,action,person_id) values(r.id,auth.uid(),p_action,coalesce(person,r.person_id));
 return jsonb_build_object('saved',true);
end $$;

create or replace function private.people_workspace(p_org uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); person uuid:=(p_payload->>'person_id')::uuid; target uuid; dept uuid; template uuid;
 contact public.organization_people; assignment public.organization_staff_directory;
 prior jsonb; result jsonb; item jsonb; grants_json jsonb; scopes uuid[]; key text; keys text[];
 starts timestamptz; ends timestamptz; actor_grant public.organization_staff_permissions;
 row_id uuid; changed integer; event_kind text; global_manager boolean;
begin
 if actor is null or not private.staff_assignment_active(p_org,actor) then raise exception 'Active verified staff assignment required' using errcode='42501'; end if;
 global_manager:=private.has_staff_permission(p_org,'staff.manage');
 if p_action='context' then
  select coalesce(jsonb_agg(to_jsonb(g)-'user_id'),'[]') into grants_json from public.organization_staff_permissions g
   where g.organization_id=p_org and g.user_id=actor and g.revoked_at is null and g.effective_at<=now() and (g.expires_at is null or g.expires_at>now());
  return jsonb_build_object('grants',grants_json,'permission_keys',private.staff_permission_keys(),
   'departments',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name) order by d.name),'[]') from public.organization_departments d where d.organization_id=p_org and d.active and (private.has_staff_permission(p_org,'people.read',d.id) or private.has_staff_permission(p_org,'staff.manage',d.id) or private.has_staff_permission(p_org,'staff.view',d.id))),
   'templates',(select coalesce(jsonb_agg(to_jsonb(t) order by t.name),'[]') from public.staff_role_templates t where t.organization_id=p_org and t.active and (global_manager or private.has_staff_permission(p_org,'staff.view') or exists(select 1 from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=actor and g.permission='staff.manage' and g.revoked_at is null and g.effective_at<=now() and (g.expires_at is null or g.expires_at>now())))));
 elsif p_action='list' then
  if not exists(select 1 from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=actor and g.permission='people.read' and g.revoked_at is null and g.effective_at<=now() and (g.expires_at is null or g.expires_at>now())) then raise exception 'People read required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(row_data order by last_name,id),'[]') into result from (
   select p.id,p.last_name,jsonb_build_object('id',p.id,'first_name',p.first_name,'last_name',p.last_name,'email',p.email,'phone',p.phone,'updated_at',p.updated_at,
    'relationships',(select coalesce(jsonb_agg(r.relationship),'[]') from public.person_organization_relationships r where r.organization_id=p_org and r.person_id=p.id and private.operational_relationship_visible(p_org,p.id,r.relationship) and r.active and r.effective_at<=now() and (r.expires_at is null or r.expires_at>now())),
    'departments',(select coalesce(jsonb_agg(d.name),'[]') from public.person_department_affiliations a join public.organization_departments d on d.organization_id=a.organization_id and d.id=a.department_id where a.organization_id=p_org and a.person_id=p.id and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and d.active and private.has_staff_permission(p_org,'people.read',d.id)),
    'portal_active',exists(select 1 from public.portal_account_links l where l.organization_id=p_org and l.person_id=p.id and l.active),
    'staff_active',exists(select 1 from public.organization_staff_directory s where s.organization_id=p_org and s.person_id=p.id and private.staff_assignment_active(p_org,s.user_id))) as row_data
   from public.organization_people p where p.organization_id=p_org and private.person_permission(p_org,p.id,'people.read')
   and (coalesce(p_payload->>'search','')='' or position(lower(p_payload->>'search') in lower(concat_ws(' ',p.first_name,p.last_name,p.email,p.phone)))>0)
   and (coalesce(p_payload->>'relationship','')='' or exists(select 1 from public.person_organization_relationships r where r.organization_id=p_org and r.person_id=p.id and r.relationship=p_payload->>'relationship' and private.operational_relationship_visible(p_org,p.id,r.relationship) and r.active and r.effective_at<=now() and (r.expires_at is null or r.expires_at>now())))
   and (coalesce(p_payload->>'department_id','')='' or exists(select 1 from public.person_department_affiliations a where a.organization_id=p_org and a.person_id=p.id and a.department_id=(p_payload->>'department_id')::uuid and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and private.has_staff_permission(p_org,'people.read',a.department_id)))
   and (coalesce(p_payload->>'portal','')='' or (p_payload->>'portal'='active')=exists(select 1 from public.portal_account_links l where l.organization_id=p_org and l.person_id=p.id and l.active))
   and (coalesce(p_payload->>'staff','')='' or (p_payload->>'staff'='active')=exists(select 1 from public.organization_staff_directory s where s.organization_id=p_org and s.person_id=p.id and private.staff_assignment_active(p_org,s.user_id)))
   and (coalesce(p_payload->>'course','')='' or (private.person_permission(p_org,p.id,'discipleship.read') and exists(select 1 from public.portal_account_links l join public.course_enrollments e on e.user_id=l.user_id where l.organization_id=p_org and l.person_id=p.id and l.active)))
   order by p.last_name,p.id limit 26 offset greatest(0,least(coalesce((p_payload->>'page')::integer,0),10000))*25
  ) q;
  return result;
 elsif p_action='template' then
  perform pg_advisory_xact_lock(hashtextextended(p_org::text,0));
  if not private.has_staff_permission(p_org,'staff.manage') then raise exception 'Organization staff manager required' using errcode='42501'; end if;
  select array_agg(value) into keys from jsonb_array_elements_text(p_payload->'permissions');
  keys:=coalesce(keys,'{}');
  if not(keys <@ private.staff_permission_keys()) or 'staff.manage'=any(keys) then raise exception 'Invalid template capabilities' using errcode='22023'; end if;
  foreach key in array keys loop if not private.has_staff_permission(p_org,key) then raise exception 'Cannot bundle unowned capability' using errcode='42501'; end if; end loop;
  template:=(p_payload->>'id')::uuid;
  if template is null then
   insert into public.staff_role_templates(organization_id,name,permissions) values(p_org,p_payload->>'name',keys) returning id into template;
  else
   select to_jsonb(t) into prior from public.staff_role_templates t where organization_id=p_org and id=template;
   update public.staff_role_templates set name=p_payload->>'name',permissions=keys,active=coalesce((p_payload->>'active')::boolean,true),revision=revision+1 where organization_id=p_org and id=template and revision=(p_payload->>'revision')::integer;
   if not found then raise exception 'Template changed; reload' using errcode='40001'; end if;
  end if;
  select to_jsonb(t) into result from public.staff_role_templates t where organization_id=p_org and id=template;
  insert into public.organization_admin_events(organization_id,actor_user_id,subject_id,kind,before_state,after_state) values(p_org,actor,template,'role_template',prior,result);
  return result;
 end if;
 select * into contact from public.organization_people where organization_id=p_org and id=person;
 if not found or not private.person_permission(p_org,person,'people.read') then raise exception 'Person unavailable' using errcode='42501'; end if;
 select l.user_id into target from public.portal_account_links l where l.organization_id=p_org and l.person_id=person and l.active;
 select * into assignment from public.organization_staff_directory where organization_id=p_org and person_id=person;
 if p_action='detail' then
  result:=jsonb_build_object('person',to_jsonb(contact)-'human_id'-'user_id',
   'can_edit',private.person_permission(p_org,person,'people.update'),
   'can_staff',private.person_permission(p_org,person,'staff.view') or private.person_permission(p_org,person,'staff.manage'),
   'can_manage_staff',private.person_permission(p_org,person,'staff.manage') and target is not null and target<>actor and not exists(select 1 from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=target and g.permission='staff.manage' and g.revoked_at is null),
   'relationships',(select coalesce(jsonb_agg(to_jsonb(r) order by r.effective_at desc),'[]') from public.person_organization_relationships r where organization_id=p_org and person_id=person and private.operational_relationship_visible(p_org,person,r.relationship)),
   'departments',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'active',a.active)),'[]') from public.person_department_affiliations a join public.organization_departments d on d.organization_id=a.organization_id and d.id=a.department_id where a.organization_id=p_org and a.person_id=person and private.has_staff_permission(p_org,'people.read',d.id)),
   'account_relationships',(select coalesce(jsonb_agg(a.affiliation),'[]') from public.organization_affiliations a where a.organization_id=p_org and a.user_id=target),
   'portal_active',target is not null,
   'activity',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]') from (select kind,created_at from public.organization_admin_events where organization_id=p_org and subject_id=person and kind in ('person_created','person_updated','person_relationship','department_affiliation') and (kind<>'person_relationship' or private.operational_relationship_visible(p_org,person,after_state->>'relationship')) order by created_at desc limit 30)e));
  if private.person_permission(p_org,person,'discipleship.read') and target is not null then
   result:=result||jsonb_build_object('discipleship',(select coalesce(jsonb_agg(jsonb_build_object('title',c.title,'started_at',e.started_at,'completed_at',e.completed_at,'total_lessons',c.total_lessons,'lessons',(select coalesce(jsonb_agg(jsonb_build_object('number',lp.lesson_number,'status',lp.status) order by lp.lesson_number),'[]') from public.lesson_progress lp where lp.user_id=target and lp.course_id=e.course_id))),'[]') from public.course_enrollments e join public.courses c on c.id=e.course_id where e.user_id=target));
  end if;
  if private.person_permission(p_org,person,'staff.view') or private.person_permission(p_org,person,'staff.manage') then
   result:=result||jsonb_build_object('assignment',case when assignment.user_id is null then null else case when global_manager or private.has_staff_permission(p_org,'staff.view') then to_jsonb(assignment) else to_jsonb(assignment)-'reason' end end,
    'grants',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=assignment.user_id and (private.has_staff_permission(p_org,'staff.view') or global_manager or (g.department_ids is not null and not exists(select 1 from unnest(g.department_ids) d where not(private.has_staff_permission(p_org,'staff.view',d) or private.has_staff_permission(p_org,'staff.manage',d)))))),
    'audit',(select coalesce(jsonb_agg(case when global_manager or private.has_staff_permission(p_org,'staff.view') then to_jsonb(e) else jsonb_build_object('id',e.id,'actor_user_id',e.actor_user_id,'created_at',e.created_at,'after_state',jsonb_build_object('operation',e.after_state->>'operation')) end order by e.created_at desc),'[]') from (select id,actor_user_id,kind,before_state,after_state,created_at from public.organization_admin_events where organization_id=p_org and subject_id=person and kind='staff_access' order by created_at desc limit 30)e));
  end if;
  return result;
 elsif p_action='update' then
  if not private.person_permission(p_org,person,'people.update') then raise exception 'Edit denied' using errcode='42501'; end if;
  if (p_payload-'person_id'-'updated_at'-'first_name'-'last_name'-'email'-'phone')<>'{}'::jsonb then raise exception 'Unsupported contact field' using errcode='22023'; end if;
  update public.organization_people set first_name=p_payload->>'first_name',last_name=p_payload->>'last_name',email=nullif(p_payload->>'email',''),phone=nullif(p_payload->>'phone','') where organization_id=p_org and id=person and updated_at=(p_payload->>'updated_at')::timestamptz;
  if not found then raise exception 'Contact changed; reload' using errcode='40001'; end if;
  return jsonb_build_object('saved',true);
 elsif p_action in ('relationship','affiliation') then
  -- Contact relationship/scope membership is not a delegated way to expand access.
  if not(private.has_staff_permission(p_org,'people.update') and private.has_staff_permission(p_org,'people.read')) then raise exception 'Organization contact editor required' using errcode='42501'; end if;
  if p_action='relationship' then
   row_id:=(p_payload->>'id')::uuid;
   if row_id is null then
    if not private.operational_relationship_visible(p_org,person,p_payload->>'relationship') then raise exception 'Financial relationship permission required' using errcode='42501';end if;
    insert into public.person_organization_relationships(organization_id,person_id,relationship,effective_at,expires_at) values(p_org,person,p_payload->>'relationship',coalesce((p_payload->>'effective_at')::timestamptz,now()),(p_payload->>'expires_at')::timestamptz) returning id into row_id;
   else
    select to_jsonb(r) into prior from public.person_organization_relationships r where organization_id=p_org and person_id=person and id=row_id for update;
    if not found or not private.operational_relationship_visible(p_org,person,prior->>'relationship') then raise exception 'Relationship unavailable' using errcode='42501'; end if;
    update public.person_organization_relationships set active=(p_payload->>'active')::boolean where organization_id=p_org and person_id=person and id=row_id;
   end if;
   select to_jsonb(r) into result from public.person_organization_relationships r where id=row_id; event_kind:='person_relationship';
  else
   dept:=(p_payload->>'department_id')::uuid;
   if not exists(select 1 from public.organization_departments where organization_id=p_org and id=dept and active) then raise exception 'Department unavailable'; end if;
   select to_jsonb(a) into prior from public.person_department_affiliations a where organization_id=p_org and person_id=person and department_id=dept for update;
   insert into public.person_department_affiliations(organization_id,person_id,department_id,active) values(p_org,person,dept,coalesce((p_payload->>'active')::boolean,true)) on conflict(organization_id,person_id,department_id) do update set active=excluded.active;
   select to_jsonb(a) into result from public.person_department_affiliations a where organization_id=p_org and person_id=person and department_id=dept; event_kind:='department_affiliation';
  end if;
  insert into public.organization_admin_events(organization_id,actor_user_id,subject_id,kind,before_state,after_state) values(p_org,actor,person,event_kind,prior,result);return result;
 elsif p_action in ('assignment','grant','role','remove_role') then
  perform pg_advisory_xact_lock(hashtextextended(p_org::text,0));
  -- Re-evaluate after serialization. Never change self or a provisioned administrator.
  if not private.person_permission(p_org,person,'staff.manage') or target is null or target=actor or exists(select 1 from public.organization_staff_permissions where organization_id=p_org and user_id=target and permission='staff.manage' and revoked_at is null) then raise exception 'Staff change denied; reviewed account link required' using errcode='42501'; end if;
  if not exists(select 1 from auth.users where id=target and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Verified account required' using errcode='42501'; end if;
  select * into assignment from public.organization_staff_directory where organization_id=p_org and user_id=target for update;
  if coalesce(assignment.revision,0)<>coalesce((p_payload->>'revision')::integer,-1) then raise exception 'Staff changed; reload' using errcode='40001'; end if;
  if assignment.person_id is not null and assignment.person_id<>person then raise exception 'Staff identity mismatch' using errcode='42501'; end if;
  select jsonb_build_object('assignment',to_jsonb(assignment),'grants',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=target)) into prior;
  if p_action='assignment' then
   if not private.has_staff_permission(p_org,'staff.manage') then raise exception 'Organization-wide manager required for assignment changes' using errcode='42501'; end if;
   starts:=coalesce((p_payload->>'effective_at')::timestamptz,now());ends:=(p_payload->>'expires_at')::timestamptz;
   insert into public.organization_staff_directory(organization_id,user_id,person_id,display_name,active,effective_at,expires_at,reason) values(p_org,target,person,concat_ws(' ',contact.first_name,contact.last_name),coalesce((p_payload->>'active')::boolean,false),starts,ends,coalesce(p_payload->>'reason',''))
   on conflict(organization_id,user_id) do update set person_id=excluded.person_id,active=excluded.active,effective_at=excluded.effective_at,expires_at=excluded.expires_at,reason=excluded.reason,revision=organization_staff_directory.revision+1,updated_at=clock_timestamp();
   -- Disabling revokes grants: later re-enabling alone cannot restore authority.
   if not coalesce((p_payload->>'active')::boolean,false) then update public.organization_staff_permissions set revoked_at=clock_timestamp() where organization_id=p_org and user_id=target and revoked_at is null; end if;
  else
   if assignment.user_id is null then raise exception 'Create the staff assignment first'; end if;
   if p_payload->'department_ids' is not null and p_payload->'department_ids'<>'null'::jsonb then select array_agg(value::uuid) into scopes from jsonb_array_elements_text(p_payload->'department_ids');if scopes is null then raise exception 'Choose departments or organization-wide';end if;end if;
   if scopes is null then
    if not private.has_staff_permission(p_org,'staff.manage') then raise exception 'Organization scope denied' using errcode='42501'; end if;
   else
    foreach dept in array scopes loop if not private.has_staff_permission(p_org,'staff.manage',dept) or not exists(select 1 from public.organization_departments where organization_id=p_org and id=dept and active) then raise exception 'Department scope denied' using errcode='42501';end if;end loop;
   end if;
   starts:=coalesce((p_payload->>'effective_at')::timestamptz,now());ends:=(p_payload->>'expires_at')::timestamptz;
   if p_action in ('role','remove_role') then
    template:=(p_payload->>'template_id')::uuid;
    select permissions into keys from public.staff_role_templates where organization_id=p_org and id=template and active;
    if not found then raise exception 'Template unavailable'; end if;
    if p_action='remove_role' then select coalesce(array_agg(permission),'{}') into keys from public.organization_staff_permissions where organization_id=p_org and user_id=target and template_id=template and revoked_at is null;end if;
   else keys:=array[p_payload->>'permission'];end if;
   foreach key in array keys loop
    if key='staff.manage' or not(key=any(private.staff_permission_keys())) then raise exception 'Cannot delegate this capability' using errcode='42501'; end if;
    -- Existing broader grants cannot be edited or revoked by a narrower manager.
    if exists(select 1 from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=target and g.permission=key and g.revoked_at is null and ((g.department_ids is null and not private.has_staff_permission(p_org,'staff.manage')) or exists(select 1 from unnest(g.department_ids) d where not private.has_staff_permission(p_org,'staff.manage',d)))) then raise exception 'Existing grant exceeds manager scope' using errcode='42501';end if;
    select * into actor_grant from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=actor and g.permission=key and g.revoked_at is null and g.effective_at<=now() and (g.expires_at is null or g.expires_at>now());
    if actor_grant.user_id is null or (actor_grant.department_ids is not null and (scopes is null or not(scopes <@ actor_grant.department_ids))) then raise exception 'Cannot delegate unowned capability/scope' using errcode='42501';end if;
    if p_action='remove_role' or coalesce((p_payload->>'revoke')::boolean,false) then
     update public.organization_staff_permissions set revoked_at=clock_timestamp() where organization_id=p_org and user_id=target and permission=key;
    else
     if starts<actor_grant.effective_at or (actor_grant.expires_at is not null and (ends is null or ends>actor_grant.expires_at)) or exists(select 1 from public.organization_staff_directory s where s.organization_id=p_org and s.user_id=actor and s.expires_at is not null and (ends is null or ends>s.expires_at)) or exists(select 1 from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=actor and g.permission='staff.manage' and g.expires_at is not null and (ends is null or ends>g.expires_at)) then raise exception 'Delegation exceeds authority dates' using errcode='42501';end if;
     insert into public.organization_staff_permissions(organization_id,user_id,permission,department_ids,effective_at,expires_at,template_id) values(p_org,target,key,scopes,starts,ends,template)
     on conflict(organization_id,user_id,permission) do update set department_ids=excluded.department_ids,effective_at=excluded.effective_at,expires_at=excluded.expires_at,template_id=excluded.template_id,revoked_at=null,granted_at=clock_timestamp();
    end if;
   end loop;
   update public.organization_staff_directory set revision=revision+1,updated_at=clock_timestamp() where organization_id=p_org and user_id=target;
  end if;
  select jsonb_build_object('assignment',to_jsonb(s),'grants',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from public.organization_staff_permissions g where g.organization_id=p_org and g.user_id=target)) into result from public.organization_staff_directory s where s.organization_id=p_org and s.user_id=target;
  insert into public.organization_admin_events(organization_id,actor_user_id,subject_id,kind,before_state,after_state) values(p_org,actor,person,'staff_access',prior,result||jsonb_build_object('operation',p_action,'reason',left(coalesce(p_payload->>'reason',''),500)));
  return jsonb_build_object('saved',true);
 end if;
 raise exception 'Unknown People operation' using errcode='22023';
end $$;

create or replace function private.outreach_registration_workspace(action text,c uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
 declare x public.outreach_campaigns;s public.outreach_registration_settings;r public.outreach_event_registrations;m public.outreach_event_attendees;id uuid;row jsonb;result jsonb;cap text;csv text;begin
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>60000 then raise exception 'Invalid request';end if;
 if action='campaigns' then return coalesce((select jsonb_agg(jsonb_build_object('id',z.id,'name',z.name)) from public.outreach_campaigns z where private.outreach_registration_can(z.id,'registration.view')),'[]');end if;
 cap:=case when action in ('list','detail','context') then 'registration.view' when action='csv' then 'registration.export' when action in ('checkin','reverse') then 'checkin.manage' else 'registration.manage' end;
 if not private.outreach_registration_can(c,cap) then raise exception 'Registration access denied' using errcode='42501';end if;
 if action not in ('list','detail','context','csv') then perform 1 from public.outreach_campaigns where outreach_campaigns.id=c for update;
  if not private.outreach_registration_can(c,cap) then raise exception 'Registration access denied' using errcode='42501';end if;end if;
 select * into x from public.outreach_campaigns where outreach_campaigns.id=c;
 select * into s from public.outreach_registration_settings where campaign_id=c;
 if action='context' then return jsonb_build_object('name',x.name,'config',private.outreach_registration_config(c),'settings',case when private.outreach_admin(x.organization_id,true) then to_jsonb(s) else null end,'admin',private.outreach_admin(x.organization_id,true),'can_manage_access',private.outreach_admin(x.organization_id,true) and private.has_staff_permission(x.organization_id,'staff.manage'),'capabilities',(select jsonb_agg(k) from unnest(array['registration.view','registration.manage','registration.export','checkin.manage']) k where private.outreach_registration_can(c,k)));end if;
 if action='configure' then
  if not private.outreach_admin(x.organization_id,true) then raise exception 'Campaign administrator required' using errcode='42501';end if;
  if coalesce(s.revision,0) is distinct from (p->>'revision')::int then raise exception 'Configuration changed';end if;
  for row in select value from jsonb_array_elements(coalesce(p->'prize_choices','[]')) loop
   if (row->>'id' ~ '^[a-z0-9_-]{1,60}$') is distinct from true or length(coalesce(row->>'label','')) not between 1 and 100 or length(coalesce(row->>'guidance',''))>500 then raise exception 'Invalid prize choice';end if;end loop;
  for row in select value from jsonb_array_elements(coalesce(p->'extra_fields','[]')) loop
   if (row->>'id' ~ '^[a-z0-9_-]{1,60}$') is distinct from true or length(coalesce(row->>'label','')) not between 1 and 160 or (row->>'type' in ('text','boolean','choice')) is distinct from true or jsonb_typeof(row->'required') is distinct from 'boolean' or (row->>'type'='choice' and (jsonb_typeof(row->'options') is distinct from 'array' or jsonb_array_length(row->'options')=0)) then raise exception 'Invalid mapped field';end if;end loop;
  if (select count(*) from jsonb_array_elements(coalesce(p->'prize_choices','[]')))<>(select count(distinct z->>'id') from jsonb_array_elements(coalesce(p->'prize_choices','[]')) z) or (select count(*) from jsonb_array_elements(coalesce(p->'extra_fields','[]')))<>(select count(distinct z->>'id') from jsonb_array_elements(coalesce(p->'extra_fields','[]')) z) then raise exception 'Duplicate configured choices';end if;
  if p ? 'event_profile' and (jsonb_typeof(p->'event_profile')<>'object' or exists(select 1 from jsonb_each(p->'event_profile') z where z.key not in ('public_name','on_site_registration_at','confirmation_message','highlights') or jsonb_typeof(z.value)<>'string' or length(z.value#>>'{}')>2000)) then raise exception 'Invalid public event profile';end if;
  if nullif(p->'event_profile'->>'on_site_registration_at','') is not null then perform (p->'event_profile'->>'on_site_registration_at')::timestamptz;end if;
  insert into public.outreach_registration_settings(campaign_id,public_slug,enabled,opens_at,closes_at,address_required,waiver_required,household_limit,instructions,prize_choices,extra_fields,structured_address,emergency_phone_required,event_profile)
  values(c,p->>'public_slug',coalesce((p->>'enabled')::boolean,false),(p->>'opens_at')::timestamptz,(p->>'closes_at')::timestamptz,coalesce((p->>'address_required')::boolean,false),coalesce((p->>'waiver_required')::boolean,true),(p->>'household_limit')::int,coalesce(p->>'instructions',''),coalesce(p->'prize_choices','[]'),coalesce(p->'extra_fields','[]'),coalesce((p->>'structured_address')::boolean,s.structured_address,false),coalesce((p->>'emergency_phone_required')::boolean,s.emergency_phone_required,false),coalesce(p->'event_profile',s.event_profile,'{}'))
  on conflict(campaign_id) do update set public_slug=excluded.public_slug,enabled=excluded.enabled,opens_at=excluded.opens_at,closes_at=excluded.closes_at,address_required=excluded.address_required,waiver_required=excluded.waiver_required,household_limit=excluded.household_limit,instructions=excluded.instructions,prize_choices=excluded.prize_choices,extra_fields=excluded.extra_fields,structured_address=excluded.structured_address,emergency_phone_required=excluded.emergency_phone_required,event_profile=excluded.event_profile,revision=outreach_registration_settings.revision+1;
  perform private.outreach_audit(c,x.organization_id,'registration.configured',c);return jsonb_build_object('saved',true);
 elsif action='waiver_publish' then
  if not private.outreach_admin(x.organization_id,true) then raise exception 'Campaign administrator required' using errcode='42501';end if;
  insert into public.outreach_waiver_versions(campaign_id,template_key,version,effective_at,text_snapshot,created_by,media_text_snapshot,media_required,media_initials_required) values(c,p->>'template_key',(p->>'version')::int,(p->>'effective_at')::timestamptz,p->>'text',auth.uid(),coalesce(p->>'media_text',''),coalesce((p->>'media_required')::boolean,false),coalesce((p->>'media_initials_required')::boolean,false)) returning outreach_waiver_versions.id into id;
  perform private.outreach_audit(c,x.organization_id,'waiver.published',id);return jsonb_build_object('id',id);
 elsif action='assignments' then
  if not (private.outreach_admin(x.organization_id,true) and private.has_staff_permission(x.organization_id,'staff.manage')) then raise exception 'Independent staff permission administrator required' using errcode='42501';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id',a.user_id,'email',u.email,'capabilities',a.capabilities,'revision',a.revision,'active',a.active)) from public.outreach_campaign_assignments a join auth.users u on u.id=a.user_id where a.campaign_id=c),'[]'::jsonb);
 elsif action='access' then
  if not (private.outreach_admin(x.organization_id,true) and private.has_staff_permission(x.organization_id,'staff.manage')) then raise exception 'Independent staff permission administrator required' using errcode='42501';end if;
  if (p->>'user_id')::uuid is not distinct from auth.uid() then raise exception 'Self permission changes prohibited' using errcode='42501';end if;
  if length(btrim(coalesce(p->>'reason','')))<10 then raise exception 'Review reason required';end if;
  if exists(select 1 from jsonb_array_elements_text(p->'capabilities') k where k not in ('registration.view','registration.manage','registration.export','checkin.manage')) then raise exception 'Only registration capabilities permitted';end if;
  update public.outreach_campaign_assignments set capabilities=array(select distinct k from unnest(capabilities||array(select jsonb_array_elements_text(p->'capabilities'))) k where k not in ('registration.view','registration.manage','registration.export','checkin.manage') or (p->'capabilities') ? k),revision=revision+1,reason=p->>'reason' where campaign_id=c and user_id=(p->>'user_id')::uuid and revision=(p->>'revision')::int;
  if not found then raise exception 'Assignment changed';end if;perform private.outreach_audit(c,x.organization_id,'registration.access_changed',(p->>'user_id')::uuid);return jsonb_build_object('saved',true);
 elsif action='walkup' then return private.outreach_registration_submit(c,p,'walkup');
 elsif action='list' then
  return jsonb_build_object('registrations',(select coalesce(jsonb_agg(jsonb_build_object('id',z.id,'reference',z.reference,'name',z.first_name||' '||z.last_name,'phone',z.phone,'email',z.email,'source',z.source,'status',z.status,'attendees',(select count(*) from public.outreach_event_attendees a where a.registration_id=z.id and a.active)) order by z.submitted_at desc),'[]') from public.outreach_event_registrations z where z.campaign_id=c and (coalesce(p->>'search','')='' or concat_ws(' ',z.reference,z.first_name,z.last_name,z.phone,z.email) ilike '%'||replace(replace(p->>'search','%','\%'),'_','\_')||'%')),
   'summary',(select jsonb_build_object(
    'households',count(distinct z.id),
    'attendees',count(a.id), 'adults',count(a.id) filter(where a.age>=18), 'minors',count(a.id) filter(where a.age<18),
    'waivers_complete',count(a.id) filter(where private.outreach_registration_coverage(c,a.id)),
    'waivers_missing',count(a.id) filter(where not private.outreach_registration_coverage(c,a.id)),
    'checked_in',count(a.id) filter(where a.checked_in_at is not null),
    'checked_in_adults',count(a.id) filter(where a.checked_in_at is not null and a.age>=18),
    'checked_in_minors',count(a.id) filter(where a.checked_in_at is not null and a.age<18),
    'not_checked_in',count(a.id) filter(where a.checked_in_at is null),
    'walkups',count(distinct z.id) filter(where z.source='walkup'))
    from public.outreach_event_registrations z left join public.outreach_event_attendees a on a.registration_id=z.id and a.campaign_id=c and a.active and a.attending
    where z.campaign_id=c and z.status in ('submitted','confirmed','checked_in')));
 elsif action='csv' then
  csv:='Registration Reference,Registration Date/Time,Primary First Name,Primary Last Name,Phone,Email,Address,City,State,ZIP,Attendee Name,Adult/Minor,Age,Relationship,Guardian,Emergency Phone,Waiver Status,Media Consent,Check-In Status,Source' || E'\r\n';
  -- Same canonical active population as headline totals, independent of table search.
  -- A household without an attending member retains one blank attendee row for household reconciliation.
  for row in select jsonb_build_array(z.reference,to_char(z.submitted_at at time zone x.timezone,'YYYY-MM-DD HH24:MI:SS')||' '||x.timezone,z.first_name,z.last_name,z.phone,z.email,coalesce(nullif(concat_ws(' ',z.address_details->>'street',z.address_details->>'line2'),''),z.address),z.address_details->>'city',z.address_details->>'state',z.address_details->>'postal',concat_ws(' ',a.first_name,a.last_name),case when a.id is null then '' when a.age<18 then 'Minor' else 'Adult' end,a.age::text,a.relationship,a.guardian_relationship,z.emergency_phone,case when a.id is null then '' when private.outreach_registration_coverage(c,a.id) then 'Covered' else 'Missing' end,case when coalesce((z.consents->>'media')::boolean,false) then 'Yes' else 'No' end,case when a.id is null then '' when a.checked_in_at is null then 'Not checked in' else 'Checked in' end,z.source)
  from public.outreach_event_registrations z left join public.outreach_event_attendees a on a.registration_id=z.id and a.campaign_id=c and a.active and a.attending
  where z.campaign_id=c and z.status in ('submitted','confirmed','checked_in') order by z.submitted_at,z.id,a.id loop
   csv:=csv||(select string_agg(private.outreach_csv_cell(value),',' order by n) from jsonb_array_elements_text(row) with ordinality t(value,n))||E'\r\n';end loop;
  perform private.outreach_audit(c,x.organization_id,'registration.exported',c);return jsonb_build_object('csv',csv,'filename',x.code||'-registration-roster.csv');
 end if;
 select * into r from public.outreach_event_registrations where campaign_id=c and outreach_event_registrations.id=(p->>'registration_id')::uuid;
 if not found then raise exception 'Household outside campaign' using errcode='42501';end if;
 if action='detail' then return private.outreach_registration_detail(c,r.id);end if;
 if action='update' then
  if r.revision is distinct from (p->>'revision')::int then raise exception 'Registration changed';end if;
  if p->>'status'='checked_in' and not exists(select 1 from public.outreach_event_attendees where registration_id=r.id and checked_in_at is not null) then raise exception 'Record individual attendee check-in first';end if;
  if p->>'status' in ('cancelled','no_show','closed') and exists(select 1 from public.outreach_event_attendees where registration_id=r.id and checked_in_at is not null) then raise exception 'Reverse check-ins before closing registration';end if;
  if p ? 'address_details' then perform private.outreach_registration_address(p->'address_details',s.structured_address and s.address_required);end if;
  if s.structured_address and p ? 'address' and not (p ? 'address_details') then raise exception 'Use structured address fields';end if;
  if s.emergency_phone_required and p ? 'emergency_phone' and length(btrim(coalesce(p->>'emergency_phone','')))=0 then raise exception 'Emergency telephone required';end if;
  update public.outreach_event_registrations set first_name=coalesce(p->>'first_name',first_name),last_name=coalesce(p->>'last_name',last_name),email=coalesce(p->>'email',email),phone=coalesce(p->>'phone',phone),address=case when p ? 'address_details' then private.outreach_registration_address(p->'address_details',s.structured_address and s.address_required) else coalesce(p->>'address',address) end,address_details=coalesce(p->'address_details',address_details),emergency_phone=coalesce(p->>'emergency_phone',emergency_phone),notes=coalesce(p->>'notes',notes),status=case when exists(select 1 from public.outreach_event_attendees where registration_id=r.id and checked_in_at is not null) then 'checked_in' else coalesce(p->>'status',status) end,revision=revision+1 where outreach_event_registrations.id=r.id;
 elsif action='sign' then id:=private.outreach_registration_sign(c,r.id,p);return jsonb_build_object('id',id);
 elsif action='waiver_correct' then
  if not exists(select 1 from public.outreach_waiver_signatures where registration_id=r.id and outreach_waiver_signatures.id=(p->>'signature_id')::uuid) then raise exception 'Signature outside household' using errcode='42501';end if;
  if exists(select 1 from public.outreach_event_attendees where registration_id=r.id and checked_in_at is not null) then raise exception 'Reverse check-ins before correcting waiver';end if;
  insert into public.outreach_waiver_corrections values((p->>'signature_id')::uuid,p->>'reason',auth.uid(),now());perform private.outreach_audit(c,x.organization_id,'waiver.corrected',(p->>'signature_id')::uuid);return jsonb_build_object('saved',true);
 elsif action='attendee_add' then id:=private.outreach_registration_attendee(c,r.id,p);return jsonb_build_object('id',id);
 else
  select * into m from public.outreach_event_attendees where campaign_id=c and registration_id=r.id and outreach_event_attendees.id=(p->>'attendee_id')::uuid;
  if not found then raise exception 'Attendee outside household' using errcode='42501';end if;
  if action in ('checkin','reverse') then
   if action='checkin' then
    if not m.active or not m.attending or r.status in ('cancelled','no_show','closed') or (s.waiver_required and not private.outreach_registration_coverage(c,m.id)) then raise exception 'Active attendee and valid waiver coverage required';end if;
    if m.checked_in_at is not null then return jsonb_build_object('saved',true,'already_checked_in',true);end if;
    update public.outreach_event_attendees set checked_in_at=clock_timestamp(),checked_in_by=auth.uid(),wristband=coalesce(p->>'wristband',wristband),revision=revision+1 where outreach_event_attendees.id=m.id;
    insert into public.outreach_prize_participants(campaign_id,attendee_id,checked_in_at,active) select c,m.id,checked_in_at,m.prize_participation from public.outreach_event_attendees where outreach_event_attendees.id=m.id on conflict(campaign_id,attendee_id) where attendee_id is not null do update set checked_in_at=excluded.checked_in_at,active=excluded.active;
    update public.outreach_event_registrations set status='checked_in',revision=revision+1 where outreach_event_registrations.id=r.id;
   else
    if length(btrim(coalesce(p->>'reason','')))<10 then raise exception 'Correction reason required';end if;
    if m.checked_in_at is null then return jsonb_build_object('saved',true,'already_reversed',true);end if;
    update public.outreach_event_attendees set checked_in_at=null,checked_in_by=null,revision=revision+1 where outreach_event_attendees.id=m.id;
    update public.outreach_prize_participants set checked_in_at=null,active=false where attendee_id=m.id;
    update public.outreach_event_registrations set status=case when exists(select 1 from public.outreach_event_attendees where registration_id=r.id and checked_in_at is not null) then 'checked_in' else 'confirmed' end,revision=revision+1 where outreach_event_registrations.id=r.id;
   end if;
   perform private.outreach_audit(c,x.organization_id,case when action='checkin' then 'attendee.checked_in' else 'attendee.checkin_reversed' end,m.id,jsonb_build_object('reason',case when action='reverse' then p->>'reason' else null end));
   perform private.outreach_event(c,case when action='checkin' then 'outreach.attendee.checked_in' else 'outreach.attendee.checkin_reversed' end,m.id,action||':'||m.id||':'||(m.revision+1));return jsonb_build_object('saved',true);
  elsif action='attendee_update' then
   if m.revision is distinct from (p->>'revision')::int then raise exception 'Attendee changed';end if;
   if m.checked_in_at is not null then raise exception 'Reverse check-in before editing attendee';end if;
   perform private.outreach_registration_answers(c,coalesce(p->'answers',m.answers));
   if p->>'prize_choice' is not null and not exists(select 1 from jsonb_array_elements(s.prize_choices) ch where ch->>'id'=p->>'prize_choice') then raise exception 'Prize choice not configured';end if;
   update public.outreach_event_attendees set prize_participation=coalesce((p->>'prize_participation')::boolean,prize_participation),bike_interest=coalesce((p->>'bike_interest')::boolean,bike_interest),tablet_only=coalesce((p->>'tablet_only')::boolean,tablet_only),prize_choice=case when p ? 'prize_choice' then p->>'prize_choice' else prize_choice end,answers=coalesce(p->'answers',answers),first_name=coalesce(p->>'first_name',first_name),last_name=coalesce(p->>'last_name',last_name),age=coalesce((p->>'age')::int,age),guardian_relationship=coalesce(p->>'guardian_relationship',guardian_relationship),attending=coalesce((p->>'attending')::boolean,attending),active=coalesce((p->>'active')::boolean,active),notes=coalesce(p->>'notes',notes),wristband=coalesce(p->>'wristband',wristband),revision=revision+1 where outreach_event_attendees.id=m.id;
   perform private.outreach_audit(c,x.organization_id,case when p->>'active'='false' then 'attendee.removed' else 'attendee.updated' end,m.id);
  else raise exception 'Unsupported registration action';end if;
 end if;
 perform private.outreach_audit(c,x.organization_id,'registration.updated',r.id);perform private.outreach_event(c,'outreach.registration.updated',r.id,'registration-update:'||gen_random_uuid());
 if action='update' and p->>'status'='confirmed' and r.status<>'confirmed' then perform private.outreach_event(c,'outreach.registration.confirmed',r.id,'registration-confirmed:'||r.id);end if;
 return jsonb_build_object('saved',true);end $$;

commit;
