import {classifyFailure} from '../../supabase/functions/_shared/communications/providers.mjs';
const purposes = new Set(['transactional','event_updates','follow_up','discipleship','marketing','donation_receipts']);
const id = x => typeof x === 'string' && /^[A-Za-z0-9:_-]{1,120}$/.test(x);
const revision = x => Number.isSafeInteger(x) && x >= 0;
const verdict = reason => Object.freeze({reason,readyForIndependentReview:reason==='ready',canSend:false,canAutomaticallyRetry:false,canChangeConsent:false});

/** Source-only projection over existing Core G/H1 records, not a dispatch token.
 * Port authenticates the actor and reads current scoped consent/suppression,
 * capabilities, and existing attempt history at one serialized snapshot. Any
 * later real dispatch must use the original backend authorize_external/dispatch.
 */
export async function reviewDisconnectedMessage(request, port, {signal}={}) {
  const r = Object.freeze({...request});
  if (![r.actorId,r.sessionId,r.organizationId,r.recipientKey,r.messageId].every(id) || !(r.campaignId===null || id(r.campaignId)) || !['email','sms'].includes(r.channel) || !purposes.has(r.purpose) || !revision(r.expectedRevision)) return verdict('invalid_request');
  if (signal?.aborted || typeof port?.withCurrentPolicy !== 'function') return verdict('unavailable');
  try {
    let called = false;
    const result = await port.withCurrentPolicy(r,s=>{
      if(called) throw Error('Repeated policy callback');
      called=true;
      if(signal?.aborted) return verdict('unavailable');
      if(!s || ['actorId','sessionId','organizationId','campaignId','recipientKey','messageId','channel','purpose'].some(k=>s[k]!==r[k]) || s.revision!==r.expectedRevision) return verdict('stale_or_mismatched_scope');
      if(s.sessionActive!==true || s.authorized!==true || s.deliveryReviewAllowed!==true) return verdict('denied');
      if(s.suppressed!==false) return verdict('suppressed_or_unknown');
      // Strict exact-purpose/channel consent; email never implies SMS or marketing.
      if(s.consentStatus!=='granted' || s.consentVerified!==true || !id(s.consentEvidenceRef)) return verdict('consent_required');
      const a=s.attempt;
      if(!a || !['never_submitted','accepted','delivered','rejected','unknown'].includes(a.state)) return verdict('attempt_unknown');
      if(a.state==='never_submitted') {
        if(a.providerAttemptId!==null || a.outboxMessageId!==r.messageId) return verdict('attempt_unknown');
        return verdict('ready');
      }
      if(a.outboxMessageId!==r.messageId || !id(a.providerAttemptId)) return verdict('attempt_unknown');
      if(a.state==='accepted' || a.state==='delivered') return verdict('already_submitted');
      if(a.state==='unknown') return verdict('reconcile_required');
      if(a.providerRejectionConfirmed!==true) return verdict('reconcile_required');
      // Even definitive transient rejection yields review only, never auto-send.
      return verdict(classifyFailure(a.error)==='transient' ? 'ready' : 'permanent_or_uncertain');
    });
    return called && !signal?.aborted ? result : verdict('unavailable');
  } catch { return verdict('unavailable'); }
}
