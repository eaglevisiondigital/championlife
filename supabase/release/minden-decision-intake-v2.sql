-- SOURCE CANDIDATE ONLY. No production application or policy approval is implied.
-- This fragment follows minden-decision-foundation-v2.sql in one forward transaction.
create table private.minden_decision_policies (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id),
 version text not null check(length(version) between 1 and 80),
 copy jsonb not null check(jsonb_typeof(copy)='object'), allow_guardian boolean not null default false,
 approved_by uuid not null references auth.users(id), approval_reference text not null check(length(approval_reference) between 12 and 500),
 approved_at timestamptz not null, effective_at timestamptz not null, expires_at timestamptz not null,
 check(isfinite(approved_at) and isfinite(effective_at) and isfinite(expires_at) and approved_at<=effective_at and effective_at<expires_at), unique(campaign_id,version)
);
create trigger minden_decision_policy_immutable before update or delete on private.minden_decision_policies for each row execute function private.outreach_immutable();
create table private.minden_decision_runtime (
 campaign_id uuid primary key references public.outreach_campaigns(id), enabled boolean not null default false,
 reader_enabled boolean not null default false, active_policy_id uuid references private.minden_decision_policies(id),
 revision integer not null default 1 check(revision>0), check(not enabled or active_policy_id is not null), check(not reader_enabled or active_policy_id is not null)
);
create table private.minden_decision_receipts (
 request_id uuid primary key, secret_hash text not null check(secret_hash~'^[0-9a-f]{64}$'), payload_hash text not null check(payload_hash~'^[0-9a-f]{64}$'),
 campaign_id uuid not null references public.outreach_campaigns(id), registration_id uuid not null unique references public.outreach_registrations(id),
 policy_id uuid not null references private.minden_decision_policies(id), locale text not null check(locale in ('en','es')),
 subject_kind text not null check(subject_kind in ('adult_self','guardian')),
 guardian_name text, resource_consent boolean not null, followup_consent boolean not null,
 resource_revoked_at timestamptz, followup_revoked_at timestamptz,
 accepted_at timestamptz not null default clock_timestamp(), check(subject_kind<>'guardian' or length(guardian_name) between 1 and 100)
);
create function private.minden_decision_receipt_immutable() returns trigger language plpgsql set search_path='' as $$
 begin
 if tg_op='DELETE' then raise exception 'Receipt is immutable' using errcode='42501'; end if;
 if (to_jsonb(old)-array['resource_revoked_at','followup_revoked_at']) is distinct from (to_jsonb(new)-array['resource_revoked_at','followup_revoked_at'])
 or (old.resource_revoked_at is not null and new.resource_revoked_at is distinct from old.resource_revoked_at)
 or (old.followup_revoked_at is not null and new.followup_revoked_at is distinct from old.followup_revoked_at)
 or new.resource_revoked_at>clock_timestamp() or new.followup_revoked_at>clock_timestamp() then raise exception 'Receipt binding/revocation is immutable' using errcode='42501'; end if;
 return new;
 end $$;
revoke all on function private.minden_decision_receipt_immutable() from public,anon,authenticated,service_role;
create trigger minden_decision_receipt_immutable before update or delete on private.minden_decision_receipts for each row execute function private.minden_decision_receipt_immutable();
create table private.minden_decision_consent_events (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references private.minden_decision_receipts(request_id),
 actor_user_id uuid not null references auth.users(id), resource_withdrawn boolean not null, followup_withdrawn boolean not null,
 recorded_at timestamptz not null default clock_timestamp(), check(resource_withdrawn or followup_withdrawn)
);
create trigger minden_decision_consent_event_immutable before update or delete on private.minden_decision_consent_events for each row execute function private.outreach_immutable();
create table private.minden_decision_token_spends(token_hash text primary key check(token_hash~'^[0-9a-f]{64}$'), request_id uuid not null unique references private.minden_decision_receipts(request_id));
create table private.minden_decision_network_windows(network_hash text not null check(network_hash~'^[0-9a-f]{64}$'), window_start timestamptz not null, count integer not null check(count>0), primary key(network_hash,window_start));
alter table private.minden_decision_policies enable row level security;
alter table private.minden_decision_runtime enable row level security;
alter table private.minden_decision_receipts enable row level security;
alter table private.minden_decision_token_spends enable row level security;
alter table private.minden_decision_consent_events enable row level security;
alter table private.minden_decision_network_windows enable row level security;
revoke all on private.minden_decision_policies,private.minden_decision_runtime,private.minden_decision_receipts,private.minden_decision_token_spends,private.minden_decision_network_windows,private.minden_decision_consent_events from public,anon,authenticated,service_role;
-- No mapping, policy, runtime activation, staff grant, Person merge or email is installed here.

