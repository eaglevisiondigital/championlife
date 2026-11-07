// Independent actual-runtime Chromium/WebKit review. Fictional transport only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const origin='https://pagination-independent.invalid';
const sources=['outreach-staff-common.js','outreach-people.js'].map(n=>readFileSync(new URL('../../assets/js/'+n,import.meta.url),'utf8'));
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{
  const page=await browser.newPage({viewport:{width:engine==='chromium'?390:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async r=>{assert.equal(new URL(r.request().url()).origin,origin);await r.fulfill({contentType:'text/html',body:'<main id="outreach-people"></main>'})});
  await page.goto(origin+'/staff-people.html?org=org-a');
  await page.evaluate(()=>{
   window.actor={id:'review-actor-a'};window.calls=[];window.caps=['people.read','followup.read'];window.rows=[];
   window.P='11111111-1111-4111-8111-111111111111';
   window.resetRows=()=>{rows=Array.from({length:205},(_,n)=>({id:'aaaaaaaa-aaaa-4aaa-8aaa-'+String(205-n).padStart(12,'0'),title:'Private Task '+(205-n),created_at:'2026-11-06T01:02:03.654321-05:30',status:'open',due_on:null,revision:1}))};resetRows();
   const context=()=>({organizations:[{id:'org-a',name:'A'},{id:'org-b',name:'B'}],grants:['org-a','org-b'].flatMap(organization_id=>caps.map(permission=>({organization_id,permission,department_ids:null})))});
   window.ChampionLifeAuth={getUser:async()=>actor,getSession:async()=>actor?{user:actor}:null,client:{auth:{onAuthStateChange:f=>window.authChange=f},rpc:async(name,p)=>{
    calls.push({kind:'rpc',name,...p});
    if(name==='staff_workspace_context')return{data:context()};
    if(p.p_action==='list')return{data:[{id:P,first_name:'Independent',last_name:'Person'}]};
    if(p.p_action==='detail')return{data:{person:{id:P,first_name:'Independent',last_name:'Person'},relationships:[]}};
    throw Error('unexpected rpc');
   },from:table=>{
    const spec={kind:'table',table,filters:[],orders:[]};const q={select:v=>(spec.columns=v,q),eq:(k,v)=>(spec.filters.push([k,v]),q),order:(k,v)=>(spec.orders.push([k,v]),q),limit:n=>(spec.limit=n,q),or:s=>(spec.or=s,q),then:async(resolve,reject)=>{
     try{calls.push(structuredClone(spec));let result=rows.map(x=>({...x}));
      if(spec.or){const m=/id\.lt\.([a-f0-9-]+)\)$/.exec(spec.or);if(!m)throw Error('malformed test query');result=result.filter(t=>t.id<m[1])}
      result=result.slice(0,spec.limit);
      if(window.holdNext){holdNext=false;await new Promise(r=>window.release=r)}
      if(window.failNext){failNext=false;return resolve({data:null,error:{code:'XX000',message:'PRIVATE_INDEPENDENT_SQL'}})}
      resolve({data:result});
     }catch(e){reject(e)}
    }};return q;
   }}};
  });
  for(const content of sources)await page.addScriptTag({content});
  const button=name=>page.getByRole('button',{name,exact:true});
  const open=async()=>{await button('Review Person & follow-up').click();await page.getByText('Task page 1',{exact:true}).waitFor()};
  const second=async()=>{await button('Older tasks').click();await page.getByText('Task page 2',{exact:true}).waitFor()};
  const snapshot=()=>page.evaluate(()=>structuredClone(calls));
  const remember=()=>page.evaluate(()=>{window.oldOlder=[...document.querySelectorAll('button')].find(b=>b.textContent==='Older tasks');window.oldNewer=[...document.querySelectorAll('button')].find(b=>b.textContent==='Newer tasks')});
  const invokeDetached=async(label)=>{const before=await snapshot();await page.evaluate(async()=>{await oldOlder.onclick();await oldNewer.onclick()});eq(await snapshot(),before,engine+' '+label+' detached Older/Newer issue zero queries')};
  const reopen=async()=>{await button('Back to People').click();await open()};
  const lastRead=()=>page.evaluate(()=>calls.filter(c=>c.kind==='table').at(-1));
  const waitHeld=()=>page.waitForFunction(()=>typeof release==='function');
  const release=()=>page.evaluate(()=>{const r=window.release;delete window.release;r()});
  await open();
  eq(await page.locator('h4').count(),100,engine+' first page renders100 not lookahead101');
  await second();let query=await lastRead();
  eq(query.or,'created_at.lt.2026-11-06T01:02:03.654321-05:30,and(created_at.eq.2026-11-06T01:02:03.654321-05:30,id.lt.aaaaaaaa-aaaa-4aaa-8aaa-000000000106)',engine+' cursor preserves exact microseconds timezone and boundary UUID');
  eq(query.filters,[['organization_id','org-a'],['person_id','11111111-1111-4111-8111-111111111111']],engine+' page read retains exact scope');
  eq(query.limit,101,engine+' page query is bounded');
  await remember();await button('Refresh latest tasks').click();await page.getByText('Task page 1',{exact:true}).waitFor();await invokeDetached('refresh retirement');eq((await lastRead()).or,undefined,engine+' latest refresh clears cursor');
  await second();await remember();await button('Newer tasks').click();await page.getByText('Task page 1',{exact:true}).waitFor();await invokeDetached('newer navigation retirement');
  // A failed Older read cannot leave its old controls usable or transfer cursor
  // state into a fresh person-detail traversal.
  await second();await remember();await page.evaluate(()=>window.failNext=true);await button('Older tasks').click();await page.getByRole('status').filter({hasText:'Unable to complete'}).waitFor();
  eq(await page.locator('h4').count(),0,engine+' failed page exposes no prior or partial tasks');eq((await page.locator('body').innerText()).includes('PRIVATE_INDEPENDENT_SQL'),false,engine+' raw failure omitted');eq(await page.getByText('No follow-up tasks.',{exact:true}).count(),0,engine+' failure is not empty-list success');await invokeDetached('failed pagination');await reopen();eq((await lastRead()).or,undefined,engine+' reopening after failure starts at latest');
  // Both directions must retire on account changes, not just the older button.
  await second();await remember();await page.evaluate(()=>{actor={id:'review-actor-b'};authChange('SIGNED_IN',{user:actor})});await button('Review Person & follow-up').waitFor();await invokeDetached('account change');await open();eq((await lastRead()).or,undefined,engine+' new account starts without old cursor');
  await second();await remember();await page.getByLabel('Organization',{exact:true}).selectOption('org-b');await button('Review Person & follow-up').waitFor();await invokeDetached('organization change');await open();query=await lastRead();eq(query.filters[0],['organization_id','org-b'],engine+' new organization is exact');eq(query.or,undefined,engine+' new organization starts without old cursor');
  // Old results captured before a switch cannot publish after the new scope.
  await second();await remember();await page.evaluate(()=>window.holdNext=true);await button('Older tasks').click();await waitHeld();await page.evaluate(()=>{actor={id:'review-actor-c'};authChange('SIGNED_IN',{user:actor})});await button('Review Person & follow-up').waitFor();await open();await release();await page.waitForTimeout(30);eq(await page.getByText('Task page 1',{exact:true}).count(),1,engine+' account switch rejects delayed older-page publication');eq(await page.getByText('Task page 3',{exact:true}).count(),0,engine+' old third page absent');await invokeDetached('delayed account transition');
  // Permission loss after a bounded task response must clear private rows.
  await page.evaluate(()=>window.holdNext=true);await button('Older tasks').click();await waitHeld();await page.evaluate(()=>caps=['people.read']);await release();await page.getByRole('alert').waitFor();eq(await page.locator('h4').count(),0,engine+' post-read permission loss clears tasks');
  // Syntactically unsafe IDs must not be concatenated into an .or filter.
  await page.evaluate(()=>{caps=['people.read','followup.read'];resetRows();rows[99].id='x),organization_id.neq.org-b';actor={id:'review-actor-d'};authChange('SIGNED_IN',{user:actor})});await button('Review Person & follow-up').waitFor();await open();eq(await button('Older tasks').count(),0,engine+' unsafe UUID boundary cannot become query');eq(await page.getByRole('status').innerText(),'Unable to load older tasks. Please refresh and try again.',engine+' unsafe cursor visibly unavailable');eq((await lastRead()).or,undefined,engine+' invalid boundary does not submit filter');
  // Silent principal mismatch is detected by the existing request fence even
  // before an auth event retires the generation.
  await page.evaluate(()=>resetRows());await button('Refresh latest tasks').click();await page.getByText('Task page 1',{exact:true}).waitFor();const before=await snapshot();await page.evaluate(()=>actor={id:'silent-new-principal'});await button('Older tasks').click();await page.getByRole('alert').waitFor();eq(await snapshot(),before,engine+' silent account mismatch issues no RPC or table request');eq(await page.locator('h4').count(),0,engine+' silent account mismatch clears tasks');
  eq(await page.evaluate(()=>localStorage.length+sessionStorage.length),0,engine+' no cursor or task storage');eq(errors,[],engine+' no browser exceptions');await page.close();
 }finally{await browser.close()}
}
console.log(JSON.stringify({ok:true,checks,syntheticTransport:true,hostedAcceptance:false}));
