-- UNAPPLIED P1-only candidate. No policy, operator, recipient, secret or sending approval.
-- Install after the reviewed Team/Travel candidate. Never replay production history.
begin;
do $$declare f record;begin
 if to_regprocedure('private.outreach_team_workspace(text,uuid,jsonb)') is null
 or (select md5(pg_get_functiondef(p.oid)) from pg_proc p where p.oid='private.outreach_team_workspace(text,uuid,jsonb)'::regprocedure)<>'52571205fafd007fa79653efce3527cc'
 or (select md5(pg_get_functiondef(p.oid)) from pg_proc p where p.oid='private.outreach_team_confirmation_valid(uuid,uuid)'::regprocedure)<>'61b13ef583b090ebc40749356a9e921e'
 then raise exception 'Exact reviewed P1 contract required';end if;
 for f in select * from(values
 ('private.outreach_team_can(uuid,text)','97e74a0873c8947a23ed058d78148da1'),
 ('private.outreach_team_lock(uuid,text)','d014a9c6a1bc02dbb8080835ff79b96e'),
 ('private.outreach_team_own(uuid)','922b4b891c14a9483a52ecef306109eb'),
 ('private.outreach_team_permission_now(uuid,text,uuid)','452afb890652820275bba50a2a4156d7'),
 ('private.outreach_team_person_permission_now(uuid,uuid,text)','dfe9daa51c8202562d7d2560051ea316'),
 ('private.outreach_team_ready(uuid,uuid)','c9bae7fcad07437f350cc1c6d988369e'),
 ('private.outreach_team_record(uuid,text,uuid,jsonb)','122af768d3c6eb2d091f578bd7142bf7'),
 ('public.outreach_team_own(uuid)','dc2d8967153817371769fb9026e23fb8'),
 ('public.outreach_team_workspace(text,uuid,jsonb)','4954a4a72aa81ea9145e4e73c7945d16'),
 ('private.staff_assignment_active(uuid,uuid)','05149569926640f4d39bca2eda70169d'),
 ('private.outreach_verified(uuid)','24578afbb6043b94775a556517b0ad45')
 )x(signature,md5) loop
 if to_regprocedure(f.signature) is null or md5(pg_get_functiondef(to_regprocedure(f.signature)))<>f.md5 then raise exception 'Reviewed notice dependency drift: %',f.signature;end if;
 end loop;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname like 'outreach_team_notice_%')
 or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('private','public') and p.proname like 'outreach_team_notice_%')
 then raise exception 'Notice installation already exists or is partial';end if;
end $$;

create table private.outreach_team_notice_runtime(
 singleton boolean primary key default true check(singleton),enabled boolean not null default false,lookup_enabled boolean not null default false,
 environment text,provider_account text,check((environment is null)=(provider_account is null)),
 check(environment is null or (environment in('isolated_test','production') and length(provider_account) between 1 and 120)));
insert into private.outreach_team_notice_runtime(singleton) values(true);
create table private.outreach_team_notice_operators(
 campaign_id uuid not null references public.outreach_campaigns(id),user_id uuid not null references auth.users(id),
 can_prepare boolean not null default false,can_authorize boolean not null default false,
 can_report boolean not null default false,can_reconcile boolean not null default false,
 effective_at timestamptz not null,expires_at timestamptz not null,revoked_at timestamptz,
 approval_ref text not null check(length(approval_ref) between 10 and 200),primary key(campaign_id,user_id),
 check(expires_at>effective_at));
create table private.outreach_team_notice_policies(
 version text primary key check(version~'^[A-Za-z0-9_-]{1,80}$'),campaign_id uuid not null references public.outreach_campaigns(id),
 kind text not null check(kind in('team_under_review','team_approved','team_waitlisted','team_declined','team_cancelled',
 'vehicle_seat_reserved','vehicle_seat_cancelled','itinerary_confirmed','itinerary_needs_review')),
 approved_by uuid references auth.users(id),approved_at timestamptz,approval_ref text,
 environment text not null check(environment in('isolated_test','production')),provider_account text not null,
 subject_template text,text_template text,copy_sha256 text,
 sender text,reply_to text,recipient_rule text,consent_rule text,retention_rule text,retry_rule text,
 effective_at timestamptz not null,expires_at timestamptz not null,revoked_at timestamptz,
 check(expires_at>effective_at),check((approved_by is null)=(approved_at is null)),
 check(approved_at is null or (num_nonnulls(approval_ref,subject_template,text_template,copy_sha256,sender,reply_to,recipient_rule,consent_rule,retention_rule,retry_rule)=10
 and length(approval_ref) between 10 and 200 and length(subject_template) between 1 and 500
 and subject_template!~E'[\r\n]' and length(text_template) between 1 and 12000 and copy_sha256~'^[0-9a-f]{64}$'
 and sender~'^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@auth[.]championlifefwb[.]com$'
 and reply_to~'^[^[:space:]<>@,;]+@[^[:space:]<>@,;]+[.][^[:space:]<>@,;]+$'
 and recipient_rule='verified_adult_own_email' and consent_rule='explicit_per_intent'
 and retention_rule='retain_evidence_pending_manual_review' and retry_rule='no_automatic_retry_after_start')));
