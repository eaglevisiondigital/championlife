-- Global Propel Events v1. Forward-only; no Auth, giving or production configuration changes.
create table public.event_settings (
 organization_id uuid primary key references public.organizations(id), timezone text not null default 'UTC',
 approval_required boolean not null default false, revision integer not null default 1
);
insert into public.event_settings(organization_id,timezone) select id,case when slug='champion-life' then 'America/Chicago' else 'UTC' end from public.organizations;
create table public.event_labels (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 kind text not null check(kind in ('audience','type')), name text not null check(length(trim(name)) between 1 and 100),
 active boolean not null default true, revision integer not null default 1,
 unique(organization_id,id), unique(organization_id,kind,name)
);
create table public.event_locations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 campus text not null default '', room text not null default '', name text not null check(length(trim(name)) between 1 and 150),
 address text not null default '', capacity integer check(capacity>=0), timezone text not null default 'UTC',
 active boolean not null default true, internal_notes text not null default '', revision integer not null default 1,
 unique(organization_id,id)
);
create table public.event_series (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), department_id uuid,
 title text not null check(length(trim(title)) between 1 and 200), summary text not null default '' check(length(summary)<=600),
 description text not null default '' check(length(description)<=20000), image_url text not null default '',
 local_start timestamp not null, local_end timestamp not null, timezone text not null,
 frequency text not null default 'once' check(frequency in ('once','daily','weekly','monthly_date','monthly_weekday','yearly')),
 interval_n integer not null default 1 check(interval_n between 1 and 52), weekdays integer[] not null default '{}',
 ordinal integer check(ordinal in (1,2,3,4,-1)), weekday integer check(weekday between 0 and 6),
 until_date date, occurrence_count integer check(occurrence_count between 1 and 10000),
 audience_ids uuid[] not null default '{}', type_id uuid, location_id uuid, custom_location text not null default '',
 attendance_mode text not null default 'in_person' check(attendance_mode in ('in_person','online','hybrid')),
 visibility text not null default 'staff' check(visibility in ('public','member','staff','hidden')),
 status text not null default 'draft' check(status in ('draft','submitted','approved','published','cancelled','archived')),
 registration_mode text not null default 'none' check(registration_mode in ('none','external','native_future')),
 registration_required boolean not null default false, registration_opens timestamptz, registration_closes timestamptz,
 capacity integer check(capacity>=0), registration_url text not null default '', cost_display text not null default '', payment_required boolean not null default false,
 contact_public boolean not null default false, contact_name text not null default '', contact_email text not null default '',
 setup_minutes integer not null default 0 check(setup_minutes between 0 and 1440), cleanup_minutes integer not null default 0 check(cleanup_minutes between 0 and 1440),
 internal_notes text not null default '', checkin_required boolean not null default false, attendance_tracking boolean not null default false,
 revision integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,id),
 foreign key(organization_id,department_id) references public.organization_departments(organization_id,id),
 foreign key(organization_id,location_id) references public.event_locations(organization_id,id),
 foreign key(organization_id,type_id) references public.event_labels(organization_id,id),
 check(isfinite(local_start) and isfinite(local_end) and local_end>local_start and local_end<=local_start+interval '31 days'),
 check(local_start::date between date '2000-01-01' and date '2100-12-31'),
 check(until_date is null or (isfinite(until_date) and until_date>=local_start::date and until_date<=local_start::date+7305)),
 check(registration_closes is null or registration_opens is null or registration_closes>registration_opens),
 check(weekdays <@ array[0,1,2,3,4,5,6] and cardinality(weekdays)<=7),
 check(frequency<>'monthly_weekday' or (ordinal is not null and weekday is not null))
);
create index event_series_scope on public.event_series(organization_id,department_id,status,visibility);
create index event_series_location on public.event_series(organization_id,location_id);
create index event_series_type on public.event_series(organization_id,type_id);
create table public.event_occurrences (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, series_id uuid not null, slot_date date not null,
 starts_at timestamptz not null, ends_at timestamptz not null, scheduled boolean not null default true,
 unique(organization_id,id), unique(series_id,slot_date),
 foreign key(organization_id,series_id) references public.event_series(organization_id,id), check(ends_at>starts_at)
);
create index event_occurrences_range on public.event_occurrences(organization_id,starts_at,ends_at);
create table public.event_exceptions (
 organization_id uuid not null, occurrence_id uuid primary key, cancelled boolean not null default false,
 starts_at timestamptz, ends_at timestamptz, location_override boolean not null default false, location_id uuid, custom_location text not null default '',
 note text not null default '', revision integer not null default 1,
 foreign key(organization_id,occurrence_id) references public.event_occurrences(organization_id,id),
 foreign key(organization_id,location_id) references public.event_locations(organization_id,id),
 check((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null and isfinite(starts_at) and isfinite(ends_at) and ends_at>starts_at and ends_at<=starts_at+interval '31 days'))
);
create index event_exceptions_location on public.event_exceptions(organization_id,location_id);
-- Separate module audit avoids coupling event scope to People/Staff audit permissions.
create table public.event_audit (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), series_id uuid,
 actor_user_id uuid not null references auth.users(id), action text not null, before_state jsonb, after_state jsonb, created_at timestamptz not null default now(),
 foreign key(organization_id,series_id) references public.event_series(organization_id,id)
);
create index event_audit_series on public.event_audit(organization_id,series_id,created_at);

