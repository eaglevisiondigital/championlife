import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewFictionalPilot } from './fictional-pilot-review.mjs';

const NOW = '2026-11-02T15:00:00Z';
function fixture(organization = 'SowGo') {
  const document = JSON.parse(readFileSync(new URL('../../docs/nmi-four-mid-readiness.template.json',import.meta.url)));
  const route = organization === 'SowGo' ? 'Outreach' : 'Main';
  const midSlot = organization === 'SowGo' ? 'MID-02' : 'MID-01';
  const slot = document.mid_slots.find(s => s.slot === midSlot);
  Object.assign(slot,{merchant_organization:organization,gateway_group_alias:'SyntheticGateway'});
  for (const key of ['legal_recipient_status','processor_status','settlement_owner_status','test_access_status']) slot[key] = 'VERIFIED';
  Object.assign(document.checkout_routes.find(r => r.route === route),{mid_slot:midSlot,boarded_purpose_approved:true});
  for (const key of Object.keys(document.controls)) document.controls[key] = key !== 'givehub_recurring_inventory_reviewed';
  const binding = {fictional:true,pilotRef:'SyntheticPilot',bindingRevision:2,route,fundRef:organization === 'SowGo' ? 'SoulFuel' : 'MainFund',organization,purpose:'contribution',midSlot,gatewayAlias:'SyntheticGateway',legalMerchantAlias:organization === 'SowGo' ? 'SowGoLegal' : 'ChurchLegal',settlementOwnerAlias:organization === 'SowGo' ? 'SowGoBank' : 'ChurchBank',receiptOwnerAlias:organization === 'SowGo' ? 'SowGoReceipt' : 'ChurchReceipt',evidenceRef:'SyntheticEvidence',verifiedBy:'FinanceReviewerOne',independentReviewer:'FinanceReviewerTwo',validFrom:'2026-11-02T14:00:00Z',expiresAt:'2026-11-03T14:00:00Z',revoked:false};
  const receipt = {route,midSlot,organization,purpose:binding.purpose,gatewayGroupAlias:binding.gatewayAlias,evidenceRef:binding.evidenceRef,legalMerchantAlias:binding.legalMerchantAlias,settlementOwnerAlias:binding.settlementOwnerAlias,receiptOwnerAlias:binding.receiptOwnerAlias,verifiedBy:binding.verifiedBy,independentReviewer:binding.independentReviewer,verifiedAt:binding.validFrom,expiresAt:binding.expiresAt,legalMerchantConfirmed:true,settlementOwnershipConfirmed:true,receiptOwnershipConfirmed:true,providerPurposeConfirmed:true};
  const authority = {fictional:true,principalRef:'FinanceOwner',verified:true,permission:'finance.pilot.review',organization,pilotRef:binding.pilotRef,bindingRevision:binding.bindingRevision,validFrom:binding.validFrom,expiresAt:binding.expiresAt,revoked:false};
  const intent = {fictional:true,pilotRef:binding.pilotRef,bindingRevision:binding.bindingRevision,idempotencyRef:'SyntheticIdempotency',orderRef:'SyntheticOrder',route,fundRef:binding.fundRef,organization,midSlot,gatewayAlias:binding.gatewayAlias,amountMinor:100,currency:'USD',kind:'one-time'};
  return {document,receipt,binding,authority,intent,journal:[],observations:[],now:NOW};
}
function attempted(f = fixture(), status = 'accepted') {
  const { intent:i } = f;
  const entry = {fictional:true,pilotRef:i.pilotRef,bindingRevision:i.bindingRevision,idempotencyRef:i.idempotencyRef,orderRef:i.orderRef,attemptRef:'SyntheticAttempt',organization:i.organization,midSlot:i.midSlot,gatewayAlias:i.gatewayAlias,amountMinor:i.amountMinor,currency:i.currency,uncertainAt:'2026-11-02T14:30:00Z'};
  f.journal.push(entry);
  const obs = Object.fromEntries(['fictional','attemptRef','orderRef','organization','midSlot','gatewayAlias','amountMinor','currency','bindingRevision'].map(k => [k,entry[k]]));
  Object.assign(obs,{observationRef:'SyntheticObservation',source:'fictional-provider-query',authoritative:true,status,transactionRef:status === 'accepted' ? 'SyntheticTransaction' : null,startedAt:'2026-11-02T14:31:00Z',completedAt:'2026-11-02T14:32:00Z',validUntil:'2026-11-02T15:30:00Z'});
  f.observations.push(obs); return f;
}
function review(f) {
  const before = JSON.stringify(f);
  const result = reviewFictionalPilot(f.document,f.receipt,f.binding,f.authority,f.intent,f.journal,f.observations,f.now);
  assert.equal(JSON.stringify(f),before,'inputs preserved');
  for (const key of ['canSubmit','canRetry','canPostLedger','providerVerified']) assert.equal(result[key],false,key);
  assert.equal(result.mode,'disabled'); assert.equal(Object.isFrozen(result),true);
  assert.deepEqual(Object.keys(result),['mode','canSubmit','canRetry','canPostLedger','providerVerified','classification','reason']);
  return result;
}
for (const organization of ['SowGo','Champion Life']) test(`${organization}: complete fictional one-time route can be reviewed without executing`,() => {
  const f = fixture(organization); assert.equal(review(f).classification,'FICTIONAL_PLAN_REVIEWABLE');
});
for (const status of ['accepted','rejected','unknown']) test(`prior ${status} never allows second attempt, retry or ledger posting`,() => {
  const result = review(attempted(fixture(),status));
  assert.equal(result.classification,status === 'unknown' ? 'UNKNOWN' : `FICTIONAL_${status.toUpperCase()}`);
});
const changes = [
  ['unselected route enabled',f => f.document.checkout_routes[1].enabled = true],
  ['selected route enabled',f => f.document.checkout_routes[2].enabled = true],
  ['boarding status revoked',f => f.document.mid_slots[1].legal_recipient_status = 'PENDING'],
  ['Soul Fuel Church MID',f => f.document.checkout_routes[2].mid_slot = 'MID-01'],
  ['Soul Fuel Church organization',f => f.document.checkout_routes[2].organization = 'Champion Life'],
  ['gateway swap',f => f.document.mid_slots[1].gateway_group_alias = 'DifferentGateway'],
  ['legal merchant swap',f => f.receipt.legalMerchantAlias = 'ChurchLegal'],
  ['settlement bank swap',f => f.receipt.settlementOwnerAlias = 'ChurchBank'],
  ['receipt owner swap',f => f.receipt.receiptOwnerAlias = 'ChurchReceipt'],
  ['unreviewed receipt replacement',f => f.receipt.evidenceRef = 'ReplacementEvidence'],
  ['same verifier',f => f.binding.independentReviewer = f.binding.verifiedBy],
  ['binding revoked',f => f.binding.revoked = true],
  ['binding expired',f => f.binding.expiresAt = NOW],
  ['binding not yet effective',f => f.binding.validFrom = '2026-11-02T16:00:00Z'],
  ['different receipt expiration',f => f.receipt.expiresAt = '2026-11-04T14:00:00Z'],
  ['different reviewer',f => f.receipt.independentReviewer = 'OtherReviewer'],
  ['unverified finance actor',f => f.authority.verified = false],
  ['revoked finance authority',f => f.authority.revoked = true],
  ['expired finance authority',f => f.authority.expiresAt = NOW],
  ['future finance authority',f => f.authority.validFrom = '2026-11-02T16:00:00Z'],
  ['other organization authority',f => f.authority.organization = 'Champion Life'],
  ['other pilot authority',f => f.authority.pilotRef = 'OtherPilot'],
  ['stale authority revision',f => f.authority.bindingRevision = 1],
  ['registration permission is not finance review',f => f.authority.permission = 'registration.view'],
  ['recurring intent held',f => f.intent.kind = 'recurring'],
  ['refund intent held',f => f.intent.kind = 'refund'],
  ['void intent held',f => f.intent.kind = 'void'],
  ['other intent organization',f => f.intent.organization = 'Champion Life'],
  ['other intent pilot',f => f.intent.pilotRef = 'OtherPilot'],
  ['other intent fund',f => f.intent.fundRef = 'OtherFund'],
  ['other intent route',f => f.intent.route = 'Main'],
  ['other intent MID',f => f.intent.midSlot = 'MID-01'],
  ['other intent gateway',f => f.intent.gatewayAlias = 'OtherGateway'],
  ['stale intent revision',f => f.intent.bindingRevision = 1],
  ['unsafe amount',f => f.intent.amountMinor = Number.MAX_SAFE_INTEGER + 1],
  ['fractional amount',f => f.intent.amountMinor = 0.5],
  ['zero amount',f => f.intent.amountMinor = 0],
  ['negative amount',f => f.intent.amountMinor = -1],
  ['currency unsupported',f => f.intent.currency = 'EUR'],
  ['invalid timestamp',f => f.now = '2026-11-02'],
  ['invalid journal array',f => f.journal = {}],
  ['invalid observations array',f => f.observations = null],
  ['orphan observation',f => f.observations = [{}]],
];
for (const [name,change] of changes) test(name,() => { const f = fixture(); change(f); assert.equal(review(f).classification,'HOLD'); });
for (const [section,key] of [['binding','revoked'],['authority','verified'],['authority','revoked'],['receipt','legalMerchantConfirmed'],['receipt','settlementOwnershipConfirmed'],['receipt','receiptOwnershipConfirmed'],['receipt','providerPurposeConfirmed']]) {
  for (const value of ['true','false',1,0,null,'',[],{}]) test(`${section}.${key} rejects ${JSON.stringify(value)}`,() => {
    const f = fixture(); f[section][key] = value; assert.equal(review(f).classification,'HOLD');
  });
}
for (const section of ['binding','authority','intent']) {
  for (const key of Object.keys(fixture()[section])) test(`${section} requires ${key}`,() => {
    const f = fixture(); delete f[section][key]; assert.equal(review(f).classification,'HOLD');
  });
  test(`${section} rejects extra private payload`,() => { const f = fixture(); f[section].secret = 'not-a-real-secret'; assert.equal(review(f).classification,'HOLD'); });
  test(`${section} requires explicit fictional mode`,() => { const f = fixture(); f[section].fictional = false; assert.equal(review(f).classification,'HOLD'); });
}
for (const key of ['pilotRef','bindingRevision','idempotencyRef','orderRef','organization','midSlot','gatewayAlias','amountMinor','currency']) test(`journal ${key} mismatch holds`,() => {
  const f = attempted(); f.journal[0][key] = typeof f.journal[0][key] === 'number' ? 99 : 'OtherValue'; assert.equal(review(f).classification,'HOLD');
});
test('identical journal and observation replay remains review-only and insensitive to key order',() => {
  const f = attempted(), expected = review(f); f.journal.push(Object.fromEntries(Object.entries(f.journal[0]).reverse())); f.observations.push(Object.fromEntries(Object.entries(f.observations[0]).reverse())); assert.deepEqual(review(f),expected);
});
test('same attempt with changed history is conflicting replay',() => {
  const f = attempted(); f.journal.push({...f.journal[0],uncertainAt:'2026-11-02T14:31:00Z'}); assert.equal(review(f).reason,'CONFLICTING_REPLAY');
});
test('another attempt under same idempotency key blocks',() => {
  const f = attempted(); f.journal.push({...f.journal[0],attemptRef:'AnotherAttempt'}); assert.equal(review(f).reason,'MULTIPLE_ATTEMPTS_REQUIRE_REVIEW');
});
test('empty result cannot clear a previously submitted attempt',() => { const f = attempted(); f.observations = []; assert.equal(review(f).classification,'UNKNOWN'); });
test('delayed response cannot clear uncertainty',() => { const f = attempted(); f.observations[0].completedAt = '2026-11-02T15:01:00Z'; assert.equal(review(f).classification,'UNKNOWN'); });
test('expired response cannot clear uncertainty',() => { const f = attempted(); f.observations[0].validUntil = NOW; assert.equal(review(f).classification,'UNKNOWN'); });
test('contradictory accepted/rejected evidence stays unknown',() => { const f = attempted(); f.observations.push({...f.observations[0],observationRef:'OtherObservation',status:'rejected',transactionRef:null}); assert.equal(review(f).classification,'UNKNOWN'); });
test('revocation cannot be overcome by a successful prior lookup',() => { const f = attempted(); f.binding.revoked = true; assert.equal(review(f).classification,'HOLD'); });
test('maximum journal bound fails closed',() => { const f = attempted(); f.journal = Array(101).fill(f.journal[0]); assert.equal(review(f).classification,'HOLD'); });
test('safe template remains unchanged and unready',() => { const f = fixture(); f.document = JSON.parse(readFileSync(new URL('../../docs/nmi-four-mid-readiness.template.json',import.meta.url))); assert.equal(review(f).classification,'HOLD'); });