create table private.outreach_team_notice_intents(
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null references public.outreach_campaigns(id),
 member_id uuid not null references public.outreach_team_members(id),history_id bigint not null references public.outreach_team_history(id),
 kind text not null,assignment_id uuid references public.outreach_team_vehicle_assignments(id),
 source_digest text not null check(source_digest~'^[0-9a-f]{64}$'),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 state text not null default 'held_policy' check(state in('held_policy','ready','leased','in_flight','accepted','hold','suppressed','superseded')),
 hold_code text not null default 'policy_not_approved',policy_version text references private.outreach_team_notice_policies(version),
 authorized_by uuid references auth.users(id),authorized_at timestamptz,
 recipient_user_id uuid references auth.users(id),portal_link_id uuid references public.portal_account_links(id),
 recipient_digest text,consent_ref text,consent_revoked_at timestamptz,
 frozen_payload jsonb,payload_digest text,provider_key text not null unique,
 provider_email_id uuid unique,lease_token uuid,lease_until timestamptz,attempt_id uuid,
 first_attempt_at timestamptz,lookup_token uuid,lookup_review_id bigint,revision integer not null default 1,
 unique(campaign_id,member_id,history_id,kind),
 check(frozen_payload is null or (jsonb_typeof(frozen_payload)='object' and octet_length(frozen_payload::text)<=20000
 and payload_digest~'^[0-9a-f]{64}$' and recipient_digest~'^[0-9a-f]{64}$' and length(consent_ref) between 10 and 200
 and policy_version is not null and authorized_by is not null and authorized_at is not null)));
create index outreach_team_notice_queue_idx on private.outreach_team_notice_intents(campaign_id,created_at,id) where state in('ready','leased','in_flight');
create table private.outreach_team_notice_attempts(
 id uuid primary key,intent_id uuid not null unique references private.outreach_team_notice_intents(id),
 lease_token uuid not null,started_at timestamptz not null default clock_timestamp(),payload_digest text not null,provider_key text not null);
create table private.outreach_team_notice_events(
 id bigint generated always as identity primary key,intent_id uuid not null references private.outreach_team_notice_intents(id),
 attempt_id uuid references private.outreach_team_notice_attempts(id),kind text not null,
 code text not null check(code~'^[a-z_]{1,80}$'),provider_email_id uuid,
 actor_user_id uuid references auth.users(id),evidence_digest text check(evidence_digest~'^[0-9a-f]{64}$'),created_at timestamptz not null default clock_timestamp());
create index outreach_team_notice_event_intent_idx on private.outreach_team_notice_events(intent_id,id);
create table private.outreach_team_notice_receipts(
 environment text not null,provider_account text not null,receipt_id text not null check(receipt_id~'^[A-Za-z0-9_-]{1,128}$'),
 body_digest text not null check(body_digest~'^[0-9a-f]{64}$'),provider_email_id uuid not null,
 event_type text not null check(event_type in('email.sent','email.delivered','email.delivery_delayed','email.failed','email.bounced','email.complained','email.suppressed')),
 provider_at timestamptz not null,received_at timestamptz not null default clock_timestamp(),
 intent_id uuid references private.outreach_team_notice_intents(id),primary key(environment,provider_account,receipt_id));
create index outreach_team_notice_receipt_email_idx on private.outreach_team_notice_receipts(environment,provider_account,provider_email_id);
create table private.outreach_team_notice_receipt_bindings(
 environment text not null,provider_account text not null,receipt_id text not null,
 intent_id uuid not null references private.outreach_team_notice_intents(id),bound_at timestamptz not null default clock_timestamp(),
 primary key(environment,provider_account,receipt_id),
 foreign key(environment,provider_account,receipt_id) references private.outreach_team_notice_receipts(environment,provider_account,receipt_id));
create table private.outreach_team_notice_receipt_conflicts(
 environment text not null,provider_account text not null,receipt_id text not null,body_digest text not null check(body_digest~'^[0-9a-f]{64}$'),
 provider_email_id uuid not null,
 received_at timestamptz not null default clock_timestamp(),primary key(environment,provider_account,receipt_id,body_digest),
 foreign key(environment,provider_account,receipt_id) references private.outreach_team_notice_receipts(environment,provider_account,receipt_id));
create table private.outreach_team_notice_suppressions(
 campaign_id uuid not null references public.outreach_campaigns(id),recipient_digest text not null,
 code text not null check(code in('manual_hold','consent_withdrawn','provider_negative')),
 created_at timestamptz not null default clock_timestamp(),primary key(campaign_id,recipient_digest));

create function private.outreach_team_notice_sha(j jsonb) returns text language sql immutable set search_path='' as $$
 select encode(pg_catalog.sha256(convert_to(j::text,'UTF8')),'hex')
$$;
create function private.outreach_team_notice_can(c uuid,u uuid,cap text) returns boolean language sql volatile security definer set search_path='' as $$
 select private.outreach_verified(u) and exists(select 1 from public.outreach_campaigns x
 join public.organization_staff_directory d on d.organization_id=x.organization_id and d.user_id=u
 join private.outreach_team_notice_operators o on o.campaign_id=x.id and o.user_id=u
 where x.id=c and d.active and d.effective_at<=clock_timestamp() and (d.expires_at is null or d.expires_at>clock_timestamp())
 and private.staff_assignment_active(x.organization_id,u) and o.revoked_at is null
 and o.effective_at<=clock_timestamp() and o.expires_at>clock_timestamp()
 and case cap when 'prepare' then o.can_prepare when 'authorize' then o.can_authorize
 when 'report' then o.can_report when 'reconcile' then o.can_reconcile else false end
 and (exists(select 1 from public.organization_staff_permissions g where g.organization_id=x.organization_id and g.user_id=u
 and g.permission='staff.manage' and g.department_ids is null and g.revoked_at is null and g.effective_at<=clock_timestamp()
 and (g.expires_at is null or g.expires_at>clock_timestamp()))
 or exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c and a.user_id=u and a.active
 and a.effective_at<=clock_timestamp() and (a.expires_at is null or a.expires_at>clock_timestamp())
 and 'view'=any(a.capabilities) and 'team.view'=any(a.capabilities))))
