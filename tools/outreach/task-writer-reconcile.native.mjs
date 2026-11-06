import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createCampaignTaskFixture,TASK_MIGRATION} from './campaign-task-fixture.mjs';
import {taskWriterOutcome} from './task-writer-outcome.mjs';
const f=await createCampaignTaskFixture({seedBinding:false});let checks=0;const records=[];
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;records.push(label)};
const deny=async(fn,code,label)=>{await assert.rejects(fn,e=>e.code===code,label);checks++;records.push(label)};
const request={actor_id:f.users.worker.id,session_id:f.users.worker.sessionId,organization_id:f.orgId,campaign_id:f.campaignId,registration_id:f.registrationId,person_id:f.personId,account_id:f.users.learner.id,task_id:f.taskId,binding_id:f.bindingId,intent_id:randomUUID(),source:f.binding.source,expected:{task_revision:2,binding_revision:1,campaign_registrant_revision:1,portal_link_revision:f.link.revision,followup_revision:1},intent:{status:'canceled',due_on:null}};
const reconcile=async(r=request,c=f.db)=>(await c.query('select private.task_writer_reconcile($1) v',[r])).rows[0].v;
const canonical=async()=>(await f.q("select (select jsonb_agg(to_jsonb(t) order by id) from followup_tasks t) tasks,(select jsonb_agg(to_jsonb(e) order by id) from followup_task_events e) events,(select jsonb_agg(to_jsonb(b) order by id) from private.campaign_person_task_bindings b) bindings,(select jsonb_agg(to_jsonb(e) order by id) from private.campaign_person_task_binding_events e) binding_events")).rows[0];
const bind=async(value=f.binding)=>{await f.setClaims(f.db,f.users.reviewer);await f.insertBinding(value);await f.setClaims(f.db,f.users.worker)};
const waitBlocked=async(pid)=>{for(let i=0;i<200;i++){if((await f.q('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){checks++;records.push('actual independent connection lock wait');return}await new Promise(r=>setTimeout(r,5))}assert.fail('lock wait not observed')};
try{
 const source=readFileSync(new URL('./task-writer-reconcile.sql',import.meta.url),'utf8');
 eq(createHash('sha256').update(readFileSync(new URL('../../'+TASK_MIGRATION,import.meta.url))).digest('hex'),'00c85fabbe17aa986a2c722e2b7f3aae2cac45fe8d2cf32736c16fc4099a883d','unchanged PR105');
 await f.db.exec(readFileSync(new URL('./task-writer-prepare.sql',import.meta.url),'utf8'));
 const catalog=async()=>(await f.q("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('private','public') and p.proname<>'task_writer_reconcile' order by 1")).rows;
 const originalFunctions=await catalog();await f.db.exec(source);eq(await catalog(),originalFunctions,'all pre-existing functions unchanged');
 for(const role of ['anon','authenticated','service_role'])eq((await f.q('select has_function_privilege($1,$2,$3) v',[role,'private.task_writer_reconcile(jsonb)','EXECUTE'])).rows[0].v,false,'no '+role+' execution');
 await deny(()=>f.authenticatedQuery('worker','select private.task_writer_reconcile($1)',[request]),'42501','no authenticated reconciliation API');
 await f.setClaims(f.db,f.users.worker);
 // Ordinary, unbound fixture history exercises exact predecessor validation.
 await f.q("update followup_tasks set status='canceled',due_on=null where id=$1",[f.taskId]);
 const beforeBinding=await canonical();
 for(const [label,change] of [
  ['duplicate event',()=>f.q("insert into followup_task_events(organization_id,task_id,actor_user_id,action,before_state,after_state) select organization_id,task_id,actor_user_id,action,before_state,after_state from followup_task_events where task_id=$1 and action='updated'",[f.taskId])],
  ['missing event',()=>f.q("delete from followup_task_events where task_id=$1 and action='updated'",[f.taskId])],
  ['null predecessor',()=>f.q("update followup_task_events set before_state=null where task_id=$1 and action='updated'",[f.taskId])],
  ['wrong predecessor',()=>f.q("update followup_task_events set before_state=jsonb_set(before_state,'{status}','\"completed\"') where task_id=$1 and action='updated'",[f.taskId])],
  ['wrong current snapshot',()=>f.q("update followup_task_events set after_state=jsonb_set(after_state,'{status}','\"completed\"') where task_id=$1 and action='updated'",[f.taskId])],
  ['wrong creation actor',()=>f.q("update followup_task_events set actor_user_id=$2 where task_id=$1 and action='created'",[f.taskId,f.users.other.id])]
 ]){
  await f.q('begin');await change();await bind();const v=await reconcile();eq(v.observation,'CANONICAL_HISTORY_INCONSISTENT',label+' cannot corroborate history');eq(v.terminal_verified,false,label+' cannot settle UNKNOWN');eq(Object.hasOwn(v,'task'),false,label+' returns no task projection');await f.q('rollback');
 }
 eq(await canonical(),beforeBinding,'adversarial ordinary fixtures rolled back');
 // A task UPDATE queued while unbound cannot become a committed bound write by
 // adding a binding later in the same transaction. No guard is disabled/replaced.
 for(const mode of ['plain','expired','withdrawn']){
  await f.setClaims(f.db,f.users.worker);await f.q('begin');
  await f.q("update followup_tasks set status='completed' where id=$1",[f.taskId]);
  await bind({...f.binding,...(mode==='expired'?{valid_until:new Date(Date.now()+150)}:{})});
  if(mode==='expired')await new Promise(r=>setTimeout(r,200));
  if(mode==='withdrawn')await f.withdraw();
  await deny(()=>f.q('commit'),'42501','existing deferred guard rejects late binding at commit: '+mode);
  eq(await canonical(),beforeBinding,'commit rejection rolls back task, task audit, binding and binding audit: '+mode);
  eq((await f.q('select consent from outreach_registrations where id=$1',[f.registrationId])).rows[0].consent,true,'consent rollback: '+mode);
 }
 await bind();const bound=await canonical();
 const v=await reconcile();eq(v.state,'UNKNOWN','matching canonical state is not an intent receipt');eq(v.observation,'EXPECTED_REVISIONS_CURRENT','five revisions currently match');eq(v.canonical_history,'ONE_EVENT_PER_REVISION','complete exact chain corroborated');eq(v.task,{id:f.taskId,status:'canceled',due_on:null,revision:2},'minimal current neutral projection');
 for(const key of ['can_authorize','can_commit','automatic_retry','terminal_verified'])eq(v[key],false,key+' remains false');
 eq(v.intent_outcome,'UNPROVEN','current state even matching intent cannot prove attribution');eq(taskWriterOutcome(v),{state:'UNKNOWN',automaticRetry:false},'existing outcome classifier preserves UNKNOWN');
 eq((await reconcile({...request,intent:{status:'open',due_on:'2026-12-01'}})).task,v.task,'changed intent UUID payload observes same canonical state without replay');
 eq(await canonical(),bound,'reconciliation makes no application DML');
 for(const key of Object.keys(request.expected))await deny(()=>reconcile({...request,expected:{...request.expected,[key]:request.expected[key]+1}}),'40001','stale '+key+' is not reconciled as terminal');
 for(const patch of [{actor_id:f.users.other.id},{session_id:f.users.other.sessionId},{organization_id:f.foreignOrgId},{registration_id:randomUUID()},{intent_outcome:'COMMITTED'}])await deny(()=>reconcile({...request,...patch}),Object.hasOwn(patch,'intent_outcome')?'22023':'42501','caller cannot replace identity/scope or assert terminal result');
 await f.q('begin read only');await deny(()=>reconcile(),'25006','no-DML reconciliation requires ordinary transaction for row locks');await f.q('rollback');
 const blocker=await f.db.connect(),worker=await f.db.connect();await f.setClaims(worker,f.users.worker);await f.setClaims(blocker,f.users.worker);
 const workerPid=(await worker.query('select pg_backend_pid() p')).rows[0].p;
 const blockerPid=(await blocker.query('select pg_backend_pid() p')).rows[0].p;
 // Unknown reconciliation cannot outrun a pending task transaction; committed
 // consent revocation during its task wait is checked after lock acquisition.
 await blocker.query('begin');await blocker.query('select id from followup_tasks where id=$1 for update',[f.taskId]);
 const waiting=reconcile(request,worker).then(value=>({value}),e=>({code:e.code}));await waitBlocked(workerPid);await f.withdraw();await blocker.query('commit');eq((await waiting).code,'42501','fresh consent denial after pending task wait');await f.reset();
 // Event writers take task before history. Reconciliation retains that task
 // lock, and after release the unchanged bound-event guard denies the writer.
 await worker.query('begin');await reconcile(request,worker);
 const eventAttempt=blocker.query("insert into followup_task_events(organization_id,task_id,actor_user_id,action,before_state,after_state) select organization_id,task_id,actor_user_id,action,before_state,after_state from followup_task_events where task_id=$1 and action='updated'",[f.taskId]).then(value=>({value}),e=>({code:e.code}));
 await waitBlocked(blockerPid);await worker.query('commit');eq((await eventAttempt).code,'42501','history insertion serializes then remains denied');
 // Known limitation made executable: a held observation has no deferred event
 // and can end after session expiry. A new observation must deny afterward.
 await f.q("update auth.sessions set not_after=clock_timestamp()+interval '200 milliseconds' where id=$1",[f.users.worker.sessionId]);
 await worker.query('begin');eq((await reconcile(request,worker)).state,'UNKNOWN','observation before expiry still unknown');await new Promise(r=>setTimeout(r,250));eq((await worker.query('commit')).command,'COMMIT','read transaction can end after expiry; no commit-time authorization claimed');await deny(()=>reconcile(),'42501','fresh read after expiry denied');await f.reset();
 await f.q('begin');await reconcile();await f.withdraw();await deny(()=>reconcile(),'42501','same-transaction consent withdrawal is rechecked');await f.q('rollback');
 await f.q('begin');await f.q('set constraints all immediate');await deny(()=>f.q("update followup_tasks set status='completed' where id=$1",[f.taskId]),'42501','constraint mode cannot open bound writer');await f.q('rollback');
 eq(await canonical(),bound,'all new paths preserve bound canonical task, history and bindings');
 console.log(JSON.stringify({status:'PASS',checks,records,sourceSha256:createHash('sha256').update(source).digest('hex'),boundWritesEnabled:false,positiveBoundCasTested:false,commitTimeExpiryAuthorizationTested:false,hostedAcceptance:false},null,2));
}finally{await f.close()}