-- Local calendar candidates. Pure, bounded, server-side recurrence; missing month dates are skipped.
create function private.event_slots(s public.event_series, p_from date, p_to date) returns table(slot_date date,starts_at timestamptz,ends_at timestamptz)
language plpgsql stable set search_path='' as $$
declare d date; n integer:=0; matches boolean; months integer; first_date date:=s.local_start::date; start_local timestamp; finish_local timestamp;
begin
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to<p_from or p_to-p_from>400 or p_to>first_date+7305 then raise exception 'Recurrence window exceeds limits'; end if;
 for d in select g::date from pg_catalog.generate_series(first_date::timestamp,least(p_to,coalesce(s.until_date,p_to))::timestamp,interval '1 day') g loop
  months:=(extract(year from d)::int-extract(year from first_date)::int)*12+extract(month from d)::int-extract(month from first_date)::int;
  matches:=case s.frequency
   when 'once' then d=first_date
   when 'daily' then (d-first_date)%s.interval_n=0
   when 'weekly' then ((d-date_trunc('week',first_date)::date)/7)%s.interval_n=0 and extract(dow from d)::int=any(case when cardinality(s.weekdays)=0 then array[extract(dow from first_date)::int] else s.weekdays end)
   when 'monthly_date' then months%s.interval_n=0 and extract(day from d)=extract(day from first_date)
   when 'monthly_weekday' then months%s.interval_n=0 and extract(dow from d)=s.weekday and (case when s.ordinal=-1 then extract(month from d+7)<>extract(month from d) else ((extract(day from d)::int-1)/7)+1=s.ordinal end)
   when 'yearly' then (extract(year from d)::int-extract(year from first_date)::int)%s.interval_n=0 and to_char(d,'MM-DD')=to_char(first_date,'MM-DD') else false end;
  if matches then
   n:=n+1; exit when s.occurrence_count is not null and n>s.occurrence_count;
   if d>=p_from then
    start_local:=d+s.local_start::time; finish_local:=start_local+(s.local_end-s.local_start);
    slot_date:=d; starts_at:=start_local at time zone s.timezone; ends_at:=finish_local at time zone s.timezone;
    -- PostgreSQL standard-time interpretation resolves DST ambiguity. Reject an inverted DST interval.
    if ends_at<=starts_at then raise exception 'DST transition makes this duration invalid; adjust local times'; end if;
    return next;
   end if;
  end if;
 end loop;
end $$;

create function private.event_materialize(p_series uuid,p_from date,p_to date) returns void language plpgsql security definer set search_path='' as $$
declare s public.event_series;
begin
 select * into strict s from public.event_series where id=p_series for update;
 -- Owner-only internal helper. Browser roles cannot execute it, even through the private schema.
 update public.event_occurrences set scheduled=false where series_id=s.id and slot_date between p_from and p_to;
 insert into public.event_occurrences(organization_id,series_id,slot_date,starts_at,ends_at)
 select s.organization_id,s.id,x.slot_date,x.starts_at,x.ends_at from private.event_slots(s,p_from,p_to)x
 on conflict(series_id,slot_date) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,scheduled=true;
