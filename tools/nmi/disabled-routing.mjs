// Offline planning only. Intentionally no transport, credentials, tokenization or activation API.
import { evaluatePilot } from './mid-readiness.mjs';
const owners={Main:'Champion Life',Youth:'Champion Life',Outreach:'SowGo'};
const ref=v=>typeof v==='string' && !/\s/.test(v) && /^[A-Za-z][A-Za-z0-9_-]{2,79}$/.test(v);
const validTime=v=>typeof v==='string' && v.length===20 && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString()===v.replace('Z','.000Z');
export function prepareDisabledRoute(document, routeName, receipt, now) {
 const held=reason=>Object.freeze({mode:'disabled',canSubmit:false,readyForReview:false,reason});
 if(!validTime(now))return held('INVALID_REVIEW_TIME');
 try {
  const result=evaluatePilot(document,routeName);
  if(!result.ready)return held('BOARDING_NOT_VERIFIED');
  const route=document.checkout_routes.find(r=>r.route===routeName),slot=document.mid_slots.find(s=>s.slot===route.mid_slot);
  if(route.enabled!==false)return held('ROUTE_MUST_REMAIN_DISABLED');
  if(!['Champion Life','SowGo'].includes(route.organization)||owners[routeName] && owners[routeName]!==route.organization)return held('RECIPIENT_MISMATCH');
  if(!['contribution','event_fee','purchase'].includes(route.purpose))return held('PURPOSE_UNRESOLVED');
  if(['Main','Youth','Outreach'].includes(routeName)&&route.purpose!=='contribution'||routeName==='Merch'&&route.purpose!=='purchase')return held('PURPOSE_MISMATCH');
  if(!ref(slot.gateway_group_alias))return held('GATEWAY_ALIAS_INVALID');
  if(!receipt || receipt.route!==routeName || receipt.midSlot!==slot.slot || receipt.organization!==route.organization || receipt.purpose!==route.purpose || receipt.gatewayGroupAlias!==slot.gateway_group_alias)return held('EVIDENCE_BINDING_MISMATCH');
  for(const k of ['evidenceRef','legalMerchantAlias','settlementOwnerAlias','receiptOwnerAlias','verifiedBy','independentReviewer'])if(!ref(receipt[k]))return held('EVIDENCE_INCOMPLETE');
  if(receipt.verifiedBy===receipt.independentReviewer)return held('INDEPENDENT_REVIEW_REQUIRED');
  if(!validTime(receipt.verifiedAt)||!validTime(receipt.expiresAt)||Date.parse(receipt.verifiedAt)>Date.parse(now)||Date.parse(receipt.expiresAt)<=Date.parse(now)||Date.parse(receipt.expiresAt)<=Date.parse(receipt.verifiedAt))return held('EVIDENCE_NOT_CURRENT');
  const approvals=['legalMerchantConfirmed','settlementOwnershipConfirmed','receiptOwnershipConfirmed','providerPurposeConfirmed'];
  if(approvals.some(k=>typeof receipt[k]!=='boolean'))return held('INVALID_EVIDENCE_APPROVAL');
  if(approvals.some(k=>receipt[k]!==true))return held('EVIDENCE_NOT_CONFIRMED');
  // Do not return customer data, merchant numbers, bank records or arbitrary receipt fields.
  return Object.freeze({mode:'disabled',canSubmit:false,readyForReview:true,route:routeName,organization:route.organization,purpose:route.purpose,midSlot:slot.slot,gatewayGroupAlias:slot.gateway_group_alias,evidenceRef:receipt.evidenceRef,recurring:'separate-review-required'});
 } catch { return held('INVALID_BOARDING_DOCUMENT'); }
}
