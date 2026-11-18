-- SOURCE-ONLY Minden decision foundation. No hosted execution or activation.
-- Existing canonical event only. No source map, staff grant or assignment seed.
begin;
do $$declare r record;begin
 if to_regprocedure('public.campaign_decision_foundation(text,uuid,uuid,jsonb)') is not null
 or to_regprocedure('public.outreach_minden_decisions(uuid)') is not null
 or to_regclass('public.outreach_decision_campaign_sources') is not null
 or to_regclass('public.outreach_decision_followup') is not null
 or to_regclass('public.outreach_decision_audit') is not null then
  raise exception 'Decision foundation already exists or unsafe/partial contract present';end if;
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.outreach_campaign_assignments'::regclass
  and conname='outreach_campaign_assignments_capabilities_check') is distinct from 'ce4344b2acc39ee5c94f3e9b5acd27f9' then
  raise exception 'Current registration/Team/travel capability contract required';end if;
 for r in select * from(values
  ('private.staff_assignment_active(uuid,uuid)','05149569926640f4d39bca2eda70169d'),
  ('private.outreach_immutable()','824478818ca3407517607bb0ccc04752'))v(signature,fingerprint) loop
  if to_regprocedure(r.signature) is null or md5(pg_get_functiondef(to_regprocedure(r.signature))) is distinct from r.fingerprint then
   raise exception 'Decision security helper drift: %',r.signature;end if;
 end loop;
 if not exists(select 1 from public.outreach_campaigns c join public.organizations o on o.id=c.organization_id
  where c.id='d26b8337-d215-42d3-ac3b-c771f7f07db7' and c.code='minden_la_2026' and c.public_slug='minden-2026' and o.slug='sowgo') then
  raise exception 'Existing approved Minden event required';end if;
 if to_regclass('auth.sessions') is null or to_regprocedure('auth.jwt()') is null then raise exception 'Current Auth session primitives required';end if;
end $$;
alter table public.outreach_campaign_assignments
 add column care_scope text not null default 'campaign' check(care_scope in('campaign','assigned')),
 add column decision_effective_at timestamptz,
 add column decision_expires_at timestamptz;
alter table public.outreach_campaign_assignments drop constraint outreach_campaign_assignments_capabilities_check;
alter table public.outreach_campaign_assignments add constraint outreach_campaign_assignments_capabilities_check check(
 capabilities <@ array['view','registration.view','registration.manage','registration.export','checkin.manage','team.view','team.manage','team.export','travel.view','travel.manage','travel.export','decisions.read','followup.manage','decisions.assign']::text[]
 and cardinality(capabilities)>0 and array_position(capabilities,null) is null
 and (not(capabilities && array['registration.manage','registration.export','checkin.manage']) or 'registration.view'=any(capabilities))
 and (not(capabilities && array['team.manage','team.export']) or 'team.view'=any(capabilities))
 and (not(capabilities && array['travel.manage','travel.export']) or 'travel.view'=any(capabilities))
 and (not('followup.manage'=any(capabilities)) or 'decisions.read'=any(capabilities))
 and (not(capabilities && array['decisions.read','followup.manage','decisions.assign']) or
  ('view'=any(capabilities) and care_scope='assigned' and decision_effective_at is not null and decision_expires_at is not null
   and expires_at is not null and isfinite(expires_at) and isfinite(decision_effective_at) and isfinite(decision_expires_at)
   and decision_effective_at>=effective_at and decision_expires_at>decision_effective_at and decision_expires_at<=expires_at))
);
create table public.outreach_decision_campaign_sources(
 campaign_id uuid primary key references public.outreach_campaigns(id),
 source text not null unique check(source ~ '^[a-z0-9_]{3,80}$'),active boolean not null default false,
 revision integer not null default 1 check(revision>0)
);
create table public.outreach_decision_followup(
 registration_id uuid primary key references public.outreach_registrations(id),campaign_id uuid not null references public.outreach_campaigns(id),
 status text not null default 'new' check(status in('new','needs_contact','attempted','connected','in_progress','completed','declined')),
 assigned_user_id uuid references auth.users(id),assignment_expires_at timestamptz,
 next_contact_on date,updated_by uuid references auth.users(id),updated_at timestamptz not null default clock_timestamp(),
 revision integer not null default 1 check(revision>0),unique(campaign_id,registration_id),
 check((assigned_user_id is null and assignment_expires_at is null) or
  (assigned_user_id is not null and assignment_expires_at is not null and isfinite(assignment_expires_at)))
);
create index outreach_decision_followup_assigned_idx on public.outreach_decision_followup(campaign_id,assigned_user_id,registration_id);
create table public.outreach_decision_audit(
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null,registration_id uuid not null,
 actor_kind text not null check(actor_kind in('service_intake','verified_staff')),actor_user_id uuid references auth.users(id),
 action text not null check(action in('service_intake','assignment_save','followup_save')),request_id uuid not null,
 request_payload jsonb not null,before_state jsonb,after_state jsonb not null,recorded_at timestamptz not null default clock_timestamp(),
 unique(campaign_id,request_id),foreign key(campaign_id,registration_id) references public.outreach_decision_followup(campaign_id,registration_id),
 check((actor_kind='service_intake' and actor_user_id is null and action='service_intake') or
  (actor_kind='verified_staff' and actor_user_id is not null and action in('assignment_save','followup_save')))
);
create trigger outreach_decision_audit_immutable before update or delete on public.outreach_decision_audit for each row execute function private.outreach_immutable();
alter table public.outreach_decision_campaign_sources enable row level security;
alter table public.outreach_decision_followup enable row level security;
alter table public.outreach_decision_audit enable row level security;
revoke all on public.outreach_decision_campaign_sources,public.outreach_decision_followup,public.outreach_decision_audit from public,anon,authenticated,service_role;

