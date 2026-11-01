// Real disposable PostgreSQL and unchanged course RLS. Auth claims are fictional.
import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import{localPostgres}from'../backend-tests/local-postgres.mjs';
import{createIsolatedWorksheetReader}from'./worksheet-source.mjs';
const db=await localPostgres(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)};
try{
 await db.exec(readFileSync(new URL('../backend-tests/fixtures/supabase-test-bootstrap.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../../supabase/bootstrap/automatic-rls.sql',import.meta.url),'utf8'));
 for(const f of ['20260923114743_create_course_progress_schema.sql','20260923114822_harden_course_security_and_indexes.sql','20260923115706_grant_authenticated_course_api_access.sql','20260923115732_restrict_authenticated_course_privileges.sql'])await db.exec(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'one@example.test',now()),($2,'two@example.test',now())",[a,b]);
 await db.query('insert into course_enrollments(user_id,course_id) select unnest($1::uuid[]),id from courses',[ [a,b] ]);
 await db.query("insert into lesson_answers(user_id,course_id,lesson_number,question_number,answer) select u,id,1,q,'PRIVATE '||u from courses cross join unnest($1::uuid[]) u cross join generate_series(1,20) q",[[a,b]]);
 const c=await db.connect();await c.query('set role authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);
 const scoped={supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',auth:{getSession:async()=>({data:{session:{user:{id:a},access_token:'fictional'}}}),getUser:async()=>({data:{user:{id:a,email_confirmed_at:'2026-01-01'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from(table){assert.ok(['courses','course_enrollments','lesson_answers'].includes(table));let columns,filters=[],single=false;return{select(s){assert.match(s,/^[a-z_,]+$/);columns=s;return this},eq(k,v){assert.match(k,/^[a-z_]+$/);filters.push([k,v]);return this},order(){return this},maybeSingle(){single=true;return this},async abortSignal(signal){assert.ok(!signal.aborted);const sql=`select ${columns} from public.${table} where `+filters.map(([k],i)=>`${k}=$${i+1}`).join(' and ');const r=await c.query(sql,filters.map(x=>x[1]));return{data:single?r.rows[0]??null:r.rows}}}}};
 const reader=createIsolatedWorksheetReader({client:scoped,projectRef:'abcdefghijklmnopqrst'});
 let r=await reader.read({lesson:1});ok(r.status==='available'&&r.savedNonblankAnswers===20,'real owner RLS queries supply twenty persisted answers');ok(!JSON.stringify(r).includes('PRIVATE'),'no raw answers in projection');ok(r.canComplete===false&&r.canCommit===false,'persisted answers not watch or completion proof');
 ok((await c.query('select * from lesson_answers where user_id=$1',[b])).rows.length===0,'RLS denies other learner even direct SQL');
 await assert.rejects(()=>c.query("insert into lesson_answers(user_id,course_id,lesson_number,question_number,answer) values($1,1,2,1,'attack')",[b]));ok(true,'RLS denies cross-account write');
 await c.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);ok((await reader.read({lesson:1})).status==='unavailable','RLS/session principal mismatch denied');
 await c.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);await db.query('delete from course_enrollments where user_id=$1',[a]);ok((await reader.read({lesson:1})).status==='unavailable','removed enrollment cannot access worksheet status');
 ok((await db.query('select count(*)::int n from lesson_answers')).rows[0].n===40,'legitimate answers preserved');reader.dispose();
 console.log(`${n} native PostgreSQL worksheet integration checks PASS`);
}finally{await db.close()}
