-- UNINSTALLED P1 recovery candidate for issue159. Never run as an historical migration.
-- Narrow recovery of PR6 79404bb / PR35 76c328c individual lifecycle, canonical
-- identity, serialized capacity and scoped manifest contracts. No public intake,
-- lodging, messaging, staff provisioning or Family Fun Day activation.
begin;
do $$declare r record;begin
 if to_regclass('public.outreach_campaigns') is null or to_regclass('public.outreach_volunteer_applications') is null or
    to_regprocedure('private.staff_assignment_active(uuid,uuid)') is null or
    to_regprocedure('private.person_permission(uuid,uuid,text)') is null or
    to_regprocedure('private.outreach_csv_cell(text)') is null then
  raise exception 'Team/travel production prerequisites missing';
 end if;
 for r in select * from(values
  ('private.staff_assignment_active(uuid,uuid)','05149569926640f4d39bca2eda70169d'),
  ('private.has_staff_permission(uuid,text,uuid)','d9dd9b23e1eddefe8b0e6d863c149677'),
  ('private.person_permission(uuid,uuid,text)','98f5cd164aac623cd3f6245550194103'),
  ('private.outreach_verified(uuid)','24578afbb6043b94775a556517b0ad45'),
  ('private.outreach_csv_cell(text)','a23dae5f2a4eeca26b1ed632d4c9bcd9'),
  ('private.outreach_immutable()','824478818ca3407517607bb0ccc04752'))v(signature,fingerprint) loop
  if to_regprocedure(r.signature) is null or md5(pg_get_functiondef(to_regprocedure(r.signature)))<>r.fingerprint then
   raise exception 'Team/travel security helper drift: %',r.signature;
  end if;
 end loop;
 if exists(select 1 from pg_class t join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname=any(array['outreach_team_members','outreach_team_legs','outreach_team_vehicles','outreach_team_driver_reviews','outreach_team_vehicle_assignments','outreach_team_history'])) or
    to_regprocedure('public.outreach_team_workspace(text,uuid,jsonb)') is not null then
  raise exception 'Team/travel already present or partial schema';
 end if;
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint
     where conrelid='public.outreach_campaign_assignments'::regclass
     and conname='outreach_campaign_assignments_capabilities_check')
    is distinct from '337390843d9bcdf5cb01f95cb5891adb' then
  raise exception 'Team/travel campaign assignment contract drift';
 end if;
end $$;

-- Extend the current registration vocabulary, preserving its implication rules.
alter table public.outreach_campaign_assignments drop constraint outreach_campaign_assignments_capabilities_check;
alter table public.outreach_campaign_assignments add constraint outreach_campaign_assignments_capabilities_check check(
 capabilities <@ array['view','registration.view','registration.manage','registration.export','checkin.manage','team.view','team.manage','team.export','travel.view','travel.manage','travel.export']::text[]
 and cardinality(capabilities)>0 and array_position(capabilities,null) is null
 and (not(capabilities && array['registration.manage','registration.export','checkin.manage']) or 'registration.view'=any(capabilities))
 and (not(capabilities && array['team.manage','team.export']) or 'team.view'=any(capabilities))
 and (not(capabilities && array['travel.manage','travel.export']) or 'travel.view'=any(capabilities)));

-- A participant is an event relationship to a reviewed canonical Person. It is
-- neither an Auth identity nor a second Person/Household directory.
create table public.outreach_team_members(
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null,organization_id uuid not null,
 application_id uuid not null unique,person_id uuid not null,household_id uuid,
 status text not null default 'applied' check(status in('applied','under_review','approved','waitlisted','declined','cancelled')),
 identity_reviewed_by uuid not null references auth.users(id),identity_reviewed_at timestamptz not null default now(),
 identity_reason text not null check(length(btrim(identity_reason)) between 10 and 500),
 availability_confirmed boolean not null default false,availability_reviewed_by uuid references auth.users(id),availability_reviewed_at timestamptz,
 availability_reason text check(length(btrim(availability_reason)) between 10 and 500),
 age integer check(age between 0 and 120),age_reviewed_by uuid references auth.users(id),age_reviewed_at timestamptz,
 age_reason text check(length(btrim(age_reason)) between 10 and 500),
 guardian_member_id uuid,guardian_reviewed_by uuid references auth.users(id),guardian_reviewed_at timestamptz,
 guardian_reason text check(length(btrim(guardian_reason)) between 10 and 500),
 checked_in_at timestamptz,checked_in_by uuid references auth.users(id),attended_at timestamptz,attended_by uuid references auth.users(id),
 revision integer not null default 1,updated_at timestamptz not null default now(),
 foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),
 foreign key(campaign_id,application_id) references public.outreach_volunteer_applications(campaign_id,id),
 foreign key(organization_id,household_id) references public.households(organization_id,id),
 unique(campaign_id,id),unique(campaign_id,person_id),
 foreign key(campaign_id,guardian_member_id) references public.outreach_team_members(campaign_id,id),
 check(guardian_member_id is null or guardian_member_id<>id),
 check(not availability_confirmed or (availability_reviewed_by is not null and availability_reviewed_at is not null and availability_reason is not null)),
 check((age is null and age_reviewed_by is null and age_reviewed_at is null and age_reason is null) or
       (age is not null and age_reviewed_by is not null and age_reviewed_at is not null and age_reason is not null)),
 check((guardian_member_id is null and guardian_reviewed_by is null and guardian_reviewed_at is null and guardian_reason is null) or
       (guardian_member_id is not null and guardian_reviewed_by is not null and guardian_reviewed_at is not null and guardian_reason is not null)),
 check((checked_in_at is null)=(checked_in_by is null)),check((attended_at is null)=(attended_by is null)),
 check(attended_at is null or checked_in_at is not null));