-- Current server-verified session, reusable by the separately reviewed reader.
-- Held SHARE locks serialize account/session revocation; time is rechecked after waits.
create function private.minden_decision_session() returns uuid language plpgsql volatile security definer set search_path='' as $$
declare actor uuid;sid uuid;expiry timestamptz;u auth.users;s auth.sessions;claims jsonb;
begin
 begin
  actor:=auth.uid();claims:=auth.jwt();sid:=(claims->>'session_id')::uuid;
  if coalesce(claims->>'exp','') !~ '^[0-9]{1,12}$' then raise invalid_text_representation;end if;
  expiry:=to_timestamp((claims->>'exp')::bigint);
 exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'Decision access unavailable' using errcode='42501';end;
 if actor is null or sid is null or expiry<=clock_timestamp() then raise exception 'Decision access unavailable' using errcode='42501';end if;
 select * into u from auth.users where id=actor for share;
 select * into s from auth.sessions where id=sid and user_id=actor for share;
 if u.id is null or u.email_confirmed_at is null or coalesce(u.is_anonymous,false) or u.deleted_at is not null
 or (u.banned_until is not null and u.banned_until>clock_timestamp()) or s.id is null
 or (s.not_after is not null and s.not_after<=clock_timestamp()) or expiry<=clock_timestamp() then
  raise exception 'Decision access unavailable' using errcode='42501';end if;
 return actor;
end $$;

-- No owner, registration, People or other module authority substitutes for this
-- exact finite campaign capability. Preserve canonical staff person-link checks.
create function private.minden_decision_authority(c uuid,u uuid,cap text) returns timestamptz language plpgsql volatile security definer set search_path='' as $$
declare campaign public.outreach_campaigns;d public.organization_staff_directory;a public.outreach_campaign_assignments;account auth.users;deadline timestamptz;
begin
 if c is distinct from 'd26b8337-d215-42d3-ac3b-c771f7f07db7'::uuid or cap is null or cap not in('decisions.read','followup.manage','decisions.assign') then return null;end if;
 select x.* into campaign from public.outreach_campaigns x join public.organizations o on o.id=x.organization_id
  where x.id=c and x.code='minden_la_2026' and x.public_slug='minden-2026' and o.slug='sowgo' for share of x;
 if campaign.id is null then return null;end if;
 select * into d from public.organization_staff_directory where organization_id=campaign.organization_id and user_id=u for share;
 select * into a from public.outreach_campaign_assignments where campaign_id=c and user_id=u for share;
 select * into account from auth.users where id=u for share;
 if d.user_id is null or not d.active or d.effective_at>clock_timestamp() or (d.expires_at is not null and d.expires_at<=clock_timestamp())
 or account.id is null or account.email_confirmed_at is null or coalesce(account.is_anonymous,false) or account.deleted_at is not null
 or (account.banned_until is not null and account.banned_until>clock_timestamp())
 or not private.staff_assignment_active(campaign.organization_id,u) or a.user_id is null or not a.active
 or a.effective_at>clock_timestamp() or a.expires_at is null or not isfinite(a.expires_at) or a.expires_at<=clock_timestamp()
 or a.care_scope<>'assigned' or not('view'=any(a.capabilities)) or not(cap=any(a.capabilities))
 or (cap='followup.manage' and not('decisions.read'=any(a.capabilities)))
 or a.decision_effective_at is null or a.decision_expires_at is null or not isfinite(a.decision_effective_at) or not isfinite(a.decision_expires_at)
 or a.decision_effective_at>clock_timestamp() or a.decision_expires_at<=clock_timestamp() then return null;end if;
 if d.person_id is not null then
  perform 1 from public.portal_account_links l where l.organization_id=campaign.organization_id and l.user_id=u and l.person_id=d.person_id and l.active for share;
  if not found then return null;end if;
 end if;
 deadline:=least(a.expires_at,a.decision_expires_at,coalesce(d.expires_at,'infinity'::timestamptz));
 if deadline<=clock_timestamp() then return null;end if;return deadline;
