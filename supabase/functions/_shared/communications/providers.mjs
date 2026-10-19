// No secrets in message objects. Production transports are injected only after a separate activation gate.
const permanent = new Set(['invalid_address','hard_bounce','complaint','rejected','undelivered']);
export function normalizeOutcome(channel, status) {
  const map={accepted:'sent',queued:'sent',sent:'sent',delivered:'delivered',soft_bounce:'soft_bounce',hard_bounce:'hard_bounce',complaint:'complaint',rejected:'rejected',undelivered:'undelivered',failed:'failed'};
  if(!['email','sms'].includes(channel)||!map[status])throw Error('Unsupported provider outcome');
  return map[status];
}
export function classifyFailure(error) {
  if(permanent.has(error?.code)||error?.status>=400&&error?.status<500&&![408,429].includes(error.status))return 'permanent';
  // An unconfirmed timeout after dispatch may have been accepted. Reconcile instead of blind resend.
  if(error?.ambiguous||['TIMEOUT','ETIMEDOUT','ECONNRESET'].includes(error?.code))return 'uncertain';
  if(error?.retryable===true||[429,502,503,504].includes(error?.status))return 'transient';
  return 'uncertain';
}
export function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function transportAdapter(channel,transport) {
  if(!['email','sms'].includes(channel)||!transport?.send)throw Error('Transport contract required');
  return Object.freeze({async send(job){if(job.channel!==channel)throw Error('Channel mismatch');const response=await transport.send({idempotencyKey:job.idempotency_key,to:job.address_snapshot,from:job.sender.from_address,fromName:job.sender.display_name,replyTo:job.sender.reply_to,subject:job.subject,text:job.rendered_body,...(channel==='email'?{html:'<p>'+escapeHtml(job.rendered_body).replace(/\n/g,'<br>')+'</p>'}:{})});if(!response?.id||normalizeOutcome(channel,response.status)!=='sent')throw Error('Provider send receipt required');return {id:String(response.id),status:'sent'};},normalize:status=>normalizeOutcome(channel,status)});
}
export function acceptanceSink() {
  const receipts=new Map();return {receipts,async send(job){if(job.sender.provider!=='acceptance_sink')throw Error('Acceptance sink only');if(!receipts.has(job.idempotency_key))receipts.set(job.idempotency_key,{id:'sink:'+job.id,status:'sent'});return receipts.get(job.idempotency_key);}};
}
export async function runWorker(rpc,organization,adapter,{enabled=false}={}) {
  if(!enabled)return {mode:'disabled',processed:0};
  const call=(action,payload={})=>rpc(action,organization,payload);
  await call('consume_events');const claimed=await call('claim');let processed=0;
  for(const job of claimed.messages){const auth=await call('authorize_dispatch',{id:job.id,lease_token:job.lease_token});if(!auth.authorized)continue;
    let result;try {const sent=await adapter.send(job);result={outcome:'sent',provider_message_id:sent.id};}catch(error){result={outcome:classifyFailure(error)};}
    // A failed database acknowledgement stays uncertain under its lease. Never call transport again here.
    await call('result',{id:job.id,lease_token:job.lease_token,...result});processed++;
  }return {mode:claimed.mode,processed};
}
export async function verifyCallback(raw,headers,secret,now=Date.now()) {
  const time=headers.get('x-communication-timestamp'), signature=headers.get('x-communication-signature');
  if(!secret||secret.length<32||!/^\d{10}$/.test(time||'')||Math.abs(now/1000-Number(time))>300||!/^sha256=[a-f0-9]{64}$/.test(signature||''))throw Error('Callback verification failed');
  const bytes=new TextEncoder(),key=await crypto.subtle.importKey('raw',bytes.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const sig=new Uint8Array(signature.slice(7).match(/../g).map(x=>parseInt(x,16)));
  if(!await crypto.subtle.verify('HMAC',key,sig,bytes.encode(time+'.'+raw)))throw Error('Callback verification failed');
  const event=JSON.parse(raw);if(!['delivery','preference'].includes(event.type)||!/^acceptance_sink$/.test(event.provider)||!event.organization_id||!event.event_id||String(event.event_id).length>200)throw Error('Invalid callback envelope');
  if(event.type==='delivery')return {organization:event.organization_id,action:'callback',payload:{event_id:event.event_id,provider:event.provider,provider_message_id:event.provider_message_id,outcome:normalizeOutcome(event.channel,event.status)}};
  if(!['STOP','START','HELP','UNSUBSCRIBE'].includes(event.keyword)||!['email','sms'].includes(event.channel)||event.keyword==='UNSUBSCRIBE'&&event.channel!=='email'||['STOP','START','HELP'].includes(event.keyword)&&event.channel!=='sms')throw Error('Invalid preference event');
  return {organization:event.organization_id,action:'keyword',payload:{event_id:event.event_id,keyword:event.keyword,channel:event.channel,address:event.address}};
}
