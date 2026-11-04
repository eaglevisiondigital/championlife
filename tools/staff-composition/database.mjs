// Disposable actual-source integration. No hosted URL, grants or historical installation are executed.
import assert from 'node:assert/strict';
import {PGlite} from '../backend-tests/node_modules/@electric-sql/pglite/dist/index.js';
import {baseline,seed,as,call,create,id,catalog} from '../forms-core/fixture.mjs';
import {source} from './source.mjs';
import {nativeDatabase} from '../forms-core/native-database.mjs';
const sql={forms:source('forms','supabase/migrations/20261104042117_forms_private_draft_core.sql').toString(),events:source('events','tools/church-events/fixtures/20260928183137_events_calendar_v1.sql').toString()};
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
const native=process.env.TEST_NATIVE_PG==='1';
const requested=process.env.COMPOSITION_ORDER;
if(native)assert.ok(['forms,events','events,forms'].includes(requested),'Native CI needs one exact order and its own empty loopback database');
const orders=requested?[requested.split(',')]:[['forms','events'],['events','forms']];
for(const order of orders){
 assert.ok(['forms,events','events,forms'].includes(order.join(',')),'Unknown composition order');
 const db=native?await nativeDatabase():new PGlite(),label=order.join('→');
 const denied=async(fn,m)=>{await assert.rejects(fn,e=>e.code==='42501');ok(true,label+' '+m)};
 try{
 await baseline(db);const before=await catalog(db);const baselineKeys=(await db.query('select private.staff_permission_keys() keys')).rows[0].keys;ok(before.tables.filter(x=>x.schema==='public').length===49&&before.functions.length===76&&before.policies.length===64,label+' exact accepted baseline');
 await db.exec(sql[order[0]]);const first=await catalog(db);await db.exec(sql[order[1]]);const combined=await catalog(db);
 for(const [stage,snapshot] of [['baseline',before],['first-module',first]]){
 for(const group of['tables','policies']){for(const old of snapshot[group])assert.ok(combined[group].some(x=>JSON.stringify(old)===JSON.stringify(x)));ok(true,label+' '+stage+' '+group+' owners/ACL/RLS preserved')}
 for(const old of snapshot.functions.filter(x=>x.name!=='staff_permission_keys'))assert.ok(combined.functions.some(x=>JSON.stringify(old)===JSON.stringify(x)));ok(true,label+' '+stage+' functions byte-identical except declared registry');
 }
 ok(combined.tables.filter(x=>x.schema==='public').length===64,label+'49 baseline +8 public Forms +7 public Events; private Forms grant table separate');
 assert.deepEqual((await db.query('select private.staff_permission_keys() keys')).rows[0].keys.sort(),[...new Set([...baselineKeys,'forms.read','forms.create','forms.edit'])].sort());ok(true,label+' exact declared permission registry union; no Events or financial additions');
 const{org,other}=await seed(db);
 await db.exec('reset role');await db.query('delete from organization_staff_permissions where user_id=$1',[id(2)]);
 for(const user of[2,3]){await db.query("insert into organization_staff_directory(organization_id,user_id,display_name) values($1,$2,'Synthetic second organization')",[other,id(user)]);await db.query("insert into organization_staff_permissions(organization_id,user_id,permission) values($1,$2,'events.manage')",[other,id(user)])}
 await db.query("insert into organization_staff_permissions(organization_id,user_id,permission) values($1,$2,'forms.read')",[org,id(3)]);
 const events=async(o,action,p={})=>(await db.query('select public.events_workspace($1,$2,$3) v',[o,action,JSON.stringify(p)])).rows[0].v;
 await as(db,1);const form=(await call(db,org,'create',create('composition-private'))).form.id;
 await denied(()=>events(org,'list'),'Forms directory permissions do not confer Events access');await denied(()=>events(other,'list'),'Forms permission cannot cross organization into Events');
 await as(db,2);const event=await events(other,'save',{title:'Synthetic other organization event',local_start:'2026-12-01T10:00',local_end:'2026-12-01T11:00',visibility:'staff',status:'draft'});
 ok(event.organization_id===other&&event.status==='draft',label+' original Events draft transaction remains functional');await denied(()=>call(db,org,'get',{id:form}),'Events authority does not confer Forms access');
 await as(db,3);ok((await call(db,org,'get',{id:form})).form.id===form,label+' combined account retains independently granted Forms read');ok((await events(other,'detail',{id:event.id})).series.id===event.id,label+' combined account retains separately scoped Events access');
 await denied(()=>call(db,other,'get',{id:form}),'shared identity does not cross Forms organization');await denied(()=>events(org,'detail',{id:event.id}),'shared identity does not cross Events organization');
 const formsCtx=await call(db,null,'context');ok(formsCtx.organizations.every(x=>x.id===org),label+' Forms discovery does not inherit Events organization');
 const staffCtx=(await db.query('select public.staff_workspace_context() v')).rows[0].v;ok(staffCtx.grants.filter(x=>x.permission.startsWith('events.')).every(x=>x.organization_id===other),label+' shared staff discovery retains exact Events organization provenance');
 await db.exec('reset role');await db.query("update organization_staff_permissions set revoked_at=clock_timestamp() where organization_id=$1 and user_id=$2 and permission='events.manage'",[other,id(3)]);await as(db,3);
 await denied(()=>events(other,'list'),'Events revocation immediately enforced');ok((await call(db,org,'get',{id:form})).form.id===form,label+' Events revocation does not destroy independent Forms authority');
 await db.exec('reset role');await db.query("update organization_staff_permissions set revoked_at=clock_timestamp() where organization_id=$1 and user_id=$2 and permission='forms.read'",[org,id(3)]);await as(db,3);await denied(()=>call(db,org,'get',{id:form}),'Forms revocation immediately enforced');
 await as(db,1);await denied(()=>db.query('select * from public.event_series'),'Forms worker has no raw Events access');await as(db,2);await denied(()=>db.query('select * from public.platform_form_versions'),'Events worker has no raw Forms access');
 await db.exec('reset role');ok((await db.query("select count(*)::int n from public.platform_form_audit")).rows[0].n===1,label+' rejected mixed-scope requests produce no successful Forms audit');ok((await db.query("select count(*)::int n from public.event_audit")).rows[0].n===1,label+' rejected mixed-scope requests produce no successful Events audit');
 for(const table of['giving_sessions','giving_ledger','platform_form_submissions'])assert.equal((await db.query('select to_regclass($1) v',['public.'+table])).rows[0].v,null);ok(true,label+' no Giving or submission dependency placeholders');
 }finally{await db.close()}
}
console.log('Forms+Events actual-source '+(native?'native PostgreSQL':'PGlite')+' composition PASS '+checks);
