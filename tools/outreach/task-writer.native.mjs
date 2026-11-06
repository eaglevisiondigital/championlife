import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createCampaignTaskFixture,TASK_MIGRATION} from './campaign-task-fixture.mjs';
import {taskWriterOutcome} from './task-writer-outcome.mjs';
let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};
const deny=async(fn,codes=['42501'])=>{await assert.rejects(fn,e=>codes.includes(e.code));checks++};
const sql=readFileSync(new URL('./task-writer-prepare.sql',import.meta.url),'utf8');
eq(createHash('sha256').update(readFileSync(new URL('../../'+TASK_MIGRATION,import.meta.url))).digest('hex'),'00c85fabbe17aa986a2c722e2b7f3aae2cac45fe8d2cf32736c16fc4099a883d','exact immutable PR105 migration');
const f=await createCampaignTaskFixture();
const request={actor_id:f.users.worker.id,session_id:f.users.worker.sessionId,organization_id:f.orgId,campaign_id:f.campaignId,registration_id:f.registrationId,person_id:f.personId,account_id:f.users.learner.id,task_id:f.taskId,binding_id:f.bindingId,intent_id:randomUUID(),source:f.binding.source,expected:{task_revision:1,binding_revision:1,campaign_registrant_revision:1,portal_link_revision:f.link.revision,followup_revision:1},intent:{status:'completed',due_on:'2026-12-01'}};
const prepare=async(r=request,c=f.db)=>(await c.query('select private.task_writer_prepare($1) v',[r])).rows[0].v;
const snapshot=async()=>({task:(await f.q('select to_jsonb(t) v from followup_tasks t where id=$1',[f.taskId])).rows[0].v,events:(await f.q('select jsonb_agg(to_jsonb(e) order by id) v from followup_task_events e where task_id=$1',[f.taskId])).rows[0].v});
const waitBlocked=async(pid)=>{for(let i=0;i<200;i++){if((await f.q('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){checks++;return;}await new Promise(r=>setTimeout(r,5));}assert.fail('actual lock wait not observed')};
try{
 const catalog=await f.q("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('private','public') order by 1");
 await f.db.exec(sql);
 eq((await f.q("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('private','public') and p.proname<>'task_writer_prepare' order by 1")).rows,catalog.rows,'all existing function definitions preserved');
 await f.setClaims(f.db,f.users.worker);
 const before=await snapshot();
 const held=await prepare();eq(held.state,'HELD');eq(held.can_authorize,false);eq(held.can_commit,false);eq(held.automatic_retry,false);eq(held.intent,request.intent);eq(held.expected,request.expected);eq(held.actor_id,f.users.worker.id);eq(held.session_id,f.users.worker.sessionId);eq(held.intent_sha256.length,64);eq(taskWriterOutcome(held),{state:'HELD',automaticRetry:false});eq(await snapshot(),before,'prepare makes no canonical task/audit writes');
 for(const outcome of [null,{},new Error('network'),{state:'COMMITTED'},{state:'HELD',can_authorize:true},{code:'55P03'},{code:'40P01'},{code:'40001'}])eq(taskWriterOutcome(outcome),{state:'UNKNOWN',automaticRetry:false});
 for(const role of ['anon','authenticated','service_role'])eq((await f.q('select has_function_privilege($1,$2,$3) v',[role,'private.task_writer_prepare(jsonb)','EXECUTE'])).rows[0].v,false);
 await deny(()=>f.authenticatedQuery('worker','select private.task_writer_prepare($1)',[request]));
 for(const patch of [{actor_id:f.users.other.id},{session_id:f.users.other.sessionId},{organization_id:f.foreignOrgId},{campaign_id:f.otherCampaignId},{registration_id:randomUUID()},{person_id:randomUUID()},{account_id:f.users.other.id},{source:'wrong'}])await deny(()=>prepare({...request,...patch}));
 for(const key of Object.keys(request.expected))await deny(()=>prepare({...request,expected:{...request.expected,[key]:2}}),['40001']);
 for(const patch of [{intent_id:null},{intent_id:'bad'},{intent_id:7},{extra:true},{intent:{...request.intent,title:'PRIVATE'}},{intent:{status:'completed'}},{intent:{status:'invalid',due_on:null}},{intent:{status:'open',due_on:'2026-02-30'}},{expected:{...request.expected,task_revision:0}},{expected:{...request.expected,task_revision:'1'}},{intent:{status:'open',due_on:'infinity'}}])await deny(()=>prepare({...request,...patch}),['22023']);
 eq((await prepare({...request,intent:{status:'open',due_on:null}})).intent.due_on,null);
 // Current independent organization manage permission is required beyond PR105 read authority.
 await f.q("update organization_staff_permissions set revoked_at=clock_timestamp() where user_id=$1 and permission='followup.manage'",[f.users.worker.id]);
 eq((await f.rpc('worker',f.args)).task.id,f.taskId);await deny(()=>prepare());
 await f.q("update organization_staff_permissions set revoked_at=null where user_id=$1 and permission='followup.manage'",[f.users.worker.id]);
 await f.q("update outreach_campaign_assignments set capabilities=array['view','decisions.read'] where campaign_id=$1 and user_id=$2",[f.campaignId,f.users.worker.id]);
 await deny(()=>prepare());
 await f.q("update outreach_campaign_assignments set capabilities=array['view','decisions.read','followup.manage'] where campaign_id=$1 and user_id=$2",[f.campaignId,f.users.worker.id]);
 for(const who of ['peopleOnly','campaignOnly','other','unverified']){await f.setClaims(f.db,f.users[who]);await deny(()=>prepare({...request,actor_id:f.users[who].id,session_id:f.users[who].sessionId}));}
 await f.setClaims(f.db,f.users.worker);
 for(const [change,reset] of [
  [()=>f.revoke('worker'),()=>f.reset()],
  [()=>f.retire('worker'),()=>f.reset()],
  [()=>f.withdraw(),()=>f.reset()],
  [()=>f.q('update outreach_decision_campaign_sources set active=false where campaign_id=$1',[f.campaignId]),()=>f.q('update outreach_decision_campaign_sources set active=true where campaign_id=$1',[f.campaignId])],
  [()=>f.q('update outreach_decision_followup set assigned_user_id=$1 where registration_id=$2',[f.users.other.id,f.registrationId]),()=>f.q('update outreach_decision_followup set assigned_user_id=$1 where registration_id=$2',[f.users.worker.id,f.registrationId])]
 ]){await change();await deny(()=>prepare());await reset();}
 // Followup revision changes are read from the canonical row, never from caller evidence.
 const fr=(await f.q('select revision from outreach_decision_followup where registration_id=$1',[f.registrationId])).rows[0].revision;
 request.expected.followup_revision=fr;
 // Exact canonical bound writes stay disabled for authenticated and owner connections.
 await deny(()=>f.authenticatedQuery('worker',"update followup_tasks set status='completed' where id=$1 and revision=1",[f.taskId]));
 await deny(()=>f.q("update followup_tasks set status='completed' where id=$1 and revision=1",[f.taskId]));
 eq(await snapshot(),before,'neither CAS filter nor database owner opens the bound writer');
 // Real two-session task lock serializes prepare; a consent revocation committed
 // while prepare waits is observed after acquisition, with no stale HELD response.
 const blocker=await f.db.connect(), contender=await f.db.connect();
 await f.setClaims(contender,f.users.worker);const pid=(await contender.query('select pg_backend_pid() p')).rows[0].p;
 await blocker.query('begin');await blocker.query('select id from followup_tasks where id=$1 for update',[f.taskId]);
 const waiting=prepare(request,contender).then(v=>({v}),e=>({code:e.code}));await waitBlocked(pid);
 await f.withdraw();await blocker.query('commit');eq((await waiting).code,'42501');await f.reset();
 // Fresh source revision change during lock wait rejects a stale precondition.
 await blocker.query('begin');await blocker.query('select id from followup_tasks where id=$1 for update',[f.taskId]);
 const stale=prepare(request,contender).then(v=>({v}),e=>({code:e.code}));await waitBlocked(pid);
 await f.q('update outreach_decision_followup set revision=revision+1 where registration_id=$1',[f.registrationId]);await blocker.query('commit');eq((await stale).code,'40001');request.expected.followup_revision++;
 // Wall-clock expiration while blocked is rechecked rather than trusting entry time.
 await f.q("update auth.sessions set not_after=clock_timestamp()+interval '300 milliseconds' where id=$1",[f.users.worker.sessionId]);
 await blocker.query('begin');await blocker.query('select id from followup_tasks where id=$1 for update',[f.taskId]);
 const expired=prepare(request,contender).then(v=>({v}),e=>({code:e.code}));await waitBlocked(pid);await new Promise(r=>setTimeout(r,400));await blocker.query('commit');eq((await expired).code,'42501');await f.reset();
 // Held prepare retains authority SHARE locks until enclosing transaction ends.
 await contender.query('begin');eq((await prepare(request,contender)).state,'HELD');
 const revokePid=(await blocker.query('select pg_backend_pid() p')).rows[0].p;
 const revoke=blocker.query('update outreach_registrations set consent=false where id=$1',[f.registrationId]);await waitBlocked(revokePid);await contender.query('rollback');await revoke;await deny(()=>prepare());await f.reset();
 // Bound failure aborts all earlier writes and their canonical audit in transaction.
 const ordinaryBefore=(await f.q('select to_jsonb(t) v from followup_tasks t where id=$1',[f.ordinaryTaskId])).rows[0].v;
 const counts=await f.counts();await f.q('begin');await f.q("update followup_tasks set status='completed' where id=$1",[f.ordinaryTaskId]);await deny(()=>f.q("update followup_tasks set status='completed' where id=$1",[f.taskId]));await f.q('rollback');
 eq((await f.q('select to_jsonb(t) v from followup_tasks t where id=$1',[f.ordinaryTaskId])).rows[0].v,ordinaryBefore);eq(await f.counts(),counts);
 // Actual canonical audit failure rolls back ordinary task mutation. This proves
 // baseline transaction semantics only; positive bound mutation remains unimplemented.
 await f.q('begin');await f.q("create function pg_temp.task_writer_reject_audit() returns trigger language plpgsql as $$begin raise exception 'Synthetic audit failure' using errcode='P0001';end$$");await f.q('create trigger task_writer_reject_audit before insert on followup_task_events for each row execute function pg_temp.task_writer_reject_audit()');
 await deny(()=>f.q("update followup_tasks set status='completed' where id=$1",[f.ordinaryTaskId]),['P0001']);await f.q('rollback');eq((await f.q('select to_jsonb(t) v from followup_tasks t where id=$1',[f.ordinaryTaskId])).rows[0].v,ordinaryBefore);eq(await f.counts(),counts);
 eq(await snapshot(),before);
 console.log(JSON.stringify({status:'PASS',checks,kind:'disposable native PostgreSQL held contract',boundWritesEnabled:false,hostedAcceptance:false}));
}finally{await f.close()}
