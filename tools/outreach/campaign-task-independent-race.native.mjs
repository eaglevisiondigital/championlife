import assert from 'node:assert/strict';
import {randomUUID as uuid,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fixture} from './campaign-task-independent-fixture.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../..',import.meta.url));
const candidate=process.env.REVIEW_CANDIDATE_SQL || fileURLToPath(new URL('../../supabase/migrations/20261105223940_campaign_person_task_boundary.sql',import.meta.url));
console.log('Candidate SHA256 '+createHash('sha256').update(readFileSync(candidate)).digest('hex'));
const f=await fixture(root,candidate),{db,q,ids,org,sessions,connect}=f;
try {
 const dual=await connect();
 const task=(await dual.query("insert into public.followup_tasks(organization_id,person_id,title,due_on,assigned_user_id)values($1,$2,'Outreach follow-up','2026-12-01',$3)returning *",[org,ids.person,ids.dual])).rows[0];
 const link=(await q('select * from public.portal_account_links where organization_id=$1 and person_id=$2',[org,ids.person])).rows[0];
 const mapping=(await q('select * from public.outreach_campaign_registrants where campaign_id=$1 and legacy_registration_id=$2',[ids.campaign,ids.registration])).rows[0];
 const binding=uuid();
 await q("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[ids.reviewer,JSON.stringify({sub:ids.reviewer,session_id:sessions.reviewer,exp:Math.floor(Date.now()/1000)+3600})]);
 await q('begin');
 await q(`insert into private.campaign_person_task_bindings(id,task_id,organization_id,campaign_id,registration_id,person_id,account_id,portal_link_id,portal_link_revision,campaign_registrant_id,campaign_registrant_revision,source,source_evidence_sha256,identity_evidence_sha256,adult_evidence_sha256,reviewer_authority_sha256,requested_by,reviewed_by,reviewed_at,valid_until,eligibility)
 values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'independent_primary',repeat('a',64),repeat('b',64),repeat('c',64),repeat('d',64),$12,$13,clock_timestamp()-interval '1 second',clock_timestamp()+interval '1 hour','verified_adult')`,[binding,task.id,org,ids.campaign,ids.registration,ids.person,ids.subject,link.id,link.revision,mapping.id,mapping.revision,ids.dual,ids.reviewer]);

 // A separate writer starts before the binding commits. Old trigger checked an
 // absent uncommitted binding, then its FK waited for the target task row.
 const writer=await db.connect();const pid=(await writer.query('select pg_backend_pid() p')).rows[0].p;
 const eventMode=process.env.REVIEW_RACE==='event';
 const write=eventMode?writer.query("insert into public.followup_task_events(organization_id,task_id,actor_user_id,action,after_state)values($1,$2,$3,'created','{\"title\":\"PRIVATE-PRAYER\"}')returning id",[org,task.id,ids.dual]):writer.query(`insert into public.outreach_partner_intakes(organization_id,source_site,source_path,raw_submission,email_normalized,phone_normalized,commitment_amount,commitment_frequency,request_key,payload_hash,followup_task_id)
 values($1,'sowgo','/synthetic','{}','fictional@independent.invalid','15555550111',1,'Monthly',$2,'synthetic',$3) returning id`,[org,uuid(),task.id]);
 const attempted=write.then(r=>({accepted:true,count:r.rowCount}),e=>({accepted:false,code:e.code,message:e.message}));
 let blocked=false;
 for(let i=0;i<200;i++) {const status=(await q('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0];if(status?.wait_event_type==='Lock'){blocked=true;break}await new Promise(resolve=>setTimeout(resolve,5))}
 console.log('ATTACHMENT_WAIT_OBSERVED '+blocked);assert.equal(blocked,true);
 await q('commit');const result=await attempted;console.log('ATTACHMENT_RESULT '+JSON.stringify(result));
 const linked=(await q(eventMode?"select count(*) n from public.followup_task_events where task_id=$1 and after_state->>'title'='PRIVATE-PRAYER'":'select count(*) n from public.outreach_partner_intakes where followup_task_id=$1',[task.id])).rows[0].n;
 console.log((eventMode?'PRIVATE_HISTORY_ROWS ':'BOUND_FINANCIAL_LINKS ')+linked);
 assert.equal(result.accepted,false,'Attachment/history write cannot survive completed binding after waiting');
 assert.equal(result.code,'42501');assert.equal(linked,0);
 console.log('4 independent attachment/history concurrency assertions PASS');
}finally{try{await q('rollback')}catch{}await db.close()}
