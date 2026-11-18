import {strictJson} from './json.mjs';
// Inactive unless BOTH explicit server configuration and current DB policy allow.
// No P0 import, scheduler, retry loop, draft import or activation endpoint.
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const hex=b=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');
export const sha256=async bytes=>hex(await crypto.subtle.digest('SHA-256',typeof bytes==='string'?new TextEncoder().encode(bytes):bytes));
export function databaseRpc(config,fetcher=fetch){
 if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.url||'')||!config.serviceKey)throw Error('Database configuration unavailable');
 return async(action,campaign,payload)=>{
  const r=await fetcher(config.url+'/rest/v1/rpc/outreach_team_notice_worker',{method:'POST',
   headers:{apikey:config.serviceKey,Authorization:'Bearer '+config.serviceKey,'Content-Type':'application/json'},
   body:JSON.stringify({p_action:action,p_campaign:campaign,p_payload:{...payload,environment:config.environment,provider_account:config.providerAccount}}),
   signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('Database operation unavailable');
  return r.json();
 };
}
export async function runOne({campaign,rpc,send}){
 if(!uuid(campaign))throw Error('Explicit campaign required');
 const lease=await rpc('claim',campaign,{});
 if(lease.state!=='leased')return {state:lease.state};
 if(!uuid(lease.intent_id)||!uuid(lease.lease_token)||lease.provider_key!=='outreach-team-v1/'+lease.intent_id)throw Error('Invalid claim');
 const envelope={intent_id:lease.intent_id,lease_token:lease.lease_token};
 const started=await rpc('start',campaign,envelope);
 if(started.state!=='in_flight')return {state:started.state};
 let providerId=null;
 try{
  if(!uuid(started.attempt_id)||typeof started.payload_json!=='string'||started.payload_digest!==lease.payload_digest
   ||await sha256(started.payload_json)!==started.payload_digest||started.provider_key!==lease.provider_key)throw Error('Frozen payload integrity');
  // One POST only. Any uncertain/non-success response is held, never auto-retried.
  const response=await send(started.payload_json,lease.provider_key);
  if(response?.ok===true&&uuid(response.id))providerId=response.id;
 }catch{/* No inference that the provider did not accept the request. */}
 try{
  return await rpc('result',campaign,{...envelope,attempt_id:started.attempt_id,provider_email_id:providerId});
 }catch{
  // Start was committed. Expired in-flight lease must enter DB reconciliation HOLD.
  return {state:'hold',code:'result_persistence_unknown'};
 }
}
// Separate GET-only capability. Never used by runOne and never retries a POST.
export async function reconcileOne({campaign,intentId,providerId,reviewId,rpc,lookup,now=Date.now}){
 if(!uuid(campaign)||!uuid(intentId)||!uuid(providerId)||!Number.isSafeInteger(reviewId)||reviewId<1)throw Error('Explicit reviewed lookup required');
 const envelope={intent_id:intentId,provider_email_id:providerId,review_id:reviewId};
 const context=await rpc('lookup_context',campaign,envelope);
 if(context.state!=='lookup_authorized')return {state:'hold',code:'lookup_not_authorized'};
 try{
  if(!uuid(context.lookup_token)||typeof context.payload_json!=='string'||await sha256(context.payload_json)!==context.payload_digest
   ||context.provider_key!=='outreach-team-v1/'+intentId)throw Error('Frozen lookup context');
  const payload=JSON.parse(context.payload_json),record=await lookup(providerId);
  // GET evidence must prove the exact frozen recipients/copy/tag and attempt time.
  const created=Date.parse(record.created_at),started=Date.parse(context.attempt_started_at);
  if(!['sent','delivered','delivery_delayed','failed','bounced','complained','suppressed'].includes(record.last_event)
   ||record.id!==providerId||record.from!==payload.from||record.subject!==payload.subject||record.text!==payload.text
   ||JSON.stringify(record.to)!==JSON.stringify(payload.to)||JSON.stringify(record.reply_to)!==JSON.stringify([payload.reply_to])
   ||JSON.stringify(record.tags)!==JSON.stringify(payload.tags)||record.bcc?.length!==0||record.cc?.length!==0
   ||record.scheduled_at!==null||!Number.isFinite(created)||created<started-300000||created>now()+300000
   ||(record.html!==null&&record.html!==''))throw Error('Provider record does not prove frozen request');
  return await rpc('lookup_result',campaign,{...envelope,lookup_token:context.lookup_token,payload_digest:context.payload_digest,
   evidence_digest:await sha256(JSON.stringify(record)),last_event:record.last_event});
 }catch{return {state:'hold',code:'provider_lookup_unconfirmed'}}
}
export async function boundedBytes(req,max=65536){
 const length=req.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>max))throw Error('Request size');
 const reader=req.body?.getReader();if(!reader)throw Error('Missing body');
 let size=0,chunks=[],expired=false;const timer=setTimeout(()=>{expired=true;reader.cancel().catch(()=>{})},5000);
 try{for(;;){const part=await reader.read();if(expired)throw Error('Request timeout');if(part.done)break;size+=part.value.length;if(size>max)throw Error('Request size');chunks.push(part.value)}}finally{clearTimeout(timer);await reader.cancel().catch(()=>{});reader.releaseLock()}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}return bytes;
}
const reply=(status,state)=>new Response(JSON.stringify(state),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function createWorkerHandler(config,{fetcher=fetch,rpc,send}={}){
 const enabled=config.mode==='owner-reviewed'&&['isolated_test','production'].includes(config.environment)
  &&typeof config.providerAccount==='string'&&config.providerAccount.length>0
  &&typeof config.invokeSecret==='string'&&config.invokeSecret.length>=32&&!!config.resendKey;
 let db=rpc;
 return async req=>{
  if(req.method!=='POST')return reply(405,{state:'unavailable'});
  if(!enabled)return reply(503,{state:'disabled'});
  // A dedicated invocation credential is independent of staff and provider keys.
  const presented=req.headers.get('authorization')||'';
  if(!/^Bearer [^\s]{32,512}$/.test(presented)||await sha256(presented)!==await sha256('Bearer '+config.invokeSecret))return reply(403,{state:'unavailable'});
  try{
   const input=strictJson(new TextDecoder('utf-8',{fatal:true}).decode(await boundedBytes(req,2048)));
   if(!input||!uuid(input.campaign))return reply(400,{state:'unavailable'});
   db??=databaseRpc(config,fetcher);
   if(input.action==='reconcile'){
    if(config.reconciliationMode!=='owner-reviewed-read'||!config.providerReadKey
     ||Object.keys(input).some(k=>!['action','campaign','intent_id','provider_email_id','review_id'].includes(k)))return reply(403,{state:'hold'});
    return reply(200,await reconcileOne({campaign:input.campaign,intentId:input.intent_id,providerId:input.provider_email_id,reviewId:input.review_id,rpc:db,
     lookup:async id=>{const r=await fetcher('https://api.resend.com/emails/'+id,{headers:{Authorization:'Bearer '+config.providerReadKey},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Lookup unavailable');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await boundedBytes(r,65536)))}}));
   }
   if(Object.keys(input).length!==1)return reply(400,{state:'unavailable'});
   const sender=send||(async(body,key)=>{
    const r=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.resendKey,
     'Content-Type':'application/json','Idempotency-Key':key},body,signal:AbortSignal.timeout(10000)});
    const value=await r.json().catch(()=>null);return {ok:r.ok,id:value?.id};
   });
   return reply(200,await runOne({campaign:input.campaign,rpc:db,send:sender}));
  }catch{return reply(503,{state:'hold',code:'operation_unconfirmed'})}
 };
}
