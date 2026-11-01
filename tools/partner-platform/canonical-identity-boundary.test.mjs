import test from 'node:test';import assert from 'node:assert/strict';import{randomUUID as uuid}from'node:crypto';
import{createCanonicalPartnerIdentityBoundary,IDENTITY_SOURCE_HASHES}from'./canonical-identity-boundary.mjs';
function fixture(){
 const ids=Object.fromEntries(['org','campaign','assignment','actor','session','partner','source','registrant','person','human','subject','request','reviewer','audit','audit2'].map(k=>[k,uuid()]));
 const time=Date.parse('2026-11-01T12:00:00Z'),future='2026-11-02T12:00:00Z',past='2026-10-01T12:00:00Z',hash='a'.repeat(64);
 let now=time,principal={userId:ids.actor,sessionId:ids.session,verified:true,expiresAt:future},hook=async cb=>cb(snapshot);
 const auth=id=>({id,email_confirmed_at:past,is_anonymous:false,deleted_at:null,banned_until:null});
 const grant={active:true,effective_at:past,expires_at:future,campaign_id:ids.campaign,user_id:ids.actor};
 const snapshot={
  actor:auth(ids.actor),session:{id:ids.session,user_id:ids.actor,not_after:future},campaign:{id:ids.campaign,organization_id:ids.org},partner:{id:ids.partner,campaign_id:ids.campaign,active:true},
  assignment:{id:ids.assignment,campaign_id:ids.campaign,partner_church_id:ids.partner,assigned_worker_user_id:ids.actor,status:'active',event_registration_id:null,decision_registration_id:ids.source,revision:1},
  campaignGrant:{...grant,capabilities:['view']},partnerGrant:{...grant,partner_church_id:ids.partner,capabilities:['partner.view']},
  source:{id:ids.source,user_id:ids.subject,consent:true},currentSourceHash:hash,
  registrant:{id:ids.registrant,campaign_id:ids.campaign,organization_id:ids.org,legacy_registration_id:ids.source,person_id:ids.person,revision:2},
  review:{campaign_id:ids.campaign,source_id:ids.source,outcome:'linked',revision:1,registrant_revision:2,source_hash:hash},
  identityRequest:{request_id:ids.request,campaign_id:ids.campaign,actor_id:ids.reviewer,request_hash:hash,result:{registrant_id:ids.registrant,person_id:ids.person,revision:2}},
  careRequest:{request_id:ids.request,campaign_id:ids.campaign,actor_id:ids.reviewer,payload_hash:hash,result:{source_id:ids.source,outcome:'linked',review_revision:1,registrant_revision:2}},
  identityAudit:{id:ids.audit,campaign_id:ids.campaign,organization_id:ids.org,actor_user_id:ids.reviewer,kind:'decision.identity_reviewed',subject_id:ids.registrant,metadata:{request_id:ids.request,source_id:ids.source,source_hash:hash,after_person:ids.person,method:'authorized_reconciliation'}},
  reviewAudit:{id:ids.audit2,campaign_id:ids.campaign,organization_id:ids.org,actor_user_id:ids.reviewer,kind:'decision.review_completed',subject_id:ids.source,metadata:{request_id:ids.request,outcome:'linked',source_hash:hash}},
  person:{id:ids.person,organization_id:ids.org,human_id:ids.human,user_id:null},account:{active:true,organization_id:ids.org,person_id:ids.person,user_id:ids.subject},subject:auth(ids.subject)
 };
 const repository={sourceHashes:{...IDENTITY_SOURCE_HASHES},async withCurrentIdentity(input,cb){assert.equal(input.userId,ids.actor);return hook(cb)}};
 const args={organizationId:ids.org,campaignId:ids.campaign,assignmentId:ids.assignment};
 const boundary=createCanonicalPartnerIdentityBoundary({getPrincipal:()=>principal,repository,now:()=>now});
 return{ids,args,snapshot,repository,boundary,setPrincipal:p=>principal=p,setNow:t=>now=t,setHook:h=>hook=h};
}
test('exact fictional serialized receipt contract returns only verified Person ID',async()=>{const f=fixture();assert.deepEqual(await f.boundary.read(f.args),{identityStatus:'verified',personId:f.ids.person})});
test('missing provider stays unverified',async()=>{const f=fixture(),b=createCanonicalPartnerIdentityBoundary({getPrincipal:()=>null});assert.deepEqual(await b.read(f.args),{identityStatus:'unverified',personId:null})});
for(const path of ['actor.email_confirmed_at','session.id','session.user_id','campaign.organization_id','partner.active','assignment.assigned_worker_user_id','assignment.decision_registration_id','assignment.revision','campaignGrant.active','partnerGrant.active','partnerGrant.capabilities','source.user_id','source.consent','currentSourceHash','registrant.organization_id','registrant.legacy_registration_id','registrant.person_id','registrant.revision','review.outcome','review.revision','review.registrant_revision','review.source_hash','identityRequest.request_id','identityRequest.actor_id','identityRequest.result.person_id','identityRequest.result.revision','careRequest.request_id','careRequest.result.review_revision','careRequest.result.registrant_revision','identityAudit.actor_user_id','identityAudit.metadata.source_hash','identityAudit.metadata.after_person','identityAudit.metadata.request_id','reviewAudit.subject_id','reviewAudit.metadata.outcome','person.organization_id','person.human_id','account.user_id','account.active','subject.email_confirmed_at'])test('missing/conflicting '+path,async()=>{const f=fixture();const parts=path.split('.'),key=parts.pop();let target=f.snapshot;for(const p of parts)target=target[p];target[key]=null;assert.deepEqual(await f.boundary.read(f.args),{identityStatus:'unverified',personId:null})});
for(const key of Object.keys(IDENTITY_SOURCE_HASHES))test('wrong source fingerprint '+key,async()=>{const f=fixture();f.repository.sourceHashes[key]='b'.repeat(64);assert.equal((await f.boundary.read(f.args)).personId,null)});
test('no name/email/household inference',async()=>{const f=fixture();f.snapshot.review=null;f.snapshot.source.email='shared@example.test';f.snapshot.person.email='shared@example.test';f.snapshot.household={members:[f.ids.subject]};assert.equal((await f.boundary.read(f.args)).personId,null)});
test('browser evidence injection rejected',async()=>{const f=fixture();assert.equal((await f.boundary.read({...f.args,verified:true,snapshot:f.snapshot})).personId,null)});
test('independent reviewer cannot be linked account owner',async()=>{const f=fixture();for(const x of [f.snapshot.identityRequest,f.snapshot.careRequest])x.actor_id=f.ids.subject;for(const x of [f.snapshot.identityAudit,f.snapshot.reviewAudit])x.actor_user_id=f.ids.subject;assert.equal((await f.boundary.read(f.args)).personId,null)});
test('late repository callback cannot restore invalidated identity',async()=>{const f=fixture();f.setHook(async cb=>{f.boundary.invalidate();cb(f.snapshot)});assert.equal((await f.boundary.read(f.args)).personId,null)});
test('account change invalidates pending projection',async()=>{const f=fixture();f.setHook(async cb=>{cb(f.snapshot);f.setPrincipal(null)});assert.equal((await f.boundary.read(f.args)).personId,null)});
test('expiry while repository completes denies',async()=>{const f=fixture();f.setHook(async cb=>{cb(f.snapshot);f.setNow(Date.parse('2026-11-03T00:00:00Z'))});assert.equal((await f.boundary.read(f.args)).personId,null)});
test('repository returned value without callback is not trusted',async()=>{const f=fixture();f.setHook(async()=>({identityStatus:'verified',personId:f.ids.person}));assert.equal((await f.boundary.read(f.args)).personId,null)});
test('two callback snapshots cannot substitute identity',async()=>{const f=fixture();f.setHook(async cb=>{cb(f.snapshot);cb(f.snapshot)});assert.equal((await f.boundary.read(f.args)).personId,null)});
test('source provenance changed after snapshot denies',async()=>{const f=fixture();f.setHook(async cb=>{cb(f.snapshot);f.repository.sourceHashes.b2='0'.repeat(64)});assert.equal((await f.boundary.read(f.args)).personId,null)});

test('conflicting canonical owner rejected',async()=>{const f=fixture();f.snapshot.person.user_id=f.ids.actor;assert.equal((await f.boundary.read(f.args)).personId,null)});
