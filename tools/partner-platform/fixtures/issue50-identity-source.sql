-- DISPOSABLE TEST FIXTURE ONLY. Selected accepted Issue50 statements; not a migration.
create table public.outreach_campaign_sources (
 source text primary key, campaign_id uuid not null references public.outreach_campaigns(id)
);
create index outreach_campaign_source_campaign_idx on public.outreach_campaign_sources(campaign_id);
alter table public.outreach_campaign_sources enable row level security;
revoke all on public.outreach_campaign_sources from public,anon,authenticated;

alter table public.outreach_campaign_assignments drop constraint outreach_campaign_assignments_capabilities_check;
alter table public.outreach_campaign_assignments add constraint outreach_campaign_assignments_capabilities_check check(
 capabilities <@ array['decision.view','decision.manage','team.view','team.manage','travel.view','travel.manage','view','registration.view','registration.manage','registration.export','checkin.manage','decisions.read','discipleship.summary.read','followup.manage','contacts.export','communications.compose','communications.send','staff.manage']::text[]
 and cardinality(capabilities)>0 and array_position(capabilities,null) is null
 and (not(capabilities && array['registration.manage','registration.export','checkin.manage']) or 'registration.view'=any(capabilities))
 and (not(capabilities && array['discipleship.summary.read','followup.manage','contacts.export']) or 'decisions.read'=any(capabilities))
 and (not('decision.manage'=any(capabilities)) or 'decision.view'=any(capabilities))
 and (not('team.manage'=any(capabilities)) or 'team.view'=any(capabilities))
 and (not('travel.manage'=any(capabilities)) or 'travel.view'=any(capabilities))
);


create table private.city_identity_requests(
 request_id uuid primary key,actor_id uuid not null references auth.users(id),campaign_id uuid not null references public.outreach_campaigns(id),
 request_hash text not null,result jsonb not null,created_at timestamptz not null default now()
);
alter table private.city_identity_requests enable row level security;
revoke all on private.city_identity_requests from public,anon,authenticated;
create trigger city_identity_requests_immutable before update or delete on private.city_identity_requests for each row execute function private.outreach_immutable();



create table public.outreach_campaign_followups (
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null references public.outreach_campaigns(id),
 source_id uuid not null references public.outreach_registrations(id), assigned_user_id uuid references auth.users(id),
 status text not null default 'open' check(status in ('open','in_progress','waiting','replied','completed','do_not_contact')),
 due_on date, revision integer not null default 1, updated_at timestamptz not null default now(),
 unique(campaign_id,source_id),unique(campaign_id,id)
);
alter table public.outreach_campaign_followups enable row level security;
revoke all on public.outreach_campaign_followups from public,anon,authenticated;
create table private.city_followup_events (
 id bigint generated always as identity primary key,campaign_id uuid not null,followup_id uuid not null,
 actor_id uuid not null references auth.users(id),kind text not null check(kind in ('created','updated','phone_attempt','personal_contact','no_response','internal_note')),
 summary text not null check(length(summary)<=500),before_state jsonb,after_state jsonb not null,created_at timestamptz not null default now(),
 foreign key(campaign_id,followup_id) references public.outreach_campaign_followups(campaign_id,id)
);
create index city_followup_history_idx on private.city_followup_events(campaign_id,followup_id,id);
alter table private.city_followup_events enable row level security;
revoke all on private.city_followup_events from public,anon,authenticated;
create trigger city_followup_history_immutable before update or delete on private.city_followup_events for each row execute function private.outreach_immutable();
create table private.city_identity_reviews (
 campaign_id uuid not null references public.outreach_campaigns(id),source_id uuid not null references public.outreach_registrations(id),
 outcome text not null check(outcome in ('linked','unlinked','keep_separate','deferred')),revision integer not null,
 source_hash text not null,registrant_revision integer not null,updated_at timestamptz not null default now(),primary key(campaign_id,source_id)
);
alter table private.city_identity_reviews enable row level security;
revoke all on private.city_identity_reviews from public,anon,authenticated;
create table private.city_care_requests (
 request_id uuid primary key,campaign_id uuid not null references public.outreach_campaigns(id),actor_id uuid not null references auth.users(id),
 payload_hash text not null,result jsonb not null,created_at timestamptz not null default now()
);
alter table private.city_care_requests enable row level security;
revoke all on private.city_care_requests from public,anon,authenticated;
create trigger city_care_requests_immutable before update or delete on private.city_care_requests for each row execute function private.outreach_immutable();



 alter table public.outreach_campaign_assignments add column care_scope text not null default 'campaign' check(care_scope in ('campaign','assigned'));
 alter table public.outreach_campaign_assignments add constraint city_assigned_care_capabilities_check check(care_scope<>'assigned' or capabilities <@ array['view','registration.view','registration.manage','registration.export','checkin.manage','decisions.read','followup.manage']::text[]);
 comment on column public.outreach_campaign_assignments.care_scope is 'Explicit reviewed assignment restriction; not a new permission grant. Assigned users cannot enumerate unassigned decisions.';


