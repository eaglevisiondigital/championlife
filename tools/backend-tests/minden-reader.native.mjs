// Fictional identities and disposable local PostgreSQL only; never accepts a hosted URL.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localPostgres } from './local-postgres.mjs';
const original=readFileSync('supabase/release/king-kind-reader-private-storage-candidate.sql','utf8');
const correction=readFileSync('supabase/release/minden-king-kind-reader-correction.sql','utf8');
const db=await localPostgres();let checks=0;
function equal(actual,expected,label){assert.deepEqual(actual,expected,label);checks++;console.log(`PASS ${checks}: ${label}`)}
const ids={minden:'11111111-1111-4111-8111-111111111111',bessemer:'22222222-2222-4222-8222-222222222222',huntsville:'33333333-3333-4333-8333-333333333333',unconfirmed:'44444444-4444-4444-8444-444444444444',unrelated:'55555555-5555-4555-8555-555555555555',withdrawn:'66666666-6666-4666-8666-666666666666',foreign:'77777777-7777-4777-8777-777777777777'};
async function visible(who,role='authenticated'){
 await db.exec(`set role ${role}`);
 try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[who]]);return(await db.query('select name from storage.objects order by name')).rows.map(r=>r.name)}finally{await db.exec('reset role')}
}
async function snapshot(){return(await db.query(`select jsonb_build_object('acl',(select proacl::text from pg_proc where oid='app_private.can_read_king_kind()'::regprocedure),'bucket',(select to_jsonb(b) from storage.buckets b where id='king-kind-books'),'policies',(select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname='storage' and tablename='objects'),'objects',(select jsonb_agg(to_jsonb(o) order by id) from storage.objects o),'rls',(select relrowsecurity from pg_class where oid='storage.objects'::regclass)) as snapshot`)).rows[0].snapshot}
async function denied(sql,role='authenticated') {await db.exec(`set role ${role}`);try{await assert.rejects(()=>db.exec(sql),e=>e.code==='42501');checks++;console.log(`PASS ${checks}: ${role} denied ${sql.split(' ').slice(0,4).join(' ')}`)}finally{await db.exec('reset role')}}
try{
 console.log((await db.query('select version()')).rows[0].version);
 await db.exec(readFileSync('tools/backend-tests/fixtures/supabase-test-bootstrap.sql','utf8'));
 await db.exec(`create table public.outreach_registrations(id uuid primary key default gen_random_uuid(),email text,consent boolean,source text);alter table public.outreach_registrations enable row level security;create schema storage;grant usage on schema storage to authenticated,anon;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select on storage.objects to authenticated,anon;`);
 await db.exec(original);
 for(const [name,id]of Object.entries(ids))await db.query('insert into auth.users(id,email,email_confirmed_at)values($1,$2,$3)',[id,`${name}@example.invalid`,name==='unconfirmed'?null:'2026-11-13T00:00:00Z']);
 for(const [name,source,consent]of [['minden','minden_la_outreach',true],['bessemer','bessemer_al_2026',true],['huntsville','huntsville_al_2026',true],['unconfirmed','minden_la_outreach',true],['withdrawn','minden_la_outreach',false],['foreign','another_city',true]])await db.query('insert into public.outreach_registrations(email,source,consent)values($1,$2,$3)',[`${name}@example.invalid`,source,consent]);
 await db.exec("insert into storage.objects(bucket_id,name)values('king-kind-books','king-kind/king-kind-english.pdf'),('king-kind-books','other-private.pdf'),('another-bucket','king-kind/king-kind-english.pdf')");
 equal(await visible('minden'),[],'original policy reproduces Minden denial');
 const before=await snapshot();await db.exec(correction);equal(await snapshot(),before,'ACL, policies, private bucket, RLS and records unchanged');
 for(const name of ['minden','bessemer','huntsville'])equal(await visible(name),['king-kind/king-kind-english.pdf'],`${name} verified registration reads exact book only`);
 for(const name of ['unconfirmed','unrelated','withdrawn','foreign'])equal(await visible(name),[],`${name} denied`);
 equal(await visible('minden','anon'),[],'anonymous denied');
 await db.exec("update auth.users set email='different@example.invalid' where id='11111111-1111-4111-8111-111111111111'");equal(await visible('minden'),[],'different authenticated email denied');
 await db.exec("update auth.users set email='minden@example.invalid' where id='11111111-1111-4111-8111-111111111111';update public.outreach_registrations set consent=false where source='minden_la_outreach'");equal(await visible('minden'),[],'withdrawn Minden consent immediately denied');
 await denied('select * from public.outreach_registrations');await denied("insert into storage.objects(bucket_id,name)values('king-kind-books','evil.pdf')");await denied("update storage.objects set name='evil.pdf'");await denied('delete from storage.objects');await denied('select app_private.can_read_king_kind()','anon');
 await assert.rejects(()=>db.exec(correction),/authority definition\/ACL drift/);await db.exec('rollback');checks++;console.log(`PASS ${checks}: repeated correction fails closed`);
 await db.exec(original);
 for(const [label,sql]of [['function language',"update pg_proc set prolang=(select oid from pg_language where lanname='plpgsql') where oid='app_private.can_read_king_kind()'::regprocedure"],['public bucket',"update storage.buckets set public=true"],['service execution',"grant execute on function app_private.can_read_king_kind() to service_role"],['broadened policy',"alter policy king_kind_registered_outreach_read on storage.objects using(true)"],['disabled RLS','alter table storage.objects disable row level security'],['extra policy','create policy extra on storage.objects for select to authenticated using(true)']]){await db.exec('begin');await db.exec(sql);await assert.rejects(()=>db.exec(correction.replace(/^begin;$/m,'').replace(/^commit;$/m,'')),/drift/);await db.exec('rollback');checks++;console.log(`PASS ${checks}: rejects ${label} drift`)}
 const oldBody=(await db.query("select prosrc from pg_proc where oid='app_private.can_read_king_kind()'::regprocedure")).rows[0].prosrc;
 await db.exec('begin');await db.exec(correction.replace(/^begin;$/m,'').replace(/^commit;$/m,''));await db.exec('rollback');equal((await db.query("select prosrc from pg_proc where oid='app_private.can_read_king_kind()'::regprocedure")).rows[0].prosrc,oldBody,'transaction rollback restores original function');
 console.log(`NATIVE PASS: ${checks} checks; no hosted acceptance`);
}finally{await db.close()}
