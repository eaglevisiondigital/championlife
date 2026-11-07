// Local WASM PostgreSQL syntax/transaction checks; not native concurrency proof.
import assert from 'node:assert/strict';import{PGlite}from'../backend-tests/node_modules/@electric-sql/pglite/dist/index.js';import{readFileSync}from'node:fs';import{randomUUID}from'node:crypto';import{migrationOrder}from'../backend-tests/migration-order.mjs';import{f,h,fixtureSQL,activationFixtureSQL}from'../backend-tests/activation-fixture.mjs';
const db=new PGlite(),q=(s,p=[])=>db.query(s,p);let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;console.log('PASS '+m)},deny=async(fn,m)=>{await assert.rejects(fn);checks++;console.log('PASS '+m)};
const as=async(role='authenticated')=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[f.user]);await db.exec('set role '+role)},owner=()=>db.exec('reset role');
const rpc=(a,p={})=>q('select communications_provider_workspace($1,$2,$3) v',[a,f.org,p]).then(r=>r.rows[0].v),svc=(a,p={})=>q('select communications_provider_service($1,$2,$3) v',[a,f.org,p]).then(r=>r.rows[0].v);
try{
await db.exec(readFileSync(new URL('../backend-tests/fixtures/supabase-test-bootstrap.sql',import.meta.url),'utf8'));await db.exec(readFileSync(new URL('../../supabase/bootstrap/automatic-rls.sql',import.meta.url),'utf8'));for(const file of migrationOrder)await db.exec(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));await db.exec(fixtureSQL+activationFixtureSQL);
await db.exec(readFileSync(new URL('../../supabase/migrations/20261101214121_communications_receipt_reconciliation.sql',import.meta.url),'utf8'));
await as();const v=await rpc('verify_request',{id:h.profile});await as('service_role');await svc('verify_result',{id:h.profile,revision:v.revision,actor:f.user,environment:'acceptance',project_ref:h.ref,configured:true,verified:true});await as();await rpc('enable',{id:h.profile,mode:'test_only'});await rpc('org_delivery',{enabled:true,email_enabled:true,sms_enabled:false});await rpc('global_delivery',{enabled:true});await owner();await q('update communication_provider_controls set structured_callbacks=true');
const unknown=async()=>{await owner();await q("update communication_provider_controls set enabled=true,mode='test_only',consecutive_failures=0");await as();const p=await rpc('test_preview',{id:h.profile,person_id:f.person});await rpc('test_confirm',{id:h.profile,person_id:f.person,request_key:randomUUID(),confirmed:true,preview_subject:p.subject,preview_body:p.body,preview_recipient:p.recipient});await as('service_role');const j=(await svc('claim_external')).messages[0];await svc('authorize_external',{message_id:j.id,lease_token:j.lease_token});await svc('result_external',{message_id:j.id,lease_token:j.lease_token,outcome:'uncertain'});await owner();const a=(await q('select id from communication_attempts where message_id=$1',[j.id])).rows[0];await as('service_role');return{id:h.profile,event_id:randomUUID(),provider:'smtp_transport',environment:'acceptance',project_ref:h.ref,message_id:j.id,attempt_id:a.id,idempotency_key:j.idempotency_key,provider_message_id:'receipt:'+j.id,outcome:'sent'}};
let p=await unknown();
const profile=await svc('profile',{id:h.profile});
const context={profile_id:profile.profile_id,organization_id:profile.organization_id,environment:profile.environment,project_ref:profile.project_ref,provider:profile.sender.provider,channel:profile.sender.channel,from_address:profile.sender.from_address,reply_to:profile.sender.reply_to??null};
p.callback_context=context;
await owner();await q("update communication_sender_profiles set from_address='changed@example.test' where id=$1",[h.profile]);await as('service_role');
if(process.env.REPRODUCE_PRIOR==='1'){
 eq((await svc('reconcile_external',p)).outcome,'sent','BEFORE stale sender context accepted and UNKNOWN resolved');
}else{
 await owner();await db.exec(readFileSync(new URL('../../supabase/migrations/20261101231457_communications_callback_context.sql',import.meta.url),'utf8'));await as('service_role');
 await deny(()=>svc('reconcile_external',p),'AFTER stale sender context cannot resolve UNKNOWN');
 await owner();eq((await q('select failure_class from communication_outbox where id=$1',[p.message_id])).rows[0].failure_class,'uncertain','rejected context preserves UNKNOWN');eq((await q('select count(*)::int n from communication_callbacks where event_id=$1',[p.event_id])).rows[0].n,0,'rejected context leaves no receipt/audit success');
 await q('update communication_sender_profiles set from_address=$1 where id=$2',[context.from_address,h.profile]);await as('service_role');
 for(const key of Object.keys(context))await deny(()=>svc('reconcile_external',{...p,callback_context:{...context,[key]:'changed'}}),'current context mismatch '+key);
 for(const bad of [null,{},undefined,{...context,extra:true}])await deny(()=>svc('reconcile_external',{...p,callback_context:bad}),'missing/extra context denied');
 await deny(()=>q("select private.comm_provider_service_receipt_v1('reconcile_external',$1,$2)",[f.org,p]),'renamed helper cannot bypass context');
 await as();await deny(()=>svc('reconcile_external',p),'authenticated cannot reconcile');await as('service_role');
 // Real endpoint normalization creates context from its SQL profile, never from raw provider data.
 const {verifiedProviderEvent}=await import('../../supabase/functions/_shared/communications/activation.mjs');
 const binding={profile_id:profile.profile_id,organization_id:profile.organization_id,environment:profile.environment,project_ref:profile.project_ref,provider:profile.sender.provider,from:profile.sender.from_address,reply_to:profile.sender.reply_to??null};
 const event={type:'reconciliation',event_id:p.event_id,provider:p.provider,environment:p.environment,project_ref:p.project_ref,message_id:p.message_id,attempt_id:p.attempt_id,idempotency_key:p.idempotency_key,provider_message_id:p.provider_message_id,status:p.outcome,callback_context:{organization_id:'forged'}};
 const normalized=await verifiedProviderEvent('{}',new Headers(),profile,binding,async()=>event);
 eq(normalized.payload.callback_context,context,'actual callback helper overwrites provider-supplied context with SQL profile');
 await owner();await q('update communication_provider_controls set enabled=false where profile_id=$1',[h.profile]);await q("update communication_consents set status='revoked' where purpose='transactional'");await as('service_role');
 eq((await svc(normalized.action,{id:h.profile,...normalized.payload})).outcome,'sent','current-bound receipt still reconciles after sending/consent stop');
 eq((await svc(normalized.action,{id:h.profile,...normalized.payload})).duplicate,true,'same context receipt replay remains idempotent');
 const delivery={id:h.profile,callback_context:context,event_id:'current-delivery',provider:p.provider,provider_message_id:p.provider_message_id,attempt_id:p.attempt_id,outcome:'delivered'};
 await deny(()=>svc('callback_external',{...delivery,callback_context:null}),'delivery path also requires context');
 eq((await svc('callback_external',delivery)).recorded,true,'bound delivery path records existing accepted receipt');
 await deny(()=>svc('keyword_external',{id:h.profile,provider:p.provider,callback_context:{}}),'keyword path cannot omit context');
 await owner();const acl=(await q("select has_function_privilege('anon','private.comm_provider_service(text,uuid,jsonb)','EXECUTE') a,has_function_privilege('authenticated','private.comm_provider_service(text,uuid,jsonb)','EXECUTE') u,has_function_privilege('service_role','private.comm_provider_service(text,uuid,jsonb)','EXECUTE') s")).rows[0];eq(acl,{a:false,u:false,s:true},'exact service-only ACL preserved');
 console.log(JSON.stringify({checks,status:'PASS',engine:'PGlite; concurrency NOT RUN'}));
}
}finally{await db.close()}
