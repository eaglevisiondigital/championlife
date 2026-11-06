// Independently authored actual-runtime review. Fictional transport; no hosted Auth.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const sources=['outreach-staff-common.js','outreach-people.js'].map(n=>readFileSync(new URL('../../assets/js/'+n,import.meta.url),'utf8'));
let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;console.log('PASS '+m)};
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{
 const page=await browser.newPage({viewport:{width:engine==='chromium'?390:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{assert.equal(new URL(r.request().url()).origin,'https://task-review.invalid');return r.fulfill({contentType:'text/html',body:'<main id="outreach-people"></main>'})});
 await page.goto('https://task-review.invalid/staff-people.html?org=org-a');
 await page.evaluate(()=>{
  window.actor={id:'actor-a'};window.caps=['people.read','followup.read','followup.manage'];window.calls=[];
  window.P='11111111-1111-4111-8111-111111111111';window.rows=Array.from({length:101},(_,i)=>({id:'aaaaaaaa-aaaa-4aaa-8aaa-'+String(101-i).padStart(12,'0'),title:'Task '+(101-i),status:'open',due_on:null,revision:7,created_at:'2026-11-06T01:02:03.123456Z'}));
  window.ChampionLifeAuth={getUser:async()=>actor,getSession:async()=>actor?{user:actor}:null,client:{auth:{onAuthStateChange:f=>window.authChange=f},rpc:async(name,p)=>{
   calls.push({kind:'rpc',name,...p});
   if(name==='staff_workspace_context'){
    if(window.holdAuth){holdAuth=false;await new Promise(r=>window.releaseAuth=r)}
    if(window.denyAuth)return{error:{code:'42501',message:'PRIVATE_DENIAL'}};
    return{data:{organizations:[{id:'org-a',name:'A'},{id:'org-b',name:'B'}],grants:['org-a','org-b'].flatMap(organization_id=>caps.map(permission=>({organization_id,permission,department_ids:null})))}};
   }
   if(p.p_action==='list')return{data:[{id:P,first_name:'Fictional',last_name:'Person'}]};
   if(p.p_action==='detail')return{data:{person:{id:P,first_name:'Fictional',last_name:'Person'},relationships:[]}};
   throw Error('Unexpected RPC');
  },from:table=>{
   const spec={kind:'table',table,filters:[]};const q={select:v=>(spec.select=v,q),eq:(k,v)=>(spec.filters.push([k,v]),q),order:()=>q,limit:n=>(spec.limit=n,q),or:s=>(spec.or=s,q),update:p=>(spec.update=structuredClone(p),q),maybeSingle:()=>q,then:async(resolve,reject)=>{try{
    calls.push(structuredClone(spec));
    if(spec.update){
     if(window.ambiguous)return resolve({error:{code:'XX000',message:'PRIVATE_UNCERTAIN'}});
     const task=rows.find(t=>t.id===spec.filters.find(f=>f[0]==='id')?.[1]);
     if(!task||task.revision!==spec.filters.find(f=>f[0]==='revision')?.[1])return resolve({data:null});
     Object.assign(task,spec.update);task.revision++;return resolve({data:{id:task.id}});
    }
    let data=rows.map(t=>({...t}));if(spec.or){const id=/id\.lt\.([a-f0-9-]+)\)$/.exec(spec.or)?.[1];if(!id)throw Error('invalid test cursor');data=data.filter(t=>t.id<id)}
    resolve({data:data.slice(0,spec.limit)});
   }catch(e){reject(e)}}};return q;
  }}};
 });
 for(const content of sources)await page.addScriptTag({content});
 const b=n=>page.getByRole('button',{name:n,exact:true}),count=()=>page.evaluate(()=>calls.filter(c=>c.update).length);
 const open=async()=>{await b('Review Person & follow-up').click();await page.getByText('Task page 1',{exact:true}).waitFor();await b('Older tasks').click();await page.getByText('Task page 2',{exact:true}).waitFor()};
 const fresh=async()=>{await page.evaluate(()=>{caps=['people.read','followup.read','followup.manage'];denyAuth=false;ambiguous=false;actor={id:'actor-'+Math.random()};authChange('SIGNED_IN',{user:actor})});await b('Review Person & follow-up').waitFor();await open()};
 const remember=()=>page.evaluate(()=>window.oldSave=[...document.querySelectorAll('button')].find(x=>x.textContent==='Save due date'));
 const detached=async(label)=>{const n=await count();await page.evaluate(()=>oldSave.onclick());eq(await count(),n,engine+' '+label+' no extra mutation')};
 await open();await page.getByLabel('Task due date',{exact:true}).fill('2026-12-02');await b('Save due date').click();await page.waitForFunction(()=>rows.at(-1).revision===8);await page.getByText('Task page 2',{exact:true}).waitFor();
 eq(await page.getByLabel('Task due date',{exact:true}).inputValue(),'2026-12-02',engine+' older page reschedule retained');
 const write=await page.evaluate(()=>calls.find(c=>c.update));eq(write.update,{due_on:'2026-12-02'},engine+' only date projected');eq(write.filters,[['organization_id','org-a'],['person_id','11111111-1111-4111-8111-111111111111'],['id','aaaaaaaa-aaaa-4aaa-8aaa-000000000001'],['revision',7]],engine+' exact scope/revision');
 await b('Remove due date').click();await page.waitForFunction(()=>rows.at(-1).revision===9);await page.getByText('Task page 2',{exact:true}).waitFor();eq(await page.getByLabel('Task due date',{exact:true}).inputValue(),'',engine+' remove date keeps older page');
 await page.locator('article select').selectOption('completed');await b('Save task status').click();await page.waitForFunction(()=>rows.at(-1).revision===10);await page.getByText('Task page 2',{exact:true}).waitFor();eq(await page.locator('article select').inputValue(),'completed',engine+' same older task status uses fresh revision');
 await remember();await page.getByLabel('Task due date',{exact:true}).fill('2026-12-03');await page.evaluate(()=>rows.at(-1).revision++);await b('Save due date').click();await page.getByText('Task changed or access was removed. Refresh the tasks before making another change.',{exact:true}).waitFor();eq(await b('Save due date').count(),0,engine+' revision conflict retires mutation control');await detached('revision conflict');
 await b('Refresh follow-up tasks').click();await page.getByText('Task page 2',{exact:true}).waitFor();eq(await page.getByLabel('Task due date',{exact:true}).inputValue(),'',engine+' conflict reload does not claim attempted change');
 await remember();await page.getByLabel('Task due date',{exact:true}).fill('2026-12-04');await page.evaluate(()=>ambiguous=true);await b('Save due date').click();await page.getByText('Task save needs review.',{exact:true}).waitFor();eq(await b('Save due date').count(),0,engine+' ambiguous write retires control');await detached('ambiguous result');eq((await page.locator('body').innerText()).includes('PRIVATE_UNCERTAIN'),false,engine+' transport details hidden');
 await fresh();await remember();await page.getByLabel('Task due date',{exact:true}).fill('2026-12-05');const n=await count();await page.evaluate(()=>holdAuth=true);await b('Save due date').click();await page.waitForFunction(()=>typeof releaseAuth==='function');await page.evaluate(()=>{actor={id:'replacement'};authChange('SIGNED_IN',{user:actor})});await b('Review Person & follow-up').waitFor();await page.evaluate(()=>releaseAuth());await detached('account change during reauthorization');eq(await count(),n,engine+' old reauthorization never writes');eq(await page.locator('h4').count(),0,engine+' account change hides old tasks');
 await open();await remember();await page.getByLabel('Task due date',{exact:true}).fill('2026-12-06');await page.evaluate(()=>denyAuth=true);await b('Save due date').click();await page.getByRole('alert').waitFor();await detached('server denial');eq(await page.locator('h4').count(),0,engine+' explicit denial clears private tasks');
 await fresh();await remember();await b('Refresh latest tasks').click();await page.getByText('Task page 1',{exact:true}).waitFor();await detached('navigation');
 await b('Older tasks').click();await page.getByText('Task page 2',{exact:true}).waitFor();await remember();await page.getByLabel('Task due date',{exact:true}).fill('2026-12-07');const before=await count();await page.evaluate(()=>actor={id:'silent-change'});await b('Save due date').click();await page.getByRole('alert').waitFor();eq(await count(),before,engine+' silent account change denies mutation');await detached('silent principal change');
 eq(await page.evaluate(()=>localStorage.length+sessionStorage.length),0,engine+' no private browser storage');eq(errors,[],engine+' no browser errors');await page.close();
 }finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,engines:['chromium','webkit'],hostedAcceptance:false}));
