-- SOURCE ONLY: bounded extension of the existing registered-book entitlement.
-- No Person linking, learner completion, storage publication, new grants or data writes.
-- Requires exact reviewed pre-Minden function/policy; separately approved installation only.
begin;
do $minden_reader$
declare
  v_function oid := to_regprocedure('app_private.can_read_king_kind()');
  v_old text := $old$
  select exists (
    select 1 from auth.users as u
    join public.outreach_registrations as r on lower(btrim(r.email)) = lower(btrim(u.email))
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and r.consent = true
      and r.source in ('bessemer_al_2026', 'huntsville_al_2026')
  )
$old$;
  v_new text := $new$
  select exists (
    select 1 from auth.users as u
    join public.outreach_registrations as r on lower(btrim(r.email)) = lower(btrim(u.email))
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and r.consent = true
      and r.source in ('bessemer_al_2026', 'huntsville_al_2026', 'minden_la_outreach')
  )
$new$;
  v_policy text := $policy$((bucket_id = 'king-kind-books'::text) AND (name = 'king-kind/king-kind-english.pdf'::text) AND ( SELECT app_private.can_read_king_kind() AS can_read_king_kind))$policy$;
  v_acl text;
begin
  if v_function is null or not exists (
    select 1 from pg_proc p join pg_language l on l.oid=p.prolang
    where p.oid=v_function and l.lanname='sql' and p.prosrc=v_old and p.proowner='postgres'::regrole
      and p.pronargs=0 and p.prorettype='boolean'::regtype and p.prokind='f'
      and p.provolatile='s' and p.prosecdef and not p.proleakproof
      and p.proconfig=array['search_path=""']::text[]
      and p.proacl::text='{postgres=X/postgres,authenticated=X/postgres}'
  ) then raise exception 'King Kind reader authority definition/ACL drift'; end if;
  if not exists (select 1 from storage.buckets where id='king-kind-books' and public=false)
    or not exists(select 1 from pg_class where oid='storage.objects'::regclass and relrowsecurity)
    or (select count(*) from pg_policies where schemaname='storage' and tablename='objects')<>1
    or not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
      and policyname='king_kind_registered_outreach_read' and permissive='PERMISSIVE' and cmd='SELECT'
      and roles=array['authenticated']::name[] and qual=v_policy and with_check is null)
  then raise exception 'King Kind private storage policy drift'; end if;
  select proacl::text into v_acl from pg_proc where oid=v_function;
  execute 'create or replace function app_private.can_read_king_kind() returns boolean language sql stable security definer set search_path = '''' as ' || quote_literal(v_new);
  if not exists(select 1 from pg_proc where oid=v_function and prosrc=v_new and proacl::text=v_acl)
    then raise exception 'King Kind reader correction changed authority'; end if;
end
$minden_reader$;
commit;
