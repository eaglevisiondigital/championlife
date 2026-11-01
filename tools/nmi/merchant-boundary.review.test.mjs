import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluate, evaluatePilot} from './mid-readiness.mjs';
import {prepareDisabledRoute} from './disabled-routing.mjs';

// Fictional non-secret metadata ONLY. Never model actual MIDs, bank accounts or credentials.
const NOW='2026-11-02T15:00:00Z';
const ALL=['Main','Youth','Outreach','Events','Merch'];
const VERIFIED=['legal_recipient_status','processor_status','settlement_owner_status','recurring_vault_status','test_access_status'];
function fixture(){
 const doc=JSON.parse(readFileSync(new URL('../../docs/nmi-four-mid-readiness.template.json',import.meta.url),'utf8'));
 for(const [i,slot] of doc.mid_slots.entries()){
  slot.merchant_organization=i===1?'SowGo':'Champion Life';
  slot.gateway_group_alias='SyntheticGateway'+i;
  for(const k of VERIFIED)slot[k]='VERIFIED';
  slot.verified_at='2026-11-02T14:00:00Z';
  slot.verified_by='SyntheticReviewer';
 }
 for(const route of doc.checkout_routes){
  route.organization=route.route==='Outreach'?'SowGo':'Champion Life';
  route.mid_slot=route.route==='Outreach'?'MID-02':'MID-01';
  route.purpose=route.route==='Merch'?'purchase':route.route==='Events'?'event_fee':'contribution';
  route.boarded_purpose_approved=true;
  route.enabled=false;
 }
 for(const key of Object.keys(doc.controls))doc.controls[key]=true;
 // A new one-time route may be independently reviewed without adopting legacy recurring tokens.
 doc.controls.givehub_recurring_inventory_reviewed=false;
 return doc;
}
function receipt(doc,name){
 const route=doc.checkout_routes.find(x=>x.route===name),slot=doc.mid_slots.find(x=>x.slot===route.mid_slot);
 return {
  route:name,midSlot:slot.slot,organization:route.organization,purpose:route.purpose,
  gatewayGroupAlias:slot.gateway_group_alias,evidenceRef:'SyntheticEvidence',
  legalMerchantAlias:'SyntheticMerchant',settlementOwnerAlias:'SyntheticSettlement',
  receiptOwnerAlias:'SyntheticReceipt',verifiedBy:'SyntheticReviewerA',
  independentReviewer:'SyntheticReviewerB',verifiedAt:'2026-11-02T14:00:00Z',
  expiresAt:'2026-11-03T14:00:00Z',
  legalMerchantConfirmed:true,settlementOwnershipConfirmed:true,
  receiptOwnershipConfirmed:true,providerPurposeConfirmed:true
 };
}
function held(plan){assert.equal(plan.mode,'disabled');assert.equal(plan.canSubmit,false)}
test('all five routes are disabled even when fictional one-time boarding review succeeds',()=>{
 const doc=fixture();
 for(const route of ALL){
  const state=evaluatePilot(doc,route),plan=prepareDisabledRoute(doc,route,receipt(doc,route),NOW);
  assert.equal(state.ready,true);
  assert.equal(plan.readyForReview,true);held(plan);
 }
 assert.equal(evaluate(doc).ready,false);
});
test('no cross-merchant settlement: SowGo Outreach cannot silently use Church merchant',()=>{
 const doc=fixture();doc.checkout_routes.find(x=>x.route==='Outreach').mid_slot='MID-01';
 const p=evaluatePilot(doc,'Outreach');
 assert.equal(p.ready,false);
 const plan=prepareDisabledRoute(doc,'Outreach',receipt(doc,'Outreach'),NOW);
 held(plan);assert.equal(plan.readyForReview,false);
});
test('Main route cannot masquerade as SowGo even if slot and purpose are independently marked verified',()=>{
 const doc=fixture(),route=doc.checkout_routes.find(x=>x.route==='Main');
 route.organization='SowGo';route.mid_slot='MID-02';
 assert.equal(evaluatePilot(doc,'Main').ready,true);
 const plan=prepareDisabledRoute(doc,'Main',receipt(doc,'Main'),NOW);
 held(plan);assert.equal(plan.reason,'RECIPIENT_MISMATCH');
});
test('receipt must exactly match route, legal merchant and gateway evidence',()=>{
 const doc=fixture();
 const mutations=[
  x=>x.midSlot='MID-04',x=>x.route='Youth',x=>x.organization='SowGo',
  x=>x.purpose='purchase',x=>x.gatewayGroupAlias='SyntheticOther'
 ];
 for(const change of mutations){
  const r=receipt(doc,'Outreach');change(r);
  const plan=prepareDisabledRoute(doc,'Outreach',r,NOW);
  held(plan);assert.equal(plan.reason,'EVIDENCE_BINDING_MISMATCH');
 }
});
test('lack of independent verifier, expired evidence and nonboolean status never permit checkout',()=>{
 const doc=fixture();
 const invalids=[
  [r=>r.independentReviewer=r.verifiedBy,'INDEPENDENT_REVIEW_REQUIRED'],
  [r=>r.expiresAt='2026-11-02T14:59:59Z','EVIDENCE_NOT_CURRENT'],
  [r=>r.settlementOwnershipConfirmed='true','INVALID_EVIDENCE_APPROVAL'],
  [r=>r.settlementOwnershipConfirmed=false,'EVIDENCE_NOT_CONFIRMED']
 ];
 for(const [mutate,reason] of invalids){
  const r=receipt(doc,'Main');mutate(r);
  const plan=prepareDisabledRoute(doc,'Main',r,NOW);
  held(plan);assert.equal(plan.reason,reason);
 }
});
test('global approval is distinct from limited one-time pilot review and never grants recurring',()=>{
 const doc=fixture(),r=receipt(doc,'Main');
 const pilot=evaluatePilot(doc,'Main'),full=evaluate(doc);
 assert.equal(pilot.ready,true);assert.equal(full.ready,false);
 assert.ok(full.blockers.some(x=>x.includes('givehub_recurring_inventory_reviewed')));
 const plan=prepareDisabledRoute(doc,'Main',r,NOW);
 held(plan);assert.equal(plan.recurring,'separate-review-required');
});
test('even a synthetic reviewed route remains non-submittable if enabled in contract',()=>{
 const doc=fixture();doc.checkout_routes.find(x=>x.route==='Main').enabled=true;
 const plan=prepareDisabledRoute(doc,'Main',receipt(doc,'Main'),NOW);
 held(plan);assert.equal(plan.readyForReview,false);
 assert.equal(plan.reason,'ROUTE_MUST_REMAIN_DISABLED');
});
test('merchant evidence becoming pending immediately holds isolated route',()=>{
 for(const k of ['legal_recipient_status','processor_status','settlement_owner_status','test_access_status']){
  const doc=fixture();doc.mid_slots[1][k]='PENDING';
  assert.equal(evaluatePilot(doc,'Outreach').ready,false);
  const plan=prepareDisabledRoute(doc,'Outreach',receipt(doc,'Outreach'),NOW);
  held(plan);assert.equal(plan.readyForReview,false);
 }
});
