// Private, offline evidence handoff validation only; never a payment authorization.
import { createHash } from 'node:crypto';
import { prepareDisabledRoute } from './disabled-routing.mjs';
const ROUTES = ['Main', 'Youth', 'Outreach', 'Events', 'Merch'];
const SLOTS = ['MID-01', 'MID-02', 'MID-03', 'MID-04'];
const alias = x => typeof x === 'string' && /^[A-Za-z][A-Za-z0-9_-]{2,79}$/.test(x);
const time = x => typeof x === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x.replace('Z', '.000Z');
const canonical = x => Array.isArray(x) ? '[' + x.map(canonical).join(',') + ']' : x !== null && typeof x === 'object' ? '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}' : JSON.stringify(x);
const shape = (x, keys) => x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
const SLOT_KEYS = ['slot','merchant_organization','legal_recipient_status','gateway_group_alias','processor_status','settlement_owner_status','recurring_vault_status','test_access_status','verified_by','verified_at'];
const ROUTE_KEYS = ['route','organization','purpose','mid_slot','enabled','boarded_purpose_approved'];
const CONTROL_KEYS = ['provider_sandbox_verified','canonical_ledger_reconciled','tokenized_checkout_verified','webhook_replay_verified','refund_recovery_verified','merchant_authority_verified','givehub_recurring_inventory_reviewed','owner_finance_release'];
function documentValid(d) {
  return shape(d, ['schema_version','readiness_status','expected_mid_count','evidence_policy','mid_slots','checkout_routes','controls','source']) && d.schema_version === 1 && d.expected_mid_count === 4
    && typeof d.readiness_status === 'string' && typeof d.evidence_policy === 'string'
    && Array.isArray(d.mid_slots) && d.mid_slots.length === 4 && new Set(d.mid_slots.map(x => x?.slot)).size === 4
    && d.mid_slots.every(s => shape(s,SLOT_KEYS) && SLOTS.includes(s.slot) && ['Champion Life','SowGo','UNVERIFIED'].includes(s.merchant_organization) && alias(s.gateway_group_alias) && ['legal_recipient_status','processor_status','settlement_owner_status','recurring_vault_status','test_access_status'].every(k=>['VERIFIED','PENDING','UNAVAILABLE'].includes(s[k])) && (s.verified_by === '' || alias(s.verified_by)) && (s.verified_at === '' || time(s.verified_at)))
    && Array.isArray(d.checkout_routes) && d.checkout_routes.length === 5 && new Set(d.checkout_routes.map(x=>x?.route)).size === 5
    && d.checkout_routes.every(r => shape(r, ROUTE_KEYS) && ROUTES.includes(r.route) && ['Champion Life','SowGo','UNVERIFIED'].includes(r.organization) && ['contribution','purchase','event_fee','mixed_event_fee_or_contribution'].includes(r.purpose) && (r.mid_slot === null || SLOTS.includes(r.mid_slot)) && r.enabled === false && typeof r.boarded_purpose_approved === 'boolean')
    && shape(d.controls, CONTROL_KEYS) && CONTROL_KEYS.every(k=>typeof d.controls[k]==='boolean')
    && shape(d.source,['champion_pr34','gate0_pr36','source_date']) && ['champion_pr34','gate0_pr36'].every(k=>/^[a-f0-9]{40}$/.test(d.source[k])) && /^\d{4}-\d{2}-\d{2}$/.test(d.source.source_date);
}
export function boardingDocumentDigest(document) {
  if (!documentValid(document)) throw new Error('INVALID_ALIAS_DOCUMENT');
  return createHash('sha256').update(canonical(document)).digest('hex');
}
const REVIEW_KEYS=['slot','documentSha256','evidenceRef','legalMerchantAlias','settlementOwnerAlias','receiptOwnerAlias','verifiedBy','independentReviewer','verifiedAt','expiresAt','revoked','legalMerchantConfirmed','settlementOwnershipConfirmed','receiptOwnershipConfirmed','providerPurposeConfirmed'];
export function prepareFourMidHandoff(document, slotReviews, routeReceipts, now) {
  const held = reason => Object.freeze({mode:'disabled',canSubmit:false,providerVerified:false,readyForPrivateReview:false,reason});
  try {
    if (!time(now)) return held('INVALID_REVIEW_TIME');
    const digest=boardingDocumentDigest(document);
    if (!Array.isArray(slotReviews)||slotReviews.length!==4||new Set(slotReviews.map(x=>x?.slot)).size!==4) return held('FOUR_UNIQUE_REVIEWS_REQUIRED');
    if (!Array.isArray(routeReceipts)||routeReceipts.length!==5||new Set(routeReceipts.map(x=>x?.route)).size!==5) return held('FIVE_UNIQUE_ROUTES_REQUIRED');
    const bySlot=new Map();
    for (const r of slotReviews) {
      if (!shape(r,REVIEW_KEYS)||!SLOTS.includes(r.slot)||r.documentSha256!==digest) return held('REVIEW_BINDING_MISMATCH');
      if (!['evidenceRef','legalMerchantAlias','settlementOwnerAlias','receiptOwnerAlias','verifiedBy','independentReviewer'].every(k=>alias(r[k]))||r.verifiedBy===r.independentReviewer) return held('INDEPENDENT_ALIAS_REVIEW_REQUIRED');
      if (!time(r.verifiedAt)||!time(r.expiresAt)||Date.parse(r.verifiedAt)>Date.parse(now)||Date.parse(r.expiresAt)<=Date.parse(now)||r.revoked!==false) return held('REVIEW_NOT_CURRENT');
      if (['legalMerchantConfirmed','settlementOwnershipConfirmed','receiptOwnershipConfirmed','providerPurposeConfirmed'].some(k=>r[k]!==true)) return held('EXACT_APPROVAL_REQUIRED');
      const s=document.mid_slots.find(x=>x.slot===r.slot);
      if (!['Champion Life','SowGo'].includes(s.merchant_organization)||!['legal_recipient_status','processor_status','settlement_owner_status','test_access_status'].every(k=>s[k]==='VERIFIED')||s.verified_by!==r.verifiedBy||s.verified_at!==r.verifiedAt) return held('SLOT_NOT_BOUND_TO_REVIEW');
      bySlot.set(r.slot,r);
    }
    // The same legal/settlement/receipt alias may be shared only within one organization.
    for (const k of ['legalMerchantAlias','settlementOwnerAlias','receiptOwnerAlias']) {
      const owners=new Map();
      for (const s of document.mid_slots) {const a=bySlot.get(s.slot)[k]; if(owners.has(a)&&owners.get(a)!==s.merchant_organization)return held('CROSS_ORGANIZATION_OWNER_ALIAS');owners.set(a,s.merchant_organization);}
    }
    const routes=[];
    for (const name of ROUTES) {
      const r=routeReceipts.find(x=>x?.route===name),route=document.checkout_routes.find(x=>x.route===name),review=bySlot.get(route.mid_slot);
      if (!r||!review||['evidenceRef','legalMerchantAlias','settlementOwnerAlias','receiptOwnerAlias','verifiedBy','independentReviewer','verifiedAt','expiresAt','legalMerchantConfirmed','settlementOwnershipConfirmed','receiptOwnershipConfirmed','providerPurposeConfirmed'].some(k=>r[k]!==review[k]))return held('ROUTE_REVIEW_MISMATCH');
      const result=prepareDisabledRoute(document,name,r,now);
      if (!result.readyForReview)return held('ROUTE_NOT_REVIEWABLE');
      routes.push(Object.freeze({route:name,midSlot:route.mid_slot,organization:route.organization}));
    }
    // Hash binding detects changed input, not document authenticity or provider acceptance.
    return Object.freeze({mode:'disabled',canSubmit:false,providerVerified:false,readyForPrivateReview:true,documentSha256:digest,reviewedSlots:4,routes:Object.freeze(routes),recurring:'separate-review-required'});
  } catch {return held('INVALID_HANDOFF');}
}
