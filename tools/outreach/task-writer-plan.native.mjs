import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {createCampaignTaskFixture,TASK_MIGRATION} from './campaign-task-fixture.mjs';
import {taskWriterOutcome} from './task-writer-outcome.mjs';
let checks=0;const records=[];
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;records.push(label)};
const deny=async(fn,code,label)=>{await assert.rejects(fn,e=>e.code===code,label);checks++;records.push(label)};
const f=await createCampaignTaskFixture({seedBinding:false});
const request={actor_id:f.users.worker.id,session_id:f.users.worker.sessionId,organization_id:f.orgId,campaign_id:f.campaignId,registration_id:f.registrationId,person_id:f.personId,account_id:f.users.learner.id,task_id:f.taskId,binding_id:f.bindingId,intent_id:randomUUID(),source:f.binding.source,expected:{task_revision:1,binding_revision:1,campaign_registrant_revision:1,portal_link_revision:f.link.revision,followup_revision:1},intent:{status:'completed',due_on:null}};
const plan=async(r=request,c=f.db)=>(await c.query('select private.task_writer_plan($1) v',[r])).rows[0].v;
const bind=async()=>{await f.setClaims(f.db,f.users.reviewer);await f.insertBinding();await f.setClaims(f.db,f.users.worker)};
const snapshot=async()=>(await f.q(`select
 (select jsonb_agg(to_jsonb(t) order by id) from followup_tasks t) tasks,
 (select jsonb_agg(to_jsonb(e) order by id) from followup_task_events e) events,
 (select jsonb_agg(to_jsonb(b) order by id) from private.campaign_person_task_bindings b) bindings,
 (select jsonb_agg(to_jsonb(e) order by id) from private.campaign_person_task_binding_events e) binding_events,
 (select jsonb_agg(to_jsonb(r) order by id) from outreach_registrations r) registrations,
 (select jsonb_agg(to_jsonb(r) order by registration_id) from outreach_decision_followup r) followup,
 (select jsonb_agg(to_jsonb(p) order by organization_id,user_id,permission) from organization_staff_permissions p) permissions`)).rows[0];
