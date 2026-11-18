// Inert preparation tests. All facts are synthetic; no provider or database use.
import assert from'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import vm from'node:vm';
import{prepareTeamNoticeDraft,DraftPreparationError}from'../outreach-team-notifications/drafts.mjs';
import{TEAM_NOTICE_PROPOSALS}from'../outreach-team-notifications/catalog.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),read=p=>readFileSync(path.join(root,p),'utf8'),clone=x=>JSON.parse(JSON.stringify(x));let n=0;
const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)},reject=(input,code,m)=>{assert.throws(()=>prepareTeamNoticeDraft(input),e=>e instanceof DraftPreparationError&&e.code===code);ok(true,m)};
const ids={org:'11111111-1111-4111-8111-111111111111',campaign:'22222222-2222-4222-8222-222222222222',member:'33333333-3333-4333-8333-333333333333',assignment:'44444444-4444-4444-8444-444444444444',leg:'55555555-5555-4555-8555-555555555555',vehicle:'66666666-6666-4666-8666-666666666666',other:'99999999-9999-4999-8999-999999999999'};
function facts(kind='team_approved'){
 const states={team_under_review:'under_review',team_approved:'approved',team_waitlisted:'waitlisted',team_declined:'declined',team_cancelled:'cancelled'};
 const v={kind,observed_at:'2026-11-17T23:00:00Z',campaign:{id:ids.campaign,organization_id:ids.org,name:'Synthetic Minden outreach'},member:{id:ids.member,campaign_id:ids.campaign,organization_id:ids.org,status:states[kind]||'approved',source_application_status:'pending',revision:5,travel_ready:true},expected:{member_revision:5}};
 if(!kind.startsWith('team_')){v.expected.assignment_revision=3;v.expected.leg_revision=2;const confirmed=kind==='itinerary_confirmed';v.travel={assignment:{id:ids.assignment,campaign_id:ids.campaign,member_id:ids.member,leg_id:ids.leg,vehicle_id:ids.vehicle,state:kind==='vehicle_seat_cancelled'?'cancelled':confirmed?'confirmed':'assigned',revision:3},leg:{id:ids.leg,campaign_id:ids.campaign,label:'Synthetic outbound',revision:2,itinerary_confirmed:confirmed,departure_at:confirmed?'2026-12-19T14:00:00Z':null,departure_location:confirmed?'PRIVATE SYNTHETIC MEETING POINT':'',destination:confirmed?'PRIVATE SYNTHETIC DESTINATION':''},confirmation_valid:confirmed};}
 return v;
}
const previews=[];
for(const kind of Object.keys(TEAM_NOTICE_PROPOSALS)){
 const input=facts(kind),before=clone(input),d=prepareTeamNoticeDraft(input);previews.push(d);
 ok(d.state==='held_for_policy_review'&&d.sendable===false&&d.recipient===null&&d.sender===null&&d.delivery_channel===null,'every proposal is inert and has no recipient/sender/channel: '+kind);
 ok(d.persistence==='none'&&d.authorization==='not_checked'&&d.freshness==='not_revalidated'&&d.required_decisions.length===8,'every proposal retains unresolved authority/freshness/policy gates: '+kind);
 ok(d.content.approval==='unapproved_proposal'&&d.content.format==='text/plain'&&!Object.hasOwn(d.content,'html')&&!d.content.text.includes('{{'),'proposed text renders bounded explicit placeholders: '+kind);
 assert.deepEqual(input,before);ok(Object.isFrozen(d)&&Object.isFrozen(d.content)&&Object.isFrozen(d.observation)&&Object.isFrozen(d.required_decisions),'preparation preserves input and deeply freezes draft: '+kind);
 assert.throws(()=>{d.sendable=true},TypeError);assert.throws(()=>{d.recipient='guessed@example.test'},TypeError);
 ok(!JSON.stringify(d).includes('PRIVATE SYNTHETIC'),'draft excludes private itinerary details: '+kind);
}
ok(previews.length===9,'nine explicit status proposals, excluding existing P0 receipt');
ok(prepareTeamNoticeDraft(facts()).content.text.includes('This approval does not confirm either'),'approval never implies seat or confirmed itinerary');
ok(prepareTeamNoticeDraft(facts('team_waitlisted')).content.text.includes('does not confirm a place on the team'),'waitlist is not approval or attendance confirmation');
ok(prepareTeamNoticeDraft(facts('team_declined')).content.text.includes('has not selected')&&!prepareTeamNoticeDraft(facts('team_declined')).content.text.includes('approved'),'nonselection content is status-accurate');
ok(prepareTeamNoticeDraft(facts('team_cancelled')).content.text.includes('record')&&!prepareTeamNoticeDraft(facts('team_cancelled')).content.text.includes('you cancelled'),'cancellation does not invent who cancelled');
ok(prepareTeamNoticeDraft(facts('vehicle_seat_reserved')).content.text.includes('itinerary is not confirmed'),'reserved seat remains distinct from confirmed itinerary');
ok(prepareTeamNoticeDraft(facts('vehicle_seat_cancelled')).content.text.includes('does not confirm another seat'),'seat cancellation never promises replacement');
ok(prepareTeamNoticeDraft(facts('itinerary_confirmed')).content.text.includes('only to this travel leg'),'confirmed copy does not imply another leg is confirmed');
ok(prepareTeamNoticeDraft(facts('itinerary_needs_review')).content.text.includes('not currently confirmed'),'travel review invalidates reliance on previous confirmation');
{
 const d=prepareTeamNoticeDraft(facts());assert.deepEqual(d,prepareTeamNoticeDraft(facts()));ok(true,'same snapshot/template produces deterministic review object');
 const next=facts();next.member.revision++;next.expected.member_revision++;ok(d.review_key!==prepareTeamNoticeDraft(next).review_key,'participant revision changes the review key');
 const t=facts('itinerary_confirmed'),old=prepareTeamNoticeDraft(t);t.travel.assignment.revision++;t.expected.assignment_revision++;ok(old.review_key!==prepareTeamNoticeDraft(t).review_key,'assignment revision changes the review key');
 ok(!Object.hasOwn(d,'idempotency_key')&&!Object.hasOwn(d,'provider_id'),'review key is not a provider task or receipt');
}
for(const[field,value]of[['enabled',true],['sendable',true],['recipient','guessed@example.test'],['sender','outreach@example.test'],['channel','email'],['delivery_mode','live']]){const x=facts();x[field]=value;reject(x,'invalid_input','activation/recipient override rejected: '+field)}
for(const[field,value]of[['email','person@example.test'],['person_id',ids.other],['review_note','PRIVATE REVIEW']]){const x=facts();x.member[field]=value;reject(x,'invalid_input','recipient/private-data input not accepted: '+field)}
{
 const x=facts();x.kind='application_received';reject(x,'unknown_template','P0 receipt template remains outside P1 preparation');
 const y=facts();y.kind='marketing';reject(y,'unknown_template','no marketing or arbitrary template');
 const z=facts();z.expected.member_revision++;reject(z,'stale_snapshot','stale selected participant revision rejected');
}
for(const[state,kind]of[['waitlisted','team_waitlisted'],['not_selected','team_declined'],['cancelled','team_cancelled']]){const x=facts(kind);x.member.status='approved';x.member.source_application_status=state;ok(prepareTeamNoticeDraft(x).observation.effective_status!=='approved','existing source-status precedence prevents stale approval: '+state);x.kind='team_approved';reject(x,'status_mismatch','approval proposal cannot override current source state: '+state)}
for(const field of['campaign_id','organization_id']){const x=facts();x.member[field]=ids.other;reject(x,'scope_mismatch','cross-scope participant rejected: '+field)}
for(const[property,field]of[['assignment','campaign_id'],['assignment','member_id'],['assignment','leg_id'],['leg','campaign_id']]){const x=facts('itinerary_confirmed');x.travel[property][field]=ids.other;reject(x,'scope_mismatch','cross-event/person/leg travel rejected: '+property+'.'+field)}
for(const key of['assignment_revision','leg_revision']){const x=facts('itinerary_confirmed');x.expected[key]++;reject(x,'stale_snapshot','stale travel snapshot rejected: '+key)}
for(const variation of['assigned','cancelled','not_ready','source_cancelled','leg_unconfirmed','server_invalid','unknown_time','unknown_departure','unknown_destination']){
 const x=facts('itinerary_confirmed');if(variation==='assigned'||variation==='cancelled')x.travel.assignment.state=variation;if(variation==='not_ready')x.member.travel_ready=false;if(variation==='source_cancelled')x.member.source_application_status='cancelled';if(variation==='leg_unconfirmed')x.travel.leg.itinerary_confirmed=false;if(variation==='server_invalid')x.travel.confirmation_valid=false;if(variation==='unknown_time')x.travel.leg.departure_at=null;if(variation==='unknown_departure')x.travel.leg.departure_location='';if(variation==='unknown_destination')x.travel.leg.destination='';
 reject(x,variation==='server_invalid'?'unconfirmed_travel':'inconsistent_snapshot','no misleading itinerary confirmation: '+variation);
}
{
 const x=facts('vehicle_seat_reserved');x.member.travel_ready=false;reject(x,'status_mismatch','ineligible participant cannot produce reserved-seat assurance');
 const y=facts('itinerary_confirmed');y.kind='itinerary_needs_review';reject(y,'status_mismatch','current confirmed snapshot does not generate unconfirmed notice');
 const z=facts('vehicle_seat_reserved');z.kind='vehicle_seat_cancelled';reject(z,'status_mismatch','active reservation cannot generate cancellation notice');
}
for(const value of['Synthetic\r\nBcc: target@example.test','Synthetic\u2028header','',null]){const x=facts();x.campaign.name=value;reject(x,'invalid_input','unsafe or missing subject label rejected')}
{
 const x=facts('vehicle_seat_reserved');x.travel.leg.label='Outbound\nPRIVATE NOTE';reject(x,'invalid_input','travel label cannot inject a header/body line');
 const y=facts('itinerary_confirmed');y.travel.leg.departure_at='Friday morning';reject(y,'invalid_input','natural-language/stale travel timing is not guessed');
 const z=facts('vehicle_seat_reserved');z.travel.leg.destination=123;reject(z,'invalid_input','unknown locations are still type-validated');
 const t=facts();t.observed_at='tomorrow';reject(t,'invalid_input','observation time is explicit rather than guessed');
 const impossible=facts('itinerary_confirmed');impossible.travel.leg.departure_at='2026-02-31T14:00:00Z';reject(impossible,'invalid_input','impossible calendar date cannot become confirmed travel');
}
// Execute the entire preparation graph with network, timers and secrets blocked.
{
 let sideEffects=0;const blocked=()=>{sideEffects++;throw Error('Forbidden capability')};
 const catalog=read('tools/outreach-team-notifications/catalog.mjs').replace('export const','const');
 const drafts=read('tools/outreach-team-notifications/drafts.mjs').replace(/import\{TEAM_NOTICE_PROPOSALS\}from'\.\/catalog\.mjs';/,'').replace('export class','class').replace('export function','function');
 const context=vm.createContext({fetch:blocked,setTimeout:blocked,setInterval:blocked,Deno:{env:{get:blocked},serve:blocked},process:{env:new Proxy({},{get:blocked})}});
 vm.runInContext(catalog+'\n'+drafts+'\nglobalThis.prepare=prepareTeamNoticeDraft;',context);
 for(const kind of Object.keys(TEAM_NOTICE_PROPOSALS))ok(context.prepare(facts(kind)).sendable===false,'sandboxed proposal needs no network/timer/secret capability: '+kind);
 ok(sideEffects===0,'preparation has zero delivery, timer or environment side effects');
}
{
 const references=[];function walk(dir){for(const entry of readdirSync(path.join(root,dir),{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(/\.(?:js|mjs|ts|html)$/.test(p)&&read(p).includes('outreach-team-notifications'))references.push(p)}}
 for(const dir of['assets/js','supabase/functions','netlify'])walk(dir);
 ok(references.length===0,'no browser, Edge or Netlify runtime imports the review preparer');
 ok(!read('tools/site-build/public-files.json').includes('outreach-team-notifications'),'review preparation has no public artifact entry');
 const exports=await import('../outreach-team-notifications/drafts.mjs');ok(Object.keys(exports).sort().join(',')==='DraftPreparationError,prepareTeamNoticeDraft','module exposes no send, enqueue, provider or activation entrypoint');
 const reviewed=read('docs/OUTREACH-TEAM-NOTIFICATIONS.md');ok(Object.values(TEAM_NOTICE_PROPOSALS).every(t=>reviewed.includes(t.subject)&&t.paragraphs.every(p=>reviewed.includes(p))),'human review document contains every exact proposed subject and paragraph');
}
console.log(n+' inert Team notification preparation checks passed; no database/provider/session use');
