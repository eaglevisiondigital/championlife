import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { probeDisabledExecutor, probeDisabledGateway } from './disabled-executor-probe.mjs';
import { loadPinnedExecutor } from './pinned-executor.mjs';

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

async function probe(f) {
  const before = JSON.stringify(f), r = await probeDisabledExecutor(f);
  assert.equal(JSON.stringify(f), before);
  for (const key of ['canSubmit','canRetry','canPostLedger','providerVerified']) assert.equal(r[key],false);
  assert.equal(r.mode,'disabled'); assert.ok(Object.isFrozen(r)); assert.ok(Object.isFrozen(r.simulatedRpcCalls));
  assert.ok(!r.simulatedRpcCalls.includes('FORBIDDEN_IO'));
  return r;
}
for (const org of ['SowGo','Champion Life']) test(`actual pinned executor holds ${org} fictional green route`,async()=>{
 const r=await probe(fixture(org)); assert.equal(r.reason,'EXISTING_EXECUTOR_HELD'); assert.equal(r.executorInvoked,true); assert.deepEqual(r.simulatedRpcCalls,[]);
});
for (const status of ['accepted','rejected','unknown']) test(`prior ${status} blocks executor and any repeated provider attempt`,async()=>{
 const r=await probe(attempted(fixture(),status)); assert.equal(r.executorInvoked,false); assert.deepEqual(r.simulatedRpcCalls,[]);
});
for (const [section,key] of [['binding','settlementOwnerAlias'],['binding','legalMerchantAlias'],['binding','receiptOwnerAlias'],['binding','gatewayAlias'],['binding','midSlot'],['binding','organization'],['binding','fundRef'],['intent','fundRef'],['intent','route'],['intent','organization'],['intent','midSlot'],['intent','gatewayAlias'],['authority','organization'],['authority','permission'],['receipt','evidenceRef']]) test(`${section}.${key} mismatch prevents executor claim`,async()=>{
 const f=fixture(); f[section][key]='OtherValue'; const r=await probe(f); assert.equal(r.executorInvoked,false); assert.deepEqual(r.simulatedRpcCalls,[]);
});
for(const operation of ['recurring','refund','void','capture','transaction']) test(`unsupported ${operation} cannot reach executor`,async()=>{
 const f=fixture(); f.intent.kind=operation; assert.equal((await probe(f)).executorInvoked,false);
});
for (const key of ['config','rpc','fetcher','readSecret','payment_token','enabled','recoveryEnabled','acceptance_pin']) test(`caller cannot inject ${key}`,async()=>{
 const f=fixture(); f[key]={enabled:true}; const r=await probe(f); assert.equal(r.reason,'INVALID_PROBE_INPUT'); assert.deepEqual(r.simulatedRpcCalls,[]);
});
for(const section of ['document','receipt','binding','authority','intent','journal','observations','now']) test(`missing ${section} fails closed`,async()=>{
 const f=fixture();delete f[section]; assert.equal((await probe(f)).reason,'INVALID_PROBE_INPUT');
});
for(const value of [null,undefined,[],{},'true',true,1]) test(`invalid input ${JSON.stringify(value)} fails closed`,async()=>{
 assert.equal((await probe(value)).reason,'INVALID_PROBE_INPUT');
});
test('input snapshot cannot change during source loading',async()=>{
 const f=fixture();const pending=probeDisabledExecutor(f); f.document.checkout_routes[0].enabled=true;f.intent.organization='Champion Life';
 const r=await pending;assert.equal(r.reason,'EXISTING_EXECUTOR_HELD');assert.equal(r.canSubmit,false);
});
test('concurrent duplicate probes never hand off, complete, post a ledger or read a secret',async()=>{
 const results=await Promise.all(Array.from({length:20},()=>probe(fixture())));
 for(const r of results){assert.equal(r.reason,'EXISTING_EXECUTOR_HELD');assert.deepEqual(r.simulatedRpcCalls,[]);}
});
test('unverified real boarding template holds even when a fictional receipt is complete',async()=>{
 const f=fixture();f.document=JSON.parse(readFileSync(new URL('../../docs/nmi-four-mid-readiness.template.json',import.meta.url))); assert.equal((await probe(f)).executorInvoked,false);
});
// Independently exercise every existing executor operation under the closed configuration.
// These transports are test doubles only; no network, credential or database port exists.
for(const operation of ['sale','authorize','capture','transaction','refund','void','recurring_create','recurring_cancel','recurring_pause']) test(`canonical executor ${operation} remains held when disabled`,async()=>{
 const execute=await loadPinnedExecutor(),calls=[];
 const r=await execute({config:{enabled:false,recoveryEnabled:false,project:null},organization_id:'fictional-org',session_id:'fictional-session',id:'fictional-op',
  rpc:async(action)=>{calls.push(action);if(action==='claim')return{claimed:true,operation,scope:{gateway_id:'fictional-gateway'},lease:'fictional-lease'};if(action==='release')return{};throw Error('forbidden mutation');},
  fetcher:()=>{throw Error('forbidden fetch');},readSecret:()=>{throw Error('forbidden secret');}});
 assert.deepEqual(r,{status:'held',retry_automatically:false});assert.deepEqual(calls,[]);
});
test('unclaimed canonical request remains held without automatic retry or transport',async()=>{
 const execute=await loadPinnedExecutor(),calls=[];
 const r=await execute({config:{enabled:false},organization_id:'fictional-org',session_id:'fictional-session',id:'fictional-op',rpc:async(action)=>{calls.push(action);return{claimed:false};},fetcher:()=>assert.fail('fetch'),readSecret:()=>assert.fail('secret')});
 assert.deepEqual(r,{status:'held',retry_automatically:false});assert.deepEqual(calls,[]);
});

for(const organization of ['SowGo','Champion Life']) test(`actual pinned gateway rejects all claims for ${organization}`,async()=>{
 const r=await probeDisabledGateway(fixture(organization));assert.equal(r.reason,'EXISTING_GATEWAY_HELD');assert.equal(r.gatewayInvoked,true);assert.deepEqual(r.simulatedRpcCalls,[]);assert.equal(r.canSubmit,false);
});
for(const status of ['accepted','rejected','unknown'])test(`gateway prior ${status} never reaches source execution`,async()=>{
 const r=await probeDisabledGateway(attempted(fixture(),status));assert.equal(r.executorInvoked,false);assert.notEqual(r.gatewayInvoked,true);assert.deepEqual(r.simulatedRpcCalls,[]);
});
for(const key of ['config','rpc','fetcher','readSecret','enabled','recoveryEnabled','acceptance_pin'])test(`gateway cannot accept caller ${key}`,async()=>{
 const f=fixture();f[key]={enabled:true};const r=await probeDisabledGateway(f);assert.equal(r.reason,'INVALID_PROBE_INPUT');assert.equal(r.executorInvoked,false);
});
test('concurrent gateway probes cannot create sessions or claim jobs',async()=>{
 const results=await Promise.all(Array.from({length:20},()=>probeDisabledGateway(fixture())));for(const r of results){assert.equal(r.reason,'EXISTING_GATEWAY_HELD');assert.deepEqual(r.simulatedRpcCalls,[]);}
});
