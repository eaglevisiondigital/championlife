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

 const baselineDefinition=(await q("select pg_get_functiondef('private.outreach_registration_workspace(text,uuid,jsonb)'::regprocedure) d")).rows[0].d;
 const aclBefore=JSON.stringify((await q("select proowner,proacl,prosecdef,proconfig from pg_proc where oid='private.outreach_registration_workspace(text,uuid,jsonb)'::regprocedure")).rows);
 await db.exec(readFileSync(new URL('../../supabase/migrations/20261103193001_church_operations_restore_capacity.sql',import.meta.url),'utf8'));
 ok(JSON.stringify((await q("select proowner,proacl,prosecdef,proconfig from pg_proc where oid='private.outreach_registration_workspace(text,uuid,jsonb)'::regprocedure")).rows)===aclBefore,'migration preserves owner, ACL, security-definer and search path');
 const org=(await q("select organization_id from outreach_campaigns where code='huntsville_al_2026'")).rows[0].organization_id;
 for(const id of[admin,worker,other])await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[id,id+'@example.test']);
 await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Synthetic administrator')",[org,admin]);await q("insert into outreach_campaign_admins(organization_id,user_id,capability,reason)values($1,$2,'manage','Synthetic fixture')",[org,admin]);await q("insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,'staff.manage')",[org,admin]);
 for(const[id,code]of[[A,'synthetic_roster_a'],[B,'synthetic_roster_b']])await q("insert into outreach_campaigns(id,organization_id,code,name,city,country,timezone,status)values($1,$2,$3,$3,'Test','US','UTC','approved')",[id,org,code]);
 await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,active,reason)values($1,$2,'local_leader',array['view','registration.view','registration.manage','checkin.manage'],true,'Synthetic fixture')",[A,worker]);
 await actor(admin);await staff('configure',{revision:0,public_slug:'synthetic-roster-a',enabled:true,waiver_required:true,prize_choices:[{id:'bike',label:'Bicycle'}]});
 const version=(await staff('waiver_publish',{template_key:'synthetic-only',version:1,effective_at:'2026-01-01T00:00:00Z',text:'SYNTHETIC TEST WAIVER. Not approved for real events.'})).id;
 const members=[{client_key:uuid(),first_name:'Morgan',last_name:'Fixture',age:38,relationship:'self',guardian_relationship:'',attending:true,prize_participation:false,prize_choice:null,answers:{}},{client_key:uuid(),first_name:'Alex',last_name:'Fixture',age:9,relationship:'child',guardian_relationship:'Parent',attending:true,prize_participation:true,prize_choice:'bike',answers:{}}];
 await staff('walkup',{request_key:uuid(),first_name:'Morgan',last_name:'Fixture',email:'fixture@example.test',phone:'+15555550100',attendees:members,consents:{ministry_followup:false,communications:false,marketing:false,media:false},waiver:{request_key:uuid(),version_id:version,signer_name:'Morgan Fixture',signer_relationship:'parent',acknowledged:true,authority_acknowledged:true,covered_keys:members.map(m=>m.client_key)}});

 await actor(worker);let full=await staff('detail',{registration_id:(await staff('list')).registrations[0].id});
 const id=full.id, child=full.attendees.find(a=>a.age===9), original=structuredClone(child),signatures=JSON.stringify(full.signatures);
 const detail=()=>staff('detail',{registration_id:id});
 const change=(a,active)=>staff('attendee_update',{registration_id:id,attendee_id:a.id,revision:a.revision,active});
 const denied=async(fn,code,label)=>{await assert.rejects(fn,e=>e.code===code);ok(true,label)};
 await change(child,false);full=await detail();let removed=full.attendees.find(a=>a.id===child.id);
 ok(!removed.active&&removed.revision===child.revision+1,'remove retains attendee with revision');
 ok((await staff('list')).summary.minors===0,'removed child excluded from totals');
 ok(!removed.waiver_covered,'inactive attendee has no current waiver coverage');
 ok(JSON.stringify(full.signatures)===signatures,'removal leaves signature snapshot untouched');
 await change(removed,true);full=await detail();let restored=full.attendees.find(a=>a.id===child.id);
 ok(restored.active&&restored.revision===removed.revision+1,'explicit restore reuses row and advances revision');
 for(const key of ['id','client_key','age','relationship','guardian_relationship','attending','notes','checked_in_at','checked_in_by','wristband','prize_choice','prize_participation'])ok(restored[key]===original[key],'restore preserves '+key);
 ok(restored.waiver_covered,'unchanged original signature qualifies again through existing coverage helper');
 ok(!restored.present_to_win&&restored.checked_in_at===null,'restore fabricates neither check-in nor prize eligibility');
 ok((await staff('list')).summary.minors===1,'restored attending child included in fresh totals');
 ok(JSON.stringify(full.signatures)===signatures,'restore preserves complete immutable signature snapshot');
 await db.exec('reset role');const audits=(await q("select kind,actor_user_id,subject_id from outreach_campaign_audit where campaign_id=$1 and kind in ('attendee.removed','attendee.updated') order by created_at",[A])).rows;
 ok(audits.some(a=>a.kind==='attendee.removed'&&a.actor_user_id===worker&&a.subject_id===child.id),'removal audit preserved');ok(audits.some(a=>a.kind==='attendee.updated'&&a.actor_user_id===worker&&a.subject_id===child.id),'restore uses existing actor-bound attendee.updated audit');await actor(worker);
 await denied(()=>change(removed,true),'P0001','stale restoration revision denied');
 await denied(()=>staff('attendee_update',{registration_id:id,attendee_id:child.id,revision:restored.revision,active:true},B),'42501','other campaign denied');
 await actor(other);await denied(()=>change(restored,false),'42501','unassigned account denied');
 await db.exec('reset role');await q("update outreach_campaign_assignments set capabilities=array['view','registration.view'] where campaign_id=$1 and user_id=$2",[A,worker]);await actor(worker);
 await denied(()=>change(restored,false),'42501','view-only cannot change active flag');
 await db.exec('reset role');await q("update outreach_campaign_assignments set capabilities=array['view','registration.view','registration.manage','checkin.manage'] where campaign_id=$1 and user_id=$2",[A,worker]);await actor(worker);
 // An existing not-attending choice is never silently changed by restoration.
 await staff('attendee_update',{registration_id:id,attendee_id:child.id,revision:restored.revision,active:false,attending:false});removed=(await detail()).attendees.find(a=>a.id===child.id);await change(removed,true);restored=(await detail()).attendees.find(a=>a.id===child.id);
 ok(restored.active&&!restored.attending,'restore preserves explicit not-attending choice');ok((await staff('list')).summary.minors===0,'not-attending restoration does not inflate attendance');
 await staff('attendee_update',{registration_id:id,attendee_id:child.id,revision:restored.revision,attending:true});restored=(await detail()).attendees.find(a=>a.id===child.id);
 // Restoring a corrected signature does not manufacture legal coverage.
 await change(restored,false);await staff('waiver_correct',{registration_id:id,signature_id:full.signatures[0].id,reason:'Synthetic signature correction for regression'});removed=(await detail()).attendees.find(a=>a.id===child.id);await change(removed,true);restored=(await detail()).attendees.find(a=>a.id===child.id);
 ok(!restored.waiver_covered,'corrected signature remains invalid after restore');
 await denied(()=>staff('checkin',{registration_id:id,attendee_id:child.id}),'P0001','uncovered restored minor cannot check in');
 // Two operators restoring the same revision serialize; exactly one succeeds.
 await change(restored,false);removed=(await detail()).attendees.find(a=>a.id===child.id);
 const clients=await Promise.all([db.connect(),db.connect()]);for(const c of clients){await c.query("select set_config('request.jwt.claim.sub',$1,false)",[worker]);await c.query('set role authenticated')}
 await db.exec('reset role');await db.exec('begin');await q('select id from outreach_campaigns where id=$1 for update',[A]);
 const payload={registration_id:id,attendee_id:child.id,revision:removed.revision,active:true};
 const pending=clients.map(c=>c.query("select outreach_registration_workspace('attendee_update',$1,$2) v",[A,payload]).then(()=>({ok:true}),e=>({code:e.code})));
 async function blocked(n){for(let i=0;i<200;i++){const count=(await q("select count(*) n from pg_stat_activity where pid=any($1) and wait_event_type='Lock'",[clients.map(c=>c.processID)])).rows[0].n;if(count===n){ok(true,n+' independent transactions observed waiting for lock');return}await new Promise(r=>setTimeout(r,10))}throw Error('Expected lock wait not observed')}
 await blocked(2);await db.exec('commit');const outcomes=await Promise.all(pending);ok(outcomes.filter(x=>x.ok).length===1&&outcomes.filter(x=>x.code==='P0001').length===1,'one concurrent restore succeeds; stale loser rejected');
 await actor(worker);restored=(await detail()).attendees.find(a=>a.id===child.id);ok(restored.revision===removed.revision+1,'concurrency advances revision once');
 // Revocation while blocked is rechecked after campaign lock acquisition.
 await change(restored,false);removed=(await detail()).attendees.find(a=>a.id===child.id);await db.exec('reset role');await db.exec('begin');await q('select id from outreach_campaigns where id=$1 for update',[A]);
 const late=clients[0].query("select outreach_registration_workspace('attendee_update',$1,$2)",[A,{...payload,revision:removed.revision}]).then(()=>({ok:true}),e=>({code:e.code}));
 await blocked(1);await q('update outreach_campaign_assignments set active=false where campaign_id=$1 and user_id=$2',[A,worker]);await db.exec('commit');ok((await late).code==='42501','revocation during lock wait prevents restoration');
 const stored=(await q('select * from outreach_event_attendees where id=$1',[child.id])).rows[0];ok(!stored.active&&stored.revision===removed.revision,'revoked write leaves removed row untouched');
 const count=(await q('select count(*) n from outreach_event_attendees where registration_id=$1',[id])).rows[0].n;ok(count===2,'restoration never duplicates attendees');
 ok((await q('select count(*) n from outreach_waiver_signatures where registration_id=$1',[id])).rows[0].n===1,'restoration never creates signature');

 // Baseline defect, corrected limit and add/restore concurrency in this disposable database.
 await actor(admin);
 for(let i=0;i<29;i++)await staff('attendee_add',{registration_id:id,client_key:uuid(),first_name:'Capacity',last_name:'Fixture '+i,age:30,relationship:'other',guardian_relationship:'',attending:true,answers:{}});
 ok((await detail()).attendees.filter(a=>a.active).length===30,'fixture reaches existing household limit');
 await db.exec('reset role');await db.exec('begin');await db.exec(baselineDefinition);await actor(admin);await change(removed,true);
 ok((await detail()).attendees.filter(a=>a.active).length===31,'baseline defect independently reproduced: restore exceeds30');
 await db.exec('reset role');await db.exec('rollback');await actor(admin);
 await denied(()=>change(removed,true),'P0001','corrected RPC denies restore when30 are active');
 ok((await detail()).attendees.find(a=>a.id===child.id).revision===removed.revision,'capacity failure preserves attendee revision');
 const extra=(await detail()).attendees.find(a=>a.first_name==='Capacity');await change(extra,false);
 ok((await detail()).attendees.filter(a=>a.active).length===29,'one final place available');
 for(const c of clients){await c.query('reset role');await c.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await c.query('set role authenticated')}
 await db.exec('reset role');await db.exec('begin');await q('select id from outreach_campaigns where id=$1 for update',[A]);
 const competing=[clients[0].query("select outreach_registration_workspace('attendee_update',$1,$2)",[A,{...payload,revision:removed.revision}]),clients[1].query("select outreach_registration_workspace('attendee_add',$1,$2)",[A,{registration_id:id,client_key:uuid(),first_name:'Last',last_name:'Place',age:35,relationship:'other',guardian_relationship:'',attending:true,answers:{}}])].map(p=>p.then(()=>({ok:true}),e=>({code:e.code})));
 await blocked(2);await db.exec('commit');const results=await Promise.all(competing);
 ok(results.filter(x=>x.ok).length===1&&results.filter(x=>x.code==='P0001').length===1,'concurrent add/restore share final place; one denied');
 await actor(admin);full=await detail();ok(full.attendees.filter(a=>a.active).length===30,'concurrent add/restore never exceeds30');
 // Explicit transaction rollback restores both active state/revision and append-only history.
 const target=full.attendees.find(a=>!a.active),active=full.attendees.find(a=>a.active);await change(active,false);
 await db.exec('reset role');const beforeRollback=JSON.stringify((await q('select * from outreach_event_attendees where id=$1',[target.id])).rows),auditCount=(await q('select count(*) n from outreach_campaign_audit where campaign_id=$1',[A])).rows[0].n;
 await db.exec('begin');await actor(admin);await change(target,true);ok((await detail()).attendees.find(a=>a.id===target.id).active,'restoration visible within transaction');await db.exec('reset role');await db.exec('rollback');
 ok(JSON.stringify((await q('select * from outreach_event_attendees where id=$1',[target.id])).rows)===beforeRollback,'rollback restores complete original attendee');
 ok((await q('select count(*) n from outreach_campaign_audit where campaign_id=$1',[A])).rows[0].n===auditCount,'rollback leaves no spurious restore audit');
 console.log(`${checks} native attendee restoration assertions PASS`);
}finally{await db.close()}
