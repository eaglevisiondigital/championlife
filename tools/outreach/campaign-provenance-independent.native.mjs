// Independently authored repros, promoted unchanged in scope from private review.
// Every identity, signature and database is fictional/disposable; never a producer.
import assert from 'node:assert/strict';
import {createCampaignTaskFixture} from './campaign-task-fixture.mjs';
import {createFixtureProvenanceEvaluator,provenanceDigest} from './campaign-provenance-contract.mjs';
import {readFixtureCanonicalFacts,makeProvenanceFixture} from './campaign-provenance-fixture.mjs';
let checks=0;
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++};
const noAuthority=result=>{for(const key of ['canLink','canWrite','canContact','realEvidenceVerified'])eq(result[key],false,`${key} remains false`)};
const f=await createCampaignTaskFixture();
try{
 const before=await f.counts();
 const fixture=makeProvenanceFixture(f,await readFixtureCanonicalFacts(f));
 const baseline=fixture.evaluator()(fixture.input,fixture.now);
 eq(baseline.status,'fixture-contract-pass','original full signed chain and external fixture anchor are valid');noAuthority(baseline);
 // Make the reviewer designation start AFTER approval, then re-sign all dependent
 // receipts, approval and external anchor. Digest mismatch cannot mask this test.
 const input=structuredClone(fixture.input), designation=JSON.parse(input.designation.bytes);
 designation.valid_from=new Date(fixture.now-5000).toISOString();
 input.designation=fixture.signAuthority(designation);
 for(const receipt of input.receipts)receipt.signed=fixture.signSource({...JSON.parse(receipt.signed.bytes),designation_sha256:provenanceDigest(input.designation.bytes)});
 const event=JSON.parse(input.history[0].bytes);
 event.receipt_sha256=input.receipts.map(receipt=>provenanceDigest(receipt.signed.bytes));
 input.history[0]=fixture.signReviewer(event);
 const inspect=createFixtureProvenanceEvaluator({...fixture.trust,trustedFixtureHeadBytes:fixture.anchor(input)});
 const early=inspect(input,fixture.now);
 eq(early.status,'denied','a currently designated reviewer was not authorized at the earlier approval');noAuthority(early);
 // Positive control: changing ONLY the approval time to be within designation and
 // refreshing its authentic external anchor restores a valid fictional chain.
 const valid=structuredClone(input);
 valid.history[0]=fixture.signReviewer({...event,recorded_at:new Date(fixture.now-4000).toISOString()});
 const validInspector=createFixtureProvenanceEvaluator({...fixture.trust,trustedFixtureHeadBytes:fixture.anchor(valid)});
 const correctedTiming=validInspector(valid,fixture.now);
 eq(correctedTiming.status,'fixture-contract-pass','same signed evidence passes with valid event-time reviewer authority');noAuthority(correctedTiming);
 const malformed=inspect(null,fixture.now);
 eq(malformed.status,'denied','null top-level envelope returns a safe denial without throwing');noAuthority(malformed);
 eq(await f.counts(),before,'inspection creates no task or audit');
 console.log(JSON.stringify({status:'PASS',checks,kind:'independent corrected provenance cases',operationalProducer:false,realEvidenceVerified:false,hostedAcceptance:false}));
}finally{await f.close()}
