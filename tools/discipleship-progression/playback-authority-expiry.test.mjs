import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, createHash, sign} from 'node:crypto';
import {createPlaybackEnvelopeVerifier, PLAYBACK_SIGNATURE_DOMAIN} from './playback-envelope-verifier.mjs';
import {reviewTrustedProgression} from './trusted-evidence-adapter.mjs';
import {COURSE} from './evidence-review.mjs';

// Real verifier/adapter composition, fictional keys and ledger only. No provider
// observation, database transaction or hosted acceptance is claimed.
function fixture({observerExpiry=150000, receiptExpiry=200000}={}) {
  const {privateKey, publicKey}=generateKeyPairSync('ed25519');
  let time=100000;
  const payload={id:'receipt-1',userId:'learner-a',sessionId:'session-a',course:COURSE,lesson:1,mediaId:'video-1',videoRevision:'v1',provider:'fictional-observer',policyVersion:'policy-1',observedAt:0,validUntil:receiptExpiry,eligiblePlayback:true,startMs:0,endMs:95000,elapsedMs:95000};
  const bytes=Buffer.from(JSON.stringify(payload));
  const envelope=JSON.stringify({version:1,keyId:'key-1',payload:bytes.toString('base64url'),signature:sign(null,Buffer.concat([Buffer.from(PLAYBACK_SIGNATURE_DOMAIN),bytes]),privateKey).toString('base64url')});
  const registry={provider:payload.provider,keyId:'key-1',revision:'observer-1',active:true,source:'independent_provider_observation',effectiveAt:0,expiresAt:observerExpiry,review:{accepted:true,id:'fictional-review',sourceSha256:'a'.repeat(64)},policies:[{course:COURSE,lesson:1,mediaId:'video-1',videoRevision:'v1',policyVersion:'policy-1'}],publicKeyPem:publicKey.export({type:'spki',format:'pem'}),publicKeySha256:createHash('sha256').update(publicKey.export({type:'spki',format:'der'})).digest('hex')};
  const ledger={userId:payload.userId,sessionId:payload.sessionId,course:COURSE,lesson:1,revision:1,sessionActive:true,enrolled:true,mediaId:payload.mediaId,videoRevision:payload.videoRevision,videoApproved:true,policyVersion:payload.policyVersion,durationMs:100000,receipts:[{id:payload.id,envelope}],answerReceipt:{id:'answer-1',userId:payload.userId,course:COURSE,lesson:1,revision:1,durable:true,complete:true}};
  const verifier=createPlaybackEnvelopeVerifier({repository:{withCurrentObserver:async(_,read)=>read(registry)},now:()=>time});
  const ports={authenticate:async()=>({userId:payload.userId,sessionId:payload.sessionId,active:true,verified:true}),loadLedger:async()=>ledger,verifyPlayback:verifier,withCurrentLedger:async(_,read)=>read(ledger)};
  return {registry,ledger,ports,verifier,envelope,setTime:value=>time=value,run:()=>reviewTrustedProgression({course:COURSE,lesson:1},ports,{now:()=>time})};
}

test('observer expires after serialized callback but before ledger transaction returns',async()=>{
  const f=fixture();
  f.ports.withCurrentLedger=async(_,read)=>{await read(f.ledger);f.setTime(150000)};
  const r=await f.run();
  assert.equal(r.advanceEvidence,false);
  assert.equal(r.completionEvidence,false);
  assert.equal(r.canCommit,false);
});

for(const [observerExpiry,receiptExpiry,expected] of [[150000,200000,150000],[250000,200000,200000],[null,200000,200000],[200000,200000,200000]]) {
  test(`verifier derives earliest authority deadline ${observerExpiry}/${receiptExpiry}`,async()=>{
    const f=fixture({observerExpiry,receiptExpiry});
    assert.equal((await f.verifier(f.envelope)).authorityValidUntil,expected);
    const r=await f.run();assert.equal(r.advanceEvidence,true);assert.equal(r.completionEvidence,true);assert.equal(r.canCommit,false);
  });
}
for(const [stage,time,expected] of [['before-lock',149999,true],['before-lock',150000,false],['after-verification',150000,false],['after-callback',149999,true],['after-callback',150000,false],['after-callback',150001,false]]) {
  test(`${stage} observes exact registry deadline at ${time}`,async()=>{
    const f=fixture();
    if(stage==='after-verification') {
      let calls=0;f.ports.verifyPlayback=async(...args)=>{const r=await f.verifier(...args);if(++calls===2)f.setTime(time);return r};
    } else f.ports.withCurrentLedger=async(_,read)=>{if(stage==='before-lock')f.setTime(time);await read(f.ledger);if(stage==='after-callback')f.setTime(time)};
    const r=await f.run();assert.equal(r.advanceEvidence,expected);assert.equal(r.completionEvidence,expected);assert.equal(r.canCommit,false);
  });
}
for(const value of [undefined,null,0,-1,100000,200001,'150000',NaN,Infinity,{},true]) {
  test(`unbound or invalid deadline rejects ${String(value)}`,async()=>{
    const f=fixture();f.ports.verifyPlayback=async(...args)=>({...await f.verifier(...args),authorityValidUntil:value});
    const r=await f.run();assert.equal(r.advanceEvidence,false);assert.equal(r.completionEvidence,false);
  });
}
for(const time of [NaN,Infinity,-1,'100000',null,94999]) {
  test(`invalid clock at final return denies ${String(time)}`,async()=>{
    const f=fixture();f.ports.withCurrentLedger=async(_,read)=>{await read(f.ledger);f.setTime(time)};
    const r=await f.run();assert.equal(r.advanceEvidence,false);assert.equal(r.completionEvidence,false);
  });
}
test('authority extension cannot silently replace the first exact proof',async()=>{
  const f=fixture();f.ports.withCurrentLedger=async(_,read)=>{f.registry.expiresAt=175000;return read(f.ledger)};
  assert.equal((await f.run()).advanceEvidence,false);
});
test('authority reduction cannot silently replace the first exact proof',async()=>{
  const f=fixture();f.ports.withCurrentLedger=async(_,read)=>{f.registry.expiresAt=125000;return read(f.ledger)};
  assert.equal((await f.run()).advanceEvidence,false);
});
test('longer registry deadline never extends receipt expiry',async()=>{
  const f=fixture({observerExpiry:250000});f.ports.withCurrentLedger=async(_,read)=>{await read(f.ledger);f.setTime(200000)};
  assert.equal((await f.run()).advanceEvidence,false);
});
test('duplicate replay cannot extend registry deadline',async()=>{
  const f=fixture();f.ledger.receipts.push({...f.ledger.receipts[0]});
  f.ports.withCurrentLedger=async(_,read)=>{await read(f.ledger);f.setTime(150000)};
  assert.equal((await f.run()).advanceEvidence,false);
});
test('metadata output exposes neither deadline nor learner/answer bindings',async()=>{
  const f=fixture(),r=await f.run();assert.equal(r.completionEvidence,true);
  for(const text of ['authorityValidUntil','learner-a','answer-1','session-a'])assert.equal(JSON.stringify(r).includes(text),false);
});