$$;
create function private.outreach_team_notice_snapshot(c uuid,m uuid,a uuid) returns text language sql stable security definer set search_path='' as $$
 select private.outreach_team_notice_sha(jsonb_build_object(
 'member',to_jsonb(t)-'age_reason'-'availability_reason'-'guardian_reason',
 'source_status',s.status,'person_updated_at',p.updated_at,'person_identity',p.human_id,'person_email',lower(p.email),
 'guardian',(select to_jsonb(g)-'age_reason'-'availability_reason'-'guardian_reason' from public.outreach_team_members g where g.id=t.guardian_member_id),
 'guardian_source',(select gs.status from public.outreach_volunteer_applications gs join public.outreach_team_members g on g.application_id=gs.id where g.id=t.guardian_member_id),
 'household',(select jsonb_build_object('status',h.status,'revision',h.revision,'members',(select jsonb_agg(jsonb_build_object('person',hm.person_id,'active',hm.active,'revision',hm.revision) order by hm.person_id) from public.household_members hm where hm.household_id=h.id and hm.person_id in(t.person_id,(select g.person_id from public.outreach_team_members g where g.id=t.guardian_member_id)))) from public.households h where h.id=t.household_id),
 'travel',(select jsonb_build_object('assignment',to_jsonb(q),'leg',to_jsonb(l),'vehicle',to_jsonb(v)-'notes',
 'occupants',(select jsonb_agg(to_jsonb(z) order by z.id) from public.outreach_team_vehicle_assignments z where z.campaign_id=c and z.leg_id=q.leg_id and z.vehicle_id=q.vehicle_id and z.state<>'cancelled' and (z.seat_role='driver' or z.member_id=t.guardian_member_id)),
 'driver',(select jsonb_agg(jsonb_build_object('member',to_jsonb(d)-'age_reason'-'availability_reason'-'guardian_reason','source',ds.status,'review',to_jsonb(r)-'reason') order by d.id) from public.outreach_team_vehicle_assignments z join public.outreach_team_members d on d.id=z.member_id join public.outreach_volunteer_applications ds on ds.id=d.application_id join public.outreach_team_driver_reviews r on r.campaign_id=c and r.member_id=d.id and r.vehicle_id=q.vehicle_id where z.campaign_id=c and z.leg_id=q.leg_id and z.vehicle_id=q.vehicle_id and z.state<>'cancelled' and z.seat_role='driver'),
 'valid',private.outreach_team_confirmation_valid(c,q.id))
 from public.outreach_team_vehicle_assignments q join public.outreach_team_legs l on l.id=q.leg_id join public.outreach_team_vehicles v on v.id=q.vehicle_id where q.id=a and q.member_id=m and q.campaign_id=c)))
 from public.outreach_team_members t join public.outreach_volunteer_applications s on s.id=t.application_id
 join public.organization_people p on p.id=t.person_id and p.organization_id=t.organization_id where t.id=m and t.campaign_id=c
$$;
create function private.outreach_team_notice_kind_valid(c uuid,m uuid,a uuid,k text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(case when k like 'team_%' then
  (case s.status when 'cancelled' then 'cancelled' when 'not_selected' then 'declined' when 'waitlisted' then 'waitlisted' else t.status end)=substring(k from 6)
 when k='vehicle_seat_cancelled' then q.state='cancelled'
 when k='itinerary_confirmed' then private.outreach_team_confirmation_valid(c,q.id)
 when k='vehicle_seat_reserved' then q.state='assigned' and private.outreach_team_ready(c,m) and not private.outreach_team_confirmation_valid(c,q.id)
 when k='itinerary_needs_review' then q.state<>'cancelled' and not private.outreach_team_confirmation_valid(c,q.id)
 else false end,false)
 from public.outreach_team_members t join public.outreach_volunteer_applications s on s.id=t.application_id
 left join public.outreach_team_vehicle_assignments q on q.id=a and q.member_id=m and q.campaign_id=c
 where t.id=m and t.campaign_id=c
$$;
create function private.outreach_team_notice_recipient(i private.outreach_team_notice_intents) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('email',lower(p.email),'digest',private.outreach_team_notice_sha(jsonb_build_object('email',lower(p.email))))
 from public.outreach_team_members m join public.organization_people p on p.id=m.person_id and p.organization_id=m.organization_id
 join public.portal_account_links l on l.id=i.portal_link_id and l.person_id=p.id and l.organization_id=p.organization_id and l.user_id=i.recipient_user_id and l.active
 join auth.users u on u.id=l.user_id and lower(u.email)=lower(p.email)
 where m.id=i.member_id and m.campaign_id=i.campaign_id and m.age>=18 and private.outreach_verified(u.id)
 and p.email~'^[^[:space:]<>@,;]+@[^[:space:]<>@,;]+[.][^[:space:]<>@,;]+$'
 and (select count(*) from public.portal_account_links q where q.organization_id=p.organization_id and q.person_id=p.id and q.active)=1
 and (select count(*) from public.organization_people q where q.organization_id=p.organization_id and lower(q.email)=lower(p.email))=1
$$;
create function private.outreach_team_notice_conflicted(i private.outreach_team_notice_intents) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.outreach_team_notice_policies p join private.outreach_team_notice_receipt_conflicts z
 on z.environment=p.environment and z.provider_account=p.provider_account
 join private.outreach_team_notice_receipts r on r.environment=z.environment and r.provider_account=z.provider_account and r.receipt_id=z.receipt_id
 where p.version=i.policy_version and (z.provider_email_id=i.provider_email_id or r.provider_email_id=i.provider_email_id
 or exists(select 1 from private.outreach_team_notice_receipt_bindings b where b.environment=z.environment and b.provider_account=z.provider_account and b.receipt_id=z.receipt_id and b.intent_id=i.id)))
