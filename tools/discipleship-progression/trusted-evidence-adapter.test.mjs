import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {COURSE} from './evidence-review.mjs';
import {reviewTrustedProgression} from './trusted-evidence-adapter.mjs';
const request = {course:COURSE,lesson:1};
const clone=x=>structuredClone(x);
function fixture() {
 const principal={userId:'learner-a',sessionId:'session-a',active:true,verified:true};
 const ledger={userId:principal.userId,sessionId:principal.sessionId,course:COURSE,lesson:1,revision:1,sessionActive:true,enrolled:true,mediaId:'video-1',videoRevision:'v1',videoApproved:true,policyVersion:'reviewed-1',durationMs:100000,receipts:[{id:'receipt-1',envelope:'fictional-server-observation'}],answerReceipt:{id:'answer-1',userId:'learner-a',course:COURSE,lesson:1,revision:1,durable:true,complete:true}};
 const proof={source:'independent_provider_observation',id:'receipt-1',envelopeSha256:createHash('sha256').update(ledger.receipts[0].envelope).digest('hex'),userId:'learner-a',sessionId:'session-a',course:COURSE,lesson:1,mediaId:'video-1',videoRevision:'v1',provider:'fictional-observer',policyVersion:'reviewed-1',observedAt:0,validUntil:200000,eligiblePlayback:true,startMs:0,endMs:95000,elapsedMs:95000};
 const ports={authenticate:async()=>principal,loadLedger:async()=>ledger,verifyPlayback:async()=>proof,withCurrentLedger:async(_,read)=>read(ledger)};
 return {principal,ledger,proof,ports};
}
const run = (f,requestOverride=request,options={})=>reviewTrustedProgression(requestOverride,f.ports,{now:()=>100000,...options});
test('trusted fictional source composes existing gate without committing or exposing answers',async()=>{const r=await run(fixture());assert.equal(r.completionEvidence,true);assert.equal(r.canCommit,false);assert.equal(JSON.stringify(r).includes('learner-a'),false);});
for(const [field,value] of Object.entries({source:'signed_client_telemetry',eligiblePlayback:'true',id:'other',envelopeSha256:'tampered',userId:'other',sessionId:'other',course:'other',lesson:2,mediaId:'other',videoRevision:'other',provider:null,policyVersion:'other',observedAt:100001,validUntil:100000,elapsedMs:100001})) test('rejects proof '+field,async()=>{const f=fixture();f.proof[field]=value;assert.equal((await run(f)).advanceEvidence,false);});
for(const [field,value] of Object.entries({active:false,verified:false,userId:null,sessionId:null})) test('principal '+field,async()=>{const f=fixture();f.principal[field]=value;assert.equal((await run(f)).advanceEvidence,false);});
for(const field of ['userId','sessionId']) test('request cannot select '+field,async()=>assert.equal((await run(fixture(),{...request,[field]:'learner-a'})).advanceEvidence,false));
for(const field of ['revision','sessionActive','enrolled','videoRevision','answerReceipt','receipts']) test('change during provider wait '+field,async()=>{const f=fixture();f.ports.verifyPlayback=async()=>{f.ledger[field]=null;return f.proof;};assert.equal((await run(f)).advanceEvidence,false);});
for(let lesson=5;lesson<=13;lesson++) test('truthful availability '+lesson,async()=>{const f=fixture();f.ledger.lesson=lesson;f.proof.lesson=lesson;f.ledger.answerReceipt.lesson=lesson;const r=await run(f,{...request,lesson});assert.equal(r.completionEvidence,false);assert.equal(r.advanceEvidence,lesson<=10);});
test('duplicate identical receipt counts once',async()=>{const f=fixture();f.proof.endMs=50000;f.proof.elapsedMs=50000;f.ledger.receipts.push(clone(f.ledger.receipts[0]));assert.equal((await run(f)).advanceEvidence,false);});
test('duplicate conflicting receipt fails',async()=>{const f=fixture();f.ledger.receipts.push(clone(f.ledger.receipts[0]));let n=0;f.ports.verifyPlayback=async()=>({...f.proof,endMs:++n===1?95000:96000,elapsedMs:96000});assert.equal((await run(f)).advanceEvidence,false);});
test('answer owned by another learner cannot complete',async()=>{const f=fixture();f.ledger.answerReceipt.userId='learner-b';const r=await run(f);assert.equal(r.advanceEvidence,true);assert.equal(r.completionEvidence,false);});
test('revocation must be freshly projected',async()=>{const f=fixture();f.ports.withCurrentLedger=async(_,read)=>read({...f.ledger,sessionActive:false});assert.equal((await run(f)).advanceEvidence,false);});
test('repeated serialized callback fails',async()=>{const f=fixture();f.ports.withCurrentLedger=async(_,read)=>{await read(f.ledger);await read(f.ledger);};assert.equal((await run(f)).advanceEvidence,false);});
test('callback omitted cannot forge result',async()=>{const f=fixture();f.ports.withCurrentLedger=async()=>({advanceEvidence:true});assert.equal((await run(f)).advanceEvidence,false);});
test('cancelled provider request fails closed',async()=>{const f=fixture(),c=new AbortController();f.ports.verifyPlayback=async()=>{c.abort();return f.proof;};assert.equal((await run(f,request,{signal:c.signal})).advanceEvidence,false);});
test('provider errors reveal no private details',async()=>{const f=fixture();f.ports.verifyPlayback=async()=>{throw Error('secret learner payload');};assert.equal(JSON.stringify(await run(f)).includes('secret'),false);});
test('proof expires before lock callback',async()=>{const f=fixture();let now=100000;f.ports.withCurrentLedger=async(_,read)=>{now=200000;return read(f.ledger);};assert.equal((await run(f,request,{now:()=>now})).advanceEvidence,false);});

