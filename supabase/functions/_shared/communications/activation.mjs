// Provider-neutral H1 handoff. No application caller chooses credentials or arbitrary From.
import {escapeHtml,classifyFailure,normalizeOutcome} from './providers.mjs';
const mail = /^[A-Za-z0-9.!#$&'+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/;
const safeHeader = (s,n=240)=>typeof s==='string'&&s.length<=n&&!/[\r\n\x00-\x1f\x7f]/.test(s);
const address = s=>safeHeader(s,320)&&mail.test(s)&&!s.includes('*');
export function bindingFor(registry,profile,runtime) {
 const b=registry?.[profile.id];
 if(!b||b.environment!==runtime.environment||b.project_ref!==runtime.project_ref||b.organization_id!==profile.organization_id||b.profile_id!==profile.id||b.provider!==profile.provider||b.from!==profile.from_address||b.reply_to!==(profile.reply_to||null)||b.sender_approved!==true)throw Object.assign(Error('Provider configuration unavailable'),{code:'configuration_error',status:422});
 return b;
}
export function smtpFailure(e){
 // A definitive SMTP 4xx/5xx response proves rejection, not an ambiguous success.
 const c=Number(e?.responseCode);
 if(c>=400&&c<500)return 'transient';if(c>=500&&c<600)return 'permanent';
 if(['EAUTH','EENVELOPE','EMESSAGE','ETLS','configuration_error'].includes(e?.code))return 'permanent';
 if(['EDNS','ECONNECTION'].includes(e?.code))return 'transient';
 return 'uncertain'; // Socket timeout/loss may follow DATA acceptance: never blind-retry.
}
export function smtpAdapter(nodemailer,binding){
 if(!binding?.host||!/^[a-z0-9.-]+$/.test(binding.host)||![465,587].includes(binding.port)||!address(binding.username)||typeof binding.password!=='string'||!binding.password||!address(binding.from)||binding.reply_to&&!address(binding.reply_to))throw Object.assign(Error('SMTP configuration unavailable'),{status:422,code:'configuration_error'});
 const transport=nodemailer.createTransport({host:binding.host,port:binding.port,secure:binding.port===465,requireTLS:true,opportunisticTLS:false,auth:{user:binding.username,pass:binding.password},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true,servername:binding.host},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:15000,dnsTimeout:5000,pool:false,logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true,maxRecipients:1});
 return {async verify(){try{await transport.verify();return{configured:true,verified:true,health:'unknown',delivery_verified:false};}finally{transport.close();}},async send(job){
  if(job.channel!=='email'||job.sender.provider!=='smtp_transport'||job.sender.from_address!==binding.from||(job.sender.reply_to||null)!==(binding.reply_to||null)||!address(job.address_snapshot)||!safeHeader(job.subject)||!safeHeader(job.sender.display_name,120)||typeof job.rendered_body!=='string'||job.rendered_body.length>12000)throw Object.assign(Error('Invalid email envelope'),{status:422});
  try{const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(job.organization_id+':'+job.idempotency_key)))).map(x=>x.toString(16).padStart(2,'0')).join('');
   const ref='<'+digest+'@'+binding.from.split('@')[1]+'>';
   const receipt=await transport.sendMail({from:{name:job.sender.display_name,address:binding.from},replyTo:binding.reply_to||undefined,to:job.address_snapshot,envelope:{from:binding.from,to:[job.address_snapshot]},subject:job.subject,text:job.rendered_body,html:'<!doctype html><html lang="en"><body><p>'+escapeHtml(job.rendered_body).replace(/\n/g,'<br>')+'</p></body></html>',messageId:ref});
   if(receipt.rejected?.length||!receipt.accepted?.some(a=>String(a).toLowerCase()===job.address_snapshot.toLowerCase()))throw Object.assign(Error('Recipient rejected'),{responseCode:550});
   return{id:String(receipt.messageId||ref),status:'sent',telemetry:'smtp_acceptance_only'};
  }catch(e){throw Object.assign(Error('SMTP delivery failed'),{failure:smtpFailure(e)});}finally{transport.close();}
 }};
}
export function smsAdapter(contract,binding){
 if(!contract?.send||!contract?.verify||!contract?.verifyCallback||!binding?.sender_service_id)throw Error('NOT CONFIGURED / PROVIDER SELECTION REQUIRED');
 return{async verify(){return contract.verify(binding);},async send(job){if(job.channel!=='sms'||!/^\+[1-9][0-9]{7,14}$/.test(job.address_snapshot))throw Object.assign(Error('Invalid SMS'),{status:422});
  const text=String(job.rendered_body).normalize('NFC').replace(/\r\n?/g,'\n');if(!text||text.length>12000)throw Object.assign(Error('Invalid SMS content'),{status:422});
  const r=await contract.send({binding,idempotencyKey:job.idempotency_key,to:job.address_snapshot,senderServiceId:binding.sender_service_id,text});if(!r?.id||normalizeOutcome('sms',r.status)!=='sent')throw Error('SMS receipt required');return{id:String(r.id),status:'sent',segments:r.segments??null,cost:r.cost??null};
 },verifyCallback:(raw,headers)=>contract.verifyCallback(raw,headers,binding)};
}
/** @param {{enabled?: boolean, runtime?: {environment: string, project_ref: string}, messageId?: string}} options */
export async function runExternalWorker(rpc,organization,resolve,{enabled=false,runtime={environment:'',project_ref:''},messageId=''}={}){
 if(!enabled)return{mode:'disabled',processed:0};
 const call=(a,p={})=>rpc(a,organization,p),claimed=await call('claim_external',messageId?{message_id:messageId}:{});
 if(claimed.environment!==runtime?.environment||claimed.project_ref!==runtime?.project_ref)throw Error('Environment binding mismatch');
 let processed=0;
 for(const job of claimed.messages){let adapter;
  try{adapter=await resolve(job.sender);}catch{const auth=await call('authorize_external',{message_id:job.id,lease_token:job.lease_token});if(auth.authorized){await call('result_external',{message_id:job.id,lease_token:job.lease_token,outcome:'permanent'});}continue;}
  const auth=await call('authorize_external',{message_id:job.id,lease_token:job.lease_token});if(!auth.authorized)continue;
  // This transaction is the handoff linearization point. Already handed-off SMTP cannot be recalled.
  let result;try{const sent=await adapter.send(job);result={outcome:'sent',provider_message_id:sent.id};}catch(e){result={outcome:e.failure||classifyFailure(e)};}
  await call('result_external',{message_id:job.id,lease_token:job.lease_token,...result});processed++;
 }return{mode:claimed.mode,processed};
}
export async function boundedBody(req){const reader=req.body?.getReader();if(!reader)throw Error('Missing body');let size=0;const chunks=[];for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw Error('Body too large');}chunks.push(value);}const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}return new TextDecoder('utf-8',{fatal:true}).decode(all);}
// Contract verifier is supplied by the selected vendor. There is no invented generic SMTP webhook.
export async function verifiedProviderEvent(raw,headers,profile,binding,verifier){
 if(!verifier||!profile.structured_callbacks)throw Error('Provider callbacks not configured');
 const e=await verifier(raw,headers,binding); // MUST verify signature, provider timestamp/replay envelope before returning.
 if(!e||!safeHeader(e.event_id,200)||!e.event_id||e.provider!==profile.sender.provider||e.organization_id||e.profile_id)throw Error('Invalid provider event');
 if(e.type==='delivery'){if(!safeHeader(e.provider_message_id,200)||!e.provider_message_id||!/^[a-f0-9-]{36}$/.test(e.attempt_id||''))throw Error('Receipt binding required');return{action:'callback_external',payload:{event_id:e.event_id,provider:e.provider,provider_message_id:e.provider_message_id,attempt_id:e.attempt_id,outcome:normalizeOutcome(profile.sender.channel,e.status)}};}
 if(e.type==='preference'&&profile.sender.channel==='sms'&&['STOP','START','HELP'].includes(e.keyword)&&/^\+[1-9][0-9]{7,14}$/.test(e.address))return{action:'keyword_external',payload:{event_id:e.event_id,provider:e.provider,keyword:e.keyword,address:e.address}};
 throw Error('Invalid provider event');
}
