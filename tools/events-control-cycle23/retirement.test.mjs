import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend-tests/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const root=new URL('../../',import.meta.url),tick=()=>new Promise(r=>setTimeout(r,0));
const source=p=>process.env.EVENTS_REVIEW_BASE?execFileSync('git',['show',process.env.EVENTS_REVIEW_BASE+':'+p],{cwd:root,encoding:'utf8'}):readFileSync(new URL(p,root),'utf8');
const ids={u:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',other:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',o:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',o2:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',event:'dddddddd-dddd-4ddd-8ddd-dddddddddd01'};
async function fixture(action='save'){
 const dom=new JSDOM('<!doctype html><main id="staff-main"><div id="staff-events-app"></div></main>',{url:'https://events.invalid/staff-events.html?org='+ids.o,runScripts:'outside-only'}),w=dom.window,doc=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 const handlers=new WeakMap(),add=w.EventTarget.prototype.addEventListener;w.EventTarget.prototype.addEventListener=function(type,fn,...args){if(type==='submit')handlers.set(this,fn);return add.call(this,type,fn,...args)};
 let actor=ids.u,hold=false,release,held=false,responseHold=false,responseRelease,responseHeld=false,denied=false,success=false;const writes=[],calls=[];
 const data={timezone:'UTC',manage_configuration:true,departments:[],labels:[],locations:[],approval_required:true,settings_revision:1};
 const series={id:ids.event,title:'Existing fictional event',status:'draft',timezone:'UTC',visibility:'staff',local_start:'2026-11-10T12:00:00',local_end:'2026-11-10T13:00:00',revision:3};
 w.ChampionLifeAuth={getUser:async()=>{if(hold){hold=false;held=true;await new Promise(r=>release=r)}return actor?{id:actor}:null},client:{auth:{onAuthStateChange(fn){this.callback=fn}},rpc:async(name,p)=>{
  calls.push({name,...p});
  if(name==='staff_workspace_context')return{data:{organizations:[{id:ids.o,name:'A'},{id:ids.o2,name:'B'}],grants:[ids.o,ids.o2].map(organization_id=>({organization_id,permission:'events.manage'}))}};
  if(p.p_action==='context')return{data};if(p.p_action==='list')return{data:[series]};
  if(p.p_action==='detail')return{data:{series,can_manage:true,conflicts:0,audit:[],occurrences:[{id:'slot',slot_date:'2026-11-10',starts_at:'2026-11-10T12:00Z',ends_at:'2026-11-10T13:00Z',scheduled:true}]}};
  writes.push(structuredClone(p));if(responseHold){responseHold=false;responseHeld=true;await new Promise(r=>responseRelease=r)}return success?{data:{id:ids.event}}:{error:denied?{code:'42501'}:{code:'40001',message:'stale'}};
 }}};
 w.eval(source('assets/js/events-common.js'));w.eval(source('assets/js/staff-events.js'));for(let i=0;i<20&&!doc.querySelector('button');i++)await tick();
 const button=text=>[...doc.querySelectorAll('button')].find(n=>n.textContent===text);
 if(action==='save')button('Create event').click();else if(action==='exception'){button(series.title).click();for(let i=0;i<10&&!button('Edit this occurrence');i++)await tick();button('Edit this occurrence').click()}else{button('Locations, audiences & settings').click();if(action==='location')button('Add location').click();if(action==='label')button('Add audience or event type').click()}
 const form=doc.querySelector('form.event-form'),save=form.querySelector('[type=submit]');assert(form&&save);
 const emit=()=>form.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:save}));
 return{dom,w,doc,form,save,writes,calls,button,emit,captured:()=>handlers.get(form)({preventDefault(){},submitter:save}),async wait(){for(let i=0;i<8;i++)await tick()},hold(){hold=true},held:()=>held,release:()=>release(),holdResponse(){responseHold=true},responseHeld:()=>responseHeld,releaseResponse:()=>responseRelease(),setActor:a=>actor=a,deny:()=>denied=true,succeed:()=>success=true};
}
const move=n=>{const p=n.parentNode;n.remove();p.append(n)};
for(const action of['save','exception','settings','location','label']){
 test(action+' current live form retains existing exact action/revision contract',async()=>{const f=await fixture(action);try{f.emit();await f.wait();assert.equal(f.writes.length,1);assert.equal(f.writes[0].p_action,action);assert.equal(f.writes[0].p_org,ids.o);assert.equal(f.writes[0].p_data.revision,action==='exception'?0:action==='settings'?1:0)}finally{f.dom.window.close()}});
 test(action+' remove/reinsert form permanently blocks captured submit',async()=>{const f=await fixture(action);try{move(f.form);f.captured();await f.wait();assert.equal(f.writes.length,0)}finally{f.dom.window.close()}});
}
for(const scenario of['button','form','dialog','main','held-button','held-form','held-dialog','held-account','held-logout','held-organization','detached-button','detached-form'])test(scenario+' cannot start a new retired mutation',async()=>{
 const f=await fixture();try{
  if(scenario.startsWith('held-')){f.hold();f.emit();for(let i=0;i<20&&!f.held();i++)await tick();assert(f.held());
   if(scenario==='held-account')f.setActor(ids.other);else if(scenario==='held-logout')f.setActor(null);else if(scenario==='held-organization'){const select=f.doc.querySelector('select[name=organization]');select.value=ids.o2;select.dispatchEvent(new f.w.Event('change'))}else move(scenario==='held-button'?f.save:scenario==='held-form'?f.form:f.form.parentNode);f.release();
  }else{const n=scenario.includes('button')?f.save:scenario.includes('form')?f.form:scenario==='main'?f.doc.querySelector('main'):f.form.parentNode;if(scenario.startsWith('detached-'))n.remove();else move(n);f.captured()}
  await f.wait();assert.equal(f.writes.length,0);
 }finally{f.dom.window.close()}
});
test('submitted mutation remains exactly once; removed controls cannot retry',async()=>{const f=await fixture();try{f.holdResponse();f.emit();for(let i=0;i<20&&!f.responseHeld();i++)await tick();assert.equal(f.writes.length,1);move(f.form);f.releaseResponse();await f.wait();f.captured();await f.wait();assert.equal(f.writes.length,1);assert(!f.form.textContent.includes('Saved'))}finally{f.dom.window.close()}});
test('late explicit denial still retires same-authority workspace',async()=>{const f=await fixture();try{f.holdResponse();f.emit();for(let i=0;i<20&&!f.responseHeld();i++)await tick();f.deny();move(f.form);f.releaseResponse();await f.wait();assert.equal(f.writes.length,1);assert.match(f.doc.querySelector('#staff-events-app').textContent,/access is no longer available/i);assert.equal(f.doc.querySelectorAll('form').length,0)}finally{f.dom.window.close()}});
test('normal close/reopen creates fresh authorized controls; old ones remain retired',async()=>{const f=await fixture();try{f.button('Close').click();await f.wait();f.button('Create event').click();f.captured();await f.wait();assert.equal(f.writes.length,0);const next=f.doc.querySelector('form.event-form');next.dispatchEvent(new f.w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:next.querySelector('[type=submit]')}));await f.wait();assert.equal(f.writes.length,1)}finally{f.dom.window.close()}});