create function private.minden_decision_policy_valid(p private.minden_decision_policies) returns boolean language sql volatile set search_path='' as $$
 select p.campaign_id='d26b8337-d215-42d3-ac3b-c771f7f07db7'::uuid
 and p.effective_at<=clock_timestamp() and p.expires_at>clock_timestamp()
 and not exists(select 1 from unnest(array['en','es']) l cross join unnest(array['processing','resource','followup','adult','guardian']) k where
 jsonb_typeof(p.copy->l->k) is distinct from 'string' or length(p.copy->l->>k) not between 12 and 4000)
$$;
create function private.minden_decision_public_config() returns jsonb language plpgsql security definer set search_path='' as $$
 declare p private.minden_decision_policies; r private.minden_decision_runtime;
 begin
 select * into r from private.minden_decision_runtime where campaign_id='d26b8337-d215-42d3-ac3b-c771f7f07db7';
 select * into p from private.minden_decision_policies where id=r.active_policy_id and campaign_id=r.campaign_id;
 if not coalesce(r.enabled,false) or not coalesce(private.minden_decision_policy_valid(p),false) or not exists(select 1 from public.outreach_decision_campaign_sources s join public.outreach_campaigns c on c.id=s.campaign_id join public.organizations o on o.id=c.organization_id where s.campaign_id=r.campaign_id and s.active and s.source='minden_la_outreach' and c.code='minden_la_2026' and c.public_slug='minden-2026' and o.slug='sowgo' and c.status not in('cancelled','closed')) then return jsonb_build_object('enabled',false); end if;
 return jsonb_build_object('enabled',true,'policy_id',p.id,'version',p.version,'copy',p.copy,'allow_guardian',p.allow_guardian);
 end $$;
-- Fixed no-argument public config facade matches current registration config pattern;
-- avoids adding anonymous USAGE to the private schema. Returns approved non-PII copy only.
create function public.minden_decision_config() returns jsonb language sql security definer set search_path='' as $$select private.minden_decision_public_config()$$;
revoke all on function private.minden_decision_public_config(),public.minden_decision_config() from public;
grant execute on function public.minden_decision_config() to anon,authenticated;

