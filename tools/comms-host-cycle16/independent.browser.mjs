// Independent real-host review. Exact accepted SDK, fictional origin-locked HTTP.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {model,ids,session} from '../staff-host-cycle8/communications-fixture.mjs';
import {root,runtime,compose,hash} from './source.mjs';
const sdk=readFileSync(process.env.SUPABASE_SDK_PATH),expected=compose();
const bytes=process.env.ACTUAL_RUNTIME==='1'?readFileSync(new URL(runtime,root)):expected;
if(process.env.ACTUAL_RUNTIME==='1')assert.deepEqual(bytes,expected,'Installed runtime is the exact reviewed composition');
assert.equal(hash(sdk),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const origin='https://independent-comms-host.invalid',backend='https://fictional-auth.supabase.co';let checks=1;
const check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
for(const [engine,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of [390,1440]){
  const label=engine+' '+width;
  async function setup(query='organization='+ids.o,denied=false){
   const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),f=model(),errors=[];
   page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.url()==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0')return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
    if(url.origin===backend)return f.backend(route);
    assert.equal(url.origin,origin,'Every external origin is rejected');assert.equal(request.method(),'GET');
    if(url.pathname==='/seed')return route.fulfill({body:'<!doctype html><title>Fictional local seed</title>',contentType:'text/html'});
    if(url.pathname==='/assets/js/supabase-config.js')return route.fulfill({body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-no-authority'}),contentType:'text/javascript'});
    const path=url.pathname.slice(1);assert(!path.includes('..'));return route.fulfill({body:path===runtime?bytes:readFileSync(new URL(path,root)),contentType:path.endsWith('.html')?'text/html':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'image/png'});
   });
   await page.goto(origin+'/seed');await page.evaluate(value=>localStorage.setItem('sb-fictional-auth-auth-token',JSON.stringify(value)),session(ids.a));
   await page.goto(origin+'/staff-communication-activity.html?'+query);
   await page.getByRole(denied?'link':'button',{name:denied?'Verify access again':'View message',exact:true}).waitFor();return {context,page,f,errors};
  }
  for(const boundary of [1,2])for(const removal of ['control','row','root']){
   const {context,page,f,errors}=await setup();
   await page.getByRole('button',{name:'View message',exact:true}).evaluate((button,boundary)=>{
    const original=ChampionLifeAuth.getUser;let calls=0;window.retained=button.onclick;window.oldButton=button;
    ChampionLifeAuth.getUser=()=>++calls===boundary?new Promise(resolve=>window.releaseAuth=async()=>resolve(await original())):original();
    window.pending=retained();
   },boundary);
   await page.waitForFunction(()=>typeof releaseAuth==='function');
   await page.evaluate(async removal=>{
    const node=removal==='root'?document.getElementById('communications-app'):removal==='row'?oldButton.closest('.comm-row'):oldButton;
    const parent=node.parentNode,next=node.nextSibling;node.remove();parent.insertBefore(node,next);await releaseAuth();await pending;await retained();
   },removal);
   check(f.calls.filter(x=>x.action==='message').length,0,label+' '+removal+' at Auth await '+boundary+' denies all retained reads');
   check(await page.locator('.comm-body').count(),0,label+' '+removal+' at Auth await '+boundary+' retains no protected body');
   check(errors,[],label+' '+removal+' at Auth await '+boundary+' no browser error');
   check(f.unexpected,[],label+' '+removal+' no provider/mutation request');await context.close();
  }
  for(const retirement of ['protected-clear','auth-replacement']){
   const{context,page,f,errors}=await setup();
   await page.getByRole('button',{name:'View message',exact:true}).evaluate(async(button,retirement)=>{
    const retained=button.onclick;if(retirement==='protected-clear')dispatchEvent(new Event('staff-protected-clear'));
    else window.ChampionLifeAuth={...ChampionLifeAuth};await retained();await retained();
   },retirement);
   check(f.calls.filter(x=>x.action==='message').length,0,label+' '+retirement+' denies retained requests');
   check(await page.locator('.comm-body').count(),0,label+' '+retirement+' no protected body');
   check(errors,[],label+' '+retirement+' no browser error');await context.close();
  }
  for(const hint of ['organization=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','campaign=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1']){
   const{context,page,f,errors}=await setup(hint,true);
   check(f.calls.filter(x=>x.name==='communications_workspace'&&x.action!=='context').length,0,label+' unauthorized hint never starts scoped Communications work '+hint);
   check(await page.locator('.comm-body').count(),0,label+' unauthorized hint has no private detail');check(errors,[],label+' denied hint no browser errors');await context.close();
  }
  {
   const{context,page,f,errors}=await setup('campaign='+ids.c);
   await page.getByRole('button',{name:'View message',exact:true}).click();await page.getByText('Private fictional subject\nPrivate fictional body',{exact:true}).waitFor();
   await page.getByRole('combobox',{name:'Outreach campaign',exact:true}).selectOption(ids.d);
   await page.waitForURL('**/staff-communication-activity.html?campaign='+ids.d);await page.getByRole('button',{name:'View message',exact:true}).waitFor();
   const last=f.calls.filter(x=>x.action==='activity').at(-1);
   check(last.p.p_campaign,ids.d,label+' actual shared host binds selected campaign');check(last.p.p_payload.organization_id,ids.p,label+' selected campaign derives owning organization');
   check(await page.locator('.comm-body').count(),0,label+' campaign navigation drops prior private detail');check(errors,[],label+' campaign transition no browser errors');await context.close();
  }
  {
   const{context,page,f,errors}=await setup();await page.getByRole('button',{name:'View message',exact:true}).click();
   await page.getByText('Private fictional subject\nPrivate fictional body',{exact:true}).waitFor();
   check(f.calls.filter(x=>x.action==='message').length,1,label+' legitimate attached read remains one request');
   check(await page.getByRole('button',{name:'Retry',exact:true}).count(),0,label+' UNKNOWN remains without Retry');
   check(await page.locator('#communications-app select[name=scope]').count(),0,label+' host alone owns scope');
   check(errors,[],label+' legitimate host no browser errors');check(f.unexpected,[],label+' no provider or mutation operation');await context.close();
  }
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,runtimeSHA256:hash(bytes),actualHostAndSDK:true,fictionalHTTP:true,hostedAcceptance:false,sending:false}));
