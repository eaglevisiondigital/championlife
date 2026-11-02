// Unmounted source composition. No fetch default, env reads, secrets, listener or registry.
// Only a separately approved host may inject private RPC/fetch capabilities and bindings.
import {resendAdapter,resendReceipt} from './resend.mjs';
import {runExternalWorker} from './activation.mjs';
const SEND_URL='https://api.resend.com/emails';
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s);
const denied=()=>Object.assign(Error('Resend host unavailable'),{failure:'uncertain'});
const check=signal=>{if(signal?.aborted)throw denied();};
async function deadline(milliseconds,outer,operation){
 if(!Number.isSafeInteger(milliseconds)||milliseconds<1||milliseconds>15000)throw denied();
 check(outer);const controller=new AbortController();let reject;
 const cancelled=new Promise((_,r)=>{reject=r;});
 const stop=()=>{controller.abort();reject(denied());};
 const timer=setTimeout(stop,milliseconds);outer?.addEventListener('abort',stop,{once:true});
 try{return await Promise.race([Promise.resolve().then(()=>{check(controller.signal);return operation(controller.signal);}),cancelled]);}
 finally{clearTimeout(timer);outer?.removeEventListener('abort',stop);}
}
async function bytes(stream,signal,limit){
 const reader=stream?.getReader();if(!reader)throw denied();let size=0;const chunks=[];
 const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
 try{for(;;){check(signal);const {done,value}=await reader.read();check(signal);if(done)break;
  if(!(value instanceof Uint8Array)||(size+=value.byteLength)>limit)throw denied();chunks.push(value.slice());
 }const raw=new Uint8Array(size);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.length;}return raw;
 }catch(e){cancel();throw e;}finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
}
export function fixedResendTransport({fetchImpl,accountId,apiKey,enabled=false,signal,timeoutMs=8000}={}){
 // Never use ambient fetch. No URL, host, redirects, auth header or account from jobs.
 return async request=>{
  if(enabled!==true||typeof fetchImpl!=='function'||typeof accountId!=='string'||!accountId||
   typeof apiKey!=='string'||!/^re_[A-Za-z0-9_-]{8,256}$/.test(apiKey)||
   request?.method!=='POST'||request.path!=='/emails'||request.account_id!==accountId||
   typeof request.body!=='string'||new TextEncoder().encode(request.body).length>65536||
   !request.headers||Object.keys(request.headers).length!==1||!/^cl-resend-[a-f0-9]{64}$/.test(request.headers['Idempotency-Key']||''))throw denied();
  // Copy every value before awaits. Authorization is supplied only by private config.
  const body=request.body,key=request.headers['Idempotency-Key'];
  return deadline(timeoutMs,signal,async operationSignal=>{
   const response=await fetchImpl(SEND_URL,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',
    headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':key},body,signal:operationSignal});
   if(operationSignal.aborted){void response?.body?.cancel().catch(()=>{});throw denied();}
   if(!response||response.redirected||response.url&&response.url!==SEND_URL||!Number.isInteger(response.status)||response.status<200||response.status>=300&&response.status<400)throw denied();
   const raw=await bytes(response.body,operationSignal,8192);check(operationSignal);
   // Never return raw provider error text, credentials or payloads to H1/logs.
   let parsed;try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw));}catch{throw denied();}
   return {status:response.status,body:uuid(parsed?.id)?{id:parsed.id}:{}};
  });
 };
}
export function createResendSourceHost({binding,rpc,fetchImpl,apiKey,outboundEnabled=false,receiptsEnabled=false,timeoutMs=8000}={}){
 const b=structuredClone(binding),outbound=new AbortController(),ingress=new AbortController();
 if(!b||b.provider!=='resend_email'||!uuid(b.organization_id)||!uuid(b.profile_id)||typeof rpc!=='function')throw denied();
 const call=(action,payload)=>rpc(action,b.organization_id,payload);
 const request=fixedResendTransport({fetchImpl,accountId:b.account_id,apiKey,enabled:outboundEnabled,signal:outbound.signal,timeoutMs});
 const adapter=resendAdapter(b,{enabled:outboundEnabled,request});
 const reply=(status,text)=>new Response(text,{status,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}});
 return Object.freeze({
  stopOutbound(){outbound.abort();},
  retire(){outbound.abort();ingress.abort();},
  async worker({messageId=''}={}){
   if(outboundEnabled!==true||outbound.signal.aborted)return{mode:'disabled',processed:0};
   return runExternalWorker((action,org,payload)=>{if(org!==b.organization_id)throw denied();return call(action,payload);},b.organization_id,
    async profile=>{if(profile?.id!==b.profile_id||profile.organization_id!==b.organization_id||profile.provider!==b.provider)throw denied();return adapter;},
    {enabled:true,runtime:{environment:b.environment,project_ref:b.project_ref},messageId,signal:outbound.signal});
  },
  async callback(req){
   if(receiptsEnabled!==true||b.structured_callbacks!==true||ingress.signal.aborted)return reply(503,'Disabled');
   if(req.method!=='POST')return reply(405,'Unavailable');
   try{return await deadline(timeoutMs,AbortSignal.any([ingress.signal,req.signal]),async signal=>{
    // Content-Length is untrusted; enforce cap on actual unchanged stream bytes.
    const raw=await bytes(req.body,signal,8192);check(signal);
    const receipt=await resendReceipt(raw,req.headers,b,async query=>{
     check(signal);
     // Only verified MAC output can reach this resolver. Never tags/address search.
     if(query.profile_id!==b.profile_id||query.organization_id!==b.organization_id||query.provider!==b.provider||!uuid(query.provider_message_id))throw denied();
     const result=await call('resend_lookup',{id:b.profile_id,provider_message_id:query.provider_message_id,provider:b.provider,
      account_id:b.account_id,environment:b.environment,project_ref:b.project_ref});check(signal);return result;
    });check(signal);
    const result=await call('resend_receipt',receipt.payload);check(signal);
    // Existing final SQL is authoritative and returns only after its transaction.
    if(result?.retry_allowed!==false||!(result.recorded===true||result.duplicate===true))throw denied();
    return reply(200,'Recorded');
   });}catch{return reply(503,'Receipt unavailable');}
  }
 });
}
