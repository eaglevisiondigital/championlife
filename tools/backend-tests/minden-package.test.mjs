// Full forward-body integration on a disposable local fixture. Exact production catalog
// is independently checked read-only; only the expected catalog literal is replaced here.
import assert from'node:assert/strict';import{decisionFixture,read,campaign}from'./minden-decision-v2.fixture.mjs';
let n=0;const ok=(v,m)=>{assert.ok(v,m);console.log('PASS '+(++n)+' '+m)};
const f=await decisionFixture(process.env.TEST_NATIVE_PG==='1',async({db,q})=>{
 await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;`);
 await db.exec(read('supabase/release/king-kind-reader-private-storage-candidate.sql'));await q("insert into storage.objects(bucket_id,name)values('king-kind-books','king-kind/king-kind-english.pdf')");
 await db.exec('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[])');
 for(const m of JSON.parse(read('docs/MINDEN-EXPECTED-PRODUCTION-CATALOG.json')).migrations)await q('insert into supabase_migrations.schema_migrations values($1,$2,$3)',[m.version,m.name,['SYNTHETIC LOCAL HISTORY ONLY']]);
 const preflight=read('supabase/release/minden-v2-production-preflight.sql'),actualQuery=preflight.slice(0,preflight.indexOf('select value=$minden_expected$'))+'select value from actual;',expected=(await q(actualQuery)).rows[0].value;
 const original=read('supabase/release/minden-v2-forward-candidate.sql'),local=original.replace(/\$minden_expected\$[\s\S]*?\$minden_expected\$/,'$minden_expected$'+JSON.stringify(expected)+'$minden_expected$');
 const changed=structuredClone(expected);changed.functions['SYNTHETIC_DRIFT()']='wrong';const bad=local.replace(/\$minden_expected\$[\s\S]*?\$minden_expected\$/,'$minden_expected$'+JSON.stringify(changed)+'$minden_expected$');
 await assert.rejects(()=>db.exec(bad),/catalog drift/);await db.exec('rollback');ok((await q("select to_regclass('private.minden_decision_receipts') x")).rows[0].x===null,'catalog mismatch leaves no partial schema');
 for(const table of['public.outreach_registrations','storage.objects']){await db.exec('alter table '+table+' disable row level security');await assert.rejects(()=>db.exec(local),/catalog drift/);await db.exec('rollback');await db.exec('alter table '+table+' enable row level security');ok(true,'exact guard rejects disabled RLS on '+table)}
 await db.exec(local);ok((await q('select public.minden_decision_config() v')).rows[0].v.enabled===false,'composed forward SQL installs atomically default OFF');
 await assert.rejects(()=>db.exec(local),/catalog drift|partial|already exists/);await db.exec('rollback');ok(true,'duplicate installer refuses before modifying state');
 return true;
});
try{
 const{db,q,as}=f;await db.exec('reset role');const before=(await q("select md5(string_agg(version||name,','order by version)) v from supabase_migrations.schema_migrations")).rows[0].v;
 const stop=(await q("select private.minden_decision_stop('SYNTHETIC disabled-package stop test') id")).rows[0].id;await q("select private.minden_decision_restore($1,'SYNTHETIC explicit exact-state restore')",[stop]);ok(true,'empty default-off stop/restore preserves absent runtime/source');
 await q("insert into outreach_decision_campaign_sources values($1,'minden_la_outreach',false,1)",[campaign]);await q('insert into private.minden_decision_runtime(campaign_id)values($1)',[campaign]);
 const id=(await q("select private.minden_decision_stop('SYNTHETIC retained runtime recovery test') id")).rows[0].id;await q('update private.minden_decision_runtime set revision=revision+1 where campaign_id=$1',[campaign]);await assert.rejects(()=>q("select private.minden_decision_restore($1,'SYNTHETIC deny drift overwrite')",[id]),/drift/);ok(true,'restore refuses any intervening runtime drift');await q('update private.minden_decision_runtime set revision=revision-1 where campaign_id=$1',[campaign]);await q("select private.minden_decision_restore($1,'SYNTHETIC exact restore after reviewed correction')",[id]);ok((await q('select enabled,reader_enabled from private.minden_decision_runtime')).rows.every(x=>!x.enabled&&!x.reader_enabled),'restore does not invent intake or reader activation');
 await as('owner');await assert.rejects(()=>q("select private.minden_decision_stop('SYNTHETIC forbidden staff stop')"),e=>e.code==='42501');ok(true,'staff owner cannot call release recovery primitives');
 await db.exec('reset role');ok((await q("select md5(string_agg(version||name,','order by version)) v from supabase_migrations.schema_migrations")).rows[0].v===before,'full installer and recovery never rewrite historical migration history');
 const policies=(await q("select with_check from pg_policies where schemaname='public' and tablename='outreach_registrations' and cmd='INSERT'")).rows;ok(policies.every(x=>!x.with_check.includes('minden')),'new schema adds no anonymous Minden REST policy');
 ok((await q('select count(*)::int n from private.outreach_team_notice_intents')).rows[0].n===0,'recovery cannot create status notification intents');
 console.log(n+' composed package/recovery checks passed ('+(process.env.TEST_NATIVE_PG==='1'?'native':'PGlite')+'); no production SQL executed');
}finally{await f.db.close()}
