import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createHash,randomUUID as uuid} from 'node:crypto';
import {database,read} from './unified-outreach.fixture.mjs';import {buildSite} from '../site-build/build.mjs';
const manifest=JSON.parse(read('docs/UNIFIED-OUTREACH-SOURCE-INVENTORY.json'));
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m);};
for(const f of manifest.protectedFiles)ok(createHash('sha256').update(readFileSync(new URL('../../'+f.path,import.meta.url))).digest('hex')===f.sha256,'production bytes '+f.path);
const productionBaseline=JSON.parse(read('docs/UNIFIED-OUTREACH-PRODUCTION-BASELINE.json'));for(const f of productionBaseline.migrations){let sql=read('supabase/migrations/'+f.sourceFile);if(f.sourceNormalization==='trim-final-newline')sql=sql.replace(/\n$/,'');ok(createHash('md5').update(sql).digest('hex')===f.sql_md5,'live production migration SQL '+f.version);}
const blocked=await buildSite({env:{CONTEXT:'branch-deploy',BRANCH:'codex/unified-outreach-production-v1',CHAMPION_PREVIEW_SUPABASE_URL:'https://niyovbgoalulzkhbvebt.supabase.co',CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic'}});ok(blocked.backend==='blocked'&&read('dist/assets/js/supabase-config.js').includes('window.CHAMPION_LIFE_SUPABASE = null'),'candidate preview refuses old shared target and fails closed until pinned');
let baselineFunctions,sourceBefore;
const source=async db=>(await db.query("select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') v from outreach_registrations r")).rows[0].v;
const registrationFunctions=async db=>(await db.query("select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' name,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like 'outreach_registration_%' order by 1")).rows;
const db=await database(async db=>{
 baselineFunctions=await registrationFunctions(db);
 for(const [decision,total] of [['salvation',14],['rededication',9],['learn_more',7],['prayer_followup',18]])for(let i=0;i<total;i++)await db.query("insert into outreach_registrations(first_name,last_name,email,phone,decision,prayer_request,consent,source)values($1,'Synthetic','synthetic@example.test','+15555550100',$2,$3,true,'bessemer_al_2026')",['Synthetic '+uuid(),decision,'Original immutable '+uuid()]);
 sourceBefore=await source(db);
});
try{
 assert.deepEqual(await source(db),sourceBefore);ok(true,'all 48 synthetic source records byte-equivalent after forward chain');
 assert.deepEqual(await registrationFunctions(db),baselineFunctions);ok(true,'every production registration function definition unchanged');
 ok((await db.query('select count(*)::int n from outreach_campaign_registrants')).rows[0].n===48,'canonical bridge includes 48 without copying contact fields');
 ok((await db.query('select count(*)::int n from outreach_campaign_assignments')).rows[0].n===0,'migration creates no real or synthetic user grants');
 ok((await db.query('select count(*)::int n from outreach_partner_users')).rows[0].n===0,'migration creates no partner grants');
 ok((await db.query("select count(*)::int n from pg_tables where schemaname='public' and tablename like 'outreach_%' and not rowsecurity")).rows[0].n===0,'every Outreach public table has RLS');
 console.log(n+' unified integration checks passed');
}finally{await db.close();}
