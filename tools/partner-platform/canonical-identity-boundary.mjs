// SERVER-ONLY dependency adapter. No repository/SQL provider is installed here.
// The existing assigned metadata RPC continues to return null/unverified.
export const IDENTITY_SOURCE_HASHES=Object.freeze({
 b:'03c3f6b94aadbe4195ecd9cea30463918687518d3c0ed5a630d3c7071d6c0020',
 b1:'578fd9fa7eb6786eea79345039bc4eec0c11a2b779875759b770627eda727f6a',
 b2:'46d29ac81d565f17b34e41571d47c2b016fe1b2f54242bf8c632562e5b9d7754'
});
const uuid=x=>typeof x==='string'&&x.length===36&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x);
const rev=x=>Number.isSafeInteger(x)&&x>0;
const capability=(values,required)=>Array.isArray(values)&&values.every(value=>typeof value==='string')&&values.includes(required);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const at=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const active=(x,n)=>x?.active===true&&at(x.effective_at)<=n&&(x.expires_at===null||n<at(x.expires_at));
const auth=(u,n)=>uuid(u?.id)&&Number.isFinite(at(u.email_confirmed_at))&&u.is_anonymous===false&&u.deleted_at===null&&(u.banned_until===null||at(u.banned_until)<=n);
const unknown=()=>Object.freeze({identityStatus:'unverified',personId:null});
const requireValue=x=>{if(!x)throw Error('Canonical identity unavailable')};
const principal=(p,n)=>uuid(p?.userId)&&uuid(p.sessionId)&&p.verified===true&&Number.isFinite(at(p.expiresAt))&&n<at(p.expiresAt);
const same=(a,b)=>a?.userId===b?.userId&&a?.sessionId===b?.sessionId;
const keys=['organizationId','campaignId','assignmentId'];

