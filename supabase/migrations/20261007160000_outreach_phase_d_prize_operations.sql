-- Phase D candidate only. Reuses the Phase C attendee/check-in record and the dormant
-- prize integrity ledger. No campaign is enabled and no authority is provisioned here.
alter table public.outreach_campaign_assignments drop constraint outreach_campaign_assignments_capabilities_check;
alter table public.outreach_campaign_assignments add constraint outreach_campaign_assignments_capabilities_check check (
 capabilities <@ array['view','export','followup','decisions','workflow','documents','draw','team.view','team.manage','travel.view','travel.manage','registration.view','registration.manage','registration.export','checkin.manage','prize.view','prize.manage','prize.draw','prize.claim']::text[]
 and cardinality(capabilities)>0 and array_position(capabilities,null) is null
 and (not('team.manage'=any(capabilities)) or 'team.view'=any(capabilities))
 and (not('travel.manage'=any(capabilities)) or 'travel.view'=any(capabilities))
 and (not(capabilities && array['registration.manage','registration.export','checkin.manage']) or 'registration.view'=any(capabilities))
 and (not(capabilities && array['prize.manage','prize.draw','prize.claim']) or 'prize.view'=any(capabilities)));

alter table public.outreach_campaign_events drop constraint outreach_campaign_events_kind_check;
alter table public.outreach_campaign_events add constraint outreach_campaign_events_kind_check check(kind in (
 'campaign.created','campaign.approved','workflow.step_due','workflow.step_overdue','workflow.step_completed','document.requested','document.uploaded','agreement.completed','training.assigned','training.completed','registration.opened','team.signup_opened','event.ready','event.completed','followup.required','drawing_number.assigned','drawing_reminder','prize.won','prize.unclaimed',
 'team_signup.submitted','team_signup.approved','team_signup.waitlisted','team_signup.not_selected','vehicle.assigned','vehicle.changed','lodging.assigned','lodging.changed','trip_details.updated','departure_reminder','team_role.assigned','team.action_required',
 'outreach.registration.submitted','outreach.registration.updated','outreach.waiver.signed','outreach.registration.confirmed','outreach.attendee.checked_in','outreach.attendee.checkin_reversed','outreach.walkup.registered',
 'outreach.drawing.reminder','outreach.prize.winner_selected','outreach.prize.claimed','outreach.prize.unclaimed'));

create table public.outreach_prize_settings (
 campaign_id uuid primary key references public.outreach_campaigns(id),
 digital_enabled boolean not null default false, drawing_enabled boolean not null default false,
 operation_mode text not null default 'hybrid' check(operation_mode in ('digital','paper','hybrid')),
 present_to_win boolean not null default true,
 one_win_only boolean not null default true check(one_win_only),
 reminder_minutes integer check(reminder_minutes between 1 and 1440),
 public_title text not null default 'Prize Drawing' check(length(btrim(public_title)) between 1 and 120),
 public_instruction text not null default 'Please come to Winner''s Circle' check(length(btrim(public_instruction)) between 1 and 200),
 revision integer not null default 1
);

alter table public.outreach_prize_participants add column manual_ticket_reference text check(manual_ticket_reference is null or length(manual_ticket_reference)<=80);
alter table public.outreach_prize_participants add column revision integer not null default 1;
alter table public.outreach_prize_pools drop constraint outreach_prize_pools_unclaimed_policy_check;
alter table public.outreach_prize_pools add constraint outreach_prize_pools_unclaimed_policy_check check(unclaimed_policy in ('remain_eligible','exclude_participant','exclude_pool'));
alter table public.outreach_prize_pools add column pool_key text check(pool_key is null or pool_key ~ '^[a-z0-9_-]{1,60}$');
alter table public.outreach_prize_pools add column prize_type text not null default 'other' check(length(prize_type) between 1 and 80);
alter table public.outreach_prize_pools add column display_name text;
alter table public.outreach_prize_pools add column category text not null default '' check(length(category)<=100);
alter table public.outreach_prize_pools add column age_guidance text not null default '' check(length(age_guidance)<=200);
alter table public.outreach_prize_pools add column size_guidance text not null default '' check(length(size_guidance)<=200);
alter table public.outreach_prize_pools add column description text not null default '' check(length(description)<=1000);
alter table public.outreach_prize_pools add column quantity integer not null default 1 check(quantity between 1 and 10000);
alter table public.outreach_prize_pools add column draw_order integer not null default 1 check(draw_order between 1 and 10000);
alter table public.outreach_prize_pools add column claim_window_seconds integer check(claim_window_seconds between 30 and 3600);
alter table public.outreach_prize_pools add column notes text not null default '' check(length(notes)<=2000);
alter table public.outreach_prize_pools add column revision integer not null default 1;
create unique index outreach_prize_pool_key_unique on public.outreach_prize_pools(campaign_id,pool_key) where pool_key is not null;