create function private.city_decision_project(did uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.outreach_registrations; c public.outreach_campaigns; rid uuid;
begin
 select * into d from public.outreach_registrations where id=did for share;
 select x.* into c from public.outreach_campaigns x join public.outreach_campaign_sources s on s.campaign_id=x.id where s.source=d.source;
 if c.id is null then return null; end if;
 perform pg_advisory_xact_lock(hashtextextended(did::text,261027));
 select id into rid from public.outreach_campaign_registrants where legacy_registration_id=did;
 if rid is not null then
  if not exists(select 1 from public.outreach_campaign_registrants where id=rid and campaign_id=c.id and organization_id=c.organization_id) then raise exception 'Source mapping conflict'; end if;
  return rid;
 end if;
 insert into public.outreach_campaign_registrants(campaign_id,organization_id,legacy_registration_id,registered_at)values(c.id,c.organization_id,did,d.created_at)returning id into rid;
 perform private.outreach_audit(c.id,c.organization_id,'decision.source_linked',rid,jsonb_build_object('source_id',did,'identity','unreviewed'));
 return rid;
end $$;

create function private.city_decision_reconcile(c uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid; d public.outreach_registrations; r public.outreach_campaign_registrants; old private.city_identity_requests; target uuid; request uuid; hash text; result jsonb;
begin
 select organization_id into org from public.outreach_campaigns where id=c;
 if not private.city_roster_can(c,'decisions.read') or not private.outreach_admin(org,true) or not private.has_staff_permission(org,'staff.manage') or not private.has_staff_permission(org,'portal.manage') then raise exception 'Independent identity administrator required' using errcode='42501';end if;
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>3000 or exists(select 1 from jsonb_object_keys(p) k where k not in ('request_id','source_id','source_hash','revision','person_id','reason')) or length(btrim(coalesce(p->>'reason','')))not between 20 and 500 or not(coalesce(p->>'source_hash','')~'^[a-f0-9]{64}$') then raise exception 'Invalid reviewed identity request';end if;
 request:=(p->>'request_id')::uuid;target:=(p->>'person_id')::uuid;
 if request is null or p->>'revision' is null or not (p ? 'person_id') then raise exception 'Request identity and revision required';end if;
 hash:=encode(sha256(convert_to(jsonb_build_object('campaign',c,'payload',p)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(request::text,261028));
 select * into old from private.city_identity_requests where request_id=request;
 if found and (old.actor_id<>auth.uid() or old.campaign_id<>c or old.request_hash<>hash) then raise exception 'Request replay conflict';end if;
 select x.* into d from public.outreach_registrations x join public.outreach_campaign_sources s on s.source=x.source where x.id=(p->>'source_id')::uuid and s.campaign_id=c and x.consent for share of x;
 if d.id is null or encode(sha256(convert_to(to_jsonb(d)::text,'UTF8')),'hex')<>p->>'source_hash' then raise exception 'Source changed or unavailable';end if;
 if target is not null and (not private.person_permission(org,target,'people.update') or not exists(select 1 from public.organization_people where id=target and organization_id=org) or exists(select 1 from public.portal_account_links where organization_id=org and person_id=target and user_id=auth.uid() and active)) then raise exception 'Person scope or independent actor denied' using errcode='42501';end if;
 perform private.city_decision_project(d.id);
 select * into r from public.outreach_campaign_registrants where legacy_registration_id=d.id and campaign_id=c and organization_id=org for update;
 if r.person_id is not null and (not private.person_permission(org,r.person_id,'people.update') or exists(select 1 from public.portal_account_links where organization_id=org and person_id=r.person_id and user_id=auth.uid() and active)) then raise exception 'Existing Person or independent actor denied' using errcode='42501';end if;
 if old.request_id is not null then
  if r.revision<>(old.result->>'revision')::int or r.person_id is distinct from target then raise exception 'Replayed state is no longer current';end if;
  return old.result;
 end if;
 if r.revision<>(p->>'revision')::int then raise exception 'Identity revision changed';end if;
 -- Existing unique campaign-person index deliberately rejects ambiguous duplicate links.
 update public.outreach_campaign_registrants set person_id=target,revision=revision+1 where id=r.id returning jsonb_build_object('registrant_id',id,'person_id',person_id,'revision',revision)into result;
 perform private.outreach_audit(c,org,'decision.identity_reviewed',r.id,jsonb_build_object('request_id',request,'source_id',d.id,'source_hash',p->>'source_hash','before_person',r.person_id,'after_person',target,'reason',p->>'reason','method','authorized_reconciliation'));
 insert into private.city_identity_requests(request_id,actor_id,campaign_id,request_hash,result)values(request,auth.uid(),c,hash,result);
 return result;
end $$;

create or replace function private.city_roster_can(c uuid,k text) returns boolean language sql stable security definer set search_path='' as $$
 select k in ('decisions.read','discipleship.summary.read','contacts.export','followup.manage') and private.outreach_verified(auth.uid()) and exists(
 select 1 from public.outreach_campaign_assignments a where a.campaign_id=c and a.user_id=auth.uid() and a.active
 and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and 'view'=any(a.capabilities) and 'decisions.read'=any(a.capabilities) and k=any(a.capabilities));
$$;

create function private.city_followup_assignee(c uuid,u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.outreach_verified(u) and exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c and a.user_id=u and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and a.capabilities @> array['view','decisions.read','followup.manage']);
$$;

create function private.city_care_assigned(c uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.outreach_verified(auth.uid()) and exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c and a.user_id=auth.uid() and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and a.care_scope='assigned');
 $$;

create function private.city_source_visible(c uuid,s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not private.city_care_assigned(c) or exists(select 1 from public.outreach_campaign_followups f where f.campaign_id=c and f.source_id=s and f.assigned_user_id=auth.uid());
 $$;

create or replace function private.city_identity_admin(c uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not private.city_care_assigned(c) and private.city_roster_can(c,'decisions.read') and exists(select 1 from public.outreach_campaigns x where x.id=c
 and private.outreach_admin(x.organization_id,true) and private.has_staff_permission(x.organization_id,'staff.manage') and private.has_staff_permission(x.organization_id,'portal.manage'));
$$;

alter function private.city_decision_reconcile(uuid,jsonb) rename to city_decision_reconcile_a;

create or replace function private.city_decision_reconcile(c uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o uuid; target uuid;
begin
 select organization_id into o from public.outreach_campaigns where id=c;
 if not (not private.city_care_assigned(c) and private.city_roster_can(c,'decisions.read') and private.outreach_admin(o,true) and private.has_staff_permission(o,'staff.manage') and private.has_staff_permission(o,'portal.manage')) then raise exception 'Independent identity administrator required' using errcode='42501';end if;
 target:=(p->>'person_id')::uuid;
 if exists(select 1 from public.portal_account_links l where l.organization_id=o and l.person_id=target and l.active and not private.outreach_verified(l.user_id)) then raise exception 'Unverified linked account denied' using errcode='42501';end if;
 return private.city_decision_reconcile_a(c,p);
end $$;

create or replace function private.city_care_workspace(c uuid,action text,p jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid; d public.outreach_registrations; r public.outreach_campaign_registrants; f public.outreach_campaign_followups;
 old private.city_care_requests; review private.city_identity_reviews; h text; req uuid; target uuid; owner_id uuid; result jsonb; before_json jsonb; data jsonb; rev integer; outcome text; other_id uuid; affected_source uuid;
begin
 if not private.city_roster_can(c,'decisions.read') then raise exception 'Campaign access denied' using errcode='42501';end if;
 select organization_id into org from public.outreach_campaigns where id=c;
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>5000 then raise exception 'Invalid request';end if;
 if action='context' then return jsonb_build_object('assigned_only',private.city_care_assigned(c),'can_review',private.city_identity_admin(c),'can_followup',private.city_roster_can(c,'followup.manage'));end if;
 if action in ('queue','identity_detail','people','target','identity_save') then
  if not private.city_identity_admin(c) then raise exception 'Independent identity administrator required' using errcode='42501';end if;
 elsif action in ('followup_detail','followup_save','activity') then
  if not private.city_roster_can(c,'followup.manage') then raise exception 'Campaign follow-up permission required' using errcode='42501';end if;
 else raise exception 'Unsupported action';end if;
 if action='queue' then
  if exists(select 1 from jsonb_object_keys(p) k where k not in ('after','state')) or coalesce(p->>'state','pending') not in ('pending','all') then raise exception 'Invalid queue filter';end if;
  select coalesce(jsonb_agg(v order by source_id),'[]') into data from (
   select x.id source_id,jsonb_build_object('source_id',x.id,'name',x.first_name||' '||x.last_name,'source',x.source,'person_id',cr.person_id,
    'review',case when ir.registrant_revision is distinct from coalesce(cr.revision,1) or ir.source_hash is distinct from encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex') then 'pending' else ir.outcome end) v
   from public.outreach_registrations x join public.outreach_campaign_sources s on s.source=x.source
   left join public.outreach_campaign_registrants cr on cr.legacy_registration_id=x.id and cr.campaign_id=c and cr.organization_id=org
   left join private.city_identity_reviews ir on ir.campaign_id=c and ir.source_id=x.id
   where s.campaign_id=c and x.consent and (nullif(p->>'after','') is null or x.id>(p->>'after')::uuid)
    and (coalesce(p->>'state','pending')='all' or ir.outcome is null or ir.outcome='deferred' or ir.registrant_revision is distinct from coalesce(cr.revision,1) or ir.source_hash<>encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex'))
   order by x.id limit 51)q;
  return jsonb_build_object('rows',(select coalesce(jsonb_agg(v),'[]') from jsonb_array_elements(data)with ordinality q(v,n)where n<=50),'more',jsonb_array_length(data)>50);
 end if;
 -- Every action is anchored to the current consented decision source and explicit map.
 select x.* into d from public.outreach_registrations x join public.outreach_campaign_sources s on s.source=x.source where x.id=(p->>'source_id')::uuid and s.campaign_id=c and x.consent for share of x;
 if d.id is null or not private.city_source_visible(c,d.id) then raise exception 'Decision unavailable' using errcode='42501';end if;
 select * into r from public.outreach_campaign_registrants where legacy_registration_id=d.id and campaign_id=c and organization_id=org;
 select * into review from private.city_identity_reviews where campaign_id=c and source_id=d.id;
 if action='identity_detail' then
  if r.person_id is not null and not private.person_permission(org,r.person_id,'people.update') then raise exception 'Person scope denied' using errcode='42501';end if;
  return jsonb_build_object('source_id',d.id,'name',d.first_name||' '||d.last_name,'email',d.email,'source_hash',encode(sha256(convert_to(to_jsonb(d)::text,'UTF8')),'hex'),
   'person_id',r.person_id,'registrant_revision',coalesce(r.revision,1),'review_revision',coalesce(review.revision,0),'outcome',coalesce(review.outcome,'pending'),
   'history',(select coalesce(jsonb_agg(v order by at),'[]') from (select a.created_at at,jsonb_build_object('at',a.created_at,'actor_id',a.actor_user_id,'outcome',a.metadata->>'outcome','reason',a.metadata->>'reason')v from public.outreach_campaign_audit a where a.campaign_id=c and a.kind='decision.review_completed' and a.subject_id=d.id order by a.created_at desc limit 50)t));
 end if;
 if action='people' then
  if exists(select 1 from jsonb_object_keys(p)k where k not in ('source_id','search')) or length(coalesce(p->>'search',''))not between 2 and 100 then raise exception 'Enter an explicit canonical People search';end if;
  data:=private.people_workspace(org,'list',jsonb_build_object('search',p->>'search','page',0));
  return (select coalesce(jsonb_agg(jsonb_build_object('person_id',v->>'id','name',(v->>'first_name')||' '||(v->>'last_name'))),'[]') from jsonb_array_elements(data)v);
 end if;
 if action='target' then
  target:=(p->>'person_id')::uuid;
  if target is null or not private.person_permission(org,target,'people.read') or not private.person_permission(org,target,'people.update') or exists(select 1 from public.portal_account_links l where l.organization_id=org and l.person_id=target and l.active and (l.user_id=auth.uid() or not private.outreach_verified(l.user_id))) then raise exception 'Verified independent Person scope required' using errcode='42501';end if;
  select id into other_id from public.outreach_campaign_registrants where campaign_id=c and organization_id=org and person_id=target and legacy_registration_id is distinct from d.id;
  select jsonb_build_object('person_id',id,'name',first_name||' '||last_name,'conflict',other_id is not null,'account_verified',exists(select 1 from public.portal_account_links l where l.organization_id=org and l.person_id=target and l.active and private.outreach_verified(l.user_id))) into result from public.organization_people where organization_id=org and id=target;
  if result is null then raise exception 'Person unavailable' using errcode='42501';end if;
  return result;
 end if;
 if action='followup_detail' then select * into f from public.outreach_campaign_followups where campaign_id=c and source_id=d.id for share;else select * into f from public.outreach_campaign_followups where campaign_id=c and source_id=d.id;end if;
 if action='followup_detail' and private.city_care_assigned(c) and f.assigned_user_id is distinct from auth.uid() then raise exception 'Assigned care only' using errcode='42501';end if;
 if action='followup_detail' then
  return jsonb_build_object('assigned_only',private.city_care_assigned(c),'source_id',d.id,'name',d.first_name||' '||d.last_name,'followup',case when f.id is null then jsonb_build_object('revision',0,'status','open','assigned_user_id',null,'due_on',null) else to_jsonb(f)end,
   'staff',(select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'name',coalesce(sd.display_name,a.role_key||' · '||right(a.user_id::text,8)))),'[]') from public.outreach_campaign_assignments a left join public.organization_staff_directory sd on sd.organization_id=org and sd.user_id=a.user_id where a.campaign_id=c and private.city_followup_assignee(c,a.user_id) and (not private.city_care_assigned(c) or a.user_id=auth.uid())),
   'history',(select coalesce(jsonb_agg(v order by id),'[]') from (select e.id,jsonb_build_object('id',e.id,'at',e.created_at,'actor_id',e.actor_id,'kind',e.kind,'summary',e.summary,'before',e.before_state,'after',e.after_state)v from private.city_followup_events e where e.campaign_id=c and e.followup_id=f.id order by e.id desc limit 100)t));
 end if;
 -- Mutations are explicit, bounded, optimistic and idempotent. Unknown keys rejected.
 if exists(select 1 from jsonb_object_keys(p) k where k not in ('request_id','source_id','source_hash','registrant_revision','review_revision','person_id','outcome','reason','revision','status','assigned_user_id','due_on','kind','summary')) then raise exception 'Unexpected field';end if;
 req:=(p->>'request_id')::uuid;if req is null then raise exception 'Request ID required';end if;
 h:=encode(sha256(convert_to(jsonb_build_object('c',c,'action',action,'p',p)::text,'UTF8')),'hex');
 -- Same request, then source: shared order for all writers; journal survives retries.
 perform pg_advisory_xact_lock(hashtextextended(req::text,261029));
 perform pg_advisory_xact_lock(hashtextextended(c::text||d.id::text,261030));
 select * into old from private.city_care_requests where request_id=req;
 if old.request_id is not null and (old.actor_id<>auth.uid() or old.campaign_id<>c or old.payload_hash<>h) then raise exception 'Conflicting request replay';end if;
 if action='identity_save' then
  if exists(select 1 from jsonb_object_keys(p)k where k not in ('request_id','source_id','source_hash','registrant_revision','review_revision','person_id','outcome','reason')) or length(btrim(coalesce(p->>'reason','')))not between 20 and 500 or not(p ? 'person_id') or p->>'review_revision' is null or p->>'registrant_revision' is null or coalesce(p->>'outcome','')not in ('linked','unlinked','keep_separate','deferred') then raise exception 'Reviewed identity evidence required';end if;
  if encode(sha256(convert_to(to_jsonb(d)::text,'UTF8')),'hex') is distinct from p->>'source_hash' then raise exception 'Source fingerprint changed';end if;
  -- Match Package A lock order before locking its registrant row.
  perform pg_advisory_xact_lock(hashtextextended(req::text,261028));
  perform pg_advisory_xact_lock(hashtextextended(d.id::text,261027));
  select * into review from private.city_identity_reviews where campaign_id=c and source_id=d.id for update;
  select * into r from public.outreach_campaign_registrants where legacy_registration_id=d.id and campaign_id=c and organization_id=org for update;
  if r.person_id is not null and (not private.person_permission(org,r.person_id,'people.update') or exists(select 1 from public.portal_account_links where organization_id=org and person_id=r.person_id and user_id=auth.uid() and active)) then raise exception 'Existing Person scope denied' using errcode='42501';end if;
  target:=(p->>'person_id')::uuid;outcome:=p->>'outcome';
  if outcome='linked' then
   perform private.city_care_workspace(c,'target',jsonb_build_object('source_id',d.id,'person_id',target));
  elsif target is not null then raise exception 'Only linked outcome may supply a Person';end if;
  if old.request_id is not null then
   if coalesce(review.revision,0)<>(old.result->>'review_revision')::int or coalesce(r.revision,1)<>(old.result->>'registrant_revision')::int then raise exception 'Replayed identity state is no longer current';end if;
   return old.result;
  end if;
  if coalesce(review.revision,0)<>(p->>'review_revision')::int or coalesce(r.revision,1)<>(p->>'registrant_revision')::int then raise exception 'Review changed; reload before saving';end if;
  rev:=coalesce(r.revision,1);
  if outcome in ('linked','unlinked') then
   result:=private.city_decision_reconcile(c,jsonb_build_object('request_id',req,'source_id',d.id,'source_hash',p->>'source_hash','revision',rev,'person_id',target,'reason',p->>'reason'));
   rev:=(result->>'revision')::int;
  elsif outcome='keep_separate' and r.person_id is not null then raise exception 'Unlink explicitly before keeping this source separate';end if;
  insert into private.city_identity_reviews(campaign_id,source_id,outcome,revision,source_hash,registrant_revision)values(c,d.id,outcome,coalesce(review.revision,0)+1,p->>'source_hash',rev)
   on conflict(campaign_id,source_id)do update set outcome=excluded.outcome,revision=excluded.revision,source_hash=excluded.source_hash,registrant_revision=excluded.registrant_revision,updated_at=now();
  result:=jsonb_build_object('source_id',d.id,'outcome',outcome,'review_revision',coalesce(review.revision,0)+1,'registrant_revision',rev);
  perform private.outreach_audit(c,org,'decision.review_completed',d.id,jsonb_build_object('request_id',req,'outcome',outcome,'reason',p->>'reason','source_hash',p->>'source_hash'));
 else
  if exists(select 1 from jsonb_object_keys(p)k where k not in ('request_id','source_id','revision','status','assigned_user_id','due_on','kind','summary')) or p->>'revision' is null or length(btrim(coalesce(p->>'summary','')))not between 3 and 500 then raise exception 'Revision and operational summary required';end if;
  select * into f from public.outreach_campaign_followups where campaign_id=c and source_id=d.id for update;
  if not private.city_roster_can(c,'followup.manage') or (private.city_care_assigned(c) and (f.id is null or f.assigned_user_id is distinct from auth.uid())) then raise exception 'Assigned care unavailable' using errcode='42501';end if;
  if old.request_id is not null then
   if coalesce(f.revision,0)<>(old.result->>'revision')::int then raise exception 'Replayed care state is no longer current';end if;
   return old.result;
  end if;
  if coalesce(f.revision,0)<>(p->>'revision')::int then raise exception 'Follow-up changed; reload before saving';end if;
  before_json:=case when f.id is null then null else to_jsonb(f)end;
  if action='followup_save' then
   if coalesce(p->>'status','')not in ('open','in_progress','waiting','replied','completed','do_not_contact') or not(p ? 'assigned_user_id') or not(p ? 'due_on') then raise exception 'Explicit status, owner and due date required';end if;
   owner_id:=(p->>'assigned_user_id')::uuid;
   if private.city_care_assigned(c) and owner_id is distinct from auth.uid() then raise exception 'Reassignment requires campaign coordinator' using errcode='42501';end if;
   if owner_id is not null and not private.city_followup_assignee(c,owner_id) then raise exception 'Assignee lacks current campaign follow-up authority' using errcode='42501';end if;
   if f.status='do_not_contact' and p->>'status'<>'do_not_contact' then raise exception 'Contact suppression cannot be cleared in this workflow';end if;
   if nullif(p->>'due_on','')::date not between date '2000-01-01' and date '2100-12-31' then raise exception 'Due date outside supported range';end if;
   insert into public.outreach_campaign_followups(campaign_id,source_id,assigned_user_id,status,due_on)values(c,d.id,owner_id,p->>'status',nullif(p->>'due_on','')::date)
   on conflict(campaign_id,source_id)do update set assigned_user_id=excluded.assigned_user_id,status=excluded.status,due_on=excluded.due_on,revision=outreach_campaign_followups.revision+1,updated_at=now() returning * into f;
   outcome:=case when before_json is null then 'created' else 'updated'end;
  else
   if f.id is null or coalesce(p->>'kind','')not in ('phone_attempt','personal_contact','no_response','internal_note') or exists(select 1 from jsonb_object_keys(p)k where k not in ('request_id','source_id','revision','kind','summary')) then raise exception 'Invalid existing follow-up activity';end if;
   if f.status='do_not_contact' and p->>'kind'<>'internal_note' then raise exception 'Contact suppressed; no contact activity permitted';end if;
   update public.outreach_campaign_followups set revision=revision+1,updated_at=now()where id=f.id returning * into f;outcome:=p->>'kind';
  end if;
  insert into private.city_followup_events(campaign_id,followup_id,actor_id,kind,summary,before_state,after_state)values(c,f.id,auth.uid(),outcome,p->>'summary',before_json,to_jsonb(f));
  perform private.outreach_audit(c,org,'decision.followup_changed',f.id,jsonb_build_object('request_id',req,'source_id',d.id,'kind',outcome,'revision',f.revision));
  result:=jsonb_build_object('id',f.id,'revision',f.revision,'status',f.status);
 end if;
 insert into private.city_care_requests(request_id,campaign_id,actor_id,payload_hash,result)values(req,c,auth.uid(),h,result);
 return result;
end $$;

create function private.city_decision_ingress() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.city_decision_project(new.id);return new;end $$;

revoke all on function private.city_decision_project(uuid),private.city_decision_ingress() from public,anon,authenticated,service_role;

revoke all on function private.city_roster_can(uuid,text) from public,anon,authenticated;

revoke all on function private.city_decision_reconcile_a(uuid,jsonb) from public,anon,authenticated;

revoke all on function private.city_decision_reconcile(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.city_decision_reconcile(uuid,jsonb) to authenticated;

revoke all on function private.city_identity_admin(uuid),private.city_followup_assignee(uuid,uuid) from public,anon,authenticated;

revoke all on function private.city_care_assigned(uuid),private.city_source_visible(uuid,uuid) from public,anon,authenticated;

revoke all on function private.city_care_workspace(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.city_care_workspace(uuid,text,jsonb) to authenticated;
