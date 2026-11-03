// Full reviewed migration chain in disposable native PostgreSQL; no hosted connection.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID as uuid} from 'node:crypto';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {migrationOrder} from '../backend-tests/migration-order.mjs';
const db=await localPostgres(),q=(s,p=[])=>db.query(s,p),A=uuid(),B=uuid(),worker=uuid(),other=uuid(),unverified=uuid();let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++};
const actor=async(id=worker,role='authenticated')=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role)};
const create=(org,person,title='Requested operational next step',due=null)=>q('insert into public.followup_tasks(organization_id,person_id,title,due_on)values($1,$2,$3,$4) returning id',[org,person,title,due]);
const counts=async()=>{await db.exec('reset role');const r=(await q(`select (select count(*) from followup_tasks) tasks,(select count(*) from followup_task_events) audits,(select count(*) from tag_workflow_notifications) notifications,(select count(*) from outreach_campaign_events) campaign_events,(select count(*) from organization_people) people,(select count(*) from outreach_event_registrations) registrations,(select count(*) from outreach_event_attendees) attendees,(select count(*) from outreach_waiver_signatures) signatures,(select count(*) from course_enrollments) enrollments`)).rows[0];await actor();return r};

try{
 await db.exec(readFileSync(new URL('../backend-tests/fixtures/supabase-test-bootstrap.sql',import.meta.url),'utf8'));await db.exec(readFileSync(new URL('../../supabase/bootstrap/automatic-rls.sql',import.meta.url),'utf8'));for(const f of migrationOrder)await db.exec(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 await q("insert into organizations(id,slug,name,kind)values($1,'synthetic-followup-a','Synthetic Church','church'),($2,'synthetic-followup-b','Synthetic Other Church','church')",[A,B]);
 for(const id of[worker,other,unverified])await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,$3)',[id,id+'@example.test',id===unverified?null:new Date()]);
 for(const id of[worker,unverified])await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Synthetic worker')",[A,id]);
 for(const org of[A,B]){if(org===B)await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Synthetic worker')",[B,worker]);await q("insert into organization_staff_permissions(organization_id,user_id,permission) select $1,$2,unnest(array['people.read','people.create','followup.read','followup.manage'])",[org,worker])}
 await q("insert into organization_staff_permissions(organization_id,user_id,permission) select $1,$2,unnest(array['people.read','followup.read','followup.manage'])",[A,unverified]);
 await actor();const person=(await q("insert into organization_people(organization_id,first_name,last_name)values($1,'Morgan','Fixture')returning id",[A])).rows[0].id;
 const foreignPerson=(await q("insert into organization_people(organization_id,first_name,last_name)values($1,'Other','Fixture')returning id",[B])).rows[0].id;
 const id=(await create(A,person,'Guest requested welcome','2026-11-10')).rows[0].id;
 const update=(due,revision,org=A,p=person,task=id)=>q('update followup_tasks set due_on=$1 where organization_id=$2 and person_id=$3 and id=$4 and revision=$5 returning id',[due,org,p,task,revision]);
 const state=async()=>{await db.exec('reset role');const r=(await q("select to_jsonb(t) task,(select jsonb_agg(to_jsonb(e) order by occurred_at) from followup_task_events e where e.task_id=t.id) events from followup_tasks t where id=$1",[id])).rows[0];await actor();return r};
 const unchanged=async(fn,label,{id:who=worker,role='authenticated',throws=false}={})=>{const before=await state();await actor(who,role);if(throws){await assert.rejects(fn,e=>e.code==='42501');ok(true,label+' denied')}else{const r=await fn();ok(r.rows.length===0,label+' updates zero rows')}ok(JSON.stringify(await state())===JSON.stringify(before),label+' preserves exact task and audit')};
 const beforeCounts=await counts();ok((await update('2026-11-17',1)).rows.length===1,'current revision reschedules existing task');let saved=await state();ok(saved.task.due_on==='2026-11-17'&&saved.task.status==='open'&&saved.task.revision===2,'server preserves status and increments revision');ok(saved.events.length===2&&saved.events[1].action==='updated'&&saved.events[1].actor_user_id===worker,'one actor-bound update event');ok(saved.events[1].before_state.due_on==='2026-11-10'&&saved.events[1].after_state.due_on==='2026-11-17','audit records before/after date');
 await unchanged(()=>update('2026-11-20',1),'stale revision replay');
 ok((await update(null,2)).rows.length===1,'explicit null clears due date');saved=await state();ok(saved.task.due_on===null&&saved.task.revision===3&&saved.events[2].after_state.due_on===null,'clear persisted and audited');
 ok((await q("update followup_tasks set status='completed' where organization_id=$1 and person_id=$2 and id=$3 and revision=3 returning id",[A,person,id])).rows.length===1,'rescheduled and cleared task completes');saved=await state();ok(saved.task.status==='completed'&&saved.task.revision===4&&saved.task.due_on===null,'completion preserves cleared due date');
 const afterCounts=await counts();ok(afterCounts.tasks===beforeCounts.tasks&&afterCounts.audits===beforeCounts.audits+3,'three mutations add exactly three events, no extra task');ok(Object.keys(beforeCounts).filter(k=>k!=='audits').every(k=>beforeCounts[k]===afterCounts[k]),'no People/registration/waiver/course/notification side effects');
 await unchanged(()=>update('2027-01-01',4,B),'wrong organization');await unchanged(()=>update('2027-01-01',4,A,foreignPerson),'wrong person');await unchanged(()=>update('2027-01-01',4,A,person,uuid()),'unknown task');
 for(const key of['people.read','followup.read','followup.manage']){
  await db.exec('reset role');await q('update organization_staff_permissions set revoked_at=now() where organization_id=$1 and user_id=$2 and permission=$3',[A,worker,key]);await unchanged(()=>update('2027-01-01',4),'revoked '+key);await db.exec('reset role');await q('update organization_staff_permissions set revoked_at=null where organization_id=$1 and user_id=$2 and permission=$3',[A,worker,key]);
 }
 for(const [label,effective,expires]of[['expired','2020-01-01','2020-01-02'],['future','2099-01-01',null]]){
  await db.exec('reset role');await q("update organization_staff_permissions set effective_at=$3,expires_at=$4 where organization_id=$1 and user_id=$2 and permission='followup.manage'",[A,worker,effective,expires]);await unchanged(()=>update('2027-01-01',4),label+' grant');
 }
 await db.exec('reset role');await q("update organization_staff_permissions set effective_at=now(),expires_at=null where organization_id=$1 and user_id=$2 and permission='followup.manage'",[A,worker]);await q('update organization_staff_directory set active=false where organization_id=$1 and user_id=$2',[A,worker]);await unchanged(()=>update('2027-01-01',4),'inactive staff');await db.exec('reset role');await q('update organization_staff_directory set active=true where organization_id=$1 and user_id=$2',[A,worker]);
 // Existing grant allows only organization-wide task management.
 await q("update organization_staff_permissions set department_ids=array[$3::uuid] where organization_id=$1 and user_id=$2 and permission='followup.manage'",[A,worker,uuid()]);await unchanged(()=>update('2027-01-01',4),'department-scoped grant');await db.exec('reset role');await q("update organization_staff_permissions set department_ids=null where organization_id=$1 and user_id=$2 and permission='followup.manage'",[A,worker]);
 await unchanged(()=>update('2027-01-01',4),'other account',{id:other});await unchanged(()=>update('2027-01-01',4),'unverified actor',{id:unverified});await unchanged(()=>update('2027-01-01',4),'anonymous actor',{id:null,role:'anon',throws:true});
 // Staff cannot change authoritative identity/revision or rewrite event history.
 for(const [field,value]of[['organization_id',B],['person_id',foreignPerson],['created_by',other],['revision',99],['workflow_run_id',uuid()]])await unchanged(()=>q('update followup_tasks set '+field+'=$1 where id=$2 returning id',[value,id]),'forged '+field,{throws:true});
 const prior=await state();await assert.rejects(()=>update('2026-02-30',4),e=>e.code==='22008');ok(true,'invalid calendar date denied');ok(JSON.stringify(await state())===JSON.stringify(prior),'invalid date leaves task/audit intact');await unchanged(()=>q("update followup_task_events set action='created' where task_id=$1 returning id",[id]),'audit rewrite',{throws:true});
 // Two genuine PostgreSQL connections compete for the same expected revision.
 const concurrentTask=(await create(A,person,'Concurrent follow-up','2026-11-10')).rows[0].id,second=await db.connect();
 await second.query("select set_config('request.jwt.claim.sub',$1,false)",[worker]);await second.query('set role authenticated');
 const sql='update followup_tasks set due_on=$1 where organization_id=$2 and person_id=$3 and id=$4 and revision=1 returning id';
 const races=await Promise.all([q(sql,['2026-11-11',A,person,concurrentTask]),second.query(sql,['2026-11-12',A,person,concurrentTask])]);ok(races.map(r=>r.rowCount).sort().join(',')==='0,1','two concurrent writers yield one winner');
 const raceTask=(await q('select revision,due_on from followup_tasks where id=$1',[concurrentTask])).rows[0];ok(raceTask.revision===2,'concurrent expected revision increments once');ok((await q('select count(*) n from followup_task_events where task_id=$1',[concurrentTask])).rows[0].n===2,'concurrent loser appends no extra audit');
 // Finance-linked tasks remain inaccessible to ordinary follow-up staff.
 await db.exec('reset role');await q("insert into outreach_partner_intakes(organization_id,source_site,source_path,raw_submission,email_normalized,phone_normalized,commitment_amount,commitment_frequency,request_key,payload_hash,person_id,followup_task_id)values($1,'champion_life','/synthetic','{}','synthetic@example.test','5550100000',1,'Monthly',$2,'synthetic',$3,$4)",[A,uuid(),person,id]);
 await unchanged(()=>update('2027-01-01',4),'finance-linked task without finance.read');await actor();ok((await q('select id from followup_tasks where id=$1',[id])).rows.length===0,'financial task hidden from read');ok((await q('select id from followup_task_events where task_id=$1',[id])).rows.length===0,'financial task audit hidden from read');
 console.log(`${checks} native Church guest follow-up reschedule assertions PASS`);
}finally{await db.close()}