alter table public.outreach_prize_pool_entries add column active boolean not null default true;
alter table public.outreach_prize_pool_entries add column updated_at timestamptz not null default now();
alter table public.outreach_prize_pool_entries add column updated_by uuid references auth.users(id);

create table public.outreach_prize_draw_sessions (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id),
 status text not null default 'started' check(status in ('started','active','completed','closed')),
 started_by uuid not null references auth.users(id), started_at timestamptz not null default now(),
 completed_at timestamptz, closed_at timestamptz, unique(campaign_id,id)
);
create unique index outreach_prize_one_open_session on public.outreach_prize_draw_sessions(campaign_id) where status in ('started','active');
create table public.outreach_prize_pool_locks (
 campaign_id uuid not null, session_id uuid not null, pool_id uuid not null,
 eligible_count integer not null check(eligible_count>=0), snapshot_at timestamptz not null default now(),
 primary key(session_id,pool_id), foreign key(campaign_id,session_id) references public.outreach_prize_draw_sessions(campaign_id,id),
 foreign key(campaign_id,pool_id) references public.outreach_prize_pools(campaign_id,id)
);
alter table public.outreach_prize_draws add column session_id uuid;
alter table public.outreach_prize_draws add constraint outreach_prize_draw_session_fk foreign key(campaign_id,session_id) references public.outreach_prize_draw_sessions(campaign_id,id);
create index outreach_prize_draw_session_idx on public.outreach_prize_draws(session_id,created_at);
create table public.outreach_prize_pool_exclusions (
 campaign_id uuid not null, pool_id uuid not null, participant_id uuid not null, draw_id uuid not null,
 primary key(pool_id,participant_id), foreign key(campaign_id,pool_id) references public.outreach_prize_pools(campaign_id,id),
 foreign key(campaign_id,participant_id) references public.outreach_prize_participants(campaign_id,id),
 foreign key(campaign_id,draw_id) references public.outreach_prize_draws(campaign_id,id)
);

create function private.outreach_prize_can(c uuid,cap text) returns boolean language sql stable security definer set search_path='' as $$
 select cap in ('prize.view','prize.manage','prize.draw','prize.claim') and private.outreach_verified(auth.uid()) and exists(
  select 1 from public.outreach_campaigns x where x.id=c and (
   private.outreach_admin(x.organization_id,cap<>'prize.view') or exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c and a.user_id=auth.uid() and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and 'view'=any(a.capabilities) and 'prize.view'=any(a.capabilities) and cap=any(a.capabilities))))
$$;

