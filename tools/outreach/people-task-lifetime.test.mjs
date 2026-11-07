// Actual People runtime, fictional owned tasks, deterministic permission/response waits.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from '../backend-tests/node_modules/jsdom/lib/api.js';
const P='11111111-1111-4111-8111-111111111111',T='aaaaaaaa-aaaa-4aaa-8aaa-111111111111';
const runtime=readFileSync(process.env.PEOPLE_SOURCE||new URL('../../assets/js/outreach-people.js',import.meta.url),'utf8');
const common=readFileSync(new URL('../../assets/js/outreach-staff-common.js',import.meta.url),'utf8');
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setTimeout(r,0))};
async function fixture(){
 const dom=new JSDOM('<main id="outreach-people"></main>',{url:'https://fixture.invalid/staff-people.html?org=org-a&person='+P,runScripts:'outside-only'}),w=dom.window;
 const task={id:T,title:'Owned task',status:'open',due_on:'2026-11-11',revision:2,created_at:'2026-11-01T00:00:00Z'};
 let actor='actor-a',caps=['people.read','followup.read','followup.manage'],holdContext=false,releaseContext,holdUpdate=false,releaseUpdate,active=true,updateResult='success';
 const writes=[],requests=[],errors=[];
 const context=()=>({organizations:['org-a','org-b'].map(id=>({id,name:id})),grants:['org-a','org-b'].flatMap(organization_id=>caps.map(permission=>({organization_id,permission,department_ids:null})))});
 w.addEventListener('error',e=>errors.push(e.message));w.StaffWorkspace={active:()=>active};
 w.ChampionLifeAuth={getUser:async()=>({id:actor}),getSession:async()=>({user:{id:actor}}),client:{auth:{onAuthStateChange:fn=>w.authChange=fn},rpc:async(name,args)=>{
  requests.push({name,args});if(name==='staff_workspace_context'){if(holdContext){holdContext=false;await new Promise(r=>releaseContext=r)}return{data:context()}}
  return{data:args.p_action==='list'?[{id:P,first_name:'Owned',last_name:'Person'}]:{person:{id:P,first_name:'Owned',last_name:'Person'},relationships:[]}};
 },from:table=>{
  const filters=[],q={select:()=>q,eq:(key,value)=>(filters.push([key,value]),q),order:()=>q,or:()=>q,limit:()=>q,maybeSingle:()=>q,update:payload=>{q.payload=payload;return q},then:async(resolve,reject)=>{
   try{requests.push({table,action:q.payload?'update':'read'});if(q.payload){writes.push({table,payload:q.payload,filters,actor});if(holdUpdate){holdUpdate=false;await new Promise(r=>releaseUpdate=r)}if(updateResult==='lost')throw Error('fictional response lost');resolve({data:updateResult==='stale'?null:{id:updateResult==='malformed'?'wrong-task':T}})}else resolve({data:[{...task}]})}catch(e){reject(e)}
  }};return q;
 }}};
 w.eval(common);w.eval(runtime);await settle();
 const card=[...w.document.querySelectorAll('article')].find(e=>e.querySelector('h4')?.textContent==='Owned task');assert.ok(card,'original task ready');
 const btn=text=>[...card.querySelectorAll('button')].find(e=>e.textContent===text);
 const status=btn('Save task status'),due=btn('Save due date'),remove=btn('Remove due date'),input=card.querySelector('input[type=date]'),select=card.querySelector('select'),controls=status.parentElement;
 select.value='completed';input.value='2026-12-01';
 return{w,dom,task,card,status,due,remove,input,select,controls,writes,requests,errors,
  contextHold:()=>{holdContext=true},contextRelease:()=>{assert.ok(releaseContext,'permission wait reached');releaseContext()},updateHold:()=>{holdUpdate=true},updateRelease:()=>{assert.ok(releaseUpdate,'update submitted');releaseUpdate()},
  actor:(value,callback=true)=>{actor=value;if(callback)w.authChange('SIGNED_IN',{user:{id:actor}})},caps:value=>caps=value,active:value=>active=value,outcome:value=>updateResult=value,close:()=>w.close()};
}
function retire(f,kind){
 const n=kind==='button'?f.status:kind==='card'?f.card:kind==='controls'?f.controls:kind==='select'?f.select:kind==='due'?f.input:kind==='label'?f.input.parentElement:kind==='ancestor'?f.card.parentElement:kind==='root'?f.w.document.getElementById('outreach-people'):f.controls;
 const parent=n.parentNode,next=n.nextSibling;n.remove();
 if(kind==='extract'){const button=f.status;button.remove();f.card.append(button)}else parent.insertBefore(n,next);
}
for(const kind of ['button','card','controls','select','due','label','ancestor','root','extract'])for(const timing of ['before-handler','during-permission'])test(kind+' '+timing+' permanently rejects NEW mutations',async()=>{
 const f=await fixture();try{
  const retained=f.status.onclick;
  if(timing==='during-permission'){f.contextHold();retained();await settle();retire(f,kind);f.contextRelease()}
  else{retire(f,kind);retained()}
  await settle();assert.equal(f.writes.length,0,'zero new task updates after removal');
  retained();await settle();assert.equal(f.writes.length,0,'retained handler cannot regain authority');
  assert.equal(f.errors.length,0);
 }finally{f.close()}
});
for(const mode of ['account','missed-account','organization','revoke','shell','clear'])test(mode+' while permission awaits denies update',async()=>{
 const f=await fixture();try{f.contextHold();const retained=f.status.onclick;retained();await settle();
  if(mode==='account')f.actor('actor-b');if(mode==='missed-account')f.actor('actor-b',false);
  if(mode==='organization'){delete f.w.StaffWorkspace;const org=f.w.document.querySelector('[aria-label=Organization]');org.value='org-b';org.onchange()}
  if(mode==='revoke')f.caps(['people.read','followup.read']);if(mode==='shell')f.active(false);if(mode==='clear')f.w.dispatchEvent(new f.w.Event('staff-protected-clear'));
  f.contextRelease();await settle();assert.equal(f.writes.length,0);retained();await settle();assert.equal(f.writes.length,0);
 }finally{f.close()}
});
for(const mode of ['status','due','remove'])test('current legitimate '+mode+' preserves exact canonical scope/revision',async()=>{
 const f=await fixture();try{await f[mode].onclick();await settle();assert.equal(f.writes.length,1);assert.deepEqual(f.writes[0].filters,[['organization_id','org-a'],['person_id',P],['id',T],['revision',2]]);assert.equal(f.writes[0].actor,'actor-a');assert.deepEqual(JSON.parse(JSON.stringify(f.writes[0].payload)),mode==='status'?{status:'completed'}:{due_on:mode==='remove'?null:'2026-12-01'});assert.equal(f.errors.length,0)}finally{f.close()}
});
test('already submitted update is distinguished from retired replay and stale publication',async()=>{
 const f=await fixture();try{f.updateHold();const retained=f.status.onclick;retained();await settle();assert.equal(f.writes.length,1,'one update submitted BEFORE retirement');retire(f,'card');f.updateRelease();await settle();retained();await settle();assert.equal(f.writes.length,1,'no NEW update after retirement');assert.equal(f.card.isConnected,true,'test actually reinserted the same card');assert.equal(f.errors.length,0)}finally{f.close()}
});
test('unrelated DOM edits do not retire legitimate task editor',async()=>{
 const f=await fixture();try{const node=f.w.document.createElement('div');f.w.document.body.append(node);node.remove();await f.status.onclick();await settle();assert.equal(f.writes.length,1)}finally{f.close()}
});

for(const outcome of ['stale','lost','malformed'])test(outcome+' outcome preserves read-only reconciliation, never old mutation',async()=>{
 const f=await fixture();try{f.outcome(outcome);const retained=f.status.onclick;await retained();await settle();assert.equal(f.writes.length,1);
  const refresh=[...f.card.querySelectorAll('button')].find(x=>x.textContent==='Refresh follow-up tasks');assert.ok(refresh,'read-only review action remains');
  f.card.append(f.status);await retained();assert.equal(f.writes.length,1,'old mutation remains permanently denied after review');
  const reads=f.requests.filter(x=>x.action==='read').length;await refresh.onclick();await settle();assert.equal(f.writes.length,1);assert.ok(f.requests.filter(x=>x.action==='read').length>reads,'legitimate reconciliation reads canonical tasks');assert.equal(f.errors.length,0);
 }finally{f.close()}
});
