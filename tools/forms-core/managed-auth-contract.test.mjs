// Isolated privilege model, NOT a claim about any managed Supabase project.
import assert from 'node:assert/strict';
import {PGlite}from'../backend-tests/node_modules/@electric-sql/pglite/dist/index.js';
import {nativeDatabase}from'./native-database.mjs';
import {baseline,seed,as,call,create,definition,read,migration,catalog}from'./fixture.mjs';
const native=process.env.TEST_NATIVE_PG==='1',db=native?await nativeDatabase():new PGlite();let checks=0;
const ok=(x,m)=>{assert.ok(x,m);checks++;console.log('PASS '+m)};
const sql=read('tools/forms-core/fixtures/managed-auth-catalog.sql');
const metadata=async role=>(await db.query(sql.replace("select 'postgres'::text requested_role",`select '${role}'::text requested_role`))).rows[0].evidence;
try{
 await baseline(db);await db.exec(read('supabase/migrations/'+migration));const{org}=await seed(db);await as(db);const made=await call(db,org,'create',create('managed-owner-contract'));await db.exec('reset role');
 const snapshot=async()=>({catalog:await catalog(db),auth:(await db.query("select relowner::regrole::text owner,relacl::text acl,relrowsecurity rls,relforcerowsecurity forced from pg_class where oid='auth.users'::regclass")).rows[0],draft:(await db.query('select to_jsonb(x) v from platform_form_versions x where id=$1',[made.version.id])).rows[0].v,audits:(await db.query('select jsonb_agg(to_jsonb(x)order by id) v from platform_form_audit x')).rows[0].v});
 const before=await snapshot();const initial=await metadata('postgres');ok(initial.role_exists&&initial.auth_users_exists,'catalog identifies planned owner and Auth relation');ok(initial.installed_sensitive_owners.every(x=>x.owner==='postgres'),'sensitive owner metadata bound to expected role');
 // These are temporary fixture-only roles/ACLs and are rolled back before every outcome check.
 await db.exec("begin;create role forms_contract_reader nologin nosuperuser noinherit;grant usage on schema auth to forms_contract_reader;");
 let m=await metadata('forms_contract_reader');ok(!m.superuser&&!m.bypass_rls,'restricted fixture owner has no superuser or bypass');ok(!m.required_columns.id.select&&!m.any_column_update,'catalog detects missing SELECT and row-lock privilege');
 await db.exec('grant select on auth.users to forms_contract_reader');m=await metadata('forms_contract_reader');ok(Object.values(m.required_columns).every(x=>x.exists&&x.select),'catalog proves SELECT capability without reading Auth rows');ok(!m.table_update&&!m.any_column_update,'SELECT alone does not imply FOR SHARE capability');
 await db.exec('grant update(id) on auth.users to forms_contract_reader');m=await metadata('forms_contract_reader');ok(!m.table_update&&m.any_column_update,'catalog detects column-only UPDATE separately from broad table UPDATE');
 await db.exec('rollback');assert.deepEqual(await snapshot(),before);ok(true,'metadata fixture restores exact Auth ACL and application catalog');
 await db.exec("begin;create role forms_contract_reader nologin nosuperuser noinherit bypassrls;grant usage on schema public,private,auth to forms_contract_reader;grant select,update on platform_forms,platform_form_versions to forms_contract_reader;grant select on auth.users to forms_contract_reader;grant execute on function private.forms_lock(uuid)to forms_contract_reader;alter function private.forms_lock_authority(uuid,text,uuid)owner to forms_contract_reader;");
 m=await metadata('forms_contract_reader');ok(!m.any_column_update,'failure fixture intentionally lacks Auth row-lock privilege');ok(m.installed_sensitive_owners.some(x=>x.signature.includes('forms_lock_authority')&&x.owner==='forms_contract_reader'),'catalog detects changed sensitive runtime owner');
 await as(db);await assert.rejects(()=>call(db,org,'save',{id:made.form.id,revision:1,definition:definition()}),e=>e.code==='42501'&&/users/.test(e.message));ok(true,'SELECT-only managed-owner model fails at Auth row lock');await db.exec('rollback');assert.deepEqual(await snapshot(),before);ok(true,'failed lock leaves no draft revision audit ACL or ownership changes');
 ok((await db.query("select count(*)::int n from pg_roles where rolname='forms_contract_reader'")).rows[0].n===0,'all synthetic execution-owner state removed');
 const absent=await metadata('forms_contract_missing');ok(!absent.role_exists&&absent.superuser===null&&absent.table_update===null&&absent.any_column_update===null,'missing role is unknown rather than fabricated permission');
 await as(db);ok((await call(db,org,'save',{id:made.form.id,revision:1,definition:definition()})).version.revision===2,'unchanged original owner and canonical save still work');
 console.log('Forms managed Auth contract '+(native?'native PostgreSQL':'PGlite')+' PASS '+checks);
}finally{await db.close()}
