-- UNAPPLIED. Stop future P1 notice attempts/lookups; preserve receipt ingestion,
-- report authority, immutable history/dedupe and all P0/shared systems.
begin;
set local lock_timeout='5s';
do $$begin
 if to_regclass('private.outreach_team_notice_runtime') is null
 or to_regprocedure('private.outreach_team_notice_worker(text,uuid,jsonb)') is null then
  raise exception 'Complete reviewed notice installation required';end if;
 if md5(pg_get_functiondef('private.outreach_team_notice_worker(text,uuid,jsonb)'::regprocedure))
 is distinct from '187c9cbb53df69de21d4ff52bca4eee4' then raise exception 'Notice worker drift; review this stop version';end if;
end $$;
update private.outreach_team_notice_runtime set enabled=false,lookup_enabled=false where singleton;
-- A POST already in flight cannot be recalled. Preserve its actual outcome.
-- Do not drop evidence, rotate a provider key or replay the installer.
commit;