export function createCanonicalPartnerIdentityBoundary({getPrincipal,repository,now=Date.now}){
 if(typeof getPrincipal!=='function'||typeof now!=='function')throw TypeError('Trusted principal binding required');
 let generation=0;
 const sources=()=>repository&&Object.keys(IDENTITY_SOURCE_HASHES).every(k=>repository.sourceHashes?.[k]===IDENTITY_SOURCE_HASHES[k]);
 return Object.freeze({invalidate(){generation++},async read(input){
  const g=++generation;let value,used=false,deadline;
  try{
   requireValue(input&&Object.getPrototypeOf(input)===Object.prototype&&Reflect.ownKeys(input).length===keys.length&&keys.every(k=>uuid(input[k])));
   requireValue(typeof repository?.withCurrentIdentity==='function'&&sources());
   const request=Object.freeze(Object.fromEntries(keys.map(k=>[k,input[k]]))),caller=structuredClone(getPrincipal());
   const current=()=>g===generation&&sources()&&principal(getPrincipal(),now())&&same(caller,getPrincipal());
   requireValue(current());
   // This provider must obtain/lock current rows AND independently verify exact
   // complete installed source provenance. Client snapshots/booleans cannot be
   // supplied in place of this server-owned serialized repository method.
   await repository.withCurrentIdentity(Object.freeze({...request,userId:caller.userId,sessionId:caller.sessionId}),raw=>{
    requireValue(!used&&current());used=true;const s=structuredClone(raw),n=now();
    const {actor,session,campaign,partner,assignment,campaignGrant,partnerGrant,source,registrant,review,identityRequest,careRequest,identityAudit,reviewAudit,person,account,subject}=s;
    requireValue(auth(actor,n)&&actor.id===caller.userId&&session?.id===caller.sessionId&&session.user_id===actor.id&&(session.not_after===null||n<at(session.not_after)));
    requireValue(campaign?.id===request.campaignId&&campaign.organization_id===request.organizationId);
    requireValue(partner?.active===true&&uuid(partner.id)&&partner.campaign_id===campaign.id);
    requireValue(assignment?.id===request.assignmentId&&assignment.campaign_id===campaign.id&&assignment.partner_church_id===partner.id&&assignment.assigned_worker_user_id===actor.id&&assignment.status==='active'&&assignment.event_registration_id===null&&rev(assignment.revision));
    requireValue(active(campaignGrant,n)&&campaignGrant.campaign_id===campaign.id&&campaignGrant.user_id===actor.id&&capability(campaignGrant.capabilities,'view'));
    requireValue(active(partnerGrant,n)&&partnerGrant.campaign_id===campaign.id&&partnerGrant.partner_church_id===partner.id&&partnerGrant.user_id===actor.id&&capability(partnerGrant.capabilities,'partner.view'));
    requireValue(uuid(source?.id)&&source.id===assignment.decision_registration_id&&source.consent===true&&uuid(source.user_id)&&hash(s.currentSourceHash));
    requireValue(uuid(registrant?.id)&&registrant.campaign_id===campaign.id&&registrant.organization_id===campaign.organization_id&&registrant.legacy_registration_id===source.id&&uuid(registrant.person_id)&&rev(registrant.revision));
    requireValue(review?.campaign_id===campaign.id&&review.source_id===source.id&&review.outcome==='linked'&&rev(review.revision)&&review.registrant_revision===registrant.revision&&review.source_hash===s.currentSourceHash);
    requireValue(uuid(identityRequest?.request_id)&&identityRequest.campaign_id===campaign.id&&uuid(identityRequest.actor_id)&&hash(identityRequest.request_hash)&&identityRequest.result?.registrant_id===registrant.id&&identityRequest.result.person_id===registrant.person_id&&identityRequest.result.revision===registrant.revision);
    requireValue(careRequest?.request_id===identityRequest.request_id&&careRequest.actor_id===identityRequest.actor_id&&careRequest.campaign_id===campaign.id&&hash(careRequest.payload_hash)&&careRequest.result?.source_id===source.id&&careRequest.result.outcome==='linked'&&careRequest.result.review_revision===review.revision&&careRequest.result.registrant_revision===registrant.revision);
    requireValue(uuid(identityAudit?.id)&&identityAudit.campaign_id===campaign.id&&identityAudit.organization_id===campaign.organization_id&&identityAudit.actor_user_id===identityRequest.actor_id&&identityAudit.kind==='decision.identity_reviewed'&&identityAudit.subject_id===registrant.id&&identityAudit.metadata?.request_id===identityRequest.request_id&&identityAudit.metadata.source_id===source.id&&identityAudit.metadata.source_hash===s.currentSourceHash&&identityAudit.metadata.after_person===registrant.person_id&&identityAudit.metadata.method==='authorized_reconciliation');
    requireValue(uuid(reviewAudit?.id)&&reviewAudit.campaign_id===campaign.id&&reviewAudit.organization_id===campaign.organization_id&&reviewAudit.actor_user_id===identityRequest.actor_id&&reviewAudit.kind==='decision.review_completed'&&reviewAudit.subject_id===source.id&&reviewAudit.metadata?.request_id===identityRequest.request_id&&reviewAudit.metadata.outcome==='linked'&&reviewAudit.metadata.source_hash===s.currentSourceHash);
    requireValue(person?.id===registrant.person_id&&person.organization_id===campaign.organization_id&&uuid(person.human_id)&&(person.user_id===null||person.user_id===source.user_id));
    requireValue(account?.active===true&&account.organization_id===campaign.organization_id&&account.person_id===person.id&&account.user_id===source.user_id&&auth(subject,n)&&subject.id===source.user_id&&identityRequest.actor_id!==subject.id);
    deadline=Math.min(at(caller.expiresAt),...[[session,'not_after'],[campaignGrant,'expires_at'],[partnerGrant,'expires_at']].map(([o,k])=>o[k]===null?Infinity:at(o[k])));
    requireValue(current()&&n<deadline);
    value=Object.freeze({identityStatus:'verified',personId:person.id});
   });
   requireValue(used&&value&&current()&&now()<deadline);return value;
  }catch{return unknown()}
 }});
}
