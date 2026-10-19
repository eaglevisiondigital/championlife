-- Forward extraction from accepted source commits; production registration definitions are untouched.
alter table public.outreach_campaign_assignments drop constraint outreach_campaign_assignments_capabilities_check;
alter table public.outreach_campaign_assignments add constraint outreach_campaign_assignments_capabilities_check check(capabilities <@ array['checkin.manage','communications.bulk_send','communications.delivery.view','communications.send','communications.templates.manage','communications.templates.view','communications.view','decision.manage','decision.view','decisions','documents','draw','export','followup','host.respond','host.view','inventory.manage','inventory.view','issue.manage','ops.manage','ops.view','preevent.manage','preevent.view','prize.claim','prize.draw','prize.manage','prize.view','registration.export','registration.manage','registration.view','team.manage','team.view','travel.manage','travel.view','view','workflow']::text[] and cardinality(capabilities)>0 and array_position(capabilities,null) is null and (not(capabilities && array['registration.manage','registration.export','checkin.manage']) or 'registration.view'=any(capabilities)) and (not('decision.manage'=any(capabilities)) or 'decision.view'=any(capabilities)) and (not('team.manage'=any(capabilities)) or 'team.view'=any(capabilities)) and (not('travel.manage'=any(capabilities)) or 'travel.view'=any(capabilities)) );
alter table public.outreach_campaign_events drop constraint outreach_campaign_events_kind_check;
alter table public.outreach_campaign_events add constraint outreach_campaign_events_kind_check check(kind in ('agreement.completed','campaign.approved','campaign.created','departure_reminder','document.requested','document.uploaded','drawing_number.assigned','drawing_reminder','event.completed','event.ready','followup.required','lodging.assigned','lodging.changed','outreach.agreement.completed','outreach.agreement.requested','outreach.attendee.checked_in','outreach.attendee.checkin_reversed','outreach.campaign.created','outreach.campaign.postponed','outreach.campaign.rescheduled','outreach.cost_impact_detected','outreach.document.approved','outreach.document.requested','outreach.document.uploaded','outreach.drawing.reminder','outreach.event_details.missing','outreach.final_readiness.changed','outreach.opportunity.approved','outreach.opportunity.submitted','outreach.ops.event_completed','outreach.ops.issue_opened','outreach.ops.issue_resolved','outreach.ops.ready','outreach.packet.generated','outreach.packet.ready','outreach.prize.claimed','outreach.prize.unclaimed','outreach.prize.winner_selected','outreach.registration.confirmed','outreach.registration.qr_requested','outreach.registration.submitted','outreach.registration.updated','outreach.task.due','outreach.task.escalated','outreach.task.overdue','outreach.training.assigned','outreach.training.completed','outreach.waiver.signed','outreach.walkup.registered','outreach.welcome.prepared','prize.unclaimed','prize.won','registration.opened','team.action_required','team.signup_opened','team_role.assigned','team_signup.approved','team_signup.not_selected','team_signup.submitted','team_signup.waitlisted','training.assigned','training.completed','trip_details.updated','vehicle.assigned','vehicle.changed','workflow.step_completed','workflow.step_due','workflow.step_overdue'));
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

create table public.outreach_ops_templates (
 id uuid primary key default gen_random_uuid(), owner_organization_id uuid references public.organizations(id),
 name text not null check(length(btrim(name)) between 1 and 160), version integer not null check(version between 1 and 10000),
 status text not null default 'draft' check(status in ('draft','published','retired')),
 description text not null default '' check(length(description)<=2000), created_by uuid references auth.users(id),
 created_at timestamptz not null default now(), published_at timestamptz, unique(owner_organization_id,name,version), unique(id,version)
);

create table public.outreach_ops_template_areas (
 id uuid primary key default gen_random_uuid(), template_id uuid not null references public.outreach_ops_templates(id), area_key text not null check(area_key~'^[a-z0-9_-]{1,60}$'),
 title text not null check(length(btrim(title)) between 1 and 120), description text not null default '' check(length(description)<=1200),
 category text not null check(length(btrim(category)) between 1 and 80), display_order integer not null check(display_order between 1 and 10000),
 required_for_ready boolean not null default false, repeatable boolean not null default false, active boolean not null default true,
 unique(template_id,area_key), unique(template_id,id)
);

create table public.outreach_ops_template_checklists (
 id uuid primary key default gen_random_uuid(), template_id uuid not null references public.outreach_ops_templates(id), area_key text not null,
 item_key text not null check(item_key~'^[a-z0-9_-]{1,80}$'), text text not null check(length(btrim(text)) between 1 and 500),
 display_order integer not null check(display_order between 1 and 10000), required boolean not null default true,
 quantity_kind text not null default 'none' check(quantity_kind in ('none','count','text','verification')),
 dependency_key text, attachment_hook boolean not null default false, unique(template_id,area_key,item_key),
 foreign key(template_id,area_key) references public.outreach_ops_template_areas(template_id,area_key)
);

create table public.outreach_ops_template_inventory (
 id uuid primary key default gen_random_uuid(), template_id uuid not null references public.outreach_ops_templates(id), area_key text not null,
 item_key text not null check(item_key~'^[a-z0-9_-]{1,80}$'), item_name text not null check(length(btrim(item_name)) between 1 and 160),
 category text not null check(length(btrim(category)) between 1 and 80), required_quantity integer not null default 0 check(required_quantity between 0 and 100000),
 critical boolean not null default false, return_required boolean not null default true, source_owner text not null default '' check(length(source_owner)<=160),
 unique(template_id,area_key,item_key), foreign key(template_id,area_key) references public.outreach_ops_template_areas(template_id,area_key)
);

create table public.outreach_ops_template_timeline (
 id uuid primary key default gen_random_uuid(), template_id uuid not null references public.outreach_ops_templates(id), item_key text not null check(item_key~'^[a-z0-9_-]{1,80}$'),
 title text not null check(length(btrim(title)) between 1 and 160), display_order integer not null check(display_order between 1 and 10000),
 relative_minutes integer, required boolean not null default false, notes text not null default '' check(length(notes)<=1000), unique(template_id,item_key)
);

create table public.outreach_event_operations (
 campaign_id uuid primary key references public.outreach_campaigns(id), template_id uuid not null, template_version integer not null,
 status text not null default 'planning' check(status in ('planning','setup','active','closeout','event_complete')),
 poll_seconds integer not null default 15 check(poll_seconds between 10 and 300), started_at timestamptz, completed_at timestamptz,
 completion_note text not null default '' check(length(completion_note)<=2000), revision integer not null default 1,
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
 foreign key(template_id,template_version) references public.outreach_ops_templates(id,version)
);

create table public.outreach_event_areas (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id), template_area_id uuid,
 area_key text not null check(area_key~'^[a-z0-9_-]{1,60}$'), instance_key text not null check(instance_key~'^[a-z0-9_-]{1,80}$'),
 title text not null check(length(btrim(title)) between 1 and 120), description text not null default '' check(length(description)<=1200),
 category text not null check(length(btrim(category)) between 1 and 80), display_order integer not null check(display_order between 1 and 10000),
 required_for_ready boolean not null default false, active boolean not null default true,
 status text not null default 'not_started' check(status in ('not_started','setup_in_progress','ready','active','issue','paused','closed','cleanup_in_progress','complete')),
 location text not null default '' check(length(location)<=500), notes text not null default '' check(length(notes)<=2000),
 issue_flag boolean not null default false, setup_started_at timestamptz, ready_at timestamptz, active_at timestamptz, closed_at timestamptz, completed_at timestamptz,
 revision integer not null default 1, updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
 unique(campaign_id,id), unique(campaign_id,instance_key)
);

create index outreach_event_areas_order_idx on public.outreach_event_areas(campaign_id,active,display_order);

create table public.outreach_event_area_members (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, area_id uuid not null, member_id uuid not null,
 role text not null check(role in ('lead','backup_lead','volunteer')), arrival_status text not null default 'not_arrived' check(arrival_status in ('not_arrived','arrived','assigned','released')),
 active boolean not null default true, notes text not null default '' check(length(notes)<=1000), assigned_at timestamptz not null default now(), assigned_by uuid references auth.users(id), released_at timestamptz,
 foreign key(campaign_id,area_id) references public.outreach_event_areas(campaign_id,id),
 foreign key(campaign_id,member_id) references public.outreach_team_members(campaign_id,id)
);

create unique index outreach_event_one_active_area_member on public.outreach_event_area_members(campaign_id,member_id) where active;

create unique index outreach_event_one_area_lead on public.outreach_event_area_members(area_id,role) where active and role in ('lead','backup_lead');

create index outreach_event_area_members_area_idx on public.outreach_event_area_members(area_id,active,role);

create table public.outreach_event_checklist_items (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, area_id uuid not null, template_item_id uuid,
 item_key text not null check(item_key~'^[a-z0-9_-]{1,80}$'), text text not null check(length(btrim(text)) between 1 and 500),
 display_order integer not null check(display_order between 1 and 10000), required boolean not null default true,
 quantity_kind text not null default 'none' check(quantity_kind in ('none','count','text','verification')), dependency_key text,
 attachment_hook boolean not null default false, completed boolean not null default false, completed_by uuid references auth.users(id), completed_at timestamptz,
 completion_note text not null default '' check(length(completion_note)<=1000), quantity_value text not null default '' check(length(quantity_value)<=200),
 issue_flag boolean not null default false, revision integer not null default 1, updated_at timestamptz not null default now(),
 foreign key(campaign_id,area_id) references public.outreach_event_areas(campaign_id,id), unique(area_id,item_key), unique(campaign_id,id),
 check((completed and completed_at is not null and completed_by is not null) or (not completed and completed_at is null and completed_by is null))
);

create index outreach_event_checklist_area_idx on public.outreach_event_checklist_items(area_id,display_order);

create table public.outreach_event_inventory (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, area_id uuid, template_item_id uuid,
 item_key text not null check(item_key~'^[a-z0-9_-]{1,80}$'), item_name text not null check(length(btrim(item_name)) between 1 and 160),
 category text not null check(length(btrim(category)) between 1 and 80), required_quantity integer not null default 0 check(required_quantity between 0 and 100000),
 available_quantity integer not null default 0 check(available_quantity between 0 and 100000), loaded_quantity integer not null default 0 check(loaded_quantity between 0 and 100000),
 on_site_quantity integer not null default 0 check(on_site_quantity between 0 and 100000), returned_quantity integer not null default 0 check(returned_quantity between 0 and 100000),
 missing_quantity integer not null default 0 check(missing_quantity between 0 and 100000), damaged_quantity integer not null default 0 check(damaged_quantity between 0 and 100000),
 direct_delivery boolean not null default false, critical boolean not null default false, return_required boolean not null default true,
 source_owner text not null default '' check(length(source_owner)<=160), vehicle_id uuid, verified_by uuid references auth.users(id), verified_at timestamptz,
 status text not null default 'needed' check(status in ('needed','committed','loaded','in_transit','on_site','in_use','packed','returned','missing','damaged')),
 notes text not null default '' check(length(notes)<=2000), revision integer not null default 1, updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
 foreign key(campaign_id,area_id) references public.outreach_event_areas(campaign_id,id), foreign key(campaign_id,vehicle_id) references public.outreach_team_vehicles(campaign_id,id),
 unique(campaign_id,id), unique(campaign_id,item_key),
 check(loaded_quantity<=available_quantity), check(direct_delivery or on_site_quantity<=loaded_quantity), check(returned_quantity<=on_site_quantity),
 check(missing_quantity+damaged_quantity<=on_site_quantity)
);

create index outreach_event_inventory_area_idx on public.outreach_event_inventory(campaign_id,area_id,status);

create index outreach_event_inventory_vehicle_idx on public.outreach_event_inventory(vehicle_id,status);

create table public.outreach_event_issues (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, area_id uuid,
 severity text not null check(severity in ('info','needs_attention','urgent')), issue text not null check(length(btrim(issue)) between 1 and 500),
 status text not null default 'open' check(status in ('open','resolved')), assigned_member_id uuid,
 opened_by uuid not null references auth.users(id), opened_at timestamptz not null default now(), resolved_by uuid references auth.users(id), resolved_at timestamptz,
 resolution_note text not null default '' check(length(resolution_note)<=2000), notes text not null default '' check(length(notes)<=2000), revision integer not null default 1,
 foreign key(campaign_id,area_id) references public.outreach_event_areas(campaign_id,id),
 foreign key(campaign_id,assigned_member_id) references public.outreach_team_members(campaign_id,id), unique(campaign_id,id),
 check((status='resolved' and resolved_at is not null and resolved_by is not null) or (status='open' and resolved_at is null and resolved_by is null))
);

create index outreach_event_issues_open_idx on public.outreach_event_issues(campaign_id,status,severity,opened_at);

create table public.outreach_event_timeline (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id), template_item_id uuid,
 item_key text not null check(item_key~'^[a-z0-9_-]{1,80}$'), title text not null check(length(btrim(title)) between 1 and 160),
 display_order integer not null check(display_order between 1 and 10000), scheduled_at timestamptz, actual_start timestamptz, actual_finish timestamptz,
 owner_member_id uuid, status text not null default 'upcoming' check(status in ('upcoming','current','delayed','complete','skipped')),
 notes text not null default '' check(length(notes)<=2000), issue_flag boolean not null default false, revision integer not null default 1,
 foreign key(campaign_id,owner_member_id) references public.outreach_team_members(campaign_id,id), unique(campaign_id,item_key), unique(campaign_id,id),
 check(actual_finish is null or actual_start is not null), check(actual_finish is null or actual_finish>=actual_start)
);

create index outreach_event_timeline_order_idx on public.outreach_event_timeline(campaign_id,display_order);

create table public.outreach_event_media_refs (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, area_id uuid, kind text not null check(kind in ('photo','video','testimony','document')),
 label text not null check(length(btrim(label)) between 1 and 160), reference_url text check(reference_url is null or (length(reference_url)<=2000 and reference_url~'^https://[^/@[:space:]]+(/[^[:cntrl:][:space:]]*)?$')),
 storage_reference text check(storage_reference is null or (length(storage_reference)<=500 and storage_reference~'^[a-zA-Z0-9/_+.-]+$')),
 notes text not null default '' check(length(notes)<=1000), created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 foreign key(campaign_id,area_id) references public.outreach_event_areas(campaign_id,id), unique(campaign_id,id),
 check(reference_url is not null or storage_reference is not null)
);

create table public.outreach_event_ops_history (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id), area_id uuid,
 actor_user_id uuid references auth.users(id), kind text not null check(length(btrim(kind)) between 1 and 100), subject_id uuid,
 snapshot jsonb not null default '{}' check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=10000), created_at timestamptz not null default now(),
 foreign key(campaign_id,area_id) references public.outreach_event_areas(campaign_id,id)
);

create index outreach_event_ops_history_idx on public.outreach_event_ops_history(campaign_id,created_at,id);

create function private.outreach_ops_template_guard() returns trigger language plpgsql set search_path='' as $$
declare s text;begin
 if tg_table_name='outreach_ops_templates' then s:=old.status;else select status into s from public.outreach_ops_templates where id=old.template_id;end if;
 if s='published' then raise exception 'Published event template is immutable' using errcode='42501';end if;return case when tg_op='DELETE' then old else new end;
end $$;

create trigger outreach_ops_template_immutable before update or delete on public.outreach_ops_templates for each row execute function private.outreach_ops_template_guard();

create trigger outreach_ops_template_area_immutable before update or delete on public.outreach_ops_template_areas for each row execute function private.outreach_ops_template_guard();

create trigger outreach_ops_template_checklist_immutable before update or delete on public.outreach_ops_template_checklists for each row execute function private.outreach_ops_template_guard();

create trigger outreach_ops_template_inventory_immutable before update or delete on public.outreach_ops_template_inventory for each row execute function private.outreach_ops_template_guard();

create trigger outreach_ops_template_timeline_immutable before update or delete on public.outreach_ops_template_timeline for each row execute function private.outreach_ops_template_guard();

create trigger outreach_event_ops_history_immutable before update or delete on public.outreach_event_ops_history for each row execute function private.outreach_immutable();

create function private.outreach_ops_can(c uuid,cap text) returns boolean language sql stable security definer set search_path='' as $$
 select cap in ('ops.view','ops.manage','inventory.view','inventory.manage','issue.manage') and private.outreach_verified(auth.uid()) and exists(
  select 1 from public.outreach_campaigns x where x.id=c and (
   private.outreach_admin(x.organization_id,cap not in ('ops.view','inventory.view')) or exists(
    select 1 from public.outreach_campaign_assignments a where a.campaign_id=c and a.user_id=auth.uid() and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and 'view'=any(a.capabilities) and cap=any(a.capabilities))))
$$;

create function private.outreach_ops_record(c uuid,a uuid,k text,s uuid,j jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
declare org uuid;begin select organization_id into org from public.outreach_campaigns where id=c;
 insert into public.outreach_event_ops_history(campaign_id,area_id,actor_user_id,kind,subject_id,snapshot) values(c,a,auth.uid(),k,s,j);
 perform private.outreach_audit(c,org,'ops.'||k,s,j);end $$;

create function private.outreach_ops_transition_ok(o text,n text) returns boolean language sql immutable set search_path='' as $$
 select o=n or (o,n) in (('not_started','setup_in_progress'),('not_started','issue'),('not_started','paused'),('setup_in_progress','ready'),('setup_in_progress','issue'),('setup_in_progress','paused'),('ready','active'),('ready','setup_in_progress'),('ready','issue'),('ready','paused'),('active','issue'),('active','paused'),('active','closed'),('issue','setup_in_progress'),('issue','ready'),('issue','active'),('issue','paused'),('issue','closed'),('paused','setup_in_progress'),('paused','ready'),('paused','active'),('paused','issue'),('paused','closed'),('closed','cleanup_in_progress'),('closed','issue'),('cleanup_in_progress','complete'),('cleanup_in_progress','issue'),('complete','cleanup_in_progress'))
$$;

create function private.outreach_ops_summary(c uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'overall_readiness',coalesce((select round(avg(case when total_required=0 then case when status in ('ready','active','closed','cleanup_in_progress','complete') then 100 else 0 end else completed_required*100.0/total_required end))::int from (select a.id,a.status,count(i.id) filter(where i.required) total_required,count(i.id) filter(where i.required and i.completed) completed_required from public.outreach_event_areas a left join public.outreach_event_checklist_items i on i.area_id=a.id where a.campaign_id=c and a.active and a.required_for_ready group by a.id) q),0),
  'areas_total',(select count(*) from public.outreach_event_areas where campaign_id=c and active),
  'areas_ready',(select count(*) from public.outreach_event_areas where campaign_id=c and active and status in ('ready','active','closed','cleanup_in_progress','complete')),
  'areas_with_issues',(select count(*) from public.outreach_event_areas where campaign_id=c and active and issue_flag),
  'checklist_total',(select count(*) from public.outreach_event_checklist_items where campaign_id=c),
  'checklist_complete',(select count(*) from public.outreach_event_checklist_items where campaign_id=c and completed),
  'volunteers_assigned',(select count(*) from public.outreach_event_area_members where campaign_id=c and active),
  'missing_leads',(select count(*) from public.outreach_event_areas a where a.campaign_id=c and a.active and not exists(select 1 from public.outreach_event_area_members m where m.area_id=a.id and m.active and m.role='lead')),
  'inventory_issues',(select count(*) from public.outreach_event_inventory where campaign_id=c and (status in ('missing','damaged') or available_quantity<required_quantity)),
  'open_alerts',(select count(*) from public.outreach_event_issues where campaign_id=c and status='open'),
  'current_stage',(select title from public.outreach_event_timeline where campaign_id=c and status in ('current','delayed') order by display_order limit 1),
  'registration_count',(select count(*) from public.outreach_event_registrations where campaign_id=c and status<>'cancelled'),
  'checkin_count',(select count(*) from public.outreach_event_attendees where campaign_id=c and checked_in_at is not null),
  'prize_ready',coalesce((select digital_enabled and drawing_enabled from public.outreach_prize_settings where campaign_id=c),false),
  'prize_pools',(select count(*) from public.outreach_prize_pools where campaign_id=c and active)
 )
$$;

create function private.outreach_ops_context(c uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'campaign',jsonb_build_object('id',x.id,'name',x.name,'code',x.code,'city',x.city,'country',x.country,'event_start',x.event_start,'timezone',x.timezone),
  'organization',jsonb_build_object('name',o.name,'slug',o.slug,'logo_asset',case o.slug when 'champion-life' then 'assets/images/logo-gold.png' when 'sowgo' then 'assets/images/sowgo-logo-light.png' else null end),
  'operation',to_jsonb(op),'summary',private.outreach_ops_summary(c),
  'capabilities',(select coalesce(jsonb_agg(k),'[]') from unnest(array['ops.view','ops.manage','inventory.view','inventory.manage','issue.manage']) k where private.outreach_ops_can(c,k)),
  'areas',(select coalesce(jsonb_agg(q.v order by q.display_order,q.title),'[]') from (select a.display_order,a.title,jsonb_build_object('id',a.id,'area_key',a.area_key,'instance_key',a.instance_key,'title',a.title,'description',a.description,'category',a.category,'display_order',a.display_order,'required_for_ready',a.required_for_ready,'status',a.status,'location',a.location,'notes',a.notes,'issue_flag',a.issue_flag,'revision',a.revision,'readiness',case when count(i.id) filter(where i.required)=0 then case when a.status in ('ready','active','closed','cleanup_in_progress','complete') then 100 else 0 end else round((count(i.id) filter(where i.required and i.completed))*100.0/(count(i.id) filter(where i.required)))::int end,'required_missing',count(i.id) filter(where i.required and not i.completed),'issues',(select count(*) from public.outreach_event_issues z where z.area_id=a.id and z.status='open'),'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'member_id',m.member_id,'name',tm.first_name||' '||tm.last_name,'role',m.role,'arrival_status',m.arrival_status,'notes',m.notes) order by case m.role when 'lead' then 1 when 'backup_lead' then 2 else 3 end,tm.first_name),'[]') from public.outreach_event_area_members m join public.outreach_team_members tm on tm.id=m.member_id where m.area_id=a.id and m.active)) v from public.outreach_event_areas a left join public.outreach_event_checklist_items i on i.area_id=a.id where a.campaign_id=c and a.active group by a.id) q),
  'checklists',(select coalesce(jsonb_agg(to_jsonb(i) order by a.display_order,i.display_order),'[]') from public.outreach_event_checklist_items i join public.outreach_event_areas a on a.id=i.area_id where i.campaign_id=c),
  'inventory',case when private.outreach_ops_can(c,'inventory.view') then (select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('area_title',a.title,'vehicle_label',v.label) order by i.category,i.item_name),'[]') from public.outreach_event_inventory i left join public.outreach_event_areas a on a.id=i.area_id left join public.outreach_team_vehicles v on v.id=i.vehicle_id where i.campaign_id=c) else '[]'::jsonb end,
  'issues',(select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('area_title',a.title,'assigned_name',m.first_name||' '||m.last_name) order by case i.status when 'open' then 0 else 1 end,case i.severity when 'urgent' then 0 when 'needs_attention' then 1 else 2 end,i.opened_at desc),'[]') from public.outreach_event_issues i left join public.outreach_event_areas a on a.id=i.area_id left join public.outreach_team_members m on m.id=i.assigned_member_id where i.campaign_id=c),
  'timeline',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('owner_name',m.first_name||' '||m.last_name) order by t.display_order),'[]') from public.outreach_event_timeline t left join public.outreach_team_members m on m.id=t.owner_member_id where t.campaign_id=c),
  'media',(select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc),'[]') from public.outreach_event_media_refs m where m.campaign_id=c),
  'team_members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.first_name||' '||m.last_name,'status',m.status) order by m.first_name,m.last_name),'[]') from public.outreach_team_members m where m.campaign_id=c and m.attending and m.volunteering and m.status in ('approved','self_traveling','guest')),
  'vehicles',case when private.outreach_ops_can(c,'inventory.view') then (select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'label',v.label,'vehicle_type',v.vehicle_type) order by v.label),'[]') from public.outreach_team_vehicles v where v.campaign_id=c and v.active) else '[]'::jsonb end,
  'templates',case when private.outreach_ops_can(c,'ops.manage') then (select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'version',t.version,'description',t.description) order by t.name,t.version desc),'[]') from public.outreach_ops_templates t where t.status='published' and (t.owner_organization_id is null or t.owner_organization_id=x.organization_id)) else '[]'::jsonb end
 ) from public.outreach_campaigns x join public.organizations o on o.id=x.organization_id left join public.outreach_event_operations op on op.campaign_id=x.id where x.id=c
$$;

