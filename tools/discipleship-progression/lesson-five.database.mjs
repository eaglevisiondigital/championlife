// Synthetic identities; disposable database only. No provider evidence.
import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import{setupCompletion,claims,U,S,B,BS}from'./completion-fixture.mjs';
const native=process.env.TEST_NATIVE_PG==='1',db=native?await(await import('../backend-tests/local-postgres.mjs')).localPostgres():new(await import('../backend-tests/node_modules/@electric-sql/pglite/dist/index.js')).PGlite();
const sql=readFileSync(new URL('../../supabase/migrations/20261102193245_lesson_five_owned_worksheet.sql',import.meta.url),'utf8');
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
const rpc=async(c=db,l=5,v=null,a=null)=>(await c.query('select public.owned_worksheet_transaction($1,$2,$3) r',[l,v,a===null?null:JSON.stringify(a)])).rows[0].r;
const arr=n=>Array.from({length:n},(_,i)=>({question:i+1,answer:`FICTIONAL GROUP ${i+1}`}));
try{
 await setupCompletion(db);
 for(const [label,change] of [
  ['source',"create or replace function private.worksheet_enrollment_versions() returns trigger language plpgsql security definer set search_path='' as $$begin return null;end$$"],
  ['constraint',"alter table private.worksheet_versions drop constraint worksheet_versions_lesson_number_check;alter table private.worksheet_versions add constraint worksheet_versions_lesson_number_check check(lesson_number between 1 and 6)"]]){
  await db.exec('begin');await db.exec(change);await db.exec('savepoint guard');await assert.rejects(()=>db.exec(sql),e=>e.code==='55000');await db.exec('rollback to guard');ok((await db.query('select count(*)::int n from private.worksheet_versions where lesson_number=5')).rows[0].n===0,label+' drift rejected before new version state');await db.exec('rollback');
 }

 const before=JSON.stringify((await db.query('select * from lesson_answers order by id')).rows);
 const policies=JSON.stringify((await db.query("select * from pg_policies where tablename='lesson_answers' order by policyname")).rows);
 await db.query("insert into lesson_answers(user_id,course_id,lesson_number,question_number,answer)values($1,1,5,1,'UNMAPPED LEGACY')",[U]);
 await assert.rejects(()=>db.exec(sql),e=>e.code==='55000');ok(true,'installation refuses unreviewed existing lesson5 answer mapping');
 ok((await db.query('select answer from lesson_answers where lesson_number=5')).rows[0].answer==='UNMAPPED LEGACY','guard preserves unknown historical answer');
 await db.query('delete from lesson_answers where lesson_number=5');await db.exec(sql);
 ok(JSON.stringify((await db.query('select * from lesson_answers order by id')).rows)===before,'existing answers preserved byte-for-byte');
 ok(JSON.stringify((await db.query("select * from pg_policies where tablename='lesson_answers' order by policyname")).rows)===policies,'answer RLS policies unchanged');
 await db.exec('set role authenticated');await claims(db);
 let r=await rpc();ok(r.answers.length===0&&r.requiredQuestions===10&&r.savedNonblankAnswers===0&&!r.canComplete&&!r.canCommit,'blank owned worksheet cannot complete');
 let old=r.revision;r=await rpc(db,5,r.revision,arr(9));ok(r.answers.length===9&&r.savedNonblankAnswers===9&&!r.allRequiredAnswersSaved,'nine saved groups not all ten');
 await assert.rejects(()=>rpc(db,5,old,arr(10)),e=>e.code==='40001');ok(true,'stale save denied');
 r=await rpc(db,5,r.revision,[{question:10,answer:'FICTIONAL LAST'}]);ok(r.allRequiredAnswersSaved&&!r.canComplete&&!r.canCommit,'ten saved groups still no completion authority');
 ok((await rpc()).answers[9].answer==='FICTIONAL LAST','reload durable saved responses');
 for(const [revision,answers]of [[null,arr(1)],['bad',arr(1)],[r.revision,[{question:11,answer:'x'}]],[r.revision,[{question:1,answer:'x'},{question:1,answer:'y'}]],[r.revision,[{question:1,answer:'x',user_id:B}]]]){await assert.rejects(()=>rpc(db,5,revision,answers));ok(true,'invalid mutation rejected')}
 for(const lesson of [0,6,13]){await assert.rejects(()=>rpc(db,lesson));ok(true,'unconfigured worksheet denied '+lesson)}
 await claims(db,B,BS);ok((await rpc()).answers.length===0,'B sees none of A responses');await assert.rejects(()=>rpc(db,5,r.revision,arr(1)));ok(true,'A revision cannot save as B');await claims(db);
 ok((await db.query('select * from lesson_answers where user_id=$1',[B])).rows.length===0,'existing direct RLS still isolates learner');
 await assert.rejects(()=>db.query('select * from private.worksheet_versions'));ok(true,'no new version-store grant');
 await db.exec('reset role');
 ok((await db.query('select count(*)::int n from lesson_progress')).rows[0].n===0&&(await db.query('select count(*)::int n from private.trusted_lesson_completion_audit')).rows[0].n===0,'no progress/completion/audit fabricated');
 await assert.rejects(()=>db.query("insert into private.lesson_observer_profiles(lesson_number)values(5)"));ok(true,'trusted observation profile remains unavailable for lesson5');
 await db.query("update auth.users set email_confirmed_at=null where id=$1",[U]);await assert.rejects(()=>rpc());ok(true,'unverified learner denied');await db.query('update auth.users set email_confirmed_at=now() where id=$1',[U]);
 await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[S]);await assert.rejects(()=>rpc());ok(true,'expired session denied');await db.query('update auth.sessions set not_after=null where id=$1',[S]);
 await db.query('begin');await db.exec("create function private.fail_lesson5()returns trigger language plpgsql as $$begin raise exception 'fictional failure';end$$;create trigger fail_lesson5 before insert or update on lesson_answers for each row execute function private.fail_lesson5();");await db.query('savepoint trial');await assert.rejects(()=>rpc(db,5,r.revision,arr(10)));await db.query('rollback to trial');ok((await rpc()).revision===r.revision,'transaction failure cannot partially change revision/answers');await db.query('rollback');
 await db.exec('set role authenticated');ok((await rpc(db,1)).requiredQuestions===20,'existing lesson1 twenty-answer behavior intact');await db.exec('reset role');
 if(native){
  const a=await db.connect(),b=await db.connect();await claims(a);await claims(b);const v=(await rpc()).revision;
  const results=await Promise.allSettled([rpc(a,5,v,[{question:1,answer:'ONE'}]),rpc(b,5,v,[{question:1,answer:'TWO'}])]);
  ok(results.filter(r=>r.status==='fulfilled').length===1&&results.filter(r=>r.status==='rejected'&&r.reason.code==='40001').length===1,'parallel same-version saves exactly one winner');
  await a.query('begin');await rpc(a);const pending=b.query('delete from auth.sessions where id=$1',[S]);await new Promise(r=>setTimeout(r,80));await a.query('commit');await pending;await assert.rejects(()=>rpc());ok(true,'committed session retirement prevents later read/save');
 }
 console.log(JSON.stringify({checks,status:'PASS',engine:native?'native PostgreSQL':'PGlite',providerEvidence:false}));
}finally{await db.close()}