create index outreach_team_member_status_idx on public.outreach_team_members(campaign_id,status);
create index outreach_team_member_person_idx on public.outreach_team_members(organization_id,person_id);
create index outreach_team_member_household_idx on public.outreach_team_members(organization_id,household_id);
create index outreach_team_member_guardian_idx on public.outreach_team_members(campaign_id,guardian_member_id);

create table public.outreach_team_legs(
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null references public.outreach_campaigns(id),
 label text not null check(length(btrim(label)) between 1 and 100),departure_at timestamptz,arrival_at timestamptz,
 departure_location text not null default '' check(length(departure_location)<=500),destination text not null default '' check(length(destination)<=500),
 itinerary_confirmed boolean not null default false,revision integer not null default 1,
 unique(campaign_id,id),check(arrival_at is null or (departure_at is not null and arrival_at>=departure_at)),
 check(not itinerary_confirmed or (departure_at is not null and length(btrim(departure_location))>0 and length(btrim(destination))>0)));
create table public.outreach_team_vehicles(
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null references public.outreach_campaigns(id),
 label text not null check(length(btrim(label)) between 1 and 100),vehicle_type text not null check(length(btrim(vehicle_type)) between 1 and 80),
 total_capacity integer not null check(total_capacity between 1 and 500),
 passenger_capacity integer not null check(passenger_capacity between 0 and 499),
 accessible_seats integer check(accessible_seats>=0 and accessible_seats<=passenger_capacity),
 passenger_carrying boolean not null default true,active boolean not null default true,
 notes text not null default '' check(length(notes)<=2000),revision integer not null default 1,
 unique(campaign_id,id),check(passenger_capacity<total_capacity),check(passenger_carrying or passenger_capacity=0));
create table public.outreach_team_driver_reviews(
 campaign_id uuid not null,member_id uuid not null,vehicle_id uuid not null,qualified boolean not null,
 reviewed_by uuid not null references auth.users(id),reviewed_at timestamptz not null default now(),
 reason text not null check(length(btrim(reason)) between 10 and 500),revision integer not null default 1,
 primary key(campaign_id,member_id,vehicle_id),
 foreign key(campaign_id,member_id) references public.outreach_team_members(campaign_id,id),
 foreign key(campaign_id,vehicle_id) references public.outreach_team_vehicles(campaign_id,id));
create index outreach_team_driver_vehicle_idx on public.outreach_team_driver_reviews(campaign_id,vehicle_id);
create table public.outreach_team_vehicle_assignments(
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null,leg_id uuid not null,vehicle_id uuid not null,member_id uuid not null,
 seat_role text not null check(seat_role in('driver','co_driver','passenger')),
 state text not null default 'assigned' check(state in('assigned','confirmed','cancelled')),
 assigned_at timestamptz not null default now(),assigned_by uuid not null references auth.users(id),
 confirmed_at timestamptz,confirmed_by uuid references auth.users(id),cancelled_at timestamptz,cancelled_by uuid references auth.users(id),
 revision integer not null default 1,
 foreign key(campaign_id,member_id) references public.outreach_team_members(campaign_id,id),
 foreign key(campaign_id,leg_id) references public.outreach_team_legs(campaign_id,id),
 foreign key(campaign_id,vehicle_id) references public.outreach_team_vehicles(campaign_id,id),
 check((confirmed_at is null)=(confirmed_by is null)),check((cancelled_at is null)=(cancelled_by is null)),
 check((state='cancelled')=(cancelled_at is not null)),check(state<>'confirmed' or confirmed_at is not null));
create unique index outreach_team_one_leg_seat_idx on public.outreach_team_vehicle_assignments(campaign_id,leg_id,member_id) where state<>'cancelled';
create unique index outreach_team_one_driver_idx on public.outreach_team_vehicle_assignments(campaign_id,leg_id,vehicle_id,seat_role) where state<>'cancelled' and seat_role<>'passenger';
create index outreach_team_occupancy_idx on public.outreach_team_vehicle_assignments(campaign_id,leg_id,vehicle_id) where state<>'cancelled';
create index outreach_team_assignment_member_idx on public.outreach_team_vehicle_assignments(campaign_id,member_id);
create table public.outreach_team_history(
 id bigint generated always as identity primary key,campaign_id uuid not null references public.outreach_campaigns(id),
 actor_user_id uuid not null references auth.users(id),kind text not null,subject_id uuid,
 metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=4000),
 created_at timestamptz not null default clock_timestamp());
create index outreach_team_history_campaign_idx on public.outreach_team_history(campaign_id,id);
create trigger outreach_team_history_immutable before update or delete on public.outreach_team_history for each row execute function private.outreach_immutable();

