// New decision intake only. No P0 receipt, status-email or Auth sending capability.
import {strictJson} from '../outreach-team-notices-worker/json.mjs';
import {fingerprint} from '../outreach-partner-submit/gateway.mjs';
const encoder=new TextEncoder(),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
async function readBody(req){
 const size=req.headers.get('content-length');if(size&&(!/^\d+$/.test(size)||Number(size)>20000))throw Error('size');
 if(!req.body)throw Error('body');let timer,total=0;const reader=req.body.getReader(),chunks=[];
 try{return await Promise.race([(async()=>{while(true){const{done,value}=await reader.read();if(done)break;total+=value.length;if(total>20000)throw Error('size');chunks.push(value)}const b=new Uint8Array(total);let at=0;for(const c of chunks){b.set(c,at);at+=c.length}return strictJson(new TextDecoder('utf-8',{fatal:true}).decode(b))})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),5000)})])}
 finally{clearTimeout(timer);await reader.cancel().catch(()=>{});reader.releaseLock()}
}
export function createDecisionHandler(config,fetcher=fetch){
 let origin,hostname,configured=false;
 try{
  const u=new URL(config.origin);origin=u.origin;hostname=u.hostname;
  const project=/^https:\/\/[a-z]{20}\.supabase\.co$/.test(config.url||'');
  const live=config.mode==='live'&&config.url==='https://exdocjbmylgxssanymjk.supabase.co'&&origin==='https://championlifefwb.com';
  const isolated=config.mode==='acceptance'&&config.url!=='https://exdocjbmylgxssanymjk.supabase.co'&&config.acceptanceProject===new URL(config.url).hostname.split('.')[0]&&((u.protocol==='https:'&&!/championlifefwb\.com$/.test(hostname))||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(hostname)&&!!u.port));
  configured=origin===config.origin&&project&&(live||isolated)&&!!config.serviceKey&&(config.pepper||'').length>=32&&!!config.turnstileSecret&&!/^[123]x0+AA$/.test(config.turnstileSecret);
 }catch{}
 return async req=>{
  const allowed=req.headers.get('origin')===origin;
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(allowed)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'});
  const reply=(status,state)=>new Response(JSON.stringify(typeof state==='string'?{state}:state),{status,headers});
  if(!allowed)return reply(403,'REJECTED');if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,'REJECTED');if(!configured)return reply(503,'UNAVAILABLE');
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get('content-type')||''))return reply(415,'REJECTED');
  let input;try{input=await readBody(req)}catch{return reply(400,'REJECTED')}
  if(!object(input)||Object.keys(input).some(k=>!['action','request_id','receipt_secret','payload','turnstile_token','website'].includes(k))||!['submit','status'].includes(input.action)||!uuid.test(input.request_id||'')||!/^[0-9a-f]{64}$/.test(input.receipt_secret||''))return reply(400,'REJECTED');
  if(input.website)return reply(400,'REJECTED');
  const rpc=async(action,extra={})=>{
   const response=await fetcher(config.url+'/rest/v1/rpc/minden_decision_gateway',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.serviceKey,Authorization:'Bearer '+config.serviceKey},body:JSON.stringify({p_action:action,p_request:input.request_id,p_secret:input.receipt_secret,...extra}),signal:AbortSignal.timeout(10000)});
   if(!response.ok){
    // A complete PostgREST SQL error conclusively rolls back this RPC transaction.
    // A missing/ambiguous response still throws and remains UNKNOWN. Never forward raw SQL errors.
    const failure=strictJson(await response.text());
    if(action==='submit'&&['22023','40001','42501','23505'].includes(failure?.code))return{state:'REJECTED'};
    throw Error('backend');
   }const data=await response.json();
   if(!object(data)||!['ACCEPTED','UNKNOWN','CONFLICT','RATE_LIMITED'].includes(data.state))throw Error('backend');
   if(data.state==='ACCEPTED'&&(data.receipt!==input.request_id||!Number.isFinite(Date.parse(data.accepted_at))))throw Error('receipt');
   return data.state==='ACCEPTED'?{state:'ACCEPTED',receipt:data.receipt,accepted_at:data.accepted_at}:{state:data.state};
  };
  if(input.action==='status'){try{return reply(200,await rpc('status'))}catch{return reply(503,'UNKNOWN')}}
  if(!object(input.payload)||typeof input.turnstile_token!=='string'||!input.turnstile_token.trim()||input.turnstile_token.length>2048)return reply(400,'REJECTED');
  // Check receipt first. A lost response can be recovered after a challenge expires or intake closes.
  // Still run submit for an existing receipt to enforce exact frozen-payload equality.
  try{const old=await rpc('status');if(old.state==='ACCEPTED')return reply(200,await rpc('submit',{p_payload:input.payload}))}catch{return reply(503,'UNKNOWN')}
  let network;
  try{
   network=await fingerprint(req.headers,config.pepper);
   const response=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:config.turnstileSecret,response:input.turnstile_token,idempotency_key:input.request_id}),signal:AbortSignal.timeout(4000)});
   if(!response.ok)return reply(400,'REJECTED');const verified=await response.json();
   if(verified.success!==true||verified.action!=='minden_decision'||verified.hostname!==hostname||!Number.isFinite(Date.parse(verified.challenge_ts))||Date.now()-Date.parse(verified.challenge_ts)>300000||Date.parse(verified.challenge_ts)>Date.now()+30000)return reply(400,'REJECTED');
  }catch{return reply(400,'REJECTED')}
  // Any failure after invoking persistence is UNKNOWN. Never claim the write did not happen.
  try{return reply(200,await rpc('submit',{p_payload:input.payload,p_network:network,p_token_hash:await hash(input.turnstile_token)}))}catch{return reply(503,'UNKNOWN')}
 };
}
