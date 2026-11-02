-- SOURCE-ONLY ENVELOPE: installed only in disposable acceptance databases.
-- No migration, login credential, role membership or exposed API is provided.
-- postgres is the existing trusted function/DDL owner, never the host credential.
begin;
create role partner_canonical_reader nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
create schema partner_identity_host authorization postgres;
revoke all on schema partner_identity_host from public,anon,authenticated,service_role;
-- Namespace resolution is needed by the existing exact catalog verifier only.
-- USAGE grants no relation access or execution of an ungranted routine.
grant usage on schema partner_identity_host,private,auth,public to partner_canonical_reader;
create function partner_identity_host.current_snapshot(uuid,uuid,uuid,uuid,uuid)
returns table(snapshot jsonb) language plpgsql volatile security definer set search_path='' as $envelope$
declare metadata jsonb;
begin
 -- A trusted server binds these transaction-local claims. Equality is a
 -- consistency check, NOT cryptographic verification of caller-set GUCs.
 if $1 is null or $2 is null or $3 is null or $4 is null or $5 is null
   or auth.uid() is distinct from $4
   or (auth.jwt()->>'session_id') is distinct from $5::text then
  raise exception 'Canonical identity unavailable' using errcode='42501';
 end if;
 metadata:=private.partner_assigned_metadata($2,$3);
 if jsonb_array_length(metadata)<>1 or metadata->0->>'organizationId' is distinct from $1::text
   or metadata->0->>'status' is distinct from 'active' then
  raise exception 'Canonical identity unavailable' using errcode='42501';
 end if;
 return query
