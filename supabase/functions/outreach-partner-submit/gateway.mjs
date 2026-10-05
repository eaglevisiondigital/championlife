import { isIP } from 'node:net';

const verification = 'Verification could not be completed. Please try again.';
const unavailable = 'We could not save your information. Please try again later.';
const encoder = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export function networkIdentity(headers) {
  // This is a hosted-ingress contract, not a general-purpose proxy parser.
  // Never fall back to client-supplied XFF, True-Client-IP, JSON or cookies.
  const value = headers.get('cf-connecting-ip');
  const kind = value && value.length <= 45 ? isIP(value) : 0;
  if (!kind) throw Error('Network unavailable');
  if (kind === 4) return 'v4:' + value;
  const canonical = new URL('https://[' + value + ']/').hostname.slice(1, -1);
  if (canonical === '2a06:98c0:3600::103') throw Error('Shared worker address');
  const [left, right = ''] = canonical.split('::');
  const a = left ? left.split(':') : [], b = right ? right.split(':') : [];
  const words = canonical.includes('::') ? [...a, ...Array(8-a.length-b.length).fill('0'), ...b] : a;
  // IPv4-mapped addresses share their IPv4 identity; IPv6 uses a /64 prefix.
  if (words.slice(0,5).every(x => parseInt(x,16) === 0) && parseInt(words[5],16) === 65535) {
    const n = words.slice(6).map(x => parseInt(x,16));
    return 'v4:' + [n[0]>>8,n[0]&255,n[1]>>8,n[1]&255].join('.');
  }
  return 'v6/64:' + words.slice(0,4).map(x => parseInt(x,16).toString(16)).join(':');
}

export async function fingerprint(headers, pepper) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pepper), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,encoder.encode('outreach:v1:' + networkIdentity(headers))));
}

async function body(req) {
  const declared = req.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared)>16384)) throw Error('Body size');
  if (!req.body) throw Error('Missing body');
  const reader=req.body.getReader(), chunks=[];let size=0,timer;
  const read=async()=>{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384)throw Error('Body size');chunks.push(value)}const all=new Uint8Array(size);let pos=0;for(const chunk of chunks){all.set(chunk,pos);pos+=chunk.length}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all))};
  try{return await Promise.race([read(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Body timeout')),5000)})])}
  finally{clearTimeout(timer);await reader.cancel().catch(()=>{});reader.releaseLock()}
}

export function createHandler(config, fetcher=fetch) {
  const origins=new Set(config.origins || []);
  const testKey=/^[123]x0+AA$/.test(config.turnstileSecret || '');
  const acceptanceTest = testKey && config.mode==='acceptance' && config.url==='https://bkbmjisprwmkptywtmih.supabase.co';
  const configured = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.url || '') &&
    !!config.serviceKey && (config.pepper || '').length>=32 && !!config.turnstileSecret &&
    !!config.action && (config.hostnames || []).length>0 && origins.size>0 &&
    [...origins].every(o=>{try{return new URL(o).origin===o && o.startsWith('https://')}catch{return false}}) &&
    (!testKey || acceptanceTest);
  return async req => {
    const origin=req.headers.get('origin'), allowed=origins.has(origin);
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
    if(allowed)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'});
    const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
    if(!allowed)return reply(403,{accepted:false,message:verification});
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(req.method!=='POST')return reply(405,{accepted:false,message:verification});
    if(!configured)return reply(503,{accepted:false,message:unavailable});
    if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get('content-type') || ''))return reply(415,{accepted:false,message:verification});
    let input;
    try{input=await body(req)}catch{return reply(400,{accepted:false,message:verification})}
    if(!object(input) || Object.keys(input).some(k=>!['payload','turnstile_token'].includes(k)) || !object(input.payload) ||
      Object.keys(input.payload).some(k=>!['brand','source_path','request_key','bot_field','fields'].includes(k)))return reply(400,{accepted:false,message:verification});
    // Harmless honeypot acknowledgment precedes challenge, network and DB processing.
    if(typeof input.payload.bot_field==='string' && input.payload.bot_field)return reply(200,{accepted:true});
    const token=input.turnstile_token;
    if(typeof token!=='string' || !token.trim() || token.length>2048)return reply(400,{accepted:false,message:verification});
    try {
      const opaque=await fingerprint(req.headers,config.pepper);
      const result=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({secret:config.turnstileSecret,response:token}),signal:AbortSignal.timeout(4000)
      });
      if(!result.ok)return reply(400,{accepted:false,message:verification});
      const check=await result.json();
      // Cloudflare's hosted dummy response has no action and hostname example.com.
      // This exception requires the fixed acceptance project AND documented dummy key/token/metadata.
      const dummyResponse=acceptanceTest && token==='XXXX.DUMMY.TOKEN.XXXX' && check.metadata?.result_with_testing_key===true && check.hostname==='example.com' && check.action===undefined;
      if(check.success!==true || (!dummyResponse && (check.action!==config.action || !config.hostnames.includes(check.hostname))))return reply(400,{accepted:false,message:verification});
      const response=await fetcher(config.url+'/rest/v1/rpc/outreach_partner_gateway',{
        method:'POST',headers:{'Content-Type':'application/json',apikey:config.serviceKey,Authorization:'Bearer '+config.serviceKey},
        body:JSON.stringify({p_data:input.payload,p_network:opaque}),signal:AbortSignal.timeout(8000)
      });
      if(!response.ok)return reply(503,{accepted:false,message:unavailable});
      const data=await response.json();
      if(data?.accepted===true)return reply(200,{accepted:true});
      if(data?.reason==='rate')return reply(429,{accepted:false,message:'Please wait a few minutes before submitting again.'});
      return reply(400,{accepted:false,message:'Check your information and try again.'});
    }catch{return reply(503,{accepted:false,message:unavailable})}
  };
}
