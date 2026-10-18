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
