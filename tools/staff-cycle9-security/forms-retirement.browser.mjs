// Existing context API must not issue Auth I/O after shared97 detaches its root.
// This is a focused lifecycle invariant, not proof of the original Linux error's cause.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {securityFixture,ids,session} from './fixture.mjs';
const {chromium,webkit}=await import('../backend-tests/node_modules/playwright/index.mjs');
const root=resolve(process.env.SOURCE_ROOT||fileURLToPath(new URL('../../',import.meta.url))),sdk=readFileSync(process.env.SUPABASE_SDK_PATH),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(sdk),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const allowed=new Set(JSON.parse(readFileSync(resolve(root,'tools/site-build/public-files.json')))),hashes={},origin='https://forms-retirement.invalid',backend='https://synthetic-composition.supabase.co',key='sb-synthetic-composition-auth-token';
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
for(const [engine,type]of Object.entries({chromium,webkit})){
 if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==engine)continue;
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{
  const f=securityFixture(),context=await browser.newContext({viewport:{width:768,height:950}}),page=await context.newPage(),errors=[];let authCalls=0;
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(req.url()==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0')return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
   if(u.origin===backend){if(u.pathname==='/auth/v1/user')authCalls++;return f.backend(route)}
   if(u.origin!==origin||req.method()!=='GET'){f.unexpected.push(req.url());return route.abort()}
   const path=u.pathname.slice(1);
   if(path==='seed')return route.fulfill({body:'<!doctype html>Fictional seed',contentType:'text/html'});
   if(path==='assets/js/supabase-config.js')return route.fulfill({body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-no-authority'}),contentType:'text/javascript'});
   assert(allowed.has(path),'actual shipped dependency '+path);const body=readFileSync(resolve(root,path));hashes[path]=sha(body);
   return route.fulfill({body,contentType:path.endsWith('.html')?'text/html':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'image/png'});
  });
  await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(ids.a)});
  await page.goto(origin+'/staff-forms.html?organization='+ids.o);await page.getByText('Private draft A',{exact:false}).waitFor();await page.waitForLoadState('networkidle');
  const before=authCalls;await page.evaluate(async()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));await ChampionLifeFormsContext.refresh()});
  eq(await page.locator('#forms-app').count(),0,engine+' actual shared session pagehide detached Forms');
  console.log(JSON.stringify({retiredRefreshObservation:engine,before,after:authCalls,contextSHA256:hashes['assets/js/forms-context.js']}));
  eq(authCalls,before,engine+' retired Forms refresh performs no new Auth HTTP');
  eq(errors,[],engine+' no runtime error suppression');eq([...f.unexpected,...f.people.unexpected,...f.modules.unexpected],[],engine+' no unknown/provider HTTP');await context.close();
 }finally{await browser.close()}
}
for(const [path,hash]of Object.entries(hashes))assert.equal(sha(readFileSync(resolve(root,path))),hash,'source unchanged '+path);
console.log(JSON.stringify({status:'PASS',checks,sourceHashes:hashes,root,originalLinuxFailure:'unresolved; this is a distinct obsolete-context invariant'}));