const eventProjection='organization_id,task_id,actor_user_id,action,before_state,after_state';
const sqlQuote=s=>"'"+s.replaceAll("'","''")+"'";
const installExperiment=async(c=f.db)=>{
 // Test-only added constraint, not a proposed installer or bound-writer bypass.
 // The immutable request is captured in trigger arguments, not a caller GUC.
 await c.query(`create constraint trigger task_writer_fixture_final after update on public.followup_tasks
  deferrable initially deferred for each row when (new.id=${sqlQuote(f.ordinaryTaskId)}::uuid)
  execute function pg_temp.task_writer_fixture_final(${sqlQuote(JSON.stringify(request))})`);
};
const ordinaryUpdate=async(c=f.db)=>c.query("update followup_tasks set status=case when status='open' then 'completed' else 'open' end where id=$1",[f.ordinaryTaskId]);
const waitBlocked=async(pid)=>{for(let i=0;i<200;i++){if((await f.q('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){checks++;records.push('observed native authority lock wait');return}await new Promise(r=>setTimeout(r,5))}assert.fail('lock wait absent')};
try{
 eq(createHash('sha256').update(readFileSync(new URL('../../'+TASK_MIGRATION,import.meta.url))).digest('hex'),'00c85fabbe17aa986a2c722e2b7f3aae2cac45fe8d2cf32736c16fc4099a883d','unchanged PR105 guard source');
 for(const name of ['prepare','reconcile'])await f.db.exec(readFileSync(new URL(`./task-writer-${name}.sql`,import.meta.url),'utf8'));
 const catalog=async()=>(await f.q("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('private','public') and p.proname<>'task_writer_plan' order by 1")).rows;
 const originalCatalog=await catalog();const source=readFileSync(new URL('./task-writer-plan.sql',import.meta.url),'utf8');await f.db.exec(source);
 eq(await catalog(),originalCatalog,'existing function definitions unchanged');
 for(const role of ['anon','authenticated','service_role'])eq((await f.q('select has_function_privilege($1,$2,$3) v',[role,'private.task_writer_plan(jsonb)','EXECUTE'])).rows[0].v,false,'no '+role+' plan grant');
 await deny(()=>f.authenticatedQuery('worker','select private.task_writer_plan($1)',[request]),'42501','no callable authenticated plan API');
 await f.setClaims(f.db,f.users.worker);
 // Exact canonical trigger correspondence. A fictional held binding is rolled
 // back before an independently authorized ORDINARY task update. The plan never
 // authorizes that update; this is shape/count proof, not positive bound CAS.
 for(const intent of [{status:'completed',due_on:null},{status:'canceled',due_on:'2026-12-01'},{status:'canceled',due_on:'2026-12-01'}]){
  request.intent=intent;const before=await snapshot();await f.q('begin');await bind();const held=await plan();
  eq(held.state,'HELD','audit specification remains held');
  for(const key of ['can_authorize','can_commit','automatic_retry','terminal_verified'])eq(held[key],false,'held '+key);
  eq(held.expected,request.expected,'exact five expectations captured');eq(held.expected_event_count,1,'one expected canonical event');
  eq(held.actor_id,f.users.worker.id,'actor from current server Auth');eq(held.session_id,f.users.worker.sessionId,'server session bound');
  eq(held.observation_transaction,(await f.q('select pg_current_xact_id()::text id')).rows[0].id,'same server transaction observation');
  eq((await plan()).observation_transaction,held.observation_transaction,'same-transaction calls share observation ID');
  eq(taskWriterOutcome(held),{state:'HELD',automaticRetry:false},'held plan cannot clear uncertainty');
  await f.q('rollback');eq(await snapshot(),before,'held plan and fictional binding rollback preserve canonical rows');
  await f.authenticatedQuery('worker','update followup_tasks set status=$2,due_on=$3 where id=$1 and revision=$4',[f.taskId,intent.status,intent.due_on,request.expected.task_revision]);
  const events=(await f.q(`select ${eventProjection} from followup_task_events where task_id=$1 and after_state->>'revision'=$2`,[f.taskId,String(request.expected.task_revision+1)])).rows;
  eq(events.length,1,'ordinary canonical trigger appends exactly one event');eq(events[0],held.audit_specification,'ordinary canonical trigger emits exact proposed before/after and server actor');
  eq((await f.q('select count(*) n from followup_task_events where task_id=$1',[f.taskId])).rows[0].n,before.events.filter(e=>e.task_id===f.taskId).length+1,'no extra canonical event with another revision');
  eq((await f.q('select revision from followup_tasks where id=$1',[f.taskId])).rows[0].revision,request.expected.task_revision+1,'canonical revision increments once, including same-value update');
  request.expected.task_revision++;
 }
 // Inconsistent old history cannot become a held mutation specification.
 await f.q('begin');await f.q(`insert into followup_task_events(${eventProjection}) select ${eventProjection} from followup_task_events where task_id=$1 and action='created'`,[f.taskId]);await bind();await deny(()=>plan(),'40001','duplicate old audit rejects plan');await f.q('rollback');
 await bind();const bound=await snapshot();await f.q('begin');const first=await plan();await f.q('rollback');await f.q('begin');const later=await plan();
 assert.notEqual(later.observation_transaction,first.observation_transaction);checks++;records.push('new transaction cannot reuse observation identity');await f.q('rollback');
 await deny(()=>plan({...request,audit_specification:first.audit_specification}),'22023','caller cannot supply authoritative before/after snapshot');
 await deny(()=>plan({...request,actor_id:f.users.other.id}),'42501','caller cannot supply a different audit actor');
 for(const key of Object.keys(request.expected))await deny(()=>plan({...request,expected:{...request.expected,[key]:request.expected[key]+1}}),'40001','plan rejects stale '+key);
 await f.q('begin');await ordinaryUpdate();await deny(()=>f.q('update followup_tasks set status=$2 where id=$1 and revision=$3',[f.taskId,'completed',request.expected.task_revision]),'42501','held plan never opens bound update');await f.q('rollback');eq(await snapshot(),bound,'bound denial rolls back earlier ordinary task and audit');
 // All following triggers/functions exist solely inside this disposable test.
 // Existing guard definitions are untouched. The extra check targets authority
 // for the held bound task while only an ordinary synthetic task is mutated.
 await f.q(`create function pg_temp.task_writer_fixture_final() returns trigger language plpgsql as $$
  begin perform private.task_writer_plan(tg_argv[0]::jsonb);return new;end$$`);
 const pause=()=>new Promise(r=>setTimeout(r,300));
 for(const [label,setup,change,code,reset] of [
  ['session expiry',()=>f.q("update auth.sessions set not_after=clock_timestamp()+interval '250 milliseconds' where id=$1",[f.users.worker.sessionId]),pause,'42501',()=>f.reset()],
  ['manage expiry',()=>f.q("update organization_staff_permissions set expires_at=clock_timestamp()+interval '250 milliseconds' where user_id=$1 and permission='followup.manage'",[f.users.worker.id]),pause,'42501',()=>f.q("update organization_staff_permissions set expires_at=null where user_id=$1 and permission='followup.manage'",[f.users.worker.id])],
  ['consent withdrawal',async()=>{},()=>f.withdraw(),'42501',async()=>{}],
  ['binding withdrawal',async()=>{},()=>f.q("update private.campaign_person_task_bindings set revoked_at=clock_timestamp(),revocation_sha256=repeat('9',64),revision=revision+1 where id=$1",[f.bindingId]),'42501',async()=>{}],
  ['followup revision drift',async()=>{},()=>f.q('update outreach_decision_followup set revision=revision+1 where registration_id=$1',[f.registrationId]),'40001',async()=>{}],
  ['actor/session replacement',async()=>{},()=>f.setClaims(f.db,f.users.other),'42501',()=>f.setClaims(f.db,f.users.worker)]
 ]){
  await setup();const before=await snapshot();await f.q('begin');await installExperiment();await ordinaryUpdate();await plan();await change();
  await deny(()=>f.q('commit'),code,'default-deferred experiment catches '+label+' at commit');eq(await snapshot(),before,'complete ordinary task/audit/dependency rollback after '+label);await reset();
 }
 // New proof of a design limit: a constraint can run successfully early. A
 // subsequent expiry or same-transaction withdrawal then has no queued event.
 for(const label of ['session expiry','consent withdrawal']){
  if(label==='session expiry')await f.q("update auth.sessions set not_after=clock_timestamp()+interval '250 milliseconds' where id=$1",[f.users.worker.sessionId]);
  const before=await f.counts();await f.q('begin');await installExperiment();await ordinaryUpdate();await plan();
  await f.q('set constraints task_writer_fixture_final immediate');
  if(label==='session expiry')await pause();else await f.withdraw();
  eq((await f.q('commit')).command,'COMMIT','early-fired experimental fence does NOT guard later '+label);
  eq((await f.counts()).audits,before.audits+1,'ordinary canonical event commits after early-fence gap');
  await deny(()=>plan(),'42501','fresh plan denies after early-fire '+label);
  await f.q('drop trigger task_writer_fixture_final on followup_tasks');await f.reset();
 }
 // Native independent consent withdrawal serializes behind the authority lock.
 // It cannot be described as revoked before the earlier transaction commits.
 const revoker=await f.db.connect(),pid=(await revoker.query('select pg_backend_pid() p')).rows[0].p;
 await f.q('begin');await installExperiment();await ordinaryUpdate();await plan();
 const pending=revoker.query('update outreach_registrations set consent=false where id=$1',[f.registrationId]);await waitBlocked(pid);
 eq((await f.q('commit')).command,'COMMIT','ordinary experiment commits before queued independent withdrawal');await pending;
 await deny(()=>plan(),'42501','committed independent withdrawal denies fresh plan');await f.q('drop trigger task_writer_fixture_final on followup_tasks');await f.reset();
 eq((await f.q('select to_jsonb(t) v from followup_tasks t where id=$1',[f.taskId])).rows[0].v,bound.tasks.find(t=>t.id===f.taskId),'bound task never mutated');
 eq((await f.q('select jsonb_agg(to_jsonb(e) order by id) v from followup_task_events e where task_id=$1',[f.taskId])).rows[0].v,bound.events.filter(e=>e.task_id===f.taskId),'bound canonical history never mutated');
 eq(await catalog(),originalCatalog,'all existing functions still unchanged after experiments');
 console.log(JSON.stringify({status:'PASS',checks,records,sourceSha256:createHash('sha256').update(source).digest('hex'),boundWritesEnabled:false,positiveBoundCasTested:false,guaranteedFinalFence:false,hostedAcceptance:false},null,2));
}finally{await f.close()}
