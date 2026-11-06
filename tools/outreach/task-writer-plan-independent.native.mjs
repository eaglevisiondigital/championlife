// Independent source review: diagnostic transaction IDs and final-fence limits.
// Ordinary disposable controls only. No operational writer or bound bypass.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url));
const {createCampaignTaskFixture}=await import(pathToFileURL(root+'/tools/outreach/campaign-task-fixture.mjs'));
let checks=0;const records=[];
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;records.push(label)};
const deny=async(fn,code,label)=>{await assert.rejects(fn,e=>e.code===code,label);checks++;records.push(label)};
const held=(v,label)=>{eq(v.state,'HELD',label);for(const key of ['can_authorize','can_commit','automatic_retry','terminal_verified'])eq(v[key],false,`${label}: ${key}`)};
const f=await createCampaignTaskFixture();
try{
 for(const name of ['prepare','reconcile','plan'])await f.db.exec(readFileSync(root+`/tools/outreach/task-writer-${name}.sql`,'utf8'));
 await f.setClaims(f.db,f.users.worker);
 const request={actor_id:f.users.worker.id,session_id:f.users.worker.sessionId,organization_id:f.orgId,campaign_id:f.campaignId,
 registration_id:f.registrationId,person_id:f.personId,account_id:f.users.learner.id,task_id:f.taskId,binding_id:f.bindingId,intent_id:randomUUID(),source:f.binding.source,
 expected:{task_revision:1,binding_revision:1,campaign_registrant_revision:1,portal_link_revision:f.link.revision,followup_revision:1},intent:{status:'completed',due_on:null}};
 const plan=async(r=request)=>(await f.q('select private.task_writer_plan($1) v',[r])).rows[0].v;
 const snapshot=async()=>(await f.q(`select
 (select jsonb_agg(to_jsonb(t) order by id) from followup_tasks t) tasks,
 (select jsonb_agg(to_jsonb(e) order by id) from followup_task_events e) events,
 (select jsonb_agg(to_jsonb(b) order by id) from private.campaign_person_task_bindings b) bindings,
 (select jsonb_agg(to_jsonb(e) order by id) from private.campaign_person_task_binding_events e) binding_events,
 (select consent from outreach_registrations where id=$1) consent`,[f.registrationId])).rows[0];
 const initial=await snapshot();
 await f.q('begin');const first=await plan();held(first,'current request held');
 await f.q('savepoint separate_intent');
 const second=await plan({...request,intent_id:randomUUID(),intent:{status:'canceled',due_on:'2026-12-12'}});
 held(second,'different intent in same transaction held');
 eq(first.observation_transaction,second.observation_transaction,'transaction ID cannot identify a particular request');
 eq(second.audit_specification.after_state.status,'canceled','validated distinct intent gets its own specification');
 eq(second.audit_specification.after_state.due_on,'2026-12-12','finite date preserved in specification');
 assert.notEqual(first.intent_sha256,second.intent_sha256);checks++;records.push('different requests can share transaction ID without sharing intent digest');
 await f.q('rollback to savepoint separate_intent');
 eq((await plan()).observation_transaction,first.observation_transaction,'savepoint rollback does not retire diagnostic transaction ID');
 await f.q('rollback');eq(await snapshot(),initial,'rolled-back plans and savepoints change no canonical rows');
 await f.q('begin');const fresh=await plan();assert.notEqual(fresh.observation_transaction,first.observation_transaction);checks++;records.push('new transaction obtains distinct diagnostic ID');await f.q('rollback');
 await deny(()=>plan({...request,observation_transaction:first.observation_transaction}),'22023','diagnostic transaction ID cannot be submitted as authority');
 await deny(()=>plan({...request,audit_specification:first.audit_specification}),'22023','old audit specification cannot replace current source capture');
 eq(/prayer|phone|email|first_name|last_name/.test(JSON.stringify(first)),false,'plan contains no sensitive source fields');
 const quote=s=>"'"+s.replaceAll("'","''")+"'";
 await f.q(`create function pg_temp.independent_fixture_check() returns trigger language plpgsql as $$
 begin perform private.task_writer_plan(tg_argv[0]::jsonb);return new;end$$`);
 const trigger=()=>f.q(`create constraint trigger independent_fixture_check after update on public.followup_tasks
 deferrable initially deferred for each row when(new.id=${quote(f.ordinaryTaskId)}::uuid)
 execute function pg_temp.independent_fixture_check(${quote(JSON.stringify(request))})`);
 const update=()=>f.q("update followup_tasks set status=case when status='open' then 'completed' else 'open' end where id=$1",[f.ordinaryTaskId]);
 // Independently reproduce a supported-mode gap: set IMMEDIATE before any task
 // mutation. The check fires inside UPDATE, then consent is withdrawn afterward.
 await f.q('begin');await trigger();await f.q('set constraints all immediate');await update();await f.withdraw();
 eq((await f.q('commit')).command,'COMMIT','IMMEDIATE before update permits later same-transaction consent withdrawal');
 const early=await snapshot();eq(early.events.length,initial.events.length+1,'ordinary event committed despite earlier-fired check');eq(early.consent,false,'later consent withdrawal committed');
 eq(early.tasks.find(t=>t.id===f.taskId),initial.tasks.find(t=>t.id===f.taskId),'bound task remains byte-identical');
 eq(early.events.filter(e=>e.task_id===f.taskId),initial.events.filter(e=>e.task_id===f.taskId),'bound audit remains byte-identical');
 await deny(()=>plan(),'42501','fresh plan after committed withdrawal denies');
 await f.q('drop trigger independent_fixture_check on followup_tasks');await f.reset();
 // Same transaction sequence under default deferred timing must reject COMMIT,
 // establishing that constraint timing, not a changed request, explains the gap.
 const baseline=await snapshot();await f.q('begin');await trigger();await update();await f.withdraw();
 await deny(()=>f.q('commit'),'42501','default deferred check rejects same later withdrawal at commit');
 eq(await snapshot(),baseline,'default deferred rejection rolls back ordinary update, event and withdrawal');
 await f.q('begin');await f.q('set constraints all immediate');
 await deny(()=>f.q("update followup_tasks set status='completed' where id=$1",[f.taskId]),'42501','PR105 still denies actual bound update in immediate mode');await f.q('rollback');
 eq(await snapshot(),baseline,'bound denial changes no canonical rows');
 eq((await f.q("select count(*)::int n from pg_trigger where tgname='independent_fixture_check'")).rows[0].n,0,'experimental trigger removed or rolled back');
 console.log(JSON.stringify({status:'PASS',checks,records,sourceSha256:createHash('sha256').update(readFileSync(root+'/tools/outreach/task-writer-plan.sql')).digest('hex'),
  independent:true,positiveBoundWriter:false,guaranteedFinalFence:false,hostedAcceptance:false},null,2));
}finally{await f.close()}
