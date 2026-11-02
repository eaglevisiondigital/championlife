// Approved workbook response groups for lessons 5–13. Reuses existing owner-bound worksheet RPC.
// No local answer storage, enrollment, profile writes or completion mutations.
(() => {
 'use strict';
 const root=document.querySelector('[data-grip-worksheet]');if(!root)return;
 const lesson=Number(root.dataset.gripWorksheet),required=({5:10,6:7,7:7,8:6,9:5,10:5,11:4,12:3,13:4})[lesson];if(!required)return;
 const worksheet=`lesson-${lesson}-workbook-sections-v1`;
 const form=root.querySelector('[data-worksheet-form]'),fields=root.querySelector('[data-worksheet-fields]'),status=root.querySelector('[data-worksheet-status]'),load=root.querySelector('[data-worksheet-load]');
 const answers=[...root.querySelectorAll('[data-worksheet-answer]')],client=window.ChampionLifeAuth?.client;
 if(answers.length!==required||answers.some((a,i)=>Number(a.dataset.worksheetAnswer)!==i+1))return;
 const auth=client?.auth,rpc=client?.rpc,origin=client?.supabaseUrl,rest=client?.rest;
 const pinned=()=>client?.auth===auth&&client?.rpc===rpc&&client?.rest===rest&&client?.supabaseUrl===origin;
 let epoch=0,controller=new AbortController(),binding=null,version=null,busy=false,active=true,timer,savedValues=null,cleanMessage='';
 const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x);
 function clear(message='Sign in, then load your private cloud worksheet.'){
  epoch++;controller.abort();controller=new AbortController();clearTimeout(timer);binding=null;version=null;busy=false;savedValues=null;cleanMessage='';
  answers.forEach(a=>{a.value='';a.defaultValue=''});fields.disabled=true;load.disabled=false;status.textContent=message;
 }
 const current=g=>active&&epoch===g&&!controller.signal.aborted&&pinned();
 async function verified(g,expected){
  if(!current(g)||!auth?.getSession||!auth?.getUser)throw Error('unavailable');
  const s=await auth.getSession(),session=s.data?.session;
  if(!current(g)||s.error||!session?.user?.id||!session.access_token||!(session.expires_at*1000>Date.now()))throw Error('unavailable');
  if(expected&&(session.user.id!==expected.id||session.access_token!==expected.token))throw Error('changed');
  const u=await auth.getUser(session.access_token);
  if(!current(g)||u.error||u.data?.user?.id!==session.user.id||!u.data.user.email_confirmed_at||u.data.user.is_anonymous)throw Error('unavailable');
  const latest=await auth.getSession();
  if(!current(g)||latest.error||latest.data?.session?.access_token!==session.access_token||latest.data?.session?.user?.id!==session.user.id||!(latest.data.session.expires_at*1000>Date.now()))throw Error('changed');
  return {id:session.user.id,token:session.access_token,email:u.data.user.email,expires:latest.data.session.expires_at*1000};
 }
 function validate(r){
  if(r?.status!=='available'||r.course!=='getting-a-grip-on-the-basics'||r.lesson!==lesson||r.worksheet!==worksheet||!uuid(r.revision)||r.requiredQuestions!==required||r.canComplete!==false||r.canCommit!==false||!Array.isArray(r.answers)||r.answers.length>required)throw Error('invalid');
  const seen=new Set();let nonblank=0;
  for(const a of r.answers){if(!Number.isInteger(a.question)||a.question<1||a.question>required||seen.has(a.question)||typeof a.answer!=='string'||a.answer.length>20000)throw Error('invalid');seen.add(a.question);if(a.answer.trim())nonblank++}
  if(r.savedNonblankAnswers!==nonblank||r.allRequiredAnswersSaved!==(nonblank===required))throw Error('invalid');
 }
 const dirty=()=>binding&&savedValues&&answers.some((a,i)=>a.value!==savedValues[i]);
 function editStatus(){
  if(!binding||fields.disabled)return;
  if(!active||!pinned()||binding.expires<=Date.now()){clear();return}
  status.textContent=dirty()?'Unsaved changes. Save responses before loading another copy. Changes are cleared when you leave or your session changes.':cleanMessage;
 }
 async function request(write){
  if(!active||busy)return;
  if(binding&&(!pinned()||binding.expires<=Date.now())){clear();return}
  if(write&&(!binding||!version||fields.disabled||binding.expires<=Date.now())){clear();return}
  const captured=write?binding:null,expected=write?version:null,payload=write?answers.map(a=>({question:Number(a.dataset.worksheetAnswer),answer:a.value})):null;
  if(!write&&dirty()){
   const observed=epoch,owner=binding;
   const discard=window.confirm('Load the saved worksheet and discard your unsaved changes?');
   // A confirmation is never authorization; account/session invalidation wins.
   if(!current(observed)||binding!==owner||owner.expires<=Date.now()){clear();return}
   if(!discard)return;
  }
  if(!write)clear('Loading your private worksheet…');
  const g=epoch,signal=controller.signal;busy=true;fields.disabled=true;load.disabled=true;let issued=false;
  try{
   const user=await verified(g,captured);if(!current(g))return;
   const query=rpc.call(client,'owned_worksheet_transaction',{p_lesson:lesson,p_expected_revision:expected,p_answers:payload});
   if(!query?.setHeader||!query.retry||!query.abortSignal)throw Error('unavailable');
   issued=write;
   const response=await query.setHeader('Authorization',`Bearer ${user.token}`).retry(false).abortSignal(signal);
   if(!current(g))return;
   if(response.error){
    const code=response.error.code;
    clear(code==='40001'?'Worksheet changed in another tab or device. Load the current saved responses before editing again.':write&&!['42501','22023','PGRST301','PGRST302','PGRST303'].includes(code)?'Save outcome is unknown. Load saved responses to reconcile; no automatic retry was made.':'Private worksheet unavailable. Verify your sign-in and enrollment, then load again.');return;
   }
   const fresh=await verified(g,user);if(!current(g))return;validate(response.data);
   binding=fresh;version=response.data.revision;
   answers.forEach(a=>{a.value=response.data.answers.find(v=>v.question===Number(a.dataset.worksheetAnswer))?.answer??''});
   fields.disabled=false;busy=false;load.disabled=false;
   savedValues=answers.map(a=>a.value);
   cleanMessage=status.textContent=`${write?'Saved':'Loaded'} for ${fresh.email}. ${response.data.savedNonblankAnswers} of ${required} response groups saved. This does not certify watching or lesson completion.`;
   clearTimeout(timer);timer=setTimeout(()=>clear('Session expired. Sign in and load your worksheet again.'),Math.min(2147483647,fresh.expires-Date.now()));
  }catch{if(current(g))clear(issued?'Save outcome is unknown. Load saved responses to reconcile; no automatic retry was made.':'Private worksheet unavailable. Sign in and load again.');}
 }
 form.addEventListener('input',editStatus);
 form.addEventListener('change',editStatus);
 form.addEventListener('submit',e=>{e.preventDefault();void request(true)});
 load.addEventListener('click',()=>void request(false));
 auth?.onAuthStateChange?.(()=>clear()); // Synchronous clearing only: no Auth callback lock re-entry.
 window.addEventListener('champion-auth-invalid',()=>clear());
 window.addEventListener('storage',e=>{if(e.key===null||e.key?.startsWith('sb-'))clear()});
 window.addEventListener('pagehide',()=>{active=false;clear()});
 window.addEventListener('pageshow',()=>{active=true;clear()});
 window.addEventListener('popstate',()=>clear());
 document.addEventListener('visibilitychange',()=>{active=!document.hidden;clear()});
 clear();
})();
