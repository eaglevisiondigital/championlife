// Disposable native PostgreSQL; all users, sessions, claims and answers fictional.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
const db=await localPostgres();let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',sa='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',sb='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sql=path=>readFileSync(new URL(path,import.meta.url),'utf8');
async function session(user=a,sid=sa){const c=await db.connect();await c.query('set role authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user,JSON.stringify({session_id:sid})]);return c}
const rpc=async(c,l=1,v=null,answers=null)=>(await c.query('select public.owned_worksheet_transaction($1,$2,$3) r',[l,v,answers===null?null:JSON.stringify(answers)])).rows[0].r;
const deny=async(fn,code,m)=>{await assert.rejects(fn,e=>e.code===code);ok(true,m)};
const answer=(question=1,answer='fictional private answer')=>({question,answer});
async function blocked(c){const pid=(await c.query('select pg_backend_pid() n')).rows[0].n;return pid}
async function waitLock(pid){for(let i=0;i<100;i++){if((await db.query("select wait_event_type='Lock' waiting from pg_stat_activity where pid=$1",[pid])).rows[0]?.waiting)return;await new Promise(r=>setTimeout(r,10))}throw Error('expected lock wait')}
try{
 await db.exec(sql('../backend-tests/fixtures/supabase-test-bootstrap.sql'));
 await db.exec("alter table auth.users add column deleted_at timestamptz,add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;");
 await db.exec(sql('../../supabase/bootstrap/automatic-rls.sql'));
 for(const f of ['20260923114743_create_course_progress_schema.sql','20260923114822_harden_course_security_and_indexes.sql','20260923115706_grant_authenticated_course_api_access.sql','20260923115732_restrict_authenticated_course_privileges.sql'])await db.exec(sql('../../supabase/migrations/'+f));
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'a@example.test',now()),($2,'b@example.test',now());",[a,b]);
 await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4)',[sa,a,sb,b]);
 await db.query('insert into course_enrollments(user_id,course_id) values($1,1),($2,1)',[a,b]);
 await db.query("insert into lesson_answers(user_id,course_id,lesson_number,question_number,answer) values($1,1,1,1,'preserved A'),($2,1,1,1,'preserved B')",[a,b]);
 await db.query("insert into lesson_progress(user_id,course_id,lesson_number,status) values($1,1,1,'in_progress')",[a]);
 await db.exec(sql('../../supabase/migrations/20261101165620_prepare_owned_worksheet_transactions.sql'));
 const c=await session(),other=await session(b,sb);
 let r=await rpc(c);ok(r.status==='available'&&r.savedNonblankAnswers===1&&/^\d+$/.test(r.revision),'existing enrolled answers receive server version');
 ok(!JSON.stringify(r).includes('preserved')&&r.canComplete===false&&r.canCommit===false,'receipt excludes raw answers and completion');
 const initial=r.revision; r=await rpc(c,1,initial,[answer(2)]);ok(r.savedNonblankAnswers===2&&r.revision!==initial,'atomic owner save preserves prior question');
 ok((await db.query('select answer from lesson_answers where user_id=$1 and question_number=1',[b])).rows[0].answer==='preserved B','other account answers unchanged');
 await deny(()=>rpc(c,1,initial,[answer(2,'replay')]),'40001','duplicate/response-lost retry conflicts rather than claiming success');
 for(const v of [null,'','0','-1','1.5','01','999999999999999999999'])await deny(()=>rpc(c,1,v,[answer()]),'40001','malformed/stale revision rejected '+JSON.stringify(v));
 for(const input of [[],[answer(),answer()], [{question:21,answer:'x'}],[{question:1,user_id:b,answer:'x'}],[{question:1,answer:null}],{},[{question:'1',answer:'x'}]])await deny(()=>rpc(c,1,r.revision,input),'22023','malformed question payload rejected '+JSON.stringify(input));
 for(const lesson of [0,5,13])await deny(()=>rpc(c,lesson),'22023','unsupported cloud worksheet '+lesson);
 await deny(()=>c.query('update private.worksheet_versions set revision=1'),'42501','private revision cannot be forged');
 await deny(()=>c.query("update lesson_answers set user_id=$1 where user_id=$2",[b,a]),'42501','answer ownership cannot change');
 await deny(()=>c.query('update course_enrollments set course_id=99 where user_id=$1',[a]),'42501','enrollment identity cannot change');
 await deny(()=>c.query('select * from private.worksheet_versions'),'42501','private metadata inaccessible');
 await deny(()=>c.query('delete from lesson_answers where user_id=$1',[a]),'42501','legacy delete privilege not expanded');
 const old=r.revision;await c.query("update lesson_answers set answer='legacy private edit',updated_at='2000-01-01' where user_id=$1 and question_number=1",[a]);
 r=await rpc(c);ok(r.revision!==old,'legacy direct update bumps server-owned revision despite forged updated_at');
 await deny(()=>rpc(c,1,old,[answer()]),'40001','legacy edit invalidates prior CAS');
 const beforeDelete=r.revision;await db.query('delete from lesson_answers where user_id=$1 and question_number=2',[a]);r=await rpc(c);ok(r.revision!==beforeDelete&&r.savedNonblankAnswers===1,'privileged delete invalidates receipt');
 const prior=r.revision;await db.query('delete from course_enrollments where user_id=$1',[a]);await deny(()=>rpc(c),'42501','unenrolled owner has no receipt');
 await db.query('insert into course_enrollments(user_id,course_id) values($1,1)',[a]);r=await rpc(c);ok(r.revision!==prior,'enrollment replacement cannot reset version ABA');
 await deny(()=>rpc(c,1,prior,[answer()]),'40001','old enrollment receipt rejected');
 const snap=JSON.stringify((await db.query('select * from lesson_answers order by id')).rows);const ver=r.revision;
 await db.exec("create function public.synthetic_fail() returns trigger language plpgsql as $$begin if new.answer='FAIL' then raise exception 'synthetic failure';end if;return new;end$$;create trigger synthetic_fail before insert or update on lesson_answers for each row execute function public.synthetic_fail();");
 await deny(()=>rpc(c,1,ver,[answer(2,'would change'),answer(3,'FAIL')]),'P0001','partial batch error rolls back all writes');
 ok(JSON.stringify((await db.query('select * from lesson_answers order by id')).rows)===snap&&(await rpc(c)).revision===ver,'failed transaction restores answers and revision');
 await db.exec('drop trigger synthetic_fail on lesson_answers;drop function public.synthetic_fail()');
 const missing=await session(a,null);await deny(()=>rpc(missing),'42501','missing session rejected');
 const wrong=await session(a,sb);await deny(()=>rpc(wrong),'42501','other account session rejected');
 for(const [field,value,restore]of [['email_confirmed_at','null','now()'],['is_anonymous','true','false'],['banned_until',"now()+interval '1 hour'",'null'],['deleted_at','now()','null']]){await db.exec(`update auth.users set ${field}=${value} where id='${a}'`);await deny(()=>rpc(c),'42501','current Auth restriction '+field);await db.exec(`update auth.users set ${field}=${restore} where id='${a}'`)}
 await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[sa]);await deny(()=>rpc(c),'42501','expired session rejected');await db.query('update auth.sessions set not_after=null where id=$1',[sa]);
 // Two same-version requests serialize; exactly one writes.
 const concurrent=await session();const cv=(await rpc(c)).revision;
 const results=await Promise.allSettled([rpc(c,1,cv,[answer(4,'one')]),rpc(concurrent,1,cv,[answer(4,'two')])]);
 ok(results.filter(x=>x.status==='fulfilled').length===1&&results.filter(x=>x.status==='rejected'&&x.reason.code==='40001').length===1,'concurrent same-version writes have one winner');
 // Privileged legacy mutation blocks the RPC before it observes the revision.
 const holder=await db.connect();await holder.query('begin');await holder.query("update lesson_answers set answer='held legacy' where user_id=$1 and question_number=1",[a]);
 const current=(await db.query('select revision::text r from private.worksheet_versions v join course_enrollments e on e.id=v.enrollment_id where e.user_id=$1 and lesson_number=1',[a])).rows[0].r;
 const pid=await blocked(c);const pending=rpc(c,1,current,[answer(5)]).then(v=>({v}),e=>({e}));await waitLock(pid);await holder.query('commit');ok((await pending).e?.code==='40001','RPC waiter rejects after committed legacy update');
 // Session expiry while waiting is evaluated at completion, not transaction start.
 await db.query("update auth.sessions set not_after=clock_timestamp()+interval '250 milliseconds' where id=$1",[sa]);
 await holder.query('begin');await holder.query('select pg_advisory_xact_lock(261101,56001)');const expiry=rpc(c).then(v=>({v}),e=>({e}));await waitLock(pid);await new Promise(r=>setTimeout(r,300));await holder.query('commit');ok((await expiry).e?.code==='42501','expiry during wait denies receipt');await db.query('update auth.sessions set not_after=null where id=$1',[sa]);
 // Auth session delete cannot complete while an authorized transaction uses it.
 await c.query('begin');await rpc(c);const revoker=await db.connect(),revpid=await blocked(revoker);const revoked=revoker.query('delete from auth.sessions where id=$1',[sa]);await waitLock(revpid);await c.query('commit');await revoked;await deny(()=>rpc(c),'42501','completed session revocation prevents further requests');
 await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sa,a]);
 // Repeatable Read retains old snapshot but locked deleted session forces retry.
 await c.query('begin isolation level repeatable read');await c.query('select count(*) from courses');await db.query('delete from auth.sessions where id=$1',[sa]);await deny(()=>rpc(c),'40001','repeatable-read stale session cannot authorize');await c.query('rollback');await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sa,a]);
 const bview=await rpc(other);ok(bview.savedNonblankAnswers===1,'independent learner remains available');
 ok((await db.query('select status from lesson_progress where user_id=$1',[a])).rows[0].status==='in_progress','progress unchanged; no fabricated completion');
 ok((await c.query('select * from lesson_answers where user_id=$1',[b])).rows.length===0,'existing answer RLS remains authoritative');

 // Direct private entry has identical checks, not an alternate authority path.
 ok((await c.query('select private.owned_worksheet_transaction(1,null,null) r')).rows[0].r.status==='available','direct private call uses the same owner-bound transaction');
 await deny(()=>wrong.query('select private.owned_worksheet_transaction(1,null,null)'),'42501','direct private call rejects foreign session');
 ok((await db.query("select relrowsecurity from pg_class where oid='public.lesson_answers'::regclass")).rows[0].relrowsecurity,'answer RLS remains enabled');
 ok((await db.query("select count(*)::int n from pg_policies where tablename='lesson_answers'")).rows[0].n===3,'existing three answer policies preserved');
 ok((await db.query("select has_table_privilege('authenticated','private.worksheet_versions','UPDATE') u,has_sequence_privilege('authenticated','private.worksheet_version_seq','USAGE') s")).rows.every(x=>!x.u&&!x.s),'version table and sequence remain inaccessible');
 await db.query("insert into courses(slug,title,total_lessons) values('unrelated-fictional-course','Other fixture',2)");
 await c.query("insert into course_enrollments(user_id,course_id) select $1,id from courses where slug='unrelated-fictional-course'",[a]);
 await c.query("insert into lesson_answers(user_id,course_id,lesson_number,question_number,answer) select $1,id,1,1,'unrelated fixture' from courses where slug='unrelated-fictional-course'",[a]);
 const unrelated=JSON.stringify((await db.query("select la.* from lesson_answers la join courses co on co.id=la.course_id where co.slug='unrelated-fictional-course'")).rows);
 const fresh=(await rpc(c)).revision;await rpc(c,1,fresh,[answer(6,'supported owner edit')]);
 ok(JSON.stringify((await db.query("select la.* from lesson_answers la join courses co on co.id=la.course_id where co.slug='unrelated-fictional-course'")).rows)===unrelated,'other course answers are preserved');
 await holder.query('begin');await holder.query('select pg_advisory_xact_lock(261101,56001)');
 await deny(()=>rpc(c,1,(fresh),[answer(7)]),'55P03','contention times out safely before answer mutation');await holder.query('rollback');
 ok((await db.query('select count(*)::int n from lesson_answers where user_id=$1 and course_id=1 and question_number=7',[a])).rows[0].n===0,'timeout cannot partially write answers');
 console.log(`${checks} native worksheet transaction checks PASS`);
}finally{await db.close()}
