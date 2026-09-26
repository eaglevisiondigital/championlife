
drop trigger if exists on_auth_user_link_outreach on auth.users;
drop trigger if exists on_outreach_registration_link_user on public.outreach_registrations;

drop function if exists public.link_new_auth_user_to_outreach();
drop function if exists public.link_new_outreach_registration();
drop function if exists public.apply_outreach_registration_to_user(uuid,text);

create or replace function public.claim_st_lucia_registration()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid;
  current_email text;
  reg public.outreach_registrations%rowtype;
  grip_course_id bigint;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select email into current_email
  from auth.users
  where id = current_user_id;

  if current_email is null then
    return false;
  end if;

  select *
  into reg
  from public.outreach_registrations
  where lower(email) = lower(current_email)
    and source = 'st_lucia_2026'
  order by created_at desc
  limit 1;

  if not found then
    return false;
  end if;

  update public.outreach_registrations
  set user_id = current_user_id
  where lower(email) = lower(current_email)
    and source = 'st_lucia_2026'
    and (user_id is null or user_id = current_user_id);

  insert into public.profiles (user_id, first_name, last_name, email, phone, updated_at)
  values (current_user_id, reg.first_name, reg.last_name, current_email, reg.phone, now())
  on conflict (user_id) do update
  set first_name = coalesce(nullif(public.profiles.first_name,''), nullif(excluded.first_name,'')),
      last_name = coalesce(nullif(public.profiles.last_name,''), nullif(excluded.last_name,'')),
      email = excluded.email,
      phone = coalesce(nullif(public.profiles.phone,''), nullif(excluded.phone,'')),
      updated_at = now();

  select id into grip_course_id
  from public.courses
  where slug = 'getting-a-grip-on-the-basics'
  limit 1;

  if grip_course_id is not null then
    insert into public.course_enrollments (user_id, course_id)
    values (current_user_id, grip_course_id)
    on conflict (user_id, course_id) do nothing;
  end if;

  return true;
end;
$$;

revoke all on function public.claim_st_lucia_registration() from public, anon;
grant execute on function public.claim_st_lucia_registration() to authenticated;