for(const target of['button','form','root'])for(const outcome of['success-after-silent-account','denial'])test(target+' retirement preserves '+outcome+' authority cleanup',async()=>{const f=await fixture();try{f.form.elements.internal_notes.value='PRIVATE OWNER A';f.holdResponse();f.emit();for(let i=0;i<20&&!f.responseHeld();i++)await tick();assert.equal(f.writes.length,1);move(target==='button'?f.save:target==='form'?f.form:f.doc.querySelector('#staff-events-app'));if(outcome==='denial')f.deny();else{f.succeed();f.setActor(ids.other)}f.releaseResponse();await f.wait();assert.equal(f.writes.length,1);assert.equal([...f.doc.querySelectorAll('[name=internal_notes]')].some(n=>n.value.includes('PRIVATE OWNER A')),false);assert.equal(f.doc.querySelectorAll('form').length,0)}finally{f.dom.window.close()}});
test('exact Events delta and immutable existing authority/test contracts reject tampering',async()=>{
 const {verifyActual,current,expectedRouter,hash}=await import('../partner-home-cycle22/source.mjs');
 const path='assets/js/staff-events.js',bytes=current(path);assert.deepEqual(bytes,expectedRouter(path));assert.equal(hash(bytes),'d50da2229c51cb32b4f259e42ca3fcf9319280dac3d2f9445673d00d52faca6f');
 for(const marker of ['recordRemovals(lifetimeObserver.takeRecords())','controls.every(currentControl)','rpc(action,data,[form,save])',"if(node===root||node.contains?.(root))retire",'if(error){if(denied(error)&&sameAuthority(b))retire();throw error;}',"if(!verified?.id||verified.id!==b.userId){retire();throw Error('retired');}"]){const text=bytes.toString();assert(text.includes(marker));assert.throws(()=>verifyActual(p=>p===path?Buffer.from(text.replace(marker,'/* unreviewed removal */')):current(p)),/Exact123/)}
 for(const p of ['assets/js/staff-workspace.js','assets/js/outreach-people.js','assets/js/forms-admin.js','assets/js/dream-team-manual.js','assets/js/staff-session.js','tools/site-build/public-files.json','.github/workflows/staff-runtime-cycle14.yml'])assert.throws(()=>verifyActual(q=>p===q?Buffer.alloc(0):current(q)),/Exact123/);
});