create function private.outreach_team_can(c uuid,cap text) returns boolean language sql volatile security definer set search_path='' as $$
 select cap in('team.view','team.manage','team.export','travel.view','travel.manage','travel.export')
 and private.outreach_verified(auth.uid()) and exists(select 1 from public.outreach_campaigns x where x.id=c and
 private.staff_assignment_active(x.organization_id,auth.uid()) and
 (private.has_staff_permission(x.organization_id,'staff.manage') or exists(
  select 1 from public.outreach_campaign_assignments a where a.campaign_id=c and a.user_id=auth.uid() and a.active
  and a.effective_at<=clock_timestamp() and (a.expires_at is null or a.expires_at>clock_timestamp())
  and 'view'=any(a.capabilities) and cap=any(a.capabilities))))
$$;
create function private.outreach_team_lock(c uuid,cap text) returns void language plpgsql security definer set search_path='' as $$begin
 if not private.outreach_team_can(c,cap) then raise exception 'Team/travel access denied' using errcode='42501';end if;
 perform 1 from public.outreach_campaigns where id=c for update;
 if not private.outreach_team_can(c,cap) then raise exception 'Team/travel access denied' using errcode='42501';end if;
end $$;
create function private.outreach_team_ready(c uuid,m uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.outreach_team_members t join public.outreach_volunteer_applications s on s.id=t.application_id and s.campaign_id=t.campaign_id
 where t.campaign_id=c and t.id=m and t.status='approved' and t.age is not null and t.availability_confirmed and s.status not in('cancelled','not_selected','waitlisted')
 and (t.age>=18 or (t.guardian_reviewed_at is not null and exists(
  select 1 from public.outreach_team_members g join public.outreach_volunteer_applications gs on gs.id=g.application_id and gs.campaign_id=g.campaign_id and gs.status not in('cancelled','not_selected','waitlisted')
  join public.households h on h.id=t.household_id and h.organization_id=t.organization_id and h.status='active'
  join public.household_members a on a.household_id=h.id and a.person_id=t.person_id and a.active
  join public.household_members b on b.household_id=h.id and b.person_id=g.person_id and b.active
  where g.id=t.guardian_member_id and g.campaign_id=c and g.status='approved' and g.age>=18 and g.availability_confirmed))))
$$;
create function private.outreach_team_record(c uuid,k text,s uuid,m jsonb default '{}') returns void language sql security definer set search_path='' as $$
 insert into public.outreach_team_history(campaign_id,actor_user_id,kind,subject_id,metadata) values(c,auth.uid(),k,s,m)
$$;
create function private.outreach_team_confirmation_valid(c uuid,a uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.outreach_team_vehicle_assignments q join public.outreach_team_members m on m.id=q.member_id
 join public.outreach_team_legs l on l.id=q.leg_id join public.outreach_team_vehicles v on v.id=q.vehicle_id
 where q.campaign_id=c and q.id=a and q.state='confirmed' and l.itinerary_confirmed and v.active and private.outreach_team_ready(c,m.id)
 and (m.age>=18 or exists(select 1 from public.outreach_team_vehicle_assignments g where g.campaign_id=c and g.leg_id=q.leg_id and g.vehicle_id=q.vehicle_id and g.member_id=m.guardian_member_id and g.state<>'cancelled'))
 and exists(select 1 from public.outreach_team_vehicle_assignments d join public.outreach_team_driver_reviews r on r.campaign_id=d.campaign_id and r.member_id=d.member_id and r.vehicle_id=d.vehicle_id and r.qualified
 where d.campaign_id=c and d.leg_id=q.leg_id and d.vehicle_id=q.vehicle_id and d.seat_role='driver' and d.state<>'cancelled' and private.outreach_team_ready(c,d.member_id)))
$$;

