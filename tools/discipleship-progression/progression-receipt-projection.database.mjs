// Exact accepted migration composition; fictional learners, local database only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setupCompletion,claims,U,S,B,BS,counts} from './completion-fixture.mjs';
import {WORKSHEET_CONTRACTS} from './worksheet-contracts.mjs';
const native=process.env.TEST_NATIVE_PG==='1';
const db=native?await(await import('../backend-tests/local-postgres.mjs')).localPostgres():new(await import('../backend-tests/node_modules/@electric-sql/pglite/dist/index.js')).PGlite();
const sql=readFileSync(new URL('../../supabase/migrations/20261105194549_bound_progression_receipt_projection.sql',import.meta.url),'utf8');
const readMigration=f=>readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8');
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
const snapshot=async(lesson=13,client=db)=>(await client.query('select public.owned_progression_snapshot($1) r',[lesson])).rows[0].r;
const source=async()=>(await db.query("select prosrc from pg_proc where oid='private.owned_progression_snapshot(integer)'::regprocedure")).rows[0].prosrc;
async function as(user=U,sid=S,client=db){await client.exec?.('reset role');if(!client.exec)await client.query('reset role');await claims(client,user,sid);await client.query('set role authenticated');}
const receiptKeys=['status','course','lesson','revision','savedNonblankAnswers','requiredQuestions','allRequiredAnswersSaved','canComplete','canCommit'];
try{
 await setupCompletion(db);
 for(const f of ['20261102193245_lesson_five_owned_worksheet.sql','20261102200549_lessons_six_to_eight_owned_worksheets.sql','20261102210907_lessons_nine_thirteen_owned_worksheets.sql'])await db.exec(readMigration(f));
 for(let lesson=2;lesson<=13;lesson++)await db.query("insert into lesson_answers(user_id,course_id,lesson_number,question_number,answer) select $1,1,$2::integer,q,'FICTIONAL PRIVATE '||($2::integer)::text||' ANSWER '||q from generate_series(1,$3::integer)q",[U,lesson,WORKSHEET_CONTRACTS[lesson].questions.length]);
 const before=await source();
 await as();const original=await snapshot();ok(original.answerReceipt.receipt.answers?.length===4,'original composed snapshot reproduces raw Lesson13 answers');await db.exec('reset role');
 // Failed or rolled-back installation must preserve source and legitimate data.
 await db.query('begin');await db.exec(sql);ok((await source())!==before,'guarded forward correction installs inside local transaction');await db.query('rollback');ok((await source())===before,'migration rollback restores original definition without touching learner data');
 for(const [name,mutation]of [
  ['missing exact extended dependency',"alter function private.owned_worksheet_transaction(integer,text,jsonb) rename to unavailable_worksheet"],
  ['PUBLIC execution expansion',"grant execute on function private.owned_progression_snapshot(integer) to public"],
  ['grant option expansion',"grant execute on function private.owned_progression_snapshot(integer) to authenticated with grant option"],
  ['definer drift',"alter function private.owned_progression_snapshot(integer) security invoker"],
  ['search path drift',"alter function private.owned_progression_snapshot(integer) set search_path=public"],
  ['source drift',"create or replace function public.owned_progression_snapshot(p_lesson integer) returns jsonb language sql security invoker set search_path='' as $$select '{}'::jsonb$$"]
 ]){
  await db.query('begin');await db.exec(mutation);await db.query('savepoint install');await assert.rejects(()=>db.exec(sql),e=>e.code==='55000');await db.query('rollback to install');ok((await source())===before,name+' blocks correction without overwriting source');await db.query('rollback');
 }
 const answerBefore=(await db.query('select user_id,course_id,lesson_number,question_number,answer,updated_at from lesson_answers order by user_id,course_id,lesson_number,question_number')).rows;
 const authorityBefore=(await db.query("select n.nspname,p.proname,p.proowner,p.proacl,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid in ('private.owned_progression_snapshot(integer)'::regprocedure,'public.owned_progression_snapshot(integer)'::regprocedure,'private.owned_worksheet_transaction(integer,text,jsonb)'::regprocedure) order by 1,2")).rows;
 await db.query('begin');await db.exec(sql);await db.query('commit');
 ok(JSON.stringify(authorityBefore)===JSON.stringify((await db.query("select n.nspname,p.proname,p.proowner,p.proacl,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid in ('private.owned_progression_snapshot(integer)'::regprocedure,'public.owned_progression_snapshot(integer)'::regprocedure,'private.owned_worksheet_transaction(integer,text,jsonb)'::regprocedure) order by 1,2")).rows),'owners, function ACLs, invoker/definer and fixed paths unchanged');
 ok(JSON.stringify(answerBefore)===JSON.stringify((await db.query('select user_id,course_id,lesson_number,question_number,answer,updated_at from lesson_answers order by user_id,course_id,lesson_number,question_number')).rows),'all legitimate answers and timestamps preserved');
 await as();
 for(let lesson=1;lesson<=13;lesson++){
  const r=await snapshot(lesson),a=r.answerReceipt,t=a.receipt,c=WORKSHEET_CONTRACTS[lesson];
  ok(r.userId===U&&r.sessionId===S&&a.userId===U&&a.sessionId===S&&r.enrollmentId===a.enrollmentId&&r.worksheetRevision===t.revision,'lesson '+lesson+' exact current owner/session/enrollment/revision');
  ok(t.lesson===lesson&&t.requiredQuestions===c.questions.length&&t.savedNonblankAnswers===c.questions.length&&t.allRequiredAnswersSaved===true,'lesson '+lesson+' exact approved count and complete saved-answer status');
  ok(JSON.stringify(Object.keys(t).sort())===JSON.stringify([...receiptKeys,...(lesson>=5?['worksheet']:[])].sort())&&!JSON.stringify(r).includes('FICTIONAL PRIVATE')&&!Object.hasOwn(t,'answers'),'lesson '+lesson+' metadata allowlist has no answer bodies');
  ok(lesson<=4?!Object.hasOwn(t,'worksheet'):t.worksheet===c.worksheet,'lesson '+lesson+' exact worksheet discriminator');
  ok(r.playbackStatus==='observer_unconfigured'&&r.canComplete===false&&r.canCommit===false&&t.canComplete===false&&t.canCommit===false,'lesson '+lesson+' never certifies playback/completion');
  const again=await snapshot(lesson);ok(JSON.stringify(again)===JSON.stringify(r),'lesson '+lesson+' repeated read has no version allocation');
 }
 const raw=(await db.query('select public.owned_worksheet_transaction(13,null,null) r')).rows[0].r;ok(raw.answers.length===4&&raw.answers[0].answer.startsWith('FICTIONAL PRIVATE'),'ordinary worksheet reload still returns own legitimate answers');
 const prior=await snapshot();await db.query("update lesson_answers set answer='' where user_id=$1 and lesson_number=13 and question_number=1",[U]);const changed=await snapshot();ok(prior.worksheetRevision!==changed.worksheetRevision&&changed.answerReceipt.receipt.savedNonblankAnswers===3&&!changed.answerReceipt.receipt.allRequiredAnswersSaved,'legacy answer edit retires receipt revision and truthful saved count');
 await as(B,BS);const other=await snapshot();ok(other.userId===B&&other.sessionId===BS&&other.answerReceipt.receipt.savedNonblankAnswers===0&&!JSON.stringify(other).includes(U),'account B receives only its own empty receipt');
 await as();ok((await snapshot()).worksheetRevision===changed.worksheetRevision,'A to B to A restores only A receipt');
 for(const [user,sid,label]of [[null,S,'anonymous'],[U,BS,'foreign session'],[U,null,'missing session']]){await as(user,sid);await assert.rejects(()=>snapshot(),e=>e.code==='42501');ok(true,label+' blocked')}
 await db.exec('reset role');await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[S]);await as();await assert.rejects(()=>snapshot(),e=>e.code==='42501');ok(true,'expired session blocked');await db.exec('reset role');await db.query('update auth.sessions set not_after=null where id=$1',[S]);
 for(const role of ['anon','service_role']){await db.exec('set role '+role);await assert.rejects(()=>snapshot(),e=>e.code==='42501');ok(true,role+' denied snapshot');await db.exec('reset role')}
 const oldEnrollment=changed.enrollmentId;await db.query('delete from course_enrollments where user_id=$1',[U]);await as();await assert.rejects(()=>snapshot(),e=>e.code==='42501');ok(true,'removed enrollment denied');await db.exec('reset role');await db.query('insert into course_enrollments(user_id,course_id)values($1,1)',[U]);await as();const replacement=await snapshot();ok(replacement.enrollmentId!==oldEnrollment&&replacement.worksheetRevision!==changed.worksheetRevision,'recreated enrollment cannot reuse old receipt binding');await db.exec('reset role');
 ok(JSON.stringify(await counts(db))===JSON.stringify({progress:0,audit:0}),'receipt-only reads create no progress or certified completion audit');
 if(native){
  const reader=await db.connect(),writer=await db.connect();await as(U,S,reader);await reader.query('begin');const locked=await snapshot(13,reader);const pid=(await writer.query('select pg_backend_pid() n')).rows[0].n;
  const wait=async()=>{for(let i=0;i<200;i++){if((await db.query("select wait_event_type='Lock' w from pg_stat_activity where pid=$1",[pid])).rows[0]?.w)return true;await new Promise(r=>setTimeout(r,10))}return false};
  const edit=writer.query("update lesson_answers set answer='FICTIONAL REPLACEMENT' where user_id=$1 and lesson_number=13 and question_number=2",[U]);ok(await wait(),'Lesson13 receipt holds legacy answer mutation mutex');await reader.query('commit');await edit;const fresh=await snapshot(13,reader);ok(fresh.worksheetRevision!==locked.worksheetRevision&&!JSON.stringify(fresh).includes('FICTIONAL REPLACEMENT'),'concurrent edit replaces metadata receipt without exposing new text');
  await reader.query('begin');await snapshot(13,reader);const revoke=writer.query('delete from auth.sessions where id=$1',[S]);ok(await wait(),'Lesson13 snapshot serializes session revocation');await reader.query('commit');await revoke;await assert.rejects(()=>snapshot(13,reader),e=>e.code==='42501');ok(true,'completed session revocation denies fresh receipt');
 }
 console.log(JSON.stringify({status:'PASS',checks,engine:native?'native PostgreSQL':'PGlite',providerEvidence:'NONE',hosted:'NOT RUN'}));
}finally{await db.close()}