create function private.outreach_prize_assign_number(c uuid,p uuid) returns text language plpgsql security definer set search_path='' as $$
declare n text;bits bigint;i integer;org uuid;begin
 perform 1 from public.outreach_prize_participants where campaign_id=c and id=p for update;
 if not found then raise exception 'Participant outside campaign' using errcode='42501';end if;
 select number into n from public.outreach_drawing_numbers where campaign_id=c and participant_id=p;if found then return n;end if;
 for i in 1..1000 loop
  bits:=('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint;
  if bits>=4294800000 then continue;end if;n:=(100000+(bits%900000))::text;
  begin insert into public.outreach_drawing_numbers(campaign_id,participant_id,number) values(c,p,n);
   select organization_id into org from public.outreach_campaigns where id=c;perform private.outreach_audit(c,org,'drawing_number.assigned',p);perform private.outreach_event(c,'drawing_number.assigned',p,'drawing-number:'||c||':'||p);return n;
  exception when unique_violation then null;end;
 end loop;raise exception 'Number space unavailable';end $$;

create function private.outreach_prize_eligible(c uuid,pool uuid) returns integer language sql stable security definer set search_path='' as $$
 select count(*)::integer from public.outreach_prize_participants p
 join public.outreach_prize_pool_entries e on e.campaign_id=p.campaign_id and e.participant_id=p.id and e.pool_id=pool and e.active
 join public.outreach_drawing_numbers n on n.campaign_id=p.campaign_id and n.participant_id=p.id
 join public.outreach_prize_settings s on s.campaign_id=p.campaign_id
 where p.campaign_id=c and p.active and (not s.present_to_win or p.checked_in_at is not null)
 and not exists(select 1 from public.outreach_prize_wins w where w.campaign_id=c and w.participant_id=p.id)
 and not exists(select 1 from public.outreach_prize_exclusions x where x.campaign_id=c and x.participant_id=p.id)
 and not exists(select 1 from public.outreach_prize_pool_exclusions x where x.pool_id=pool and x.participant_id=p.id)
 and not exists(select 1 from public.outreach_prize_draws d where d.campaign_id=c and d.participant_id=p.id and not exists(select 1 from public.outreach_prize_draw_history h where h.draw_id=d.id and h.kind in ('claimed','unclaimed')))
$$;

create function private.outreach_prize_context(c uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'campaign',jsonb_build_object('id',x.id,'name',x.name,'code',x.code,'city',x.city,'event_start',x.event_start,'timezone',x.timezone),
  'registration_slug',(select public_slug from public.outreach_registration_settings where campaign_id=c),
  'organization',jsonb_build_object('name',o.name,'slug',o.slug,'logo_asset',case o.slug when 'champion-life' then 'assets/images/logo-gold.png' when 'sowgo' then 'assets/images/sowgo-logo-light.png' else null end),
  'settings',to_jsonb(s),'admin',private.outreach_admin(x.organization_id,true),'capabilities',(select coalesce(jsonb_agg(k),'[]') from unnest(array['prize.view','prize.manage','prize.draw','prize.claim']) k where private.outreach_prize_can(c,k)),
  'assignments',case when private.outreach_admin(x.organization_id,true) then (select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'email',u.email,'role_key',a.role_key,'capabilities',a.capabilities,'revision',a.revision,'active',a.active) order by u.email),'[]') from public.outreach_campaign_assignments a join auth.users u on u.id=a.user_id where a.campaign_id=c) else '[]'::jsonb end,
  'session',(select to_jsonb(q) from public.outreach_prize_draw_sessions q where q.campaign_id=c order by q.started_at desc limit 1),
  'pools',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('eligible_count',private.outreach_prize_eligible(c,p.id),'drawn_count',(select count(*) from public.outreach_prize_draws d where d.pool_id=p.id),'claimed_count',(select count(*) from public.outreach_prize_draws d join public.outreach_prize_draw_history h on h.draw_id=d.id and h.kind='claimed' where d.pool_id=p.id),'remaining',greatest(0,p.quantity-(select count(*) from public.outreach_prize_draws d join public.outreach_prize_draw_history h on h.draw_id=d.id and h.kind='claimed' where d.pool_id=p.id)),'locked',exists(select 1 from public.outreach_prize_pool_locks l where l.pool_id=p.id and exists(select 1 from public.outreach_prize_draw_sessions q where q.id=l.session_id and q.status in ('started','active')))) order by p.draw_order,p.name),'[]') from public.outreach_prize_pools p where p.campaign_id=c),
  'participants',(select coalesce(jsonb_agg(jsonb_build_object('id',pp.id,'name',coalesce(a.first_name||' '||a.last_name,'Participant'),'guardian',coalesce(r.first_name||' '||r.last_name,''),'phone',coalesce(r.phone,''),'number',n.number,'checked_in',pp.checked_in_at is not null,'active',pp.active,'manual_ticket_reference',pp.manual_ticket_reference,'winner',w.draw_id is not null,'pools',(select coalesce(jsonb_agg(e.pool_id),'[]') from public.outreach_prize_pool_entries e where e.participant_id=pp.id and e.active)) order by a.first_name,a.last_name,pp.id),'[]') from public.outreach_prize_participants pp left join public.outreach_event_attendees a on a.id=pp.attendee_id left join public.outreach_event_registrations r on r.id=a.registration_id left join public.outreach_drawing_numbers n on n.campaign_id=pp.campaign_id and n.participant_id=pp.id left join public.outreach_prize_wins w on w.campaign_id=pp.campaign_id and w.participant_id=pp.id where pp.campaign_id=c),
  'current',(select jsonb_build_object('id',d.id,'pool_id',d.pool_id,'prize',d.prize_label,'number',n.number,'selected_at',d.created_at,'state',coalesce((select h.kind from public.outreach_prize_draw_history h where h.draw_id=d.id and h.kind in ('claimed','unclaimed') order by h.created_at desc limit 1),'selected'),'participant',jsonb_build_object('name',a.first_name||' '||a.last_name,'guardian',r.first_name||' '||r.last_name,'phone',r.phone,'email',r.email)) from public.outreach_prize_draws d join public.outreach_drawing_numbers n on n.campaign_id=d.campaign_id and n.participant_id=d.participant_id left join public.outreach_prize_participants pp on pp.id=d.participant_id left join public.outreach_event_attendees a on a.id=pp.attendee_id left join public.outreach_event_registrations r on r.id=a.registration_id where d.campaign_id=c order by d.created_at desc,d.id desc limit 1),
  'history',(select coalesce(jsonb_agg(z order by z->>'selected_at' desc),'[]') from (select jsonb_build_object('id',d.id,'pool',p.name,'prize',d.prize_label,'number',n.number,'selected_at',d.created_at,'state',coalesce((select h.kind from public.outreach_prize_draw_history h where h.draw_id=d.id and h.kind in ('claimed','unclaimed') order by h.created_at desc limit 1),'selected')) z from public.outreach_prize_draws d join public.outreach_prize_pools p on p.id=d.pool_id join public.outreach_drawing_numbers n on n.campaign_id=d.campaign_id and n.participant_id=d.participant_id where d.campaign_id=c order by d.created_at desc limit 100) q)
 ) from public.outreach_campaigns x join public.organizations o on o.id=x.organization_id left join public.outreach_prize_settings s on s.campaign_id=x.id where x.id=c
