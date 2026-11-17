import {fingerprint} from '../outreach-partner-submit/gateway.mjs';
const originAllowed='https://championlifefwb.com',action='minden_volunteer',host='championlifefwb.com';
const generic='We could not complete your application. Check your information and try again.';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Frozen template v1. Its payload and deterministic key must remain stable on retry.
export function confirmationV1(p){
 if(p.version!==1)throw Error('Unknown mail version');
 const title='Minden volunteer application received';
 const paragraphs=[`Hello ${p.first_name},`,'We received your volunteer application for the SOWGO outreach in Minden, Louisiana, on Saturday, December 19, 2026.',`Application reference: ${p.reference}`,'Your application is pending team selection. This is not confirmation of team approval or a vehicle assignment.','We will contact you once the team has been picked.','Travel, meeting, lodging, and final times will be confirmed by the outreach team.','Please only fill out the form once. Thank you for your willingness to serve!'];
 return {from:'SOWGO Outreach <outreach@auth.championlifefwb.com>',to:[p.email],subject:title,text:paragraphs.join('\n\n'),html:`<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><title>${title}</title></head><body style="margin:0;background:#f1f5f9;color:#142c48"><div lang="en" dir="ltr" style="max-width:600px;margin:auto;padding:28px;font:16px/1.6 Arial,sans-serif;background:#fff;color:#142c48"><h1 style="font-size:26px">${title}</h1>${paragraphs.map(t=>'<p>'+escape(t)+'</p>').join('')}<p><a style="color:#123d67" href="https://championlifefwb.com/minden-serve.html">Minden volunteer application details</a></p></div></body></html>`};
}
export function createVolunteerHandler(config,fetcher=fetch){
 const ready=config.enabled===true&&/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.url||'')&&!!config.serviceKey&&(config.pepper||'').length>=32&&!!config.resendKey&&!!config.turnstileSecret&&!/^[123]x0+AA$/.test(config.turnstileSecret);
 const rpc=async(name,args,token=config.serviceKey)=>{const r=await fetcher(config.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:config.serviceKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Object.assign(Error('Database unavailable'),{status:r.status});return r.json()};
 async function deliver(id){
  const c=await rpc('outreach_volunteer_delivery',{p_action:'claim',p_id:id});if(c.state!=='claimed')return c.state;
  let result;
  try{
   const r=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.resendKey,'Content-Type':'application/json','Idempotency-Key':c.key},body:JSON.stringify(confirmationV1(c.payload)),signal:AbortSignal.timeout(10000)});
   const data=await r.json().catch(()=>({}));
   if(r.ok&&uuid(data.id))result={state:'accepted',provider_id:data.id};
   else result={state:(r.status===429||r.status>=500||(r.status===409&&data.name==='concurrent_idempotent_requests'))?'pending':'failed',error:'Provider HTTP '+r.status};
  }catch{result={state:'pending',error:'Provider response not confirmed'};}
  await rpc('outreach_volunteer_delivery',{p_action:'result',p_id:id,p_lease:c.lease,p_data:result});return result.state;
 }
 return async req=>{
  const origin=req.headers.get('origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(origin!==originAllowed)return reply(403,{accepted:false,message:generic});
  Object.assign(headers,{'Access-Control-Allow-Origin':originAllowed,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, apikey'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply(405,{accepted:false,message:generic});
  if(!ready)return reply(503,{accepted:false,message:'Applications are temporarily unavailable. Please try again later.'});
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get('content-type')||''))return reply(415,{accepted:false,message:generic});
  let reader,timer,phase='input';
  try{
   if(!req.body)throw Error('body');reader=req.body.getReader();const read=async()=>{let parts=[],size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>20000)throw Error('size');parts.push(value)}const bytes=new Uint8Array(size);let at=0;for(const b of parts){bytes.set(b,at);at+=b.length}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))};
   const input=await Promise.race([read(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),5000)})]);clearTimeout(timer);
   if(!input||Array.isArray(input)||typeof input!=='object')throw Error('input');
   if(input.action==='retry_confirmation'){
    if(Object.keys(input).some(k=>!['action','id'].includes(k))||!uuid(input.id))throw Error('input');
    phase='authorization';const bearer=req.headers.get('authorization')||'';if(!bearer.startsWith('Bearer '))return reply(401,{message:'Sign in required.'});
    // Database validates the authenticated user and current owner authority; never trust JWT payload decoding.
    const authorized=await rpc('outreach_volunteer_workspace',{p_action:'mail_authorize',p_data:{id:input.id}},bearer.slice(7));
    if(authorized.id!==input.id)return reply(403,{message:'Access denied.'});
    return reply(200,{state:await deliver(input.id)});
   }
   if(Object.keys(input).some(k=>!['payload','turnstile_token','bot_field'].includes(k))||!input.payload||Array.isArray(input.payload)||typeof input.payload!=='object'||input.bot_field||typeof input.turnstile_token!=='string'||!input.turnstile_token||input.turnstile_token.length>2048)throw Error('input');
   const network=await fingerprint(req.headers,config.pepper);phase='verify';
   const v=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:config.turnstileSecret,response:input.turnstile_token}),signal:AbortSignal.timeout(4000)});if(!v.ok)throw Error('Verification');const proof=await v.json();
   if(proof.success!==true||proof.action!==action||proof.hostname!==host)return reply(400,{accepted:false,message:'Please complete the security check and try again.'});
   phase='database';const result=await rpc('outreach_volunteer_gateway',{p_payload:input.payload,p_network:network});
   if(result.accepted!==true)return reply(result.reason==='rate'?429:result.reason==='conflict'?409:400,{accepted:false,message:result.reason==='conflict'?'This request changed. Reload the form before sending again.':generic});
   if(!uuid(result.application_id)||!/^V-[A-F0-9]{16}$/.test(result.reference))throw Error('Receipt');
   let confirmation='pending';try{confirmation=await deliver(result.application_id)}catch{/* Application is durable even when mail service or receipt persistence fails. */}
   return reply(200,{accepted:true,reference:result.reference,confirmation,message:'Application received. Pending team selection. We will contact you once the team has been picked.'});
  }catch(e){return reply([401,403].includes(e.status)?e.status:phase==='input'?400:503,{accepted:false,message:[401,403].includes(e.status)?'Your staff session or review access is no longer available.':generic})}finally{clearTimeout(timer);if(reader){await reader.cancel().catch(()=>{});reader.releaseLock()}}
 };
}
