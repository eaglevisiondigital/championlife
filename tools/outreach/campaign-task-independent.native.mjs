import assert from 'node:assert/strict';
import {randomUUID as uuid,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fixture} from './campaign-task-independent-fixture.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../..',import.meta.url));
const candidate=process.env.REVIEW_CANDIDATE_SQL || fileURLToPath(new URL('../../supabase/migrations/20261105223940_campaign_person_task_boundary.sql',import.meta.url));
assert.ok(candidate,'Exact local candidate migration path required');
console.log('Candidate SHA256 '+createHash('sha256').update(readFileSync(candidate)).digest('hex'));
const f=await fixture(root,candidate),{db,q,ids,org,foreignOrg,sessions,connect}=f;
let checks=0;
const check=(v,label)=>{assert.ok(v,label);console.log('PASS '+(++checks)+' '+label)};
const deny=async(fn,label,codes=['42501','P0001'])=>{await assert.rejects(fn,e=>codes.includes(e.code),label);check(true,label)};
try {
 const dual=await connect(),people=await connect('peopleOnly'),campaign=await connect('campaignOnly');
 const task=(await dual.query("insert into public.followup_tasks(organization_id,person_id,title,due_on,assigned_user_id)values($1,$2,'Outreach follow-up','2026-12-01',$3)returning *",[org,ids.person,ids.dual])).rows[0];
 const link=(await q('select * from public.portal_account_links where organization_id=$1 and person_id=$2',[org,ids.person])).rows[0];
 const mapping=(await q('select * from public.outreach_campaign_registrants where campaign_id=$1 and legacy_registration_id=$2',[ids.campaign,ids.registration])).rows[0];
 const binding=uuid();
 await q("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[ids.reviewer,JSON.stringify({sub:ids.reviewer,session_id:sessions.reviewer,exp:Math.floor(Date.now()/1000)+3600})]);
 const bindingSql=`insert into private.campaign_person_task_bindings(id,task_id,organization_id,campaign_id,registration_id,person_id,account_id,portal_link_id,portal_link_revision,campaign_registrant_id,campaign_registrant_revision,source,source_evidence_sha256,identity_evidence_sha256,adult_evidence_sha256,reviewer_authority_sha256,requested_by,reviewed_by,reviewed_at,valid_until,eligibility)
 values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'independent_primary',repeat('a',64),repeat('b',64),$15,repeat('d',64),$12,$13,clock_timestamp()+$16::interval,clock_timestamp()+$17::interval,$14)`;
 const bindingArgs=[binding,task.id,org,ids.campaign,ids.registration,ids.person,ids.subject,link.id,link.revision,mapping.id,mapping.revision,ids.dual,ids.reviewer];
 // Owner-only fictional proofs exercise fail-closed states, not an issuance API.
 for(const [label,eligibility,adultHash,reviewTime,validTime] of [
  ['Unknown age','unknown','c'.repeat(64),'-1 second','1 hour'],
  ['Minor','minor','c'.repeat(64),'-1 second','1 hour'],
  ['Conflicting age','conflict','c'.repeat(64),'-1 second','1 hour'],
  ['Missing adult evidence','verified_adult',null,'-1 second','1 hour'],
  ['Expired review','verified_adult','c'.repeat(64),'-1 hour','-1 second'],
  ['Future review','verified_adult','c'.repeat(64),'1 minute','1 hour']
 ]) {
  await q('begin');
  try {
   await q(bindingSql,[...bindingArgs,eligibility,adultHash,reviewTime,validTime]);
   await q("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[ids.dual,JSON.stringify({sub:ids.dual,session_id:sessions.dual,exp:Math.floor(Date.now()/1000)+3600})]);
   await q('set local role authenticated');
   check((await q('select id from public.followup_tasks where id=$1',[task.id])).rowCount===0,label+' hides direct task');
   check((await q('select id from public.followup_task_events where task_id=$1',[task.id])).rowCount===0,label+' hides task audit');
   await deny(()=>q('select public.campaign_person_task_context($1,$2,$3,$4)',[org,ids.campaign,ids.registration,{task_id:task.id,binding_id:binding,binding_revision:1}]),label+' denies readonly context');
  }finally{await q('rollback')}
  check((await q('select id from private.campaign_person_task_binding_events where binding_id=$1',[binding])).rowCount===0,label+' test rollback leaves no success journal');
 }
 await q(bindingSql,[...bindingArgs,'verified_adult','c'.repeat(64),'-1 second','1 hour']);

 const payload={task_id:task.id,binding_id:binding,binding_revision:1};
 const context=(c=dual,p=payload,o=org,ca=ids.campaign,r=ids.registration)=>c.query('select public.campaign_person_task_context($1,$2,$3,$4) v',[o,ca,r,p]).then(x=>x.rows[0].v);
 const tasks=(c=dual)=>c.query('select id,title,status,due_on,assigned_user_id,revision from public.followup_tasks where id=$1',[task.id]);
 const events=(c=dual)=>c.query('select * from public.followup_task_events where task_id=$1',[task.id]);
 const visible=await context();check(visible.task.id===task.id&&visible.task.title==='Outreach follow-up','Exact dual-authority readonly task context');
 check(!/PRIVATE|prayer|email|phone|source_evidence|adult_evidence|reviewer_authority/.test(JSON.stringify(visible)),'Context excludes restricted source and evidence payload');
 check((await tasks()).rowCount===1,'Dual-authority direct generic task read succeeds');
 check((await events()).rowCount===1,'Dual-authority direct task audit read succeeds');
 for(const[c,name]of[[people,'People-only'],[campaign,'campaign-only']]){
  check((await tasks(c)).rowCount===0,name+' direct task read denied');
  check((await events(c)).rowCount===0,name+' direct task audit read denied');
  await deny(()=>context(c),name+' readonly context denied');
  check((await c.query("update public.followup_tasks set status='completed' where id=$1 returning id",[task.id])).rowCount===0,name+' generic task mutation blocked');
 }
 check((await people.query('select id from public.followup_tasks where id=$1',[ids.ordinaryTask])).rowCount===1,'Unrelated ordinary task remains available under existing People permission');
 await deny(()=>context(dual,payload,foreignOrg),'Wrong organization context denied');
 await deny(()=>context(dual,payload,org,ids.otherCampaign),'Wrong campaign context denied');
 await deny(()=>context(dual,{...payload,binding_revision:2}),'Stale binding revision denied',['40001','42501']);
 await deny(()=>context(dual,{...payload,person_id:ids.otherPerson}),'Caller cannot supply Person identity',['22023','42501']);
 for(const role of ['anon','authenticated','service_role']) {
  const privileges=(await q("select has_table_privilege($1,'private.campaign_person_task_bindings','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') v",[role])).rows[0].v;
  check(privileges===false,role+' has no direct provenance table privilege');
 }
 // Changes are fictional only and rolled back. Real API clients cannot perform
 // this owner setup. The same connection then reads as authenticated, proving
 // policy behavior against the changed authoritative rows, not mocked results.
 async function hiddenAfter(sql,args,label) {
  const c=await db.connect();await c.query('begin');
  try {
   await c.query(sql,args);
   await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[ids.dual,JSON.stringify({sub:ids.dual,session_id:sessions.dual,exp:Math.floor(Date.now()/1000)+3600})]);
   await c.query('set local role authenticated');
   check((await tasks(c)).rowCount===0,label+' hides generic task');
   check((await events(c)).rowCount===0,label+' hides task audit');
  }finally{await c.query('rollback')}
 }
 for(const[sql,args,label]of[
  ['update public.outreach_campaign_assignments set active=false where campaign_id=$1 and user_id=$2',[ids.campaign,ids.dual],'Campaign revocation'],
  ["update public.outreach_campaign_assignments set decision_expires_at=clock_timestamp()-interval '1 second' where campaign_id=$1 and user_id=$2",[ids.campaign,ids.dual],'Campaign authority expiration'],
  ['update public.outreach_decision_followup set assigned_user_id=$1 where registration_id=$2',[ids.campaignOnly,ids.registration],'Record reassignment'],
  ['update public.organization_staff_permissions set revoked_at=clock_timestamp() where organization_id=$1 and user_id=$2 and permission=$3',[org,ids.dual,'followup.read'],'People follow-up grant revocation'],
  ["update public.organization_staff_permissions set effective_at=clock_timestamp()-interval '1 hour',expires_at=clock_timestamp()-interval '1 second' where organization_id=$1 and user_id=$2 and permission=$3",[org,ids.dual,'people.read'],'People grant expiration'],
  ['update public.organization_staff_directory set active=false where organization_id=$1 and user_id=$2',[org,ids.dual],'Staff directory retirement'],
  ['update auth.users set email_confirmed_at=null where id=$1',[ids.dual],'Actor verification withdrawn'],
  ['delete from auth.sessions where id=$1',[sessions.dual],'Session retirement'],
  ['update public.outreach_registrations set consent=false where id=$1',[ids.registration],'Ministry consent withdrawal'],
  ['update public.outreach_decision_campaign_sources set active=false where campaign_id=$1',[ids.campaign],'Source mapping deactivation'],
  ['update auth.users set email_confirmed_at=null where id=$1',[ids.subject],'Linked account verification withdrawn'],
  ['update public.portal_account_links set active=false where id=$1',[link.id],'Person association withdrawal']
 ])await hiddenAfter(sql,args,label);
 await deny(()=>dual.query("update public.followup_tasks set status='completed' where id=$1 returning revision",[task.id]),'Even dual-authorized blind UPDATE remains disabled');
 await deny(()=>dual.query("update public.followup_tasks set status='completed' where id=$1 and revision=1 returning revision",[task.id]),'CAS-filtered generic UPDATE remains disabled until dedicated writer');
 check((await events()).rowCount===1,'No successful audit from disabled writes');
 await deny(()=>dual.query("update public.followup_tasks set title='PRIVATE-PRAYER' where id=$1 returning id",[task.id]),'Bound title cannot be repurposed through generic API');
 const c=await db.connect();await c.query('begin');
 try {await c.query('set local role service_role');await deny(()=>c.query('truncate public.followup_task_events'),'Privileged truncate cannot erase bound audit');} finally{await c.query('rollback')}
 check((await events()).rowCount===1,'Bound history survives rejected truncation');

 for(const[sql,args,label]of[
  ['update public.followup_task_events set actor_user_id=$1 where task_id=$2',[ids.peopleOnly,task.id],'Privileged actor attribution change denied'],
  ['update public.followup_task_events set organization_id=$1 where task_id=$2',[foreignOrg,task.id],'Privileged organization reparent denied'],
  ['delete from public.followup_task_events where task_id=$1',[task.id],'Privileged bound history deletion denied']
 ]) {
  const alteration=await db.connect();await alteration.query('begin');
  try {await alteration.query('set local role service_role');await deny(()=>alteration.query(sql,args),label);}finally{await alteration.query('rollback')}
 }
 const reparent=await db.connect();await reparent.query('begin');
 try {await reparent.query('set local role service_role');await deny(()=>reparent.query('update public.followup_task_events set task_id=$1 where task_id=$2',[ids.ordinaryTask,task.id]),'Privileged reparent cannot detach bound audit');}finally{await reparent.query('rollback')}
 check((await events()).rowCount===1,'Bound history survives rejected reparent');
 const inbound=await db.connect();await inbound.query('begin');
 try {await inbound.query('set local role service_role');await deny(()=>inbound.query('update public.followup_task_events set task_id=$1 where task_id=$2',[task.id,ids.ordinaryTask]),'Privileged reparent cannot inject unrelated history');}finally{await inbound.query('rollback')}
 check((await events()).rowCount===1,'Bound history survives rejected incoming reparent');


 const secondBoundWriter=await connect();
 const concurrent=await Promise.allSettled([dual.query("update public.followup_tasks set status='completed' where id=$1 returning revision",[task.id]),secondBoundWriter.query("update public.followup_tasks set status='canceled' where id=$1 returning revision",[task.id])]);
 check(concurrent.every(x=>x.status==='rejected'&&x.reason.code==='42501'),'Concurrent blind bound writes both reject');
 check((await events()).rowCount===1,'Concurrent rejected writes create zero successful audits');
 const ordinaryWriters=await Promise.all([connect(),connect()]);
 const ordinaryResults=await Promise.all(ordinaryWriters.map((c,i)=>c.query('update public.followup_tasks set status=$1 where id=$2 and revision=1 returning revision',[i?'canceled':'completed',ids.ordinaryTask])));
 check(ordinaryResults.reduce((n,r)=>n+r.rowCount,0)===1,'Existing ordinary task explicit CAS remains functional under concurrency');
 check((await q('select count(*) n from public.followup_task_events where task_id=$1',[ids.ordinaryTask])).rows[0].n===2,'Ordinary CAS winner produces exactly one additional audit');
 const auditOwner=await db.connect();await auditOwner.query('begin');
 try {
  await auditOwner.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[ids.dual,JSON.stringify({sub:ids.dual,session_id:sessions.dual,exp:Math.floor(Date.now()/1000)+3600})]);
  await auditOwner.query("update private.campaign_person_task_bindings set revoked_at=clock_timestamp(),revocation_sha256=repeat('f',64),revision=revision+1 where id=$1",[binding]);
  const withdrawal=(await auditOwner.query("select * from private.campaign_person_task_binding_events where binding_id=$1 and action='binding_withdrawn'",[binding])).rows[0];
  check(withdrawal.recorded_by===ids.dual&&withdrawal.reviewed_by===ids.reviewer,'Withdrawal audit distinguishes actual recorder from original reviewer');
 }finally{await auditOwner.query('rollback')}
 const rollback=await db.connect();await rollback.query('begin');
 try {
  await rollback.query("create function private.independent_audit_failure()returns trigger language plpgsql as $$begin raise exception 'Fictional audit failure' using errcode='P0001';end$$");
  await rollback.query('create trigger independent_audit_failure before insert on private.campaign_person_task_binding_events for each row execute function private.independent_audit_failure()');
  await rollback.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[ids.dual,JSON.stringify({sub:ids.dual,session_id:sessions.dual,exp:Math.floor(Date.now()/1000)+3600})]);
  await deny(()=>rollback.query("update private.campaign_person_task_bindings set revoked_at=clock_timestamp(),revocation_sha256=repeat('f',64),revision=revision+1 where id=$1",[binding]),'Audit failure rejects withdrawal transaction',['P0001']);
 }finally{await rollback.query('rollback')}
 check((await q('select revoked_at,revision from private.campaign_person_task_bindings where id=$1',[binding])).rows[0].revoked_at===null,'Rejected withdrawal audit rolls back binding mutation');
 check((await q('select count(*) n from private.campaign_person_task_binding_events where binding_id=$1',[binding])).rows[0].n===1,'Rejected/rolled-back withdrawals leave no success journal');

 console.log(JSON.stringify({independentNativeChecks:checks,hosted:false,realReviewerAuthority:false,sourceReadinessOnly:true}));
}finally{await db.close()}