$$;
create function private.outreach_team_notice_valid(i private.outreach_team_notice_intents) returns text language plpgsql volatile security definer set search_path='' as $$
declare p private.outreach_team_notice_policies;r private.outreach_team_notice_runtime;rec jsonb;
begin
 select * into r from private.outreach_team_notice_runtime;
 if not r.enabled then return 'runtime_disabled';end if;
 select * into p from private.outreach_team_notice_policies where version=i.policy_version and campaign_id=i.campaign_id and kind=i.kind;
 if p.version is null or p.approved_at is null or p.revoked_at is not null or p.effective_at>clock_timestamp() or p.expires_at<=clock_timestamp()
 or r.environment is distinct from p.environment or r.provider_account is distinct from p.provider_account then return 'policy_not_approved';end if;
 if not private.outreach_team_notice_can(i.campaign_id,i.created_by,'prepare') or not private.outreach_team_notice_can(i.campaign_id,i.authorized_by,'authorize')
 or not private.outreach_team_notice_can(i.campaign_id,p.approved_by,'authorize') then return 'authority_revoked';end if;
 if i.source_digest is distinct from private.outreach_team_notice_snapshot(i.campaign_id,i.member_id,i.assignment_id) then return 'source_changed';end if;
 if not private.outreach_team_notice_kind_valid(i.campaign_id,i.member_id,i.assignment_id,i.kind) then return 'source_changed';end if;
 rec:=private.outreach_team_notice_recipient(i);
 if rec is null or rec->>'digest' is distinct from i.recipient_digest or rec->>'email' is distinct from i.frozen_payload->'to'->>0 then return 'recipient_changed';end if;
 if i.consent_revoked_at is not null then return 'consent_withdrawn';end if;
 if exists(select 1 from private.outreach_team_notice_suppressions s where s.campaign_id=i.campaign_id and s.recipient_digest=i.recipient_digest) then return 'recipient_suppressed';end if;
 if i.payload_digest is distinct from private.outreach_team_notice_sha(i.frozen_payload) then return 'payload_integrity';end if;
 if private.outreach_team_notice_conflicted(i) then return 'receipt_conflict';end if;
 return null;
end $$;
create function private.outreach_team_notice_immutable() returns trigger language plpgsql set search_path='' as $$begin
 if TG_OP='DELETE' then raise exception 'Notice evidence/dedupe is retained; no deletion API';end if;
 if TG_TABLE_NAME='outreach_team_notice_policies' then
  if (to_jsonb(new)-'revoked_at') is distinct from (to_jsonb(old)-'revoked_at') or old.revoked_at is not null or new.revoked_at is null then raise exception 'Approved policy versions are immutable; revoke only';end if;return new;
 end if;
 if TG_TABLE_NAME<>'outreach_team_notice_intents' then raise exception 'Notice policy/evidence is immutable';end if;
 if row(new.id,new.campaign_id,new.member_id,new.history_id,new.kind,new.assignment_id,new.source_digest,new.created_by,new.created_at,new.provider_key)
 is distinct from row(old.id,old.campaign_id,old.member_id,old.history_id,old.kind,old.assignment_id,old.source_digest,old.created_by,old.created_at,old.provider_key)
 or (old.frozen_payload is not null and row(new.frozen_payload,new.payload_digest,new.policy_version,new.authorized_by,new.authorized_at,new.recipient_user_id,new.portal_link_id,new.recipient_digest,new.consent_ref)
 is distinct from row(old.frozen_payload,old.payload_digest,old.policy_version,old.authorized_by,old.authorized_at,old.recipient_user_id,old.portal_link_id,old.recipient_digest,old.consent_ref))
 or (old.provider_email_id is not null and new.provider_email_id is distinct from old.provider_email_id)
 then raise exception 'Frozen notice identity/payload cannot change';end if;return new;
end $$;
do $$declare t text;begin
 foreach t in array array['runtime','operators','policies','intents','attempts','events','receipts','receipt_bindings','receipt_conflicts','suppressions'] loop
 execute format('alter table private.outreach_team_notice_%I enable row level security',t);
 execute format('revoke all on table private.outreach_team_notice_%I from public,anon,authenticated,service_role',t);
 end loop;
 foreach t in array array['policies','intents','attempts','events','receipts','receipt_bindings','receipt_conflicts'] loop
 execute format('create trigger notice_immutable before update or delete on private.outreach_team_notice_%I for each row execute function private.outreach_team_notice_immutable()',t);
 end loop;
end $$;