create function private.outreach_ops_workspace(action text,c uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare x public.outreach_campaigns;op public.outreach_event_operations;area_row public.outreach_event_areas;check_row public.outreach_event_checklist_items;inv public.outreach_event_inventory;issue_row public.outreach_event_issues;timeline_row public.outreach_event_timeline;tmpl public.outreach_ops_templates;cap text;result_id uuid;csv text;begin
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>50000 then raise exception 'Invalid request';end if;
 cap:=case when action in ('context','campaigns','area') then 'ops.view' when action in ('inventory_save','inventory_count') then 'inventory.manage' when action='export' then 'ops.manage' when action in ('issue_save','issue_resolve') then 'issue.manage' else 'ops.manage' end;
 if action='campaigns' then return coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'name',q.name,'city',q.city,'event_start',q.event_start)) from public.outreach_campaigns q where private.outreach_ops_can(q.id,'ops.view')),'[]');end if;
 if not private.outreach_ops_can(c,cap) then raise exception 'Event day access denied' using errcode='42501';end if;
 select * into x from public.outreach_campaigns where id=c;if not found then raise exception 'Campaign unavailable' using errcode='42501';end if;
 if action='context' then return private.outreach_ops_context(c);end if;
 perform pg_advisory_xact_lock(hashtextextended(c::text,20261007));
 if not private.outreach_ops_can(c,cap) then raise exception 'Event day access denied' using errcode='42501';end if;
 if action='template_clone' then
  select * into tmpl from public.outreach_ops_templates where id=(p->>'template_id')::uuid and status='published' and (owner_organization_id is null or owner_organization_id=x.organization_id);if not found then raise exception 'Published template unavailable' using errcode='42501';end if;
  insert into public.outreach_ops_templates(owner_organization_id,name,version,status,description,created_by) values(x.organization_id,coalesce(nullif(p->>'name',''),tmpl.name),coalesce((select max(version)+1 from public.outreach_ops_templates where owner_organization_id=x.organization_id and name=coalesce(nullif(p->>'name',''),tmpl.name)),1),'draft',tmpl.description,auth.uid()) returning outreach_ops_templates.id into result_id;
  insert into public.outreach_ops_template_areas(template_id,area_key,title,description,category,display_order,required_for_ready,repeatable,active) select result_id,area_key,title,description,category,display_order,required_for_ready,repeatable,active from public.outreach_ops_template_areas where template_id=tmpl.id;
  insert into public.outreach_ops_template_checklists(template_id,area_key,item_key,text,display_order,required,quantity_kind,dependency_key,attachment_hook) select result_id,area_key,item_key,text,display_order,required,quantity_kind,dependency_key,attachment_hook from public.outreach_ops_template_checklists where template_id=tmpl.id;
  insert into public.outreach_ops_template_inventory(template_id,area_key,item_key,item_name,category,required_quantity,critical,return_required,source_owner) select result_id,area_key,item_key,item_name,category,required_quantity,critical,return_required,source_owner from public.outreach_ops_template_inventory where template_id=tmpl.id;
  insert into public.outreach_ops_template_timeline(template_id,item_key,title,display_order,relative_minutes,required,notes) select result_id,item_key,title,display_order,relative_minutes,required,notes from public.outreach_ops_template_timeline where template_id=tmpl.id;
  perform private.outreach_ops_record(c,null,'template_cloned',result_id,jsonb_build_object('source',tmpl.id));return jsonb_build_object('id',result_id);
 elsif action='template_area_save' then
  select * into tmpl from public.outreach_ops_templates where id=(p->>'template_id')::uuid and owner_organization_id=x.organization_id and status='draft';if not found then raise exception 'Editable template unavailable' using errcode='42501';end if;
  insert into public.outreach_ops_template_areas(template_id,area_key,title,description,category,display_order,required_for_ready,repeatable,active) values(tmpl.id,p->>'area_key',p->>'title',coalesce(p->>'description',''),p->>'category',(p->>'display_order')::int,coalesce((p->>'required_for_ready')::boolean,false),coalesce((p->>'repeatable')::boolean,false),coalesce((p->>'active')::boolean,true)) on conflict(template_id,area_key) do update set title=excluded.title,description=excluded.description,category=excluded.category,display_order=excluded.display_order,required_for_ready=excluded.required_for_ready,repeatable=excluded.repeatable,active=excluded.active returning id into result_id;return jsonb_build_object('id',result_id);
 elsif action='template_checklist_save' then
  select * into tmpl from public.outreach_ops_templates where id=(p->>'template_id')::uuid and owner_organization_id=x.organization_id and status='draft';if not found then raise exception 'Editable template unavailable' using errcode='42501';end if;
  insert into public.outreach_ops_template_checklists(template_id,area_key,item_key,text,display_order,required,quantity_kind,dependency_key,attachment_hook) values(tmpl.id,p->>'area_key',p->>'item_key',p->>'text',(p->>'display_order')::int,coalesce((p->>'required')::boolean,true),coalesce(p->>'quantity_kind','none'),p->>'dependency_key',coalesce((p->>'attachment_hook')::boolean,false)) on conflict(template_id,area_key,item_key) do update set text=excluded.text,display_order=excluded.display_order,required=excluded.required,quantity_kind=excluded.quantity_kind,dependency_key=excluded.dependency_key,attachment_hook=excluded.attachment_hook returning id into result_id;return jsonb_build_object('id',result_id);
 elsif action='template_inventory_save' then
  select * into tmpl from public.outreach_ops_templates where id=(p->>'template_id')::uuid and owner_organization_id=x.organization_id and status='draft';if not found then raise exception 'Editable template unavailable' using errcode='42501';end if;
  insert into public.outreach_ops_template_inventory(template_id,area_key,item_key,item_name,category,required_quantity,critical,return_required,source_owner) values(tmpl.id,p->>'area_key',p->>'item_key',p->>'item_name',p->>'category',coalesce((p->>'required_quantity')::int,0),coalesce((p->>'critical')::boolean,false),coalesce((p->>'return_required')::boolean,true),coalesce(p->>'source_owner','')) on conflict(template_id,area_key,item_key) do update set item_name=excluded.item_name,category=excluded.category,required_quantity=excluded.required_quantity,critical=excluded.critical,return_required=excluded.return_required,source_owner=excluded.source_owner returning id into result_id;return jsonb_build_object('id',result_id);
 elsif action='template_timeline_save' then
  select * into tmpl from public.outreach_ops_templates where id=(p->>'template_id')::uuid and owner_organization_id=x.organization_id and status='draft';if not found then raise exception 'Editable template unavailable' using errcode='42501';end if;
  insert into public.outreach_ops_template_timeline(template_id,item_key,title,display_order,relative_minutes,required,notes) values(tmpl.id,p->>'item_key',p->>'title',(p->>'display_order')::int,(p->>'relative_minutes')::int,coalesce((p->>'required')::boolean,false),coalesce(p->>'notes','')) on conflict(template_id,item_key) do update set title=excluded.title,display_order=excluded.display_order,relative_minutes=excluded.relative_minutes,required=excluded.required,notes=excluded.notes returning id into result_id;return jsonb_build_object('id',result_id);
 elsif action='template_publish' then
  select * into tmpl from public.outreach_ops_templates where id=(p->>'template_id')::uuid and owner_organization_id=x.organization_id and status='draft' for update;if not found or not exists(select 1 from public.outreach_ops_template_areas where template_id=tmpl.id and active) then raise exception 'Publishable template unavailable';end if;
  update public.outreach_ops_templates set status='published',published_at=clock_timestamp() where id=tmpl.id;perform private.outreach_ops_record(c,null,'template_published',tmpl.id,jsonb_build_object('version',tmpl.version));return jsonb_build_object('id',tmpl.id,'published',true);
 elsif action='instantiate' then
  if exists(select 1 from public.outreach_event_operations where campaign_id=c) then raise exception 'Event operations already instantiated';end if;
  select * into tmpl from public.outreach_ops_templates where id=(p->>'template_id')::uuid and status='published' and (owner_organization_id is null or owner_organization_id=x.organization_id);if not found then raise exception 'Published template unavailable' using errcode='42501';end if;
  insert into public.outreach_event_operations(campaign_id,template_id,template_version,updated_by) values(c,tmpl.id,tmpl.version,auth.uid());
  insert into public.outreach_event_areas(campaign_id,template_area_id,area_key,instance_key,title,description,category,display_order,required_for_ready)
   select c,a.id,a.area_key,a.area_key,a.title,a.description,a.category,a.display_order,a.required_for_ready from public.outreach_ops_template_areas a where a.template_id=tmpl.id and a.active;
  insert into public.outreach_event_checklist_items(campaign_id,area_id,template_item_id,item_key,text,display_order,required,quantity_kind,dependency_key,attachment_hook)
   select c,a.id,i.id,i.item_key,i.text,i.display_order,i.required,i.quantity_kind,i.dependency_key,i.attachment_hook from public.outreach_ops_template_checklists i join public.outreach_event_areas a on a.campaign_id=c and a.area_key=i.area_key where i.template_id=tmpl.id;
  insert into public.outreach_event_inventory(campaign_id,area_id,template_item_id,item_key,item_name,category,required_quantity,critical,return_required,source_owner)
   select c,a.id,i.id,a.instance_key||'-'||i.item_key,i.item_name,i.category,i.required_quantity,i.critical,i.return_required,i.source_owner from public.outreach_ops_template_inventory i join public.outreach_event_areas a on a.campaign_id=c and a.area_key=i.area_key where i.template_id=tmpl.id;
  insert into public.outreach_event_timeline(campaign_id,template_item_id,item_key,title,display_order,scheduled_at,notes)
   select c,i.id,i.item_key,i.title,i.display_order,case when x.event_start is null or i.relative_minutes is null then null else x.event_start+(i.relative_minutes||' minutes')::interval end,i.notes from public.outreach_ops_template_timeline i where i.template_id=tmpl.id;
  perform private.outreach_ops_record(c,null,'template_instantiated',c,jsonb_build_object('template_id',tmpl.id,'version',tmpl.version));return private.outreach_ops_context(c);
 elsif action='area_add' then
  if not (p->>'instance_key')~'^[a-z0-9_-]{1,80}$' then raise exception 'Invalid area key';end if;
  insert into public.outreach_event_areas(campaign_id,area_key,instance_key,title,description,category,display_order,required_for_ready,location,notes) values(c,coalesce(p->>'area_key',p->>'instance_key'),p->>'instance_key',p->>'title',coalesce(p->>'description',''),p->>'category',coalesce((p->>'display_order')::int,1000),coalesce((p->>'required_for_ready')::boolean,false),coalesce(p->>'location',''),coalesce(p->>'notes','')) returning * into area_row;
  perform private.outreach_ops_record(c,area_row.id,'area_created',area_row.id,to_jsonb(area_row));return to_jsonb(area_row);
 elsif action='area_status' then
  select * into area_row from public.outreach_event_areas where campaign_id=c and id=(p->>'area_id')::uuid for update;if not found then raise exception 'Area outside campaign' using errcode='42501';end if;
  if area_row.revision<>(p->>'revision')::int then raise exception 'Area changed';end if;if not private.outreach_ops_transition_ok(area_row.status,p->>'status') then raise exception 'Invalid area status transition';end if;
  update public.outreach_event_areas set status=p->>'status',location=coalesce(p->>'location',location),notes=coalesce(p->>'notes',notes),revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid(),setup_started_at=case when p->>'status'='setup_in_progress' then coalesce(setup_started_at,clock_timestamp()) else setup_started_at end,ready_at=case when p->>'status'='ready' then coalesce(ready_at,clock_timestamp()) else ready_at end,active_at=case when p->>'status'='active' then coalesce(active_at,clock_timestamp()) else active_at end,closed_at=case when p->>'status'='closed' then coalesce(closed_at,clock_timestamp()) else closed_at end,completed_at=case when p->>'status'='complete' then clock_timestamp() else completed_at end where id=area_row.id returning * into area_row;
  perform private.outreach_ops_record(c,area_row.id,'area_status_changed',area_row.id,jsonb_build_object('to',area_row.status,'revision',area_row.revision));return to_jsonb(area_row);
 elsif action='area_member_set' then
  if not exists(select 1 from public.outreach_event_areas where campaign_id=c and id=(p->>'area_id')::uuid) or not exists(select 1 from public.outreach_team_members where campaign_id=c and id=(p->>'member_id')::uuid and attending and volunteering and status in ('approved','self_traveling','guest')) then raise exception 'Area or volunteer outside campaign' using errcode='42501';end if;
  update public.outreach_event_area_members set active=false,released_at=clock_timestamp() where campaign_id=c and member_id=(p->>'member_id')::uuid and active;
  insert into public.outreach_event_area_members(campaign_id,area_id,member_id,role,arrival_status,notes,assigned_by) values(c,(p->>'area_id')::uuid,(p->>'member_id')::uuid,p->>'role',coalesce(p->>'arrival_status','assigned'),coalesce(p->>'notes',''),auth.uid()) returning id into result_id;
  perform private.outreach_ops_record(c,(p->>'area_id')::uuid,'volunteer_assigned',result_id,p);return jsonb_build_object('id',result_id);
 elsif action='area_member_status' then
  update public.outreach_event_area_members set arrival_status=p->>'arrival_status',notes=coalesce(p->>'notes',notes) where campaign_id=c and id=(p->>'id')::uuid and active returning area_id into result_id;if not found then raise exception 'Assignment outside campaign' using errcode='42501';end if;
  perform private.outreach_ops_record(c,result_id,'volunteer_arrival_changed',(p->>'id')::uuid,p);return jsonb_build_object('saved',true);
 elsif action in ('checklist_complete','checklist_reopen') then
  select * into check_row from public.outreach_event_checklist_items where campaign_id=c and id=(p->>'item_id')::uuid for update;if not found then raise exception 'Checklist outside campaign' using errcode='42501';end if;
  if check_row.revision<>(p->>'revision')::int then if action='checklist_complete' and check_row.completed then return to_jsonb(check_row);else raise exception 'Checklist item changed';end if;end if;
  if action='checklist_complete' and check_row.dependency_key is not null and not exists(select 1 from public.outreach_event_checklist_items d where d.area_id=check_row.area_id and d.item_key=check_row.dependency_key and d.completed) then raise exception 'Checklist dependency incomplete';end if;
  update public.outreach_event_checklist_items set completed=action='checklist_complete',completed_by=case when action='checklist_complete' then auth.uid() else null end,completed_at=case when action='checklist_complete' then clock_timestamp() else null end,completion_note=coalesce(p->>'note',''),quantity_value=coalesce(p->>'quantity',''),issue_flag=coalesce((p->>'issue_flag')::boolean,false),revision=revision+1,updated_at=clock_timestamp() where id=check_row.id returning * into check_row;
  perform private.outreach_ops_record(c,check_row.area_id,case when action='checklist_complete' then 'checklist_completed' else 'checklist_reopened' end,check_row.id,jsonb_build_object('text',check_row.text,'quantity',check_row.quantity_value,'issue',check_row.issue_flag));return to_jsonb(check_row);
 elsif action='inventory_save' then
  if p->>'id' is null then
   if p->>'area_id' is not null and not exists(select 1 from public.outreach_event_areas where campaign_id=c and id=(p->>'area_id')::uuid) then raise exception 'Area outside campaign' using errcode='42501';end if;
   if p->>'vehicle_id' is not null and not exists(select 1 from public.outreach_team_vehicles where campaign_id=c and id=(p->>'vehicle_id')::uuid and active) then raise exception 'Vehicle outside campaign' using errcode='42501';end if;
   insert into public.outreach_event_inventory(campaign_id,area_id,item_key,item_name,category,required_quantity,available_quantity,direct_delivery,critical,return_required,source_owner,vehicle_id,status,notes,updated_by) values(c,(p->>'area_id')::uuid,p->>'item_key',p->>'item_name',p->>'category',coalesce((p->>'required_quantity')::int,0),coalesce((p->>'available_quantity')::int,0),coalesce((p->>'direct_delivery')::boolean,false),coalesce((p->>'critical')::boolean,false),coalesce((p->>'return_required')::boolean,true),coalesce(p->>'source_owner',''),(p->>'vehicle_id')::uuid,coalesce(p->>'status','needed'),coalesce(p->>'notes',''),auth.uid()) returning * into inv;
  else
   select * into inv from public.outreach_event_inventory where campaign_id=c and id=(p->>'id')::uuid for update;if not found then raise exception 'Inventory outside campaign' using errcode='42501';end if;if inv.revision<>(p->>'revision')::int then raise exception 'Inventory changed';end if;
   if p->>'vehicle_id' is not null and not exists(select 1 from public.outreach_team_vehicles where campaign_id=c and id=(p->>'vehicle_id')::uuid and active) then raise exception 'Vehicle outside campaign' using errcode='42501';end if;
   update public.outreach_event_inventory set area_id=coalesce((p->>'area_id')::uuid,area_id),required_quantity=coalesce((p->>'required_quantity')::int,required_quantity),available_quantity=coalesce((p->>'available_quantity')::int,available_quantity),loaded_quantity=coalesce((p->>'loaded_quantity')::int,loaded_quantity),on_site_quantity=coalesce((p->>'on_site_quantity')::int,on_site_quantity),returned_quantity=coalesce((p->>'returned_quantity')::int,returned_quantity),missing_quantity=coalesce((p->>'missing_quantity')::int,missing_quantity),damaged_quantity=coalesce((p->>'damaged_quantity')::int,damaged_quantity),direct_delivery=coalesce((p->>'direct_delivery')::boolean,direct_delivery),critical=coalesce((p->>'critical')::boolean,critical),return_required=coalesce((p->>'return_required')::boolean,return_required),source_owner=coalesce(p->>'source_owner',source_owner),vehicle_id=case when p?'vehicle_id' then (p->>'vehicle_id')::uuid else vehicle_id end,status=coalesce(p->>'status',status),notes=coalesce(p->>'notes',notes),verified_by=auth.uid(),verified_at=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid() where id=inv.id returning * into inv;
  end if;
  perform private.outreach_ops_record(c,inv.area_id,'inventory_changed',inv.id,to_jsonb(inv)-'notes');return to_jsonb(inv);
 elsif action='issue_save' then
  if p->>'area_id' is not null and not exists(select 1 from public.outreach_event_areas where campaign_id=c and id=(p->>'area_id')::uuid) then raise exception 'Area outside campaign' using errcode='42501';end if;
  if p->>'assigned_member_id' is not null and not exists(select 1 from public.outreach_team_members where campaign_id=c and id=(p->>'assigned_member_id')::uuid) then raise exception 'Assignee outside campaign' using errcode='42501';end if;
  insert into public.outreach_event_issues(campaign_id,area_id,severity,issue,assigned_member_id,opened_by,notes) values(c,(p->>'area_id')::uuid,p->>'severity',p->>'issue',(p->>'assigned_member_id')::uuid,auth.uid(),coalesce(p->>'notes','')) returning * into issue_row;
  if issue_row.area_id is not null then update public.outreach_event_areas set issue_flag=true,revision=revision+1,updated_at=clock_timestamp() where id=issue_row.area_id;end if;
  perform private.outreach_ops_record(c,issue_row.area_id,'issue_opened',issue_row.id,jsonb_build_object('severity',issue_row.severity,'issue',issue_row.issue));perform private.outreach_event(c,'outreach.ops.issue_opened',issue_row.id,'ops-issue:'||issue_row.id);return to_jsonb(issue_row);
 elsif action='issue_resolve' then
  select * into issue_row from public.outreach_event_issues where campaign_id=c and id=(p->>'issue_id')::uuid for update;if not found then raise exception 'Issue outside campaign' using errcode='42501';end if;if issue_row.status='resolved' then return to_jsonb(issue_row);end if;if issue_row.revision<>(p->>'revision')::int then raise exception 'Issue changed';end if;
  update public.outreach_event_issues set status='resolved',resolved_by=auth.uid(),resolved_at=clock_timestamp(),resolution_note=p->>'resolution_note',revision=revision+1 where id=issue_row.id returning * into issue_row;
  if issue_row.area_id is not null and not exists(select 1 from public.outreach_event_issues where area_id=issue_row.area_id and status='open') then update public.outreach_event_areas set issue_flag=false,revision=revision+1,updated_at=clock_timestamp() where id=issue_row.area_id;end if;
  perform private.outreach_ops_record(c,issue_row.area_id,'issue_resolved',issue_row.id,jsonb_build_object('resolution',issue_row.resolution_note));perform private.outreach_event(c,'outreach.ops.issue_resolved',issue_row.id,'ops-issue-resolved:'||issue_row.id);return to_jsonb(issue_row);
 elsif action='timeline_save' then
  select * into timeline_row from public.outreach_event_timeline where campaign_id=c and id=(p->>'id')::uuid for update;if not found then raise exception 'Timeline item outside campaign' using errcode='42501';end if;if timeline_row.revision<>(p->>'revision')::int then raise exception 'Timeline changed';end if;
  if p->>'owner_member_id' is not null and not exists(select 1 from public.outreach_team_members where campaign_id=c and id=(p->>'owner_member_id')::uuid) then raise exception 'Owner outside campaign' using errcode='42501';end if;
  update public.outreach_event_timeline set status=coalesce(p->>'status',status),scheduled_at=coalesce((p->>'scheduled_at')::timestamptz,scheduled_at),actual_start=case when p->>'status'='current' then coalesce(actual_start,clock_timestamp()) else actual_start end,actual_finish=case when p->>'status'='complete' then clock_timestamp() else actual_finish end,owner_member_id=case when p?'owner_member_id' then (p->>'owner_member_id')::uuid else owner_member_id end,notes=coalesce(p->>'notes',notes),issue_flag=coalesce((p->>'issue_flag')::boolean,issue_flag),revision=revision+1 where id=timeline_row.id returning * into timeline_row;
  perform private.outreach_ops_record(c,null,'timeline_changed',timeline_row.id,jsonb_build_object('title',timeline_row.title,'status',timeline_row.status));return to_jsonb(timeline_row);
 elsif action='media_add' then
  insert into public.outreach_event_media_refs(campaign_id,area_id,kind,label,reference_url,storage_reference,notes,created_by) values(c,(p->>'area_id')::uuid,p->>'kind',p->>'label',p->>'reference_url',p->>'storage_reference',coalesce(p->>'notes',''),auth.uid()) returning id into result_id;
  perform private.outreach_ops_record(c,(p->>'area_id')::uuid,'media_reference_added',result_id,jsonb_build_object('kind',p->>'kind','label',p->>'label'));return jsonb_build_object('id',result_id);
 elsif action='start' then
  update public.outreach_event_operations set status=case when status='planning' then 'setup' else 'active' end,started_at=coalesce(started_at,clock_timestamp()),revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid() where campaign_id=c returning * into op;if not found then raise exception 'Instantiate event operations first';end if;
  perform private.outreach_ops_record(c,null,'event_started',c,to_jsonb(op));return to_jsonb(op);
 elsif action='closeout' then
  select * into op from public.outreach_event_operations where campaign_id=c for update;if not found then raise exception 'Event operations unavailable';end if;
  if exists(select 1 from public.outreach_event_areas where campaign_id=c and active and required_for_ready and status<>'complete') then raise exception 'Required areas must be complete';end if;
  if exists(select 1 from public.outreach_event_checklist_items i join public.outreach_event_areas a on a.id=i.area_id where i.campaign_id=c and a.active and i.required and not i.completed) then raise exception 'Required checklist items remain';end if;
  if exists(select 1 from public.outreach_event_issues where campaign_id=c and status='open' and severity='urgent') then raise exception 'Urgent issues remain open';end if;
  if exists(select 1 from public.outreach_event_inventory where campaign_id=c and critical and (status in ('missing','damaged') or (return_required and returned_quantity<>on_site_quantity))) then raise exception 'Critical inventory is not accounted for';end if;
  update public.outreach_event_operations set status='event_complete',completed_at=clock_timestamp(),completion_note=p->>'note',revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid() where campaign_id=c returning * into op;
  perform private.outreach_ops_record(c,null,'event_completed',c,jsonb_build_object('note',op.completion_note));perform private.outreach_event(c,'outreach.ops.event_completed',c,'ops-event-completed:'||c);return to_jsonb(op);
 elsif action='export' then
  csv:='Section,Area,Item,Owner or Vehicle,Status,Required,Available,Loaded,On Site,Returned,Notes'||chr(13)||chr(10);
  select csv||coalesce(string_agg(line,chr(13)||chr(10)),'') into csv from (
   select 'Timeline,'||private.outreach_csv_cell('')||','||private.outreach_csv_cell(title)||','||private.outreach_csv_cell(coalesce((select first_name||' '||last_name from public.outreach_team_members where id=owner_member_id),''))||','||private.outreach_csv_cell(status)||',,,,,'||private.outreach_csv_cell(notes) line,display_order o from public.outreach_event_timeline where campaign_id=c
   union all select 'Area,'||private.outreach_csv_cell(title)||','||private.outreach_csv_cell('Readiness')||','||private.outreach_csv_cell(coalesce((select tm.first_name||' '||tm.last_name from public.outreach_event_area_members m join public.outreach_team_members tm on tm.id=m.member_id where m.area_id=a.id and m.active and m.role='lead'),''))||','||private.outreach_csv_cell(status)||',,,,,,'||private.outreach_csv_cell(notes),10000+display_order from public.outreach_event_areas a where campaign_id=c and active
   union all select 'Volunteer,'||private.outreach_csv_cell(a.title)||','||private.outreach_csv_cell(replace(m.role,'_',' '))||','||private.outreach_csv_cell(tm.first_name||' '||tm.last_name)||','||private.outreach_csv_cell(m.arrival_status)||',,,,,,'||private.outreach_csv_cell(case when tm.phone is null then m.notes else 'Phone: '||tm.phone||case when m.notes='' then '' else ' · '||m.notes end end),15000+a.display_order*1000 from public.outreach_event_area_members m join public.outreach_event_areas a on a.id=m.area_id join public.outreach_team_members tm on tm.id=m.member_id where m.campaign_id=c and m.active
   union all select 'Emergency Contact,'||private.outreach_csv_cell(a.title)||','||private.outreach_csv_cell(replace(m.role,'_',' '))||','||private.outreach_csv_cell(tm.first_name||' '||tm.last_name)||','||private.outreach_csv_cell(m.arrival_status)||',,,,,,'||private.outreach_csv_cell(coalesce('Phone: '||tm.phone,'Phone unavailable')),18000+a.display_order*1000 from public.outreach_event_area_members m join public.outreach_event_areas a on a.id=m.area_id join public.outreach_team_members tm on tm.id=m.member_id where m.campaign_id=c and m.active and m.role in ('lead','backup_lead')
   union all select 'Checklist,'||private.outreach_csv_cell(a.title)||','||private.outreach_csv_cell(i.text)||','||private.outreach_csv_cell('')||','||private.outreach_csv_cell(case when i.completed then 'complete' else 'open' end)||','||private.outreach_csv_cell(case when i.required then 'yes' else 'no' end)||',,,,,'||private.outreach_csv_cell(i.completion_note),20000+a.display_order*1000+i.display_order from public.outreach_event_checklist_items i join public.outreach_event_areas a on a.id=i.area_id where i.campaign_id=c
   union all select 'Inventory,'||private.outreach_csv_cell(coalesce(a.title,''))||','||private.outreach_csv_cell(i.item_name)||','||private.outreach_csv_cell(coalesce(v.label,i.source_owner))||','||private.outreach_csv_cell(i.status)||','||i.required_quantity||','||i.available_quantity||','||i.loaded_quantity||','||i.on_site_quantity||','||i.returned_quantity||','||private.outreach_csv_cell(i.notes),30000 from public.outreach_event_inventory i left join public.outreach_event_areas a on a.id=i.area_id left join public.outreach_team_vehicles v on v.id=i.vehicle_id where i.campaign_id=c
   union all select 'Issue,'||private.outreach_csv_cell(coalesce(a.title,''))||','||private.outreach_csv_cell(i.issue)||','||private.outreach_csv_cell(coalesce(m.first_name||' '||m.last_name,''))||','||private.outreach_csv_cell(i.status||' / '||i.severity)||',,,,,,'||private.outreach_csv_cell(coalesce(nullif(i.resolution_note,''),i.notes)),40000 from public.outreach_event_issues i left join public.outreach_event_areas a on a.id=i.area_id left join public.outreach_team_members m on m.id=i.assigned_member_id where i.campaign_id=c
  ) z;
  perform private.outreach_ops_record(c,null,'backup_exported',c,jsonb_build_object('format','csv'));return jsonb_build_object('csv',csv,'filename',x.code||'-event-day-backup.csv');
 else raise exception 'Unsupported event day action';end if;
end $$;

create function public.outreach_event_day_workspace(p_action text,p_campaign uuid default null,p_payload jsonb default '{}') returns jsonb language sql security definer set search_path='' as $$select private.outreach_ops_workspace(p_action,p_campaign,p_payload)$$;

-- The source production packet is captured as versioned template data, not schema.
insert into public.outreach_ops_templates(id,name,version,status,description,published_at) values('e0000000-0000-4000-8000-000000000001','SowGo / Champion Life Standard Outreach',1,'published','Reusable event-day template mapped from the approved Outreach Production Packet.',now());

insert into public.outreach_ops_template_areas(template_id,area_key,title,description,category,display_order,required_for_ready,repeatable) values
('e0000000-0000-4000-8000-000000000001','registration','Registration','Guest welcome, waiver, ticket, wristband and check-in readiness.','guest_services',10,true,false),
('e0000000-0000-4000-8000-000000000001','water_food','Water / Food Stations','Configurable water, food and replenishment stations.','hospitality',20,false,true),
('e0000000-0000-4000-8000-000000000001','first_aid','First Aid','Readiness only; no medical record storage.','safety',30,true,false),
('e0000000-0000-4000-8000-000000000001','inflatables','Inflatables','Units, power, safety and entrance/exit staffing.','activities',40,true,true),
('e0000000-0000-4000-8000-000000000001','face_paint','Face Painting','Guest activity setup, timing and cleanup.','activities',50,false,false),
('e0000000-0000-4000-8000-000000000001','games','Games','Campaign-configurable stage games and activities.','program',60,false,true),
('e0000000-0000-4000-8000-000000000001','sound_stage','Sound / Stage','Sound check, power, equipment and stage readiness.','program',70,true,false),
('e0000000-0000-4000-8000-000000000001','altar_care','Altar Care','Bible, follow-up and decision readiness using the existing campaign follow-up system.','ministry',80,true,false),
('e0000000-0000-4000-8000-000000000001','prize_area','Prize Area','Phase D operator, configured prizes and backup readiness.','prizes',90,false,false),
('e0000000-0000-4000-8000-000000000001','bike_area','Bike Area','Restricted zones, categories, inventory and reference materials.','prizes',100,false,false),
('e0000000-0000-4000-8000-000000000001','winners_circle','Winner''s Circle','Verification and handoff readiness using Phase D claims.','prizes',110,false,false),
('e0000000-0000-4000-8000-000000000001','cleanup','Cleanup','Site, equipment, inventory and final sign-off.','closeout',120,true,false),
('e0000000-0000-4000-8000-000000000001','photos_video','Photos / Video','Operational capture checklist and reference hooks only.','media',130,false,false);

