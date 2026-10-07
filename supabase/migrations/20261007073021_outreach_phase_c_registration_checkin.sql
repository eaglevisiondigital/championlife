-- Phase C candidate only. No campaign enabled, canonical identity or authority created.
alter table public.outreach_campaign_assignments drop constraint outreach_campaign_assignments_capabilities_check;
alter table public.outreach_campaign_assignments add constraint outreach_campaign_assignments_capabilities_check check (
 capabilities <@ array['view','export','followup','decisions','workflow','documents','draw','team.view','team.manage','travel.view','travel.manage','registration.view','registration.manage','registration.export','checkin.manage']::text[]
 and cardinality(capabilities)>0 and array_position(capabilities,null) is null
 and (not('team.manage'=any(capabilities)) or 'team.view'=any(capabilities))
 and (not('travel.manage'=any(capabilities)) or 'travel.view'=any(capabilities))
 and (not(capabilities && array['registration.manage','registration.export','checkin.manage']) or 'registration.view'=any(capabilities)));
alter table public.outreach_campaign_events drop constraint outreach_campaign_events_kind_check;
alter table public.outreach_campaign_events add constraint outreach_campaign_events_kind_check check(kind in (
 'campaign.created','campaign.approved','workflow.step_due','workflow.step_overdue','workflow.step_completed','document.requested','document.uploaded','agreement.completed','training.assigned','training.completed','registration.opened','team.signup_opened','event.ready','event.completed','followup.required','drawing_number.assigned','drawing_reminder','prize.won','prize.unclaimed',
 'team_signup.submitted','team_signup.approved','team_signup.waitlisted','team_signup.not_selected','vehicle.assigned','vehicle.changed','lodging.assigned','lodging.changed','trip_details.updated','departure_reminder','team_role.assigned','team.action_required',
 'outreach.registration.submitted','outreach.registration.updated','outreach.waiver.signed','outreach.registration.confirmed','outreach.attendee.checked_in','outreach.attendee.checkin_reversed','outreach.walkup.registered'));
