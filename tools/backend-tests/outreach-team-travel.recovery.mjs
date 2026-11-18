// Guard/replay acceptance, entirely synthetic and in-memory.
import{PGlite}from'@electric-sql/pglite';import{readFileSync}from'node:fs';import assert from'node:assert/strict';import{migrationOrder}from'./migration-order.mjs';import{candidate}from'./outreach-team-travel.fixture.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8'),db=new PGlite();let n=0;
const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)};
try{
 await db.exec(read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));await db.exec(read('supabase/bootstrap/automatic-rls.sql'));for(const f of migrationOrder)await db.exec(read('supabase/migrations/'+f));await db.exec(read('supabase/release/dream-track-v1-forward-candidate.sql'));
 await assert.rejects(()=>db.exec(candidate),/prerequisites missing/);await db.exec('rollback');ok(!(await db.query("select to_regclass('public.outreach_team_members') v")).rows[0].v,'missing P0 dependency stops before creating Team tables');
 await db.exec(read('tools/backend-tests/fixtures/outreach-volunteer-p0-contract.sql'));
 const definition=(await db.query("select pg_get_functiondef('private.staff_assignment_active(uuid,uuid)'::regprocedure) v")).rows[0].v;
 await db.exec("create or replace function private.staff_assignment_active(p_org uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$select true$$");
 await assert.rejects(()=>db.exec(candidate),/security helper drift/);await db.exec('rollback');ok(!(await db.query("select to_regclass('public.outreach_team_members') v")).rows[0].v,'weakened staff helper stops before creating Team tables');await db.exec(definition);
 const constraint=(await db.query("select pg_get_constraintdef(oid) v from pg_constraint where conrelid='outreach_campaign_assignments'::regclass and conname='outreach_campaign_assignments_capabilities_check'")).rows[0].v;
 await db.exec('alter table public.outreach_campaign_assignments drop constraint outreach_campaign_assignments_capabilities_check;alter table public.outreach_campaign_assignments add constraint outreach_campaign_assignments_capabilities_check check(true)');
 await assert.rejects(()=>db.exec(candidate),/campaign assignment contract drift/);await db.exec('rollback');
 ok(!(await db.query("select to_regclass('public.outreach_team_members') v")).rows[0].v,'changed campaign capability constraint stops before replacement or Team table creation');
 await db.exec('alter table public.outreach_campaign_assignments drop constraint outreach_campaign_assignments_capabilities_check;alter table public.outreach_campaign_assignments add constraint outreach_campaign_assignments_capabilities_check '+constraint);
 await db.exec('create table public.outreach_team_vehicles(synthetic int)');await assert.rejects(()=>db.exec(candidate),/partial schema/);await db.exec('rollback');await db.exec('drop table public.outreach_team_vehicles');ok(true,'partial historical installation is refused');
 await db.exec(candidate);ok((await db.query("select count(*)::int n from pg_class where relname like 'outreach_team_%' and relkind='r'")).rows[0].n===6,'fresh candidate installs six bounded tables');
 const rls=(await db.query("select bool_and(relrowsecurity) v from pg_class where relname like 'outreach_team_%' and relkind='r'")).rows[0].v;ok(rls,'every new table enables RLS');
 const acl=(await db.query("select count(*)::int n from information_schema.table_privileges where grantee in('PUBLIC','anon','authenticated') and table_name like 'outreach_team_%'")).rows[0].n;ok(acl===0,'zero raw client table grants');
 const helpers=(await db.query("select count(*)::int n from information_schema.routine_privileges where routine_schema='private' and routine_name like 'outreach_team_%' and grantee in('PUBLIC','anon','authenticated') and routine_name not in('outreach_team_workspace','outreach_team_own')")).rows[0].n;ok(helpers===0,'internal helper execution remains private');
 const grants=(await db.query('select count(*)::int n from organization_staff_permissions')).rows[0].n;ok(grants===0,'candidate provisions no staff permission');
 await assert.rejects(()=>db.exec(candidate),/already present/);await db.exec('rollback');ok(true,'repeat application refused without rewriting history');
 console.log(n+' Team/travel recovery guard checks passed');
}finally{await db.close()}
