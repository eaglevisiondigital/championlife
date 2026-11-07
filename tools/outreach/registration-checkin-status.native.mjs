// Existing registration RPC status authority in disposable native PostgreSQL; synthetic records only.
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
 await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,active,reason)values($1,$2,'local_leader',array['view','registration.view','checkin.manage'],true,'Synthetic fixture')",[A,worker]);
 await actor(admin);await staff('configure',{revision:0,public_slug:'synthetic-roster-a',enabled:true,waiver_required:true,prize_choices:[{id:'bike',label:'Bicycle'}]});
 const version=(await staff('waiver_publish',{template_key:'synthetic-only',version:1,effective_at:'2026-01-01T00:00:00Z',text:'SYNTHETIC TEST WAIVER. Not approved for real events.'})).id;
 const members=[{client_key:uuid(),first_name:'Morgan',last_name:'Fixture',age:38,relationship:'self',guardian_relationship:'',attending:true,prize_participation:false,prize_choice:null,answers:{}},{client_key:uuid(),first_name:'Alex',last_name:'Fixture',age:9,relationship:'child',guardian_relationship:'Parent',attending:true,prize_participation:true,prize_choice:'bike',answers:{}}];
 await staff('walkup',{request_key:uuid(),first_name:'Morgan',last_name:'Fixture',email:'fixture@example.test',phone:'+15555550100',attendees:members,consents:{ministry_followup:false,communications:false,marketing:false,media:false},waiver:{request_key:uuid(),version_id:version,signer_name:'Morgan Fixture',signer_relationship:'parent',acknowledged:true,authority_acknowledged:true,covered_keys:members.map(m=>m.client_key)}});
 await actor(worker);const full=await staff('detail',{registration_id:(await staff('list')).registrations[0].id}),member=full.attendees[0];
 const snapshot=async()=>{await db.exec('reset role');const state=(await q("select jsonb_build_object('household',(select to_jsonb(r) from outreach_event_registrations r where id=$1),'attendee',(select to_jsonb(a) from outreach_event_attendees a where id=$2),'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from outreach_campaign_audit a where campaign_id=$3),'events',(select coalesce(jsonb_agg(to_jsonb(e) order by id),'[]') from outreach_campaign_events e where campaign_id=$3)) v",[full.id,member.id,A])).rows[0].v;await actor(worker);return state};
 const setStatus=async status=>{await db.exec('reset role');await q('update outreach_event_registrations set status=$1 where id=$2',[status,full.id]);await actor(worker)};
 for(const status of ['cancelled','no_show','closed']){
  await setStatus(status);const before=await snapshot();
  await assert.rejects(()=>staff('checkin',{registration_id:full.id,attendee_id:member.id}),/Active attendee and valid waiver coverage required/);ok(true,status+' backend rejects retained or forged check-in');
  const after=await snapshot();ok(JSON.stringify(after.household)===JSON.stringify(before.household),status+' household unchanged');ok(JSON.stringify(after.attendee)===JSON.stringify(before.attendee),status+' attendee unchanged');ok(JSON.stringify(after.audit)===JSON.stringify(before.audit),status+' no success audit');ok(JSON.stringify(after.events)===JSON.stringify(before.events),status+' no success event');
 }
 for(const status of ['submitted','confirmed','checked_in']){
  await setStatus(status);const before=await snapshot();const result=await staff('checkin',{registration_id:full.id,attendee_id:member.id,wristband:'synthetic-band'});ok(result.saved===true,status+' authorized check-in succeeds');const after=await snapshot();ok(after.attendee.checked_in_at!==null&&after.household.status==='checked_in',status+' state committed');ok(after.audit.length===before.audit.length+1,status+' exactly one audit');ok(after.events.length===before.events.length+1,status+' exactly one event');
  await staff('reverse',{registration_id:full.id,attendee_id:member.id,reason:'Synthetic test restoration only'});
 }
 const beforeCross=await snapshot();await assert.rejects(()=>staff('checkin',{registration_id:full.id,attendee_id:member.id},B),e=>e.code==='42501');ok(true,'other campaign denied');ok(JSON.stringify(await snapshot())===JSON.stringify(beforeCross),'cross-campaign denial preserves records/audits');
 await db.exec('reset role');await q("update outreach_campaign_assignments set capabilities=array['view','registration.view'] where campaign_id=$1 and user_id=$2",[A,worker]);await actor(worker);const beforeRevoked=await snapshot();await assert.rejects(()=>staff('checkin',{registration_id:full.id,attendee_id:member.id}),e=>e.code==='42501');ok(true,'revoked check-in capability denied');ok(JSON.stringify(await snapshot())===JSON.stringify(beforeRevoked),'revocation denial preserves records/audits');
 console.log(JSON.stringify({status:'PASS',checks,hosted:false}));
}finally{await db.close()}
