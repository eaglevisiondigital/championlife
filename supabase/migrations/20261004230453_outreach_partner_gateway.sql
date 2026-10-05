-- Server-only guest boundary. Preserve previously applied source migrations.
-- No Events dependency and no anonymous private schema usage.
revoke all on function public.outreach_partner_submit(jsonb),private.outreach_partner_submit(jsonb) from public,anon,authenticated,service_role;
drop function public.outreach_partner_submit(jsonb);
create or replace function private.outreach_partner_submit(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid; key uuid; digest text; prior public.outreach_partner_intakes; fields jsonb; k text; v text; maxlen integer; email text; phone text; amount numeric;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>12000 or
 (p_data - array['brand','source_path','request_key','bot_field','fields'])<>'{}'::jsonb then raise exception 'Unsupported submission' using errcode='22023'; end if;
 if coalesce(p_data->>'brand','') not in ('champion-life','sowgo') then raise exception 'Unknown presentation'; end if;
 if coalesce(p_data->>'bot_field','')<>'' then return jsonb_build_object('accepted',true); end if;
 if coalesce(p_data->>'source_path','') !~ '^/[^?#]*$' or length(p_data->>'source_path')>500 then raise exception 'Invalid source path'; end if;
 fields:=p_data->'fields';
 if fields is null or jsonb_typeof(fields)<>'object' or (fields-array['first-name','last-name','email','address-line-1','address-line-2','city','state-province','postal-code','phone','commitment-amount','commitment-frequency'])<>'{}'::jsonb then raise exception 'Unsupported fields'; end if;
 foreach k in array array['first-name','last-name','email','address-line-1','address-line-2','city','state-province','postal-code','phone','commitment-amount','commitment-frequency'] loop
  v:=fields->>k; maxlen:=case when k='email' then 254 when k like 'address%' then 250 when k='phone' then 60 when k='postal-code' then 30 when k='commitment-amount' then 20 else 100 end;
  if (k<>'address-line-2' and (v is null or btrim(v)='')) or (fields ? k and jsonb_typeof(fields->k)<>'string') or length(v)>maxlen or v ~ '[[:cntrl:]]' then raise exception 'Invalid field: %',k; end if;
 end loop;
 email:=lower(btrim(fields->>'email')); phone:=regexp_replace(fields->>'phone','[^0-9+]','','g');
 if email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(regexp_replace(phone,'[^0-9]','','g')) not between 7 and 20 then raise exception 'Invalid contact information'; end if;
 if fields->>'commitment-amount' !~ '^[0-9]+(\.[0-9]{1,2})?$' then raise exception 'Invalid amount'; end if;
 amount:=(fields->>'commitment-amount')::numeric;
 if amount<1 or amount>9999999999.99 or coalesce(fields->>'commitment-frequency','') not in ('Weekly','Bi-weekly','Monthly') then raise exception 'Invalid commitment'; end if;
 key:=(p_data->>'request_key')::uuid; if key is null then raise exception 'Request key required'; end if;
 select id into org from public.organizations where slug='sowgo'; if org is null then raise exception 'Intake unavailable'; end if;
 -- Serialize replay and rate checks; raw input is never used as identity evidence.
 perform pg_advisory_xact_lock(hashtextextended('outreach-request:'||key::text,0));
 digest:=encode(sha256(convert_to((p_data-'request_key'-'bot_field')::text,'UTF8')),'hex');
 select * into prior from public.outreach_partner_intakes where request_key=key;
 if found then
  if prior.payload_hash<>digest then raise exception 'Request changed; begin a new submission'; end if;
  return jsonb_build_object('accepted',true);
 end if;
 insert into public.outreach_partner_intakes(organization_id,source_site,source_path,raw_submission,email_normalized,phone_normalized,commitment_amount,commitment_frequency,request_key,payload_hash)
 values(org,case p_data->>'brand' when 'sowgo' then 'sowgo' else 'champion_life' end,p_data->>'source_path',fields,email,phone,amount,fields->>'commitment-frequency',key,digest);
 return jsonb_build_object('accepted',true);
end $$;

-- Only the guarded gateway below can invoke the canonical implementation.
revoke all on function private.outreach_partner_submit(jsonb) from public,anon,authenticated,service_role;
create table private.outreach_abuse_windows (
 dimension text not null check (dimension in ('network','email','phone')),
 fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
 window_ends_at timestamptz not null,
 attempts integer not null check(attempts between 1 and 1000000),
 primary key(dimension,fingerprint)
);
create index outreach_abuse_expiry on private.outreach_abuse_windows(window_ends_at);
alter table private.outreach_abuse_windows enable row level security;
revoke all on private.outreach_abuse_windows from public,anon,authenticated,service_role;

-- Central acceptance policy, also proposed initial production settings pending review.
-- Anchored one-hour windows, not a shared organization quota.
create function private.outreach_abuse_limit(p_dimension text) returns integer
 language sql immutable security invoker set search_path='' as $$
 select case p_dimension when 'network' then 30 when 'email' then 5 when 'phone' then 5 else 0 end
$$;
revoke all on function private.outreach_abuse_limit(text) from public,anon,authenticated,service_role;

create function private.outreach_abuse_cleanup() returns integer
 language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
 delete from private.outreach_abuse_windows where (dimension,fingerprint) in
 (select dimension,fingerprint from private.outreach_abuse_windows
  where window_ends_at < clock_timestamp()-interval '23 hours'
  order by window_ends_at limit 1000 for update skip locked);
 get diagnostics removed=row_count; return removed;
end $$;
revoke all on function private.outreach_abuse_cleanup() from public,anon,authenticated,service_role;

create function private.outreach_partner_gateway(p_data jsonb,p_network text) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare
 key uuid; prior public.outreach_partner_intakes; digest text; result jsonb;
 d text; fp text; email text; phone text; n integer; blocked boolean:=false;
 changed boolean:=false; instant timestamptz:=clock_timestamp();
begin
 if p_network is null or p_network !~ '^[0-9a-f]{64}$' then return jsonb_build_object('accepted',false,'reason','invalid'); end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>12000 then return jsonb_build_object('accepted',false,'reason','invalid'); end if;
 -- Gateway does this before Siteverify too. Never persist a honeypot payload.
 if jsonb_typeof(p_data->'bot_field')='string' and p_data->>'bot_field'<>'' then return jsonb_build_object('accepted',true); end if;
 begin key:=(p_data->>'request_key')::uuid; exception when invalid_text_representation then key:=null; end;
 if key is not null then
  perform pg_advisory_xact_lock(hashtextextended('outreach-request:'||key::text,0));
  digest:=encode(sha256(convert_to((p_data-'request_key'-'bot_field')::text,'UTF8')),'hex');
  select * into prior from public.outreach_partner_intakes where request_key=key;
  if found then
   if prior.payload_hash=digest then return jsonb_build_object('accepted',true); end if;
   changed:=true;
  end if;
 end if;
 email:=lower(btrim(coalesce(p_data->'fields'->>'email','')));
 phone:=regexp_replace(coalesce(p_data->'fields'->>'phone',''),'[^0-9]','','g');
 -- Lock order is always network -> email -> phone, then canonical insert.
 -- Reject over-limit networks before allocating rows for rotating contact values.
 foreach d in array array['network','email','phone'] loop
  fp:=case d when 'network' then p_network else encode(sha256(convert_to(d||':'||case d when 'email' then email else phone end,'UTF8')),'hex') end;
  insert into private.outreach_abuse_windows as w(dimension,fingerprint,window_ends_at,attempts)
   values(d,fp,instant+interval '1 hour',1)
   on conflict(dimension,fingerprint) do update set
    attempts=case when w.window_ends_at<=instant then 1 else least(w.attempts+1,1000000) end,
    window_ends_at=case when w.window_ends_at<=instant then instant+interval '1 hour' else w.window_ends_at end
   returning attempts into n;
  if n>private.outreach_abuse_limit(d) then
   blocked:=true;
   if d='network' then return jsonb_build_object('accepted',false,'reason','rate'); end if;
  end if;
 end loop;
 if blocked then return jsonb_build_object('accepted',false,'reason','rate'); end if;
 if changed then return jsonb_build_object('accepted',false,'reason','invalid'); end if;
 -- Catch only validation errors here, so attempted submissions retain rate counts.
 -- Unexpected database failures roll back and the gateway fails closed.
 begin
  result:=private.outreach_partner_submit(p_data);
 exception when sqlstate '22023' or invalid_text_representation or raise_exception or numeric_value_out_of_range then
  return jsonb_build_object('accepted',false,'reason','invalid');
 end;
 return result;
end $$;
create function public.outreach_partner_gateway(p_data jsonb,p_network text) returns jsonb
 language sql security invoker set search_path='' as $$select private.outreach_partner_gateway(p_data,p_network)$$;
revoke all on function private.outreach_partner_gateway(jsonb,text),public.outreach_partner_gateway(jsonb,text) from public,anon,authenticated,service_role;
grant usage on schema private to service_role;
grant execute on function private.outreach_partner_gateway(jsonb,text),public.outreach_partner_gateway(jsonb,text) to service_role;
-- No client grants on counters, cleanup, policy or canonical submit.
-- Use the existing scheduler when present; never install an extension implicitly.
-- Cleanup has its own transaction so its row locks cannot deadlock intake counters.
do $schedule$
begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('outreach-abuse-cleanup','*/5 * * * *','select private.outreach_abuse_cleanup()');
 end if;
end $schedule$;
-- Verify this exact cleanup schedule before release; no scheduler means a release blocker.