$$;

create function private.outreach_prize_workspace(action text,c uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare x public.outreach_campaigns;s public.outreach_prize_settings;pool public.outreach_prize_pools;session public.outreach_prize_draw_sessions;part uuid;draw public.outreach_prize_draws;number text;result jsonb;csv text;row jsonb;cap text;claimed integer;pending public.outreach_prize_draws;begin
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>30000 then raise exception 'Invalid request';end if;
 cap:=case when action in ('context','campaigns','household') then 'prize.view' when action in ('draw','session_start','session_complete','pool_start','redisplay') then 'prize.draw' when action in ('claim','unclaimed') then 'prize.claim' else 'prize.manage' end;
 if action='campaigns' then return coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'name',q.name,'city',q.city,'event_start',q.event_start)) from public.outreach_campaigns q where private.outreach_prize_can(q.id,'prize.view')),'[]');end if;
 if not private.outreach_prize_can(c,cap) then raise exception 'Prize access denied' using errcode='42501';end if;
 select * into x from public.outreach_campaigns where id=c;if not found then raise exception 'Campaign unavailable' using errcode='42501';end if;
 if action='context' or action='redisplay' then return private.outreach_prize_context(c);end if;
 perform pg_advisory_xact_lock(hashtextextended(c::text,919));
 if not private.outreach_prize_can(c,cap) then raise exception 'Prize access denied' using errcode='42501';end if;
 select * into s from public.outreach_prize_settings where campaign_id=c;
 if action='configure' then
  insert into public.outreach_prize_settings(campaign_id,digital_enabled,drawing_enabled,operation_mode,present_to_win,reminder_minutes,public_title,public_instruction)
  values(c,coalesce((p->>'digital_enabled')::boolean,false),coalesce((p->>'drawing_enabled')::boolean,false),coalesce(p->>'operation_mode','hybrid'),coalesce((p->>'present_to_win')::boolean,true),(p->>'reminder_minutes')::integer,coalesce(p->>'public_title','Prize Drawing'),coalesce(p->>'public_instruction','Please come to Winner''s Circle'))
  on conflict(campaign_id) do update set digital_enabled=excluded.digital_enabled,drawing_enabled=excluded.drawing_enabled,operation_mode=excluded.operation_mode,present_to_win=excluded.present_to_win,reminder_minutes=excluded.reminder_minutes,public_title=excluded.public_title,public_instruction=excluded.public_instruction,revision=outreach_prize_settings.revision+1;
  perform private.outreach_audit(c,x.organization_id,'prize.configured',c);return jsonb_build_object('saved',true);
 elsif action='pool_save' then
  if p->>'id' is not null and exists(select 1 from public.outreach_prize_pool_locks l join public.outreach_prize_draw_sessions q on q.id=l.session_id where l.pool_id=(p->>'id')::uuid and q.status in ('started','active')) then raise exception 'Pool is locked for an active draw';end if;
  if p->>'id' is null then insert into public.outreach_prize_pools(campaign_id,name,display_name,pool_key,prize_type,category,age_guidance,size_guidance,description,quantity,draw_order,claim_window_seconds,notes,active,unclaimed_policy)
   values(c,p->>'name',coalesce(p->>'display_name',p->>'name'),nullif(p->>'pool_key',''),coalesce(p->>'prize_type','other'),coalesce(p->>'category',''),coalesce(p->>'age_guidance',''),coalesce(p->>'size_guidance',''),coalesce(p->>'description',''),coalesce((p->>'quantity')::integer,1),coalesce((p->>'draw_order')::integer,1),(p->>'claim_window_seconds')::integer,coalesce(p->>'notes',''),coalesce((p->>'active')::boolean,true),p->>'unclaimed_policy') returning * into pool;
  else update public.outreach_prize_pools set name=p->>'name',display_name=coalesce(p->>'display_name',p->>'name'),pool_key=nullif(p->>'pool_key',''),prize_type=coalesce(p->>'prize_type','other'),category=coalesce(p->>'category',''),age_guidance=coalesce(p->>'age_guidance',''),size_guidance=coalesce(p->>'size_guidance',''),description=coalesce(p->>'description',''),quantity=(p->>'quantity')::integer,draw_order=(p->>'draw_order')::integer,claim_window_seconds=(p->>'claim_window_seconds')::integer,notes=coalesce(p->>'notes',''),active=coalesce((p->>'active')::boolean,true),unclaimed_policy=p->>'unclaimed_policy',revision=revision+1 where campaign_id=c and id=(p->>'id')::uuid and revision=(p->>'revision')::integer returning * into pool;if not found then raise exception 'Prize pool changed';end if;end if;
  perform private.outreach_audit(c,x.organization_id,'prize.pool_saved',pool.id);return to_jsonb(pool);
 elsif action='sync' then
  insert into public.outreach_prize_participants(campaign_id,attendee_id,checked_in_at,active)
   select c,a.id,a.checked_in_at,a.active and a.attending and a.prize_participation from public.outreach_event_attendees a where a.campaign_id=c and a.prize_participation
   on conflict(campaign_id,attendee_id) where attendee_id is not null do update set checked_in_at=excluded.checked_in_at,active=excluded.active,revision=outreach_prize_participants.revision+1;
  for part in select id from public.outreach_prize_participants where campaign_id=c loop perform private.outreach_prize_assign_number(c,part);end loop;
  insert into public.outreach_prize_pool_entries(campaign_id,pool_id,participant_id,updated_by)
   select c,q.id,pp.id,auth.uid() from public.outreach_prize_pools q join public.outreach_event_attendees a on a.campaign_id=q.campaign_id and a.prize_choice=q.pool_key join public.outreach_prize_participants pp on pp.attendee_id=a.id and pp.campaign_id=a.campaign_id where q.campaign_id=c and q.pool_key is not null
   on conflict(pool_id,participant_id) do update set active=true,updated_at=clock_timestamp(),updated_by=excluded.updated_by;
  perform private.outreach_audit(c,x.organization_id,'prize.identities_synced',c);return jsonb_build_object('participants',(select count(*) from public.outreach_prize_participants where campaign_id=c),'numbers',(select count(*) from public.outreach_drawing_numbers where campaign_id=c));
 elsif action='participant_set' then
  part:=(p->>'participant_id')::uuid;if exists(select 1 from public.outreach_prize_wins where campaign_id=c and participant_id=part) then raise exception 'Winner eligibility cannot be re-enabled' using errcode='42501';end if;
  if exists(select 1 from public.outreach_prize_pool_locks l join public.outreach_prize_draw_sessions q on q.id=l.session_id where l.pool_id=(p->>'pool_id')::uuid and q.status in ('started','active')) then raise exception 'Pool is locked for an active draw';end if;
  insert into public.outreach_prize_pool_entries(campaign_id,pool_id,participant_id,active,updated_by) values(c,(p->>'pool_id')::uuid,part,coalesce((p->>'active')::boolean,true),auth.uid()) on conflict(pool_id,participant_id) do update set active=excluded.active,updated_at=clock_timestamp(),updated_by=excluded.updated_by;
  update public.outreach_prize_participants set manual_ticket_reference=case when s.operation_mode in ('paper','hybrid') then nullif(p->>'manual_ticket_reference','') else null end,revision=revision+1 where campaign_id=c and id=part;
  perform private.outreach_audit(c,x.organization_id,'prize.eligibility_changed',part,jsonb_build_object('pool_id',p->>'pool_id','active',coalesce((p->>'active')::boolean,true)));return jsonb_build_object('saved',true);
 elsif action='session_start' then
  if s.campaign_id is null or not s.drawing_enabled then raise exception 'Digital drawing is not enabled';end if;
  select * into session from public.outreach_prize_draw_sessions where campaign_id=c and status in ('started','active') for update;
  if not found then insert into public.outreach_prize_draw_sessions(campaign_id,status,started_by) values(c,'active',auth.uid()) returning * into session;end if;
  perform private.outreach_audit(c,x.organization_id,'prize.session_started',session.id);return to_jsonb(session);
 elsif action='pool_start' then
  select * into session from public.outreach_prize_draw_sessions where campaign_id=c and status in ('started','active') for update;if not found then raise exception 'Start the draw session first';end if;
  select * into pool from public.outreach_prize_pools where campaign_id=c and id=(p->>'pool_id')::uuid and active for update;if not found then raise exception 'Prize pool unavailable';end if;
  insert into public.outreach_prize_pool_locks(campaign_id,session_id,pool_id,eligible_count) values(c,session.id,pool.id,private.outreach_prize_eligible(c,pool.id)) on conflict(session_id,pool_id) do nothing;
  perform private.outreach_audit(c,x.organization_id,'prize.pool_locked',pool.id);return jsonb_build_object('pool_id',pool.id,'eligible_count',private.outreach_prize_eligible(c,pool.id));
 elsif action='draw' then
  if s.campaign_id is null or not s.digital_enabled or not s.drawing_enabled then raise exception 'Digital drawing is not enabled';end if;
  select * into session from public.outreach_prize_draw_sessions where campaign_id=c and status in ('started','active') for update;if not found then raise exception 'Start the draw session first';end if;
  select * into pool from public.outreach_prize_pools where campaign_id=c and id=(p->>'pool_id')::uuid and active for update;if not found or not exists(select 1 from public.outreach_prize_pool_locks l where l.session_id=session.id and l.pool_id=pool.id) then raise exception 'Start and lock this prize pool first';end if;
  select d.* into pending from public.outreach_prize_draws d where d.campaign_id=c and d.pool_id=pool.id and not exists(select 1 from public.outreach_prize_draw_history h where h.draw_id=d.id and h.kind in ('claimed','unclaimed')) order by d.created_at desc limit 1 for update;
  if found then return private.outreach_prize_context(c);end if;
  select count(*) into claimed from public.outreach_prize_draws d join public.outreach_prize_draw_history h on h.draw_id=d.id and h.kind='claimed' where d.pool_id=pool.id;if claimed>=pool.quantity then raise exception 'Prize inventory exhausted';end if;
  perform private.outreach_audit(c,x.organization_id,case when exists(select 1 from public.outreach_prize_draws old join public.outreach_prize_draw_history h on h.draw_id=old.id and h.kind='unclaimed' where old.pool_id=pool.id) then 'prize.redraw_initiated' else 'prize.draw_initiated' end,pool.id);
  select pp.id into part from public.outreach_prize_participants pp join public.outreach_prize_pool_entries e on e.campaign_id=pp.campaign_id and e.participant_id=pp.id and e.pool_id=pool.id and e.active join public.outreach_drawing_numbers n on n.campaign_id=pp.campaign_id and n.participant_id=pp.id
   where pp.campaign_id=c and pp.active and (not s.present_to_win or pp.checked_in_at is not null) and not exists(select 1 from public.outreach_prize_wins w where w.campaign_id=c and w.participant_id=pp.id) and not exists(select 1 from public.outreach_prize_exclusions z where z.campaign_id=c and z.participant_id=pp.id) and not exists(select 1 from public.outreach_prize_pool_exclusions z where z.pool_id=pool.id and z.participant_id=pp.id) and not exists(select 1 from public.outreach_prize_draws d where d.campaign_id=c and d.participant_id=pp.id and not exists(select 1 from public.outreach_prize_draw_history h where h.draw_id=d.id and h.kind in ('claimed','unclaimed'))) order by gen_random_uuid() limit 1 for update of pp;
  if part is null then raise exception 'No eligible checked-in participant';end if;
  insert into public.outreach_prize_draws(campaign_id,pool_id,participant_id,prize_label,operator_id,session_id) values(c,pool.id,part,coalesce(pool.display_name,pool.name),auth.uid(),session.id) returning * into draw;
  insert into public.outreach_prize_draw_history(campaign_id,draw_id,kind,actor_id) values(c,draw.id,'selected',auth.uid());perform private.outreach_audit(c,x.organization_id,'prize.winner_selected',draw.id);perform private.outreach_event(c,'outreach.prize.winner_selected',part,'prize-selected:'||draw.id);return private.outreach_prize_context(c);
 elsif action in ('claim','unclaimed') then
  select * into draw from public.outreach_prize_draws where campaign_id=c and id=(p->>'draw_id')::uuid for update;if not found then raise exception 'Draw unavailable';end if;
  if exists(select 1 from public.outreach_prize_draw_history where draw_id=draw.id and kind=case when action='claim' then 'claimed' else 'unclaimed' end) then return private.outreach_prize_context(c);end if;
  if exists(select 1 from public.outreach_prize_draw_history where draw_id=draw.id and kind in ('claimed','unclaimed')) then raise exception 'Draw already resolved';end if;
  select * into pool from public.outreach_prize_pools where id=draw.pool_id for update;
  if action='claim' then
   if s.present_to_win and not exists(select 1 from public.outreach_prize_participants where campaign_id=c and id=draw.participant_id and active and checked_in_at is not null) then raise exception 'Checked-in participant required';end if;
   select count(*) into claimed from public.outreach_prize_draws d join public.outreach_prize_draw_history h on h.draw_id=d.id and h.kind='claimed' where d.pool_id=pool.id;if claimed>=pool.quantity then raise exception 'Prize inventory exhausted';end if;
   insert into public.outreach_prize_wins(campaign_id,participant_id,draw_id) values(c,draw.participant_id,draw.id);insert into public.outreach_prize_exclusions(campaign_id,participant_id,draw_id) values(c,draw.participant_id,draw.id) on conflict do nothing;update public.outreach_prize_pool_entries set active=false,updated_at=clock_timestamp(),updated_by=auth.uid() where campaign_id=c and participant_id=draw.participant_id;
   insert into public.outreach_prize_draw_history(campaign_id,draw_id,kind,actor_id) values(c,draw.id,'claimed',auth.uid());perform private.outreach_audit(c,x.organization_id,'prize.claimed',draw.id);perform private.outreach_event(c,'outreach.prize.claimed',draw.participant_id,'prize-claimed:'||draw.id);perform private.outreach_event(c,'prize.won',draw.participant_id,'prize-won:'||draw.id);
  else
   if pool.unclaimed_policy='exclude_participant' then insert into public.outreach_prize_exclusions(campaign_id,participant_id,draw_id) values(c,draw.participant_id,draw.id) on conflict do nothing;update public.outreach_prize_pool_entries set active=false,updated_at=clock_timestamp(),updated_by=auth.uid() where campaign_id=c and participant_id=draw.participant_id;
   elsif pool.unclaimed_policy='exclude_pool' then insert into public.outreach_prize_pool_exclusions(campaign_id,pool_id,participant_id,draw_id) values(c,pool.id,draw.participant_id,draw.id) on conflict do nothing;update public.outreach_prize_pool_entries set active=false,updated_at=clock_timestamp(),updated_by=auth.uid() where pool_id=pool.id and participant_id=draw.participant_id;end if;
   insert into public.outreach_prize_draw_history(campaign_id,draw_id,kind,actor_id) values(c,draw.id,'unclaimed',auth.uid());perform private.outreach_audit(c,x.organization_id,'prize.unclaimed',draw.id,jsonb_build_object('policy',pool.unclaimed_policy));perform private.outreach_event(c,'outreach.prize.unclaimed',draw.participant_id,'prize-unclaimed:'||draw.id);perform private.outreach_event(c,'prize.unclaimed',draw.participant_id,'legacy-prize-unclaimed:'||draw.id);
  end if;return private.outreach_prize_context(c);
 elsif action='session_complete' then
  update public.outreach_prize_draw_sessions set status='completed',completed_at=clock_timestamp() where campaign_id=c and status in ('started','active') returning * into session;if not found then raise exception 'No active draw session';end if;perform private.outreach_audit(c,x.organization_id,'prize.session_completed',session.id);return to_jsonb(session);
 elsif action='reminder_prepare' then
  if s.reminder_minutes is null then raise exception 'Configure reminder timing first';end if;perform private.outreach_event(c,'outreach.drawing.reminder',c,'drawing-reminder:'||c||':'||s.revision);perform private.outreach_audit(c,x.organization_id,'prize.reminder_prepared',c,jsonb_build_object('minutes',s.reminder_minutes));return jsonb_build_object('held',true,'minutes',s.reminder_minutes);
 elsif action='export' then
  csv:='Drawing Number,Attendee,Guardian,Phone,Pool,Checked In,Eligible,Winner State,Manual Ticket'||E'\r\n';
  for row in select jsonb_build_array(n.number,a.first_name||' '||a.last_name,r.first_name||' '||r.last_name,r.phone,pz.name,case when pp.checked_in_at is null then 'No' else 'Yes' end,case when e.active and pp.active and not exists(select 1 from public.outreach_prize_wins w where w.campaign_id=c and w.participant_id=pp.id) then 'Eligible' else 'Inactive' end,case when exists(select 1 from public.outreach_prize_wins w where w.campaign_id=c and w.participant_id=pp.id) then 'Claimed winner' else '' end,coalesce(pp.manual_ticket_reference,'')) from public.outreach_prize_participants pp join public.outreach_drawing_numbers n on n.campaign_id=pp.campaign_id and n.participant_id=pp.id left join public.outreach_event_attendees a on a.id=pp.attendee_id left join public.outreach_event_registrations r on r.id=a.registration_id left join public.outreach_prize_pool_entries e on e.participant_id=pp.id and e.campaign_id=pp.campaign_id left join public.outreach_prize_pools pz on pz.id=e.pool_id where pp.campaign_id=c order by n.number loop csv:=csv||(select string_agg(private.outreach_csv_cell(value),',' order by ord) from jsonb_array_elements_text(row) with ordinality q(value,ord))||E'\r\n';end loop;
  perform private.outreach_audit(c,x.organization_id,'prize.backup_exported',c);return jsonb_build_object('csv',csv,'filename',x.code||'-prize-backup.csv');
 elsif action='access' then
  if not private.outreach_admin(x.organization_id,true) then raise exception 'Campaign administrator required' using errcode='42501';end if;if length(btrim(coalesce(p->>'reason','')))<10 then raise exception 'Review reason required';end if;
  if exists(select 1 from jsonb_array_elements_text(p->'capabilities') k where k not in ('prize.view','prize.manage','prize.draw','prize.claim')) then raise exception 'Only prize capabilities permitted';end if;
  update public.outreach_campaign_assignments set capabilities=array(select distinct k from unnest(capabilities||array(select jsonb_array_elements_text(p->'capabilities'))) k where k not in ('prize.view','prize.manage','prize.draw','prize.claim') or (p->'capabilities') ? k),revision=revision+1,reason=p->>'reason' where campaign_id=c and user_id=(p->>'user_id')::uuid and revision=(p->>'revision')::integer;if not found then raise exception 'Assignment changed';end if;perform private.outreach_audit(c,x.organization_id,'prize.access_changed',(p->>'user_id')::uuid);return jsonb_build_object('saved',true);
 else raise exception 'Unsupported prize action';end if;end $$;