create function private.outreach_team_workspace(a text,c uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;cap text;m public.outreach_team_members;g public.outreach_team_members;v public.outreach_team_vehicles;
 l public.outreach_team_legs;x public.outreach_team_vehicle_assignments;target uuid;old text;reason text;
 rows jsonb;item jsonb;csv text;occupation integer;passengers integer;drivers integer;role text;rev integer;
begin
 select organization_id into org from public.outreach_campaigns where id=c;
 if org is null then raise exception 'Team/travel access denied' using errcode='42501';end if;
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>16000 then raise exception 'Invalid team payload' using errcode='22023';end if;
 cap:=case when a in('context','members','history') then 'team.view' when a in('roster','manifest','travelers') then 'travel.view'
  when a='csv' then 'travel.export' when a in('enroll','review_age','availability_review','guardian_review','guardian_options','status','attendance') then 'team.manage' else 'travel.manage' end;
 if not private.outreach_team_can(c,cap) and not(a='context' and private.outreach_team_can(c,'travel.view')) then raise exception 'Team/travel access denied' using errcode='42501';end if;
 if a='context' then return jsonb_build_object('campaign_id',c,'organization_id',org,'name',(select name from public.outreach_campaigns where id=c),
  'application_review_allowed',private.has_staff_permission(org,'staff.manage') and exists(select 1 from public.outreach_campaigns e join public.organizations o on o.id=e.organization_id where e.id=c and e.code='minden_la_2026' and o.slug='sowgo'),
  'capabilities',to_jsonb(array(select k from unnest(array['team.view','team.manage','team.export','travel.view','travel.manage','travel.export']) k where private.outreach_team_can(c,k))),
  'summary',(select coalesce(jsonb_object_agg(status,n),'{}') from(select status,count(*) n from public.outreach_team_members where campaign_id=c group by status)s));
 elsif a='guardian_options' then
  select * into m from public.outreach_team_members where campaign_id=c and id=(p->>'member_id')::uuid;
  if m.id is null or not(private.has_staff_permission(org,'households.read') and private.person_permission(org,m.person_id,'people.read')) then raise exception 'Canonical household review denied' using errcode='42501';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('guardian_member_id',g1.id,'household_id',h.id,'household_name',h.name,'first_name',z.first_name,'last_name',z.last_name))
   from public.outreach_team_members g1 join public.organization_people z on z.id=g1.person_id and z.organization_id=org
   join public.household_members x1 on x1.person_id=m.person_id and x1.organization_id=org and x1.active
   join public.household_members x2 on x2.household_id=x1.household_id and x2.person_id=g1.person_id and x2.active
   join public.households h on h.id=x1.household_id and h.organization_id=org and h.status='active'
   where g1.campaign_id=c and g1.age>=18 and g1.status='approved' and private.person_permission(org,g1.person_id,'people.read')),'[]');
 elsif a='travelers' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'first_name',z.first_name,'last_name',z.last_name,'status',t.status,'travel_ready',private.outreach_team_ready(c,t.id),'adult_reviewed',t.age>=18) order by z.last_name,z.first_name,t.id)
   from public.outreach_team_members t join public.organization_people z on z.id=t.person_id and z.organization_id=t.organization_id where t.campaign_id=c),'[]');
 elsif a='members' then
  return coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('first_name',z.first_name,'last_name',z.last_name,'source_application_status',(select status from public.outreach_volunteer_applications s where s.id=t.application_id),'travel_ready',private.outreach_team_ready(c,t.id)) order by z.last_name,z.first_name,t.id)
   from public.outreach_team_members t join public.organization_people z on z.id=t.person_id and z.organization_id=t.organization_id where t.campaign_id=c),'[]');
 elsif a='history' then return coalesce((select jsonb_agg(to_jsonb(h)||jsonb_build_object('actor_label',coalesce((select display_name from public.organization_staff_directory d where d.organization_id=org and d.user_id=h.actor_user_id),'Authorized staff reviewer')) order by h.id desc) from(select * from public.outreach_team_history where campaign_id=c and (private.outreach_team_can(c,'travel.view') or kind in('enroll','review_age','age.reviewed','availability_review','availability.reviewed','guardian_review','guardian.reviewed','status','approval.changed','attendance','attendance.changed')) and (not(p?'subject_id') or subject_id=(p->>'subject_id')::uuid) order by id desc limit 500)h),'[]');
 elsif a='roster' then
  return jsonb_build_object('legs',coalesce((select jsonb_agg(to_jsonb(t) order by label,id) from public.outreach_team_legs t where campaign_id=c),'[]'),
   'vehicles',coalesce((select jsonb_agg(to_jsonb(t) order by label,id) from public.outreach_team_vehicles t where campaign_id=c),'[]'),
   'driver_reviews',coalesce((select jsonb_agg(to_jsonb(t)-'reason') from public.outreach_team_driver_reviews t where campaign_id=c),'[]'),
   'assignments',coalesce((select jsonb_agg(to_jsonb(t)) from public.outreach_team_vehicle_assignments t where campaign_id=c),'[]'),
   'capacity',coalesce((select jsonb_agg(jsonb_build_object('leg_id',lg.id,'vehicle_id',v1.id,'total_capacity',v1.total_capacity,'passenger_capacity',v1.passenger_capacity,
    'occupants',(select count(*) from public.outreach_team_vehicle_assignments q where q.campaign_id=c and q.leg_id=lg.id and q.vehicle_id=v1.id and q.state<>'cancelled'),
    'available_passenger_seats',greatest(0,least(v1.passenger_capacity-(select count(*) from public.outreach_team_vehicle_assignments q where q.campaign_id=c and q.leg_id=lg.id and q.vehicle_id=v1.id and q.state<>'cancelled' and q.seat_role='passenger'),
     v1.total_capacity-(select count(*) from public.outreach_team_vehicle_assignments q where q.campaign_id=c and q.leg_id=lg.id and q.vehicle_id=v1.id and q.state<>'cancelled')-
     (case when exists(select 1 from public.outreach_team_vehicle_assignments q where q.campaign_id=c and q.leg_id=lg.id and q.vehicle_id=v1.id and q.state<>'cancelled' and q.seat_role='driver') then 0 else 1 end)))))
    from public.outreach_team_legs lg cross join public.outreach_team_vehicles v1 where lg.campaign_id=c and v1.campaign_id=c and v1.active),'[]'),
   'unassigned_approved',(select count(*) from public.outreach_team_members t where t.campaign_id=c and t.status='approved' and not exists(select 1 from public.outreach_team_vehicle_assignments q where q.campaign_id=c and q.member_id=t.id and q.state<>'cancelled' and (not(p?'leg_id') or q.leg_id=(p->>'leg_id')::uuid))));
 elsif a in('manifest','csv') then
  if p->>'leg_id' is null then raise exception 'Explicit travel leg required';end if;
  select * into l from public.outreach_team_legs where campaign_id=c and id=(p->>'leg_id')::uuid;
  if l.id is null then raise exception 'Travel leg unavailable';end if;
  select coalesce(jsonb_agg(jsonb_build_object('assignment_id',q.id,'member_id',t.id,'name',z.first_name||' '||z.last_name,
   'vehicle_id',v1.id,'vehicle',v1.label,'seat_role',q.seat_role,'state',q.state,'leg',l.label,
   'departure_at',case when l.itinerary_confirmed then l.departure_at else null end,'itinerary_confirmed',l.itinerary_confirmed,'confirmation_valid',private.outreach_team_confirmation_valid(c,q.id))
   order by v1.label,q.seat_role,z.last_name,z.first_name,t.id),'[]') into rows
  from public.outreach_team_vehicle_assignments q join public.outreach_team_members t on t.id=q.member_id
  join public.organization_people z on z.id=t.person_id and z.organization_id=t.organization_id
  join public.outreach_team_vehicles v1 on v1.id=q.vehicle_id where q.campaign_id=c and q.leg_id=l.id and q.state<>'cancelled'
  and (not(p?'vehicle_id') or q.vehicle_id=(p->>'vehicle_id')::uuid);
  if a='manifest' then return rows;end if;
  csv:='Name,Vehicle,Seat role,Assignment state,Current itinerary valid,Travel leg,Departure (confirmed only)'||E'\r\n';
  for item in select value from jsonb_array_elements(rows) loop
   csv:=csv||private.outreach_csv_cell(item->>'name')||','||private.outreach_csv_cell(item->>'vehicle')||','||private.outreach_csv_cell(item->>'seat_role')||','||private.outreach_csv_cell(item->>'state')||','||private.outreach_csv_cell(item->>'confirmation_valid')||','||private.outreach_csv_cell(item->>'leg')||','||private.outreach_csv_cell(item->>'departure_at')||E'\r\n';
  end loop;
  perform private.outreach_team_record(c,'manifest.exported',l.id,jsonb_build_object('rows',jsonb_array_length(rows)));
  return jsonb_build_object('csv',csv,'filename','outreach-travel-'||l.id||'.csv');
 end if;
 perform private.outreach_team_lock(c,cap);
 reason:=btrim(coalesce(p->>'reason',''));
 if a in('enroll','review_age','availability_review','guardian_review','status','attendance','driver_review','assignment_cancel','assignment_reassign') and length(reason) not between 10 and 500 then raise exception 'Explicit review reason required';end if;
 if a='enroll' then
  if not(private.person_permission(org,(p->>'person_id')::uuid,'people.read') and private.person_permission(org,(p->>'person_id')::uuid,'people.update')) then raise exception 'Reviewed canonical Person required' using errcode='42501';end if;
  if not exists(select 1 from public.outreach_volunteer_applications s where s.id=(p->>'application_id')::uuid and s.campaign_id=c and s.organization_id=org and s.status not in('cancelled','not_selected')) then raise exception 'Active application in this event required';end if;
  insert into public.outreach_team_members(campaign_id,organization_id,application_id,person_id,identity_reviewed_by,identity_reason)
   values(c,org,(p->>'application_id')::uuid,(p->>'person_id')::uuid,auth.uid(),reason) returning id into target;
 elsif a in('review_age','availability_review','guardian_review','status','attendance') then
  select * into m from public.outreach_team_members where campaign_id=c and id=(p->>'member_id')::uuid;
  if m.id is null then raise exception 'Participant unavailable';end if;
  if m.revision is distinct from (p->>'revision')::int then raise exception 'Participant changed; reload' using errcode='40001';end if;
  target:=m.id;
  if a='review_age' then
   if not(private.person_permission(org,m.person_id,'people.read') and private.person_permission(org,m.person_id,'people.update')) then raise exception 'Canonical age review permission required' using errcode='42501';end if;
   if exists(select 1 from public.outreach_team_vehicle_assignments where campaign_id=c and member_id=m.id and state<>'cancelled') then raise exception 'Release travel assignments before age correction';end if;
   if p->>'age' is null then raise exception 'Explicit verified age required';end if;
   update public.outreach_team_members set age=(p->>'age')::int,age_reviewed_by=auth.uid(),age_reviewed_at=now(),age_reason=reason where id=m.id;
   perform private.outreach_team_record(c,'age.reviewed',m.id,jsonb_build_object('from',m.age,'to',(p->>'age')::int,'reason',reason));
  elsif a='availability_review' then
   if jsonb_typeof(p->'confirmed') is distinct from 'boolean' then raise exception 'Explicit availability review required';end if;
   if not(p->>'confirmed')::boolean and exists(select 1 from public.outreach_team_vehicle_assignments where campaign_id=c and member_id=m.id and state<>'cancelled') then raise exception 'Release travel before availability cancellation';end if;
   update public.outreach_team_members set availability_confirmed=(p->>'confirmed')::boolean,availability_reviewed_by=auth.uid(),availability_reviewed_at=now(),availability_reason=reason where id=m.id;
   perform private.outreach_team_record(c,'availability.reviewed',m.id,jsonb_build_object('from',m.availability_confirmed,'to',(p->>'confirmed')::boolean,'reason',reason));
  elsif a='guardian_review' then
   select * into g from public.outreach_team_members where campaign_id=c and id=(p->>'guardian_member_id')::uuid;
   if m.age is null or m.age>=18 or g.id is null or g.age<18 or g.age is null or g.id=m.id then raise exception 'Reviewed minor and adult guardian required';end if;
   if not(private.has_staff_permission(org,'households.read') and private.person_permission(org,m.person_id,'people.read') and private.person_permission(org,g.person_id,'people.read')) then raise exception 'Canonical guardian review denied' using errcode='42501';end if;
   if not exists(select 1 from public.households h join public.household_members x1 on x1.household_id=h.id and x1.person_id=m.person_id and x1.active join public.household_members x2 on x2.household_id=h.id and x2.person_id=g.person_id and x2.active where h.organization_id=org and h.id=(p->>'household_id')::uuid and h.status='active') then raise exception 'Active canonical Household membership required';end if;
   update public.outreach_team_members set guardian_member_id=g.id,guardian_reviewed_by=auth.uid(),guardian_reviewed_at=now(),guardian_reason=reason,household_id=(p->>'household_id')::uuid where id=m.id;
   perform private.outreach_team_record(c,'guardian.reviewed',m.id,jsonb_build_object('from',m.guardian_member_id,'to',g.id,'household_id',p->>'household_id','reason',reason));
  elsif a='status' then
   old:=m.status;
   if p->>'status' is null or p->>'status' not in('applied','under_review','approved','waitlisted','declined','cancelled') then raise exception 'Invalid approval state';end if;
   -- Status transitions never imply identity, itinerary, check-in or attendance.
   if p->>'status'<>'approved' and exists(select 1 from public.outreach_team_vehicle_assignments where campaign_id=c and state<>'cancelled' and (member_id=m.id or member_id in(select id from public.outreach_team_members where campaign_id=c and guardian_member_id=m.id and age<18))) then raise exception 'Release participant and dependent travel before approval change';end if;
   update public.outreach_team_members set status=p->>'status' where id=m.id;
   perform private.outreach_team_record(c,'approval.changed',m.id,jsonb_build_object('from',old,'to',p->>'status','reason',reason));
  else
   if m.status<>'approved' then raise exception 'Approved volunteer required for attendance';end if;
   if p->>'state'='checked_in' then update public.outreach_team_members set checked_in_at=coalesce(checked_in_at,now()),checked_in_by=coalesce(checked_in_by,auth.uid()) where id=m.id;
   elsif p->>'state'='attended' and m.checked_in_at is not null then update public.outreach_team_members set attended_at=coalesce(attended_at,now()),attended_by=coalesce(attended_by,auth.uid()) where id=m.id;
   elsif p->>'state'='reverse' then update public.outreach_team_members set checked_in_at=null,checked_in_by=null,attended_at=null,attended_by=null where id=m.id;
   else raise exception 'Explicit check-in before attendance required';end if;
   perform private.outreach_team_record(c,'attendance.changed',m.id,jsonb_build_object('state',p->>'state','previous_checked_in',m.checked_in_at is not null,'previous_attended',m.attended_at is not null,'reason',reason));
  end if;
  update public.outreach_team_members set revision=revision+1,updated_at=now() where id=m.id;
 elsif a='leg_save' then
  target:=(p->>'id')::uuid;
  if target is not null then
   select * into l from public.outreach_team_legs where campaign_id=c and id=target;
   if l.id is null or l.revision is distinct from (p->>'revision')::int then raise exception 'Travel leg changed; reload' using errcode='40001';end if;
   -- Changing confirmed details explicitly invalidates every prior confirmation.
   update public.outreach_team_vehicle_assignments set state='assigned',confirmed_at=null,confirmed_by=null,revision=revision+1 where campaign_id=c and leg_id=target and state='confirmed';
  end if;
  insert into public.outreach_team_legs(id,campaign_id,label,departure_at,arrival_at,departure_location,destination,itinerary_confirmed,revision)
  values(coalesce(target,gen_random_uuid()),c,p->>'label',(p->>'departure_at')::timestamptz,(p->>'arrival_at')::timestamptz,coalesce(p->>'departure_location',''),coalesce(p->>'destination',''),coalesce((p->>'itinerary_confirmed')::boolean,false),coalesce(l.revision,0)+1)
  on conflict(id) do update set label=excluded.label,departure_at=excluded.departure_at,arrival_at=excluded.arrival_at,departure_location=excluded.departure_location,destination=excluded.destination,itinerary_confirmed=excluded.itinerary_confirmed,revision=excluded.revision returning id into target;
  perform private.outreach_team_record(c,'itinerary.changed',target,jsonb_build_object('previous_departure_at',l.departure_at,'departure_at',p->>'departure_at','itinerary_confirmed',coalesce((p->>'itinerary_confirmed')::boolean,false),'prior_confirmations_invalidated',l.id is not null));
 elsif a='vehicle_save' then
  target:=(p->>'id')::uuid;
  if target is not null then
   select * into v from public.outreach_team_vehicles where campaign_id=c and id=target;
   if v.id is null or v.revision is distinct from (p->>'revision')::int then raise exception 'Vehicle changed; reload' using errcode='40001';end if;
   if exists(select 1 from public.outreach_team_vehicle_assignments where campaign_id=c and vehicle_id=v.id and state<>'cancelled') then raise exception 'Release occupants before vehicle change';end if;
   update public.outreach_team_driver_reviews set qualified=false,revision=revision+1 where campaign_id=c and vehicle_id=v.id;
  end if;
  insert into public.outreach_team_vehicles(id,campaign_id,label,vehicle_type,total_capacity,passenger_capacity,passenger_carrying,accessible_seats,active,notes,revision)
  values(coalesce(target,gen_random_uuid()),c,p->>'label',p->>'vehicle_type',(p->>'total_capacity')::int,(p->>'passenger_capacity')::int,coalesce((p->>'passenger_carrying')::boolean,true),(p->>'accessible_seats')::int,coalesce((p->>'active')::boolean,true),coalesce(p->>'notes',''),coalesce(v.revision,0)+1)
  on conflict(id) do update set label=excluded.label,vehicle_type=excluded.vehicle_type,total_capacity=excluded.total_capacity,passenger_capacity=excluded.passenger_capacity,passenger_carrying=excluded.passenger_carrying,accessible_seats=excluded.accessible_seats,active=excluded.active,notes=excluded.notes,revision=excluded.revision returning id into target;
  perform private.outreach_team_record(c,'vehicle.capacity.changed',target,jsonb_build_object('previous_total',v.total_capacity,'total',(p->>'total_capacity')::int,'previous_passengers',v.passenger_capacity,'passengers',(p->>'passenger_capacity')::int));
 elsif a='driver_review' then
  select * into m from public.outreach_team_members where campaign_id=c and id=(p->>'member_id')::uuid;
  select * into v from public.outreach_team_vehicles where campaign_id=c and id=(p->>'vehicle_id')::uuid;
  if m.id is null or v.id is null or m.age is null or m.age<18 or not private.outreach_team_ready(c,m.id) then raise exception 'Approved reviewed adult driver required';end if;
  if p->>'qualified' is null then raise exception 'Explicit driver qualification review required';end if;
  if not(p->>'qualified')::boolean and exists(select 1 from public.outreach_team_vehicle_assignments where campaign_id=c and vehicle_id=v.id and member_id=m.id and seat_role<>'passenger' and state<>'cancelled') then raise exception 'Release driver assignments before revocation';end if;
  select revision into rev from public.outreach_team_driver_reviews where campaign_id=c and member_id=m.id and vehicle_id=v.id;
  select qualified::text into old from public.outreach_team_driver_reviews where campaign_id=c and member_id=m.id and vehicle_id=v.id;
  if coalesce(rev,0) is distinct from (p->>'revision')::int then raise exception 'Driver review changed; reload' using errcode='40001';end if;
  insert into public.outreach_team_driver_reviews(campaign_id,member_id,vehicle_id,qualified,reviewed_by,reason,revision) values(c,m.id,v.id,(p->>'qualified')::boolean,auth.uid(),reason,coalesce(rev,0)+1)
  on conflict(campaign_id,member_id,vehicle_id) do update set qualified=excluded.qualified,reviewed_by=excluded.reviewed_by,reviewed_at=now(),reason=excluded.reason,revision=excluded.revision;
  perform private.outreach_team_record(c,'driver.qualification.changed',m.id,jsonb_build_object('vehicle_id',v.id,'from',old::boolean,'to',(p->>'qualified')::boolean,'reason',reason));
  target:=m.id;
 elsif a in('assignment_save','assignment_reassign','assignment_cancel','assignment_confirm') then
  if a<>'assignment_save' then
   select * into x from public.outreach_team_vehicle_assignments where campaign_id=c and id=(p->>'assignment_id')::uuid;
   if x.id is null or x.state='cancelled' or x.revision is distinct from (p->>'revision')::int then raise exception 'Assignment changed; reload' using errcode='40001';end if;
   if a='assignment_confirm' then
    select * into l from public.outreach_team_legs where campaign_id=c and id=x.leg_id;
    if not l.itinerary_confirmed or not private.outreach_team_ready(c,x.member_id) then raise exception 'Reviewed participant and confirmed itinerary required';end if;
    if not exists(select 1 from public.outreach_team_vehicle_assignments d join public.outreach_team_driver_reviews r on r.campaign_id=d.campaign_id and r.member_id=d.member_id and r.vehicle_id=d.vehicle_id and r.qualified where d.campaign_id=c and d.leg_id=x.leg_id and d.vehicle_id=x.vehicle_id and d.seat_role='driver' and d.state<>'cancelled' and private.outreach_team_ready(c,d.member_id)) then raise exception 'Qualified responsible driver required';end if;
    update public.outreach_team_vehicle_assignments set state='confirmed',confirmed_at=now(),confirmed_by=auth.uid(),revision=revision+1 where id=x.id;
    target:=x.id;
   else
    if x.seat_role='driver' and exists(select 1 from public.outreach_team_vehicle_assignments q where q.campaign_id=c and q.leg_id=x.leg_id and q.vehicle_id=x.vehicle_id and q.id<>x.id and q.state='confirmed') then raise exception 'Unconfirm passenger itinerary before removing responsible driver';end if;
    if exists(select 1 from public.outreach_team_members dep join public.outreach_team_vehicle_assignments q on q.member_id=dep.id and q.campaign_id=c and q.leg_id=x.leg_id and q.vehicle_id=x.vehicle_id and q.state<>'cancelled' where dep.guardian_member_id=x.member_id and dep.age<18) then raise exception 'Release dependent travel before removing guardian';end if;
    update public.outreach_team_vehicle_assignments set state='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),revision=revision+1 where id=x.id;
    target:=x.id;
   end if;
  end if;
  if a in('assignment_save','assignment_reassign') then
   select * into m from public.outreach_team_members where campaign_id=c and id=case when a='assignment_reassign' then x.member_id else (p->>'member_id')::uuid end;
   select * into l from public.outreach_team_legs where campaign_id=c and id=case when a='assignment_reassign' then x.leg_id else (p->>'leg_id')::uuid end;
   select * into v from public.outreach_team_vehicles where campaign_id=c and id=(p->>'vehicle_id')::uuid and active;
   role:=p->>'seat_role';
   if m.id is null or v.id is null or l.id is null or not private.outreach_team_ready(c,m.id) then raise exception 'Approved participant with verified age/guardian and active vehicle/leg required';end if;
   if role is null or role not in('driver','co_driver','passenger') then raise exception 'Valid seat role required';end if;
   if role='passenger' and not v.passenger_carrying then raise exception 'Equipment-only vehicle cannot carry passengers';end if;
   if role<>'passenger' and not exists(select 1 from public.outreach_team_driver_reviews r where r.campaign_id=c and r.member_id=m.id and r.vehicle_id=v.id and r.qualified and m.age>=18) then raise exception 'Separate driver qualification review required';end if;
   if m.age<18 and not exists(select 1 from public.outreach_team_vehicle_assignments q where q.campaign_id=c and q.leg_id=l.id and q.vehicle_id=v.id and q.member_id=m.guardian_member_id and q.state<>'cancelled') then raise exception 'Reviewed guardian must occupy same vehicle/leg';end if;
   select count(*),count(*) filter(where seat_role='passenger'),count(*) filter(where seat_role='driver') into occupation,passengers,drivers from public.outreach_team_vehicle_assignments where campaign_id=c and leg_id=l.id and vehicle_id=v.id and state<>'cancelled';
   -- Driver is always included/reserved in total seats; co-driver consumes a seat too.
   if occupation+1+(case when drivers=0 and role<>'driver' then 1 else 0 end)>v.total_capacity or (role='passenger' and passengers+1>v.passenger_capacity) then raise exception 'Vehicle capacity reached';end if;
   insert into public.outreach_team_vehicle_assignments(campaign_id,leg_id,vehicle_id,member_id,seat_role,assigned_by) values(c,l.id,v.id,m.id,role,auth.uid()) returning id into target;
   if a='assignment_reassign' then perform private.outreach_team_record(c,'assignment.replaced',x.id,jsonb_build_object('replacement_id',target,'reason',reason));end if;
  end if;
 else raise exception 'Unknown team/travel action' using errcode='22023';end if;
 perform private.outreach_team_record(c,a,target,jsonb_build_object('reason',nullif(reason,'')));
 return jsonb_build_object('id',target,'saved',true);
