-- Forward-only current-main adaptation. No source registration is rewritten.

-- Extracted from PR #29: 20261018124500_unified_staff_workspace_v1.sql
-- Unified Staff Workspace v1
-- Adds campaign-aware decision/follow-up access and controlled staff profile management.
-- Existing Huntsville family registration/check-in remains unchanged.

alter table public.outreach_campaign_assignments
  drop constraint outreach_campaign_assignments_capabilities_check;

alter table public.outreach_campaign_assignments
  add constraint outreach_campaign_assignments_capabilities_check check (
    capabilities <@ array[
      'view',
      'registration.view','registration.manage','registration.export','checkin.manage',
      'decision.view','decision.manage',
      'team.view','team.manage','travel.view','travel.manage'
    ]::text[]
    and cardinality(capabilities)>0
    and array_position(capabilities,null) is null
    and (not(capabilities && array['registration.manage','registration.export','checkin.manage']) or 'registration.view'=any(capabilities))
    and (not('decision.manage'=any(capabilities)) or 'decision.view'=any(capabilities))
    and (not('team.manage'=any(capabilities)) or 'team.view'=any(capabilities))
    and (not('travel.manage'=any(capabilities)) or 'travel.view'=any(capabilities))
  );

create table public.outreach_decision_campaign_sources (
  campaign_id uuid primary key references public.outreach_campaigns(id),
  source text not null unique check(source ~ '^[a-z0-9_]{3,80}$'),
  active boolean not null default true
);

create table public.outreach_decision_followup (
  registration_id uuid primary key references public.outreach_registrations(id) on delete cascade,
  campaign_id uuid not null references public.outreach_campaigns(id),
  status text not null default 'new' check(status in ('new','contacting','connected','discipleship','closed')),
  assigned_user_id uuid references auth.users(id),
  notes text not null default '' check(length(notes)<=4000),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  revision integer not null default 1
);
create index outreach_decision_followup_campaign_idx on public.outreach_decision_followup(campaign_id,status,updated_at desc);

do $$
declare
  o uuid;
  c uuid;
begin
  select id into strict o from public.organizations where slug='sowgo';

  select id into c from public.outreach_campaigns
   where organization_id=o and code='bessemer_al_2026';

  if c is null then
    if exists(select 1 from public.outreach_campaigns where public_slug='bessemer-2026') then
      raise exception 'Bessemer public slug already exists outside expected campaign';
    end if;
    insert into public.outreach_campaigns(
      organization_id,code,name,public_slug,city,state_province,country,timezone,venue,status,public_page
    ) values (
      o,'bessemer_al_2026','Bessemer Outreach','bessemer-2026','Bessemer','AL','US','America/Chicago',
      '{}'::jsonb,'completed','/bessemer/'
    ) returning id into c;
  end if;

  insert into public.outreach_decision_campaign_sources(campaign_id,source)
  values(c,'bessemer_al_2026')
  on conflict(campaign_id) do update set source=excluded.source,active=true;

  select id into strict c from public.outreach_campaigns
   where organization_id=o and code='huntsville_al_2026';

  update public.outreach_campaigns
     set public_page='/huntsville/'
   where id=c and public_page is null;

  insert into public.outreach_decision_campaign_sources(campaign_id,source)
  values(c,'huntsville_al_2026')
  on conflict(campaign_id) do update set source=excluded.source,active=true;
end $$;

create function private.outreach_decision_can(p_campaign uuid,p_cap text)
returns boolean
language sql stable security definer set search_path=''
as $$
 select
   p_cap in ('decision.view','decision.manage')
   and private.outreach_verified(auth.uid())
   and exists(
     select 1
       from public.outreach_campaigns c
      where c.id=p_campaign
        and (
          private.outreach_admin(c.organization_id,p_cap='decision.manage')
          or exists(
            select 1
              from public.outreach_campaign_assignments a
             where a.campaign_id=c.id
               and a.user_id=auth.uid()
               and a.active
               and a.effective_at<=now()
               and (a.expires_at is null or a.expires_at>now())
               and 'view'=any(a.capabilities)
               and p_cap=any(a.capabilities)
          )
        )
   )
$$;

create function private.outreach_decision_workspace(p_action text,p_campaign uuid,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  c public.outreach_campaigns;
  src text;
  r public.outreach_registrations;
  f public.outreach_decision_followup;
  search_text text;
  next_status text;
begin
  if not private.outreach_verified(auth.uid()) then
    raise exception 'Verified sign-in required' using errcode='42501';
  end if;

  if p_action='campaigns' then
    return coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',c.id,'name',c.name,'code',c.code,'city',c.city,'state_province',c.state_province,
          'country',c.country,'status',c.status,'public_page',c.public_page,
          'decision_count',(select count(*) from public.outreach_registrations r where r.source=s.source),
          'salvation_count',(select count(*) from public.outreach_registrations r where r.source=s.source and r.decision='salvation'),
          'rededication_count',(select count(*) from public.outreach_registrations r where r.source=s.source and r.decision='rededication'),
          'followup_count',(select count(*) from public.outreach_registrations r where r.source=s.source and r.decision='prayer_followup')
        )
        order by c.name
      )
      from public.outreach_campaigns c
      join public.outreach_decision_campaign_sources s on s.campaign_id=c.id and s.active
      where private.outreach_decision_can(c.id,'decision.view')
    ),'[]'::jsonb);
  end if;

  select * into c from public.outreach_campaigns where id=p_campaign;
  select source into src from public.outreach_decision_campaign_sources where campaign_id=p_campaign and active;
  if c.id is null or src is null or not private.outreach_decision_can(p_campaign,'decision.view') then
    raise exception 'Decision workspace access denied' using errcode='42501';
  end if;

  if p_action='context' then
    return jsonb_build_object(
      'campaign',jsonb_build_object(
        'id',c.id,'name',c.name,'code',c.code,'city',c.city,'state_province',c.state_province,
        'country',c.country,'status',c.status,'public_page',c.public_page
      ),
      'capabilities',jsonb_build_array('decision.view') ||
        case when private.outreach_decision_can(p_campaign,'decision.manage')
          then jsonb_build_array('decision.manage') else '[]'::jsonb end
    );
  end if;

  if p_action='list' then
    search_text:=left(btrim(coalesce(p_payload->>'search','')),100);
    return jsonb_build_object(
      'summary',jsonb_build_object(
        'total',(select count(*) from public.outreach_registrations x where x.source=src),
        'salvation',(select count(*) from public.outreach_registrations x where x.source=src and x.decision='salvation'),
        'rededication',(select count(*) from public.outreach_registrations x where x.source=src and x.decision='rededication'),
        'learn_more',(select count(*) from public.outreach_registrations x where x.source=src and x.decision='learn_more'),
        'prayer_followup',(select count(*) from public.outreach_registrations x where x.source=src and x.decision='prayer_followup'),
        'open_followup',(select count(*) from public.outreach_registrations x
          left join public.outreach_decision_followup y on y.registration_id=x.id
          where x.source=src and coalesce(y.status,'new')<>'closed')
      ),
      'registrations',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',x.id,'name',x.first_name||' '||x.last_name,'first_name',x.first_name,'last_name',x.last_name,
          'email',x.email,'phone',x.phone,'decision',x.decision,'created_at',x.created_at,
          'followup_status',coalesce(y.status,'new'),'assigned_user_id',y.assigned_user_id,'revision',coalesce(y.revision,0)
        ) order by x.created_at desc)
        from public.outreach_registrations x
        left join public.outreach_decision_followup y on y.registration_id=x.id
        where x.source=src
          and (
            search_text=''
            or concat_ws(' ',x.first_name,x.last_name,x.email,x.phone,x.decision) ilike
              '%'||replace(replace(search_text,'%','\%'),'_','\_')||'%'
          )
      ),'[]'::jsonb)
    );
  end if;

  if p_payload->>'registration_id' is null then
    raise exception 'Registration required';
  end if;
  select * into r from public.outreach_registrations
   where id=(p_payload->>'registration_id')::uuid and source=src;
  if r.id is null then raise exception 'Registration outside campaign' using errcode='42501'; end if;

  if p_action='detail' then
    select * into f from public.outreach_decision_followup where registration_id=r.id;
    return jsonb_build_object(
      'id',r.id,'first_name',r.first_name,'last_name',r.last_name,'email',r.email,'phone',r.phone,
      'decision',r.decision,'prayer_request',r.prayer_request,'created_at',r.created_at,'consent',r.consent,
      'followup_status',coalesce(f.status,'new'),'assigned_user_id',f.assigned_user_id,
      'notes',coalesce(f.notes,''),'revision',coalesce(f.revision,0)
    );
  end if;

  if p_action='save' then
    if not private.outreach_decision_can(p_campaign,'decision.manage') then
      raise exception 'Decision management access denied' using errcode='42501';
    end if;
    next_status:=p_payload->>'status';
    if next_status not in ('new','contacting','connected','discipleship','closed') then
      raise exception 'Invalid follow-up status';
    end if;
    if coalesce((p_payload->>'revision')::int,0)=0 then
      insert into public.outreach_decision_followup(
        registration_id,campaign_id,status,assigned_user_id,notes,updated_by
      ) values (
        r.id,p_campaign,next_status,
        nullif(p_payload->>'assigned_user_id','')::uuid,
        left(coalesce(p_payload->>'notes',''),4000),auth.uid()
      )
      on conflict(registration_id) do nothing;
      if not found then raise exception 'Follow-up changed; reload'; end if;
    else
      update public.outreach_decision_followup
         set status=next_status,
             assigned_user_id=nullif(p_payload->>'assigned_user_id','')::uuid,
             notes=left(coalesce(p_payload->>'notes',''),4000),
             updated_by=auth.uid(),updated_at=now(),revision=revision+1
       where registration_id=r.id and revision=(p_payload->>'revision')::int;
      if not found then raise exception 'Follow-up changed; reload'; end if;
    end if;
    perform private.outreach_audit(p_campaign,c.organization_id,'decision.followup_updated',r.id,
      jsonb_build_object('status',next_status));
    return jsonb_build_object('saved',true);
  end if;

  raise exception 'Unsupported decision action';
end $$;

create function public.outreach_decision_workspace(
  p_action text,p_campaign uuid default null,p_payload jsonb default '{}'
) returns jsonb
language sql security invoker set search_path=''
as $$ select private.outreach_decision_workspace(p_action,p_campaign,p_payload) $$;

create function private.outreach_access_admin()
returns boolean language sql stable security definer set search_path=''
as $$
 select private.outreach_verified(auth.uid()) and exists(
   select 1 from public.organizations o
   where o.slug in ('champion-life','sowgo') and private.outreach_admin(o.id,true)
 )
$$;

create function private.outreach_access_workspace(p_action text,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  uid uuid;
  email_value text;
  display_value text;
  profile text;
  cid uuid;
  champion uuid;
  sowgo uuid;
  perms text[];
  p text;
  cap text[];
begin
  if not private.outreach_access_admin() then
    raise exception 'Staff access management denied' using errcode='42501';
  end if;
  select id into strict champion from public.organizations where slug='champion-life';
  select id into strict sowgo from public.organizations where slug='sowgo';

  if p_action='list' then
    return jsonb_build_object(
      'users',coalesce((
        select jsonb_agg(jsonb_build_object(
          'user_id',u.id,'email',u.email,'confirmed',u.email_confirmed_at is not null,
          'organizations',coalesce((
            select jsonb_agg(jsonb_build_object('slug',o.slug,'display_name',d.display_name,'active',d.active))
            from public.organization_staff_directory d join public.organizations o on o.id=d.organization_id
            where d.user_id=u.id
          ),'[]'::jsonb),
          'campaigns',coalesce((
            select jsonb_agg(jsonb_build_object('campaign_id',a.campaign_id,'name',c.name,'capabilities',a.capabilities,'active',a.active))
            from public.outreach_campaign_assignments a join public.outreach_campaigns c on c.id=a.campaign_id
            where a.user_id=u.id
          ),'[]'::jsonb)
        ) order by lower(u.email))
        from auth.users u
        where exists(select 1 from public.organization_staff_directory d where d.user_id=u.id)
           or exists(select 1 from public.outreach_campaign_assignments a where a.user_id=u.id)
      ),'[]'::jsonb),
      'campaigns',coalesce((
        select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'code',c.code,'status',c.status) order by c.name)
        from public.outreach_campaigns c
      ),'[]'::jsonb)
    );
  end if;

  email_value:=lower(btrim(coalesce(p_payload->>'email','')));
  display_value:=left(btrim(coalesce(p_payload->>'display_name','')),150);
  profile:=p_payload->>'profile';
  if email_value='' or display_value='' then raise exception 'Email and display name required'; end if;
  select id into uid from auth.users where lower(email)=email_value;
  if uid is null then raise exception 'Account not created yet. Send the sign-in invitation first.'; end if;

  if profile in ('champion_full','outreach_full') then
    if profile='champion_full' then
      perms:=array[
        'people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage',
        'staff.view','staff.manage','finance.read','finance.configure','care.read','discipleship.read',
        'followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage',
        'portal.manage','events.view','events.manage','registrations.view','registrations.manage',
        'outreach.view','outreach.manage','courses.manage','forms.view','forms.manage','communications.send'
      ]::text[];
      foreach cid in array array[champion,sowgo] loop
        insert into public.organization_staff_directory(organization_id,user_id,display_name,active,effective_at,expires_at,reason)
        values(cid,uid,display_value,true,now(),null,'Owner-approved full Champion Life and Outreach staff access.')
        on conflict(organization_id,user_id) do update set display_name=excluded.display_name,active=true,expires_at=null,reason=excluded.reason,revision=public.organization_staff_directory.revision+1,updated_at=now();
        foreach p in array perms loop
          insert into public.organization_staff_permissions(organization_id,user_id,permission,revoked_at,department_ids,effective_at,expires_at,template_id)
          values(cid,uid,p,null,null,now(),null,null)
          on conflict(organization_id,user_id,permission) do update set revoked_at=null,department_ids=null,effective_at=least(public.organization_staff_permissions.effective_at,excluded.effective_at),expires_at=null,template_id=null;
        end loop;
        insert into public.outreach_campaign_admins(organization_id,user_id,capability,active,effective_at,expires_at,reason)
        values(cid,uid,'manage',true,now(),null,'Owner-approved full Outreach administration.')
        on conflict(organization_id,user_id) do update set capability='manage',active=true,expires_at=null,reason=excluded.reason;
      end loop;
    else
      perms:=array[
        'people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage',
        'staff.view','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage',
        'portal.manage','events.view','events.manage','registrations.view','registrations.manage',
        'outreach.view','outreach.manage','forms.view','forms.manage','communications.send'
      ]::text[];
      insert into public.organization_staff_directory(organization_id,user_id,display_name,active,effective_at,expires_at,reason)
      values(sowgo,uid,display_value,true,now(),null,'Owner-approved full Outreach staff access.')
      on conflict(organization_id,user_id) do update set display_name=excluded.display_name,active=true,expires_at=null,reason=excluded.reason,revision=public.organization_staff_directory.revision+1,updated_at=now();
      foreach p in array perms loop
        insert into public.organization_staff_permissions(organization_id,user_id,permission,revoked_at,department_ids,effective_at,expires_at,template_id)
        values(sowgo,uid,p,null,null,now(),null,null)
        on conflict(organization_id,user_id,permission) do update set revoked_at=null,department_ids=null,effective_at=least(public.organization_staff_permissions.effective_at,excluded.effective_at),expires_at=null,template_id=null;
      end loop;
      insert into public.outreach_campaign_admins(organization_id,user_id,capability,active,effective_at,expires_at,reason)
      values(sowgo,uid,'manage',true,now(),null,'Owner-approved full Outreach administration.')
      on conflict(organization_id,user_id) do update set capability='manage',active=true,expires_at=null,reason=excluded.reason;
    end if;
  elsif profile in ('campaign_followup','campaign_operations') then
    cid:=(p_payload->>'campaign_id')::uuid;
    if not exists(select 1 from public.outreach_campaigns c where c.id=cid) then raise exception 'Campaign required'; end if;
    cap:=case when profile='campaign_followup'
      then array['view','decision.view','decision.manage']::text[]
      else array['view','registration.view','registration.manage','registration.export','checkin.manage','decision.view','decision.manage']::text[]
    end;
    insert into public.outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,effective_at,expires_at,active,reason)
    values(cid,uid,'local_coordinator',cap,now(),null,true,'Owner-approved campaign-scoped staff access.')
    on conflict(campaign_id,user_id) do update set role_key='local_coordinator',capabilities=excluded.capabilities,active=true,expires_at=null,reason=excluded.reason,revision=public.outreach_campaign_assignments.revision+1;
  else
    raise exception 'Invalid staff profile';
  end if;

  return jsonb_build_object('saved',true,'user_id',uid);
end $$;

create function public.outreach_access_workspace(p_action text,p_payload jsonb default '{}')
returns jsonb language sql security invoker set search_path=''
as $$ select private.outreach_access_workspace(p_action,p_payload) $$;

alter table public.outreach_decision_campaign_sources enable row level security;
alter table public.outreach_decision_followup enable row level security;
revoke all on public.outreach_decision_campaign_sources from public,anon,authenticated;
revoke all on public.outreach_decision_followup from public,anon,authenticated;
grant all on public.outreach_decision_campaign_sources,public.outreach_decision_followup to service_role;

revoke all on function private.outreach_decision_can(uuid,text),
 private.outreach_decision_workspace(text,uuid,jsonb),
 public.outreach_decision_workspace(text,uuid,jsonb),
 private.outreach_access_admin(),
 private.outreach_access_workspace(text,jsonb),
 public.outreach_access_workspace(text,jsonb)
from public,anon,authenticated;

grant execute on function public.outreach_decision_workspace(text,uuid,jsonb) to authenticated;
grant execute on function public.outreach_access_workspace(text,jsonb) to authenticated;


