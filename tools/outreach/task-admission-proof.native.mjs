// Disposable ordinary-task proof only; no operational terminal/writer API.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {createCampaignTaskFixture,TASK_MIGRATION} from './campaign-task-fixture.mjs';
import {taskWriterOutcome} from './task-writer-outcome.mjs';
let checks=0;const records=[];
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;records.push(label)};
const deny=async(fn,code,label)=>{await assert.rejects(fn,e=>e.code===code,label);checks++;records.push(label)};
const f=await createCampaignTaskFixture();
const arm=(c,id)=>c.query('select task_intent_fixture.arm($1)',[id]);
const reject=(c,id)=>c.query('select task_intent_fixture.reject_admission($1)',[id]);
const capture=(c,id,task,status='completed',revision=1,due=null)=>c.query('select task_intent_fixture.capture($1,$2,$3,$4,$5)',[id,task,revision,status,due]);
const update=(c,task,status='completed',due=null)=>c.query('update followup_tasks set status=$2,due_on=$3 where id=$1',[task,status,due]);
const state=async(task)=>(await f.q(`select
 (select to_jsonb(t) from followup_tasks t where id=$1) task,
 (select jsonb_agg(to_jsonb(e) order by id) from followup_task_events e where task_id=$1) events,
 (select coalesce(jsonb_agg(to_jsonb(x) order by observation_xid),'[]') from task_intent_fixture.executions x where task_id=$1) executions,
 (select coalesce(jsonb_agg(to_jsonb(r) order by intent_id),'[]') from task_intent_fixture.receipts r join task_intent_fixture.intents i using(intent_id) where i.task_id=$1) receipts,
 (select coalesce(jsonb_agg(to_jsonb(s) order by intent_id),'[]') from task_intent_fixture.settlements s join task_intent_fixture.intents i using(intent_id) where i.task_id=$1) settlements`,[task])).rows[0];
