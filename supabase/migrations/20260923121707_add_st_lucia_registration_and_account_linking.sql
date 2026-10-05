
create table if not exists public.outreach_registrations (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'st_lucia_2026',
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  decision text not null check (decision in ('salvation','rededication','learn_more','prayer_followup')),
  prayer_request text,
  consent boolean not null default true,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists outreach_registrations_email_idx on public.outreach_registrations ((lower(email)));
create index if not exists outreach_registrations_user_id_idx on public.outreach_registrations (user_id);
create index if not exists outreach_registrations_source_idx on public.outreach_registrations (source);

alter table public.outreach_registrations enable row level security;

drop policy if exists "outreach_insert_public" on public.outreach_registrations;
create policy "outreach_insert_public"
on public.outreach_registrations
for insert
to anon, authenticated
with check (
  source = 'st_lucia_2026'
  and length(trim(first_name)) between 1 and 100
  and length(trim(last_name)) between 1 and 100
  and length(trim(email)) between 5 and 320
  and length(trim(phone)) between 7 and 40
  and consent = true
);

drop policy if exists "outreach_select_own" on public.outreach_registrations;
create policy "outreach_select_own"
on public.outreach_registrations
for select
to authenticated
using ((select auth.uid()) = user_id);

grant insert on public.outreach_registrations to anon;
grant select, insert on public.outreach_registrations to authenticated;

create or replace function public.apply_outreach_registration_to_user(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  reg public.outreach_registrations%rowtype;
  grip_course_id bigint;
begin
  select *
  into reg
  from public.outreach_registrations
  where lower(email) = lower(p_email)
    and source = 'st_lucia_2026'
  order by created_at desc
  limit 1;

  if not found then
    return;
  end if;

  update public.outreach_registrations
  set user_id = p_user_id
  where lower(email) = lower(p_email)
    and source = 'st_lucia_2026'
    and (user_id is null or user_id = p_user_id);

  insert into public.profiles (user_id, first_name, last_name, email, phone, updated_at)
  values (p_user_id, reg.first_name, reg.last_name, p_email, reg.phone, now())
  on conflict (user_id) do update
  set first_name = coalesce(nullif(excluded.first_name,''), public.profiles.first_name),
      last_name = coalesce(nullif(excluded.last_name,''), public.profiles.last_name),
      email = excluded.email,
      phone = coalesce(nullif(excluded.phone,''), public.profiles.phone),
      updated_at = now();

  select id into grip_course_id
  from public.courses
  where slug = 'getting-a-grip-on-the-basics'
  limit 1;

  if grip_course_id is not null then
    insert into public.course_enrollments (user_id, course_id)
    values (p_user_id, grip_course_id)
    on conflict (user_id, course_id) do nothing;
  end if;
end;
$$;

revoke all on function public.apply_outreach_registration_to_user(uuid,text) from public, anon, authenticated;

create or replace function public.link_new_auth_user_to_outreach()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.email is not null then
    perform public.apply_outreach_registration_to_user(new.id, new.email);
  end if;
  return new;
end;
$$;

revoke all on function public.link_new_auth_user_to_outreach() from public, anon, authenticated;

drop trigger if exists on_auth_user_link_outreach on auth.users;
create trigger on_auth_user_link_outreach
after insert on auth.users
for each row execute function public.link_new_auth_user_to_outreach();

create or replace function public.link_new_outreach_registration()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  existing_user_id uuid;
begin
  select id into existing_user_id
  from auth.users
  where lower(email) = lower(new.email)
  order by created_at desc
  limit 1;

  if existing_user_id is not null then
    update public.outreach_registrations
    set user_id = existing_user_id
    where id = new.id;

    perform public.apply_outreach_registration_to_user(existing_user_id, new.email);
  end if;

  return new;
end;
$$;

revoke all on function public.link_new_outreach_registration() from public, anon, authenticated;

drop trigger if exists on_outreach_registration_link_user on public.outreach_registrations;
create trigger on_outreach_registration_link_user
after insert on public.outreach_registrations
for each row execute function public.link_new_outreach_registration();
