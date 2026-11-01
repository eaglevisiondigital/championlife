import {WORKSHEET_QUESTIONS} from './worksheet-source.mjs';
import {COURSE} from './evidence-review.mjs';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const revision=x=>typeof x==='string'&&/^[1-9][0-9]{0,18}$/.test(x);
const plain=x=>x&&Object.getPrototypeOf(x)===Object.prototype;
const result=status=>Object.freeze({status,canComplete:false,canCommit:false});

// Source-only adapter. Requires the reviewed migration in an explicitly isolated
// project. Does not mount public UI, store drafts, enroll or complete lessons.
export function createIsolatedWorksheetTransactions({client,projectRef,onClear=()=>{}}){
 if(!/^[a-z]{20}$/.test(projectRef??'')||projectRef==='exdocjbmylgxssanymjk')throw Error('Isolated project required');
 const origin=`https://${projectRef}.supabase.co`,auth=client?.auth,rest=client?.rest,rpc=client?.rpc;
 const pinned=()=>client?.supabaseUrl===origin&&client.auth===auth&&client.rest===rest&&client.rpc===rpc&&auth?.url===origin+'/auth/v1'&&rest?.url===origin+'/rest/v1';
 if(!pinned()||typeof rpc!=='function'||!auth.getSession||!auth.getUser||!auth.onAuthStateChange)throw Error('Pinned existing Auth and REST client required');
 let generation=0,controller,disposed=false;
 const clear=()=>{generation++;controller?.abort();try{onClear()}catch{}};
 const subscription=auth.onAuthStateChange(clear);
 const navigationEvents=['pagehide','pageshow','popstate'];
 for(const name of navigationEvents)globalThis.addEventListener?.(name,clear);
 async function perform(input,write){
  clear();const g=generation;controller=new AbortController();const signal=controller.signal;
  const current=()=>!disposed&&g===generation&&!signal.aborted&&pinned();
  let issued=false;
  const fail=status=>{if(current())clear();return result(status)};
  try{
   const keys=write?['answers','lesson','revision']:['lesson'];
   if(!current()||!plain(input)||Reflect.ownKeys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k))||!Number.isInteger(input.lesson)||!WORKSHEET_QUESTIONS[input.lesson])return fail('unavailable');
   const lesson=input.lesson;let answers=null;
   if(write){
    if(!revision(input.revision)||!Array.isArray(input.answers)||input.answers.length<1||input.answers.length>20)return fail('unavailable');
    const seen=new Set();answers=[];
    for(const a of input.answers){
     if(!plain(a)||Reflect.ownKeys(a).length!==2||!Object.hasOwn(a,'question')||!Object.hasOwn(a,'answer')||!WORKSHEET_QUESTIONS[lesson].includes(a.question)||seen.has(a.question)||typeof a.answer!=='string'||a.answer.length>20000)return fail('unavailable');
     seen.add(a.question);answers.push({question:a.question,answer:a.answer});
    }
   }
   const expected=write?input.revision:null;
   const s=await auth.getSession(),session=s.data?.session;
   if(s.error||!current()||!uuid(session?.user?.id)||typeof session.access_token!=='string'||!session.access_token)return fail('unavailable');
   const user=session.user.id,token=session.access_token;
   async function authorize(){
    if(!current())throw Error('stale');
    const u=await auth.getUser(token);if(!current())throw Error('stale');
    const s=await auth.getSession();
    if(!current()||u.error||s.error||u.data?.user?.id!==user||!u.data.user.email_confirmed_at||u.data.user.is_anonymous===true||s.data?.session?.user?.id!==user||s.data.session.access_token!==token)throw Error('denied');
   }
   await authorize();if(!current())return fail('unavailable');
   // Supabase 2.118.0 PostgREST builder supports setHeader/retry. Pin the verified
   // bearer explicitly: SDK session refresh/account change must never substitute
   // the next user's token for answers captured from the former account.
   const query=rpc.call(client,'owned_worksheet_transaction',{p_lesson:lesson,p_expected_revision:expected,p_answers:answers});
   if(!query?.setHeader||!query.retry||!query.abortSignal)return fail('unavailable');
   issued=write;
   const response=await query.setHeader('Authorization',`Bearer ${token}`).retry(false).abortSignal(signal);
   answers=null;
   if(!current())return fail('unavailable');
   if(response.error){
    const code=response.error.code;
    return fail(code==='40001'?'conflict':['42501','22023','23514','23505','PGRST301','PGRST302','PGRST303'].includes(code)?'unavailable':write?'uncertain':'unavailable');
   }
   await authorize();if(!current())return fail('unavailable');
   const r=response.data;
   if(!r||r.status!=='available'||r.course!==COURSE||r.lesson!==lesson||!revision(r.revision)||r.requiredQuestions!==20||!Number.isInteger(r.savedNonblankAnswers)||r.savedNonblankAnswers<0||r.savedNonblankAnswers>20||r.allRequiredAnswersSaved!==(r.savedNonblankAnswers===20)||r.canComplete!==false||r.canCommit!==false)return fail(write?'uncertain':'unavailable');
   return Object.freeze({status:'available',course:COURSE,lesson,revision:r.revision,savedNonblankAnswers:r.savedNonblankAnswers,requiredQuestions:20,allRequiredAnswersSaved:r.allRequiredAnswersSaved,canComplete:false,canCommit:false});
  }catch{return fail(current()&&issued?'uncertain':'unavailable')}
 }
 return Object.freeze({read:input=>perform(input,false),save:input=>perform(input,true),clear,dispose(){disposed=true;clear();subscription.data?.subscription?.unsubscribe();for(const name of navigationEvents)globalThis.removeEventListener?.(name,clear)}});
}
