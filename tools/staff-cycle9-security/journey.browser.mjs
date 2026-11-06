// Independent source-bound security journey. No runtime overlays or compatibility shims.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {securityFixture,ids,session} from './fixture.mjs';
const {chromium,webkit}=await import('../backend-tests/node_modules/playwright/index.mjs');
const root=resolve(process.env.SOURCE_ROOT||fileURLToPath(new URL('../../',import.meta.url)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),sdk=readFileSync(process.env.SUPABASE_SDK_PATH);
assert.equal(sha(sdk),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const manifest=readFileSync(resolve(root,'tools/site-build/public-files.json')),allowed=new Set(JSON.parse(manifest)),served=new Map();
const moduleSpecs=[{name:'Forms',path:'staff-forms.html',key:'organization',rpc:'forms_workspace',marker:'Private draft A',mount:'#forms-app'},{name:'Events',path:'staff-events.html',key:'org',rpc:'events_workspace',marker:'Private event A',mount:'#staff-events-app'},{name:'Dream',path:'staff-dream-team-manual.html',key:'org',rpc:'dream_team_manual_followup',marker:'Applicant A',mount:'#dream-team-manual'}];
for(const path of ['staff-home.html','staff-people.html','staff-outreach-registration.html','staff-communication-activity.html',...moduleSpecs.map(m=>m.path)]){
 assert(allowed.has(path),'actual build manifest must ship '+path);assert(readFileSync(resolve(root,path)).length,'actual source must exist '+path);
}
const origin='https://staff-cycle9.invalid',backend='https://synthetic-composition.supabase.co',sdkUrl='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0',key='sb-synthetic-composition-auth-token';
let checks=0;const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;console.log('PASS '+label)};
for(const [engine,type]of Object.entries({chromium,webkit})){
 if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==engine)continue;
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of [390,768,1440]){
  if(process.env.TEST_WIDTH&&Number(process.env.TEST_WIDTH)!==width)continue;
  const label=engine+' '+width;
  async function setup(){
   const f=securityFixture(),context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[],requests=[];
   page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push({message:e.message,stack:e.stack,time:Date.now()}));page.on('requestfailed',r=>requests.push({url:r.url(),failure:r.failure(),time:Date.now()}));
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(req.url()===sdkUrl)return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
    if(url.origin===backend)return f.backend(route);
    if(url.origin!==origin||req.method()!=='GET'){f.unexpected.push(req.method()+' '+url.href);return route.abort()}
    const path=url.pathname.slice(1);
    // Fictional authentication boundary only; protected HTML is always actual source.
    if(['seed','discipleship-login.html'].includes(path))return route.fulfill({body:'<!doctype html><h1>Fictional authentication boundary</h1>',contentType:'text/html'});
    if(path==='assets/js/supabase-config.js')return route.fulfill({body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-no-authority'}),contentType:'text/javascript'});
    if(!allowed.has(path)){f.unexpected.push(path);return route.fulfill({status:404,body:''})}
    const body=readFileSync(resolve(root,path)),hash=sha(body);if(served.has(path))assert.equal(hash,served.get(path),'source stable during journey '+path);else served.set(path,hash);
    return route.fulfill({body,contentType:path.endsWith('.html')?'text/html':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'image/png'});
   });
   const seed=async actor=>{f.setActor(actor);await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(actor)})};
   await seed(ids.a);
   const go=path=>page.goto(origin+'/'+path),button=name=>page.getByRole('button',{name,exact:true});
   const active=()=>page.waitForFunction(()=>window.StaffWorkspace?.active());
   const done=async()=>{if(errors.length)console.log(JSON.stringify({securityDiagnostic:label,url:page.url(),errors,requests}));eq(errors,[],label+' no suppressed runtime errors');eq([...f.unexpected,...f.people.unexpected,...f.modules.unexpected],[],label+' no unexpected/provider HTTP');eq([...f.writes,...f.people.writes,...f.modules.writes],[],label+' no mutation or sending');await context.close()};
   return{f,page,go,button,seed,active,done};
  }
  if(!process.env.TEST_SCENARIO||process.env.TEST_SCENARIO==='account'){
   const {f,page,go,button,seed,active,done}=await setup();
   await go('staff-home.html?context=church&org='+ids.o);await active();
   eq(await page.getByRole('link',{name:/^Open (Forms|Church Events|Dream Team & Manual Follow-up)$/}).count(),3,label+' real composed home discovers all independently allowed modules');
   await page.getByRole('link',{name:'Open People & Follow-up',exact:true}).click();await button('Review Person & follow-up').waitFor();
   await button('Review Person & follow-up').click();await page.getByRole('heading',{name:'Follow-up tasks',exact:true}).waitFor();
   eq(await page.getByRole('button',{name:'Save due date',exact:true}).count(),0,label+' read-only People cannot edit due dates');
   await page.getByRole('combobox',{name:'Ministry context',exact:true}).selectOption('outreach');await active();
   await page.getByRole('link',{name:'Open Registration & Check-In',exact:true}).click();await button('Open household').waitFor();
   await page.getByLabel('Name, phone, email or reference',{exact:true}).fill('PRIVATE ACCOUNT A SEARCH');await button('Search').click();await button('Open household').waitFor();
   // Actual SDK A→B event, then a fresh B document and actual SDK B→A event.
   f.setActor(ids.b);await page.evaluate(s=>ChampionLifeAuth.client.auth.setSession({access_token:s.access_token,refresh_token:s.refresh_token}),session(ids.b));await page.waitForURL('**/discipleship-login.html?next=*');
   eq((await page.locator('body').innerText()).includes('PRIVATE ACCOUNT A SEARCH'),false,label+' account replacement clears old search/document');
   await go('staff-home.html?context=outreach&campaign='+ids.c);await active();
   eq(await page.locator('a[href*="staff-people.html"]').count(),0,label+' B campaign-only permission creates no People route');
   eq(await page.locator('a[href*="staff-forms.html"],a[href*="staff-events.html"],a[href*="staff-dream-team-manual.html"]').count(),0,label+' B campaign scope grants no standalone module route');
   await page.getByRole('link',{name:'Open Registration & Check-In',exact:true}).click();await button('Open household').waitFor();
   eq(await page.getByLabel('Name, phone, email or reference',{exact:true}).inputValue(),'',label+' B sees no prior A search');
   f.setActor(ids.a);await page.evaluate(s=>ChampionLifeAuth.client.auth.setSession({access_token:s.access_token,refresh_token:s.refresh_token}),session(ids.a));await page.waitForURL('**/discipleship-login.html?next=*');
   await go('staff-home.html?context=church&org='+ids.o);await active();
   eq(await page.getByRole('link',{name:'Open People & Follow-up',exact:true}).count(),1,label+' A returns through fresh current discovery');
   await seed(ids.b);const before=f.calls.filter(c=>c.name==='people_workspace').length;await go('staff-people.html?org='+ids.o);await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();
   eq(f.calls.filter(c=>c.name==='people_workspace').length,before,label+' campaign-only direct People route never invokes private module');await done();
  }
  for(const m of moduleSpecs){
   if(process.env.TEST_SCENARIO&&process.env.TEST_SCENARIO!=='modules'||process.env.TEST_MODULE&&process.env.TEST_MODULE!==m.name)continue;
   const {f,page,go,button,seed,done}=await setup();
   await go(m.path+'?'+m.key+'='+ids.o);await page.getByText(m.marker,{exact:m.name==='Events'}).first().waitFor().catch(async error=>{console.log(JSON.stringify({failedModule:m.name,calls:f.calls,unexpected:f.unexpected,body:await page.locator('body').innerText()}));throw error});
   eq(await page.evaluate(()=>!!window.StaffWorkspace),false,label+' '+m.name+' uses its actual standalone architecture');
   eq(await page.locator('script[src*="supabase-js"]').count(),1,label+' '+m.name+' has exactly one pinned SDK script');
   eq(await page.getByRole('link',{name:'Staff home',exact:true}).getAttribute('href'),'staff-home.html',label+' '+m.name+' return link carries no private subject or inferred scope');
   await page.getByRole('link',{name:'Staff home',exact:true}).click();await page.waitForFunction(()=>window.StaffWorkspace?.active());
   eq(await page.getByRole('link',{name:'Open People & Follow-up',exact:true}).count(),1,label+' '+m.name+' real return page verifies independent current authority');
   await go(m.path+'?'+m.key+'='+ids.o);await page.getByText(m.marker,{exact:m.name==='Events'}).first().waitFor();
   await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
   eq(await page.locator(m.mount).count(),0,label+' '+m.name+' pagehide removes private mount before cache snapshot');
   f.denyModule(m.rpc);await Promise.all([page.waitForNavigation({waitUntil:'load'}),page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})))]);
   await page.waitForLoadState('networkidle');await page.waitForFunction(()=>/unavailable|no event access|no longer available/i.test(document.body.textContent));
   eq((await page.locator('body').innerText()).includes(m.marker),false,label+' '+m.name+' persisted lifecycle cannot restore revoked private data');
   f.denyModule(null);await seed(ids.b);await go(m.path+'?'+m.key+'='+ids.o);await page.waitForLoadState('networkidle');await page.waitForFunction(()=>/unavailable|no event access|no longer available/i.test(document.body.textContent));
   eq((await page.locator('body').innerText()).includes(m.marker),false,label+' '+m.name+' denied account sees no former result');
   await seed(ids.a);const before=f.calls.filter(c=>c.name===m.rpc&&c.action==='list').length;
   await go(m.path+'?'+m.key+'='+ids.o+'&'+m.key+'='+ids.otherOrg);await page.waitForLoadState('networkidle');await page.waitForFunction(()=>/unavailable|no event access|no longer available/i.test(document.body.textContent));
   eq(f.calls.filter(c=>c.name===m.rpc&&c.action==='list').length,before,label+' '+m.name+' duplicate tenant selector never falls back');
   if(m.name==='Forms'){
    for(const value of ['', 'malformed', '99999999-9999-4999-8999-999999999999']){
     const prior=f.calls.filter(c=>c.name===m.rpc&&c.action==='list').length;
     await go(m.path+'?organization='+value);await page.waitForLoadState('networkidle');
     eq(f.calls.filter(c=>c.name===m.rpc&&c.action==='list').length,prior,label+' Forms empty/malformed/ungranted scope issues no list: '+value);
    }
    await go(m.path);await page.getByText('Private draft A',{exact:false}).waitFor();eq(await page.getByLabel('Organization',{exact:true}).inputValue(),ids.o,label+' Forms absent hint retains current authorized default');
    await go(m.path+'?organization='+ids.otherOrg);await page.getByText('Private draft B',{exact:false}).waitFor();eq(await page.getByLabel('Organization',{exact:true}).inputValue(),ids.otherOrg,label+' Forms valid second-organization hint remains usable');
   }
   await done();
  }
  for(const kind of ['expired','revoked','late']){
   if(process.env.TEST_SCENARIO&&process.env.TEST_SCENARIO!=='retirement')continue;
   const {f,page,go,button,active,done}=await setup();await go('staff-people.html?org='+ids.o);await button('Review Person & follow-up').waitFor();
   await button('Review Person & follow-up').evaluate(b=>window.retiredReview=b.onclick);
   if(kind==='late'){f.people.hold('people_workspace:detail');await button('Review Person & follow-up').click();for(let i=0;i<500&&!f.people.held();i++)await page.waitForTimeout(10);assert(f.people.held(),'captured Person detail held')}
   if(kind==='expired')f.expire();else f.revoke();await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.waitForFunction(()=>!window.StaffWorkspace?.active());
   if(kind==='late'){f.people.release();await page.waitForTimeout(80)}
   eq((await page.locator('body').innerText()).includes('Taylor Person'),false,label+' '+kind+' current access clears private data');
   const before=f.calls.length;await page.evaluate(()=>{retiredReview();retiredReview()});await page.waitForTimeout(40);
   eq(f.calls.length,before,label+' '+kind+' duplicate retired controls make no requests');await done();
  }
  if(!process.env.TEST_SCENARIO||process.env.TEST_SCENARIO==='communications'){
   const {f,page,go,active,done}=await setup();await go('staff-communication-activity.html?campaign='+ids.c);await active();await page.getByText('No communication activity matches this scope.',{exact:true}).waitFor();
   eq(await page.getByRole('button',{name:/send|preview|retry|confirm/i}).count(),0,label+' delivery-only Communications has no sending controls');
   eq(f.calls.some(c=>c.name==='communications_workspace'&&['preview','confirm','send','retry'].includes(c.action)),false,label+' no consent decision or provider attempt inferred from context');await done();
  }
 }}finally{await browser.close()}
}
assert.equal(sha(readFileSync(resolve(root,'tools/site-build/public-files.json'))),sha(manifest),'manifest stable during run');
for(const [path,hash]of served)assert.equal(sha(readFileSync(resolve(root,path))),hash,'served source stable '+path);
const result={status:'PASS',checks,root,sourceHashes:Object.fromEntries(served),manifest:sha(manifest),sdk:sha(sdk),runtimeOverlays:0,hostedAuth:false,rlsProof:false,bfcache:'synthetic lifecycle dispatch, not a claimed real browser cache restoration',originalLinuxFailure:'preserved; not fixed or reclassified'};
if(process.env.EVIDENCE_DIR){mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});writeFileSync(resolve(process.env.EVIDENCE_DIR,'journey-source.json'),JSON.stringify(result,null,2)+'\n')}
console.log(JSON.stringify(result));