end $$;
create function private.minden_decision_consent(r uuid) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare allowed boolean;
begin
 if to_regprocedure('private.minden_decision_followup_consent(uuid)') is null then return false;end if;
 execute 'select private.minden_decision_followup_consent($1)' into allowed using r;
 return allowed is true;
end $$;

-- Root's service intake must call this in the same transaction AFTER its legacy
-- registration + UNASSIGNED followup insert. No staff attribution is fabricated.
create function private.minden_decision_record_intake(c uuid,r uuid,request uuid) returns void language plpgsql volatile security definer set search_path='' as $$
declare f public.outreach_decision_followup;receipt public.outreach_decision_audit;payload jsonb:=jsonb_build_object('registration_id',r);
begin
 if c is distinct from 'd26b8337-d215-42d3-ac3b-c771f7f07db7'::uuid or r is null or request is null then raise exception 'Invalid service intake';end if;
 if not exists(select 1 from public.outreach_campaigns x join public.organizations o on o.id=x.organization_id where x.id=c and x.code='minden_la_2026' and x.public_slug='minden-2026' and o.slug='sowgo')
 or not exists(select 1 from public.outreach_decision_campaign_sources where campaign_id=c and source='minden_la_outreach' and active) then raise exception 'Reviewed Minden source required';end if;
 select * into f from public.outreach_decision_followup where campaign_id=c and registration_id=r;
 if not found or not exists(select 1 from public.outreach_registrations where id=r and source='minden_la_outreach') then raise exception 'Exact service intake required';end if;
 select * into receipt from public.outreach_decision_audit where campaign_id=c and request_id=request;
 if found then
  if receipt.actor_kind<>'service_intake' or receipt.registration_id<>r or receipt.request_payload<>payload then raise exception 'Conflicting intake receipt' using errcode='23505';end if;return;
 end if;
 if f.assigned_user_id is not null or f.assignment_expires_at is not null or f.updated_by is not null or f.revision<>1 or f.status<>'new' or f.next_contact_on is not null then raise exception 'Unassigned initial intake required';end if;
 insert into public.outreach_decision_audit(campaign_id,registration_id,actor_kind,action,request_id,request_payload,before_state,after_state)
 values(c,r,'service_intake','service_intake',request,payload,null,to_jsonb(f));
end $$;

