// Disposable Unix-socket PostgreSQL only. Existing SQL and worker, fictional sink.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {migrationOrder} from '../backend-tests/migration-order.mjs';
import {f,fixtureSQL} from '../backend-tests/communications-fixture.mjs';
import {runWorker} from '../../supabase/functions/_shared/communications/providers.mjs';

const bin=process.env.TEST_POSTGRES_BIN||'/opt/homebrew/opt/postgresql@17/bin';
const root=mkdtempSync(join(tmpdir(),'comm-durable-')),data=join(root,'data'),socket=join(root,'socket');
mkdirSync(socket);
const exe=n=>join(bin,n),port='55503';
const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',socket,'-p',port,'-U','postgres','postgres'];
const sql=s=>execFileSync(exe('psql'),args,{input:s,encoding:'utf8',maxBuffer:5e6,stdio:['pipe','pipe','pipe']}).trim();
const lit=s=>"'"+String(s).replaceAll("'","''")+"'";
let started=false,checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
const rejects=async(fn,label)=>{await assert.rejects(fn);checks++;console.log('PASS '+label)};
const worker=(action,payload={})=>JSON.parse(sql(`set role service_role;select communications_service(${lit(action)},'${f.org}',${lit(JSON.stringify(payload))});`));
const staff=(action,payload={})=>JSON.parse(sql(`set request.jwt.claim.sub='${f.user}';set role authenticated;select communications_workspace(${lit(action)},'${f.campaign}',${lit(JSON.stringify({organization_id:f.org,...payload}))});`));
const row=id=>JSON.parse(sql(`select row_to_json(m) from communication_outbox m where id=${lit(id)}`));
const attempts=id=>Number(sql(`select count(*) from communication_attempts where message_id=${lit(id)}`));
const audit=(id,kind)=>Number(sql(`select count(*) from communication_audit where subject_id=${lit(id)} and kind=${lit(kind)}`));
function queue(person=f.person){
 const x=staff('preview',{request_key:randomUUID(),channel:'email',template_id:f.template,sender_profile_id:f.sender,audience:{kind:'person',person_id:person}});
 staff('confirm',{id:x.batch.id,confirmed:true});
 return sql(`select id from communication_outbox where batch_id=${lit(x.batch.id)}`);
}
function isolate(){sql("update communication_outbox set status='cancelled',lease_token=null,lease_until=null where status in ('draft','queued','scheduled','sending');");}
try {
 execFileSync(exe('initdb'),['-D',data,'--auth=trust','-U','postgres','--locale=C','--encoding=UTF8'],{stdio:'inherit',env:{...process.env,LC_ALL:'C',LANG:'C'}});
 execFileSync(exe('pg_ctl'),['-D',data,'-l',join(root,'server.log'),'-o',`-k ${socket} -p ${port} -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
 sql(readFileSync(new URL('../backend-tests/fixtures/supabase-test-bootstrap.sql',import.meta.url),'utf8'));
 sql(readFileSync(new URL('../../supabase/bootstrap/automatic-rls.sql',import.meta.url),'utf8'));
 for(const name of migrationOrder)sql(readFileSync(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8'));
 sql(readFileSync(new URL('../../supabase/migrations/20261106071632_communications_preference_replay_binding.sql',import.meta.url),'utf8'));
 sql(fixtureSQL);
 // No automated fixture reminders; each scenario queues explicit fictional rows.
 sql('update communication_routes set enabled=false;');
 let calls=0,sends=0;
 const rpc=async(action,org,payload)=>{assert.equal(org,f.org);calls++;return worker(action,payload)};
 const sink={async send(job){sends++;assert.equal(job.sender.provider,'acceptance_sink');return{id:'durable:'+job.id}}};
 const baseline=sql('select md5(coalesce(jsonb_agg(t)::text,\'[]\')) from communication_outbox t;');
 eq(await runWorker(rpc,f.org,sink),{mode:'disabled',processed:0},'default disabled');
 eq(calls,0,'disabled calls no RPC');eq(sends,0,'disabled calls no sink');
 eq(sql('select md5(coalesce(jsonb_agg(t)::text,\'[]\')) from communication_outbox t;'),baseline,'disabled preserves durable rows');

 const uncertain=queue();
 await runWorker(rpc,f.org,{async send(){sends++;throw Object.assign(Error('synthetic timeout'),{code:'ETIMEDOUT'})}},{enabled:true});
 eq(row(uncertain).status,'failed','timeout is durable failed');
 eq(row(uncertain).failure_class,'uncertain','timeout classified uncertain');
 eq(attempts(uncertain),1,'one timeout attempt');
 let before=sends;await runWorker(rpc,f.org,sink,{enabled:true});eq(sends,before,'uncertain not automatically resent');
 await rejects(async()=>staff('retry',{id:uncertain}),'uncertain manual retry denied');
 eq(audit(uncertain,'provider.result'),1,'one uncertain result audit');

 isolate();const lost=queue();
 await rejects(()=>runWorker(async(a,o,p)=>{if(a==='result')throw Error('lost before durable acknowledgement');return rpc(a,o,p)},f.org,sink,{enabled:true}),'lost result acknowledgement stops worker');
 eq(row(lost).status,'sending','unacknowledged handoff retains lease');
 assert.ok(row(lost).dispatch_authorized_at);checks++;
 eq(audit(lost,'provider.result'),0,'no fabricated successful result audit');
 sql(`update communication_outbox set lease_until=now()-interval '1 minute' where id=${lit(lost)}`);
 before=sends;await runWorker(rpc,f.org,sink,{enabled:true});
 eq(sends,before,'expired post-handoff lease never resends');
 eq(row(lost).failure_class,'uncertain','lost receipt becomes uncertain');eq(attempts(lost),1,'lease retirement does not invent attempt');
 await rejects(async()=>staff('retry',{id:lost}),'lost receipt retry denied');
 await rejects(async()=>worker('callback',{provider:'acceptance_sink',provider_message_id:'unknown',event_id:'unknown-receipt',outcome:'delivered'}),'unbound callback cannot attach unknown receipt');
 eq(audit(lost,'delivery.delivered'),0,'unknown receipt no delivered audit');

 isolate();const acknowledged=queue();
 await rejects(()=>runWorker(async(a,o,p)=>{const result=await rpc(a,o,p);if(a==='result')throw Error('lost response after DB commit');return result},f.org,sink,{enabled:true}),'lost response after commit stops worker');
 eq(row(acknowledged).status,'sent','committed result survives lost response');
 eq(audit(acknowledged,'provider.result'),1,'one committed result audit');
 before=sends;await runWorker(rpc,f.org,sink,{enabled:true});eq(sends,before,'committed lost response not resent');
 const receipt={provider:'acceptance_sink',provider_message_id:'durable:'+acknowledged,event_id:'ack-delivered',outcome:'delivered'};
 worker('callback',receipt);worker('callback',receipt);
 eq(row(acknowledged).status,'delivered','known receipt records delivery');eq(audit(acknowledged,'delivery.delivered'),1,'duplicate callback has one audit');
 await rejects(async()=>JSON.parse(sql(`set role service_role;select communications_service('callback','${f.other}',${lit(JSON.stringify(receipt))});`)),'cross-organization receipt denied');

 isolate();const first=queue(),second=queue(f.person2),abort=new AbortController();before=sends;
 const result=await runWorker(rpc,f.org,{async send(job){sends++;abort.abort();return{id:'cancel:'+job.id}}},{enabled:true,signal:abort.signal});
 eq(result,{mode:'cancelled',processed:1},'cancellation after handoff records result then stops');
 eq(sends-before,1,'cancellation no second handoff');
 const rows=[row(first),row(second)];eq(rows.filter(r=>r.status==='sent').length,1,'one durable sent record');
 eq(rows.filter(r=>r.dispatch_authorized_at===null).length,1,'remaining claimed job never dispatch authorized');
 eq(audit(first,'provider.result')+audit(second,'provider.result'),1,'cancellation preserves only actual result audit');

 isolate();const revoked=queue();before=sends;
 await runWorker(async(a,o,p)=>{
  if(a==='authorize_dispatch')staff('consent',{audience:{kind:'person',person_id:f.person},recipient_key:'person:'+f.person,channel:'email',purpose:'event_updates',status:'revoked',source:'Fictional test',proof_reference:'fictional-revoke',explicitly_reviewed:true});
  return rpc(a,o,p);
 },f.org,sink,{enabled:true});
 eq(sends,before,'revocation between claim and handoff blocks sink');eq(row(revoked).status,'suppressed','revocation durable suppression');
 eq(audit(revoked,'provider.result'),0,'revoked job no successful provider result');
 console.log(JSON.stringify({status:'PASS',checks,transport:'fictional sink only',schema:'unchanged full local migration replay',hosted:false}));
} finally {
 if(started)execFileSync(exe('pg_ctl'),['-D',data,'-m','fast','-w','stop'],{stdio:'ignore'});
 rmSync(root,{recursive:true,force:true});
}
