// Regression for direct task-table completion, which does not traverse the shell RPC guard.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createFixture,ids,session} from '../staff-cycle7/people-registration-fixture.mjs';
const {chromium,webkit}=await import('../backend-tests/node_modules/playwright/index.mjs');
const root=resolve(process.env.SOURCE_ROOT||fileURLToPath(new URL('../../',import.meta.url))),sdk=readFileSync(process.env.SUPABASE_SDK_PATH),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(sdk),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const allowed=new Set(JSON.parse(readFileSync(resolve(root,'tools/site-build/public-files.json')))),hashes={},origin='https://direct-response.invalid',backend='https://synthetic-composition.supabase.co',key='sb-synthetic-composition-auth-token';
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
for(const [engine,type]of Object.entries({chromium,webkit})){
 if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==engine)continue;
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{
  const f=createFixture(),context=await browser.newContext({viewport:{width:768,height:950}}),page=await context.newPage(),errors=[];let release=null,patches=0;
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(req.url()==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0')return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
   if(u.origin===backend){
    const headers={'access-control-allow-origin':'*'};
    if(u.pathname==='/rest/v1/rpc/communications_workspace')return route.fulfill({status:404,json:{code:'PGRST202'},headers});
    if(u.pathname==='/rest/v1/followup_tasks'&&req.method()==='PATCH'){
     patches++;await new Promise(r=>release=r);return route.fulfill({status:503,json:{code:'TEST_UNCERTAIN',message:'Fictional failed response; no task mutation performed'},headers});
    }
    return f.backend({request:()=>req,abort:(...args)=>route.abort(...args),fulfill:options=>route.fulfill({...options,headers:{...options.headers,...headers}})});
   }
   if(u.origin!==origin||req.method()!=='GET'){f.unexpected.push(req.url());return route.abort()}
   const path=u.pathname.slice(1);
   if(['seed','discipleship-login.html'].includes(path))return route.fulfill({body:'<!doctype html>Fictional authentication boundary',contentType:'text/html'});
   if(path==='assets/js/supabase-config.js')return route.fulfill({body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-no-authority'}),contentType:'text/javascript'});
   assert(allowed.has(path),'actual shipped dependency '+path);const body=readFileSync(resolve(root,path));hashes[path]=sha(body);
   return route.fulfill({body,contentType:path.endsWith('.html')?'text/html':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'image/png'});
  });
  await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(ids.a)});
  await page.goto(origin+'/staff-people.html?org='+ids.o);await page.getByRole('button',{name:'Review Person & follow-up',exact:true}).click();await page.getByRole('heading',{name:'Follow-up tasks',exact:true}).waitFor();
  const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Care 100',exact:true})});
  await card.getByLabel('Status').selectOption('completed').catch(async error=>{console.log(JSON.stringify({setupFailure:await page.locator('body').innerText(),calls:f.calls,errors}));throw error});await card.getByRole('button',{name:'Save task status',exact:true}).evaluate(b=>window.retiredTaskSave=b.onclick);await card.getByRole('button',{name:'Save task status',exact:true}).click();
  for(let i=0;i<500&&!release;i++)await page.waitForTimeout(10);assert(release,'direct PATCH response held');eq(patches,1,engine+' one existing-task update attempted');
  // Actual SDK reads persisted storage on getSession. Same-document storage change
  // models a missed callback; no Auth runtime method or application function is replaced.
  f.setActor(ids.b);await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(ids.b)});
  release();await page.waitForTimeout(180);
  console.log(JSON.stringify({completionObservation:engine,body:await page.locator('body').innerText(),peopleSHA256:hashes['assets/js/outreach-people.js'],patches}));
  eq((await page.locator('body').innerText()).includes('Care 100'),false,engine+' failed direct response after silent account replacement clears old task data');
  eq((await page.locator('body').innerText()).includes('Taylor Person'),false,engine+' failed direct response cannot retain old Person');
  eq(patches,1,engine+' uncertain failed response is never automatically retried');
  const callsBefore=f.calls.length;await page.evaluate(()=>{retiredTaskSave();retiredTaskSave()});await page.waitForTimeout(80);
  eq(patches,1,engine+' duplicate retained save cannot submit another PATCH');eq(f.calls.length,callsBefore,engine+' duplicate retained save cannot query former scope');
  eq(f.writes.length,0,engine+' fixture performed no task mutation');eq(errors,[],engine+' no runtime exceptions');eq(f.unexpected,[],engine+' no external/unexpected HTTP');await context.close();
 }finally{await browser.close()}
}
for(const [path,hash]of Object.entries(hashes))assert.equal(sha(readFileSync(resolve(root,path))),hash,'source unchanged '+path);
console.log(JSON.stringify({status:'PASS',checks,sourceHashes:hashes,root,providerOperations:0,hostedAuth:false}));