create function private.minden_decision_gateway(p_action text,p_request uuid,p_secret text,p_payload jsonb default '{}'::jsonb,p_network text default null,p_token_hash text default null) returns jsonb language plpgsql security definer set search_path='' as $$
 declare c public.outreach_campaigns; r private.minden_decision_runtime; p private.minden_decision_policies; receipt private.minden_decision_receipts; x jsonb; h text; reg uuid; counter integer; win timestamptz; k text; v text;
 begin
 if p_request is null or p_secret is null or p_secret !~ '^[0-9a-f]{64}$' or p_action is null or p_action not in ('status','submit') then raise exception 'Invalid receipt request' using errcode='22023'; end if;
 -- Same-key requests serialize even before a receipt exists. No unbounded lock-key namespace or PII in logs.
 perform pg_advisory_xact_lock(hashtextextended('minden-decision:'||p_request::text,0));
 select * into receipt from private.minden_decision_receipts where request_id=p_request;
 h:=encode(sha256(convert_to(p_secret,'UTF8')),'hex');
 if receipt.request_id is not null then
  if receipt.secret_hash<>h then return jsonb_build_object('state','UNKNOWN'); end if;
  if p_action='submit' and receipt.payload_hash<>encode(sha256(convert_to(p_payload::text,'UTF8')),'hex') then return jsonb_build_object('state','CONFLICT'); end if;
  return jsonb_build_object('state','ACCEPTED','receipt',receipt.request_id,'accepted_at',receipt.accepted_at);
 end if;
 if p_action='status' then return jsonb_build_object('state','UNKNOWN'); end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_payload) t(key) where key<>all(array['first_name','last_name','email','phone','decision','prayer_request','policy_id','locale','subject_kind','guardian_name','processing_consent','resource_consent','followup_consent','adult_attested','guardian_attested'])) then raise exception 'Invalid fields' using errcode='22023'; end if;
 for k in select unnest(array['first_name','last_name','email','phone','decision','prayer_request','policy_id','locale','subject_kind','guardian_name']) loop
  if jsonb_typeof(p_payload->k) is distinct from 'string' then raise exception 'Invalid fields' using errcode='22023'; end if;
 end loop;
 for k in select unnest(array['processing_consent','resource_consent','followup_consent','adult_attested','guardian_attested']) loop
  if jsonb_typeof(p_payload->k) is distinct from 'boolean' then raise exception 'Invalid consent' using errcode='22023'; end if;
 end loop;
 if length(btrim(p_payload->>'first_name')) not between 1 and 100 or length(btrim(p_payload->>'last_name')) not between 1 and 100 or length(btrim(p_payload->>'email')) not between 3 and 320 or p_payload->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_payload->>'phone')>40 or (length(p_payload->>'phone')>0 and length(p_payload->>'phone')<7) or length(p_payload->>'prayer_request')>2000 or p_payload->>'decision' not in ('salvation','rededication','learn_more','prayer_followup') or p_payload->>'locale' not in ('en','es') or p_payload->>'subject_kind' not in ('adult_self','guardian') or p_payload->'processing_consent'<>'true'::jsonb then raise exception 'Invalid fields' using errcode='22023'; end if;
 if p_network is null or p_network !~ '^[0-9a-f]{64}$' or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Verified proof required' using errcode='42501'; end if;
 select * into c from public.outreach_campaigns where id='d26b8337-d215-42d3-ac3b-c771f7f07db7' for share;
 if c.id is null or c.code<>'minden_la_2026' or c.public_slug<>'minden-2026' or c.status in ('cancelled','closed') or not exists(select 1 from public.organizations where id=c.organization_id and slug='sowgo') then raise exception 'Intake closed' using errcode='42501'; end if;
 select * into r from private.minden_decision_runtime where campaign_id=c.id for share;
 select * into p from private.minden_decision_policies where id=r.active_policy_id and campaign_id=c.id for share;
 if not coalesce(r.enabled,false) or not coalesce(private.minden_decision_policy_valid(p),false) then raise exception 'Intake closed' using errcode='42501'; end if;
 if p_payload->>'policy_id'<>p.id::text then raise exception 'Consent changed; review current consent' using errcode='40001'; end if;
 perform 1 from public.outreach_decision_campaign_sources where campaign_id=c.id and source='minden_la_outreach' and active for share;
 if not found then raise exception 'Intake closed' using errcode='42501'; end if;
 if p_payload->>'subject_kind'='adult_self' then
  if p_payload->'adult_attested'<>'true'::jsonb or p_payload->'guardian_attested'<>'false'::jsonb or p_payload->>'guardian_name'<>'' then raise exception 'Adult attestation required' using errcode='22023'; end if;
 else
  if not p.allow_guardian or p_payload->'guardian_attested'<>'true'::jsonb or p_payload->'adult_attested'<>'true'::jsonb or length(btrim(p_payload->>'guardian_name')) not between 1 and 100 then raise exception 'Guardian authority required' using errcode='22023'; end if;
 end if;
 win:=date_trunc('hour',clock_timestamp());
 insert into private.minden_decision_network_windows values(p_network,win,1) on conflict(network_hash,window_start) do update set count=private.minden_decision_network_windows.count+1 returning count into counter;
 if counter>12 then return jsonb_build_object('state','RATE_LIMITED'); end if;
 reg:=gen_random_uuid();
 insert into public.outreach_registrations(id,first_name,last_name,email,phone,decision,prayer_request,consent,source)
 values(reg,btrim(p_payload->>'first_name'),btrim(p_payload->>'last_name'),lower(btrim(p_payload->>'email')),btrim(p_payload->>'phone'),p_payload->>'decision',nullif(p_payload->>'prayer_request',''),true,'minden_la_outreach');
 insert into public.outreach_decision_followup(registration_id,campaign_id) values(reg,c.id);
 insert into private.minden_decision_receipts(request_id,secret_hash,payload_hash,campaign_id,registration_id,policy_id,locale,subject_kind,guardian_name,resource_consent,followup_consent)
 values(p_request,h,encode(sha256(convert_to(p_payload::text,'UTF8')),'hex'),c.id,reg,p.id,p_payload->>'locale',p_payload->>'subject_kind',nullif(btrim(p_payload->>'guardian_name'),''),(p_payload->>'resource_consent')::boolean,(p_payload->>'followup_consent')::boolean);
 insert into private.minden_decision_token_spends values(p_token_hash,p_request);
 perform private.minden_decision_record_intake(c.id,reg,p_request);
 -- Recheck real time after any waits; expiry during lock acquisition is a denial with complete rollback.
 if not private.minden_decision_policy_valid(p) or p.expires_at<=clock_timestamp() then raise exception 'Consent expired' using errcode='40001'; end if;
 return jsonb_build_object('state','ACCEPTED','receipt',p_request,'accepted_at',clock_timestamp());
 end $$;
