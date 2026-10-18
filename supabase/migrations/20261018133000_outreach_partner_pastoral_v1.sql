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
