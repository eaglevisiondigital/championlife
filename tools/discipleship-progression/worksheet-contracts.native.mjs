// Real disposable native PostgreSQL, fictional Auth transport only. No hosted access.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {setupCompletion,claims,U,S,B,BS,counts} from './completion-fixture.mjs';
import {WORKSHEET_CONTRACTS} from './worksheet-contracts.mjs';
import {createIsolatedWorksheetTransactions} from './worksheet-transactions.mjs';
const db=await localPostgres(),ref='abcdefghijklmnopqrst';let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
try{
 await setupCompletion(db);
 for(const file of ['20261102193245_lesson_five_owned_worksheet.sql','20261102200549_lessons_six_to_eight_owned_worksheets.sql','20261102210907_lessons_nine_thirteen_owned_worksheets.sql'])await db.exec(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 const connection=await db.connect();await connection.query('set role authenticated');
 let owner=U,sid=S,event,requests=0;
 const auth={url:`https://${ref}.supabase.co/auth/v1`,getSession:async()=>({data:{session:{user:{id:owner},access_token:owner}}}),getUser:async token=>({data:{user:{id:token,email_confirmed_at:'fictional'}}}),onAuthStateChange:callback=>{event=callback;return{data:{subscription:{unsubscribe(){}}}}}};
 const client={supabaseUrl:`https://${ref}.supabase.co`,auth,rest:{url:`https://${ref}.supabase.co/rest/v1`},rpc(name,args){assert.equal(name,'owned_worksheet_transaction');let bearer;return{setHeader(k,v){assert.equal(k,'Authorization');bearer=v.slice(7);return this},retry(v){assert.equal(v,false);return this},async abortSignal(signal){requests++;assert.equal(signal.aborted,false);assert.equal(bearer,owner);await claims(connection,bearer,sid);try{return{data:(await connection.query('select public.owned_worksheet_transaction($1,$2,$3) r',[args.p_lesson,args.p_expected_revision,args.p_answers===null?null:JSON.stringify(args.p_answers)])).rows[0].r}}catch(error){return{error:{code:error.code}}}}}}};
 const adapter=createIsolatedWorksheetTransactions({client,projectRef:ref});
 for(const {lesson,questions,worksheet}of Object.values(WORKSHEET_CONTRACTS)){
  const start=await adapter.read({lesson});ok(start.status==='available'&&start.requiredQuestions===questions.length,'native catalog receipt '+lesson);
  const answers=questions.map(question=>({question,answer:question===1?'   ':'FICTIONAL PRIVATE'}));
  const saved=await adapter.save({lesson,revision:start.revision,answers});ok(saved.status==='available'&&saved.savedNonblankAnswers===questions.length-1&&!saved.allRequiredAnswersSaved,'native blank answers not counted '+lesson);
  ok(!JSON.stringify(saved).includes('PRIVATE')&&saved.canComplete===false&&saved.canCommit===false,'projection excludes answers and credit '+lesson);
  ok(worksheet===null?!Object.hasOwn(saved,'worksheet'):saved.worksheet===worksheet,'exact native worksheet identity '+lesson);
  const full=await adapter.save({lesson,revision:saved.revision,answers:[{question:1,answer:'FICTIONAL FINAL'}]});ok(full.status==='available'&&full.allRequiredAnswersSaved&&full.revision!==saved.revision,'native CAS complete answers '+lesson);
  ok((await adapter.save({lesson,revision:saved.revision,answers})).status==='conflict','native stale write rejected '+lesson);
  owner=B;sid=BS;event('SIGNED_IN');ok((await adapter.read({lesson})).savedNonblankAnswers===0,'second owner cannot see first answers '+lesson);
  ok((await adapter.save({lesson,revision:full.revision,answers})).status==='conflict','first revision cannot write second account '+lesson);
  owner=U;sid=S;event('SIGNED_IN');
 }
 await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[S]);
 ok((await adapter.read({lesson:13})).status==='unavailable','actual SQL expiry denies read');
 ok((await adapter.save({lesson:13,revision:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',answers:[{question:1,answer:'must not save'}]})).status==='unavailable','actual SQL expiry denies write');
 ok(JSON.stringify(await counts(db))===JSON.stringify({progress:0,audit:0}),'no progress or completion audits created');
 const before=requests;adapter.dispose();ok((await adapter.read({lesson:13})).status==='unavailable'&&requests===before,'disposed adapter sends nothing');
 console.log(JSON.stringify({status:'PASS',checks,providerEvidence:false,engine:'native PostgreSQL'}));
}finally{await db.close()}