end $$;

create function private.event_member(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.portal_account_links l join public.organization_people p on p.organization_id=l.organization_id and p.id=l.person_id
 join auth.users u on u.id=l.user_id join public.person_organization_relationships r on r.organization_id=l.organization_id and r.person_id=l.person_id
 where l.organization_id=p_org and l.user_id=auth.uid() and l.active and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 and r.relationship='member' and r.active and r.effective_at<=now() and (r.expires_at is null or r.expires_at>now()))
$$;

create function private.events_workspace(p_org uuid,p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.event_series; old_s public.event_series; loc public.event_locations; lab public.event_labels; exc public.event_exceptions;
 prior jsonb; result jsonb; target uuid; dept uuid; rev integer; zone text; approval boolean; r record; from_date date; to_date date; actor uuid:=auth.uid();
 allowed text[]:=array['id','revision','department_id','title','summary','description','image_url','local_start','local_end','timezone','frequency','interval_n','weekdays','ordinal','weekday','until_date','occurrence_count','audience_ids','type_id','location_id','custom_location','attendance_mode','visibility','status','registration_mode','registration_required','registration_opens','registration_closes','capacity','registration_url','cost_display','payment_required','contact_public','contact_name','contact_email','setup_minutes','cleanup_minutes','internal_notes','checkin_required','attendance_tracking'];
begin
 if actor is null or not (private.has_staff_permission(p_org,'events.view') or private.has_staff_permission(p_org,'events.manage') or exists(select 1 from public.organization_departments d where d.organization_id=p_org and (private.has_staff_permission(p_org,'events.view',d.id) or private.has_staff_permission(p_org,'events.manage',d.id)))) then raise exception 'Event access denied' using errcode='42501'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>40000 then raise exception 'Invalid event payload'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('events:'||p_org::text,0));
 select timezone,approval_required into zone,approval from public.event_settings where organization_id=p_org;
 zone:=coalesce(zone,'UTC');approval:=coalesce(approval,false);
 if p_action='context' then
  return jsonb_build_object('timezone',zone,'approval_required',approval,'settings_revision',coalesce((select revision from public.event_settings where organization_id=p_org),0),
   'manage_configuration',private.has_staff_permission(p_org,'events.manage'),
   'departments',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'can_manage',private.has_staff_permission(p_org,'events.manage',d.id)) order by d.name),'[]') from public.organization_departments d where d.organization_id=p_org and d.active and (private.has_staff_permission(p_org,'events.view',d.id) or private.has_staff_permission(p_org,'events.manage',d.id))),
   'labels',(select coalesce(jsonb_agg(to_jsonb(l) order by l.name),'[]') from public.event_labels l where organization_id=p_org),
   'locations',(select coalesce(jsonb_agg(case when private.has_staff_permission(p_org,'events.manage') then to_jsonb(l) else to_jsonb(l)-'internal_notes' end order by l.name),'[]') from public.event_locations l where organization_id=p_org));
 end if;
 if p_action in ('settings','label','location') then
  if not private.has_staff_permission(p_org,'events.manage') then raise exception 'Organization event management required' using errcode='42501'; end if;
  target:=nullif(p_data->>'id','')::uuid;rev:=coalesce((p_data->>'revision')::int,0);
  if p_action='settings' then
   if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_data->>'timezone') then raise exception 'Unknown timezone'; end if;
   select to_jsonb(t) into prior from public.event_settings t where organization_id=p_org;
   if coalesce((prior->>'revision')::int,0)<>rev then raise exception 'Stale settings'; end if;
   insert into public.event_settings(organization_id,timezone,approval_required,revision) values(p_org,p_data->>'timezone',(p_data->>'approval_required')::boolean,rev+1)
   on conflict(organization_id) do update set timezone=excluded.timezone,approval_required=excluded.approval_required,revision=excluded.revision returning to_jsonb(event_settings.*) into result;
  elsif p_action='label' then
   select * into lab from public.event_labels where organization_id=p_org and id=target;
   prior:=case when lab.id is not null then to_jsonb(lab) end;
   if (target is not null and lab.id is null) or coalesce(lab.revision,0)<>rev then raise exception 'Stale or unavailable label'; end if;
   insert into public.event_labels(id,organization_id,kind,name,active,revision) values(coalesce(target,gen_random_uuid()),p_org,coalesce(lab.kind,p_data->>'kind'),p_data->>'name',coalesce((p_data->>'active')::boolean,true),rev+1)
   on conflict(id) do update set name=excluded.name,active=excluded.active,revision=excluded.revision returning to_jsonb(event_labels.*) into result;
  else
   select * into loc from public.event_locations where organization_id=p_org and id=target;
   prior:=case when loc.id is not null then to_jsonb(loc) end;
   if (target is not null and loc.id is null) or coalesce(loc.revision,0)<>rev then raise exception 'Stale or unavailable location'; end if;
   if not exists(select 1 from pg_catalog.pg_timezone_names where name=coalesce(nullif(p_data->>'timezone',''),zone)) then raise exception 'Unknown timezone'; end if;
   insert into public.event_locations(id,organization_id,campus,room,name,address,capacity,timezone,active,internal_notes,revision)
   values(coalesce(target,gen_random_uuid()),p_org,coalesce(p_data->>'campus',''),coalesce(p_data->>'room',''),p_data->>'name',coalesce(p_data->>'address',''),(p_data->>'capacity')::int,coalesce(nullif(p_data->>'timezone',''),zone),coalesce((p_data->>'active')::boolean,true),coalesce(p_data->>'internal_notes',''),rev+1)
   on conflict(id) do update set campus=excluded.campus,room=excluded.room,name=excluded.name,address=excluded.address,capacity=excluded.capacity,timezone=excluded.timezone,active=excluded.active,internal_notes=excluded.internal_notes,revision=excluded.revision returning to_jsonb(event_locations.*) into result;
  end if;
  insert into public.event_audit(organization_id,actor_user_id,action,before_state,after_state) values(p_org,actor,p_action,prior,result);return result;
 end if;
 if p_action='list' then
  return (select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc,t.id),'[]') from (select id,title,status,visibility,department_id,local_start,timezone,revision,updated_at from public.event_series where organization_id=p_org and (private.has_staff_permission(p_org,'events.view',department_id) or private.has_staff_permission(p_org,'events.manage',department_id)) order by updated_at desc,id limit 51 offset greatest(0,least(10000,coalesce((p_data->>'page')::int,0)))*50)t);
 end if;
 target:=nullif(p_data->>'id','')::uuid;
 select * into old_s from public.event_series where organization_id=p_org and id=target for update;
 if target is not null and old_s.id is null then raise exception 'Event unavailable' using errcode='42501'; end if;
 if p_action='save' then
  if p_data-allowed<>'{}'::jsonb then raise exception 'Unsupported event fields'; end if;
  dept:=nullif(p_data->>'department_id','')::uuid;
  if not private.has_staff_permission(p_org,'events.manage',dept) or (old_s.id is not null and not private.has_staff_permission(p_org,'events.manage',old_s.department_id)) then raise exception 'Event scope denied' using errcode='42501'; end if;
  if coalesce(old_s.revision,0)<>coalesce((p_data->>'revision')::int,0) then raise exception 'Stale event: reload before saving'; end if;
  if dept is not null and not exists(select 1 from public.organization_departments where organization_id=p_org and id=dept and active) then raise exception 'Inactive department'; end if;
  if old_s.id is null then
   -- Table defaults supply a fully typed initial record; failure later rolls back this insertion.
   insert into public.event_series(organization_id,title,local_start,local_end,timezone,department_id) values(p_org,p_data->>'title',(p_data->>'local_start')::timestamp,(p_data->>'local_end')::timestamp,coalesce(nullif(p_data->>'timezone',''),zone),dept) returning * into s;
  else s:=old_s; end if;
  s:=jsonb_populate_record(s,p_data-array['id','revision','registration_opens','registration_closes']);
  s.registration_opens:=case when p_data->>'registration_opens' ~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then (p_data->>'registration_opens')::timestamptz else (p_data->>'registration_opens')::timestamp at time zone coalesce(nullif(s.timezone,''),zone) end;
  s.registration_closes:=case when p_data->>'registration_closes' ~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then (p_data->>'registration_closes')::timestamptz else (p_data->>'registration_closes')::timestamp at time zone coalesce(nullif(s.timezone,''),zone) end; s.timezone:=coalesce(nullif(s.timezone,''),zone);
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=s.timezone) then raise exception 'Unknown timezone'; end if;
  if s.image_url<>'' and s.image_url !~ '^https://[^[:space:]]+$' then raise exception 'Image must use HTTPS'; end if;
  if s.registration_mode='external' and s.registration_url !~ '^https://[^[:space:]]+$' then raise exception 'External registration needs an HTTPS URL'; end if;
  if exists(select 1 from unnest(s.audience_ids)x where not exists(select 1 from public.event_labels l where l.organization_id=p_org and l.id=x and l.kind='audience' and l.active)) or cardinality(s.audience_ids)>30 then raise exception 'Invalid audience'; end if;
  if s.type_id is not null and not exists(select 1 from public.event_labels where organization_id=p_org and id=s.type_id and kind='type' and active) then raise exception 'Invalid event type'; end if;
  if s.location_id is not null and not exists(select 1 from public.event_locations where organization_id=p_org and id=s.location_id and active) then raise exception 'Location unavailable or inactive'; end if;
  if old_s.id is null and s.status not in ('draft','submitted') then raise exception 'Create a draft before publishing'; end if;
  if old_s.id is not null and s.status<>old_s.status and not (case old_s.status when 'draft' then s.status in ('submitted','approved','published','archived') when 'submitted' then s.status in ('draft','approved','published','archived') when 'approved' then s.status in ('draft','published','archived') when 'published' then s.status in ('draft','cancelled','archived') when 'cancelled' then s.status in ('draft','archived') else s.status='draft' end) then raise exception 'Invalid lifecycle transition'; end if;
  if s.status='published' and old_s.status is distinct from 'published' and approval and old_s.status is distinct from 'approved' then raise exception 'Approval required before publication'; end if;
  if approval and old_s.status='approved' and s.status='published' and (to_jsonb(s)-array['updated_at','revision','status'])<>(to_jsonb(old_s)-array['updated_at','revision','status']) then raise exception 'Approved content changed; return to draft for review'; end if;
  -- Changing approved/published content requires returning to draft when approval is enabled.
  if approval and old_s.status in ('approved','published') and s.status=old_s.status and (to_jsonb(s)-array['updated_at','revision'])<>(to_jsonb(old_s)-array['updated_at','revision']) then raise exception 'Return to draft before changing approved content'; end if;
  s.revision:=coalesce(old_s.revision,0)+1;s.updated_at:=now();
  update public.event_series t set
   (department_id,title,summary,description,image_url,local_start,local_end,timezone,frequency,interval_n,weekdays,ordinal,weekday,until_date,occurrence_count,audience_ids,type_id,location_id,custom_location,attendance_mode,visibility,status,registration_mode,registration_required,registration_opens,registration_closes,capacity,registration_url,cost_display,payment_required,contact_public,contact_name,contact_email,setup_minutes,cleanup_minutes,internal_notes,checkin_required,attendance_tracking,revision,updated_at)=
   (s.department_id,s.title,s.summary,s.description,s.image_url,s.local_start,s.local_end,s.timezone,s.frequency,s.interval_n,s.weekdays,s.ordinal,s.weekday,s.until_date,s.occurrence_count,s.audience_ids,s.type_id,s.location_id,s.custom_location,s.attendance_mode,s.visibility,s.status,s.registration_mode,s.registration_required,s.registration_opens,s.registration_closes,s.capacity,s.registration_url,s.cost_display,s.payment_required,s.contact_public,s.contact_name,s.contact_email,s.setup_minutes,s.cleanup_minutes,s.internal_notes,s.checkin_required,s.attendance_tracking,s.revision,s.updated_at)
   where t.id=s.id;
  -- Preserve identity and exceptions for removed dates; retire obsolete regular slots, including outside this window.
  update public.event_occurrences set scheduled=false where series_id=s.id;
  from_date:=greatest(s.local_start::date,least(current_date,s.local_start::date+6905));
  perform private.event_materialize(s.id,from_date,least(from_date+366,s.local_start::date+7305));
  result:=to_jsonb(s);
  insert into public.event_audit(organization_id,series_id,actor_user_id,action,before_state,after_state) values(p_org,s.id,actor,case when old_s.id is null then 'created' when old_s.status<>s.status then 'status:'||s.status else 'series_edited' end,case when old_s.id is not null then to_jsonb(old_s) end,result);
  return result;
 end if;
 if old_s.id is null or not (private.has_staff_permission(p_org,'events.view',old_s.department_id) or private.has_staff_permission(p_org,'events.manage',old_s.department_id)) then raise exception 'Event unavailable' using errcode='42501'; end if;
 if p_action='exception' then
  if not private.has_staff_permission(p_org,'events.manage',old_s.department_id) then raise exception 'Event scope denied' using errcode='42501'; end if;
  if old_s.revision<>(p_data->>'series_revision')::int or p_data->>'series_revision' is null then raise exception 'Stale series'; end if;
  target:=(p_data->>'occurrence_id')::uuid;
  if not exists(select 1 from public.event_occurrences where organization_id=p_org and series_id=old_s.id and id=target) then raise exception 'Occurrence unavailable'; end if;
  select * into exc from public.event_exceptions where occurrence_id=target;
  if coalesce(exc.revision,0)<>coalesce((p_data->>'revision')::int,0) then raise exception 'Stale occurrence'; end if;
  if nullif(p_data->>'location_id','') is not null and not exists(select 1 from public.event_locations where organization_id=p_org and id=(p_data->>'location_id')::uuid and active) then raise exception 'Location unavailable'; end if;
  if approval and old_s.status in ('approved','published') then raise exception 'Return series to draft before changing approved occurrences'; end if;
  prior:=case when exc.occurrence_id is not null then to_jsonb(exc) end;
  insert into public.event_exceptions(organization_id,occurrence_id,cancelled,starts_at,ends_at,location_override,location_id,custom_location,note,revision)
  values(p_org,target,coalesce((p_data->>'cancelled')::boolean,false),case when p_data ? 'starts_local' then (p_data->>'starts_local')::timestamp at time zone old_s.timezone else (p_data->>'starts_at')::timestamptz end,case when p_data ? 'ends_local' then (p_data->>'ends_local')::timestamp at time zone old_s.timezone else (p_data->>'ends_at')::timestamptz end,coalesce((p_data->>'location_override')::boolean,false),nullif(p_data->>'location_id','')::uuid,coalesce(p_data->>'custom_location',''),coalesce(p_data->>'note',''),coalesce(exc.revision,0)+1)
  on conflict(occurrence_id) do update set cancelled=excluded.cancelled,starts_at=excluded.starts_at,ends_at=excluded.ends_at,location_override=excluded.location_override,location_id=excluded.location_id,custom_location=excluded.custom_location,note=excluded.note,revision=excluded.revision returning to_jsonb(event_exceptions.*) into result;
  update public.event_series set revision=revision+1,updated_at=now() where id=old_s.id;
  insert into public.event_audit(organization_id,series_id,actor_user_id,action,before_state,after_state) values(p_org,old_s.id,actor,'occurrence_exception',prior,result);return result;
 elsif p_action='detail' then
  from_date:=coalesce((p_data->>'from')::date,greatest(old_s.local_start::date,least(current_date,old_s.local_start::date+6905)));
  to_date:=coalesce((p_data->>'to')::date,least(from_date+366,old_s.local_start::date+7305));
  perform private.event_materialize(old_s.id,from_date,to_date);
  return jsonb_build_object('series',to_jsonb(old_s),'can_manage',private.has_staff_permission(p_org,'events.manage',old_s.department_id),
   'occurrences',(select coalesce(jsonb_agg(to_jsonb(o)||jsonb_build_object('exception',to_jsonb(e)) order by o.starts_at),'[]') from public.event_occurrences o left join public.event_exceptions e on e.occurrence_id=o.id where o.series_id=old_s.id and (o.slot_date between from_date and to_date or e.occurrence_id is not null)),
   'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]') from (select action,actor_user_id,created_at from public.event_audit where series_id=old_s.id order by created_at desc limit 30)a),
   'conflicts',private.event_conflicts(old_s.id));
 end if;
 raise exception 'Unknown events action';
