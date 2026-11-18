// Inert, side-effect-free review preparation. No import from app/Edge runtime.
import{TEAM_NOTICE_PROPOSALS}from'./catalog.mjs';
const teamStates=['applied','under_review','approved','waitlisted','declined','cancelled'];
const applicationStates=['pending','under_review','waitlisted','not_selected','cancelled'];
const travelKinds=['vehicle_seat_reserved','vehicle_seat_cancelled','itinerary_confirmed','itinerary_needs_review'];
const requirements=Object.freeze(['notification_policy','recipient_identity_and_channel','consent_and_suppression','sender_and_reply_to','fresh_authorization_and_state','copy_approval','delivery_idempotency_and_recovery','release_approval']);
export class DraftPreparationError extends Error{constructor(code,message){super(message);this.name='DraftPreparationError';this.code=code;}}
const fail=(code,message)=>{throw new DraftPreparationError(code,message)};
function object(value,required,path){
 if(!value||typeof value!=='object'||Array.isArray(value))fail('invalid_input',path+' must be an object');
 if(Object.keys(value).some(k=>!required.includes(k))||required.some(k=>!Object.hasOwn(value,k)))fail('invalid_input',path+' has missing or unsupported fields');
 return value;
}
function id(v,path){if(typeof v!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v))fail('invalid_input',path+' requires an explicit UUID');return v.toLowerCase();}
function revision(v,path){if(!Number.isSafeInteger(v)||v<1)fail('invalid_input',path+' requires a positive revision');return v;}
function label(v,path,max){if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(v))fail('invalid_input',path+' requires bounded single-line text');return v.trim();}
function bool(v,path){if(typeof v!=='boolean')fail('invalid_input',path+' requires an explicit boolean');return v;}
function optionalLocation(v,path){if(typeof v!=='string'||v.length>500||/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(v))fail('invalid_input',path+' requires bounded single-line text');return v.trim().length>0;}
function instant(v){
 if(typeof v!=='string')return false;
 const r=v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/);if(!r||!Number.isFinite(Date.parse(v)))return false;
 const[y,m,d,h,min,s]=r.slice(1).map(Number),days=[31,(y%4===0&&(y%100!==0||y%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];
 return y>=1&&m>=1&&m<=12&&d>=1&&d<=days[m-1]&&h<24&&min<60&&s<60;
}
function departureKnown(v){if(v===null)return false;if(!instant(v))fail('invalid_input','Travel departure must be an explicit timestamp or null');return true;}
function equal(a,b,code,message){if(a!==b)fail(code,message);}
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const v of Object.values(value))freeze(v);Object.freeze(value)}return value;}
// Same source-status precedence used by the reviewed participant presentation.
function effectiveStatus(member){return member.source_application_status==='cancelled'?'cancelled':member.source_application_status==='not_selected'?'declined':member.source_application_status==='waitlisted'?'waitlisted':member.status;}
export function prepareTeamNoticeDraft(input){
 const hasTravel=input&&travelKinds.includes(input.kind);
 object(input,['kind','observed_at','campaign','member','expected',...(hasTravel?['travel']:[])],'request');
 if(!Object.hasOwn(TEAM_NOTICE_PROPOSALS,input.kind))fail('unknown_template','No proposal exists for this notice kind');
 const template=TEAM_NOTICE_PROPOSALS[input.kind];
 if(typeof input.observed_at!=='string'||!input.observed_at.endsWith('Z')||!instant(input.observed_at))fail('invalid_input','An explicit UTC snapshot observation time is required');
 const c=object(input.campaign,['id','organization_id','name'],'campaign'),m=object(input.member,['id','campaign_id','organization_id','status','source_application_status','revision','travel_ready'],'member');
 const campaignId=id(c.id,'campaign.id'),org=id(c.organization_id,'campaign.organization_id'),memberId=id(m.id,'member.id'),eventName=label(c.name,'campaign.name',160);
 equal(id(m.campaign_id,'member.campaign_id'),campaignId,'scope_mismatch','Participant belongs to a different event');
 equal(id(m.organization_id,'member.organization_id'),org,'scope_mismatch','Participant belongs to a different organization');
 if(!teamStates.includes(m.status)||!applicationStates.includes(m.source_application_status))fail('invalid_input','Unsupported participant or source application state');
 const memberRevision=revision(m.revision,'member.revision'),ready=bool(m.travel_ready,'member.travel_ready'),state=effectiveStatus(m);
 const expected=object(input.expected,['member_revision',...(hasTravel?['assignment_revision','leg_revision']:[])],'expected');
 equal(revision(expected.member_revision,'expected.member_revision'),memberRevision,'stale_snapshot','Participant revision changed; obtain a fresh review snapshot');
 const values={event_name:eventName};let travel=null;
 if(!hasTravel){
  const desired={team_under_review:'under_review',team_approved:'approved',team_waitlisted:'waitlisted',team_declined:'declined',team_cancelled:'cancelled'}[input.kind];
  equal(state,desired,'status_mismatch','Proposal does not match the current effective participant state');
 }else{
  const t=object(input.travel,['assignment','leg','confirmation_valid'],'travel');
  const a=object(t.assignment,['id','campaign_id','member_id','leg_id','vehicle_id','state','revision'],'travel.assignment');
  const l=object(t.leg,['id','campaign_id','label','revision','itinerary_confirmed','departure_at','departure_location','destination'],'travel.leg');
  const assignmentId=id(a.id,'travel.assignment.id'),legId=id(l.id,'travel.leg.id'),vehicleId=id(a.vehicle_id,'travel.assignment.vehicle_id');
  equal(id(a.campaign_id,'travel.assignment.campaign_id'),campaignId,'scope_mismatch','Assignment belongs to a different event');
  equal(id(l.campaign_id,'travel.leg.campaign_id'),campaignId,'scope_mismatch','Travel leg belongs to a different event');
  equal(id(a.member_id,'travel.assignment.member_id'),memberId,'scope_mismatch','Assignment belongs to a different participant');
  equal(id(a.leg_id,'travel.assignment.leg_id'),legId,'scope_mismatch','Assignment and travel leg differ');
  if(!['assigned','confirmed','cancelled'].includes(a.state))fail('invalid_input','Unsupported assignment state');
  const assignmentRevision=revision(a.revision,'travel.assignment.revision'),legRevision=revision(l.revision,'travel.leg.revision'),legConfirmed=bool(l.itinerary_confirmed,'travel.leg.itinerary_confirmed'),valid=bool(t.confirmation_valid,'travel.confirmation_valid');
  equal(revision(expected.assignment_revision,'expected.assignment_revision'),assignmentRevision,'stale_snapshot','Assignment revision changed; obtain a fresh review snapshot');
  equal(revision(expected.leg_revision,'expected.leg_revision'),legRevision,'stale_snapshot','Travel leg revision changed; obtain a fresh review snapshot');
  values.leg_label=label(l.label,'travel.leg.label',100);
  const timeKnown=departureKnown(l.departure_at),fromKnown=optionalLocation(l.departure_location,'travel.leg.departure_location'),destinationKnown=optionalLocation(l.destination,'travel.leg.destination'),locationsKnown=fromKnown&&destinationKnown;
  const confirmed=state==='approved'&&ready&&a.state==='confirmed'&&legConfirmed&&valid&&timeKnown&&locationsKnown;
  if(valid&&!confirmed)fail('inconsistent_snapshot','Itinerary validity conflicts with participant, assignment or leg state');
  if(input.kind==='itinerary_confirmed'&&!confirmed)fail('unconfirmed_travel','Current confirmed itinerary evidence is required');
  if(input.kind==='vehicle_seat_reserved'&&(state!=='approved'||!ready||a.state!=='assigned'||valid))fail('status_mismatch','Reserved-seat proposal requires an eligible participant and an unconfirmed assigned seat');
  if(input.kind==='vehicle_seat_cancelled'&&(a.state!=='cancelled'||valid))fail('status_mismatch','Seat-cancellation proposal requires a cancelled reservation');
  if(input.kind==='itinerary_needs_review'&&(a.state==='cancelled'||confirmed))fail('status_mismatch','Review proposal requires an active arrangement without current confirmation');
  travel={assignment_id:assignmentId,assignment_revision:assignmentRevision,leg_id:legId,leg_revision:legRevision,vehicle_id:vehicleId,assignment_state:a.state,leg_itinerary_confirmed:legConfirmed,confirmation_valid:valid,departure_known:timeKnown,locations_known:locationsKnown};
 }
 const render=s=>s.replace(/\{\{([a-z_]+)\}\}/g,(_,key)=>{if(!Object.hasOwn(values,key))fail('template_error','Proposal contains an unsupported placeholder');return values[key]});
 const subject=render(template.subject),text=template.paragraphs.map(render).join('\n\n');
 // A review key identifies this proposed snapshot/version. It is NOT a provider
 // idempotency key, send authorization, delivery task or persistent outbox row.
 const key=['team-notice-review-v1',input.kind,template.version,campaignId,memberId,memberRevision,...(travel?[travel.assignment_id,travel.assignment_revision,travel.leg_id,travel.leg_revision]:[])].join('/');
 return freeze({kind:input.kind,template_version:template.version,state:'held_for_policy_review',sendable:false,recipient:null,sender:null,delivery_channel:null,persistence:'none',authorization:'not_checked',freshness:'not_revalidated',required_decisions:[...requirements],review_key:key,observation:{observed_at:new Date(input.observed_at).toISOString(),campaign_id:campaignId,organization_id:org,member_id:memberId,member_revision:memberRevision,team_status:m.status,source_application_status:m.source_application_status,effective_status:state,travel_ready:ready,...(travel?{travel}:{} )},content:{format:'text/plain',approval:'unapproved_proposal',subject,text}});
}