-- Extracted from PR #29: 20261018124600_unified_staff_team_travel_v1.sql
-- Reconciled Phase B team/travel slice for current production main.
-- Based on accepted Phase B behavior, adjusted only for the current minimal campaign core and unified capability model.
-- Phase B candidate: additive campaign operations, never a second Person/household model.
-- People Staff v1 replaced this baseline check but omitted existing Household event kinds.
-- Restore those kinds so canonical Household writes retain their original audit trigger.
alter table public.organization_admin_events drop constraint organization_admin_events_kind_check;
alter table public.organization_admin_events add constraint organization_admin_events_kind_check check(kind in ('staff_access','person_created','person_updated','person_relationship','department_affiliation','role_template','household_created','household_updated','household_member_added','household_member_updated'));
alter table public.outreach_campaign_events drop constraint outreach_campaign_events_kind_check;
alter table public.outreach_campaign_events add constraint outreach_campaign_events_kind_check check(kind in (
 'outreach.registration.submitted','outreach.registration.updated','outreach.waiver.signed','outreach.registration.confirmed',
 'outreach.attendee.checked_in','outreach.attendee.checkin_reversed','outreach.walkup.registered',
 'team_signup.submitted','team_signup.approved','team_signup.waitlisted','team_signup.not_selected',
 'vehicle.assigned','vehicle.changed','lodging.assigned','lodging.changed','trip_details.updated',
 'departure_reminder','team_role.assigned','team.action_required'
));
create table public.outreach_team_settings (
 campaign_id uuid primary key references public.outreach_campaigns(id), enabled boolean not null default false,
 opens_at timestamptz, closes_at timestamptz, window_override text not null default 'scheduled' check(window_override in ('scheduled','open','closed')),
 official_capacity integer check(official_capacity between 0 and 10000), multiple_roles boolean not null default true,
 participant_notes text not null default '' check(length(participant_notes)<=2000), arrival_target timestamptz,
 coordination_name text not null default '' check(length(coordination_name)<=160), coordination_phone text not null default '' check(length(coordination_phone)<=40),
 revision integer not null default 1, check(closes_at is null or opens_at is null or closes_at>opens_at)
);
create table public.outreach_team_roles (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id),
 name text not null check(length(btrim(name)) between 1 and 100), active boolean not null default true, unique(campaign_id,id),unique(campaign_id,name)
);
-- A signup is an intake snapshot awaiting reviewed canonical identity, not a new contact database.
create table public.outreach_team_signups (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, organization_id uuid not null,
 applicant_user_id uuid not null references auth.users(id), household_id uuid, party_label text not null check(length(btrim(party_label)) between 1 and 150),
 submitted_at timestamptz not null default now(), notes text not null default '' check(length(notes)<=2000), revision integer not null default 1,
 foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id),
 foreign key(organization_id,household_id) references public.households(organization_id,id), unique(campaign_id,applicant_user_id),unique(campaign_id,id)
);
create index outreach_team_signup_org_idx on public.outreach_team_signups(organization_id,household_id);
create index outreach_team_signup_user_idx on public.outreach_team_signups(applicant_user_id,campaign_id);
create table public.outreach_team_members (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, signup_id uuid not null, organization_id uuid not null,
 person_id uuid, primary_applicant boolean not null default false, first_name text not null check(length(btrim(first_name)) between 1 and 100), last_name text not null check(length(btrim(last_name)) between 1 and 100),
 email text check(email is null or (length(email)<=320 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')), phone text check(phone is null or length(phone)<=40),
 relationship text not null check(relationship in ('self','spouse','child','dependent','family')), age integer not null check(age between 0 and 120),
 guardian_member_id uuid, guardian_reviewed boolean not null default false, party_access_reviewed boolean not null default false,
 attending boolean not null default true, volunteering boolean not null default false,
 status text not null default 'applied' check(status in ('applied','under_review','approved','waitlisted','not_selected','self_traveling','guest','cancelled')),
 transport_preference text not null default 'needs_ride' check(transport_preference in ('driving_self','willing_to_drive','needs_ride','own_transport','traveling_separately')),
 travel_mode text not null default 'independent' check(travel_mode in ('official_vehicle','self_driving','riding_with_participant','independent','not_traveling','local_attendee')),
 lodging_preference text not null default 'undecided' check(lodging_preference in ('needs_lodging','own_lodging','family_friends','local','undecided')),
 preferred_roles uuid[] not null default '{}', secondary_roles uuid[] not null default '{}', willing_anywhere boolean not null default false,
 available_vehicle jsonb not null default '{}' check(jsonb_typeof(available_vehicle)='object' and octet_length(available_vehicle::text)<=2000),
 notes text not null default '' check(length(notes)<=2000), consent_state text not null default 'phase_c_pending' check(consent_state='phase_c_pending'),
 revision integer not null default 1, updated_at timestamptz not null default now(), unique(campaign_id,id),unique(signup_id,id),
 foreign key(campaign_id,signup_id) references public.outreach_team_signups(campaign_id,id),
 foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),
 foreign key(signup_id,guardian_member_id) references public.outreach_team_members(signup_id,id),
 check(not primary_applicant or (relationship='self' and age>=18)), check(age>=18 or guardian_member_id is not null),check(not volunteering or attending)
);
create unique index outreach_team_primary_idx on public.outreach_team_members(signup_id) where primary_applicant;
create unique index outreach_team_person_idx on public.outreach_team_members(campaign_id,person_id) where person_id is not null;
create index outreach_team_member_signup_idx on public.outreach_team_members(signup_id);
create index outreach_team_member_guardian_idx on public.outreach_team_members(guardian_member_id);
create index outreach_team_member_status_idx on public.outreach_team_members(campaign_id,status);
create table public.outreach_team_guardian_links (
 campaign_id uuid not null, primary_person_id uuid not null references public.organization_people(id), dependent_person_id uuid not null references public.organization_people(id),
 active boolean not null default true, reviewed_by uuid not null references auth.users(id), reason text not null check(length(btrim(reason)) between 10 and 500),
 primary key(campaign_id,primary_person_id,dependent_person_id), foreign key(campaign_id) references public.outreach_campaigns(id),check(primary_person_id<>dependent_person_id)
);
create index outreach_team_guardian_dependent_idx on public.outreach_team_guardian_links(dependent_person_id);
create table public.outreach_team_vehicles (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id),
 label text not null check(length(btrim(label)) between 1 and 100), vehicle_type text not null check(length(btrim(vehicle_type)) between 1 and 80),
 total_capacity integer not null check(total_capacity between 1 and 500), passenger_capacity integer not null check(passenger_capacity between 0 and 500),
 passenger_carrying boolean not null default true, towing boolean not null default false, active boolean not null default true,
 departure_at timestamptz, departure_location text not null default '' check(length(departure_location)<=500), destination text not null default '' check(length(destination)<=500),
 participant_notes text not null default '' check(length(participant_notes)<=2000), internal_notes text not null default '' check(length(internal_notes)<=2000),revision integer not null default 1,
 unique(campaign_id,id), check(passenger_capacity<=total_capacity),check(passenger_carrying or passenger_capacity=0)
);
create table public.outreach_team_vehicle_assignments (
 campaign_id uuid not null, member_id uuid not null, vehicle_id uuid not null, seat_role text not null check(seat_role in ('driver','co_driver','passenger')),
 assigned_at timestamptz not null default now(),driver_reviewed boolean not null default false,family_split_reviewed boolean not null default false,guardian_travel_reviewed boolean not null default false, primary key(campaign_id,member_id),
 foreign key(campaign_id,member_id) references public.outreach_team_members(campaign_id,id),foreign key(campaign_id,vehicle_id) references public.outreach_team_vehicles(campaign_id,id)
);
create unique index outreach_team_driver_idx on public.outreach_team_vehicle_assignments(vehicle_id,seat_role) where seat_role<>'passenger';
create index outreach_team_vehicle_members_idx on public.outreach_team_vehicle_assignments(vehicle_id);
create table public.outreach_team_lodgings (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id), name text not null check(length(btrim(name)) between 1 and 150),
 address text not null default '' check(length(address)<=500), phone text not null default '' check(length(phone)<=40),
 check_in timestamptz not null, check_out timestamptz not null, map_url text check(map_url is null or (length(map_url)<=2000 and map_url ~ '^https://[^/@[:space:]]+(/[^[:cntrl:][:space:]]*)?$')),
 participant_notes text not null default '' check(length(participant_notes)<=2000), internal_notes text not null default '' check(length(internal_notes)<=2000),
 visibility text not null default 'assigned' check(visibility in ('assigned','staff')), active boolean not null default true,revision integer not null default 1,
 unique(campaign_id,id),check(check_out>check_in)
);
create table public.outreach_team_rooms (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, lodging_id uuid not null, label text not null check(length(btrim(label)) between 1 and 100),
 capacity integer check(capacity between 1 and 500), internal_notes text not null default '' check(length(internal_notes)<=2000),active boolean not null default true,revision integer not null default 1,
 foreign key(campaign_id,lodging_id) references public.outreach_team_lodgings(campaign_id,id),unique(campaign_id,id),unique(lodging_id,label)
);
create index outreach_team_room_lodging_idx on public.outreach_team_rooms(lodging_id);
create table public.outreach_team_room_assignments (
 campaign_id uuid not null, member_id uuid not null, room_id uuid not null, assigned_at timestamptz not null default now(),guardian_travel_reviewed boolean not null default false,primary key(member_id,room_id),
 foreign key(campaign_id,member_id) references public.outreach_team_members(campaign_id,id),foreign key(campaign_id,room_id) references public.outreach_team_rooms(campaign_id,id)
);
create index outreach_team_room_members_idx on public.outreach_team_room_assignments(room_id);
create table public.outreach_team_role_assignments (
 campaign_id uuid not null,member_id uuid not null,role_id uuid not null,team_lead_member_id uuid,notes text not null default '' check(length(notes)<=2000),assigned_at timestamptz not null default now(),
 primary key(member_id,role_id),foreign key(campaign_id,member_id) references public.outreach_team_members(campaign_id,id),foreign key(campaign_id,role_id) references public.outreach_team_roles(campaign_id,id),foreign key(campaign_id,team_lead_member_id) references public.outreach_team_members(campaign_id,id)
);
create index outreach_team_role_members_idx on public.outreach_team_role_assignments(role_id);
create index outreach_team_role_lead_idx on public.outreach_team_role_assignments(team_lead_member_id);
create table public.outreach_team_meetings (
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null references public.outreach_campaigns(id),label text not null check(length(btrim(label)) between 1 and 150),
 kind text not null check(kind in ('departure','fuel_stop','host_church','venue','hotel','team_meetup','staging')),
 address text not null default '' check(length(address)<=500),meet_at timestamptz,instructions text not null default '' check(length(instructions)<=2000),
 map_url text check(map_url is null or (length(map_url)<=2000 and map_url ~ '^https://[^/@[:space:]]+(/[^[:cntrl:][:space:]]*)?$')),
 visibility text not null default 'participants' check(visibility in ('participants','official','staff')),revision integer not null default 1
);
create index outreach_team_meetings_campaign_idx on public.outreach_team_meetings(campaign_id,meet_at);
create function private.outreach_team_can(p_campaign uuid,p_cap text) returns boolean language sql stable security definer set search_path='' as $$
 select p_cap in ('team.view','team.manage','travel.view','travel.manage') and private.outreach_verified(auth.uid()) and exists(select 1 from public.outreach_campaigns c where c.id=p_campaign and
 (private.outreach_admin(c.organization_id,p_cap like '%.manage') or exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c.id and a.user_id=auth.uid() and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and 'view'=any(a.capabilities) and p_cap=any(a.capabilities))))
$$;
create function private.outreach_team_open(p_campaign uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.outreach_team_settings s join public.outreach_campaigns c on c.id=s.campaign_id where c.id=p_campaign and s.enabled and c.status not in ('draft','closed','cancelled','completed') and
 (s.window_override='open' or (s.window_override='scheduled' and (s.opens_at is null or now()>=s.opens_at) and (s.closes_at is null or now()<s.closes_at))))
$$;
-- Campaign-specific reviewed authority is distinct from a household's adult/child label.
create function private.outreach_team_guardian(p_campaign uuid,p_primary uuid,p_dependent uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.outreach_team_guardian_links g join public.portal_account_links l on l.person_id=g.primary_person_id and l.active
 join public.outreach_campaigns c on c.id=g.campaign_id and c.organization_id=l.organization_id
 where g.campaign_id=p_campaign and g.primary_person_id=p_primary and g.dependent_person_id=p_dependent and g.active and l.user_id=auth.uid()
 and exists(select 1 from public.household_members a join public.household_members b on b.household_id=a.household_id and b.organization_id=a.organization_id where a.organization_id=c.organization_id and a.person_id=g.primary_person_id and b.person_id=g.dependent_person_id and a.active and b.active and exists(select 1 from public.households h where h.id=a.household_id and h.status='active')))
$$;
create function private.outreach_team_official(p_campaign uuid,p_member uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.outreach_team_members m where m.campaign_id=p_campaign and m.id=p_member and m.status='approved' and m.attending and m.person_id is not null and
 (m.age>=18 or (m.guardian_reviewed and exists(select 1 from public.outreach_team_members g where g.signup_id=m.signup_id and g.id=m.guardian_member_id and g.age>=18 and g.status='approved' and g.attending))))
$$;
-- All capacity/status operations acquire the same campaign row. This serializes ONLY one
-- campaign's operational mutations; it also makes status, room/vehicle edits and assignments
-- atomic relative to each other. Reads do not acquire the lock.
create function private.outreach_team_lock(p_campaign uuid,p_cap text) returns void language plpgsql security definer set search_path='' as $$
 begin
  if not private.outreach_team_can(p_campaign,p_cap) then raise exception 'Team/travel access denied' using errcode='42501';end if;
  perform 1 from public.outreach_campaigns where id=p_campaign for update;
  if not private.outreach_team_can(p_campaign,p_cap) then raise exception 'Team/travel access denied' using errcode='42501';end if;
 end
$$;
create function private.outreach_team_portal(p_action text,p_campaign uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.outreach_campaigns;s public.outreach_team_signups;m public.outreach_team_members;primary_id uuid;primary_person uuid; item jsonb;i integer:=0;members jsonb;known jsonb;person uuid;sid uuid; result jsonb; mine boolean; shared boolean;
begin
 if not private.outreach_verified(auth.uid()) then raise exception 'Verified sign-in required' using errcode='42501';end if;
 if p_action='available' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'city',x.city,'country',x.country,'event_start',x.event_start,'timezone',x.timezone)) from public.outreach_campaigns x where private.outreach_team_open(x.id) or exists(select 1 from public.outreach_team_signups owned_signup where owned_signup.campaign_id=x.id and (owned_signup.applicant_user_id=auth.uid() or exists(select 1 from public.outreach_team_members owned_member join public.portal_account_links pl on pl.organization_id=owned_member.organization_id and pl.person_id=owned_member.person_id and pl.active where owned_member.signup_id=owned_signup.id and pl.user_id=auth.uid())))),'[]');
 end if;
 select * into c from public.outreach_campaigns where id=p_campaign;
 select * into s from public.outreach_team_signups where campaign_id=p_campaign and applicant_user_id=auth.uid();
 if s.id is null and p_action in ('own','form') then select x.* into s from public.outreach_team_signups x where x.campaign_id=p_campaign and exists(select 1 from public.outreach_team_members y join public.portal_account_links l on l.person_id=y.person_id and l.organization_id=y.organization_id and l.active where y.signup_id=x.id and l.user_id=auth.uid()) limit 1;end if;
 if c.id is null or (s.id is null and not private.outreach_team_open(c.id)) then raise exception 'Campaign signup unavailable' using errcode='42501';end if;
 select l.person_id into primary_person from public.portal_account_links l where l.organization_id=c.organization_id and l.user_id=auth.uid() and l.active;
 if p_action='form' then
  return jsonb_build_object('campaign',jsonb_build_object('id',c.id,'name',c.name,'event_start',c.event_start,'timezone',c.timezone,'city',c.city), 'signup_open',private.outreach_team_open(c.id),'existing_signup_id',s.id,
   'email',(select email from auth.users where id=auth.uid()),'primary_person',(select jsonb_build_object('id',p.id,'first_name',p.first_name,'last_name',p.last_name,'phone',p.phone) from public.organization_people p where p.organization_id=c.organization_id and p.id=primary_person),
   'known_members',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'first_name',p.first_name,'last_name',p.last_name)) from public.organization_people p where p.organization_id=c.organization_id and private.outreach_team_guardian(c.id,primary_person,p.id)),'[]'),
   'roles',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name) order by r.name) from public.outreach_team_roles r where r.campaign_id=c.id and r.active),'[]'));
 elsif p_action='submit' then
  perform 1 from public.outreach_campaigns where id=c.id for update;
  select * into s from public.outreach_team_signups where campaign_id=c.id and applicant_user_id=auth.uid();
  if s.id is not null then return jsonb_build_object('id',s.id,'already_submitted',true);end if;
  if not private.outreach_team_open(c.id) then raise exception 'Signup window is closed' using errcode='22023';end if;
  if jsonb_typeof(p_payload->'members') is distinct from 'array' or jsonb_array_length(p_payload->'members') not between 1 and 20 or octet_length(p_payload::text)>50000 then raise exception 'One primary applicant and up to 19 party members required' using errcode='22023';end if;
  insert into public.outreach_team_signups(campaign_id,organization_id,applicant_user_id,party_label,notes) values(c.id,c.organization_id,auth.uid(),p_payload->>'party_label',coalesce(p_payload->>'notes','')) returning id into sid;
  for item in select value from jsonb_array_elements(p_payload->'members') loop
   if item->>'travel_mode'='official_vehicle' then raise exception 'Official vehicle mode requires reviewed assignment';end if;
   person:=(item->>'person_id')::uuid;
   if i=0 then person:=primary_person;
   elsif person is not null and not private.outreach_team_guardian(c.id,primary_person,person) then raise exception 'Existing family member requires reviewed guardian authority' using errcode='42501';end if;
   if exists(select 1 from unnest(array(select jsonb_array_elements_text(coalesce(item->'preferred_roles','[]'))) || array(select jsonb_array_elements_text(coalesce(item->'secondary_roles','[]')))) r where not exists(select 1 from public.outreach_team_roles t where t.campaign_id=c.id and t.id=r::uuid and t.active)) then raise exception 'Service preference outside campaign' using errcode='22023';end if;
   if coalesce((item->>'volunteering')::boolean,false)=false and (jsonb_array_length(coalesce(item->'preferred_roles','[]'))>0 or jsonb_array_length(coalesce(item->'secondary_roles','[]'))>0 or coalesce((item->>'willing_anywhere')::boolean,false)) then raise exception 'Attendee-only member cannot select volunteer preferences' using errcode='22023';end if;
   if (coalesce(item->'available_vehicle','{}')-'type'-'seats'-'make_model'-'notes')<>'{}' then raise exception 'Unsupported personal vehicle detail';end if;
   if item->'available_vehicle'->>'seats' is not null and (item->'available_vehicle'->>'seats')::int not between 1 and 100 then raise exception 'Invalid personal vehicle capacity';end if;
   insert into public.outreach_team_members(campaign_id,signup_id,organization_id,person_id,primary_applicant,first_name,last_name,email,phone,relationship,age,guardian_member_id,attending,volunteering,transport_preference,travel_mode,lodging_preference,preferred_roles,secondary_roles,willing_anywhere,available_vehicle,notes)
   values(c.id,sid,c.organization_id,person,i=0,btrim(item->>'first_name'),btrim(item->>'last_name'),case when i=0 then (select email from auth.users where id=auth.uid()) else null end,nullif(item->>'phone',''),case when i=0 then 'self' else item->>'relationship' end,(item->>'age')::int,case when (item->>'age')::int<18 then primary_id else null end,coalesce((item->>'attending')::boolean,true),coalesce((item->>'volunteering')::boolean,false),coalesce(item->>'transport_preference','needs_ride'),coalesce(item->>'travel_mode','independent'),coalesce(item->>'lodging_preference','undecided'),array(select value::uuid from jsonb_array_elements_text(coalesce(item->'preferred_roles','[]'))),array(select value::uuid from jsonb_array_elements_text(coalesce(item->'secondary_roles','[]'))),coalesce((item->>'willing_anywhere')::boolean,false),coalesce(item->'available_vehicle','{}'),coalesce(item->>'notes','')) returning * into m;
   if i=0 then primary_id:=m.id;end if;i:=i+1;
  end loop;
  perform private.outreach_audit(c.id,c.organization_id,'team_signup.submitted',sid,jsonb_build_object('members',i));perform private.outreach_event(c.id,'team_signup.submitted',sid,'team-submitted:'||sid);return jsonb_build_object('id',sid,'already_submitted',false);
 elsif p_action='own' then
  -- No lookup by caller-supplied person, household or signup ID. Ownership is server-derived.
  if s.id is null then raise exception 'Own signup unavailable' using errcode='42501';end if;
  members:='[]';
  for m in select * from public.outreach_team_members where signup_id=s.id and (s.applicant_user_id=auth.uid() or exists(select 1 from public.portal_account_links l where l.person_id=outreach_team_members.person_id and l.organization_id=c.organization_id and l.active and l.user_id=auth.uid()) or private.outreach_team_guardian(c.id,primary_person,person_id)) order by primary_applicant desc,first_name,id loop
   mine:=(m.primary_applicant and s.applicant_user_id=auth.uid()) or exists(select 1 from public.portal_account_links l where l.organization_id=c.organization_id and l.user_id=auth.uid() and l.person_id=m.person_id and l.active);
   shared:=mine or (m.party_access_reviewed and (m.person_id is null or private.outreach_team_guardian(c.id,primary_person,m.person_id)));
   result:=jsonb_build_object('id',m.id,'name',m.first_name||' '||m.last_name,'age',m.age,'relationship',m.relationship,'attending',m.attending,'volunteering',m.volunteering,'status',m.status,'consent_state',m.consent_state,'guardian_reviewed',m.guardian_reviewed,'trip_shared',shared);
   if shared and m.status in ('approved','self_traveling','guest','not_selected') then
    result:=result||jsonb_build_object('travel_mode',m.travel_mode,'lodging_preference',m.lodging_preference,
     'vehicle',(select jsonb_build_object('label',v.label,'seat_role',a.seat_role,'departure_at',v.departure_at,'departure_location',v.departure_location,'destination',v.destination,'notes',v.participant_notes,
       'driver',(select d.first_name||' '||d.last_name from public.outreach_team_vehicle_assignments da join public.outreach_team_members d on d.id=da.member_id where da.vehicle_id=v.id and da.seat_role='driver')) from public.outreach_team_vehicle_assignments a join public.outreach_team_vehicles v on v.id=a.vehicle_id where a.member_id=m.id),
     'lodging',coalesce((select jsonb_agg(jsonb_build_object('name',l.name,'address',l.address,'phone',l.phone,'room',r.label,'check_in',l.check_in,'check_out',l.check_out,'map_url',l.map_url,'notes',l.participant_notes)) from public.outreach_team_room_assignments a join public.outreach_team_rooms r on r.id=a.room_id join public.outreach_team_lodgings l on l.id=r.lodging_id where a.member_id=m.id and l.visibility='assigned' and l.active),'[]'),
     'roles',coalesce((select jsonb_agg(jsonb_build_object('name',r.name)) from public.outreach_team_role_assignments a join public.outreach_team_roles r on r.id=a.role_id where a.member_id=m.id),'[]'));
   end if;
   members:=members||jsonb_build_array(result);
  end loop;
  return jsonb_build_object('campaign',jsonb_build_object('id',c.id,'name',c.name,'event_start',c.event_start,'event_end',c.event_end,'timezone',c.timezone,'host_church',(select name from public.organizations where id=c.host_organization_id),'venue',jsonb_build_object('name',c.venue->>'name','address',c.venue->>'address')),
   'party_label',s.party_label,'submitted_at',s.submitted_at,'members',members,
   'trip',(select jsonb_build_object('notes',t.participant_notes,'arrival_target',t.arrival_target,'coordination_name',t.coordination_name,'coordination_phone',t.coordination_phone) from public.outreach_team_settings t where t.campaign_id=c.id and exists(select 1 from public.outreach_team_members x where x.signup_id=s.id and x.status in ('approved','self_traveling','guest','not_selected') and ((x.primary_applicant and s.applicant_user_id=auth.uid()) or exists(select 1 from public.portal_account_links pl where pl.organization_id=c.organization_id and pl.person_id=x.person_id and pl.user_id=auth.uid() and pl.active) or (x.party_access_reviewed and private.outreach_team_guardian(c.id,primary_person,x.person_id))))),
   'meetings',coalesce((select jsonb_agg(jsonb_build_object('label',x.label,'kind',x.kind,'address',x.address,'meet_at',x.meet_at,'instructions',x.instructions,'map_url',x.map_url) order by x.meet_at) from public.outreach_team_meetings x where x.campaign_id=c.id and x.visibility<>'staff' and exists(select 1 from public.outreach_team_members y where y.signup_id=s.id and y.status in ('approved','self_traveling','guest','not_selected') and ((y.primary_applicant and s.applicant_user_id=auth.uid()) or exists(select 1 from public.portal_account_links pl where pl.organization_id=c.organization_id and pl.person_id=y.person_id and pl.user_id=auth.uid() and pl.active) or (y.party_access_reviewed and private.outreach_team_guardian(c.id,primary_person,y.person_id))) and (x.visibility='participants' or y.status='approved'))),'[]'),
   'training',coalesce((select jsonb_agg(jsonb_build_object('title',r.title,'url',r.source_url,'state',a.state)) from public.outreach_campaign_training a join public.outreach_campaign_resources r on r.id=a.resource_id where a.campaign_id=c.id and a.assigned_user_id=auth.uid()),'[]'));
 end if;
 raise exception 'Unknown participant action' using errcode='22023';
