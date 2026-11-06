// Actual shipped Events/Dream: pending detail/history retirement, not a native authority proof.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {detailFixture,ids,session} from './fixture.mjs';
const {chromium,webkit}=await import('../backend-tests/node_modules/playwright/index.mjs');
const root=resolve(process.env.SOURCE_ROOT||fileURLToPath(new URL('../../',import.meta.url))),sha=b=>createHash('sha256').update(b).digest('hex');
const sdk=readFileSync(process.env.SUPABASE_SDK_PATH);
assert.equal(sha(sdk),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const manifest=readFileSync(resolve(root,'tools/site-build/public-files.json')),allowed=new Set(JSON.parse(manifest)),hashes={};
const fixtureHashes=Object.fromEntries(['./fixture.mjs','../staff-cycle8/modules-fixture.mjs','../staff-cycle7/people-registration-fixture.mjs'].map(p=>[p,sha(readFileSync(new URL(p,import.meta.url)))]));
const origin='https://pending-detail.invalid',backend='https://synthetic-composition.supabase.co',key='sb-synthetic-composition-auth-token';
let checks=0;function eq(a,b,label){assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)}
async function until(page,condition,label){for(let n=0;n<500;n++){if(await condition())return;await page.waitForTimeout(10)}throw Error('Timed out: '+label)}
for(const [engine,type] of Object.entries({chromium,webkit})){
 if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==engine)continue;
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const module of ['events','dream'])for(const scenario of ['org-success','org-denial','same-org-denial','identity-success']){
  const f=detailFixture(),context=await browser.newContext({viewport:{width:engine==='chromium'?390:1440,height:950}}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  const label=engine+' '+module+' '+scenario,name=module==='events'?'events_workspace':'dream_team_manual_followup';
  const path=module==='events'?'staff-events.html':'staff-dream-team-manual.html';
  const button=()=>module==='events'?page.getByRole('button',{name:/^Private event /}):page.getByRole('button',{name:'Review application',exact:true});
  const select=()=>module==='events'?page.locator('select[name="organization"]'):page.getByLabel('Organization',{exact:true});
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(req.url()==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0')return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
   if(u.origin===backend)return f.backend(route);
   if(u.origin!==origin||req.method()!=='GET'){f.unexpected.push(req.url());return route.abort()}
   const p=u.pathname.slice(1);
   if(['seed','discipleship-login.html'].includes(p))return route.fulfill({body:'<!doctype html>Fictional authentication boundary',contentType:'text/html'});
   if(p==='assets/js/supabase-config.js')return route.fulfill({body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-no-authority'}),contentType:'text/javascript'});
   assert(allowed.has(p),'actual public dependency '+p);const body=readFileSync(resolve(root,p));if(hashes[p])assert.equal(sha(body),hashes[p],'source stable across scenarios '+p);hashes[p]=sha(body);
   return route.fulfill({body,contentType:p.endsWith('.html')?'text/html':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'image/png'});
  });
  try{
   await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(ids.a)});
   await page.goto(origin+'/'+path+'?org='+ids.o);await button().waitFor();
   await button().evaluate(b=>window.retainedDetail=b);f.holdDetail(name,scenario.includes('denial'));await button().click();
   await until(page,()=>f.held(),'detail response held');eq(f.calls.filter(c=>c.name===name&&c.action==='detail').length,1,label+' one pending detail');
   if(scenario.startsWith('org-')){
    if(module==='events'){await page.getByRole('button',{name:'Close',exact:true}).click();await button().waitFor()}
    await select().selectOption(ids.other);await button().waitFor();
    await until(page,async()=>new URL(page.url()).searchParams.get('org')===ids.other,'organization B selected');
   }else if(scenario==='same-org-denial'){
    // Retire only the detail ticket while preserving the same authority scope.
    if(module==='events'){await page.getByRole('button',{name:'Close',exact:true}).click();await button().waitFor()}
    else{await select().selectOption(ids.o);await button().waitFor()}
   }else{
    f.setActor(ids.b);await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(ids.b)});
   }
   f.release();await until(page,()=>f.finished()===1,'held response delivered');await page.waitForLoadState('networkidle');
   const text=await page.locator('body').innerText();
   if(module==='dream')eq(text.includes('Private answer A'),false,label+' no old restricted answer');
   eq(text.includes(module==='events'?'Private event A':'Existing manual task A'),false,label+' no old module detail projection');
   eq(await page.getByText(module==='events'?'Event history':'Task history',{exact:true}).count(),0,label+' no late old history');
   if(scenario.startsWith('org-')){
    eq(await select().inputValue(),ids.other,label+' old response cannot retire unrelated organization B');
    await button().click();await page.getByText(module==='events'?'Event history':'Task history',{exact:true}).waitFor();
    eq((await page.locator('body').innerText()).includes(module==='events'?'Private event B':'Existing manual task B'),true,label+' current B detail remains reviewable');
   }else{
    eq(await button().count(),0,label+' changed identity or current-scope denial retires review controls');
    eq((await page.locator('body').innerText()).includes(module==='events'?'Private event A':'Applicant A'),false,label+' current scope private projection cleared');
   }
   const before=f.calls.length;await page.evaluate(()=>{retainedDetail.click();retainedDetail.click()});await page.waitForTimeout(80);
   eq(f.calls.length,before,label+' duplicate detached detail control cannot request former scope');
   eq(f.writes,[],label+' no mutation or task issuance');eq(f.unexpected,[],label+' no provider/unknown request');eq(errors,[],label+' strict zero page errors');
  }catch(error){console.log(JSON.stringify({failure:label,error:String(error),body:await page.locator('body').innerText(),calls:f.calls,errors}));throw error}
  finally{f.release();await context.close()}
 }}finally{await browser.close()}
}
for(const [path,hash]of Object.entries(hashes))assert.equal(sha(readFileSync(resolve(root,path))),hash,'source stable '+path);
assert.equal(sha(readFileSync(resolve(root,'tools/site-build/public-files.json'))),sha(manifest));
for(const [path,hash]of Object.entries(fixtureHashes))assert.equal(sha(readFileSync(new URL(path,import.meta.url))),hash,'fixture stable '+path);
console.log(JSON.stringify({status:'PASS',checks,root,sourceHashes:hashes,fixtureHashes,manifestSHA256:sha(manifest),sdkSHA256:sha(sdk),authority:'fictional HTTP only; no native/hosted authorization claim'}));