insert into public.outreach_ops_template_checklists(template_id,area_key,item_key,text,display_order,required,quantity_kind,attachment_hook) values
('e0000000-0000-4000-8000-000000000001','registration','tables_chairs','Tables and chairs positioned',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','registration','tents_tote','Tents and registration tote ready',20,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','registration','line_team','Line attendants and registration workers assigned',30,true,'count',false),
('e0000000-0000-4000-8000-000000000001','registration','waiver_checkin','Waiver and check-in devices/process verified',40,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','registration','wristbands_tickets','Wristbands and ticket workflow available',50,true,'count',false),
('e0000000-0000-4000-8000-000000000001','water_food','station_setup','Station table, tent, cooler and trash ready',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','water_food','water_ice','Water, ice and cups stocked',20,true,'count',false),
('e0000000-0000-4000-8000-000000000001','water_food','replenishment','Replenishment owner confirmed',30,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','first_aid','location','Station location communicated',10,true,'text',false),
('e0000000-0000-4000-8000-000000000001','first_aid','supplies','First aid kit, cooler and snacks/juice verified',20,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','first_aid','staff','Lead and team assigned',30,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','inflatables','units_power','Units, blowers, generators, fuel and cords verified',10,true,'count',false),
('e0000000-0000-4000-8000-000000000001','inflatables','mats_safety','Foam mats and safety checklist complete',20,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','inflatables','entrance_exit','Entrance and exit staff assigned',30,true,'count',false),
('e0000000-0000-4000-8000-000000000001','inflatables','wristbands','Wristband requirement confirmed',40,false,'verification',false),
('e0000000-0000-4000-8000-000000000001','face_paint','setup','Tents, tables, chairs and kits ready',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','face_paint','staff_water','Staff and team water ready',20,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','face_paint','cleanup','Cleanup complete',30,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','games','activities','Activities, order and hosts confirmed',10,true,'text',false),
('e0000000-0000-4000-8000-000000000001','games','supplies','Game supplies and prize notes ready',20,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','sound_stage','power','Generator and power verified',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','sound_stage','sound_check','Sound check complete',20,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','sound_stage','stage_ready','Stage, chairs and team water ready',30,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','altar_care','tent_table','Tent, table and chairs ready',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','altar_care','ministry_supplies','Bibles, pens and clipboards ready',20,true,'count',false),
('e0000000-0000-4000-8000-000000000001','altar_care','followup','Existing decision/follow-up process and devices ready',30,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','prize_area','phase_d','Phase D configuration and operator readiness verified',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','prize_area','tablets_backup','Tablets, prize cards and backup roster ready',20,true,'count',false),
('e0000000-0000-4000-8000-000000000001','bike_area','restricted_zones','Restricted area and category zones marked',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','bike_area','inventory_twice','Bike inventory counted and reverified',20,true,'count',false),
('e0000000-0000-4000-8000-000000000001','bike_area','cards_labels','Category labels and prize cards ready',30,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','winners_circle','location_team','Location and team ready',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','winners_circle','verification','Ticket/number verification and Phase D handoff process ready',20,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','cleanup','equipment','Equipment and supplies packed',10,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','cleanup','inventory','Inventory exceptions recorded',20,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','cleanup','site','Trash collected, facilities checked and site clean',30,true,'verification',true),
('e0000000-0000-4000-8000-000000000001','cleanup','borrowed','Borrowed equipment returned',40,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','cleanup','signoff','Final area sign-off',50,true,'verification',false),
('e0000000-0000-4000-8000-000000000001','photos_video','winner_photos','Prize winner photos captured',10,false,'count',true),
('e0000000-0000-4000-8000-000000000001','photos_video','group_photo','Volunteer group photo captured',20,false,'verification',true),
('e0000000-0000-4000-8000-000000000001','photos_video','event_video','Event video/reference recorded',30,false,'verification',true),
('e0000000-0000-4000-8000-000000000001','photos_video','testimonies','Testimony/media notes recorded',40,false,'text',true);

insert into public.outreach_ops_template_inventory(template_id,area_key,item_key,item_name,category,required_quantity,critical,return_required) values
('e0000000-0000-4000-8000-000000000001','registration','tables_8','8-foot tables','furniture',4,false,true),('e0000000-0000-4000-8000-000000000001','registration','table_6','6-foot table','furniture',1,false,true),('e0000000-0000-4000-8000-000000000001','registration','chairs','Chairs','furniture',16,false,true),('e0000000-0000-4000-8000-000000000001','registration','tents','Tents','shelter',4,true,true),('e0000000-0000-4000-8000-000000000001','registration','wristbands','Paper wristbands','registration',0,true,false),
('e0000000-0000-4000-8000-000000000001','water_food','tables','6-foot tables','furniture',3,false,true),('e0000000-0000-4000-8000-000000000001','water_food','tents','Tents','shelter',3,false,true),('e0000000-0000-4000-8000-000000000001','water_food','coolers','Orange coolers','hospitality',5,false,true),('e0000000-0000-4000-8000-000000000001','water_food','water','Water','consumable',0,true,false),('e0000000-0000-4000-8000-000000000001','water_food','ice','Ice','consumable',0,false,false),
('e0000000-0000-4000-8000-000000000001','first_aid','kit','First aid kit','safety',1,true,true),('e0000000-0000-4000-8000-000000000001','first_aid','red_tent','Red tent','shelter',1,true,true),('e0000000-0000-4000-8000-000000000001','first_aid','cooler','Red cooler','hospitality',1,false,true),
('e0000000-0000-4000-8000-000000000001','inflatables','units','Inflatable units','activities',0,true,true),('e0000000-0000-4000-8000-000000000001','inflatables','blowers','Blowers','power',0,true,true),('e0000000-0000-4000-8000-000000000001','inflatables','generators','Generators','power',0,true,true),('e0000000-0000-4000-8000-000000000001','inflatables','fuel','Generator fuel','consumable',0,true,false),
('e0000000-0000-4000-8000-000000000001','face_paint','kits','Face paint kits','activities',3,false,true),('e0000000-0000-4000-8000-000000000001','sound_stage','sound','Sound equipment','av',1,true,true),('e0000000-0000-4000-8000-000000000001','sound_stage','generator','Stage generator','power',1,true,true),
('e0000000-0000-4000-8000-000000000001','altar_care','bibles','Bibles','ministry',0,true,true),('e0000000-0000-4000-8000-000000000001','altar_care','devices','Follow-up forms or digital devices','ministry',0,true,true),
('e0000000-0000-4000-8000-000000000001','prize_area','tablets','Tablets','prizes',0,false,true),('e0000000-0000-4000-8000-000000000001','bike_area','bikes','Bikes','prizes',0,true,true),('e0000000-0000-4000-8000-000000000001','cleanup','trash_bags','Trash bags','cleanup',0,false,false);

insert into public.outreach_ops_template_timeline(template_id,item_key,title,display_order,relative_minutes,required) values
('e0000000-0000-4000-8000-000000000001','team_arrival','Team arrival',10,-180,true),('e0000000-0000-4000-8000-000000000001','setup','Setup',20,-150,true),('e0000000-0000-4000-8000-000000000001','registration','Registration opens',30,-60,true),('e0000000-0000-4000-8000-000000000001','activities','Inflatables / face paint / music',40,-60,false),('e0000000-0000-4000-8000-000000000001','games','Games',50,0,false),('e0000000-0000-4000-8000-000000000001','concert','Concert',60,45,false),('e0000000-0000-4000-8000-000000000001','message','Message',70,75,true),('e0000000-0000-4000-8000-000000000001','prayer','Prayer / altar call',80,100,true),('e0000000-0000-4000-8000-000000000001','prizes','Prizes',90,120,false),('e0000000-0000-4000-8000-000000000001','closing','Closing',100,180,true),('e0000000-0000-4000-8000-000000000001','cleanup','Cleanup',110,190,true);

do $$declare n text;begin foreach n in array array['outreach_ops_templates','outreach_ops_template_areas','outreach_ops_template_checklists','outreach_ops_template_inventory','outreach_ops_template_timeline','outreach_event_operations','outreach_event_areas','outreach_event_area_members','outreach_event_checklist_items','outreach_event_inventory','outreach_event_issues','outreach_event_timeline','outreach_event_media_refs','outreach_event_ops_history'] loop execute format('alter table public.%I enable row level security',n);execute format('revoke all on public.%I from public,anon,authenticated',n);end loop;end $$;

revoke all on function private.outreach_ops_template_guard(),private.outreach_ops_can(uuid,text),private.outreach_ops_record(uuid,uuid,text,uuid,jsonb),private.outreach_ops_transition_ok(text,text),private.outreach_ops_summary(uuid),private.outreach_ops_context(uuid),private.outreach_ops_workspace(text,uuid,jsonb) from public,anon,authenticated;

revoke all on function public.outreach_event_day_workspace(text,uuid,jsonb) from public,anon;

grant execute on function public.outreach_event_day_workspace(text,uuid,jsonb) to authenticated;

-- Preserve monotonic template versions when an organization clones the global standard.
-- The global V1 template has no owner_organization_id, so the original owner-scoped
-- max(version) query alone would otherwise produce another V1.

create function private.outreach_ops_template_insert_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  next_version integer;
begin
  if new.status = 'draft' and new.owner_organization_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.owner_organization_id::text || ':' || new.name, 0)
    );
    select coalesce(max(t.version), 0) + 1
      into next_version
      from public.outreach_ops_templates t
     where t.name = new.name
       and (t.owner_organization_id is null or t.owner_organization_id = new.owner_organization_id);
    new.version := greatest(new.version, next_version);
  end if;
  return new;
end
$$;

create trigger outreach_ops_template_insert_version
before insert on public.outreach_ops_templates
for each row execute function private.outreach_ops_template_insert_version();

revoke all on function private.outreach_ops_template_insert_version() from public, anon, authenticated;

alter table public.outreach_campaign_contacts drop constraint outreach_campaign_contacts_role_key_check;

alter table public.outreach_campaign_contacts add constraint outreach_campaign_contacts_role_key_check check(role_key in ('host_pastor','host_coordinator','local_coordinator','ground_coordinator','church_office','outreach_coordinator','pastor_roddy','internal_team','internal_manager','logistics_lead','production_lead','local_leader','other'));

alter table public.outreach_campaign_events alter column campaign_id drop not null;

alter table public.outreach_campaign_events add column organization_id uuid references public.organizations(id);

alter table public.outreach_campaign_events add constraint outreach_event_owner check(campaign_id is not null or organization_id is not null);

alter table public.outreach_opportunities drop constraint outreach_opportunities_stage_check;

alter table public.outreach_opportunities add constraint outreach_opportunities_stage_check check(stage in ('new','contacted','reviewing','tentative','approved','future','declined','converted'));

alter table public.outreach_opportunities add column assigned_owner uuid references auth.users(id);

alter table public.outreach_opportunities add column next_action text not null default '' check(length(next_action)<=1000);

alter table public.outreach_opportunities add column target_month text check(target_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

alter table public.outreach_opportunities add column disposition_reason text not null default '' check(length(disposition_reason)<=2000);

alter table public.outreach_opportunities add column source_website text;

alter table public.outreach_opportunities add column request_key uuid;

alter table public.outreach_opportunities add column created_by uuid references auth.users(id);

create unique index outreach_opportunity_retry on public.outreach_opportunities(organization_id,request_key) where request_key is not null;

alter table public.outreach_campaigns drop constraint outreach_campaigns_status_check;

alter table public.outreach_campaigns add constraint outreach_campaigns_status_check check(status in ('draft','approved','preparing','registration_open','ready','completed','closed','cancelled','scheduled','postponed','rescheduled'));

alter table public.outreach_campaign_steps add column priority text not null default 'normal' check(priority in ('low','normal','high','critical'));

alter table public.outreach_campaign_steps add column reconfirmation_required boolean not null default false;

alter table public.outreach_campaign_steps add column reconfirmed_at timestamptz;

alter table public.outreach_campaign_steps add column created_by uuid references auth.users(id) default auth.uid();

alter table public.outreach_campaign_steps add column created_at timestamptz not null default now();

alter table public.outreach_campaign_steps add column updated_at timestamptz not null default now();

-- Categories are configuration labels, not a closed schema enumeration.
alter table public.outreach_campaign_documents drop constraint outreach_campaign_documents_category_check;

alter table public.outreach_campaign_documents add constraint outreach_document_category check(category ~ '^[a-z0-9_-]{1,80}$');

alter table public.outreach_campaign_documents drop constraint outreach_campaign_documents_status_check;

alter table public.outreach_campaign_documents add constraint outreach_document_status check(status in ('requested','uploaded','approved','rejected','needs_changes'));

alter table public.outreach_campaign_documents drop constraint outreach_campaign_documents_visibility_check;

alter table public.outreach_campaign_documents add constraint outreach_document_visibility check(visibility in ('restricted','internal','public','host_church','campaign_team','public_resource'));

alter table public.outreach_campaign_documents add column phase_f boolean not null default false;

alter table public.outreach_campaign_documents add column instructions text not null default '' check(length(instructions)<=6000);

alter table public.outreach_campaign_documents add column created_by uuid references auth.users(id) default auth.uid();

alter table public.outreach_campaign_documents add column reviewed_by uuid references auth.users(id);

alter table public.outreach_campaign_documents add column reviewed_at timestamptz;

alter table public.outreach_campaign_documents add column review_note text not null default '' check(length(review_note)<=2000);

alter table public.outreach_campaign_documents add column expires_at timestamptz;

alter table public.outreach_campaign_documents add column revision integer not null default 1;

alter table public.outreach_campaign_resources add column version integer not null default 1 check(version>0);

alter table public.outreach_campaign_resources drop constraint outreach_campaign_resources_campaign_id_resource_key_key;

alter table public.outreach_campaign_resources add unique(campaign_id,resource_key,version);

alter table public.outreach_campaign_resources drop constraint outreach_campaign_resources_resource_type_check;

alter table public.outreach_campaign_resources add constraint outreach_campaign_resources_resource_type_check check(resource_type in ('training','book','form','packet','flyer','other'));

create trigger phasef_resource_immutable before update or delete on public.outreach_campaign_resources for each row execute function private.outreach_immutable();

alter table public.outreach_campaign_resources add column visibility text not null default 'campaign_team' check(visibility in ('internal','host_church','campaign_team','public_resource'));

alter table public.outreach_campaign_resources add column created_at timestamptz not null default now();

alter table public.outreach_campaign_training add column assigned_role text;

alter table public.outreach_campaign_training add column assigned_at timestamptz not null default now();

alter table public.outreach_campaign_training add column required boolean not null default true;

create table public.outreach_host_profiles (
 owner_organization_id uuid not null references public.organizations(id), host_organization_id uuid not null references public.organizations(id),
 address text not null default '' check(length(address)<=600), city text not null, state_province text not null default '', country text not null,
 phone text not null default '' check(length(phone)<=40), website text check(website ~ '^https://[^[:space:]@]+$'),
 reviewed_by uuid not null references auth.users(id), reviewed_at timestamptz not null default now(), revision integer not null default 1,
 primary key(owner_organization_id,host_organization_id)
);

create table public.outreach_agreement_versions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 template_key text not null check(template_key ~ '^[a-z0-9_]{1,80}$'), version integer not null check(version>0),
 title text not null check(length(title) between 1 and 160), text_snapshot text not null check(length(btrim(text_snapshot)) between 10 and 30000),
 fields jsonb not null check(jsonb_typeof(fields)='array' and octet_length(fields::text)<=20000),
 source text not null check(length(source) between 1 and 2000), created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(organization_id,template_key,version), unique(organization_id,id)
);

create table public.outreach_campaign_agreements (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, organization_id uuid not null,
 agreement_version_id uuid not null, request_key uuid not null, version integer not null,
 text_snapshot text not null, fields_snapshot jsonb not null, responses jsonb not null check(jsonb_typeof(responses)='object' and octet_length(responses::text)<=20000),
 signature_name text not null check(length(btrim(signature_name)) between 2 and 160), acknowledged boolean not null check(acknowledged),
 submitted_by uuid not null references auth.users(id), submitted_at timestamptz not null default now(), source text not null,
 status text not null default 'submitted' check(status in ('submitted','approved','rejected','needs_changes')),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, review_note text not null default '' check(length(review_note)<=2000), revision integer not null default 1,
 unique(campaign_id,request_key), unique(campaign_id,version), unique(campaign_id,id),
 foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id),
 foreign key(organization_id,agreement_version_id) references public.outreach_agreement_versions(organization_id,id)
);

create table public.outreach_task_reminders (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, step_id uuid not null, reminder_key text not null unique,
 kind text not null check(kind in ('upcoming','due','overdue','repeated_overdue','escalation','stale')),
 scheduled_at timestamptz not null, due_snapshot timestamptz, recipient_roles jsonb not null default '[]',
 assigned_user_id uuid references auth.users(id), state text not null default 'pending' check(state in ('pending','acknowledged','superseded')),
 created_at timestamptz not null default now(), foreign key(campaign_id,step_id) references public.outreach_campaign_steps(campaign_id,id)
);

create index outreach_reminder_due on public.outreach_task_reminders(campaign_id,state,scheduled_at);

create table public.outreach_campaign_packets (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id), generation_key uuid not null,
 version integer not null, campaign_revision integer not null, state text not null check(state in ('final','updated')),
 snapshot jsonb not null, host_snapshot jsonb not null, generated_by uuid not null references auth.users(id), generated_at timestamptz not null default now(),
 unique(campaign_id,generation_key), unique(campaign_id,version), unique(campaign_id,id)
);

create table public.outreach_interest_channels (
 slug text primary key check(slug ~ '^[a-z0-9-]{3,80}$'), organization_id uuid not null references public.organizations(id), enabled boolean not null default false,
 source_website text not null check(source_website ~ '^https://[^[:space:]@]+$'),
 network_hour_limit integer not null default 120 check(network_hour_limit between 1 and 1000), contact_hour_limit integer not null default 5 check(contact_hour_limit between 1 and 100)
);

create table private.outreach_interest_rate (
 channel text not null references public.outreach_interest_channels(slug), fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 bucket timestamptz not null, attempts integer not null, primary key(channel,fingerprint,bucket)
);

alter table private.outreach_interest_rate enable row level security;

revoke all on private.outreach_interest_rate from public,anon,authenticated;

-- Host capabilities deliberately do NOT imply legacy 'view': legacy registrant/travel APIs stay denied.
create function private.phasef_can(c uuid,cap text default 'preevent.view') returns boolean language sql stable security definer set search_path='' as $$
 select cap in ('preevent.view','preevent.manage','host.view','host.respond') and private.outreach_verified(auth.uid()) and exists(
 select 1 from public.outreach_campaigns x where x.id=c and (private.outreach_admin(x.organization_id,cap in ('preevent.manage','host.respond')) or exists(
 select 1 from public.outreach_campaign_assignments a where a.campaign_id=c and a.user_id=auth.uid() and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and cap=any(a.capabilities))))
$$;

create function private.phasef_host(c uuid) returns boolean language sql stable security definer set search_path='' as $$select private.phasef_can(c,'host.view') and not private.phasef_can(c,'preevent.view')$$;

create function private.phasef_step_visible(c uuid,s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.outreach_campaign_steps x where x.campaign_id=c and x.id=s and (private.phasef_can(c) or (private.phasef_can(c,'host.view') and coalesce(x.definition->>'visibility','internal') in ('host_church','public_resource') and (x.assigned_user_id is null or x.assigned_user_id=auth.uid()))))
$$;

create function private.phasef_doc_visible(c uuid,d uuid,writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.outreach_campaign_documents x join public.outreach_campaigns y on y.id=x.campaign_id where x.id=d and x.campaign_id=c and
 ((private.phasef_can(c) and (x.visibility<>'restricted' or private.outreach_admin(y.organization_id,true)) and (not writing or private.phasef_can(c,'preevent.manage'))) or
 (private.phasef_can(c,'host.view') and x.phase_f and x.visibility in ('host_church','public_resource') and (not writing or (private.phasef_can(c,'host.respond') and x.requested_from=auth.uid())))) and (not writing or x.status='requested'))
$$;

create or replace function private.outreach_document_can(p_name text,p_write boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.outreach_campaign_documents d join public.outreach_campaigns c on c.id=d.campaign_id where d.object_path=p_name and
 case when d.phase_f then private.phasef_doc_visible(c.id,d.id,p_write) else private.outreach_can(c.id,'documents') and (d.visibility<>'restricted' or private.outreach_admin(c.organization_id,true)) and (not p_write or d.status='requested') end)
$$;

create function private.phasef_agreement_guard() returns trigger language plpgsql set search_path='' as $$begin
 if (to_jsonb(new)-array['status','reviewed_by','reviewed_at','review_note','revision']) is distinct from (to_jsonb(old)-array['status','reviewed_by','reviewed_at','review_note','revision']) then raise exception 'Signed agreement snapshot is immutable' using errcode='42501';end if;return new;end$$;

create trigger phasef_agreement_immutable before update on public.outreach_campaign_agreements for each row execute function private.phasef_agreement_guard();

create trigger phasef_agreement_no_delete before delete on public.outreach_campaign_agreements for each row execute function private.outreach_immutable();

create trigger phasef_agreement_version_immutable before update or delete on public.outreach_agreement_versions for each row execute function private.outreach_immutable();

create trigger phasef_packet_immutable before update or delete on public.outreach_campaign_packets for each row execute function private.outreach_immutable();

create function private.phasef_document_guard() returns trigger language plpgsql set search_path='' as $$begin
 if old.phase_f and (to_jsonb(new)-array['status','uploaded_at','byte_size','mime_type','reviewed_by','reviewed_at','review_note','revision']) is distinct from (to_jsonb(old)-array['status','uploaded_at','byte_size','mime_type','reviewed_by','reviewed_at','review_note','revision']) then raise exception 'Document version is immutable';end if;
 if old.phase_f and old.status<>'requested' and (new.byte_size is distinct from old.byte_size or new.mime_type is distinct from old.mime_type or new.uploaded_at is distinct from old.uploaded_at) then raise exception 'Uploaded version is immutable';end if;return new;end$$;

create trigger phasef_document_immutable before update on public.outreach_campaign_documents for each row execute function private.phasef_document_guard();

-- Extend the validator while retaining the accepted Phase A checks.
alter function private.outreach_template_valid(jsonb) rename to phasef_legacy_template_valid;

create function private.outreach_template_valid(p jsonb) returns boolean language plpgsql set search_path='' as $$declare s jsonb; normalized jsonb:='[]';n jsonb;v jsonb;begin
 if jsonb_typeof(p)<>'array' then return false;end if;
 for s in select value from jsonb_array_elements(p) loop
  n:=s;
  if s ? 'completion_rule' and s->>'completion_rule' not in ('manual','assigned_training_complete','approved_agreement','packet_generated','final_readiness') then return false;end if;
  if s->>'completion_rule' in ('approved_agreement','packet_generated','final_readiness') then n:=jsonb_set(n,'{completion_rule}','"manual"');end if;
  if s ? 'visibility' and s->>'visibility' not in ('internal','host_church','campaign_team','public_resource') then return false;end if;
  if s ? 'reconfirm_on_change' and jsonb_typeof(s->'reconfirm_on_change')<>'boolean' then return false;end if;
  if s ? 'required_fields' and jsonb_typeof(s->'required_fields')<>'array' then return false;end if;
  if s ? 'reminder_offsets' then
   if jsonb_typeof(s->'reminder_offsets')<>'array' or jsonb_array_length(s->'reminder_offsets')>30 then return false;end if;
   for v in select value from jsonb_array_elements(s->'reminder_offsets') loop if v::text !~ '^-?[0-9]+$' or (v::text)::int not between -365 and 365 then return false;end if;end loop;
  end if;
  if s ? 'escalations' then
   if jsonb_typeof(s->'escalations')<>'array' or jsonb_array_length(s->'escalations')>10 then return false;end if;
   for v in select value from jsonb_array_elements(s->'escalations') loop if coalesce((v->>'after_days')::int,0) not between 1 and 365 or jsonb_typeof(v->'roles')<>'array' then return false;end if;end loop;
  end if;
  normalized:=normalized||jsonb_build_array(n);
 end loop;return private.phasef_legacy_template_valid(normalized);exception when others then return false;end$$;

create function private.phasef_fields_valid(fields jsonb,answers jsonb) returns boolean language plpgsql immutable set search_path='' as $$declare f jsonb;k text;v jsonb;begin
 if jsonb_typeof(fields)<>'array' or jsonb_typeof(answers)<>'object' then return false;end if;
 for k in select jsonb_object_keys(answers) loop if not exists(select 1 from jsonb_array_elements(fields) x where x->>'key'=k) then return false;end if;end loop;
 for f in select value from jsonb_array_elements(fields) loop
  k:=f->>'key';v:=answers->k;
  if coalesce((f->>'required')::boolean,false) and (v is null or v='null' or v='""') then return false;end if;
  if v is not null and v<>'null' then
   if f->>'type'='boolean' and jsonb_typeof(v)<>'boolean' then return false;end if;
   if f->>'type'='integer' and (v::text !~ '^[0-9]+$' or (v::text)::numeric>100000) then return false;end if;
   if f->>'type' in ('text','choice') and (jsonb_typeof(v)<>'string' or length(answers->>k)>6000) then return false;end if;
   if f->>'type'='choice' and not coalesce((f->'options') ? (answers->>k),false) then return false;end if;
  end if;
 end loop;return true;exception when others then return false;end$$;

create function private.phasef_field_schema_valid(fields jsonb) returns boolean language sql immutable set search_path='' as $$
 select jsonb_typeof(fields)='array' and jsonb_array_length(fields)<=60 and not exists(select 1 from jsonb_array_elements(fields) f where coalesce(f->>'key','')!~'^[a-z0-9_]{1,80}$' or length(coalesce(f->>'label','')) not between 1 and 200 or coalesce(f->>'type','') not in ('text','boolean','integer','choice') or (f ? 'required' and jsonb_typeof(f->'required')<>'boolean') or (f->>'type'='choice' and (jsonb_typeof(f->'options') is distinct from 'array' or jsonb_array_length(f->'options')=0))) and (select count(*) from jsonb_array_elements(fields))=(select count(distinct f->>'key') from jsonb_array_elements(fields) f)
$$;

-- Known operational inputs are document-confirmed, independent from pending exact legacy form fields.
create function private.phasef_inputs_valid(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select jsonb_typeof(p)='object' and octet_length(p::text)<=6000 and not exists(select 1 from jsonb_each(p) x where
 (x.key in ('flyers','bikes_enabled','tablets_enabled','personnel_final','inventory_confirmed','semi_parking','box_truck_parking','bus_rv_staging') and jsonb_typeof(x.value)<>'boolean') or
 (x.key in ('bikes_quantity','tablets_quantity') and (x.value::text!~'^[0-9]+$' or length(x.value::text)>6)) or
 (x.key in ('bikes_responsibility','tablets_responsibility') and (jsonb_typeof(x.value) is distinct from 'string' or x.value#>>'{}' not in ('host','champion_sowgo'))) or
 (x.key in ('permits_required','insurance_required') and (jsonb_typeof(x.value) is distinct from 'string' or x.value#>>'{}' not in ('yes','no','unknown'))) or
 (x.key in ('permits_state','insurance_state') and (jsonb_typeof(x.value) is distinct from 'string' or x.value#>>'{}' not in ('unknown','requested','submitted','approved','verified','not_required'))))
$$;

create function private.phasef_interest_valid(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$declare k text;v jsonb;begin
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>12000 then return false;end if;
 for k,v in select * from jsonb_each(p) loop
  if k<>all(array['church_name','pastor_name','city','state_province','country','primary_contact','submitter_is_pastor','submitter_role','phone','email','website','preferred_months','alternate_months','previous_experience','prior_outreach','notes']) then return false;end if;
  if k not in ('submitter_is_pastor','prior_outreach','alternate_months') and (jsonb_typeof(v)<>'string' or length(p->>k)>2000) then return false;end if;
 end loop;
 return length(btrim(coalesce(p->>'church_name',''))) between 1 and 160 and length(btrim(coalesce(p->>'city',''))) between 1 and 100 and length(btrim(coalesce(p->>'country',''))) between 2 and 100
 and length(btrim(coalesce(p->>'pastor_name',''))) between 1 and 160 and length(btrim(coalesce(p->>'primary_contact',''))) between 1 and 160
 and jsonb_typeof(p->'submitter_is_pastor')='boolean' and (p->>'submitter_is_pastor'='true' or length(btrim(coalesce(p->>'submitter_role',''))) between 1 and 160)
 and coalesce(p->>'email','') ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and length(p->>'email')<=254
 and coalesce(p->>'phone','') ~ '^[+0-9(). -]{7,40}$' and coalesce(p->>'preferred_months','') ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
 and (not(p ? 'prior_outreach') or jsonb_typeof(p->'prior_outreach')='boolean')
 and (not(p ? 'website') or p->>'website'='' or p->>'website' ~ '^https://[^[:space:]@]+$')
 and (not(p ? 'alternate_months') or jsonb_typeof(p->'alternate_months')='array') and not exists(select 1 from jsonb_array_elements_text(coalesce(p->'alternate_months','[]')) x where x !~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
 exception when others then return false;end$$;

create function private.phasef_interest_gateway(channel text,p jsonb,network text,email_hash text,phone_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
 #variable_conflict use_column
 declare ch public.outreach_interest_channels;o public.outreach_opportunities;h text;n int;begin
 select * into ch from public.outreach_interest_channels where slug=channel and enabled;
 if not found or p->>'request_key' is null or private.phasef_interest_valid(p->'details') is distinct from true or network !~ '^[a-f0-9]{64}$' or email_hash !~ '^[a-f0-9]{64}$' or phone_hash !~ '^[a-f0-9]{64}$' then raise exception 'Interest unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended('interest:'||channel,0));
 select * into o from public.outreach_opportunities where organization_id=ch.organization_id and request_key=(p->>'request_key')::uuid;
 if found then if o.details<>p->'details' or o.source_website<>ch.source_website then raise exception 'Retry differs';end if;return jsonb_build_object('accepted',true);end if;
 for h in select unnest(array[network,email_hash,phone_hash]) loop
  insert into private.outreach_interest_rate values(channel,h,date_trunc('hour',now()),1) on conflict(channel,fingerprint,bucket) do update set attempts=outreach_interest_rate.attempts+1 returning attempts into n;
  if n>(case when h=network then ch.network_hour_limit else ch.contact_hour_limit end) then return jsonb_build_object('accepted',false,'reason','rate');end if;
 end loop;
 insert into public.outreach_opportunities(organization_id,details,source_website,request_key,target_month) values(ch.organization_id,p->'details',ch.source_website,(p->>'request_key')::uuid,p->'details'->>'preferred_months') returning * into o;
 perform private.outreach_audit(null,ch.organization_id,'outreach.opportunity.submitted',o.id);
 insert into public.outreach_campaign_events(organization_id,kind,subject_id,event_key) values(ch.organization_id,'outreach.opportunity.submitted',o.id,'interest:'||o.id);
 return jsonb_build_object('accepted',true);end$$;

create function public.outreach_interest_gateway(p_channel text,p_payload jsonb,p_network text,p_email_hash text,p_phone_hash text) returns jsonb language sql security invoker set search_path='' as $$select private.phasef_interest_gateway(p_channel,p_payload,p_network,p_email_hash,p_phone_hash)$$;

create function private.phasef_blockers(c uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare x public.outreach_campaigns;s public.outreach_campaign_steps;d public.outreach_campaign_documents;b jsonb:='[]';k text;begin
 select * into x from public.outreach_campaigns where id=c;
 if exists(select 1 from public.outreach_campaign_steps where campaign_id=c and definition->>'completion_rule'='approved_agreement') and not exists(select 1 from public.outreach_campaign_agreements where campaign_id=c and agreement_version_id=(x.settings->>'agreement_version_id')::uuid and status='approved') then b:=b||jsonb_build_array('Current agreement approval required');end if;
 if x.event_start is null or x.registration_start is null or x.event_end is null or length(btrim(coalesce(x.settings->>'setup_arrival','')))=0 or length(coalesce(x.venue->>'site_name',''))=0 or length(coalesce(x.venue->>'address',''))=0 then b:=b||jsonb_build_array('Event location and timeline incomplete');end if;
 if x.status in ('postponed','cancelled','closed','completed') then b:=b||jsonb_build_array('Campaign is '||x.status);end if;
 for s in select * from public.outreach_campaign_steps where campaign_id=c and coalesce((definition->>'required')::boolean,true) and coalesce(definition->>'category','') not in ('final_readiness','final_packet','event_day','post_event') loop
  if private.outreach_step_state(c,s.step_key) not in ('completed','not_applicable') then b:=b||jsonb_build_array('Task: '||(s.definition->>'title'));end if;
  if s.reconfirmation_required then b:=b||jsonb_build_array('Reconfirm: '||(s.definition->>'title'));end if;
 end loop;
 if coalesce(x.settings->>'training_gate','required')='required' and (not exists(select 1 from public.outreach_campaign_training where campaign_id=c and required) or exists(select 1 from public.outreach_campaign_training where campaign_id=c and required and state<>'completed')) then b:=b||jsonb_build_array('Required training incomplete');end if;
 for k in select unnest(array['permits','insurance']) loop
  if coalesce(x.settings->'workflow_inputs'->>(k||'_required'),'unknown')='unknown' then b:=b||jsonb_build_array(initcap(k)||' requirement unknown');
  elsif x.settings->'workflow_inputs'->>(k||'_required')='yes' and not exists(select 1 from public.outreach_campaign_documents where campaign_id=c and category=k and status='approved' and (expires_at is null or expires_at>x.event_start)) then b:=b||jsonb_build_array(initcap(k)||' approval missing or expired');end if;
 end loop;
 for d in select * from public.outreach_campaign_documents where campaign_id=c and phase_f and replaces_id is null and status in ('requested','uploaded','needs_changes','rejected') and category in ('site_layout','production_packet') loop
  if not exists(select 1 from public.outreach_campaign_documents where campaign_id=c and category=d.category and status='approved' and (expires_at is null or expires_at>x.event_start)) then b:=b||jsonb_build_array('Document: '||d.title);end if;
 end loop;
 if not coalesce((x.settings->'workflow_inputs'->>'personnel_final')::boolean,false) then b:=b||jsonb_build_array('Personnel not finalized');end if;
 if not coalesce((x.settings->'workflow_inputs'->>'inventory_confirmed')::boolean,false) then b:=b||jsonb_build_array('Inventory not confirmed');end if;
 return b;end$$;

create function private.phasef_reminders(c uuid) returns jsonb language plpgsql security definer set search_path='' as $$
 #variable_conflict use_column
 declare x public.outreach_campaigns;s public.outreach_campaign_steps;offset_day int;item jsonb;due timestamptz;kind text;key text;id uuid;roles jsonb;count_new int:=0;begin
 select * into x from public.outreach_campaigns where id=c for update;
 update public.outreach_task_reminders r set state='superseded' from public.outreach_campaign_steps s where r.campaign_id=c and s.id=r.step_id and r.state='pending' and (s.due_at is distinct from r.due_snapshot or (s.status='completed' and not s.reconfirmation_required and r.kind<>'stale') or private.outreach_step_state(c,s.step_key)='not_applicable' or x.status in ('postponed','cancelled','closed','completed'));
 if x.status in ('postponed','cancelled','closed','completed') then return jsonb_build_object('created',0,'provider_connected',false);end if;
 for s in select * from public.outreach_campaign_steps where campaign_id=c and status<>'completed' and due_at is not null loop
  if private.outreach_step_state(c,s.step_key) not in ('ready','overdue') then continue;end if;
  for offset_day in select jsonb_array_elements_text(coalesce(s.definition->'reminder_offsets','[14,7,3,1,0,-7]'))::int loop
   due:=s.due_at-make_interval(days=>offset_day);kind:=case when offset_day>0 then 'upcoming' when offset_day=0 then 'due' when offset_day=-1 then 'overdue' else 'repeated_overdue' end;
   key:=s.id||':'||s.due_at||':'||kind||':'||offset_day;
   insert into public.outreach_task_reminders(campaign_id,step_id,reminder_key,kind,scheduled_at,due_snapshot,assigned_user_id,recipient_roles) values(c,s.id,key,kind,due,s.due_at,s.assigned_user_id,jsonb_build_array(s.assigned_role)) on conflict(reminder_key) do nothing returning outreach_task_reminders.id into id;
   if id is not null then count_new:=count_new+1;end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(s.definition->'escalations','[]')) loop
   due:=s.due_at+make_interval(days=>(item->>'after_days')::int);key:=s.id||':'||s.due_at||':escalation:'||(item->>'after_days');
   insert into public.outreach_task_reminders(campaign_id,step_id,reminder_key,kind,scheduled_at,due_snapshot,recipient_roles) values(c,s.id,key,'escalation',due,s.due_at,item->'roles') on conflict(reminder_key) do nothing;
  end loop;
 end loop;
 -- Reconfirmation and expired-document work stays visible even after prior task completion.
 for s in select * from public.outreach_campaign_steps where campaign_id=c and reconfirmation_required loop
  insert into public.outreach_task_reminders(campaign_id,step_id,reminder_key,kind,scheduled_at,due_snapshot,recipient_roles,assigned_user_id) values(c,s.id,s.id||':stale:'||s.revision,'stale',now(),s.due_at,jsonb_build_array(s.assigned_role),s.assigned_user_id) on conflict(reminder_key) do nothing;
 end loop;
 for item in select to_jsonb(d) from public.outreach_campaign_documents d where d.campaign_id=c and d.phase_f and d.status='approved' and d.expires_at<=coalesce(x.event_start,now()) loop
  select * into s from public.outreach_campaign_steps z where z.campaign_id=c order by coalesce(z.definition->'required_documents' ? (item->>'category'),false) desc,z.position limit 1;
  if found then insert into public.outreach_task_reminders(campaign_id,step_id,reminder_key,kind,scheduled_at,due_snapshot,recipient_roles) values(c,s.id,(item->>'id')||':expiry:'||(item->>'expires_at'),'stale',least(now(),(item->>'expires_at')::timestamptz),s.due_at,jsonb_build_array(s.assigned_role)) on conflict(reminder_key) do nothing;end if;
 end loop;
 -- Only materialize due hooks once; future rows remain pending. No delivery claim.
 for item in select to_jsonb(r) from public.outreach_task_reminders r where r.campaign_id=c and r.state='pending' and r.scheduled_at<=now() loop
  kind:=case when item->>'kind'='escalation' then 'outreach.task.escalated' when item->>'kind' in ('overdue','repeated_overdue') then 'outreach.task.overdue' else 'outreach.task.due' end;
  perform private.outreach_event(c,kind,(item->>'step_id')::uuid,'reminder:'||(item->>'id'));
 end loop;
 if x.event_start is not null and now()>=x.event_start-make_interval(days=>coalesce((x.settings->>'details_due_days')::int,30)) and (x.venue->>'site_name' is null or x.registration_start is null) then perform private.outreach_event(c,'outreach.event_details.missing',c,c||':details:'||x.revision);end if;
 return jsonb_build_object('created',count_new,'provider_connected',false,'delivery_state','pending');end$$;

create function private.phasef_reschedule_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.event_start is distinct from old.event_start or new.registration_start is distinct from old.registration_start or new.event_end is distinct from old.event_end or new.settings->>'setup_arrival' is distinct from old.settings->>'setup_arrival' or new.venue is distinct from old.venue then
  update public.outreach_campaign_steps set due_at=new.event_start+make_interval(days=>coalesce((definition->>'due_days')::int,0)),reconfirmation_required=true,updated_at=clock_timestamp(),revision=revision+1 where campaign_id=new.id and status='completed' and coalesce((definition->>'reconfirm_on_change')::boolean,false);
  update public.outreach_task_reminders set state='superseded' where campaign_id=new.id and state='pending';
  perform private.outreach_audit(new.id,new.organization_id,'outreach.schedule.changed',new.id,jsonb_build_object('old_event_start',old.event_start,'new_event_start',new.event_start,'venue_changed',new.venue is distinct from old.venue));
  perform private.outreach_event(new.id,'outreach.campaign.rescheduled',new.id,new.id||':reschedule:'||new.revision);
 end if;return new;end$$;

create trigger phasef_campaign_changed after update on public.outreach_campaigns for each row execute function private.phasef_reschedule_guard();

create function private.phasef_packet(c uuid,host boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$declare x public.outreach_campaigns;r jsonb;begin
 select * into x from public.outreach_campaigns where id=c;
 r:=jsonb_build_object('campaign',jsonb_build_object('name',x.name,'country',x.country,'city',x.city,'date',x.event_start,'timezone',x.timezone,'registration_start',x.registration_start,'event_end',x.event_end,'setup_arrival',x.settings->>'setup_arrival','venue',x.venue,'status',x.status),
 'host_church',(select jsonb_build_object('name',o.name,'address',p.address,'phone',p.phone,'website',p.website) from public.organizations o left join public.outreach_host_profiles p on p.host_organization_id=o.id and p.owner_organization_id=x.organization_id where o.id=x.host_organization_id),
 'registration',jsonb_build_object('url',x.settings->>'public_registration_url','qr_request',x.settings->>'qr_request_state'),
 'documents',(select coalesce(jsonb_agg(jsonb_build_object('title',d.title,'category',d.category,'document_id',d.id,'version',d.version,'expires_at',d.expires_at)),'[]') from public.outreach_campaign_documents d where d.campaign_id=c and d.status='approved' and (not host or d.visibility in ('host_church','public_resource'))),
 'permits',x.settings->'workflow_inputs'->>'permits_state','insurance',x.settings->'workflow_inputs'->>'insurance_state',
 'contacts',(select coalesce(jsonb_agg(jsonb_build_object('role',a.role_key,'name',p.first_name||' '||p.last_name,'phone',p.phone,'email',p.email)),'[]') from public.outreach_campaign_contacts a join public.organization_people p on p.organization_id=a.organization_id and p.id=a.person_id where a.campaign_id=c and a.active and (not host or a.role_key in ('host_pastor','local_coordinator','outreach_coordinator','pastor_roddy','logistics_lead'))),
 'production_notes',x.settings->>'production_notes','generated_from_revision',x.revision);
 if not host then
  r:=r||jsonb_build_object('personnel',(select coalesce(jsonb_agg(jsonb_build_object('name',m.first_name||' '||m.last_name,'role',r.role,'area',a.title)),'[]') from public.outreach_event_area_members r join public.outreach_team_members m on m.id=r.member_id join public.outreach_event_areas a on a.id=r.area_id where r.campaign_id=c and r.active),
  'inventory',(select coalesce(jsonb_agg(jsonb_build_object('item',item_name,'required',required_quantity,'available',available_quantity,'responsibility',source_owner)),'[]') from public.outreach_event_inventory where campaign_id=c),
  'meetups',(select coalesce(jsonb_agg(to_jsonb(m)-'campaign_id'-'id'-'revision'),'[]') from public.outreach_team_meetings m where campaign_id=c),
  'lodging',(select coalesce(jsonb_agg(to_jsonb(l)-'internal_notes'-'campaign_id'-'id'-'revision'),'[]') from public.outreach_team_lodgings l where campaign_id=c and active));
 end if;return r;end$$;

create or replace function private.outreach_step_state(p_campaign uuid,p_key text) returns text language plpgsql stable security definer set search_path='' as $$
declare s public.outreach_campaign_steps; c public.outreach_campaigns; dep text; value jsonb;
begin
 select * into s from public.outreach_campaign_steps where campaign_id=p_campaign and step_key=p_key;
 if not found then return 'blocked';end if;
 if s.definition->>'phase_f'='true' and s.reconfirmation_required then return 'awaiting_reconfirmation';end if;
 if s.status='completed' then return 'completed';end if;
 select * into c from public.outreach_campaigns where id=p_campaign;
 if coalesce((s.definition->>'active')::boolean,true)=false then return 'not_applicable';end if;
 if s.definition ? 'condition' then
  value:=c.settings->'workflow_inputs'->(s.definition->'condition'->>'field');
  if value is null then return 'awaiting_configuration';end if;
  if value<>s.definition->'condition'->'equals' then return 'not_applicable';end if;
 end if;
 for dep in select jsonb_array_elements_text(coalesce(s.definition->'depends_on','[]')) loop
  if private.outreach_step_state(p_campaign,dep) not in ('completed','not_applicable') then return 'blocked';end if;
 end loop;
 return case when s.due_at<now() then 'overdue' else 'ready' end;
end $$;

create function private.phasef_workspace(action text,c uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
 #variable_conflict use_column
 declare x public.outreach_campaigns;o public.outreach_opportunities;s public.outreach_campaign_steps;d public.outreach_campaign_documents;a public.outreach_campaign_agreements;v public.outreach_agreement_versions;packet public.outreach_campaign_packets;
 org uuid:=(p->>'organization_id')::uuid;id uuid;host_org uuid;coordinator uuid;item jsonb;rows jsonb;b jsonb;value jsonb;k text;host boolean;manage boolean;host_request boolean:=false;signature text;roles jsonb;begin
 if not private.outreach_verified(auth.uid()) then raise exception 'Verified identity required' using errcode='42501';end if;
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>125000 then raise exception 'Invalid request';end if;
 if action='organizations' then return private.outreach_core('context',null,'{}');end if;
 if action in ('opportunities','opportunity_save','convert','agreement_publish','agreement_templates','workflow_publish','hosts') then
  if not private.outreach_admin(org,action not in ('opportunities','agreement_templates','hosts')) then raise exception 'Campaign administrator required' using errcode='42501';end if;
  if action='hosts' then return coalesce((select jsonb_agg(to_jsonb(h)||jsonb_build_object('name',o.name)) from public.outreach_host_profiles h join public.organizations o on o.id=h.host_organization_id where owner_organization_id=org),'[]');end if;
  if action='agreement_templates' then return coalesce((select jsonb_agg(to_jsonb(t) order by version desc) from public.outreach_agreement_versions t where organization_id=org),'[]');end if;
  if action='agreement_publish' then
   if private.phasef_field_schema_valid(p->'fields') is distinct from true or length(btrim(coalesce(p->>'approval_reason','')))<10 then raise exception 'Exact reviewed text and field schema required';end if;
   insert into public.outreach_agreement_versions(organization_id,template_key,version,title,text_snapshot,fields,source,created_by) values(org,p->>'template_key',(p->>'version')::int,p->>'title',p->>'text_snapshot',p->'fields',p->>'source',auth.uid()) returning * into v;
   perform private.outreach_audit(null,org,'outreach.agreement.published',v.id);return to_jsonb(v);
  end if;
  if action='workflow_publish' then
   if exists(select 1 from jsonb_array_elements(p->'steps') s where s->>'phase_f' is distinct from 'true') then raise exception 'Native pre-event workflow marker required';end if;
   return private.outreach_workflow('template_publish',null,p);end if;
  if action='opportunities' then return coalesce((select jsonb_agg(to_jsonb(t) order by created_at desc) from public.outreach_opportunities t where organization_id=org),'[]');end if;
  if action='opportunity_save' then
   if private.phasef_interest_valid(p->'details') is distinct from true or coalesce(p->>'stage','new') in ('approved','converted') then raise exception 'Explicit reviewed conversion required';end if;
   if p->>'assigned_owner' is not null and not private.staff_assignment_active(org,(p->>'assigned_owner')::uuid) then raise exception 'Owner unavailable';end if;
   if p->>'stage' in ('declined','future') and length(btrim(coalesce(p->>'disposition_reason','')))<3 then raise exception 'Disposition reason required';end if;
   if p->>'id' is null then
    insert into public.outreach_opportunities(organization_id,details,created_by,source_website) values(org,p->'details',auth.uid(),'manual') returning * into o;
   else
    select * into o from public.outreach_opportunities where organization_id=org and outreach_opportunities.id=(p->>'id')::uuid for update;
    if not found or o.stage in ('approved','converted') or o.revision is distinct from (p->>'revision')::int then raise exception 'Opportunity changed';end if;
   end if;
   update public.outreach_opportunities set details=p->'details',stage=coalesce(p->>'stage',stage),assigned_owner=(p->>'assigned_owner')::uuid,next_action=coalesce(p->>'next_action',''),target_month=coalesce(p->>'target_month',p->'details'->>'preferred_months'),disposition_reason=coalesce(p->>'disposition_reason',''),updated_at=clock_timestamp(),revision=revision+1 where outreach_opportunities.id=o.id returning * into o;
   perform private.outreach_audit(null,org,'outreach.opportunity.stage_changed',o.id,jsonb_build_object('stage',o.stage,'revision',o.revision));return to_jsonb(o);
  end if;
  select * into o from public.outreach_opportunities where organization_id=org and outreach_opportunities.id=(p->>'id')::uuid for update;
  if not found then raise exception 'Opportunity unavailable' using errcode='42501';end if;
  select * into x from public.outreach_campaigns where opportunity_id=o.id;
  if found then return to_jsonb(x);end if;
  if not exists(select 1 from public.outreach_workflow_templates t where t.id=(p->>'template_id')::uuid and (t.organization_id is null or t.organization_id=org) and not exists(select 1 from jsonb_array_elements(t.steps) s where s->>'phase_f' is distinct from 'true')) then raise exception 'Published native pre-event workflow required';end if;
  if not exists(select 1 from pg_timezone_names where name=p->>'timezone') then raise exception 'Valid IANA timezone required';end if;
  if length(btrim(coalesce(p->>'identity_review_reason','')))<10 then raise exception 'Reviewed host identity required';end if;
  -- Reuse explicit reviewed canonical Organization ID; new host requires a new reviewed slug, never email matching.
  host_org:=(p->>'host_organization_id')::uuid;
  if host_org is null then
   if not coalesce((p->>'create_host_confirmed')::boolean,false) then raise exception 'Select reviewed host or explicitly confirm new host';end if;
   insert into public.organizations(slug,name,kind) values(p->>'new_host_slug',o.details->>'church_name','church') returning organizations.id into host_org;
  elsif not exists(select 1 from public.outreach_host_profiles where owner_organization_id=org and host_organization_id=host_org) then raise exception 'Reviewed host outside owner directory';end if;
  insert into public.outreach_host_profiles(owner_organization_id,host_organization_id,city,state_province,country,address,phone,website,reviewed_by) values(org,host_org,o.details->>'city',coalesce(o.details->>'state_province',''),o.details->>'country',coalesce(p->>'host_address',''),coalesce(o.details->>'phone',''),nullif(o.details->>'website',''),auth.uid()) on conflict(owner_organization_id,host_organization_id) do nothing;
  coordinator:=(p->>'coordinator_user_id')::uuid;
  if coordinator is not null and not private.staff_assignment_active(org,coordinator) then raise exception 'Coordinator outside active staff';end if;
  value:=private.phasef_previous_core('approve',null,p);c:=(value->>'id')::uuid;
  update public.outreach_campaigns set host_organization_id=host_org,event_start=(p->>'event_start')::timestamptz,settings=settings||jsonb_build_object('coordinator_user_id',coordinator,'phase_f',true),revision=revision+1 where outreach_campaigns.id=c returning * into x;
  update public.outreach_opportunities set stage='converted' where outreach_opportunities.id=o.id;
  perform private.outreach_event(c,'outreach.opportunity.approved',o.id,'f-approved:'||o.id);
  perform private.outreach_event(c,'outreach.campaign.created',c,'f-created:'||c);
  perform private.outreach_event(c,'outreach.agreement.requested',c,'f-agreement:'||c);
  perform private.outreach_event(c,'outreach.welcome.prepared',c,'f-welcome:'||c);
  return to_jsonb(x);
 end if;
 if action='campaigns' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',z.id,'name',z.name,'country',z.country,'region',z.state_province,'city',z.city,'status',z.status,'event_start',z.event_start,'timezone',z.timezone,'host_organization_id',z.host_organization_id,'host_name',h.name,'coordinator',z.settings->>'coordinator_user_id','ready',jsonb_array_length(private.phasef_blockers(z.id))=0,'overdue',(select count(*) from public.outreach_campaign_steps s where s.campaign_id=z.id and private.phasef_step_visible(z.id,s.id) and private.outreach_step_state(z.id,s.step_key)='overdue'),'workflow_percent',(select coalesce(round(100.0*count(*) filter(where private.outreach_step_state(z.id,s.step_key) in ('completed','not_applicable'))/nullif(count(*),0)),0) from public.outreach_campaign_steps s where s.campaign_id=z.id and private.phasef_step_visible(z.id,s.id))) order by z.event_start nulls last,z.name) from public.outreach_campaigns z left join public.organizations h on h.id=z.host_organization_id where private.phasef_can(z.id) or private.phasef_can(z.id,'host.view')),'[]');
 end if;
 select * into x from public.outreach_campaigns where id=c for update;
 if not found or not (private.phasef_can(c) or private.phasef_can(c,'host.view')) then raise exception 'Campaign access denied' using errcode='42501';end if;
 host:=private.phasef_host(c);manage:=private.phasef_can(c,'preevent.manage');
 if action='context' then
  b:=private.phasef_blockers(c);
  return jsonb_build_object('campaign',jsonb_build_object('id',c,'name',x.name,'status',x.status,'event_start',x.event_start,'registration_start',x.registration_start,'event_end',x.event_end,'setup_arrival',x.settings->>'setup_arrival','timezone',x.timezone,'city',x.city,'country',x.country,'venue',x.venue,'revision',x.revision,'organization_id',x.organization_id,'host_organization_id',x.host_organization_id,'host_name',(select name from public.organizations where id=x.host_organization_id)),
   'host_profile',(select to_jsonb(h)-'reviewed_by' from public.outreach_host_profiles h where h.owner_organization_id=x.organization_id and h.host_organization_id=x.host_organization_id),
   'assignments',case when private.outreach_admin(x.organization_id,true) then (select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'role',a.role_key,'email',u.email,'active',a.active)),'[]') from public.outreach_campaign_assignments a join auth.users u on u.id=a.user_id where a.campaign_id=c) else '[]'::jsonb end,
   'comments',(select coalesce(jsonb_agg(jsonb_build_object('step_id',z.step_id,'body',z.body,'created_at',z.created_at) order by z.created_at),'[]') from public.outreach_campaign_step_comments z where z.campaign_id=c and private.phasef_step_visible(c,z.step_id)),
   'host',host,'manage',manage,'respond',manage or private.phasef_can(c,'host.respond'),'inputs',x.settings->'workflow_inputs','settings',case when host then null else x.settings end,'training_gate',coalesce(x.settings->>'training_gate','required'),'registration_url',x.settings->>'public_registration_url','flyer',x.settings->'flyer',
   'blockers',case when host then (select coalesce(jsonb_agg('Task: '||(s.definition->>'title')),'[]') from public.outreach_campaign_steps s where s.campaign_id=c and private.phasef_step_visible(c,s.id) and (s.reconfirmation_required or private.outreach_step_state(c,s.step_key) not in ('completed','not_applicable'))) else b end,
   'ready',jsonb_array_length(b)=0,'packet_due_at',x.event_start-make_interval(days=>coalesce((x.settings->>'packet_due_days')::int,14)),
   'steps',(select coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('state',private.outreach_step_state(c,s.step_key)) order by position),'[]') from public.outreach_campaign_steps s where s.campaign_id=c and private.phasef_step_visible(c,s.id)),
   'documents',(select coalesce(jsonb_agg(to_jsonb(d) order by created_at desc),'[]') from public.outreach_campaign_documents d where d.campaign_id=c and private.phasef_doc_visible(c,d.id)),
   'resources',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.outreach_campaign_resources r where r.campaign_id=c and (not host or r.visibility in ('host_church','public_resource'))),
   'training',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('title',r.title,'url',r.source_url)),'[]') from public.outreach_campaign_training t join public.outreach_campaign_resources r on r.id=t.resource_id where t.campaign_id=c and (not host or t.assigned_user_id=auth.uid())),
   'agreement_version',(select to_jsonb(t) from public.outreach_agreement_versions t where t.organization_id=x.organization_id and t.id=(x.settings->>'agreement_version_id')::uuid),
   'agreements',(select coalesce(jsonb_agg(to_jsonb(a) order by version desc),'[]') from public.outreach_campaign_agreements a where a.campaign_id=c),
   'contacts',private.phasef_packet(c,host)->'contacts',
   'reminders',case when host then '[]'::jsonb else (select coalesce(jsonb_agg(to_jsonb(r) order by scheduled_at),'[]') from public.outreach_task_reminders r where campaign_id=c and state='pending') end,
   'events',case when host then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'delivery_state',e.delivery_state,'created_at',e.created_at) order by created_at desc),'[]') from public.outreach_campaign_events e where campaign_id=c) end,
   'packets',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'version',t.version,'state',t.state,'generated_at',t.generated_at,'current',t.campaign_revision=x.revision) order by version desc),'[]') from public.outreach_campaign_packets t where t.campaign_id=c),
   'team_ready',case when host then null else exists(select 1 from public.outreach_team_members where campaign_id=c and status='approved') end,
   'event_day_ready',case when host then null else exists(select 1 from public.outreach_event_areas where campaign_id=c and status='ready') end);
 end if;
 if action in ('packet_preview','packet_read') then
  if action='packet_preview' then return jsonb_build_object('snapshot',private.phasef_packet(c,host),'blockers',case when host then '[]'::jsonb else private.phasef_blockers(c) end);end if;
  select * into packet from public.outreach_campaign_packets where campaign_id=c and outreach_campaign_packets.id=(p->>'id')::uuid;
  if not found then raise exception 'Packet unavailable' using errcode='42501';end if;
  return jsonb_build_object('snapshot',case when host then packet.host_snapshot else packet.snapshot end,'generated_at',packet.generated_at,'version',packet.version,'current',packet.campaign_revision=x.revision);
 end if;
 if action='agreement_submit' then
  if not manage and not private.phasef_can(c,'host.respond') then raise exception 'Agreement access denied' using errcode='42501';end if;
  select * into v from public.outreach_agreement_versions where organization_id=x.organization_id and outreach_agreement_versions.id=(x.settings->>'agreement_version_id')::uuid;
  if not found then raise exception 'Reviewed agreement not configured; exact source mapping pending';end if;
  select * into a from public.outreach_campaign_agreements where campaign_id=c and request_key=(p->>'request_key')::uuid;
  if found then if a.responses<>p->'responses' or a.signature_name<>p->>'signature_name' or a.submitted_by<>auth.uid() or a.agreement_version_id<>v.id or (p->>'acknowledged')::boolean is distinct from true then raise exception 'Agreement retry differs';end if;return to_jsonb(a);end if;
  if exists(select 1 from public.outreach_campaign_agreements where campaign_id=c and agreement_version_id=v.id and status in ('submitted','approved')) then raise exception 'Current agreement already submitted';end if;
  if private.phasef_fields_valid(v.fields,p->'responses') is distinct from true then raise exception 'Agreement answers invalid';end if;
  insert into public.outreach_campaign_agreements(campaign_id,organization_id,agreement_version_id,request_key,version,text_snapshot,fields_snapshot,responses,signature_name,acknowledged,submitted_by,source)
  values(c,x.organization_id,v.id,(p->>'request_key')::uuid,coalesce((select max(version)+1 from public.outreach_campaign_agreements where campaign_id=c),1),v.text_snapshot,v.fields,p->'responses',p->>'signature_name',(p->>'acknowledged')::boolean,auth.uid(),v.source) returning * into a;
  perform private.outreach_audit(c,x.organization_id,'outreach.agreement.submitted',a.id,jsonb_build_object('version',a.version));return to_jsonb(a);
 end if;
 if action='training_status' then
  if not manage and not private.phasef_can(c,'host.respond') then raise exception 'Training response denied' using errcode='42501';end if;
  update public.outreach_campaign_training set state=p->>'state',viewed_at=coalesce(viewed_at,now()),completed_at=case when p->>'state'='completed' then coalesce(completed_at,now()) else completed_at end where campaign_id=c and outreach_campaign_training.id=(p->>'id')::uuid and assigned_user_id=auth.uid() and (state<>'completed' or p->>'state'='completed') and p->>'state' in ('viewed','completed') returning outreach_campaign_training.id into id;
  if not found then raise exception 'Own training unavailable' using errcode='42501';end if;
  perform private.outreach_audit(c,x.organization_id,'outreach.training.'||(p->>'state'),id);
  if p->>'state'='completed' then perform private.outreach_event(c,'outreach.training.completed',id,'f-training-complete:'||id);end if;return jsonb_build_object('saved',true);
 end if;
 if action='document_uploaded' then
  select * into d from public.outreach_campaign_documents where campaign_id=c and outreach_campaign_documents.id=(p->>'id')::uuid;
  if not found or not private.phasef_doc_visible(c,d.id) or (not manage and (not private.phasef_can(c,'host.respond') or d.requested_from<>auth.uid())) then raise exception 'Document access denied' using errcode='42501';end if;
  if d.status<>'requested' then return to_jsonb(d);end if;
  select metadata into item from storage.objects where bucket_id='outreach-campaign-documents' and name=d.object_path;
  if item is null or coalesce((item->>'size')::bigint,0) not between 1 and 10485760 or coalesce(item->>'mimetype','')<>all(array['application/pdf','image/png','image/jpeg','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) then raise exception 'Uploaded file unavailable';end if;
  update public.outreach_campaign_documents set status='uploaded',uploaded_at=now(),byte_size=(item->>'size')::bigint,mime_type=item->>'mimetype',revision=revision+1 where outreach_campaign_documents.id=d.id returning * into d;
  perform private.outreach_audit(c,x.organization_id,'outreach.document.uploaded',d.id);perform private.outreach_event(c,'outreach.document.uploaded',d.id,'f-doc-upload:'||d.id);return to_jsonb(d);
 end if;
 if action in ('step_complete','step_reopen','step_comment','step_reconfirm') then
  select * into s from public.outreach_campaign_steps where campaign_id=c and outreach_campaign_steps.id=(p->>'id')::uuid;
  if not found or not private.phasef_step_visible(c,s.id) or (not manage and (not private.phasef_can(c,'host.respond') or s.assigned_user_id is distinct from auth.uid())) then raise exception 'Task access denied' using errcode='42501';end if;
  if action='step_complete' and s.status='completed' then return to_jsonb(s);end if;
  if s.revision is distinct from (p->>'revision')::int then raise exception 'Task changed';end if;
  if action='step_comment' then insert into public.outreach_campaign_step_comments(campaign_id,step_id,actor_user_id,body) values(c,s.id,auth.uid(),p->>'body');
  elsif action='step_reopen' then
   if not manage or length(btrim(coalesce(p->>'note','')))<10 then raise exception 'Manager reopen reason required';end if;
   update public.outreach_campaign_steps set status='reopened',revision=revision+1,updated_at=now() where outreach_campaign_steps.id=s.id;
  elsif action='step_reconfirm' then
   if s.definition->>'completion_rule'='approved_agreement' and not exists(select 1 from public.outreach_campaign_agreements where campaign_id=c and agreement_version_id=(x.settings->>'agreement_version_id')::uuid and status='approved') then raise exception 'Current approved agreement required';end if;
   if length(btrim(coalesce(p->>'note','')))<10 then raise exception 'Reconfirmation note required';end if;
   update public.outreach_campaign_steps set reconfirmation_required=false,reconfirmed_at=now(),revision=revision+1,updated_at=now() where outreach_campaign_steps.id=s.id;
  else
   if private.outreach_step_state(c,s.step_key) not in ('ready','overdue') then raise exception 'Task prerequisites incomplete';end if;
   if coalesce((s.definition->>'approval_required')::boolean,false) and not manage then raise exception 'Task requires manager approval' using errcode='42501';end if;
   if s.definition->>'completion_rule'='approved_agreement' and not exists(select 1 from public.outreach_campaign_agreements where campaign_id=c and agreement_version_id=(x.settings->>'agreement_version_id')::uuid and status='approved') then raise exception 'Approved agreement required';end if;
   if s.definition->>'completion_rule'='assigned_training_complete' and coalesce(x.settings->>'training_gate','required')='required' and (not exists(select 1 from public.outreach_campaign_training where campaign_id=c and required) or exists(select 1 from public.outreach_campaign_training where campaign_id=c and required and state<>'completed')) then raise exception 'Required training incomplete';end if;
   if s.definition->>'completion_rule'='packet_generated' and not exists(select 1 from public.outreach_campaign_packets where campaign_id=c and campaign_revision=x.revision) then raise exception 'Current packet required';end if;
   if s.definition->>'completion_rule'='final_readiness' and jsonb_array_length(private.phasef_blockers(c))>0 then raise exception 'Readiness blockers remain';end if;
   for k in select jsonb_array_elements_text(coalesce(s.definition->'required_documents','[]')) loop if not exists(select 1 from public.outreach_campaign_documents where campaign_id=c and category=k and status='approved' and (expires_at is null or expires_at>coalesce(x.event_start,now()))) then raise exception 'Approved document required: %',k;end if;end loop;
   for k in select jsonb_array_elements_text(coalesce(s.definition->'required_fields','[]')) loop if coalesce(x.settings->'workflow_inputs'->>k,x.venue->>k,to_jsonb(x)->>k,'')='' or (k in ('personnel_final','inventory_confirmed') and x.settings->'workflow_inputs'->>k is distinct from 'true') then raise exception 'Required field: %',k;end if;end loop;
   update public.outreach_campaign_steps set status='completed',completed_by=auth.uid(),completed_at=now(),completion_note=coalesce(p->>'note',''),updated_at=now(),revision=revision+1 where outreach_campaign_steps.id=s.id;
   perform private.outreach_event(c,'workflow.step_completed',s.id,'f-complete:'||s.id||':'||(s.revision+1));
  end if;
  if action in ('step_reopen','step_reconfirm') then update public.outreach_campaigns set revision=revision+1 where outreach_campaigns.id=c;end if;
  perform private.outreach_event(c,'outreach.final_readiness.changed',s.id,'f-readiness:'||s.id||':'||action||':'||(s.revision+1));
  perform private.outreach_audit(c,x.organization_id,'outreach.task.'||action,s.id,jsonb_build_object('revision',s.revision+1));return jsonb_build_object('saved',true);
 end if;
 if action='host_information' then
  if not private.phasef_can(c,'host.respond') then raise exception 'Host response required' using errcode='42501';end if;
  if exists(select 1 from jsonb_object_keys(p) k where k<>all(array['revision','venue','registration_start','event_end','setup_arrival','workflow_inputs'])) or jsonb_typeof(p->'venue') is distinct from 'object' or exists(select 1 from jsonb_each(p->'venue') z where z.key<>all(array['site_name','address','load_in_route','parking_notes']) or jsonb_typeof(z.value)<>'string' or length(z.value#>>'{}')>2000) or jsonb_typeof(p->'workflow_inputs') is distinct from 'object' or exists(select 1 from jsonb_object_keys(p->'workflow_inputs') k where k<>all(array['flyers','bikes_enabled','tablets_enabled','bikes_quantity','tablets_quantity','bikes_responsibility','tablets_responsibility','permits_required','insurance_required','semi_parking','box_truck_parking','bus_rv_staging'])) then raise exception 'Only host event responses permitted';end if;
  if not exists(select 1 from public.outreach_campaign_agreements where campaign_id=c and agreement_version_id=(x.settings->>'agreement_version_id')::uuid and status='approved') then raise exception 'Approved agreement required before event responses';end if;
  p:=p||jsonb_build_object('workflow_inputs',coalesce(x.settings->'workflow_inputs','{}')||(p->'workflow_inputs'),'venue',x.venue||(p->'venue'));host_request:=true;action:='configure';
 end if;
 if not manage and not host_request then raise exception 'Pre-event management required' using errcode='42501';end if;
 if action='agreement_review' then
  select * into a from public.outreach_campaign_agreements where campaign_id=c and outreach_campaign_agreements.id=(p->>'id')::uuid;
  if not found or a.revision is distinct from (p->>'revision')::int or a.status<>'submitted' then raise exception 'Agreement review changed';end if;
  if p->>'status' not in ('approved','rejected','needs_changes') or (p->>'status'<>'approved' and length(btrim(coalesce(p->>'note','')))<3) then raise exception 'Review reason required';end if;
  update public.outreach_campaign_agreements set status=p->>'status',reviewed_by=auth.uid(),reviewed_at=now(),review_note=coalesce(p->>'note',''),revision=revision+1 where outreach_campaign_agreements.id=a.id returning * into a;
  perform private.outreach_audit(c,x.organization_id,'outreach.agreement.reviewed',a.id,jsonb_build_object('status',a.status));
  if a.status='approved' then perform private.outreach_event(c,'outreach.agreement.completed',a.id,'f-agreement-approved:'||a.id);end if;return to_jsonb(a);
 elsif action='configure' then
  if exists(select 1 from jsonb_object_keys(p) k where k<>all(array['revision','workflow_inputs','venue','event_start','event_end','registration_start','public_registration_url','training_gate','packet_due_days','details_due_days','agreement_version_id','production_notes','setup_arrival','flyer','qr_request_state'])) then raise exception 'Unsupported configuration';end if;
  if x.revision is distinct from (p->>'revision')::int then raise exception 'Campaign changed';end if;
  value:=coalesce(p->'workflow_inputs',x.settings->'workflow_inputs','{}');
  if private.phasef_inputs_valid(value) is distinct from true then raise exception 'Invalid operational inputs';end if;
  if p ? 'public_registration_url' and p->>'public_registration_url'<>'' and p->>'public_registration_url' !~ '^https://[^[:space:]@]+$' then raise exception 'HTTPS registration URL required';end if;
  if p ? 'agreement_version_id' and not exists(select 1 from public.outreach_agreement_versions where organization_id=x.organization_id and outreach_agreement_versions.id=(p->>'agreement_version_id')::uuid) then raise exception 'Agreement outside organization';end if;
  if p ? 'training_gate' and p->>'training_gate' not in ('required','warning') then raise exception 'Invalid training gate';end if;
  if p ? 'packet_due_days' and (p->>'packet_due_days')::int not between 1 and 365 then raise exception 'Invalid packet deadline';end if;
  if p ? 'details_due_days' and (p->>'details_due_days')::int not between 1 and 365 then raise exception 'Invalid detail deadline';end if;
  if p ? 'agreement_version_id' and p->>'agreement_version_id' is distinct from x.settings->>'agreement_version_id' then update public.outreach_campaign_steps set reconfirmation_required=true,revision=revision+1 where campaign_id=c and status='completed' and definition->>'completion_rule'='approved_agreement';end if;
  update public.outreach_campaigns set settings=settings||jsonb_build_object('workflow_inputs',value)|| (p-array['revision','workflow_inputs','venue','event_start','event_end','registration_start','status']),
  venue=coalesce(p->'venue',venue),event_start=case when p ? 'event_start' then (p->>'event_start')::timestamptz else event_start end,event_end=case when p ? 'event_end' then (p->>'event_end')::timestamptz else event_end end,registration_start=case when p ? 'registration_start' then (p->>'registration_start')::timestamptz else registration_start end,revision=revision+1 where outreach_campaigns.id=c returning * into x;
  for k in select unnest(array['bikes','tablets']) loop
   if value->>(k||'_responsibility')='champion_sowgo' and coalesce((value->>(k||'_enabled'))::boolean,false) then
    perform private.outreach_event(c,'outreach.cost_impact_detected',c,c||':cost:'||k||':'||x.revision);
    insert into public.outreach_campaign_step_comments(campaign_id,step_id,actor_user_id,body) select c,s.id,auth.uid(),initcap(k)||' purchase/transport requires coordinator action. Quantity: '||coalesce(value->>(k||'_quantity'),'unknown')||'. Cost impact: unknown; resolution pending.' from public.outreach_campaign_steps s where s.campaign_id=c and s.step_key='procurement';
   end if;
  end loop;
  if length(coalesce(x.settings->>'public_registration_url',''))>0 and x.registration_start is not null and length(coalesce(x.venue->>'site_name',''))>0 then perform private.outreach_event(c,'outreach.registration.qr_requested',c,c||':qr:'||x.revision);end if;
  perform private.outreach_audit(c,x.organization_id,'outreach.pre_event.configured',c);return to_jsonb(x);
 elsif action in ('reschedule','postpone') then
  if x.revision is distinct from (p->>'revision')::int or length(btrim(coalesce(p->>'reason','')))<3 then raise exception 'Current revision and reason required';end if;
  if action='reschedule' and p->>'event_start' is null then raise exception 'New date required';end if;
  update public.outreach_campaigns set status=case when action='postpone' then 'postponed' else 'rescheduled' end,event_start=case when action='reschedule' then (p->>'event_start')::timestamptz else event_start end,event_end=case when action='reschedule' then (p->>'event_end')::timestamptz else event_end end,registration_start=case when action='reschedule' then (p->>'registration_start')::timestamptz else registration_start end,settings=settings||jsonb_build_object('schedule_reason',p->>'reason','postpone_reason_kind',coalesce(p->>'reason_kind','other')),revision=revision+1 where outreach_campaigns.id=c returning * into x;
  if action='postpone' then perform private.outreach_event(c,'outreach.campaign.postponed',c,c||':postponed:'||x.revision);end if;
  perform private.outreach_audit(c,x.organization_id,'outreach.campaign.'||action,c);perform private.phasef_reminders(c);return to_jsonb(x);
 elsif action='host_profile_save' then
  update public.outreach_host_profiles set address=coalesce(p->>'address',address),phone=coalesce(p->>'phone',phone),website=nullif(p->>'website',''),reviewed_by=auth.uid(),reviewed_at=now(),revision=revision+1 where owner_organization_id=x.organization_id and host_organization_id=x.host_organization_id and revision=(p->>'revision')::int;
  if not found then raise exception 'Host profile changed';end if;perform private.outreach_audit(c,x.organization_id,'outreach.host.reviewed',x.host_organization_id);return jsonb_build_object('saved',true);
 elsif action='reminders' then return private.phasef_reminders(c);
 elsif action='reminder_acknowledge' then
  update public.outreach_task_reminders set state='acknowledged' where campaign_id=c and outreach_task_reminders.id=(p->>'id')::uuid and state='pending' returning outreach_task_reminders.id into id;
  if id is not null then perform private.outreach_audit(c,x.organization_id,'outreach.reminder.acknowledged',id);end if;return jsonb_build_object('saved',id is not null);
 elsif action='step_assign' then
  if p->>'user_id' is not null and not exists(select 1 from public.outreach_campaign_assignments where campaign_id=c and user_id=(p->>'user_id')::uuid and active and effective_at<=now() and (expires_at is null or expires_at>now()) and private.outreach_verified(user_id)) then raise exception 'Assignee outside campaign';end if;
  update public.outreach_campaign_steps set assigned_user_id=(p->>'user_id')::uuid,priority=coalesce(p->>'priority','normal'),revision=revision+1,updated_at=now() where campaign_id=c and outreach_campaign_steps.id=(p->>'id')::uuid and revision=(p->>'revision')::int;
  if not found then raise exception 'Task changed';end if;perform private.outreach_audit(c,x.organization_id,'outreach.task.assigned',(p->>'id')::uuid);return jsonb_build_object('saved',true);
 elsif action='document_request' then
  if p->>'requested_from' is not null and not exists(select 1 from public.outreach_campaign_assignments where campaign_id=c and user_id=(p->>'requested_from')::uuid and active and effective_at<=now() and (expires_at is null or expires_at>now()) and private.outreach_verified(user_id)) then raise exception 'Requested account outside campaign';end if;
  if p->>'visibility'='restricted' and not private.outreach_admin(x.organization_id,true) then raise exception 'Restricted document requires administrator';end if;
  id:=gen_random_uuid();
  if p->>'replaces_id' is not null then select * into d from public.outreach_campaign_documents where campaign_id=c and outreach_campaign_documents.id=(p->>'replaces_id')::uuid; if not found or not private.phasef_doc_visible(c,d.id) then raise exception 'Prior version outside campaign';end if;end if;
  insert into public.outreach_campaign_documents(id,campaign_id,category,title,requested_from,due_at,visibility,replaces_id,version,object_path,phase_f,instructions,expires_at) values(id,c,p->>'category',p->>'title',(p->>'requested_from')::uuid,(p->>'due_at')::timestamptz,coalesce(d.visibility,p->>'visibility','host_church'),d.id,coalesce(d.version+1,1),c||'/'||id||'/file',true,coalesce(p->>'instructions',''),(p->>'expires_at')::timestamptz) returning * into d;
  perform private.outreach_audit(c,x.organization_id,'outreach.document.requested',id);perform private.outreach_event(c,'outreach.document.requested',id,'f-doc-request:'||id);return to_jsonb(d);
 elsif action='document_review' then
  select * into d from public.outreach_campaign_documents where campaign_id=c and outreach_campaign_documents.id=(p->>'id')::uuid;
  if not found or not d.phase_f or not private.phasef_doc_visible(c,d.id) or d.status<>'uploaded' or d.revision is distinct from (p->>'revision')::int then raise exception 'Document review changed';end if;
  if p->>'status' not in ('approved','rejected','needs_changes') or (p->>'status'<>'approved' and length(btrim(coalesce(p->>'note','')))<3) then raise exception 'Review reason required';end if;
  update public.outreach_campaign_documents set status=p->>'status',reviewed_by=auth.uid(),reviewed_at=now(),review_note=coalesce(p->>'note',''),revision=revision+1 where outreach_campaign_documents.id=d.id returning * into d;
  perform private.outreach_audit(c,x.organization_id,'outreach.document.reviewed',d.id,jsonb_build_object('status',d.status));if d.status='approved' then perform private.outreach_event(c,'outreach.document.approved',d.id,'f-doc-approved:'||d.id);end if;return to_jsonb(d);
 elsif action='training_assign' then
  if not exists(select 1 from public.outreach_campaign_assignments where campaign_id=c and user_id=(p->>'user_id')::uuid and active and effective_at<=now() and (expires_at is null or expires_at>now()) and private.outreach_verified(user_id)) or not exists(select 1 from public.outreach_campaign_resources where campaign_id=c and outreach_campaign_resources.id=(p->>'resource_id')::uuid and resource_type in ('training','packet') and capture_state='available') then raise exception 'Resource or assignee outside campaign';end if;
  insert into public.outreach_campaign_training(campaign_id,resource_id,assigned_user_id,assigned_role,required) values(c,(p->>'resource_id')::uuid,(p->>'user_id')::uuid,p->>'role',coalesce((p->>'required')::boolean,true)) on conflict(resource_id,assigned_user_id) do nothing returning outreach_campaign_training.id into id;
  if id is not null then perform private.outreach_event(c,'outreach.training.assigned',id,'f-training-assigned:'||id);perform private.outreach_audit(c,x.organization_id,'outreach.training.assigned',id);end if;return jsonb_build_object('saved',true);
 elsif action='resource_save' then
  if p->>'source_url' is not null and p->>'source_url' !~ '^https://[^[:space:]@]+$' then raise exception 'HTTPS resource required';end if;
  if p->>'document_id' is not null and not exists(select 1 from public.outreach_campaign_documents where campaign_id=c and outreach_campaign_documents.id=(p->>'document_id')::uuid and status='approved') then raise exception 'Approved campaign document required';end if;
  insert into public.outreach_campaign_resources(campaign_id,resource_key,title,resource_type,source_url,document_id,capture_state,visibility,version) values(c,p->>'resource_key',p->>'title',p->>'resource_type',p->>'source_url',(p->>'document_id')::uuid,'available',coalesce(p->>'visibility','host_church'),coalesce((p->>'version')::int,1)) returning outreach_campaign_resources.id into id;
  perform private.outreach_audit(c,x.organization_id,'outreach.resource.published',id);return jsonb_build_object('id',id);
 elsif action='packet_generate' then
  select * into packet from public.outreach_campaign_packets where campaign_id=c and generation_key=(p->>'generation_key')::uuid;
  if found then return jsonb_build_object('id',packet.id,'version',packet.version,'generated_at',packet.generated_at);end if;
  b:=private.phasef_blockers(c);if jsonb_array_length(b)>0 then raise exception 'Packet blocked: %',b;end if;
  insert into public.outreach_campaign_packets(campaign_id,generation_key,version,campaign_revision,state,snapshot,host_snapshot,generated_by) values(c,(p->>'generation_key')::uuid,coalesce((select max(version)+1 from public.outreach_campaign_packets where campaign_id=c),1),x.revision,case when exists(select 1 from public.outreach_campaign_packets where campaign_id=c) then 'updated' else 'final' end,private.phasef_packet(c,false),private.phasef_packet(c,true),auth.uid()) returning * into packet;
  perform private.outreach_audit(c,x.organization_id,'outreach.packet.generated',packet.id,jsonb_build_object('version',packet.version));perform private.outreach_event(c,'outreach.packet.ready',packet.id,'f-packet-ready:'||packet.id);perform private.outreach_event(c,'outreach.packet.generated',packet.id,'f-packet:'||packet.id);return jsonb_build_object('id',packet.id,'version',packet.version,'generated_at',packet.generated_at);
 end if;
 raise exception 'Unsupported pre-event action';end$$;

create function public.outreach_pre_event_workspace(p_action text,p_campaign uuid default null,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.phasef_workspace(p_action,p_campaign,p_payload)$$;

-- Route Phase F snapshots through the stronger completion gates, retaining legacy v1 behavior.
alter function private.outreach_workflow(text,uuid,jsonb) rename to phasef_previous_workflow;

create function private.outreach_workflow(p_action text,p_campaign uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if p_action in ('complete','reopen','comment','assign') and exists(select 1 from public.outreach_campaign_steps where campaign_id=p_campaign and id=(p_payload->>'id')::uuid and definition->>'phase_f'='true') then
  return private.phasef_workspace(case p_action when 'complete' then 'step_complete' when 'reopen' then 'step_reopen' when 'comment' then 'step_comment' else 'step_assign' end,p_campaign,p_payload);
 end if;return private.phasef_previous_workflow(p_action,p_campaign,p_payload);end$$;

alter function private.outreach_core(text,uuid,jsonb) rename to phasef_previous_core;

create function private.outreach_core(p_action text,p_campaign uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if p_action='configure' and exists(select 1 from public.outreach_campaigns where id=p_campaign and settings->>'phase_f'='true') then return private.phasef_workspace('configure',p_campaign,coalesce(p_payload->'settings','{}')||(p_payload-'settings'));end if;
 if p_action='approve' and (exists(select 1 from public.outreach_workflow_templates where id=(p_payload->>'template_id')::uuid and steps->0->>'phase_f'='true') or exists(select 1 from public.outreach_campaigns where opportunity_id=(p_payload->>'id')::uuid and settings->>'phase_f'='true')) then
  return private.phasef_workspace('convert',null,p_payload);
 end if;
 return private.phasef_previous_core(p_action,p_campaign,p_payload);end$$;

-- Revoke renamed entry points: callers cannot sidestep native gates.
revoke all on function private.phasef_previous_core(text,uuid,jsonb),private.phasef_previous_workflow(text,uuid,jsonb) from public,anon,authenticated;

-- RLS and RPC-only relations; all signatures default-denied, then narrow grants.
do $$declare n text;r record;begin
 foreach n in array array['outreach_host_profiles','outreach_agreement_versions','outreach_campaign_agreements','outreach_task_reminders','outreach_campaign_packets','outreach_interest_channels'] loop
 execute format('alter table public.%I enable row level security',n);execute format('revoke all on public.%I from public,anon,authenticated',n);execute format('grant all on public.%I to service_role',n);end loop;
 for r in select p.oid::regprocedure fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'phasef_%' loop execute format('revoke all on function %s from public,anon,authenticated',r.fn);end loop;
end$$;

revoke all on function public.outreach_interest_gateway(text,jsonb,text,text,text),public.outreach_pre_event_workspace(text,uuid,jsonb),private.outreach_core(text,uuid,jsonb),private.outreach_workflow(text,uuid,jsonb),private.outreach_template_valid(jsonb) from public,anon,authenticated;

grant execute on function private.phasef_workspace(text,uuid,jsonb),public.outreach_pre_event_workspace(text,uuid,jsonb),private.outreach_core(text,uuid,jsonb),private.outreach_workflow(text,uuid,jsonb) to authenticated;

grant execute on function private.phasef_interest_gateway(text,jsonb,text,text,text),public.outreach_interest_gateway(text,jsonb,text,text,text) to service_role;

-- Two configured consumers, disabled until separately approved deployment/abuse-control acceptance.
insert into public.outreach_interest_channels(slug,organization_id,source_website) select slug,id,case slug when 'sowgo' then 'https://sowgo.org' else 'https://championlifefwb.com' end from public.organizations where slug in ('champion-life','sowgo');

-- Immutable source-informed version 2. Existing campaign snapshots/seeds are untouched.
insert into public.outreach_workflow_templates(template_key,version,title,steps) values('outreach_source_workflow',2,'SowGo / Champion Life Pre-Event Workflow','[{"key": "host_setup", "title": "Host Church Contact Setup", "category": "host_setup", "role": "local_coordinator", "order": 10, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Host Church Contact Setup. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -45, "reconfirm_on_change": false}, {"key": "welcome", "title": "Welcome / Portal Access", "category": "welcome", "role": "outreach_coordinator", "order": 20, "active": true, "required": true, "phase_f": true, "visibility": "internal", "instructions": "Confirm and complete Welcome / Portal Access. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -45, "reconfirm_on_change": false, "depends_on": ["host_setup"]}, {"key": "agreement", "title": "Outreach Agreement & Pre-Checklist", "category": "agreement", "role": "host_pastor", "order": 30, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Outreach Agreement & Pre-Checklist. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -45, "reconfirm_on_change": false, "depends_on": ["welcome"], "completion_rule": "approved_agreement", "approval_required": true, "required_form": "agreement", "signature_required": true}, {"key": "procurement", "title": "Cost / Procurement Decisions", "category": "procurement", "role": "outreach_coordinator", "order": 40, "active": true, "required": true, "phase_f": true, "visibility": "internal", "instructions": "Confirm and complete Cost / Procurement Decisions. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -45, "reconfirm_on_change": false, "depends_on": ["agreement"]}, {"key": "production", "title": "Production Packet", "category": "production", "role": "local_coordinator", "order": 50, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Production Packet. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -45, "reconfirm_on_change": false, "depends_on": ["agreement"], "required_documents": ["production_packet"]}, {"key": "training", "title": "Training", "category": "training", "role": "host_pastor", "order": 60, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Training. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -45, "reconfirm_on_change": false, "depends_on": ["agreement"], "completion_rule": "assigned_training_complete"}, {"key": "event_details", "title": "Event Details", "category": "event_details", "role": "local_coordinator", "order": 70, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Event Details. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -30, "reconfirm_on_change": true, "depends_on": ["agreement"]}, {"key": "venue", "title": "Venue / Site Information", "category": "venue", "role": "local_coordinator", "order": 80, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Venue / Site Information. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -30, "reconfirm_on_change": true, "depends_on": ["agreement"], "required_documents": ["site_layout"], "required_fields": ["site_name", "address"]}, {"key": "permits", "title": "Permits", "category": "permits", "role": "local_coordinator", "order": 90, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Permits. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -30, "reconfirm_on_change": true, "depends_on": ["agreement"], "condition": {"field": "permits_required", "equals": "yes"}, "required_documents": ["permits"]}, {"key": "insurance", "title": "Insurance", "category": "insurance", "role": "local_coordinator", "order": 100, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Insurance. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -30, "reconfirm_on_change": true, "depends_on": ["agreement"], "condition": {"field": "insurance_required", "equals": "yes"}, "required_documents": ["insurance"]}, {"key": "flyers", "title": "Promotion / Flyers", "category": "promotion", "role": "local_coordinator", "order": 110, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Promotion / Flyers. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -30, "reconfirm_on_change": true, "depends_on": ["agreement"], "condition": {"field": "flyers", "equals": true}, "required_documents": ["flyers"]}, {"key": "registration_qr", "title": "Public Registration / QR", "category": "registration", "role": "outreach_coordinator", "order": 120, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Public Registration / QR. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -30, "reconfirm_on_change": true, "depends_on": ["agreement"]}, {"key": "team_travel", "title": "Team Signup / Travel", "category": "team", "role": "logistics_lead", "order": 130, "active": true, "required": true, "phase_f": true, "visibility": "internal", "instructions": "Confirm and complete Team Signup / Travel. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -30, "reconfirm_on_change": true, "depends_on": ["agreement"]}, {"key": "personnel_inventory", "title": "Personnel / Inventory", "category": "inventory", "role": "logistics_lead", "order": 140, "active": true, "required": true, "phase_f": true, "visibility": "internal", "instructions": "Confirm and complete Personnel / Inventory. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -30, "reconfirm_on_change": true, "depends_on": ["agreement"], "required_fields": ["personnel_final", "inventory_confirmed"]}, {"key": "final_packet", "title": "Final Event Information Packet", "category": "final_packet", "role": "outreach_coordinator", "order": 150, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Final Event Information Packet. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -14, "reconfirm_on_change": true, "depends_on": ["event_details", "venue", "permits", "insurance", "personnel_inventory"], "completion_rule": "packet_generated"}, {"key": "final_readiness", "title": "Final Readiness", "category": "final_readiness", "role": "outreach_coordinator", "order": 160, "active": true, "required": true, "phase_f": true, "visibility": "internal", "instructions": "Confirm and complete Final Readiness. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -14, "reconfirm_on_change": true, "depends_on": ["final_packet"], "completion_rule": "final_readiness"}, {"key": "event_day", "title": "Event Day", "category": "event_day", "role": "internal_team", "order": 170, "active": true, "required": false, "phase_f": true, "visibility": "internal", "instructions": "Confirm and complete Event Day. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": 0, "reconfirm_on_change": false, "depends_on": ["final_readiness"]}, {"key": "post_event", "title": "Post-Event Follow-Up", "category": "post_event", "role": "local_coordinator", "order": 180, "active": true, "required": false, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Post-Event Follow-Up. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": 0, "reconfirm_on_change": false, "depends_on": ["event_day"]}]'::jsonb);

alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;

-- Additive installed capability union; accepted NMI pattern.
do $$declare keys text[];begin
 keys:=array(select distinct k from unnest(private.staff_permission_keys()||array['people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage','staff.view','staff.manage','finance.read','finance.configure','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage','events.view','events.manage','registrations.view','registrations.manage','outreach.view','outreach.manage','courses.manage','forms.view','forms.manage','checkin.view','checkin.manage','registrations.restricted','registrations.override','dream_team.application.read','dream_team.application.manage','dream_team.application.restricted','dream_team.placement.manage','communications.send','communications.view','communications.bulk_send','communications.templates.view','communications.templates.manage','communications.delivery.view']::text[])k order by k);
execute format('alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check(permission=any(%L::text[]))',keys);
end $$;

-- Additive installed capability union; accepted NMI pattern.
do $$declare keys text[];begin
 keys:=array(select distinct k from unnest(private.staff_permission_keys()||array['people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage','staff.view','staff.manage','finance.read','finance.configure','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage','events.view','events.manage','registrations.view','registrations.manage','outreach.view','outreach.manage','courses.manage','forms.view','forms.manage','checkin.view','checkin.manage','registrations.restricted','registrations.override','dream_team.application.read','dream_team.application.manage','dream_team.application.restricted','dream_team.placement.manage','communications.send','communications.view','communications.bulk_send','communications.templates.view','communications.templates.manage','communications.delivery.view']::text[])k order by k);
execute format('create or replace function private.staff_permission_keys() returns text[] language sql immutable set search_path='''' as %L','select '||quote_literal(keys)||'::text[]');
end $$;

create table public.communication_settings (
 organization_id uuid primary key references public.organizations(id),
 delivery_mode text not null default 'disabled' check(delivery_mode in ('disabled','acceptance_sink')),
 timezone text not null default 'UTC', quiet_start integer check(quiet_start between 0 and 23), quiet_end integer check(quiet_end between 0 and 23),
 window_seconds integer not null default 3600 check(window_seconds between 60 and 86400),
 organization_limit integer not null default 10000 check(organization_limit>0), campaign_limit integer not null default 5000 check(campaign_limit>0), user_limit integer not null default 2000 check(user_limit>0), recipient_limit integer not null default 20 check(recipient_limit>0),
 max_attempts integer not null default 4 check(max_attempts between 1 and 10), retention_days integer not null default 180 check(retention_days>=1),
 approved_link_origins text[] not null default '{}', check((quiet_start is null)=(quiet_end is null)), check(quiet_start is null or quiet_start<>quiet_end)
);

create table public.communication_sender_profiles (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 channel text not null check(channel in ('email','sms')), provider text not null check(provider in ('acceptance_sink','smtp_transport','sms_transport')),
 display_name text not null check(length(display_name) between 1 and 120), from_address text not null check(length(from_address) between 1 and 320 and from_address !~ E'[\r\n]'),
 reply_to text check(reply_to is null or (length(reply_to)<=320 and reply_to !~ E'[\r\n]')), footer text not null default '' check(length(footer)<=1000), support_contact text not null default '' check(length(support_contact)<=320),
 active boolean not null default false, approved_at timestamptz, unique(organization_id,id), check(not active or approved_at is not null)
);

create table public.communication_templates (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), template_key text not null check(template_key ~ '^[a-z0-9_]{1,80}$'),
 channel text not null check(channel in ('email','sms')), message_type text not null check(message_type in ('transactional','operational','reminder','follow_up','campaign','marketing','receipt','security')),
 purpose text not null check(purpose in ('transactional','event_updates','follow_up','discipleship','marketing','donation_receipts')),
 version integer not null check(version>0), locale text not null default 'en' check(locale ~ '^[a-zA-Z-]{2,15}$'),
 subject text not null default '' check(length(subject)<=240 and subject !~ E'[\r\n]'), body text not null check(length(body) between 1 and 12000),
 state text not null default 'draft' check(state in ('draft','published')), active boolean not null default false, revision integer not null default 1,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), published_at timestamptz,
 unique(organization_id,id), unique(organization_id,template_key,channel,locale,version), check(not active or state='published'), check(message_type<>'marketing' or purpose='marketing')
);

create unique index communication_one_active_template on public.communication_templates(organization_id,template_key,channel,locale) where active;

create table public.communication_consents (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), campaign_id uuid,
 recipient_key text not null, channel text not null check(channel in ('email','sms')), purpose text not null check(purpose in ('transactional','event_updates','follow_up','discipleship','marketing','donation_receipts')),
 status text not null check(status in ('granted','revoked')), source text not null check(length(source) between 1 and 100), proof_reference text not null check(length(proof_reference) between 5 and 500),
 recorded_by uuid references auth.users(id), recorded_at timestamptz not null default now(), revoked_at timestamptz,
 foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id)
);

create unique index communication_consent_scope on public.communication_consents(organization_id,coalesce(campaign_id,'00000000-0000-0000-0000-000000000000'::uuid),recipient_key,channel,purpose);

create table public.communication_preferences (
 organization_id uuid not null references public.organizations(id), recipient_key text not null,
 email_allowed boolean not null default true, sms_allowed boolean not null default true, preferred_channel text check(preferred_channel in ('email','sms')), timezone text not null default 'UTC',
 primary key(organization_id,recipient_key)
);

create table public.communication_suppressions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), channel text not null check(channel in ('email','sms')), address text not null,
 reason text not null check(reason in ('stop','unsubscribe','hard_bounce','complaint','admin','invalid_address')), active boolean not null default true, created_at timestamptz not null default now(), cleared_at timestamptz,
 unique(organization_id,channel,address,reason)
);

create table public.communication_batches (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), campaign_id uuid,
 request_key uuid not null, created_by uuid not null references auth.users(id), request_snapshot jsonb not null, recipients jsonb not null,
 channel text not null check(channel in ('email','sms')), message_type text not null, purpose text not null,
 template_id uuid, sender_profile_id uuid not null, subject text not null, body text not null, variables jsonb not null default '{}',
 campaign_revision integer, state text not null default 'draft' check(state in ('draft','queued','cancelled')), created_at timestamptz not null default now(), confirmed_at timestamptz,
 scheduled_at timestamptz not null default now(), unique(organization_id,request_key), unique(organization_id,id),
 foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id),
 foreign key(organization_id,template_id) references public.communication_templates(organization_id,id), foreign key(organization_id,sender_profile_id) references public.communication_sender_profiles(organization_id,id)
);

create table public.communication_outbox (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), campaign_id uuid, batch_id uuid,
 recipient_key text not null, recipient_name text not null, address_snapshot text not null, channel text not null check(channel in ('email','sms')),
 message_type text not null check(message_type in ('transactional','operational','reminder','follow_up','campaign','marketing','receipt','security')), purpose text not null,
 template_id uuid, sender_profile_id uuid not null, subject text not null, rendered_body text not null,
 status text not null default 'queued' check(status in ('draft','queued','scheduled','sending','sent','delivered','failed','suppressed','cancelled')),
 scheduled_at timestamptz not null default now(), created_at timestamptz not null default now(), sent_at timestamptz, delivered_at timestamptz, failed_at timestamptz,
 attempts integer not null default 0, provider text, provider_message_id text, failure_class text, lease_token uuid, lease_until timestamptz, dispatch_authorized_at timestamptz,
 source_event_id uuid references public.outreach_campaign_events(id), source_reminder_id uuid references public.outreach_task_reminders(id), source_step_id uuid references public.outreach_campaign_steps(id), source_due_at timestamptz, source_campaign_revision integer,
 idempotency_key text not null check(length(idempotency_key) between 1 and 500), audit_reference uuid not null default gen_random_uuid(),
 credits_estimated integer not null default 0 check(credits_estimated>=0), credits_reserved integer not null default 0 check(credits_reserved>=0), credits_consumed integer not null default 0 check(credits_consumed>=0), credits_released integer not null default 0 check(credits_released>=0),
 unique(organization_id,idempotency_key), unique(organization_id,id),
 foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id), foreign key(organization_id,batch_id) references public.communication_batches(organization_id,id),
 foreign key(organization_id,template_id) references public.communication_templates(organization_id,id), foreign key(organization_id,sender_profile_id) references public.communication_sender_profiles(organization_id,id)
);

create index communication_due_idx on public.communication_outbox(organization_id,status,scheduled_at);

create index communication_history_idx on public.communication_outbox(organization_id,recipient_key,created_at desc);

create unique index communication_provider_id_idx on public.communication_outbox(organization_id,provider,provider_message_id) where provider_message_id is not null;

create table public.communication_attempts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, message_id uuid not null, attempt integer not null, lease_token uuid not null unique,
 started_at timestamptz not null default now(), finished_at timestamptz, outcome text, failure_class text,
 foreign key(organization_id,message_id) references public.communication_outbox(organization_id,id), unique(message_id,attempt)
);

create table public.communication_callbacks (
 organization_id uuid not null, provider text not null, event_id text not null check(length(event_id) between 1 and 200), message_id uuid not null, outcome text not null, received_at timestamptz not null default now(),
 primary key(organization_id,provider,event_id), foreign key(organization_id,message_id) references public.communication_outbox(organization_id,id)
);

create table public.communication_keyword_events(organization_id uuid not null references public.organizations(id),event_id text not null,keyword text not null,created_at timestamptz not null default now(),primary key(organization_id,event_id));

create table public.communication_routes (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, campaign_id uuid not null, event_kind text not null check(length(event_kind)<=100), template_id uuid not null, sender_profile_id uuid not null,
 audience jsonb not null, enabled boolean not null default false, approved_by uuid references auth.users(id), approved_at timestamptz,
 unique(campaign_id,event_kind,template_id), foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id),
 foreign key(organization_id,template_id) references public.communication_templates(organization_id,id), foreign key(organization_id,sender_profile_id) references public.communication_sender_profiles(organization_id,id), check(not enabled or approved_at is not null)
);

create table public.communication_event_consumption (
 organization_id uuid not null references public.organizations(id), route_id uuid not null references public.communication_routes(id), event_id uuid not null references public.outreach_campaign_events(id), consumed_at timestamptz not null default now(), primary key(organization_id,route_id,event_id)
);

create table public.communication_audit (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), campaign_id uuid, actor uuid references auth.users(id), kind text not null,
 subject_id uuid, metadata jsonb not null default '{}', created_at timestamptz not null default now(), foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id)
);

-- Append-only audit and immutable published message content. No provider secrets in these relations.
create function private.comm_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_TABLE_NAME='communication_audit' then raise exception 'Immutable communications audit'; end if;
 if old.state='published' and (TG_OP='DELETE' or (to_jsonb(new)-'active') is distinct from (to_jsonb(old)-'active')) then raise exception 'Published template is immutable';end if;
 if TG_OP='DELETE' then return old;end if;return new;
end$$;

create trigger communication_template_immutable before update or delete on public.communication_templates for each row execute function private.comm_immutable();

create trigger communication_audit_immutable before update or delete on public.communication_audit for each row execute function private.comm_immutable();

create function private.comm_lock(o uuid) returns void language sql security definer set search_path='' as $$ select pg_advisory_xact_lock(hashtextextended('communications:'||o::text,0)) $$;

create function private.comm_can(o uuid,c uuid,k text) returns boolean language sql volatile security definer set search_path='' as $$
 select private.outreach_verified(auth.uid()) and (c is null or exists(select 1 from public.outreach_campaigns where id=c and organization_id=o)) and
 (private.has_staff_permission(o,k) or (c is not null and exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c and a.user_id=auth.uid() and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and k=any(a.capabilities))))
$$;

create function private.comm_audit(o uuid,c uuid,k text,s uuid default null,m jsonb default '{}') returns void language sql security definer set search_path='' as $$
 insert into public.communication_audit(organization_id,campaign_id,actor,kind,subject_id,metadata) values(o,c,auth.uid(),k,s,m)
$$;

create function private.comm_address(ch text,a text) returns text language sql immutable set search_path='' as $$
 select case when ch='email' then lower(btrim(a)) else regexp_replace(btrim(a),'[ ()-]','','g') end
$$;

create function private.comm_valid_address(ch text,a text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(case when ch='email' then length(a)<=320 and a ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' else a ~ '^\+[1-9][0-9]{7,14}$' end,false)
$$;

create function private.comm_timezone_guard() returns trigger language plpgsql set search_path='' as $$begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'IANA timezone required';end if;return new;end$$;

create trigger communication_settings_timezone before insert or update on public.communication_settings for each row execute function private.comm_timezone_guard();

create trigger communication_preferences_timezone before insert or update on public.communication_preferences for each row execute function private.comm_timezone_guard();

-- Canonical identity references only. No duplicate People table, no contact similarity merge.
create function private.comm_audience(o uuid,c uuid,f jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a jsonb:='[]';k text:=f->>'kind';begin
 if jsonb_typeof(f)<>'object' or exists(select 1 from jsonb_object_keys(f) x where x<>all(array['kind','role','status','person_id','area_id','progress','inactive_days'])) then raise exception 'Unsupported audience filter';end if;
 if k='discipleship' and f->>'progress'='inactive' and coalesce((f->>'inactive_days')::int,0) not between 1 and 3650 then raise exception 'Explicit inactive day threshold required';end if;
 if c is null then
  if k<>'person' or not private.person_permission(o,(f->>'person_id')::uuid,'people.read') then raise exception 'Scoped People access required' using errcode='42501';end if;
  select coalesce(jsonb_agg(jsonb_build_object('key','person:'||p.id,'name',p.first_name||' '||p.last_name,'first_name',p.first_name,'email',p.email,'sms',p.phone)),'[]') into a from public.organization_people p where p.organization_id=o and p.id=(f->>'person_id')::uuid and not exists(select 1 from public.outreach_team_members child where child.person_id=p.id and child.organization_id=o and child.age<18);
 elsif k in ('host','contacts','person','follow_up','discipleship') then
  select coalesce(jsonb_agg(jsonb_build_object('key','person:'||p.id,'name',p.first_name||' '||p.last_name,'first_name',p.first_name,'email',p.email,'sms',p.phone)),'[]') into a from public.organization_people p where p.organization_id=o and
  (exists(select 1 from public.outreach_campaign_contacts x where x.campaign_id=c and x.person_id=p.id and x.active and (coalesce(f->>'role','')='' or x.role_key=f->>'role') and (k<>'host' or x.role_key in ('host_pastor','local_coordinator'))) or
   exists(select 1 from public.outreach_campaign_registrants x where x.campaign_id=c and x.person_id=p.id and (k not in ('host','contacts'))))
  and (k<>'person' or p.id=(f->>'person_id')::uuid) and not exists(select 1 from public.outreach_team_members child where child.person_id=p.id and child.campaign_id=c and child.age<18)
  and (k<>'follow_up' or exists(select 1 from public.outreach_campaign_followups t join public.outreach_campaign_registrants r on r.id=t.registrant_id where t.campaign_id=c and r.person_id=p.id and t.status=coalesce(f->>'status','open')))
  and (k<>'discipleship' or exists(select 1 from public.portal_account_links l join public.course_enrollments e on e.user_id=l.user_id join public.courses cc on cc.id=e.course_id where l.organization_id=o and l.person_id=p.id and l.active and private.outreach_verified(l.user_id) and cc.slug='getting-a-grip-on-the-basics' and (case when e.completed_at is not null then 'completed' when f->>'progress'='inactive' and coalesce((select max(lp.updated_at) from public.lesson_progress lp where lp.user_id=e.user_id and lp.course_id=e.course_id),e.started_at)<now()-make_interval(days=>(f->>'inactive_days')::int) then 'inactive' when exists(select 1 from public.lesson_progress lp where lp.user_id=e.user_id and lp.course_id=e.course_id and lp.status<>'not_started') then 'active' else 'not_started' end)=coalesce(f->>'progress','active')));
 elsif k in ('registrations','checked_in') then
  select coalesce(jsonb_agg(jsonb_build_object('key','registration:'||r.id,'name',r.first_name||' '||r.last_name,'first_name',r.first_name,'email',r.email,'sms',r.phone)),'[]') into a from public.outreach_event_registrations r where r.campaign_id=c and r.organization_id=o and r.status not in ('cancelled','closed') and (coalesce(f->>'status','')='' or r.status=f->>'status') and (k<>'checked_in' or exists(select 1 from public.outreach_event_attendees t where t.registration_id=r.id and t.active and t.checked_in_at is not null));
 elsif k in ('team','area') then
  -- Minors always project their explicitly reviewed adult guardian; no minor address.
  select coalesce(jsonb_agg(distinct jsonb_build_object('key',case when p.person_id is not null then 'person:'||p.person_id else 'team:'||p.id end,'name',p.first_name||' '||p.last_name,'first_name',p.first_name,'email',p.email,'sms',p.phone)),'[]') into a
  from public.outreach_team_members t join public.outreach_team_members p on p.campaign_id=t.campaign_id and p.id=case when t.age<18 and t.guardian_reviewed then t.guardian_member_id when t.age>=18 then t.id else null end
  where t.campaign_id=c and t.organization_id=o and t.attending and p.age>=18 and p.status not in ('cancelled','not_selected') and t.status=coalesce(f->>'status','approved')
   and (k<>'area' or exists(select 1 from public.outreach_event_area_members x where x.campaign_id=c and x.member_id=t.id and x.area_id=(f->>'area_id')::uuid and x.active and (coalesce(f->>'role','')='' or x.role=f->>'role')));
 else raise exception 'Unsupported audience kind';end if;
 if k='person' and jsonb_array_length(a)=0 then raise exception 'Recipient denied' using errcode='42501';end if;
 return a;
end$$;

create function private.comm_block(o uuid,c uuid,r text,ch text,a text,purpose text) returns text language plpgsql security definer set search_path='' as $$
declare pref public.communication_preferences;begin
 if not private.comm_valid_address(ch,a) then return 'invalid_address';end if;
 if exists(select 1 from public.communication_suppressions s where s.organization_id=o and s.channel=ch and s.address=a and s.active) then return 'suppression';end if;
 select * into pref from public.communication_preferences where organization_id=o and recipient_key=r;
 if (ch='email' and not pref.email_allowed) or (ch='sms' and not pref.sms_allowed) then return 'preference';end if;
 -- A campaign-specific revocation overrides an organization-wide grant. No inferred exemptions.
 if not coalesce((select status='granted' from public.communication_consents x where x.organization_id=o and x.recipient_key=r and x.channel=ch and x.purpose=comm_block.purpose and (x.campaign_id=c or x.campaign_id is null) order by (x.campaign_id is not null) desc limit 1),false) then return 'consent_required';end if;
 return null;
end$$;

create function private.comm_render(t text,v jsonb) returns text language plpgsql immutable set search_path='' as $$
declare x text;result text:=t;allowed text[]:=array['first_name','campaign_name','campaign_date','church_name','task_name','due_date','portal_link','registration_link','event_location','coordinator_name'];begin
 if exists(select 1 from jsonb_object_keys(v) k where k<>all(allowed)) then raise exception 'Unknown template variable';end if;
 for x in select (regexp_matches(t,'\{\{([a-z_]+)\}\}','g'))[1] loop
  if x<>all(allowed) then raise exception 'Unknown template variable';end if;
  if not(v?x) or coalesce(v->>x,'')='' then raise exception 'Missing template variable: %',x;end if;
  result:=replace(result,'{{'||x||'}}',v->>x);
 end loop;
 if result ~ '\{\{|\}\}' then raise exception 'Invalid template expression';end if;
 return result;
end$$;

create function private.comm_actor_can(o uuid,c uuid,k text,u uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select private.outreach_verified(u) and (exists(select 1 from public.organization_staff_permissions g where g.organization_id=o and g.user_id=u and g.permission=k and g.department_ids is null and g.revoked_at is null and g.effective_at<=now() and (g.expires_at is null or g.expires_at>now()) and private.staff_assignment_active(o,u)) or exists(select 1 from public.outreach_campaign_assignments a join public.outreach_campaigns cc on cc.id=a.campaign_id where cc.organization_id=o and a.campaign_id=c and a.user_id=u and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and k=any(a.capabilities)))
$$;

-- Recheck canonical recipient membership/address and the initiating actor at both lease and handoff.
create function private.comm_recipient_current(m public.communication_outbox,f jsonb,u uuid) returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
 if m.campaign_id is null then
  return private.comm_actor_can(m.organization_id,null,'people.read',u) and exists(select 1 from public.organization_people p where p.organization_id=m.organization_id and 'person:'||p.id=m.recipient_key and private.comm_address(m.channel,case when m.channel='email' then p.email else p.phone end)=m.address_snapshot and not exists(select 1 from public.outreach_team_members child where child.person_id=p.id and child.organization_id=m.organization_id and child.age<18));
 end if;
 return exists(select 1 from jsonb_array_elements(private.comm_audience(m.organization_id,m.campaign_id,f)) r where r->>'key'=m.recipient_key and private.comm_address(m.channel,r->>m.channel)=m.address_snapshot);
exception when others then return false;
end$$;

create function private.comm_source_authorized(m public.communication_outbox) returns boolean language sql volatile security definer set search_path='' as $$
 select case when m.batch_id is not null then exists(select 1 from public.communication_batches b where b.id=m.batch_id and private.comm_actor_can(m.organization_id,m.campaign_id,'communications.send',b.created_by) and (jsonb_array_length(b.recipients)<=1 or private.comm_actor_can(m.organization_id,m.campaign_id,'communications.bulk_send',b.created_by)) and private.comm_recipient_current(m,b.request_snapshot->'audience',b.created_by))
 when m.source_event_id is not null then exists(select 1 from public.communication_routes r where r.campaign_id=m.campaign_id and r.enabled and r.template_id=m.template_id and m.idempotency_key like 'event:'||m.source_event_id||':route:'||r.id||':%' and private.comm_actor_can(m.organization_id,m.campaign_id,'communications.send',r.approved_by) and private.comm_actor_can(m.organization_id,m.campaign_id,'communications.bulk_send',r.approved_by) and private.comm_recipient_current(m,r.audience,r.approved_by)) else false end
$$;

create function private.comm_variables(o uuid,c uuid,r jsonb,extra jsonb default '{}',step_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;camp public.outreach_campaigns;s public.outreach_campaign_steps;x text;begin
 if jsonb_typeof(extra)<>'object' or exists(select 1 from jsonb_object_keys(extra) k where k not in ('portal_link','registration_link','coordinator_name')) then raise exception 'Only approved supplemental variables allowed';end if;
 for x in select value from jsonb_each_text(extra) where key in ('portal_link','registration_link') loop
  if x !~ '^https://[^/]+/' or not exists(select 1 from public.communication_settings cfg,unnest(cfg.approved_link_origins) z where cfg.organization_id=o and split_part(x,'/',1)||'//'||split_part(x,'/',3)=z) then raise exception 'Approved HTTPS link origin required';end if;
 end loop;
 select * into camp from public.outreach_campaigns where id=c and organization_id=o;
 select * into s from public.outreach_campaign_steps where id=step_id and campaign_id=c;
 v:=jsonb_build_object('first_name',r->>'first_name','church_name',(select name from public.organizations where id=o),'campaign_name',camp.name,'campaign_date',case when camp.event_start is not null then to_char(camp.event_start at time zone camp.timezone,'YYYY-MM-DD HH24:MI')||' '||camp.timezone else null end,'event_location',camp.venue->>'site_name','task_name',s.definition->>'title','due_date',case when s.due_at is not null then to_char(s.due_at at time zone camp.timezone,'YYYY-MM-DD HH24:MI')||' '||camp.timezone else null end);
 return v||extra;
end$$;

create function private.comm_enqueue(o uuid,c uuid,r jsonb,ch text,typ text,purp text,t uuid,sender uuid,subj text,body text,key text,at_time timestamptz,batch uuid default null,event uuid default null,reminder uuid default null,step uuid default null,due timestamptz default null) returns uuid language plpgsql security definer set search_path='' as $$
declare mid uuid;block text;actor_id uuid;cfg public.communication_settings;addr text:=private.comm_address(ch,r->>ch);begin
 select id into mid from public.communication_outbox where organization_id=o and idempotency_key=key;if found then return mid;end if;
 select * into cfg from public.communication_settings where organization_id=o;
 if (select count(*) from public.communication_outbox where organization_id=o and created_at>now()-make_interval(secs=>cfg.window_seconds))>=cfg.organization_limit or (select count(*) from public.communication_outbox where organization_id=o and campaign_id is not distinct from c and created_at>now()-make_interval(secs=>cfg.window_seconds))>=cfg.campaign_limit or (select count(*) from public.communication_outbox where organization_id=o and recipient_key=r->>'key' and created_at>now()-make_interval(secs=>cfg.window_seconds))>=cfg.recipient_limit then raise exception 'Communications rate limit' using errcode='54000';end if;
 select created_by into actor_id from public.communication_batches where id=batch;
 if actor_id is null and event is not null then select approved_by into actor_id from public.communication_routes route where key like 'event:'||event||':route:'||route.id||':%';end if;
 if actor_id is not null and (select count(*) from public.communication_outbox msg left join public.communication_batches bb on bb.id=msg.batch_id where msg.organization_id=o and msg.created_at>now()-make_interval(secs=>cfg.window_seconds) and (bb.created_by=actor_id or exists(select 1 from public.communication_routes rr where rr.approved_by=actor_id and msg.idempotency_key like 'event:'||msg.source_event_id||':route:'||rr.id||':%')))>=cfg.user_limit then raise exception 'User communications rate limit' using errcode='54000';end if;
 block:=private.comm_block(o,c,r->>'key',ch,addr,purp);
 insert into public.communication_outbox(organization_id,campaign_id,batch_id,recipient_key,recipient_name,address_snapshot,channel,message_type,purpose,template_id,sender_profile_id,subject,rendered_body,status,scheduled_at,idempotency_key,source_event_id,source_reminder_id,source_step_id,source_due_at,credits_estimated,credits_reserved)
 values(o,c,batch,r->>'key',r->>'name',coalesce(addr,''),ch,typ,purp,t,sender,subj,body,case when block is not null then 'suppressed' when at_time>now() then 'scheduled' else 'queued' end,at_time,key,event,reminder,step,due,case when ch='sms' then 1 else 0 end,case when ch='sms' and block is null then 1 else 0 end)
 on conflict(organization_id,idempotency_key) do nothing returning id into mid;
 if mid is null then select id into mid from public.communication_outbox where organization_id=o and idempotency_key=key;return mid;end if;
 update public.communication_outbox set failure_class=block,source_campaign_revision=(select revision from public.outreach_campaigns where id=c) where id=mid;
 perform private.comm_audit(o,c,'queue.created',mid,jsonb_build_object('channel',ch,'suppressed',block is not null));return mid;
end$$;

create function private.comm_workspace(action text,c uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o uuid:=(p->>'organization_id')::uuid;camp public.outreach_campaigns;t public.communication_templates;b public.communication_batches;m public.communication_outbox;profile public.communication_sender_profiles;
 target_id uuid:=(p->>'id')::uuid;recipient jsonb;items jsonb;vars jsonb;result jsonb;key text;ch text;typ text;purp text;subj text;body text;addr text;block text;cfg public.communication_settings;needs text;at_time timestamptz;cnt integer;allowed text[]:=array['communications.view','communications.send','communications.bulk_send','communications.templates.view','communications.templates.manage','communications.delivery.view'];
begin
 if not private.outreach_verified(auth.uid()) then raise exception 'Verified identity required' using errcode='42501';end if;
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>32000 then raise exception 'Invalid request';end if;
 if action='context' then return jsonb_build_object(
 'organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'permissions',(select jsonb_agg(k) from unnest(allowed) k where private.comm_can(x.id,null,k)))),'[]') from public.organizations x where exists(select 1 from unnest(allowed) k where private.comm_can(x.id,null,k))),
 'campaigns',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'organization_id',x.organization_id,'name',x.name,'permissions',(select jsonb_agg(k) from unnest(allowed) k where private.comm_can(x.organization_id,x.id,k)))),'[]') from public.outreach_campaigns x where exists(select 1 from unnest(allowed) k where private.comm_can(x.organization_id,x.id,k))));end if;
 if c is not null then select * into camp from public.outreach_campaigns where id=c;if not found or (o is not null and o<>camp.organization_id) then raise exception 'Campaign denied' using errcode='42501';end if;o:=camp.organization_id;end if;
 if o is null then raise exception 'Organization required';end if;
 needs:=case when action in ('template_create','template_edit','template_publish','template_deactivate','route_save') then 'communications.templates.manage' when action in ('templates','template_preview') then 'communications.templates.view' when action in ('preview','confirm','cancel','retry','consent','preferences','suppress','external_action','senders') then 'communications.send' when action in ('activity','message','batch','history','external_history') then 'communications.delivery.view' else 'communications.view' end;
 if not private.comm_can(o,c,needs) then raise exception 'Communications access denied' using errcode='42501';end if;
 perform private.comm_lock(o);
 if not private.comm_can(o,c,needs) then raise exception 'Communications access revoked' using errcode='42501';end if;
 insert into public.communication_settings(organization_id) values(o) on conflict do nothing;
 select * into cfg from public.communication_settings where organization_id=o;
 if action='overview' then
  return jsonb_build_object('metrics',(select coalesce(jsonb_object_agg(status,n),'{}') from (select status,count(*) n from public.communication_outbox where organization_id=o and campaign_id is not distinct from c group by status) x),'delivery_mode',cfg.delivery_mode,'permissions',(select jsonb_agg(k) from unnest(allowed) k where private.comm_can(o,c,k)),
  'senders',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.communication_sender_profiles s where s.organization_id=o and s.active),'routes',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.communication_routes r where r.organization_id=o and r.campaign_id=c));
 elsif action='senders' then
  return coalesce((select jsonb_agg(to_jsonb(x)) from public.communication_sender_profiles x where x.organization_id=o and x.active),'[]');
 elsif action='templates' then
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.template_key,x.version desc) from public.communication_templates x where x.organization_id=o),'[]');
 elsif action in ('template_create','template_edit') then
  if action='template_edit' then select * into t from public.communication_templates where organization_id=o and communication_templates.id=target_id;if not found or t.state<>'draft' or t.revision<>(p->>'revision')::int then raise exception 'Current draft required';end if;
  else t.id:=gen_random_uuid();t.template_key:=p->>'template_key';t.channel:=p->>'channel';t.locale:=coalesce(p->>'locale','en');select coalesce(max(version),0)+1 into t.version from public.communication_templates where organization_id=o and template_key=t.template_key and channel=t.channel and locale=t.locale;end if;
  -- Validate token names without accepting arbitrary code. Preview supplies actual data later.
  perform private.comm_render(coalesce(p->>'subject','')||' '||(p->>'body'),'{"first_name":"sample","campaign_name":"sample","campaign_date":"sample","church_name":"sample","task_name":"sample","due_date":"sample","portal_link":"sample","registration_link":"sample","event_location":"sample","coordinator_name":"sample"}');
  if action='template_create' then insert into public.communication_templates(id,organization_id,template_key,channel,message_type,purpose,version,locale,subject,body,created_by) values(t.id,o,t.template_key,t.channel,p->>'message_type',p->>'purpose',t.version,t.locale,coalesce(p->>'subject',''),p->>'body',auth.uid()) returning * into t;
  else update public.communication_templates set subject=coalesce(p->>'subject',''),body=p->>'body',revision=revision+1 where communication_templates.id=t.id returning * into t;end if;
  perform private.comm_audit(o,c,action,t.id);return to_jsonb(t);
 elsif action in ('template_publish','template_deactivate','template_preview') then
  select * into t from public.communication_templates where organization_id=o and communication_templates.id=target_id;if not found then raise exception 'Template denied' using errcode='42501';end if;
  if action='template_preview' then return jsonb_build_object('subject',private.comm_render(t.subject,coalesce(p->'variables','{}')),'body',private.comm_render(t.body,coalesce(p->'variables','{}')));end if;
  if action='template_publish' and t.state='draft' then
   if t.revision<>(p->>'revision')::int then raise exception 'Draft revision changed';end if;
   update public.communication_templates set active=false where organization_id=o and template_key=t.template_key and channel=t.channel and locale=t.locale and active;
   update public.communication_templates set state='published',active=true,published_at=now() where communication_templates.id=target_id returning * into t;
  elsif action='template_deactivate' then update public.communication_templates set active=false where communication_templates.id=target_id returning * into t;end if;
  perform private.comm_audit(o,c,action,t.id);return to_jsonb(t);
 elsif action in ('consent','preferences','suppress','external_action') then
  select x into recipient from jsonb_array_elements(private.comm_audience(o,c,p->'audience')) x where x->>'key'=p->>'recipient_key';
  if recipient is null then raise exception 'Recipient denied' using errcode='42501';end if;
  ch:=p->>'channel';key:=recipient->>'key';addr:=private.comm_address(ch,recipient->>ch);
  if action='consent' then
   if coalesce(p->>'status','') not in ('granted','revoked') or length(coalesce(p->>'proof_reference',''))<5 or coalesce((p->>'explicitly_reviewed')::boolean,false)=false then raise exception 'Explicit reviewed consent proof required';end if;
   insert into public.communication_consents(organization_id,campaign_id,recipient_key,channel,purpose,status,source,proof_reference,recorded_by,revoked_at) values(o,c,key,ch,p->>'purpose',p->>'status',p->>'source',p->>'proof_reference',auth.uid(),case when p->>'status'='revoked' then now() end)
   on conflict(organization_id,coalesce(campaign_id,'00000000-0000-0000-0000-000000000000'::uuid),recipient_key,channel,purpose) do update set status=excluded.status,source=excluded.source,proof_reference=excluded.proof_reference,recorded_by=excluded.recorded_by,recorded_at=now(),revoked_at=excluded.revoked_at returning to_jsonb(communication_consents) into result;
  elsif action='preferences' then
   insert into public.communication_preferences(organization_id,recipient_key,email_allowed,sms_allowed,preferred_channel,timezone) values(o,key,(p->>'email_allowed')::boolean,(p->>'sms_allowed')::boolean,p->>'preferred_channel',coalesce(p->>'timezone','UTC')) on conflict(organization_id,recipient_key) do update set email_allowed=excluded.email_allowed,sms_allowed=excluded.sms_allowed,preferred_channel=excluded.preferred_channel,timezone=excluded.timezone returning to_jsonb(communication_preferences) into result;
  elsif action='suppress' then
   insert into public.communication_suppressions(organization_id,channel,address,reason) values(o,ch,addr,'admin') on conflict(organization_id,channel,address,reason) do update set active=true,cleared_at=null;result:=jsonb_build_object('suppressed',true);
  else if ch not in ('email','sms') then raise exception 'External channel required';end if;result:=jsonb_build_object('recorded_as','external_manual','delivered',false);end if;
  perform private.comm_audit(o,c,action,null,jsonb_build_object('recipient_key',key,'channel',ch,'status',p->>'status','purpose',p->>'purpose','external_manual',action='external_action'));return result;
 elsif action='preview' then
  select * into b from public.communication_batches where organization_id=o and request_key=(p->>'request_key')::uuid;
  if found then if b.request_snapshot<>p or b.created_by<>auth.uid() or b.campaign_id is distinct from c then raise exception 'Request key conflict';end if;return jsonb_build_object('batch',to_jsonb(b),'delivery_mode',cfg.delivery_mode);end if;
  ch:=p->>'channel';select * into profile from public.communication_sender_profiles where organization_id=o and communication_sender_profiles.id=(p->>'sender_profile_id')::uuid and active and channel=ch;
  if not found then raise exception 'Approved sender profile required';end if;
  if p->>'template_id' is not null then select * into t from public.communication_templates where organization_id=o and communication_templates.id=(p->>'template_id')::uuid and active and channel=ch;if not found then raise exception 'Published matching template required';end if;typ:=t.message_type;purp:=t.purpose;subj:=t.subject;body:=t.body;
  else typ:=p->>'message_type';purp:=p->>'purpose';subj:=coalesce(p->>'subject','');body:=p->>'body';if length(body) not between 1 and 12000 or length(subj)>240 or subj ~ E'[\r\n]' or typ='marketing' and purp<>'marketing' then raise exception 'Invalid composed content';end if;end if;
  items:='[]';for recipient in select x from jsonb_array_elements(private.comm_audience(o,c,p->'audience')) x loop
   addr:=private.comm_address(ch,recipient->>ch);vars:=private.comm_variables(o,c,recipient,coalesce(p->'variables','{}'));block:=private.comm_block(o,c,recipient->>'key',ch,addr,purp);
   begin
    result:=jsonb_build_object('subject',private.comm_render(subj,vars),'body',private.comm_render(body,vars)||case when profile.footer<>'' then E'\n\n'||profile.footer else '' end);
   exception when others then if SQLERRM like 'Missing template variable:%' then block:='missing_template_data';result:=jsonb_build_object('subject',subj,'body',body,'warning',SQLERRM);else raise;end if;end;
   items:=items||jsonb_build_array(recipient||result||jsonb_build_object('address',coalesce(addr,''),'blocked',block,'variables',vars));
  end loop;
  -- Canonical identity dedupe, deterministic ordering; also avoid duplicate destination within this intended send.
  select coalesce(jsonb_agg(x order by x->>'key'),'[]') into items from (select distinct on (coalesce(nullif(x->>'address',''),x->>'key')) x from jsonb_array_elements(items) x order by coalesce(nullif(x->>'address',''),x->>'key'),x->>'key') q;
  cnt:=jsonb_array_length(items);if cnt>1 and not private.comm_can(o,c,'communications.bulk_send') then raise exception 'Bulk send permission required' using errcode='42501';end if;
  at_time:=coalesce((p->>'scheduled_at')::timestamptz,now());
  insert into public.communication_batches(organization_id,campaign_id,request_key,created_by,request_snapshot,recipients,channel,message_type,purpose,template_id,sender_profile_id,subject,body,variables,campaign_revision,scheduled_at)
  values(o,c,(p->>'request_key')::uuid,auth.uid(),p,items,ch,typ,purp,t.id,profile.id,subj,body,coalesce(p->'variables','{}'),camp.revision,at_time) returning * into b;
  perform private.comm_audit(o,c,'audience.preview',b.id,jsonb_build_object('count',cnt));return jsonb_build_object('batch',to_jsonb(b),'delivery_mode',cfg.delivery_mode);
 elsif action='confirm' then
  select * into b from public.communication_batches where organization_id=o and communication_batches.id=target_id and campaign_id is not distinct from c;
  if not found or b.created_by<>auth.uid() then raise exception 'Batch denied' using errcode='42501';end if;
  if b.state='queued' then return jsonb_build_object('id',b.id,'state',b.state);end if;
  if b.state<>'draft' or not coalesce((p->>'confirmed')::boolean,false) or b.created_at<now()-interval '15 minutes' then raise exception 'Current explicit confirmation required';end if;
  if c is not null and b.campaign_revision<>camp.revision then raise exception 'Campaign changed; preview again';end if;
  if b.template_id is not null and not exists(select 1 from public.communication_templates where communication_templates.id=b.template_id and active) then raise exception 'Template changed; preview again';end if;
  if not exists(select 1 from public.communication_sender_profiles where communication_sender_profiles.id=b.sender_profile_id and active) then raise exception 'Sender inactive';end if;
  cnt:=jsonb_array_length(b.recipients);if cnt>1 and not private.comm_can(o,c,'communications.bulk_send') then raise exception 'Bulk send permission required' using errcode='42501';end if;
  -- All counts serialize with enqueue on the organization lock; legitimate limits are tenant-configurable.
  if (select count(*) from public.communication_outbox where organization_id=o and created_at>now()-make_interval(secs=>cfg.window_seconds))+cnt>cfg.organization_limit or
   (select count(*) from public.communication_outbox where organization_id=o and campaign_id is not distinct from c and created_at>now()-make_interval(secs=>cfg.window_seconds))+cnt>cfg.campaign_limit or
   (select count(*) from public.communication_outbox msg join public.communication_batches x on x.id=msg.batch_id where msg.organization_id=o and x.created_by=auth.uid() and msg.created_at>now()-make_interval(secs=>cfg.window_seconds))+cnt>cfg.user_limit then raise exception 'Communications rate limit' using errcode='54000';end if;
  for recipient in select x from jsonb_array_elements(b.recipients) x loop
   if not exists(select 1 from jsonb_array_elements(private.comm_audience(o,c,b.request_snapshot->'audience')) x where x->>'key'=recipient->>'key' and private.comm_address(b.channel,x->>b.channel)=recipient->>'address') then raise exception 'Audience changed; preview again';end if;
   if (select count(*) from public.communication_outbox where organization_id=o and recipient_key=recipient->>'key' and created_at>now()-make_interval(secs=>cfg.window_seconds))>=cfg.recipient_limit then raise exception 'Recipient rate limit' using errcode='54000';end if;
   if recipient->>'blocked'='missing_template_data' then continue;end if;
   perform private.comm_enqueue(o,c,recipient,b.channel,b.message_type,b.purpose,b.template_id,b.sender_profile_id,recipient->>'subject',recipient->>'body','batch:'||b.id||':'||(recipient->>'key')||':'||b.channel,b.scheduled_at,b.id);
  end loop;
  update public.communication_batches set state='queued',confirmed_at=now() where communication_batches.id=b.id;
  select count(*) into cnt from public.communication_outbox where batch_id=b.id;perform private.comm_audit(o,c,'bulk.confirmed',b.id,jsonb_build_object('count',cnt));return jsonb_build_object('id',b.id,'state','queued','count',cnt);
 elsif action='external_history' then
  if p->>'person_id' is null or not private.person_permission(o,(p->>'person_id')::uuid,'people.read') then raise exception 'People history access denied' using errcode='42501';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('channel',a.metadata->>'channel','created_at',a.created_at,'campaign_id',a.campaign_id,'status','external_manual')) from public.communication_audit a where a.organization_id=o and (c is null or a.campaign_id=c) and a.kind='external_action' and a.metadata->>'recipient_key'='person:'||(p->>'person_id')),'[]');
 elsif action in ('activity','history') then
  if action='history' then
   if p->>'person_id' is null or not private.person_permission(o,(p->>'person_id')::uuid,'people.read') then raise exception 'People history access denied' using errcode='42501';end if;
  end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select id,campaign_id,recipient_key,recipient_name,channel,message_type,template_id,status,provider,provider_message_id,failure_class,created_at,scheduled_at,sent_at,delivered_at,failed_at,attempts from public.communication_outbox where organization_id=o and (campaign_id is not distinct from c or (action='history' and c is null))
   and (action<>'history' or recipient_key='person:'||(p->>'person_id')) and (coalesce(p->>'channel','')='' or channel=p->>'channel') and (coalesce(p->>'status','')='' or status=p->>'status') and (coalesce(p->>'message_type','')='' or message_type=p->>'message_type') and (coalesce(p->>'provider','')='' or provider=p->>'provider') and (coalesce(p->>'recipient','')='' or recipient_name ilike '%'||(p->>'recipient')||'%') and (p->>'from' is null or created_at>=(p->>'from')::timestamptz) and (p->>'to' is null or created_at<(p->>'to')::timestamptz+interval '1 day') order by created_at desc limit 200) x),'[]');
 elsif action in ('message','batch','cancel','retry') then
  if action='batch' then select * into b from public.communication_batches where organization_id=o and communication_batches.id=target_id and campaign_id is not distinct from c;if not found then raise exception 'Batch denied' using errcode='42501';end if;return (to_jsonb(b)-'recipients'-'body'-'subject'-'variables'-'request_snapshot')||jsonb_build_object('messages',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.recipient_name,'status',x.status,'failure_class',x.failure_class)),'[]') from public.communication_outbox x where x.batch_id=b.id));end if;
  select * into m from public.communication_outbox where organization_id=o and communication_outbox.id=target_id and campaign_id is not distinct from c;if not found then raise exception 'Message denied' using errcode='42501';end if;
  if action='message' then if not private.comm_can(o,c,'communications.view') then raise exception 'Message body access denied' using errcode='42501';end if;return to_jsonb(m)-'lease_token';end if;
  if action='cancel' and m.status in ('draft','queued','scheduled') then update public.communication_outbox set status='cancelled',credits_released=credits_reserved,credits_reserved=0 where communication_outbox.id=target_id;
  elsif action='retry' and m.status='failed' and m.failure_class='transient' and m.attempts<cfg.max_attempts then update public.communication_outbox set status='queued',scheduled_at=now(),failure_class=null where communication_outbox.id=target_id;
  else raise exception 'Message state cannot be changed';end if;
  perform private.comm_audit(o,c,action,target_id);return jsonb_build_object('id',target_id,'action',action);
 elsif action='route_save' then
  if c is null or not private.comm_can(o,c,'communications.send') or not private.comm_can(o,c,'communications.bulk_send') or not coalesce((p->>'confirmed')::boolean,false) then raise exception 'Explicit automation approval required' using errcode='42501';end if;
  select * into t from public.communication_templates where organization_id=o and communication_templates.id=(p->>'template_id')::uuid and active;if not found then raise exception 'Published route template required';end if;
  select * into profile from public.communication_sender_profiles where organization_id=o and communication_sender_profiles.id=(p->>'sender_profile_id')::uuid and active and channel=t.channel;if not found then raise exception 'Matching approved sender required';end if;
  perform private.comm_audience(o,c,p->'audience');
  insert into public.communication_routes(organization_id,campaign_id,event_kind,template_id,sender_profile_id,audience,enabled,approved_by,approved_at) values(o,c,p->>'event_kind',t.id,(p->>'sender_profile_id')::uuid,p->'audience',coalesce((p->>'enabled')::boolean,false),auth.uid(),now()) on conflict(campaign_id,event_kind,template_id) do update set audience=excluded.audience,enabled=excluded.enabled,approved_by=excluded.approved_by,approved_at=excluded.approved_at returning to_jsonb(communication_routes) into result;
  perform private.comm_audit(o,c,'route.approved',(result->>'id')::uuid);return result;
 else raise exception 'Unknown communications action';end if;
end$$;

-- Trusted worker surface only. No browser worker credentials or arbitrary provider dispatch.
create function private.comm_service(action text,o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare cfg public.communication_settings;m public.communication_outbox;profile public.communication_sender_profiles;lease uuid;block text;localhour integer;zone text;outcome text;route public.communication_routes;e public.outreach_campaign_events;t public.communication_templates;camp public.outreach_campaigns;r jsonb;v jsonb;rem public.outreach_task_reminders;step public.outreach_campaign_steps;ids jsonb:='[]';mid uuid;begin
 perform private.comm_lock(o);select * into cfg from public.communication_settings where organization_id=o;
 if not found then raise exception 'Communication settings missing';end if;
 if action='consume_events' then
  for route in select * from public.communication_routes where organization_id=o and enabled loop
   -- Current approver authority, not a permanent grant copied at route creation.
   if not exists(select 1 from public.organization_staff_permissions g where g.organization_id=o and g.user_id=route.approved_by and g.permission='communications.send' and g.revoked_at is null and g.department_ids is null and g.effective_at<=now() and (g.expires_at is null or g.expires_at>now()) and private.staff_assignment_active(o,g.user_id)) and not exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=route.campaign_id and a.user_id=route.approved_by and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and a.capabilities @> array['communications.send','communications.bulk_send']) then continue;end if;
   select * into t from public.communication_templates where id=route.template_id and organization_id=o and active;if not found then continue;end if;
   select * into camp from public.outreach_campaigns where id=route.campaign_id and organization_id=o;
   if camp.status in ('cancelled','closed','completed') then continue;end if;
   select * into profile from public.communication_sender_profiles where id=route.sender_profile_id and active;if not found then continue;end if;
   for e in select ev.* from public.outreach_campaign_events ev where ev.campaign_id=route.campaign_id and ev.kind=route.event_kind and ev.created_at>=route.approved_at and not exists(select 1 from public.communication_event_consumption done where done.organization_id=o and done.route_id=route.id and done.event_id=ev.id) order by ev.created_at limit 100 loop
    rem:=null;step:=null;
    if e.event_key like 'reminder:%' then select * into rem from public.outreach_task_reminders where id=e.subject_id and campaign_id=camp.id;
     -- Phase F events use step subject IDs; match exact reminder key when appropriate.
     if not found then select * into rem from public.outreach_task_reminders where campaign_id=camp.id and ('reminder:'||id)=e.event_key;end if;
     if rem.id is null or rem.state<>'pending' then insert into public.communication_event_consumption(organization_id,route_id,event_id) values(o,route.id,e.id) on conflict do nothing;continue;end if;
     if rem.scheduled_at>now() or camp.status='postponed' then continue;end if;
     select * into step from public.outreach_campaign_steps where id=rem.step_id and campaign_id=camp.id;
     if step.status='completed' or step.due_at is distinct from rem.due_snapshot then insert into public.communication_event_consumption(organization_id,route_id,event_id) values(o,route.id,e.id) on conflict do nothing;continue;end if;
    end if;
    for r in select x from jsonb_array_elements(private.comm_audience(o,camp.id,route.audience)) x loop
     -- Reminder recipient roles come from Phase F, never a newly invented escalation roster.
     if rem.id is not null and not exists(select 1 from public.outreach_campaign_contacts x where x.campaign_id=camp.id and 'person:'||x.person_id=r->>'key' and x.active and (rem.recipient_roles ? x.role_key)) and not exists(select 1 from public.organization_people pp where 'person:'||pp.id=r->>'key' and pp.organization_id=o and pp.user_id=rem.assigned_user_id) then continue;end if;
     v:=private.comm_variables(o,camp.id,r,'{}',step.id);
     mid:=private.comm_enqueue(o,camp.id,r,t.channel,t.message_type,t.purpose,t.id,profile.id,private.comm_render(t.subject,v),private.comm_render(t.body,v)||case when profile.footer<>'' then E'\n\n'||profile.footer else '' end,'event:'||e.id||':route:'||route.id||':'||(r->>'key')||':'||t.channel,now(),null,e.id,rem.id,step.id,step.due_at);ids:=ids||jsonb_build_array(mid);
    end loop;
    insert into public.communication_event_consumption(organization_id,route_id,event_id) values(o,route.id,e.id) on conflict do nothing;
   end loop;
  end loop;return jsonb_build_object('messages',ids);
 elsif action='claim' then
  if cfg.delivery_mode<>'acceptance_sink' then return jsonb_build_object('messages','[]'::jsonb,'mode','disabled');end if;
  -- A lost post-handoff lease is uncertain and must reconcile, never blindly resend.
  update public.communication_attempts a set finished_at=now(),outcome='lease_expired',failure_class=case when m.dispatch_authorized_at is null then 'transient' else 'uncertain' end from public.communication_outbox m where m.organization_id=o and m.status='sending' and m.lease_until<now() and a.lease_token=m.lease_token;
  update public.communication_outbox set status=case when dispatch_authorized_at is null then 'scheduled' else 'failed' end,scheduled_at=case when dispatch_authorized_at is null then now()+interval '30 seconds' else scheduled_at end,failure_class=case when dispatch_authorized_at is null then 'transient' else 'uncertain' end,failed_at=now(),lease_token=null,lease_until=null where organization_id=o and status='sending' and lease_until<now();
  for m in select * from public.communication_outbox where organization_id=o and status in ('queued','scheduled') and scheduled_at<=now() order by scheduled_at,id limit 25 for update skip locked loop
   profile:=null;select * into profile from public.communication_sender_profiles where id=m.sender_profile_id and organization_id=o and active;
   block:=private.comm_block(o,m.campaign_id,m.recipient_key,m.channel,m.address_snapshot,m.purpose);
   if not private.comm_source_authorized(m) then block:='source_authority_revoked';end if;
   if profile.id is null or (profile.provider<>'acceptance_sink' or profile.channel<>m.channel) then block:='provider_disabled';end if;
   if m.source_reminder_id is not null and not exists(select 1 from public.outreach_task_reminders rr join public.outreach_campaign_steps ss on ss.id=rr.step_id join public.outreach_campaigns cc on cc.id=rr.campaign_id where rr.id=m.source_reminder_id and rr.state='pending' and ss.status<>'completed' and ss.due_at is not distinct from m.source_due_at and cc.status not in ('postponed','completed','cancelled','closed')) then block:='stale_workflow';end if;
   if m.campaign_id is not null and not exists(select 1 from public.outreach_campaigns cc where cc.id=m.campaign_id and cc.revision=m.source_campaign_revision and cc.status not in ('cancelled','closed','completed')) then block:='stale_campaign';end if;
   if m.attempts>=cfg.max_attempts then block:='attempts_exhausted';end if;
   if block is not null then update public.communication_outbox set status=case when block='stale_workflow' then 'cancelled' else 'suppressed' end,failure_class=block,credits_released=credits_reserved,credits_reserved=0 where id=m.id;perform private.comm_audit(o,m.campaign_id,'dispatch.blocked',m.id,jsonb_build_object('reason',block));continue;end if;
   if m.channel='sms' and cfg.quiet_start is not null then
    zone:=coalesce((select timezone from public.communication_preferences where organization_id=o and recipient_key=m.recipient_key),(select timezone from public.outreach_campaigns where id=m.campaign_id),cfg.timezone);
    localhour:=extract(hour from now() at time zone zone);
    if (cfg.quiet_start<cfg.quiet_end and localhour>=cfg.quiet_start and localhour<cfg.quiet_end) or (cfg.quiet_start>cfg.quiet_end and (localhour>=cfg.quiet_start or localhour<cfg.quiet_end)) then
     update public.communication_outbox set status='scheduled',scheduled_at=(((now() at time zone zone)::date + case when cfg.quiet_start>cfg.quiet_end and localhour>=cfg.quiet_start then 1 else 0 end)+make_interval(hours=>cfg.quiet_end)) at time zone zone where id=m.id;continue;
    end if;
   end if;
   lease:=gen_random_uuid();update public.communication_outbox set status='sending',attempts=attempts+1,lease_token=lease,lease_until=now()+interval '2 minutes',dispatch_authorized_at=null,provider=profile.provider where id=m.id returning * into m;
   insert into public.communication_attempts(organization_id,message_id,attempt,lease_token) values(o,m.id,m.attempts,lease);
   ids:=ids||jsonb_build_array(to_jsonb(m)||jsonb_build_object('sender',to_jsonb(profile)));perform private.comm_audit(o,m.campaign_id,'attempt.claimed',m.id,jsonb_build_object('attempt',m.attempts));
  end loop;return jsonb_build_object('messages',ids,'mode',cfg.delivery_mode);
 elsif action in ('authorize_dispatch','result') then
  select * into m from public.communication_outbox where organization_id=o and id=(p->>'id')::uuid and status='sending' and lease_token=(p->>'lease_token')::uuid and lease_until>now();if not found then raise exception 'Current lease required';end if;
  if action='authorize_dispatch' then
   block:=private.comm_block(o,m.campaign_id,m.recipient_key,m.channel,m.address_snapshot,m.purpose);
   if not private.comm_source_authorized(m) then block:='source_authority_revoked';end if;
   if m.source_reminder_id is not null and not exists(select 1 from public.outreach_task_reminders rr join public.outreach_campaign_steps ss on ss.id=rr.step_id join public.outreach_campaigns cc on cc.id=rr.campaign_id where rr.id=m.source_reminder_id and rr.state='pending' and ss.status<>'completed' and ss.due_at is not distinct from m.source_due_at and cc.status not in ('postponed','completed','cancelled','closed')) then block:='stale_workflow';end if;
   if m.campaign_id is not null and not exists(select 1 from public.outreach_campaigns cc where cc.id=m.campaign_id and cc.revision=m.source_campaign_revision and cc.status not in ('cancelled','closed','completed')) then block:='stale_campaign';end if;
   if cfg.delivery_mode<>'acceptance_sink' or not exists(select 1 from public.communication_sender_profiles where id=m.sender_profile_id and active and provider='acceptance_sink') then block:='provider_disabled';end if;
   if block is not null then update public.communication_outbox set status='suppressed',failure_class=block,credits_released=credits_reserved,credits_reserved=0 where id=m.id;perform private.comm_audit(o,m.campaign_id,'dispatch.blocked',m.id,jsonb_build_object('reason',block));return jsonb_build_object('authorized',false,'reason',block);end if;
   update public.communication_outbox set dispatch_authorized_at=now() where id=m.id;perform private.comm_audit(o,m.campaign_id,'dispatch.authorized',m.id);return jsonb_build_object('authorized',true);
  end if;
  if m.dispatch_authorized_at is null then raise exception 'Dispatch authorization required';end if;
  outcome:=p->>'outcome';if outcome not in ('sent','transient','permanent','uncertain') then raise exception 'Invalid provider result';end if;
  if outcome='sent' and (coalesce(p->>'provider_message_id','')='' or length(p->>'provider_message_id')>200) then raise exception 'Provider receipt required';end if;
  update public.communication_outbox set status=case when outcome='sent' then 'sent' when outcome='transient' and attempts<cfg.max_attempts then 'scheduled' else 'failed' end,scheduled_at=case when outcome='transient' then now()+make_interval(secs=>least(3600,30*(2^attempts)::int)) else scheduled_at end,sent_at=case when outcome='sent' then now() else sent_at end,failed_at=case when outcome<>'sent' then now() else null end,provider_message_id=p->>'provider_message_id',failure_class=case when outcome='sent' then null else outcome end,lease_token=null,lease_until=null,credits_consumed=case when outcome='sent' then credits_reserved else credits_consumed end,credits_reserved=case when outcome='sent' then 0 else credits_reserved end where id=m.id;
  update public.communication_attempts set finished_at=now(),outcome=outcome,failure_class=case when outcome='sent' then null else outcome end where lease_token=m.lease_token;perform private.comm_audit(o,m.campaign_id,'provider.result',m.id,jsonb_build_object('outcome',outcome));return jsonb_build_object('id',m.id,'outcome',outcome);
 elsif action='callback' then
  outcome:=p->>'outcome';if outcome not in ('delivered','soft_bounce','hard_bounce','complaint','rejected','undelivered','failed','sent') then raise exception 'Invalid normalized callback';end if;
  select * into m from public.communication_outbox where organization_id=o and provider=p->>'provider' and provider_message_id=p->>'provider_message_id';if not found then raise exception 'Provider receipt not found';end if;
  insert into public.communication_callbacks(organization_id,provider,event_id,message_id,outcome) values(o,m.provider,p->>'event_id',m.id,outcome) on conflict do nothing;
  if not found then return jsonb_build_object('duplicate',true);end if;
  if outcome='delivered' and m.status='sent' then update public.communication_outbox set status='delivered',delivered_at=now(),failure_class=null where id=m.id;perform private.comm_audit(o,m.campaign_id,'delivery.delivered',m.id);
  elsif outcome in ('hard_bounce','complaint','rejected','undelivered','failed','soft_bounce') then
   if m.status<>'delivered' then update public.communication_outbox set status='failed',failure_class=case when outcome='soft_bounce' then 'transient' else outcome end,failed_at=now() where id=m.id;end if;
   if outcome in ('hard_bounce','complaint') then insert into public.communication_suppressions(organization_id,channel,address,reason) values(o,m.channel,m.address_snapshot,outcome) on conflict(organization_id,channel,address,reason) do update set active=true,cleared_at=null;end if;
   perform private.comm_audit(o,m.campaign_id,'delivery.'||outcome,m.id);
  end if;return jsonb_build_object('recorded',true);
 elsif action='keyword' then
  if length(coalesce(p->>'event_id','')) not between 1 and 200 then raise exception 'Preference event ID required';end if;
  insert into public.communication_keyword_events(organization_id,event_id,keyword) values(o,p->>'event_id',p->>'keyword') on conflict do nothing;if not found then return jsonb_build_object('duplicate',true);end if;
  if p->>'keyword' not in ('STOP','START','HELP','UNSUBSCRIBE') then raise exception 'Unknown preference keyword';end if;
  if p->>'keyword' in ('STOP','UNSUBSCRIBE') then insert into public.communication_suppressions(organization_id,channel,address,reason) values(o,p->>'channel',private.comm_address(p->>'channel',p->>'address'),case when p->>'keyword'='STOP' then 'stop' else 'unsubscribe' end) on conflict(organization_id,channel,address,reason) do update set active=true,cleared_at=null;
  elsif p->>'keyword'='START' then update public.communication_suppressions set active=false,cleared_at=now() where organization_id=o and channel='sms' and address=private.comm_address('sms',p->>'address') and reason='stop';end if;
  -- START clears only STOP. It never manufactures marketing/purpose consent.
  perform private.comm_audit(o,null,'preference.keyword',null,jsonb_build_object('keyword',p->>'keyword','channel',p->>'channel'));return jsonb_build_object('keyword',p->>'keyword','consent_granted',false);
 else raise exception 'Unknown worker action';end if;
end$$;

create function public.communications_workspace(p_action text,p_campaign uuid default null,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.comm_workspace(p_action,p_campaign,p_payload)$$;

create function public.communications_service(p_action text,p_organization uuid,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.comm_service(p_action,p_organization,p_payload)$$;

revoke all on function public.communications_workspace(text,uuid,jsonb) from public,anon,service_role;

grant execute on function public.communications_workspace(text,uuid,jsonb) to authenticated;

revoke all on function public.communications_service(text,uuid,jsonb) from public,anon,authenticated;

grant execute on function public.communications_service(text,uuid,jsonb) to service_role;

do $$declare x record;begin
 for x in select tablename from pg_tables where schemaname='public' and tablename like 'communication_%' loop execute format('alter table public.%I enable row level security',x.tablename);execute format('revoke all on public.%I from public,anon,authenticated,service_role',x.tablename);end loop;
 for x in select oid::regprocedure f from pg_proc where pronamespace='private'::regnamespace and proname like 'comm_%' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',x.f);end loop;
end$$;

grant execute on function private.comm_workspace(text,uuid,jsonb) to authenticated;

grant execute on function private.comm_service(text,uuid,jsonb) to service_role;

-- H1 additive build candidate. No hosted application, bootstrap grant, provider secret or activation.
alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;

-- Additive installed capability union; accepted NMI pattern.
do $$declare keys text[];begin
 keys:=array(select distinct k from unnest(private.staff_permission_keys()||array['people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage','staff.view','staff.manage','finance.read','finance.configure','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage','events.view','events.manage','registrations.view','registrations.manage','outreach.view','outreach.manage','courses.manage','forms.view','forms.manage','checkin.view','checkin.manage','registrations.restricted','registrations.override','dream_team.application.read','dream_team.application.manage','dream_team.application.restricted','dream_team.placement.manage','communications.send','communications.view','communications.bulk_send','communications.templates.view','communications.templates.manage','communications.delivery.view','communications.providers.view','communications.providers.manage','communications.providers.test','communications.providers.enable']::text[])k order by k);
execute format('alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check(permission=any(%L::text[]))',keys);
end $$;

-- Additive installed capability union; accepted NMI pattern.
do $$declare keys text[];begin
 keys:=array(select distinct k from unnest(private.staff_permission_keys()||array['people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage','staff.view','staff.manage','finance.read','finance.configure','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage','events.view','events.manage','registrations.view','registrations.manage','outreach.view','outreach.manage','courses.manage','forms.view','forms.manage','checkin.view','checkin.manage','registrations.restricted','registrations.override','dream_team.application.read','dream_team.application.manage','dream_team.application.restricted','dream_team.placement.manage','communications.send','communications.view','communications.bulk_send','communications.templates.view','communications.templates.manage','communications.delivery.view','communications.providers.view','communications.providers.manage','communications.providers.test','communications.providers.enable']::text[])k order by k);
execute format('create or replace function private.staff_permission_keys() returns text[] language sql immutable set search_path='''' as %L','select '||quote_literal(keys)||'::text[]');
end $$;

create or replace function private.comm_workspace(action text,c uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o uuid:=(p->>'organization_id')::uuid;camp public.outreach_campaigns;t public.communication_templates;b public.communication_batches;m public.communication_outbox;profile public.communication_sender_profiles;
 target_id uuid:=(p->>'id')::uuid;recipient jsonb;items jsonb;vars jsonb;result jsonb;key text;ch text;typ text;purp text;subj text;body text;addr text;block text;cfg public.communication_settings;needs text;at_time timestamptz;cnt integer;allowed text[]:=array['communications.view','communications.send','communications.bulk_send','communications.templates.view','communications.templates.manage','communications.delivery.view','communications.providers.view','communications.providers.manage','communications.providers.test','communications.providers.enable'];
begin
 if not private.outreach_verified(auth.uid()) then raise exception 'Verified identity required' using errcode='42501';end if;
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>32000 then raise exception 'Invalid request';end if;
 if action='context' then return jsonb_build_object(
 'organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'permissions',(select jsonb_agg(k) from unnest(allowed) k where private.comm_can(x.id,null,k)))),'[]') from public.organizations x where exists(select 1 from unnest(allowed) k where private.comm_can(x.id,null,k))),
 'campaigns',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'organization_id',x.organization_id,'name',x.name,'permissions',(select jsonb_agg(k) from unnest(allowed) k where private.comm_can(x.organization_id,x.id,k)))),'[]') from public.outreach_campaigns x where exists(select 1 from unnest(allowed) k where private.comm_can(x.organization_id,x.id,k))));end if;
 if c is not null then select * into camp from public.outreach_campaigns where id=c;if not found or (o is not null and o<>camp.organization_id) then raise exception 'Campaign denied' using errcode='42501';end if;o:=camp.organization_id;end if;
 if o is null then raise exception 'Organization required';end if;
 needs:=case when action in ('template_create','template_edit','template_publish','template_deactivate','route_save') then 'communications.templates.manage' when action in ('templates','template_preview') then 'communications.templates.view' when action in ('preview','confirm','cancel','retry','consent','preferences','suppress','external_action','senders') then 'communications.send' when action in ('activity','message','batch','history','external_history') then 'communications.delivery.view' else 'communications.view' end;
 if not private.comm_can(o,c,needs) then raise exception 'Communications access denied' using errcode='42501';end if;
 perform private.comm_lock(o);
 if not private.comm_can(o,c,needs) then raise exception 'Communications access revoked' using errcode='42501';end if;
 insert into public.communication_settings(organization_id) values(o) on conflict do nothing;
 select * into cfg from public.communication_settings where organization_id=o;
 if action='overview' then
  return jsonb_build_object('metrics',(select coalesce(jsonb_object_agg(status,n),'{}') from (select status,count(*) n from public.communication_outbox where organization_id=o and campaign_id is not distinct from c group by status) x),'delivery_mode',cfg.delivery_mode,'permissions',(select jsonb_agg(k) from unnest(allowed) k where private.comm_can(o,c,k)),
  'senders',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.communication_sender_profiles s where s.organization_id=o and s.active),'routes',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.communication_routes r where r.organization_id=o and r.campaign_id=c));
 elsif action='senders' then
  return coalesce((select jsonb_agg(to_jsonb(x)) from public.communication_sender_profiles x where x.organization_id=o and x.active),'[]');
 elsif action='templates' then
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.template_key,x.version desc) from public.communication_templates x where x.organization_id=o),'[]');
 elsif action in ('template_create','template_edit') then
  if action='template_edit' then select * into t from public.communication_templates where organization_id=o and communication_templates.id=target_id;if not found or t.state<>'draft' or t.revision<>(p->>'revision')::int then raise exception 'Current draft required';end if;
  else t.id:=gen_random_uuid();t.template_key:=p->>'template_key';t.channel:=p->>'channel';t.locale:=coalesce(p->>'locale','en');select coalesce(max(version),0)+1 into t.version from public.communication_templates where organization_id=o and template_key=t.template_key and channel=t.channel and locale=t.locale;end if;
  -- Validate token names without accepting arbitrary code. Preview supplies actual data later.
  perform private.comm_render(coalesce(p->>'subject','')||' '||(p->>'body'),'{"first_name":"sample","campaign_name":"sample","campaign_date":"sample","church_name":"sample","task_name":"sample","due_date":"sample","portal_link":"sample","registration_link":"sample","event_location":"sample","coordinator_name":"sample"}');
  if action='template_create' then insert into public.communication_templates(id,organization_id,template_key,channel,message_type,purpose,version,locale,subject,body,created_by) values(t.id,o,t.template_key,t.channel,p->>'message_type',p->>'purpose',t.version,t.locale,coalesce(p->>'subject',''),p->>'body',auth.uid()) returning * into t;
  else update public.communication_templates set subject=coalesce(p->>'subject',''),body=p->>'body',revision=revision+1 where communication_templates.id=t.id returning * into t;end if;
  perform private.comm_audit(o,c,action,t.id);return to_jsonb(t);
 elsif action in ('template_publish','template_deactivate','template_preview') then
  select * into t from public.communication_templates where organization_id=o and communication_templates.id=target_id;if not found then raise exception 'Template denied' using errcode='42501';end if;
  if action='template_preview' then return jsonb_build_object('subject',private.comm_render(t.subject,coalesce(p->'variables','{}')),'body',private.comm_render(t.body,coalesce(p->'variables','{}')));end if;
  if action='template_publish' and t.state='draft' then
   if t.revision<>(p->>'revision')::int then raise exception 'Draft revision changed';end if;
   update public.communication_templates set active=false where organization_id=o and template_key=t.template_key and channel=t.channel and locale=t.locale and active;
   update public.communication_templates set state='published',active=true,published_at=now() where communication_templates.id=target_id returning * into t;
  elsif action='template_deactivate' then update public.communication_templates set active=false where communication_templates.id=target_id returning * into t;end if;
  perform private.comm_audit(o,c,action,t.id);return to_jsonb(t);
 elsif action in ('consent','preferences','suppress','external_action') then
  select x into recipient from jsonb_array_elements(private.comm_audience(o,c,p->'audience')) x where x->>'key'=p->>'recipient_key';
  if recipient is null then raise exception 'Recipient denied' using errcode='42501';end if;
  ch:=p->>'channel';key:=recipient->>'key';addr:=private.comm_address(ch,recipient->>ch);
  if action='consent' then
   if coalesce(p->>'status','') not in ('granted','revoked') or length(coalesce(p->>'proof_reference',''))<5 or coalesce((p->>'explicitly_reviewed')::boolean,false)=false then raise exception 'Explicit reviewed consent proof required';end if;
   insert into public.communication_consents(organization_id,campaign_id,recipient_key,channel,purpose,status,source,proof_reference,recorded_by,revoked_at) values(o,c,key,ch,p->>'purpose',p->>'status',p->>'source',p->>'proof_reference',auth.uid(),case when p->>'status'='revoked' then now() end)
   on conflict(organization_id,coalesce(campaign_id,'00000000-0000-0000-0000-000000000000'::uuid),recipient_key,channel,purpose) do update set status=excluded.status,source=excluded.source,proof_reference=excluded.proof_reference,recorded_by=excluded.recorded_by,recorded_at=now(),revoked_at=excluded.revoked_at returning to_jsonb(communication_consents) into result;
  elsif action='preferences' then
   insert into public.communication_preferences(organization_id,recipient_key,email_allowed,sms_allowed,preferred_channel,timezone) values(o,key,(p->>'email_allowed')::boolean,(p->>'sms_allowed')::boolean,p->>'preferred_channel',coalesce(p->>'timezone','UTC')) on conflict(organization_id,recipient_key) do update set email_allowed=excluded.email_allowed,sms_allowed=excluded.sms_allowed,preferred_channel=excluded.preferred_channel,timezone=excluded.timezone returning to_jsonb(communication_preferences) into result;
  elsif action='suppress' then
   insert into public.communication_suppressions(organization_id,channel,address,reason) values(o,ch,addr,'admin') on conflict(organization_id,channel,address,reason) do update set active=true,cleared_at=null;result:=jsonb_build_object('suppressed',true);
  else if ch not in ('email','sms') then raise exception 'External channel required';end if;result:=jsonb_build_object('recorded_as','external_manual','delivered',false);end if;
  perform private.comm_audit(o,c,action,null,jsonb_build_object('recipient_key',key,'channel',ch,'status',p->>'status','purpose',p->>'purpose','external_manual',action='external_action'));return result;
 elsif action='preview' then
  select * into b from public.communication_batches where organization_id=o and request_key=(p->>'request_key')::uuid;
  if found then if b.request_snapshot<>p or b.created_by<>auth.uid() or b.campaign_id is distinct from c then raise exception 'Request key conflict';end if;return jsonb_build_object('batch',to_jsonb(b),'delivery_mode',cfg.delivery_mode);end if;
  ch:=p->>'channel';select * into profile from public.communication_sender_profiles where organization_id=o and communication_sender_profiles.id=(p->>'sender_profile_id')::uuid and active and channel=ch;
  if not found then raise exception 'Approved sender profile required';end if;
  if p->>'template_id' is not null then select * into t from public.communication_templates where organization_id=o and communication_templates.id=(p->>'template_id')::uuid and active and channel=ch;if not found then raise exception 'Published matching template required';end if;typ:=t.message_type;purp:=t.purpose;subj:=t.subject;body:=t.body;
  else typ:=p->>'message_type';purp:=p->>'purpose';subj:=coalesce(p->>'subject','');body:=p->>'body';if length(body) not between 1 and 12000 or length(subj)>240 or subj ~ E'[\r\n]' or typ='marketing' and purp<>'marketing' then raise exception 'Invalid composed content';end if;end if;
  items:='[]';for recipient in select x from jsonb_array_elements(private.comm_audience(o,c,p->'audience')) x loop
   addr:=private.comm_address(ch,recipient->>ch);vars:=private.comm_variables(o,c,recipient,coalesce(p->'variables','{}'));block:=private.comm_block(o,c,recipient->>'key',ch,addr,purp);
   begin
    result:=jsonb_build_object('subject',private.comm_render(subj,vars),'body',private.comm_render(body,vars)||case when profile.footer<>'' then E'\n\n'||profile.footer else '' end);
   exception when others then if SQLERRM like 'Missing template variable:%' then block:='missing_template_data';result:=jsonb_build_object('subject',subj,'body',body,'warning',SQLERRM);else raise;end if;end;
   items:=items||jsonb_build_array(recipient||result||jsonb_build_object('address',coalesce(addr,''),'blocked',block,'variables',vars));
  end loop;
  -- Canonical identity dedupe, deterministic ordering; also avoid duplicate destination within this intended send.
  select coalesce(jsonb_agg(x order by x->>'key'),'[]') into items from (select distinct on (coalesce(nullif(x->>'address',''),x->>'key')) x from jsonb_array_elements(items) x order by coalesce(nullif(x->>'address',''),x->>'key'),x->>'key') q;
  cnt:=jsonb_array_length(items);if cnt>1 and not private.comm_can(o,c,'communications.bulk_send') then raise exception 'Bulk send permission required' using errcode='42501';end if;
  at_time:=coalesce((p->>'scheduled_at')::timestamptz,now());
  insert into public.communication_batches(organization_id,campaign_id,request_key,created_by,request_snapshot,recipients,channel,message_type,purpose,template_id,sender_profile_id,subject,body,variables,campaign_revision,scheduled_at)
  values(o,c,(p->>'request_key')::uuid,auth.uid(),p,items,ch,typ,purp,t.id,profile.id,subj,body,coalesce(p->'variables','{}'),camp.revision,at_time) returning * into b;
  perform private.comm_audit(o,c,'audience.preview',b.id,jsonb_build_object('count',cnt));return jsonb_build_object('batch',to_jsonb(b),'delivery_mode',cfg.delivery_mode);
 elsif action='confirm' then
  select * into b from public.communication_batches where organization_id=o and communication_batches.id=target_id and campaign_id is not distinct from c;
  if not found or b.created_by<>auth.uid() then raise exception 'Batch denied' using errcode='42501';end if;
  if b.state='queued' then return jsonb_build_object('id',b.id,'state',b.state);end if;
  if b.state<>'draft' or not coalesce((p->>'confirmed')::boolean,false) or b.created_at<now()-interval '15 minutes' then raise exception 'Current explicit confirmation required';end if;
  if c is not null and b.campaign_revision<>camp.revision then raise exception 'Campaign changed; preview again';end if;
  if b.template_id is not null and not exists(select 1 from public.communication_templates where communication_templates.id=b.template_id and active) then raise exception 'Template changed; preview again';end if;
  if not exists(select 1 from public.communication_sender_profiles where communication_sender_profiles.id=b.sender_profile_id and active) then raise exception 'Sender inactive';end if;
  cnt:=jsonb_array_length(b.recipients);if cnt>1 and not private.comm_can(o,c,'communications.bulk_send') then raise exception 'Bulk send permission required' using errcode='42501';end if;
  -- All counts serialize with enqueue on the organization lock; legitimate limits are tenant-configurable.
  if (select count(*) from public.communication_outbox where organization_id=o and created_at>now()-make_interval(secs=>cfg.window_seconds))+cnt>cfg.organization_limit or
   (select count(*) from public.communication_outbox where organization_id=o and campaign_id is not distinct from c and created_at>now()-make_interval(secs=>cfg.window_seconds))+cnt>cfg.campaign_limit or
   (select count(*) from public.communication_outbox msg join public.communication_batches x on x.id=msg.batch_id where msg.organization_id=o and x.created_by=auth.uid() and msg.created_at>now()-make_interval(secs=>cfg.window_seconds))+cnt>cfg.user_limit then raise exception 'Communications rate limit' using errcode='54000';end if;
  for recipient in select x from jsonb_array_elements(b.recipients) x loop
   if not exists(select 1 from jsonb_array_elements(private.comm_audience(o,c,b.request_snapshot->'audience')) x where x->>'key'=recipient->>'key' and private.comm_address(b.channel,x->>b.channel)=recipient->>'address') then raise exception 'Audience changed; preview again';end if;
   if (select count(*) from public.communication_outbox where organization_id=o and recipient_key=recipient->>'key' and created_at>now()-make_interval(secs=>cfg.window_seconds))>=cfg.recipient_limit then raise exception 'Recipient rate limit' using errcode='54000';end if;
   if recipient->>'blocked'='missing_template_data' then continue;end if;
   perform private.comm_enqueue(o,c,recipient,b.channel,b.message_type,b.purpose,b.template_id,b.sender_profile_id,recipient->>'subject',recipient->>'body','batch:'||b.id||':'||(recipient->>'key')||':'||b.channel,b.scheduled_at,b.id);
  end loop;
  update public.communication_batches set state='queued',confirmed_at=now() where communication_batches.id=b.id;
  select count(*) into cnt from public.communication_outbox where batch_id=b.id;perform private.comm_audit(o,c,'bulk.confirmed',b.id,jsonb_build_object('count',cnt));return jsonb_build_object('id',b.id,'state','queued','count',cnt);
 elsif action='external_history' then
  if p->>'person_id' is null or not private.person_permission(o,(p->>'person_id')::uuid,'people.read') then raise exception 'People history access denied' using errcode='42501';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('channel',a.metadata->>'channel','created_at',a.created_at,'campaign_id',a.campaign_id,'status','external_manual')) from public.communication_audit a where a.organization_id=o and (c is null or a.campaign_id=c) and a.kind='external_action' and a.metadata->>'recipient_key'='person:'||(p->>'person_id')),'[]');
 elsif action in ('activity','history') then
  if action='history' then
   if p->>'person_id' is null or not private.person_permission(o,(p->>'person_id')::uuid,'people.read') then raise exception 'People history access denied' using errcode='42501';end if;
  end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select id,campaign_id,recipient_key,recipient_name,channel,message_type,template_id,status,provider,provider_message_id,failure_class,created_at,scheduled_at,sent_at,delivered_at,failed_at,attempts from public.communication_outbox where organization_id=o and (campaign_id is not distinct from c or (action='history' and c is null))
   and (action<>'history' or recipient_key='person:'||(p->>'person_id')) and (coalesce(p->>'channel','')='' or channel=p->>'channel') and (coalesce(p->>'status','')='' or status=p->>'status') and (coalesce(p->>'message_type','')='' or message_type=p->>'message_type') and (coalesce(p->>'provider','')='' or provider=p->>'provider') and (coalesce(p->>'recipient','')='' or recipient_name ilike '%'||(p->>'recipient')||'%') and (p->>'from' is null or created_at>=(p->>'from')::timestamptz) and (p->>'to' is null or created_at<(p->>'to')::timestamptz+interval '1 day') order by created_at desc limit 200) x),'[]');
 elsif action in ('message','batch','cancel','retry') then
  if action='batch' then select * into b from public.communication_batches where organization_id=o and communication_batches.id=target_id and campaign_id is not distinct from c;if not found then raise exception 'Batch denied' using errcode='42501';end if;return (to_jsonb(b)-'recipients'-'body'-'subject'-'variables'-'request_snapshot')||jsonb_build_object('messages',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.recipient_name,'status',x.status,'failure_class',x.failure_class)),'[]') from public.communication_outbox x where x.batch_id=b.id));end if;
  select * into m from public.communication_outbox where organization_id=o and communication_outbox.id=target_id and campaign_id is not distinct from c;if not found then raise exception 'Message denied' using errcode='42501';end if;
  if action='message' then if not private.comm_can(o,c,'communications.view') then raise exception 'Message body access denied' using errcode='42501';end if;return to_jsonb(m)-'lease_token';end if;
  if action='cancel' and m.status in ('draft','queued','scheduled') then update public.communication_outbox set status='cancelled',credits_released=credits_reserved,credits_reserved=0 where communication_outbox.id=target_id;
  elsif action='retry' and m.status='failed' and m.failure_class='transient' and m.attempts<cfg.max_attempts then update public.communication_outbox set status='queued',scheduled_at=now(),failure_class=null where communication_outbox.id=target_id;
  else raise exception 'Message state cannot be changed';end if;
  perform private.comm_audit(o,c,action,target_id);return jsonb_build_object('id',target_id,'action',action);
 elsif action='route_save' then
  if c is null or not private.comm_can(o,c,'communications.send') or not private.comm_can(o,c,'communications.bulk_send') or not coalesce((p->>'confirmed')::boolean,false) then raise exception 'Explicit automation approval required' using errcode='42501';end if;
  select * into t from public.communication_templates where organization_id=o and communication_templates.id=(p->>'template_id')::uuid and active;if not found then raise exception 'Published route template required';end if;
  select * into profile from public.communication_sender_profiles where organization_id=o and communication_sender_profiles.id=(p->>'sender_profile_id')::uuid and active and channel=t.channel;if not found then raise exception 'Matching approved sender required';end if;
  perform private.comm_audience(o,c,p->'audience');
  insert into public.communication_routes(organization_id,campaign_id,event_kind,template_id,sender_profile_id,audience,enabled,approved_by,approved_at) values(o,c,p->>'event_kind',t.id,(p->>'sender_profile_id')::uuid,p->'audience',coalesce((p->>'enabled')::boolean,false),auth.uid(),now()) on conflict(campaign_id,event_kind,template_id) do update set audience=excluded.audience,enabled=excluded.enabled,approved_by=excluded.approved_by,approved_at=excluded.approved_at returning to_jsonb(communication_routes) into result;
  perform private.comm_audit(o,c,'route.approved',(result->>'id')::uuid);return result;
 else raise exception 'Unknown communications action';end if;
