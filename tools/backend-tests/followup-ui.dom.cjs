// Requires jsdom 26.1.0. No live requests or real identities.
const {JSDOM}=require('jsdom');const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');const dom=new JSDOM(fs.readFileSync(path.join(root,'staff-people.html'),'utf8'),{runScripts:'outside-only',url:'https://workspace.test/staff-people.html'});
const w=dom.window,d=w.document;w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
let task=null, conflict=false, inserts=0, listener;const calls=[];
w.ChampionLifeAuth={getUser:async()=>({id:'staff'}),client:{auth:{onAuthStateChange(fn){listener=fn}},from(table){const f={};let mode='select',values;const q={select(){return q},eq(k,v){f[k]=v;return q},is(k,v){f[k]=v;return q},order(){return q},range(){return q},limit(){return q},maybeSingle(){return q},insert(v){mode='insert';values=v;return q},update(v){mode='update';values=v;return q},then(resolve){let data=[];calls.push({table,mode,f:{...f},values});
 if(table==='organizations')data=[{id:'church',name:'Champion Life Church'},{id:'outreach',name:'SowGo'}];
 if(table==='organization_staff_permissions')data=['people.read','followup.read','followup.manage'].map(permission=>({organization_id:'church',permission})).concat([{organization_id:'outreach',permission:'people.read'}]);
 if(table==='organization_people')data=[{id:'person',organization_id:'church',first_name:'Jane',last_name:'Example'}];
 if(table==='followup_tasks'){
  if(mode==='insert'){inserts++;task={...values,id:'task',status:'open',revision:1,person:{first_name:'Jane',last_name:'Example'}};data={id:'task'};}
  else if(mode==='update'){data=conflict?null:{id:'task'};if(!conflict)task={...task,...values,revision:task.revision+1};}
  else data=task?[task]:[];
 }
 if(table==='followup_task_events')data=[{action:'created',occurred_at:'2026-09-25T12:00:00Z',actor_user_id:'staff',after_state:{title:'Welcome call',status:'open',due_on:null}}];
 return Promise.resolve({data,error:null}).then(resolve);}};return q;}}};
w.eval(fs.readFileSync(path.join(root,'assets/js/staff-people.js'),'utf8'));
const wait=()=>new Promise(r=>setTimeout(r,0));const click=s=>d.querySelector(s).click();const submit=()=>d.getElementById('task-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
(async()=>{
 await wait();click('.sidebar [data-view="people"]');await wait();click('#people button');assert.equal(d.getElementById('task-editor').open,true);
 d.getElementById('task-title').value='Welcome call';d.getElementById('task-assignee').value='staff';submit();await wait();await wait();
 assert.equal(inserts,1);assert.equal(task.assigned_user_id,'staff');assert.equal(task.organization_id,'church');assert.equal(d.getElementById('view-followup').hidden,false);assert.match(d.getElementById('task-list').textContent,/Welcome call/);
 click('#task-list button');d.getElementById('task-state').value='completed';submit();await wait();await wait();assert.equal(task.status,'completed');assert.equal(task.revision,2);assert.equal(calls.filter(c=>c.mode==='update').at(-1).f.revision,1);
 conflict=true;click('#task-list button');d.getElementById('task-title').value='Conflict';submit();await wait();assert.match(d.getElementById('task-save-status').textContent,/not saved/);assert.equal(task.title,'Welcome call');click('#task-cancel');
 click('#task-list .actions button:last-child');await wait();assert.match(d.getElementById('task-events').textContent,/Welcome call/);click('#task-history-close');
 const org=d.getElementById('organization');org.value='outreach';org.dispatchEvent(new w.Event('change'));await wait();assert.equal(d.getElementById('task-list').textContent,'');assert.match(d.getElementById('task-status').textContent,/not been assigned/);
 org.value='church';org.dispatchEvent(new w.Event('change'));await wait();click('#task-list button');listener('SIGNED_OUT',null);assert.equal(d.getElementById('task-editor').open,false);assert.equal(d.getElementById('task-title').value,'');assert.equal(d.getElementById('task-list').textContent,'');
 console.log('PASS follow-up UI: creation, self-assignment, status update, revision conflict, activity, organization switch and account clearing');dom.window.close();
})().catch(e=>{console.error(e);process.exitCode=1;dom.window.close()});
