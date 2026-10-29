-- DRAFT: General morning-prayer resource registration. Review on disposable PostgreSQL first.
-- No outreach-decision, giving, staff, or church-membership relationship is created.
-- Do NOT apply to production without independently approved release and recovery gates.
begin;

create table public.general_king_kind_registrants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 100),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 100),
  verified_email text not null check (char_length(verified_email) between 5 and 320),
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.general_king_kind_registrants enable row level security;
revoke all on public.general_king_kind_registrants from public, anon, authenticated;
grant all on public.general_king_kind_registrants to service_role;

-- Sign-up must be bound to a currently verified Supabase user, never a visitor-supplied email.
create function public.register_general_king_kind_resource(p_first_name text, p_last_name text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  subject uuid := auth.uid();
  email_now text;
  given text := btrim(coalesce(p_first_name,''));
  family text := btrim(coalesce(p_last_name,''));
begin
  if subject is null then
    raise exception 'Verified sign-in required' using errcode='42501';
  end if;
  select lower(btrim(u.email)) into email_now
    from auth.users u
   where u.id=subject and u.email_confirmed_at is not null and u.email is not null;
  if email_now is null or char_length(email_now) not between 5 and 320 then
    raise exception 'Verified email required' using errcode='42501';
  end if;
  if char_length(given) not between 1 and 100 or char_length(family) not between 1 and 100 then
    raise exception 'Enter your first and last name' using errcode='22023';
  end if;
  insert into public.general_king_kind_registrants (user_id,first_name,last_name,verified_email)
  values (subject,given,family,email_now)
  on conflict(user_id) do update
     set first_name=excluded.first_name,
         last_name=excluded.last_name,
         verified_email=excluded.verified_email,
         updated_at=now();
  return jsonb_build_object('registered',true);
end
$$;
revoke all on function public.register_general_king_kind_resource(text,text) from public, anon, authenticated;
grant execute on function public.register_general_king_kind_resource(text,text) to authenticated;

-- Preserve the accepted Bessemer/Huntsville decision eligibility, adding an independent
-- verified-user general-resource eligibility path. Exact object/bucket restrictions remain
-- enforced by the existing storage.objects policy (king_kind_registered_outreach_read).
create or replace function app_private.can_read_king_kind()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users as u
    join public.outreach_registrations as r
      on lower(btrim(r.email)) = lower(btrim(u.email))
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and r.consent = true
      and r.source in ('bessemer_al_2026', 'huntsville_al_2026')
  )
  or exists (
    select 1 from auth.users as u
    join public.general_king_kind_registrants as g
      on g.user_id=u.id and g.verified_email=lower(btrim(u.email))
    where u.id=auth.uid() and u.email_confirmed_at is not null
  )
$$;
revoke all on function app_private.can_read_king_kind() from public, anon;
grant execute on function app_private.can_read_king_kind() to authenticated;
commit;

-- Release validation: deny anon/unverified users, deny unregistered verified users,
-- preserve prior outreach eligibility, allow registered verified users only,
-- deny unrelated Storage objects and all writes, verify login/account switch.