end$$;

-- Trusted worker surface only. No browser worker credentials or arbitrary provider dispatch.
-- Global control is explicitly bootstrapped later by a trusted operator; no staff.manage inference.
create table public.communication_external_control (
 singleton boolean primary key default true check(singleton), external_enabled boolean not null default false,
 environment text not null default 'unconfigured' check(environment in ('unconfigured','acceptance','production')),
 project_ref text check(project_ref ~ '^[a-z]{20}$'), revision integer not null default 1,
 check((environment='unconfigured')=(project_ref is null))
);

insert into public.communication_external_control(singleton)values(true);

create table public.communication_super_admins (
 user_id uuid primary key references auth.users(id), active boolean not null default false,
 expires_at timestamptz not null, approved_by uuid references auth.users(id), reason text not null check(length(reason)>5)
);

create table public.communication_org_delivery (
 organization_id uuid primary key references public.organizations(id), enabled boolean not null default false,
 email_enabled boolean not null default false, sms_enabled boolean not null default false
);

create table public.communication_provider_controls (
 profile_id uuid primary key, organization_id uuid not null, environment text not null check(environment in ('acceptance','production')),
 project_ref text not null check(project_ref ~ '^[a-z]{20}$'), provider_name text not null check(length(provider_name) between 1 and 120),
 configured boolean not null default false, credentials_verified boolean not null default false, sender_approved boolean not null default false,
 mode text not null default 'disabled' check(mode in ('disabled','configured','verification_pending','verified','test_only','production_enabled','suspended')),
 enabled boolean not null default false, production_allowed boolean not null default false,
 sending_domain text, allowed_classes text[] not null default array['transactional']::text[] check(allowed_classes <@ array['transactional','operational','reminder','follow_up','campaign','marketing','receipt','security']::text[]),
 health text not null default 'unknown' check(health in ('healthy','degraded','disabled','configuration_error','provider_error','unknown')),
 last_success_at timestamptz, last_failure_at timestamptz,last_callback_at timestamptz,last_verified_at timestamptz,
 consecutive_failures integer not null default 0 check(consecutive_failures>=0), revision integer not null default 1,
 foreign key(organization_id,profile_id)references public.communication_sender_profiles(organization_id,id),
 check(not enabled or (configured and credentials_verified and sender_approved and mode in ('test_only','production_enabled'))),
 check(mode<>'production_enabled' or production_allowed)
);

