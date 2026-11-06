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
import {createResendSourceHost} from '../../supabase/functions/_shared/communications/resend-host.mjs';
import {runExternalWorker} from '../../supabase/functions/_shared/communications/activation.mjs';

const bin=process.env.TEST_POSTGRES_BIN||'/opt/homebrew/opt/postgresql@17/bin';
const root=mkdtempSync(join(tmpdir(),'comm-resend-host-')),data=join(root,'data'),socket=join(root,'socket');
mkdirSync(socket);
const exe=n=>join(bin,n),port='55508';
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

 const hostSQL=readFileSync(new URL('../../supabase/migrations/20261102154214_communications_resend_host_lookup.sql',import.meta.url),'utf8');
 for(const change of ["grant execute on function public.communications_provider_service(text,uuid,jsonb) to authenticated;","drop index communication_resend_receipt_unique;","drop index communication_resend_receipt_unique;create unique index communication_resend_receipt_unique on communication_outbox(organization_id,provider,provider_message_id) where false;","create or replace function public.communications_provider_service(p_action text,p_organization uuid,p_payload jsonb default '{}')returns jsonb language sql security invoker set search_path='' as $$select '{}'::jsonb$$;"]){await rejects(async()=>sql('begin;'+change+hostSQL+'commit;'),'migration refuses dependency/permission drift with full rollback');}
 eq(sql("select has_function_privilege('authenticated','public.communications_provider_service(text,uuid,jsonb)','EXECUTE')"),'f','rejected installation preserves service-only wrapper');
 sql(hostSQL);
 const eventsSQL=readFileSync(new URL('../../supabase/migrations/20261102193138_communications_resend_suppressed.sql',import.meta.url),'utf8');
 for(const change of ["grant execute on function private.comm_provider_service_resend_v1(text,uuid,jsonb) to service_role;", "create or replace function private.comm_provider_service_resend_v1(action text,o uuid,p jsonb)returns jsonb language sql security definer set search_path='' as $$select '{}'::jsonb$$;"]){await rejects(async()=>sql('begin;'+change+eventsSQL+'commit;'),'events migration rejects function or privilege drift');}
 sql(eventsSQL);
 sql(readFileSync(new URL('../../supabase/migrations/20261106071632_communications_preference_replay_binding.sql',import.meta.url),'utf8'));
 let requests=0,seq=0;
 const api=async()=>{requests++;return new Response(JSON.stringify({id:randomUUID()}));};
 const host=createResendSourceHost({binding,rpc,fetchImpl:api,apiKey:'re_fictional_not_a_secret',outboundEnabled:true,receiptsEnabled:true});
 async function accepted(){isolate();sql(`update communication_provider_controls set enabled=true,consecutive_failures=0,mode='test_only' where profile_id='${h.profile}'`);const id=queue();await host.worker({messageId:id});eq(row(id).status,'sent','existing H1 worker + fixed transport durable acceptance');return id;}
 const lookupRequest=id=>({id:h.profile,provider_message_id:row(id).provider_message_id,provider:'resend_email',account_id:binding.account_id,environment:runtime.environment,project_ref:h.ref});
 const lookup=id=>worker('resend_lookup',lookupRequest(id));
 function req(id,type='email.delivered',eventId='msg_host_'+(++seq)){const m=row(id),time=String(Math.floor(Date.now()/1000)),raw=Buffer.from(JSON.stringify({type,created_at:new Date().toISOString(),data:{email_id:m.provider_message_id,from:binding.from,to:[m.address_snapshot]}}));const mac=createHmac('sha256',Buffer.from(binding.webhook_secret.slice(6),'base64')).update(eventId+'.'+time+'.').update(raw).digest('base64');return new Request('https://fictional.test/callback',{method:'POST',body:raw,headers:{'svix-id':eventId,'svix-timestamp':time,'svix-signature':'v1,'+mac}});}
 let id=await accepted();const known=lookup(id);
 eq(Object.keys(known).sort(),['message_id','attempt_id','organization_id','profile_id','provider','provider_message_id','recipient','from','environment','project_ref','account_id','idempotency_key','purpose'].sort(),'lookup exact metadata projection excludes message body/subject and secrets');
 eq(known.message_id,id,'known provider ID maps current canonical message');
 for(const patch of [{id:randomUUID()},{provider_message_id:randomUUID()},{provider:'smtp_transport'},{account_id:'wrong'},{environment:'production'},{project_ref:'aaaaaaaaaaaaaaaaaaaa'},{recipient:'search@example.test'},{message_id:id},{id:null}])await rejects(async()=>worker('resend_lookup',{...lookupRequest(id),...patch}),'wrong lookup scope/extra fields denied '+JSON.stringify(patch));
 for(const role of ['anon','authenticated'])await rejects(async()=>sql(`set role ${role};select communications_provider_service('resend_lookup','${f.org}',${lit(JSON.stringify(lookupRequest(id)))});`),'untrusted '+role+' lookup denied');
 await rejects(async()=>sql(`set role service_role;select private.comm_provider_service_resend_v1('resend_receipt','${f.org}','{}');`),'renamed privileged helper direct call denied');
 await rejects(async()=>sql(`set role service_role;select communications_provider_service('resend_lookup','${randomUUID()}',${lit(JSON.stringify(lookupRequest(id)))});`),'cross organization lookup denied');
 let r=req(id),copy=r.clone();eq((await host.callback(r)).status,200,'raw signed callback + trusted lookup + durable SQL ACK');eq(row(id).status,'delivered','existing delivery ledger committed');eq((await host.callback(copy)).status,200,'same exact receipt replay ACK');eq(audit(id,'provider.resend_receipt'),1,'one immutable success audit for replay');
 id=await accepted();r=req(id,'email.suppressed');copy=r.clone();eq((await host.callback(r)).status,200,'suppressed host ACK only after durable hold');eq(row(id).status,'suppressed','suppressed through host canonical ledger');eq((await host.callback(copy)).status,200,'suppressed host replay deduplicates');eq(audit(id,'provider.resend_receipt'),1,'suppressed host replay one audit');sql("update communication_suppressions set active=false where reason='provider_suppressed';");
 id=await accepted();eq((await host.callback(req(id,'email.delivery_delayed'))).status,200,'delayed callback durably ACKed');eq(row(id).status,'sent','delay not delivery or retry');eq((await host.callback(req(id,'email.failed'))).status,200,'failed callback durably ACKed');eq(row(id).failure_class,'failed','failed host terminal failure');
 // Outbound/global kill does not destroy receipt authority for handed-off known attempts.
 sql('update communication_external_control set external_enabled=false;');
 eq((await host.callback(req(id,'email.complained'))).status,200,'receipt survives database outbound kill');eq(Number(sql(`select count(*) from communication_suppressions where organization_id='${f.org}' and reason='complaint' and active`)),1,'durable complaint suppression');sql('update communication_suppressions set active=false;update communication_external_control set external_enabled=true;');
 id=await accepted();r=req(id);const raced=createResendSourceHost({binding,receiptsEnabled:true,rpc:async(a,o,p)=>{const result=worker(a,p);if(a==='resend_lookup')sql(`update communication_provider_controls set resend_account_id='changed' where profile_id='${h.profile}'`);return result;}});
 eq((await raced.callback(r)).status,503,'lookup-to-receipt account drift denied by final SQL');eq(row(id).status,'sent','TOCTOU denial retains prior delivery state');eq(audit(id,'provider.resend_receipt'),0,'TOCTOU no success audit');sql(`update communication_provider_controls set resend_account_id='fictional-account' where profile_id='${h.profile}'`);
 id=await accepted();r=req(id);
 sql(`create function private.fail_host_audit()returns trigger language plpgsql as $$begin if new.kind='provider.resend_receipt' then raise exception 'injected failure';end if;return new;end$$;create trigger fail_host_audit before insert on communication_audit for each row execute function private.fail_host_audit();`);
 eq((await host.callback(r)).status,503,'audit failure never ACKed');eq(row(id).status,'sent','audit failure rolls back receipt');eq(audit(id,'provider.resend_receipt'),0,'audit failure no success evidence');sql('drop trigger fail_host_audit on communication_audit;drop function private.fail_host_audit();');
 // Real separate database sessions and host callbacks race; final RPC deduplicates.
 const asyncRpc=(action,org,payload)=>new Promise((resolve,reject)=>execFile(exe('psql'),[...args,'-c',`set role service_role;select communications_provider_service(${lit(action)},${lit(org)},${lit(JSON.stringify(payload))});`],{encoding:'utf8'},(e,out)=>e?reject(e):resolve(JSON.parse(out.trim()))));
 const parallel=createResendSourceHost({binding,receiptsEnabled:true,rpc:asyncRpc});r=req(id);const duplicate=r.clone();const rr=await Promise.all([parallel.callback(r),parallel.callback(duplicate)]);eq(rr.map(x=>x.status),[200,200],'separate connections concurrent duplicate callbacks ACK only committed outcomes');eq(audit(id,'provider.resend_receipt'),1,'concurrent duplicate single immutable audit');
 // A timeout is not database cancellation: a submitted transaction can finish late.
 id=await accepted();r=req(id);const retry=r.clone();let release,commitStarted;const barrier=new Promise(r=>{release=r}),beginCommit=new Promise(r=>{commitStarted=r});let eventual;
 const slow=createResendSourceHost({binding,receiptsEnabled:true,timeoutMs:20,rpc:async(a,o,p)=>{if(a==='resend_lookup')return worker(a,p);commitStarted();await barrier;return eventual=worker(a,p);}});
 const response=slow.callback(r);await beginCommit;eq((await response).status,503,'in-flight commit timeout gives retryable non-ACK');release();for(let i=0;i<100&&!eventual;i++)await new Promise(r=>setTimeout(r,1));eq(eventual.recorded,true,'already submitted operation may commit after timeout');eq((await host.callback(retry)).status,200,'provider replay of late commit deduplicates');eq(audit(id,'provider.resend_receipt'),1,'late commit and replay retain one audit');
 // Lookup waits on same authority lock, then observes committed profile change.
 id=await accepted();const lp=lookupRequest(id);
 const change=new Promise((resolve,reject)=>execFile(exe('psql'),[...args,'-c',`begin;select private.comm_external_lock('${f.org}');update communication_provider_controls set structured_callbacks=false where profile_id='${h.profile}';select pg_sleep(0.5);commit;`],{encoding:'utf8'},e=>e?reject(e):resolve()));
 let held=false;for(let i=0;i<100;i++){held=Number(sql("select count(*) from pg_stat_activity where query like 'begin;select private.comm_external_lock%' and wait_event='PgSleep'"))>0;if(held)break;await new Promise(r=>setTimeout(r,10));}eq(held,true,'independent profile mutation holds shared authority lock');await rejects(()=>asyncRpc('resend_lookup',f.org,lp),'blocked lookup observes committed revocation');await change;sql(`update communication_provider_controls set structured_callbacks=true where profile_id='${h.profile}'`);
 // Missing response cannot yield a lookup or a second send; no ID heuristic.
 isolate();const unknownId=queue();let lostCalls=0;const lost=createResendSourceHost({binding,rpc,outboundEnabled:true,receiptsEnabled:true,apiKey:'re_fictional_not_a_secret',fetchImpl:async()=>{lostCalls++;throw Error('response lost');}});await lost.worker({messageId:unknownId});eq(row(unknownId).failure_class,'uncertain','transport loss durable UNKNOWN');await lost.worker({messageId:unknownId});eq(lostCalls,1,'UNKNOWN never resent');await rejects(async()=>lookup(unknownId),'UNKNOWN without known ID cannot resolve');eq(attempts(unknownId),1,'UNKNOWN retains original attempt only');
 host.stopOutbound();const before=requests;eq((await host.worker()).mode,'disabled','host kill before claim');eq(requests,before,'host kill no fetch');host.retire();eq((await host.callback(req(id))).status,503,'retired callback disabled');
 console.log(JSON.stringify({status:'PASS',checks,provider:'fictional fixed transport and MAC, native isolated SQL',hosted:false}));
} finally {
 if(started)execFileSync(exe('pg_ctl'),['-D',data,'-m','fast','-w','stop'],{stdio:'ignore'});
 rmSync(root,{recursive:true,force:true});
}
