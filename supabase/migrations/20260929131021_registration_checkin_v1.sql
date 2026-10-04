-- Reusable Registration + Check-in. Only forward application to isolated acceptance is authorized.
alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;
alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check(permission=any(array['people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage','staff.view','staff.manage','finance.read','finance.configure','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage','events.view','events.manage','registrations.view','registrations.manage','outreach.view','outreach.manage','courses.manage','forms.view','forms.manage','communications.send','checkin.view','checkin.manage','registrations.restricted','registrations.override']::text[]));
create or replace function private.staff_permission_keys() returns text[] language sql immutable set search_path='' as $$ select array['people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage','staff.view','staff.manage','finance.read','finance.configure','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage','events.view','events.manage','registrations.view','registrations.manage','outreach.view','outreach.manage','courses.manage','forms.view','forms.manage','communications.send','checkin.view','checkin.manage','registrations.restricted','registrations.override']::text[] $$;
alter table public.event_series drop constraint event_series_registration_mode_check;
alter table public.event_series add constraint event_series_registration_mode_check check(registration_mode in ('none','external','native_future','native'));

alter table public.event_occurrences add constraint event_occurrences_series_identity unique(series_id,id);

create table public.event_registration_settings (
 series_id uuid primary key, organization_id uuid not null, enabled boolean not null default false,
 scope text not null default 'occurrence' check(scope in ('occurrence','series')),
 max_attendees integer not null default 10 check(max_attendees between 1 and 30), next_steps text not null default '' check(length(next_steps)<=2000),
 revision integer not null default 1, foreign key(organization_id,series_id) references public.event_series(organization_id,id)
);
create table public.event_registration_questions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, series_id uuid not null,
 label text not null check(length(trim(label)) between 1 and 200), help_text text not null default '' check(length(help_text)<=1000),
 kind text not null check(kind in ('short_text','long_text','email','phone','number','select','multi_select','yes_no','consent','date')),
 scope text not null check(scope in ('registrant','attendee')), sensitivity text not null default 'general' check(sensitivity in ('general','restricted')),
 required boolean not null default false, active boolean not null default true, display_order integer not null default 0,
 options jsonb not null default '[]' check(jsonb_typeof(options)='array' and jsonb_array_length(options)<=30), revision integer not null default 1,
 unique(organization_id,id), foreign key(organization_id,series_id) references public.event_series(organization_id,id)
);
create index registration_questions_series on public.event_registration_questions(series_id,display_order);
create table public.event_registrations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, series_id uuid not null, occurrence_id uuid,
 scope text not null check(scope in ('occurrence','series')), request_key uuid not null, request_hash text not null,
 reference text not null unique default ('R-'||replace(gen_random_uuid()::text,'-','')),
 registrant_first_name text not null check(length(trim(registrant_first_name)) between 1 and 100), registrant_last_name text not null check(length(trim(registrant_last_name)) between 1 and 100),
 email text not null default '' check(length(email)<=254), phone text not null default '' check(length(phone)<=40),
 person_id uuid, portal_user_id uuid references auth.users(id),
 status text not null default 'confirmed' check(status in ('pending','confirmed','cancelled','expired','waitlisted_future')),
 payment_status text not null default 'not_required' check(payment_status in ('not_required','pending','authorized','paid','failed','refunded','partially_refunded_future')),
 payment_intent_reference text, payment_destination_id uuid,
 origin text not null default 'public' check(origin in ('public','walk_in')), revision integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,id), unique(organization_id,request_key),
 foreign key(organization_id,series_id) references public.event_series(organization_id,id),
 foreign key(organization_id,occurrence_id) references public.event_occurrences(organization_id,id),
 foreign key(series_id,occurrence_id) references public.event_occurrences(series_id,id),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),
 foreign key(organization_id,payment_destination_id) references public.giving_destinations(organization_id,id),
 check((scope='series' and occurrence_id is null) or (scope='occurrence' and occurrence_id is not null))
);
create index registrations_bucket on public.event_registrations(series_id,occurrence_id,status);
create index registrations_person on public.event_registrations(organization_id,person_id);
create table public.event_registration_attendees (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, registration_id uuid not null,
 first_name text not null check(length(trim(first_name)) between 1 and 100), last_name text not null check(length(trim(last_name)) between 1 and 100),
 person_id uuid, is_registrant boolean not null default false, guardian_attendee_id uuid,
 unique(organization_id,id), foreign key(organization_id,registration_id) references public.event_registrations(organization_id,id),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),
 foreign key(organization_id,guardian_attendee_id) references public.event_registration_attendees(organization_id,id)
);
create index registration_attendees_registration on public.event_registration_attendees(registration_id);
create index registration_attendees_person on public.event_registration_attendees(organization_id,person_id);
create table public.event_registration_answers (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, registration_id uuid not null, attendee_id uuid, question_id uuid not null,
 value jsonb not null, restricted boolean not null, revision integer not null default 1,
 unique nulls not distinct(registration_id,attendee_id,question_id),
 foreign key(organization_id,registration_id) references public.event_registrations(organization_id,id),
 foreign key(organization_id,attendee_id) references public.event_registration_attendees(organization_id,id),
 foreign key(organization_id,question_id) references public.event_registration_questions(organization_id,id)
);
create index registration_answers_question on public.event_registration_answers(question_id);
create table public.event_attendance (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, attendee_id uuid not null, occurrence_id uuid not null,
 checked_in_at timestamptz not null default now(), checked_in_by uuid not null references auth.users(id),
 method text not null check(method in ('staff','walk_in')), note text not null default '' check(length(note)<=500),
 reversed_at timestamptz, reversed_by uuid references auth.users(id), revision integer not null default 1,
 unique(attendee_id,occurrence_id), foreign key(organization_id,attendee_id) references public.event_registration_attendees(organization_id,id),
 foreign key(organization_id,occurrence_id) references public.event_occurrences(organization_id,id)
);
create index attendance_occurrence on public.event_attendance(organization_id,occurrence_id);
create table public.registration_audit (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, series_id uuid not null, registration_id uuid,
 actor_user_id uuid references auth.users(id), action text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now(),
 foreign key(organization_id,series_id) references public.event_series(organization_id,id),
 foreign key(organization_id,registration_id) references public.event_registrations(organization_id,id)
);
create index registration_audit_history on public.registration_audit(registration_id,created_at);