end $$;

create function private.outreach_team_manifest(p_campaign uuid,p_filters jsonb default '{}') returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'signup_id',s.id,'party_label',s.party_label,'household_id',s.household_id,'first_name',m.first_name,'last_name',m.last_name,'age',m.age,'relationship',m.relationship,'attending',m.attending,'volunteering',m.volunteering,'status',m.status,'person_linked',m.person_id is not null,'revision',m.revision,'guardian_reviewed',m.guardian_reviewed,'consent_state',m.consent_state,
 'phone',m.phone,'email',case when private.outreach_team_can(p_campaign,'team.view') then m.email else null end,
 'roles',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'team_lead_member_id',a.team_lead_member_id)) from public.outreach_team_role_assignments a join public.outreach_team_roles r on r.id=a.role_id where a.member_id=m.id),'[]'),
 'travel',case when private.outreach_team_can(p_campaign,'travel.view') then jsonb_build_object('mode',m.travel_mode,'preference',m.transport_preference,'lodging_preference',m.lodging_preference,
 'vehicle',(select jsonb_build_object('id',v.id,'label',v.label,'seat_role',a.seat_role,'departure_at',v.departure_at) from public.outreach_team_vehicle_assignments a join public.outreach_team_vehicles v on v.id=a.vehicle_id where a.member_id=m.id),
 'lodging',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'room_id',r.id,'room',r.label)) from public.outreach_team_room_assignments a join public.outreach_team_rooms r on r.id=a.room_id join public.outreach_team_lodgings l on l.id=r.lodging_id where a.member_id=m.id),'[]')) else null end
 ) order by s.party_label,m.primary_applicant desc,m.first_name,m.id),'[]')
 from public.outreach_team_members m join public.outreach_team_signups s on s.id=m.signup_id
 where m.campaign_id=p_campaign and (private.outreach_team_can(p_campaign,'team.view') or private.outreach_team_can(p_campaign,'travel.view'))
 and (coalesce(p_filters->>'status','')='' or m.status=p_filters->>'status')
 and (coalesce(p_filters->>'signup_id','')='' or s.id=(p_filters->>'signup_id')::uuid)
 and (coalesce(p_filters->>'household_id','')='' or s.household_id=(p_filters->>'household_id')::uuid)
 and (coalesce(p_filters->>'role_id','')='' or exists(select 1 from public.outreach_team_role_assignments a where a.member_id=m.id and a.role_id=(p_filters->>'role_id')::uuid))
 and (coalesce(p_filters->>'vehicle_id','')='' or (private.outreach_team_can(p_campaign,'travel.view') and exists(select 1 from public.outreach_team_vehicle_assignments a where a.member_id=m.id and a.vehicle_id=(p_filters->>'vehicle_id')::uuid)))
 and (coalesce(p_filters->>'lodging_id','')='' or (private.outreach_team_can(p_campaign,'travel.view') and exists(select 1 from public.outreach_team_room_assignments a join public.outreach_team_rooms r on r.id=a.room_id where a.member_id=m.id and r.lodging_id=(p_filters->>'lodging_id')::uuid)))
 and (coalesce(p_filters->>'travel','')='' or (private.outreach_team_can(p_campaign,'travel.view') and case p_filters->>'travel' when 'official' then exists(select 1 from public.outreach_team_vehicle_assignments a where a.member_id=m.id) when 'self_traveling' then m.status='self_traveling' or m.travel_mode in ('self_driving','independent','riding_with_participant') when 'needs_ride' then m.transport_preference='needs_ride' and m.status='approved' and not exists(select 1 from public.outreach_team_vehicle_assignments a where a.member_id=m.id) else false end))