end $$;

-- Internal effective schedule joins preserve overrides without mutating base occurrence identity.
create view private.event_schedule with (security_invoker=true) as
 select o.id,o.organization_id,o.series_id,o.slot_date,coalesce(e.starts_at,o.starts_at) starts_at,coalesce(e.ends_at,o.ends_at) ends_at,
 coalesce(e.cancelled,false) cancelled,(o.scheduled or e.occurrence_id is not null) retained,
 case when e.location_override then e.location_id else s.location_id end location_id,
 case when e.location_override then e.custom_location else s.custom_location end custom_location
 from public.event_occurrences o join public.event_series s on s.id=o.series_id left join public.event_exceptions e on e.occurrence_id=o.id;
revoke all on private.event_schedule from public,anon,authenticated;

create function private.event_conflicts(p_series uuid) returns bigint language sql stable security definer set search_path='' as $$
 select count(*) from private.event_schedule a join private.event_schedule b
 on b.organization_id=a.organization_id and b.series_id<>a.series_id and b.location_id=a.location_id and a.starts_at<b.ends_at and b.starts_at<a.ends_at
 join public.event_series sb on sb.id=b.series_id
 where a.series_id=p_series and a.retained and b.retained and not a.cancelled and not b.cancelled and sb.status not in ('cancelled','archived')
 and (private.has_staff_permission(a.organization_id,'events.view',(select department_id from public.event_series where id=p_series)) or private.has_staff_permission(a.organization_id,'events.manage',(select department_id from public.event_series where id=p_series)))