create function private.outreach_team_notice_workspace(a text,c uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare i private.outreach_team_notice_intents;h public.outreach_team_history;m public.outreach_team_members;q public.outreach_team_vehicle_assignments;
 policy private.outreach_team_notice_policies;rec jsonb;payload jsonb;why text;subject text;body text;label text;newid uuid:=gen_random_uuid();cap text;
begin
 cap:=case when a='authorize' then 'authorize' when a in('review_hold','reconcile') then 'reconcile' when a='report' then 'report' else 'prepare' end;
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>4000 or not private.outreach_team_notice_can(c,auth.uid(),cap) then raise exception 'Notice access denied' using errcode='42501';end if;
 perform 1 from public.outreach_campaigns where id=c for update;
 if not private.outreach_team_notice_can(c,auth.uid(),cap) then raise exception 'Notice access denied' using errcode='42501';end if;
 if a='prepare' then
  select * into h from public.outreach_team_history where campaign_id=c and id=(p->>'history_id')::bigint;
  select * into m from public.outreach_team_members where campaign_id=c and id=(p->>'member_id')::uuid;
  select * into q from public.outreach_team_vehicle_assignments where campaign_id=c and id=nullif(p->>'assignment_id','')::uuid and member_id=m.id;
  if h.id is null or m.id is null then raise exception 'Authoritative source event required';end if;
  why:=p->>'kind';
  if why in('team_under_review','team_approved','team_waitlisted','team_declined','team_cancelled') then
   if h.kind<>'approval.changed' or h.subject_id<>m.id or h.metadata->>'to' is distinct from substring(why from 6) or m.status<>h.metadata->>'to'
    or h.id is distinct from (select max(z.id) from public.outreach_team_history z where z.campaign_id=c and z.subject_id=m.id and z.kind='approval.changed') then raise exception 'Source decision does not match';end if;
  elsif why in('vehicle_seat_reserved','vehicle_seat_cancelled','itinerary_confirmed','itinerary_needs_review') then
   if q.id is null or not ((h.subject_id=q.id and (h.kind=case why when 'vehicle_seat_reserved' then 'assignment_save' when 'vehicle_seat_cancelled' then 'assignment_cancel' when 'itinerary_confirmed' then 'assignment_confirm' else 'assignment_confirm' end or (why='vehicle_seat_reserved' and h.kind='assignment_reassign')))
    or (why='itinerary_needs_review' and h.kind='itinerary.changed' and h.subject_id=q.leg_id)) then raise exception 'Authoritative travel event required';end if;
   if (why='vehicle_seat_reserved' and (q.state<>'assigned' or q.revision<>1)) or (why='vehicle_seat_cancelled' and q.state<>'cancelled')
   or (why='itinerary_confirmed' and not private.outreach_team_confirmation_valid(c,q.id))
   or (why='itinerary_needs_review' and (q.state='cancelled' or private.outreach_team_confirmation_valid(c,q.id))) then raise exception 'Current travel state does not match';end if;
  else raise exception 'Unknown notice kind';end if;
  if not private.outreach_team_notice_kind_valid(c,m.id,q.id,why) then raise exception 'Current source precedence does not match';end if;
  insert into private.outreach_team_notice_intents(id,campaign_id,member_id,history_id,kind,assignment_id,source_digest,created_by,provider_key)
  values(newid,c,m.id,h.id,why,q.id,private.outreach_team_notice_snapshot(c,m.id,q.id),auth.uid(),'outreach-team-v1/'||newid)
  on conflict(campaign_id,member_id,history_id,kind) do nothing;
  select * into i from private.outreach_team_notice_intents where campaign_id=c and member_id=m.id and history_id=h.id and kind=why;
  return jsonb_build_object('id',i.id,'state',i.state,'sendable',false);
 elsif a='report' then
  return jsonb_build_object('counts',(select coalesce(jsonb_object_agg(state,n),'{}') from(select state,count(*) n from private.outreach_team_notice_intents where campaign_id=c group by state)x),
   'intents',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'state',x.state,'hold_code',x.hold_code,'created_at',x.created_at,'attempt_started',x.first_attempt_at is not null,
    'outcomes',(select coalesce(jsonb_agg(distinct r.event_type),'[]') from private.outreach_team_notice_receipts r join private.outreach_team_notice_receipt_bindings b using(environment,provider_account,receipt_id) where b.intent_id=x.id),
    'lookup_outcomes',(select coalesce(jsonb_agg(distinct e.code),'[]') from private.outreach_team_notice_events e where e.intent_id=x.id and e.kind='provider_lookup'),
    'evidence_conflict',private.outreach_team_notice_conflicted(x::private.outreach_team_notice_intents)) order by x.created_at desc,x.id),'[]') from(select * from private.outreach_team_notice_intents where campaign_id=c order by created_at desc,id limit 100)x));
 end if;
 select * into i from private.outreach_team_notice_intents where campaign_id=c and id=(p->>'intent_id')::uuid for update;
 if i.id is null then raise exception 'Notice unavailable';end if;
 if a='authorize' then
  if i.frozen_payload is not null or i.state<>'held_policy' then raise exception 'Intent is already frozen';end if;
  select * into policy from private.outreach_team_notice_policies where version=p->>'policy_version' and campaign_id=c and kind=i.kind;
  if policy.approved_at is null or policy.copy_sha256 is distinct from private.outreach_team_notice_sha(jsonb_build_object('subject',policy.subject_template,'text',policy.text_template)) then raise exception 'Exact approved copy/policy required';end if;
  i.policy_version:=policy.version;i.authorized_by:=auth.uid();i.authorized_at:=clock_timestamp();
  i.recipient_user_id:=(p->>'recipient_user_id')::uuid;i.portal_link_id:=(p->>'portal_link_id')::uuid;i.consent_ref:=p->>'consent_ref';
  if p->>'explicit_consent_reviewed' is distinct from 'true' or i.consent_ref is null or length(i.consent_ref) not between 10 and 200 then raise exception 'Explicit recipient/consent review required';end if;
  rec:=private.outreach_team_notice_recipient(i);if rec is null then raise exception 'Approved recipient contract not met';end if;
  select name into label from public.outreach_campaigns where id=c;
  subject:=replace(policy.subject_template,'{{event_name}}',label);body:=replace(policy.text_template,'{{event_name}}',label);
  if i.assignment_id is not null then select l.label into label from public.outreach_team_vehicle_assignments z join public.outreach_team_legs l on l.id=z.leg_id where z.id=i.assignment_id;
   subject:=replace(subject,'{{leg_label}}',label);body:=replace(body,'{{leg_label}}',label);end if;
  if subject~E'[\r\n]' or subject like '%{{%' or body like '%{{%' then raise exception 'Approved bounded template required';end if;
  i.recipient_digest:=rec->>'digest';i.frozen_payload:=jsonb_build_object('from',policy.sender,'reply_to',policy.reply_to,'to',jsonb_build_array(rec->>'email'),'subject',subject,'text',body,
   'tags',jsonb_build_array(jsonb_build_object('name','p1_intent','value',i.id::text)));
  i.payload_digest:=private.outreach_team_notice_sha(i.frozen_payload);
  why:=private.outreach_team_notice_valid(i);if why is not null then raise exception 'Notice approval gate: %',why;end if;
  update private.outreach_team_notice_intents set policy_version=i.policy_version,authorized_by=i.authorized_by,authorized_at=i.authorized_at,
   recipient_user_id=i.recipient_user_id,portal_link_id=i.portal_link_id,recipient_digest=i.recipient_digest,consent_ref=i.consent_ref,
   frozen_payload=i.frozen_payload,payload_digest=i.payload_digest,state='ready',hold_code='',revision=revision+1 where id=i.id;
  insert into private.outreach_team_notice_events(intent_id,kind,code,actor_user_id) values(i.id,'authorized','owner_reviewed',auth.uid());
 elsif a in('suppress','withdraw') then
  update private.outreach_team_notice_intents set consent_revoked_at=clock_timestamp(),state='suppressed',hold_code='consent_withdrawn',revision=revision+1 where id=i.id;
  if i.recipient_digest is not null then insert into private.outreach_team_notice_suppressions values(c,i.recipient_digest,'consent_withdrawn',clock_timestamp()) on conflict do nothing;end if;
  insert into private.outreach_team_notice_events(intent_id,kind,code,actor_user_id) values(i.id,'suppressed','consent_withdrawn',auth.uid());
 elsif a='review_hold' then
  if i.state<>'hold' or p->>'code' not in('provider_lookup_required','unsent_not_proven','evidence_reviewed') then raise exception 'Held notice review required';end if;
  insert into private.outreach_team_notice_events(intent_id,kind,code,actor_user_id,provider_email_id) values(i.id,'reconciliation_review',p->>'code',auth.uid(),nullif(p->>'provider_email_id','')::uuid);
 else raise exception 'Unknown notice action';end if;
 return jsonb_build_object('id',i.id,'state',(select state from private.outreach_team_notice_intents where id=i.id),'sendable',false,
  'review_id',case when a='review_hold' then (select max(id) from private.outreach_team_notice_events where intent_id=i.id and kind='reconciliation_review' and actor_user_id=auth.uid()) else null end);
