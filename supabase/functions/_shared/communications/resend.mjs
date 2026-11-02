// SOURCE ONLY: no fetch, environment reads, credentials or installed registry.
// A future reviewed host must supply account-scoped IO and the existing H1 RPC gates.
const encoder = new TextEncoder();
const uuid = s => typeof s === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s);
const text = (s, n) => typeof s === 'string' && s.length > 0 && s.length <= n && !/[\x00-\x1f\x7f]/.test(s);
const address = s => text(s, 320) && /^[A-Za-z0-9.!#$&'+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s);
const fail = () => { throw Object.assign(Error('Resend binding or evidence unavailable'), {failure:'uncertain'}); };
const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2,'0')).join('');
const digest = async b => hex(await crypto.subtle.digest('SHA-256', b));
function context(b) {
 if (!b || b.provider !== 'resend_email' || !uuid(b.organization_id) || !uuid(b.profile_id) ||
  !['acceptance','production'].includes(b.environment) || !/^[a-z]{20}$/.test(b.project_ref || '') ||
  !text(b.account_id, 100) || !address(b.from) || (b.reply_to != null && !address(b.reply_to))) fail();
 return [b.environment,b.project_ref,b.organization_id,b.profile_id,b.provider,b.account_id,b.from,b.reply_to ?? null];
}
export const RESEND_SOURCE_DEFAULTS = Object.freeze({enabled:false,structured_callbacks:false});
export function resendAdapter(binding, {request, enabled=false}={}) {
 const b = structuredClone(binding); context(b);
 return Object.freeze({async send(job,authorization) {
  if (enabled !== true || b.enabled !== true || b.sender_approved !== true || typeof request !== 'function') fail();
  // Snapshot before any await; no client-selected account, sender or endpoint.
  const j=structuredClone(job);
  if (!uuid(j.id) || !uuid(j.lease_token) || j.organization_id !== b.organization_id ||
   j.sender_profile_id !== b.profile_id || j.channel !== 'email' || j.provider !== b.provider ||
   j.sender?.id !== b.profile_id || j.sender.organization_id !== b.organization_id ||
   j.sender.provider !== b.provider || j.sender.from_address !== b.from || (j.sender.reply_to ?? null)!==(b.reply_to ?? null) ||
   !address(j.address_snapshot) || !text(j.idempotency_key,500) || !text(j.purpose,100) ||
   !text(j.subject,240) || typeof j.rendered_body !== 'string' || !j.rendered_body || j.rendered_body.length>12000) fail();
  const expected={environment:b.environment,project_ref:b.project_ref,organization_id:b.organization_id,profile_id:b.profile_id,provider:b.provider,account_id:b.account_id,from:b.from,reply_to:b.reply_to??null,message_id:j.id,idempotency_key:j.idempotency_key,recipient:j.address_snapshot,purpose:j.purpose,subject:j.subject,body_sha256:await digest(encoder.encode(j.rendered_body))};
  const key='cl-resend-'+await digest(encoder.encode([b.environment,b.project_ref,b.organization_id,b.profile_id,b.account_id,j.id,j.idempotency_key].join('\n')));
  expected.api_idempotency_key=key;
  const authorized=authorization?.resend_binding;
  if(authorization?.authorized!==true || !authorized || Object.keys(authorized).length!==Object.keys(expected).length || Object.entries(expected).some(([k,v])=>authorized[k]!==v))fail();
  const payload={from:b.from,to:[j.address_snapshot],subject:j.subject,text:j.rendered_body,...(b.reply_to?{reply_to:b.reply_to}:{})};
  let r;
  try {r=await request(Object.freeze({method:'POST',path:'/emails',account_id:b.account_id,headers:Object.freeze({'Idempotency-Key':key}),body:JSON.stringify(payload)}));}
  catch {fail();} // Never infer rejection from a lost response or retry UNKNOWN.
  if (r?.status===200 && uuid(r.body?.id)) return {id:r.body.id,status:'sent',telemetry:'api_acceptance_only'};
  // Conservative permanent failures do not schedule automatic retries, including 429/5xx.
  if (Number.isInteger(r?.status) && [400,401,403,404,422].includes(r.status)) throw Object.assign(Error('Resend rejected request'),{failure:'permanent'});
  fail();
 }});
}
function unbase64(value) {
 if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) fail();
 return Uint8Array.from(atob(value), c=>c.charCodeAt(0));
}
const outcomes=Object.freeze({'email.sent':'sent','email.delivered':'delivered','email.bounced':'hard_bounce','email.complained':'complaint','email.failed':'failed','email.delivery_delayed':'sent'});
export async function verifyResendWebhook(raw,headers,binding,{now=Date.now()}={}) {
 const b=structuredClone(binding);context(b);
 if (b.structured_callbacks!==true || !(raw instanceof Uint8Array) || !raw.length || raw.length>8192 || !Number.isFinite(now)) fail();
 const bytes=raw.slice(),id=headers.get('svix-id'),time=headers.get('svix-timestamp'),signatures=headers.get('svix-signature');
 if (!/^[A-Za-z0-9_-]{1,200}$/.test(id||'') || !/^\d{10}$/.test(time||'') || Math.abs(now/1000-Number(time))>300 || !text(signatures,2048) || !/^whsec_/.test(b.webhook_secret||'')) fail();
 const keyBytes=unbase64(b.webhook_secret.slice(6));if(keyBytes.length<16)fail();
 const prefix=encoder.encode(id+'.'+time+'.'),signed=new Uint8Array(prefix.length+bytes.length);signed.set(prefix);signed.set(bytes,prefix.length);
 const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['verify']);
 let verified=false;
 for(const value of signatures.split(' ')) {
  if(!value.startsWith('v1,'))continue;
  const signature=unbase64(value.slice(3));if(signature.length!==32)continue;
  // WebCrypto verification performs the MAC comparison; no JS string equality.
  verified=(await crypto.subtle.verify('HMAC',key,signature,signed))||verified;
 }
 if(!verified)fail();
 const event=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));
 if(typeof event?.created_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(event.created_at)||!Number.isFinite(Date.parse(event.created_at))||Date.parse(event.created_at)>now+300000)fail();
 if(!Object.hasOwn(outcomes,event?.type)||!uuid(event.data?.email_id)||!Array.isArray(event.data.to)||event.data.to.length!==1||!address(event.data.to[0])||event.data.from!==b.from)fail();
 return Object.freeze({event_id:id,event_type:event.type,occurred_at:event.created_at,body_sha256:await digest(bytes),outcome:outcomes[event.type],provider_message_id:event.data.email_id,recipient:event.data.to[0],from:b.from});
}
export async function resendReceipt(raw,headers,binding,resolveAttempt,options={}) {
 // Resolver is trusted server storage, never a browser field or payload tag.
 const b=structuredClone(binding),snapshot=JSON.stringify(binding);
 const e=await verifyResendWebhook(raw,headers,b,options);
 if(typeof resolveAttempt!=='function')fail();
 const a=await resolveAttempt({profile_id:b.profile_id,organization_id:b.organization_id,provider:b.provider,provider_message_id:e.provider_message_id});
 if(JSON.stringify(binding)!==snapshot || !a || !uuid(a.message_id)||!uuid(a.attempt_id)||a.organization_id!==b.organization_id||a.profile_id!==b.profile_id||a.provider!=='resend_email'||a.provider_message_id!==e.provider_message_id||a.recipient!==e.recipient||a.from!==b.from||a.environment!==b.environment||a.project_ref!==b.project_ref||a.account_id!==b.account_id||!text(a.idempotency_key,500)||!text(a.purpose,100))fail();
 return {action:'resend_receipt',organization:b.organization_id,payload:{id:b.profile_id,...e,message_id:a.message_id,attempt_id:a.attempt_id,idempotency_key:a.idempotency_key,purpose:a.purpose,account_id:b.account_id,environment:b.environment,project_ref:b.project_ref,provider:'resend_email',reply_to:b.reply_to??null}};
}
