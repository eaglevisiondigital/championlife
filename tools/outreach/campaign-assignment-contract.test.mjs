import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prepareAssignmentReview,FOUNDATION} from './campaign-assignment-contract.mjs';
let checks=0; const check=(v,m)=>{assert.ok(v,m);console.log('PASS '+(++checks)+' '+m)};
const fixture=()=>({version:'campaign-assignment-review.v1',request_id:randomUUID(),foundation_sha256:FOUNDATION.sha256,organization_id:randomUUID(),campaign_id:randomUUID(),registration_id:randomUUID(),source:'synthetic_decision_a',worker_user_id:randomUUID(),requester_user_id:randomUUID(),reviewer_user_id:randomUUID(),effective_at:'2026-11-03T00:00:00.000Z',expires_at:'2026-11-04T00:00:00.000Z',capabilities:['view','decisions.read'],expected_campaign_assignment_revision:1,expected_record_revision:0,source_mapping_snapshot_sha256:'1'.repeat(64),record_binding_snapshot_sha256:'2'.repeat(64),worker_identity_evidence_sha256:'3'.repeat(64),administrator_authority_evidence_sha256:'4'.repeat(64),audit_policy_sha256:'5'.repeat(64),reason:'initial_assigned_care'});
const p=fixture(),r=prepareAssignmentReview(p);
check(!r.executable&&r.authority==='unverified'&&!r.contactAllowed&&!r.exportAllowed&&!r.messagingAllowed,'valid declaration never proves authority or enables contact/export/message');
check(r.sourceTable==='public.outreach_registrations'&&r.careScope==='assigned','single exact decision source and assigned scope');
check(prepareAssignmentReview({...p,capabilities:['decisions.read','view']}).requestSha256===r.requestSha256,'capability order is canonical');
check(prepareAssignmentReview(Object.fromEntries(Object.entries(p).reverse())).requestSha256===r.requestSha256,'object order is canonical');
for(const key of Object.keys(p)){const v={...p};delete v[key];assert.throws(()=>prepareAssignmentReview(v));check(true,'missing '+key+' rejected')}
for(const [key,value] of [['approved',true],['canExecute',true],['email','person@example.invalid'],['sourceTable','outreach_event_registrations'],['issuerRole','administrator']]){assert.throws(()=>prepareAssignmentReview({...p,[key]:value}));check(true,'extra '+key+' rejected')}
for(const key of ['expected_campaign_assignment_revision','expected_record_revision'])for(const value of [null,-1,1.1,'1',Infinity,2147483648]){assert.throws(()=>prepareAssignmentReview({...p,[key]:value}));check(true,'invalid '+key+' '+value+' rejected')}
for(const value of [[],['view'],['view','decisions.read','registration.export'],['view','decisions.read','contact'],['view','decisions.read','decisions.read'],['view','decisions.read',true]]){assert.throws(()=>prepareAssignmentReview({...p,capabilities:value}));check(true,'malformed/escalated capabilities rejected')}
for(const value of [null,'infinity','2026-02-30T00:00:00.000Z','2026-11-03T00:00:00Z','2026-11-03T00:00:00.000Z']){assert.throws(()=>prepareAssignmentReview({...p,expires_at:value}));check(true,'nonfinite/noncanonical/nonincreasing expiry rejected')}
for(const key of ['requester_user_id','reviewer_user_id']){assert.throws(()=>prepareAssignmentReview({...p,[key]:p.worker_user_id}));check(true,'worker cannot propose themselves as independent '+key)}
assert.throws(()=>prepareAssignmentReview({...p,reviewer_user_id:p.requester_user_id}));check(true,'proposed review roles must be distinct');
assert.throws(()=>prepareAssignmentReview({...p,foundation_sha256:'0'.repeat(64)}));check(true,'wrong reviewed baseline rejected');
for(const key of ['organization_id','campaign_id','registration_id','worker_user_id','request_id']){check(prepareAssignmentReview({...p,[key]:randomUUID()}).requestSha256!==r.requestSha256,'digest binds '+key)}
for(const [key,value] of [['source','other_source'],['expires_at','2026-11-05T00:00:00.000Z'],['expected_record_revision',1],['capabilities',['view','decisions.read','followup.manage']],['source_mapping_snapshot_sha256','6'.repeat(64)],['record_binding_snapshot_sha256','7'.repeat(64)]]){check(prepareAssignmentReview({...p,[key]:value}).requestSha256!==r.requestSha256,'digest binds '+key)}
const accessors={...p};Object.defineProperty(accessors,'source',{get(){throw Error('must not run')},enumerable:true});assert.throws(()=>prepareAssignmentReview(accessors),/shape/);check(true,'accessors rejected without invocation');
check(prepareAssignmentReview({...p,reason:'revoke'}).executable===false,'revocation proposal is not a permission mutation');
check(!r.canonicalRequest.includes('email'),'review request collects no contact or personal evidence payload');
console.log(checks+' assignment review contract checks PASS');