-- Internal helpers have no client execution. RPCs serialize on the SAME lock as Events writes.
create function private.registration_permission(s public.event_series,k text) returns boolean language sql stable set search_path='' as $$
 select private.has_staff_permission(s.organization_id,k,s.department_id)
$$;
create function private.registration_used(p_series uuid,p_occurrence uuid,p_scope text) returns integer language sql stable set search_path='' as $$
 select count(*)::integer from public.event_registration_attendees a join public.event_registrations r on r.id=a.registration_id
 where r.series_id=p_series and r.status in ('pending','confirmed') and (p_scope='series' or r.occurrence_id=p_occurrence)
$$;
create function private.registration_answer_valid(q public.event_registration_questions,v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare t text:=v#>>'{}';
begin
 if v is null or v='null'::jsonb or v='""'::jsonb or v='[]'::jsonb then return not q.required; end if;
 if octet_length(v::text)>9000 then return false; end if;
 case q.kind
 when 'short_text' then return jsonb_typeof(v)='string' and length(t)<=500;
 when 'long_text' then return jsonb_typeof(v)='string' and length(t)<=8000;
 when 'email' then return jsonb_typeof(v)='string' and length(t)<=254 and t~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
 when 'phone' then return jsonb_typeof(v)='string' and length(t)<=40 and t~'^[+0-9() .-]+$';
 when 'number' then return jsonb_typeof(v)='number' and abs(t::numeric)<=1000000000;
 when 'select' then return jsonb_typeof(v)='string' and q.options ? t;
 when 'multi_select' then return jsonb_typeof(v)='array' and jsonb_array_length(v)<=30 and v <@ q.options;
 when 'yes_no' then return jsonb_typeof(v)='boolean';
 when 'consent' then return jsonb_typeof(v)='boolean' and (not q.required or v='true'::jsonb);
 when 'date' then
  if jsonb_typeof(v)<>'string' or t!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
  return t::date between date '1900-01-01' and date '2100-12-31';
 else return false; end case;
 exception when others then return false;
end $$;
create function private.registration_answers(p_registration uuid,p_attendee uuid,p_answers jsonb) returns void language plpgsql set search_path='' as $$
declare r public.event_registrations; q public.event_registration_questions; v jsonb; sc text:=case when p_attendee is null then 'registrant' else 'attendee' end;
begin
 select * into strict r from public.event_registrations where id=p_registration;
 if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'Answers must be an object'; end if;
 if exists(select 1 from jsonb_object_keys(p_answers) k where not exists(select 1 from public.event_registration_questions x where x.id::text=k and x.series_id=r.series_id and x.active and x.scope=sc)) then raise exception 'Unknown question'; end if;
 for q in select * from public.event_registration_questions where series_id=r.series_id and active and scope=sc loop
  v:=p_answers->q.id::text;
  if not private.registration_answer_valid(q,v) then raise exception 'Answer required or invalid: %',q.label; end if;
  if v is not null then insert into public.event_registration_answers(organization_id,registration_id,attendee_id,question_id,value,restricted) values(r.organization_id,r.id,p_attendee,q.id,v,q.sensitivity='restricted'); end if;
 end loop;
end $$;
create function private.registration_confirmation(r public.event_registrations) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('reference',r.reference,'status',r.status,'scope',r.scope,'event',s.title,'timezone',s.timezone,
 'starts_at',case when r.occurrence_id is not null then (select starts_at from private.event_schedule where id=r.occurrence_id) else s.local_start at time zone s.timezone end,
 'next_steps',coalesce(c.next_steps,''),'attendees',(select jsonb_agg(jsonb_build_object('first_name',a.first_name,'last_name',a.last_name) order by a.id) from public.event_registration_attendees a where a.registration_id=r.id))
 from public.event_series s left join public.event_registration_settings c on c.series_id=s.id where s.id=r.series_id
$$;

create function private.registration_public(p_slug text,p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid; s public.event_series; c public.event_registration_settings; o record; r public.event_registrations; a jsonb; attendee uuid;
 used integer; n integer; fingerprint text; linked uuid; portal uuid; self_count integer:=0;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>100000 then raise exception 'Invalid registration payload'; end if;
 select id into org from public.organizations where slug=p_slug;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('events:'||org::text,0));
 select * into s from public.event_series where id=(p_data->>'series_id')::uuid and organization_id=org;
 if s.id is null or s.status<>'published' or not(s.visibility='public' or (s.visibility='member' and private.event_member(org)) or (s.visibility in ('staff','hidden') and (private.registration_permission(s,'events.view') or private.registration_permission(s,'events.manage')))) then raise exception 'Registration unavailable' using errcode='42501'; end if;
 select * into c from public.event_registration_settings where series_id=s.id;
 if s.registration_mode<>'native' or c.series_id is null or not c.enabled then raise exception 'Native registration unavailable'; end if;
 if p_action is null or p_action not in ('form','submit') then raise exception 'Unsupported public action'; end if;
 if p_data-array['series_id','occurrence_id','request_key','registrant','attendees','answers','form_revision','event_revision']<>'{}'::jsonb then raise exception 'Unsupported registration fields'; end if;
 if c.scope='occurrence' then
  select * into o from private.event_schedule where id=(p_data->>'occurrence_id')::uuid and series_id=s.id and retained and not cancelled;
  if o.id is null then raise exception 'Occurrence unavailable'; end if;
 elsif p_data->>'occurrence_id' is not null and p_action='submit' then raise exception 'This event uses series enrollment'; end if;
 used:=private.registration_used(s.id,(p_data->>'occurrence_id')::uuid,c.scope);
 if p_action='form' then
  return jsonb_build_object('title',s.title,'scope',c.scope,'timezone',s.timezone,'capacity',s.capacity,'remaining',case when s.capacity is null then null else greatest(0,s.capacity-used) end,
   'available',(case when c.scope='occurrence' then o.ends_at>now() else exists(select 1 from private.event_schedule where series_id=s.id and retained and not cancelled and ends_at>now()) end) and not s.payment_required and (s.registration_opens is null or s.registration_opens<=now()) and (s.registration_closes is null or s.registration_closes>now()) and (s.capacity is null or used<s.capacity),
   'payment_required',s.payment_required,'opens',s.registration_opens,'closes',s.registration_closes,'revision',c.revision,'event_revision',s.revision,'max_attendees',c.max_attendees,
   'questions',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'label',q.label,'help_text',q.help_text,'kind',q.kind,'scope',q.scope,'required',q.required,'options',q.options) order by q.display_order,q.id),'[]') from public.event_registration_questions q where q.series_id=s.id and q.active));
 end if;
 fingerprint:=encode(sha256(convert_to(p_data::text,'UTF8')),'hex');
 if p_data->>'request_key' is null then raise exception 'Request key required'; end if;
 select * into r from public.event_registrations where organization_id=org and request_key=(p_data->>'request_key')::uuid;
 if r.id is not null then
  if r.request_hash<>fingerprint or r.series_id<>s.id or r.portal_user_id is distinct from auth.uid() then raise exception 'Request key already used'; end if;
  return private.registration_confirmation(r);
 end if;
 if s.payment_required then raise exception 'Registration unavailable: payment processing is not enabled'; end if;
 if (s.registration_opens is not null and s.registration_opens>now()) or (s.registration_closes is not null and s.registration_closes<=now()) then raise exception 'Registration is closed'; end if;
 if c.scope='occurrence' and o.ends_at<=now() then raise exception 'Occurrence has ended'; end if;
 if c.scope='series' and not exists(select 1 from private.event_schedule where series_id=s.id and retained and not cancelled and ends_at>now()) then raise exception 'No upcoming series dates available'; end if;
 if (p_data->>'form_revision')::int is distinct from c.revision or (p_data->>'event_revision')::int is distinct from s.revision then raise exception 'Registration form changed; reload before submitting'; end if;
 if jsonb_typeof(p_data->'registrant') is distinct from 'object' or (p_data->'registrant')-array['first_name','last_name','email','phone']<>'{}'::jsonb then raise exception 'Invalid registrant'; end if;
 if coalesce(p_data#>>'{registrant,email}','')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and coalesce(p_data#>>'{registrant,phone}','')!~'^[+0-9() .-]{5,40}$' then raise exception 'A contact email or phone is required'; end if;
 if jsonb_typeof(p_data->'attendees') is distinct from 'array' then raise exception 'Attendees required'; end if;
 n:=jsonb_array_length(p_data->'attendees');
 if n<1 or n>c.max_attendees then raise exception 'Attendee count exceeds form limit'; end if;
 if s.capacity is not null and used+n>s.capacity then raise exception 'Not enough remaining places'; end if;
 select l.person_id,l.user_id into linked,portal from public.portal_account_links l join auth.users u on u.id=l.user_id where l.organization_id=org and l.user_id=auth.uid() and l.active and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false);
 insert into public.event_registrations(organization_id,series_id,occurrence_id,scope,request_key,request_hash,registrant_first_name,registrant_last_name,email,phone,person_id,portal_user_id)
 values(org,s.id,(p_data->>'occurrence_id')::uuid,c.scope,(p_data->>'request_key')::uuid,fingerprint,trim(p_data#>>'{registrant,first_name}'),trim(p_data#>>'{registrant,last_name}'),coalesce(p_data#>>'{registrant,email}',''),coalesce(p_data#>>'{registrant,phone}',''),linked,auth.uid()) returning * into r;
 perform private.registration_answers(r.id,null,coalesce(p_data->'answers','{}'));
 for a in select value from jsonb_array_elements(p_data->'attendees') loop
  if jsonb_typeof(a)<>'object' or a-array['first_name','last_name','is_registrant','answers']<>'{}'::jsonb then raise exception 'Invalid attendee'; end if;
  if coalesce((a->>'is_registrant')::boolean,false) then
   self_count:=self_count+1;
   if self_count>1 or a->>'first_name' is distinct from p_data#>>'{registrant,first_name}' or a->>'last_name' is distinct from p_data#>>'{registrant,last_name}' then raise exception 'Registrant attendee must match registrant'; end if;
  end if;
  insert into public.event_registration_attendees(organization_id,registration_id,first_name,last_name,is_registrant,person_id)
  values(org,r.id,trim(a->>'first_name'),trim(a->>'last_name'),coalesce((a->>'is_registrant')::boolean,false),case when (a->>'is_registrant')::boolean then linked end) returning id into attendee;
  perform private.registration_answers(r.id,attendee,coalesce(a->'answers','{}'));
 end loop;
 insert into public.registration_audit(organization_id,series_id,registration_id,actor_user_id,action) values(org,s.id,r.id,auth.uid(),'created');
 return private.registration_confirmation(r);
end $$;

-- Trusted reconciliation is explicit and reuses People authorization and its existing audit trigger.
create function private.registration_person(p_org uuid,p_data jsonb) returns uuid language plpgsql set search_path='' as $$
declare person uuid:=(p_data->>'person_id')::uuid;
begin
 if person is not null then
  if not private.person_permission(p_org,person,'people.read') then raise exception 'Contact scope denied' using errcode='42501'; end if;
  return person;
 end if;
 if not coalesce((p_data->>'create_person')::boolean,false) then return null; end if;
 if not(private.has_staff_permission(p_org,'people.read') and private.has_staff_permission(p_org,'people.create')) then raise exception 'Contact creation permission required' using errcode='42501'; end if;
 -- Same lock covers all module contact creation; existing People inserts may still require later human reconciliation.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('registration-people:'||p_org::text,0));
 if exists(select 1 from public.organization_people p where p.organization_id=p_org and
 ((lower(p.first_name)=lower(trim(p_data->>'first_name')) and lower(p.last_name)=lower(trim(p_data->>'last_name')))
 or (nullif(p_data->>'email','') is not null and lower(p.email)=lower(p_data->>'email'))
 or (nullif(p_data->>'phone','') is not null and p.phone=p_data->>'phone'))) then raise exception 'Possible existing contact; review People and explicitly link the correct contact'; end if;
 insert into public.organization_people(organization_id,first_name,last_name,email,phone) values(p_org,p_data->>'first_name',p_data->>'last_name',nullif(p_data->>'email',''),nullif(p_data->>'phone','')) returning id into person;
 return person;
end $$;

create function private.registrations_workspace(p_org uuid,p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare s public.event_series; c public.event_registration_settings; r public.event_registrations; q public.event_registration_questions;
 old_q public.event_registration_questions; ans public.event_registration_answers; a public.event_registration_attendees; o record;
 can_read boolean; can_manage boolean; can_check boolean; can_restricted boolean; target uuid; person uuid; v jsonb; row_data jsonb;
 used integer; n integer; occ uuid:=(p_data->>'occurrence_id')::uuid; attendee uuid; rev integer; fingerprint text;
begin
 if auth.uid() is null then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>100000 then raise exception 'Invalid staff payload'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('events:'||p_org::text,0));
 if p_action='events' then
  return (select coalesce(jsonb_agg(to_jsonb(t) order by t.local_start),'[]') from (select id,title,local_start,timezone,status from public.event_series s where organization_id=p_org and
   (private.registration_permission(s,'registrations.view') or private.registration_permission(s,'registrations.manage') or private.registration_permission(s,'checkin.view') or private.registration_permission(s,'checkin.manage')) order by local_start,id limit 101 offset greatest(0,least(10000,coalesce((p_data->>'page')::int,0)))*100)t);
 end if;
 select * into s from public.event_series where organization_id=p_org and id=(p_data->>'series_id')::uuid for update;
 can_manage:=private.registration_permission(s,'registrations.manage'); can_check:=private.registration_permission(s,'checkin.manage');
 can_read:=can_manage or private.registration_permission(s,'registrations.view'); can_restricted:=can_read and private.registration_permission(s,'registrations.restricted');
 if s.id is null or not coalesce(can_read or can_check or private.registration_permission(s,'checkin.view'),false) then raise exception 'Registration scope denied' using errcode='42501'; end if;
 select * into c from public.event_registration_settings where series_id=s.id;
 if occ is not null then
  select * into o from private.event_schedule where id=occ and series_id=s.id;
  if o.id is null then raise exception 'Wrong occurrence' using errcode='42501'; end if;
 end if;
 if p_action='context' then
  if p_data->>'from' is not null then
   perform private.event_materialize(s.id,(p_data->>'from')::date,(p_data->>'to')::date);
  end if;
  return jsonb_build_object('event',jsonb_build_object('id',s.id,'title',s.title,'timezone',s.timezone,'capacity',s.capacity,'payment_required',s.payment_required,'registration_mode',s.registration_mode),
   'settings',case when c.series_id is null then jsonb_build_object('revision',0,'enabled',false,'scope','occurrence','max_attendees',10,'next_steps','') else to_jsonb(c) end,
   'can_manage',can_manage,'can_checkin',can_check,'can_restricted',can_restricted,'can_override',can_manage and private.registration_permission(s,'registrations.override'),
   'can_create_person',private.has_staff_permission(p_org,'people.read') and private.has_staff_permission(p_org,'people.create'),
   'questions',case when can_manage then (select coalesce(jsonb_agg(to_jsonb(x) order by x.display_order,x.id),'[]') from public.event_registration_questions x where series_id=s.id) else '[]'::jsonb end,
   'occurrences',(select coalesce(jsonb_agg(to_jsonb(t) order by t.starts_at),'[]') from (select id,starts_at,ends_at,cancelled,retained from private.event_schedule where series_id=s.id and starts_at>coalesce((p_data->>'from')::date,current_date-31) order by starts_at limit 400)t));
 end if;
 if p_action='settings' then
  if not can_manage then raise exception 'Registration management required' using errcode='42501'; end if;
  if p_data-array['series_id','revision','enabled','scope','max_attendees','next_steps']<>'{}'::jsonb then raise exception 'Unsupported settings'; end if;
  if coalesce(c.revision,0)<>coalesce((p_data->>'revision')::int,-1) then raise exception 'Stale settings'; end if;
  if c.scope is distinct from p_data->>'scope' and exists(select 1 from public.event_registrations where series_id=s.id) then raise exception 'Registration scope cannot change after enrollment'; end if;
  insert into public.event_registration_settings(series_id,organization_id,enabled,scope,max_attendees,next_steps,revision)
  values(s.id,p_org,coalesce((p_data->>'enabled')::boolean,false),p_data->>'scope',(p_data->>'max_attendees')::int,coalesce(p_data->>'next_steps',''),coalesce(c.revision,0)+1)
  on conflict(series_id) do update set enabled=excluded.enabled,scope=excluded.scope,max_attendees=excluded.max_attendees,next_steps=excluded.next_steps,revision=excluded.revision;
  insert into public.registration_audit(organization_id,series_id,actor_user_id,action) values(p_org,s.id,auth.uid(),'settings_changed');return jsonb_build_object('saved',true);
 end if;
 if p_action='question' then
  if not can_manage then raise exception 'Registration management required' using errcode='42501'; end if;
  if p_data-array['series_id','id','revision','label','help_text','kind','scope','sensitivity','required','active','display_order','options']<>'{}'::jsonb then raise exception 'Unsupported question fields'; end if;
  if c.series_id is null then raise exception 'Save registration settings first'; end if;
  select * into old_q from public.event_registration_questions where id=(p_data->>'id')::uuid and series_id=s.id;
  if (p_data->>'id' is not null and old_q.id is null) or coalesce(old_q.revision,0)<>coalesce((p_data->>'revision')::int,0) then raise exception 'Stale question'; end if;
  if old_q.id is null and (select count(*) from public.event_registration_questions where series_id=s.id)>=60 then raise exception 'Question limit reached'; end if;
  q:=jsonb_populate_record(old_q,p_data-array['series_id','id','revision']);
  if jsonb_typeof(q.options) is distinct from 'array' or exists(select 1 from jsonb_array_elements(q.options)x where jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 1 and 200) then raise exception 'Invalid choices'; end if;
  if q.kind in ('select','multi_select') and jsonb_array_length(q.options)=0 then raise exception 'Choices required'; end if;
  if old_q.id is not null and exists(select 1 from public.event_registration_answers where question_id=old_q.id) and (q.kind,q.scope,q.sensitivity,q.options) is distinct from (old_q.kind,old_q.scope,old_q.sensitivity,old_q.options) then raise exception 'Answered question type, scope, privacy and choices are immutable; deactivate and replace'; end if;
  insert into public.event_registration_questions(id,organization_id,series_id,label,help_text,kind,scope,sensitivity,required,active,display_order,options,revision)
  values(coalesce(old_q.id,gen_random_uuid()),p_org,s.id,q.label,coalesce(q.help_text,''),q.kind,q.scope,coalesce(q.sensitivity,'general'),coalesce(q.required,false),coalesce(q.active,true),coalesce(q.display_order,0),q.options,coalesce(old_q.revision,0)+1)
  on conflict(id) do update set label=excluded.label,help_text=excluded.help_text,kind=excluded.kind,scope=excluded.scope,sensitivity=excluded.sensitivity,required=excluded.required,active=excluded.active,display_order=excluded.display_order,options=excluded.options,revision=excluded.revision;
  update public.event_registration_settings set revision=revision+1 where series_id=s.id;
  insert into public.registration_audit(organization_id,series_id,actor_user_id,action) values(p_org,s.id,auth.uid(),'question_changed');return jsonb_build_object('saved',true);
 end if;
 if p_action='list' then
  if c.scope='occurrence' and occ is null then raise exception 'Choose an occurrence'; end if;
  used:=private.registration_used(s.id,occ,coalesce(c.scope,'occurrence'));
  return jsonb_build_object('capacity',s.capacity,'used',used,'remaining',case when s.capacity is null then null else greatest(0,s.capacity-used) end,
   'summary',(select jsonb_build_object('registrations',count(*),'cancelled',count(*) filter(where status='cancelled'),'confirmed',count(*) filter(where status='confirmed'),'payment_not_required',count(*) filter(where payment_status='not_required'),'payment_pending',count(*) filter(where payment_status='pending')) from public.event_registrations where series_id=s.id and (scope='series' or occurrence_id=occ)),
   'checked_in',(select count(*) from public.event_attendance atd join public.event_registration_attendees a on a.id=atd.attendee_id join public.event_registrations r on r.id=a.registration_id where r.series_id=s.id and atd.occurrence_id=occ and atd.reversed_at is null),
   'registrations',(select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id),'[]') from
    (select r.id,r.reference,r.registrant_first_name,r.registrant_last_name,r.phone,r.status,r.payment_status,r.scope,r.revision,r.created_at,
     (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'first_name',a.first_name,'last_name',a.last_name,'checked_in',exists(select 1 from public.event_attendance x where x.attendee_id=a.id and x.occurrence_id=occ and x.reversed_at is null)) order by a.id),'[]') from public.event_registration_attendees a where a.registration_id=r.id) attendees
    from public.event_registrations r where r.series_id=s.id and (r.scope='series' or r.occurrence_id=occ)
     and (nullif(p_data->>'status','') is null or r.status=p_data->>'status')
     and (nullif(p_data->>'search','') is null or concat_ws(' ',r.registrant_first_name,r.registrant_last_name,r.phone,r.reference) ilike '%'||left(p_data->>'search',100)||'%' or exists(select 1 from public.event_registration_attendees a where a.registration_id=r.id and concat_ws(' ',a.first_name,a.last_name) ilike '%'||left(p_data->>'search',100)||'%'))
    order by r.created_at desc,r.id limit 51 offset greatest(0,least(10000,coalesce((p_data->>'page')::int,0)))*50)t));
 end if;
 if p_action='walk_in' then
  if not can_check or not can_manage then raise exception 'Check-in and registration management required' using errcode='42501'; end if;
  if p_data-array['series_id','occurrence_id','request_key','first_name','last_name','email','phone','person_id','create_person','override','override_reason','answers','attendee_answers']<>'{}'::jsonb then raise exception 'Unsupported walk-in fields'; end if;
  if occ is null or not o.retained or o.cancelled or s.status in ('cancelled','archived') then raise exception 'Occurrence unavailable'; end if;
  if s.payment_required then raise exception 'Payment processing is not enabled'; end if;

  fingerprint:=encode(sha256(convert_to(p_data::text,'UTF8')),'hex');
  select * into r from public.event_registrations where organization_id=p_org and request_key=(p_data->>'request_key')::uuid;
  if r.id is not null then
   if r.request_hash<>fingerprint or r.series_id<>s.id then raise exception 'Request key already used'; end if;
   return jsonb_build_object('id',r.id);
  end if;
  used:=private.registration_used(s.id,occ,coalesce(c.scope,'occurrence'));
  if s.capacity is not null and used+1>s.capacity then
   if not coalesce((p_data->>'override')::boolean,false) or not private.registration_permission(s,'registrations.override') or length(trim(coalesce(p_data->>'override_reason','')))<5 then raise exception 'Capacity full; explicit override permission and reason required' using errcode='42501'; end if;
  end if;
  person:=private.registration_person(p_org,p_data);
  if person is null then raise exception 'Walk-in requires a reviewed contact or authorized contact creation'; end if;
  if exists(select 1 from public.event_registration_attendees a join public.event_registrations r on r.id=a.registration_id where a.person_id=person and r.series_id=s.id and r.status in ('pending','confirmed') and (r.scope='series' or r.occurrence_id=occ)) then raise exception 'Contact already registered; check in existing attendee'; end if;
  insert into public.event_registrations(organization_id,series_id,occurrence_id,scope,request_key,request_hash,registrant_first_name,registrant_last_name,email,phone,person_id,origin)
  values(p_org,s.id,case when c.scope='series' then null else occ end,coalesce(c.scope,'occurrence'),(p_data->>'request_key')::uuid,fingerprint,p_data->>'first_name',p_data->>'last_name',coalesce(p_data->>'email',''),coalesce(p_data->>'phone',''),person,'walk_in') returning * into r;
  insert into public.event_registration_attendees(organization_id,registration_id,first_name,last_name,person_id,is_registrant) values(p_org,r.id,r.registrant_first_name,r.registrant_last_name,person,true) returning id into attendee;
  perform private.registration_answers(r.id,null,coalesce(p_data->'answers','{}'));
  perform private.registration_answers(r.id,attendee,coalesce(p_data->'attendee_answers','{}'));
  insert into public.event_attendance(organization_id,attendee_id,occurrence_id,checked_in_by,method) values(p_org,attendee,occ,auth.uid(),'walk_in');
  insert into public.registration_audit(organization_id,series_id,registration_id,actor_user_id,action,metadata) values(p_org,s.id,r.id,auth.uid(),'walk_in',jsonb_build_object('occurrence_id',occ));
  if s.capacity is not null and used+1>s.capacity then insert into public.registration_audit(organization_id,series_id,registration_id,actor_user_id,action,metadata) values(p_org,s.id,r.id,auth.uid(),'capacity_override',jsonb_build_object('reason',left(p_data->>'override_reason',500))); end if;
  return jsonb_build_object('id',r.id);
 end if;
 select * into r from public.event_registrations where id=(p_data->>'registration_id')::uuid and series_id=s.id and organization_id=p_org for update;
 if r.id is null then raise exception 'Registration unavailable' using errcode='42501'; end if;
 if occ is not null and r.scope='occurrence' and r.occurrence_id<>occ then raise exception 'Registration belongs to another occurrence' using errcode='42501'; end if;
 if p_action='detail' then
  return jsonb_build_object('registration',to_jsonb(r)-array['request_key','request_hash','portal_user_id','payment_destination_id'],
   'attendees',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from public.event_registration_attendees a where registration_id=r.id),
   'answers',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'question_id',x.question_id,'attendee_id',x.attendee_id,'label',q.label,'kind',q.kind,'options',q.options,'value',x.value,'restricted',x.restricted,'revision',x.revision)),'[]') from public.event_registration_answers x join public.event_registration_questions q on q.id=x.question_id where x.registration_id=r.id and can_read and (not x.restricted or can_restricted)),
   'attendance',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.event_attendance x join public.event_registration_attendees a on a.id=x.attendee_id where a.registration_id=r.id),
   'history',(select coalesce(jsonb_agg(to_jsonb(t) order by created_at desc),'[]') from (select action,created_at,actor_user_id,metadata from public.registration_audit where registration_id=r.id order by created_at desc limit 100)t));
 end if;
 if (p_data->>'revision')::int is distinct from r.revision then raise exception 'Stale registration: reload before changing'; end if;
 if p_action in ('check_in','undo') then
  if not can_check then raise exception 'Check-in management required' using errcode='42501'; end if;
  if p_data-array['series_id','occurrence_id','registration_id','revision','attendee_id','note']<>'{}'::jsonb then raise exception 'Unsupported check-in fields'; end if;
  if occ is null then raise exception 'Choose an occurrence'; end if;
  if p_action='check_in' and (r.status<>'confirmed' or not o.retained or o.cancelled or s.status in ('cancelled','archived')) then raise exception 'Registration or occurrence unavailable for check-in'; end if;
  if p_data->>'attendee_id' is not null and not exists(select 1 from public.event_registration_attendees where id=(p_data->>'attendee_id')::uuid and registration_id=r.id) then raise exception 'Wrong attendee' using errcode='42501'; end if;
  for a in select * from public.event_registration_attendees where registration_id=r.id and (p_data->>'attendee_id' is null or id=(p_data->>'attendee_id')::uuid) loop
   if p_action='check_in' then
    insert into public.event_attendance(organization_id,attendee_id,occurrence_id,checked_in_by,method,note) values(p_org,a.id,occ,auth.uid(),'staff',coalesce(p_data->>'note',''))
    on conflict(attendee_id,occurrence_id) do update set checked_in_at=now(),checked_in_by=auth.uid(),reversed_at=null,reversed_by=null,revision=event_attendance.revision+1,note=excluded.note where event_attendance.reversed_at is not null;
   else
    update public.event_attendance set reversed_at=now(),reversed_by=auth.uid(),revision=revision+1 where attendee_id=a.id and occurrence_id=occ and reversed_at is null;
   end if;
   if found then insert into public.registration_audit(organization_id,series_id,registration_id,actor_user_id,action,metadata) values(p_org,s.id,r.id,auth.uid(),p_action,jsonb_build_object('attendee_id',a.id,'occurrence_id',occ)); end if;
  end loop;
 elsif p_action='status' then
  if not can_manage then raise exception 'Registration management required' using errcode='42501'; end if;
  if p_data-array['series_id','occurrence_id','registration_id','revision','status','override','override_reason']<>'{}'::jsonb then raise exception 'Unsupported status fields'; end if;
  if p_data->>'status' not in ('pending','confirmed','cancelled','expired') or p_data->>'status' is null then raise exception 'Unsupported lifecycle state'; end if;
  if p_data->>'status'<>'confirmed' and exists(select 1 from public.event_attendance x join public.event_registration_attendees a on a.id=x.attendee_id where a.registration_id=r.id and x.reversed_at is null) then raise exception 'Reverse active check-ins before changing attendance eligibility'; end if;
  if p_data->>'status' in ('pending','confirmed') and r.status not in ('pending','confirmed') then
   if s.status in ('cancelled','archived') or s.payment_required then raise exception 'Enrollment unavailable'; end if;
   used:=private.registration_used(s.id,r.occurrence_id,r.scope);select count(*) into n from public.event_registration_attendees where registration_id=r.id;
   if s.capacity is not null and used+n>s.capacity then
    if not coalesce((p_data->>'override')::boolean,false) or not private.registration_permission(s,'registrations.override') or length(trim(coalesce(p_data->>'override_reason','')))<5 then raise exception 'Capacity full; explicit override permission and reason required' using errcode='42501'; end if;
    insert into public.registration_audit(organization_id,series_id,registration_id,actor_user_id,action,metadata) values(p_org,s.id,r.id,auth.uid(),'capacity_override',jsonb_build_object('reason',left(p_data->>'override_reason',500)));
   end if;
  end if;
  update public.event_registrations set status=p_data->>'status' where id=r.id;
  insert into public.registration_audit(organization_id,series_id,registration_id,actor_user_id,action,metadata) values(p_org,s.id,r.id,auth.uid(),'status_changed',jsonb_build_object('before',r.status,'after',p_data->>'status'));
 elsif p_action in ('add_attendee','remove_attendee') then
  if not can_manage then raise exception 'Registration management required' using errcode='42501'; end if;
  if p_data-array['series_id','registration_id','revision','attendee_id','first_name','last_name','answers','override','override_reason']<>'{}'::jsonb then raise exception 'Unsupported attendee fields'; end if;
  if p_action='add_attendee' then
   if r.status not in ('pending','confirmed') or s.status in ('cancelled','archived') or s.payment_required then raise exception 'Enrollment unavailable'; end if;
   select count(*) into n from public.event_registration_attendees where registration_id=r.id;
   if n>=coalesce(c.max_attendees,10) then raise exception 'Attendee limit reached'; end if;
   used:=private.registration_used(s.id,r.occurrence_id,r.scope);
   if s.capacity is not null and used+1>s.capacity then
    if not coalesce((p_data->>'override')::boolean,false) or not private.registration_permission(s,'registrations.override') or length(trim(coalesce(p_data->>'override_reason','')))<5 then raise exception 'Capacity full; explicit override permission and reason required' using errcode='42501'; end if;
    insert into public.registration_audit(organization_id,series_id,registration_id,actor_user_id,action,metadata) values(p_org,s.id,r.id,auth.uid(),'capacity_override',jsonb_build_object('reason',left(p_data->>'override_reason',500)));
   end if;
   insert into public.event_registration_attendees(organization_id,registration_id,first_name,last_name) values(p_org,r.id,p_data->>'first_name',p_data->>'last_name') returning id into attendee;
   perform private.registration_answers(r.id,attendee,coalesce(p_data->'answers','{}'));
  else
   attendee:=(p_data->>'attendee_id')::uuid;
   if not exists(select 1 from public.event_registration_attendees where id=attendee and registration_id=r.id) then raise exception 'Wrong attendee'; end if;
   if exists(select 1 from public.event_attendance where attendee_id=attendee) then raise exception 'An attendee with attendance history cannot be removed'; end if;
   if (select count(*) from public.event_registration_attendees where registration_id=r.id)<=1 then raise exception 'Cancel the registration instead of removing its last attendee'; end if;
   delete from public.event_registration_answers where attendee_id=attendee;
   delete from public.event_registration_attendees where id=attendee;
  end if;
  insert into public.registration_audit(organization_id,series_id,registration_id,actor_user_id,action,metadata) values(p_org,s.id,r.id,auth.uid(),case when p_action='add_attendee' then 'attendee_added' else 'attendee_removed' end,jsonb_build_object('attendee_id',attendee));
 elsif p_action='edit' then
  if not can_manage then raise exception 'Registration management required' using errcode='42501'; end if;
  if p_data-array['series_id','registration_id','revision','attendee_id','first_name','last_name','email','phone']<>'{}'::jsonb then raise exception 'Unsupported edit fields'; end if;
  if p_data->>'attendee_id' is null then
   update public.event_registrations set registrant_first_name=p_data->>'first_name',registrant_last_name=p_data->>'last_name',email=coalesce(p_data->>'email',''),phone=coalesce(p_data->>'phone','') where id=r.id;
  else
   update public.event_registration_attendees set first_name=p_data->>'first_name',last_name=p_data->>'last_name' where id=(p_data->>'attendee_id')::uuid and registration_id=r.id;
   if not found then raise exception 'Wrong attendee'; end if;
  end if;
  insert into public.registration_audit(organization_id,series_id,registration_id,actor_user_id,action) values(p_org,s.id,r.id,auth.uid(),'registration_edited');
 elsif p_action='link_person' then
  if not can_manage then raise exception 'Registration management required' using errcode='42501'; end if;
  if p_data-array['series_id','registration_id','revision','attendee_id','person_id']<>'{}'::jsonb then raise exception 'Unsupported linking fields'; end if;
  person:=private.registration_person(p_org,p_data);
  if person is null then raise exception 'Choose a reviewed contact'; end if;
  if p_data->>'attendee_id' is null then update public.event_registrations set person_id=person where id=r.id;
  else
   update public.event_registration_attendees set person_id=person where id=(p_data->>'attendee_id')::uuid and registration_id=r.id;
   if not found then raise exception 'Wrong attendee'; end if;
  end if;
  insert into public.registration_audit(organization_id,series_id,registration_id,actor_user_id,action) values(p_org,s.id,r.id,auth.uid(),'person_link_reviewed');
 elsif p_action='answer' then
  if not can_manage then raise exception 'Registration management required' using errcode='42501'; end if;
  if p_data-array['series_id','registration_id','revision','answer_id','answer_revision','value']<>'{}'::jsonb then raise exception 'Unsupported answer fields'; end if;
  select * into ans from public.event_registration_answers where id=(p_data->>'answer_id')::uuid and registration_id=r.id;
  if ans.id is null or (ans.restricted and not can_restricted) then raise exception 'Answer access denied' using errcode='42501'; end if;
  if ans.revision is distinct from (p_data->>'answer_revision')::int then raise exception 'Stale answer'; end if;
  select * into q from public.event_registration_questions where id=ans.question_id;
  if not private.registration_answer_valid(q,p_data->'value') then raise exception 'Invalid answer'; end if;
  update public.event_registration_answers set value=p_data->'value',revision=revision+1 where id=ans.id;
  insert into public.registration_audit(organization_id,series_id,registration_id,actor_user_id,action,metadata) values(p_org,s.id,r.id,auth.uid(),case when ans.restricted then 'restricted_answer_changed' else 'answer_changed' end,jsonb_build_object('answer_id',ans.id));
 else raise exception 'Unsupported staff action'; end if;
 update public.event_registrations set revision=revision+1,updated_at=now() where id=r.id returning revision into rev;
 return jsonb_build_object('id',r.id,'revision',rev);
