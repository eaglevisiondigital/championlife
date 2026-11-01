// Disposable Unix-socket PostgreSQL only. Existing SQL and worker, fictional sink.
import assert from 'node:assert/strict';
import {execFileSync,execFile} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {migrationOrder} from '../backend-tests/migration-order.mjs';
import {f,h,fixtureSQL,activationFixtureSQL} from '../backend-tests/activation-fixture.mjs';
import {runExternalWorker} from '../../supabase/functions/_shared/communications/activation.mjs';

const bin=process.env.TEST_POSTGRES_BIN||'/opt/homebrew/opt/postgresql@17/bin';
const root=mkdtempSync(join(tmpdir(),'comm-receipt-reconciliation-')),data=join(root,'data'),socket=join(root,'socket');
mkdirSync(socket);
const exe=n=>join(bin,n),port='55503';
const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',socket,'-p',port,'-U','postgres','postgres'];
const sql=s=>execFileSync(exe('psql'),args,{input:s,encoding:'utf8',maxBuffer:5e6,stdio:['pipe','pipe','pipe']}).trim();
const lit=s=>"'"+String(s).replaceAll("'","''")+"'";
let started=false,checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
const rejects=async(fn,label)=>{await assert.rejects(fn);checks++;console.log('PASS '+label)};
const worker=(action,payload={})=>JSON.parse(sql(`set role service_role;select communications_provider_service(${lit(action)},'${f.org}',${lit(JSON.stringify(payload))});`));
const staff=(action,payload={})=>JSON.parse(sql(`set request.jwt.claim.sub='${f.user}';set role authenticated;select communications_provider_workspace(${lit(action)},'${f.org}',${lit(JSON.stringify({organization_id:f.org,...payload}))});`));
const row=id=>JSON.parse(sql(`select row_to_json(m) from communication_outbox m where id=${lit(id)}`));
const attempts=id=>Number(sql(`select count(*) from communication_attempts where message_id=${lit(id)}`));
const audit=(id,kind)=>Number(sql(`select count(*) from communication_audit where subject_id=${lit(id)} and kind=${lit(kind)}`));
function queue(){
 const preview=staff('test_preview',{id:h.profile,person_id:f.person});
 return staff('test_confirm',{id:h.profile,person_id:f.person,request_key:randomUUID(),confirmed:true,preview_subject:preview.subject,preview_body:preview.body,preview_recipient:preview.recipient}).message_id;
}
function isolate(){sql("update communication_outbox set status='cancelled',lease_token=null,lease_until=null where status in ('draft','queued','scheduled','sending');");}
try {
 execFileSync(exe('initdb'),['-D',data,'--auth=trust','-U','postgres','--locale=C','--encoding=UTF8'],{stdio:'inherit',env:{...process.env,LC_ALL:'C',LANG:'C'}});
 execFileSync(exe('pg_ctl'),['-D',data,'-l',join(root,'server.log'),'-o',`-k ${socket} -p ${port} -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
 sql(readFileSync(new URL('../backend-tests/fixtures/supabase-test-bootstrap.sql',import.meta.url),'utf8'));
 sql(readFileSync(new URL('../../supabase/bootstrap/automatic-rls.sql',import.meta.url),'utf8'));
 for(const name of migrationOrder)sql(readFileSync(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8'));
 sql(fixtureSQL+activationFixtureSQL);
 // No automated fixture reminders; each scenario queues explicit fictional rows.
 sql('update communication_routes set enabled=false;');
 const runtime={environment:'acceptance',project_ref:h.ref};
 const v=staff('verify_request',{id:h.profile});
 worker('verify_result',{id:h.profile,revision:v.revision,actor:f.user,environment:runtime.environment,project_ref:h.ref,configured:true,verified:true});
 staff('enable',{id:h.profile,mode:'test_only'});staff('org_delivery',{enabled:true,email_enabled:true,sms_enabled:false});staff('global_delivery',{enabled:true});
 let calls=0,sends=0;
 const rpc=async(a,o,p)=>{assert.equal(o,f.org);calls++;return worker(a,p)};
 const resolve=async()=>({send:async job=>{sends++;return{id:'h1:'+job.id,status:'sent'}}});
 const run=(r=rpc,res=resolve,extra={})=>runExternalWorker(r,f.org,res,{enabled:true,runtime,...extra});
 // First preserve the exact legacy callback conflict behavior.
 let first=queue();await run();let firstRow=row(first);
 const firstAttempt=JSON.parse(sql(`select row_to_json(a) from communication_attempts a where message_id=${lit(first)}`));
 sql(`update communication_provider_controls set structured_callbacks=true where profile_id='${h.profile}'`);
 const delivery={id:h.profile,event_id:'legacy-event',provider:'smtp_transport',provider_message_id:firstRow.provider_message_id,attempt_id:firstAttempt.id,outcome:'delivered'};
 worker('callback_external',delivery);
 eq(worker('callback_external',{...delivery,outcome:'failed'}).duplicate,true,'BEFORE conflicting same event silently acknowledged duplicate');
 sql(readFileSync(new URL('../../supabase/migrations/20261101214121_communications_receipt_reconciliation.sql',import.meta.url),'utf8'));
 await rejects(async()=>worker('callback_external',{...delivery,outcome:'failed'}),'AFTER conflicting same event rejected');
 eq(row(first).status,'delivered','original delivered status preserved');
 eq(worker('callback_external',delivery).duplicate,true,'exact old callback replay remains idempotent');
 let seq=0;
 async function unknown(){isolate();sql(`update communication_provider_controls set enabled=true,mode='test_only',consecutive_failures=0 where profile_id='${h.profile}'`);const id=queue();await run(rpc,async()=>({send:async()=>{throw {failure:'uncertain'}}}));const m=row(id);const a=JSON.parse(sql(`select row_to_json(x) from communication_attempts x where message_id=${lit(id)}`));return{id:h.profile,event_id:'receipt-'+(++seq),provider:'smtp_transport',environment:runtime.environment,project_ref:h.ref,message_id:id,attempt_id:a.id,idempotency_key:m.idempotency_key,provider_message_id:'accepted-'+id,outcome:'sent'}}
 const reconcile=p=>worker('reconcile_external',p);
 let p=await unknown();await rejects(async()=>sql(`set role service_role;select communications_provider_service(null,'${f.org}',${lit(JSON.stringify(p))});`),'null action cannot enter reconciliation');const count=Number(sql('select count(*) from communication_audit'));
 for(const patch of [{attempt_id:randomUUID()},{message_id:randomUUID()},{idempotency_key:'another'},{id:randomUUID()},{provider:'sms_transport'},{environment:'production'},{project_ref:'aaaaaaaaaaaaaaaaaaaa'},{provider_message_id:null},{outcome:'delivered'}])await rejects(async()=>reconcile({...p,...patch}),'wrong receipt binding denied '+JSON.stringify(patch));
 eq(row(p.message_id).failure_class,'uncertain','rejected receipts retain UNKNOWN');eq(Number(sql('select count(*) from communication_audit')),count,'denied receipts create no successful audit');
 await rejects(async()=>sql(`set role authenticated;select communications_provider_service('reconcile_external','${f.org}',${lit(JSON.stringify(p))});`),'authenticated role cannot reconcile');
 await rejects(async()=>sql(`set role service_role;select private.comm_provider_service_h1('claim_external','${f.org}','{}');`),'old private helper cannot bypass wrapper');
 sql("update communication_consents set status='revoked' where purpose='transactional'");
 eq(reconcile(p).outcome,'sent','authenticated receipt recovers already handed-off UNKNOWN after consent revoked');
 eq(row(p.message_id).provider_message_id,p.provider_message_id,'exact receipt bound');eq(row(p.message_id).status,'sent','UNKNOWN becomes sent never requeued');
 eq(audit(p.message_id,'provider.reconciled'),1,'one reconciliation audit');eq(reconcile(p).duplicate,true,'exact receipt replay idempotent');
 eq(audit(p.message_id,'provider.reconciled'),1,'replay no duplicate audit');
 for(const patch of [{provider_message_id:'different'},{outcome:'rejected',provider_message_id:null},{event_id:'different-event',outcome:'rejected',provider_message_id:null}])await rejects(async()=>reconcile({...p,...patch}),'contradictory receipt rejected');
 const before=sends;await run();eq(sends,before,'reconciled accepted message never resent');
 sql("update communication_consents set status='granted' where purpose='transactional'");
 p=await unknown();reconcile({...p,outcome:'uncertain',provider_message_id:null});eq(row(p.message_id).failure_class,'uncertain','verified inconclusive evidence leaves UNKNOWN');
 eq(reconcile({...p,outcome:'uncertain',provider_message_id:null}).duplicate,true,'inconclusive evidence replay idempotent');
 await rejects(async()=>reconcile(p),'same event cannot change outcome');p.event_id+='-accepted';reconcile(p);eq(row(p.message_id).status,'sent','new definitive authenticated event resolves prior uncertainty');
 p=await unknown();reconcile({...p,outcome:'rejected',provider_message_id:null});eq(row(p.message_id).failure_class,'rejected','definitive rejection stays failed');
 const n=sends;await run();eq(sends,n,'rejection not automatically retried');
 await rejects(async()=>reconcile({...p,event_id:'late-accepted'}),'rejected case cannot silently become accepted');
 p=await unknown();
 sql(`create function private.fail_receipt_audit()returns trigger language plpgsql as $$begin if new.kind='provider.reconciled' then raise exception 'injected audit failure';end if;return new;end$$;create trigger fail_receipt_audit before insert on communication_audit for each row execute function private.fail_receipt_audit();`);
 await rejects(async()=>reconcile(p),'audit failure aborts receipt transaction');eq(row(p.message_id).failure_class,'uncertain','audit failure rolls back status');eq(Number(sql(`select count(*) from communication_callbacks where event_id=${lit(p.event_id)}`)),0,'audit failure rolls back callback evidence');
 sql('drop trigger fail_receipt_audit on communication_audit;drop function private.fail_receipt_audit();');
 // Two independent PostgreSQL sessions, same exact signed event.
 const concurrent=payload=>new Promise((resolve,reject)=>execFile(exe('psql'),[...args,'-c',`set role service_role;select communications_provider_service('reconcile_external','${f.org}',${lit(JSON.stringify(payload))});`],{encoding:'utf8'},(e,out)=>e?reject(e):resolve(JSON.parse(out.trim()))));
 const pair=await Promise.all([concurrent(p),concurrent(p)]);eq(pair.filter(x=>x.recorded).length,1,'concurrent receipt exactly one winner');eq(pair.filter(x=>x.duplicate).length,1,'concurrent receipt one duplicate');eq(audit(p.message_id,'provider.reconciled'),1,'concurrent receipt one immutable audit');
 p=await unknown();const competing=await Promise.allSettled([concurrent(p),concurrent({...p,outcome:'rejected',provider_message_id:null})]);eq(competing.filter(x=>x.status==='fulfilled').length,1,'contradictory concurrent receipts one winner');eq(competing.filter(x=>x.status==='rejected').length,1,'contradictory concurrent receipt denied');eq(audit(p.message_id,'provider.reconciled'),1,'contradictory race one audit');
 console.log(JSON.stringify({status:'PASS',checks,transport:'fictional H1 adapter only',schema:'existing H1 plus local reconciliation migration',hosted:false}));

} finally {
 if(started)execFileSync(exe('pg_ctl'),['-D',data,'-m','fast','-w','stop'],{stdio:'ignore'});
 rmSync(root,{recursive:true,force:true});
}
