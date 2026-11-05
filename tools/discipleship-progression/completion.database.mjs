import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {setupCompletion,fictionalProfile,observation,args,complete,counts,claims,U,S,B,BS} from './completion-fixture.mjs';
const native=process.env.TEST_NATIVE_PG==='1';
const db=native?await(await import('../backend-tests/local-postgres.mjs')).localPostgres():new(await import('../backend-tests/node_modules/@electric-sql/pglite/dist/index.js')).PGlite();
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
async function denied(label,prepare=async()=>{},transform=x=>x){
 await db.query('begin');try{await prepare();await db.query('savepoint attempt');await assert.rejects(()=>complete(db,transform([...base,base[4].slice()])));await db.query('rollback to attempt');ok(JSON.stringify(await counts(db))===JSON.stringify({progress:0,audit:0}),label+' denied without progress/audit');}finally{await db.query('rollback')}
}
let base,p,o;
try{
 await setupCompletion(db);
 if(process.env.WORKSHEET_EXTENSIONS==='1')for(const file of ['20261102193245_lesson_five_owned_worksheet.sql','20261102200549_lessons_six_to_eight_owned_worksheets.sql','20261102210907_lessons_nine_thirteen_owned_worksheets.sql','20261105194549_bound_progression_receipt_projection.sql'])await db.exec(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 ok((await db.query('select count(*)::int n from private.lesson_observer_profiles')).rows[0].n===0,'migration seeds no observer authority');
 p=await fictionalProfile(db);o=await observation(db,p);base=await args(db,p,[o.id]);
 await denied('default-disabled observer');
 p=(await db.query('update private.lesson_observer_profiles set enabled=true returning *')).rows[0];o=await observation(db,p);base=await args(db,p,[o.id]);
 for(const [name,index,value]of [['null worksheet',1,null],['old worksheet',1,randomUUID()],['null profile',2,null],['foreign profile',2,randomUUID()],['old profile revision',3,randomUUID()],['null observations',4,null],['empty observations',4,[]],['duplicate observation ID',4,[o.id,o.id]],['missing observation',4,[randomUUID()]],['null observation ID',4,[null]],['unsupported lesson5',0,5],['unsupported lesson13',0,13]])await denied(name,undefined,a=>{a[index]=value;return a});
 await denied('changed durable answer',()=>db.query("update lesson_answers set answer='' where user_id=$1 and question_number=1",[U]));
 await denied('missing durable answer',()=>db.query('delete from lesson_answers where user_id=$1 and question_number=1',[U]));
 await db.query('begin');await db.query("update lesson_answers set answer='' where user_id=$1 and question_number=1",[U]);const partial=await args(db,p,[o.id]);await db.query('savepoint incomplete');await assert.rejects(()=>complete(db,partial));await db.query('rollback to incomplete');ok((await counts(db)).audit===0,'fresh revision with19answers fails');await db.query('rollback');
 for(const [name,sql]of [['disabled observer','enabled=false'],['policy replacement',"policy_version='replacement'"],['media replacement',"media_id='replacement'"],['expired observer',"expires_at=now()-interval '1 minute'"],['future observer',"effective_at=now()+interval '1 minute'"],['key replacement',"public_key_sha256=repeat('c',64)"]])await denied(name,()=>db.exec('update private.lesson_observer_profiles set '+sql));
 await denied('revoked observation',()=>db.query('update private.lesson_watch_observations set revoked=true where id=$1',[o.id]));
 for(const [name,user,sid]of [['other account',B,BS],['foreign session',U,BS],['anonymous identity',null,S],['missing session',U,null],['malformed session',U,'bad']])await denied(name,()=>claims(db,user,sid));
 for(const [name,sql]of [['unverified',"update auth.users set email_confirmed_at=null where id='"+U+"'"],['anonymous',"update auth.users set is_anonymous=true where id='"+U+"'"],['banned',"update auth.users set banned_until=now()+interval '1 hour' where id='"+U+"'"],['deleted',"update auth.users set deleted_at=now() where id='"+U+"'"],['expired session',"update auth.sessions set not_after=now()-interval '1 second' where id='"+S+"'"],['revoked session',"delete from auth.sessions where id='"+S+"'"],['removed enrollment',"delete from course_enrollments where id=1"]])await denied(name,()=>db.exec(sql));
 // Each malformed source row is fictional; a real trusted ingester must reject it.
 for(const [name,overrides]of [['other user receipt',{user_id:B}],['other session receipt',{session_id:BS}],['replacement enrollment receipt',{enrollment_id:999}],['wrong lesson receipt',{lesson_number:2}],['wrong media receipt',{media_id:'wrong'}],['wrong video revision',{video_revision:'wrong'}],['wrong policy',{policy_version:'wrong'}],['old observer revision',{profile_revision:randomUUID()}],['under95percent',{end_ms:949}],['past duration',{end_ms:1001,elapsed_ms:1001}],['unelapsed playback',{observed_at:new Date(Date.now()-100),elapsed_ms:950}],['expired observation',{valid_until:new Date(Date.now()-1000)}],['beforeobserver effective',{observed_at:new Date(Date.now()-10800000)}]]){
  let bad;await denied(name,async()=>{bad=await observation(db,p,overrides)},a=>{a[4]=[bad.id];return a});
 }
 for(const [label,overrides]of [['ineligible playback',{eligible_playback:false}],['nonfinite observation',{observed_at:'-infinity'}],['nonfinite validity',{valid_until:'infinity'}],['duplicate provider receipt',{provider_receipt_id:o.provider_receipt_id}],['duplicate envelope',{envelope_sha256:o.envelope_sha256}]]){await assert.rejects(()=>observation(db,p,overrides));ok(true,label+' rejected at durable boundary')}
 let dup1,dup2;await denied('overlapping segments do not accumulate',async()=>{dup1=await observation(db,p,{end_ms:500,elapsed_ms:500});dup2=await observation(db,p,{start_ms:200,end_ms:700,elapsed_ms:500})},a=>{a[4]=[dup1.id,dup2.id];return a});
 for(const role of ['anon','authenticated','service_role']){
  await db.exec('set role '+role);await assert.rejects(()=>complete(db,base));ok(true,role+' cannot execute completion');
  for(const table of ['lesson_observer_profiles','lesson_watch_observations','trusted_lesson_completion_audit']){await assert.rejects(()=>db.query('select * from private.'+table));ok(true,role+' cannot read '+table)}
  await db.exec('reset role');
 }
 for(const [name,sql]of [['observation editing',`update private.lesson_watch_observations set end_ms=999 where id='${o.id}'`],['observation deletion',`delete from private.lesson_watch_observations where id='${o.id}'`],['observation truncate','truncate private.lesson_watch_observations']]){await assert.rejects(()=>db.exec(sql));ok(true,name+' blocked')}
 await denied('audit insertion failure rolls back progress',async()=>{await db.exec("create function private.test_fail_audit() returns trigger language plpgsql as $$begin raise exception 'fictional audit failure';end$$;create trigger test_fail_audit before insert on private.trusted_lesson_completion_audit for each row execute function private.test_fail_audit()");});
 // Existing browser-writable completion cannot supply proof or audit.
 await db.query("insert into lesson_progress(user_id,course_id,lesson_number,status)values($1,1,1,'completed')",[B]);ok((await counts(db)).audit===0,'legacy completion not trusted proof');await db.query('delete from lesson_progress');
 const result=await complete(db,base);ok(result.source==='trusted_lesson_completion_v1'&&result.uniqueWatchedMs===950&&result.durationMs===1000,'exact95percent and20durableanswers atomically complete');
 ok(JSON.stringify(await counts(db))===JSON.stringify({progress:1,audit:1}),'oneprogress andoneaudit committed');
 const audit=(await db.query('select * from private.trusted_lesson_completion_audit')).rows[0];
 ok(audit.user_id===U&&audit.session_id===S&&audit.worksheet_revision===base[1]&&audit.profile_id===p.id&&audit.profile_revision===p.revision,'audit binds actor/session/worksheet/currentobserver');
 ok(audit.observation_bindings[0].id===o.id&&audit.observation_bindings[0].envelopeSha256===o.envelope_sha256&&!JSON.stringify(audit).includes('FICTIONAL PRIVATE ANSWER'),'audit exact receipt hash andnoanswers');
 ok((await complete(db,base)).completionReceipt===result.completionReceipt&&(await counts(db)).audit===1,'duplicatecompletion idempotent');
 await db.query("update lesson_progress set status='in_progress' where user_id=$1",[U]);await complete(db,base);ok((await db.query('select status from lesson_progress where user_id=$1',[U])).rows[0].status==='in_progress','retry doesnot overwrite laterlegacyprogress');
 for(const sql of ['update private.trusted_lesson_completion_audit set unique_watched_ms=1000','delete from private.trusted_lesson_completion_audit','truncate private.trusted_lesson_completion_audit']){await assert.rejects(()=>db.exec(sql));ok(true,'completion audit immutable '+sql.split(' ')[0])}
 await db.query('update private.lesson_watch_observations set revoked=true where id=$1',[o.id]);await assert.rejects(()=>complete(db,base));ok((await counts(db)).audit===1,'revokedproof cannot replay historicalreceipt oraddsuccessaudit');
 await assert.rejects(()=>db.query('update private.lesson_watch_observations set revoked=false where id=$1',[o.id]));ok(true,'observation revocation irreversible');
 // Fresh independent evidence and worksheet generation exercise disjoint union.
 await db.query("update lesson_answers set answer='FICTIONAL CHANGED' where user_id=$1 and question_number=1",[U]);const left=await observation(db,p,{end_ms:500,elapsed_ms:500}),right=await observation(db,p,{start_ms:500,end_ms:950,elapsed_ms:450});base=await args(db,p,[right.id,left.id]);
 const union=await complete(db,base);ok(union.uniqueWatchedMs===950&&(await counts(db)).audit===2,'disjointunion andfreshworksheet auditablecompletion');
 if(native){
  const r=await db.connect(),w=await db.connect();await claims(r);await claims(w);
  await db.query("update lesson_answers set answer='concurrent fictional' where user_id=$1 and question_number=1",[U]);base=await args(db,p,[right.id,left.id]);
  const concurrent=await Promise.all([complete(r,base),complete(w,base)]);
  ok(concurrent[0].completionReceipt===concurrent[1].completionReceipt&&(await counts(db)).audit===3,'simultaneous exact completion commits one audit');
  const currentReceipt=concurrent[0].completionReceipt;
  const pid=(await w.query('select pg_backend_pid() n')).rows[0].n;
  async function waiting(){for(let i=0;i<200;i++){if((await db.query("select wait_event_type='Lock' w from pg_stat_activity where pid=$1",[pid])).rows[0]?.w)return true;await new Promise(f=>setTimeout(f,10))}return false}
  for(const [label,sql,params]of [['observer revocation','update private.lesson_observer_profiles set enabled=false where id=$1',[p.id]],['receipt revocation','update private.lesson_watch_observations set revoked=true where id=$1',[left.id]],['answer edit',"update lesson_answers set answer='writer' where user_id=$1 and question_number=1",[U]],['session retirement','delete from auth.sessions where id=$1',[S]]]){
   await r.query('begin');await complete(r,base);await w.query('begin');const pending=w.query(sql,params);ok(await waiting(),label+' waitsforcompletion transaction');await r.query('commit');await pending;await w.query('rollback');ok((await complete(r,base)).completionReceipt===currentReceipt,label+' rolledback writer leavesevidenceintact');
  }
  // Writer commits first; caller then cannot retain cached observer authority.
  await w.query('begin');await w.query('update private.lesson_observer_profiles set enabled=false where id=$1',[p.id]);const pending=complete(r,base);await new Promise(f=>setTimeout(f,100));await w.query('commit');await assert.rejects(()=>pending);ok((await counts(db)).audit===3,'committed observer revocation deniesblockedcompletion withoutaudit');
  // Deadline while waiting on legacy progress row rolls back new completion.
  p=(await db.query('update private.lesson_observer_profiles set enabled=true returning *')).rows[0];const fresh=await observation(db,p);await db.query("update lesson_answers set answer='fresh' where user_id=$1 and question_number=1",[U]);base=await args(db,p,[fresh.id]);
  await db.query("update auth.sessions set not_after=clock_timestamp()+interval '700 milliseconds' where id=$1",[S]);await w.query('begin');await w.query('select * from lesson_progress where user_id=$1 for update',[U]);const timed=complete(r,base);await new Promise(f=>setTimeout(f,900));await w.query('commit');await assert.rejects(()=>timed);ok((await counts(db)).audit===3,'expiry duringprogress lock rejectsatomicwrite andaudit');
 }
 console.log(JSON.stringify({checks,status:'PASS',engine:native?'native PostgreSQL':'PGlite; concurrency NOT RUN',providerEvidence:'FICTIONAL ONLY'}));
}finally{await db.close()}