$$;
create function private.outreach_team_workspace(p_action text,p_campaign uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.outreach_campaigns; m public.outreach_team_members; s public.outreach_team_signups; v public.outreach_team_vehicles; l public.outreach_team_lodgings; r public.outreach_team_rooms;
 target_id uuid:=(p_payload->>'id')::uuid; member uuid:=(p_payload->>'member_id')::uuid;person uuid:=(p_payload->>'person_id')::uuid;target uuid;cap text;kind text;operation uuid:=gen_random_uuid();result jsonb;rows jsonb;item jsonb; prior text;status_name text; csv text; seats integer; occupation integer; count_approved integer; cfg public.outreach_team_settings;
begin
 select * into c from public.outreach_campaigns where outreach_campaigns.id=p_campaign;
 if c.id is null or not private.outreach_verified(auth.uid()) then raise exception 'Campaign access denied' using errcode='42501';end if;
 if p_action in ('list','manifest','summary') then
  if not(private.outreach_team_can(c.id,'team.view') or private.outreach_team_can(c.id,'travel.view')) then raise exception 'Team/travel access denied' using errcode='42501';end if;
  rows:=private.outreach_team_manifest(c.id,p_payload);
  if p_action='manifest' then return rows;end if;
  select * into cfg from public.outreach_team_settings where campaign_id=c.id;
  select count(*) into count_approved from public.outreach_team_members where campaign_id=c.id and status='approved';
  result:=jsonb_build_object('campaign',jsonb_build_object('id',c.id,'name',c.name,'organization_id',c.organization_id,'timezone',c.timezone),
   'capabilities',to_jsonb(array(select k from unnest(array['team.view','team.manage','travel.view','travel.manage']) k where private.outreach_team_can(c.id,k))),
   'admin',private.outreach_admin(c.organization_id,true),'identity_review_allowed',private.has_staff_permission(c.organization_id,'people.read') and private.has_staff_permission(c.organization_id,'people.update'),'person_create_allowed',private.has_staff_permission(c.organization_id,'people.create'),'members',rows,'settings',case when private.outreach_team_can(c.id,'travel.view') then to_jsonb(cfg) else to_jsonb(cfg)-'participant_notes'-'arrival_target'-'coordination_name'-'coordination_phone' end,
   'roles',coalesce((select jsonb_agg(to_jsonb(t) order by name) from public.outreach_team_roles t where campaign_id=c.id),'[]'),
   'summary',jsonb_build_object('applicants',(select count(*) from public.outreach_team_signups where campaign_id=c.id),'applied',(select count(*) from public.outreach_team_members where campaign_id=c.id and status in ('applied','under_review')),'approved',count_approved,'waitlisted',(select count(*) from public.outreach_team_members where campaign_id=c.id and status='waitlisted'),'not_selected',(select count(*) from public.outreach_team_members where campaign_id=c.id and status='not_selected'),'self_traveling',(select count(*) from public.outreach_team_members where campaign_id=c.id and status='self_traveling'),'remaining_official_slots',case when cfg.official_capacity is null then null else greatest(0,cfg.official_capacity-count_approved) end,
   'needs_ride',case when private.outreach_team_can(c.id,'travel.view') then (select count(*) from public.outreach_team_members t where campaign_id=c.id and status='approved' and transport_preference='needs_ride' and not exists(select 1 from public.outreach_team_vehicle_assignments a where a.member_id=t.id)) else null end,
   'official_passengers',case when private.outreach_team_can(c.id,'travel.view') then (select count(*) from public.outreach_team_vehicle_assignments where campaign_id=c.id and seat_role='passenger') else null end,
   'available_seats',case when private.outreach_team_can(c.id,'travel.view') then (select coalesce(sum(least(t.passenger_capacity-(select count(*) from public.outreach_team_vehicle_assignments a where a.vehicle_id=t.id and a.seat_role='passenger'),t.total_capacity-(select count(*) from public.outreach_team_vehicle_assignments a where a.vehicle_id=t.id))),0) from public.outreach_team_vehicles t where campaign_id=c.id and active and passenger_carrying) else null end,
   'needs_lodging',case when private.outreach_team_can(c.id,'travel.view') then (select count(*) from public.outreach_team_members t where campaign_id=c.id and status='approved' and lodging_preference='needs_lodging' and not exists(select 1 from public.outreach_team_room_assignments a where a.member_id=t.id)) else null end,
   'lodging_assigned',case when private.outreach_team_can(c.id,'travel.view') then (select count(distinct member_id) from public.outreach_team_room_assignments where campaign_id=c.id) else null end));
  if private.outreach_team_can(c.id,'travel.view') then
   result:=result||jsonb_build_object('vehicles',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('assigned',(select count(*) from public.outreach_team_vehicle_assignments a where a.vehicle_id=t.id),'passengers',(select count(*) from public.outreach_team_vehicle_assignments a where a.vehicle_id=t.id and a.seat_role='passenger'),'driver_member_id',(select member_id from public.outreach_team_vehicle_assignments a where a.vehicle_id=t.id and a.seat_role='driver'),'co_driver_member_id',(select member_id from public.outreach_team_vehicle_assignments a where a.vehicle_id=t.id and a.seat_role='co_driver')) order by label) from public.outreach_team_vehicles t where campaign_id=c.id),'[]'),
    'lodgings',coalesce((select jsonb_agg(to_jsonb(t) order by name) from public.outreach_team_lodgings t where campaign_id=c.id),'[]'),
    'rooms',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('assigned',(select count(*) from public.outreach_team_room_assignments a where a.room_id=t.id)) order by label) from public.outreach_team_rooms t where campaign_id=c.id),'[]'),
    'meetings',coalesce((select jsonb_agg(to_jsonb(t) order by meet_at) from public.outreach_team_meetings t where campaign_id=c.id),'[]'));
  end if;return result;
 elsif p_action in ('member','traveler') then
  if not private.outreach_team_can(c.id,case when p_action='member' then 'team.view' else 'travel.view' end) then raise exception 'Team access denied' using errcode='42501';end if;
  select * into m from public.outreach_team_members where campaign_id=c.id and outreach_team_members.id=member;
  if m.id is null then raise exception 'Member outside campaign' using errcode='42501';end if;
  select * into s from public.outreach_team_signups where outreach_team_signups.id=m.signup_id;
  result:=to_jsonb(m);if p_action='traveler' then result:=result-'email'-'notes'-'available_vehicle'-'person_id'-'party_access_reviewed';end if;if not private.outreach_team_can(c.id,'travel.view') then result:=result-'transport_preference'-'travel_mode'-'lodging_preference'-'available_vehicle';end if;
  return jsonb_build_object('member',result,'party',jsonb_build_object('id',s.id,'label',s.party_label,'household_id',s.household_id,'submitted_at',s.submitted_at,'notes',case when p_action='member' then s.notes else '' end),'party_members',private.outreach_team_manifest(c.id,jsonb_build_object('signup_id',s.id)));
 elsif p_action='matches' then
  if not private.outreach_team_can(c.id,'team.manage') then raise exception 'Team management denied' using errcode='42501';end if;
  select * into m from public.outreach_team_members where campaign_id=c.id and outreach_team_members.id=member;
  if m.id is null or not private.has_staff_permission(c.organization_id,'people.read') then raise exception 'Independent People read required' using errcode='42501';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'first_name',t.first_name,'last_name',t.last_name,'email',t.email,'phone',t.phone)) from public.organization_people t where t.organization_id=c.organization_id and private.person_permission(c.organization_id,t.id,'people.read') and
   ((m.email is not null and lower(t.email)=lower(m.email)) or (nullif(regexp_replace(coalesce(m.phone,''),'[^0-9]','','g'),'') is not null and regexp_replace(t.phone,'[^0-9]','','g')=regexp_replace(m.phone,'[^0-9]','','g')) or (lower(t.first_name)=lower(m.first_name) and lower(t.last_name)=lower(m.last_name)) or (length(coalesce(p_payload->>'search',''))>=2 and position(lower(p_payload->>'search') in lower(concat_ws(' ',t.first_name,t.last_name,t.email,t.phone)))>0))),'[]');
 elsif p_action='family_context' then
  if not(private.outreach_team_can(c.id,'team.manage') and private.has_staff_permission(c.organization_id,'people.read')) then raise exception 'Reviewed family access required' using errcode='42501';end if;
  select * into s from public.outreach_team_signups where campaign_id=c.id and id=(p_payload->>'signup_id')::uuid;
  if s.id is null then raise exception 'Party outside campaign' using errcode='42501';end if;
  return jsonb_build_object('revision',s.revision,'household_id',s.household_id,'members',(select jsonb_agg(jsonb_build_object('id',t.id,'person_id',t.person_id,'primary_applicant',t.primary_applicant,'age',t.age)) from public.outreach_team_members t where t.signup_id=s.id),
   'households',case when private.has_staff_permission(c.organization_id,'households.read') then coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'name',h.name)) from public.households h where h.organization_id=c.organization_id and h.status='active' and not exists(select 1 from public.outreach_team_members t where t.signup_id=s.id and (t.person_id is null or not exists(select 1 from public.household_members hm where hm.household_id=h.id and hm.person_id=t.person_id and hm.active)))),'[]') else '[]'::jsonb end,
   'guardian_links',coalesce((select jsonb_agg(jsonb_build_object('primary_person_id',g.primary_person_id,'dependent_person_id',g.dependent_person_id,'active',g.active)) from public.outreach_team_guardian_links g where g.campaign_id=c.id and exists(select 1 from public.outreach_team_members t where t.signup_id=s.id and t.person_id=g.primary_person_id) and exists(select 1 from public.outreach_team_members t where t.signup_id=s.id and t.person_id=g.dependent_person_id)),'[]'));
 elsif p_action='export' then
  cap:=case when p_payload->>'kind'='team' then 'team.view' else 'travel.view' end;
  if not private.outreach_team_can(c.id,cap) then raise exception 'Manifest export denied' using errcode='42501';end if;
  if p_payload->>'kind' not in ('team','travel','needs_action') or p_payload->>'kind' is null then raise exception 'Unknown manifest export';end if;
  rows:=private.outreach_team_manifest(c.id,p_payload);
  csv:=case p_payload->>'kind' when 'team' then 'Name,Phone,Email,Status,Role' when 'travel' then 'Name,Household,Vehicle,Driver/Passenger,Departure,Lodging' else 'Participant,Missing vehicle,Needs ride,Missing lodging,Missing role' end||E'\r\n';
  for item in select value from jsonb_array_elements(rows) loop
   csv:=csv||private.outreach_csv_cell((item->>'first_name')||' '||(item->>'last_name'))||',';
   if p_payload->>'kind'='team' then csv:=csv||private.outreach_csv_cell(item->>'phone')||','||private.outreach_csv_cell(item->>'email')||','||private.outreach_csv_cell(item->>'status')||','||private.outreach_csv_cell((select string_agg(x->>'name',' / ') from jsonb_array_elements(item->'roles')x));
   elsif p_payload->>'kind'='travel' then csv:=csv||private.outreach_csv_cell(item->>'party_label')||','||private.outreach_csv_cell(item->'travel'->'vehicle'->>'label')||','||private.outreach_csv_cell(item->'travel'->'vehicle'->>'seat_role')||','||private.outreach_csv_cell(item->'travel'->'vehicle'->>'departure_at')||','||private.outreach_csv_cell((select string_agg((x->>'name')||' / '||(x->>'room'),' | ') from jsonb_array_elements(item->'travel'->'lodging')x));
   else csv:=csv||case when item->>'status'='approved' and item->'travel'->>'mode'='official_vehicle' and item->'travel'->'vehicle'='null' then 'yes' else 'no' end||','||case when item->>'status'='approved' and item->'travel'->>'preference'='needs_ride' and item->'travel'->'vehicle'='null' then 'yes' else 'no' end||','||case when item->>'status'='approved' and item->'travel'->>'lodging_preference'='needs_lodging' and jsonb_array_length(item->'travel'->'lodging')=0 then 'yes' else 'no' end||','||case when (item->>'volunteering')::boolean and jsonb_array_length(item->'roles')=0 then 'yes' else 'no' end;end if;
   csv:=csv||E'\r\n';
  end loop;
  perform private.outreach_audit(c.id,c.organization_id,'team.manifest_exported',c.id,jsonb_build_object('kind',p_payload->>'kind','rows',jsonb_array_length(rows)));return jsonb_build_object('csv',csv,'filename',c.code||'-'||(p_payload->>'kind')||'.csv');
 end if;
 cap:=case when p_action in ('settings','role_save','status','link_person','create_person','household_link','guardian_link','member_review','role_assign','role_remove','access') then 'team.manage' else 'travel.manage' end;
 perform private.outreach_team_lock(c.id,cap);
 if p_action='settings' then
  select * into cfg from public.outreach_team_settings where campaign_id=c.id;
  if (p_payload ?| array['participant_notes','arrival_target','coordination_name','coordination_phone']) and not private.outreach_team_can(c.id,'travel.manage') then raise exception 'Trip configuration requires explicit travel manage' using errcode='42501';end if;
  if coalesce(cfg.revision,0) is distinct from (p_payload->>'revision')::int then raise exception 'Settings changed; reload' using errcode='40001';end if;
  insert into public.outreach_team_settings(campaign_id,enabled,opens_at,closes_at,window_override,official_capacity,multiple_roles,participant_notes,arrival_target,coordination_name,coordination_phone,revision)
  values(c.id,coalesce((p_payload->>'enabled')::boolean,false),(p_payload->>'opens_at')::timestamptz,(p_payload->>'closes_at')::timestamptz,coalesce(p_payload->>'window_override','scheduled'),(p_payload->>'official_capacity')::int,coalesce((p_payload->>'multiple_roles')::boolean,true),coalesce(p_payload->>'participant_notes',cfg.participant_notes,''),case when p_payload?'arrival_target' then (p_payload->>'arrival_target')::timestamptz else cfg.arrival_target end,coalesce(p_payload->>'coordination_name',cfg.coordination_name,''),coalesce(p_payload->>'coordination_phone',cfg.coordination_phone,''),coalesce(cfg.revision,0)+1)
  on conflict(campaign_id) do update set enabled=excluded.enabled,opens_at=excluded.opens_at,closes_at=excluded.closes_at,window_override=excluded.window_override,official_capacity=excluded.official_capacity,multiple_roles=excluded.multiple_roles,participant_notes=excluded.participant_notes,arrival_target=excluded.arrival_target,coordination_name=excluded.coordination_name,coordination_phone=excluded.coordination_phone,revision=excluded.revision;
  if not coalesce((p_payload->>'multiple_roles')::boolean,true) and exists(select 1 from public.outreach_team_role_assignments where campaign_id=c.id group by member_id having count(*)>1) then raise exception 'Resolve multiple roles before restricting campaign';end if;
  kind:='trip_details.updated';target_id:=c.id;
 elsif p_action='role_save' then
  if target_id is null then insert into public.outreach_team_roles(campaign_id,name) values(c.id,p_payload->>'name') returning outreach_team_roles.id into target_id;
  else update public.outreach_team_roles set name=p_payload->>'name',active=coalesce((p_payload->>'active')::boolean,true) where campaign_id=c.id and outreach_team_roles.id=target_id;if not found then raise exception 'Role outside campaign' using errcode='42501';end if;end if;kind:='team.role_catalog_updated';
 elsif p_action='access' then
  if not private.outreach_admin(c.organization_id,true) then raise exception 'Organization outreach administrator required' using errcode='42501';end if;
  target:=(p_payload->>'user_id')::uuid;
  select * into cfg from public.outreach_team_settings where campaign_id=c.id;
  if not exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c.id and a.user_id=target and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and private.outreach_verified(target)) then raise exception 'Active existing campaign assignment required';end if;
  if length(btrim(coalesce(p_payload->>'reason','')))<10 or length(p_payload->>'reason')>500 then raise exception 'Access review reason required';end if;
  if not(array(select jsonb_array_elements_text(p_payload->'capabilities')) <@ array['team.view','team.manage','travel.view','travel.manage']) then raise exception 'Invalid Phase B capability';end if;
  update public.outreach_campaign_assignments set capabilities=array(select distinct x from unnest(capabilities) x where x not in ('team.view','team.manage','travel.view','travel.manage'))||array(select jsonb_array_elements_text(p_payload->'capabilities')),revision=revision+1 where campaign_id=c.id and user_id=target and revision=(p_payload->>'revision')::int;
  if not found then raise exception 'Assignment changed; reload' using errcode='40001';end if;target_id:=target;kind:='team.access_changed';
 elsif p_action in ('status','link_person','create_person','member_review','role_assign','role_remove','vehicle_assign','vehicle_remove','lodging_assign','lodging_remove','travel_mode') then
  select * into m from public.outreach_team_members where campaign_id=c.id and outreach_team_members.id=member for update;
  if m.id is null then raise exception 'Member outside campaign' using errcode='42501';end if;
  if m.revision is distinct from (p_payload->>'revision')::int then raise exception 'Member changed; reload' using errcode='40001';end if;
  target_id:=m.id;
  if p_action='status' then
   status_name:=p_payload->>'status';prior:=m.status;
   if status_name is null or status_name=prior then raise exception 'Choose a new status';end if;
   if prior='cancelled' and status_name<>'applied' then raise exception 'Reopen cancelled signup as applied first';end if;
   if status_name='applied' and prior not in ('cancelled','not_selected','waitlisted') then raise exception 'Only cancelled, not selected or waitlisted may reopen';end if;
   if length(btrim(coalesce(p_payload->>'reason','')))<10 or length(p_payload->>'reason')>500 then raise exception 'Status review reason required';end if;
   if status_name='approved' and (not m.attending or m.person_id is null or (m.age<18 and (not m.guardian_reviewed or not exists(select 1 from public.outreach_team_members g where g.id=m.guardian_member_id and g.signup_id=m.signup_id and g.status='approved' and g.age>=18)))) then raise exception 'Review canonical identity, attendance and minor guardian before official approval';end if;
   if status_name<>'approved' and (exists(select 1 from public.outreach_team_vehicle_assignments where member_id=m.id) or exists(select 1 from public.outreach_team_room_assignments where member_id=m.id) or exists(select 1 from public.outreach_team_members where guardian_member_id=m.id and status='approved') or exists(select 1 from public.outreach_team_role_assignments where team_lead_member_id=m.id)) then raise exception 'Release official assignments and dependent approvals before changing status';end if;
   update public.outreach_team_members set status=status_name where outreach_team_members.id=m.id;
   if status_name in ('applied','under_review','waitlisted','cancelled') then delete from public.outreach_team_role_assignments where member_id=m.id;end if;
   kind:=case status_name when 'approved' then 'team_signup.approved' when 'waitlisted' then 'team_signup.waitlisted' when 'not_selected' then 'team_signup.not_selected' else 'team.status_changed' end;
   perform private.outreach_audit(c.id,c.organization_id,kind,m.id,jsonb_build_object('from',prior,'to',status_name,'reason',p_payload->>'reason'));
  elsif p_action in ('link_person','create_person') then
   if m.person_id is not null then raise exception 'Already linked; identity cannot silently change';end if;
   if length(btrim(coalesce(p_payload->>'reason','')))<10 or length(p_payload->>'reason')>500 then raise exception 'Identity review reason required';end if;
   if p_action='create_person' then
    if not(private.has_staff_permission(c.organization_id,'people.read') and private.has_staff_permission(c.organization_id,'people.create') and private.has_staff_permission(c.organization_id,'people.update')) then raise exception 'Independent People creation/update permission required' using errcode='42501';end if;
    perform pg_advisory_xact_lock(hashtextextended(c.organization_id::text||':reviewed-people-create',0));
    if exists(select 1 from public.organization_people t where t.organization_id=c.organization_id and ((m.email is not null and lower(t.email)=lower(m.email)) or (nullif(regexp_replace(coalesce(m.phone,''),'[^0-9]','','g'),'') is not null and regexp_replace(t.phone,'[^0-9]','','g')=regexp_replace(m.phone,'[^0-9]','','g')) or (lower(t.first_name)=lower(m.first_name) and lower(t.last_name)=lower(m.last_name)))) then raise exception 'Possible existing Person; review candidates before linking';end if;
    insert into public.organization_people(organization_id,first_name,last_name,email,phone) values(c.organization_id,m.first_name,m.last_name,m.email,m.phone) returning organization_people.id into person;
   elsif not (private.person_permission(c.organization_id,person,'people.read') and private.person_permission(c.organization_id,person,'people.update')) then raise exception 'Independent Person read/update required' using errcode='42501';end if;
   update public.outreach_team_members set person_id=person,guardian_reviewed=false,party_access_reviewed=false where outreach_team_members.id=m.id;kind:='team.identity_linked';
  elsif p_action='member_review' then
   if length(btrim(coalesce(p_payload->>'reason','')))<10 or length(p_payload->>'reason')>500 then raise exception 'Party/guardian review reason required';end if;
   if m.person_id is null or not private.person_permission(c.organization_id,m.person_id,'people.read') then raise exception 'Canonical Person review required' using errcode='42501';end if;
   -- New submitted party relationships never silently become canonical Household membership.
   if coalesce((p_payload->>'guardian_reviewed')::boolean,false) and (m.age>=18 or not exists(select 1 from public.outreach_team_members g where g.id=m.guardian_member_id and g.signup_id=m.signup_id and g.person_id is not null and g.age>=18)) then raise exception 'Explicit linked adult guardian required';end if;
   update public.outreach_team_members set guardian_reviewed=coalesce((p_payload->>'guardian_reviewed')::boolean,false),party_access_reviewed=coalesce((p_payload->>'party_access_reviewed')::boolean,false) where outreach_team_members.id=m.id;kind:='team.party_authority_reviewed';
  elsif p_action='role_assign' then
   if not m.volunteering or not m.attending or m.status not in ('approved','self_traveling','guest','not_selected') then raise exception 'Serving participant must be reviewed first';end if;
   if not exists(select 1 from public.outreach_team_roles t where t.campaign_id=c.id and t.id=(p_payload->>'role_id')::uuid and t.active) then raise exception 'Role outside active campaign';end if;
   if not coalesce((select multiple_roles from public.outreach_team_settings where campaign_id=c.id),true) and exists(select 1 from public.outreach_team_role_assignments where member_id=m.id and role_id<>(p_payload->>'role_id')::uuid) then raise exception 'Campaign permits one final service role';end if;
   if p_payload->>'team_lead_member_id' is not null and not private.outreach_team_official(c.id,(p_payload->>'team_lead_member_id')::uuid) then raise exception 'Team lead must be approved in same campaign';end if;
   insert into public.outreach_team_role_assignments(campaign_id,member_id,role_id,team_lead_member_id,notes) values(c.id,m.id,(p_payload->>'role_id')::uuid,(p_payload->>'team_lead_member_id')::uuid,coalesce(p_payload->>'notes','')) on conflict(member_id,role_id) do update set team_lead_member_id=excluded.team_lead_member_id,notes=excluded.notes,assigned_at=now();kind:='team_role.assigned';
  elsif p_action='role_remove' then delete from public.outreach_team_role_assignments where member_id=m.id and role_id=(p_payload->>'role_id')::uuid;kind:='team.role_removed';
  elsif p_action='vehicle_assign' then
   if not private.outreach_team_official(c.id,m.id) then raise exception 'Official approved traveler with reviewed guardian required';end if;
   select * into v from public.outreach_team_vehicles where campaign_id=c.id and outreach_team_vehicles.id=(p_payload->>'vehicle_id')::uuid;
   if v.id is null or not v.active then raise exception 'Active vehicle in same campaign required';end if;
   if exists(select 1 from public.outreach_team_vehicle_assignments where member_id=m.id) then raise exception 'Release existing primary vehicle before reassignment';end if;
   kind:=p_payload->>'seat_role';if kind not in ('driver','co_driver','passenger') or kind is null then raise exception 'Valid seat role required';end if;
   if kind='passenger' and not v.passenger_carrying then raise exception 'Equipment-only vehicle cannot carry passengers';end if;
   if kind<>'passenger' and (m.age<18 or not coalesce((p_payload->>'driver_reviewed')::boolean,false)) then raise exception 'Adult driver qualification must be explicitly reviewed';end if;
   select count(*),count(*) filter(where seat_role='passenger') into occupation,seats from public.outreach_team_vehicle_assignments where vehicle_id=v.id;
   if occupation>=v.total_capacity or (kind='passenger' and seats>=v.passenger_capacity) then raise exception 'Vehicle capacity reached';end if;
   -- Splitting a submitted family across vehicles requires an explicit operator acknowledgement.
   if exists(select 1 from public.outreach_team_members t join public.outreach_team_vehicle_assignments a on a.member_id=t.id where t.signup_id=m.signup_id and a.vehicle_id<>v.id) and not coalesce((p_payload->>'family_split_reviewed')::boolean,false) then raise exception 'Review intentional family vehicle split';end if;
   if m.age<18 and not exists(select 1 from public.outreach_team_vehicle_assignments a where a.member_id=m.guardian_member_id and a.vehicle_id=v.id) and not coalesce((p_payload->>'guardian_travel_reviewed')::boolean,false) then raise exception 'Review minor travel supervision for separate vehicle';end if;
   insert into public.outreach_team_vehicle_assignments(campaign_id,member_id,vehicle_id,seat_role,driver_reviewed,family_split_reviewed,guardian_travel_reviewed) values(c.id,m.id,v.id,kind,coalesce((p_payload->>'driver_reviewed')::boolean,false),coalesce((p_payload->>'family_split_reviewed')::boolean,false),coalesce((p_payload->>'guardian_travel_reviewed')::boolean,false));update public.outreach_team_members set travel_mode='official_vehicle' where outreach_team_members.id=m.id;kind:='vehicle.assigned';
  elsif p_action='vehicle_remove' then
   if exists(select 1 from public.outreach_team_vehicle_assignments a join public.outreach_team_members d on d.id=a.member_id join public.outreach_team_vehicle_assignments g on g.member_id=m.id and g.vehicle_id=a.vehicle_id where d.guardian_member_id=m.id and not a.guardian_travel_reviewed) then raise exception 'Release dependent passengers before removing guardian vehicle';end if;delete from public.outreach_team_vehicle_assignments where member_id=m.id;update public.outreach_team_members set travel_mode='independent' where outreach_team_members.id=m.id;kind:='vehicle.changed';
  elsif p_action='lodging_assign' then
   if not private.outreach_team_official(c.id,m.id) then raise exception 'Official approval required for assigned lodging';end if;
   select * into r from public.outreach_team_rooms where campaign_id=c.id and outreach_team_rooms.id=(p_payload->>'room_id')::uuid;
   select * into l from public.outreach_team_lodgings where campaign_id=c.id and outreach_team_lodgings.id=r.lodging_id;
   if r.id is null or not r.active or not l.active then raise exception 'Active room in campaign required';end if;
   if exists(select 1 from public.outreach_team_room_assignments a join public.outreach_team_rooms x on x.id=a.room_id join public.outreach_team_lodgings y on y.id=x.lodging_id where a.member_id=m.id and tstzrange(y.check_in,y.check_out,'[)') && tstzrange(l.check_in,l.check_out,'[)')) then raise exception 'Conflicting lodging stay';end if;
   if r.capacity is not null and (select count(*) from public.outreach_team_room_assignments where room_id=r.id)>=r.capacity then raise exception 'Room capacity reached';end if;
   if m.age<18 and not exists(select 1 from public.outreach_team_room_assignments a where a.member_id=m.guardian_member_id and a.room_id=r.id) and not coalesce((p_payload->>'guardian_travel_reviewed')::boolean,false) then raise exception 'Review minor lodging supervision';end if;
   insert into public.outreach_team_room_assignments(campaign_id,member_id,room_id,guardian_travel_reviewed) values(c.id,m.id,r.id,coalesce((p_payload->>'guardian_travel_reviewed')::boolean,false));kind:='lodging.assigned';
  elsif p_action='lodging_remove' then
   if exists(select 1 from public.outreach_team_room_assignments a join public.outreach_team_members d on d.id=a.member_id where d.guardian_member_id=m.id and a.room_id=(p_payload->>'room_id')::uuid and not a.guardian_travel_reviewed) then raise exception 'Release dependent lodging before removing guardian room';end if;delete from public.outreach_team_room_assignments where member_id=m.id and room_id=(p_payload->>'room_id')::uuid;kind:='lodging.changed';
  elsif p_action='travel_mode' then
   if exists(select 1 from public.outreach_team_vehicle_assignments where member_id=m.id) then raise exception 'Release official vehicle before changing travel mode';end if;
   if p_payload->>'travel_mode'='official_vehicle' then raise exception 'Official vehicle mode requires assignment';end if;
   update public.outreach_team_members set travel_mode=p_payload->>'travel_mode' where outreach_team_members.id=m.id;kind:='trip_details.updated';
  end if;
  update public.outreach_team_members set revision=revision+1,updated_at=now() where outreach_team_members.id=m.id;
 elsif p_action='household_link' then
  select * into s from public.outreach_team_signups where campaign_id=c.id and outreach_team_signups.id=(p_payload->>'signup_id')::uuid;
  if s.id is null or s.revision is distinct from (p_payload->>'revision')::int then raise exception 'Party changed; reload';end if;
  if not(private.has_staff_permission(c.organization_id,'households.read') and private.has_staff_permission(c.organization_id,'people.read')) or not exists(select 1 from public.households h where h.organization_id=c.organization_id and h.id=(p_payload->>'household_id')::uuid and h.status='active') then raise exception 'Reviewed canonical Household required' using errcode='42501';end if;
  if length(btrim(coalesce(p_payload->>'reason','')))<10 then raise exception 'Household review reason required';end if;
  if exists(select 1 from public.outreach_team_members t where t.signup_id=s.id and (t.person_id is null or not exists(select 1 from public.household_members h where h.household_id=(p_payload->>'household_id')::uuid and h.person_id=t.person_id and h.active))) then raise exception 'Review canonical Household memberships first';end if;
  update public.outreach_team_signups set household_id=(p_payload->>'household_id')::uuid,revision=revision+1 where outreach_team_signups.id=s.id;target_id:=s.id;kind:='team.household_linked';
 elsif p_action='guardian_link' then
  if not (private.person_permission(c.organization_id,(p_payload->>'primary_person_id')::uuid,'people.read') and private.person_permission(c.organization_id,(p_payload->>'dependent_person_id')::uuid,'people.read')) then raise exception 'Reviewed canonical guardian/dependent required' using errcode='42501';end if;
  if length(btrim(coalesce(p_payload->>'reason','')))<10 then raise exception 'Guardian review reason required';end if;
  if not exists(select 1 from public.household_members a join public.household_members b on b.household_id=a.household_id and b.organization_id=a.organization_id join public.households hh on hh.id=a.household_id and hh.status='active' where a.organization_id=c.organization_id and a.person_id=(p_payload->>'primary_person_id')::uuid and b.person_id=(p_payload->>'dependent_person_id')::uuid and a.active and b.active) then raise exception 'Active canonical Household relationship required';end if;
  insert into public.outreach_team_guardian_links(campaign_id,primary_person_id,dependent_person_id,active,reviewed_by,reason) values(c.id,(p_payload->>'primary_person_id')::uuid,(p_payload->>'dependent_person_id')::uuid,coalesce((p_payload->>'active')::boolean,true),auth.uid(),p_payload->>'reason') on conflict(campaign_id,primary_person_id,dependent_person_id) do update set active=excluded.active,reviewed_by=excluded.reviewed_by,reason=excluded.reason;target_id:=(p_payload->>'dependent_person_id')::uuid;kind:='team.guardian_authority_changed';
 elsif p_action='vehicle_save' then
  select * into v from public.outreach_team_vehicles where campaign_id=c.id and outreach_team_vehicles.id=target_id;
  if target_id is not null and (v.id is null or v.revision is distinct from (p_payload->>'revision')::int) then raise exception 'Vehicle changed; reload';end if;
  select count(*),count(*) filter(where seat_role='passenger') into occupation,seats from public.outreach_team_vehicle_assignments where vehicle_id=target_id;
  if occupation>0 and (not coalesce((p_payload->>'active')::boolean,true) or not coalesce((p_payload->>'passenger_carrying')::boolean,true) and seats>0 or occupation>(p_payload->>'total_capacity')::int or seats>(p_payload->>'passenger_capacity')::int) then raise exception 'Release occupants before restricting vehicle';end if;
  insert into public.outreach_team_vehicles(id,campaign_id,label,vehicle_type,total_capacity,passenger_capacity,passenger_carrying,towing,active,departure_at,departure_location,destination,participant_notes,internal_notes,revision)
  values(coalesce(target_id,gen_random_uuid()),c.id,p_payload->>'label',p_payload->>'vehicle_type',(p_payload->>'total_capacity')::int,(p_payload->>'passenger_capacity')::int,coalesce((p_payload->>'passenger_carrying')::boolean,true),coalesce((p_payload->>'towing')::boolean,false),coalesce((p_payload->>'active')::boolean,true),(p_payload->>'departure_at')::timestamptz,coalesce(p_payload->>'departure_location',''),coalesce(p_payload->>'destination',''),coalesce(p_payload->>'participant_notes',''),coalesce(p_payload->>'internal_notes',''),coalesce(v.revision,0)+1)
  on conflict on constraint outreach_team_vehicles_pkey do update set label=excluded.label,vehicle_type=excluded.vehicle_type,total_capacity=excluded.total_capacity,passenger_capacity=excluded.passenger_capacity,passenger_carrying=excluded.passenger_carrying,towing=excluded.towing,active=excluded.active,departure_at=excluded.departure_at,departure_location=excluded.departure_location,destination=excluded.destination,participant_notes=excluded.participant_notes,internal_notes=excluded.internal_notes,revision=excluded.revision returning outreach_team_vehicles.id into target_id;kind:='trip_details.updated';
 elsif p_action='lodging_save' then
  select * into l from public.outreach_team_lodgings where campaign_id=c.id and outreach_team_lodgings.id=target_id;
  if target_id is not null and (l.id is null or l.revision is distinct from (p_payload->>'revision')::int) then raise exception 'Lodging changed; reload';end if;
  if target_id is not null and exists(select 1 from public.outreach_team_room_assignments a join public.outreach_team_rooms x on x.id=a.room_id where x.lodging_id=target_id) and (l.check_in is distinct from (p_payload->>'check_in')::timestamptz or l.check_out is distinct from (p_payload->>'check_out')::timestamptz or not coalesce((p_payload->>'active')::boolean,true)) then raise exception 'Release assignments before changing stay window or deactivating lodging';end if;
  insert into public.outreach_team_lodgings(id,campaign_id,name,address,phone,check_in,check_out,map_url,participant_notes,internal_notes,visibility,active,revision)
  values(coalesce(target_id,gen_random_uuid()),c.id,p_payload->>'name',coalesce(p_payload->>'address',''),coalesce(p_payload->>'phone',''),(p_payload->>'check_in')::timestamptz,(p_payload->>'check_out')::timestamptz,nullif(p_payload->>'map_url',''),coalesce(p_payload->>'participant_notes',''),coalesce(p_payload->>'internal_notes',''),coalesce(p_payload->>'visibility','assigned'),coalesce((p_payload->>'active')::boolean,true),coalesce(l.revision,0)+1)
  on conflict on constraint outreach_team_lodgings_pkey do update set name=excluded.name,address=excluded.address,phone=excluded.phone,check_in=excluded.check_in,check_out=excluded.check_out,map_url=excluded.map_url,participant_notes=excluded.participant_notes,internal_notes=excluded.internal_notes,visibility=excluded.visibility,active=excluded.active,revision=excluded.revision returning outreach_team_lodgings.id into target_id;kind:='trip_details.updated';
 elsif p_action='room_save' then
  select * into r from public.outreach_team_rooms where campaign_id=c.id and outreach_team_rooms.id=target_id;
  if target_id is not null and (r.id is null or r.revision is distinct from (p_payload->>'revision')::int) then raise exception 'Room changed; reload';end if;
  select count(*) into occupation from public.outreach_team_room_assignments where room_id=target_id;
  if occupation>0 and (r.lodging_id is distinct from (p_payload->>'lodging_id')::uuid or not coalesce((p_payload->>'active')::boolean,true) or ((p_payload->>'capacity')::int is not null and occupation>(p_payload->>'capacity')::int)) then raise exception 'Release occupants before restricting room';end if;
  insert into public.outreach_team_rooms(id,campaign_id,lodging_id,label,capacity,internal_notes,active,revision)
  values(coalesce(target_id,gen_random_uuid()),c.id,(p_payload->>'lodging_id')::uuid,p_payload->>'label',(p_payload->>'capacity')::int,coalesce(p_payload->>'internal_notes',''),coalesce((p_payload->>'active')::boolean,true),coalesce(r.revision,0)+1)
  on conflict on constraint outreach_team_rooms_pkey do update set lodging_id=excluded.lodging_id,label=excluded.label,capacity=excluded.capacity,internal_notes=excluded.internal_notes,active=excluded.active,revision=excluded.revision returning outreach_team_rooms.id into target_id;kind:='trip_details.updated';
 elsif p_action='meeting_save' then
  if target_id is not null and not exists(select 1 from public.outreach_team_meetings where campaign_id=c.id and outreach_team_meetings.id=target_id and revision=(p_payload->>'revision')::int) then raise exception 'Meeting changed; reload';end if;
  insert into public.outreach_team_meetings(id,campaign_id,label,kind,address,meet_at,instructions,map_url,visibility)
  values(coalesce(target_id,gen_random_uuid()),c.id,p_payload->>'label',p_payload->>'kind',coalesce(p_payload->>'address',''),(p_payload->>'meet_at')::timestamptz,coalesce(p_payload->>'instructions',''),nullif(p_payload->>'map_url',''),coalesce(p_payload->>'visibility','participants'))
  on conflict on constraint outreach_team_meetings_pkey do update set label=excluded.label,kind=excluded.kind,address=excluded.address,meet_at=excluded.meet_at,instructions=excluded.instructions,map_url=excluded.map_url,visibility=excluded.visibility,revision=outreach_team_meetings.revision+1 returning outreach_team_meetings.id into target_id;kind:='trip_details.updated';
 elsif p_action='reminders' then
  -- Held manual tasks/events only, never claims provider delivery. Stable daily cadence.
  for m in select * from public.outreach_team_members where campaign_id=c.id and status not in ('cancelled','not_selected') loop
   if m.status in ('applied','under_review') then perform private.outreach_event(c.id,'team.action_required',m.id,'team-approval:'||m.id||':'||current_date);end if;
   if m.status='approved' then
    if m.transport_preference='needs_ride' and not exists(select 1 from public.outreach_team_vehicle_assignments where member_id=m.id) then perform private.outreach_event(c.id,'team.action_required',m.id,'team-ride:'||m.id||':'||current_date);end if;
    if m.travel_mode='official_vehicle' and not exists(select 1 from public.outreach_team_vehicle_assignments where member_id=m.id) then perform private.outreach_event(c.id,'team.action_required',m.id,'team-vehicle:'||m.id||':'||current_date);end if;
    if m.lodging_preference='needs_lodging' and not exists(select 1 from public.outreach_team_room_assignments where member_id=m.id) then perform private.outreach_event(c.id,'team.action_required',m.id,'team-lodging:'||m.id||':'||current_date);end if;
   end if;
   if m.volunteering and m.status in ('approved','self_traveling','guest') and not exists(select 1 from public.outreach_team_role_assignments where member_id=m.id) then perform private.outreach_event(c.id,'team.action_required',m.id,'team-role:'||m.id||':'||current_date);end if;
  end loop;
  for v in select * from public.outreach_team_vehicles where campaign_id=c.id and active and departure_at between now() and now()+interval '3 days' loop perform private.outreach_event(c.id,'departure_reminder',v.id,'team-departure:'||v.id||':'||current_date);end loop;
  return jsonb_build_object('state','held','events',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'subject_id',x.subject_id,'created_at',x.created_at,'acknowledged_at',x.acknowledged_at)) from public.outreach_campaign_events x where x.campaign_id=c.id and (x.kind like 'team_%' or x.kind in ('vehicle.assigned','vehicle.changed','lodging.assigned','lodging.changed','trip_details.updated','departure_reminder'))),'[]'));
 else raise exception 'Unknown team/travel action' using errcode='22023';end if;
 if p_action<>'status' then perform private.outreach_audit(c.id,c.organization_id,kind,target_id,jsonb_build_object('operation',p_action));end if;
 if kind in ('team_signup.approved','team_signup.waitlisted','team_signup.not_selected','vehicle.assigned','vehicle.changed','lodging.assigned','lodging.changed','trip_details.updated','team_role.assigned') then perform private.outreach_event(c.id,kind,target_id,'team-event:'||operation);end if;
 return jsonb_build_object('id',target_id,'saved',true);
