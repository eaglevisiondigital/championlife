-- PREPARED ONLY. Explicit production rollback authorization is required.
-- Removes only the exact expected job. Retains extension, counters and all data.
begin;
set local row_security = off;
do $target$
begin
 if current_setting('champion.outreach_release_target',true) is distinct from 'exdocjbmylgxssanymjk'
    or current_database()<>'postgres' or current_user<>'postgres'
    or not exists(select 1 from pg_roles where rolname=current_user and rolbypassrls) then
  raise exception 'Explicit production-target acknowledgement and postgres BYPASSRLS session required';
 end if;
end
$target$;
lock table cron.job in share row exclusive mode;
do $unschedule$
declare existing cron.job%rowtype; matching_count integer;
begin
 select count(*) into matching_count from cron.job where jobname='outreach-abuse-cleanup';
 if matching_count>1 then raise exception 'Duplicate cleanup job name; review without removing'; end if;
 if matching_count=1 then
  select * into existing from cron.job where jobname='outreach-abuse-cleanup';
  if existing.schedule is distinct from '*/5 * * * *'
     or existing.command is distinct from 'select private.outreach_abuse_cleanup()'
     or existing.database is distinct from 'postgres' or existing.username is distinct from 'postgres'
     or existing.nodename is distinct from 'localhost'
     or existing.nodeport is distinct from current_setting('port')::integer then
   raise exception 'Unexpected cleanup job definition; review without removing';
  end if;
  if not cron.unschedule(existing.jobid) then raise exception 'Expected cleanup job was not removed'; end if;
  raise notice 'Unscheduled Outreach cleanup job id: %',existing.jobid;
 end if;
end
$unschedule$;
commit;
