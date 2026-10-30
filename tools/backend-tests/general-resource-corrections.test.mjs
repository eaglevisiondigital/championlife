// Fictional local DOM/Auth only. No provider connections, emails or real users.
import {JSDOM} from 'jsdom';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8'),wait=ms=>new Promise(r=>setTimeout(r,ms)),flush=()=>wait(50);
const A={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'a@example.test',email_confirmed_at:'2026-01-01',is_anonymous:false},B={...A,id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'b@example.test'};let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
function dom(path,url=path){const d=new JSDOM(read(path),{url:'https://fictional.example.test/'+url,runScripts:'outside-only'});d.window.fetch=()=>{throw Error('Unexpected network')};return d}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}}
// Corrected actual worksheet script, including formerly unowned local drafts.
{
 const d=dom('getting-a-grip-1.html'),w=d.window;let active=A,mode='',pending,events=[],saves=[];
 const data=u=>({user:u,profile:{first_name:u.id===A.id?'Person A':'Person B',email:u.email},answers:[{question_number:1,answer:u.id===A.id?'A CLOUD':'B CLOUD'}],progress:null});
 const switchTo=u=>{active=u;events.forEach(f=>f(u?'SIGNED_IN':'SIGNED_OUT',{user:u}))};
 w.ChampionLifeAuth={client:{auth:{onAuthStateChange:f=>events.push(f)}},getVerifiedUser:async()=>{if(mode==='expired')throw Error('Expired');return active},getSession:async()=>({user:active,expires_at:Date.now()/1000+3600}),loadLesson:async(n,id)=>{const u=active;if(mode==='slow'){pending=deferred();return pending.promise}return data(u)},saveLesson:async p=>{saves.push(p);if(mode==='slow-save'){pending=deferred();return pending.promise}return{saved:true}}};
 const legacy=JSON.stringify({values:{q1:'UNATTRIBUTED PRIVATE',email:'legacy@example.test'}});w.localStorage.setItem('championlife-grip-lesson-1-draft-v1',legacy);
 w.eval(read('assets/js/grip-course.js'));await flush();
 const q=w.document.querySelector('[name=q1]'),email=w.document.querySelector('[name=email]');
 ok(q.value==='A CLOUD','verified A sees own cloud answer, never legacy draft');
 q.value='A UNFINISHED';q.dispatchEvent(new w.Event('input',{bubbles:true}));
 const key=id=>`championlife-grip-v2:${id}:getting-a-grip-on-the-basics:lesson:1`;
 ok(JSON.parse(w.localStorage.getItem(key(A.id))).owner===A.id,'unfinished draft immediately captured with owner/course/lesson');
 switchTo(B);ok(q.value===''&&email.value==='','account-change callback clears private fields synchronously');await flush();
 ok(q.value==='B CLOUD'&&email.value===B.email,'B sees only B data');
 ok(saves.length===0,'A pending autosave canceled on switch');
 q.value='B UNFINISHED';q.dispatchEvent(new w.Event('input',{bubbles:true}));switchTo(A);await flush();
 ok(q.value==='A UNFINISHED','A→B→A restores only A unfinished draft');
 ok(JSON.parse(w.localStorage.getItem(key(B.id))).values.q1==='B UNFINISHED','B draft retained under B key');
 ok(w.localStorage.getItem('championlife-grip-lesson-1-draft-v1')===legacy,'legacy unassigned draft preserved byte-for-byte, never imported');
 switchTo(null);ok(q.value===''&&q.disabled,'logout immediately clears/disables worksheet');await flush();ok(q.value==='','logged-out late restore stays blank');
 switchTo(A);await flush();mode='slow';w.dispatchEvent(new w.PageTransitionEvent('pageshow',{persisted:true}));await flush();const late=pending;
 mode='';switchTo(B);await flush();late.resolve(data(A));await flush();ok(q.value==='B UNFINISHED','late A load cannot overwrite B');
 mode='slow-save';q.value='B SECOND';q.dispatchEvent(new w.Event('input',{bubbles:true}));await wait(1100);const lateSave=pending;
 ok(saves.at(-1).expectedUserId===B.id&&saves.at(-1).answers[1]==='B SECOND','save payload explicitly bound to displayed owner');
 mode='';switchTo(A);await flush();lateSave.resolve({saved:true});await flush();ok(q.value==='A UNFINISHED','late B save cannot render into A');
 ok(saves.at(-1).signal.aborted,'account change abort signal invalidates pending save authority');
 w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:true}));ok(q.value===''&&email.value==='','bfcache snapshot has no private worksheet content');
 switchTo(B);await flush();ok(q.value==='','Auth event cannot repopulate a hidden/bfcache worksheet');switchTo(A);await flush();
 w.dispatchEvent(new w.PageTransitionEvent('pageshow',{persisted:true}));await flush();ok(q.value==='A UNFINISHED','Back restores only after verified same-user load');
 mode='expired';w.dispatchEvent(new w.PageTransitionEvent('pageshow',{persisted:true}));await flush();ok(q.value===''&&q.disabled,'auth/network failure fails closed with no private display');
 ok(JSON.parse(w.localStorage.getItem(key(A.id))).values.q1==='A UNFINISHED','failure preserves owner-scoped draft without cloud deletion');
 mode='';switchTo(B);await flush();w.dispatchEvent(new w.StorageEvent('storage',{key:'sb-fictional-auth-token'}));ok(q.value==='','cross-tab Auth storage change clears immediately');await flush();
 ok(q.value==='B SECOND','same verified owner can recover draft after cross-tab revalidation');
 d.window.close();
}
// General callback failures cannot borrow old A session; valid callback must match token.
for(const kind of ['expired','consumed','invalid','sdk-error','stale-token','malformed','valid','returning']){
 const hash=['expired','consumed','invalid'].includes(kind)?'#error=access_denied&error_code=otp_expired':kind==='malformed'?'?token=invalid&type=magiclink':kind==='returning'?'':'#access_token=fresh&refresh_token=private';
 const d=dom('king-kind/index.html','king-kind/'+hash),w=d.window;let active=A,calls=0,events=[],logoutFail=false;
 w.ChampionLifeAuth={client:{auth:{initialize:async()=>({error:kind==='sdk-error'?Error('failure'):null}),getUser:async()=>({data:{user:active}}),getSession:async()=>({data:{session:{user:active,access_token:kind==='stale-token'?'OLD':'fresh'}}}),onAuthStateChange:f=>events.push(f),signOut:async()=>{if(logoutFail)return{error:Error('failure')};active=null;events.forEach(f=>f('SIGNED_OUT',null));return{}},signInWithOtp:async()=>({}),verifyOtp:async()=>({})},rpc:async()=>{calls++;return{data:{registered:true,reference:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}}}}};
 w.eval(read('assets/js/general-resource-registration.js'));await flush();
 const accepted=w.document.querySelector('#generalResourceCard').classList.contains('registered');
 ok(accepted===['valid','returning'].includes(kind),kind+' callback/session success classification');
 ok(!w.location.hash&&!w.location.search,'callback credentials/errors removed from URL '+kind);
 ok(w.document.querySelector('#resource-account-email').textContent.includes(A.email),'current account distinct and visible '+kind);
 if(!accepted)ok(calls===0&&w.document.querySelector('#resource-message').textContent.includes('request a new'),'failed callback blocks status success and provides recovery '+kind);
 else{
  ok(!w.document.querySelector('#resource-switch').hidden&&!w.document.querySelector('#resource-account').hidden,'switch persists after success '+kind);
  logoutFail=true;w.document.querySelector('#resource-switch-button').click();await flush();ok(!w.document.querySelector('#generalResourceCard').classList.contains('registered'),'failed logout keeps private success hidden '+kind);
  ok(active===A&&w.document.querySelector('#resource-message').textContent.includes('could not sign out'),'failed logout not misrepresented '+kind);
  logoutFail=false;w.document.querySelector('#resource-switch-button').click();await flush();ok(active===null&&w.document.querySelector('#resource-account-email').textContent==='','successful logout clears account '+kind);
 }
 d.window.close();
}
// A failed link can recover through a freshly verified OTP, without trusting the old session.
{
 const d=dom('king-kind/index.html','king-kind/#error=access_denied&error_code=otp_expired'),w=d.window;let sends=0,writes=0;
 w.ChampionLifeAuth={client:{auth:{initialize:async()=>({error:Error('expired')}),getUser:async()=>({data:{user:A}}),onAuthStateChange:()=>{},signInWithOtp:async()=>{sends++;return{}},verifyOtp:async()=>({data:{user:A},error:null})},rpc:async args=>{writes++;return{data:{registered:true,reference:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}}}}};
 w.eval(read('assets/js/general-resource-registration.js'));await flush();
 const form=w.document.querySelector('#generalResourceForm');form.elements.namedItem('name').value='Fictional A';form.elements.namedItem('email').value=A.email;form.elements.namedItem('resource-consent').checked=true;
 form.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();ok(sends===1&&writes===0,'failed callback requires fresh verification even with old matching account');
 ok(w.document.querySelector('#resource-message').textContent.includes('not complete yet'),'requesting email is not success');
 w.document.querySelector('#resource-code').value='12345678';w.document.querySelector('#resource-code-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
 ok(writes===1&&w.document.querySelector('#generalResourceCard').classList.contains('registered'),'verified matching OTP permits registration recovery');
 ok(!w.document.querySelector('#resource-switch').hidden,'recovered registration retains switching');d.window.close();
}
// Dashboard does not reveal stale responses or hide book behind St Lucia.
{
 const d=dom('my-discipleship.html'),w=d.window;let active=A,events=[],mode='',pending;
 const data=u=>({user:u,profile:{first_name:u===A?'Private A':'Private B'},progress:[{lesson_number:1,status:'completed'}]});
 w.ChampionLifeAuth={client:{auth:{onAuthStateChange:f=>events.push(f)}},getVerifiedUser:async()=>active,getSession:async()=>({user:active,expires_at:Date.now()/1000+3600}),getOutreachRegistration:async()=>null,getDashboard:async()=>{const u=active;if(mode==='slow'){pending=deferred();return pending.promise}return data(u)},signOut:async()=>{active=null}};
 w.eval([...w.document.scripts].find(s=>s.textContent.includes('const lessons=')).textContent);await flush();
 ok(w.document.querySelector('#readerResources').classList.contains('show'),'general reader link independent of St Lucia');
 ok(!w.document.querySelector('#stLuciaResources').classList.contains('show'),'no fabricated St Lucia attribution');
 ok(w.document.querySelectorAll('.dash-lesson').length===13,'all existing lesson routes preserved');
 ok(w.document.querySelectorAll('.dash-lesson small')[12].textContent.includes('video coming soon'),'course availability honest');
 mode='slow';w.dispatchEvent(new w.PageTransitionEvent('pageshow'));await flush();const late=pending;mode='';active=B;events.forEach(f=>f('SIGNED_IN',{user:B}));
 ok(w.document.querySelector('#dashName').textContent==='','dashboard clears synchronously on switch');await flush();late.resolve(data(A));await flush();ok(w.document.querySelector('#dashName').textContent==='Private B','late dashboard A response discarded');
 w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:true}));ok(w.document.querySelector('#dashName').textContent===''&&w.document.querySelector('#dashLessons').textContent==='','dashboard Back snapshot sanitized');events.forEach(f=>f('SIGNED_IN',{user:A}));await flush();ok(w.document.querySelector('#dashName').textContent==='','Auth event cannot repopulate hidden dashboard');d.window.close();
}
// Actual auth helper, slow profile select changes A to B before the first write.
{
 const d=new JSDOM('',{url:'https://fictional.example.test',runScripts:'outside-only'}),w=d.window;let active=A,events=[],writes=[],pause=null,mode='',expired=false;
 function query(table){let action='select',payload;const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,upsert:p=>{action='upsert';payload=p;return q},single:()=>q,maybeSingle:()=>q,then:async(resolve,reject)=>{try{
  if(table==='profiles'&&action==='select'&&mode==='slow'){pause=deferred();await pause.promise}
  if(action==='upsert')writes.push({table,payload,actor:active?.id});
  resolve({data:table==='courses'?{id:1}:table==='lesson_answers'?[]:{},error:null});
 }catch(e){reject(e)}}};return q}
 const client={auth:{onAuthStateChange:f=>events.push(f),getUser:async()=>({data:{user:active}}),getSession:async()=>({data:{session:{user:active,expires_at:Date.now()/1000+(expired?-1:3600)}}})},from:query};
 w.CHAMPION_LIFE_SUPABASE={};w.supabase={createClient:()=>client};w.eval(read('assets/js/champion-life-auth.js'));
 mode='slow';const save=w.ChampionLifeAuth.saveLesson({expectedUserId:A.id,lessonNumber:1,answers:{1:'PRIVATE A'},profile:{firstName:'A'}});await flush();active=B;events.forEach(f=>f('SIGNED_IN',{user:B}));pause.resolve();await assert.rejects(save);ok(writes.length===0,'actual helper stops A profile/save before B write after delayed query');
 mode='';await assert.rejects(w.ChampionLifeAuth.saveLesson({expectedUserId:A.id,lessonNumber:1,answers:{1:'PRIVATE A'}}));ok(writes.length===0,'explicit draft-owner mismatch denied');
 await assert.rejects(w.ChampionLifeAuth.saveLesson({lessonNumber:1,answers:{1:'UNOWNED'}}));ok(writes.length===0,'unowned draft cannot infer current account');
 await w.ChampionLifeAuth.saveLesson({expectedUserId:B.id,lessonNumber:1,answers:{1:'B OWN'}});ok(writes.every(x=>Array.isArray(x.payload)?x.payload.every(r=>r.user_id===B.id):x.payload.user_id===B.id),'valid own save preserves explicit UUID through profile/enrollment/answers/progress');
 ok(writes.map(x=>x.table).join()==='profiles,course_enrollments,lesson_answers,lesson_progress','existing legitimate cloud-save paths preserved');
 const n=writes.length;expired=true;await assert.rejects(w.ChampionLifeAuth.saveLesson({expectedUserId:B.id,lessonNumber:1,answers:{1:'EXPIRED'}}));ok(writes.length===n,'expired session cannot start cloud mutations');
 expired=false;const controller=new AbortController();controller.abort();await assert.rejects(w.ChampionLifeAuth.saveLesson({expectedUserId:B.id,lessonNumber:1,answers:{1:'ABORTED'},signal:controller.signal}));ok(writes.length===n,'invalidated UI generation cannot start cloud mutations');d.window.close();
}
console.log(`${checks} focused correction/security assertions passed; all Auth and Storage provider acceptance remains untested.`);
