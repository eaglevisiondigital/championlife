import assert from 'node:assert/strict';
import {createCampaignTaskFixture} from './campaign-task-fixture.mjs';
import {createFixtureProvenanceEvaluator,provenanceDigest} from './campaign-provenance-contract.mjs';
import {readFixtureCanonicalFacts,makeProvenanceFixture} from './campaign-provenance-fixture.mjs';
let checks = 0;
const eq = (a,b,message) => { assert.deepEqual(a,b,message); checks++; };
const f = await createCampaignTaskFixture();
try {
  const before = await f.counts(), canonicalBytes = await readFixtureCanonicalFacts(f);
  const fixture = makeProvenanceFixture(f,canonicalBytes), inspect = fixture.evaluator();
  const {input,now} = fixture;
  const accepted = inspect(input,now);
  eq(accepted.status,'fixture-contract-pass','real canonical rows support a strictly fictional proof exercise');
  for (const k of ['canLink','canWrite','canContact','realEvidenceVerified']) eq(accepted[k],false);
  eq(Object.isFrozen(accepted),true);
  for (const malformed of [null,undefined,1,'',[],{},Object.defineProperty({},'caseBytes',{get(){throw Error('hostile');},enumerable:true})]) eq(inspect(malformed,now).status,'denied','malformed top-level input denied without throwing');
  eq(/PRIVATE|@|first_name|last_name|phone|prayer|verification_note/.test(canonicalBytes),false,'snapshot excludes sensitive source payloads');
  const denied = (change,message) => { const copy=structuredClone(input); change(copy); eq(inspect(copy,now).status,'denied',message); };
  for (const field of ['organization_id','campaign_id','registration_id','person_id','account_id','requested_by','reviewed_by','task_id','binding_id','portal_link_id','campaign_registrant_id','policy_id','case_id']) {
    denied(x=>{const c=JSON.parse(x.caseBytes);c[field]='00000000-0000-0000-0000-000000000001';x.caseBytes=JSON.stringify(c)},`wrong ${field}`);
  }
  for (const field of ['version','task_revision','binding_revision','portal_link_revision','campaign_registrant_revision','followup_revision']) {
    denied(x=>{const c=JSON.parse(x.caseBytes);c[field]++;x.caseBytes=JSON.stringify(c)},`stale ${field}`);
  }
  for (const field of ['source','method','mode','purpose','canonical_sha256']) denied(x=>{const c=JSON.parse(x.caseBytes);c[field]='unapproved';x.caseBytes=JSON.stringify(c)},`changed ${field}`);
  denied(x=>{x.caseBytes=x.caseBytes.replace('"version":1','"version":2,"version":1')},'duplicate JSON keys');
  denied(x=>{x.caseBytes=JSON.parse(x.caseBytes)},'caller object/getters never consumed');
  denied(x=>{x.receipts=[]},'hash-only evidence rejected');
  denied(x=>{x.receipts[0].verified=true},'caller verified boolean rejected');
  denied(x=>{x.receipts[0].original+=' '},'changed original bytes');
  denied(x=>{x.receipts[1]=x.receipts[0]},'duplicate kind/conflicting missing identity');
  denied(x=>{x.receipts[0].signed.signature='A'.repeat(86)+'=='},'signature forgery');
  for (const kind of ['adult','identity','consent','source']) denied(x=>{const r=x.receipts.find(r=>JSON.parse(r.signed.bytes).kind===kind);r.original=JSON.stringify({verified:true,sha256:provenanceDigest(r.original)});r.signed=fixture.signSource({...JSON.parse(r.signed.bytes),original_sha256:provenanceDigest(r.original)})},`signed hash/boolean cannot substitute ${kind} witness`);
  for (const classification of ['minor','unknown','guardian-asserted','email-matched','adult-self-declared']) denied(x=>{const r=x.receipts[2];const o=JSON.parse(r.original);o.assertion=classification;r.original=JSON.stringify(o);r.signed=fixture.signSource({...JSON.parse(r.signed.bytes),original_sha256:provenanceDigest(r.original)})},classification);
  denied(x=>{const p=JSON.parse(x.policy.bytes);p.evidence_retain_until='infinity';x.policy=fixture.signAuthority(p)},'unbounded retention');
  denied(x=>{const d=JSON.parse(x.designation.bytes);d.authorizer_id=f.users.worker.id;x.designation=fixture.signAuthority(d)},'requester cannot designate reviewer');
  denied(x=>{const d=JSON.parse(x.designation.bytes);d.valid_until=new Date(now).toISOString();x.designation=fixture.signAuthority(d)},'expired reviewer authority');
  // Independently reproduced: current designation is insufficient when the reviewer
  // had no designation at approval. Re-sign every dependent record and anchor so a
  // digest mismatch does not mask this historical-authority check.
  const lateDesignation=structuredClone(input);
  lateDesignation.designation=fixture.signAuthority({...JSON.parse(input.designation.bytes),valid_from:new Date(now-5000).toISOString()});
  for (const r of lateDesignation.receipts) r.signed=fixture.signSource({...JSON.parse(r.signed.bytes),designation_sha256:provenanceDigest(lateDesignation.designation.bytes)});
  lateDesignation.history[0]=fixture.signReviewer({...JSON.parse(lateDesignation.history[0].bytes),receipt_sha256:lateDesignation.receipts.map(r=>provenanceDigest(r.signed.bytes))});
  const lateInspector=createFixtureProvenanceEvaluator({...fixture.trust,trustedFixtureHeadBytes:fixture.anchor(lateDesignation)});
  eq(lateInspector(lateDesignation,now).status,'denied','reviewer must be designated at actual approval, not just now');
  denied(x=>{x.history=[]},'missing approval');
  denied(x=>{x.history.push(x.history[0])},'replayed approval');
  denied(x=>{const e=JSON.parse(x.history[0].bytes);e.case_sha256='0'.repeat(64);x.history[0]=fixture.signReviewer(e)},'signed cross-case approval');
  denied(x=>{const e=JSON.parse(x.history[0].bytes);e.recorded_at=new Date(now-25000).toISOString();x.history[0]=fixture.signReviewer(e)},'approval before evidence');
  eq(createFixtureProvenanceEvaluator(fixture.trust)(input,now).status,'denied','no externally supplied fixture head');
  eq(inspect(input,now+300000).status,'denied','finite policy expiry');
  const withdrawn=structuredClone(input);withdrawn.history.push(fixture.withdrawal());
  const afterWithdrawal=createFixtureProvenanceEvaluator({...fixture.trust,trustedFixtureHeadBytes:fixture.anchor(withdrawn)});
  eq(afterWithdrawal(withdrawn,now).status,'withdrawn');
  eq(afterWithdrawal(input,now).status,'denied','truncated journal before withdrawal fails current head');
  eq(inspect(withdrawn,now).status,'denied','unanchored appended journal');
  for (const name of ['campaign','source','registration','person','portal_link','registrant','followup','task','binding','account','reviewer','authorizer']) {
    denied(x=>{const rows=JSON.parse(x.canonicalBytes);rows[name].push(rows[name][0]);x.canonicalBytes=JSON.stringify(rows)},`duplicate ${name}`);
    const facts=JSON.parse(canonicalBytes);facts[name].push(facts[name][0]);
    const duplicate=makeProvenanceFixture(f,JSON.stringify(facts),now);
    eq(duplicate.evaluator()(duplicate.input,now).status,'denied',`fresh signature cannot accept duplicate ${name}`);
  }
  for (const [table,field,value] of [['source','active',false],['registration','user_id',f.users.other.id],
    ['registration','consent',false],['portal_link','active',false],['registrant','person_id',f.users.other.id],
    ['binding','eligibility','minor'],['binding','eligibility','unknown'],['binding','revoked_at',new Date(now).toISOString()],
    ['account','active',false],['reviewer','verified',false],['authorizer','active',false],['authorizer','verified',false]]) {
    const facts=JSON.parse(canonicalBytes);facts[table][0][field]=value;
    const inconsistent=makeProvenanceFixture(f,JSON.stringify(facts),now);
    eq(inconsistent.evaluator()(inconsistent.input,now).status,'denied',`freshly signed fixture cannot accept ${table}.${field}`);
  }
  // Canonical changes are actually committed in the disposable database, then
  // freshly read. Even freshly signed fixture material cannot upgrade withdrawn consent.
  await f.withdraw();
  const current=await readFixtureCanonicalFacts(f), changed=makeProvenanceFixture(f,current);
  eq(changed.evaluator()(changed.input,changed.now).status,'denied','current native consent withdrawal');
  eq(inspect({...input,canonicalBytes:current},now).status,'denied','old source receipt after canonical change');
  eq(await f.counts(),before,'contract inspection creates no canonical task/audit writes');
  console.log(JSON.stringify({status:'PASS',checks,operationalProducer:false,realEvidenceVerified:false}));
} finally { await f.close(); }
