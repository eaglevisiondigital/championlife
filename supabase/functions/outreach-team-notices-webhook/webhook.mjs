import {strictJson} from '../outreach-team-notices-worker/json.mjs';
import {boundedBytes,databaseRpc,sha256} from '../outreach-team-notices-worker/worker.mjs';
// Svix HMAC-SHA256 format; raw bytes, timestamp and message ID are authenticated.
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
function base64(value){
 if(typeof value!=='string'||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw Error('Invalid signature');
 return Uint8Array.from(atob(value),c=>c.charCodeAt(0));
}
export async function verifyRawWebhook(bytes,headers,secret,now=Date.now()){
 const id=headers.get('svix-id'),ts=headers.get('svix-timestamp'),signatures=headers.get('svix-signature');
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(id||'')||!/^\d{10}$/.test(ts||'')||Math.abs(now/1000-Number(ts))>300
 ||typeof signatures!=='string'||signatures.length>2048||typeof secret!=='string'||!secret.startsWith('whsec_'))throw Error('Invalid webhook');
 const keyBytes=base64(secret.slice(6));if(keyBytes.length<16||keyBytes.length>64)throw Error('Invalid webhook configuration');
 const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const prefix=new TextEncoder().encode(id+'.'+ts+'.'),signed=new Uint8Array(prefix.length+bytes.length);signed.set(prefix);signed.set(bytes,prefix.length);
 const candidates=signatures.trim().split(/\s+/);if(candidates.length>8)throw Error('Invalid signature');
 for(const candidate of candidates){
  const pair=candidate.split(',');if(pair.length!==2||pair[0]!=='v1')continue;
  const signature=base64(pair[1]);
  if(await crypto.subtle.verify('HMAC',key,signature,signed))return {id,bodyDigest:await sha256(bytes)};
 }
 throw Error('Invalid signature');
}
export {strictJson} from '../outreach-team-notices-worker/json.mjs';
export function createWebhookHandler(config,{fetcher=fetch,rpc,now=Date.now}={}){
 const ready=['isolated_test','production'].includes(config.environment)&&!!config.providerAccount&&!!config.webhookSecret;
 let db=rpc;
 return async req=>{
  const reply=(status,state)=>new Response(JSON.stringify({state}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(req.method!=='POST')return reply(405,'unavailable');if(!ready)return reply(503,'disabled');
  try{
   const bytes=await boundedBytes(req),proof=await verifyRawWebhook(bytes,req.headers,config.webhookSecret,now());
   const event=strictJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(!['email.sent','email.delivered','email.delivery_delayed','email.failed','email.bounced','email.complained','email.suppressed'].includes(event.type))return reply(200,'ignored');
   if(!uuid(event.data?.email_id)||typeof event.created_at!=='string'||!Number.isFinite(Date.parse(event.created_at)))return reply(400,'invalid');
   db??=databaseRpc(config,fetcher);
   const result=await db('receipt',null,{receipt_id:proof.id,body_digest:proof.bodyDigest,provider_email_id:event.data.email_id,event_type:event.type,provider_at:event.created_at});
   return reply(200,result.state);
  }catch{return reply(400,'unconfirmed')}
 };
}