const ordinary=async()=>{const task=randomUUID();await f.q("insert into followup_tasks(id,organization_id,person_id,title,assigned_user_id)values($1,$2,$3,'Outreach follow-up',$4)",[task,f.orgId,f.personId,f.users.worker.id]);return task};
const admitted=async(status='completed')=>{const task=await ordinary(),id=randomUUID();await capture(f.db,id,task,status);return{task,id}};
const wait=async(c)=>{const pid=(await c.query('select pg_backend_pid() pid')).rows[0].pid;return async()=>{for(let i=0;i<200;i++){if((await f.q('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){checks++;records.push('observed actual independent session wait');return}await new Promise(r=>setTimeout(r,5))}assert.fail('lock wait not observed')}};
try{
 eq(createHash('sha256').update(readFileSync(new URL('../../'+TASK_MIGRATION,import.meta.url))).digest('hex'),'00c85fabbe17aa986a2c722e2b7f3aae2cac45fe8d2cf32736c16fc4099a883d','unchanged PR105 migration');
 const definitions=async()=>(await f.q("select p.oid::regprocedure::text sig,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('private','public') order by 1")).rows;
 const original=await definitions();
 await f.db.exec(readFileSync(new URL('./task-intent-fixture.sql',import.meta.url),'utf8'));
 await f.db.exec(readFileSync(new URL('./task-admission-proof.sql',import.meta.url),'utf8'));
 eq(await definitions(),original,'no existing canonical function replaced');
 await f.setClaims(f.db,f.users.worker);
 const bound=await state(f.taskId);
 const a=await f.db.connect(),b=await f.db.connect();await f.setClaims(a,f.users.worker);await f.setClaims(b,f.users.worker);const waiting=await wait(b);
 for(const role of ['anon','authenticated','service_role']){
  eq((await f.q("select has_schema_privilege($1,'task_intent_fixture','usage') v",[role])).rows[0].v,false,role+' has no lab schema');
  eq((await f.q("select bool_or(has_function_privilege($1,p.oid,'execute')) v from pg_proc p where p.pronamespace='task_intent_fixture'::regnamespace",[role])).rows[0].v,false,role+' has no lab function');
  eq((await f.q("select bool_or(has_table_privilege($1,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) v from pg_class c where c.relnamespace='task_intent_fixture'::regnamespace and c.relkind='r'",[role])).rows[0].v,false,role+' has no lab table');
 }
 eq((await f.q("select bool_and(relrowsecurity) v from pg_class where relnamespace='task_intent_fixture'::regnamespace and relkind='r'")).rows[0].v,true,'all experiment tables have RLS');
 await deny(()=>arm(f.db,randomUUID()),'22023','missing admission cannot be armed');
 await deny(()=>reject(f.db,randomUUID()),'22023','absence cannot be settled as rejection');
 // Actual canonical event, not caller-selected FK: ordinary positive control.
 const success=await admitted(),before=await state(success.task);
 await a.query('begin');await arm(a,success.id);await update(a,success.task);
 eq(await state(success.task),before,'pending task/event/receipt/settlement are invisible to observer');
 await a.query('commit');const committed=await state(success.task);
 eq(committed.task.revision,2,'ordinary task increments once');eq(committed.events.length,before.events.length+1,'one actual canonical event');
 eq(committed.receipts.length,1,'observer records one receipt');eq(committed.settlements.length,1,'one immutable lab settlement');
 const event=committed.events.find(e=>e.id===committed.receipts[0].event_id),execution=committed.executions[0];
 eq(event.before_state,execution.before_state,'exact canonical before state');eq(event.after_state,execution.after_state,'exact canonical after state');eq(event.actor_user_id,f.users.worker.id,'server actor corresponds');eq(event.task_id,success.task,'canonical task corresponds');
 eq(committed.settlements[0].event_id,event.id,'settlement and receipt share actual event');
 eq(taskWriterOutcome(committed.settlements[0]),{state:'UNKNOWN',automaticRetry:false},'lab event observation is not operational terminal authority');
 await deny(()=>arm(f.db,success.id),'55000','later execution cannot repeat settled lab intent');await deny(()=>reject(f.db,success.id),'55000','observed event cannot become rejection');eq(await state(success.task),committed,'duplicate attempts preserve entire settled state');
 // Old-event injection, forged current event and changed mutation are rejected.
 for(const mode of ['old-receipt','forged-event','wrong-status','wrong-date','wrong-title','changed-actor','extra-update','fake-settlement']){
  const x=await admitted(),saved=await state(x.task);await a.query('begin');await arm(a,x.id);
  if(mode==='old-receipt')await deny(()=>a.query('insert into task_intent_fixture.receipts(intent_id,event_id)values($1,$2)',[x.id,event.id]),'42501','caller cannot choose unrelated old event');
  if(mode==='forged-event')await deny(()=>a.query(`insert into followup_task_events(organization_id,task_id,actor_user_id,action,before_state,after_state)
   select $1,$2,$3,'updated',before_state,after_state from task_intent_fixture.executions where intent_id=$4`,[f.orgId,x.task,f.users.worker.id,x.id]),'42501','matching direct event insert is not canonical trigger provenance');
  if(mode==='wrong-status')await deny(()=>update(a,x.task,'canceled'),'22023','different status cannot correspond');
  if(mode==='wrong-date')await deny(()=>update(a,x.task,'completed','2027-01-01'),'22023','different date cannot correspond');
  if(mode==='wrong-title')await deny(()=>a.query("update followup_tasks set title='Changed',status='completed',due_on=null where id=$1",[x.task]),'42501','changed task identity cannot correspond');
  if(mode==='changed-actor'){await f.setClaims(a,f.users.other);await deny(()=>update(a,x.task),'42501','later server actor cannot consume original admission');await f.setClaims(a,f.users.worker).catch(()=>{});}
  if(mode==='extra-update'){await update(a,x.task);await deny(()=>update(a,x.task),'22023','second event cannot enter exact one-event settlement');}
  if(mode==='fake-settlement')await deny(()=>a.query("insert into task_intent_fixture.settlements(intent_id,observation,event_id)values($1,'LAB_EVENT_OBSERVED',$2)",[x.id,event.id]),'42501','direct owner event-result insert cannot substitute for observer');
  await a.query('rollback');await f.setClaims(a,f.users.worker);eq(await state(x.task),saved,mode+' rolls back task audit execution receipt settlement');
 }
 // Default fixture immutability controls cover the newly introduced observations.
 for(const table of ['executions','settlements'])for(const op of ['update','delete','truncate'])await deny(()=>f.q(op==='update'?`update task_intent_fixture.${table} set intent_id=intent_id`:`${op==='delete'?'delete from':'truncate'} task_intent_fixture.${table}`),'42501',table+' rejects '+op);
 // Arm without mutation can commit: it is unresolved, never a success receipt.
 const abandoned=await admitted();await arm(f.db,abandoned.id);eq((await state(abandoned.task)).settlements,[],'committed arm without event remains unresolved');await reject(f.db,abandoned.id);await deny(()=>arm(f.db,abandoned.id),'55000','rejection closes abandoned lab attempt');
 const rejected=await state(abandoned.task);await reject(f.db,abandoned.id);eq(await state(abandoned.task),rejected,'repeated rejection performs no new canonical or fixture write');
 const stale=await admitted();await update(f.db,stale.task,'canceled');await deny(()=>arm(f.db,stale.id),'40001','admission does not waive current ordinary revision comparison');eq((await state(stale.task)).executions,[],'stale revision does not arm an execution');
 {
  const x=await admitted(),saved=await state(x.task);await a.query('begin');await arm(a,x.id);await update(a,x.task);await deny(()=>update(a,f.taskId),'42501','later bound denial aborts observed ordinary event transaction');await a.query('rollback');eq(await state(x.task),saved,'bound denial rolls back new execution receipt and settlement with canonical state');
 }
 // Rejection and execution serialize through the same task-first locks.
 for(const disposition of ['executor-commit','executor-rollback','rejector-commit','rejector-rollback']){
  const x=await admitted(),saved=await state(x.task);await a.query('begin');await b.query('begin');
  let pending;
  if(disposition.startsWith('executor')){await arm(a,x.id);await update(a,x.task);pending=reject(b,x.id).then(()=>({ok:true}),e=>({code:e.code}));}
  else{await reject(a,x.id);pending=arm(b,x.id).then(()=>({ok:true}),e=>({code:e.code}));}
  await waiting();eq(await state(x.task),saved,'pending '+disposition+' reveals no terminal result');
  await a.query(disposition.endsWith('commit')?'commit':'rollback');const answer=await pending;
  if(disposition.endsWith('commit')){eq(answer.code,'55000',disposition+' excludes opposite settlement/execution');await b.query('rollback');}
  else {eq(answer.ok,true,disposition+' frees waiting path after rollback');if(disposition==='rejector-rollback')await update(b,x.task);await b.query('commit');}
  const final=await state(x.task);eq(final.settlements.length,1,disposition+' has one committed settlement');
  eq(final.settlements[0].observation,disposition==='executor-rollback'||disposition==='rejector-commit'?'LAB_REJECTED':'LAB_EVENT_OBSERVED',disposition+' exact observation');
  await deny(()=>arm(f.db,x.id),'55000',disposition+' excludes later arm');
 }
 // Original capture and new rejection preserve task-first ordering even when a
 // conflicting global UUID proposal first locks a DIFFERENT task.
 {
  const x=await admitted(),other=await ordinary();await a.query('begin');await reject(a,x.id);
  const pending=capture(b,x.id,other).then(()=>({ok:true}),e=>({code:e.code}));await waiting();await a.query('commit');eq((await pending).code,'22023','different-task UUID collision remains conflict after rejection lock');
 }
 // Timeout does not settle its blocker; that operation can still commit.
 {
  const x=await admitted();await a.query('begin');await arm(a,x.id);await update(a,x.task);
  const pending=reject(b,x.id).then(()=>({ok:true}),e=>({code:e.code}));await waiting();eq((await pending).code,'55P03','actual rejection timeout is not terminal');eq((await state(x.task)).settlements,[],'timed out observer sees no settlement');await a.query('commit');eq((await state(x.task)).settlements[0].observation,'LAB_EVENT_OBSERVED','blocker commits after rejection caller timed out');
 }
 // A task-lock wait must not preserve session authority that expires meanwhile.
 {
  const x=await admitted();await a.query('begin');await a.query('select id from followup_tasks where id=$1 for update',[x.task]);
  const pending=arm(b,x.id).then(()=>({ok:true}),e=>({code:e.code}));await waiting();await f.retire('worker');await a.query('commit');eq((await pending).code,'42501','current session revocation after task wait denies arm');eq((await state(x.task)).executions,[],'post-wait denial records no execution');await f.reset();
 }
 // Preserve the final-fence limit explicitly: event-time observation does not
 // prevent same-transaction session revocation AFTER the observed ordinary event.
 {
  const x=await admitted();await a.query('begin');await arm(a,x.id);await update(a,x.task);await a.query("update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1",[f.users.worker.sessionId]);await a.query('commit');
  eq((await state(x.task)).settlements[0].observation,'LAB_EVENT_OBSERVED','lab event observation is not final authorization fence');await f.reset();
 }
 // Closed-path limitation: ordinary writers that never arm do not consult the
 // fixture settlement; this is not a global/provider no-pending guarantee.
 {
  const x=await admitted();await reject(f.db,x.id);await update(f.db,x.task);const outside=await state(x.task);eq(outside.task.revision,2,'unarmed ordinary writer remains outside lab rejection gate');eq(outside.settlements[0].observation,'LAB_REJECTED','lab rejection is not a claim about all canonical writes');eq(taskWriterOutcome(outside),{state:'UNKNOWN',automaticRetry:false},'outside-path evidence remains UNKNOWN');
 }
 await deny(()=>capture(f.db,randomUUID(),f.taskId),'42501','bound task cannot become lab admission');await deny(()=>update(f.db,f.taskId),'42501','PR105 bound write denial remains actual');eq(await state(f.taskId),bound,'bound task history and fixture rows unchanged');
 console.log(JSON.stringify({ok:true,checks,records,operationalWriter:false,terminalAuthority:false},null,2));
}finally{await f.close()}
