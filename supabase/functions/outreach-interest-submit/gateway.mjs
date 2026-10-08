import {fingerprint} from '../outreach-partner-submit/gateway.mjs';
const message='We could not submit your outreach interest. Check your information and try again.';
async function contactHash(value,pepper){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
export function createInterestHandler(config,fetcher=fetch){
 const origins=new Set(config.origins||[]),dummy=/^[123]x0+AA$/.test(config.turnstileSecret||'');
 const ready=/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.url||'')&&!!config.serviceKey&&(config.pepper||'').length>=32&&!!config.turnstileSecret&&!!config.action&&(config.hostnames||[]).length>0&&origins.size>0&&[...origins].every(o=>{try{return new URL(o).origin===o&&o.startsWith('https://')}catch{return false}})&&(!dummy||(config.mode==='acceptance'&&config.url==='https://bkbmjisprwmkptywtmih.supabase.co'));
 return async req=>{
  const origin=req.headers.get('origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'},reply=(status,v)=>new Response(JSON.stringify(v),{status,headers});
  if(!origins.has(origin))return reply(403,{accepted:false,message});
  Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,{accepted:false,message});
  if(!ready)return reply(503,{accepted:false,message});
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get('content-type')||''))return reply(415,{accepted:false,message});
  let reader,timer,submitted=false;
  try{
   if(!req.body)throw Error('body');reader=req.body.getReader();let size=0,parts=[];
   const read=async()=>{while(true){const{value,done}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw Error('size');parts.push(value)}const bytes=new Uint8Array(size);let offset=0;for(const b of parts){bytes.set(b,offset);offset+=b.length}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))};
   const input=await Promise.race([read(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),5000)})]);clearTimeout(timer);
   if(!input||Array.isArray(input)||Object.keys(input).some(k=>!['slug','payload','turnstile_token','bot_field'].includes(k))||typeof input.slug!=='string'||!/^[a-z0-9][a-z0-9-]{2,79}$/.test(input.slug)||!input.payload||Array.isArray(input.payload))throw Error('input');
   if(input.bot_field)return reply(400,{accepted:false,message});
   if(typeof input.turnstile_token!=='string'||input.turnstile_token.length>2048||!input.turnstile_token)throw Error('challenge');
   const network=await fingerprint(req.headers,config.pepper);
   const verify=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:config.turnstileSecret,response:input.turnstile_token}),signal:AbortSignal.timeout(4000)});
   if(!verify.ok)throw Error('verify');const v=await verify.json();
   const acceptanceDummy=dummy&&input.turnstile_token==='XXXX.DUMMY.TOKEN.XXXX'&&v.metadata?.result_with_testing_key===true&&v.hostname==='example.com'&&v.action===undefined;
   if(v.success!==true||(!acceptanceDummy&&(v.action!==config.action||!config.hostnames.includes(v.hostname))))return reply(400,{accepted:false,message});
   submitted=true;const response=await fetcher(config.url+'/rest/v1/rpc/outreach_interest_gateway',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.serviceKey,Authorization:'Bearer '+config.serviceKey},body:JSON.stringify({p_channel:input.slug,p_payload:input.payload,p_network:network,p_email_hash:await contactHash('email:'+String(input.payload.details?.email||'').trim().toLowerCase(),config.pepper),p_phone_hash:await contactHash('phone:'+String(input.payload.details?.phone||'').replace(/[^0-9]/g,''),config.pepper)}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error('database');const data=await response.json();
   if(data?.accepted===true)return reply(200,{accepted:true});
   return reply(data?.reason==='rate'?429:400,{accepted:false,message});
  }catch{return reply(submitted?503:400,{accepted:false,message})}finally{clearTimeout(timer);if(reader){await reader.cancel().catch(()=>{});reader.releaseLock()}}
 };
}
