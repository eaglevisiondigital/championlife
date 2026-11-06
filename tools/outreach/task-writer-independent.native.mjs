import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createCampaignTaskFixture} from './campaign-task-fixture.mjs';
import {taskWriterOutcome} from './task-writer-outcome.mjs';
const source=fileURLToPath(new URL('../..',import.meta.url));
const f=await createCampaignTaskFixture();let checks=0;const records=[];
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;records.push(label)};
const deny=async(r,label,c=f.db)=>{await assert.rejects(c.query('select private.task_writer_prepare($1) v',[r]),e=>e.code==='42501',label);checks++;records.push(label)};
const request={actor_id:f.users.worker.id,session_id:f.users.worker.sessionId,organization_id:f.orgId,campaign_id:f.campaignId,registration_id:f.registrationId,person_id:f.personId,account_id:f.users.learner.id,task_id:f.taskId,binding_id:f.bindingId,intent_id:randomUUID(),source:f.binding.source,expected:{task_revision:1,binding_revision:1,campaign_registrant_revision:1,portal_link_revision:f.link.revision,followup_revision:1},intent:{status:'completed',due_on:null}};
const prepare=async(r=request,c=f.db)=>(await c.query('select private.task_writer_prepare($1) v',[r])).rows[0].v;
const canonical=async()=>(await f.q("select (select jsonb_agg(to_jsonb(t) order by id) from followup_tasks t) tasks,(select jsonb_agg(to_jsonb(e) order by id) from followup_task_events e) events")).rows[0];
const blocked=async(c)=>{const pid=(await c.query('select pg_backend_pid() p')).rows[0].p;return async()=>{for(let i=0;i<100;i++){if((await f.q('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0].wait_event_type==='Lock'){checks++;return;}await new Promise(r=>setTimeout(r,10))}throw Error('No lock wait observed')}};
try{
 const sql=readFileSync(source+'/tools/outreach/task-writer-prepare.sql','utf8');await f.db.exec(sql);await f.setClaims(f.db,f.users.worker);const original=await canonical();
 const a=await prepare();eq(a.state,'HELD','valid source still held');
 for(const flag of ['can_authorize','can_commit','automatic_retry'])eq(a[flag],false,'held '+flag);
 eq((await prepare()).intent_sha256,a.intent_sha256,'identical preparation only deterministic marker');
 const changed=await prepare({...request,intent:{status:'open',due_on:'2026-12-01'}});
 assert.notEqual(changed.intent_sha256,a.intent_sha256);checks++;records.push('same intent ID can represent changed intent; explicitly no idempotency claim');
 eq(await canonical(),original,'multiple preparation calls write no task or event');
 for(const field of ['task_id','binding_id'])await deny({...request,[field]:randomUUID()},'unknown '+field);
 for(const [label,change] of [
  ['manage future-effective',"update organization_staff_permissions set effective_at=clock_timestamp()+interval '1 hour' where user_id=$1 and permission='followup.manage'"],
  ['manage expired',"update organization_staff_permissions set effective_at=clock_timestamp()-interval '1 hour',expires_at=clock_timestamp()-interval '1 second' where user_id=$1 and permission='followup.manage'"],
  ['manage department-scoped',"update organization_staff_permissions set department_ids=array[gen_random_uuid()] where user_id=$1 and permission='followup.manage'"],
  ['independent people permission expired',"update organization_staff_permissions set effective_at=clock_timestamp()-interval '1 hour',expires_at=clock_timestamp()-interval '1 second' where user_id=$1 and permission='people.read'"],
  ['staff directory inactive',"update organization_staff_directory set active=false where user_id=$1"],
  ['staff directory expired',"update organization_staff_directory set effective_at=clock_timestamp()-interval '1 hour',expires_at=clock_timestamp()-interval '1 second' where user_id=$1"]
 ]){
  await f.q('begin');await f.q(change,[f.users.worker.id]);await deny(request,label);await f.q('rollback');
 }
 // New manage requirement expires while the helper waits beyond permission reads.
 const blocker=await f.db.connect(),worker=await f.db.connect();await f.setClaims(worker,f.users.worker);const waitWorker=await blocked(worker),waitBlocker=await blocked(blocker);
 await f.q("update organization_staff_permissions set expires_at=clock_timestamp()+interval '500 milliseconds' where user_id=$1 and permission='followup.manage'",[f.users.worker.id]);
 await blocker.query('begin');await blocker.query('select id from outreach_registrations where id=$1 for update',[f.registrationId]);
 const waiting=prepare(request,worker).then(v=>({v}),e=>({code:e.code}));await waitWorker();await new Promise(r=>setTimeout(r,600));await blocker.query('rollback');eq((await waiting).code,'42501','manage expires after permission-read while registration lock blocks');
 await f.q("update organization_staff_permissions set expires_at=null where user_id=$1 and permission='followup.manage'",[f.users.worker.id]);
 // A successful held read retains the newly required manage row lock.
 await worker.query('begin');eq((await prepare(request,worker)).state,'HELD','held in enclosing transaction');
 const revoke=blocker.query("update organization_staff_permissions set revoked_at=clock_timestamp() where user_id=$1 and permission='followup.manage'",[f.users.worker.id]);await waitBlocker();await worker.query('rollback');await revoke;await deny(request,'committed manage revocation denies');
 await f.q("update organization_staff_permissions set revoked_at=null where user_id=$1 and permission='followup.manage'",[f.users.worker.id]);
 // Actual lock timeout remains non-authorizing UNKNOWN; no retry surface exists.
 await blocker.query('begin');await blocker.query('select id from followup_tasks where id=$1 for update',[f.taskId]);
 const timeout=await prepare(request,worker).then(v=>v,e=>e);eq(timeout.code,'55P03','real task lock timeout');eq(taskWriterOutcome(timeout),{state:'UNKNOWN',automaticRetry:false},'lock timeout is unknown without retry');await blocker.query('rollback');
 eq(await canonical(),original,'all negative/concurrency paths preserve canonical task/audit');
 eq((await f.q("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='task_writer_prepare'")).rows[0].n,0,'no public writer wrapper');
 console.log(JSON.stringify({status:'PASS',checks,sourceSha256:createHash('sha256').update(sql).digest('hex'),records,syntheticOnly:true,boundMutationTested:false,hostedAcceptance:false},null,2));
}finally{await f.close()}
