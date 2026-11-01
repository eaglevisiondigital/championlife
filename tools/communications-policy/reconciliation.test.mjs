import test from 'node:test';import assert from 'node:assert/strict';import {createHmac,timingSafeEqual} from 'node:crypto';
import {verifiedProviderEvent} from '../../supabase/functions/_shared/communications/activation.mjs';
const binding={environment:'acceptance',project_ref:'fictional-only'},profile={structured_callbacks:true,sender:{provider:'sms_transport',channel:'sms'}};
const key=Buffer.from('fictional-signature-test-key-not-a-credential');
const event={type:'reconciliation',event_id:'evt-1',provider:'sms_transport',message_id:'11111111-1111-4111-8111-111111111111',attempt_id:'22222222-2222-4222-8222-222222222222',idempotency_key:'provider-test:fictional',environment:binding.environment,project_ref:binding.project_ref,status:'sent',provider_message_id:'receipt-1'};
const sign=raw=>createHmac('sha256',key).update(raw).digest('hex');
// Fictional audited-verifier interface, not a selected/installed vendor.
async function verifier(raw,headers){const sig=Buffer.from(headers.get('signature')||'','hex'),expected=Buffer.from(sign(raw),'hex');if(sig.length!==expected.length||!timingSafeEqual(sig,expected))throw Error('Signature denied');return JSON.parse(raw)}
const run=e=>{const raw=JSON.stringify(e);return verifiedProviderEvent(raw,new Headers({signature:sign(raw)}),profile,binding,verifier)};
test('authenticated exact UNKNOWN receipt maps to same existing RPC',async()=>{const r=await run(event);assert.equal(r.action,'reconcile_external');assert.equal(r.payload.attempt_id,event.attempt_id);assert.equal(r.payload.idempotency_key,event.idempotency_key);assert.equal(r.payload.outcome,'sent')});
test('forged body verified flag cannot replace signature',async()=>{await assert.rejects(verifiedProviderEvent(JSON.stringify({...event,verified:true}),new Headers(),profile,binding,verifier),/Signature denied/)});
test('no configured verifier denies',async()=>{await assert.rejects(verifiedProviderEvent(JSON.stringify(event),new Headers(),profile,binding,null))});
for(const field of ['message_id','attempt_id','idempotency_key','environment','project_ref','event_id','provider','status','provider_message_id'])for(const value of [undefined,null,''])test(`missing ${field}:${value}`,async()=>{await assert.rejects(run({...event,[field]:value}))});
for(const change of [{message_id:'another'},{attempt_id:'../x'},{idempotency_key:'x\ny'},{environment:'production'},{project_ref:'another'},{status:'delivered'},{status:'true'},{provider_message_id:'\tbad'},{organization_id:'caller-org'},{profile_id:'caller-profile'},{provider:'smtp_transport'}])test('reject wrong binding '+JSON.stringify(change),async()=>{await assert.rejects(run({...event,...change}))});
for(const status of ['rejected','uncertain'])test('negative outcome never binds provider ID '+status,async()=>{const r=await run({...event,status,provider_message_id:null});assert.equal(r.payload.outcome,status);assert.equal(r.payload.provider_message_id,null);await assert.rejects(run({...event,status}))});
test('authenticated delivery path still maps existing callback',async()=>{const r=await run({...event,type:'delivery',status:'delivered'});assert.equal(r.action,'callback_external');assert.equal(r.payload.outcome,'delivered')});

for(const flag of [false,'false','true',0,1,null,undefined,[],{}])test('structured callbacks must exact true '+JSON.stringify(flag),async()=>{let calls=0;await assert.rejects(verifiedProviderEvent('{}',{}, {...profile,structured_callbacks:flag},binding,async()=>{calls++;return event}));assert.equal(calls,0)});
