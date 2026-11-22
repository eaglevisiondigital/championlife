// Local preservation/branding/context proof only; never loads a remote SDK.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {root,context,preservedHashes,verifyGenerated} from '../outreach-login/generate.mjs';
const read=p=>readFile(path.join(root,p),'utf8');let n=0;
const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)},tick=()=>new Promise(r=>setImmediate(r));
await verifyGenerated();ok(true,'inline Auth has only reviewed contexts and one implicit-callback type-policy delta; equivalent baseline suite stays intact');
for(const[file,hash]of Object.entries(preservedHashes))ok(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')===hash,'preserved exact canonical bytes: '+file);
const html=await read('outreach-login.html'),dom=new JSDOM(html,{url:'https://outreach.local.test/outreach-login.html',runScripts:'outside-only'}),w=dom.window,d=w.document;
try{
 ok(d.title==='Outreach Sign In | SOWGO · Champion Life','page title identifies SOWGO/Champion Life Outreach');
 ok(d.querySelector('h1').textContent==='Sign in to Outreach.','Outreach sign-in purpose is explicit');
 const visible=d.body.cloneNode(true);visible.querySelectorAll('script').forEach(e=>e.remove());
 ok(!/discipleship|getting a grip/i.test(visible.textContent),'visible page has no unrelated course branding');
 ok(d.querySelector('.outreach-brand img').getAttribute('src')==='assets/images/sowgo-logo.png','original SOWGO logo reused without derivative asset');
 ok(d.querySelector('meta[name=robots]').content==='noindex,nofollow'&&d.querySelector('meta[name=referrer]').content==='no-referrer','unpublished callback page has noindex and no-referrer metadata');
 ok(d.querySelector('.auth-skip').getAttribute('href')==='#outreach-sign-in'&&d.querySelector('main').tabIndex===-1,'keyboard skip link targets main');
 ok(d.querySelector('#authMessage').getAttribute('role')==='status'&&d.querySelector('#authMessage').getAttribute('aria-live')==='polite','sign-in feedback is announced');
 ok([...d.querySelectorAll('input')].every(i=>i.closest('label')&&d.getElementById(i.getAttribute('aria-describedby'))),'email and one-time-code inputs have labels and descriptions');
 const calls=[];
 w.sessionStorage.setItem('championlife-auth-next','/my-discipleship.html?course=keep');
 w.ChampionLifeAuth={getSession:async()=>null,client:{auth:{initialize:async()=>({error:null}),onAuthStateChange:()=>{},signInWithOtp:async a=>{calls.push(a);return{}},verifyOtp:async()=>{throw Error('Unexpected synthetic verification')}}}};
 w.eval(d.querySelector('script:not([src])').textContent);await tick();
 ok(w.sessionStorage.getItem(context.storage)===context.fallback,'missing event destination uses public Outreach fallback without guessing a campaign');
 ok(w.sessionStorage.getItem('championlife-auth-next')==='/my-discipleship.html?course=keep','independent Outreach storage preserves existing course destination');
 d.querySelector('#loginEmail').value='synthetic@example.test';d.querySelector('#sendCodeBtn').click();await tick();
 const callback=new URL(calls[0].options.emailRedirectTo);
 ok(callback.pathname===context.callback&&callback.searchParams.get('next')===context.fallback,'email callback uses only the new Outreach path and sanitized fallback');
 ok(calls[0].options.shouldCreateUser===true,'existing canonical account-creation option is preserved, not silently changed');
 ok(d.querySelector('#codeStep').classList.contains('active')&&d.activeElement.id==='loginCode','successful synthetic request opens and focuses the OTP step');
}finally{w.close()}
const campaign='11111111-1111-4111-8111-111111111111';
for(const[page,script,container]of[['outreach-team.html','assets/js/outreach-team-portal.js','main'],['staff-outreach-team-travel.html','assets/js/outreach-team-travel.js','#outreach-team-travel']]){
 const h=new JSDOM(await read(page),{url:'https://outreach.local.test/'+page+'?campaign='+campaign,runScripts:'outside-only'});
 try{let calls=0;h.window.ChampionLifeAuth={getUser:async()=>null,client:{rpc:async()=>{calls++;throw Error('No signed-out RPC')},auth:{onAuthStateChange:()=>{}}}};h.window.eval(await read(script));await tick();const url=new URL(h.window.document.querySelector(container+' a').href);ok(url.pathname===context.callback&&url.searchParams.get('next')==='/'+page+'?campaign='+campaign,'unpublished '+page+' sign-in link preserves its explicit event destination');ok(calls===0,'signed-out '+page+' link requires no backend access')}finally{h.window.close()}
}
const manifest=JSON.parse(await read('tools/site-build/public-files.json'));
{
 const html=await read('staff-outreach-team-travel.html'),h=new JSDOM(html,{url:'https://outreach.local.test/staff-outreach-team-travel.html?campaign='+campaign,runScripts:'outside-only'}),w=h.window,redirects=[];
 try{
  ok(Boolean(w.document.querySelector('script[src="assets/js/outreach-staff-session.js"]'))&&!w.document.querySelector('script[src="assets/js/staff-session.js"]'),'only unpublished P1 staff page selects generated Outreach session presentation');
  w.sessionStorage.setItem('championlife-auth-next','/my-discipleship.html');w.sessionStorage.setItem(context.storage,'/staff-outreach-team-travel.html?campaign='+campaign);
  w.ChampionLifeAuth={getUser:async()=>({id:'synthetic-staff',email:'staff@example.test'}),getSession:async()=>null,client:{auth:{onAuthStateChange:()=>{},signOut:async()=>({error:null})}}};
  vm.runInNewContext(await read('assets/js/outreach-staff-session.js'),{window:w,document:w.document,sessionStorage:w.sessionStorage,setTimeout,location:{pathname:'/staff-outreach-team-travel.html',search:'?campaign='+campaign,replace:u=>redirects.push(u)}});await tick();w.document.querySelector('#staff-logout').click();await tick();
  const target=new URL(redirects[0],'https://outreach.local.test');
  ok(target.pathname===context.callback&&target.searchParams.get('next')==='/staff-outreach-team-travel.html?campaign='+campaign,'staff logout preserves its explicit event destination through branded login');
  ok(w.sessionStorage.getItem('championlife-auth-next')==='/my-discipleship.html'&&!w.sessionStorage.getItem(context.storage),'P1 logout clears only its independent return hint');
 }finally{w.close()}
}
const approvedP1=['outreach-login.html','assets/css/outreach-login.css','assets/js/outreach-staff-session.js','outreach-team.html','assets/css/outreach-team-portal.css','assets/js/outreach-team-portal.js','staff-outreach-team-travel.html','assets/css/outreach-team-travel.css','assets/js/outreach-team-travel.js'];
ok(manifest.length===511,'approved P1 plus reviewed Watch files and the public Sunday sermon booklet contains 511 explicit public files');
ok(manifest.filter(file=>file.startsWith('worship/')).length===75,'exactly 75 reviewed Watch-only public assets are present');
ok(JSON.stringify(manifest.slice(-approvedP1.length))===JSON.stringify(approvedP1),'only the nine reviewed P1 files are appended in fixed order');
for(const file of approvedP1)ok(manifest.filter(v=>v===file).length===1,'exactly one reviewed P1 public entry: '+file);
console.log(n+' Outreach login preservation/branding/context checks passed (synthetic Auth only)');
