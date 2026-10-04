-- Project provisioning prerequisite, NOT a numbered migration. See docs/MIGRATION-BASELINE.md.
-- Only an empty isolated database or the known failed one-migration prefix is eligible.
-- Run as postgres, then use supported Supabase branch rebase to resume historical migrations.
begin;
set local search_path = pg_catalog;
do $bootstrap$
begin
 if current_user <> 'postgres' then raise exception 'Bootstrap requires postgres'; end if;
 if exists(select 1 from auth.users) then raise exception 'Bootstrap refuses databases containing Auth users'; end if;
 if to_regnamespace('private') is not null then raise exception 'Bootstrap refuses initialized application databases'; end if;
 if to_regclass('supabase_migrations.schema_migrations') is not null then
  if exists(select 1 from supabase_migrations.schema_migrations where version <> '20260923114743') then
   raise exception 'Bootstrap refuses migration history beyond the known failed prefix';
  end if;
 end if;
 if to_regprocedure('public.rls_auto_enable()') is null then
  execute $definition$CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$$definition$;
 end if;
 if md5(trim(regexp_replace(pg_get_functiondef('public.rls_auto_enable()'::regprocedure), '\s+', ' ', 'g'))) <> '58249bb7e7ad29ddb07a33b2d61f4a16' then
  raise exception 'Unexpected rls_auto_enable definition; refusing to overwrite';
 end if;
 if exists(select 1 from pg_proc where oid='public.rls_auto_enable()'::regprocedure and proowner <> (select oid from pg_roles where rolname='postgres')) then
  raise exception 'Unexpected helper owner';
 end if;
end;
$bootstrap$;
revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role;
do $trigger$
begin
 if exists(select 1 from pg_event_trigger where evtname='ensure_rls') then
  if not exists(select 1 from pg_event_trigger where evtname='ensure_rls' and evtfoid='public.rls_auto_enable()'::regprocedure and evtevent='ddl_command_end' and evtenabled='O' and evttags=array['CREATE TABLE','CREATE TABLE AS','SELECT INTO']::text[]) then
   raise exception 'Unexpected ensure_rls trigger; refusing to overwrite';
  end if;
 else
  create event trigger ensure_rls on ddl_command_end
   when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
   execute function public.rls_auto_enable();
 end if;
end;
$trigger$;
commit;
