// Disposable Unix-socket PostgreSQL only. Existing SQL and worker, fictional sink.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {migrationOrder} from '../backend-tests/migration-order.mjs';
import {f,h,fixtureSQL,activationFixtureSQL} from '../backend-tests/activation-fixture.mjs';
import {runExternalWorker} from '../../supabase/functions/_shared/communications/activation.mjs';

const bin=process.env.TEST_POSTGRES_BIN||'/opt/homebrew/opt/postgresql@17/bin';
const root=mkdtempSync(join(tmpdir(),'comm-h1-durable-')),data=join(root,'data'),socket=join(root,'socket');
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
 sql(readFileSync(new URL('../../supabase/migrations/20261106071632_communications_preference_replay_binding.sql',import.meta.url),'utf8'));
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
 let id=queue();let before=sends;
 eq(await runExternalWorker(rpc,f.org,resolve,{enabled:'false',runtime}),{mode:'disabled',processed:0},'false string never starts H1');
 eq(calls,0,'malformed enable no database operation');eq(row(id).status,'queued','malformed enable preserves queued row');
 const stop=new AbortController();stop.abort();await run(rpc,resolve,{signal:stop.signal});eq(calls,0,'already cancelled no database operation');
 await run();eq(row(id).status,'sent','canonical external receipt persisted');eq(row(id).provider_message_id,'h1:'+id,'exact accepted ID retained');eq(audit(id,'provider.result'),1,'accepted result one immutable audit');
 await run();eq(sends-before,1,'accepted receipt never resent');

 isolate();id=queue();before=sends;
 await run(async(a,o,p)=>{if(a==='authorize_external')sql("update communication_consents set status='revoked' where purpose='transactional'");return rpc(a,o,p)});
 eq(sends,before,'authoritative revoked consent zero handoffs');eq(row(id).status,'suppressed','revoked consent durable suppression');eq(audit(id,'provider.result'),0,'denial no successful result');
 sql("update communication_consents set status='granted' where purpose='transactional'");

 isolate();id=queue();before=sends;
 await run(rpc,async()=>({send:async()=>{sends++;return {status:'sent'}}}));
 eq(row(id).status,'failed','missing receipt persists failed');eq(row(id).failure_class,'uncertain','missing receipt stays UNKNOWN');eq(row(id).provider_message_id,null,'missing receipt cannot fabricate provider ID');eq(attempts(id),1,'one ambiguous attempt');
 await run();eq(sends-before,1,'UNKNOWN never automatically retried');
 await rejects(async()=>sql(`set request.jwt.claim.sub='${f.user}';set role authenticated;select communications_workspace('retry','${f.campaign}',${lit(JSON.stringify({organization_id:f.org,id}))});`),'manual retry cannot bypass UNKNOWN');

 isolate();id=queue();before=sends;
 await rejects(()=>run(async(a,o,p)=>{if(a==='result_external')throw Error('lost ack');return rpc(a,o,p)}),'failed acknowledgement stops H1');
 eq(row(id).status,'sending','lost ack retains durable lease');eq(audit(id,'provider.result'),0,'lost ack no fabricated success');
 sql(`update communication_outbox set lease_until=now()-interval '1 minute' where id=${lit(id)}`);
 await run();eq(row(id).failure_class,'uncertain','expired post-handoff lease becomes UNKNOWN');eq(sends-before,1,'expired UNKNOWN not resent');

 isolate();id=queue();const id2=queue(),ac=new AbortController();before=sends;
 const result=await run(rpc,async()=>({send:async job=>{sends++;ac.abort();return{id:'cancel:'+job.id,status:'sent'}}}),{signal:ac.signal});
 eq(result,{mode:'cancelled',processed:1},'cancel after handoff persists receipt then stops');eq(sends-before,1,'no second external handoff after cancellation');
 const rows=[row(id),row(id2)];eq(rows.filter(x=>x.status==='sent').length,1,'one durable accepted row');eq(rows.filter(x=>x.dispatch_authorized_at===null).length,1,'other claimed row never authorized');
 eq(audit(id,'provider.result')+audit(id2,'provider.result'),1,'one actual receipt audit');

 isolate();id=queue();const ac2=new AbortController();before=sends;
 await run(async(a,o,p)=>{const value=await rpc(a,o,p);if(a==='authorize_external')ac2.abort();return value},resolve,{signal:ac2.signal});
 eq(sends,before,'cancel after DB authority before send blocks handoff');eq(audit(id,'provider.result'),0,'cancel before send no false receipt');
 sql(`update communication_outbox set lease_until=now()-interval '1 minute' where id=${lit(id)}`);await run();
 eq(row(id).failure_class,'uncertain','uncompleted authorized handoff fails closed');eq(sends,before,'no retry of authorized unknown handoff');
 console.log(JSON.stringify({status:'PASS',checks,transport:'fictional H1 adapter only',schema:'existing unmodified H1 migrations',hosted:false}));
} finally {
 if(started)execFileSync(exe('pg_ctl'),['-D',data,'-m','fast','-w','stop'],{stdio:'ignore'});
 rmSync(root,{recursive:true,force:true});
}