create function public.outreach_prize_workspace(p_action text,p_campaign uuid default null,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.outreach_prize_workspace(p_action,p_campaign,p_payload)$$;
create function public.outreach_prize_public_state(p_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('campaign',x.name,'organization',o.name,'logo_asset',case o.slug when 'champion-life' then 'assets/images/logo-gold.png' when 'sowgo' then 'assets/images/sowgo-logo-light.png' else null end,'title',s.public_title,'instruction',s.public_instruction,'prize',coalesce(p.display_name,p.name),'state',coalesce((select h.kind from public.outreach_prize_draw_history h where h.draw_id=d.id and h.kind in ('claimed','unclaimed') order by h.created_at desc limit 1),case when d.id is null then 'waiting' else 'selected' end),'number',n.number,'selected_at',d.created_at)
 from public.outreach_registration_settings r join public.outreach_campaigns x on x.id=r.campaign_id join public.organizations o on o.id=x.organization_id join public.outreach_prize_settings s on s.campaign_id=x.id and s.digital_enabled and s.drawing_enabled left join lateral(select z.* from public.outreach_prize_draws z where z.campaign_id=x.id order by z.created_at desc,z.id desc limit 1)d on true left join public.outreach_prize_pools p on p.id=d.pool_id left join public.outreach_drawing_numbers n on n.campaign_id=d.campaign_id and n.participant_id=d.participant_id where r.public_slug=p_slug
$$;
create function public.outreach_prize_household_numbers(p_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u auth.users;c uuid;r public.outreach_event_registrations;begin
 if not private.outreach_verified(auth.uid()) then raise exception 'Verified sign-in required' using errcode='42501';end if;select * into u from auth.users where id=auth.uid();select s.campaign_id into c from public.outreach_registration_settings s join public.outreach_prize_settings ps on ps.campaign_id=s.campaign_id and ps.digital_enabled where s.public_slug=p_slug;
 select * into r from public.outreach_event_registrations where campaign_id=c and lower(email)=lower(u.email) order by submitted_at desc limit 1;if not found then raise exception 'Household drawing numbers unavailable' using errcode='42501';end if;
 return jsonb_build_object('campaign',(select name from public.outreach_campaigns where id=c),'present_to_win',(select present_to_win from public.outreach_prize_settings where campaign_id=c),'members',(select coalesce(jsonb_agg(jsonb_build_object('name',a.first_name||' '||a.last_name,'number',n.number,'categories',(select coalesce(jsonb_agg(p.name order by p.draw_order),'[]') from public.outreach_prize_pool_entries e join public.outreach_prize_pools p on p.id=e.pool_id where e.participant_id=pp.id and e.active),'status',case when w.draw_id is not null then 'claimed' when exists(select 1 from public.outreach_prize_draws d where d.campaign_id=c and d.participant_id=pp.id and not exists(select 1 from public.outreach_prize_draw_history h where h.draw_id=d.id and h.kind in ('claimed','unclaimed'))) then 'winner' when pp.checked_in_at is not null and pp.active then 'eligible' when n.number is not null then 'assigned' else 'not_assigned' end) order by a.first_name,a.id),'[]') from public.outreach_event_attendees a left join public.outreach_prize_participants pp on pp.attendee_id=a.id and pp.campaign_id=a.campaign_id left join public.outreach_drawing_numbers n on n.campaign_id=pp.campaign_id and n.participant_id=pp.id left join public.outreach_prize_wins w on w.campaign_id=pp.campaign_id and w.participant_id=pp.id where a.registration_id=r.id and a.active));end $$;

do $$declare n text;begin foreach n in array array['outreach_prize_settings','outreach_prize_draw_sessions','outreach_prize_pool_locks','outreach_prize_pool_exclusions'] loop execute format('alter table public.%I enable row level security',n);execute format('revoke all on public.%I from public,anon,authenticated',n);execute format('grant all on public.%I to service_role',n);end loop;end $$;
create trigger outreach_prize_session_immutable before delete on public.outreach_prize_draw_sessions for each row execute function private.outreach_immutable();
create trigger outreach_prize_pool_exclusion_immutable before update or delete on public.outreach_prize_pool_exclusions for each row execute function private.outreach_immutable();
revoke all on function private.outreach_prize_can(uuid,text),private.outreach_prize_assign_number(uuid,uuid),private.outreach_prize_eligible(uuid,uuid),private.outreach_prize_context(uuid),private.outreach_prize_workspace(text,uuid,jsonb),public.outreach_prize_workspace(text,uuid,jsonb),public.outreach_prize_public_state(text),public.outreach_prize_household_numbers(text) from public,anon,authenticated;
grant execute on function private.outreach_prize_workspace(text,uuid,jsonb),public.outreach_prize_workspace(text,uuid,jsonb),public.outreach_prize_household_numbers(text) to authenticated;
grant execute on function public.outreach_prize_public_state(text) to anon,authenticated;