end $$;
create function public.outreach_team_portal(p_action text,p_campaign uuid default null,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select private.outreach_team_portal(p_action,p_campaign,p_payload) $$;
create function public.outreach_team_workspace(p_action text,p_campaign uuid,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select private.outreach_team_workspace(p_action,p_campaign,p_payload) $$;
revoke all on function private.outreach_team_can(uuid,text),private.outreach_team_open(uuid),private.outreach_team_guardian(uuid,uuid,uuid),private.outreach_team_official(uuid,uuid),private.outreach_team_lock(uuid,text),private.outreach_team_manifest(uuid,jsonb),private.outreach_team_portal(text,uuid,jsonb),private.outreach_team_workspace(text,uuid,jsonb),public.outreach_team_portal(text,uuid,jsonb),public.outreach_team_workspace(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.outreach_team_portal(text,uuid,jsonb),private.outreach_team_workspace(text,uuid,jsonb),public.outreach_team_portal(text,uuid,jsonb),public.outreach_team_workspace(text,uuid,jsonb) to authenticated;
do $$declare n text;begin
 foreach n in array array['outreach_team_settings','outreach_team_roles','outreach_team_signups','outreach_team_members','outreach_team_guardian_links','outreach_team_vehicles','outreach_team_vehicle_assignments','outreach_team_lodgings','outreach_team_rooms','outreach_team_room_assignments','outreach_team_role_assignments','outreach_team_meetings'] loop
  execute format('alter table public.%I enable row level security',n);execute format('revoke all on public.%I from public,anon,authenticated',n);execute format('grant all on public.%I to service_role',n);
 end loop;
end $$;
create function public.outreach_team_access(p_campaign uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(array(select k from unnest(array['team.view','team.manage','travel.view','travel.manage']) k where private.outreach_team_can(p_campaign,k)))
$$;
revoke all on function public.outreach_team_access(uuid) from public,anon,authenticated;
grant execute on function public.outreach_team_access(uuid) to authenticated;


-- Extracted from PR #29: 20261018124700_huntsville_team_setup.sql
-- Prepare Huntsville team/travel settings without opening public team signup.
do $$
declare c uuid;
begin
  select id into strict c from public.outreach_campaigns where code='huntsville_al_2026';

  insert into public.outreach_team_settings(
    campaign_id,enabled,window_override,multiple_roles,participant_notes,coordination_name,coordination_phone
  ) values (
    c,false,'closed',true,
    'Champion Life team planning for the Huntsville / City Hangout outreach.',
    '',''
  )
  on conflict(campaign_id) do nothing;

  insert into public.outreach_team_roles(campaign_id,name,active) values
    (c,'Prayer Team',true),
    (c,'Registration & Check-In',true),
    (c,'Setup & Logistics',true),
    (c,'Giveaways & Family Support',true),
    (c,'Discipleship & Follow-Up',true),
    (c,'Serve Wherever Needed',true)
  on conflict(campaign_id,name) do nothing;
end $$;


-- Extracted from PR #29: 20261018124800_unified_staff_workspace_grants_fix.sql
-- Allow authenticated callers to traverse the reviewed public invoker wrappers.
grant execute on function private.outreach_decision_workspace(text,uuid,jsonb) to authenticated;
grant execute on function private.outreach_access_workspace(text,jsonb) to authenticated;


-- Extracted from PR #29: 20261018124900_unified_staff_workspace_function_fix.sql
create or replace function private.outreach_decision_workspace(p_action text,p_campaign uuid,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  c public.outreach_campaigns;
  src text;
  r public.outreach_registrations;
  f public.outreach_decision_followup;
  search_text text;
  next_status text;
begin
  if not private.outreach_verified(auth.uid()) then
    raise exception 'Verified sign-in required' using errcode='42501';
  end if;

  if p_action='campaigns' then
    return coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',oc.id,'name',oc.name,'code',oc.code,'city',oc.city,'state_province',oc.state_province,
          'country',oc.country,'status',oc.status,'public_page',oc.public_page,
          'decision_count',(select count(*) from public.outreach_registrations rr where rr.source=srcmap.source),
          'salvation_count',(select count(*) from public.outreach_registrations rr where rr.source=srcmap.source and rr.decision='salvation'),
          'rededication_count',(select count(*) from public.outreach_registrations rr where rr.source=srcmap.source and rr.decision='rededication'),
          'followup_count',(select count(*) from public.outreach_registrations rr where rr.source=srcmap.source and rr.decision='prayer_followup')
        )
        order by oc.name
      )
      from public.outreach_campaigns oc
      join public.outreach_decision_campaign_sources srcmap on srcmap.campaign_id=oc.id and srcmap.active
      where private.outreach_decision_can(oc.id,'decision.view')
    ),'[]'::jsonb);
  end if;

  select * into c from public.outreach_campaigns where id=p_campaign;
  select source into src from public.outreach_decision_campaign_sources where campaign_id=p_campaign and active;
  if c.id is null or src is null or not private.outreach_decision_can(p_campaign,'decision.view') then
    raise exception 'Decision workspace access denied' using errcode='42501';
  end if;

  if p_action='context' then
    return jsonb_build_object(
      'campaign',jsonb_build_object(
        'id',c.id,'name',c.name,'code',c.code,'city',c.city,'state_province',c.state_province,
        'country',c.country,'status',c.status,'public_page',c.public_page
      ),
      'capabilities',jsonb_build_array('decision.view') ||
        case when private.outreach_decision_can(p_campaign,'decision.manage')
          then jsonb_build_array('decision.manage') else '[]'::jsonb end
    );
  end if;

  if p_action='list' then
    search_text:=left(btrim(coalesce(p_payload->>'search','')),100);
    return jsonb_build_object(
      'summary',jsonb_build_object(
        'total',(select count(*) from public.outreach_registrations x where x.source=src),
        'salvation',(select count(*) from public.outreach_registrations x where x.source=src and x.decision='salvation'),
        'rededication',(select count(*) from public.outreach_registrations x where x.source=src and x.decision='rededication'),
        'learn_more',(select count(*) from public.outreach_registrations x where x.source=src and x.decision='learn_more'),
        'prayer_followup',(select count(*) from public.outreach_registrations x where x.source=src and x.decision='prayer_followup'),
        'open_followup',(select count(*) from public.outreach_registrations x
          left join public.outreach_decision_followup y on y.registration_id=x.id
          where x.source=src and coalesce(y.status,'new')<>'closed')
      ),
      'registrations',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',x.id,'name',x.first_name||' '||x.last_name,'first_name',x.first_name,'last_name',x.last_name,
          'email',x.email,'phone',x.phone,'decision',x.decision,'created_at',x.created_at,
          'followup_status',coalesce(y.status,'new'),'assigned_user_id',y.assigned_user_id,'revision',coalesce(y.revision,0)
        ) order by x.created_at desc)
        from public.outreach_registrations x
        left join public.outreach_decision_followup y on y.registration_id=x.id
        where x.source=src
          and (
            search_text=''
            or concat_ws(' ',x.first_name,x.last_name,x.email,x.phone,x.decision) ilike
              '%'||replace(replace(search_text,'%','\%'),'_','\_')||'%'
          )
      ),'[]'::jsonb)
    );
  end if;

  if p_payload->>'registration_id' is null then
    raise exception 'Registration required';
  end if;
  select * into r from public.outreach_registrations
   where id=(p_payload->>'registration_id')::uuid and source=src;
  if r.id is null then raise exception 'Registration outside campaign' using errcode='42501'; end if;

  if p_action='detail' then
    select * into f from public.outreach_decision_followup where registration_id=r.id;
    return jsonb_build_object(
      'id',r.id,'first_name',r.first_name,'last_name',r.last_name,'email',r.email,'phone',r.phone,
      'decision',r.decision,'prayer_request',r.prayer_request,'created_at',r.created_at,'consent',r.consent,
      'followup_status',coalesce(f.status,'new'),'assigned_user_id',f.assigned_user_id,
      'notes',coalesce(f.notes,''),'revision',coalesce(f.revision,0)
    );
  end if;

  if p_action='save' then
    if not private.outreach_decision_can(p_campaign,'decision.manage') then
      raise exception 'Decision management access denied' using errcode='42501';
    end if;
    next_status:=p_payload->>'status';
    if next_status not in ('new','contacting','connected','discipleship','closed') then
      raise exception 'Invalid follow-up status';
    end if;
    if coalesce((p_payload->>'revision')::int,0)=0 then
      insert into public.outreach_decision_followup(
        registration_id,campaign_id,status,assigned_user_id,notes,updated_by
      ) values (
        r.id,p_campaign,next_status,
        nullif(p_payload->>'assigned_user_id','')::uuid,
        left(coalesce(p_payload->>'notes',''),4000),auth.uid()
      )
      on conflict(registration_id) do nothing;
      if not found then raise exception 'Follow-up changed; reload'; end if;
    else
      update public.outreach_decision_followup
         set status=next_status,
             assigned_user_id=nullif(p_payload->>'assigned_user_id','')::uuid,
             notes=left(coalesce(p_payload->>'notes',''),4000),
             updated_by=auth.uid(),updated_at=now(),revision=revision+1
       where registration_id=r.id and revision=(p_payload->>'revision')::int;
      if not found then raise exception 'Follow-up changed; reload'; end if;
    end if;
    perform private.outreach_audit(p_campaign,c.organization_id,'decision.followup_updated',r.id,
      jsonb_build_object('status',next_status));
    return jsonb_build_object('saved',true);
  end if;

  raise exception 'Unsupported decision action';
end $$;


-- Extracted from PR #29: 20261018125000_restrict_unified_staff_access_admin.sql
create or replace function private.outreach_access_admin()
returns boolean language sql stable security definer set search_path=''
as $$
 select private.outreach_verified(auth.uid()) and exists(
   select 1
   from public.organizations o
   where o.slug in ('champion-life','sowgo')
     and private.has_staff_permission(o.id,'staff.manage')
 )
$$;


-- Extracted from PR #29: 20261018133000_outreach_partner_pastoral_v1.sql
-- OUTREACH-PARTNER-PASTORAL-V1
-- Campaign-scoped partner church access, assignment, follow-up and pastoral privacy.
-- Additive only. Source registrations/decisions remain immutable through this package.

create table public.outreach_partner_churches (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.outreach_campaigns(id),
  name text not null check(length(btrim(name)) between 2 and 180),
  slug text not null check(slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  external_organization_id uuid references public.organizations(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  revision integer not null default 1,
  unique(campaign_id,slug),
  unique(campaign_id,id)
);

create table public.outreach_partner_users (
  partner_church_id uuid not null references public.outreach_partner_churches(id),
  campaign_id uuid not null,
  user_id uuid not null references auth.users(id),
  capabilities text[] not null,
  active boolean not null default true,
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  granted_by uuid not null references auth.users(id),
  reason text not null check(length(btrim(reason)) between 10 and 500),
  revision integer not null default 1,
  primary key(partner_church_id,user_id),
  foreign key(campaign_id,partner_church_id) references public.outreach_partner_churches(campaign_id,id),
  check(expires_at is null or expires_at>effective_at),
  check(
    capabilities <@ array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes']::text[]
    and cardinality(capabilities)>0
    and array_position(capabilities,null) is null
    and (not('partner.followup'=any(capabilities)) or 'partner.view'=any(capabilities))
    and (not('partner.assign_local'=any(capabilities)) or 'partner.view'=any(capabilities))
    and (not('partner.export'=any(capabilities)) or 'partner.view'=any(capabilities))
    and (not('partner.pastoral_notes'=any(capabilities)) or 'partner.view'=any(capabilities))
  )
);
create index outreach_partner_users_user_idx on public.outreach_partner_users(user_id,campaign_id);

create table public.outreach_partner_assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.outreach_campaigns(id),
  partner_church_id uuid not null,
  decision_registration_id uuid references public.outreach_registrations(id),
  event_registration_id uuid references public.outreach_event_registrations(id),
  assigned_worker_user_id uuid references auth.users(id),
  status text not null default 'active' check(status in ('active','completed','revoked')),
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default now(),
  assignment_reason text not null check(length(btrim(assignment_reason)) between 10 and 500),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  revision integer not null default 1,
  foreign key(campaign_id,partner_church_id) references public.outreach_partner_churches(campaign_id,id),
  check((decision_registration_id is not null)::int + (event_registration_id is not null)::int = 1),
  check((status='revoked')=(revoked_at is not null))
);
create unique index outreach_partner_assignment_decision_active_uq
  on public.outreach_partner_assignments(partner_church_id,decision_registration_id)
  where decision_registration_id is not null and status<>'revoked';
create unique index outreach_partner_assignment_event_active_uq
  on public.outreach_partner_assignments(partner_church_id,event_registration_id)
  where event_registration_id is not null and status<>'revoked';
create index outreach_partner_assignments_campaign_idx on public.outreach_partner_assignments(campaign_id,partner_church_id,status);

create table public.outreach_partner_followup (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.outreach_partner_assignments(id),
  campaign_id uuid not null,
  partner_church_id uuid not null,
  status text not null check(status in ('new','attempted','contacted','connected','discipleship_started','needs_followup','declined','complete')),
  next_contact_at timestamptz,
  shared_note text not null default '' check(length(shared_note)<=4000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  revision integer not null default 1,
  foreign key(campaign_id,partner_church_id) references public.outreach_partner_churches(campaign_id,id)
);
create index outreach_partner_followup_assignment_idx on public.outreach_partner_followup(assignment_id,created_at desc);

create table public.outreach_partner_pastoral_notes (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.outreach_partner_assignments(id),
  campaign_id uuid not null,
  partner_church_id uuid not null,
  note text not null check(length(btrim(note)) between 1 and 8000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  revision integer not null default 1,
  foreign key(campaign_id,partner_church_id) references public.outreach_partner_churches(campaign_id,id)
);
create index outreach_partner_pastoral_notes_assignment_idx on public.outreach_partner_pastoral_notes(assignment_id,created_at desc);

create function private.outreach_partner_central_manage(p_campaign uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
 select private.outreach_verified(auth.uid()) and exists(
   select 1 from public.outreach_campaigns c
   where c.id=p_campaign
     and (private.outreach_admin(c.organization_id,true)
       or private.has_staff_permission(c.organization_id,'staff.manage')
       or private.has_staff_permission(c.organization_id,'outreach.manage'))
 )
$$;

create function private.outreach_partner_cap(p_partner uuid,p_cap text)
returns boolean
language sql stable security definer set search_path=''
as $$
 select p_cap in ('partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes')
 and private.outreach_verified(auth.uid())
 and exists(
   select 1 from public.outreach_partner_users u
   join public.outreach_partner_churches p on p.id=u.partner_church_id and p.active
   where u.partner_church_id=p_partner and u.user_id=auth.uid() and u.active
     and u.effective_at<=now() and (u.expires_at is null or u.expires_at>now())
     and p_cap=any(u.capabilities)
 )
$$;

create function private.outreach_partner_assignment_allowed(p_assignment uuid,p_cap text)
returns boolean
language sql stable security definer set search_path=''
as $$
 select exists(
   select 1 from public.outreach_partner_assignments a
   where a.id=p_assignment and a.status<>'revoked'
     and (private.outreach_partner_central_manage(a.campaign_id)
       or private.outreach_partner_cap(a.partner_church_id,p_cap))
 )
$$;

create function private.outreach_partner_subject_json(a public.outreach_partner_assignments)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  d public.outreach_registrations;
  e public.outreach_event_registrations;
  minors jsonb;
begin
  if a.decision_registration_id is not null then
    select * into d from public.outreach_registrations where id=a.decision_registration_id;
    return jsonb_build_object(
      'kind','decision','id',d.id,'name',d.first_name||' '||d.last_name,
      'first_name',d.first_name,'last_name',d.last_name,'email',d.email,'phone',d.phone,
      'decision',d.decision,'prayer_request',d.prayer_request,'consent',d.consent,'created_at',d.created_at
    );
  end if;
  select * into e from public.outreach_event_registrations where id=a.event_registration_id;
  select coalesce(jsonb_agg(jsonb_build_object(
      'first_name',x.first_name,'last_name',x.last_name,'age',x.age,
      'relationship',x.relationship,'guardian_relationship',x.guardian_relationship,
      'attending',x.attending,'checked_in',x.checked_in_at is not null
    ) order by x.age desc,x.first_name),'[]'::jsonb)
    into minors
    from public.outreach_event_attendees x
    where x.registration_id=e.id and x.active;
  return jsonb_build_object(
    'kind','household','id',e.id,'reference',e.reference,
    'name',e.first_name||' '||e.last_name,'first_name',e.first_name,'last_name',e.last_name,
    'email',e.email,'phone',e.phone,'status',e.status,'submitted_at',e.submitted_at,
    'attendees',minors,
    'minor_contact_rule','Use the registering adult/guardian contact. Do not contact minors directly.'
  );
end $$;

create function private.outreach_partner_workspace(p_action text,p_partner uuid,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  partner_row public.outreach_partner_churches;
  a public.outreach_partner_assignments;
  worker uuid;
  assignment_id uuid;
  source text;
  row_id uuid;
  caps text[];
  fstatus text;
begin
  if not private.outreach_verified(auth.uid()) then raise exception 'Verified sign-in required' using errcode='42501'; end if;

  if p_action='partners' then
    return coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',pc.id,'campaign_id',pc.campaign_id,'name',pc.name,'slug',pc.slug,
        'campaign_name',c.name,'campaign_status',c.status,
        'capabilities',to_jsonb(array(select k from unnest(array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes']) k where private.outreach_partner_cap(partner_row.id,k))),
        'central_manage',private.outreach_partner_central_manage(partner_row.campaign_id)
      ) order by c.name,pc.name)
      from public.outreach_partner_churches pc
      join public.outreach_campaigns c on c.id=pc.campaign_id
      where pc.active and (private.outreach_partner_central_manage(pc.campaign_id) or private.outreach_partner_cap(pc.id,'partner.view'))
    ),'[]'::jsonb);
  end if;

  select * into partner_row from public.outreach_partner_churches where id=p_partner and active;
  if partner_row.id is null or not(private.outreach_partner_central_manage(partner_row.campaign_id) or private.outreach_partner_cap(partner_row.id,'partner.view')) then
    raise exception 'Partner workspace access denied' using errcode='42501';
  end if;
  caps:=array(select k from unnest(array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes']) k where private.outreach_partner_cap(partner_row.id,k));

  if p_action='context' then
    return jsonb_build_object(
      'partner',jsonb_build_object('id',partner_row.id,'name',partner_row.name,'campaign_id',partner_row.campaign_id,'slug',partner_row.slug),
      'campaign',(select jsonb_build_object('id',c.id,'name',c.name,'status',c.status,'city',c.city,'state_province',c.state_province) from public.outreach_campaigns c where c.id=partner_row.campaign_id),
      'capabilities',to_jsonb(caps),'central_manage',private.outreach_partner_central_manage(partner_row.campaign_id)
    );
  end if;

  if p_action='list' then
    return jsonb_build_object(
      'summary',jsonb_build_object(
        'assigned',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'),
        'open',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status='active'),
        'completed',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status='completed'),
        'needs_followup',(select count(distinct x.id) from public.outreach_partner_assignments x left join lateral (
          select status from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1
        ) lf on true where x.partner_church_id=partner_row.id and x.status<>'revoked' and coalesce(lf.status,'new') in ('new','attempted','needs_followup'))
      ),
      'assignments',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',x.id,'subject',private.outreach_partner_subject_json(x),'status',x.status,
          'assigned_worker_user_id',x.assigned_worker_user_id,'assigned_at',x.assigned_at,
          'latest_followup',(select jsonb_build_object('status',y.status,'next_contact_at',y.next_contact_at,'created_at',y.created_at)
             from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1)
        ) order by x.assigned_at desc)
        from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'
      ),'[]'::jsonb)
    );
  end if;

  if p_action='detail' then
    assignment_id:=(p_payload->>'assignment_id')::uuid;
    select * into a from public.outreach_partner_assignments where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked';
    if a.id is null then raise exception 'Assignment unavailable' using errcode='42501'; end if;
    return jsonb_build_object(
      'assignment',jsonb_build_object('id',a.id,'status',a.status,'assigned_worker_user_id',a.assigned_worker_user_id,'revision',a.revision),
      'subject',private.outreach_partner_subject_json(a),
      'followup',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'status',x.status,'next_contact_at',x.next_contact_at,'shared_note',x.shared_note,'created_at',x.created_at,'created_by',x.created_by) order by x.created_at desc) from public.outreach_partner_followup x where x.assignment_id=a.id),'[]'::jsonb),
      'pastoral_notes',case
        when private.outreach_partner_cap(partner_row.id,'partner.pastoral_notes') or private.has_staff_permission((select organization_id from public.outreach_campaigns where id=partner_row.campaign_id),'care.read')
        then coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'note',n.note,'created_at',n.created_at,'created_by',n.created_by) order by n.created_at desc) from public.outreach_partner_pastoral_notes n where n.assignment_id=a.id),'[]'::jsonb)
        else '[]'::jsonb end
    );
  end if;

  if p_action='followup_add' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.followup') or private.outreach_partner_central_manage(partner_row.campaign_id)) then raise exception 'Follow-up access denied' using errcode='42501'; end if;
    assignment_id:=(p_payload->>'assignment_id')::uuid;
    select * into a from public.outreach_partner_assignments where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked' for update;
    if a.id is null then raise exception 'Assignment unavailable' using errcode='42501'; end if;
    fstatus:=p_payload->>'status';
    if fstatus not in ('new','attempted','contacted','connected','discipleship_started','needs_followup','declined','complete') then raise exception 'Invalid follow-up status'; end if;
    insert into public.outreach_partner_followup(assignment_id,campaign_id,partner_church_id,status,next_contact_at,shared_note,created_by)
    values(a.id,a.campaign_id,a.partner_church_id,fstatus,(p_payload->>'next_contact_at')::timestamptz,left(coalesce(p_payload->>'shared_note',''),4000),auth.uid());
    if fstatus in ('complete','declined') then update public.outreach_partner_assignments set status='completed',revision=revision+1 where id=a.id; end if;
    perform private.outreach_audit(a.campaign_id,(select organization_id from public.outreach_campaigns where id=a.campaign_id),'partner.followup_recorded',a.id,jsonb_build_object('partner_church_id',partner_row.id,'status',fstatus));
    return jsonb_build_object('saved',true);
  end if;

  if p_action='pastoral_note_add' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.pastoral_notes') or private.has_staff_permission((select organization_id from public.outreach_campaigns where id=partner_row.campaign_id),'care.read')) then raise exception 'Pastoral note access denied' using errcode='42501'; end if;
    assignment_id:=(p_payload->>'assignment_id')::uuid;
    select * into a from public.outreach_partner_assignments where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked';
    if a.id is null then raise exception 'Assignment unavailable' using errcode='42501'; end if;
    insert into public.outreach_partner_pastoral_notes(assignment_id,campaign_id,partner_church_id,note,created_by)
    values(a.id,a.campaign_id,a.partner_church_id,left(btrim(p_payload->>'note'),8000),auth.uid());
    perform private.outreach_audit(a.campaign_id,(select organization_id from public.outreach_campaigns where id=a.campaign_id),'partner.pastoral_note_recorded',a.id,jsonb_build_object('partner_church_id',partner_row.id));
    return jsonb_build_object('saved',true);
  end if;

  if p_action='assign_worker' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.assign_local') or private.outreach_partner_central_manage(partner_row.campaign_id)) then raise exception 'Local assignment access denied' using errcode='42501'; end if;
    assignment_id:=(p_payload->>'assignment_id')::uuid;
    worker:=nullif(p_payload->>'user_id','')::uuid;
    if worker is not null and not exists(select 1 from public.outreach_partner_users u where u.partner_church_id=partner_row.id and u.user_id=worker and u.active and u.effective_at<=now() and (u.expires_at is null or u.expires_at>now())) then raise exception 'Worker outside partner church' using errcode='42501'; end if;
    update public.outreach_partner_assignments set assigned_worker_user_id=worker,revision=revision+1 where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked';
    if not found then raise exception 'Assignment unavailable' using errcode='42501'; end if;
    return jsonb_build_object('saved',true);
  end if;

  if p_action='export' then
    if not private.outreach_partner_cap(partner_row.id,'partner.export') and not private.outreach_partner_central_manage(partner_row.campaign_id) then raise exception 'Export access denied' using errcode='42501'; end if;
    return jsonb_build_object(
      'filename',partner_row.slug||'-followup.csv',
      'rows',coalesce((
        select jsonb_agg(jsonb_build_object(
          'name',private.outreach_partner_subject_json(x)->>'name',
          'email',private.outreach_partner_subject_json(x)->>'email',
          'phone',private.outreach_partner_subject_json(x)->>'phone',
          'decision',private.outreach_partner_subject_json(x)->>'decision',
          'status',coalesce((select y.status from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1),'new'),
          'next_contact_at',(select y.next_contact_at from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1)
        ) order by x.assigned_at)
        from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'
      ),'[]'::jsonb)
    );
  end if;

  raise exception 'Unsupported partner action';