create table public.communication_test_allowlist (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 channel text not null check(channel in ('email','sms')), recipient text not null check(recipient !~ '[*%\r\n]'),
 purpose text not null check(purpose='transactional'), enabled boolean not null default true,
 expires_at timestamptz not null, approved_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 constraint communication_test_allowlist_scope unique(organization_id,channel,recipient,purpose),check(private.comm_valid_address(channel,recipient))
);

create table public.communication_provider_tests (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 request_key uuid not null,profile_id uuid not null,person_id uuid not null,created_by uuid not null references auth.users(id),
 message_id uuid not null,authorized_at timestamptz not null default now(),
 unique(organization_id,request_key),unique(message_id),
 foreign key(organization_id,profile_id)references public.communication_sender_profiles(organization_id,id),
 foreign key(organization_id,person_id)references public.organization_people(organization_id,id),
 foreign key(organization_id,message_id)references public.communication_outbox(organization_id,id)
);

create function private.comm_external_lock(o uuid) returns void language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended('communications:external-control',0));
 perform private.comm_lock(o);
end$$;

create function private.comm_super_admin()returns boolean language sql volatile security definer set search_path='' as $$
 select private.outreach_verified(auth.uid()) and exists(select 1 from public.communication_super_admins where user_id=auth.uid() and active and expires_at>now() and approved_by is not null)