-- Exact positive existing-row association only; missing/ambiguous rows deny.
-- Every successful authority/provenance row is held FOR SHARE through callback
-- and commit. Existing UNIQUE account/source keys prevent replacement inserts.
select jsonb_build_object(
 'actor',jsonb_build_object('id',u.id,'email_confirmed_at',u.email_confirmed_at,'is_anonymous',u.is_anonymous,'deleted_at',u.deleted_at,'banned_until',u.banned_until),
 'session',jsonb_build_object('id',s.id,'user_id',s.user_id,'not_after',s.not_after),
 'campaign',jsonb_build_object('id',c.id,'organization_id',c.organization_id),
 'partner',jsonb_build_object('id',pc.id,'campaign_id',pc.campaign_id,'active',pc.active),
 'assignment',jsonb_build_object('id',a.id,'campaign_id',a.campaign_id,'partner_church_id',a.partner_church_id,'assigned_worker_user_id',a.assigned_worker_user_id,'status',a.status,'event_registration_id',a.event_registration_id,'decision_registration_id',a.decision_registration_id,'revision',a.revision),
 'campaignGrant',jsonb_build_object('campaign_id',ca.campaign_id,'user_id',ca.user_id,'active',ca.active,'effective_at',ca.effective_at,'expires_at',ca.expires_at,'capabilities',ca.capabilities),
 'partnerGrant',jsonb_build_object('campaign_id',pu.campaign_id,'partner_church_id',pu.partner_church_id,'user_id',pu.user_id,'active',pu.active,'effective_at',pu.effective_at,'expires_at',pu.expires_at,'capabilities',pu.capabilities),
 'source',jsonb_build_object('id',d.id,'user_id',d.user_id,'consent',d.consent),
 'currentSourceHash',encode(sha256(convert_to(to_jsonb(d)::text,'UTF8')),'hex'),
 'registrant',jsonb_build_object('id',r.id,'campaign_id',r.campaign_id,'organization_id',r.organization_id,'legacy_registration_id',r.legacy_registration_id,'person_id',r.person_id,'revision',r.revision),
 'review',jsonb_build_object('campaign_id',ir.campaign_id,'source_id',ir.source_id,'outcome',ir.outcome,'revision',ir.revision,'registrant_revision',ir.registrant_revision,'source_hash',ir.source_hash),
 'identityRequest',jsonb_build_object('request_id',iq.request_id,'campaign_id',iq.campaign_id,'actor_id',iq.actor_id,'request_hash',iq.request_hash,'result',iq.result),
 'careRequest',jsonb_build_object('request_id',cq.request_id,'campaign_id',cq.campaign_id,'actor_id',cq.actor_id,'payload_hash',cq.payload_hash,'result',cq.result),
 'identityAudit',jsonb_build_object('id',ia.id,'campaign_id',ia.campaign_id,'organization_id',ia.organization_id,'actor_user_id',ia.actor_user_id,'kind',ia.kind,'subject_id',ia.subject_id,'metadata',jsonb_build_object('request_id',ia.metadata->'request_id','source_id',ia.metadata->'source_id','source_hash',ia.metadata->'source_hash','after_person',ia.metadata->'after_person','method',ia.metadata->'method')),
 'reviewAudit',jsonb_build_object('id',ra.id,'campaign_id',ra.campaign_id,'organization_id',ra.organization_id,'actor_user_id',ra.actor_user_id,'kind',ra.kind,'subject_id',ra.subject_id,'metadata',jsonb_build_object('request_id',ra.metadata->'request_id','outcome',ra.metadata->'outcome','source_hash',ra.metadata->'source_hash')),
 'person',jsonb_build_object('id',p.id,'organization_id',p.organization_id,'human_id',p.human_id,'user_id',p.user_id),
 'account',jsonb_build_object('active',l.active,'organization_id',l.organization_id,'person_id',l.person_id,'user_id',l.user_id),
 'subject',jsonb_build_object('id',su.id,'email_confirmed_at',su.email_confirmed_at,'is_anonymous',su.is_anonymous,'deleted_at',su.deleted_at,'banned_until',su.banned_until)
) snapshot
from public.outreach_partner_assignments a
join public.outreach_campaigns c on c.id=a.campaign_id and c.organization_id=$1
join public.outreach_partner_churches pc on pc.id=a.partner_church_id and pc.campaign_id=c.id
join public.outreach_campaign_assignments ca on ca.campaign_id=c.id and ca.user_id=$4
join public.outreach_partner_users pu on pu.campaign_id=c.id and pu.partner_church_id=pc.id and pu.user_id=$4
join auth.users u on u.id=$4
join auth.sessions s on s.user_id=u.id and s.id=$5
join public.outreach_registrations d on d.id=a.decision_registration_id
join public.outreach_campaign_sources sm on sm.source=d.source and sm.campaign_id=c.id
join public.outreach_campaign_registrants r on r.legacy_registration_id=d.id and r.campaign_id=c.id and r.organization_id=c.organization_id
join private.city_identity_reviews ir on ir.campaign_id=c.id and ir.source_id=d.id
join private.city_care_requests cq on cq.campaign_id=c.id and cq.result->>'source_id'=d.id::text and cq.result->>'review_revision'=ir.revision::text
join private.city_identity_requests iq on iq.request_id=cq.request_id and iq.campaign_id=c.id and iq.actor_id=cq.actor_id
join public.outreach_campaign_audit ia on ia.campaign_id=c.id and ia.kind='decision.identity_reviewed' and ia.subject_id=r.id and ia.metadata->>'request_id'=iq.request_id::text
join public.outreach_campaign_audit ra on ra.campaign_id=c.id and ra.kind='decision.review_completed' and ra.subject_id=d.id and ra.metadata->>'request_id'=iq.request_id::text
join public.organization_people p on p.id=r.person_id and p.organization_id=c.organization_id
join private.people h on h.id=p.human_id
join public.portal_account_links l on l.organization_id=c.organization_id and l.person_id=p.id and l.user_id=d.user_id
join auth.users su on su.id=d.user_id
where a.campaign_id=$2 and a.id=$3 and a.assigned_worker_user_id=$4
for share of a,c,pc,ca,pu,u,s,d,sm,r,ir,cq,iq,ia,ra,p,h,l,su;
end $envelope$;
revoke all on function partner_identity_host.current_snapshot(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function partner_identity_host.current_snapshot(uuid,uuid,uuid,uuid,uuid) to partner_canonical_reader;
commit;
