-- UNINSTALLED incident recovery action for the exact reviewed P1 release only.
-- Confirm target project/source/current catalog before any hosted execution.
-- Stop P1 RPC access without deleting records/history or changing other modules.
begin;
do $$begin
 if to_regclass('public.outreach_team_members') is null
 or to_regprocedure('public.outreach_team_workspace(text,uuid,jsonb)') is null
 or to_regprocedure('public.outreach_team_own(uuid)') is null then
  raise exception 'Complete reviewed P1 installation required before stopping access';
 end if;
end $$;
revoke execute on function public.outreach_team_workspace(text,uuid,jsonb),
 private.outreach_team_workspace(text,uuid,jsonb),public.outreach_team_own(uuid),
 private.outreach_team_own(uuid) from public,anon,authenticated;
commit;
