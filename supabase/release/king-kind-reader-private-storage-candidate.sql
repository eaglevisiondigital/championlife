-- REVIEW-ONLY CANDIDATE. DO NOT APPLY WITHOUT PRODUCTION AUTHORIZATION.
-- No book bytes stored in public GitHub. Upload verified PDF to the private bucket via authorized Supabase Storage workflow.
-- Exact object: king-kind-books/king-kind/king-kind-english.pdf
-- Authorized reader edition SHA-256: 417f9faa7ff3945fdf4ff62931a233739856d03221c8429e21b768b221b94a54; 83 pages; notice on formerly blank page 4.
begin;
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('king-kind-books','king-kind-books',false,30000000,array['application/pdf']::text[])
on conflict (id) do nothing;

-- If an existing bucket with this name has public=true, STOP. Do not continue release.
-- SELECT applies only to one exact object and verified, previously registered email identities.
drop policy if exists king_kind_registered_outreach_read on storage.objects;
create policy king_kind_registered_outreach_read on storage.objects
for select to authenticated
using (bucket_id='king-kind-books'
   and name='king-kind/king-kind-english.pdf'
   and (select app_private.can_read_king_kind()));
commit;
-- Post-release verification: bucket.private, exact object path, anonymous denial,
-- verified registrants from BOTH cities allowed, unrelated users denied,
-- no list of other bucket objects, no writes, no financial grants, and PDF byte hash preserved.
