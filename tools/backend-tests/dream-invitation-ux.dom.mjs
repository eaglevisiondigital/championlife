import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const read=f=>readFileSync(new URL('../../'+f,import.meta.url),'utf8');
const tick=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setTimeout(r,5))};
const fresh=()=>({enrolled:true,status:'In progress',completion:{},lessons:Array.from({length:7},(_,i)=>({number:i+1,title:i===0?'Dream Track Intro':'Lesson '+(i+1),unlocked:i===0,status:'not_started',watched_percent:0,mastered:0,resume_seconds:0,last_activity:null}))});
async function landing({state=fresh(),token=null,error=null,user={id:'learner'},deferred=false}={}){
 const d=new JSDOM(read('dream-track-invite.html'),{url:'https://preview.example/dream-track-invite.html'+(token!==null?'?token='+token:''),runScripts:'outside-only'}),w=d.window,calls=[];let callback,resolve;
 w.ChampionLifeAuth={getUser:async()=>user,getSession:async()=>user?{user,access_token:'synthetic'}:null,client:{auth:{onAuthStateChange:fn=>callback=fn}}};w.CHAMPION_LIFE_SUPABASE={url:'https://db.example',publishableKey:'public'};
 w.fetch=async(_,opts)=>{calls.push(JSON.parse(opts.body));if(deferred)await new Promise(r=>resolve=r);return{ok:!error,json:async()=>error?{message:error}:state}};
 for(const f of ['dream-track-common.js','dream-track.js'])w.eval(read('assets/js/'+f));await tick();
 return{d,w,calls,signOut:async()=>{user=null;callback('SIGNED_OUT',null);await tick();resolve?.();await tick()}};
}
let n=0;
for(const token of [null,'a'.repeat(64)]){
 const t=await landing({token});const root=t.w.document.querySelector('#dream-app');assert.match(root.textContent,/You’re enrolled/);assert.equal(root.querySelector('.btn').getAttribute('href'),'dream-track-1.html');assert.equal(root.querySelector('.btn').textContent,'START DREAM TRACK');assert.equal(t.calls[0].p_action,token?'claim_invite':'claim_pending');assert.equal(t.w.sessionStorage.getItem('championlife-dream-invite'),null);assert.equal(t.w.location.search,'');t.d.window.close();n++;
}
for(const number of [1,4,7]){
 const state=fresh();state.lessons.forEach(l=>{l.unlocked=l.number<=number;l.status=l.number<number?'completed':'not_started'});state.lessons[number-1].last_activity='2026-10-01T00:00:00Z';const t=await landing({state});const a=t.w.document.querySelector('#dream-app .btn');assert.equal(a.textContent,'RESUME DREAM TRACK');assert.equal(a.getAttribute('href'),`dream-track-${number}.html`);t.d.window.close();n++;
}
for(const status of ['Dream Track Completed','ONLINE COURSEWORK COMPLETE – FINAL MEETING REQUIRED']){
 const state=fresh();state.status=status;state.lessons.forEach(l=>{l.status='completed';l.unlocked=true});const t=await landing({state});assert.match(t.w.document.querySelector('#dream-app').textContent,status==='Dream Track Completed'?/Dream Track completed/:/final meeting is the next step/);assert(!t.w.document.querySelector('#dream-app a[href="dream-track-1.html"]'));assert(t.w.document.querySelector('#dream-app a[href="my-discipleship.html"]'));t.d.window.close();n++;
}
for(const error of ['Wrong account','Invitation expired','Invitation cancelled','Invalid invitation']){
 const t=await landing({token:'b'.repeat(64),error});assert(t.w.document.querySelector('#dream-app').textContent.includes(error));assert(!t.w.document.querySelector('#dream-app .btn'));assert.equal(t.calls.length,1);assert.equal(t.calls[0].p_action,'claim_invite');t.d.window.close();n++;
}
let t=await landing({state:{...fresh(),enrolled:false}});assert.match(t.w.document.querySelector('#dream-app').textContent,/No active Dream Track invitation/);assert(!t.w.document.querySelector('#dream-app .btn'));t.d.window.close();n++;
t=await landing({token:'malformed'});assert.equal(t.calls.length,0);assert.match(t.w.document.querySelector('#dream-app').textContent,/invalid/);t.d.window.close();n++;
t=await landing({token:'a'.repeat(64),user:null});assert.equal(t.calls.length,0);assert.equal(t.w.sessionStorage.getItem('championlife-dream-invite'),'a'.repeat(64));assert.equal(t.w.document.querySelector('#dream-app .btn').getAttribute('href'),'discipleship-login.html?next=%2Fdream-track-invite.html');t.d.window.close();n++;
t=await landing({deferred:true});await t.signOut();assert(!t.w.document.querySelector('#dream-enrollment-title'));t.d.window.close();n++;
const login=read('discipleship-login.html');const fn=login.slice(login.indexOf('  function safeNext(value)'),login.indexOf('  const next = safeNext'));const ctx={URL,location:{origin:'https://preview.example'}};vm.createContext(ctx);vm.runInContext(fn,ctx);
for(const value of ['//evil.example/dream-track-invite.html','https://evil.example','javascript:alert(1)','/dream-track-8.html'])assert.equal(ctx.safeNext(value),'/my-discipleship.html');assert.equal(ctx.safeNext('/dream-track-invite.html?next=//evil'),'/dream-track-invite.html');n++;
for(const invited of [true,false]){
 const d=new JSDOM(login,{url:'https://preview.example/discipleship-login.html'+(invited?'?next=%2Fdream-track-invite.html':''),runScripts:'outside-only'}),w=d.window,calls=[];
 w.ChampionLifeAuth={getSession:async()=>null,client:{auth:{onAuthStateChange:()=>{},signInWithOtp:async args=>{calls.push(args);return{}},verifyOtp:async args=>{calls.push(args);return{error:{message:'Synthetic invalid code'}}}}}};
 w.eval([...w.document.scripts].find(s=>!s.src&&s.textContent.includes('safeNext')).textContent);await tick();
 const b=[...w.document.querySelectorAll('button')].find(b=>b.textContent==='I already have a code');assert.equal(!!b,invited);
 w.document.querySelector('#loginEmail').value='learner@example.test';
 if(invited){b.click();assert.equal(calls.length,0);assert(w.document.querySelector('#codeStep').classList.contains('active'));w.document.querySelector('#loginCode').value='12345678';w.document.querySelector('#verifyCodeBtn').click();await tick();assert.equal(calls[0].type,'email');w.document.querySelector('#backBtn').click();}
 w.document.querySelector('#sendCodeBtn').click();await tick();assert.equal(calls.at(-1).options.emailRedirectTo,'https://preview.example/discipleship-login.html'+(invited?'?next=%2Fdream-track-invite.html':''));d.window.close();n++;
}
console.log(`PASS ${n} focused invitation landing/login scenarios`);