create function private.campaign_decision_foundation(p_action text,p_org uuid,p_campaign uuid,p_payload jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor uuid;org uuid;cap text;deadline timestamptz;target_deadline timestamptz;f public.outreach_decision_followup;r public.outreach_registrations;
 item record;rows jsonb:='[]';result jsonb;rid uuid;target uuid;expires timestamptz;request uuid;expected integer;why text;receipt public.outreach_decision_audit;before_row jsonb;after_row jsonb;page_number integer:=0;allowed boolean;
begin
 actor:=private.minden_decision_session();
 if p_action is null or p_action not in('context','list','detail','followup_save','queue','assignees','assignment_get','assignment_save')
 or p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>3000 then raise exception 'Invalid decision request' using errcode='22023';end if;
 if p_campaign is distinct from 'd26b8337-d215-42d3-ac3b-c771f7f07db7'::uuid then raise exception 'Decision access unavailable' using errcode='42501';end if;
 select c.organization_id into org from public.outreach_campaigns c join public.organizations o on o.id=c.organization_id
 where c.id=p_campaign and c.code='minden_la_2026' and c.public_slug='minden-2026' and o.slug='sowgo' for share of c;
 if org is null or (p_org is distinct from org and not(p_action='context' and p_org is null)) then raise exception 'Decision access unavailable' using errcode='42501';end if;
 cap:=case when p_action in('queue','assignees','assignment_get','assignment_save') then 'decisions.assign' when p_action='followup_save' then 'followup.manage' else 'decisions.read' end;
 deadline:=private.minden_decision_authority(p_campaign,actor,cap);
 if p_action='context' and deadline is null then deadline:=private.minden_decision_authority(p_campaign,actor,'decisions.assign');end if;
 if deadline is null then raise exception 'Decision access unavailable' using errcode='42501';end if;
 perform 1 from public.outreach_decision_campaign_sources where campaign_id=p_campaign and source='minden_la_outreach' and active for share;
 if not found then raise exception 'Reviewed Minden source required' using errcode='42501';end if;
 if p_action in('context','queue','assignees') and p_payload<>'{}'::jsonb then raise exception 'Unexpected request fields' using errcode='22023';end if;
 if p_action='context' then
  result:=jsonb_build_object('organization_id',org,'campaign_id',p_campaign,'scope','assigned','expires_at',least(deadline,to_timestamp((auth.jwt()->>'exp')::bigint),(select coalesce(not_after,'infinity'::timestamptz) from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=actor)),'server_time',clock_timestamp(),
   'capabilities',to_jsonb(array(select k from unnest(array['decisions.read','followup.manage','decisions.assign']) k where private.minden_decision_authority(p_campaign,actor,k) is not null)));
 elsif p_action='queue' then
  select coalesce(jsonb_agg(jsonb_build_object('registration_id',x.registration_id,'registered_at',x.created_at) order by x.created_at,x.registration_id),'[]') into rows
  from(select fu.registration_id,reg.created_at from public.outreach_decision_followup fu join public.outreach_registrations reg on reg.id=fu.registration_id and reg.source='minden_la_outreach'
   where fu.campaign_id=p_campaign and (fu.assigned_user_id is null or fu.assignment_expires_at<=clock_timestamp() or private.minden_decision_authority(p_campaign,fu.assigned_user_id,'decisions.read') is null) order by reg.created_at,reg.id limit 50)x;
  result:=jsonb_build_object('organization_id',org,'campaign_id',p_campaign,'queue',rows);
 elsif p_action='assignees' then
  for item in select a.user_id from public.outreach_campaign_assignments a where a.campaign_id=p_campaign order by a.user_id loop
   target_deadline:=private.minden_decision_authority(p_campaign,item.user_id,'decisions.read');
   if target_deadline is not null then rows:=rows||jsonb_build_array(jsonb_build_object('user_id',item.user_id,'expires_at',target_deadline));end if;
  end loop;
  result:=jsonb_build_object('organization_id',org,'campaign_id',p_campaign,'assignees',rows);
 elsif p_action='list' then
  if exists(select 1 from jsonb_object_keys(p_payload) k where k<>'page') or (p_payload?'page' and coalesce(p_payload->>'page','') !~ '^[0-9]{1,4}$') then raise exception 'Invalid page' using errcode='22023';end if;
  page_number:=coalesce((p_payload->>'page')::integer,0);
  for item in select fu.*,reg.first_name,reg.last_name,reg.decision,reg.created_at from public.outreach_decision_followup fu join public.outreach_registrations reg on reg.id=fu.registration_id and reg.source='minden_la_outreach'
   where fu.campaign_id=p_campaign and fu.assigned_user_id=actor and fu.assignment_expires_at>clock_timestamp()
   order by reg.created_at,reg.id limit 50 offset page_number*50 for share of fu,reg loop
   deadline:=least(deadline,item.assignment_expires_at);
   allowed:=private.minden_decision_authority(p_campaign,actor,'followup.manage') is not null and private.minden_decision_consent(item.registration_id);
   rows:=rows||jsonb_build_array(jsonb_build_object('registration_id',item.registration_id,'name',concat_ws(' ',item.first_name,item.last_name),'decision',item.decision,
    'registered_at',item.created_at,'status',item.status,'revision',item.revision,'next_contact_on',item.next_contact_on,'followup_allowed',allowed,'contact_allowed',false));
  end loop;
  result:=jsonb_build_object('organization_id',org,'campaign_id',p_campaign,'page',page_number,'registrations',rows);
 else
  if coalesce(p_payload->>'registration_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Registration required' using errcode='22023';end if;
  rid:=(p_payload->>'registration_id')::uuid;
  select * into f from public.outreach_decision_followup where registration_id=rid for update;
  select * into r from public.outreach_registrations where id=rid for share;
  if f.registration_id is null or f.campaign_id<>p_campaign or r.source is distinct from 'minden_la_outreach' then raise exception 'Decision access unavailable' using errcode='42501';end if;
  if p_action in('detail','followup_save') and (f.assigned_user_id is distinct from actor or f.assignment_expires_at<=clock_timestamp()) then raise exception 'Decision access unavailable' using errcode='42501';end if;
  if p_action in('detail','followup_save') then deadline:=least(deadline,f.assignment_expires_at);end if;
  if p_action='detail' then
   if exists(select 1 from jsonb_object_keys(p_payload) k where k<>'registration_id') then raise exception 'Unexpected request fields' using errcode='22023';end if;
   allowed:=private.minden_decision_authority(p_campaign,actor,'followup.manage') is not null and private.minden_decision_consent(rid);
   result:=jsonb_build_object('organization_id',org,'campaign_id',p_campaign,'registration_id',rid,'name',concat_ws(' ',r.first_name,r.last_name),'decision',r.decision,
    'registered_at',r.created_at,'status',f.status,'revision',f.revision,'next_contact_on',f.next_contact_on,'followup_allowed',allowed,'contact_allowed',false);
  elsif p_action='assignment_get' then
   if exists(select 1 from jsonb_object_keys(p_payload) k where k<>'registration_id') then raise exception 'Unexpected request fields' using errcode='22023';end if;
   result:=jsonb_build_object('organization_id',org,'campaign_id',p_campaign,'registration_id',rid,'assigned_user_id',f.assigned_user_id,'expires_at',f.assignment_expires_at,'revision',f.revision,'updated_at',f.updated_at);
  else
   if coalesce(p_payload->>'revision','') !~ '^[1-9][0-9]{0,7}$' or coalesce(p_payload->>'request_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Revision and request key required' using errcode='22023';end if;
   expected:=(p_payload->>'revision')::integer;request:=(p_payload->>'request_id')::uuid;
   before_row:=to_jsonb(f);
   select * into receipt from public.outreach_decision_audit where campaign_id=p_campaign and request_id=request;
   if found then
    if receipt.actor_kind<>'verified_staff' or receipt.actor_user_id<>actor or receipt.action<>p_action or receipt.registration_id<>rid or receipt.request_payload<>p_payload then raise exception 'Conflicting decision retry' using errcode='23505';end if;
    if receipt.after_state is distinct from before_row then raise exception 'Decision changed; reload' using errcode='40001';end if;
    if p_action='assignment_save' then target:=f.assigned_user_id;expires:=f.assignment_expires_at;end if;
    result:=jsonb_build_object('saved',true,'revision',f.revision,'replayed',true);
   else
    if f.revision<>expected then raise exception 'Decision changed; reload' using errcode='40001';end if;
    if p_action='assignment_save' then
     if exists(select 1 from jsonb_object_keys(p_payload) k where k not in('registration_id','revision','request_id','assigned_user_id','expires_at','reason'))
      or not(p_payload?'assigned_user_id') or not(p_payload?'expires_at') or jsonb_typeof(p_payload->'reason') is distinct from 'string'
      or length(btrim(p_payload->>'reason')) not between 10 and 500 then raise exception 'Explicit assignment review required' using errcode='22023';end if;
     why:=btrim(p_payload->>'reason');
     if p_payload->'assigned_user_id'='null'::jsonb then
      if p_payload->'expires_at' is distinct from 'null'::jsonb then raise exception 'Revoke requires null expiry' using errcode='22023';end if;target:=null;expires:=null;
     else
      if coalesce(p_payload->>'assigned_user_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(p_payload->'expires_at') is distinct from 'string' then raise exception 'Finite reviewed assignee required' using errcode='22023';end if;
      target:=(p_payload->>'assigned_user_id')::uuid;
      begin expires:=(p_payload->>'expires_at')::timestamptz;exception when invalid_datetime_format or datetime_field_overflow then raise exception 'Finite assignment expiry required' using errcode='22023';end;
      target_deadline:=private.minden_decision_authority(p_campaign,target,'decisions.read');
      if target_deadline is null or not isfinite(expires) or expires<=clock_timestamp() or expires>least(deadline,target_deadline) then raise exception 'Assignee authority or expiry unavailable' using errcode='42501';end if;
     end if;
     update public.outreach_decision_followup set assigned_user_id=target,assignment_expires_at=expires,updated_by=actor,updated_at=clock_timestamp(),revision=revision+1 where registration_id=rid returning * into f;
    else
     if exists(select 1 from jsonb_object_keys(p_payload) k where k not in('registration_id','revision','request_id','status','next_contact_on'))
      or coalesce(p_payload->>'status','') not in('new','needs_contact','attempted','connected','in_progress','completed','declined')
      or not(p_payload?'next_contact_on') or (p_payload->>'next_contact_on' is not null and (p_payload->>'next_contact_on') !~ '^\d{4}-\d{2}-\d{2}$') then raise exception 'Invalid follow-up update' using errcode='22023';end if;
     if r.consent is distinct from true or not private.minden_decision_consent(rid) then raise exception 'Current follow-up consent required' using errcode='42501';end if;
     update public.outreach_decision_followup set status=p_payload->>'status',next_contact_on=(p_payload->>'next_contact_on')::date,updated_by=actor,updated_at=clock_timestamp(),revision=revision+1 where registration_id=rid returning * into f;
    end if;
    after_row:=to_jsonb(f);
    insert into public.outreach_decision_audit(campaign_id,registration_id,actor_kind,actor_user_id,action,request_id,request_payload,before_state,after_state)
     values(p_campaign,rid,'verified_staff',actor,p_action,request,p_payload,before_row,after_row);
    result:=jsonb_build_object('saved',true,'revision',f.revision,'replayed',false);
   end if;
  end if;
 end if;
 -- Any expiry/session change crossed during row, receipt or audit waits rolls
 -- back both mutation and audit. Repeat all relevant current authority/consent.
 perform private.minden_decision_session();
 if private.minden_decision_authority(p_campaign,actor,cap) is null and not(p_action='context' and private.minden_decision_authority(p_campaign,actor,'decisions.assign') is not null)
 or deadline<=clock_timestamp() then raise exception 'Decision access unavailable' using errcode='42501';end if;
 if p_action in('detail','followup_save') and f.assignment_expires_at<=clock_timestamp() then raise exception 'Decision assignment expired' using errcode='42501';end if;
 if p_action='assignment_save' and target is not null and (expires<=clock_timestamp() or expires>private.minden_decision_authority(p_campaign,target,'decisions.read') or private.minden_decision_authority(p_campaign,target,'decisions.read') is null) then raise exception 'Assignee authority expired' using errcode='42501';end if;
 if p_action='followup_save' and (r.consent is distinct from true or not private.minden_decision_consent(rid)) then raise exception 'Current follow-up consent required' using errcode='42501';end if;
 perform private.minden_decision_session();
 if deadline<=clock_timestamp() or (p_action='assignment_save' and target is not null and expires<=clock_timestamp()) then raise exception 'Decision access expired' using errcode='42501';end if;
 return result||jsonb_build_object('access_expires_at',least(deadline,to_timestamp((auth.jwt()->>'exp')::bigint),(select coalesce(not_after,'infinity'::timestamptz) from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=actor)),'server_time',clock_timestamp());
end $$;
create function public.campaign_decision_foundation(p_action text,p_org uuid,p_campaign uuid,p_payload jsonb default '{}') returns jsonb language sql volatile security invoker set search_path='' as $$
 select private.campaign_decision_foundation(p_action,p_org,p_campaign,p_payload)
$$;
revoke all on function private.minden_decision_session(),private.minden_decision_authority(uuid,uuid,text),private.minden_decision_consent(uuid),private.minden_decision_record_intake(uuid,uuid,uuid),private.campaign_decision_foundation(text,uuid,uuid,jsonb),public.campaign_decision_foundation(text,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.campaign_decision_foundation(text,uuid,uuid,jsonb),public.campaign_decision_foundation(text,uuid,uuid,jsonb) to authenticated;
grant execute on function private.minden_decision_record_intake(uuid,uuid,uuid) to service_role;
commit;
