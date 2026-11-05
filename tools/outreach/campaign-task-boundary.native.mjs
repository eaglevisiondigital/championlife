import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCampaignTaskFixture,TASK_MIGRATION} from './campaign-task-fixture.mjs';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};
const f=await createCampaignTaskFixture();
const denied=async(fn,codes=['42501'])=>{await assert.rejects(fn,e=>codes.includes(e.code));checks++};
try{
 const response=await f.rpc('worker',f.args);eq(response.task.title,'Outreach follow-up');eq(response.actor_id,f.users.worker.id);eq(response.task.assigned_user_id,f.users.worker.id);ok(!JSON.stringify(response).includes('PRIVATE-PRAYER'));
 for(const who of ['peopleOnly','campaignOnly','other','unverified']){
  await denied(()=>f.rpc(who,f.args));
  eq((await f.authenticatedQuery(who,'select id from followup_tasks where id=$1',[f.taskId])).rowCount,0);
  eq((await f.authenticatedQuery(who,'select id from followup_task_events where task_id=$1',[f.taskId])).rowCount,0);
 }
 eq((await f.authenticatedQuery('worker','select id from followup_tasks where id=$1',[f.taskId])).rowCount,1);
 eq((await f.authenticatedQuery('worker','select id from followup_task_events where task_id=$1',[f.taskId])).rowCount,1);
 const before=await f.counts();
 for(const set of ["title='Changed'","status='completed'","due_on='2026-12-01'","assigned_user_id=null"]){await denied(()=>f.authenticatedQuery('worker',`update followup_tasks set ${set} where id=$1`,[f.taskId]))}
 await f.setClaims(f.db,f.users.worker);
 await denied(()=>f.q("update followup_tasks set status='completed' where id=$1",[f.taskId]));eq(await f.counts(),before);
 const updated=await f.authenticatedQuery('worker',"update followup_tasks set due_on='2026-12-02' where id=$1 returning revision",[f.ordinaryTaskId]);eq(updated.rows[0].revision,2);
 await denied(()=>f.rpc('worker',{...f.args,p_payload:{...f.args.p_payload,binding_revision:2}}),['40001']);
 await denied(()=>f.rpc('worker',{...f.args,p_payload:{...f.args.p_payload,extra:true}}),['22023']);
 await denied(()=>f.rpc('worker',{...f.args,p_campaign:f.otherCampaignId}));
 await denied(()=>f.q('truncate followup_task_events'));
 await denied(()=>f.q('update private.campaign_person_task_binding_events set evidence_sha256=$1',['5'.repeat(64)]));
 await f.revoke('worker');await denied(()=>f.rpc('worker',f.args));await f.reset();
 await f.retire('worker');await denied(()=>f.rpc('worker',f.args));await f.reset();
 await f.q('update outreach_registrations set consent=false where id=$1',[f.registrationId]);await denied(()=>f.rpc('worker',f.args));await f.reset();
 console.log(JSON.stringify({status:'PASS',checks}));
}finally{await f.close()}
// Upgrade guard and failed installation rollback on an exact source baseline.
const g=await createCampaignTaskFixture({install:false});
try{
 for(const drift of ['alter table public.followup_tasks disable row level security','revoke select on public.followup_tasks from authenticated','alter function private.operational_followup_visible(uuid,uuid) volatile']){
  await g.q('begin');await g.q(drift);
  await denied(()=>g.db.exec(readFileSync(new URL('../../'+TASK_MIGRATION,import.meta.url),'utf8')),['P0001']);await g.q('rollback');
  eq((await g.q("select to_regclass('private.campaign_person_task_bindings') x")).rows[0].x,null);
 }
 console.log(JSON.stringify({status:'PASS',totalChecks:checks}));
}finally{await g.close()}
