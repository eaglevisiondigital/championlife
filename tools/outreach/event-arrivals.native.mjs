// Existing installed registration RPC; disposable Unix-socket PostgreSQL, fictional data only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID as uuid} from 'node:crypto';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {migrationOrder} from '../backend-tests/migration-order.mjs';
const db=await localPostgres(),q=(s,p=[])=>db.query(s,p),admin=uuid(),worker=uuid(),other=uuid(),A=uuid(),B=uuid();let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++};
const actor=async id=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')};
const staff=(action,p={},campaign=A)=>q('select outreach_registration_workspace($1,$2,$3) v',[action,campaign,p]).then(r=>r.rows[0].v);
try{
 await db.exec(readFileSync(new URL('../backend-tests/fixtures/supabase-test-bootstrap.sql',import.meta.url),'utf8'));await db.exec(readFileSync(new URL('../../supabase/bootstrap/automatic-rls.sql',import.meta.url),'utf8'));for(const f of migrationOrder)await db.exec(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));

 const org=(await q("select organization_id from outreach_campaigns where code='huntsville_al_2026'")).rows[0].organization_id;
 for(const id of[admin,worker,other])await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[id,id+'@example.test']);
 await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Synthetic administrator')",[org,admin]);await q("insert into outreach_campaign_admins(organization_id,user_id,capability,reason)values($1,$2,'manage','Synthetic fixture')",[org,admin]);await q("insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,'staff.manage')",[org,admin]);
 for(const[id,code]of[[A,'synthetic_roster_a'],[B,'synthetic_roster_b']])await q("insert into outreach_campaigns(id,organization_id,code,name,city,country,timezone,status)values($1,$2,$3,$3,'Test','US','UTC','approved')",[id,org,code]);
 await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,active,reason)values($1,$2,'local_leader',array['view','registration.view','registration.manage','checkin.manage'],true,'Synthetic fixture')",[A,worker]);
 await actor(admin);await staff('configure',{revision:0,public_slug:'synthetic-roster-a',enabled:true,waiver_required:true,prize_choices:[{id:'bike',label:'Bicycle'}]});
 const version=(await staff('waiver_publish',{template_key:'synthetic-only',version:1,effective_at:'2026-01-01T00:00:00Z',text:'SYNTHETIC TEST WAIVER. Not approved for real events.'})).id;
 const members=[{client_key:uuid(),first_name:'Morgan',last_name:'Fixture',age:38,relationship:'self',guardian_relationship:'',attending:true,prize_participation:false,prize_choice:null,answers:{}},{client_key:uuid(),first_name:'Alex',last_name:'Fixture',age:9,relationship:'child',guardian_relationship:'Parent',attending:true,prize_participation:true,prize_choice:'bike',answers:{}}];
 await staff('walkup',{request_key:uuid(),first_name:'Morgan',last_name:'Fixture',email:'fixture@example.test',phone:'+15555550100',attendees:members,consents:{ministry_followup:false,communications:false,marketing:false,media:false},waiver:{request_key:uuid(),version_id:version,signer_name:'Morgan Fixture',signer_relationship:'parent',acknowledged:true,authority_acknowledged:true,covered_keys:members.map(m=>m.client_key)}});


 await actor(worker);const initial=await staff('list'),id=initial.registrations[0].id;
 const detail=()=>staff('detail',{registration_id:id}),denied=async(fn,code,label)=>{await assert.rejects(fn,e=>e.code===code);ok(true,label)};
 let full=await detail();const child=full.attendees.find(a=>a.age===9),adult=full.attendees.find(a=>a.age===38),signature=JSON.stringify(full.signatures);
 for(const[key,value]of Object.entries({households:1,attendees:2,adults:1,minors:1,waivers_complete:2,waivers_missing:0,checked_in:0,not_checked_in:2}))ok(initial.summary[key]===value,'canonical summary '+key);
 const miss=await staff('list',{search:'does-not-exist'});ok(miss.registrations.length===0,'search filters registration list');ok(JSON.stringify(miss.summary)===JSON.stringify(initial.summary),'search does not change campaign totals');
 ok(full.attendees.every(a=>a.active&&a.attending&&a.waiver_covered),'attendee readiness is authoritative detail');
 await staff('checkin',{registration_id:id,attendee_id:child.id,wristband:'SYNTHETIC'});full=await detail();
 ok(full.attendees.find(a=>a.id===child.id).checked_in_at!==null,'existing check-in persists');
 const checked=await staff('list');ok(checked.summary.checked_in===1&&checked.summary.checked_in_minors===1,'minor check-in totals fresh');ok(checked.summary.not_checked_in===1,'pending total decreases');
 ok(JSON.stringify(full.signatures)===signature,'check-in preserves signed snapshot');
 await db.exec('reset role');const auditCount=(await q("select count(*) n from outreach_campaign_audit where campaign_id=$1 and kind='attendee.checked_in'",[A])).rows[0].n;await actor(worker);
 const duplicate=await staff('checkin',{registration_id:id,attendee_id:child.id});ok(duplicate.already_checked_in,'duplicate check-in idempotent');
 await db.exec('reset role');ok((await q("select count(*) n from outreach_campaign_audit where campaign_id=$1 and kind='attendee.checked_in'",[A])).rows[0].n===auditCount,'duplicate does not duplicate audit');await actor(worker);
 await denied(()=>staff('reverse',{registration_id:id,attendee_id:child.id,reason:'short'}),'P0001','correction requires meaningful reason');
 await staff('reverse',{registration_id:id,attendee_id:child.id,reason:'Synthetic wrong arrival correction'});
 ok((await staff('list')).summary.checked_in===0,'reversal clears current attendance');ok((await staff('list')).summary.not_checked_in===2,'reversal returns attendee to pending queue');
 await staff('waiver_correct',{registration_id:id,signature_id:full.signatures[0].id,reason:'Synthetic waiver evidence corrected'});
 full=await detail();ok(full.attendees.every(a=>!a.waiver_covered),'corrected waiver not treated as consent');ok((await staff('list')).summary.waivers_missing===2,'missing coverage count tracks corrected waiver');
 await denied(()=>staff('checkin',{registration_id:id,attendee_id:child.id}),'P0001','uncovered minor denied');
 await denied(()=>staff('detail',{registration_id:id},B),'42501','cross-campaign detail denied');
 await denied(()=>staff('list',{},B),'42501','cross-campaign list denied');
 await denied(()=>staff('csv'),'42501','no export inherited from check-in');
 await db.exec('reset role');await q("update outreach_campaign_assignments set capabilities=array['view','registration.view'] where campaign_id=$1 and user_id=$2",[A,worker]);await actor(worker);
 ok((await staff('list')).registrations.length===1,'view-only may inspect assigned campaign');
 await denied(()=>staff('checkin',{registration_id:id,attendee_id:adult.id}),'42501','view-only cannot check in');await denied(()=>staff('reverse',{registration_id:id,attendee_id:child.id,reason:'Synthetic view-only attempt'}),'42501','view-only cannot reverse');
 await db.exec('reset role');await q('update outreach_campaign_assignments set active=false where campaign_id=$1 and user_id=$2',[A,worker]);await actor(worker);
 for(const action of ['context','list','detail'])await denied(()=>staff(action,{registration_id:id}),'42501','revocation denies '+action);
 await actor(other);await denied(()=>staff('list'),'42501','unassigned account denied');
 await db.exec('reset role');await q('update auth.users set email_confirmed_at=null where id=$1',[worker]);await q('update outreach_campaign_assignments set active=true where campaign_id=$1 and user_id=$2',[A,worker]);await actor(worker);await denied(()=>staff('list'),'42501','unverified worker denied');
 await db.exec('reset role');await q("select set_config('request.jwt.claim.sub','',false)");await db.exec('set role anon');await denied(()=>staff('list'),'42501','anonymous denied');
 await db.exec('reset role');await db.exec('begin');await q("update outreach_event_registrations set status='closed' where id=$1",[id]);await actor(admin);
 ok((await staff('list')).summary.attendees===0,'closed household excluded from totals');ok((await staff('list')).registrations.some(r=>r.id===id&&r.status==='closed'),'list preserves historical closed row for client exclusion');
 await denied(()=>staff('checkin',{registration_id:id,attendee_id:adult.id}),'P0001','closed record cannot check in');await db.exec('reset role');await db.exec('rollback');
 await actor(admin);full=await detail();ok(full.attendees.length===2,'no duplicate attendee or household identity');ok(full.signatures.length===1,'immutable signature retained');
 await db.exec('reset role');const records=(await q("select kind,actor_user_id,subject_id from outreach_campaign_audit where campaign_id=$1 and kind in ('attendee.checked_in','attendee.checkin_reversed')",[A])).rows;
 ok(records.length===2&&records.every(r=>r.actor_user_id===worker&&r.subject_id===child.id),'exact attributed check-in/reversal audits only');
 console.log(`${checks} Event Day arrival native PostgreSQL assertions PASS`);
}finally{await db.close()}
