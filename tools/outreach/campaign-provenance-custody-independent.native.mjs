// Independent adversarial inspection; fictional keys and disposable native rows.
// No genuine source, authority, immutable store or provider acceptance is asserted.
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const mod=name=>import(pathToFileURL(resolve(root,'tools/outreach',name)).href);
const {createCampaignTaskFixture}=await mod('campaign-task-fixture.mjs');
const {createFixtureProvenanceEvaluator,provenanceDigest}=await mod('campaign-provenance-contract.mjs');
const {readFixtureCanonicalFacts,makeProvenanceFixture}=await mod('campaign-provenance-fixture.mjs');
const sourceHash=createHash('sha256').update(readFileSync(resolve(root,'tools/outreach/campaign-provenance-contract.mjs'))).digest('hex');
let checks=0;const cases=[];
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++};
const inspectResult=(result,status,label)=>{
 eq(result.status,status,label);for(const flag of ['canLink','canWrite','canContact','realEvidenceVerified'])eq(result[flag],false,label+' '+flag);
 eq(Object.keys(result).sort(),['status','reason','canLink','canWrite','canContact','realEvidenceVerified'].sort(),label+' exact private output');
 eq(Object.isFrozen(result),true,label+' frozen output');cases.push(label);
};
const f=await createCampaignTaskFixture();
try {
 const before=(await f.q('select (select jsonb_agg(to_jsonb(t) order by id) from followup_tasks t) tasks,(select jsonb_agg(to_jsonb(e) order by id) from followup_task_events e) events')).rows[0];
 const canonical=await readFixtureCanonicalFacts(f),v=makeProvenanceFixture(f,canonical),{input,now}=v;
 const iso=delta=>new Date(now+delta).toISOString();
 // Rebuild all signed dependencies so target-condition denial is not masked by
 // an unrelated old hash/signature. Trust anchor is supplied independently.
 function reseal(x){
  for(const receipt of x.receipts)receipt.signed=v.signSource({...JSON.parse(receipt.signed.bytes),policy_sha256:provenanceDigest(x.policy.bytes),designation_sha256:provenanceDigest(x.designation.bytes)});
  let previous=null;
  for(let n=0;n<x.history.length;n++){
   x.history[n]=v.signReviewer({...JSON.parse(x.history[n].bytes),receipt_sha256:x.receipts.map(r=>provenanceDigest(r.signed.bytes)),previous_sha256:previous});
   previous=provenanceDigest(x.history[n].bytes);
  }return x;
 }
 const run=(x=input,anchor=v.anchor(x),at=now)=>createFixtureProvenanceEvaluator({...v.trust,trustedFixtureHeadBytes:anchor})(x,at);
 inspectResult(run(),'fixture-contract-pass','valid source control');
 eq(/PRIVATE-PRAYER|private@example.invalid|15555550123|first_name|last_name|email|phone|prayer/.test(canonical),false,'canonical source excludes personal payloads');
 const anchor=JSON.parse(v.anchor(input));
 for(const [name,delta,status] of [['capture at approval',-10000,'fixture-contract-pass'],['capture before approval',-10001,'denied'],['capture after current time',1,'denied']])inspectResult(run(input,JSON.stringify({...anchor,captured_at:iso(delta)})),status,name);
 inspectResult(run(input,JSON.stringify({...anchor,current_until:iso(1)}),now+1),'denied','anchor ends exclusively even when policy remains active');
 inspectResult(run(input,JSON.stringify({...anchor,current_until:iso(1)}),now),'fixture-contract-pass','short independent anchor positive control');
 for(const key of ['policy_sha256','designation_sha256'])inspectResult(run(input,JSON.stringify({...anchor,[key]:'0'.repeat(64)})),'denied','current anchor binds '+key);
 const withdrawn=structuredClone(input);withdrawn.history.push(v.withdrawal());
 const withdrawnAnchor=v.anchor(withdrawn);
 inspectResult(run(withdrawn,withdrawnAnchor),'withdrawn','complete current withdrawal');
 inspectResult(run(input,withdrawnAnchor),'denied','authentic current head rejects earlier signed prefix');
 inspectResult(run(withdrawn,v.anchor(input)),'denied','new caller history cannot update captured head');
 inspectResult(run(withdrawn,JSON.stringify({...JSON.parse(withdrawnAnchor),captured_at:iso(-5001)})),'denied','custody capture must include withdrawal instant');
 for(const kind of ['source','identity','adult','consent']){
  const x=structuredClone(input),p=JSON.parse(x.policy.bytes);
  p.accepted_methods[kind].valid_from=iso(-19999);x.policy=v.signAuthority(p);reseal(x);
  inspectResult(run(x),'denied',kind+' proof before accepted method');
  const r=x.receipts.find(r=>JSON.parse(r.signed.bytes).kind===kind);
  r.signed=v.signSource({...JSON.parse(r.signed.bytes),observed_at:iso(-19999)});reseal(x);
  inspectResult(run(x),'fixture-contract-pass',kind+' proof at accepted method start control');
 }
 const early=structuredClone(input),d=JSON.parse(early.designation.bytes);
 d.valid_from=iso(-9999);early.designation=v.signAuthority(d);reseal(early);
 inspectResult(run(early),'denied','current designation cannot ratify an earlier approval');
 early.history[0]=v.signReviewer({...JSON.parse(early.history[0].bytes),recorded_at:iso(-9999)});
 inspectResult(run(early),'fixture-contract-pass','designation exact approval boundary control');
 for(const [label,mutate] of [
  ['source key cannot authorize policy',x=>x.policy=v.signSource(JSON.parse(x.policy.bytes))],
  ['reviewer key cannot authorize designation',x=>x.designation=v.signReviewer(JSON.parse(x.designation.bytes))],
  ['authority key cannot witness source',x=>x.receipts[0].signed=v.signAuthority(JSON.parse(x.receipts[0].signed.bytes))],
  ['source key cannot approve review',x=>x.history[0]=v.signSource(JSON.parse(x.history[0].bytes))]
 ]){const x=structuredClone(input);mutate(x);inspectResult(run(x),'denied',label)}
 assert.throws(()=>createFixtureProvenanceEvaluator({...v.trust,reviewerKey:v.trust.sourceKey,trustedFixtureHeadBytes:v.anchor(input)}));checks++;
 // Actual auth metadata changes, then new canonical bytes and every fictional
 // signature, prove current status matters independently of digest freshness.
 await f.q('update auth.users set banned_until=clock_timestamp()+interval \'1 hour\' where id=$1',[f.users.other.id]);
 const banned=makeProvenanceFixture(f,await readFixtureCanonicalFacts(f));
 inspectResult(banned.evaluator()(banned.input,banned.now),'denied','native current authorizer banned');
 await f.q('update auth.users set banned_until=null,email_confirmed_at=null where id=$1',[f.users.other.id]);
 const unverified=makeProvenanceFixture(f,await readFixtureCanonicalFacts(f));
 inspectResult(unverified.evaluator()(unverified.input,unverified.now),'denied','native current authorizer unverified');
 await f.q('update auth.users set email_confirmed_at=clock_timestamp() where id=$1',[f.users.other.id]);
 const restored=makeProvenanceFixture(f,await readFixtureCanonicalFacts(f));
 inspectResult(restored.evaluator()(restored.input,restored.now),'fixture-contract-pass','restored fictional account control');
 const after=(await f.q('select (select jsonb_agg(to_jsonb(t) order by id) from followup_tasks t) tasks,(select jsonb_agg(to_jsonb(e) order by id) from followup_task_events e) events')).rows[0];
 eq(after,before,'all canonical task and audit row bytes unchanged');
 eq(createHash('sha256').update(readFileSync(resolve(root,'tools/outreach/campaign-provenance-contract.mjs'))).digest('hex'),sourceHash,'reviewed module stable during tests');
 console.log(JSON.stringify({status:'PASS',checks,cases,sourceHash,operationalProducer:false,realEvidenceVerified:false,hostedAcceptance:false}));
}finally{await f.close()}
