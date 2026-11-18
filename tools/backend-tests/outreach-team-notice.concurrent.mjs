// Independent native local connections; synthetic policy/accounts/provider only.
import assert from'node:assert/strict';import{randomUUID as uuid}from'node:crypto';
import{noticeFixture}from'./outreach-team-notice.fixture.mjs';
import{runOne,reconcileOne}from'../../supabase/functions/outreach-team-notices-worker/worker.mjs';
const f=await noticeFixture(true),{db,q,campaign,owner,as,workspace}=f;let n=0;
const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)};
const wrap=c=>({query:(...a)=>c.query(...a),exec:s=>c.query(s)});
const connections=[];
async function client(role='service_role'){const c=await db.connect();connections.push(c);await c.query('set role '+role);return wrap(c)}
const service=c=>(a,event=campaign,p={})=>f.service(a,event,p,c);
const admin=()=>db.exec('reset role');
async function expire(id){await admin();await q("update private.outreach_team_notice_intents set lease_until=clock_timestamp()-interval '1 second' where id=$1",[id])}
try{
 await f.operator();await f.configure();const policy=await f.policy(),m=await f.participant();
 const a=await client('authenticated'),b=await client('authenticated');
 await as(owner,'authenticated',a);await as(owner,'authenticated',b);
 const producer=c=>f.workspace('prepare',{member_id:m.id,kind:'team_approved',history_id:m.history},campaign,c);
 const produced=await Promise.all([producer(a),producer(b)]);
 ok(produced[0].id===produced[1].id,'concurrent producers resolve one durable logical intent');
 const i=produced[0];await f.authorize(i,m,policy);
 const c1=await client(),c2=await client(),s1=service(c1),s2=service(c2);
 const leases=await Promise.all([s1('claim'),s2('claim')]);
 ok(leases.filter(x=>x.state==='leased').length===1&&leases.filter(x=>x.state==='empty').length===1,'concurrent workers acquire at most one active lease');
 const old=leases.find(x=>x.state==='leased');await expire(i.id);const fresh=await s2('claim');
 ok(fresh.state==='leased'&&fresh.lease_token!==old.lease_token,'expired pre-start lease can be reclaimed with new CAS token');
 ok((await s1('start',campaign,{intent_id:i.id,lease_token:old.lease_token})).state==='stale','stale worker cannot start after lease replacement');
 const starts=await Promise.all([s1('start',campaign,{intent_id:i.id,lease_token:fresh.lease_token}),s2('start',campaign,{intent_id:i.id,lease_token:fresh.lease_token})]);
 ok(starts.filter(x=>x.state==='in_flight').length===1&&starts.filter(x=>x.state==='stale').length===1,'concurrent start creates one immutable attempt');
 const started=starts.find(x=>x.state==='in_flight');await admin();
 ok((await q('select count(*)::int n from private.outreach_team_notice_attempts where intent_id=$1',[i.id])).rows[0].n===1,'one attempt persisted before any provider call');
 await expire(i.id);ok((await s1('claim')).state==='hold','expired in-flight attempt cannot be reclaimed for another send');
 await s1('result',campaign,{intent_id:i.id,lease_token:fresh.lease_token,attempt_id:started.attempt_id,provider_email_id:uuid()});
 ok((await f.row(i.id)).state==='hold','late successful response does not overwrite reconciliation HOLD');
 const m2=await f.participant(),i2=await f.prepare(m2);await f.authorize(i2,m2,policy);
 let posts=0;const before=await f.row(i2.id),provider=uuid();
 const crashRpc=async(action,c,p)=>{if(action==='result')throw Error('SIMULATED crash before result persistence');return s1(action,c,p)};
 const crashed=await runOne({campaign,rpc:crashRpc,send:async()=>{posts++;return{ok:true,id:provider}}});
 ok(posts===1&&crashed.code==='result_persistence_unknown','accepted provider response plus local persistence crash remains uncertain');
 const early={receipt_id:'msg_early_unknown',body_digest:'c'.repeat(64),provider_email_id:provider,event_type:'email.delivered',provider_at:new Date().toISOString()};
 ok((await s2('receipt',null,early)).state==='unmatched_hold','receipt before persisted provider identity is retained unmatched');
 await expire(i2.id);await runOne({campaign,rpc:s2,send:async()=>posts++});
 ok(posts===1&&(await f.row(i2.id)).state==='hold','crash recovery issues no second POST');
 await as(owner);const review=await workspace('review_hold',{intent_id:i2.id,code:'provider_lookup_required',provider_email_id:provider});
 await admin();await q('update private.outreach_team_notice_runtime set lookup_enabled=true');
 const frozen=await f.row(i2.id),record={id:provider,...frozen.frozen_payload,reply_to:[frozen.frozen_payload.reply_to],
  created_at:frozen.first_attempt_at,last_event:'delivered',cc:[],bcc:[],html:null,scheduled_at:null};
 let gets=0;const recovered=await reconcileOne({campaign,intentId:i2.id,providerId:provider,reviewId:Number(review.review_id),rpc:s2,lookup:async()=>{gets++;return record}});
 ok(recovered.state==='accepted'&&gets===1&&posts===1,'manual reviewed GET proof reconciles unknown-ID crash without resending');
 ok((await f.row(i2.id)).provider_key===before.provider_key,'reconciliation preserves original provider key across crash');
 await as(owner);const report=await workspace('report');
 ok(report.intents.find(x=>x.id===i2.id).outcomes.includes('email.delivered'),'previously unmatched signed receipt adopted into redacted report');
 const m3=await f.participant(),i3=await f.prepare(m3);await f.authorize(i3,m3,policy);
 const l3=await s1('claim'),start3=await s1('start',campaign,{intent_id:i3.id,lease_token:l3.lease_token}),provider3=uuid();
 await s2('receipt',null,{...early,receipt_id:'msg_early_bounce',provider_email_id:provider3,event_type:'email.bounced'});
 await s1('result',campaign,{intent_id:i3.id,lease_token:l3.lease_token,attempt_id:start3.attempt_id,provider_email_id:provider3});
 ok((await f.row(i3.id)).state==='suppressed','fast bounce preceding send-result persistence is adopted and suppresses');
 const m4=await f.participant(),i4=await f.prepare(m4);await f.authorize(i4,m4,policy);
 const l4=await s1('claim'),start4=await s1('start',campaign,{intent_id:i4.id,lease_token:l4.lease_token}),provider4=uuid();
 const racing={...early,receipt_id:'msg_racing_positive',provider_email_id:provider4};
 await Promise.all([s1('result',campaign,{intent_id:i4.id,lease_token:l4.lease_token,attempt_id:start4.attempt_id,provider_email_id:provider4.toUpperCase()}),s2('receipt',null,racing)]);
 await Promise.all([s1('receipt',null,racing),s2('receipt',null,racing)]);
 await admin();
 ok((await q("select count(*)::int n from private.outreach_team_notice_receipts where receipt_id=$1",[racing.receipt_id])).rows[0].n===1,'concurrent signed receipt replay stores one immutable receipt');
 ok((await q('select count(*)::int n from private.outreach_team_notice_receipt_bindings where intent_id=$1',[i4.id])).rows[0].n===1,'mixed-case result/receipt overlap binds receipt exactly once');
 const contradictory=await f.participant(),ci=await f.prepare(contradictory);await f.authorize(ci,contradictory,policy);
 const cl=await s1('claim'),cs=await s1('start',campaign,{intent_id:ci.id,lease_token:cl.lease_token}),ce=uuid();
 await s2('receipt',null,{...early,receipt_id:'msg_cross_identity',provider_email_id:uuid(),body_digest:'d'.repeat(64)});
 await s2('receipt',null,{...early,receipt_id:'msg_cross_identity',provider_email_id:ce,body_digest:'e'.repeat(64)});
 ok((await s1('result',campaign,{intent_id:ci.id,lease_token:cl.lease_token,attempt_id:cs.attempt_id,provider_email_id:ce})).state==='hold','contradictory receipt identity holds the later-bound conflicting provider ID');
 await as(owner);ok((await workspace('report')).intents.find(x=>x.id===ci.id).evidence_conflict,'redacted report retains cross-provider contradiction without a false delivery claim');
 const m5=await f.participant(),i5=await f.prepare(m5);
 const pre=await f.row(i5.id);ok((await s1('result',campaign,{intent_id:i5.id,provider_email_id:uuid()})).state==='stale','result before any committed start is rejected');
 const post=await f.row(i5.id);ok(pre.revision===post.revision&&post.provider_email_id===null,'prestart forgery changes no evidence or binding');
 await f.authorize(i5,m5,policy);const l5=await s1('claim');
 const holder=await db.connect();connections.push(holder);await holder.query('begin');await holder.query('select id from public.outreach_campaigns where id=$1 for update',[campaign]);
 await admin();await q("update private.outreach_team_notice_operators set expires_at=clock_timestamp()+interval '700 milliseconds' where campaign_id=$1 and user_id=$2",[campaign,owner]);
 const waiting=s1('start',campaign,{intent_id:i5.id,lease_token:l5.lease_token});let blocked=false;
 for(let x=0;x<100;x++){const result=await q("select wait_event_type='Lock' b from pg_stat_activity where pid=$1",[connections[2].processID]);if(result.rows[0]?.b){blocked=true;break}await new Promise(r=>setTimeout(r,10))}
 // Assert independently that the in-flight SQL is waiting, rather than infer from delay.
 if(!blocked){const r=await q("select count(*)::int n from pg_stat_activity where wait_event_type='Lock' and query like '%outreach_team_notice_worker%'");blocked=r.rows[0].n>0}
 ok(blocked,'authorized start observed waiting on campaign lock');
 for(let x=0;x<100;x++){if((await q("select expires_at<clock_timestamp() b from private.outreach_team_notice_operators where campaign_id=$1 and user_id=$2",[campaign,owner])).rows[0].b)break;await new Promise(r=>setTimeout(r,15))}
 await holder.query('commit');ok((await waiting).state==='hold','operator expiry during lock wait denies provider start');
 await admin();ok((await q('select count(*)::int n from private.outreach_team_notice_attempts where intent_id=$1',[i5.id])).rows[0].n===0,'expired blocked start leaves zero attempts');
 console.log(n+' independent native notification concurrency/recovery checks passed');
}finally{for(const c of connections)await c.end().catch(()=>{});await db.close()}
