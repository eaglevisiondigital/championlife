-- Preserve the public RPC signature used by existing login/dashboard code.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

revoke all on public.outreach_registrations from anon, authenticated;
grant insert on public.outreach_registrations to anon, authenticated;
grant select on public.outreach_registrations to authenticated;
alter table public.outreach_registrations alter column consent set default false;
alter policy outreach_insert_public on public.outreach_registrations with check (
 user_id is null and source='st_lucia_2026'
 and length(btrim(first_name)) between 1 and 100
 and length(btrim(last_name)) between 1 and 100
 and length(btrim(email)) between 5 and 320
 and length(btrim(phone)) between 7 and 40
 and consent=true
);

create or replace function private.claim_st_lucia_registration()
returns boolean language plpgsql security definer set search_path='' as $$
declare
 current_user_id uuid := auth.uid();
 current_email text;
 reg public.outreach_registrations%rowtype;
 grip_course_id bigint;
begin
 if current_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select email into current_email from auth.users
 where id=current_user_id and email_confirmed_at is not null and coalesce(is_anonymous,false)=false;
 if current_email is null then return false; end if;
 -- Serialize competing claims for the same verified email.
 perform pg_advisory_xact_lock(hashtextextended(lower(current_email),0));
 select * into reg from public.outreach_registrations
 where lower(email)=lower(current_email) and source='st_lucia_2026'
 and (user_id is null or user_id=current_user_id)
 order by created_at desc,id desc limit 1 for update;
 if not found then return false; end if;
 update public.outreach_registrations set user_id=current_user_id
 where lower(email)=lower(current_email) and source='st_lucia_2026'
 and (user_id is null or user_id=current_user_id);
 insert into public.profiles(user_id,first_name,last_name,email,phone,updated_at)
 values(current_user_id,reg.first_name,reg.last_name,current_email,reg.phone,now())
 on conflict(user_id) do update set
 first_name=coalesce(nullif(public.profiles.first_name,''),nullif(excluded.first_name,'')),
 last_name=coalesce(nullif(public.profiles.last_name,''),nullif(excluded.last_name,'')),
 email=excluded.email,
 phone=coalesce(nullif(public.profiles.phone,''),nullif(excluded.phone,'')),updated_at=now();
 select id into grip_course_id from public.courses where slug='getting-a-grip-on-the-basics' limit 1;
 if grip_course_id is not null then
 insert into public.course_enrollments(user_id,course_id) values(current_user_id,grip_course_id)
 on conflict(user_id,course_id) do nothing;
 end if;
 return true;
end;
$$;
revoke all on function private.claim_st_lucia_registration() from public,anon;
grant execute on function private.claim_st_lucia_registration() to authenticated;
create or replace function public.claim_st_lucia_registration()
returns boolean language sql security invoker set search_path='' as $$
 select private.claim_st_lucia_registration();
$$;
revoke all on function public.claim_st_lucia_registration() from public,anon;
grant execute on function public.claim_st_lucia_registration() to authenticated;
