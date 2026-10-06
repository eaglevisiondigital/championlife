-- Dormant integrity foundation only: no browser RPC, operator UI or public wheel.
-- Phase D must add its own acceptance/release gate; all functions remain owner-only.
create table public.outreach_prize_participants (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id),
 registrant_id uuid, checked_in_at timestamptz, active boolean not null default true,
 foreign key(campaign_id,registrant_id) references public.outreach_campaign_registrants(campaign_id,id), unique(campaign_id,id), unique(campaign_id,registrant_id)
);
create table public.outreach_drawing_numbers (
 campaign_id uuid not null, participant_id uuid not null, number text not null check(number ~ '^[1-9][0-9]{5}$'),
 primary key(campaign_id,participant_id), unique(campaign_id,number), foreign key(campaign_id,participant_id) references public.outreach_prize_participants(campaign_id,id)
);
create table public.outreach_prize_pools (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id),
 name text not null check(length(name) between 1 and 160), policy jsonb not null default '{}', active boolean not null default true,
 -- Explicit choice required. No silent policy for an unclaimed selection.
 unclaimed_policy text not null check(unclaimed_policy in ('remain_eligible','exclude_participant')),
 unique(campaign_id,id)
);
create table public.outreach_prize_pool_entries (
 campaign_id uuid not null, pool_id uuid not null, participant_id uuid not null,
 primary key(pool_id,participant_id), foreign key(campaign_id,pool_id) references public.outreach_prize_pools(campaign_id,id), foreign key(campaign_id,participant_id) references public.outreach_prize_participants(campaign_id,id)
);
create table public.outreach_prize_draws (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, pool_id uuid not null, participant_id uuid not null,
 prize_label text not null check(length(prize_label) between 1 and 160), operator_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 foreign key(campaign_id,pool_id) references public.outreach_prize_pools(campaign_id,id), foreign key(campaign_id,participant_id) references public.outreach_prize_participants(campaign_id,id),unique(campaign_id,id)
);
create table public.outreach_prize_draw_history (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, draw_id uuid not null,
 kind text not null check(kind in ('selected','claimed','unclaimed')), actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 foreign key(campaign_id,draw_id) references public.outreach_prize_draws(campaign_id,id), unique(draw_id,kind)
);
-- Unique immutable ledger is the one-win constraint across ALL pools/categories.
create table public.outreach_prize_wins (
 campaign_id uuid not null, participant_id uuid not null, draw_id uuid not null unique, won_at timestamptz not null default now(),
 primary key(campaign_id,participant_id), foreign key(campaign_id,participant_id) references public.outreach_prize_participants(campaign_id,id), foreign key(campaign_id,draw_id) references public.outreach_prize_draws(campaign_id,id)
);
create table public.outreach_prize_exclusions (
 campaign_id uuid not null, participant_id uuid not null, draw_id uuid not null,
 primary key(campaign_id,participant_id), foreign key(campaign_id,participant_id) references public.outreach_prize_participants(campaign_id,id), foreign key(campaign_id,draw_id) references public.outreach_prize_draws(campaign_id,id)
);
create index outreach_prize_entry_campaign_idx on public.outreach_prize_pool_entries(campaign_id,participant_id);
create index outreach_prize_draw_participant_idx on public.outreach_prize_draws(campaign_id,participant_id);
create index outreach_prize_history_campaign_idx on public.outreach_prize_draw_history(campaign_id,draw_id);
create function private.outreach_draw_operator(p_campaign uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.outreach_verified(auth.uid()) and exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=p_campaign and a.user_id=auth.uid() and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and 'view'=any(a.capabilities) and 'draw'=any(a.capabilities))
$$;
create function private.outreach_drawing_number(p_campaign uuid,p_participant uuid) returns text language plpgsql security definer set search_path='' as $$
declare n text; bits bigint; i integer;
begin
 if not private.outreach_draw_operator(p_campaign) then raise exception 'Explicit campaign draw permission required' using errcode='42501';end if;
 perform 1 from public.outreach_prize_participants where campaign_id=p_campaign and id=p_participant for update;
 if not found then raise exception 'Participant outside campaign';end if;
 select number into n from public.outreach_drawing_numbers where campaign_id=p_campaign and participant_id=p_participant;if found then return n;end if;
 for i in 1..1000 loop
  bits:=('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint;
  if bits>=4294800000 then continue;end if; -- rejection sampling, no modulo bias
  n:=(100000+(bits%900000))::text;
  begin insert into public.outreach_drawing_numbers(campaign_id,participant_id,number) values(p_campaign,p_participant,n);
   perform private.outreach_event(p_campaign,'drawing_number.assigned',p_participant,'drawing_number:'||p_campaign||':'||p_participant);return n;
  exception when unique_violation then null;end;
 end loop;raise exception 'Number space unavailable';
end $$;
create function private.outreach_prize_select(p_campaign uuid,p_pool uuid,p_prize text) returns jsonb language plpgsql security definer set search_path='' as $$
declare participant uuid; draw uuid; n text; org uuid;
begin
 if not private.outreach_draw_operator(p_campaign) then raise exception 'Explicit campaign draw permission required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_campaign::text,726));
 if not exists(select 1 from public.outreach_prize_pools where campaign_id=p_campaign and id=p_pool and active) then raise exception 'Pool unavailable';end if;
 select p.id into participant from public.outreach_prize_participants p join public.outreach_prize_pool_entries e on e.campaign_id=p.campaign_id and e.participant_id=p.id
 join public.outreach_drawing_numbers d on d.campaign_id=p.campaign_id and d.participant_id=p.id
 where p.campaign_id=p_campaign and e.pool_id=p_pool and p.active and p.checked_in_at is not null
 and not exists(select 1 from public.outreach_prize_wins w where w.campaign_id=p_campaign and w.participant_id=p.id)
 and not exists(select 1 from public.outreach_prize_exclusions x where x.campaign_id=p_campaign and x.participant_id=p.id)
 and not exists(select 1 from public.outreach_prize_draws x where x.campaign_id=p_campaign and x.participant_id=p.id and not exists(select 1 from public.outreach_prize_draw_history h where h.draw_id=x.id and h.kind in ('claimed','unclaimed')))
 order by gen_random_uuid() limit 1 for update of p;
 if participant is null then raise exception 'No eligible checked-in participant';end if;
 insert into public.outreach_prize_draws(campaign_id,pool_id,participant_id,prize_label,operator_id) values(p_campaign,p_pool,participant,p_prize,auth.uid()) returning id into draw;
 insert into public.outreach_prize_draw_history(campaign_id,draw_id,kind,actor_id) values(p_campaign,draw,'selected',auth.uid());
 select organization_id into org from public.outreach_campaigns where id=p_campaign;perform private.outreach_audit(p_campaign,org,'draw.selected',draw);
 select number into n from public.outreach_drawing_numbers where campaign_id=p_campaign and participant_id=participant;
 -- Deliberately no participant/name/phone in presentation projection.
 return jsonb_build_object('draw_id',draw,'number',n,'prize',p_prize);
end $$;
create function private.outreach_prize_resolve(p_campaign uuid,p_draw uuid,p_outcome text) returns void language plpgsql security definer set search_path='' as $$
declare d public.outreach_prize_draws; policy text; org uuid;
begin
 if not private.outreach_draw_operator(p_campaign) then raise exception 'Explicit campaign draw permission required' using errcode='42501';end if;
 if p_outcome not in ('claimed','unclaimed') then raise exception 'Invalid outcome';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_campaign::text,726));
 select * into d from public.outreach_prize_draws where campaign_id=p_campaign and id=p_draw for update;
 if not found then raise exception 'Draw outside campaign';end if;
 if exists(select 1 from public.outreach_prize_draw_history where draw_id=d.id and kind in ('claimed','unclaimed')) then raise exception 'Draw already resolved';end if;
 if p_outcome='claimed' then
  if not exists(select 1 from public.outreach_prize_participants where campaign_id=p_campaign and id=d.participant_id and active and checked_in_at is not null) then raise exception 'Checked-in participant required';end if;
  insert into public.outreach_prize_wins(campaign_id,participant_id,draw_id) values(p_campaign,d.participant_id,d.id);
  perform private.outreach_event(p_campaign,'prize.won',d.participant_id,'prize.won:'||d.id);
 else
  select unclaimed_policy into policy from public.outreach_prize_pools where id=d.pool_id;
  if policy='exclude_participant' then insert into public.outreach_prize_exclusions(campaign_id,participant_id,draw_id) values(p_campaign,d.participant_id,d.id) on conflict do nothing;end if;
  perform private.outreach_event(p_campaign,'prize.unclaimed',d.participant_id,'prize.unclaimed:'||d.id);
 end if;
 insert into public.outreach_prize_draw_history(campaign_id,draw_id,kind,actor_id) values(p_campaign,d.id,p_outcome,auth.uid());
 select organization_id into org from public.outreach_campaigns where id=p_campaign;perform private.outreach_audit(p_campaign,org,'prize.'||p_outcome,d.id);
end $$;
do $$declare n text;begin
 foreach n in array array['outreach_prize_participants','outreach_drawing_numbers','outreach_prize_pools','outreach_prize_pool_entries','outreach_prize_draws','outreach_prize_draw_history','outreach_prize_wins','outreach_prize_exclusions'] loop
 execute format('alter table public.%I enable row level security',n);execute format('revoke all on public.%I from public,anon,authenticated',n);execute format('grant all on public.%I to service_role',n);end loop;
 foreach n in array array['outreach_drawing_numbers','outreach_prize_draws','outreach_prize_draw_history','outreach_prize_wins','outreach_prize_exclusions'] loop
 execute format('create trigger %I before update or delete on public.%I for each row execute function private.outreach_immutable()',n||'_immutable',n);end loop;
end $$;
revoke all on function private.outreach_draw_operator(uuid),private.outreach_drawing_number(uuid,uuid),private.outreach_prize_select(uuid,uuid,text),private.outreach_prize_resolve(uuid,uuid,text) from public,anon,authenticated,service_role;
