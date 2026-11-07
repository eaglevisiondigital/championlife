import {reviewDisconnectedMessage} from './disconnected-review.mjs';
import {normalizeOutcome} from '../../supabase/functions/_shared/communications/providers.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,120}$/.test(x);
const int=x=>Number.isSafeInteger(x)&&x>=0;
const copy=x=>JSON.parse(JSON.stringify(x));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const result=(reason,resolution='none')=>Object.freeze({reason,resolution,canSend:false,canAutomaticallyRetry:false,canWrite:false,canChangeConsent:false});
const scope=['organization_id','campaign_id','recipient_key','channel','purpose','idempotency_key','sender_profile_id','provider'];

/** Read-only integration with Core G/H1 communication_outbox/attempts/callbacks.
 * All ports are trusted server dependencies, never request JSON. withCurrentOutbox
 * must reauthenticate, authorize exact campaign/recipient and serialize current
 * consent/suppression/outbox/attempt/callback state under the existing comm_lock.
 * verifyReceipt must authenticate the provider and bind the full dispatch scope.
 * No sender, database mutation or live provider is included.
 */
export async function reviewExistingOutbox(input,ports,{signal}={}) {
 try {
  const request=copy(input);
  if(!id(request?.messageId)||!id(request.organizationId)||!(request.campaignId===null||id(request.campaignId))||'actorId'in request||'sessionId'in request||signal?.aborted)return result('invalid_request');
  for(const method of ['authenticate','loadOutbox','lookupReceipt','verifyReceipt','withCurrentOutbox'])if(typeof ports?.[method]!=='function')return result('unavailable');
  const principal=copy(await ports.authenticate({signal}));
  if(!id(principal.actorId)||!id(principal.sessionId)||principal.active!==true||principal.verified!==true||signal?.aborted)return result('denied');
  const target=Object.freeze({messageId:request.messageId,organizationId:request.organizationId,campaignId:request.campaignId,actorId:principal.actorId,sessionId:principal.sessionId});
  const snapshot=copy(await ports.loadOutbox(target,{signal}));
  const m=snapshot.message;
  if(!m||m.id!==target.messageId||m.organization_id!==target.organizationId||m.campaign_id!==target.campaignId||!id(m.recipient_key)||!id(m.idempotency_key)||!id(m.sender_profile_id)||!id(m.provider)||!int(m.attempts)||!int(snapshot.revision)||!Array.isArray(snapshot.callbacks))return result('scope_mismatch');
  // Lookup and verification use saved dispatch identity, never an address/recipient
  // supplied by the caller. Full recipient/purpose binding is checked below.
  const raw=await ports.lookupReceipt(Object.freeze({messageId:m.id,...Object.fromEntries(scope.map(k=>[k,m[k]]))}),{signal});
  const receipt=raw===null?null:copy(await ports.verifyReceipt(raw,{signal}));
  if(receipt&&(receipt.verified!==true||receipt.message_id!==m.id||scope.some(k=>receipt[k]!==m[k])||!id(receipt.event_id)||!id(receipt.provider_message_id)||(m.provider_message_id!==null&&receipt.provider_message_id!==m.provider_message_id)))return result('receipt_mismatch');
  let count=0,review;
  await ports.withCurrentOutbox(target,async current=>{
   if(++count!==1)throw Error('Repeated callback');
   if(signal?.aborted||!same(snapshot,copy(current))){review=result('stale');return;}
   const a=current.attempt;
   if(m.attempts>0&&(!a||a.organization_id!==m.organization_id||a.message_id!==m.id||a.attempt!==m.attempts||!id(a.id))){review=result('attempt_mismatch');return;}
   let state='unknown';
   if(['draft','queued','scheduled'].includes(m.status)&&m.attempts===0&&a===null&&m.dispatch_authorized_at===null&&m.provider_message_id===null)state='never_submitted';
   if(['sent','delivered'].includes(m.status)&&id(m.provider_message_id)&&m.attempts>0)state=m.status==='sent'?'accepted':'delivered';
   if(m.status==='failed'&&m.failure_class!=='uncertain'&&a?.finished_at&&receipt?.rejectionConfirmed===true&&receipt.status==='rejected')state='rejected';
   const req={actorId:target.actorId,sessionId:target.sessionId,organizationId:m.organization_id,campaignId:m.campaign_id,recipientKey:m.recipient_key,messageId:m.id,channel:m.channel,purpose:m.purpose,expectedRevision:current.revision};
   // Metadata comes from current scoped policy, never outbox address/body content.
   if(['actorId','sessionId','organizationId','campaignId','recipientKey','messageId','channel','purpose'].some(k=>current.policy?.[k]!==req[k])){review=result('policy_scope_mismatch');return;}
   const policy=await reviewDisconnectedMessage(req,{withCurrentPolicy:async(_,read)=>read({...current.policy,...req,revision:current.revision,attempt:{state,outboxMessageId:m.id,providerAttemptId:state==='never_submitted'?null:a?.id,providerRejectionConfirmed:receipt?.rejectionConfirmed,error:receipt?.error}})},{signal});
   if(['draft','queued','scheduled','sending','sent','delivered','failed'].includes(m.status)===false){review=result('held');return;}
   if(!['ready','already_submitted','reconcile_required','permanent_or_uncertain'].includes(policy.reason)){review=result(policy.reason);return;}
   if(receipt){
    const outcome=normalizeOutcome(m.channel,receipt.status);
    const prior=current.callbacks.filter(c=>c.organization_id===m.organization_id&&c.provider===m.provider&&c.event_id===receipt.event_id);
    if(prior.length){review=result(prior.every(c=>c.message_id===m.id&&c.outcome===outcome)?'duplicate_receipt':'receipt_conflict');return;}
    // Core G/H1 callback resolves known provider IDs; it cannot safely attach an
    // unknown post-handoff receipt. That requires separately reviewed reconciliation.
    if(m.provider_message_id===null){review=result('reconcile_required','manual_reconciliation_required');return;}
    review=result(policy.reason,'existing_callback_review');return;
   }
   review=result(policy.reason,state==='unknown'?'provider_reconciliation_required':'none');
  },{signal});
  return count===1&&!signal?.aborted?review??result('unavailable'):result('unavailable');
 }catch{return result('unavailable');}
}
