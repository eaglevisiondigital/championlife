// Local synthetic claims/Storage schema, not hosted Auth or provider acceptance.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID as uuid} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {localPostgres} from './local-postgres.mjs';
import {migrationOrder} from './migration-order.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const native=process.env.TEST_NATIVE_PG==='1',db=native?await localPostgres():new PGlite();
const q=(s,a=[])=>db.query(s,a);let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
const as=async(id,role='authenticated',connection=db)=>{await connection.query('reset role');await connection.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await connection.query('set role '+role)};
const denied=async(fn,m,code='42501')=>{await assert.rejects(fn,e=>e.code===code);ok(true,m)};
const call=(action,payload={},connection=db)=>connection.query('select public.general_resource_registration($1,$2) v',[action,payload]).then(r=>r.rows[0].v);
const ids=Array.from({length:9},()=>uuid()),[alice,bob,unverified,anonymous,legacyH,legacyB,unknown,concurrent,atomic]=ids;
const payload=(id,overrides={})=>({request_id:uuid(),name:'Fictional Reader',email:id+'@example.test',resource_consent:true,consent_version:'general-resources-v1',...overrides});
const book=async()=> (await q('select name from storage.objects order by name')).rows.map(r=>r.name);
const count=async table=>(await q('select count(*)::int n from '+table)).rows[0].n;
try{
 await db.exec(read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));
 await db.exec(read('supabase/bootstrap/automatic-rls.sql'));
 for(const f of migrationOrder)await db.exec(read('supabase/migrations/'+f));
 await db.exec(`create schema storage;grant usage on schema storage to authenticated,anon;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;grant select on storage.objects to authenticated,anon;`);
 await db.exec(read('supabase/release/king-kind-reader-private-storage-candidate.sql'));
 const policyBefore=(await q("select qual from pg_policies where policyname='king_kind_registered_outreach_read'")).rows[0].qual;
 await db.exec(read('supabase/release/general-king-kind-resources-candidate.sql'));
 ok(policyBefore===(await q("select qual from pg_policies where policyname='king_kind_registered_outreach_read'")).rows[0].qual,'Storage RLS exact object policy unchanged');
 for(const id of ids)await q('insert into auth.users(id,email,email_confirmed_at,is_anonymous)values($1,$2,$3,$4)',[id,id+'@example.test',id===unverified?null:new Date(),id===anonymous]);
 for(const [id,source]of[[legacyH,'huntsville_al_2026'],[legacyB,'bessemer_al_2026']])await q("insert into outreach_registrations(first_name,last_name,email,source,consent,phone,decision)values('Fictional','Legacy',$1,$2,true,'5555550100','learn_more')",[id+'@example.test',source]);
 await q("insert into storage.objects(bucket_id,name)values('king-kind-books','king-kind/king-kind-english.pdf'),('king-kind-books','unrelated-private.pdf'),('other-private','king-kind/king-kind-english.pdf')");
 // Snapshot whole legacy rows (synthetic only) including signatures/history when present.
 const tables=(await q("select tablename from pg_tables where schemaname='public' and (tablename like '%registration%' or tablename like '%waiver%' or tablename in ('lesson_progress','course_enrollments','profiles','organization_staff_permissions'))")).rows.map(r=>r.tablename);
 const snapshot=async()=>{const result={};for(const t of tables)result[t]=(await q(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') v from public.${t} t`)).rows[0].v;return result};
 const before=await snapshot();
 for(const id of [legacyH,legacyB]){await as(id);ok((await book()).join()==='king-kind/king-kind-english.pdf','legacy outreach reader retained');}
 for(const id of[unknown,unverified,anonymous]){await as(id);ok((await book()).length===0,'unregistered/unverified/anonymous identity has no book');}
 await as(null,'anon');await denied(()=>call('register',payload(alice)),'anonymous RPC denied');
 for(const id of[unverified,anonymous]){await as(id);await denied(()=>call('register',payload(id)),'unverified or anonymous Auth identity denied');}
 await as(alice);ok(!(await call('status')).registered,'unregistered status honest');
 for(const [change,label]of[[{resource_consent:false},'required consent'],[{resource_consent:'true'},'string consent'],[{email:bob+'@example.test'},'other verified email'],[{name:' '},'empty name'],[{phone:'not-a-phone'},'invalid telephone'],[{campaign_id:uuid()},'campaign injection'],[{user_id:bob},'actor injection'],[{ministry_updates:'true'},'marketing coercion'],[{prayer:{text:'invalid'}},'nontext prayer'],[{interest:'salvation'},'fabricated decision'],[{request_id:'invalid'},'invalid idempotency key']])await denied(()=>call('register',payload(alice,change)),label+' rejected','22023');
 const original=payload(alice,{prayer:'Private synthetic prayer'}),first=await call('register',original);
 ok(first.registered&&!first.existing,'verified general registration accepted');
 ok((await call('register',original)).reference===first.reference,'same-request retry returns same receipt');
 ok((await call('register',payload(alice,{ministry_updates:true}))).reference===first.reference,'reload retry cannot duplicate or change consent');
 ok((await call('status')).reference===first.reference,'own safe status receipt');
 ok((await book()).join()==='king-kind/king-kind-english.pdf','general registrant can retrieve only approved private object');
 await denied(()=>q('select * from app_private.general_resource_registrations'),'direct personal/contact/prayer enumeration denied');
 await denied(()=>q('select * from app_private.general_resource_audit'),'audit enumeration denied');
 await denied(()=>q("update app_private.general_resource_registrations set revoked_at=null"),'self-restoration denied');
 await denied(()=>q("insert into storage.objects(bucket_id,name)values('king-kind-books','write.pdf')"),'Storage writes denied');
 await denied(()=>call('status',{user_id:bob}),'status cannot target another identity','22023');
 await as(bob);ok(!(await call('status')).registered,'other identity cannot see receipt');
 await denied(()=>call('register',payload(bob,{request_id:original.request_id})),'cross-account request collision denied','22023');
 ok((await call('register',payload(bob,{phone:'+1 (555) 555-0100',interest:'discipleship',ministry_updates:true}))).registered,'optional phone and separate ministry consent accepted');
 await db.exec('reset role');
 ok(await count('app_private.general_resource_registrations')===2,'only two identities persisted');
 ok(await count('app_private.general_resource_audit')===2,'one immutable attributable audit per identity');
 const row=(await q('select * from app_private.general_resource_registrations where user_id=$1',[alice])).rows[0];
 ok(!row.ministry_updates&&row.phone===''&&row.interest==='','omitted optional fields remain empty / marketing false');
 ok((await q('select actor_id from app_private.general_resource_audit where registration_id=$1',[row.id])).rows[0].actor_id===alice,'audit actor is verified caller');
 await denied(()=>q("update app_private.general_resource_audit set action='registered'"),'immutable audit update denied');
 await denied(()=>q('delete from app_private.general_resource_audit'),'immutable audit delete denied');
 // Deliberate audit failure must roll back registration too.
 await db.exec("create function public.fail_resource_audit()returns trigger language plpgsql as $$begin raise exception 'synthetic audit failure';end$$;create trigger test_audit_failure before insert on app_private.general_resource_audit for each row execute function public.fail_resource_audit()");
 await as(atomic);await assert.rejects(()=>call('register',payload(atomic)));await db.exec('reset role');
 ok(!(await q('select 1 from app_private.general_resource_registrations where user_id=$1',[atomic])).rows.length,'audit failure rolls back registration atomically');
 await db.exec('drop trigger test_audit_failure on app_private.general_resource_audit;drop function public.fail_resource_audit()');
 if(native){
  const clients=await Promise.all(Array.from({length:6},()=>db.connect()));
  await Promise.all(clients.map(c=>as(concurrent,'authenticated',c)));
  const p=payload(concurrent),results=await Promise.all(clients.map(c=>call('register',p,c)));
  ok(new Set(results.map(r=>r.reference)).size===1,'six real concurrent connections produce one receipt');
  ok((await q('select count(*)::int n from app_private.general_resource_audit where actor_id=$1',[concurrent])).rows[0].n===1,'concurrent retries create exactly one audit');
 }
 await q('update app_private.general_resource_registrations set revoked_at=now()where user_id=$1',[alice]);
 await as(alice);ok((await book()).length===0,'revocation denies new Storage access');ok(!(await call('status')).registered,'revoked status hides receipt');await denied(()=>call('register',original),'retry cannot restore revoked access');
 await as(null);await denied(()=>call('status'),'cleared subject denied');
 await db.exec('reset role');assert.deepEqual(await snapshot(),before);ok(true,'all legacy registration/waiver/staff/course rows unchanged');
 ok(!(await q("select public from storage.buckets where id='king-kind-books'")).rows[0].public,'bucket remains private');
 const retained=await count('app_private.general_resource_registrations'),audited=await count('app_private.general_resource_audit');
 await db.exec(read('supabase/release/general-king-kind-resources-containment.sql'));
 await as(bob);await denied(()=>call('status'),'containment disables public RPC');await denied(()=>q("select app_private.general_resource_registration('status','{}')"),'containment disables direct helper');ok((await book()).length===0,'containment stops new general book URLs');
 for(const id of[legacyH,legacyB]){await as(id);ok((await book()).length===1,'containment preserves legacy reader access');}
 await db.exec('reset role');ok(await count('app_private.general_resource_registrations')===retained&&await count('app_private.general_resource_audit')===audited,'containment preserves all new records/audits');
 console.log(`${checks} general resource database/security checks passed (${native?'native PostgreSQL':'PGlite'}); genuine Auth/Storage UNTESTED.`);
}finally{await db.close()}
