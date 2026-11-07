import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign} from 'node:crypto';
import {createPlaybackEnvelopeVerifier,PLAYBACK_SIGNATURE_DOMAIN} from './playback-envelope-verifier.mjs';
import {reviewTrustedProgression} from './trusted-evidence-adapter.mjs';
import {COURSE} from './evidence-review.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
function fixture(){
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');let time=100000,hook=async cb=>cb(registry);
 const proof={id:'receipt-1',userId:'learner-a',sessionId:'session-a',course:COURSE,lesson:1,mediaId:'video-1',videoRevision:'v1',provider:'fictional-observer',policyVersion:'reviewed-1',observedAt:0,validUntil:200000,eligiblePlayback:true,startMs:0,endMs:95000,elapsedMs:95000};
 const registry={provider:proof.provider,keyId:'key-1',revision:'registry-1',active:true,source:'independent_provider_observation',effectiveAt:0,expiresAt:200000,review:{accepted:true,id:'fictional-review',sourceSha256:'a'.repeat(64)},policies:[{course:COURSE,lesson:1,mediaId:'video-1',videoRevision:'v1',policyVersion:'reviewed-1'}],publicKeyPem:publicKey.export({type:'spki',format:'pem'}),publicKeySha256:sha(publicKey.export({type:'spki',format:'der'}))};
 function envelope(p=proof,domain=PLAYBACK_SIGNATURE_DOMAIN,key=privateKey){const bytes=Buffer.from(JSON.stringify(p));return JSON.stringify({version:1,keyId:'key-1',payload:bytes.toString('base64url'),signature:sign(null,Buffer.concat([Buffer.from(domain),bytes]),key).toString('base64url')})}
 const repository={async withCurrentObserver(target,cb){assert.deepEqual(target,{provider:proof.provider,keyId:'key-1'});return hook(cb)}};
 const verifier=createPlaybackEnvelopeVerifier({repository,now:()=>time});
 return{proof,registry,repository,verifier,envelope,setNow:x=>time=x,setHook:x=>hook=x};
}
test('fictional Ed25519 signature verifies integrity but does not commit progress',async()=>{const f=fixture(),e=f.envelope(),r=await f.verifier(e);assert.equal(r.envelopeSha256,sha(e));assert.equal(r.source,'independent_provider_observation');assert.equal(r.observerRevision,'registry-1');assert.equal(r.canCommit,undefined)});
test('absent observer repository denies even a valid signature',async()=>{const f=fixture();assert.equal(await createPlaybackEnvelopeVerifier()(f.envelope()),null)});
for(const [key,value]of Object.entries({active:false,source:'signed_client_telemetry',revision:null,provider:'other',keyId:'other',effectiveAt:1,expiresAt:100000,publicKeySha256:'0'.repeat(64),publicKeyPem:'invalid',policies:'all'}))test('registry denies '+key,async()=>{const f=fixture();f.registry[key]=value;assert.equal(await f.verifier(f.envelope()),null)});
for(const value of [false,'true',1,null])test('observer source approval exact boolean '+value,async()=>{const f=fixture();f.registry.review.accepted=value;assert.equal(await f.verifier(f.envelope()),null)});
for(const key of ['id','sourceSha256'])test('source review lacks '+key,async()=>{const f=fixture();delete f.registry.review[key];assert.equal(await f.verifier(f.envelope()),null)});
for(const key of ['course','lesson','mediaId','videoRevision','policyVersion'])test('registry policy binding '+key,async()=>{const f=fixture();f.registry.policies[0][key]='other';assert.equal(await f.verifier(f.envelope()),null)});
for(const [key,value] of Object.entries({id:null,userId:null,sessionId:null,course:'other',lesson:11,mediaId:null,videoRevision:null,provider:null,policyVersion:null,observedAt:100001,validUntil:100000,eligiblePlayback:'true',startMs:-1,endMs:0,elapsedMs:94000}))test('signed invalid proof '+key,async()=>{const f=fixture();assert.equal(await f.verifier(f.envelope({...f.proof,[key]:value})),null)});
test('cross-protocol signature denies',async()=>{const f=fixture();assert.equal(await f.verifier(f.envelope(f.proof,'other-domain\n')),null)});
test('wrong signer denies',async()=>{const f=fixture(),{privateKey}=generateKeyPairSync('ed25519');assert.equal(await f.verifier(f.envelope(f.proof,PLAYBACK_SIGNATURE_DOMAIN,privateKey)),null)});
test('tampered payload denies',async()=>{const f=fixture(),e=JSON.parse(f.envelope());e.payload=Buffer.from(JSON.stringify({...f.proof,userId:'learner-b'})).toString('base64url');assert.equal(await f.verifier(JSON.stringify(e)),null)});
for(const k of ['publicKey','jwksUrl','accepted','source'])test('caller cannot inject '+k,async()=>{const f=fixture();assert.equal(await f.verifier(JSON.stringify({...JSON.parse(f.envelope()),[k]:'untrusted'})),null)});
test('missing signature denies',async()=>{const f=fixture(),e=JSON.parse(f.envelope());delete e.signature;assert.equal(await f.verifier(JSON.stringify(e)),null)});
test('noncanonical base64 denies',async()=>{const f=fixture(),e=JSON.parse(f.envelope());e.payload+='=';assert.equal(await f.verifier(JSON.stringify(e)),null)});
test('oversized envelope denies',async()=>assert.equal(await fixture().verifier(' '.repeat(65537)),null));
test('omitted callback cannot forge proof',async()=>{const f=fixture();f.setHook(async()=>f.proof);assert.equal(await f.verifier(f.envelope()),null)});
test('repeated registry callback denies',async()=>{const f=fixture();f.setHook(async cb=>{cb(f.registry);cb(f.registry)});assert.equal(await f.verifier(f.envelope()),null)});
test('expiry during registry transaction denies',async()=>{const f=fixture();f.setHook(async cb=>{cb(f.registry);f.setNow(200000)});assert.equal(await f.verifier(f.envelope()),null)});
test('cancelled verification cannot return proof',async()=>{const f=fixture(),c=new AbortController();f.setHook(async cb=>{cb(f.registry);c.abort()});assert.equal(await f.verifier(f.envelope(),{signal:c.signal}),null)});
function progression(f){
 const ledger={userId:'learner-a',sessionId:'session-a',course:COURSE,lesson:1,revision:1,sessionActive:true,enrolled:true,mediaId:'video-1',videoRevision:'v1',videoApproved:true,policyVersion:'reviewed-1',durationMs:100000,receipts:[{id:'receipt-1',envelope:f.envelope()}],answerReceipt:{id:'answers-1',userId:'learner-a',course:COURSE,lesson:1,revision:1,durable:true,complete:true}};
 const ports={authenticate:async()=>({userId:'learner-a',sessionId:'session-a',active:true,verified:true}),loadLedger:async()=>ledger,verifyPlayback:f.verifier,withCurrentLedger:async(_,read)=>read(ledger)};
 const run=()=>reviewTrustedProgression({course:COURSE,lesson:1},ports,{now:()=>100000});return{ledger,ports,run};
}
test('actual signed fictional envelopes integrate with unique watch gate',async()=>{const f=fixture(),p=progression(f);const r=await p.run();assert.equal(r.completionEvidence,true);assert.equal(r.canCommit,false)});
for(const [k,v]of [['active',false],['revision','registry-2'],['source','signed_client_telemetry']])test('observer authority changes while waiting ledger '+k,async()=>{const f=fixture(),p=progression(f);p.ports.withCurrentLedger=async(_,read)=>{f.registry[k]=v;return read(p.ledger)};assert.equal((await p.run()).advanceEvidence,false)});
for(const [k,v] of [['userId','learner-b'],['sessionId','session-b'],['lesson',2],['mediaId','video-b'],['videoRevision','v2'],['policyVersion','other']])test('valid signature cannot cross progression binding '+k,async()=>{const f=fixture(),p=progression(f);p.ledger.receipts[0].envelope=f.envelope({...f.proof,[k]:v});assert.equal((await p.run()).advanceEvidence,false)});
test('duplicate signed replay gives no extra unique watch credit',async()=>{const f=fixture();f.proof.endMs=50000;f.proof.elapsedMs=50000;const p=progression(f);p.ledger.receipts.push({...p.ledger.receipts[0]});assert.equal((await p.run()).advanceEvidence,false)});
test('conflicting signed receipt replay denies',async()=>{const f=fixture(),p=progression(f);p.ledger.receipts.push({id:'receipt-1',envelope:f.envelope({...f.proof,endMs:96000,elapsedMs:96000})});assert.equal((await p.run()).advanceEvidence,false)});
test('non-Ed25519 key rejected regardless matching fingerprint',async()=>{const f=fixture(),{publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});f.registry.publicKeyPem=publicKey.export({type:'spki',format:'pem'});f.registry.publicKeySha256=sha(publicKey.export({type:'spki',format:'der'}));assert.equal(await f.verifier(f.envelope()),null)});

test('ledger mutation during second observer verification denies',async()=>{const f=fixture(),p=progression(f);let n=0;p.ports.verifyPlayback=async(...args)=>{const result=await f.verifier(...args);if(++n===2)p.ledger.sessionActive=false;return result};assert.equal((await p.run()).advanceEvidence,false)});
test('second verification error denies without exposing diagnostic',async()=>{const f=fixture(),p=progression(f);let n=0;p.ports.verifyPlayback=async(...args)=>{if(++n===2)throw Error('private provider diagnostic');return f.verifier(...args)};const r=await p.run();assert.equal(r.advanceEvidence,false);assert.equal(JSON.stringify(r).includes('private'),false)});
test('signature from revoked review source denies while ledger waits',async()=>{const f=fixture(),p=progression(f);p.ports.withCurrentLedger=async(_,read)=>{f.registry.review.accepted=false;return read(p.ledger)};assert.equal((await p.run()).completionEvidence,false)});
