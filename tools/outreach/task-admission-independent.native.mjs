// Independently authored adversarial review of the disposable admission experiment.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createCampaignTaskFixture} from './campaign-task-fixture.mjs';
import {taskWriterOutcome} from './task-writer-outcome.mjs';
const f=await createCampaignTaskFixture();let checks=0;const records=[];
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;records.push(label)};
const deny=async(fn,code,label)=>{await assert.rejects(fn,e=>e.code===code,label);checks++;records.push(label)};
const snapshot=async()=>({canonical:await f.counts(),rows:(await f.q(`select
 (select count(*)::int from task_intent_fixture.executions) executions,
 (select count(*)::int from task_intent_fixture.receipts) receipts,
 (select count(*)::int from task_intent_fixture.settlements) settlements`)).rows[0]});
const fresh=async()=>{const task=randomUUID(),intent=randomUUID();await f.q("insert into followup_tasks(id,organization_id,person_id,title,assigned_user_id)values($1,$2,$3,'Outreach follow-up',$4)",[task,f.orgId,f.personId,f.users.worker.id]);await f.q("select task_intent_fixture.capture($1,$2,1,'completed',null)",[intent,task]);return{task,intent}};
const arm=x=>f.q('select task_intent_fixture.arm($1)',[x.intent]);
const mutate=x=>f.q("update followup_tasks set status='completed',due_on=null where id=$1",[x.task]);
try{
 await f.db.exec(readFileSync(new URL('./task-intent-fixture.sql',import.meta.url),'utf8'));
 await f.db.exec(readFileSync(new URL('./task-admission-proof.sql',import.meta.url),'utf8'));
 await f.setClaims(f.db,f.users.worker);
 eq((await f.q("select bool_and(not prosecdef) v from pg_proc where pronamespace='task_intent_fixture'::regnamespace")).rows[0].v,true,'all lab functions retain invoker authority');
 for(const role of ['worker','campaignOnly','peopleOnly','unverified']){
  await deny(()=>f.authenticatedQuery(role,'select task_intent_fixture.arm($1)',[randomUUID()]),'42501',role+' cannot execute lab admission');
  await deny(()=>f.authenticatedQuery(role,'select * from task_intent_fixture.settlements'),'42501',role+' cannot read lab settlements');
 }
 // Rejection in the same transaction as arming must prevent any event commit.
 {const x=await fresh(),before=await snapshot();await f.q('begin');await arm(x);await f.q('select task_intent_fixture.reject_admission($1)',[x.intent]);await deny(()=>mutate(x),'22023','same-transaction rejection cannot be followed by observed mutation');await f.q('rollback');eq(await snapshot(),before,'same-transaction failure rolls back every new row');}
 // A later failure in audit insertion unwinds the task, observation and receipt.
 await f.db.exec("create function task_intent_fixture.fail_audit() returns trigger language plpgsql as $$begin raise exception 'Independent injected audit failure' using errcode='P0001';end$$;create trigger zz_independent_fail after insert on followup_task_events for each row execute function task_intent_fixture.fail_audit()");
 // Create the task with the failure trigger temporarily disabled inside this lab.
 await f.q('alter table followup_task_events disable trigger zz_independent_fail');const failed=await fresh();await f.q('alter table followup_task_events enable trigger zz_independent_fail');
 const beforeFailure=await snapshot();await f.q('begin');await arm(failed);await deny(()=>mutate(failed),'P0001','downstream audit failure aborts mutation');await f.q('rollback');eq(await snapshot(),beforeFailure,'audit failure rolls back task/event/receipt/settlement');eq((await f.q('select revision from followup_tasks where id=$1',[failed.task])).rows[0].revision,1,'audit failure retains task revision');await f.q('drop trigger zz_independent_fail on followup_task_events');
 // An arm committed alone cannot attach a later transaction's event.
 {const x=await fresh();await arm(x);await mutate(x);eq((await f.q('select count(*)::int n from task_intent_fixture.receipts where intent_id=$1',[x.intent])).rows[0].n,0,'earlier transaction arm does not bind later event');eq((await f.q('select count(*)::int n from task_intent_fixture.settlements where intent_id=$1',[x.intent])).rows[0].n,0,'no terminal settlement for earlier arm');eq(taskWriterOutcome({state:'LAB_EVENT_OBSERVED'}),{state:'UNKNOWN',automaticRetry:false},'lab state cannot promote operational result');await deny(()=>arm(x),'40001','stale task revision fails after unobserved mutation');}
 // A current Auth session different from captured session is not interchangeable.
 {const x=await fresh(),second={...f.users.worker,sessionId:randomUUID()};await f.q("insert into auth.sessions(id,user_id,not_after)values($1,$2,clock_timestamp()+interval '1 hour')",[second.sessionId,second.id]);await f.setClaims(f.db,second);await deny(()=>arm(x),'22023','new same-user session cannot consume old admission');await f.setClaims(f.db,f.users.worker);}
 // Two independently authorized requests against one revision: one event only.
 {const x=await fresh(),other=randomUUID();await f.q("select task_intent_fixture.capture($1,$2,1,'canceled',null)",[other,x.task]);const a=await f.db.connect(),b=await f.db.connect();try{await f.setClaims(a,f.users.worker);await f.setClaims(b,f.users.worker);await a.query('begin');await a.query('select task_intent_fixture.arm($1)',[x.intent]);await a.query("update followup_tasks set status='completed',due_on=null where id=$1",[x.task]);const pid=(await b.query('select pg_backend_pid() p')).rows[0].p;const pending=b.query('select task_intent_fixture.arm($1)',[other]).then(()=>null,e=>e.code);let waiting=false;for(let n=0;n<200;n++){if((await f.q('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){waiting=true;break}await new Promise(r=>setTimeout(r,5))}eq(waiting,true,'independent second session waits on task lock');await a.query('commit');eq(await pending,'40001','competing intent rejects stale task revision');eq((await f.q('select count(*)::int n from task_intent_fixture.receipts where intent_id in($1,$2)',[x.intent,other])).rows[0].n,1,'one receipt across competing intents');eq((await f.q("select count(*)::int n from followup_task_events where task_id=$1 and action='updated'",[x.task])).rows[0].n,1,'one canonical update audit across competing intents');}finally{await a.end();await b.end()}}
 await deny(()=>f.q("select task_intent_fixture.capture($1,$2,1,'completed',null)",[randomUUID(),f.taskId]),'42501','actual bound task remains unavailable to lab capture');
 eq((await f.q('select revision from followup_tasks where id=$1',[f.taskId])).rows[0].revision,1,'bound task unchanged');
 console.log(JSON.stringify({status:'PASS',checks,records,hostedAcceptance:false,operationalWriteAuthority:false,terminalAuthority:false},null,2));
}finally{await f.close()}