$$;

create function private.comm_external_gate(m public.communication_outbox) returns text language plpgsql security definer set search_path='' as $$
declare g public.communication_external_control;org public.communication_org_delivery;ctl public.communication_provider_controls;s public.communication_sender_profiles;t public.communication_provider_tests;begin
 select * into g from public.communication_external_control;
 select * into org from public.communication_org_delivery where organization_id=m.organization_id;
 select * into ctl from public.communication_provider_controls where profile_id=m.sender_profile_id and organization_id=m.organization_id;
 select * into s from public.communication_sender_profiles where id=m.sender_profile_id and organization_id=m.organization_id;
 select * into t from public.communication_provider_tests where message_id=m.id;
 if t.id is null then return 'message_activation_required';end if; -- G queues/automations cannot drain to external providers in H1.
 if not coalesce(g.external_enabled,false) then return 'global_disabled';end if;
 if not coalesce(org.enabled,false) or not coalesce(case when m.channel='email' then org.email_enabled else org.sms_enabled end,false) then return 'organization_channel_disabled';end if;
 if ctl.profile_id is null or ctl.environment<>g.environment or ctl.project_ref is distinct from g.project_ref then return 'environment_mismatch';end if;
 if not(ctl.configured and ctl.credentials_verified and ctl.sender_approved and ctl.enabled and ctl.mode in ('test_only','production_enabled')) or not s.active or s.channel<>m.channel or not(m.message_type=any(ctl.allowed_classes)) then return 'profile_disabled';end if;
 if ctl.mode='production_enabled' and not ctl.production_allowed then return 'production_activation_required';end if;
 if not exists(select 1 from public.communication_test_allowlist a where a.organization_id=m.organization_id and a.channel=m.channel and a.recipient=m.address_snapshot and a.purpose=m.purpose and a.enabled and a.expires_at>now()) then return 'test_recipient_not_allowlisted';end if;
 if not private.comm_actor_can(m.organization_id,null,'communications.providers.view',t.created_by) or not private.comm_actor_can(m.organization_id,null,'communications.providers.test',t.created_by) or not private.comm_actor_can(m.organization_id,null,'people.read',t.created_by) then return 'test_authority_revoked';end if;
 if not exists(select 1 from public.organization_people pp where pp.id=t.person_id and pp.organization_id=m.organization_id and private.comm_address(m.channel,case when m.channel='email' then pp.email else pp.phone end)=m.address_snapshot and not exists(select 1 from public.outreach_team_members child where child.person_id=pp.id and child.organization_id=m.organization_id and child.age<18)) then return 'recipient_changed_or_restricted';end if;
 return private.comm_block(m.organization_id,null,m.recipient_key,m.channel,m.address_snapshot,m.purpose);
