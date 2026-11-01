-- SOURCE PREPARATION ONLY. No application role can execute this primitive.
-- Existing independent administrator checks are a required minimum, not an
-- approved Partner issuer policy. No public wrapper, grants or linking API.
create function private.partner_revoke_assigned_access(
 p_campaign uuid,p_partner uuid,p_kind text,p_subject uuid,p_revision integer,p_request uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare
 actor uuid:=auth.uid(); sid uuid; org uuid; person uuid; target uuid;
 deadline timestamptz:='infinity'; expiry timestamptz;
 access_row public.outreach_partner_users; assignment_row public.outreach_partner_assignments;
 prior public.outreach_campaign_audit; before_state jsonb; after_state jsonb; result jsonb; request_hash text;
begin
 if actor is null or p_campaign is null or p_partner is null or p_subject is null or p_request is null
   or p_kind is null or p_kind not in ('access','assignment') or p_revision is null or p_revision<1
   or p_reason is null or length(btrim(p_reason)) not between 10 and 500 then
  raise exception 'Exact reviewed revocation request required' using errcode='22023';end if;
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
 perform 1 from public.outreach_partner_churches where id=p_partner and campaign_id=p_campaign for share;
 if not found then raise exception 'Partner unavailable' using errcode='42501';end if;
 request_hash:=encode(sha256(convert_to(jsonb_build_object('campaign',p_campaign,'partner',p_partner,'kind',p_kind,
  'subject',p_subject,'revision',p_revision,'reason',p_reason)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('partner-revoke:'||p_request::text,261101));
 if p_kind='access' then
  select * into access_row from public.outreach_partner_users where partner_church_id=p_partner and campaign_id=p_campaign and user_id=p_subject for update;
  if not found then raise exception 'Assigned access unavailable' using errcode='42501';end if;
  target:=access_row.user_id;before_state:=jsonb_build_object('revision',access_row.revision,'active',access_row.active);
 else
  select * into assignment_row from public.outreach_partner_assignments where id=p_subject and partner_church_id=p_partner and campaign_id=p_campaign for update;
  if not found then raise exception 'Assigned record unavailable' using errcode='42501';end if;
  target:=assignment_row.assigned_worker_user_id;before_state:=jsonb_build_object('revision',assignment_row.revision,'status',assignment_row.status);
 end if;
 if target is not distinct from actor then raise exception 'Self changes prohibited' using errcode='42501';end if;
 if clock_timestamp()>=deadline then raise exception 'Administrator expired' using errcode='42501';end if;
 select * into prior from public.outreach_campaign_audit where kind='partner.private_revoked' and metadata->>'request_id'=p_request::text;
 if found then
  if prior.actor_user_id is distinct from actor or prior.campaign_id is distinct from p_campaign
   or prior.metadata->>'request_sha256' is distinct from request_hash or prior.metadata->'after' is distinct from before_state then
   raise exception 'Revocation replay conflict' using errcode='40001';end if;
  if clock_timestamp()>=deadline then raise exception 'Administrator expired' using errcode='42501';end if;
  return prior.metadata->'result';
 end if;
 if (before_state->>'revision')::integer<>p_revision then raise exception 'Assignment changed' using errcode='40001';end if;
 if p_kind='access' then
  if not access_row.active then raise exception 'Access already revoked' using errcode='40001';end if;
  update public.outreach_partner_users set active=false,revision=revision+1
   where partner_church_id=p_partner and user_id=p_subject and revision=p_revision
   returning jsonb_build_object('revision',revision,'active',active) into after_state;
 else
  if assignment_row.status='revoked' then raise exception 'Assignment already revoked' using errcode='40001';end if;
  update public.outreach_partner_assignments set status='revoked',revoked_at=clock_timestamp(),revoked_by=actor,revision=revision+1
   where id=p_subject and revision=p_revision returning jsonb_build_object('revision',revision,'status',status) into after_state;
 end if;
 if not found then raise exception 'Assignment changed' using errcode='40001';end if;
 result:=jsonb_build_object('revoked',true,'kind',p_kind,'subject',p_subject,'revision',(after_state->>'revision')::integer);
 perform private.outreach_audit(p_campaign,org,'partner.private_revoked',p_subject,jsonb_build_object('request_id',p_request,
  'request_sha256',request_hash,'partner_id',p_partner,'reason',p_reason,'before',before_state,'after',after_state,'result',result));
 if clock_timestamp()>=deadline then raise exception 'Administrator expired' using errcode='42501';end if;
 return result;
end $$;
revoke all on function private.partner_revoke_assigned_access(uuid,uuid,text,uuid,integer,uuid,text)
 from public,anon,authenticated,service_role;
-- A separately reviewed authority/issuance policy and public wrapper would be a
-- future package. Do not grant EXECUTE as a shortcut to operational activation.
