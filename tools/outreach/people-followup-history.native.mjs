// Existing schema/RLS only, disposable Unix-socket PostgreSQL. No migration edits.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID as uuid} from 'node:crypto';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {migrationOrder} from '../backend-tests/migration-order.mjs';
const db=await localPostgres(),q=(s,p=[])=>db.query(s,p),A=uuid(),B=uuid(),worker=uuid(),reader=uuid(),other=uuid();let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
const actor=async(id=reader,role='authenticated')=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role)};
const history=(org,task)=>q(`select id,organization_id,task_id,occurred_at,action,before_state->>'status' before_status,after_state->>'status' after_status,before_state->>'due_on' before_due,after_state->>'due_on' after_due,before_state->'revision' before_revision,after_state->'revision' after_revision from public.followup_task_events where organization_id=$1 and task_id=$2 order by occurred_at desc,id desc limit 51`,[org,task]);
const bound=(org,person,task)=>q('select id from public.followup_tasks where organization_id=$1 and person_id=$2 and id=$3',[org,person,task]);
try{
 await db.exec(readFileSync(new URL('../backend-tests/fixtures/supabase-test-bootstrap.sql',import.meta.url),'utf8'));await db.exec(readFileSync(new URL('../../supabase/bootstrap/automatic-rls.sql',import.meta.url),'utf8'));for(const file of migrationOrder)await db.exec(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 await q("insert into organizations(id,slug,name,kind)values($1,'history-a','Fictional A','church'),($2,'history-b','Fictional B','church')",[A,B]);
 for(const id of[worker,reader,other])await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[id,id+'@example.test']);
 for(const org of[A,B]){
  await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Fictional author')",[org,worker]);
  await q("insert into organization_staff_permissions(organization_id,user_id,permission)select $1,$2,unnest(array['people.read','people.create','followup.read','followup.manage'])",[org,worker]);
 }
 await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Fictional reader')",[A,reader]);
 await q("insert into organization_staff_permissions(organization_id,user_id,permission)select $1,$2,unnest(array['people.read','followup.read'])",[A,reader]);
 await actor(worker);
 const person=(await q("insert into organization_people(organization_id,first_name,last_name)values($1,'Fictional','Person')returning id",[A])).rows[0].id;
 const foreignPerson=(await q("insert into organization_people(organization_id,first_name,last_name)values($1,'Foreign','Person')returning id",[B])).rows[0].id;
 const task=(await q("insert into followup_tasks(organization_id,person_id,title,due_on)values($1,$2,'PRIVATE_TITLE','2026-11-10')returning id",[A,person])).rows[0].id;
 const foreignTask=(await q("insert into followup_tasks(organization_id,person_id,title)values($1,$2,'Foreign')returning id",[B,foreignPerson])).rows[0].id;
 await q("update followup_tasks set due_on='2026-11-17' where id=$1",[task]);await q("update followup_tasks set status='completed',due_on=null where id=$1",[task]);
 const financial=(await q("insert into followup_tasks(organization_id,person_id,title)values($1,$2,'PRIVATE_FINANCIAL')returning id",[A,person])).rows[0].id;
 await db.exec('reset role');await q("insert into outreach_partner_intakes(organization_id,source_site,source_path,raw_submission,email_normalized,phone_normalized,commitment_amount,commitment_frequency,request_key,payload_hash,person_id,followup_task_id,status)values($1,'sowgo','/fictional','{}','fixture@example.test','15555550100',7,'Monthly',$2,'fictional',$3,$4,'linked')",[A,uuid(),person,financial]);
 const snapshot=async()=>{await db.exec('reset role');return (await q(`select (select jsonb_agg(to_jsonb(t) order by id) from followup_tasks t) tasks,(select jsonb_agg(to_jsonb(e) order by id) from followup_task_events e) events,(select jsonb_agg(to_jsonb(i) order by id) from outreach_partner_intakes i) intakes`)).rows[0]};
 const before=await snapshot();await actor();
 eq((await bound(A,person,task)).rows,[{id:task}],'read-only reader binds exact task/org/person');eq((await bound(A,foreignPerson,task)).rowCount,0,'wrong canonical Person binding denied');
 let rows=(await history(A,task)).rows;eq(rows.length,3,'three immutable events readable without management permission');
 const created=rows.find(r=>r.action==='created');eq([created.before_status,created.before_due,created.before_revision,created.after_status,created.after_due,created.after_revision],[null,null,null,'open','2026-11-10',1],'canonical created event shape');
 const rescheduled=rows.find(r=>r.after_revision===2);eq([rescheduled.before_due,rescheduled.after_due],['2026-11-10','2026-11-17'],'canonical rescheduled date history');
 const completed=rows.find(r=>r.after_revision===3);eq([completed.before_status,completed.after_status,completed.before_due,completed.after_due],['open','completed','2026-11-17',null],'canonical completion and date removal');
 eq(JSON.stringify(rows).includes('PRIVATE_TITLE'),false,'projection omits historical private title');eq(Object.keys(rows[0]).sort(),['id','organization_id','task_id','occurred_at','action','before_status','after_status','before_due','after_due','before_revision','after_revision'].sort(),'no actor/assignment/raw JSON projection');
 eq((await history(B,foreignTask)).rowCount,0,'cross organization event denied');eq((await history(B,task)).rowCount,0,'mismatched organization/task returns none');
 eq((await bound(A,person,financial)).rowCount,0,'financial task binding denied without finance permission');eq((await history(A,financial)).rowCount,0,'financial event denied by unchanged restrictive policy');
 await db.exec('reset role');await q("insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,'finance.read')",[A,reader]);await actor();eq((await history(A,financial)).rowCount,1,'independent finance permission permits existing financial event');await db.exec('reset role');await q("delete from organization_staff_permissions where organization_id=$1 and user_id=$2 and permission='finance.read'",[A,reader]);
 for(const permission of['people.read','followup.read']){
  await q('update organization_staff_permissions set revoked_at=now() where organization_id=$1 and user_id=$2 and permission=$3',[A,reader,permission]);await actor();eq((await history(A,task)).rowCount,0,'revoked '+permission+' denies event read');await db.exec('reset role');await q('update organization_staff_permissions set revoked_at=null where organization_id=$1 and user_id=$2 and permission=$3',[A,reader,permission]);
 }
 await q("update organization_staff_permissions set expires_at='2020-01-01',effective_at='2019-01-01' where organization_id=$1 and user_id=$2 and permission='followup.read'",[A,reader]);await actor();eq((await history(A,task)).rowCount,0,'expired read permission denies events');await db.exec('reset role');await q("update organization_staff_permissions set expires_at=null,effective_at=now() where organization_id=$1 and user_id=$2 and permission='followup.read'",[A,reader]);
 await actor(other);eq((await history(A,task)).rowCount,0,'unassigned account cannot read history');await actor(null,'anon');await assert.rejects(()=>history(A,task),e=>e.code==='42501');eq(true,true,'anonymous event read rejected');
 await actor();await assert.rejects(()=>q("update followup_task_events set action='created' where task_id=$1",[task]),e=>e.code==='42501');eq(true,true,'reader cannot rewrite audit');await assert.rejects(()=>q('delete from followup_task_events where task_id=$1',[task]),e=>e.code==='42501');eq(true,true,'reader cannot delete audit');
 eq(await snapshot(),before,'read/denial tests leave tasks, events and financial intake byte-equivalent');
 console.log(JSON.stringify({status:'PASS',checks,native:true,sqlChanged:false,hosted:false}));
}finally{await db.close()}