end$$;

create function private.comm_provider_workspace(action text,o uuid,p jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare s public.communication_sender_profiles;ctl public.communication_provider_controls;person public.organization_people;
 m public.communication_outbox;mid uuid;id uuid:=(p->>'id')::uuid;need text;g public.communication_external_control;org public.communication_org_delivery;
 recipient text;subj text;body text;block text;req uuid;existing public.communication_provider_tests;cnt integer;begin
 if not private.outreach_verified(auth.uid()) or jsonb_typeof(p)<>'object' or octet_length(p::text)>8000 then raise exception 'Provider access denied' using errcode='42501';end if;
 if action='context' then return jsonb_build_object('super_admin',private.comm_super_admin(),'organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'permissions',(select jsonb_agg(k)from unnest(array['communications.providers.view','communications.providers.manage','communications.providers.test','communications.providers.enable'])k where private.comm_can(x.id,null,k)))),'[]')from public.organizations x where private.comm_can(x.id,null,'communications.providers.view')));end if;
 need:=case when action in ('configure','allowlist_add','allowlist_remove') then 'manage' when action in ('test_preview','test_confirm','dry_run','verify_request','test_dispatch_request','test_recipients')then 'test' when action in ('enable','disable','suspend','org_delivery','global_delivery')then 'enable' else 'view' end;
 if o is null or not private.comm_can(o,null,'communications.providers.'||need) or not private.comm_can(o,null,'communications.providers.view') then raise exception 'Provider access denied' using errcode='42501';end if;
 perform private.comm_external_lock(o);
 if not private.comm_can(o,null,'communications.providers.'||need) then raise exception 'Provider access revoked' using errcode='42501';end if;
 select * into g from public.communication_external_control;
 insert into public.communication_org_delivery(organization_id)values(o)on conflict do nothing;
 select * into org from public.communication_org_delivery where organization_id=o;
 if action='overview' then return jsonb_build_object('global_enabled',g.external_enabled,'environment',g.environment,'super_admin',private.comm_super_admin(),'organization',to_jsonb(org),'profiles',(select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('sender',to_jsonb(ss))),'[]')from public.communication_provider_controls c join public.communication_sender_profiles ss on ss.id=c.profile_id where c.organization_id=o),'allowlist',(select coalesce(jsonb_agg(to_jsonb(a)),'[]')from public.communication_test_allowlist a where a.organization_id=o),'email_status',case when exists(select 1 from public.communication_provider_controls c join public.communication_sender_profiles ss on ss.id=c.profile_id where c.organization_id=o and ss.channel='email')then 'SENDER PROFILE CONFIGURED'else 'PENDING SENDER CONFIGURATION'end,'sms_status',case when exists(select 1 from public.communication_provider_controls c join public.communication_sender_profiles ss on ss.id=c.profile_id where c.organization_id=o and ss.channel='sms' and c.configured)then 'CONFIGURED'else 'NOT CONFIGURED / PROVIDER SELECTION REQUIRED'end);
 elsif action='test_recipients' then
  if not private.comm_can(o,null,'people.read')then raise exception 'Scoped People read required' using errcode='42501';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',pp.id,'name',pp.first_name||' '||pp.last_name,'address',aa.recipient,'channel',aa.channel))from public.communication_test_allowlist aa join public.organization_people pp on pp.organization_id=aa.organization_id and aa.recipient=private.comm_address(aa.channel,case when aa.channel='email'then pp.email else pp.phone end)where aa.organization_id=o and aa.enabled and aa.expires_at>now()and not exists(select 1 from public.outreach_team_members child where child.person_id=pp.id and child.organization_id=o and child.age<18)),'[]');
 elsif action='global_delivery' then
  if not private.comm_super_admin() then raise exception 'Explicit Super Admin required' using errcode='42501';end if;
  if p->>'enabled'='true' and g.environment='unconfigured' then raise exception 'Environment bootstrap required';end if;
  update public.communication_external_control set external_enabled=(p->>'enabled')::boolean,revision=revision+1;
 elsif action='org_delivery' then
  update public.communication_org_delivery set enabled=(p->>'enabled')::boolean,email_enabled=(p->>'email_enabled')::boolean,sms_enabled=(p->>'sms_enabled')::boolean where organization_id=o;
 elsif action='allowlist_add' then
  recipient:=private.comm_address(p->>'channel',p->>'recipient');
  if (p->>'expires_at')::timestamptz<=now() or (p->>'expires_at')::timestamptz>now()+interval '30 days' then raise exception 'Allowlist expiry required within 30 days';end if;
  insert into public.communication_test_allowlist(organization_id,channel,recipient,purpose,expires_at,approved_by)values(o,p->>'channel',recipient,'transactional',(p->>'expires_at')::timestamptz,auth.uid())on conflict on constraint communication_test_allowlist_scope do update set enabled=true,expires_at=excluded.expires_at,approved_by=auth.uid();
 elsif action='allowlist_remove' then
  update public.communication_test_allowlist set enabled=false where organization_id=o and communication_test_allowlist.id=id;if not found then raise exception 'Allowlist denied' using errcode='42501';end if;
 else
  select * into s from public.communication_sender_profiles where organization_id=o and communication_sender_profiles.id=id;
  select * into ctl from public.communication_provider_controls where profile_id=id and organization_id=o;
  if s.id is null or ctl.profile_id is null then raise exception 'Provider profile denied' using errcode='42501';end if;
  if action='configure' then
   update public.communication_provider_controls set provider_name=p->>'provider_name',allowed_classes=array(select jsonb_array_elements_text(p->'allowed_classes')),credentials_verified=false,last_verified_at=null,enabled=false,mode='verification_pending',health='unknown',revision=revision+1 where profile_id=id;
  elsif action='verify_request' then
   perform private.comm_audit(o,null,'provider.verify_requested',id);
   return jsonb_build_object('id',id,'revision',ctl.revision,'environment',ctl.environment,'project_ref',ctl.project_ref,'sender',to_jsonb(s));
  elsif action in ('enable','disable','suspend')then
   if action='enable' and (not(ctl.configured and ctl.credentials_verified and ctl.sender_approved) or ctl.environment<>g.environment or ctl.project_ref is distinct from g.project_ref or p->>'mode' not in ('test_only','production_enabled') or (p->>'mode'='production_enabled' and not ctl.production_allowed)) then raise exception 'Verified sender and explicit activation required';end if;
   if action='enable' and ctl.enabled and ctl.mode=p->>'mode' then return jsonb_build_object('unchanged',true);end if;
   update public.communication_provider_controls set enabled=action='enable',mode=case when action='enable' then p->>'mode' when action='suspend'then 'suspended'else 'disabled'end,health=case when action='enable'then 'unknown'else 'disabled'end,consecutive_failures=case when action='enable'then 0 else consecutive_failures end,revision=revision+1 where profile_id=id;
   update public.communication_sender_profiles set active=action='enable' where communication_sender_profiles.id=id;
  elsif action in ('test_preview','test_confirm','dry_run')then
   if not private.comm_can(o,null,'people.read') then raise exception 'Scoped People read required' using errcode='42501';end if;
   select * into person from public.organization_people where organization_id=o and organization_people.id=(p->>'person_id')::uuid;
   if person.id is null then raise exception 'Test recipient denied' using errcode='42501';end if;
   recipient:=private.comm_address(s.channel,case when s.channel='email'then person.email else person.phone end);
   subj:=case when s.channel='email'then s.display_name||' Communications Test'else ''end;
   body:='This is an authorized test of the Global Propel Communications Core for '||s.display_name||'.';
   m.organization_id:=o;m.sender_profile_id:=id;m.channel:=s.channel;m.message_type:='transactional';m.purpose:='transactional';m.address_snapshot:=recipient;m.recipient_key:='person:'||person.id;
   block:=private.comm_block(o,null,m.recipient_key,s.channel,recipient,'transactional');
   if exists(select 1 from public.outreach_team_members child where child.person_id=person.id and child.organization_id=o and child.age<18)then block:='restricted_minor';end if;
   if not exists(select 1 from public.communication_test_allowlist a where a.organization_id=o and a.channel=s.channel and a.recipient=recipient and a.enabled and a.expires_at>now())then block:=coalesce(block,'test_recipient_not_allowlisted');end if;
   if action<>'test_confirm'then return jsonb_build_object('subject',subj,'body',body,'recipient',recipient,'mode',ctl.mode,'counts',jsonb_build_object('eligible',case when block is null then 1 else 0 end,'suppressed',case when block in ('suppression','preference','consent_required')then 1 else 0 end,'invalid',case when block in ('invalid_address','restricted_minor')then 1 else 0 end,'held',case when block is not null or not(g.external_enabled and org.enabled and ctl.enabled and ctl.credentials_verified and ctl.sender_approved and ctl.environment=g.environment and ctl.project_ref=g.project_ref and 'transactional'=any(ctl.allowed_classes) and case when s.channel='email'then org.email_enabled else org.sms_enabled end)then 1 else 0 end,'would_send',case when block is null and g.external_enabled and org.enabled and ctl.enabled and ctl.credentials_verified and ctl.sender_approved and ctl.environment=g.environment and ctl.project_ref=g.project_ref and 'transactional'=any(ctl.allowed_classes) and case when s.channel='email'then org.email_enabled else org.sms_enabled end then 1 else 0 end),'reason',block);end if;
   if p->>'confirmed' is distinct from 'true' or p->>'preview_subject' is distinct from subj or p->>'preview_body' is distinct from body or p->>'preview_recipient' is distinct from recipient then raise exception 'Exact reviewed test confirmation required';end if;
   req:=(p->>'request_key')::uuid;if req is null then raise exception 'Idempotency key required';end if;
   select * into existing from public.communication_provider_tests where organization_id=o and request_key=req;
   if found then
    if existing.profile_id<>id or existing.person_id<>person.id then raise exception 'Idempotency key content mismatch';end if;
    return jsonb_build_object('message_id',existing.message_id,'duplicate',true);
   end if;
   if block is not null then raise exception 'Test blocked: %',block;end if;
   insert into public.communication_settings(organization_id)values(o)on conflict do nothing;
   mid:=private.comm_enqueue(o,null,jsonb_build_object('key',m.recipient_key,'name',person.first_name||' '||person.last_name,s.channel,recipient),s.channel,'transactional','transactional',null,id,subj,body,'provider-test:'||req,now());
   insert into public.communication_provider_tests(organization_id,request_key,profile_id,person_id,created_by,message_id)values(o,req,id,person.id,auth.uid(),mid);
   select * into m from public.communication_outbox where communication_outbox.id=mid;
   block:=private.comm_external_gate(m);if block is not null then raise exception 'Test held: %',block;end if;
   perform private.comm_audit(o,null,'provider.test_authorized',mid,jsonb_build_object('profile',id));return jsonb_build_object('message_id',mid,'status','queued');
  elsif action in ('test_result','test_dispatch_request')then
   return coalesce((select jsonb_build_object('message_id',mm.id,'status',mm.status,'attempts',mm.attempts,'provider_message_id',mm.provider_message_id,'failure_class',mm.failure_class)from public.communication_outbox mm join public.communication_provider_tests tt on tt.message_id=mm.id where mm.organization_id=o and tt.profile_id=id and mm.id=(p->>'message_id')::uuid),'{}');
  else raise exception 'Unknown provider action';end if;
 end if;
 perform private.comm_audit(o,null,'provider.'||action,id);return jsonb_build_object('updated',true);
