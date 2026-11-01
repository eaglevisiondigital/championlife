import test from 'node:test';
import assert from 'node:assert/strict';
import {createSerializedPartnerReader} from './serialized-repository-reader.mjs';
import {READ_CAPABILITY} from './relationship-reader.mjs';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tick = Date.parse('2026-11-01T12:00:00.000Z');
const life = () => ({active:true, revoked:false, effectiveAt:'2026-11-01T11:00:00.000Z', expiresAt:'2026-11-01T13:00:00.000Z'});
function fixture() {
 const request = {organizationId:id(1), campaignId:id(2), intakeId:id(3)};
 let p = {userId:id(4), sessionId:id(5), epoch:1, verified:true, ...life()};
 const e = {...request,...life(), id:id(6),revision:1,current:true,conflicted:false,status:'verified',identityEvidenceId:id(7),reviewAuditId:id(8),verifiedBy:id(9),verifiedAt:'2026-11-01T11:30:00.000Z',method:'reviewed-canonical-binding',personId:id(10),humanId:id(11),relationshipId:id(12),householdId:null};
 const s = {authorityRevision:1, session:p, assignment:{...request,...life(),id:id(13),revision:1,userId:p.userId,sessionId:p.sessionId,sessionEpoch:p.epoch,capability:READ_CAPABILITY,associationId:e.id,associationRevision:1,personId:e.personId,relationshipId:e.relationshipId,householdId:null},association:e,campaign:{...life(),id:request.campaignId,organizationId:request.organizationId},person:{id:e.personId,humanId:e.humanId,organizationId:request.organizationId,active:true},relationship:{...life(),id:e.relationshipId,personId:e.personId,organizationId:request.organizationId},intake:{id:request.intakeId,organizationId:request.organizationId,personId:e.personId,status:'linked',revision:1,submittedAt:'2026-11-01T11:15:00.000Z',sourceSite:'sowgo'},household:null,membership:null};
 let run = async (q, cb) => cb(s), clock=tick;
 const reader=createSerializedPartnerReader({getPrincipal:()=>p,repository:{withCurrentSnapshot:(...args)=>run(...args)},now:()=>clock});
 return {reader,request,s,setPrincipal:x=>p=x,p,setRun:x=>run=x,setClock:x=>clock=x};
}
test('exact canonical projection has no confidential or global identity data', async()=>{
 const f=fixture(); f.s.person.email='private';f.s.intake.raw_submission={secret:true};f.s.intake.commitment_amount=100;
 const result=await f.reader.read(f.request); assert.equal(result.status,'ready');assert.deepEqual(Object.keys(result.record).sort(),['organizationId','campaignId','intakeId','personId','relationshipId','householdId','status','revision','submittedAt','sourceSite'].sort());
});
const failures={
 anonymous:f=>f.setPrincipal(null), unverified:f=>f.p.verified=false,
 sessionRevoked:f=>f.s.session.revoked=true, sessionEpoch:f=>f.s.session={...f.p,epoch:2},
 wrongCampaign:f=>f.s.campaign.organizationId=id(99), expiredCampaign:f=>f.s.campaign.expiresAt='2026-11-01T12:00:00.000Z',
 unassigned:f=>f.s.assignment.userId=id(99), wrongSession:f=>f.s.assignment.sessionId=id(99), revokedAssignment:f=>f.s.assignment.revoked=true,
 expiredAssignment:f=>f.s.assignment.expiresAt='2026-11-01T12:00:00.000Z', financeInstead:f=>f.s.assignment.capability='finance.read',
 associationMissing:f=>f.s.association=null, associationReplaced:f=>f.s.association.id=id(99), revisionStale:f=>f.s.association.revision=2,
 identityUnverified:f=>f.s.association.status='unverified', associationConflict:f=>f.s.association.conflicted=true,
 associationRevoked:f=>f.s.association.revoked=true, associationSuperseded:f=>f.s.association.current=false,
 emailMatching:f=>f.s.association.method='matched-email', tagMatching:f=>f.s.association.method='partner-tag',
 missingReviewAudit:f=>f.s.association.reviewAuditId=null, missingVerifier:f=>f.s.association.verifiedBy=null,
 futureVerification:f=>f.s.association.verifiedAt='2026-11-02T12:00:00.000Z',
 mismatchedPerson:f=>f.s.person.id=id(99), wrongHuman:f=>f.s.person.humanId=id(99), otherOrganization:f=>f.s.person.organizationId=id(99),
 reassignedPerson:f=>f.s.assignment.personId=id(99), inactivePerson:f=>f.s.person.active=false,
 wrongRelationship:f=>f.s.relationship.personId=id(99), revokedRelationship:f=>f.s.relationship.revoked=true,
 unlinkedIntake:f=>f.s.intake.status='new', wrongIntake:f=>f.s.intake.id=id(99), otherIntakePerson:f=>f.s.intake.personId=id(99),
 invalidAuthorityRevision:f=>f.s.authorityRevision=0, absentAuthorityRevision:f=>delete f.s.authorityRevision,
 unauthorizedHousehold:f=>f.s.household={id:id(20)}, arbitraryClientAuthority:f=>f.request.allowed=true,
 malformedSelection:f=>f.request.campaignId='huntsville', missingSelection:f=>delete f.request.intakeId
};
for(const [name,mutate]of Object.entries(failures)) test(name+' denies',async()=>{const f=fixture();mutate(f);assert.deepEqual(await f.reader.read(f.request),{status:'unavailable'});});
test('explicit canonical household membership allowed without guardian inference',async()=>{
 const f=fixture();f.s.association.householdId=id(20);f.s.assignment.householdId=id(20);f.s.household={id:id(20),organizationId:id(1),status:'active'};f.s.membership={householdId:id(20),personId:id(10),organizationId:id(1),active:true,relationship:'child'};
 assert.equal((await f.reader.read(f.request)).status,'ready');f.s.membership.personId=id(99);assert.equal((await f.reader.read(f.request)).status,'unavailable');
});
for(const action of ['logout','switch','invalidate','expire','abort','revoke','replace']) test('pending snapshot '+action+' denied',async()=>{
 const f=fixture();let release;const wait=new Promise(r=>release=r);f.setRun(async(q,cb)=>{await wait;cb(f.s);});const c=new AbortController();const pending=f.reader.read(f.request,{signal:c.signal});
 if(action==='logout')f.setPrincipal(null);if(action==='switch')f.setPrincipal({...f.p,userId:id(99)});if(action==='invalidate')f.reader.invalidate();if(action==='expire')f.setClock(tick+3600000);if(action==='abort')c.abort();if(action==='revoke')f.s.assignment.revoked=true;if(action==='replace')f.s.association.id=id(99);release();assert.equal((await pending).status,'unavailable');
});
test('callback result cannot be forged by repository return',async()=>{const f=fixture();f.setRun(async()=>({status:'ready'}));assert.equal((await f.reader.read(f.request)).status,'unavailable');});
test('duplicate repository callback rejects whole operation',async()=>{const f=fixture();f.setRun(async(q,cb)=>{cb(f.s);cb(f.s);});assert.equal((await f.reader.read(f.request)).status,'unavailable');});
test('repository failure after callback discards projection and error',async()=>{const f=fixture();f.setRun(async(q,cb)=>{cb(f.s);throw new Error('private details');});assert.deepEqual(await f.reader.read(f.request),{status:'unavailable'});});
test('logout after callback before repository completion denies',async()=>{const f=fixture();f.setRun(async(q,cb)=>{cb(f.s);f.setPrincipal(null);});assert.equal((await f.reader.read(f.request)).status,'unavailable');});
test('out of order requests only release latest selection',async()=>{const f=fixture();let release;const wait=new Promise(r=>release=r);f.setRun(async(q,cb)=>{await wait;cb(f.s);});const a=f.reader.read(f.request);f.setRun(async(q,cb)=>cb(f.s));assert.equal((await f.reader.read(f.request)).status,'ready');release();assert.equal((await a).status,'unavailable');});
test('caller mutation cannot redirect server lookup',async()=>{const f=fixture();let target;f.setRun(async(q,cb)=>{target=q;f.request.campaignId=id(99);cb(f.s);});assert.equal((await f.reader.read(f.request)).status,'ready');assert.equal(target.campaignId,id(2));});
test('fresh independent eligible account can read after old session invalidation',async()=>{const f=fixture();f.reader.invalidate();const p={...f.p,userId:id(30),sessionId:id(31),epoch:2};f.setPrincipal(p);f.s.session=p;Object.assign(f.s.assignment,{userId:p.userId,sessionId:p.sessionId,sessionEpoch:p.epoch});assert.equal((await f.reader.read(f.request)).status,'ready');});
for (const field of ['organizationId','campaignId','intakeId']) test('association exact '+field,async()=>{const f=fixture();f.s.association[field]=id(99);assert.equal((await f.reader.read(f.request)).status,'unavailable');});
test('transaction waiting for a serialized snapshot observes completed revocation',async()=>{const f=fixture();let unlock;const locked=new Promise(r=>unlock=r);f.setRun(async(q,cb)=>{await locked;cb(f.s);});const read=f.reader.read(f.request);f.s.assignment.revoked=true;unlock();assert.equal((await read).status,'unavailable');});
test('promise completion past authority expiry never returns stale projection',async()=>{const f=fixture();f.setRun(async(q,cb)=>{cb(f.s);f.setClock(tick+3600000);});assert.equal((await f.reader.read(f.request)).status,'unavailable');});
test('repeated denied lookup does not preserve prior authorized record',async()=>{const f=fixture();assert.equal((await f.reader.read(f.request)).status,'ready');f.s.assignment.revoked=true;for(let n=0;n<5;n++)assert.deepEqual(await f.reader.read(f.request),{status:'unavailable'});});