create table public.outreach_registration_settings (
 campaign_id uuid primary key references public.outreach_campaigns(id), public_slug text not null unique check(public_slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
 enabled boolean not null default false, opens_at timestamptz, closes_at timestamptz,
 address_required boolean not null default false, waiver_required boolean not null default true,
 household_limit integer check(household_limit between 1 and 100000),
 instructions text not null default '' check(length(instructions)<=2000),
 prize_choices jsonb not null default '[]' check(jsonb_typeof(prize_choices)='array' and jsonb_array_length(prize_choices)<=40),
 extra_fields jsonb not null default '[]' check(jsonb_typeof(extra_fields)='array' and jsonb_array_length(extra_fields)<=40),
 revision integer not null default 1, check(closes_at is null or opens_at is null or closes_at>opens_at)
);
create table public.outreach_waiver_versions (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id),
 template_key text not null check(length(template_key) between 1 and 100), version integer not null check(version>0),
 effective_at timestamptz not null, text_snapshot text not null check(length(btrim(text_snapshot)) between 10 and 20000),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(campaign_id,id), unique(campaign_id,template_key,version)
);
create table public.outreach_event_registrations (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, organization_id uuid not null,
 request_key uuid not null, request_snapshot jsonb not null, reference text not null default ('R-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16))),
 first_name text not null check(length(btrim(first_name)) between 1 and 100), last_name text not null check(length(btrim(last_name)) between 1 and 100),
 email text not null check(length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 phone text not null check(length(phone) between 7 and 40 and phone ~ '^[+0-9(). -]+$' and length(regexp_replace(phone,'[^0-9]','','g')) between 7 and 15), address text not null default '' check(length(address)<=500),
 source text not null check(source in ('public','walkup')), status text not null default 'submitted' check(status in ('submitted','confirmed','checked_in','cancelled','no_show','closed')),
 consents jsonb not null default '{}' check(jsonb_typeof(consents)='object'), notes text not null default '' check(length(notes)<=2000),
 household_id uuid, submitted_at timestamptz not null default now(), revision integer not null default 1,
 foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id),
 foreign key(organization_id,household_id) references public.households(organization_id,id),
 unique(campaign_id,id), unique(campaign_id,request_key), unique(campaign_id,reference)
);
create index outreach_event_registration_lookup on public.outreach_event_registrations(campaign_id,lower(last_name),lower(email),phone);
create table public.outreach_event_attendees (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, registration_id uuid not null,
 client_key uuid not null, first_name text not null check(length(btrim(first_name)) between 1 and 100), last_name text not null check(length(btrim(last_name)) between 1 and 100),
 age integer not null check(age between 0 and 120), relationship text not null check(relationship in ('self','spouse','child','dependent','other')),
 guardian_relationship text not null default '' check(length(guardian_relationship)<=100), attending boolean not null default true, active boolean not null default true,
 prize_participation boolean not null default false, bike_interest boolean not null default false, tablet_only boolean not null default false,
 prize_choice text, answers jsonb not null default '{}' check(jsonb_typeof(answers)='object' and octet_length(answers::text)<=4000),
 wristband text not null default '' check(length(wristband)<=80), notes text not null default '' check(length(notes)<=1000),
 checked_in_at timestamptz, checked_in_by uuid references auth.users(id), revision integer not null default 1,
 registrant_id uuid,
 foreign key(campaign_id,registration_id) references public.outreach_event_registrations(campaign_id,id),
 foreign key(campaign_id,registrant_id) references public.outreach_campaign_registrants(campaign_id,id),
 unique(campaign_id,id), unique(registration_id,client_key),
 check(age>=18 or (relationship in ('child','dependent') and length(btrim(guardian_relationship))>0)),
 check((checked_in_at is null)=(checked_in_by is null)), check(not tablet_only or not bike_interest)
);
create index outreach_event_attendees_registration on public.outreach_event_attendees(campaign_id,registration_id);
-- Reuse dormant prize identity; never create a second identity ledger or drawing number.
alter table public.outreach_prize_participants add column attendee_id uuid;
alter table public.outreach_prize_participants add constraint outreach_prize_attendee_fk foreign key(campaign_id,attendee_id) references public.outreach_event_attendees(campaign_id,id);
create unique index outreach_prize_attendee_unique on public.outreach_prize_participants(campaign_id,attendee_id) where attendee_id is not null;
create table public.outreach_waiver_signatures (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, registration_id uuid not null,
 request_key uuid not null, version_id uuid not null, version integer not null, text_snapshot text not null,
 signer_name text not null check(length(btrim(signer_name)) between 3 and 200), signer_relationship text not null check(signer_relationship in ('self','parent','legal_guardian','authorized_adult')),
 authority_acknowledged boolean not null check(authority_acknowledged), acknowledged boolean not null check(acknowledged),
 signature_method text not null default 'typed_name' check(signature_method='typed_name'),
 coverage_snapshot jsonb not null check(jsonb_typeof(coverage_snapshot)='array' and jsonb_array_length(coverage_snapshot)>0),
 signed_at timestamptz not null default now(), recorded_by uuid references auth.users(id),
 foreign key(campaign_id,registration_id) references public.outreach_event_registrations(campaign_id,id),
 foreign key(campaign_id,version_id) references public.outreach_waiver_versions(campaign_id,id),
 unique(registration_id,request_key)
);
create table public.outreach_waiver_corrections (
 signature_id uuid primary key references public.outreach_waiver_signatures(id),
 reason text not null check(length(btrim(reason)) between 10 and 500), recorded_by uuid not null references auth.users(id), recorded_at timestamptz not null default now()
);
-- Rate state is private, independent of any canonical Person/email matching.
create table private.outreach_registration_rate (
 campaign_id uuid not null references public.outreach_campaigns(id), network_hash text not null, bucket timestamptz not null, attempts integer not null,
 primary key(campaign_id,network_hash,bucket)
);
alter table private.outreach_registration_rate enable row level security;
revoke all on private.outreach_registration_rate from public,anon,authenticated;
create trigger outreach_waiver_version_immutable before update or delete on public.outreach_waiver_versions for each row execute function private.outreach_immutable();
create trigger outreach_waiver_signature_immutable before update or delete on public.outreach_waiver_signatures for each row execute function private.outreach_immutable();
create trigger outreach_waiver_correction_immutable before update or delete on public.outreach_waiver_corrections for each row execute function private.outreach_immutable();
create function private.outreach_registration_can(c uuid,cap text) returns boolean language sql stable security definer set search_path='' as $$
 select cap in ('registration.view','registration.manage','registration.export','checkin.manage') and private.outreach_verified(auth.uid()) and exists(select 1 from public.outreach_campaigns x where x.id=c and
 (private.outreach_admin(x.organization_id,cap<>'registration.view') or exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c and a.user_id=auth.uid() and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and 'view'=any(a.capabilities) and 'registration.view'=any(a.capabilities) and cap=any(a.capabilities))))