end $$;
-- A verified portal link releases only that individual's serving history and
-- confirmed itinerary. It never releases passenger lists, application answers,
-- guardian review evidence, other household members, or driver contact details.
create function private.outreach_team_own(c uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not private.outreach_verified(auth.uid()) then raise exception 'Verified account required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('member_id',m.id,'campaign_id',m.campaign_id,'campaign',e.name,'status',m.status,
  'checked_in_at',m.checked_in_at,'attended_at',m.attended_at,'source_application_status',(select status from public.outreach_volunteer_applications s where s.id=m.application_id),'travel_ready',private.outreach_team_ready(m.campaign_id,m.id),
  'travel',coalesce((select jsonb_agg(jsonb_build_object('leg',l.label,'vehicle',v.label,'state',q.state,
    'itinerary_confirmed',private.outreach_team_confirmation_valid(m.campaign_id,q.id),
    'departure_at',case when private.outreach_team_confirmation_valid(m.campaign_id,q.id) then l.departure_at else null end,
    'departure_location',case when private.outreach_team_confirmation_valid(m.campaign_id,q.id) then l.departure_location else null end,
    'destination',case when private.outreach_team_confirmation_valid(m.campaign_id,q.id) then l.destination else null end))
   from public.outreach_team_vehicle_assignments q join public.outreach_team_legs l on l.id=q.leg_id join public.outreach_team_vehicles v on v.id=q.vehicle_id
   where q.campaign_id=m.campaign_id and q.member_id=m.id and q.state<>'cancelled'),'[]')))
  from public.outreach_team_members m join public.outreach_campaigns e on e.id=m.campaign_id
  where (c is null or m.campaign_id=c) and exists(select 1 from public.portal_account_links k where k.organization_id=m.organization_id and k.person_id=m.person_id and k.active and k.user_id=auth.uid())),'[]');
end $$;
create function public.outreach_team_own(p_campaign uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.outreach_team_own(p_campaign)$$;
create function public.outreach_team_workspace(p_action text,p_campaign uuid,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.outreach_team_workspace(p_action,p_campaign,p_payload)$$;
revoke all on function private.outreach_team_can(uuid,text),private.outreach_team_lock(uuid,text),private.outreach_team_ready(uuid,uuid),private.outreach_team_confirmation_valid(uuid,uuid),private.outreach_team_record(uuid,text,uuid,jsonb),private.outreach_team_workspace(text,uuid,jsonb),public.outreach_team_workspace(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.outreach_team_workspace(text,uuid,jsonb),public.outreach_team_workspace(text,uuid,jsonb) to authenticated;
revoke all on function private.outreach_team_own(uuid),public.outreach_team_own(uuid) from public,anon,authenticated;
grant execute on function private.outreach_team_own(uuid),public.outreach_team_own(uuid) to authenticated;
do $$declare t text;begin
 foreach t in array array['outreach_team_members','outreach_team_legs','outreach_team_vehicles','outreach_team_driver_reviews','outreach_team_vehicle_assignments','outreach_team_history'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
commit;