end $$;

create function public.outreach_partner_workspace(p_action text,p_partner uuid default null,p_payload jsonb default '{}')
returns jsonb language sql security invoker set search_path=''
as $$ select private.outreach_partner_workspace(p_action,p_partner,p_payload) $$;

create function private.outreach_partner_admin_workspace(p_action text,p_campaign uuid,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  p public.outreach_partner_churches;
  pid uuid;
  uid uuid;
  assignment uuid;
  decision_source text;
  target uuid;
begin
  if not private.outreach_partner_central_manage(p_campaign) then raise exception 'Partner administration denied' using errcode='42501'; end if;

  if p_action='list' then
    return jsonb_build_object(
      'partners',coalesce((
        select jsonb_agg(to_jsonb(x)||jsonb_build_object(
          'users',coalesce((select jsonb_agg(jsonb_build_object(
            'user_id',u.user_id,'email',(select email from auth.users where id=u.user_id),
            'capabilities',u.capabilities,'active',u.active,'revision',u.revision
          ) order by lower((select email from auth.users where id=u.user_id))) from public.outreach_partner_users u where u.partner_church_id=x.id),'[]'::jsonb)
        ) order by x.name)
        from public.outreach_partner_churches x where x.campaign_id=p_campaign
      ),'[]'::jsonb),
      'unassigned_decisions',coalesce((
        select jsonb_agg(jsonb_build_object('id',r.id,'name',r.first_name||' '||r.last_name,'decision',r.decision,'created_at',r.created_at) order by r.created_at desc)
        from public.outreach_decision_campaign_sources s
        join public.outreach_registrations r on r.source=s.source
        where s.campaign_id=p_campaign and s.active
          and not exists(select 1 from public.outreach_partner_assignments a where a.campaign_id=p_campaign and a.decision_registration_id=r.id and a.status<>'revoked')
      ),'[]'::jsonb),
      'unassigned_households',coalesce((
        select jsonb_agg(jsonb_build_object('id',r.id,'name',r.first_name||' '||r.last_name,'reference',r.reference,'submitted_at',r.submitted_at) order by r.submitted_at desc)
        from public.outreach_event_registrations r
        where r.campaign_id=p_campaign
          and not exists(select 1 from public.outreach_partner_assignments a where a.campaign_id=p_campaign and a.event_registration_id=r.id and a.status<>'revoked')
      ),'[]'::jsonb)
    );
  end if;

  if p_action='partner_save' then
    pid:=nullif(p_payload->>'id','')::uuid;
    if pid is null then
      insert into public.outreach_partner_churches(campaign_id,name,slug,external_organization_id,created_by)
      values(p_campaign,btrim(p_payload->>'name'),lower(btrim(p_payload->>'slug')),nullif(p_payload->>'external_organization_id','')::uuid,auth.uid())
      returning id into pid;
    else
      update public.outreach_partner_churches set name=btrim(p_payload->>'name'),active=coalesce((p_payload->>'active')::boolean,true),revision=revision+1
       where id=pid and campaign_id=p_campaign;
      if not found then raise exception 'Partner church unavailable' using errcode='42501'; end if;
    end if;
    return jsonb_build_object('saved',true,'id',pid);
  end if;

  if p_action='user_grant' then
    pid:=(p_payload->>'partner_church_id')::uuid;
    if nullif(p_payload->>'user_id','') is not null then
      uid:=(p_payload->>'user_id')::uuid;
    else
      select id into uid from auth.users where lower(email)=lower(btrim(p_payload->>'email'));
    end if;
    if uid is null then raise exception 'Verified Auth account required'; end if;
    if not exists(select 1 from public.outreach_partner_churches where id=pid and campaign_id=p_campaign) then raise exception 'Partner church unavailable' using errcode='42501'; end if;
    insert into public.outreach_partner_users(partner_church_id,campaign_id,user_id,capabilities,active,granted_by,reason)
    values(pid,p_campaign,uid,array(select jsonb_array_elements_text(p_payload->'capabilities')),true,auth.uid(),p_payload->>'reason')
    on conflict(partner_church_id,user_id) do update set capabilities=excluded.capabilities,active=true,expires_at=null,granted_by=excluded.granted_by,reason=excluded.reason,revision=public.outreach_partner_users.revision+1;
    return jsonb_build_object('saved',true);
  end if;

  if p_action='assign' then
    pid:=(p_payload->>'partner_church_id')::uuid;
    if not exists(select 1 from public.outreach_partner_churches where id=pid and campaign_id=p_campaign and active) then raise exception 'Partner church unavailable' using errcode='42501'; end if;
    if p_payload->>'subject_type'='decision' then
      target:=(p_payload->>'subject_id')::uuid;
      select s.source into decision_source from public.outreach_decision_campaign_sources s where s.campaign_id=p_campaign and s.active;
      if not exists(select 1 from public.outreach_registrations where id=target and outreach_registrations.source=decision_source) then raise exception 'Decision outside campaign' using errcode='42501'; end if;
      insert into public.outreach_partner_assignments(campaign_id,partner_church_id,decision_registration_id,assigned_by,assignment_reason)
      values(p_campaign,pid,target,auth.uid(),p_payload->>'reason') returning id into assignment;
    elsif p_payload->>'subject_type'='household' then
      target:=(p_payload->>'subject_id')::uuid;
      if not exists(select 1 from public.outreach_event_registrations where id=target and campaign_id=p_campaign) then raise exception 'Household outside campaign' using errcode='42501'; end if;
      insert into public.outreach_partner_assignments(campaign_id,partner_church_id,event_registration_id,assigned_by,assignment_reason)
      values(p_campaign,pid,target,auth.uid(),p_payload->>'reason') returning id into assignment;
    else raise exception 'Invalid subject type'; end if;
    perform private.outreach_audit(p_campaign,(select organization_id from public.outreach_campaigns where id=p_campaign),'partner.assignment_created',assignment,jsonb_build_object('partner_church_id',pid,'subject_type',p_payload->>'subject_type'));
    return jsonb_build_object('saved',true,'id',assignment);
  end if;

  if p_action='revoke_assignment' then
    assignment:=(p_payload->>'assignment_id')::uuid;
    update public.outreach_partner_assignments set status='revoked',revoked_at=now(),revoked_by=auth.uid(),revision=revision+1
     where id=assignment and campaign_id=p_campaign and status<>'revoked';
    if not found then raise exception 'Assignment unavailable'; end if;
    perform private.outreach_audit(p_campaign,(select organization_id from public.outreach_campaigns where id=p_campaign),'partner.assignment_revoked',assignment,'{}'::jsonb);
    return jsonb_build_object('saved',true);
  end if;

  raise exception 'Unsupported partner admin action';
end $$;

create function public.outreach_partner_admin_workspace(p_action text,p_campaign uuid,p_payload jsonb default '{}')
returns jsonb language sql security invoker set search_path=''
as $$ select private.outreach_partner_admin_workspace(p_action,p_campaign,p_payload) $$;

do $$declare n text;begin
  foreach n in array array['outreach_partner_churches','outreach_partner_users','outreach_partner_assignments','outreach_partner_followup','outreach_partner_pastoral_notes'] loop
    execute format('alter table public.%I enable row level security',n);
    execute format('revoke all on public.%I from public,anon,authenticated',n);
    execute format('grant all on public.%I to service_role',n);
  end loop;
end $$;

revoke all on function private.outreach_partner_central_manage(uuid),private.outreach_partner_cap(uuid,text),
 private.outreach_partner_assignment_allowed(uuid,text),private.outreach_partner_subject_json(public.outreach_partner_assignments),
 private.outreach_partner_workspace(text,uuid,jsonb),public.outreach_partner_workspace(text,uuid,jsonb),
 private.outreach_partner_admin_workspace(text,uuid,jsonb),public.outreach_partner_admin_workspace(text,uuid,jsonb)
from public,anon,authenticated;

grant execute on function private.outreach_partner_workspace(text,uuid,jsonb),public.outreach_partner_workspace(text,uuid,jsonb),
 private.outreach_partner_admin_workspace(text,uuid,jsonb),public.outreach_partner_admin_workspace(text,uuid,jsonb)
to authenticated;


-- Extracted from PR #29: 20261018133100_outreach_partner_workspace_fix.sql
create or replace function private.outreach_partner_workspace(p_action text,p_partner uuid,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  partner_row public.outreach_partner_churches;
  a public.outreach_partner_assignments;
  worker uuid;
  assignment_id uuid;
  source text;
  row_id uuid;
  caps text[];
  fstatus text;
begin
  if not private.outreach_verified(auth.uid()) then raise exception 'Verified sign-in required' using errcode='42501'; end if;

  if p_action='partners' then
    return coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',pc.id,'campaign_id',pc.campaign_id,'name',pc.name,'slug',pc.slug,
        'campaign_name',c.name,'campaign_status',c.status,
        'capabilities',to_jsonb(array(select k from unnest(array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes']) k where private.outreach_partner_cap(partner_row.id,k))),
        'central_manage',private.outreach_partner_central_manage(partner_row.campaign_id)
      ) order by c.name,pc.name)
      from public.outreach_partner_churches pc
      join public.outreach_campaigns c on c.id=pc.campaign_id
      where pc.active and (private.outreach_partner_central_manage(pc.campaign_id) or private.outreach_partner_cap(pc.id,'partner.view'))
    ),'[]'::jsonb);
  end if;

  select * into partner_row from public.outreach_partner_churches where id=p_partner and active;
  if partner_row.id is null or not(private.outreach_partner_central_manage(partner_row.campaign_id) or private.outreach_partner_cap(partner_row.id,'partner.view')) then
    raise exception 'Partner workspace access denied' using errcode='42501';
  end if;
  caps:=array(select k from unnest(array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes']) k where private.outreach_partner_cap(partner_row.id,k));

  if p_action='context' then
    return jsonb_build_object(
      'partner',jsonb_build_object('id',partner_row.id,'name',partner_row.name,'campaign_id',partner_row.campaign_id,'slug',partner_row.slug),
      'campaign',(select jsonb_build_object('id',c.id,'name',c.name,'status',c.status,'city',c.city,'state_province',c.state_province) from public.outreach_campaigns c where c.id=partner_row.campaign_id),
      'capabilities',to_jsonb(caps),'central_manage',private.outreach_partner_central_manage(partner_row.campaign_id)
    );
  end if;

  if p_action='list' then
    return jsonb_build_object(
      'summary',jsonb_build_object(
        'assigned',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'),
        'open',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status='active'),
        'completed',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status='completed'),
        'needs_followup',(select count(distinct x.id) from public.outreach_partner_assignments x left join lateral (
          select status from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1
        ) lf on true where x.partner_church_id=partner_row.id and x.status<>'revoked' and coalesce(lf.status,'new') in ('new','attempted','needs_followup'))
      ),
      'assignments',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',x.id,'subject',private.outreach_partner_subject_json(x),'status',x.status,
          'assigned_worker_user_id',x.assigned_worker_user_id,'assigned_at',x.assigned_at,
          'latest_followup',(select jsonb_build_object('status',y.status,'next_contact_at',y.next_contact_at,'created_at',y.created_at)
             from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1)
        ) order by x.assigned_at desc)
        from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'
      ),'[]'::jsonb)
    );
  end if;

  if p_action='detail' then
    assignment_id:=(p_payload->>'assignment_id')::uuid;
    select * into a from public.outreach_partner_assignments where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked';
    if a.id is null then raise exception 'Assignment unavailable' using errcode='42501'; end if;
    return jsonb_build_object(
      'assignment',jsonb_build_object('id',a.id,'status',a.status,'assigned_worker_user_id',a.assigned_worker_user_id,'revision',a.revision),
      'subject',private.outreach_partner_subject_json(a),
      'followup',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'status',x.status,'next_contact_at',x.next_contact_at,'shared_note',x.shared_note,'created_at',x.created_at,'created_by',x.created_by) order by x.created_at desc) from public.outreach_partner_followup x where x.assignment_id=a.id),'[]'::jsonb),
      'pastoral_notes',case
        when private.outreach_partner_cap(partner_row.id,'partner.pastoral_notes') or private.has_staff_permission((select organization_id from public.outreach_campaigns where id=partner_row.campaign_id),'care.read')
        then coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'note',n.note,'created_at',n.created_at,'created_by',n.created_by) order by n.created_at desc) from public.outreach_partner_pastoral_notes n where n.assignment_id=a.id),'[]'::jsonb)
        else '[]'::jsonb end
    );
  end if;

  if p_action='followup_add' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.followup') or private.outreach_partner_central_manage(partner_row.campaign_id)) then raise exception 'Follow-up access denied' using errcode='42501'; end if;
    assignment_id:=(p_payload->>'assignment_id')::uuid;
    select * into a from public.outreach_partner_assignments where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked' for update;
    if a.id is null then raise exception 'Assignment unavailable' using errcode='42501'; end if;
    fstatus:=p_payload->>'status';
    if fstatus not in ('new','attempted','contacted','connected','discipleship_started','needs_followup','declined','complete') then raise exception 'Invalid follow-up status'; end if;
    insert into public.outreach_partner_followup(assignment_id,campaign_id,partner_church_id,status,next_contact_at,shared_note,created_by)
    values(a.id,a.campaign_id,a.partner_church_id,fstatus,(p_payload->>'next_contact_at')::timestamptz,left(coalesce(p_payload->>'shared_note',''),4000),auth.uid());
    if fstatus in ('complete','declined') then update public.outreach_partner_assignments set status='completed',revision=revision+1 where id=a.id; end if;
    perform private.outreach_audit(a.campaign_id,(select organization_id from public.outreach_campaigns where id=a.campaign_id),'partner.followup_recorded',a.id,jsonb_build_object('partner_church_id',partner_row.id,'status',fstatus));
    return jsonb_build_object('saved',true);
  end if;

  if p_action='pastoral_note_add' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.pastoral_notes') or private.has_staff_permission((select organization_id from public.outreach_campaigns where id=partner_row.campaign_id),'care.read')) then raise exception 'Pastoral note access denied' using errcode='42501'; end if;
    assignment_id:=(p_payload->>'assignment_id')::uuid;
    select * into a from public.outreach_partner_assignments where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked';
    if a.id is null then raise exception 'Assignment unavailable' using errcode='42501'; end if;
    insert into public.outreach_partner_pastoral_notes(assignment_id,campaign_id,partner_church_id,note,created_by)
    values(a.id,a.campaign_id,a.partner_church_id,left(btrim(p_payload->>'note'),8000),auth.uid());
    perform private.outreach_audit(a.campaign_id,(select organization_id from public.outreach_campaigns where id=a.campaign_id),'partner.pastoral_note_recorded',a.id,jsonb_build_object('partner_church_id',partner_row.id));
    return jsonb_build_object('saved',true);
  end if;

  if p_action='assign_worker' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.assign_local') or private.outreach_partner_central_manage(partner_row.campaign_id)) then raise exception 'Local assignment access denied' using errcode='42501'; end if;
    assignment_id:=(p_payload->>'assignment_id')::uuid;
    worker:=nullif(p_payload->>'user_id','')::uuid;
    if worker is not null and not exists(select 1 from public.outreach_partner_users u where u.partner_church_id=partner_row.id and u.user_id=worker and u.active and u.effective_at<=now() and (u.expires_at is null or u.expires_at>now())) then raise exception 'Worker outside partner church' using errcode='42501'; end if;
    update public.outreach_partner_assignments set assigned_worker_user_id=worker,revision=revision+1 where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked';
    if not found then raise exception 'Assignment unavailable' using errcode='42501'; end if;
    return jsonb_build_object('saved',true);
  end if;

  if p_action='export' then
    if not private.outreach_partner_cap(partner_row.id,'partner.export') and not private.outreach_partner_central_manage(partner_row.campaign_id) then raise exception 'Export access denied' using errcode='42501'; end if;
    return jsonb_build_object(
      'filename',partner_row.slug||'-followup.csv',
      'rows',coalesce((
        select jsonb_agg(jsonb_build_object(
          'name',private.outreach_partner_subject_json(x)->>'name',
          'email',private.outreach_partner_subject_json(x)->>'email',
          'phone',private.outreach_partner_subject_json(x)->>'phone',
          'decision',private.outreach_partner_subject_json(x)->>'decision',
          'status',coalesce((select y.status from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1),'new'),
          'next_contact_at',(select y.next_contact_at from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1)
        ) order by x.assigned_at)
        from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'
      ),'[]'::jsonb)
    );
  end if;

  raise exception 'Unsupported partner action';