create function public.minden_decision_gateway(p_action text,p_request uuid,p_secret text,p_payload jsonb default '{}'::jsonb,p_network text default null,p_token_hash text default null) returns jsonb language sql security invoker set search_path='' as $$select private.minden_decision_gateway(p_action,p_request,p_secret,p_payload,p_network,p_token_hash)$$;
revoke all on function private.minden_decision_gateway(text,uuid,text,jsonb,text,text),public.minden_decision_gateway(text,uuid,text,jsonb,text,text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.minden_decision_gateway(text,uuid,text,jsonb,text,text),public.minden_decision_gateway(text,uuid,text,jsonb,text,text) to service_role;

create function private.minden_decision_followup_consent(p_registration uuid) returns boolean language plpgsql security definer set search_path='' as $$
 declare r private.minden_decision_receipts; p private.minden_decision_policies; runtime private.minden_decision_runtime;
 begin
 select * into r from private.minden_decision_receipts where registration_id=p_registration for share;
 select * into runtime from private.minden_decision_runtime where campaign_id=r.campaign_id for share;
 select * into p from private.minden_decision_policies where id=r.policy_id and campaign_id=r.campaign_id for share;
 return coalesce(r.followup_consent and r.followup_revoked_at is null and runtime.active_policy_id=r.policy_id and private.minden_decision_policy_valid(p) and p.expires_at>clock_timestamp(),false);
 end $$;
revoke all on function private.minden_decision_policy_valid(private.minden_decision_policies),private.minden_decision_followup_consent(uuid) from public,anon,authenticated,service_role;

create function private.minden_decision_revoke(p_request uuid,p_resource boolean,p_followup boolean) returns jsonb language plpgsql security definer set search_path='' as $$
 declare u uuid; email_address text; r private.minden_decision_receipts;
 begin
 if p_resource is null or p_followup is null or not(p_resource or p_followup) then raise exception 'Choose a permission to withdraw' using errcode='22023'; end if;
 u:=private.minden_decision_session();
 select lower(btrim(email)) into email_address from auth.users where id=u;
 select x.* into r from private.minden_decision_receipts x join public.outreach_registrations d on d.id=x.registration_id where x.request_id=p_request and lower(btrim(d.email))=email_address for update of x;
 if r.request_id is null then raise exception 'Receipt unavailable' using errcode='42501'; end if;
 if (p_resource and r.resource_revoked_at is null) or (p_followup and r.followup_revoked_at is null) then
 insert into private.minden_decision_consent_events(request_id,actor_user_id,resource_withdrawn,followup_withdrawn) values(p_request,u,p_resource and r.resource_revoked_at is null,p_followup and r.followup_revoked_at is null);
 end if;
 update private.minden_decision_receipts set resource_revoked_at=case when p_resource then coalesce(resource_revoked_at,clock_timestamp()) else resource_revoked_at end,followup_revoked_at=case when p_followup then coalesce(followup_revoked_at,clock_timestamp()) else followup_revoked_at end where request_id=p_request;
 perform private.minden_decision_session();
 return jsonb_build_object('revoked',true);
 end $$;
create function public.minden_decision_revoke(p_request uuid,p_resource boolean,p_followup boolean) returns jsonb language sql security invoker set search_path='' as $$select private.minden_decision_revoke(p_request,p_resource,p_followup)$$;
revoke all on function private.minden_decision_revoke(uuid,boolean,boolean),public.minden_decision_revoke(uuid,boolean,boolean) from public,anon;
grant execute on function private.minden_decision_revoke(uuid,boolean,boolean),public.minden_decision_revoke(uuid,boolean,boolean) to authenticated;
