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
 let actor=ids.u,hold=false,release,held=false,responseHold=false,responseRelease,responseHeld=false,denied=false,success=false,outcome=null,readFailure=false;const writes=[],calls=[];
 const data={timezone:'UTC',manage_configuration:true,departments:[],labels:[],locations:[],approval_required:true,settings_revision:1};
 const series={id:ids.event,title:'Existing fictional event',status:'draft',timezone:'UTC',visibility:'staff',local_start:'2026-11-10T12:00:00',local_end:'2026-11-10T13:00:00',revision:3};
 w.ChampionLifeAuth={getUser:async()=>{if(hold){hold=false;held=true;await new Promise(r=>release=r)}return actor?{id:actor}:null},client:{auth:{onAuthStateChange(fn){this.callback=fn}},rpc:async(name,p)=>{
  calls.push({name,...p});
  if(name==='staff_workspace_context')return{data:{organizations:[{id:ids.o,name:'A'},{id:ids.o2,name:'B'}],grants:[ids.o,ids.o2].map(organization_id=>({organization_id,permission:'events.manage'}))}};
  if(p.p_action==='context')return readFailure?{error:{message:'Fictional context failure',status:502}}:{data};if(p.p_action==='list')return{data:[series]};
  if(p.p_action==='detail')return{data:{series,can_manage:true,conflicts:0,audit:[],occurrences:[{id:'slot',slot_date:'2026-11-10',starts_at:'2026-11-10T12:00Z',ends_at:'2026-11-10T13:00Z',scheduled:true}]}};
  writes.push(structuredClone(p));if(responseHold){responseHold=false;responseHeld=true;await new Promise(r=>responseRelease=r)}if(outcome==='lost')throw new TypeError('Response lost after fictional commit');if(outcome==='proxy')return{error:{message:'Gateway unavailable',status:502}};if(outcome==='malformed')return{data:null};if(outcome==='confirmed')return{data:{id:ids.event,organization_id:p.p_org,revision:p.p_data.revision+1}};return success?{data:{id:ids.event}}:{error:denied?{code:'42501'}:{code:'40001',message:'stale'}};
 }}};
 w.eval(source('assets/js/events-common.js'));w.eval(source('assets/js/staff-events.js'));for(let i=0;i<20&&!doc.querySelector('button');i++)await tick();
 const button=text=>[...doc.querySelectorAll('button')].find(n=>n.textContent===text);
 if(action==='save')button('Create event').click();else if(action==='exception'){button(series.title).click();for(let i=0;i<10&&!button('Edit this occurrence');i++)await tick();button('Edit this occurrence').click()}else{button('Locations, audiences & settings').click();if(action==='location')button('Add location').click();if(action==='label')button('Add audience or event type').click()}
 const form=doc.querySelector('form.event-form'),save=form.querySelector('[type=submit]');assert(form&&save);
 const emit=()=>form.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:save}));
 return{dom,w,doc,form,save,writes,calls,button,emit,captured:()=>handlers.get(form)({preventDefault(){},submitter:save}),async wait(){for(let i=0;i<8;i++)await tick()},hold(){hold=true},held:()=>held,release:()=>release(),holdResponse(){responseHold=true},responseHeld:()=>responseHeld,releaseResponse:()=>responseRelease(),setActor:a=>actor=a,deny:()=>denied=true,succeed:()=>success=true,outcome:value=>outcome=value,failRead:()=>readFailure=true};
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
 const path='assets/js/staff-events.js',bytes=current(path);assert.deepEqual(bytes,expectedRouter(path));assert.equal(hash(bytes),'92d33fbbb7c6bc839db174da11c014dda23f437f9bb385ba4bf2a9143db08d61');
 for(const marker of ['recordRemovals(lifetimeObserver.takeRecords())','controls.every(currentControl)','rpc(action,data,[form,save],attempt)',"if(node===root||node.contains?.(root))retire",'if(error){if(denied(error)&&sameAuthority(b))retire();throw error;}',"if(!verified?.id||verified.id!==b.userId){retire();throw Error('retired');}"]){const text=bytes.toString();assert(text.includes(marker));assert.throws(()=>verifyActual(p=>p===path?Buffer.from(text.replace(marker,'/* unreviewed removal */')):current(p)),/Exact123/)}
 for(const p of ['assets/js/staff-workspace.js','assets/js/outreach-people.js','assets/js/forms-admin.js','assets/js/dream-team-manual.js','assets/js/staff-session.js','tools/site-build/public-files.json','.github/workflows/staff-runtime-cycle14.yml'])assert.throws(()=>verifyActual(q=>p===q?Buffer.alloc(0):current(q)),/Exact123/);
});

