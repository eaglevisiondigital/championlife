import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
const {createCampaignTaskFixture}=await import(pathToFileURL(root+'/tools/outreach/campaign-task-fixture.mjs'));
const {taskWriterOutcome}=await import(pathToFileURL(root+'/tools/outreach/task-writer-outcome.mjs'));
let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};
for(const duplicate of [false,true]){
 const f=await createCampaignTaskFixture({seedBinding:false});
 try{
  await f.db.exec(readFileSync(root+'/tools/outreach/task-writer-prepare.sql','utf8'));
  await f.db.exec(readFileSync(root+'/tools/outreach/task-writer-reconcile.sql','utf8'));
  await f.setClaims(f.db,f.users.worker);
  await f.q("update followup_tasks set status='completed',revision=revision+1 where id=$1",[f.taskId]);
  await f.q("update followup_tasks set status='open',due_on='2026-12-02',revision=revision+1 where id=$1",[f.taskId]);
  if(duplicate)await f.q('insert into followup_task_events(organization_id,task_id,actor_user_id,action,before_state,after_state) select organization_id,task_id,actor_user_id,action,before_state,after_state from followup_task_events where task_id=$1 and action=\'created\'',[f.taskId]);
  await f.setClaims(f.db,f.users.reviewer);await f.insertBinding();
  await f.setClaims(f.db,f.users.worker);
  const before=await f.counts();
  const req={actor_id:f.users.worker.id,session_id:f.users.worker.sessionId,organization_id:f.orgId,campaign_id:f.campaignId,registration_id:f.registrationId,person_id:f.personId,account_id:f.users.learner.id,task_id:f.taskId,binding_id:f.bindingId,intent_id:randomUUID(),source:f.binding.source,expected:{task_revision:3,binding_revision:1,campaign_registrant_revision:1,portal_link_revision:f.link.revision,followup_revision:1},intent:{status:'completed',due_on:null}};
  const reconcile=async(r=req)=>(await f.q('select private.task_writer_reconcile($1) value',[r])).rows[0].value;
  const a=await reconcile();eq(a.state,'UNKNOWN');for(const k of ['can_authorize','can_commit','automatic_retry','terminal_verified'])eq(a[k],false,k);
  eq(a.observation,duplicate?'CANONICAL_HISTORY_INCONSISTENT':'EXPECTED_REVISIONS_CURRENT');
  eq(taskWriterOutcome(a),{state:'UNKNOWN',automaticRetry:false});
  if(!duplicate){eq(a.task.revision,3);eq(a.canonical_history,'ONE_EVENT_PER_REVISION');eq(a.intent_outcome,'UNPROVEN');
   const b=await reconcile({...req,intent_id:randomUUID(),intent:{status:'open',due_on:'2026-12-02'}});eq(b.intent_outcome,'UNPROVEN','even current state matching intent does not prove this request committed');eq(b.terminal_verified,false);
  }else eq(Object.hasOwn(a,'task'),false,'inconsistent history returns no task projection');
  await f.withdraw();await assert.rejects(reconcile,e=>e.code==='42501');checks++;
  eq(await f.counts(),before,'observations and denial change no canonical records');
 }finally{await f.close();}
}
console.log(JSON.stringify({checks,status:'PASS',writesEnabled:false,terminalProof:false}));
