-- PRIVATE SOURCE PREPARATION ONLY. No public wrapper or application EXECUTE.
-- Existing AND administrator checks are a necessary minimum, not an approved
-- operational Partner issuer policy. No campaign/contact/pastoral/finance grant.
create function private.partner_prepare_assignment(
 p_campaign uuid,p_partner uuid,p_action text,p_worker uuid,p_assignment uuid,
 p_decision uuid,p_previous_worker uuid,p_revision integer,p_expires timestamptz,
 p_request uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare
 actor uuid:=auth.uid();sid uuid;org uuid;person uuid;expiry timestamptz;deadline timestamptz:='infinity';
 worker uuid;request_hash text;prior public.outreach_campaign_audit;current_access public.outreach_partner_users;
 current_assignment public.outreach_partner_assignments;before_state jsonb;after_state jsonb;result jsonb;target uuid;
begin
 if actor is null or p_campaign is null or p_partner is null or p_worker is null or p_request is null
  or p_action is null or p_action not in ('issue_access','assign','reassign')
  or p_reason is null or length(btrim(p_reason)) not between 10 and 500 or p_revision is null
  or p_worker=actor or p_previous_worker=actor then
  raise exception 'Independent exact Partner request required' using errcode='22023';end if;
 if (p_action='issue_access' and (p_revision<>0 or p_expires is null or not isfinite(p_expires) or p_expires<=clock_timestamp() or p_assignment is not null or p_decision is not null or p_previous_worker is not null))
  or (p_action='assign' and (p_revision<>0 or p_assignment is null or p_decision is null or p_previous_worker is not null or p_expires is not null))
  or (p_action='reassign' and (p_revision<1 or p_assignment is null or p_decision is null or p_previous_worker is null or p_worker=p_previous_worker or p_expires is not null)) then
  raise exception 'Explicit creation/reassignment binding required' using errcode='22023';end if;
 begin sid:=nullif(auth.jwt()->>'session_id','')::uuid;
 exception when invalid_text_representation then raise exception 'Administrator unavailable' using errcode='42501';end;
 if sid is null then raise exception 'Administrator unavailable' using errcode='42501';end if;
 -- Fixed lock order: actor, session, campaign, directory, optional account link,
 -- staff permission, campaign admin, Partner church, request key, target.
 perform 1 from auth.users where id=actor and email_confirmed_at is not null
  and not coalesce(is_anonymous,false) and deleted_at is null
  and (banned_until is null or banned_until<=clock_timestamp()) for share;
 if not found then raise exception 'Administrator unavailable' using errcode='42501';end if;
 select not_after into expiry from auth.sessions where id=sid and user_id=actor for share;
 if not found or expiry<=clock_timestamp() then raise exception 'Administrator unavailable' using errcode='42501';end if;
 deadline:=least(deadline,coalesce(expiry,'infinity'));
 select organization_id into org from public.outreach_campaigns where id=p_campaign for share;
 if not found then raise exception 'Campaign unavailable' using errcode='42501';end if;
 select person_id,expires_at into person,expiry from public.organization_staff_directory
  where organization_id=org and user_id=actor and active and effective_at<=clock_timestamp()
   and (expires_at is null or expires_at>clock_timestamp()) for share;
 if not found then raise exception 'Independent administrator required' using errcode='42501';end if;
 deadline:=least(deadline,coalesce(expiry,'infinity'));
 if person is not null then
  perform 1 from public.portal_account_links where organization_id=org and person_id=person and user_id=actor and active for share;
  if not found then raise exception 'Administrator account link unavailable' using errcode='42501';end if;
 end if;
 select expires_at into expiry from public.organization_staff_permissions where organization_id=org and user_id=actor
  and permission='staff.manage' and department_ids is null and revoked_at is null and effective_at<=clock_timestamp()
  and (expires_at is null or expires_at>clock_timestamp()) for share;
 if not found then raise exception 'Independent administrator required' using errcode='42501';end if;
 deadline:=least(deadline,coalesce(expiry,'infinity'));
 select expires_at into expiry from public.outreach_campaign_admins where organization_id=org and user_id=actor
  and capability='manage' and active and effective_at<=clock_timestamp() and (expires_at is null or expires_at>clock_timestamp()) for share;
 if not found then raise exception 'Independent administrator required' using errcode='42501';end if;
 deadline:=least(deadline,coalesce(expiry,'infinity'));
 perform 1 from public.outreach_partner_churches where id=p_partner and campaign_id=p_campaign and active for share;
 if not found then raise exception 'Partner unavailable' using errcode='42501';end if;

 -- Every target principal is real verified Auth evidence, never a guessed email.
 -- Shared locks protect non-key revocation; consistent UUID ordering avoids two
 -- competing reassignments acquiring old/new worker rows in opposite order.
 for worker in select distinct x from unnest(array[p_worker,p_previous_worker]) x where x is not null order by x loop
  perform 1 from auth.users where id=worker and email_confirmed_at is not null and not coalesce(is_anonymous,false)
   and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) for share;
  if not found then raise exception 'Verified worker unavailable' using errcode='42501';end if;
  select expires_at into expiry from public.outreach_campaign_assignments where campaign_id=p_campaign and user_id=worker
   and active and effective_at<=clock_timestamp() and (expires_at is null or expires_at>clock_timestamp())
   and 'view'=any(capabilities) for share;
  if not found then raise exception 'Explicit campaign worker unavailable' using errcode='42501';end if;
  deadline:=least(deadline,coalesce(expiry,'infinity'));
  if p_action<>'issue_access' then
   select expires_at into expiry from public.outreach_partner_users where campaign_id=p_campaign and partner_church_id=p_partner
    and user_id=worker and active and effective_at<=clock_timestamp() and (expires_at is null or expires_at>clock_timestamp())
    and 'partner.view'=any(capabilities) for share;
   if not found then raise exception 'Explicit Partner worker unavailable' using errcode='42501';end if;
   deadline:=least(deadline,coalesce(expiry,'infinity'));
  end if;
 end loop;
 if p_action<>'issue_access' then
  perform 1 from public.outreach_campaign_registrants where campaign_id=p_campaign and organization_id=org
   and legacy_registration_id=p_decision for share;
  if not found then raise exception 'Exact decision association unavailable' using errcode='42501';end if;
 end if;
 request_hash:=encode(sha256(convert_to(jsonb_build_object('campaign',p_campaign,'partner',p_partner,'action',p_action,
  'worker',p_worker,'assignment',p_assignment,'decision',p_decision,'previous_worker',p_previous_worker,
  'revision',p_revision,'expires',p_expires,'reason',p_reason)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('partner-prepare:'||p_request::text,261101));
 -- Serializes absent-row creation. Existing rows still use row locks/CAS.
 if p_action='issue_access' then
  perform pg_advisory_xact_lock(hashtextextended('partner-access:'||p_partner::text||p_worker::text,261101));
  select * into current_access from public.outreach_partner_users where partner_church_id=p_partner and user_id=p_worker for update;
  before_state:=case when found then jsonb_build_object('revision',current_access.revision,'active',current_access.active,
   'worker',current_access.user_id,'capabilities',current_access.capabilities,'expires',current_access.expires_at)else null end;
  target:=p_worker;
 else
  perform pg_advisory_xact_lock(hashtextextended('partner-assignment:'||p_assignment::text,261101));
  select * into current_assignment from public.outreach_partner_assignments where id=p_assignment for update;
  before_state:=case when found then jsonb_build_object('revision',current_assignment.revision,'status',current_assignment.status,
   'worker',current_assignment.assigned_worker_user_id,'campaign',current_assignment.campaign_id,
   'partner',current_assignment.partner_church_id,'decision',current_assignment.decision_registration_id,'event',current_assignment.event_registration_id)else null end;
  target:=p_assignment;
 end if;
 if clock_timestamp()>=deadline then raise exception 'Assignment authority expired' using errcode='42501';end if;
 select * into prior from public.outreach_campaign_audit where kind='partner.private_prepared' and metadata->>'request_id'=p_request::text;
 if found then
  if prior.actor_user_id is distinct from actor or prior.campaign_id is distinct from p_campaign
   or prior.metadata->>'request_sha256' is distinct from request_hash or prior.metadata->'after' is distinct from before_state then
   raise exception 'Assignment replay conflict' using errcode='40001';end if;
  return prior.metadata->'result';
 end if;
 if p_action='issue_access' then
  if before_state is not null then raise exception 'Existing Partner access cannot be replaced' using errcode='40001';end if;
  if p_expires>deadline then raise exception 'Access cannot outlive required authority' using errcode='22023';end if;
  insert into public.outreach_partner_users(partner_church_id,campaign_id,user_id,capabilities,effective_at,expires_at,granted_by,reason)
   values(p_partner,p_campaign,p_worker,array['partner.view'],clock_timestamp(),p_expires,actor,p_reason)
   returning jsonb_build_object('revision',revision,'active',active,'worker',user_id,'capabilities',capabilities,'expires',expires_at) into after_state;
 elsif p_action='assign' then
  if before_state is not null then raise exception 'Existing assignment cannot be replaced' using errcode='40001';end if;
  insert into public.outreach_partner_assignments(id,campaign_id,partner_church_id,decision_registration_id,assigned_worker_user_id,assigned_by,assignment_reason)
   values(p_assignment,p_campaign,p_partner,p_decision,p_worker,actor,p_reason)
   returning jsonb_build_object('revision',revision,'status',status,'worker',assigned_worker_user_id,'campaign',campaign_id,
    'partner',partner_church_id,'decision',decision_registration_id,'event',event_registration_id) into after_state;
 else
  if current_assignment.id is null or current_assignment.campaign_id<>p_campaign or current_assignment.partner_church_id<>p_partner
   or current_assignment.decision_registration_id is distinct from p_decision or current_assignment.event_registration_id is not null
   or current_assignment.assigned_worker_user_id is distinct from p_previous_worker or current_assignment.status<>'active'
   or current_assignment.revision<>p_revision then raise exception 'Reviewed assignment changed' using errcode='40001';end if;
  update public.outreach_partner_assignments set assigned_worker_user_id=p_worker,assigned_by=actor,
   assigned_at=clock_timestamp(),assignment_reason=p_reason,revision=revision+1 where id=p_assignment and revision=p_revision
   returning jsonb_build_object('revision',revision,'status',status,'worker',assigned_worker_user_id,'campaign',campaign_id,
    'partner',partner_church_id,'decision',decision_registration_id,'event',event_registration_id) into after_state;
  if not found then raise exception 'Assignment changed' using errcode='40001';end if;
 end if;
 result:=jsonb_build_object('prepared',true,'action',p_action,'subject',target,'revision',(after_state->>'revision')::integer,
  'personId',null,'identityStatus','unverified');
 perform private.outreach_audit(p_campaign,org,'partner.private_prepared',target,jsonb_build_object('request_id',p_request,
  'request_sha256',request_hash,'partner_id',p_partner,'reason',p_reason,'before',before_state,'after',after_state,'result',result));
 if clock_timestamp()>=deadline then raise exception 'Assignment authority expired' using errcode='42501';end if;
 return result;
end $$;
revoke all on function private.partner_prepare_assignment(uuid,uuid,text,uuid,uuid,uuid,uuid,integer,timestamptz,uuid,text)
 from public,anon,authenticated,service_role;
