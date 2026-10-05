-- PREPARED ONLY. Explicit production release authorization is required.
-- Verify the dashboard/connection project ref first. The session acknowledgement
-- below is an operator interlock, not proof of the connected project's identity.
-- Run AFTER missing Outreach migrations, including the 120/hour policy.
begin;
set local row_security = off;
do $preflight$
begin
 if current_setting('champion.outreach_release_target',true) is distinct from 'exdocjbmylgxssanymjk'
    or current_database()<>'postgres' or current_user<>'postgres' then
  raise exception 'Explicit production-target acknowledgement and postgres session required';
 end if;
 if not exists(select 1 from pg_roles where rolname=current_user and rolbypassrls) then
  raise exception 'All cron owners must be visible; BYPASSRLS required';
 end if;
 if not exists(select 1 from pg_available_extensions where name='pg_cron')
    or 'pg_cron'<>all(string_to_array(replace(current_setting('shared_preload_libraries'),' ',''),','))
    or current_setting('cron.database_name',true) is distinct from 'postgres'
    or current_setting('cron.host',true) is distinct from 'localhost' then
  raise exception 'Supported preloaded local pg_cron configuration required';
 end if;
 if to_regnamespace('cron') is not null and not exists(select 1 from pg_extension where extname='pg_cron') then
  raise exception 'Unexpected existing cron schema; review without overwriting';
 end if;
 if private.outreach_abuse_limit('network')<>120 or private.outreach_abuse_limit('email')<>5
    or private.outreach_abuse_limit('phone')<>5 then
  raise exception 'Approved rate policy migration must be applied first';
 end if;
 if not exists(select 1 from pg_proc where oid='private.outreach_abuse_cleanup()'::regprocedure
               and prosecdef and proowner=(select oid from pg_roles where rolname='postgres')) then
  raise exception 'Expected owner-only cleanup function required';
 end if;
 if has_function_privilege('anon','private.outreach_abuse_cleanup()','execute')
    or has_function_privilege('authenticated','private.outreach_abuse_cleanup()','execute')
    or has_function_privilege('service_role','private.outreach_abuse_cleanup()','execute') then
  raise exception 'Cleanup must not be executable by browser/server API roles';
 end if;
end
$preflight$;

-- Supabase documented extension location and postgres-only management grants.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Serialize catalog writes, including cron.schedule callers outside this script.
lock table cron.job in share row exclusive mode;
do $schedule$
declare existing cron.job%rowtype; matching_count integer; cleanup_job bigint;
begin
 if not exists(select 1 from pg_extension where extname='pg_cron' and extnamespace='pg_catalog'::regnamespace) then
  raise exception 'Unexpected pg_cron extension schema';
 end if;
 select count(*) into matching_count from cron.job where jobname='outreach-abuse-cleanup';
 if matching_count>1 then raise exception 'Duplicate cleanup job name; review without overwriting'; end if;
 if matching_count=1 then
  select * into existing from cron.job where jobname='outreach-abuse-cleanup';
  if existing.schedule is distinct from '*/5 * * * *'
     or existing.command is distinct from 'select private.outreach_abuse_cleanup()'
     or existing.database is distinct from 'postgres' or existing.username is distinct from 'postgres'
     or existing.nodename is distinct from 'localhost'
     or existing.nodeport is distinct from current_setting('port')::integer
     or existing.active is distinct from true then
   raise exception 'Unexpected cleanup job definition; review without overwriting';
  end if;
  cleanup_job:=existing.jobid; -- Exact active job: retain its id and history.
 else
  cleanup_job:=cron.schedule('outreach-abuse-cleanup','*/5 * * * *','select private.outreach_abuse_cleanup()');
 end if;
 raise notice 'Verified Outreach cleanup job id: %',cleanup_job;
end
$schedule$;
commit;
