import assert from'node:assert/strict';import{createHmac,randomUUID as uuid}from'node:crypto';
import{createWorkerHandler,runOne,reconcileOne,sha256}from'../../supabase/functions/outreach-team-notices-worker/worker.mjs';
import{createWebhookHandler,verifyRawWebhook,strictJson}from'../../supabase/functions/outreach-team-notices-webhook/webhook.mjs';
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)};
const rejects=async(fn,m)=>{await assert.rejects(fn);ok(true,m)};
const id=uuid(),campaign=uuid(),lease=uuid(),attempt=uuid(),email=uuid(),secret='SYNTHETIC_INVOCATION_SECRET_32_CHARS_ONLY';
const payload=JSON.stringify({from:'outreach@auth.championlifefwb.com',to:['synthetic@example.test'],reply_to:'synthetic@example.test',subject:'Synthetic test only',text:'No live message',tags:[{name:'p1_intent',value:id}]});
const digest=await sha256(payload),claim={state:'leased',intent_id:id,lease_token:lease,provider_key:'outreach-team-v1/'+id,payload_digest:digest};
const start={state:'in_flight',attempt_id:attempt,payload_json:payload,provider_key:claim.provider_key,payload_digest:digest};
let calls=0;const forbidden=async()=>{calls++;throw Error('No network or DB allowed')};
const request=(body=JSON.stringify({campaign}),token=secret)=>new Request('https://fixture.test/worker',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body});
for(const config of [{},{mode:'owner-reviewed'},{mode:'owner-reviewed',environment:'isolated_test',providerAccount:'fixture',invokeSecret:secret}]){
 const h=createWorkerHandler(config,{fetcher:forbidden,rpc:forbidden,send:forbidden});ok((await h(request())).status===503,'missing gate keeps HTTP worker disabled');
}ok(calls===0,'inactive factory performs zero provider/database operations');
const config={mode:'owner-reviewed',environment:'isolated_test',providerAccount:'fixture',invokeSecret:secret,resendKey:'synthetic-noncredential'};
ok((await createWorkerHandler(config,{rpc:forbidden})(request(undefined,'not-authorized-token'))).status===403,'staff/unapproved token is not worker invocation authority');
ok(calls===0,'invocation denial has zero DB operations');
ok((await createWorkerHandler(config,{rpc:forbidden})(request('{"campaign":"'+campaign+'","campaign":"'+uuid()+'"}'))).status!==200,'duplicate worker campaign keys rejected before DB');
ok(calls===0,'ambiguous worker JSON causes no DB operation');
for(const [response,label]of[[{ok:true,id:email},'accepted'],[{ok:false,id:email},'non-success'],[{ok:true,id:'not-an-id'},'invalid ID'],[null,'empty']]){
 let posts=0,resultArgs;const rpc=async(a,c,p)=>a==='claim'?claim:a==='start'?start:(resultArgs=p,{state:p.provider_email_id?'accepted':'hold'});
 const r=await runOne({campaign,rpc,send:async(body,key)=>{posts++;ok(body===payload&&key===claim.provider_key,label+' uses frozen bytes and stable key');return response}});
 ok(posts===1,label+' issues at most one provider call');ok(r.state===(label==='accepted'?'accepted':'hold'),label+' accurately records acceptance or HOLD');
 ok(resultArgs.attempt_id===attempt&&resultArgs.lease_token===lease,label+' result bound to exact attempt/lease');
}
for(const mode of ['timeout','crash_before_persistence','changed_payload','changed_key']){
 let posts=0,resultArgs;const rpc=async(a,c,p)=>{if(a==='claim')return claim;if(a==='start')return {...start,...(mode==='changed_payload'?{payload_json:'{}'}:{}),...(mode==='changed_key'?{provider_key:'new-key'}:{})};resultArgs=p;if(mode==='crash_before_persistence')throw Error('DB unavailable');return{state:'hold'}};
 const r=await runOne({campaign,rpc,send:async()=>{posts++;if(mode==='timeout')throw Error('Unknown accepted outcome');return{ok:true,id:email}}});
 ok(r.state==='hold',mode+' stays held');ok(posts===(mode.startsWith('changed_')?0:1),mode+' never retries or sends altered bytes');ok(!!resultArgs,mode+' attempts durable outcome recording');
}
let post=0;ok((await runOne({campaign,rpc:async()=>({state:'disabled'}),send:async()=>post++})).state==='disabled'&&post===0,'DB disabled gate prevents send');
const vectorBody='{"event_type":"ping","data":{"success":true}}';
const vectorHeaders=new Headers({'svix-id':'msg_loFOjxBNrRLzqYUf','svix-timestamp':'1731705121','svix-signature':'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0='});
ok((await verifyRawWebhook(new TextEncoder().encode(vectorBody),vectorHeaders,'whsec_plJ3nmyCDGBKInavdOK15jsl',1731705121000)).id==='msg_loFOjxBNrRLzqYUf','official published Svix vector verifies with fixed fixture clock');
await rejects(()=>verifyRawWebhook(new TextEncoder().encode(vectorBody+' '),vectorHeaders,'whsec_plJ3nmyCDGBKInavdOK15jsl',1731705121000),'one changed raw byte invalidates signature');
await rejects(()=>verifyRawWebhook(new TextEncoder().encode(vectorBody),vectorHeaders,'whsec_plJ3nmyCDGBKInavdOK15jsl',1731705422000),'stale signed timestamp rejected');
const webhookSecret='whsec_'+Buffer.alloc(32,7).toString('base64'),now=Date.now(),ts=String(Math.floor(now/1000));
function signed(body,changes={}){
 const headers={'svix-id':'msg_fixture_1','svix-timestamp':ts,...changes};headers['svix-signature']=changes['svix-signature']||'v1,'+createHmac('sha256',Buffer.alloc(32,7)).update(headers['svix-id']+'.'+headers['svix-timestamp']+'.'+body).digest('base64');
 return new Request('https://fixture.test/hook',{method:'POST',headers,body});
}
const event=JSON.stringify({type:'email.delivered',created_at:new Date(now).toISOString(),data:{email_id:email,to:['DO-NOT-STORE@example.test'],body:'UNTRUSTED PRIVATE PROVIDER BODY'}});
let receiptArgs;const hook=createWebhookHandler({environment:'isolated_test',providerAccount:'fixture',webhookSecret},{now:()=>now,rpc:async(a,c,p)=>{receiptArgs={a,c,p};return{state:'recorded'}}});
ok((await hook(signed(event))).status===200,'valid raw-body signature permits durable receipt ingestion');
ok(receiptArgs.a==='receipt'&&receiptArgs.c===null&&Object.keys(receiptArgs.p).sort().join(',')==='body_digest,event_type,provider_at,provider_email_id,receipt_id','webhook forwards only redacted bounded evidence');
ok(!JSON.stringify(receiptArgs).includes('DO-NOT-STORE')&&!JSON.stringify(receiptArgs).includes('UNTRUSTED'),'provider recipients/bodies are not retained or executed');
for(const [body,headers]of[[event,{'svix-signature':'v1,AAAA'}],[event,{'svix-id':'bad,id'}],[event,{'svix-timestamp':String(Number(ts)-301)}],[event,{'svix-timestamp':String(Number(ts)+301)}],
 ['{"type":"email.sent","type":"email.delivered","created_at":"2026-01-01","data":{"email_id":"'+email+'"}}',{}],
 ['{"type":"email.delivered","created_at":"2026-01-01","data":{"email_id":"'+email+'","email_id":"'+uuid()+'"}}',{}],
 ['{"__proto__":{"admin":true}}',{}],[event.replace(email,'wrong-provider-id'),{}]]){
 receiptArgs=null;ok((await hook(signed(body,headers))).status===400,'invalid/replayed/malformed/duplicate receipt rejected');ok(receiptArgs===null,'denied webhook causes no DB trust write');
}
ok((await createWebhookHandler({},{rpc:forbidden})(signed(event))).status===503,'unconfigured webhook disabled');
ok((await createWebhookHandler({environment:'isolated_test',providerAccount:'fixture',webhookSecret},{now:()=>now,rpc:async()=>{throw Error('Persistence failed')}})(signed(event))).status!==200,'persistence error never acknowledged as stored');
for(const text of ['{"x":1,"x":2}','{"data":{"email_id":"a","email_id":"b"}}','{"constructor":{}}','[1,]','{} true','{"x":NaN}','['.repeat(22)+'0'+']'.repeat(22)]){
 assert.throws(()=>strictJson(text));ok(true,'strict signed JSON rejects ambiguity/depth/prototype input');
}
ok(strictJson('{"a":[true,false,null,1.5,-2e3],"b":"escaped\\\\value"}').a.length===5,'strict parser preserves valid signed JSON');
const lookupContext={state:'lookup_authorized',lookup_token:uuid(),payload_json:payload,payload_digest:digest,provider_key:claim.provider_key,attempt_started_at:new Date(now).toISOString()};
const frozen=JSON.parse(payload),record={id:email,...frozen,reply_to:[frozen.reply_to],created_at:new Date(now).toISOString(),last_event:'delivered',cc:[],bcc:[],html:null,scheduled_at:null};
let lookupResult;
const lookupRpc=async(a,c,p)=>a==='lookup_context'?lookupContext:(lookupResult=p,{state:'accepted'});
ok((await reconcileOne({campaign,intentId:id,providerId:email,reviewId:1,rpc:lookupRpc,lookup:async()=>record,now:()=>now})).state==='accepted','GET-only reconciliation verifies exact frozen tagged provider record');
ok(lookupResult.payload_digest===digest&&lookupResult.lookup_token===lookupContext.lookup_token,'lookup evidence CAS-bound to frozen payload and manual review');
for(const change of [{id:uuid()},{to:['wrong@example.test']},{text:'different'},{tags:[]},{reply_to:[]},{bcc:['hidden@example.test']},{last_event:null},{last_event:'unknown'},{created_at:'1990-01-01T00:00:00Z'},{scheduled_at:new Date().toISOString()}]){
 lookupResult=null;ok((await reconcileOne({campaign,intentId:id,providerId:email,reviewId:1,rpc:lookupRpc,lookup:async()=>({...record,...change}),now:()=>now})).state==='hold','wrong/incomplete provider lookup proof stays held');ok(lookupResult===null,'unproven lookup never binds email or acceptance');
}
console.log(n+' notification HTTP/cryptographic/adversarial checks passed; no provider network use');