end$$;

create function public.communications_provider_workspace(p_action text,p_organization uuid default null,p_payload jsonb default '{}')returns jsonb language sql security invoker set search_path='' as $$select private.comm_provider_workspace(p_action,p_organization,p_payload)$$;

alter table public.communication_provider_controls add column structured_callbacks boolean not null default false;

create function private.comm_provider_service(action text,o uuid,p jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare g public.communication_external_control;ctl public.communication_provider_controls;s public.communication_sender_profiles;m public.communication_outbox;
 lease uuid;block text;ids jsonb:='[]';cfg public.communication_settings;id uuid:=(p->>'id')::uuid;ans jsonb;begin
 perform private.comm_external_lock(o);select * into g from public.communication_external_control;
 if action='bind_environment' then
  if g.external_enabled or (p->>'environment') not in ('acceptance','production') or (p->>'project_ref') !~ '^[a-z]{20}$' or ((p->>'environment'='acceptance') is distinct from (p->>'project_ref'='bkbmjisprwmkptywtmih'))then raise exception 'Disabled exact environment binding required';end if;
  update public.communication_external_control set environment=p->>'environment',project_ref=p->>'project_ref',revision=revision+1;return jsonb_build_object('bound',true);
 elsif action='provision' then
  if g.environment='unconfigured' or g.external_enabled then raise exception 'Disabled environment bootstrap required';end if;
  if p->>'provider' not in ('smtp_transport','sms_transport') or (p->>'channel',p->>'provider') not in (('email','smtp_transport'),('sms','sms_transport')) or (p->>'channel'='email' and not private.comm_valid_address('email',p->>'from_address')) or (p->>'reply_to' is not null and not private.comm_valid_address('email',p->>'reply_to')) then raise exception 'Approved sender metadata required';end if;
  insert into public.communication_sender_profiles(id,organization_id,channel,provider,display_name,from_address,reply_to,approved_at)values(id,o,p->>'channel',p->>'provider',p->>'display_name',p->>'from_address',p->>'reply_to',now());
  insert into public.communication_provider_controls(profile_id,organization_id,environment,project_ref,provider_name,configured,sender_approved,mode,sending_domain,structured_callbacks)values(id,o,g.environment,g.project_ref,p->>'provider_name',coalesce((p->>'configured')::boolean,false),coalesce((p->>'sender_approved')::boolean,false),'configured',case when p->>'channel'='email'then split_part(p->>'from_address','@',2)end,coalesce((p->>'structured_callbacks')::boolean,false));
  perform private.comm_audit(o,null,'provider.provision',id);return jsonb_build_object('id',id,'mode','configured');
 elsif action='claim_external' then
  if not g.external_enabled then return jsonb_build_object('messages','[]'::jsonb,'mode','disabled','environment',g.environment,'project_ref',g.project_ref);end if;
  select * into cfg from public.communication_settings where organization_id=o;
  -- Only test outbox records, never older G batches or automated events.
  update public.communication_attempts a set finished_at=now(),outcome='lease_expired',failure_class=case when mm.dispatch_authorized_at is null then 'transient'else 'uncertain'end from public.communication_outbox mm join public.communication_provider_tests tt on tt.message_id=mm.id where mm.organization_id=o and mm.status='sending' and mm.lease_until<now() and a.lease_token=mm.lease_token;
  update public.communication_outbox mm set status=case when dispatch_authorized_at is null then 'queued'else 'failed'end,failure_class=case when dispatch_authorized_at is null then 'transient'else 'uncertain'end,lease_token=null,lease_until=null where mm.organization_id=o and mm.status='sending' and mm.lease_until<now() and exists(select 1 from public.communication_provider_tests tt where tt.message_id=mm.id);
  for m in select mm.* from public.communication_outbox mm join public.communication_provider_tests tt on tt.message_id=mm.id where mm.organization_id=o and mm.status in ('queued','scheduled')and mm.scheduled_at<=now() and (p->>'message_id' is null or mm.id=(p->>'message_id')::uuid)order by mm.scheduled_at,mm.id limit 5 for update of mm skip locked loop
   block:=private.comm_external_gate(m);
   if block in ('consent_required','suppression','preference','invalid_address','test_authority_revoked','recipient_changed_or_restricted')then
    update public.communication_outbox set status='suppressed',failure_class=block where communication_outbox.id=m.id;perform private.comm_audit(o,null,'provider.dispatch_blocked',m.id,jsonb_build_object('reason',block));continue;
   end if;
   if block is not null then continue;end if;
   if m.attempts>=cfg.max_attempts then update public.communication_outbox set status='failed',failure_class='attempts_exhausted'where communication_outbox.id=m.id;continue;end if;
   select * into s from public.communication_sender_profiles where communication_sender_profiles.id=m.sender_profile_id;
   lease:=gen_random_uuid();update public.communication_outbox set status='sending',attempts=attempts+1,lease_token=lease,lease_until=now()+interval '2 minutes',dispatch_authorized_at=null,provider=s.provider where communication_outbox.id=m.id returning * into m;
   insert into public.communication_attempts(organization_id,message_id,attempt,lease_token)values(o,m.id,m.attempts,lease);
   ids:=ids||jsonb_build_array(to_jsonb(m)||jsonb_build_object('sender',to_jsonb(s)));
   perform private.comm_audit(o,null,'provider.attempt_claimed',m.id);
  end loop;return jsonb_build_object('messages',ids,'mode','external_tests','environment',g.environment,'project_ref',g.project_ref);
 end if;
 select * into ctl from public.communication_provider_controls where profile_id=id and organization_id=o;
 select * into s from public.communication_sender_profiles where communication_sender_profiles.id=id and organization_id=o;
 if action in ('verify_result','profile')then
  if ctl.profile_id is null then raise exception 'Profile denied';end if;
  if action='profile'then return to_jsonb(ctl)||jsonb_build_object('sender',to_jsonb(s));end if;
  if ctl.revision<>(p->>'revision')::int or ctl.environment is distinct from p->>'environment' or ctl.project_ref is distinct from p->>'project_ref' or not private.comm_actor_can(o,null,'communications.providers.view',(p->>'actor')::uuid) or not private.comm_actor_can(o,null,'communications.providers.test',(p->>'actor')::uuid) then raise exception 'Verification authority/config changed';end if;
  update public.communication_provider_controls set configured=coalesce((p->>'configured')::boolean,false),credentials_verified=p->>'verified'='true',mode=case when p->>'verified'='true'then 'verified'else 'verification_pending'end,enabled=false,last_verified_at=case when p->>'verified'='true'then now()end,health=case when p->>'verified'='true'then 'unknown'else 'configuration_error'end,revision=revision+1 where profile_id=id;
  update public.communication_sender_profiles set active=false where communication_sender_profiles.id=id;
  perform private.comm_audit(o,null,'provider.verification_result',id,jsonb_build_object('verified',p->>'verified'='true'));return jsonb_build_object('verified',p->>'verified'='true','sender_approved',ctl.sender_approved);
 elsif action='callback_rejected'then
  if ctl.profile_id is not null then perform private.comm_audit(o,null,'provider.callback_rejected',id,'{"reason":"validation_failed"}');end if;return '{}';
 elsif action in ('callback_external','keyword_external')then
  if ctl.profile_id is null or not ctl.structured_callbacks or ctl.environment<>g.environment or ctl.project_ref is distinct from g.project_ref or p->>'provider' is distinct from s.provider then raise exception 'Verified callback profile required';end if;
  if action='keyword_external'then
   if s.channel<>'sms' or p->>'keyword' not in ('STOP','START','HELP')then raise exception 'SMS preference required';end if;
   ans:=private.comm_service('keyword',o,p||jsonb_build_object('channel','sms'));
  else
   select * into m from public.communication_outbox where organization_id=o and sender_profile_id=id and provider=s.provider and provider_message_id=p->>'provider_message_id';
   if m.id is null or not exists(select 1 from public.communication_attempts a where a.message_id=m.id and a.id=(p->>'attempt_id')::uuid and a.outcome='sent')then raise exception 'Callback receipt/attempt binding required';end if;
   ans:=private.comm_service('callback',o,p||jsonb_build_object('provider',s.provider));
  end if;
  update public.communication_provider_controls set last_callback_at=now()where profile_id=id;return ans;
 elsif action in ('authorize_external','result_external')then
  select * into m from public.communication_outbox where organization_id=o and communication_outbox.id=(p->>'message_id')::uuid and status='sending' and lease_token=(p->>'lease_token')::uuid and lease_until>now();
  if m.id is null or not exists(select 1 from public.communication_provider_tests where message_id=m.id)then raise exception 'Current test lease required';end if;
  if action='authorize_external'then
   if m.dispatch_authorized_at is not null then raise exception 'Lease already handed off';end if;
   block:=private.comm_external_gate(m);
   if block is not null then
    update public.communication_outbox set status=case when block in ('consent_required','suppression','preference','test_authority_revoked','recipient_changed_or_restricted')then 'suppressed'else 'queued'end,failure_class=block,lease_token=null,lease_until=null where communication_outbox.id=m.id;
    update public.communication_attempts set finished_at=now(),outcome='held',failure_class=block where lease_token=m.lease_token;
    perform private.comm_audit(o,null,'provider.dispatch_blocked',m.id,jsonb_build_object('reason',block));return jsonb_build_object('authorized',false,'reason',block);
   end if;
   update public.communication_outbox set dispatch_authorized_at=now() where communication_outbox.id=m.id;
   perform private.comm_audit(o,null,'provider.dispatch_authorized',m.id);return jsonb_build_object('authorized',true,'environment',g.environment,'project_ref',g.project_ref);
  end if;
  ans:=private.comm_service('result',o,p||jsonb_build_object('id',m.id));
  update public.communication_provider_controls set last_success_at=case when p->>'outcome'='sent'then now()else last_success_at end,last_failure_at=case when p->>'outcome'<>'sent'then now()else last_failure_at end,consecutive_failures=case when p->>'outcome'='sent'then 0 else consecutive_failures+1 end,health=case when p->>'outcome'='sent'then 'healthy'else 'degraded'end where profile_id=m.sender_profile_id;
  update public.communication_provider_controls set enabled=false,mode='suspended',health='provider_error',revision=revision+1 where profile_id=m.sender_profile_id and consecutive_failures>=3;
  if found then perform private.comm_audit(o,null,'provider.circuit_suspended',m.sender_profile_id);end if;
  return ans;
 else raise exception 'Unknown provider service action';end if;
end$$;

create function public.communications_provider_service(p_action text,p_organization uuid,p_payload jsonb default '{}')returns jsonb language sql security invoker set search_path='' as $$select private.comm_provider_service(p_action,p_organization,p_payload)$$;

-- Existing staff pages expose only the delivery boundary, not provider administration metadata.
alter function private.comm_workspace(text,uuid,jsonb) rename to comm_workspace_phase_g;

create function private.comm_workspace(action text,c uuid,p jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;o uuid:=(p->>'organization_id')::uuid;sender public.communication_sender_profiles;t public.communication_templates;
 recipient jsonb;vars jsonb;items jsonb:='[]';block text;address text;subject text;body text;rendered jsonb;
 eligible integer:=0;suppressed integer:=0;invalid integer:=0;
begin
 if action='dry_run' then
  if not private.outreach_verified(auth.uid()) or jsonb_typeof(p)<>'object' or octet_length(p::text)>32000 then raise exception 'Verified dry-run access required' using errcode='42501';end if;
  if c is not null then select organization_id into o from public.outreach_campaigns where id=c and (o is null or organization_id=o);end if;
  if o is null or not private.comm_can(o,c,'communications.send') then raise exception 'Scoped dry-run access required' using errcode='42501';end if;
  perform private.comm_lock(o);
  if not private.comm_can(o,c,'communications.send') then raise exception 'Access revoked' using errcode='42501';end if;
  select * into sender from public.communication_sender_profiles where organization_id=o and id=(p->>'sender_profile_id')::uuid and channel=p->>'channel';
  if sender.id is null then raise exception 'Approved organization sender required';end if;
  if p->>'template_id' is not null then
   select * into t from public.communication_templates where organization_id=o and id=(p->>'template_id')::uuid and active and channel=sender.channel;
   if t.id is null then raise exception 'Published matching template required';end if;subject:=t.subject;body:=t.body;
  else
   subject:=coalesce(p->>'subject','');body:=p->>'body';
   if length(body) not between 1 and 12000 or body is null or length(subject)>240 or subject ~ E'[\r\n]' or p->>'purpose' not in ('transactional','event_updates','follow_up','discipleship','marketing','donation_receipts') then raise exception 'Invalid dry-run content';end if;
  end if;
  for recipient in select x from jsonb_array_elements(private.comm_audience(o,c,p->'audience'))x loop
   address:=private.comm_address(sender.channel,recipient->>sender.channel);
   block:=private.comm_block(o,c,recipient->>'key',sender.channel,address,coalesce(t.purpose,p->>'purpose'));
   begin
    vars:=private.comm_variables(o,c,recipient,coalesce(p->'variables','{}'));
    rendered:=jsonb_build_object('subject',private.comm_render(subject,vars),'body',private.comm_render(body,vars)||case when sender.footer<>''then E'\n\n'||sender.footer else ''end);
   exception when others then block:='missing_template_data';rendered:='{}';end;
   if block in ('invalid_address','missing_template_data')then invalid:=invalid+1;
   elsif block is not null then suppressed:=suppressed+1;else eligible:=eligible+1;end if;
   items:=items||jsonb_build_array(recipient||rendered||jsonb_build_object('address',address,'blocked',block,'delivery_gate','message_activation_required'));
  end loop;
  -- H1 never authorizes a normal/bulk/automation audience for external delivery.
  return jsonb_build_object('mode','dry_run','counts',jsonb_build_object('eligible',eligible,'suppressed',suppressed,'invalid',invalid,'held',eligible,'would_send',0),'recipients',items,'sender',to_jsonb(sender),'sender_external_ready',coalesce((select configured and credentials_verified and sender_approved and enabled from public.communication_provider_controls where profile_id=sender.id),false),'reason','message_activation_required');
 end if;
 result:=private.comm_workspace_phase_g(action,c,p);
 if action in ('overview','context')then result:=result||jsonb_build_object('external_delivery_enabled',(select external_enabled from public.communication_external_control),'external_boundary','Only separately authorized provider tests; automated and bulk external delivery held');end if;
 return result;
end$$;

-- Grants stay narrow. Tables and helper functions are never browser/service-role raw APIs.
do $$declare x record;begin
 for x in select tablename from pg_tables where schemaname='public' and tablename in ('communication_external_control','communication_super_admins','communication_org_delivery','communication_provider_controls','communication_test_allowlist','communication_provider_tests')loop execute format('alter table public.%I enable row level security',x.tablename);execute format('revoke all on public.%I from public,anon,authenticated,service_role',x.tablename);end loop;
 for x in select oid::regprocedure f from pg_proc where pronamespace='private'::regnamespace and proname in ('comm_external_lock','comm_super_admin','comm_external_gate','comm_provider_workspace','comm_provider_service','comm_workspace','comm_workspace_phase_g')loop execute format('revoke all on function %s from public,anon,authenticated,service_role',x.f);end loop;
end$$;

revoke all on function public.communications_provider_workspace(text,uuid,jsonb)from public,anon,service_role;

revoke all on function public.communications_provider_service(text,uuid,jsonb)from public,anon,authenticated;

grant execute on function public.communications_provider_workspace(text,uuid,jsonb),private.comm_provider_workspace(text,uuid,jsonb),private.comm_workspace(text,uuid,jsonb)to authenticated;

grant execute on function public.communications_provider_service(text,uuid,jsonb),private.comm_provider_service(text,uuid,jsonb)to service_role;

-- The sink worker cannot claim or suppress external provider tests.
create or replace function private.comm_service(action text,o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare cfg public.communication_settings;m public.communication_outbox;profile public.communication_sender_profiles;lease uuid;block text;localhour integer;zone text;outcome text;route public.communication_routes;e public.outreach_campaign_events;t public.communication_templates;camp public.outreach_campaigns;r jsonb;v jsonb;rem public.outreach_task_reminders;step public.outreach_campaign_steps;ids jsonb:='[]';mid uuid;begin
 perform private.comm_lock(o);select * into cfg from public.communication_settings where organization_id=o;
 if not found then raise exception 'Communication settings missing';end if;
 if action='consume_events' then
  for route in select * from public.communication_routes where organization_id=o and enabled loop
   -- Current approver authority, not a permanent grant copied at route creation.
   if not exists(select 1 from public.organization_staff_permissions g where g.organization_id=o and g.user_id=route.approved_by and g.permission='communications.send' and g.revoked_at is null and g.department_ids is null and g.effective_at<=now() and (g.expires_at is null or g.expires_at>now()) and private.staff_assignment_active(o,g.user_id)) and not exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=route.campaign_id and a.user_id=route.approved_by and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and a.capabilities @> array['communications.send','communications.bulk_send']) then continue;end if;
   select * into t from public.communication_templates where id=route.template_id and organization_id=o and active;if not found then continue;end if;
   select * into camp from public.outreach_campaigns where id=route.campaign_id and organization_id=o;
   if camp.status in ('cancelled','closed','completed') then continue;end if;
   select * into profile from public.communication_sender_profiles where id=route.sender_profile_id and active;if not found then continue;end if;
   for e in select ev.* from public.outreach_campaign_events ev where ev.campaign_id=route.campaign_id and ev.kind=route.event_kind and ev.created_at>=route.approved_at and not exists(select 1 from public.communication_event_consumption done where done.organization_id=o and done.route_id=route.id and done.event_id=ev.id) order by ev.created_at limit 100 loop
    rem:=null;step:=null;
    if e.event_key like 'reminder:%' then select * into rem from public.outreach_task_reminders where id=e.subject_id and campaign_id=camp.id;
     -- Phase F events use step subject IDs; match exact reminder key when appropriate.
     if not found then select * into rem from public.outreach_task_reminders where campaign_id=camp.id and ('reminder:'||id)=e.event_key;end if;
     if rem.id is null or rem.state<>'pending' then insert into public.communication_event_consumption(organization_id,route_id,event_id) values(o,route.id,e.id) on conflict do nothing;continue;end if;
     if rem.scheduled_at>now() or camp.status='postponed' then continue;end if;
     select * into step from public.outreach_campaign_steps where id=rem.step_id and campaign_id=camp.id;
     if step.status='completed' or step.due_at is distinct from rem.due_snapshot then insert into public.communication_event_consumption(organization_id,route_id,event_id) values(o,route.id,e.id) on conflict do nothing;continue;end if;
    end if;
    for r in select x from jsonb_array_elements(private.comm_audience(o,camp.id,route.audience)) x loop
     -- Reminder recipient roles come from Phase F, never a newly invented escalation roster.
     if rem.id is not null and not exists(select 1 from public.outreach_campaign_contacts x where x.campaign_id=camp.id and 'person:'||x.person_id=r->>'key' and x.active and (rem.recipient_roles ? x.role_key)) and not exists(select 1 from public.organization_people pp where 'person:'||pp.id=r->>'key' and pp.organization_id=o and pp.user_id=rem.assigned_user_id) then continue;end if;
     v:=private.comm_variables(o,camp.id,r,'{}',step.id);
     mid:=private.comm_enqueue(o,camp.id,r,t.channel,t.message_type,t.purpose,t.id,profile.id,private.comm_render(t.subject,v),private.comm_render(t.body,v)||case when profile.footer<>'' then E'\n\n'||profile.footer else '' end,'event:'||e.id||':route:'||route.id||':'||(r->>'key')||':'||t.channel,now(),null,e.id,rem.id,step.id,step.due_at);ids:=ids||jsonb_build_array(mid);
    end loop;
    insert into public.communication_event_consumption(organization_id,route_id,event_id) values(o,route.id,e.id) on conflict do nothing;
   end loop;
  end loop;return jsonb_build_object('messages',ids);
 elsif action='claim' then
  if cfg.delivery_mode<>'acceptance_sink' then return jsonb_build_object('messages','[]'::jsonb,'mode','disabled');end if;
  -- A lost post-handoff lease is uncertain and must reconcile, never blindly resend.
  update public.communication_attempts a set finished_at=now(),outcome='lease_expired',failure_class=case when m.dispatch_authorized_at is null then 'transient' else 'uncertain' end from public.communication_outbox m where m.organization_id=o and m.status='sending' and m.lease_until<now() and a.lease_token=m.lease_token and not exists(select 1 from public.communication_provider_tests h1 where h1.message_id=m.id);
  update public.communication_outbox set status=case when dispatch_authorized_at is null then 'scheduled' else 'failed' end,scheduled_at=case when dispatch_authorized_at is null then now()+interval '30 seconds' else scheduled_at end,failure_class=case when dispatch_authorized_at is null then 'transient' else 'uncertain' end,failed_at=now(),lease_token=null,lease_until=null where organization_id=o and status='sending' and lease_until<now() and not exists(select 1 from public.communication_provider_tests h1 where h1.message_id=communication_outbox.id);
  for m in select * from public.communication_outbox where organization_id=o and status in ('queued','scheduled') and scheduled_at<=now() and not exists(select 1 from public.communication_provider_tests tt where tt.message_id=communication_outbox.id) order by scheduled_at,id limit 25 for update skip locked loop
   profile:=null;select * into profile from public.communication_sender_profiles where id=m.sender_profile_id and organization_id=o and active;
   block:=private.comm_block(o,m.campaign_id,m.recipient_key,m.channel,m.address_snapshot,m.purpose);
   if not private.comm_source_authorized(m) then block:='source_authority_revoked';end if;
   if profile.id is null or (profile.provider<>'acceptance_sink' or profile.channel<>m.channel) then block:='provider_disabled';end if;
   if m.source_reminder_id is not null and not exists(select 1 from public.outreach_task_reminders rr join public.outreach_campaign_steps ss on ss.id=rr.step_id join public.outreach_campaigns cc on cc.id=rr.campaign_id where rr.id=m.source_reminder_id and rr.state='pending' and ss.status<>'completed' and ss.due_at is not distinct from m.source_due_at and cc.status not in ('postponed','completed','cancelled','closed')) then block:='stale_workflow';end if;
   if m.campaign_id is not null and not exists(select 1 from public.outreach_campaigns cc where cc.id=m.campaign_id and cc.revision=m.source_campaign_revision and cc.status not in ('cancelled','closed','completed')) then block:='stale_campaign';end if;
   if m.attempts>=cfg.max_attempts then block:='attempts_exhausted';end if;
   if block is not null then update public.communication_outbox set status=case when block='stale_workflow' then 'cancelled' else 'suppressed' end,failure_class=block,credits_released=credits_reserved,credits_reserved=0 where id=m.id;perform private.comm_audit(o,m.campaign_id,'dispatch.blocked',m.id,jsonb_build_object('reason',block));continue;end if;
   if m.channel='sms' and cfg.quiet_start is not null then
    zone:=coalesce((select timezone from public.communication_preferences where organization_id=o and recipient_key=m.recipient_key),(select timezone from public.outreach_campaigns where id=m.campaign_id),cfg.timezone);
    localhour:=extract(hour from now() at time zone zone);
    if (cfg.quiet_start<cfg.quiet_end and localhour>=cfg.quiet_start and localhour<cfg.quiet_end) or (cfg.quiet_start>cfg.quiet_end and (localhour>=cfg.quiet_start or localhour<cfg.quiet_end)) then
     update public.communication_outbox set status='scheduled',scheduled_at=(((now() at time zone zone)::date + case when cfg.quiet_start>cfg.quiet_end and localhour>=cfg.quiet_start then 1 else 0 end)+make_interval(hours=>cfg.quiet_end)) at time zone zone where id=m.id;continue;
    end if;
   end if;
   lease:=gen_random_uuid();update public.communication_outbox set status='sending',attempts=attempts+1,lease_token=lease,lease_until=now()+interval '2 minutes',dispatch_authorized_at=null,provider=profile.provider where id=m.id returning * into m;
   insert into public.communication_attempts(organization_id,message_id,attempt,lease_token) values(o,m.id,m.attempts,lease);
   ids:=ids||jsonb_build_array(to_jsonb(m)||jsonb_build_object('sender',to_jsonb(profile)));perform private.comm_audit(o,m.campaign_id,'attempt.claimed',m.id,jsonb_build_object('attempt',m.attempts));
  end loop;return jsonb_build_object('messages',ids,'mode',cfg.delivery_mode);
 elsif action in ('authorize_dispatch','result') then
  select * into m from public.communication_outbox where organization_id=o and id=(p->>'id')::uuid and status='sending' and lease_token=(p->>'lease_token')::uuid and lease_until>now();if not found then raise exception 'Current lease required';end if;
  if action='authorize_dispatch' then
   block:=private.comm_block(o,m.campaign_id,m.recipient_key,m.channel,m.address_snapshot,m.purpose);
   if not private.comm_source_authorized(m) then block:='source_authority_revoked';end if;
   if m.source_reminder_id is not null and not exists(select 1 from public.outreach_task_reminders rr join public.outreach_campaign_steps ss on ss.id=rr.step_id join public.outreach_campaigns cc on cc.id=rr.campaign_id where rr.id=m.source_reminder_id and rr.state='pending' and ss.status<>'completed' and ss.due_at is not distinct from m.source_due_at and cc.status not in ('postponed','completed','cancelled','closed')) then block:='stale_workflow';end if;
   if m.campaign_id is not null and not exists(select 1 from public.outreach_campaigns cc where cc.id=m.campaign_id and cc.revision=m.source_campaign_revision and cc.status not in ('cancelled','closed','completed')) then block:='stale_campaign';end if;
   if cfg.delivery_mode<>'acceptance_sink' or not exists(select 1 from public.communication_sender_profiles where id=m.sender_profile_id and active and provider='acceptance_sink') then block:='provider_disabled';end if;
   if block is not null then update public.communication_outbox set status='suppressed',failure_class=block,credits_released=credits_reserved,credits_reserved=0 where id=m.id;perform private.comm_audit(o,m.campaign_id,'dispatch.blocked',m.id,jsonb_build_object('reason',block));return jsonb_build_object('authorized',false,'reason',block);end if;
   update public.communication_outbox set dispatch_authorized_at=now() where id=m.id;perform private.comm_audit(o,m.campaign_id,'dispatch.authorized',m.id);return jsonb_build_object('authorized',true);
  end if;
  if m.dispatch_authorized_at is null then raise exception 'Dispatch authorization required';end if;
  outcome:=p->>'outcome';if outcome not in ('sent','transient','permanent','uncertain') then raise exception 'Invalid provider result';end if;
  if outcome='sent' and (coalesce(p->>'provider_message_id','')='' or length(p->>'provider_message_id')>200) then raise exception 'Provider receipt required';end if;
  update public.communication_outbox set status=case when outcome='sent' then 'sent' when outcome='transient' and attempts<cfg.max_attempts then 'scheduled' else 'failed' end,scheduled_at=case when outcome='transient' then now()+make_interval(secs=>least(3600,30*(2^attempts)::int)) else scheduled_at end,sent_at=case when outcome='sent' then now() else sent_at end,failed_at=case when outcome<>'sent' then now() else null end,provider_message_id=p->>'provider_message_id',failure_class=case when outcome='sent' then null else outcome end,lease_token=null,lease_until=null,credits_consumed=case when outcome='sent' then credits_reserved else credits_consumed end,credits_reserved=case when outcome='sent' then 0 else credits_reserved end where id=m.id;
  update public.communication_attempts set finished_at=now(),outcome=outcome,failure_class=case when outcome='sent' then null else outcome end where lease_token=m.lease_token;perform private.comm_audit(o,m.campaign_id,'provider.result',m.id,jsonb_build_object('outcome',outcome));return jsonb_build_object('id',m.id,'outcome',outcome);
 elsif action='callback' then
  outcome:=p->>'outcome';if outcome not in ('delivered','soft_bounce','hard_bounce','complaint','rejected','undelivered','failed','sent') then raise exception 'Invalid normalized callback';end if;
  select * into m from public.communication_outbox where organization_id=o and provider=p->>'provider' and provider_message_id=p->>'provider_message_id';if not found then raise exception 'Provider receipt not found';end if;
  insert into public.communication_callbacks(organization_id,provider,event_id,message_id,outcome) values(o,m.provider,p->>'event_id',m.id,outcome) on conflict do nothing;
  if not found then return jsonb_build_object('duplicate',true);end if;
  if outcome='delivered' and m.status='sent' then update public.communication_outbox set status='delivered',delivered_at=now(),failure_class=null where id=m.id;perform private.comm_audit(o,m.campaign_id,'delivery.delivered',m.id);
  elsif outcome in ('hard_bounce','complaint','rejected','undelivered','failed','soft_bounce') then
   if m.status<>'delivered' then update public.communication_outbox set status='failed',failure_class=case when outcome='soft_bounce' then 'transient' else outcome end,failed_at=now() where id=m.id;end if;
   if outcome in ('hard_bounce','complaint') then insert into public.communication_suppressions(organization_id,channel,address,reason) values(o,m.channel,m.address_snapshot,outcome) on conflict(organization_id,channel,address,reason) do update set active=true,cleared_at=null;end if;
   perform private.comm_audit(o,m.campaign_id,'delivery.'||outcome,m.id);
  end if;return jsonb_build_object('recorded',true);
 elsif action='keyword' then
  if length(coalesce(p->>'event_id','')) not between 1 and 200 then raise exception 'Preference event ID required';end if;
  insert into public.communication_keyword_events(organization_id,event_id,keyword) values(o,p->>'event_id',p->>'keyword') on conflict do nothing;if not found then return jsonb_build_object('duplicate',true);end if;
  if p->>'keyword' not in ('STOP','START','HELP','UNSUBSCRIBE') then raise exception 'Unknown preference keyword';end if;
  if p->>'keyword' in ('STOP','UNSUBSCRIBE') then insert into public.communication_suppressions(organization_id,channel,address,reason) values(o,p->>'channel',private.comm_address(p->>'channel',p->>'address'),case when p->>'keyword'='STOP' then 'stop' else 'unsubscribe' end) on conflict(organization_id,channel,address,reason) do update set active=true,cleared_at=null;
  elsif p->>'keyword'='START' then update public.communication_suppressions set active=false,cleared_at=now() where organization_id=o and channel='sms' and address=private.comm_address('sms',p->>'address') and reason='stop';end if;
  -- START clears only STOP. It never manufactures marketing/purpose consent.
  perform private.comm_audit(o,null,'preference.keyword',null,jsonb_build_object('keyword',p->>'keyword','channel',p->>'channel'));return jsonb_build_object('keyword',p->>'keyword','consent_granted',false);
 else raise exception 'Unknown worker action';end if;
end$$;
