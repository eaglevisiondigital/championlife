-- REVIEW-ONLY CONTAINMENT. Separate execution authorization required.
-- Preserve registrations and immutable audits; restore only the previous reader eligibility.
begin;
revoke execute on function public.general_resource_registration(text,jsonb) from authenticated;
revoke execute on function app_private.general_resource_registration(text,jsonb) from authenticated;
create or replace function app_private.can_read_king_kind()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users as u
    join public.outreach_registrations as r on lower(btrim(r.email)) = lower(btrim(u.email))
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and r.consent = true
      and r.source in ('bessemer_al_2026', 'huntsville_al_2026')
  )
$$;
revoke all on function app_private.can_read_king_kind() from public, anon;
grant execute on function app_private.can_read_king_kind() to authenticated;

commit;
-- Existing signed URLs retain their original maximum 900-second lifetime.
-- No rows, original registrations, permissions or bucket policies are deleted.