$$;
create function private.outreach_registration_open(c uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.outreach_registration_settings s join public.outreach_campaigns x on x.id=s.campaign_id where x.id=c and s.enabled and x.status not in ('draft','closed','completed','cancelled') and (s.opens_at is null or now()>=s.opens_at) and (s.closes_at is null or now()<s.closes_at))
$$;
create function private.outreach_registration_config(c uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('name',x.name,'organization_name',o.name,'logo_asset',case o.slug when 'champion-life' then 'assets/images/logo-gold.png' when 'sowgo' then 'assets/images/sowgo-logo-light.png' else null end,'slug',s.public_slug,'event_start',x.event_start,'event_end',x.event_end,'timezone',x.timezone,'venue',jsonb_build_object('name',x.venue->>'name','address',x.venue->>'address'),'address_required',s.address_required,'waiver_required',s.waiver_required,'instructions',s.instructions,'prize_choices',s.prize_choices,'extra_fields',s.extra_fields,
 'waiver',(select jsonb_build_object('id',v.id,'version',v.version,'text',v.text_snapshot) from public.outreach_waiver_versions v where v.campaign_id=c and v.effective_at<=now() order by v.effective_at desc,v.version desc limit 1))
 from public.outreach_campaigns x join public.outreach_registration_settings s on s.campaign_id=x.id join public.organizations o on o.id=x.organization_id where x.id=c
$$;
create function private.outreach_registration_public_config(slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare c uuid;result jsonb;begin select campaign_id into c from public.outreach_registration_settings where public_slug=slug;
 if c is null or not private.outreach_registration_open(c) then raise exception 'Registration unavailable';end if;
 result:=private.outreach_registration_config(c);if (result->>'waiver_required')::boolean and result->'waiver'='null'::jsonb then raise exception 'Registration unavailable';end if;return result;end $$;
-- Deliberately public read-only projection: no private-schema access is granted to guests.
create function public.outreach_registration_config(p_slug text) returns jsonb language sql security definer set search_path='' as $$select private.outreach_registration_public_config(p_slug)$$;
create function private.outreach_registration_coverage(c uuid,a uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.outreach_waiver_signatures w join public.outreach_event_attendees m on m.registration_id=w.registration_id and m.campaign_id=w.campaign_id
 where m.id=a and m.campaign_id=c and m.active and not exists(select 1 from public.outreach_waiver_corrections z where z.signature_id=w.id)
 and exists(select 1 from jsonb_array_elements(w.coverage_snapshot) t where t->>'id'=m.id::text and t->>'first_name'=m.first_name and t->>'last_name'=m.last_name and (t->>'age')::integer=m.age and t->>'relationship'=m.relationship and t->>'guardian_relationship'=m.guardian_relationship))
$$;
create function private.outreach_registration_answers(c uuid,answers jsonb) returns void language plpgsql security definer set search_path='' as $$
 declare s public.outreach_registration_settings;f jsonb;answer jsonb;begin
 select * into s from public.outreach_registration_settings where campaign_id=c;
 if jsonb_typeof(coalesce(answers,'{}'))<>'object' or exists(select 1 from jsonb_object_keys(coalesce(answers,'{}')) k where not exists(select 1 from jsonb_array_elements(s.extra_fields) mapped where mapped->>'id'=k)) then raise exception 'Extra field not configured';end if;
 for f in select value from jsonb_array_elements(s.extra_fields) loop
  answer:=coalesce(answers,'{}')->(f->>'id');
  if (f->>'required')::boolean and (answer is null or answer='null'::jsonb or answer='""'::jsonb) then raise exception 'Required mapped field missing';end if;
  if answer is not null and answer<>'null'::jsonb then
   if f->>'type'='boolean' and jsonb_typeof(answer)<>'boolean' or f->>'type' in ('text','choice') and jsonb_typeof(answer)<>'string' then raise exception 'Mapped field type invalid';end if;
   if f->>'type'='choice' and not coalesce((f->'options') ? (answer#>>'{}'),false) then raise exception 'Mapped choice invalid';end if;
   if f->>'type'='text' and length(answer#>>'{}')>500 then raise exception 'Mapped text too long';end if;
  end if;
 end loop;
end $$;
create function private.outreach_registration_attendee(c uuid,r uuid,p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
 declare s public.outreach_registration_settings; id uuid;old public.outreach_event_attendees;f jsonb;answer jsonb;begin
 select * into s from public.outreach_registration_settings where campaign_id=c;
 if exists(select 1 from jsonb_object_keys(p) k where k not in ('registration_id','client_key','first_name','last_name','age','relationship','guardian_relationship','attending','prize_participation','bike_interest','tablet_only','prize_choice','answers')) then raise exception 'Unknown attendee field';end if;
 if jsonb_typeof(p)<>'object' or (p->>'client_key') is null or jsonb_typeof(p->'age')<>'number' then raise exception 'Attendee identity and age required';end if;
 if p->>'prize_choice' is not null and not exists(select 1 from jsonb_array_elements(s.prize_choices) ch where ch->>'id'=p->>'prize_choice') then raise exception 'Prize choice not configured';end if;
 perform private.outreach_registration_answers(c,coalesce(p->'answers','{}'));
 select * into old from public.outreach_event_attendees where registration_id=r and client_key=(p->>'client_key')::uuid;
 if found then
  if old.first_name is distinct from btrim(p->>'first_name') or old.last_name is distinct from btrim(p->>'last_name') or old.age is distinct from (p->>'age')::integer or old.relationship is distinct from p->>'relationship' or old.guardian_relationship is distinct from coalesce(p->>'guardian_relationship','') or old.attending is distinct from coalesce((p->>'attending')::boolean,true) or old.prize_participation is distinct from coalesce((p->>'prize_participation')::boolean,false) or old.bike_interest is distinct from coalesce((p->>'bike_interest')::boolean,false) or old.tablet_only is distinct from coalesce((p->>'tablet_only')::boolean,false) or old.prize_choice is distinct from p->>'prize_choice' or old.answers is distinct from coalesce(p->'answers','{}') then raise exception 'Attendee retry changed';end if;return old.id;
 end if;
 if (select count(*) from public.outreach_event_attendees where registration_id=r and active)>=30 then raise exception 'Household attendee limit reached';end if;
 insert into public.outreach_event_attendees(campaign_id,registration_id,client_key,first_name,last_name,age,relationship,guardian_relationship,attending,prize_participation,bike_interest,tablet_only,prize_choice,answers)
 values(c,r,(p->>'client_key')::uuid,btrim(p->>'first_name'),btrim(p->>'last_name'),(p->>'age')::integer,p->>'relationship',coalesce(p->>'guardian_relationship',''),coalesce((p->>'attending')::boolean,true),coalesce((p->>'prize_participation')::boolean,false),coalesce((p->>'bike_interest')::boolean,false),coalesce((p->>'tablet_only')::boolean,false),p->>'prize_choice',coalesce(p->'answers','{}')) returning outreach_event_attendees.id into id;
 perform private.outreach_audit(c,(select organization_id from public.outreach_campaigns where outreach_campaigns.id=c),'attendee.added',id);perform private.outreach_event(c,'outreach.registration.updated',r,'attendee-added:'||id);
 return id;end $$;
create function private.outreach_registration_sign(c uuid,r uuid,p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
 declare w public.outreach_waiver_versions;old public.outreach_waiver_signatures;covered jsonb;sig uuid;begin
 select * into w from public.outreach_waiver_versions where campaign_id=c and id=(p->>'version_id')::uuid and effective_at<=now();
 if not found or (p->>'acknowledged')::boolean is distinct from true or (p->>'authority_acknowledged')::boolean is distinct from true or jsonb_typeof(p->'covered_keys')<>'array' then raise exception 'Waiver, acknowledgment and signer authority required';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'first_name',m.first_name,'last_name',m.last_name,'age',m.age,'relationship',m.relationship,'guardian_relationship',m.guardian_relationship) order by m.id),'[]') into covered from public.outreach_event_attendees m where m.campaign_id=c and m.registration_id=r and m.active and (p->'covered_keys') ? m.client_key::text;
 if jsonb_array_length(covered)=0 or jsonb_array_length(covered)<>jsonb_array_length(p->'covered_keys') then raise exception 'Explicit household coverage required';end if;
 if exists(select 1 from jsonb_array_elements(covered) m where (m->>'age')::int<18) and p->>'signer_relationship' not in ('parent','legal_guardian') then raise exception 'Minor requires parent or legal guardian';end if;
 select * into old from public.outreach_waiver_signatures where registration_id=r and request_key=(p->>'request_key')::uuid;
 if found then
  if old.version_id is distinct from w.id or old.signer_name is distinct from btrim(p->>'signer_name') or old.signer_relationship is distinct from p->>'signer_relationship' or old.coverage_snapshot is distinct from covered then raise exception 'Signature retry changed';end if;
  return old.id;
 end if;
 if w.id is distinct from (select id from public.outreach_waiver_versions where campaign_id=c and effective_at<=now() order by effective_at desc,version desc limit 1) then raise exception 'Current waiver version required';end if;
 if p->>'signer_relationship'='self' and (jsonb_array_length(covered)<>1 or lower(btrim(p->>'signer_name')) is distinct from lower((covered->0->>'first_name')||' '||(covered->0->>'last_name'))) then raise exception 'Self signature covers only the signer';end if;
 insert into public.outreach_waiver_signatures(campaign_id,registration_id,request_key,version_id,version,text_snapshot,signer_name,signer_relationship,authority_acknowledged,acknowledged,coverage_snapshot,recorded_by)
 values(c,r,(p->>'request_key')::uuid,w.id,w.version,w.text_snapshot,btrim(p->>'signer_name'),p->>'signer_relationship',true,true,covered,auth.uid()) returning id into sig;
 perform private.outreach_audit(c,(select organization_id from public.outreach_campaigns where id=c),'waiver.signed',sig,jsonb_build_object('covered_count',jsonb_array_length(covered),'version',w.version));
 perform private.outreach_event(c,'outreach.waiver.signed',sig,'waiver:'||sig);return sig;end $$;
create function private.outreach_registration_submit(c uuid,p jsonb,mode text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare s public.outreach_registration_settings;x public.outreach_campaigns;r public.outreach_event_registrations;v jsonb;a jsonb;key uuid;begin
 select * into x from public.outreach_campaigns where id=c for update;
 if not found then raise exception 'Registration unavailable';end if;
 select * into s from public.outreach_registration_settings where campaign_id=c;
 if not found or (mode='public' and not private.outreach_registration_open(c)) or x.status in ('closed','cancelled','completed','draft') then raise exception 'Registration unavailable';end if;
 if mode='walkup' and not private.outreach_registration_can(c,'registration.manage') then raise exception 'Registration access denied' using errcode='42501';end if;
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>60000 or jsonb_typeof(p->'attendees')<>'array' or jsonb_array_length(p->'attendees') not between 1 and 30 then raise exception 'Invalid household';end if;
 if exists(select 1 from jsonb_object_keys(p) k where k not in ('request_key','first_name','last_name','email','phone','address','attendees','consents','waiver')) then raise exception 'Unknown registration field';end if;
 key:=(p->>'request_key')::uuid;if key is null then raise exception 'Request key required';end if;
 select * into r from public.outreach_event_registrations where campaign_id=c and request_key=key;
 if found then if r.request_snapshot is distinct from p or r.source<>mode then raise exception 'Submission retry changed';end if;return jsonb_build_object('accepted',true,'reference',r.reference,'attendee_count',jsonb_array_length(p->'attendees'));end if;
 if s.address_required and length(btrim(coalesce(p->>'address','')))=0 then raise exception 'Address required';end if;
 if s.household_limit is not null and (select count(*) from public.outreach_event_registrations where campaign_id=c and status not in ('cancelled','closed'))>=s.household_limit then raise exception 'Registration capacity reached';end if;
 if jsonb_typeof(coalesce(p->'consents','{}'))<>'object' or exists(select 1 from jsonb_each(coalesce(p->'consents','{}')) z where z.key not in ('ministry_followup','communications','marketing','media') or jsonb_typeof(z.value)<>'boolean') then raise exception 'Separate explicit consent choices required';end if;
 insert into public.outreach_event_registrations(campaign_id,organization_id,request_key,request_snapshot,first_name,last_name,email,phone,address,source,consents)
 values(c,x.organization_id,key,p,btrim(p->>'first_name'),btrim(p->>'last_name'),lower(btrim(p->>'email')),btrim(p->>'phone'),coalesce(p->>'address',''),mode,coalesce(p->'consents','{}')) returning * into r;
 for a in select value from jsonb_array_elements(p->'attendees') loop perform private.outreach_registration_attendee(c,r.id,a);end loop;
 if (select count(*) from public.outreach_event_attendees where registration_id=r.id)<>jsonb_array_length(p->'attendees') then raise exception 'Duplicate attendee keys';end if;
 if p->'waiver' is not null and p->'waiver'<>'null'::jsonb then
  if exists(select 1 from jsonb_object_keys(p->'waiver') k where k not in ('request_key','version_id','signer_name','signer_relationship','acknowledged','authority_acknowledged','covered_keys')) then raise exception 'Unknown waiver field';end if;
  perform private.outreach_registration_sign(c,r.id,p->'waiver');end if;
 if s.waiver_required and exists(select 1 from public.outreach_event_attendees m where m.registration_id=r.id and m.attending and not private.outreach_registration_coverage(c,m.id)) then raise exception 'Required waiver must cover attending members';end if;
 perform private.outreach_audit(c,x.organization_id,'registration.submitted',r.id,jsonb_build_object('source',mode,'attendees',jsonb_array_length(p->'attendees')));
 perform private.outreach_event(c,'outreach.registration.submitted',r.id,'registration:'||r.id);
 if mode='walkup' then perform private.outreach_event(c,'outreach.walkup.registered',r.id,'walkup:'||r.id);end if;
 return jsonb_build_object('accepted',true,'reference',r.reference,'attendee_count',jsonb_array_length(p->'attendees'));end $$;
-- Server gateway alone may submit. Public RPC cannot be bypassed with an anon key.
create function private.outreach_registration_gateway(slug text,p jsonb,network text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare c uuid;n integer;begin
 if network !~ '^[a-f0-9]{64}$' or network is null then raise exception 'Verified ingress required';end if;
 select campaign_id into c from public.outreach_registration_settings where public_slug=slug;
 if c is null or not private.outreach_registration_open(c) then raise exception 'Registration unavailable';end if;
 insert into private.outreach_registration_rate values(c,network,date_trunc('hour',now()),1) on conflict(campaign_id,network_hash,bucket) do update set attempts=outreach_registration_rate.attempts+1 returning attempts into n;
 if n>120 then return jsonb_build_object('accepted',false,'reason','rate');end if;
 begin return private.outreach_registration_submit(c,p,'public');exception when others then return jsonb_build_object('accepted',false,'reason','invalid');end;end $$;
create function public.outreach_registration_gateway(p_slug text,p_payload jsonb,p_network text) returns jsonb language sql security invoker set search_path='' as $$select private.outreach_registration_gateway(p_slug,p_payload,p_network)$$;
create function private.outreach_registration_detail(c uuid,r uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(x)-'request_key'-'request_snapshot'-'household_id'||jsonb_build_object('attendees',(select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('waiver_covered',private.outreach_registration_coverage(c,m.id),'present_to_win',m.checked_in_at is not null and m.active and m.attending and m.prize_participation and (not s.waiver_required or private.outreach_registration_coverage(c,m.id)) and x.status not in ('cancelled','no_show','closed')) order by m.first_name),'[]') from public.outreach_event_attendees m where m.registration_id=x.id),
 'signatures',(select coalesce(jsonb_agg(to_jsonb(w)-'request_key'||jsonb_build_object('corrected',exists(select 1 from public.outreach_waiver_corrections z where z.signature_id=w.id)) order by w.signed_at),'[]') from public.outreach_waiver_signatures w where w.registration_id=x.id))
 from public.outreach_event_registrations x join public.outreach_registration_settings s on s.campaign_id=x.campaign_id where x.id=r and x.campaign_id=c
$$;
create function private.outreach_registration_workspace(action text,c uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
 declare x public.outreach_campaigns;s public.outreach_registration_settings;r public.outreach_event_registrations;m public.outreach_event_attendees;id uuid;row jsonb;result jsonb;cap text;csv text;begin
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>60000 then raise exception 'Invalid request';end if;
 if action='campaigns' then return coalesce((select jsonb_agg(jsonb_build_object('id',z.id,'name',z.name)) from public.outreach_campaigns z where private.outreach_registration_can(z.id,'registration.view')),'[]');end if;
 cap:=case when action in ('list','detail','context') then 'registration.view' when action='csv' then 'registration.export' when action in ('checkin','reverse') then 'checkin.manage' else 'registration.manage' end;
 if not private.outreach_registration_can(c,cap) then raise exception 'Registration access denied' using errcode='42501';end if;
 if action not in ('list','detail','context','csv') then perform 1 from public.outreach_campaigns where outreach_campaigns.id=c for update;
  if not private.outreach_registration_can(c,cap) then raise exception 'Registration access denied' using errcode='42501';end if;end if;
 select * into x from public.outreach_campaigns where outreach_campaigns.id=c;
 select * into s from public.outreach_registration_settings where campaign_id=c;
 if action='context' then return jsonb_build_object('name',x.name,'config',private.outreach_registration_config(c),'settings',case when private.outreach_admin(x.organization_id,true) then to_jsonb(s) else null end,'admin',private.outreach_admin(x.organization_id,true),'capabilities',(select jsonb_agg(k) from unnest(array['registration.view','registration.manage','registration.export','checkin.manage']) k where private.outreach_registration_can(c,k)));end if;
 if action='configure' then
  if not private.outreach_admin(x.organization_id,true) then raise exception 'Campaign administrator required' using errcode='42501';end if;
  if coalesce(s.revision,0) is distinct from (p->>'revision')::int then raise exception 'Configuration changed';end if;
  for row in select value from jsonb_array_elements(coalesce(p->'prize_choices','[]')) loop
   if (row->>'id' ~ '^[a-z0-9_-]{1,60}$') is distinct from true or length(coalesce(row->>'label','')) not between 1 and 100 or length(coalesce(row->>'guidance',''))>500 then raise exception 'Invalid prize choice';end if;end loop;
  for row in select value from jsonb_array_elements(coalesce(p->'extra_fields','[]')) loop
   if (row->>'id' ~ '^[a-z0-9_-]{1,60}$') is distinct from true or length(coalesce(row->>'label','')) not between 1 and 160 or (row->>'type' in ('text','boolean','choice')) is distinct from true or jsonb_typeof(row->'required') is distinct from 'boolean' or (row->>'type'='choice' and (jsonb_typeof(row->'options') is distinct from 'array' or jsonb_array_length(row->'options')=0)) then raise exception 'Invalid mapped field';end if;end loop;
  if (select count(*) from jsonb_array_elements(coalesce(p->'prize_choices','[]')))<>(select count(distinct z->>'id') from jsonb_array_elements(coalesce(p->'prize_choices','[]')) z) or (select count(*) from jsonb_array_elements(coalesce(p->'extra_fields','[]')))<>(select count(distinct z->>'id') from jsonb_array_elements(coalesce(p->'extra_fields','[]')) z) then raise exception 'Duplicate configured choices';end if;
  insert into public.outreach_registration_settings(campaign_id,public_slug,enabled,opens_at,closes_at,address_required,waiver_required,household_limit,instructions,prize_choices,extra_fields)
  values(c,p->>'public_slug',coalesce((p->>'enabled')::boolean,false),(p->>'opens_at')::timestamptz,(p->>'closes_at')::timestamptz,coalesce((p->>'address_required')::boolean,false),coalesce((p->>'waiver_required')::boolean,true),(p->>'household_limit')::int,coalesce(p->>'instructions',''),coalesce(p->'prize_choices','[]'),coalesce(p->'extra_fields','[]'))
  on conflict(campaign_id) do update set public_slug=excluded.public_slug,enabled=excluded.enabled,opens_at=excluded.opens_at,closes_at=excluded.closes_at,address_required=excluded.address_required,waiver_required=excluded.waiver_required,household_limit=excluded.household_limit,instructions=excluded.instructions,prize_choices=excluded.prize_choices,extra_fields=excluded.extra_fields,revision=outreach_registration_settings.revision+1;
  perform private.outreach_audit(c,x.organization_id,'registration.configured',c);return jsonb_build_object('saved',true);
 elsif action='waiver_publish' then
  if not private.outreach_admin(x.organization_id,true) then raise exception 'Campaign administrator required' using errcode='42501';end if;
  insert into public.outreach_waiver_versions(campaign_id,template_key,version,effective_at,text_snapshot,created_by) values(c,p->>'template_key',(p->>'version')::int,(p->>'effective_at')::timestamptz,p->>'text',auth.uid()) returning outreach_waiver_versions.id into id;
  perform private.outreach_audit(c,x.organization_id,'waiver.published',id);return jsonb_build_object('id',id);
 elsif action='access' then
  if not private.outreach_admin(x.organization_id,true) then raise exception 'Campaign administrator required' using errcode='42501';end if;
  if length(btrim(coalesce(p->>'reason','')))<10 then raise exception 'Review reason required';end if;
  if exists(select 1 from jsonb_array_elements_text(p->'capabilities') k where k not in ('registration.view','registration.manage','registration.export','checkin.manage')) then raise exception 'Only registration capabilities permitted';end if;
  update public.outreach_campaign_assignments set capabilities=array(select distinct k from unnest(capabilities||array(select jsonb_array_elements_text(p->'capabilities'))) k where k not in ('registration.view','registration.manage','registration.export','checkin.manage') or (p->'capabilities') ? k),revision=revision+1,reason=p->>'reason' where campaign_id=c and user_id=(p->>'user_id')::uuid and revision=(p->>'revision')::int;
  if not found then raise exception 'Assignment changed';end if;perform private.outreach_audit(c,x.organization_id,'registration.access_changed',(p->>'user_id')::uuid);return jsonb_build_object('saved',true);
 elsif action='walkup' then return private.outreach_registration_submit(c,p,'walkup');
 elsif action='list' then
  return jsonb_build_object('registrations',(select coalesce(jsonb_agg(jsonb_build_object('id',z.id,'reference',z.reference,'name',z.first_name||' '||z.last_name,'phone',z.phone,'email',z.email,'source',z.source,'status',z.status,'attendees',(select count(*) from public.outreach_event_attendees a where a.registration_id=z.id and a.active)) order by z.submitted_at desc),'[]') from public.outreach_event_registrations z where z.campaign_id=c and (coalesce(p->>'search','')='' or concat_ws(' ',z.reference,z.first_name,z.last_name,z.phone,z.email) ilike '%'||replace(replace(p->>'search','%','\%'),'_','\_')||'%')),
   'summary',(select jsonb_build_object('households',count(distinct z.id),'attendees',count(a.id) filter(where a.active),'adults',count(a.id) filter(where a.active and a.age>=18),'minors',count(a.id) filter(where a.active and a.age<18),'waivers_complete',count(a.id) filter(where a.active and private.outreach_registration_coverage(c,a.id)),'waivers_missing',count(a.id) filter(where a.active and not private.outreach_registration_coverage(c,a.id)),'checked_in',count(a.id) filter(where a.active and a.checked_in_at is not null),'not_checked_in',count(a.id) filter(where a.active and a.checked_in_at is null),'walkups',count(distinct z.id) filter(where z.source='walkup'),'cancelled',count(distinct z.id) filter(where z.status='cancelled'),'no_show',count(distinct z.id) filter(where z.status='no_show')) from public.outreach_event_registrations z left join public.outreach_event_attendees a on a.registration_id=z.id where z.campaign_id=c));
 elsif action='csv' then
  csv:='Reference,Primary,Attendee,Age,Adult/Minor,Guardian Relationship,Phone,Email,Waiver,Check-In,Source,Prize Preference'||E'\r\n';
  for row in select jsonb_build_array(z.reference,z.first_name||' '||z.last_name,a.first_name||' '||a.last_name,a.age::text,case when a.age<18 then 'Minor' else 'Adult' end,a.guardian_relationship,z.phone,z.email,case when private.outreach_registration_coverage(c,a.id) then 'Covered' else 'Missing' end,case when a.checked_in_at is null then 'Not checked in' else 'Checked in' end,z.source,coalesce(a.prize_choice,'')) from public.outreach_event_registrations z join public.outreach_event_attendees a on a.registration_id=z.id where z.campaign_id=c and a.active loop
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
  update public.outreach_event_registrations set first_name=coalesce(p->>'first_name',first_name),last_name=coalesce(p->>'last_name',last_name),email=coalesce(p->>'email',email),phone=coalesce(p->>'phone',phone),address=coalesce(p->>'address',address),notes=coalesce(p->>'notes',notes),status=case when exists(select 1 from public.outreach_event_attendees where registration_id=r.id and checked_in_at is not null) then 'checked_in' else coalesce(p->>'status',status) end,revision=revision+1 where outreach_event_registrations.id=r.id;
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
create function public.outreach_registration_workspace(p_action text,p_campaign uuid default null,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.outreach_registration_workspace(p_action,p_campaign,p_payload)$$;
do $$declare n text;begin foreach n in array array['outreach_registration_settings','outreach_waiver_versions','outreach_event_registrations','outreach_event_attendees','outreach_waiver_signatures','outreach_waiver_corrections'] loop
 execute format('alter table public.%I enable row level security',n);execute format('revoke all on public.%I from public,anon,authenticated',n);execute format('grant all on public.%I to service_role',n);end loop;end $$;
revoke all on function private.outreach_registration_answers(uuid,jsonb),private.outreach_registration_can(uuid,text),private.outreach_registration_open(uuid),private.outreach_registration_config(uuid),private.outreach_registration_public_config(text),private.outreach_registration_coverage(uuid,uuid),private.outreach_registration_attendee(uuid,uuid,jsonb),private.outreach_registration_sign(uuid,uuid,jsonb),private.outreach_registration_submit(uuid,jsonb,text),private.outreach_registration_gateway(text,jsonb,text),private.outreach_registration_detail(uuid,uuid),private.outreach_registration_workspace(text,uuid,jsonb),public.outreach_registration_config(text),public.outreach_registration_gateway(text,jsonb,text),public.outreach_registration_workspace(text,uuid,jsonb) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function public.outreach_registration_config(text) to anon,authenticated;
grant execute on function private.outreach_registration_workspace(text,uuid,jsonb),public.outreach_registration_workspace(text,uuid,jsonb) to authenticated;
grant execute on function private.outreach_registration_gateway(text,jsonb,text),public.outreach_registration_gateway(text,jsonb,text) to service_role;
