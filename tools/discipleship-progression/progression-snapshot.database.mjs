// Synthetic claims only. PGlite proves SQL semantics; native mode also proves locks.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewProgression,COURSE} from './evidence-review.mjs';
const native=process.env.TEST_NATIVE_PG==='1';
const db=native?await(await import('../backend-tests/local-postgres.mjs')).localPostgres():new(await import('../backend-tests/node_modules/@electric-sql/pglite/dist/index.js')).PGlite();
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',sa='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',sb='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const owner=()=>db.exec('reset role');
async function as(user=a,sid=sa,role='authenticated',client=db){await client.query('reset role');await client.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user,JSON.stringify({session_id:sid})]);await client.query('set role '+role)}
const snapshot=async(client=db,lesson=1)=>(await client.query('select public.owned_progression_snapshot($1) r',[lesson])).rows[0].r;
async function deny(fn,m){await assert.rejects(fn);ok(true,m)}
try{
 await db.exec(read('../backend-tests/fixtures/supabase-test-bootstrap.sql'));
 await db.exec("alter table auth.users add column deleted_at timestamptz,add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;");
 await db.exec(read('../../supabase/bootstrap/automatic-rls.sql'));
 for(const f of ['20260923114743_create_course_progress_schema.sql','20260923114822_harden_course_security_and_indexes.sql','20260923115706_grant_authenticated_course_api_access.sql','20260923115732_restrict_authenticated_course_privileges.sql','20261101165620_prepare_owned_worksheet_transactions.sql','20261101231330_owned_progression_snapshot.sql'])await db.exec(read('../../supabase/migrations/'+f));
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'a@example.test',now()),($2,'b@example.test',now())",[a,b]);
 await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4)',[sa,a,sb,b]);
 await db.query('insert into course_enrollments(user_id,course_id) values($1,1),($2,1)',[a,b]);
 await db.query("insert into lesson_answers(user_id,course_id,lesson_number,question_number,answer) select $1,1,1,q,'FICTIONAL PRIVATE ANSWER' from generate_series(1,20) q",[a]);
 await as();let r=await snapshot();
 ok(r.userId===a&&r.sessionId===sa&&r.answerReceipt.userId===a&&r.answerReceipt.sessionId===sa,'SQL binds snapshot and nested receipt to current learner/session');
 ok(r.enrollmentId===r.answerReceipt.enrollmentId&&r.worksheetRevision===r.answerReceipt.receipt.revision,'locked enrollment and opaque revision agree');
 ok(r.answerReceipt.receipt.savedNonblankAnswers===20&&r.answerReceipt.receipt.allRequiredAnswersSaved,'actual twenty saved answers projected');
 ok(!JSON.stringify(r).includes('FICTIONAL PRIVATE ANSWER')&&!Object.hasOwn(r,'revision'),'no answer text or shared allocation counter exposed');
 ok(r.canComplete===false&&r.canCommit===false&&r.playbackStatus==='observer_unconfigured','no fictional playback or completion authority');
 ok(JSON.stringify(await snapshot())===JSON.stringify(r),'read does not allocate a new version');
 const review=await reviewProgression({userId:a,sessionId:sa,course:COURSE,lesson:1},{withCurrentEvidence:async(_,f)=>f({...r,sessionActive:true,enrolled:true,revision:1,videoApproved:false})});
 ok(review.reason==='media_unavailable'&&!review.completionEvidence&&!review.canCommit,'actual snapshot cannot satisfy playback gate');
 // Synthetic media is used only to check compatibility of the real SQL answer bridge.
 const evidence=await reviewProgression({userId:a,sessionId:sa,course:COURSE,lesson:1},{withCurrentEvidence:async(_,f)=>f({...r,sessionActive:true,enrolled:true,revision:1,videoApproved:true,videoRevision:'fictional',durationMs:100,watchReceipts:[]})});
 ok(evidence.answerRequirementMet&&!evidence.completionEvidence,'SQL projection matches accepted opaque answer gate without watch credit');
 await as(b,sb);const other=await snapshot();ok(other.userId===b&&other.answerReceipt.receipt.savedNonblankAnswers===0,'different account sees only own answer count');
 await as();const before=r.worksheetRevision;await db.query("update lesson_answers set answer='',updated_at='2000-01-01' where user_id=$1 and question_number=1",[a]);r=await snapshot();
 ok(r.worksheetRevision!==before&&r.answerReceipt.receipt.savedNonblankAnswers===19,'legacy edit invalidates exact durable projection');
 for(const lesson of [null,0,5,10,11,13])await deny(()=>snapshot(db,lesson),'unsupported cloud lesson denied '+lesson);
 for(const [user,sid,label]of [[a,null,'missing session'],[a,sb,'foreign session'],[a,'bad','malformed session'],[null,sa,'missing learner']]){await as(user,sid);await deny(()=>snapshot(),label+' denied')}
 for(const role of ['anon','service_role']){await as(a,sa,role);await deny(()=>snapshot(),role+' cannot call public snapshot');await deny(()=>db.query('select private.owned_progression_snapshot(1)'),role+' cannot bypass private wrapper')}
 await as();ok((await db.query('select private.owned_progression_snapshot(1) r')).rows[0].r.userId===a,'private entry preserves same checks');
 await deny(()=>db.query('select * from private.worksheet_versions'),'private ledger table inaccessible');
 for(const [field,value,restore]of [['email_confirmed_at','null','now()'],['is_anonymous','true','false'],['banned_until',"now()+interval '1 hour'",'null'],['deleted_at','now()','null']]){await owner();await db.exec(`update auth.users set ${field}=${value} where id='${a}'`);await as();await deny(()=>snapshot(),'current Auth restriction '+field);await owner();await db.exec(`update auth.users set ${field}=${restore} where id='${a}'`)}
 await owner();await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[sa]);await as();await deny(()=>snapshot(),'expired session denied');await owner();await db.query('update auth.sessions set not_after=null where id=$1',[sa]);
 await as();const old=(await snapshot()).enrollmentId;await owner();await db.query('delete from course_enrollments where user_id=$1',[a]);await as();await deny(()=>snapshot(),'removed enrollment denied');await owner();await db.query('insert into course_enrollments(user_id,course_id) values($1,1)',[a]);await as();r=await snapshot();ok(r.enrollmentId!==old&&r.worksheetRevision!==before,'replacement enrollment has fresh binding');
 await owner();ok((await db.query('select count(*)::int n from lesson_progress')).rows[0].n===0,'snapshot never writes progress');
 for(const schema of ['public','private']){const acl=(await db.query("select has_function_privilege('anon',$1,'EXECUTE') a,has_function_privilege('service_role',$1,'EXECUTE') s,has_function_privilege('authenticated',$1,'EXECUTE') u",[schema+'.owned_progression_snapshot(integer)'])).rows[0];ok(!acl.a&&!acl.s&&acl.u,schema+' exact function ACL')}
 if(native){
  const reader=await db.connect(),writer=await db.connect();await as(a,sa,'authenticated',reader);await reader.query('begin');await snapshot(reader);
  const pid=(await writer.query('select pg_backend_pid() n')).rows[0].n;
  const pending=writer.query('delete from auth.sessions where id=$1',[sa]);
  let waiting=false;for(let i=0;i<100;i++){waiting=(await db.query("select wait_event_type='Lock' w from pg_stat_activity where pid=$1",[pid])).rows[0]?.w;if(waiting)break;await new Promise(r=>setTimeout(r,10))}
  ok(waiting,'snapshot holds existing Auth session lock until transaction end');await reader.query('commit');await pending;
  await deny(()=>snapshot(reader),'completed concurrent revocation denies next snapshot');
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sa,a]);await reader.query('begin');const locked=await snapshot(reader);
  const edit=writer.query("update lesson_answers set answer='changed after snapshot' where user_id=$1 and question_number=2",[a]);
  waiting=false;for(let i=0;i<100;i++){waiting=(await db.query("select wait_event_type='Lock' w from pg_stat_activity where pid=$1",[pid])).rows[0]?.w;if(waiting)break;await new Promise(r=>setTimeout(r,10))}
  ok(waiting,'legacy answer mutation shares snapshot transaction mutex');await reader.query('commit');await edit;ok((await snapshot(reader)).worksheetRevision!==locked.worksheetRevision,'committed legacy writer invalidates subsequent snapshot');
 }
 console.log(JSON.stringify({checks,status:'PASS',engine:native?'native PostgreSQL':'PGlite; concurrency NOT RUN'}));
}finally{await db.close()}
