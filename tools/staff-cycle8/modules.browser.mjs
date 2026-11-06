// Full-page navigation through actual pinned HTML. Standalone modules are not shell-injected.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadSource} from './modules-source.mjs';
import {fixture,ids,session} from './modules-fixture.mjs';
import {knownUnload} from './modules-unload.mjs';
const {chromium,webkit}=await import('../backend-tests/node_modules/playwright/index.mjs');
const root=fileURLToPath(new URL('../../',import.meta.url)),sdk=readFileSync(process.env.SUPABASE_SDK_PATH);
assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const files={'staff-home.html':'homeHtml','staff-people.html':'peopleHtml','staff-forms.html':'formsHtml','staff-events.html':'eventsHtml','staff-dream-team-manual.html':'dreamHtml','assets/js/champion-life-auth.js':'auth','assets/js/staff-session.js':'sharedSession','assets/js/staff-workspace.js':'shell','assets/js/outreach-staff-common.js':'common','assets/js/outreach-people.js':'people','assets/js/forms-admin.js':'formsAdmin','assets/js/forms-context.js':'formsContext','assets/js/forms-model.js':'formsModel','assets/js/forms-renderer.js':'formsRenderer','assets/js/events-common.js':'eventsCommon','assets/js/staff-events.js':'events','assets/js/dream-team-manual.js':'dream','assets/css/outreach-campaigns.css':'campaignCss','assets/css/staff-portal.css':'portalCss','assets/css/staff-workspace.css':'workspaceCss','assets/css/forms.css':'formsCss','assets/css/events.css':'eventsCss'};
const sources=Object.fromEntries(Object.entries(files).map(([path,id])=>[path,loadSource(id)]));
console.log(JSON.stringify({sourceInventory:Object.fromEntries(Object.entries(sources).map(([path,text])=>[path,createHash('sha256').update(text).digest('hex')])),hostSource:process.env.HOST_SOURCE_ROOT?'explicit candidate shell only':'exact102',sharedSession:'exact97'}));
const modules=[{name:'Forms',link:'Open Forms',path:'staff-forms.html',query:'organization',rpc:'forms_workspace',mount:'#forms-app',marker:'Private draft '},{name:'Events',link:'Open Church Events',path:'staff-events.html',query:'org',rpc:'events_workspace',mount:'#staff-events-app',marker:'Private event '},{name:'Dream',link:'Open Dream Team & Manual Follow-up',path:'staff-dream-team-manual.html',query:'org',rpc:'dream_team_manual_followup',mount:'#dream-team-manual',marker:'Applicant '}];
let checks=0,unloadDiagnostics=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS',label)};
const origin='https://module-cycle8.invalid',backend='https://synthetic-modules.supabase.co',key='sb-synthetic-modules-auth-token',sdkUrl='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0';
for(const [engine,type]of Object.entries({chromium,webkit})){
 if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==engine)continue;
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of [390,1440])for(const m of modules){
  if(process.env.TEST_MODULE&&process.env.TEST_MODULE!==m.name)continue;
  const f=fixture(),context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[],failedRequests=[],navigations=[],lifecycle=[],requestLifecycle=[],served=new Set();let phase='setup';page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push({message:e.message,phase,stack:e.stack,time:Date.now()}));page.on('requestfailed',r=>failedRequests.push({url:r.url(),failure:r.failure(),phase,time:Date.now()}));page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations.push({url:frame.url(),phase,time:Date.now()})});
  // Observation only: no fetch wrapping, request aborting, application source edits,
  // extra Auth I/O, or changes to existing diagnostic acceptance/privacy assertions.
  await page.exposeBinding('__cycle8Lifecycle',({frame},event)=>{lifecycle.push({...event,frameUrl:frame.url(),observedPhase:phase,received:Date.now()})});
  await page.addInitScript(()=>{
   const record=event=>{void window.__cycle8Lifecycle({...event,url:location.href,time:Date.now()}).catch(()=>{})};
   for(const type of ['pagehide','pageshow','beforeunload','popstate','hashchange'])addEventListener(type,event=>{
    record({kind:'document-event',type,trusted:event.isTrusted,persisted:event.persisted??null});
    if(type==='pagehide')queueMicrotask(()=>record({kind:'after-pagehide-handlers',privateMounts:document.querySelectorAll('#forms-app,#staff-events-app,#dream-team-manual').length}));
   });
   const watch=setInterval(()=>{
    const client=window.ChampionLifeAuth?.client;if(!client?.auth?.onAuthStateChange)return;clearInterval(watch);
    client.auth.onAuthStateChange((event,session)=>{record({kind:'actual-sdk-auth-event',event,principal:session?.user?.id||null})});
   },5);
   addEventListener('pagehide',()=>clearInterval(watch));
  });
  let requestSequence=0;const requestIds=new WeakMap();
  const observeRequest=(kind,request,extra={})=>{
   if(new URL(request.url()).origin!==backend)return;
   if(!requestIds.has(request))requestIds.set(request,++requestSequence);
   let frameUrl;try{frameUrl=request.frame().url()}catch{frameUrl='detached'}
   requestLifecycle.push({kind,id:requestIds.get(request),url:request.url(),method:request.method(),frameUrl,phase,time:Date.now(),...extra});
  };
  page.on('request',r=>observeRequest('request',r));page.on('requestfinished',r=>observeRequest('requestfinished',r));page.on('requestfailed',r=>observeRequest('requestfailed',r,{failure:r.failure()}));
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(req.url()===sdkUrl)return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
   if(u.origin===backend)return f.backend(route);
   if(u.origin!==origin||req.method()!=='GET'){f.unexpected.push(req.method()+' '+req.url());return route.abort()}
   if(u.pathname==='/seed'||u.pathname==='/discipleship-login.html')return route.fulfill({body:'<!doctype html><h1>Fictional sign in</h1>',contentType:'text/html'});
   if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-no-authority'}),contentType:'text/javascript'});
   const path=u.pathname.slice(1);if(sources[path]){served.add(path);return route.fulfill({body:sources[path],contentType:path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript'})}
   if(['assets/images/logo-gold.png','assets/images/propel-logo-header-transparent.png'].includes(path))return route.fulfill({body:readFileSync(root+path),contentType:'image/png'});
   f.unexpected.push(path);return route.fulfill({status:404,body:''});
  });
  const label=engine+' '+width+' '+m.name,b=name=>page.getByRole('button',{name,exact:true}),choice=()=>m.name==='Events'?page.locator('select[name=organization]'):page.getByLabel('Organization',{exact:true}),marker=s=>page.getByText(m.marker+s,{exact:m.name!=='Forms'}),open=async org=>{await page.goto(origin+'/'+m.path+'?'+m.query+'='+org);await marker(org===ids.o?'A':'B').waitFor()},waitHold=async()=>{for(let i=0;i<500&&!f.held();i++)await page.waitForTimeout(10);assert(f.held(),'response held')};
  await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(ids.a)});
  await page.goto(origin+'/staff-home.html?context=church&org='+ids.o);await page.getByRole('link',{name:m.link,exact:true}).waitFor();
  eq(await page.getByRole('link',{name:m.link,exact:true}).getAttribute('href'),m.path+'?'+m.query+'='+ids.o,label+' real shell route preserves requested organization');
  await page.getByRole('link',{name:m.link,exact:true}).click();await marker('A').waitFor();
  eq(await page.evaluate(()=>!!window.StaffWorkspace),false,label+' module remains standalone; no injected shell');
  eq(await choice().inputValue(),ids.o,label+' module independently selects authorized organization');
  eq(await page.locator('body').evaluate(e=>e.hasAttribute('data-staff-workspace')),false,label+' original module HTML preserved');
  if(m.name==='Dream'){
   eq(await b('Review application').count(),1,label+' unverified relationship has no review control');await b('Review application').click();await page.getByRole('heading',{name:'Restricted application review',exact:true}).waitFor();
   eq(f.calls.filter(c=>c.name===m.rpc&&c.action==='detail').at(-1).p_data,f.binding,label+' exact application Person/account revisions remain bound');
   eq(await page.getByRole('heading',{name:'Existing manual task A',exact:true}).count(),1,label+' existing canonical task displayed read-only');
   await page.getByText('Task history',{exact:true}).click();eq(await page.getByText(/existing_task_reviewed/).count(),1,label+' existing task history preserved');
   eq(await b('Create manual next-step task').count()+await b('Save next-step task').count(),0,label+' no task issuance under read-only authority');
   eq(await page.locator('a[href*="person="]').count(),0,label+' absent Person deep link reported without invention');
   await b('Back to applications').click();await marker('A').waitFor();
  }else if(m.name==='Events'){
   await b('Private event A').click();await page.getByRole('heading',{name:'Private event A',exact:true}).waitFor();
   eq(await b('Edit entire series').count(),0,label+' event detail remains read-only');await page.getByText('Event history',{exact:true}).click();eq(await page.getByText(/existing_review/).count(),1,label+' event history preserved');await b('Close').click();await marker('A').waitFor();
  }else{
   eq(await b('Create form').count(),0,label+' no private draft creation with read-only authority');
   eq(await page.getByRole('link',{name:'Preview',exact:true}).getAttribute('href'),'staff-form-builder.html?organization='+ids.o+'&form='+ids.form+'&preview=true',label+' preview link binds form and organization');
   eq(await page.getByRole('link',{name:/publish|Submissions/i}).count(),0,label+' publication and collection remain absent');
  }
  await choice().selectOption(ids.other);await marker('B').waitFor();eq(await marker('A').count(),0,label+' organization replacement removes old module data');
  f.hold(m.rpc+':list');await choice().selectOption(ids.o);await waitHold();await choice().selectOption(ids.other);await marker('B').waitFor();f.release();await page.waitForTimeout(120);
  eq(await marker('A').count(),0,label+' obsolete organization list cannot restore old data');eq(await choice().inputValue(),ids.other,label+' late list preserves current organization');
  f.deny(m.rpc+':list');await choice().selectOption(ids.o);await page.waitForFunction(selector=>/no longer available|access is unavailable/.test(document.querySelector(selector)?.textContent||''),m.mount);
  eq(await marker('A').count()+await marker('B').count(),0,label+' explicit denial clears private results');
  phase='account-replacement';await open(ids.other);f.setActor(ids.b);await page.evaluate(value=>ChampionLifeAuth.client.auth.setSession({access_token:value.access_token,refresh_token:value.refresh_token}),session(ids.b));await page.waitForURL('**/discipleship-login.html?next=*');
  eq(new URL(page.url()).searchParams.get('next'),'/'+m.path+'?'+m.query+'='+ids.other,label+' shared97 session preserves module-specific return scope');eq(await page.locator(m.mount).count(),0,label+' account transition detaches old module');
  phase='denied-new-account';await page.goto(origin+'/'+m.path+'?'+m.query+'='+ids.other);await page.waitForFunction(selector=>/no longer available|no event access|Requested organization is unavailable/.test(document.querySelector(selector)?.textContent||''),m.mount);eq(await marker('B').count(),0,label+' new account lacks prior module authority');
  phase='reseed-original-account';f.setActor(ids.a);await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(ids.a)});
  phase='invalid-route';const before=f.calls.filter(c=>c.name===m.rpc&&c.action==='list').length;await page.goto(origin+'/'+m.path+'?'+m.query+'=unavailable');await page.waitForFunction(selector=>/no longer available|unavailable/.test(document.querySelector(selector)?.textContent||''),m.mount);
  eq(f.calls.filter(c=>c.name===m.rpc&&c.action==='list').length,before,label+' invalid route does not fall back to authorized tenant');
  if(m.name==='Dream'){
   await open(ids.o);await page.getByRole('link',{name:'People & Follow-up',exact:true}).click();await page.getByRole('heading',{name:'Canonical Person',exact:true}).waitFor();
   eq(f.calls.filter(c=>c.name==='people_workspace').every(c=>!('application_id'in(c.p_data||{}))),true,label+' generic People return does not invent application linkage');
  }
  eq(f.writes,[],label+' no mutation RPC attempted');eq(f.unexpected,[],label+' no provider or unknown HTTP requests');if(errors.length)console.log(JSON.stringify({browserDiagnostic:label,errors,failedRequests,navigations,lifecycle,requestLifecycle}));
  const unexpectedErrors=errors.filter(error=>{
   const known=knownUnload({engine,moduleName:m.name,error,failedRequests,navigations,backend,sdkUrl,otherOrg:ids.other});
   if(known)unloadDiagnostics++;return !known;
  });
  if(process.env.DIAGNOSTIC_OBSERVATIONS==='1'&&!errors.length)console.log(JSON.stringify({lifecycleDiagnostic:label,lifecycle,requestLifecycle,navigations}));
  eq(unexpectedErrors,[],label+' no unexpected runtime errors (correlated SDK unload diagnostics reported separately)');
  eq(served.has(m.path)&&served.has('assets/js/staff-session.js')&&served.has('staff-home.html'),true,label+' exact module HTML and shared session served');await context.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,unloadDiagnostics,diagnosticQualification:'ExactSDK WebKit account-replacement unload diagnostics are correlated and retained, not fixed',scope:'102 home full-page links to standalone98Forms/96Events/99Dream with97session',providerRequests:0,taskIssuance:0,genuineAuth:false}));