end $$;

create function public.registration_public(p_slug text,p_action text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.registration_public(p_slug,p_action,p_data) $$;
create function public.registrations_workspace(p_org uuid,p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select private.registrations_workspace(p_org,p_action,p_data) $$;
revoke all on function private.registration_permission(public.event_series,text),private.registration_used(uuid,uuid,text),private.registration_answer_valid(public.event_registration_questions,jsonb),private.registration_answers(uuid,uuid,jsonb),private.registration_confirmation(public.event_registrations),private.registration_person(uuid,jsonb),private.registration_public(text,text,jsonb),private.registrations_workspace(uuid,text,jsonb),public.registration_public(text,text,jsonb),public.registrations_workspace(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.registration_public(text,text,jsonb),public.registration_public(text,text,jsonb) to anon,authenticated;
grant execute on function private.registrations_workspace(uuid,text,jsonb),public.registrations_workspace(uuid,text,jsonb) to authenticated;
alter table public.event_registration_settings enable row level security;
alter table public.event_registration_questions enable row level security;
alter table public.event_registrations enable row level security;
alter table public.event_registration_attendees enable row level security;
alter table public.event_registration_answers enable row level security;
alter table public.event_attendance enable row level security;
alter table public.registration_audit enable row level security;
revoke all on public.event_registration_settings,public.event_registration_questions,public.event_registrations,public.event_registration_attendees,public.event_registration_answers,public.event_attendance,public.registration_audit from public,anon,authenticated;
grant all on public.event_registration_settings,public.event_registration_questions,public.event_registrations,public.event_registration_attendees,public.event_registration_answers,public.event_attendance,public.registration_audit to service_role;
