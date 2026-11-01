import {COURSE} from './evidence-review.mjs';
const production='exdocjbmylgxssanymjk';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const denied=()=>Object.freeze({status:'unavailable',canComplete:false,canCommit:false});
const positive=x=>Number.isSafeInteger(Number(x))&&Number(x)>0;
export const WORKSHEET_QUESTIONS=Object.freeze(Object.fromEntries([1,2,3,4].map(n=>[n,Object.freeze(Array.from({length:20},(_,i)=>i+1))])));

// Uses the existing caller-scoped Supabase client, never a second Auth instance or
// service credential. This isolated integration is not mounted in the public app.
export function createIsolatedWorksheetReader({client,projectRef,onClear=()=>{}}) {
 if(!/^[a-z]{20}$/.test(projectRef??'')||projectRef===production||client?.supabaseUrl!==`https://${projectRef}.supabase.co`||!client.auth?.getUser||!client.auth?.getSession||!client.auth?.onAuthStateChange)throw Error('Explicit isolated client required');
 let generation=0,controller,disposed=false;
 function invalidate(){generation++;controller?.abort();try{onClear()}catch{}}
 const sub=client.auth.onAuthStateChange(()=>{invalidate()});
 async function read(input){
  invalidate();const g=generation;controller=new AbortController();const signal=controller.signal;
  const current=()=>!disposed&&g===generation&&!signal.aborted;
  const fail=()=>{if(current())invalidate();return denied()};
  try{
   if(disposed||!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).length!==1||!Object.hasOwn(input,'lesson')||!WORKSHEET_QUESTIONS[input.lesson]||!Number.isInteger(input.lesson))return fail();
   const lesson=input.lesson;
   const sessionResult=await client.auth.getSession();const session=sessionResult.data?.session;
   if(sessionResult.error||!current()||!uuid(session?.user?.id)||typeof session.access_token!=='string'||!session.access_token)return fail();
   const userId=session.user.id,token=session.access_token;
   async function authorize(){
    if(!current())throw Error('stale');
    const r=await client.auth.getUser(token);
    const s=await client.auth.getSession();
    if(!current()||r.error||s.error||r.data?.user?.id!==userId||!r.data.user.email_confirmed_at||r.data.user.is_anonymous===true||s.data?.session?.user?.id!==userId||s.data.session.access_token!==token)throw Error('denied');
   }
   async function query(q){if(!current())throw Error('stale');const r=await q.abortSignal(signal);if(!current()||r.error)throw Error('query denied');return r.data;}
   await authorize();
   const course=await query(client.from('courses').select('id,slug').eq('slug',COURSE).maybeSingle());
   if(!positive(course?.id)||course.slug!==COURSE)return fail();
   const enrollment=()=>client.from('course_enrollments').select('user_id,course_id').eq('user_id',userId).eq('course_id',course.id).maybeSingle();
   const enrolled=r=>r?.user_id===userId&&String(r.course_id)===String(course.id);
   if(!enrolled(await query(enrollment())))return fail();
   // Raw answers never leave this function or enter persistent/browser storage.
   let rows=await query(client.from('lesson_answers').select('user_id,course_id,lesson_number,question_number,answer').eq('user_id',userId).eq('course_id',course.id).eq('lesson_number',lesson).order('question_number'));
   if(!Array.isArray(rows)||rows.length>20)return fail();
   const seen=new Set(),answered=new Set();
   for(const r of rows){
    if(r.user_id!==userId||String(r.course_id)!==String(course.id)||r.lesson_number!==lesson||!WORKSHEET_QUESTIONS[lesson].includes(r.question_number)||seen.has(r.question_number)||typeof r.answer!=='string')return fail();
    seen.add(r.question_number);if(r.answer.trim())answered.add(r.question_number);
   }
   rows=null;
   // This is observational status, not a serialized completion transaction.
   if(!enrolled(await query(enrollment())))return fail();
   await authorize();
   if(!current())return fail();
   return Object.freeze({status:'available',course:COURSE,lesson,requiredQuestions:20,savedNonblankAnswers:answered.size,allRequiredAnswersSaved:answered.size===20,canComplete:false,canCommit:false});
  }catch{return fail()}
 }
 return Object.freeze({read,clear:invalidate,dispose(){disposed=true;invalidate();sub.data?.subscription?.unsubscribe()}});
}
