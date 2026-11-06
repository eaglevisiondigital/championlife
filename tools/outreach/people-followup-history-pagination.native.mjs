// Existing schema/RLS only, disposable Unix-socket PostgreSQL. No migration edits.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID as uuid} from 'node:crypto';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {migrationOrder} from '../backend-tests/migration-order.mjs';
const db=await localPostgres(),q=(s,p=[])=>db.query(s,p),A=uuid(),B=uuid(),worker=uuid(),reader=uuid(),other=uuid();let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
const actor=async(id=reader,role='authenticated')=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role)};
const history=(org,task,cursor=null)=>q(`select id,organization_id,task_id,occurred_at,action,before_state->>'status' before_status,after_state->>'status' after_status,before_state->>'due_on' before_due,after_state->>'due_on' after_due,before_state->'revision' before_revision,after_state->'revision' after_revision from public.followup_task_events where organization_id=$1 and task_id=$2 and ($3::timestamptz is null or occurred_at<$3 or (occurred_at=$3 and id<$4::uuid)) order by occurred_at desc,id desc limit 51`,[org,task,cursor?.occurred_at||null,cursor?.id||null]);
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
 await actor(worker);await db.exec('begin');for(let n=0;n<122;n++)await q("update followup_tasks set due_on=$2 where id=$1",[task,n%2?'2026-11-18':'2026-11-19']);await db.exec('commit');
 const before=await snapshot();await actor();
 const first=(await history(A,task)).rows;eq(first.length,51,'read-only reader gets bounded51 audit lookahead');
 const cursor=async row=>({id:row.id,occurred_at:(await q('select occurred_at::text stamp from followup_task_events where id=$1',[row.id])).rows[0].stamp});
 const second=(await history(A,task,await cursor(first[49]))).rows,third=(await history(A,task,await cursor(second[49]))).rows;
 eq(second.length,51,'secondpage bounded51');eq(third.length,25,'lastpage25');
 const all=[...first.slice(0,50),...second.slice(0,50),...third];eq(new Set(all.map(r=>r.id)).size,125,'all125 audit events reached without duplication');
 eq(all.map(r=>r.id),(await q('select id from followup_task_events where organization_id=$1 and task_id=$2 order by occurred_at desc,id desc',[A,task])).rows.map(r=>r.id),'exact SQL ordering preserved across tied timestamps');
 eq((await history(A,task,await cursor(third.at(-1)))).rowCount,0,'oldestcursor returns empty');
 eq(JSON.stringify(all).includes('PRIVATE_TITLE'),false,'private historical task title not projected');
 eq((await history(B,foreignTask,await cursor(first[49]))).rowCount,0,'crossorganization cursor cannot grant read');
 eq((await history(A,financial,await cursor(first[49]))).rowCount,0,'financial history stays restricted');
 eq((await bound(A,foreignPerson,task)).rowCount,0,'wrongcanonicalPerson binding denied');
 for(const permission of['people.read','followup.read']){
  await db.exec('reset role');await q('update organization_staff_permissions set revoked_at=now() where organization_id=$1 and user_id=$2 and permission=$3',[A,reader,permission]);await actor();eq((await history(A,task,{occurred_at:first[49].occurred_at,id:first[49].id})).rowCount,0,'revoked '+permission+' denies olderhistory');await db.exec('reset role');await q('update organization_staff_permissions set revoked_at=null where organization_id=$1 and user_id=$2 and permission=$3',[A,reader,permission]);
 }
 await actor(other);eq((await history(A,task,{occurred_at:first[49].occurred_at,id:first[49].id})).rowCount,0,'otheraccount cannot reuse cursor');
 await actor(null,'anon');await assert.rejects(()=>history(A,task),e=>e.code==='42501');eq(true,true,'anonymous history still denied');
 eq(await snapshot(),before,'pagination and negative tests leave exact tasks/events/intakes unchanged');
 console.log(JSON.stringify({status:'PASS',checks,native:true,sqlChanged:false,hosted:false}));
}finally{await db.close()}
