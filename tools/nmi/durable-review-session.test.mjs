// Fictional server-port race against the actual disabled durable reviewer.
// No database installation, provider request, credential, payment or real identity.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDurablePilotReviewer} from './durable-pilot-review.mjs';
const ids=Array.from({length:6},(_,i)=>`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
function fixture(organization){
 const selection={organizationId:ids[0],formId:ids[1],fundId:ids[2],routeId:ids[3]};
 const ownership=organization==='SowGo'?'SowGo':'Church';
 const evidence={...selection,fictional:true,revoked:false,approved:true,independentReview:true,kind:'one-time',midSlot:'MID-01',revision:1,expiresAt:'2099-01-01',organization,purpose:'charitable_contribution',gatewayId:ids[5],midAlias:'MID-01',legalMerchant:`Synthetic${ownership}Legal`,settlementOwner:`Synthetic${ownership}Bank`,receiptOwner:`Synthetic${ownership}Receipt`,evidenceRef:'SyntheticReview'};
 const state={identity:{userId:ids[4],sessionId:'fictional-session',verified:true},evidenceCalls:0,authCalls:0,queries:[],throwAuth:false};
 const held=deferred(),release=deferred();
 const row={checked:true,status:'active',is_public:true,account_enabled:true,proof_enabled:true,nmi_route_enabled:true,recurring_allowed:false,form_enabled:false,control_enabled:false,purpose:evidence.purpose,gateway_id:evidence.gatewayId,mid_reference:evidence.midAlias,proof_mid:evidence.midAlias,merchant_reference:evidence.legalMerchant,proof_merchant:evidence.legalMerchant,settlement_reference:evidence.settlementOwner,receipt_identity:evidence.receiptOwner,proof_reference:evidence.evidenceRef,route_revision:1};
 const ports={
  authenticate:async()=>{state.authCalls++;if(state.throwAuth)throw Error('SYNTHETIC_PRIVATE_AUTH_FAILURE');return structuredClone(state.identity)},
  resolveEvidence:async()=>{if(++state.evidenceCalls===2){held.resolve();await release.promise}return structuredClone(evidence)},
  withReadOnlyTransaction:async read=>read({query:async(sql,args)=>{
   state.queries.push({sql,args});
   if(sql.includes('set_config'))return{rows:[{}]};
   if(sql.includes('outreach_verified'))return{rows:[{allowed:true}]};
   if(sql.includes('payments_route('))return{rows:[{route:{provider:'nmi',environment:'sandbox',currency:'USD',processor_route_id:selection.routeId}}]};
   if(sql.includes('payment_ops_incidents'))return{rows:[{blocked:false}]};
   return{rows:[structuredClone(row)]};
  }})
 };
 return{state,held,release,run:()=>createDurablePilotReviewer(ports)(selection)};
}
function disabled(result,state){
 for(const flag of ['canSubmit','canRetry','canPostLedger','providerVerified'])assert.equal(result[flag],false,flag+' always off');
 assert(state.queries.every(q=>q.sql.startsWith('select ')),'only existing read queries used');
 assert.equal(state.authCalls,2,'final identity read uses existing second authentication, no extra loop');
 assert.equal(JSON.stringify(result).includes('Synthetic'),false,'no merchant or Auth details projected');
}
for(const organization of ['Champion Life','SowGo']){
 for(const change of ['account','session','logout','unverified','auth-error'])test(`${organization}: ${change} during final evidence lookup denies old review`,async()=>{
  const f=fixture(organization),pending=f.run();await f.held.promise;
  if(change==='account')f.state.identity={...f.state.identity,userId:ids[3]};
  if(change==='session')f.state.identity={...f.state.identity,sessionId:'replacement-session'};
  if(change==='logout')f.state.identity=null;
  if(change==='unverified')f.state.identity={...f.state.identity,verified:false};
  if(change==='auth-error')f.state.throwAuth=true;
  f.release.resolve();const result=await pending;
  disabled(result,f.state);assert.equal(result.reviewableSnapshot,false,'retired identity cannot receive a reviewable snapshot');
 });
 test(`${organization}: unchanged identity after delayed lookup remains reviewable but disabled`,async()=>{
  const f=fixture(organization),pending=f.run();await f.held.promise;
  f.state.identity=structuredClone(f.state.identity);f.release.resolve();const result=await pending;
  disabled(result,f.state);assert.equal(result.reviewableSnapshot,true);assert.equal(result.reason,'DISABLED_DURABLE_SNAPSHOT_REVIEWABLE');
 });
}
