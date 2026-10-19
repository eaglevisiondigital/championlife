import {dedicatedAcceptance} from '../_shared/payments/acceptance-pin.mjs';
import {inputOnly} from '../_shared/payments/nmi.mjs';
import {executeNmiGiving} from '../_shared/payments/nmi-executor.mjs';
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(x);
const hex=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
export function createGivingHandler(config,fetcher=fetch,readSecret=(_name)=> ''){
 return async req=>{
  const origin=req.headers.get('Origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  const reply=(status,x)=>new Response(JSON.stringify(x),{status,headers});
  if(!dedicatedAcceptance(config)||!config.acceptance_pin.origins.includes(origin)||!config.origins.includes(origin)||!/^https:\/\/[a-z0-9-]+--championlifechurch\.netlify\.app$/.test(origin||''))return reply(503,{status:'held',fallback_path:'/outreach-giving.html'});
  headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='authorization,apikey,content-type,x-client-info';headers['Access-Control-Allow-Methods']='POST,OPTIONS';
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply(405,{status:'held'});
  if((!config.enabled&&!config.recoveryEnabled)||!config.serviceKey||!config.publicKey)return reply(503,{status:'held',fallback_path:'/outreach-giving.html'});
  try{
   const reader=req.body?.getReader();if(!reader)throw Error();let n=0;const parts=[];for(;;){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>8192){await reader.cancel();throw Error()}parts.push(r.value)}const bytes=new Uint8Array(n);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length}
   const data=inputOnly(JSON.parse(new TextDecoder().decode(bytes)),['action','organization_id','form_id','request_key','capability','receipt_email','donor_name','frequency','starts_on','lines','challenge_token','session_id','leg_id','operation','refund_id','instruction_id','parent_attempt_id','save_method','payment_token','reason','gateway_id','route_id','batch_reference','date','job_id','fee_minor','net_minor','deposit_minor','statement_reference']);
   if(!uuid(data.organization_id)||!['form','create','status','execute','shutdown','batch','operations','job','reconcile'].includes(data.action))throw Error();
   if(!config.enabled&&!(['status','shutdown','batch','operations','job','reconcile'].includes(data.action)||(data.action==='execute'&&['transaction','refund','void','recurring_cancel','recurring_pause'].includes(data.operation))))throw Error();
   const rpc=async(action,org,payload)=>{const r=await fetcher(config.project+'/rest/v1/rpc/nmi_giving_service',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.serviceKey,Authorization:'Bearer '+config.serviceKey},body:JSON.stringify({p_action:action,p_org:org,p_payload:payload}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('rpc');return r.json()};
   let actor=null;const bearer=req.headers.get('Authorization');
   if(bearer){if(!/^Bearer [A-Za-z0-9_.-]{20,4096}$/.test(bearer))throw Error();const r=await fetcher(config.project+'/auth/v1/user',{headers:{apikey:config.publicKey,Authorization:bearer},signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();const user=await r.json();if(!uuid(user.id)||!user.email_confirmed_at||user.is_anonymous)throw Error();actor=user.id;}
   if(data.action==='form'){if(!uuid(data.form_id))throw Error();return reply(200,await rpc('form',data.organization_id,{form_id:data.form_id}));}
   let capability_hash;if(data.capability!==undefined){if(!/^[a-f0-9]{64}$/.test(data.capability))throw Error();capability_hash=await hex(new TextEncoder().encode(data.capability));}
   if(data.action==='create'){
    if(!capability_hash||!uuid(data.form_id)||!uuid(data.request_key)||!config.turnstileSecret||!config.pepper||config.pepper.length<32||typeof data.challenge_token!=='string'||data.challenge_token.length>2048)throw Error();
    const challenge=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:config.turnstileSecret,response:data.challenge_token}),signal:AbortSignal.timeout(7000)});if(!challenge.ok)throw Error();const proof=await challenge.json();if(proof.success!==true||proof.action!=='nmi_giving'||proof.hostname!==new URL(origin).hostname)throw Error();
    const ip=req.headers.get('CF-Connecting-IP')||req.headers.get('X-NF-Client-Connection-IP');if(!ip)throw Error();const network_hash=await hex(new TextEncoder().encode(config.pepper+'\0'+ip));
    const payload={form_id:data.form_id,request_key:data.request_key,capability_hash,network_hash,receipt_email:data.receipt_email,donor_name:data.donor_name||'',frequency:data.frequency||'once',lines:data.lines,actor_id:actor};if(data.starts_on)payload.starts_on=data.starts_on;
    return reply(200,await rpc('create',data.organization_id,payload));
   }
   if(data.action==='operations'){if(!actor)throw Error();return reply(200,await rpc('operations',data.organization_id,{actor_id:actor}));}
   if(data.action==='reconcile'){if(!actor)throw Error();return reply(200,await rpc('batch_reconcile',data.organization_id,{actor_id:actor,gateway_id:data.gateway_id,route_id:data.route_id,batch_reference:data.batch_reference,fee_minor:data.fee_minor,net_minor:data.net_minor,deposit_minor:data.deposit_minor,statement_reference:data.statement_reference}));}
   if(data.action==='job'){
    if(!actor||!uuid(data.job_id))throw Error();const work=await rpc('operation_job',data.organization_id,{actor_id:actor,job_id:data.job_id});if(!work.claimed)return reply(200,work);
    const result=await executeNmiGiving({config,organization_id:data.organization_id,session_id:work.session_id,id:work.id,rpc,fetcher,readSecret});await rpc('job_complete',data.organization_id,{actor_id:actor,job_id:data.job_id,lease:work.job_lease,state:['captured','settled','failed'].includes(result.operation_status)?'completed':'review'});return reply(200,result);
   }
   if(data.action==='shutdown'){if(!actor)throw Error();return reply(200,await rpc('shutdown',data.organization_id,{actor_id:actor,reason:data.reason}));}
   if(data.action==='batch'){
    if(!actor)throw Error();const {lookupBatch}=await import('../_shared/payments/nmi-executor-batch.mjs');return reply(200,await lookupBatch({config,rpc,organization_id:data.organization_id,actor_id:actor,gateway_id:data.gateway_id,route_id:data.route_id,batch_reference:data.batch_reference,date:data.date,fetcher,readSecret}));
   }
   if(!uuid(data.session_id))throw Error();
   if(data.action==='status')return reply(200,await rpc('status',data.organization_id,{session_id:data.session_id,actor_id:actor,...(capability_hash?{capability_hash}:{})}));
   if(!uuid(data.leg_id)||!uuid(data.request_key))throw Error();
   if(data.payment_token!==undefined&&(!/^[A-Za-z0-9_-]{8,256}$/.test(data.payment_token)||/^\d{13,19}$/.test(data.payment_token)))throw Error();
   const p={session_id:data.session_id,leg_id:data.leg_id,request_key:data.request_key,operation:data.operation,actor_id:actor,...(capability_hash?{capability_hash}:{})};for(const k of ['refund_id','instruction_id','parent_attempt_id','save_method'])if(data[k]!==undefined)p[k]=data[k];
   const prepared=await rpc('prepare',data.organization_id,p);
   if(['completed','failed','review'].includes(prepared.state))return reply(200,await rpc('status',data.organization_id,{session_id:data.session_id,actor_id:actor,...(capability_hash?{capability_hash}:{})}));
   return reply(200,await executeNmiGiving({config,organization_id:data.organization_id,session_id:data.session_id,id:prepared.id,payment_token:data.payment_token,rpc,fetcher,readSecret}));
  }catch{return reply(409,{status:'pending',message:'We cannot confirm this payment yet. Do not submit it again. Review its status or contact finance.',retry_automatically:false})}
 };
}