end $$;

create function private.outreach_team_notice_adopt(i private.outreach_team_notice_intents) returns void language plpgsql security definer set search_path='' as $$
declare policy private.outreach_team_notice_policies;
begin
 if i.provider_email_id is null then return;end if;
 select * into policy from private.outreach_team_notice_policies where version=i.policy_version;
 insert into private.outreach_team_notice_receipt_bindings(environment,provider_account,receipt_id,intent_id)
 select r.environment,r.provider_account,r.receipt_id,i.id from private.outreach_team_notice_receipts r
 where r.provider_email_id=i.provider_email_id and r.environment=policy.environment and r.provider_account=policy.provider_account on conflict do nothing;
 if exists(select 1 from private.outreach_team_notice_receipts r join private.outreach_team_notice_receipt_bindings b using(environment,provider_account,receipt_id)
 where b.intent_id=i.id and r.event_type in('email.failed','email.bounced','email.complained','email.suppressed')) then
  insert into private.outreach_team_notice_suppressions values(i.campaign_id,i.recipient_digest,'provider_negative',clock_timestamp()) on conflict do nothing;
  update private.outreach_team_notice_intents set state='suppressed',hold_code='provider_negative',revision=revision+1 where id=i.id;
 end if;
 if private.outreach_team_notice_conflicted(i) then
  update private.outreach_team_notice_intents set state=case when state='suppressed' then 'suppressed' else 'hold' end,hold_code='receipt_conflict',revision=revision+1 where id=i.id;end if;
