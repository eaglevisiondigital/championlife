import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const tick=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setTimeout(r,5));};
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
for(const mode of ['authorized','department-only','wrong-org','rpc-revoked','delivery-revoked','account-switch']){
 const dom=new JSDOM(read('staff-dream-track.html'),{url:'https://acceptance.example/staff-dream-track.html',runScripts:'outside-only'}),w=dom.window;
 let callback,user={id:'manager-a',email:'manager@example.test'},revoked=false;
 w.ChampionLifeAuth={getUser:async()=>user,getSession:async()=>user?{user,access_token:'fictional-session'}:null,client:{auth:{onAuthStateChange:fn=>callback=fn}}};
 w.CHAMPION_LIFE_SUPABASE={url:'https://database.example',publishableKey:'public-fixture'};
 const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
 w.fetch=async(url,opts)=>{
  const body=JSON.parse(opts.body);
  if(url.endsWith('/staff_workspace_context'))return response({organizations:[{id:'org-a',name:'Synthetic Church'}],grants:[{organization_id:mode==='wrong-org'?'org-b':'org-a',permission:'courses.manage',department_ids:mode==='department-only'?['dept-a']:null}]});
  if(url.includes('/functions/'))return response({error:'Course management required'},403);
  if(revoked)return response({message:'Organization-wide courses.manage required'},403);
  if(body.p_action==='invite')return response({id:'invite-a',token:'a'.repeat(64)});
  return response({learners:[{id:1,email:'learner@example.test',name:'Synthetic Learner',passed_lessons:0}],invites:[],code_exists:false,code_active:false});
 };
 for(const file of ['dream-track-common.js','staff-dream-track.js'])w.eval(read('assets/js/'+file));await tick();
 const button=text=>[...w.document.querySelectorAll('button')].find(x=>x.textContent===text);
 if(['department-only','wrong-org'].includes(mode)){
  ok(!w.document.body.textContent.includes('learner@example.test'),mode+' cannot render private learner');
  ok(!button('Invite learner'),mode+' has no course mutation controls');
 }else{
  ok(w.document.body.textContent.includes('learner@example.test'),mode+' initially renders authorized learner');
  if(mode==='rpc-revoked'){
   revoked=true;button('Search').click();await tick();
   ok(!w.document.body.textContent.includes('learner@example.test'),'revoked RPC clears prior learner');
   ok(!button('Invite learner')&&w.document.querySelector('[role=alert]'),'revoked RPC removes controls and announces denial');
  }else if(mode==='delivery-revoked'){
   button('Invite learner').click();await tick();
   const email=w.document.querySelector('input[type=email]');email.value='controlled@example.test';
   const form=email.closest('form');form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
   ok(!w.document.body.textContent.includes('controlled@example.test'),'delivery denial clears recipient');
   ok(!w.document.querySelector('[aria-label="Single-use invitation link"]'),'delivery denial clears raw link');
   ok(!button('Invite learner')&&w.document.querySelector('[role=alert]'),'delivery denial removes stale authority');
  }else if(mode==='account-switch'){
   user=null;callback('SIGNED_OUT',null);await tick();
   ok(!w.document.body.textContent.includes('learner@example.test'),'account change clears private learner');
  }else{
   ok(w.document.querySelector('#staff-session')&&w.document.querySelector('#staff-logout'),'current staff session header present');
   ok(w.document.querySelector('#staff-main #staff-dream-app'),'protected module mounted under current session boundary');
  }
 }
 w.close();
}
console.log(`${checks} DreamTrack staff integration/security assertions passed`);
