import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedProviderEvent} from '../../supabase/functions/_shared/communications/activation.mjs';

const profileId='11111111-1111-4111-8111-111111111111';
const organizationId='22222222-2222-4222-8222-222222222222';
const other='33333333-3333-4333-8333-333333333333';
function fixture() {
 const binding={profile_id:profileId,organization_id:organizationId,provider:'sms_transport',environment:'acceptance',project_ref:'fictional-only',from:'+15555550100',reply_to:null,verifier_key:'FICTIONAL_ONLY'};
 const profile={profile_id:profileId,organization_id:organizationId,environment:'acceptance',project_ref:'fictional-only',structured_callbacks:true,
  sender:{id:profileId,organization_id:organizationId,provider:'sms_transport',channel:'sms',from_address:binding.from,reply_to:null}};
 const event={type:'reconciliation',event_id:'synthetic-event',provider:'sms_transport',environment:'acceptance',project_ref:'fictional-only',message_id:other,
  attempt_id:'44444444-4444-4444-8444-444444444444',idempotency_key:'fictional-request',status:'sent',provider_message_id:'fictional-receipt'};
 return {binding,profile,event};
}
async function run(f,verifier=async()=>f.event) {
 const result=await verifiedProviderEvent('{}',new Headers(),f.profile,f.binding,verifier);
 assert.ok(!JSON.stringify(result).includes('FICTIONAL_ONLY'));
 assert.equal(result.payload.callback_context.organization_id,organizationId);
 assert.ok(!JSON.stringify(result).includes('verifier_key'));
 assert.deepEqual(Object.keys(result.payload.callback_context).sort(),['channel','environment','from_address','organization_id','profile_id','project_ref','provider','reply_to']);
 return result;
}
const changes={
 'registry profile':f=>f.binding.profile_id=other,
 'registry organization':f=>f.binding.organization_id=other,
 'registry provider':f=>f.binding.provider='smtp_transport',
 'registry environment':f=>f.binding.environment='production',
 'registry project':f=>f.binding.project_ref='other-project',
 'registry From':f=>f.binding.from='+15555550199',
 'registry Reply-To':f=>f.binding.reply_to='other@example.test',
 'profile ID':f=>f.profile.profile_id=other,
 'profile organization':f=>f.profile.organization_id=other,
 'profile environment':f=>f.profile.environment='production',
 'profile project':f=>f.profile.project_ref='other-project',
 'sender ID':f=>f.profile.sender.id=other,
 'sender organization':f=>f.profile.sender.organization_id=other,
 'sender provider':f=>f.profile.sender.provider='smtp_transport',
 'sender channel':f=>f.profile.sender.channel='email',
 'sender From':f=>f.profile.sender.from_address='+15555550199',
 'sender Reply-To':f=>f.profile.sender.reply_to='other@example.test',
};
for(const [name,change]of Object.entries(changes))test(`${name} mismatch denies before verifier`,async()=>{
 const f=fixture();change(f);let calls=0;
 await assert.rejects(run(f,async()=>{calls++;return f.event}),/binding mismatch/);assert.equal(calls,0);
});
for(const field of ['profile_id','organization_id','provider','environment','project_ref','from'])test(`missing registry ${field} denies before verifier`,async()=>{
 const f=fixture();delete f.binding[field];let calls=0;
 await assert.rejects(run(f,async()=>{calls++;return f.event}));assert.equal(calls,0);
});
for(const field of ['profile_id','organization_id','environment','project_ref','sender'])test(`missing SQL profile ${field} denies before verifier`,async()=>{
 const f=fixture();delete f.profile[field];let calls=0;
 await assert.rejects(run(f,async()=>{calls++;return f.event}));assert.equal(calls,0);
});
for(const [name,change]of Object.entries(changes))test(`${name} changes during verification cannot substitute context`,async()=>{
 const f=fixture();await assert.rejects(run(f,async()=>{change(f);return f.event}),/context changed/);
});
test('credential binding change during verification denies without exposing value',async()=>{
 const f=fixture();await assert.rejects(run(f,async()=>{f.binding.verifier_key='REPLACED_PRIVATE_VALUE';return f.event}),error=>error.message==='Provider callback context changed');
});
test('verifier gets an isolated binding and cannot mutate it into another account',async()=>{
 const f=fixture();await assert.rejects(run(f,async(_,__,b)=>{assert.notEqual(b,f.binding);b.profile_id=other;return f.event}),/context changed/);
 assert.equal(f.binding.profile_id,profileId);
});
test('structured callback capability revoked during verification denies',async()=>{
 const f=fixture();await assert.rejects(run(f,async()=>{f.profile.structured_callbacks=false;return f.event}),/context changed/);
});
test('matching reconciliation remains usable after outbound sending and consent stop',async()=>{
 const f=fixture();Object.assign(f.profile,{enabled:false,sender_approved:false,credentials_verified:false,consent:'revoked'});f.profile.sender.active=false;f.binding.sender_approved=false;
 const r=await run(f);assert.equal(r.action,'reconcile_external');assert.equal(r.payload.outcome,'sent');assert.equal(r.payload.attempt_id,f.event.attempt_id);
});
test('outbound flags changing during verification do not fabricate receipt cancellation',async()=>{
 const f=fixture();const r=await run(f,async()=>{f.profile.enabled=false;f.profile.sender.active=false;f.profile.consent='revoked';return f.event});assert.equal(r.action,'reconcile_external');
});
for(const status of ['rejected','uncertain'])test(`matching ${status} receipt preserves hold`,async()=>{
 const f=fixture();f.event.status=status;f.event.provider_message_id=null;const r=await run(f);assert.equal(r.payload.outcome,status);assert.equal(r.payload.provider_message_id,null);
});
test('matching delivery uses same profile fence',async()=>{
 const f=fixture();f.event.type='delivery';f.event.status='delivered';assert.equal((await run(f)).action,'callback_external');
});
test('matching STOP keyword uses same profile fence without creating send authority',async()=>{
 const f=fixture();f.event={type:'preference',event_id:'stop-event',provider:'sms_transport',keyword:'STOP',address:'+15555550101'};assert.equal((await run(f)).action,'keyword_external');
});
test('empty real verifier registry remains denied',async()=>{
 const f=fixture();await assert.rejects(verifiedProviderEvent('{}',new Headers(),f.profile,f.binding,undefined),/not configured/);
});