end $$;




-- Extracted from PR #29: 20261018133200_outreach_partner_workspace_alias_fix.sql
create or replace function private.outreach_partner_workspace(p_action text,p_partner uuid,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  partner_row public.outreach_partner_churches;
  a public.outreach_partner_assignments;
  worker uuid;
  assignment_id uuid;
  source text;
  row_id uuid;
  caps text[];
  fstatus text;
begin
  if not private.outreach_verified(auth.uid()) then raise exception 'Verified sign-in required' using errcode='42501'; end if;

  if p_action='partners' then
    return coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',pc.id,'campaign_id',pc.campaign_id,'name',pc.name,'slug',pc.slug,
        'campaign_name',c.name,'campaign_status',c.status,
        'capabilities',to_jsonb(array(select k from unnest(array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes']) k where private.outreach_partner_cap(partner_row.id,k))),
        'central_manage',private.outreach_partner_central_manage(partner_row.campaign_id)
      ) order by c.name,pc.name)
      from public.outreach_partner_churches pc
      join public.outreach_campaigns c on c.id=pc.campaign_id
      where pc.active and (private.outreach_partner_central_manage(pc.campaign_id) or private.outreach_partner_cap(pc.id,'partner.view'))
    ),'[]'::jsonb);
  end if;

  select * into partner_row from public.outreach_partner_churches where id=p_partner and active;
  if partner_row.id is null or not(private.outreach_partner_central_manage(partner_row.campaign_id) or private.outreach_partner_cap(partner_row.id,'partner.view')) then
    raise exception 'Partner workspace access denied' using errcode='42501';
  end if;
  caps:=array(select k from unnest(array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes']) k where private.outreach_partner_cap(partner_row.id,k));

  if p_action='context' then
    return jsonb_build_object(
      'partner',jsonb_build_object('id',partner_row.id,'name',partner_row.name,'campaign_id',partner_row.campaign_id,'slug',partner_row.slug),
      'campaign',(select jsonb_build_object('id',c.id,'name',c.name,'status',c.status,'city',c.city,'state_province',c.state_province) from public.outreach_campaigns c where c.id=partner_row.campaign_id),
      'capabilities',to_jsonb(caps),'central_manage',private.outreach_partner_central_manage(partner_row.campaign_id)
    );
  end if;

  if p_action='list' then
    return jsonb_build_object(
      'summary',jsonb_build_object(
        'assigned',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'),
        'open',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status='active'),
        'completed',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status='completed'),
        'needs_followup',(select count(distinct x.id) from public.outreach_partner_assignments x left join lateral (
          select status from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1
        ) lf on true where x.partner_church_id=partner_row.id and x.status<>'revoked' and coalesce(lf.status,'new') in ('new','attempted','needs_followup'))
      ),
      'assignments',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',x.id,'subject',private.outreach_partner_subject_json(x),'status',x.status,
          'assigned_worker_user_id',x.assigned_worker_user_id,'assigned_at',x.assigned_at,
          'latest_followup',(select jsonb_build_object('status',y.status,'next_contact_at',y.next_contact_at,'created_at',y.created_at)
             from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1)
        ) order by x.assigned_at desc)
        from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'
      ),'[]'::jsonb)
    );
  end if;

  if p_action='detail' then
    assignment_id:=(p_payload->>'assignment_id')::uuid;
    select * into a from public.outreach_partner_assignments where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked';
    if a.id is null then raise exception 'Assignment unavailable' using errcode='42501'; end if;
    return jsonb_build_object(
      'assignment',jsonb_build_object('id',a.id,'status',a.status,'assigned_worker_user_id',a.assigned_worker_user_id,'revision',a.revision),
      'subject',private.outreach_partner_subject_json(a),
      'followup',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'status',x.status,'next_contact_at',x.next_contact_at,'shared_note',x.shared_note,'created_at',x.created_at,'created_by',x.created_by) order by x.created_at desc) from public.outreach_partner_followup x where x.assignment_id=a.id),'[]'::jsonb),
      'pastoral_notes',case
        when private.outreach_partner_cap(partner_row.id,'partner.pastoral_notes') or private.has_staff_permission((select organization_id from public.outreach_campaigns where id=partner_row.campaign_id),'care.read')
        then coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'note',n.note,'created_at',n.created_at,'created_by',n.created_by) order by n.created_at desc) from public.outreach_partner_pastoral_notes n where n.assignment_id=a.id),'[]'::jsonb)
        else '[]'::jsonb end
    );
  end if;

  if p_action='followup_add' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.followup') or private.outreach_partner_central_manage(partner_row.campaign_id)) then raise exception 'Follow-up access denied' using errcode='42501'; end if;
    assignment_id:=(p_payload->>'assignment_id')::uuid;
    select * into a from public.outreach_partner_assignments where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked' for update;
    if a.id is null then raise exception 'Assignment unavailable' using errcode='42501'; end if;
    fstatus:=p_payload->>'status';
    if fstatus not in ('new','attempted','contacted','connected','discipleship_started','needs_followup','declined','complete') then raise exception 'Invalid follow-up status'; end if;
    insert into public.outreach_partner_followup(assignment_id,campaign_id,partner_church_id,status,next_contact_at,shared_note,created_by)
    values(a.id,a.campaign_id,a.partner_church_id,fstatus,(p_payload->>'next_contact_at')::timestamptz,left(coalesce(p_payload->>'shared_note',''),4000),auth.uid());
    if fstatus in ('complete','declined') then update public.outreach_partner_assignments set status='completed',revision=revision+1 where id=a.id; end if;
    perform private.outreach_audit(a.campaign_id,(select organization_id from public.outreach_campaigns where id=a.campaign_id),'partner.followup_recorded',a.id,jsonb_build_object('partner_church_id',partner_row.id,'status',fstatus));
    return jsonb_build_object('saved',true);
  end if;

  if p_action='pastoral_note_add' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.pastoral_notes') or private.has_staff_permission((select organization_id from public.outreach_campaigns where id=partner_row.campaign_id),'care.read')) then raise exception 'Pastoral note access denied' using errcode='42501'; end if;
    assignment_id:=(p_payload->>'assignment_id')::uuid;
    select * into a from public.outreach_partner_assignments where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked';
    if a.id is null then raise exception 'Assignment unavailable' using errcode='42501'; end if;
    insert into public.outreach_partner_pastoral_notes(assignment_id,campaign_id,partner_church_id,note,created_by)
    values(a.id,a.campaign_id,a.partner_church_id,left(btrim(p_payload->>'note'),8000),auth.uid());
    perform private.outreach_audit(a.campaign_id,(select organization_id from public.outreach_campaigns where id=a.campaign_id),'partner.pastoral_note_recorded',a.id,jsonb_build_object('partner_church_id',partner_row.id));
    return jsonb_build_object('saved',true);
  end if;

  if p_action='assign_worker' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.assign_local') or private.outreach_partner_central_manage(partner_row.campaign_id)) then raise exception 'Local assignment access denied' using errcode='42501'; end if;
    assignment_id:=(p_payload->>'assignment_id')::uuid;
    worker:=nullif(p_payload->>'user_id','')::uuid;
    if worker is not null and not exists(select 1 from public.outreach_partner_users u where u.partner_church_id=partner_row.id and u.user_id=worker and u.active and u.effective_at<=now() and (u.expires_at is null or u.expires_at>now())) then raise exception 'Worker outside partner church' using errcode='42501'; end if;
    update public.outreach_partner_assignments set assigned_worker_user_id=worker,revision=revision+1 where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked';
    if not found then raise exception 'Assignment unavailable' using errcode='42501'; end if;
    return jsonb_build_object('saved',true);
  end if;

  if p_action='export' then
    if not private.outreach_partner_cap(partner_row.id,'partner.export') and not private.outreach_partner_central_manage(partner_row.campaign_id) then raise exception 'Export access denied' using errcode='42501'; end if;
    return jsonb_build_object(
      'filename',partner_row.slug||'-followup.csv',
      'rows',coalesce((
        select jsonb_agg(jsonb_build_object(
          'name',private.outreach_partner_subject_json(x)->>'name',
          'email',private.outreach_partner_subject_json(x)->>'email',
          'phone',private.outreach_partner_subject_json(x)->>'phone',
          'decision',private.outreach_partner_subject_json(x)->>'decision',
          'status',coalesce((select y.status from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1),'new'),
          'next_contact_at',(select y.next_contact_at from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1)
        ) order by x.assigned_at)
        from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'
      ),'[]'::jsonb)
    );
  end if;

  raise exception 'Unsupported partner action';
end $$;




-- Extracted from PR #29: 20261018133300_outreach_partner_operations_fix.sql
create or replace function private.outreach_partner_workspace(p_action text,p_partner uuid,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  partner_row public.outreach_partner_churches;
  a public.outreach_partner_assignments;
  worker uuid;
  assignment_id uuid;
  caps text[];
  fstatus text;
begin
  if not private.outreach_verified(auth.uid()) then raise exception 'Verified sign-in required' using errcode='42501'; end if;

  if p_action='partners' then
    return coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',pc.id,'campaign_id',pc.campaign_id,'name',pc.name,'slug',pc.slug,
        'campaign_name',c.name,'campaign_status',c.status,
        'capabilities',to_jsonb(array(select k from unnest(array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes']) k where private.outreach_partner_cap(pc.id,k))),
        'central_manage',private.outreach_partner_central_manage(pc.campaign_id)
      ) order by c.name,pc.name)
      from public.outreach_partner_churches pc
      join public.outreach_campaigns c on c.id=pc.campaign_id
      where pc.active and (private.outreach_partner_central_manage(pc.campaign_id) or private.outreach_partner_cap(pc.id,'partner.view'))
    ),'[]'::jsonb);
  end if;

  select * into partner_row from public.outreach_partner_churches where id=p_partner and active;
  if partner_row.id is null or not(private.outreach_partner_central_manage(partner_row.campaign_id) or private.outreach_partner_cap(partner_row.id,'partner.view')) then
    raise exception 'Partner workspace access denied' using errcode='42501';
  end if;
  caps:=array(select k from unnest(array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes']) k where private.outreach_partner_cap(partner_row.id,k));

  if p_action='context' then
    return jsonb_build_object(
      'partner',jsonb_build_object('id',partner_row.id,'name',partner_row.name,'campaign_id',partner_row.campaign_id,'slug',partner_row.slug),
      'campaign',(select jsonb_build_object('id',c.id,'name',c.name,'status',c.status,'city',c.city,'state_province',c.state_province) from public.outreach_campaigns c where c.id=partner_row.campaign_id),
      'capabilities',to_jsonb(caps),
      'central_manage',private.outreach_partner_central_manage(partner_row.campaign_id),
      'workers',case when private.outreach_partner_cap(partner_row.id,'partner.assign_local') or private.outreach_partner_central_manage(partner_row.campaign_id)
        then coalesce((select jsonb_agg(jsonb_build_object('user_id',u.user_id,'email',(select email from auth.users where id=u.user_id)) order by lower((select email from auth.users where id=u.user_id)))
          from public.outreach_partner_users u where u.partner_church_id=partner_row.id and u.active and u.effective_at<=now() and (u.expires_at is null or u.expires_at>now())),'[]'::jsonb)
        else '[]'::jsonb end
    );
  end if;

  if p_action='list' then
    return jsonb_build_object(
      'summary',jsonb_build_object(
        'assigned',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'),
        'open',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status='active'),
        'completed',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status='completed'),
        'needs_followup',(select count(distinct x.id) from public.outreach_partner_assignments x left join lateral (
          select status from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1
        ) lf on true where x.partner_church_id=partner_row.id and x.status<>'revoked' and coalesce(lf.status,'new') in ('new','attempted','needs_followup'))
      ),
      'assignments',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',x.id,'subject',private.outreach_partner_subject_json(x),'status',x.status,
          'assigned_worker_user_id',x.assigned_worker_user_id,'assigned_at',x.assigned_at,
          'latest_followup',(select jsonb_build_object('status',y.status,'next_contact_at',y.next_contact_at,'created_at',y.created_at)
             from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1)
        ) order by x.assigned_at desc)
        from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'
      ),'[]'::jsonb)
    );
  end if;

  assignment_id:=nullif(p_payload->>'assignment_id','')::uuid;
  if p_action in ('detail','followup_add','pastoral_note_add','assign_worker') then
    select * into a from public.outreach_partner_assignments where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked';
    if a.id is null then raise exception 'Assignment unavailable' using errcode='42501'; end if;
  end if;

  if p_action='detail' then
    return jsonb_build_object(
      'assignment',jsonb_build_object('id',a.id,'status',a.status,'assigned_worker_user_id',a.assigned_worker_user_id,'revision',a.revision),
      'subject',private.outreach_partner_subject_json(a),
      'followup',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'status',x.status,'next_contact_at',x.next_contact_at,'shared_note',x.shared_note,'created_at',x.created_at,'created_by',x.created_by) order by x.created_at desc) from public.outreach_partner_followup x where x.assignment_id=a.id),'[]'::jsonb),
      'pastoral_notes',case
        when private.outreach_partner_cap(partner_row.id,'partner.pastoral_notes') or private.has_staff_permission((select organization_id from public.outreach_campaigns where id=partner_row.campaign_id),'care.read')
        then coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'note',n.note,'created_at',n.created_at,'created_by',n.created_by) order by n.created_at desc) from public.outreach_partner_pastoral_notes n where n.assignment_id=a.id),'[]'::jsonb)
        else '[]'::jsonb end
    );
  elsif p_action='followup_add' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.followup') or private.outreach_partner_central_manage(partner_row.campaign_id)) then raise exception 'Follow-up access denied' using errcode='42501'; end if;
    fstatus:=p_payload->>'status';
    if fstatus not in ('new','attempted','contacted','connected','discipleship_started','needs_followup','declined','complete') then raise exception 'Invalid follow-up status'; end if;
    insert into public.outreach_partner_followup(assignment_id,campaign_id,partner_church_id,status,next_contact_at,shared_note,created_by)
    values(a.id,a.campaign_id,a.partner_church_id,fstatus,nullif(p_payload->>'next_contact_at','')::timestamptz,left(coalesce(p_payload->>'shared_note',''),4000),auth.uid());
    if fstatus in ('complete','declined') then update public.outreach_partner_assignments set status='completed',revision=revision+1 where id=a.id; end if;
    perform private.outreach_audit(a.campaign_id,(select organization_id from public.outreach_campaigns where id=a.campaign_id),'partner.followup_recorded',a.id,jsonb_build_object('partner_church_id',partner_row.id,'status',fstatus));
    return jsonb_build_object('saved',true);
  elsif p_action='pastoral_note_add' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.pastoral_notes') or private.has_staff_permission((select organization_id from public.outreach_campaigns where id=partner_row.campaign_id),'care.read')) then raise exception 'Pastoral note access denied' using errcode='42501'; end if;
    insert into public.outreach_partner_pastoral_notes(assignment_id,campaign_id,partner_church_id,note,created_by)
    values(a.id,a.campaign_id,a.partner_church_id,left(btrim(p_payload->>'note'),8000),auth.uid());
    perform private.outreach_audit(a.campaign_id,(select organization_id from public.outreach_campaigns where id=a.campaign_id),'partner.pastoral_note_recorded',a.id,jsonb_build_object('partner_church_id',partner_row.id));
    return jsonb_build_object('saved',true);
  elsif p_action='assign_worker' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.assign_local') or private.outreach_partner_central_manage(partner_row.campaign_id)) then raise exception 'Local assignment access denied' using errcode='42501'; end if;
    worker:=nullif(p_payload->>'user_id','')::uuid;
    if worker is not null and not exists(select 1 from public.outreach_partner_users u where u.partner_church_id=partner_row.id and u.user_id=worker and u.active and u.effective_at<=now() and (u.expires_at is null or u.expires_at>now())) then raise exception 'Worker outside partner church' using errcode='42501'; end if;
    update public.outreach_partner_assignments set assigned_worker_user_id=worker,revision=revision+1 where id=a.id;
    perform private.outreach_audit(a.campaign_id,(select organization_id from public.outreach_campaigns where id=a.campaign_id),'partner.worker_assigned',a.id,jsonb_build_object('partner_church_id',partner_row.id,'worker_user_id',worker));
    return jsonb_build_object('saved',true);
  elsif p_action='export' then
    if not private.outreach_partner_cap(partner_row.id,'partner.export') and not private.outreach_partner_central_manage(partner_row.campaign_id) then raise exception 'Export access denied' using errcode='42501'; end if;
    return jsonb_build_object('filename',partner_row.slug||'-followup.csv','rows',coalesce((
      select jsonb_agg(jsonb_build_object(
        'name',private.outreach_partner_subject_json(x)->>'name','email',private.outreach_partner_subject_json(x)->>'email',
        'phone',private.outreach_partner_subject_json(x)->>'phone','decision',private.outreach_partner_subject_json(x)->>'decision',
        'status',coalesce((select y.status from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1),'new'),
        'next_contact_at',(select y.next_contact_at from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1)
      ) order by x.assigned_at) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'
    ),'[]'::jsonb));
  end if;
  raise exception 'Unsupported partner action';
end $$;