$$;
-- Public read surface. Only safe fields are constructed. Hidden events are staff-only even with a guessed UUID.
create function private.events_catalog(p_slug text,p_from date,p_to date,p_filters jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid; zone text; member_ok boolean; series_record public.event_series; ids uuid[]; result jsonb;
begin
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to<p_from or p_to-p_from>93 or p_from<current_date-366 or p_to>current_date+730 then raise exception 'Choose a date window of at most 93 days within the supported calendar'; end if;
 if p_filters is null or jsonb_typeof(p_filters)<>'object' or octet_length(p_filters::text)>2000 then raise exception 'Invalid filters'; end if;
 select o.id,coalesce(es.timezone,'UTC') into org,zone from public.organizations o left join public.event_settings es on es.organization_id=o.id where o.slug=p_slug;
 if org is null then return jsonb_build_object('timezone','UTC','events','[]'::jsonb,'labels','[]'::jsonb,'departments','[]'::jsonb);end if;
 member_ok:=private.event_member(org);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('events:'||org::text,0));
 select array_agg(id) into ids from (select id from public.event_series s where s.organization_id=org and s.status='published'
 and (s.visibility='public' or (s.visibility='member' and member_ok) or private.has_staff_permission(org,'events.view',s.department_id) or private.has_staff_permission(org,'events.manage',s.department_id))
 and (nullif(p_filters->>'id','') is null or s.id=(p_filters->>'id')::uuid)
 and (nullif(p_filters->>'department_id','') is null or s.department_id=(p_filters->>'department_id')::uuid)
 and (nullif(p_filters->>'audience_id','') is null or (p_filters->>'audience_id')::uuid=any(s.audience_ids))
 and (nullif(p_filters->>'type_id','') is null or s.type_id=(p_filters->>'type_id')::uuid)
 order by id limit 201)t;
 if cardinality(ids)>200 then raise exception 'Narrow the filters to at most 200 series'; end if;
 for series_record in select * from public.event_series where id=any(ids) order by id loop
  if p_from<=series_record.local_start::date+7305 and series_record.local_start::date<=p_to+1 then perform private.event_materialize(series_record.id,greatest(series_record.local_start::date,p_from-31),least(p_to+1,series_record.local_start::date+7305));end if;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',s.id,'title',s.title,'summary',s.summary,'description',s.description,'image_url',s.image_url,'timezone',s.timezone,
  'department',case when d.id is not null then jsonb_build_object('id',d.id,'name',d.name) end,
  'audiences',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name) order by l.name),'[]') from public.event_labels l where l.organization_id=org and l.id=any(s.audience_ids)),
  'type',case when t.id is not null then jsonb_build_object('id',t.id,'name',t.name) end,
  'recurrence',jsonb_build_object('frequency',s.frequency,'interval',s.interval_n,'weekdays',s.weekdays,'ordinal',s.ordinal,'weekday',s.weekday,'until',s.until_date,'count',s.occurrence_count,'start',s.local_start),
  'attendance_mode',s.attendance_mode,'contact',case when s.contact_public then jsonb_build_object('name',s.contact_name,'email',s.contact_email) end,
  'registration',jsonb_build_object('mode',s.registration_mode,'required',s.registration_required,'opens',s.registration_opens,'closes',s.registration_closes,'capacity',s.capacity,'url',case when s.registration_mode='external' then s.registration_url else '' end,'cost',s.cost_display,'payment_required',s.payment_required),
  'occurrences',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'starts_at',x.starts_at,'ends_at',x.ends_at,'cancelled',x.cancelled,
    'location',case when x.custom_location<>'' then jsonb_build_object('name',x.custom_location) when l.id is not null then jsonb_build_object('name',l.name,'campus',l.campus,'room',l.room,'address',l.address) end) order by x.starts_at,x.id),'[]')
    from private.event_schedule x left join public.event_locations l on l.organization_id=org and l.id=x.location_id
    where x.series_id=s.id and x.retained and x.ends_at>=(p_from::timestamp at time zone zone) and x.starts_at<((p_to+1)::timestamp at time zone zone))
 ) order by s.title,s.id),'[]') into result
 from public.event_series s left join public.organization_departments d on d.id=s.department_id left join public.event_labels t on t.id=s.type_id where s.id=any(ids);
 return jsonb_build_object('timezone',zone,'events',result,
  'labels',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',kind) order by name),'[]') from public.event_labels where organization_id=org and active),
  'departments',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name) order by d.name),'[]') from public.organization_departments d where d.organization_id=org and d.active and exists(select 1 from public.event_series s where s.id=any(ids) and s.department_id=d.id)));
