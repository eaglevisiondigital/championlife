// Disposable PG17 catalog probe. No seeded accounts/people/tasks or positive privileged RPCs.
import assert from 'node:assert/strict';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {loadSource,sourceManifest} from './source.mjs';
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);console.log('PASS',++checks,label)};
const db=await localPostgres();
const catalog=async()=> (await db.query(`select jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'owner',p.proowner::regrole::text,'acl',p.proacl::text)order by p.oid::regprocedure::text)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','app_private')and p.prokind='f'),
 'relations',(select jsonb_agg(jsonb_build_object('name',c.oid::regclass::text,'owner',c.relowner::regrole::text,'acl',c.relacl::text,'rls',c.relrowsecurity)order by c.oid::regclass::text)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private','app_private','storage')and c.relkind='r'),
 'policies',(select jsonb_agg(to_jsonb(p)order by schemaname,tablename,policyname)from pg_policies p),
 'triggers',(select jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)order by t.oid)from pg_trigger t where not t.tgisinternal)) v`)).rows[0].v;
const core=async()=> (await db.query(`select jsonb_build_object('functions',(select jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'def',pg_get_functiondef(p.oid),'acl',p.proacl::text,'owner',p.proowner::regrole::text)order by p.oid::regprocedure::text)from pg_proc p where p.oid=any(array['private.has_staff_permission(uuid,text,uuid)'::regprocedure,'private.staff_assignment_active(uuid,uuid)'::regprocedure,'private.guard_followup_task()'::regprocedure,'private.audit_followup_task()'::regprocedure,'private.cancel_changed_workflow_notification()'::regprocedure])), 'triggers',(select jsonb_agg(jsonb_build_object('def',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)order by t.tgname)from pg_trigger t where t.tgrelid='public.followup_tasks'::regclass and not t.tgisinternal)) v`)).rows[0].v;
async function denied(sql,params,pattern,label){let error;try{await db.query(sql,params)}catch(e){error=e}assert(error,label+' must reject');assert.match(error.message,pattern);assert.equal(error.code,/^select public\./.test(sql)?'42501':'P0001');console.log('PASS',++checks,label,error.code,error.message)}
try{
 eq(Math.floor(Number((await db.query('show server_version_num')).rows[0].server_version_num)/10000),17,'exact native PostgreSQL major17');
 await db.exec(loadSource('bootstrap'));
 // Exact accepted Forms baseline environment, with synthetic Storage catalog only.
 await db.exec(`alter default privileges in schema public grant truncate,references,trigger,maintain on tables to anon,authenticated,service_role;alter default privileges in schema public revoke execute on functions from public,anon,authenticated,service_role;create schema storage;grant usage on schema storage to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select on storage.objects to anon,authenticated;`);
 await db.exec(loadSource('automaticRls'));
 const base=sourceManifest.sources.filter(r=>/^baseline\d+$/.test(r.id));eq(base.length,26,'exact current main baseline count');for(const row of base)await db.exec(loadSource(row.id));
 await db.exec(loadSource('acceptedReader'));
 const before=await core();
 for(const id of ['formsSql','dreamSql','eventsSql']){
  try{await db.exec(loadSource(id))}catch(e){console.log('CATALOG_COMPATIBILITY_REJECTED',id,e.code,e.message);await db.exec('rollback');throw e}
  eq(await core(),before,id+' leaves canonical task and authority definitions/ACL/triggers unchanged');
 }
 eq((await db.query("select count(*)::int n from auth.users")).rows[0].n,0,'no synthetic identity inserted');
 eq((await db.query("select count(*)::int n from public.followup_tasks")).rows[0].n,0,'no canonical task inserted');
 const snapshots=await catalog();
 for(const [id,pattern]of [['formsSql',/Forms exists/],['dreamSql',/Staff permission registry drift/],['eventsSql',/Events exists or is partial/]]){
  await denied(loadSource(id),[],pattern,id+' refuses replay against composed catalog');await db.exec('rollback');eq(await catalog(),snapshots,id+' replay failure leaves complete observed catalog unchanged');
 }
 const org=(await db.query("select id from organizations where slug='champion-life'")).rows[0].id;
 for(const actor of ['', '77000000-0000-4000-8000-000000000001']){
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);await db.exec('set role authenticated');
  await denied('select public.forms_workspace($1,$2,$3)',['list',org,'{}'],/verified|denied|authentication|sign.in|Staff assignment unavailable/i,'Forms rejects '+(actor?'unbacked identity':'missing identity'));
  await denied('select public.dream_team_manual_followup($1,$2,$3)',[org,'list','{}'],/verified|denied|authentication|sign.in|Staff assignment unavailable/i,'Dream rejects '+(actor?'unbacked identity':'missing identity'));
  await denied('select public.events_workspace($1,$2,$3)',[org,'list','{}'],/denied/i,'Events rejects '+(actor?'unbacked identity':'missing identity'));
  await db.exec('reset role');
 }
 eq(await catalog(),snapshots,'denied cross-module RPCs leave catalog unchanged');
 for(const table of ['platform_forms','platform_form_audit','event_series','event_audit','followup_tasks','followup_task_events']){
  eq((await db.query('select count(*)::int n from public.'+table)).rows[0].n,0,table+' remains empty');
 }
 console.log('SUMMARY PASS',checks,'catalog/negative checks; no account or operational integration acceptance');
}finally{await db.close()}
