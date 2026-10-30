-- LOCAL REVIEW CANDIDATE ONLY. Not applied hosted; migration ledger name requires release review.
-- Requires the unchanged approved King Kind private Storage release first.
begin;
create table app_private.general_resource_registrations(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id),
 request_id uuid not null unique,
 name text not null check(length(name) between 1 and 160),
 verified_email text not null check(length(verified_email)<=254),
 phone text not null default '' check(length(phone)<=40),
 prayer text not null default '' check(length(prayer)<=2000),
 interest text not null default '' check(interest in('','discipleship','prayer','church','serving')),
 resource_consent boolean not null check(resource_consent),
 ministry_updates boolean not null default false,
 consent_version text not null check(consent_version='general-resources-v1'),
 created_at timestamptz not null default now(),
 revoked_at timestamptz
);
create table app_private.general_resource_audit(
 id uuid primary key default gen_random_uuid(),
 registration_id uuid not null references app_private.general_resource_registrations(id),
 actor_id uuid not null references auth.users(id),
 action text not null check(action='registered'),
 created_at timestamptz not null default now()
);
alter table app_private.general_resource_registrations enable row level security;
alter table app_private.general_resource_audit enable row level security;
revoke all on app_private.general_resource_registrations,app_private.general_resource_audit from public,anon,authenticated;
create function app_private.general_resource_audit_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Immutable resource audit' using errcode='42501';end$$;
create trigger general_resource_audit_immutable before update or delete on app_private.general_resource_audit for each row execute function app_private.general_resource_audit_immutable();
revoke all on function app_private.general_resource_audit_immutable() from public,anon,authenticated;

create function app_private.general_resource_registration(action text,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u auth.users;r app_private.general_resource_registrations; rid uuid; n text; e text; p text; prayer_text text; interest_text text;
begin
 select * into u from auth.users where id=auth.uid();
 if u.id is null or u.email_confirmed_at is null or coalesce(u.is_anonymous,false) then raise exception 'Verified account required' using errcode='42501';end if;
 if action is null or action not in('register','status') or payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid request' using errcode='22023';end if;
 if action='status' then
  if payload<>'{}'::jsonb then raise exception 'Invalid request' using errcode='22023';end if;
  select * into r from app_private.general_resource_registrations where user_id=u.id;
  return jsonb_build_object('registered',r.id is not null and r.revoked_at is null,'reference',case when r.revoked_at is null then r.id end);
 end if;
 if exists(select 1 from jsonb_object_keys(payload) k where k not in('request_id','name','email','phone','prayer','interest','resource_consent','ministry_updates','consent_version'))then raise exception 'Invalid fields' using errcode='22023';end if;
 if jsonb_typeof(payload->'name') is distinct from 'string' or jsonb_typeof(payload->'email') is distinct from 'string' or payload->'resource_consent' is distinct from 'true'::jsonb or payload->>'consent_version' is distinct from 'general-resources-v1' or (payload ? 'ministry_updates' and jsonb_typeof(payload->'ministry_updates')<>'boolean')then raise exception 'Required fields missing' using errcode='22023';end if;
 if exists(select 1 from jsonb_each(payload) f where f.key in('phone','prayer','interest')and jsonb_typeof(f.value)<>'string')then raise exception 'Invalid optional field' using errcode='22023';end if;
 n=btrim(payload->>'name');e=lower(btrim(payload->>'email'));p=btrim(coalesce(payload->>'phone',''));prayer_text=btrim(coalesce(payload->>'prayer',''));interest_text=coalesce(payload->>'interest','');
 if length(n) not between 1 and 160 or length(e)>254 or e<>lower(btrim(u.email)) or length(p)>40 or (p<>''and p !~ '^[+0-9() .-]{5,40}$')or length(prayer_text)>2000 or interest_text not in('','discipleship','prayer','church','serving') then raise exception 'Invalid registration' using errcode='22023';end if;
 begin rid=(payload->>'request_id')::uuid;exception when invalid_text_representation then raise exception 'Invalid request key' using errcode='22023';end;
 if rid is null then raise exception 'Request key required' using errcode='22023';end if;
 -- Lock a genuine identity, not a caller-supplied actor or email. Serializes retries.
 perform 1 from auth.users where id=u.id for update;
 select * into r from app_private.general_resource_registrations where user_id=u.id;
 if found then
  if r.revoked_at is not null then raise exception 'Resource access unavailable' using errcode='42501';end if;
  return jsonb_build_object('registered',true,'reference',r.id,'existing',true);
 end if;
 -- Cross-account request collision returns a generic rejection, never another receipt.
 if exists(select 1 from app_private.general_resource_registrations where request_id=rid)then raise exception 'Invalid request key' using errcode='22023';end if;
 insert into app_private.general_resource_registrations(user_id,request_id,name,verified_email,phone,prayer,interest,resource_consent,ministry_updates,consent_version)
 values(u.id,rid,n,e,p,prayer_text,interest_text,true,coalesce((payload->>'ministry_updates')::boolean,false),'general-resources-v1') returning * into r;
 insert into app_private.general_resource_audit(registration_id,actor_id,action)values(r.id,u.id,'registered');
 return jsonb_build_object('registered',true,'reference',r.id,'existing',false);
end$$;
revoke all on function app_private.general_resource_registration(text,jsonb) from public,anon;
grant execute on function app_private.general_resource_registration(text,jsonb) to authenticated;
create function public.general_resource_registration(action text,payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$select app_private.general_resource_registration(action,payload)$$;
revoke all on function public.general_resource_registration(text,jsonb) from public,anon;
grant execute on function public.general_resource_registration(text,jsonb) to authenticated;

-- Extend eligibility only; preserve exact private object Storage policy and legacy branch.
create or replace function app_private.can_read_king_kind()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and (
  exists(select 1 from public.outreach_registrations r where lower(btrim(r.email))=lower(btrim(u.email)) and r.consent=true and r.source in('bessemer_al_2026','huntsville_al_2026'))
  or (not coalesce(u.is_anonymous,false) and exists(select 1 from app_private.general_resource_registrations g where g.user_id=u.id and g.resource_consent=true and g.revoked_at is null))
 ))
$$;
revoke all on function app_private.can_read_king_kind() from public,anon;
grant execute on function app_private.can_read_king_kind() to authenticated;
commit;
