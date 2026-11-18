-- Source-only stop/recovery primitives. No stop/restore action executes on install.
create table private.minden_decision_release_stops(
 id uuid primary key default gen_random_uuid(),reference text not null,
 prior_runtime jsonb,prior_source jsonb,stopped_at timestamptz not null default clock_timestamp(),restored_at timestamptz
);
alter table private.minden_decision_release_stops enable row level security;
revoke all on private.minden_decision_release_stops from public,anon,authenticated,service_role;
create function private.minden_decision_stop(p_reference text) returns uuid language plpgsql security invoker set search_path='' as $$
 declare c uuid:='d26b8337-d215-42d3-ac3b-c771f7f07db7';r private.minden_decision_runtime;s public.outreach_decision_campaign_sources;i uuid;
 begin
 if current_user<>'postgres' or length(btrim(p_reference)) not between 12 and 500 or p_reference is null then raise exception 'Explicit stop reference and owner required' using errcode='42501';end if;
 perform 1 from public.outreach_campaigns where id=c for update;
 if exists(select 1 from private.minden_decision_release_stops where restored_at is null) then raise exception 'Existing unresolved stop; do not overwrite snapshot';end if;
 select * into r from private.minden_decision_runtime where campaign_id=c for update;
 select * into s from public.outreach_decision_campaign_sources where campaign_id=c for update;
 insert into private.minden_decision_release_stops(reference,prior_runtime,prior_source)values(p_reference,case when r.campaign_id is not null then to_jsonb(r) end,case when s.campaign_id is not null then to_jsonb(s) end) returning id into i;
 update private.minden_decision_runtime set enabled=false,reader_enabled=false,revision=revision+1 where campaign_id=c;
 update public.outreach_decision_campaign_sources set active=false,revision=revision+1 where campaign_id=c;
 return i;
 end $$;
create function private.minden_decision_restore(p_stop uuid,p_reference text) returns boolean language plpgsql security invoker set search_path='' as $$
 declare c uuid:='d26b8337-d215-42d3-ac3b-c771f7f07db7';state private.minden_decision_release_stops;r private.minden_decision_runtime;s public.outreach_decision_campaign_sources;
 begin
 if current_user<>'postgres' or length(btrim(p_reference)) not between 12 and 500 or p_reference is null then raise exception 'Explicit restore reference and owner required' using errcode='42501';end if;
 perform 1 from public.outreach_campaigns where id=c for update;
 select * into state from private.minden_decision_release_stops where id=p_stop and restored_at is null for update;
 if state.id is null then raise exception 'Exact unresolved stop required';end if;
 select * into r from private.minden_decision_runtime where campaign_id=c for update;
 select * into s from public.outreach_decision_campaign_sources where campaign_id=c for update;
 if (state.prior_runtime is null)<>(r.campaign_id is null) or (state.prior_source is null)<>(s.campaign_id is null)
 or (state.prior_runtime is not null and to_jsonb(r) is distinct from state.prior_runtime||jsonb_build_object('enabled',false,'reader_enabled',false,'revision',(state.prior_runtime->>'revision')::integer+1))
 or (state.prior_source is not null and to_jsonb(s) is distinct from state.prior_source||jsonb_build_object('active',false,'revision',(state.prior_source->>'revision')::integer+1)) then raise exception 'Stop state drift; reconcile instead of overwriting';end if;
 update private.minden_decision_runtime set enabled=(state.prior_runtime->>'enabled')::boolean,reader_enabled=(state.prior_runtime->>'reader_enabled')::boolean,revision=revision+1 where campaign_id=c;
 update public.outreach_decision_campaign_sources set active=(state.prior_source->>'active')::boolean,revision=revision+1 where campaign_id=c;
 update private.minden_decision_release_stops set restored_at=clock_timestamp(),reference=reference||E'\nRESTORE: '||p_reference where id=p_stop;
 return true;
 end $$;
revoke all on function private.minden_decision_stop(text),private.minden_decision_restore(uuid,text) from public,anon,authenticated,service_role;
