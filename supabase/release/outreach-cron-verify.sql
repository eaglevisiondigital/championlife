-- READ ONLY. Expect exactly one active local postgres job with the exact contract.
select jobid,jobname,schedule,command,database,username,nodename,nodeport,active,
       schedule='*/5 * * * *' and command='select private.outreach_abuse_cleanup()'
       and database='postgres' and username='postgres' and nodename='localhost'
       and nodeport=current_setting('port')::integer and active as expected_contract
from cron.job where jobname='outreach-abuse-cleanup';

-- Wait for an actual scheduled run at release; catalog presence is not run success.
select d.jobid,d.runid,d.status,d.return_message,d.start_time,d.end_time
from cron.job_run_details d join cron.job j on j.jobid=d.jobid
where j.jobname='outreach-abuse-cleanup' order by d.runid desc limit 10;

-- Retention is approximately 24h from window start, with bounded backlog removal.
select count(*) as retained_windows,
       count(*) filter(where window_ends_at<clock_timestamp()-interval '23 hours') as cleanup_backlog,
       min(window_ends_at) as oldest_window_end
from private.outreach_abuse_windows;

select role_name,has_function_privilege(role_name,'private.outreach_abuse_cleanup()','execute') as can_execute
from (values ('anon'),('authenticated'),('service_role')) roles(role_name);
