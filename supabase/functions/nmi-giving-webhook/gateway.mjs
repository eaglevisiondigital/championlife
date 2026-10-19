import {dedicatedAcceptance} from '../_shared/payments/acceptance-pin.mjs';
import {verifyNmiWebhook,webhookProjection} from '../_shared/payments/nmi.mjs';
import {executeNmiGiving} from '../_shared/payments/nmi-executor.mjs';
const uuid=x=>/^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(x||'');
export function createGivingWebhook(config,fetcher=fetch,readSecret=(_name)=> ''){
 return async req=>{
  const reply=(status,x)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(req.method!=='POST')return reply(405,{accepted:false});if(!dedicatedAcceptance(config)||!config.enabled||!config.serviceKey)return reply(503,{accepted:false});
  try{
   const u=new URL(req.url),org=u.searchParams.get('organization'),gateway=u.searchParams.get('gateway');if(!uuid(org)||!uuid(gateway))throw Error();
   const rpc=async(action,o,p)=>{const r=await fetcher(config.project+'/rest/v1/rpc/nmi_giving_service',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.serviceKey,Authorization:'Bearer '+config.serviceKey},body:JSON.stringify({p_action:action,p_org:o,p_payload:p}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();return r.json()};
   const reader=req.body?.getReader();if(!reader)throw Error();let n=0;const parts=[];for(;;){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>262144){await reader.cancel();throw Error()}parts.push(r.value)}const bytes=new Uint8Array(n);let at=0;for(const b of parts){bytes.set(b,at);at+=b.length}const raw=new TextDecoder().decode(bytes);
   const secret=readSecret('PAYMENTS_'+gateway.replaceAll('-','').toUpperCase()+'_SANDBOX_WEBHOOK_V1');
   if(!await verifyNmiWebhook(raw,req.headers.get('Webhook-Signature'),secret))throw Error();
   const event=webhookProjection(raw),scope=await rpc('webhook_scope',org,{gateway_id:gateway});if(event.merchant_reference!==scope.merchant_reference)throw Error();
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
   // Only the optional documented subscription identity is projected; no raw event persistence.
   const parsed=JSON.parse(raw),subscription=parsed.event_body?.subscription?.id;
   const payload={gateway_id:gateway,event_id:event.event_id,digest,merchant_reference:event.merchant_reference,processor_id:event.processor_id,provider_reference:event.provider_reference,kind:event.kind,status:event.status};
   if(typeof subscription==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(subscription))payload.subscription_reference=subscription;
   const accepted=await rpc('webhook',org,payload);
   if(accepted.lookup_id)await executeNmiGiving({config,organization_id:org,session_id:accepted.session_id,id:accepted.lookup_id,rpc,fetcher,readSecret});
   return reply(200,{accepted:true,duplicate:accepted.duplicate===true});
  }catch{return reply(409,{accepted:false,retry_automatically:false})}
 };
}
