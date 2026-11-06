import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';
import {COURSE, reviewProgression} from './evidence-review.mjs';
import {createPlaybackEnvelopeVerifier, PLAYBACK_SIGNATURE_DOMAIN} from './playback-envelope-verifier.mjs';
import {reviewTrustedProgression} from './trusted-evidence-adapter.mjs';

// Actual verifier/adapter composition with fictional keys and an intentionally
// single-media ledger. This is no claim of genuine viewing or provider approval.
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
function fixture(lesson,{endMs=95000,duplicate=false,expiresAt=150000}={}) {
  const p={id:'fictional-first-part',userId:'fictional-learner',sessionId:'fictional-session',course:COURSE,lesson,mediaId:'fictional-media',videoRevision:'v1',provider:'fictional-observer',policyVersion:'p1',observedAt:0,validUntil:200000,eligiblePlayback:true,startMs:0,endMs,elapsedMs:endMs};
  const bytes=Buffer.from(JSON.stringify(p));
  const envelope=JSON.stringify({version:1,keyId:'k1',payload:bytes.toString('base64url'),signature:sign(null,Buffer.concat([Buffer.from(PLAYBACK_SIGNATURE_DOMAIN),bytes]),privateKey).toString('base64url')});
  const registry={provider:p.provider,keyId:'k1',revision:'r1',active:true,source:'independent_provider_observation',effectiveAt:0,expiresAt,review:{accepted:true,id:'fictional-review',sourceSha256:'a'.repeat(64)},policies:[{course:COURSE,lesson,mediaId:p.mediaId,videoRevision:p.videoRevision,policyVersion:p.policyVersion}],publicKeyPem:publicKey.export({format:'pem',type:'spki'}),publicKeySha256:createHash('sha256').update(publicKey.export({format:'der',type:'spki'})).digest('hex')};
  const ledger={userId:p.userId,sessionId:p.sessionId,course:COURSE,lesson,revision:1,sessionActive:true,enrolled:true,mediaId:p.mediaId,videoRevision:p.videoRevision,policyVersion:p.policyVersion,videoApproved:true,durationMs:100000,receipts:[{id:p.id,envelope}],answerReceipt:{id:'fictional-answer',userId:p.userId,course:COURSE,lesson,revision:1,durable:true,complete:true}};
  if(duplicate) ledger.receipts.push({...ledger.receipts[0]});
  const verifyPlayback=createPlaybackEnvelopeVerifier({repository:{withCurrentObserver:async(_,read)=>read(registry)},now:()=>100000});
  return {p,ledger,envelope,verifyPlayback,run:()=>reviewTrustedProgression({course:COURSE,lesson},{authenticate:async()=>({userId:p.userId,sessionId:p.sessionId,active:true,verified:true}),loadLedger:async()=>ledger,verifyPlayback,withCurrentLedger:async(_,read)=>read(ledger)},{now:()=>100000})};
}
function assertHeld(result) {
  assert.equal(result.watchThresholdMet,false);
  assert.equal(result.advanceEvidence,false);
  assert.equal(result.completionEvidence,false);
  assert.equal(result.canCommit,false);
  assert.equal(result.reason,'media_unavailable');
}

for(const lesson of [6,8,9]) {
  test(`Lesson ${lesson} source contains multiple media without inventing required order or duration`,()=>{
    const html=readFileSync(new URL(`../../getting-a-grip-${lesson}.html`,import.meta.url),'utf8');
    assert.ok([...html.matchAll(/<iframe\b[^>]*src="https:\/\/www\.youtube\.com\/embed\//g)].length>1);
  });
  for(const [label,options] of [['95-percent',{}],['entire-single-part',{endMs:100000}],['replayed-single-part',{duplicate:true}]]) {
    test(`Lesson ${lesson} ${label} signed receipt cannot supply multipart advancement`,async()=>{
      const f=fixture(lesson,options);
      assert.equal((await f.verifyPlayback(f.envelope)).lesson,lesson);
      assertHeld(await f.run());
    });
  }
  test(`Lesson ${lesson} disconnected evaluator also rejects single-media evidence`,async()=>{
    const f=fixture(lesson),snapshot={...f.ledger,watchReceipts:[{...f.p,providerValidated:true}]};
    assertHeld(await reviewProgression({userId:f.p.userId,sessionId:f.p.sessionId,course:COURSE,lesson},{withCurrentEvidence:async(_,read)=>read(snapshot)}));
  });
}
for(const lesson of [1,2,3,4,5,7,10]) {
  test(`Lesson ${lesson} retains exact 95-percent single-media review without write authority`,async()=>{
    const result=await fixture(lesson).run();
    assert.equal(result.advanceEvidence,true);
    assert.equal(result.completionEvidence,lesson<=4);
    assert.equal(result.canCommit,false);
    assert.equal(JSON.stringify(result).includes('fictional-'),false);
    assert.equal((await fixture(lesson,{endMs:94999}).run()).advanceEvidence,false);
  });
}
for(const lesson of [11,12,13]) {
  test(`Lesson ${lesson} missing media stays held`,async()=>{
    const f=fixture(lesson);
    assert.equal(await f.verifyPlayback(f.envelope),null);
    assert.equal((await f.run()).advanceEvidence,false);
  });
}
test('single-media observer expiry remains enforced',async()=>{
  const result=await fixture(1,{expiresAt:100000}).run();
  assert.equal(result.advanceEvidence,false);
  assert.equal(result.canCommit,false);
});
