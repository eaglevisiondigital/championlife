// Actual lesson DOM/runtime with fictional Auth. No network or provider calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../backend-tests/node_modules/jsdom/lib/api.js';
import fs from 'node:fs';
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,0));
const A={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'a@example.test',email_confirmed_at:'2026-01-01'};
async function fixture(lesson=5){
 const dom=new JSDOM(read(`getting-a-grip-${lesson}.html`),{url:'https://notes.example.test/',runScripts:'outside-only'}),w=dom.window;
 let hold='',resume,waiter,callbacks=[],writes=0;
 const key=`championlife-grip-notes-v1:${A.id}:getting-a-grip-on-the-basics:lesson:${lesson}`;
 w.localStorage.setItem(key,JSON.stringify({owner:A.id,course:'getting-a-grip-on-the-basics',lesson,notes:'OWN SAVED'}));
 const original=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(...args){writes++;return original.apply(this,args)};
 const pause=async phase=>{if(hold===phase){waiter=true;await new Promise(r=>resume=r)}};
 w.fetch=()=>{throw Error('No network')};
 w.ChampionLifeAuth={client:{auth:{onAuthStateChange:f=>callbacks.push(f)}},getVerifiedUser:async()=>{await pause('verify');return A},getSession:async()=>{await pause('session');return{user:A,expires_at:Date.now()/1000+600}}};
 w.eval(read('assets/js/grip-notes.js'));await tick();await tick();
 const field=w.document.querySelector('.note-box'),status=w.document.querySelector('[data-grip-notes-status]'),wrap=field.closest('.grip-notes-wrap');
 return{w,field,status,wrap,close:()=>dom.window.close(),writes:()=>writes,saved:()=>JSON.parse(w.localStorage.getItem(key)).notes,
  edit:txt=>{field.value=txt;field.dispatchEvent(new w.Event('input'))},hold:phase=>{hold=phase;waiter=false},waiting:()=>waiter,
  release:()=>{hold='';resume?.()},revive:()=>{callbacks.forEach(f=>f('SIGNED_IN'));w.dispatchEvent(new w.Event('pageshow'))}};
}
function detach(f,mode){
 const {field,wrap,status,w}=f;
 if(mode==='field'){const parent=field.parentNode;field.remove();parent.append(field)}
 if(mode==='wrapper'){const parent=wrap.parentNode;wrap.remove();parent.append(wrap)}
 if(mode==='status'){const parent=status.parentNode;status.remove();parent.append(status)}
 if(mode==='extracted'){const parent=wrap.parentNode;wrap.remove();parent.append(field)}
 if(mode==='ancestor'){const ancestor=wrap.parentNode,parent=ancestor.parentNode;ancestor.remove();parent.append(wrap)}
 if(mode==='replacement'){field.replaceWith(field.cloneNode(true));w.document.body.append(field)}
}
for(const phase of ['verify','session'])for(const operation of ['restore','save'])for(const mode of ['field','wrapper','status','extracted','ancestor','replacement']){
 test(`${operation} at ${phase}: ${mode} retirement clears and never revives`,async()=>{
  const f=await fixture();try{
   assert.equal(f.field.value,'OWN SAVED');f.hold(phase);
   if(operation==='save')f.edit('RETIRED EDIT');else f.w.dispatchEvent(new f.w.Event('pageshow'));
   await tick();assert.ok(f.waiting());detach(f,mode);f.release();await tick();await tick();
   assert.equal(f.saved(),'OWN SAVED');assert.equal(f.writes(),0);assert.equal(f.field.value,'');assert.equal(f.field.defaultValue,'');assert.equal(f.field.disabled,true);
   assert.match(f.status.textContent,/closed/i);
   f.revive();await tick();await tick();f.edit('REINSERTED EDIT');await tick();
   assert.equal(f.writes(),0);assert.equal(f.saved(),'OWN SAVED');assert.equal(f.field.value,'');assert.equal(f.field.disabled,true);assert.match(f.status.textContent,/closed/i);
  }finally{f.close()}
 });
}
for(const lesson of [5,6,7,8,9,10,11,12,13])test(`lesson ${lesson}: live saves and unrelated DOM updates remain usable`,async()=>{
 const f=await fixture(lesson);try{
  const sibling=f.w.document.createElement('span');f.wrap.append(sibling);sibling.remove();
  f.edit('VALID EDIT');await tick();await tick();assert.equal(f.saved(),'VALID EDIT');assert.equal(f.writes(),1);assert.equal(f.field.disabled,false);assert.match(f.status.textContent,/Saved on this device/);
 }finally{f.close()}
});
test('same-task remove/reinsert and input cannot precede observer retirement',async()=>{
 const f=await fixture();try{detach(f,'field');f.edit('SAME TASK');await tick();await tick();assert.equal(f.writes(),0);assert.equal(f.field.value,'');assert.equal(f.field.disabled,true)}finally{f.close()}
});
