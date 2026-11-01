import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boardingDocumentDigest,prepareFourMidHandoff} from './boarding-handoff.mjs';
const NOW='2026-11-02T15:00:00Z';
export function fixture(){
 const d=JSON.parse(readFileSync(new URL('../../docs/nmi-four-mid-readiness.template.json',import.meta.url)));
 for(const [i,s] of d.mid_slots.entries()){
  s.merchant_organization=i===1?'SowGo':'Champion Life';s.gateway_group_alias='Gateway'+i;
  for(const k of ['legal_recipient_status','processor_status','settlement_owner_status','test_access_status'])s[k]='VERIFIED';
  s.verified_by='ReviewerA';s.verified_at='2026-11-02T14:00:00Z';
 }
 for(const r of d.checkout_routes){r.organization=r.route==='Outreach'?'SowGo':'Champion Life';r.mid_slot=r.route==='Outreach'?'MID-02':r.route==='Events'?'MID-03':r.route==='Merch'?'MID-04':'MID-01';r.purpose=r.route==='Merch'?'purchase':r.route==='Events'?'event_fee':'contribution';r.boarded_purpose_approved=true;}
 for(const k of Object.keys(d.controls))d.controls[k]=true;
 d.controls.givehub_recurring_inventory_reviewed=false;
 const digest=boardingDocumentDigest(d);
 const reviews=d.mid_slots.map((s,i)=>({slot:s.slot,documentSha256:digest,evidenceRef:'Evidence'+i,legalMerchantAlias:'Legal'+i,settlementOwnerAlias:'BankOwner'+i,receiptOwnerAlias:'Receipt'+i,verifiedBy:'ReviewerA',independentReviewer:'ReviewerB',verifiedAt:s.verified_at,expiresAt:'2026-11-03T14:00:00Z',revoked:false,legalMerchantConfirmed:true,settlementOwnershipConfirmed:true,receiptOwnershipConfirmed:true,providerPurposeConfirmed:true}));
 const receipts=d.checkout_routes.map(r=>{const s=d.mid_slots.find(x=>x.slot===r.mid_slot),v=reviews.find(x=>x.slot===s.slot);const {slot,documentSha256,revoked,...rest}=v;return {...rest,route:r.route,midSlot:s.slot,organization:r.organization,purpose:r.purpose,gatewayGroupAlias:s.gateway_group_alias};});
 return {d,reviews,receipts};
}
const run=f=>prepareFourMidHandoff(f.d,f.reviews,f.receipts,NOW);
const deny=f=>{const r=run(f);assert.equal(r.readyForPrivateReview,false);assert.equal(r.canSubmit,false);assert.equal(r.providerVerified,false);};
test('four fictional merchant reviews map five disabled routes; recurring remains separate',()=>{const r=run(fixture());assert.equal(r.readyForPrivateReview,true);assert.equal(r.reviewedSlots,4);assert.equal(r.routes.length,5);assert.equal(r.canSubmit,false);assert.equal(r.providerVerified,false);assert.equal(r.recurring,'separate-review-required');assert.deepEqual(r.routes.find(x=>x.route==='Outreach'),{route:'Outreach',midSlot:'MID-02',organization:'SowGo'});assert.ok(Object.isFrozen(r.routes[0]));});
test('document digest is independent of JSON object key order',()=>{const f=fixture();assert.equal(boardingDocumentDigest(f.d),boardingDocumentDigest(Object.fromEntries(Object.entries(f.d).reverse())));});
const mutations={
 'duplicate MID slot':f=>f.d.mid_slots[3]=structuredClone(f.d.mid_slots[2]),
 'duplicate review':f=>f.reviews[3]=structuredClone(f.reviews[2]),
 'missing unused MID review':f=>f.reviews.pop(),
 'extra review':f=>f.reviews.push(structuredClone(f.reviews[0])),
 'duplicate route':f=>f.receipts[4]=structuredClone(f.receipts[0]),
 'missing route':f=>f.receipts.pop(),
 'changed gateway':f=>f.d.mid_slots[1].gateway_group_alias='ChangedGateway',
 'changed settlement':f=>f.reviews[1].settlementOwnerAlias='ChangedBank',
 'changed legal merchant':f=>f.reviews[1].legalMerchantAlias='ChangedLegal',
 'changed purpose':f=>f.d.checkout_routes[3].purpose='contribution',
 'changed source':f=>f.d.source.champion_pr34='a'.repeat(40),
 'string enabled':f=>f.d.checkout_routes[0].enabled='false',
 'enabled route':f=>f.d.checkout_routes[0].enabled=true,
 'raw MID field':f=>f.d.mid_slots[0].merchant_id='PRIVATE-NUMBER',
 'raw bank field':f=>f.reviews[0].bank_account='PRIVATE-NUMBER',
 'same reviewer':f=>f.reviews[0].independentReviewer=f.reviews[0].verifiedBy,
 'expired review':f=>f.reviews[0].expiresAt=NOW,
 'future review':f=>f.reviews[0].verifiedAt='2026-11-03T14:00:00Z',
 'revoked review':f=>f.reviews[0].revoked=true,
 'string revocation':f=>f.reviews[0].revoked='false',
 'missing revocation':f=>delete f.reviews[0].revoked,
 'stale document digest':f=>f.reviews[0].documentSha256='0'.repeat(64),
 'wrong route MID':f=>f.receipts[0].midSlot='MID-04',
 'wrong route owner':f=>f.receipts[1].organization='SowGo',
 'missing legal confirmation':f=>delete f.reviews[0].legalMerchantConfirmed,
 'empty input':f=>f.d=null,
};
for(const [name,change]of Object.entries(mutations))test(name+' denies',()=>{const f=fixture();change(f);deny(f);});
for(const val of ['true','false',1,0,null,'',[],{}])test('nonboolean approval '+JSON.stringify(val)+' denies',()=>{const f=fixture();f.reviews[0].settlementOwnershipConfirmed=val;deny(f);});
for(const field of ['legalMerchantAlias','settlementOwnerAlias','receiptOwnerAlias'])test('cross-organization '+field+' denied even if route receipts agree',()=>{const f=fixture();f.reviews[1][field]=f.reviews[0][field];f.receipts.find(r=>r.route==='Outreach')[field]=f.reviews[0][field];deny(f);});
test('all output remains sanitized even on invalid input',()=>{const f=fixture();f.reviews[0].secret='DO_NOT_ECHO';assert.ok(!JSON.stringify(run(f)).includes('DO_NOT_ECHO'));});
test('pending original template never appears provider verified or actionable',()=>{const d=JSON.parse(readFileSync(new URL('../../docs/nmi-four-mid-readiness.template.json',import.meta.url)));const r=prepareFourMidHandoff(d,[],[],NOW);assert.equal(r.readyForPrivateReview,false);assert.equal(r.canSubmit,false);assert.equal(r.providerVerified,false);});
test('invalid date is denied without parser exception',()=>{const f=fixture();assert.equal(prepareFourMidHandoff(f.d,f.reviews,f.receipts,'2026-11-02').readyForPrivateReview,false);});
