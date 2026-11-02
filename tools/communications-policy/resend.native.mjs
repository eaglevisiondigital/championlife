// Disposable Unix-socket PostgreSQL only. Existing SQL and worker, fictional sink.
import assert from 'node:assert/strict';
import {execFileSync,execFile} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHmac,randomUUID} from 'node:crypto';
import {migrationOrder} from '../backend-tests/migration-order.mjs';
import {f,h,fixtureSQL,activationFixtureSQL} from '../backend-tests/activation-fixture.mjs';
import {resendAdapter,resendReceipt} from '../../supabase/functions/_shared/communications/resend.mjs';
import {runExternalWorker} from '../../supabase/functions/_shared/communications/activation.mjs';

const bin=process.env.TEST_POSTGRES_BIN||'/opt/homebrew/opt/postgresql@17/bin';
const root=mkdtempSync(join(tmpdir(),'comm-resend-')),data=join(root,'data'),socket=join(root,'socket');
mkdirSync(socket);
const exe=n=>join(bin,n),port='55507';
const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',socket,'-p',port,'-U','postgres','postgres'];
const sql=s=>execFileSync(exe('psql'),args,{input:s,encoding:'utf8',maxBuffer:5e6,stdio:['pipe','pipe','pipe']}).trim();
const lit=s=>"'"+String(s).replaceAll("'","''")+"'";
let started=false,checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
const rejects=async(fn,label)=>{await assert.rejects(fn);checks++;console.log('PASS '+label)};
let contextEnabled=false;
const callbackContext=()=>JSON.parse(sql(`select json_build_object('profile_id',c.profile_id,'organization_id',c.organization_id,'environment',c.environment,'project_ref',c.project_ref,'provider',s.provider,'channel',s.channel,'from_address',s.from_address,'reply_to',s.reply_to) from communication_provider_controls c join communication_sender_profiles s on s.id=c.profile_id where c.profile_id='${h.profile}'`));
const bound=(action,payload)=>contextEnabled&&['callback_external','reconcile_external','keyword_external'].includes(action)&&!Object.hasOwn(payload,'callback_context')?{...payload,callback_context:callbackContext()}:payload;
const worker=(action,payload={})=>JSON.parse(sql(`set role service_role;select communications_provider_service(${lit(action)},'${f.org}',${lit(JSON.stringify(bound(action,payload)))});`));
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
 for(const file of ['20261101214121_communications_receipt_reconciliation.sql','20261101231457_communications_callback_context.sql','20261102150100_communications_resend_source.sql'])sql(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 // Only fictional fixture installation; no host provisioning route is introduced.
 sql(`update communication_sender_profiles set provider='resend_email' where id='${h.profile}';update communication_provider_controls set structured_callbacks=true,resend_account_id='fictional-account' where profile_id='${h.profile}'`);
 const profile=worker('profile',{id:h.profile});
 const binding={provider:'resend_email',organization_id:f.org,profile_id:h.profile,environment:runtime.environment,project_ref:h.ref,account_id:'fictional-account',from:profile.sender.from_address,reply_to:profile.sender.reply_to,enabled:true,sender_approved:true,structured_callbacks:true,webhook_secret:'whsec_'+Buffer.alloc(32,9).toString('base64')};
 let requests=0,seq=0;
 const adapter=resendAdapter(binding,{enabled:true,request:async()=>{requests++;return{status:200,body:{id:randomUUID()}}}});
 async function accepted(){isolate();sql(`update communication_provider_controls set enabled=true,consecutive_failures=0,mode='test_only' where profile_id='${h.profile}'`);const id=queue();await run(rpc,async()=>adapter);eq(row(id).status,'sent','API accepted durable existing outbox');return id;}
 function lookup(id){const m=row(id);const a=JSON.parse(sql(`select row_to_json(a) from communication_attempts a where message_id=${lit(id)} order by attempt desc limit 1`));return{message_id:id,attempt_id:a.id,organization_id:f.org,profile_id:h.profile,provider:'resend_email',provider_message_id:m.provider_message_id,recipient:m.address_snapshot,from:binding.from,environment:runtime.environment,project_ref:h.ref,account_id:binding.account_id,idempotency_key:m.idempotency_key,purpose:m.purpose};}
 async function receipt(id,type='email.delivered',eventId='msg_'+(++seq)){const a=lookup(id),time=String(Math.floor(Date.now()/1000));const raw=Buffer.from(JSON.stringify({type,created_at:new Date(Date.now()).toISOString(),data:{email_id:a.provider_message_id,from:binding.from,to:[a.recipient]}}));const mac=createHmac('sha256',Buffer.from(binding.webhook_secret.slice(6),'base64')).update(eventId+'.'+time+'.').update(raw).digest('base64');const headers=new Headers({'svix-id':eventId,'svix-timestamp':time,'svix-signature':'v1,'+mac});return(await resendReceipt(raw,headers,binding,async()=>a)).payload;}
 const ingest=p=>worker('resend_receipt',p);
 let id=await accepted(),p=await receipt(id);
 const duplicateId=queue();await rejects(async()=>sql(`update communication_outbox set provider='resend_email',provider_message_id=${lit(row(id).provider_message_id)} where id=${lit(duplicateId)} and organization_id='${f.org}'`),'duplicate provider ID cannot alias a canonical message');
 eq(ingest(p).recorded,true,'cryptographic callback committed');eq(row(id).status,'delivered','recipient-server delivery recorded');eq(ingest(p).duplicate,true,'exact signed replay idempotent');eq(audit(id,'provider.resend_receipt'),1,'single immutable audit');
 for(const patch of [{body_sha256:'0'.repeat(64)},{outcome:'failed'},{attempt_id:randomUUID()},{message_id:randomUUID()},{account_id:'wrong'},{recipient:'wrong@example.test'},{from:'wrong@example.test'},{reply_to:'wrong@example.test'},{purpose:'marketing'},{idempotency_key:'wrong'},{environment:'production'},{project_ref:'aaaaaaaaaaaaaaaaaaaa'},{provider:'smtp_transport'}])await rejects(async()=>ingest({...p,...patch}),'wrong receipt binding/replay rejected '+JSON.stringify(patch));
 eq(audit(id,'provider.resend_receipt'),1,'rejected receipts no successful audit');
 await rejects(async()=>sql(`set role authenticated;select communications_provider_service('resend_receipt','${f.org}',${lit(JSON.stringify(p))});`),'browser role cannot submit trusted receipts');
 await rejects(async()=>worker('callback_external',{...p,callback_context:callbackContext()}),'generic callback cannot bypass Resend evidence');
 await rejects(async()=>sql(`set role service_role;select private.comm_provider_service_context_v1('callback_external','${f.org}',${lit(JSON.stringify(p))});`),'old helper execute revoked');
 ingest(await receipt(id,'email.sent'));eq(row(id).status,'delivered','late sent cannot downgrade delivered');
 ingest(await receipt(id,'email.complained'));eq(Number(sql(`select count(*) from communication_suppressions where organization_id='${f.org}' and reason='complaint' and active`)),1,'complaint after delivered suppresses');eq(row(id).status,'delivered','delivery history preserved after complaint');
 await rejects(async()=>queue(),'complaint blocks future test creation before dispatch');
 sql('update communication_suppressions set active=false;');
 id=await accepted();p=await receipt(id,'email.bounced');ingest(p);eq(row(id).failure_class,'hard_bounce','bounce recorded');eq(Number(sql("select count(*) from communication_suppressions where reason='hard_bounce' and active")),1,'bounce suppression');ingest(await receipt(id,'email.sent'));eq(row(id).failure_class,'hard_bounce','late acceptance cannot erase bounce');sql('update communication_suppressions set active=false;');
 id=await accepted();ingest(await receipt(id,'email.failed'));eq(row(id).failure_class,'failed','provider failure durable');
 id=await accepted();ingest(await receipt(id,'email.delivery_delayed'));eq(row(id).status,'sent','delay remains accepted never retry queued');ingest(await receipt(id));eq(row(id).status,'delivered','delivery after delay progresses');
 id=await accepted();p=await receipt(id);sql(`update communication_provider_controls set resend_account_id='other-account' where profile_id='${h.profile}'`);await rejects(async()=>ingest({...p,account_id:'other-account'}),'fresh account binding cannot claim old handoff');eq(audit(id,'provider.resend_receipt'),0,'account drift no audit');sql(`update communication_provider_controls set resend_account_id='fictional-account' where profile_id='${h.profile}'`);
 sql(`update communication_outbox set rendered_body='changed' where id='${id}'`);await rejects(async()=>ingest(p),'changed canonical content cannot claim old handoff');
 id=await accepted();p=await receipt(id);
 sql(`create function private.fail_resend_audit()returns trigger language plpgsql as $$begin if new.kind='provider.resend_receipt' then raise exception 'injected failure';end if;return new;end$$;create trigger fail_resend_audit before insert on communication_audit for each row execute function private.fail_resend_audit();`);
 await rejects(async()=>ingest(p),'audit failure rolls back transaction');eq(row(id).status,'sent','audit failure rolls back delivery');eq(Number(sql(`select count(*) from communication_callbacks where event_id=${lit(p.event_id)}`)),0,'audit failure rolls back callback');sql('drop trigger fail_resend_audit on communication_audit;drop function private.fail_resend_audit();');
 const concurrent=payload=>new Promise((resolve,reject)=>execFile(exe('psql'),[...args,'-c',`set role service_role;select communications_provider_service('resend_receipt','${f.org}',${lit(JSON.stringify(payload))});`],{encoding:'utf8'},(e,out)=>e?reject(e):resolve(JSON.parse(out.trim()))));
 const pair=await Promise.all([concurrent(p),concurrent(p)]);eq(pair.filter(x=>x.recorded).length,1,'separate connection receipt exactly one commit');eq(pair.filter(x=>x.duplicate).length,1,'separate connection receipt duplicate');eq(audit(id,'provider.resend_receipt'),1,'concurrent single immutable audit');
 id=await accepted();p=await receipt(id);const race=await Promise.allSettled([concurrent(p),concurrent({...p,body_sha256:'0'.repeat(64)})]);eq(race.filter(x=>x.status==='fulfilled').length,1,'conflicting race one commit');eq(race.filter(x=>x.status==='rejected').length,1,'conflicting race one denial');
 // A reply-to/profile change committed while callback waits invalidates old envelope.
 id=await accepted();p=await receipt(id);
 const change=new Promise((resolve,reject)=>execFile(exe('psql'),[...args,'-c',`begin;select private.comm_external_lock('${f.org}');update communication_sender_profiles set reply_to='changed@example.test' where id='${h.profile}';select pg_sleep(1);commit;`],{encoding:'utf8'},e=>e?reject(e):resolve()));
 let held=false;for(let i=0;i<100;i++){held=Number(sql("select count(*) from pg_stat_activity where query like 'begin;select private.comm_external_lock%' and wait_event='PgSleep'"))>0;if(held)break;await new Promise(r=>setTimeout(r,10))}eq(held,true,'context lock independently held');await rejects(()=>concurrent(p),'locked profile drift denies stale receipt');await change;eq(row(id).status,'sent','context race leaves receipt unresolved');eq(audit(id,'provider.resend_receipt'),0,'context race no successful audit');sql(`update communication_sender_profiles set reply_to=${binding.reply_to===null?'null':lit(binding.reply_to)} where id='${h.profile}'`);
 isolate();sql(`update communication_provider_controls set enabled=true,consecutive_failures=0,mode='test_only' where profile_id='${h.profile}'`);id=queue();const before=requests;await run(rpc,async()=>resendAdapter(binding,{enabled:true,request:async()=>{requests++;throw Error('lost response')}}));eq(row(id).failure_class,'uncertain','lost API response durable UNKNOWN');await run(rpc,async()=>adapter);eq(requests,before+1,'UNKNOWN never resent');await rejects(()=>receipt(id),'UNKNOWN without provider ID cannot be mapped');eq(attempts(id),1,'UNKNOWN does not create second attempt');
 console.log(JSON.stringify({status:'PASS',checks,provider:'fictional injected API and signatures',hosted:false}));
} finally {
 if(started)execFileSync(exe('pg_ctl'),['-D',data,'-m','fast','-w','stop'],{stdio:'ignore'});
 rmSync(root,{recursive:true,force:true});
}
