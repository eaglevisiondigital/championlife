// Disposable PostgreSQL transaction experiment. No operational ledger/writer.
// Ordinary fictional canonical tasks are positive controls; bound writes stay OFF.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {createCampaignTaskFixture,TASK_MIGRATION} from './campaign-task-fixture.mjs';
import {taskWriterOutcome} from './task-writer-outcome.mjs';
let checks=0;const records=[];
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;records.push(label)};
const deny=async(fn,code,label)=>{await assert.rejects(fn,e=>e.code===code,label);checks++;records.push(label)};
const unknown=(value,label)=>{
 eq(value.state,'UNKNOWN',label);
 for(const key of ['can_authorize','can_commit','automatic_retry','terminal_verified'])eq(value[key],false,`${label}: ${key}`);
 eq(taskWriterOutcome(value),{state:'UNKNOWN',automaticRetry:false},`${label}: existing classifier`);
};
const f=await createCampaignTaskFixture();
try {
 const source=readFileSync(new URL('./task-intent-fixture.sql',import.meta.url),'utf8');
 eq(createHash('sha256').update(readFileSync(new URL('../../'+TASK_MIGRATION,import.meta.url))).digest('hex'),
  '00c85fabbe17aa986a2c722e2b7f3aae2cac45fe8d2cf32736c16fc4099a883d','PR105 bytes unchanged');
 const canonicalDefinitions=async()=>(await f.q(`select n.nspname,p.proname,pg_get_functiondef(p.oid) definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('private','public') order by 1,2,p.oid`)).rows;
 const definitions=await canonicalDefinitions();
 await f.db.exec(source);eq(await canonicalDefinitions(),definitions,'fixture does not replace any canonical function');
 for(const role of ['anon','authenticated','service_role']) {
  eq((await f.q("select has_schema_privilege($1,'task_intent_fixture','USAGE') v",[role])).rows[0].v,false,`${role} has no fixture schema access`);
  eq((await f.q("select has_function_privilege($1,'task_intent_fixture.capture(uuid,uuid,integer,text,date)','EXECUTE') v",[role])).rows[0].v,false,`${role} has no fixture capture execution`);
  for(const table of ['intents','receipts'])eq((await f.q("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') v",[role,`task_intent_fixture.${table}`])).rows[0].v,false,`${role} has no ${table} privileges`);
 }
 await deny(()=>f.authenticatedQuery('worker','select task_intent_fixture.capture($1,$2,1,$3,null)',[randomUUID(),f.ordinaryTaskId,'completed']),'42501','fixture has no authenticated RPC');
 const boundRows=async()=>(await f.q(`select
  (select to_jsonb(t) from followup_tasks t where id=$1) task,
  (select jsonb_agg(to_jsonb(e) order by id) from followup_task_events e where task_id=$1) events,
  (select to_jsonb(b) from private.campaign_person_task_bindings b where task_id=$1) binding,
  (select jsonb_agg(to_jsonb(e) order by id) from private.campaign_person_task_binding_events e where binding_id=$2) binding_events`,[f.taskId,f.bindingId])).rows[0];
 const boundBefore=await boundRows();
 const ordinaryRows=async()=>(await f.q(`select
  (select to_jsonb(t) from followup_tasks t where id=$1) task,
  (select jsonb_agg(to_jsonb(e) order by id) from followup_task_events e where task_id=$1) events,
  (select coalesce(jsonb_agg(to_jsonb(i) order by intent_id),'[]') from task_intent_fixture.intents i) intents,
  (select coalesce(jsonb_agg(to_jsonb(r) order by intent_id),'[]') from task_intent_fixture.receipts r) receipts`,[f.ordinaryTaskId])).rows[0];
 const a=await f.db.connect(),b=await f.db.connect();
 await f.setClaims(a,f.users.worker);await f.setClaims(b,f.users.worker);await f.setClaims(f.db,f.users.worker);
 const pidB=(await b.query('select pg_backend_pid() pid')).rows[0].pid;
 const waitBlocked=async()=>{for(let i=0;i<200;i++){
  if((await f.q('select wait_event_type from pg_stat_activity where pid=$1',[pidB])).rows[0]?.wait_event_type==='Lock'){checks++;records.push('actual independent connection lock wait');return}
  await new Promise(r=>setTimeout(r,5));
 }assert.fail('expected lock wait not observed')};
 const capture=async(c,id,{task=f.ordinaryTaskId,revision=1,status='completed',due=null}={})=>(await c.query('select task_intent_fixture.capture($1,$2,$3,$4,$5) v',[id,task,revision,status,due])).rows[0].v;
 // The harness alone orchestrates this ordinary UPDATE and references its actual
 // trigger event. No SQL function creates or changes canonical tasks in this lab.
 const mutateAndReceipt=async(c,id,status,due=null)=>{
  await c.query('update followup_tasks set status=$2,due_on=$3 where id=$1',[f.ordinaryTaskId,status,due]);
  const event=(await c.query(`select e.id from followup_task_events e join followup_tasks t on t.id=e.task_id
   where t.id=$1 and (e.after_state->>'revision')::integer=t.revision`,[f.ordinaryTaskId])).rows;
  assert.equal(event.length,1,'existing trigger produces one current ordinary event');
  await c.query('insert into task_intent_fixture.receipts(intent_id,event_id) values($1,$2)',[id,event[0].id]);
  return event[0].id;
 };
 const countsFor=async id=>(await f.q(`select (select count(*)::int from task_intent_fixture.intents where intent_id=$1) intents,
  (select count(*)::int from task_intent_fixture.receipts where intent_id=$1) receipts`,[id])).rows[0];
 // A missing intent AND event can coexist with a real uncommitted mutation.
 const committedId=randomUUID(),before=await ordinaryRows();
 await a.query('begin');unknown(await capture(a,committedId),'capture is not authority');
 const committedEvent=await mutateAndReceipt(a,committedId,'completed');
 eq(await ordinaryRows(),before,'separate observer sees no intent/event while writer transaction is pending');
 eq(taskWriterOutcome(await ordinaryRows()),{state:'UNKNOWN',automaticRetry:false},'absent snapshot cannot prove no pending work');
 // The harness deliberately discards its COMMIT response as an application input.
 // This is a controlled lost-response model, not a physical transport fault test.
 await a.query('commit');await a.end();
 eq(await countsFor(committedId),{intents:1,receipts:1},'new connection sees fixture claim and receipt after discarded response');
 const committed=await ordinaryRows();
 eq(committed.task.revision,2,'ordinary canonical revision committed');
 eq(committed.events.length,before.events.length+1,'one canonical audit committed with ordinary control');
 eq(committed.receipts[0].event_id,committedEvent,'fixture receipt references existing canonical event');
 unknown(await capture(b,committedId),'exact existing intent stays UNKNOWN even with fixture receipt');
 eq(await ordinaryRows(),committed,'exact existing intent performs no repeat task or audit write');
 eq(taskWriterOutcome({state:'COMMITTED',...committed.receipts[0]}),{state:'UNKNOWN',automaticRetry:false},'caller-provided receipt never becomes terminal authority');
 // Independently committed capture alone is not a receipt or a no-pending fence.
 const pendingId=randomUUID();unknown(await capture(b,pendingId,{revision:2,status:'canceled'}),'committed capture without receipt');
 eq(await countsFor(pendingId),{intents:1,receipts:0},'committed claim may have no outcome');
 eq(taskWriterOutcome(await countsFor(pendingId)),{state:'UNKNOWN',automaticRetry:false},'missing receipt cannot settle a captured request');
 // Atomic rollback after receipt insertion, and a failure while recording it.
 for(const mode of ['rollback','receipt-failure','bound-denial']) {
  const saved=await ordinaryRows(),id=randomUUID();await b.query('begin');
  await capture(b,id,{revision:2,status:'canceled'});await mutateAndReceipt(b,id,'canceled');
  if(mode==='receipt-failure')await deny(()=>b.query('insert into task_intent_fixture.receipts(intent_id,event_id) values($1,$2)',[id,randomUUID()]),'23505','duplicate receipt aborts containing transaction');
  if(mode==='bound-denial')await deny(()=>b.query("update followup_tasks set status='completed' where id=$1",[f.taskId]),'42501','bound denial aborts earlier ordinary mutation and fixture receipt');
  await b.query('rollback');eq(await ordinaryRows(),saved,`${mode}: intent, receipt, task and canonical audit all rolled back`);
  eq(await countsFor(id),{intents:0,receipts:0},`${mode}: absence still lacks durable rejection receipt`);
  eq(taskWriterOutcome(await countsFor(id)),{state:'UNKNOWN',automaticRetry:false},`${mode}: observed absence remains UNKNOWN`);
 }
 await deny(()=>capture(b,randomUUID(),{task:f.taskId}),'42501','lab capture explicitly refuses bound tasks');
 // Two sessions with the same intent are serialized, and do not run a task writer.
 const c=await f.db.connect();await f.setClaims(c,f.users.worker);
 for(const conflict of [false,true]) {
  const id=randomUUID();await c.query('begin');await capture(c,id,{revision:2,status:'canceled'});
  const pending=capture(b,id,{revision:2,status:conflict?'open':'canceled'}).then(value=>({value}),e=>({code:e.code}));
  await waitBlocked();eq(await countsFor(id),{intents:0,receipts:0},'observer absence during competing in-flight capture');
  await c.query('commit');const result=await pending;
  if(conflict)eq(result.code,'22023','same intent changed payload is a conflict after winning transaction commits');
  else {unknown(result.value,'concurrent exact intent remains observation');eq(result.value.fixture_observation,'EXACT_INTENT_ONLY','only one concurrent capture wins')}
  eq(await countsFor(id),{intents:1,receipts:0},'unique fixture intent exists once without invented terminal receipt');
 }
 // Uniqueness conflict crosses different task locks; PK itself must arbitrate.
 const secondTask=randomUUID();await f.q("insert into followup_tasks(id,organization_id,person_id,title,assigned_user_id) values($1,$2,$3,'Outreach follow-up',$4)",[secondTask,f.orgId,f.personId,f.users.worker.id]);
 const uniqueId=randomUUID();await c.query('begin');await capture(c,uniqueId,{revision:2});
 const uniqueWait=capture(b,uniqueId,{task:secondTask}).then(value=>({value}),e=>({code:e.code}));await waitBlocked();
 await c.query('commit');eq((await uniqueWait).code,'22023','same UUID cannot silently bind a different task across distinct task locks');
 eq(await countsFor(uniqueId),{intents:1,receipts:0},'unique collision does not create another record');
 // After rollback a waiting capture can insert; earlier absence was not a
 // rejection tombstone and did not prevent later admission of that same UUID.
 const rolledId=randomUUID();await c.query('begin');await capture(c,rolledId,{revision:2});
 const afterRollback=capture(b,rolledId,{revision:2}).then(value=>({value}),e=>({code:e.code}));await waitBlocked();
 await c.query('rollback');const recovered=await afterRollback;unknown(recovered.value,'rollback allows later fixture admission, never automatic retry');
 eq(recovered.value.fixture_observation,'CAPTURED_ONLY','rolled-back insertion is not a durable rejection barrier');
 // A lock timeout is not terminal and does not cancel its independent blocker.
 const timeoutId=randomUUID();await c.query('begin');await capture(c,timeoutId,{revision:2});
 const timed=capture(b,timeoutId,{revision:2}).then(value=>({value}),e=>({code:e.code}));await waitBlocked();
 eq((await timed).code,'55P03','actual lock timeout while independent capture remains pending');
 eq(await countsFor(timeoutId),{intents:0,receipts:0},'timeout observer still sees no committed receipt');
 await c.query('commit');eq(await countsFor(timeoutId),{intents:1,receipts:0},'blocker can commit after another caller times out');
 eq(taskWriterOutcome(await countsFor(timeoutId)),{state:'UNKNOWN',automaticRetry:false},'timeout is not no-pending proof');
 // Immutable full request, server actor/session and task scope cannot be replaced.
 for(const patch of [{revision:3},{status:'open'},{due:'2026-12-01'},{task:secondTask}])
  await deny(()=>capture(b,committedId,{...patch}),'22023','same intent cannot change its immutable binding');
 const newSession=randomUUID();await f.q("insert into auth.sessions(id,user_id,not_after) values($1,$2,clock_timestamp()+interval '1 hour')",[newSession,f.users.worker.id]);
 await f.setClaims(b,{...f.users.worker,sessionId:newSession});
 await deny(()=>capture(b,committedId),'22023','same actor with another session cannot replace captured session');
 await f.setClaims(b,f.users.other);await deny(()=>capture(b,committedId),'42501','different server actor cannot claim another worker task');
 await f.setClaims(b,f.users.worker);
 await f.q("update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1",[f.users.worker.sessionId]);
 await deny(()=>capture(b,committedId),'42501','expired current identity cannot read exact prior capture');await f.reset();
 await f.q("update organization_staff_permissions set revoked_at=clock_timestamp() where organization_id=$1 and user_id=$2 and permission='followup.manage'",[f.orgId,f.users.worker.id]);
 await deny(()=>capture(b,committedId),'42501','revoked ordinary management cannot read exact prior capture');
 await f.q("update organization_staff_permissions set revoked_at=null where organization_id=$1 and user_id=$2 and permission='followup.manage'",[f.orgId,f.users.worker.id]);
 for(const table of ['intents','receipts'])for(const statement of [`update task_intent_fixture.${table} set intent_id=intent_id`,`delete from task_intent_fixture.${table}`,`truncate task_intent_fixture.${table} cascade`])
  await deny(()=>f.q(statement),'42501',`${table}: append-only history denies ${statement.split(' ')[0]}`);
 // Positive limitation control: referential integrity alone accepts an OLD
 // unrelated event. Roll back immediately; never treat such a row as a receipt.
 const historic=committed.events.find(e=>e.action==='created').id;
 await b.query('begin');await b.query('insert into task_intent_fixture.receipts(intent_id,event_id) values($1,$2)',[pendingId,historic]);
 eq((await b.query('select fixture_result from task_intent_fixture.receipts where intent_id=$1',[pendingId])).rows[0].fixture_result,'LAB_OBSERVED_COMMIT','FK alone does not enforce event/request correspondence or coupling');
 eq(taskWriterOutcome((await b.query('select * from task_intent_fixture.receipts where intent_id=$1',[pendingId])).rows[0]),{state:'UNKNOWN',automaticRetry:false},'a server-stored historical event reference alone is still unproven');await b.query('rollback');
 eq(await countsFor(pendingId),{intents:1,receipts:0},'invalid correspondence control rolled back');
 eq(await boundRows(),boundBefore,'all bound canonical task, history and binding bytes unchanged');
 eq(await canonicalDefinitions(),definitions,'canonical functions remain unchanged after experiment');
 console.log(JSON.stringify({status:'PASS',checks,records,sourceSha256:createHash('sha256').update(source).digest('hex'),
  labOnly:true,productionRegistry:false,boundWritesEnabled:false,terminalVerified:false,automaticRetry:false,
  physicalTransportFailureTested:false,hostedAcceptance:false},null,2));
}finally{await f.close()}