create or replace function private.outreach_partner_admin_workspace(p_action text,p_campaign uuid,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  pid uuid; uid uuid; assignment uuid; decision_source text; target uuid;
begin
  if not private.outreach_partner_central_manage(p_campaign) then raise exception 'Partner administration denied' using errcode='42501'; end if;

  if p_action='list' then
    return jsonb_build_object(
      'partners',coalesce((
        select jsonb_agg(to_jsonb(x)||jsonb_build_object(
          'users',coalesce((select jsonb_agg(jsonb_build_object('user_id',u.user_id,'email',(select email from auth.users where id=u.user_id),'capabilities',u.capabilities,'active',u.active,'revision',u.revision) order by lower((select email from auth.users where id=u.user_id))) from public.outreach_partner_users u where u.partner_church_id=x.id),'[]'::jsonb),
          'assigned',(select count(*) from public.outreach_partner_assignments a where a.partner_church_id=x.id and a.status<>'revoked'),
          'open',(select count(*) from public.outreach_partner_assignments a where a.partner_church_id=x.id and a.status='active'),
          'completed',(select count(*) from public.outreach_partner_assignments a where a.partner_church_id=x.id and a.status='completed'),
          'needs_followup',(select count(distinct a.id) from public.outreach_partner_assignments a left join lateral (select status from public.outreach_partner_followup f where f.assignment_id=a.id order by f.created_at desc limit 1) lf on true where a.partner_church_id=x.id and a.status<>'revoked' and coalesce(lf.status,'new') in ('new','attempted','needs_followup'))
        ) order by x.name) from public.outreach_partner_churches x where x.campaign_id=p_campaign
      ),'[]'::jsonb),
      'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'partner_church_id',a.partner_church_id,'subject',private.outreach_partner_subject_json(a),'status',a.status,'assigned_at',a.assigned_at) order by a.assigned_at desc) from public.outreach_partner_assignments a where a.campaign_id=p_campaign and a.status<>'revoked'),'[]'::jsonb),
      'unassigned_decisions',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.first_name||' '||r.last_name,'decision',r.decision,'created_at',r.created_at) order by r.created_at desc) from public.outreach_decision_campaign_sources s join public.outreach_registrations r on r.source=s.source where s.campaign_id=p_campaign and s.active and not exists(select 1 from public.outreach_partner_assignments a where a.campaign_id=p_campaign and a.decision_registration_id=r.id and a.status<>'revoked')),'[]'::jsonb),
      'unassigned_households',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.first_name||' '||r.last_name,'reference',r.reference,'submitted_at',r.submitted_at) order by r.submitted_at desc) from public.outreach_event_registrations r where r.campaign_id=p_campaign and not exists(select 1 from public.outreach_partner_assignments a where a.campaign_id=p_campaign and a.event_registration_id=r.id and a.status<>'revoked')),'[]'::jsonb)
    );
  elsif p_action='partner_save' then
    pid:=nullif(p_payload->>'id','')::uuid;
    if pid is null then insert into public.outreach_partner_churches(campaign_id,name,slug,external_organization_id,created_by) values(p_campaign,btrim(p_payload->>'name'),lower(btrim(p_payload->>'slug')),nullif(p_payload->>'external_organization_id','')::uuid,auth.uid()) returning id into pid;
    else update public.outreach_partner_churches set name=btrim(p_payload->>'name'),active=coalesce((p_payload->>'active')::boolean,true),revision=revision+1 where id=pid and campaign_id=p_campaign; if not found then raise exception 'Partner church unavailable' using errcode='42501'; end if; end if;
    return jsonb_build_object('saved',true,'id',pid);
  elsif p_action='user_grant' then
    pid:=(p_payload->>'partner_church_id')::uuid;
    if nullif(p_payload->>'user_id','') is not null then uid:=(p_payload->>'user_id')::uuid; else select id into uid from auth.users where lower(email)=lower(btrim(p_payload->>'email')); end if;
    if uid is null then raise exception 'Verified Auth account required'; end if;
    if not exists(select 1 from public.outreach_partner_churches where id=pid and campaign_id=p_campaign) then raise exception 'Partner church unavailable' using errcode='42501'; end if;
    insert into public.outreach_partner_users(partner_church_id,campaign_id,user_id,capabilities,active,granted_by,reason)
    values(pid,p_campaign,uid,array(select jsonb_array_elements_text(p_payload->'capabilities')),true,auth.uid(),p_payload->>'reason')
    on conflict(partner_church_id,user_id) do update set capabilities=excluded.capabilities,active=true,effective_at=now(),expires_at=null,granted_by=excluded.granted_by,reason=excluded.reason,revision=public.outreach_partner_users.revision+1;
    perform private.outreach_audit(p_campaign,(select organization_id from public.outreach_campaigns where id=p_campaign),'partner.user_granted',uid,jsonb_build_object('partner_church_id',pid,'capabilities',p_payload->'capabilities'));
    return jsonb_build_object('saved',true);
  elsif p_action='user_revoke' then
    pid:=(p_payload->>'partner_church_id')::uuid; uid:=(p_payload->>'user_id')::uuid;
    update public.outreach_partner_users set active=false,expires_at=now(),granted_by=auth.uid(),reason=p_payload->>'reason',revision=revision+1 where partner_church_id=pid and campaign_id=p_campaign and user_id=uid and active;
    if not found then raise exception 'Partner user unavailable'; end if;
    update public.outreach_partner_assignments set assigned_worker_user_id=null,revision=revision+1 where partner_church_id=pid and assigned_worker_user_id=uid and status<>'revoked';
    perform private.outreach_audit(p_campaign,(select organization_id from public.outreach_campaigns where id=p_campaign),'partner.user_revoked',uid,jsonb_build_object('partner_church_id',pid));
    return jsonb_build_object('saved',true);
  elsif p_action='assign' then
    pid:=(p_payload->>'partner_church_id')::uuid;
    if not exists(select 1 from public.outreach_partner_churches where id=pid and campaign_id=p_campaign and active) then raise exception 'Partner church unavailable' using errcode='42501'; end if;
    target:=(p_payload->>'subject_id')::uuid;
    if p_payload->>'subject_type'='decision' then
      select s.source into decision_source from public.outreach_decision_campaign_sources s where s.campaign_id=p_campaign and s.active;
      if not exists(select 1 from public.outreach_registrations r where r.id=target and r.source=decision_source) then raise exception 'Decision outside campaign' using errcode='42501'; end if;
      insert into public.outreach_partner_assignments(campaign_id,partner_church_id,decision_registration_id,assigned_by,assignment_reason) values(p_campaign,pid,target,auth.uid(),p_payload->>'reason') returning id into assignment;
    elsif p_payload->>'subject_type'='household' then
      if not exists(select 1 from public.outreach_event_registrations r where r.id=target and r.campaign_id=p_campaign) then raise exception 'Household outside campaign' using errcode='42501'; end if;
      insert into public.outreach_partner_assignments(campaign_id,partner_church_id,event_registration_id,assigned_by,assignment_reason) values(p_campaign,pid,target,auth.uid(),p_payload->>'reason') returning id into assignment;
    else raise exception 'Invalid subject type'; end if;
    perform private.outreach_audit(p_campaign,(select organization_id from public.outreach_campaigns where id=p_campaign),'partner.assignment_created',assignment,jsonb_build_object('partner_church_id',pid,'subject_type',p_payload->>'subject_type'));
    return jsonb_build_object('saved',true,'id',assignment);
  elsif p_action='revoke_assignment' then
    assignment:=(p_payload->>'assignment_id')::uuid;
    if length(btrim(coalesce(p_payload->>'reason','')))<10 then raise exception 'Assignment revocation reason required'; end if;
    update public.outreach_partner_assignments set status='revoked',revoked_at=now(),revoked_by=auth.uid(),revision=revision+1 where id=assignment and campaign_id=p_campaign and status<>'revoked';
    if not found then raise exception 'Assignment unavailable'; end if;
    perform private.outreach_audit(p_campaign,(select organization_id from public.outreach_campaigns where id=p_campaign),'partner.assignment_revoked',assignment,jsonb_build_object('reason',left(btrim(p_payload->>'reason'),500)));
    return jsonb_build_object('saved',true);
  end if;
  raise exception 'Unsupported partner admin action';
end $$;


-- Extracted from PR #29: 20261018133400_outreach_partner_audit_fix.sql
create or replace function private.outreach_partner_workspace(p_action text,p_partner uuid,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  partner_row public.outreach_partner_churches;
  a public.outreach_partner_assignments;
  worker uuid;
  assignment_id uuid;
  caps text[];
  fstatus text;
begin
  if not private.outreach_verified(auth.uid()) then raise exception 'Verified sign-in required' using errcode='42501'; end if;

  if p_action='partners' then
    return coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',pc.id,'campaign_id',pc.campaign_id,'name',pc.name,'slug',pc.slug,
        'campaign_name',c.name,'campaign_status',c.status,
        'capabilities',to_jsonb(array(select k from unnest(array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes']) k where private.outreach_partner_cap(pc.id,k))),
        'central_manage',private.outreach_partner_central_manage(pc.campaign_id)
      ) order by c.name,pc.name)
      from public.outreach_partner_churches pc
      join public.outreach_campaigns c on c.id=pc.campaign_id
      where pc.active and (private.outreach_partner_central_manage(pc.campaign_id) or private.outreach_partner_cap(pc.id,'partner.view'))
    ),'[]'::jsonb);
  end if;

  select * into partner_row from public.outreach_partner_churches where id=p_partner and active;
  if partner_row.id is null or not(private.outreach_partner_central_manage(partner_row.campaign_id) or private.outreach_partner_cap(partner_row.id,'partner.view')) then
    raise exception 'Partner workspace access denied' using errcode='42501';
  end if;
  caps:=array(select k from unnest(array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes']) k where private.outreach_partner_cap(partner_row.id,k));

  if p_action='context' then
    return jsonb_build_object(
      'partner',jsonb_build_object('id',partner_row.id,'name',partner_row.name,'campaign_id',partner_row.campaign_id,'slug',partner_row.slug),
      'campaign',(select jsonb_build_object('id',c.id,'name',c.name,'status',c.status,'city',c.city,'state_province',c.state_province) from public.outreach_campaigns c where c.id=partner_row.campaign_id),
      'capabilities',to_jsonb(caps),
      'central_manage',private.outreach_partner_central_manage(partner_row.campaign_id),
      'workers',case when private.outreach_partner_cap(partner_row.id,'partner.assign_local') or private.outreach_partner_central_manage(partner_row.campaign_id)
        then coalesce((select jsonb_agg(jsonb_build_object('user_id',u.user_id,'email',(select email from auth.users where id=u.user_id)) order by lower((select email from auth.users where id=u.user_id)))
          from public.outreach_partner_users u where u.partner_church_id=partner_row.id and u.active and u.effective_at<=now() and (u.expires_at is null or u.expires_at>now())),'[]'::jsonb)
        else '[]'::jsonb end
    );
  end if;

  if p_action='list' then
    return jsonb_build_object(
      'summary',jsonb_build_object(
        'assigned',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'),
        'open',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status='active'),
        'completed',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status='completed'),
        'needs_followup',(select count(distinct x.id) from public.outreach_partner_assignments x left join lateral (
          select status from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1
        ) lf on true where x.partner_church_id=partner_row.id and x.status<>'revoked' and coalesce(lf.status,'new') in ('new','attempted','needs_followup'))
      ),
      'assignments',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',x.id,'subject',private.outreach_partner_subject_json(x),'status',x.status,
          'assigned_worker_user_id',x.assigned_worker_user_id,'assigned_at',x.assigned_at,
          'latest_followup',(select jsonb_build_object('status',y.status,'next_contact_at',y.next_contact_at,'created_at',y.created_at)
             from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1)
        ) order by x.assigned_at desc)
        from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'
      ),'[]'::jsonb)
    );
  end if;

  assignment_id:=nullif(p_payload->>'assignment_id','')::uuid;
  if p_action in ('detail','followup_add','pastoral_note_add','assign_worker') then
    select * into a from public.outreach_partner_assignments where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked';
    if a.id is null then raise exception 'Assignment unavailable' using errcode='42501'; end if;
  end if;

  if p_action='detail' then
    return jsonb_build_object(
      'assignment',jsonb_build_object('id',a.id,'status',a.status,'assigned_worker_user_id',a.assigned_worker_user_id,'revision',a.revision),
      'subject',private.outreach_partner_subject_json(a),
      'followup',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'status',x.status,'next_contact_at',x.next_contact_at,'shared_note',x.shared_note,'created_at',x.created_at,'created_by',x.created_by) order by x.created_at desc) from public.outreach_partner_followup x where x.assignment_id=a.id),'[]'::jsonb),
      'pastoral_notes',case
        when private.outreach_partner_cap(partner_row.id,'partner.pastoral_notes') or private.has_staff_permission((select organization_id from public.outreach_campaigns where id=partner_row.campaign_id),'care.read')
        then coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'note',n.note,'created_at',n.created_at,'created_by',n.created_by) order by n.created_at desc) from public.outreach_partner_pastoral_notes n where n.assignment_id=a.id),'[]'::jsonb)
        else '[]'::jsonb end
    );
  elsif p_action='followup_add' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.followup') or private.outreach_partner_central_manage(partner_row.campaign_id)) then raise exception 'Follow-up access denied' using errcode='42501'; end if;
    fstatus:=p_payload->>'status';
    if fstatus not in ('new','attempted','contacted','connected','discipleship_started','needs_followup','declined','complete') then raise exception 'Invalid follow-up status'; end if;
    insert into public.outreach_partner_followup(assignment_id,campaign_id,partner_church_id,status,next_contact_at,shared_note,created_by)
    values(a.id,a.campaign_id,a.partner_church_id,fstatus,nullif(p_payload->>'next_contact_at','')::timestamptz,left(coalesce(p_payload->>'shared_note',''),4000),auth.uid());
    if fstatus in ('complete','declined') then update public.outreach_partner_assignments set status='completed',revision=revision+1 where id=a.id; end if;
    perform private.outreach_audit(a.campaign_id,(select organization_id from public.outreach_campaigns where id=a.campaign_id),'partner.followup_recorded',a.id,jsonb_build_object('partner_church_id',partner_row.id,'status',fstatus));
    return jsonb_build_object('saved',true);
  elsif p_action='pastoral_note_add' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.pastoral_notes') or private.has_staff_permission((select organization_id from public.outreach_campaigns where id=partner_row.campaign_id),'care.read')) then raise exception 'Pastoral note access denied' using errcode='42501'; end if;
    insert into public.outreach_partner_pastoral_notes(assignment_id,campaign_id,partner_church_id,note,created_by)
    values(a.id,a.campaign_id,a.partner_church_id,left(btrim(p_payload->>'note'),8000),auth.uid());
    perform private.outreach_audit(a.campaign_id,(select organization_id from public.outreach_campaigns where id=a.campaign_id),'partner.pastoral_note_recorded',a.id,jsonb_build_object('partner_church_id',partner_row.id));
    return jsonb_build_object('saved',true);
  elsif p_action='assign_worker' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.assign_local') or private.outreach_partner_central_manage(partner_row.campaign_id)) then raise exception 'Local assignment access denied' using errcode='42501'; end if;
    worker:=nullif(p_payload->>'user_id','')::uuid;
    if worker is not null and not exists(select 1 from public.outreach_partner_users u where u.partner_church_id=partner_row.id and u.user_id=worker and u.active and u.effective_at<=now() and (u.expires_at is null or u.expires_at>now())) then raise exception 'Worker outside partner church' using errcode='42501'; end if;
    update public.outreach_partner_assignments set assigned_worker_user_id=worker,revision=revision+1 where id=a.id;
    perform private.outreach_audit(a.campaign_id,(select organization_id from public.outreach_campaigns where id=a.campaign_id),'partner.worker_assigned',a.id,jsonb_build_object('partner_church_id',partner_row.id,'worker_user_id',worker));
    return jsonb_build_object('saved',true);
  elsif p_action='export' then
    if not private.outreach_partner_cap(partner_row.id,'partner.export') and not private.outreach_partner_central_manage(partner_row.campaign_id) then raise exception 'Export access denied' using errcode='42501'; end if;
    return jsonb_build_object('filename',partner_row.slug||'-followup.csv','rows',coalesce((
      select jsonb_agg(jsonb_build_object(
        'name',private.outreach_partner_subject_json(x)->>'name','email',private.outreach_partner_subject_json(x)->>'email',
        'phone',private.outreach_partner_subject_json(x)->>'phone','decision',private.outreach_partner_subject_json(x)->>'decision',
        'status',coalesce((select y.status from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1),'new'),
        'next_contact_at',(select y.next_contact_at from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1)
      ) order by x.assigned_at) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'
    ),'[]'::jsonb));
  end if;
  raise exception 'Unsupported partner action';
end $$;

create or replace function private.outreach_partner_admin_workspace(p_action text,p_campaign uuid,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  pid uuid; uid uuid; assignment uuid; decision_source text; target uuid;
begin
  if not private.outreach_partner_central_manage(p_campaign) then raise exception 'Partner administration denied' using errcode='42501'; end if;

  if p_action='list' then
    return jsonb_build_object(
      'partners',coalesce((
        select jsonb_agg(to_jsonb(x)||jsonb_build_object(
          'users',coalesce((select jsonb_agg(jsonb_build_object('user_id',u.user_id,'email',(select email from auth.users where id=u.user_id),'capabilities',u.capabilities,'active',u.active,'revision',u.revision) order by lower((select email from auth.users where id=u.user_id))) from public.outreach_partner_users u where u.partner_church_id=x.id),'[]'::jsonb),
          'assigned',(select count(*) from public.outreach_partner_assignments a where a.partner_church_id=x.id and a.status<>'revoked'),
          'open',(select count(*) from public.outreach_partner_assignments a where a.partner_church_id=x.id and a.status='active'),
          'completed',(select count(*) from public.outreach_partner_assignments a where a.partner_church_id=x.id and a.status='completed'),
          'needs_followup',(select count(distinct a.id) from public.outreach_partner_assignments a left join lateral (select status from public.outreach_partner_followup f where f.assignment_id=a.id order by f.created_at desc limit 1) lf on true where a.partner_church_id=x.id and a.status<>'revoked' and coalesce(lf.status,'new') in ('new','attempted','needs_followup'))
        ) order by x.name) from public.outreach_partner_churches x where x.campaign_id=p_campaign
      ),'[]'::jsonb),
      'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'partner_church_id',a.partner_church_id,'subject',private.outreach_partner_subject_json(a),'status',a.status,'assigned_at',a.assigned_at) order by a.assigned_at desc) from public.outreach_partner_assignments a where a.campaign_id=p_campaign and a.status<>'revoked'),'[]'::jsonb),
      'unassigned_decisions',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.first_name||' '||r.last_name,'decision',r.decision,'created_at',r.created_at) order by r.created_at desc) from public.outreach_decision_campaign_sources s join public.outreach_registrations r on r.source=s.source where s.campaign_id=p_campaign and s.active and not exists(select 1 from public.outreach_partner_assignments a where a.campaign_id=p_campaign and a.decision_registration_id=r.id and a.status<>'revoked')),'[]'::jsonb),
      'unassigned_households',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.first_name||' '||r.last_name,'reference',r.reference,'submitted_at',r.submitted_at) order by r.submitted_at desc) from public.outreach_event_registrations r where r.campaign_id=p_campaign and not exists(select 1 from public.outreach_partner_assignments a where a.campaign_id=p_campaign and a.event_registration_id=r.id and a.status<>'revoked')),'[]'::jsonb)
    );
  elsif p_action='partner_save' then
    pid:=nullif(p_payload->>'id','')::uuid;
    if pid is null then insert into public.outreach_partner_churches(campaign_id,name,slug,external_organization_id,created_by) values(p_campaign,btrim(p_payload->>'name'),lower(btrim(p_payload->>'slug')),nullif(p_payload->>'external_organization_id','')::uuid,auth.uid()) returning id into pid;
    else update public.outreach_partner_churches set name=btrim(p_payload->>'name'),active=coalesce((p_payload->>'active')::boolean,true),revision=revision+1 where id=pid and campaign_id=p_campaign; if not found then raise exception 'Partner church unavailable' using errcode='42501'; end if; end if;
    return jsonb_build_object('saved',true,'id',pid);
  elsif p_action='user_grant' then
    pid:=(p_payload->>'partner_church_id')::uuid;
    if nullif(p_payload->>'user_id','') is not null then uid:=(p_payload->>'user_id')::uuid; else select id into uid from auth.users where lower(email)=lower(btrim(p_payload->>'email')); end if;
    if uid is null then raise exception 'Verified Auth account required'; end if;
    if not exists(select 1 from public.outreach_partner_churches where id=pid and campaign_id=p_campaign) then raise exception 'Partner church unavailable' using errcode='42501'; end if;
    insert into public.outreach_partner_users(partner_church_id,campaign_id,user_id,capabilities,active,granted_by,reason)
    values(pid,p_campaign,uid,array(select jsonb_array_elements_text(p_payload->'capabilities')),true,auth.uid(),p_payload->>'reason')
    on conflict(partner_church_id,user_id) do update set capabilities=excluded.capabilities,active=true,effective_at=now(),expires_at=null,granted_by=excluded.granted_by,reason=excluded.reason,revision=public.outreach_partner_users.revision+1;
    perform private.outreach_audit(p_campaign,(select organization_id from public.outreach_campaigns where id=p_campaign),'partner.user_granted',uid,jsonb_build_object('partner_church_id',pid,'capabilities',p_payload->'capabilities'));
    return jsonb_build_object('saved',true);
  elsif p_action='user_revoke' then
    pid:=(p_payload->>'partner_church_id')::uuid; uid:=(p_payload->>'user_id')::uuid;
    update public.outreach_partner_users set active=false,expires_at=now(),granted_by=auth.uid(),reason=p_payload->>'reason',revision=revision+1 where partner_church_id=pid and campaign_id=p_campaign and user_id=uid and active;
    if not found then raise exception 'Partner user unavailable'; end if;
    update public.outreach_partner_assignments set assigned_worker_user_id=null,revision=revision+1 where partner_church_id=pid and assigned_worker_user_id=uid and status<>'revoked';
    perform private.outreach_audit(p_campaign,(select organization_id from public.outreach_campaigns where id=p_campaign),'partner.user_revoked',uid,jsonb_build_object('partner_church_id',pid));
    return jsonb_build_object('saved',true);
  elsif p_action='assign' then
    pid:=(p_payload->>'partner_church_id')::uuid;
    if not exists(select 1 from public.outreach_partner_churches where id=pid and campaign_id=p_campaign and active) then raise exception 'Partner church unavailable' using errcode='42501'; end if;
    target:=(p_payload->>'subject_id')::uuid;
    if p_payload->>'subject_type'='decision' then
      select s.source into decision_source from public.outreach_decision_campaign_sources s where s.campaign_id=p_campaign and s.active;
      if not exists(select 1 from public.outreach_registrations r where r.id=target and r.source=decision_source) then raise exception 'Decision outside campaign' using errcode='42501'; end if;
      insert into public.outreach_partner_assignments(campaign_id,partner_church_id,decision_registration_id,assigned_by,assignment_reason) values(p_campaign,pid,target,auth.uid(),p_payload->>'reason') returning id into assignment;
    elsif p_payload->>'subject_type'='household' then
      if not exists(select 1 from public.outreach_event_registrations r where r.id=target and r.campaign_id=p_campaign) then raise exception 'Household outside campaign' using errcode='42501'; end if;
      insert into public.outreach_partner_assignments(campaign_id,partner_church_id,event_registration_id,assigned_by,assignment_reason) values(p_campaign,pid,target,auth.uid(),p_payload->>'reason') returning id into assignment;
    else raise exception 'Invalid subject type'; end if;
    perform private.outreach_audit(p_campaign,(select organization_id from public.outreach_campaigns where id=p_campaign),'partner.assignment_created',assignment,jsonb_build_object('partner_church_id',pid,'subject_type',p_payload->>'subject_type'));
    return jsonb_build_object('saved',true,'id',assignment);
  elsif p_action='revoke_assignment' then
    assignment:=(p_payload->>'assignment_id')::uuid;
    if length(btrim(coalesce(p_payload->>'reason','')))<10 then raise exception 'Assignment revocation reason required'; end if;
    update public.outreach_partner_assignments set status='revoked',revoked_at=now(),revoked_by=auth.uid(),revision=revision+1 where id=assignment and campaign_id=p_campaign and status<>'revoked';
    if not found then raise exception 'Assignment unavailable'; end if;
    perform private.outreach_audit(p_campaign,(select organization_id from public.outreach_campaigns where id=p_campaign),'partner.assignment_revoked',assignment,jsonb_build_object('reason',left(btrim(p_payload->>'reason'),500)));
    return jsonb_build_object('saved',true);
  end if;
  raise exception 'Unsupported partner admin action';
end $$;