for(const field of ['userId','sessionId','course','lesson']) test('wrong durable ledger '+field,async()=>{const f=fixture();f.ledger[field]='other';assert.equal((await run(f)).advanceEvidence,false);});
test('request mutated during auth cannot redirect lesson',async()=>{const f=fixture(),r={...request};f.ports.authenticate=async()=>{r.lesson=2;return f.principal;};assert.equal((await run(f,r)).completionEvidence,true);});

// Actual owned_worksheet_transaction response shape; ownership is supplied only
// by the server ledger under its existing serialization contract.
const tokenA='00000000-0000-4000-8000-000000000001';
const tokenB='00000000-0000-4000-8000-000000000002';
function worksheetFixture() {
 const f=fixture();
 f.ledger.enrollmentId='enrollment-a';f.ledger.worksheetRevision=tokenA;
 f.ledger.answerReceipt={source:'owned_worksheet_transaction_v1',userId:'learner-a',sessionId:'session-a',enrollmentId:'enrollment-a',receipt:{status:'available',course:COURSE,lesson:1,revision:tokenA,requiredQuestions:20,savedNonblankAnswers:20,allRequiredAnswersSaved:true,canComplete:false,canCommit:false}};
 return f;
}
test('opaque worksheet receipt composes without converting token or allowing writes',async()=>{const r=await run(worksheetFixture());assert.equal(r.completionEvidence,true);assert.equal(r.canCommit,false);assert.equal(JSON.stringify(r).includes(tokenA),false);});
for(const [field,value] of Object.entries({userId:'learner-b',sessionId:'session-b',enrollmentId:'enrollment-b',source:'browser_receipt'})) test('opaque ownership rejects '+field,async()=>{const f=worksheetFixture();f.ledger.answerReceipt[field]=value;assert.equal((await run(f)).completionEvidence,false);});
for(const [field,value] of Object.entries({status:'failed',course:'other',lesson:2,revision:tokenB,requiredQuestions:19,savedNonblankAnswers:19,allRequiredAnswersSaved:'true',canComplete:true,canCommit:true})) test('opaque receipt rejects '+field,async()=>{const f=worksheetFixture();f.ledger.answerReceipt.receipt[field]=value;assert.equal((await run(f)).completionEvidence,false);});
for(const value of [null,undefined,1,'1','',{},'00000000-0000-1000-8000-000000000001','00000000-0000-4000-7000-000000000001']) test('invalid opaque token '+JSON.stringify(value),async()=>{const f=worksheetFixture();f.ledger.worksheetRevision=value;f.ledger.answerReceipt.receipt.revision=value;assert.equal((await run(f)).completionEvidence,false);});
for(const field of ['source','userId','sessionId','enrollmentId','receipt']) test('missing opaque binding '+field,async()=>{const f=worksheetFixture();delete f.ledger.answerReceipt[field];assert.equal((await run(f)).completionEvidence,false);});
for(const field of ['status','course','lesson','revision','requiredQuestions','savedNonblankAnswers','allRequiredAnswersSaved','canComplete','canCommit']) test('missing opaque receipt '+field,async()=>{const f=worksheetFixture();delete f.ledger.answerReceipt.receipt[field];assert.equal((await run(f)).completionEvidence,false);});
test('browser RPC summary alone is not owned answer evidence',async()=>{const f=worksheetFixture();f.ledger.answerReceipt=f.ledger.answerReceipt.receipt;assert.equal((await run(f)).completionEvidence,false);});
test('failed opaque receipt cannot downgrade through legacy fields',async()=>{const f=worksheetFixture();Object.assign(f.ledger.answerReceipt,fixture().ledger.answerReceipt);f.ledger.answerReceipt.receipt.revision=tokenB;assert.equal((await run(f)).completionEvidence,false);});
for(const field of ['worksheetRevision','enrollmentId','answerReceipt']) test('opaque state changed during observer wait '+field,async()=>{const f=worksheetFixture();f.ports.verifyPlayback=async()=>{f.ledger[field]=null;return f.proof;};assert.equal((await run(f)).completionEvidence,false);});
test('changed receipt under ledger callback cannot complete',async()=>{const f=worksheetFixture();let n=0;f.ports.verifyPlayback=async()=>{if(++n===2)f.ledger.answerReceipt.receipt.revision=tokenB;return f.proof;};assert.equal((await run(f)).completionEvidence,false);});
test('new enrollment with old receipt cannot complete',async()=>{const f=worksheetFixture();f.ledger.enrollmentId='replacement-enrollment';assert.equal((await run(f)).completionEvidence,false);});
for(let lesson=5;lesson<=10;lesson++) test('opaque receipt cannot invent worksheet '+lesson,async()=>{const f=worksheetFixture();f.ledger.lesson=lesson;f.proof.lesson=lesson;f.ledger.answerReceipt.receipt.lesson=lesson;assert.equal((await run(f,{...request,lesson})).completionEvidence,false);});
