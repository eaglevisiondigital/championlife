import assert from 'node:assert/strict';import {randomUUID as uuid} from 'node:crypto';
import {localPostgres} from './local-postgres.mjs';
import {installMindenBaseline,installApprovedDecisionFoundation,read,correction} from './minden-contract-fixture.mjs';
const db=await localPostgres(),q=(...args)=>db.query(...args);let n=0;
const check=(value,message)=>{assert.ok(value,message);console.log('PASS '+(++n)+' '+message)};
const deny=async(fn,message)=>{await assert.rejects(fn);check(true,message)};
const ids={};for(const k of['worker','care','other','admin','record','unassigned','foreign'])ids[k]=uuid();
const sessions={};let campaign,org;
async function role(name,user='') {await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user,JSON.stringify({sub:user,session_id:sessions[user],exp:Math.floor(Date.now()/1000)+3600})]);await db.exec('set role '+name);}
const desk=id=>q('select public.outreach_minden_decisions($1) v',[id]).then(r=>r.rows[0].v);
const staff=(action,payload={})=>q('select public.outreach_registration_workspace($1,$2,$3) v',[action,campaign,payload]).then(r=>r.rows[0].v);
try{
 await installMindenBaseline(db);
 const c=(await q("select id,organization_id,status from outreach_campaigns where code='minden_la_family_fun_day'")).rows[0];campaign=c.id;org=c.organization_id;
 check(c.status==='draft'&&!(await q('select enabled from outreach_registration_settings where campaign_id=$1',[campaign])).rows[0].enabled,'Minden remains disabled and no legal waiver installed');
 const hunt=(await q("select to_jsonb(c) v from outreach_campaigns c where code='huntsville_al_2026'")).rows[0].v;
 for(const kind of['worker','care','other','admin']){sessions[ids[kind]]=uuid();await q('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[ids[kind],kind+'@example.invalid']);await q("insert into auth.sessions(id,user_id,not_after)values($1,$2,now()+interval '1 hour')",[sessions[ids[kind]],ids[kind]]);}
 await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,reason) values($1,$2,'local_leader',array['view','registration.view','registration.manage','registration.export','checkin.manage'],'Fictional local registration worker')",[campaign,ids.worker]);
 await role('anon');
 const insert=async(id,source='minden_la_outreach')=>q("insert into outreach_registrations(id,source,first_name,last_name,email,phone,decision,prayer_request,consent)values($1,$2,'Fictional','Minden','PRIVATE@example.invalid','15555550123','salvation','PRIVATE-PRAYER',true)",[id,source]);
 await insert(ids.record);await insert(ids.unassigned);check(true,'actual public decision INSERT accepts Minden source');
 await deny(()=>insert(ids.foreign,'unapproved_source'),'unapproved decision source denied');
 await role('authenticated',ids.worker);const original=await desk(campaign);
 check(original.decisions.length===2&&original.decisions[0].email==='PRIVATE@example.invalid'&&original.decisions[0].prayer_request==='PRIVATE-PRAYER','ORIGINAL DEFECT: registration-only staff can read all contact/prayer decision records');
 await role('postgres');await db.exec(read(correction));
 await role('authenticated',ids.worker);await deny(()=>desk(null),'corrected facade denies absent canonical foundation');
 await role('postgres');await installApprovedDecisionFoundation(db);
 await role('authenticated',ids.worker);await deny(()=>desk(null),'corrected facade denies absent reviewed Minden source mapping');
 await role('postgres');await q("insert into outreach_decision_campaign_sources(campaign_id,source) values($1,'minden_la_outreach')",[campaign]);
 for(const who of[ids.care,ids.other])await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,care_scope,decision_effective_at,decision_expires_at,reason)values($1,$2,'local_leader',array['view','decisions.read','followup.manage'],'assigned',now()-interval '1 hour',now()+interval '1 hour','Fictional independent decision authority')",[campaign,who]);
 await q('insert into outreach_decision_followup(registration_id,campaign_id,assigned_user_id,updated_by)values($1,$2,$3,$3),($4,$2,$5,$5)',[ids.record,campaign,ids.care,ids.unassigned,ids.other]);
 await role('authenticated',ids.worker);await deny(()=>desk(null),'registration-only staff no longer gains decision authority');
 await role('authenticated',ids.care);const context=await desk(null),list=await desk(campaign);
 check(context.campaign_id===campaign&&context.organization_id===org&&context.scope==='assigned','canonical Minden context for decision-only staff');
 check(list.registrations.length===1&&list.registrations[0].registration_id===ids.record,'assigned-only list excludes other worker records');
 check(!/PRIVATE|email|phone|prayer|answers|notes/.test(JSON.stringify(list))&&list.registrations[0].contact_allowed===false,'minimum projection has no private contact/prayer/learner answers');
 await deny(()=>desk(hunt.id),'wrong campaign denied');await deny(()=>staff('list'),'decision-only staff cannot list household registrations');
 await role('postgres');await q('update outreach_decision_campaign_sources set active=false where campaign_id=$1',[campaign]);await role('authenticated',ids.care);await deny(()=>desk(campaign),'mapping revocation immediately denies');
 await role('postgres');await q('update outreach_decision_campaign_sources set active=true where campaign_id=$1',[campaign]);await q("update outreach_campaign_assignments set decision_expires_at=now()-interval '1 second' where campaign_id=$1 and user_id=$2",[campaign,ids.care]);await role('authenticated',ids.care);await deny(()=>desk(campaign),'expired decision assignment denied');
 await role('anon');await deny(()=>desk(campaign),'anonymous decision staff read denied');
 await role('postgres');
 // Permanent independently reviewed regression: mapping can change while the
 // canonical assignment lock is pending. Wait for real lock state, not a race delay.
 await q("update outreach_campaign_assignments set decision_expires_at=now()+interval '1 hour' where campaign_id=$1 and user_id=$2",[campaign,ids.care]);
 const lock=await db.connect(),caller=await db.connect();await lock.query('begin');
 await lock.query('select * from outreach_campaign_assignments where campaign_id=$1 and user_id=$2 for update',[campaign,ids.care]);
 await caller.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[ids.care,JSON.stringify({sub:ids.care,session_id:sessions[ids.care],exp:Math.floor(Date.now()/1000)+3600})]);await caller.query('set role authenticated');
 const pid=(await caller.query('select pg_backend_pid() pid')).rows[0].pid;
 const pending=caller.query('select public.outreach_minden_decisions(null) v').then(r=>({data:r.rows[0].v}),e=>({error:e.code}));
 let blocked=false;for(let i=0;i<200;i++){if((await q("select wait_event_type='Lock' blocked from pg_stat_activity where pid=$1",[pid])).rows[0]?.blocked){blocked=true;break}await new Promise(r=>setTimeout(r,10))}assert.ok(blocked,'canonical assignment lock reached');
 await q("update outreach_decision_campaign_sources set source='foreign_reviewed_source' where campaign_id=$1",[campaign]);await lock.query('commit');
 check((await pending).error==='42501','concurrent source-map replacement cannot relabel foreign records as Minden');
 await q("update outreach_decision_campaign_sources set source='minden_la_outreach' where campaign_id=$1",[campaign]);
 // Synthetic legal text deliberately has no Louisiana approval and is local-only.
 await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Fictional local admin')",[org,ids.admin]);
 await q("insert into outreach_campaign_admins(organization_id,user_id,capability,reason)values($1,$2,'manage','Fictional test only')",[org,ids.admin]);
 await q("update outreach_campaigns set status='approved' where id=$1",[campaign]);
 await role('authenticated',ids.admin);const config=JSON.parse(read('config/outreach/minden-family-fun-day.json'));
 await staff('configure',{...config.registration,revision:1,enabled:true});
 await role('anon');await deny(()=>q("select outreach_registration_config('minden-family-fun-day')"),'public family registration requires separately published waiver');
 await role('authenticated',ids.admin);const waiver=await staff('waiver_publish',{template_key:'synthetic_minden',version:1,title:'SYNTHETIC ONLY',text:'SYNTHETIC LOCAL TEST WAIVER — NOT APPROVED FOR ANY EVENT',effective_at:'2026-01-01T00:00:00Z',media_text:'SYNTHETIC MEDIA ONLY',media_required:true,media_initials_required:true});
 const attendees=[{client_key:uuid(),first_name:'Adult',last_name:'Synthetic',age:35,relationship:'self',guardian_relationship:'',attending:true},{client_key:uuid(),first_name:'Child',last_name:'Synthetic',age:8,relationship:'child',guardian_relationship:'Parent',attending:true}];
 const payload={request_key:uuid(),first_name:'Adult',last_name:'Synthetic',email:'family@example.invalid',phone:'15555550155',address_details:{street:'100 Fictional Street',line2:'',city:'Minden',state:'LA',postal:'71055'},emergency_phone:'15555550156',consents:{media:true,marketing:false,communications:false,ministry_followup:false},attendees,waiver:{request_key:uuid(),version_id:waiver.id,signer_name:'Adult Synthetic',signer_relationship:'parent',acknowledged:true,authority_acknowledged:true,covered_keys:attendees.map(a=>a.client_key),media_consent:true,media_initials:'AS'}};
 await role('service_role');const create=async p=>(await q('select outreach_registration_gateway($1,$2,$3) v',['minden-family-fun-day',p,'e'.repeat(64)])).rows[0].v;
 const receipt=await create(payload);check(receipt.accepted&&receipt.reference,'actual public gateway persists household with reference');check((await create(payload)).reference===receipt.reference,'same request replay does not duplicate household');
 await role('authenticated',ids.worker);let roster=await staff('list'),household=roster.registrations.find(x=>x.reference===receipt.reference),detail=await staff('detail',{registration_id:household.id});
 check(roster.summary.households===1&&roster.summary.adults===1&&roster.summary.minors===1&&roster.summary.attendees===2,'canonical roster counts adults children household accurately');
 check(detail.signatures.length===1&&detail.signatures[0].coverage_snapshot.length===2,'immutable waiver snapshot covers household');
 for(const attendee of detail.attendees)await staff('checkin',{registration_id:household.id,attendee_id:attendee.id});
 check((await staff('list')).summary.checked_in===2,'check-in reflected in canonical campaign totals');
 await staff('reverse',{registration_id:household.id,attendee_id:detail.attendees[0].id,reason:'Synthetic authorized correction'});check((await staff('list')).summary.checked_in===1,'partial reversal correct totals');
 await staff('reverse',{registration_id:household.id,attendee_id:detail.attendees[1].id,reason:'Synthetic authorized correction'});check((await staff('list')).summary.checked_in===0,'final reversal correct totals');
 const csv=(await staff('csv')).csv;check(csv.includes('Adult')&&csv.includes('Child')&&!csv.includes('SYNTHETIC LOCAL TEST WAIVER')&&!csv.includes('AS,'),'authorized scoped roster excludes legal signature payload');
 await role('postgres');check(JSON.stringify((await q("select to_jsonb(c) v from outreach_campaigns c where code='huntsville_al_2026'")).rows[0].v)===JSON.stringify(hunt),'Huntsville original campaign unchanged');check((await q('select count(*)::int n from organization_people')).rows[0].n===0,'no Person identity creation');
 if(process.env.TEST_MINDEN_BROWSER==='1'){const {publicJourney}=await import('./minden-public.browser.mjs');n+=await publicJourney(db);}
 console.log(n+' Minden canonical journey checks PASS; all identities, assignments and legal text synthetic/disposable');
}finally{await db.close()}