end $$;

create function public.events_workspace(p_org uuid,p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.events_workspace(p_org,p_action,p_data)$$;
create function public.events_catalog(p_slug text,p_from date,p_to date,p_filters jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.events_catalog(p_slug,p_from,p_to,p_filters)$$;

alter table public.event_settings enable row level security;
alter table public.event_labels enable row level security;
alter table public.event_locations enable row level security;
alter table public.event_series enable row level security;
alter table public.event_occurrences enable row level security;
alter table public.event_exceptions enable row level security;
alter table public.event_audit enable row level security;
revoke all on public.event_settings,public.event_labels,public.event_locations,public.event_series,public.event_occurrences,public.event_exceptions,public.event_audit from public,anon,authenticated;
grant all on public.event_settings,public.event_labels,public.event_locations,public.event_series,public.event_occurrences,public.event_exceptions,public.event_audit to service_role;
revoke all on function private.event_slots(public.event_series,date,date),private.event_materialize(uuid,date,date),private.event_member(uuid),private.event_conflicts(uuid),private.events_workspace(uuid,text,jsonb),private.events_catalog(text,date,date,jsonb),public.events_workspace(uuid,text,jsonb),public.events_catalog(text,date,date,jsonb) from public,anon,authenticated;
grant usage on schema private to anon,authenticated;
grant execute on function private.events_workspace(uuid,text,jsonb),public.events_workspace(uuid,text,jsonb) to authenticated;
-- This guarded, safe projection is the sole intentionally anonymous private implementation.
grant execute on function private.events_catalog(text,date,date,jsonb),public.events_catalog(text,date,date,jsonb) to anon,authenticated;