for(const scenario of['normal-switch','history-failure','held-identity','dispatched-write'])test('organization recovery '+scenario,async()=>{
 const f=await fixture();try{
  f.form.elements.internal_notes.value='PRIVATE ORIGINAL ORGANIZATION';
  if(scenario==='held-identity'){f.hold();f.emit();for(let i=0;i<20&&!f.held();i++)await tick();assert(f.held());}
  if(scenario==='dispatched-write'){f.holdResponse();f.emit();for(let i=0;i<20&&!f.responseHeld();i++)await tick();assert(f.responseHeld());assert.equal(f.writes.length,1);}
  if(scenario!=='normal-switch')f.w.history.replaceState=()=>{throw new f.w.DOMException('Injected history failure','SecurityError')};
  const selector=f.doc.querySelector('select[name=organization]');selector.value=ids.o2;selector.dispatchEvent(new f.w.Event('change'));await f.wait();
  assert.equal(f.doc.querySelectorAll('form.event-form').length,0);
  assert.equal(f.doc.querySelectorAll('[name=internal_notes]').length,0);
  if(scenario==='held-identity')f.release();if(scenario==='dispatched-write')f.releaseResponse();await f.wait();f.captured();await f.wait();
  assert.equal(f.writes.length,scenario==='dispatched-write'?1:0);
  if(scenario==='normal-switch'){assert.equal(f.w.location.search,'?org='+ids.o2);assert(f.calls.some(c=>c.p_org===ids.o2&&c.p_action==='list'));}
  else{assert.equal(f.w.location.search,'?org='+ids.o);assert.equal(selector.options.length,0);assert.match(f.doc.querySelector('#staff-events-app').textContent,/Organization change unavailable/);assert.equal(f.calls.some(c=>c.p_org===ids.o2),false);}
 }finally{f.dom.window.close()}
});

for(const outcome of ['lost','proxy','malformed'])test('safe save '+outcome+' preserves current draft and holds repeat submissions',async()=>{
 const f=await fixture();try{f.form.elements.title.value='Private unfinished draft';f.outcome(outcome);f.emit();await f.wait();
 assert.equal(f.writes.length,1);assert.match(f.form.textContent,/cannot confirm whether.*saved/i);assert.equal(f.form.elements.title.value,'Private unfinished draft');assert.equal(f.save.disabled,true);
 f.emit();f.captured();await f.wait();assert.equal(f.writes.length,1);assert.equal(f.calls.filter(c=>c.p_action==='detail').length,0);
 f.button('Close').click();await f.wait();f.button('Create event').click();const next=f.doc.querySelector('form.event-form');next.dispatchEvent(new f.w.SubmitEvent('submit',{bubbles:true,cancelable:true}));await f.wait();assert.equal(f.writes.length,1);assert.match(next.textContent,/cannot confirm whether.*saved/i);
 }finally{f.dom.window.close()}
});
test('safe save confirmed result opens exact returned event without resubmission',async()=>{const f=await fixture();try{f.outcome('confirmed');f.emit();await f.wait();assert.equal(f.writes.length,1);assert.equal(f.calls.filter(c=>c.p_action==='detail').at(-1).p_data.id,ids.event);f.captured();await f.wait();assert.equal(f.writes.length,1)}finally{f.dom.window.close()}});
test('safe save explicit rejection preserves draft and never retries automatically',async()=>{const f=await fixture();try{f.form.elements.title.value='Keep rejected draft';f.emit();await f.wait();assert.equal(f.writes.length,1);assert.match(f.form.textContent,/record changed/i);assert.equal(f.form.elements.title.value,'Keep rejected draft');assert.equal(f.save.disabled,false)}finally{f.dom.window.close()}});
for(const change of ['account','organization','logout'])test('safe save lost result after '+change+' cannot restore private draft',async()=>{const f=await fixture();try{f.form.elements.internal_notes.value='PRIVATE SAVE A';f.outcome('lost');f.holdResponse();f.emit();for(let i=0;i<20&&!f.responseHeld();i++)await tick();assert(f.responseHeld());if(change==='organization'){const n=f.doc.querySelector('select[name=organization]');n.value=ids.o2;n.dispatchEvent(new f.w.Event('change'))}else f.setActor(change==='account'?ids.other:null);f.releaseResponse();await f.wait();assert.equal(f.doc.querySelectorAll('[name=internal_notes]').length,0);f.captured();await f.wait();assert.equal(f.writes.length,1)}finally{f.dom.window.close()}});