end $$;
create function private.outreach_team_notice_worker(a text,c uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare i private.outreach_team_notice_intents;r private.outreach_team_notice_runtime;receipt private.outreach_team_notice_receipts;
 why text;token uuid;attempt uuid;email uuid;locked_email uuid;valid boolean;policy private.outreach_team_notice_policies;review private.outreach_team_notice_events;
begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>5000 then raise exception 'Invalid worker envelope';end if;
 select * into r from private.outreach_team_notice_runtime;
 if r.environment is null or r.provider_account is null or r.environment is distinct from p->>'environment' or r.provider_account is distinct from p->>'provider_account' then raise exception 'Worker environment mismatch' using errcode='42501';end if;
 if a='receipt' then
  if p->>'body_digest'!~'^[0-9a-f]{64}$' or p->>'receipt_id'!~'^[A-Za-z0-9_-]{1,128}$' then raise exception 'Verified receipt required';end if;
  email:=(p->>'provider_email_id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(r.environment||':'||r.provider_account||':'||(p->>'receipt_id'),0));
  select * into receipt from private.outreach_team_notice_receipts where environment=r.environment and provider_account=r.provider_account and receipt_id=p->>'receipt_id';
  for locked_email in select distinct value from unnest(array[email,receipt.provider_email_id]) as ids(value) where value is not null order by value loop
   perform pg_advisory_xact_lock(hashtextextended('p1-email:'||r.environment||':'||r.provider_account||':'||locked_email,0));end loop;
  if receipt.receipt_id is not null then
   if receipt.body_digest is distinct from p->>'body_digest' then
    insert into private.outreach_team_notice_receipt_conflicts(environment,provider_account,receipt_id,body_digest,provider_email_id)
     values(r.environment,r.provider_account,receipt.receipt_id,p->>'body_digest',email) on conflict do nothing;
    update private.outreach_team_notice_intents t set state='hold',hold_code='receipt_conflict',revision=revision+1 where
     (t.provider_email_id in(email,receipt.provider_email_id) or t.id in
      (select b.intent_id from private.outreach_team_notice_receipt_bindings b where b.environment=r.environment and b.provider_account=r.provider_account and b.receipt_id=receipt.receipt_id))
     and exists(select 1 from private.outreach_team_notice_policies z where z.version=t.policy_version and z.environment=r.environment and z.provider_account=r.provider_account);
    return jsonb_build_object('state','hold','code','receipt_conflict');end if;
   return jsonb_build_object('state','duplicate');end if;
  select * into i from private.outreach_team_notice_intents where provider_email_id=email;
  if i.id is not null then
   select * into policy from private.outreach_team_notice_policies where version=i.policy_version;
   if policy.environment<>r.environment or policy.provider_account<>r.provider_account then raise exception 'Receipt environment mismatch';end if;
   perform 1 from public.outreach_campaigns where id=i.campaign_id for update;
  end if;
  insert into private.outreach_team_notice_receipts(environment,provider_account,receipt_id,body_digest,provider_email_id,event_type,provider_at,intent_id)
   values(r.environment,r.provider_account,p->>'receipt_id',p->>'body_digest',email,p->>'event_type',(p->>'provider_at')::timestamptz,i.id)
   on conflict do nothing;
  if i.id is not null then perform private.outreach_team_notice_adopt(i);end if;
  return jsonb_build_object('state',case when i.id is null then 'unmatched_hold' else 'recorded' end);
 end if;
 if c is null then raise exception 'Explicit event required';end if;
 if a in('result','lookup_result') and nullif(p->>'provider_email_id','') is not null then
  perform pg_advisory_xact_lock(hashtextextended('p1-email:'||r.environment||':'||r.provider_account||':'||((p->>'provider_email_id')::uuid)::text,0));end if;
 perform 1 from public.outreach_campaigns where id=c for update;
 select * into r from private.outreach_team_notice_runtime;
 if r.environment is distinct from p->>'environment' or r.provider_account is distinct from p->>'provider_account' then raise exception 'Worker environment changed' using errcode='42501';end if;
 if a='claim' then
  if not r.enabled then return jsonb_build_object('state','disabled');end if;
  select * into i from private.outreach_team_notice_intents where campaign_id=c and
   (state='ready' or (state in('leased','in_flight') and lease_until<=clock_timestamp())) order by created_at,id for update skip locked limit 1;
  if i.id is null then return jsonb_build_object('state','empty');end if;
  if i.first_attempt_at is not null then why:='attempt_outcome_unknown';else why:=private.outreach_team_notice_valid(i);end if;
  if why is not null then update private.outreach_team_notice_intents set state='hold',hold_code=why,revision=revision+1 where id=i.id;
   return jsonb_build_object('state','hold','code',why);end if;
  token:=gen_random_uuid();
  update private.outreach_team_notice_intents set state='leased',lease_token=token,lease_until=clock_timestamp()+interval '30 seconds',revision=revision+1 where id=i.id;
  return jsonb_build_object('state','leased','intent_id',i.id,'lease_token',token,'payload_digest',i.payload_digest,'provider_key',i.provider_key);
 end if;
 select * into i from private.outreach_team_notice_intents where campaign_id=c and id=(p->>'intent_id')::uuid for update;
 if i.id is null then raise exception 'Notice unavailable';end if;
 if a='start' then
  if i.state<>'leased' or i.lease_token is distinct from (p->>'lease_token')::uuid or i.lease_until<=clock_timestamp() or i.first_attempt_at is not null then return jsonb_build_object('state','stale');end if;
  why:=private.outreach_team_notice_valid(i);if why is not null then
   update private.outreach_team_notice_intents set state='hold',hold_code=why,revision=revision+1 where id=i.id;return jsonb_build_object('state','hold','code',why);end if;
  attempt:=gen_random_uuid();insert into private.outreach_team_notice_attempts(id,intent_id,lease_token,payload_digest,provider_key) values(attempt,i.id,i.lease_token,i.payload_digest,i.provider_key);
  update private.outreach_team_notice_intents set state='in_flight',attempt_id=attempt,first_attempt_at=clock_timestamp(),revision=revision+1 where id=i.id;
  return jsonb_build_object('state','in_flight','attempt_id',attempt,'payload_json',i.frozen_payload::text,'provider_key',i.provider_key,'payload_digest',i.payload_digest);
 elsif a='result' then
  if i.first_attempt_at is null or i.attempt_id is null or i.lease_token is null
   or i.attempt_id is distinct from (p->>'attempt_id')::uuid or i.lease_token is distinct from (p->>'lease_token')::uuid then return jsonb_build_object('state','stale');end if;
  if exists(select 1 from private.outreach_team_notice_events e where e.intent_id=i.id and e.attempt_id=i.attempt_id and e.kind='attempt_result') then return jsonb_build_object('state','duplicate');end if;
  email:=nullif(p->>'provider_email_id','')::uuid;
  why:=private.outreach_team_notice_valid(i);
  valid:=i.state='in_flight' and i.lease_until>clock_timestamp() and why is null;
  if email is not null and exists(select 1 from private.outreach_team_notice_intents x where x.provider_email_id=email and x.id<>i.id) then email:=null;why:='provider_binding_conflict';valid:=false;end if;
  if email is null and why is null then why:='provider_outcome_unknown';end if;
  insert into private.outreach_team_notice_events(intent_id,attempt_id,kind,code,provider_email_id)
   values(i.id,i.attempt_id,'attempt_result',case when email is not null then 'provider_accepted' else 'provider_outcome_unknown' end,email);
  update private.outreach_team_notice_intents set provider_email_id=coalesce(provider_email_id,email),
   state=case when valid and email is not null then 'accepted' when state='suppressed' then 'suppressed' else 'hold' end,
   hold_code=case when valid and email is not null then '' else coalesce(why,'late_result_requires_review') end,revision=revision+1 where id=i.id;
  select * into i from private.outreach_team_notice_intents where id=i.id;
  perform private.outreach_team_notice_adopt(i);
  return jsonb_build_object('state',(select state from private.outreach_team_notice_intents where id=i.id));
 elsif a in('lookup_context','lookup_result') then
  if not r.lookup_enabled or i.first_attempt_at is null or i.attempt_id is null or i.state not in('hold','suppressed') then return jsonb_build_object('state','hold','code','lookup_not_authorized');end if;
  select * into review from private.outreach_team_notice_events where id=(p->>'review_id')::bigint and intent_id=i.id and kind='reconciliation_review'
   and code='provider_lookup_required' and provider_email_id=(p->>'provider_email_id')::uuid and private.outreach_team_notice_can(c,actor_user_id,'reconcile');
  if review.id is null then return jsonb_build_object('state','hold','code','lookup_not_authorized');end if;
  if a='lookup_context' then
   token:=gen_random_uuid();update private.outreach_team_notice_intents set lookup_token=token,lookup_review_id=review.id,revision=revision+1 where id=i.id;
   return jsonb_build_object('state','lookup_authorized','lookup_token',token,'payload_json',i.frozen_payload::text,'payload_digest',i.payload_digest,
    'provider_key',i.provider_key,'attempt_started_at',i.first_attempt_at);
  end if;
  if p->>'last_event' is null or p->>'last_event' not in('sent','delivered','delivery_delayed','failed','bounced','complained','suppressed') then return jsonb_build_object('state','hold','code','provider_outcome_unknown');end if;
  if i.lookup_token is null or i.lookup_token is distinct from (p->>'lookup_token')::uuid or i.lookup_review_id is distinct from review.id
   or i.payload_digest is distinct from p->>'payload_digest' or p->>'evidence_digest' is null or p->>'evidence_digest'!~'^[0-9a-f]{64}$' then return jsonb_build_object('state','stale');end if;
  email:=(p->>'provider_email_id')::uuid;
  if (i.provider_email_id is not null and i.provider_email_id<>email) or exists(select 1 from private.outreach_team_notice_intents x where x.provider_email_id=email and x.id<>i.id) then return jsonb_build_object('state','hold','code','provider_binding_conflict');end if;
  why:=private.outreach_team_notice_valid(i);
  insert into private.outreach_team_notice_events(intent_id,attempt_id,kind,code,provider_email_id,actor_user_id,evidence_digest)
   values(i.id,i.attempt_id,'provider_lookup',
    case when p->>'last_event' in('bounced','complained','suppressed','failed') then 'provider_record_negative'
    when p->>'last_event'='delivered' then 'provider_record_delivered' when p->>'last_event'='delivery_delayed' then 'provider_record_delayed' else 'provider_record_accepted' end,email,review.actor_user_id,p->>'evidence_digest');
  update private.outreach_team_notice_intents set provider_email_id=coalesce(provider_email_id,email),lookup_token=null,
   state=case when state='suppressed' then 'suppressed' when why is null then 'accepted' else 'hold' end,
   hold_code=coalesce(why,''),revision=revision+1 where id=i.id;
  if p->>'last_event' in('bounced','complained','suppressed','failed') then
   insert into private.outreach_team_notice_suppressions values(c,i.recipient_digest,'provider_negative',clock_timestamp()) on conflict do nothing;
   update private.outreach_team_notice_intents set state='suppressed',hold_code='provider_negative',revision=revision+1 where id=i.id;
  end if;
  select * into i from private.outreach_team_notice_intents where id=i.id;perform private.outreach_team_notice_adopt(i);
  return jsonb_build_object('state',(select state from private.outreach_team_notice_intents where id=i.id));
 elsif a='reconcile' then
  -- Resolve only already-bound signed evidence. Unknown provider IDs stay held.
  if i.state<>'hold' or i.provider_email_id is null or not exists(select 1 from private.outreach_team_notice_events e where e.intent_id=i.id and e.kind='reconciliation_review' and private.outreach_team_notice_can(c,e.actor_user_id,'reconcile')) then return jsonb_build_object('state','hold','code','provider_lookup_required');end if;
  why:=private.outreach_team_notice_valid(i);
  if why is not null or not exists(select 1 from private.outreach_team_notice_receipts q join private.outreach_team_notice_receipt_bindings b using(environment,provider_account,receipt_id) where b.intent_id=i.id and q.provider_email_id=i.provider_email_id and q.event_type in('email.sent','email.delivered'))
   or exists(select 1 from private.outreach_team_notice_receipts q join private.outreach_team_notice_receipt_bindings b using(environment,provider_account,receipt_id) where b.intent_id=i.id and q.event_type in('email.failed','email.bounced','email.complained','email.suppressed')) then return jsonb_build_object('state','hold');end if;
  update private.outreach_team_notice_intents set state='accepted',hold_code='',revision=revision+1 where id=i.id;
  insert into private.outreach_team_notice_events(intent_id,kind,code) values(i.id,'reconciled','verified_bound_receipt');
  return jsonb_build_object('state','accepted');
 else raise exception 'Unknown worker action';end if;
end $$;
create function public.outreach_team_notice_workspace(p_action text,p_campaign uuid,p_payload jsonb default '{}') returns jsonb language sql security definer set search_path='' as $$select private.outreach_team_notice_workspace(p_action,p_campaign,p_payload)$$;
create function public.outreach_team_notice_worker(p_action text,p_campaign uuid,p_payload jsonb default '{}') returns jsonb language sql security definer set search_path='' as $$select private.outreach_team_notice_worker(p_action,p_campaign,p_payload)$$;
do $$declare f record;begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('private','public') and p.proname like 'outreach_team_notice_%' loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);end loop;
end $$;
grant execute on function public.outreach_team_notice_workspace(text,uuid,jsonb) to authenticated;
grant execute on function public.outreach_team_notice_worker(text,uuid,jsonb) to service_role;
revoke all on sequence private.outreach_team_notice_events_id_seq from public,anon,authenticated,service_role;
commit;
