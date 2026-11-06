// Fictional contract regression only: native metadata, ephemeral signing roots,
// external immutable head capture. No accepted real method, custodian or producer.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createCampaignTaskFixture} from './campaign-task-fixture.mjs';
import {createFixtureProvenanceEvaluator,provenanceDigest} from './campaign-provenance-contract.mjs';
import {readFixtureCanonicalFacts,makeProvenanceFixture} from './campaign-provenance-fixture.mjs';
let checks=0;
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++};
const outcome=(value,status,label)=>{
  eq(value.status,status,label);
  for(const key of ['canLink','canWrite','canContact','realEvidenceVerified'])eq(value[key],false,`${label}: ${key}`);
  eq(Object.isFrozen(value),true,`${label}: frozen`);
};
const f=await createCampaignTaskFixture();
try {
  const before=await f.counts(),canonical=await readFixtureCanonicalFacts(f);
  const fixture=makeProvenanceFixture(f,canonical),{input,now}=fixture;
  const iso=offset=>new Date(now+offset).toISOString();
  // Re-seal every dependency after signed-field changes. A digest mismatch must
  // not be the reason a negative authority/method/retention case is denied.
  const reseal=x=>{
    for(const r of x.receipts)r.signed=fixture.signSource({...JSON.parse(r.signed.bytes),
      policy_sha256:provenanceDigest(x.policy.bytes),designation_sha256:provenanceDigest(x.designation.bytes)});
    let previous=null;
    const p=JSON.parse(x.policy.bytes);
    for(let i=0;i<x.history.length;i++){
      x.history[i]=fixture.signReviewer({...JSON.parse(x.history[i].bytes),previous_sha256:previous,
        receipt_sha256:x.receipts.map(r=>provenanceDigest(r.signed.bytes)),valid_until:p.valid_until,
        evidence_retain_until:p.evidence_retain_until,audit_retain_until:p.audit_retain_until});
      previous=provenanceDigest(x.history[i].bytes);
    }
    return x;
  };
  const inspect=(x,anchor=fixture.anchor(x),at=now)=>createFixtureProvenanceEvaluator({...fixture.trust,trustedFixtureHeadBytes:anchor})(x,at);
  const change=(mutate,label)=>{
    const x=structuredClone(input);mutate(x);reseal(x);outcome(inspect(x),'denied',label);
  };
  outcome(inspect(input),'fixture-contract-pass','complete current fixture');
  eq(/email|@|phone|prayer|verification_note|first_name|last_name/.test(canonical),false,'snapshot excludes private source fields');
  const designation=JSON.parse(input.designation.bytes);
  eq(JSON.parse(canonical).authorizer[0].id,designation.authorizer_id,'designation binds the current canonical authorizer');
  change(x=>{x.designation=fixture.signAuthority({...designation,authorizer_id:randomUUID()})},'absent authorizer cannot designate');
  for(const role of ['requested_by','reviewed_by','account_id']){
    const facts=JSON.parse(canonical),id=JSON.parse(input.caseBytes)[role];
    facts.authorizer[0].id=id;
    const overlap=makeProvenanceFixture(f,JSON.stringify(facts),now),x=structuredClone(overlap.input);
    x.designation=overlap.signAuthority({...JSON.parse(x.designation.bytes),authorizer_id:id});
    for(const r of x.receipts)r.signed=overlap.signSource({...JSON.parse(r.signed.bytes),designation_sha256:provenanceDigest(x.designation.bytes)});
    x.history[0]=overlap.signReviewer({...JSON.parse(x.history[0].bytes),receipt_sha256:x.receipts.map(r=>provenanceDigest(r.signed.bytes))});
    outcome(createFixtureProvenanceEvaluator({...overlap.trust,trustedFixtureHeadBytes:overlap.anchor(x)})(x,now),'denied',`authorizer cannot be ${role}, despite valid account`);
  }
  for(const field of ['valid_from','valid_until'])change(x=>{
    x.designation=fixture.signAuthority({...designation,[field]:iso(field==='valid_from'?1:0)});
  },`current designation ${field} boundary`);
  for(const kind of ['source','identity','adult','consent']) {
    change(x=>{const p=JSON.parse(x.policy.bytes);delete p.accepted_methods[kind];x.policy=fixture.signAuthority(p)},`missing accepted ${kind} method`);
    change(x=>{const p=JSON.parse(x.policy.bytes);p.accepted_methods[kind].method='email-matched';x.policy=fixture.signAuthority(p);
      const r=x.receipts.find(r=>JSON.parse(r.signed.bytes).kind===kind);r.signed=fixture.signSource({...JSON.parse(r.signed.bytes),method:'email-matched'});
    },`signed contact matching cannot become accepted ${kind} method`);
    change(x=>{const r=x.receipts.find(r=>JSON.parse(r.signed.bytes).kind===kind);r.signed=fixture.signSource({...JSON.parse(r.signed.bytes),method:'fictional-other-witness-v1'})},`${kind} receipt method differs from policy`);
    for(const [field,value] of [['valid_from',iso(-15000)],['valid_until',iso(0)],['valid_until','infinity']])change(x=>{
      const p=JSON.parse(x.policy.bytes);p.accepted_methods[kind][field]=value;x.policy=fixture.signAuthority(p);
    },`${kind} method not accepted at observation, expired or unbounded: ${field}=${value}`);
  }
  // Finite shorter method acceptance remains valid if the receipt fits the exact
  // window. Policy receipt validity cannot silently exceed method acceptance.
  const shorter=structuredClone(input),p=JSON.parse(shorter.policy.bytes);
  p.accepted_methods.identity.valid_until=iso(60000);shorter.policy=fixture.signAuthority(p);
  reseal(shorter);outcome(inspect(shorter),'denied','receipt outlives method acceptance');
  const identity=shorter.receipts.find(r=>JSON.parse(r.signed.bytes).kind==='identity');
  identity.signed=fixture.signSource({...JSON.parse(identity.signed.bytes),valid_until:iso(60000)});
  reseal(shorter);outcome(inspect(shorter),'fixture-contract-pass','shorter exact method window positive control');
  outcome(inspect(shorter,fixture.anchor(shorter),now+60000),'denied','method expiry is exclusive');
  for(const [field,value] of [['evidence_retain_until',iso(200000)],['audit_retain_until',iso(500000)],['audit_retain_until','infinity']])change(x=>{
    const p=JSON.parse(x.policy.bytes);p[field]=value;x.policy=fixture.signAuthority(p);
  },`invalid finite retention ordering: ${field}`);
  const baseAnchor=JSON.parse(fixture.anchor(input));
  for(const [field,value] of [['captured_at',iso(1)],['captured_at',iso(-10001)],['current_until',iso(0)],
    ['current_until',iso(300001)],['current_until','infinity'],['policy_sha256','0'.repeat(64)],['designation_sha256','0'.repeat(64)],
    ['head_sha256','0'.repeat(64)],['event_count',2]])outcome(inspect(input,JSON.stringify({...baseAnchor,[field]:value})),'denied',`independent capture rejects ${field}`);
  outcome(inspect(input,JSON.stringify({...baseAnchor,captured_at:iso(-10000)})),'fixture-contract-pass','head may be captured at latest event, no invented freshness interval');
  const captured=fixture.evaluator(),withdrawn=structuredClone(input);
  withdrawn.history.push(fixture.withdrawal());
  outcome(captured(withdrawn,now),'denied','later proposal cannot mutate previously captured head');
  const withdrawalHead=fixture.anchor(withdrawn),afterWithdrawal=createFixtureProvenanceEvaluator({...fixture.trust,trustedFixtureHeadBytes:withdrawalHead});
  outcome(afterWithdrawal(withdrawn,now),'withdrawn','current withdrawal retains original approval');
  outcome(afterWithdrawal(input,now),'denied','truncated pre-withdrawal history rejected');
  outcome(inspect(withdrawn,JSON.stringify({...JSON.parse(withdrawalHead),captured_at:iso(-5001)})),'denied','capture must include withdrawal event time');
  const reactivated=structuredClone(withdrawn);reactivated.history.push(input.history[0]);
  outcome(inspect(reactivated),'denied','withdrawn case cannot reactivate by appending approval');
  // Re-read actual native metadata after authorizer retirement. Re-signing every
  // fictional document cannot turn a banned/unconfirmed/anonymous/deleted account
  // into current authority; restore only the disposable account after each case.
  for(const [column,value] of [['banned_until',new Date(now+3600000)],['email_confirmed_at',null],['is_anonymous',true],['deleted_at',new Date(now)]]) {
    await f.q(`update auth.users set ${column}=$1 where id=$2`,[value,f.users.other.id]);
    const stale=makeProvenanceFixture(f,await readFixtureCanonicalFacts(f));
    outcome(stale.evaluator()(stale.input,stale.now),'denied',`native retired authorizer ${column}`);
    await f.q('update auth.users set banned_until=null,email_confirmed_at=clock_timestamp(),is_anonymous=false,deleted_at=null where id=$1',[f.users.other.id]);
  }
  const current=makeProvenanceFixture(f,await readFixtureCanonicalFacts(f));
  outcome(current.evaluator()(current.input,current.now),'fixture-contract-pass','restored synthetic authorizer positive control');
  eq(await f.counts(),before,'evaluation changes no canonical task or task audit');
  console.log(JSON.stringify({status:'PASS',checks,kind:'fictional authorizer method and custody contract',operationalProducer:false,realEvidenceVerified:false,hostedAcceptance:false}));
} finally {await f.close()}