for(const action of ['exception','settings','location','label'])test('safe save '+action+' lost response holds its existing mutation contract',async()=>{const f=await fixture(action);try{f.outcome('lost');f.emit();await f.wait();f.captured();await f.wait();assert.equal(f.writes.length,1);assert.match(f.form.textContent,/cannot confirm whether.*saved/i);assert.equal(f.save.disabled,true)}finally{f.dom.window.close()}});
test('safe save explicit rejection after silent account change clears private fields',async()=>{const f=await fixture();try{f.form.elements.internal_notes.value='PRIVATE A';f.holdResponse();f.emit();for(let i=0;i<20&&!f.responseHeld();i++)await tick();f.setActor(ids.other);f.releaseResponse();await f.wait();assert.equal(f.doc.querySelectorAll('[name=internal_notes]').length,0);assert.equal(f.writes.length,1)}finally{f.dom.window.close()}});
test('safe save pending request prevents a reopened form from creating another request',async()=>{const f=await fixture();try{f.holdResponse();f.outcome('lost');f.emit();for(let i=0;i<20&&!f.responseHeld();i++)await tick();f.button('Close').click();await f.wait();f.button('Create event').click();const next=f.doc.querySelector('form.event-form');next.dispatchEvent(new f.w.SubmitEvent('submit',{bubbles:true,cancelable:true}));await f.wait();assert.equal(f.writes.length,1);f.releaseResponse();await f.wait();assert.equal(f.writes.length,1)}finally{f.dom.window.close()}});

test('safe save late unknown from organization A cannot disable fresh organization B editor',async()=>{const f=await fixture();try{f.outcome('lost');f.holdResponse();f.emit();for(let i=0;i<20&&!f.responseHeld();i++)await tick();const selector=f.doc.querySelector('select[name=organization]');selector.value=ids.o2;selector.dispatchEvent(new f.w.Event('change'));await f.wait();f.button('Create event').click();const save=f.doc.querySelector('form.event-form [type=submit]');assert.equal(save.disabled,false);f.releaseResponse();await f.wait();assert.equal(save.disabled,false);assert.equal(f.writes.length,1)}finally{f.dom.window.close()}});

for(const action of ['location','label','settings'])test('safe save confirmed '+action+' is still confirmed after context refresh failure',async()=>{const f=await fixture(action);try{f.outcome('confirmed');f.failRead();f.emit();await f.wait();assert.equal(f.writes.length,1);assert.match(f.doc.querySelector('#staff-events-app').textContent,/Save confirmed.*could not be loaded.*Do not submit/s)}finally{f.dom.window.close()}});
test('safe save rejection after editor reopen clears misleading uncertain guidance without reviving old controls',async()=>{const f=await fixture();try{f.holdResponse();f.emit();for(let i=0;i<20&&!f.responseHeld();i++)await tick();f.button('Close').click();await f.wait();f.button('Create event').click();f.releaseResponse();await f.wait();assert.match(f.doc.querySelector('form.event-form').textContent,/earlier save was rejected.*Close and reopen/s);f.captured();await f.wait();assert.equal(f.writes.length,1)}finally{f.dom.window.close()}});
