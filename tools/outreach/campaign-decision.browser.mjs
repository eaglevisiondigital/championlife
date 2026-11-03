// Real Chromium/WebKit with exact PR80 SQL in disposable PostgreSQL. Fictional Auth only.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const ROOT=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const {createCampaignFoundationTestHost}=await import(process.env.CAMPAIGN_TEST_HOST?pathToFileURL(process.env.CAMPAIGN_TEST_HOST).href:'./campaign-foundation-test-host.mjs');
const host=await createCampaignFoundationTestHost(),origin='https://campaign-review.invalid',evidence=process.env.CAMPAIGN_EVIDENCE_DIR;
if(evidence)await mkdir(evidence,{recursive:true});
let seeded=false;let passes=0;const check=(value,label)=>{assert.ok(value,label);passes++;console.log('PASS '+label)};
const shell=(await readFile(path.join(ROOT,'staff-home.html'),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
const mutations=()=>host.requests.filter(x=>x.action==='followup_save').length;
try{
 for(const [engine,browserType] of [['chromium',chromium],['webkit',webkit]])for(const [size,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  await host.reset();const browser=await browserType.launch({headless:true});try{const context=await browser.newContext({viewport}),page=await context.newPage();let hold=null,release=null,dropped=false,deniedContext=false;
  const unexpected=[];
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!==origin){unexpected.push(url.origin);return route.abort()}
   if(url.pathname==='/rpc'){
    const {token,args}=route.request().postDataJSON();let response;
    if(hold?.before&&args.p_action===hold.action&&(!hold.record||args.p_payload.registration_id===hold.record)){hold=null;await new Promise(resolve=>release=resolve)}
    try{response={data:await host.rpc(token,args)}}catch(e){response={error:{code:e.code}}}
    if(hold&&args.p_action===hold.action&&(!hold.record||args.p_payload.registration_id===hold.record)){hold=null;await new Promise(resolve=>release=resolve)}
    if(dropped&&args.p_action==='followup_save'){dropped=false;return route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"NETWORK"}}'})}
    if(deniedContext&&args.p_action==='context')response={error:{code:'42501'}};
    return route.fulfill({contentType:'application/json',body:JSON.stringify(response)})
   }
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:shell});
   const relative=decodeURIComponent(url.pathname).slice(1);if(relative.includes('..'))return route.abort();
   try{const body=await readFile(path.join(ROOT,relative));return route.fulfill({contentType:relative.endsWith('.mjs')||relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':relative.endsWith('.svg')?'image/svg+xml':'image/png',body})}catch{return route.abort()}
  });
  await page.goto(origin);await page.evaluate(async({users,org,campaign,otherCampaign})=>{
   const {mountCampaignDecisionView}=await import('/tools/outreach/campaign-decision-view.mjs');
   window.fx={users,who:'worker',listeners:[],allowed:[{organizationId:org,campaignId:campaign},{organizationId:org,campaignId:otherCampaign}],active:true};
   const current=()=>fx.users[fx.who];
   window.sharedAuth={getSession:async()=>({user:{id:current().id},access_token:current().token,expires_at:Math.floor(Date.now()/1000)+3600}),client:{supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',rest:{url:'https://abcdefghijklmnopqrst.supabase.co/rest/v1'},auth:{url:'https://abcdefghijklmnopqrst.supabase.co/auth/v1',getUser:async()=>({data:{user:{id:current().id,email_confirmed_at:fx.who==='unverified'?null:'2026-01-01'}}}),onAuthStateChange:fn=>{fx.listeners.push(fn);return{data:{subscription:{unsubscribe(){fx.listeners=fx.listeners.filter(x=>x!==fn)}}}}}},rpc:async(name,args)=>{if(name!=='campaign_decision_foundation')throw Error('Unexpected RPC');return fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:current().token,args})}).then(r=>r.json())}}};
   document.querySelector('#staff-main').hidden=false;document.querySelector('#staff-access-message').textContent='Fictional local acceptance';
   window.view=mountCampaignDecisionView({root:document.querySelector('#staff-home-links'),auth:sharedAuth,workspace:{active:()=>fx.active},eventTarget:window,getAllowedCampaigns:()=>fx.allowed,projectRef:'abcdefghijklmnopqrst'});window.org=org;window.campaign=campaign;
  },{users:host.users,org:host.orgId,campaign:host.campaignId,otherCampaign:host.otherCampaignId});
  const open=async(record=host.records.a)=>page.evaluate(async r=>{view.select(org,campaign);await view.detail(r)},record);
  const state=()=>page.evaluate(()=>view.snapshot());
  const staleAttempt=()=>page.evaluate(()=>{window.oldForm?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});
  const retain=()=>page.evaluate(()=>window.oldForm=document.querySelector('#staff-home-links form'));
  const submit=async status=>{await page.selectOption('select[name=status]',status);await page.locator('button[type=submit]').click();await page.waitForFunction(()=>view.snapshot()?.state==='detail'||view.snapshot()?.state==='unavailable')};
  const label=engine+'/'+size+' ';
  await page.evaluate(async()=>{view.select(org,campaign);await view.list()});check((await state()).rows.length===(seeded?50:2)&&!(await state()).rows.some(r=>r.registrationId===host.records.c),label+'assigned list excludes others');check(!(await page.textContent('body')).includes('PRIVATE-'),label+'no contact/prayer projection');
  await open();check(await page.locator('form').count()===1,label+'authorized status controls');check(!JSON.stringify(await state()).includes(host.users.worker.token),label+'no bearer in snapshot');
  const initial=mutations();await submit('in_progress');check(mutations()===initial+1&&(await state()).record.status==='in_progress',label+'actual PostgreSQL save');
  await retain();await host.revoke(host.users.worker.id);await page.evaluate(()=>view.list().catch(()=>{}));check((await state()).state==='unavailable'&&await page.locator('form').count()===0,label+'database revocation clears');const afterDenied=mutations();await staleAttempt();await page.waitForTimeout(30);check(mutations()===afterDenied,label+'retained denied form zero mutations');
  await host.reset();await open();await retain();hold={action:'detail',record:host.records.a};await page.evaluate(r=>{window.pending=view.detail(r).catch(e=>e.code)},host.records.a);await page.waitForFunction(()=>view.snapshot().state==='loading');while(!release)await new Promise(r=>setTimeout(r,10));await page.evaluate(async r=>{await view.list();await view.detail(r)},host.records.b);release();release=null;await page.evaluate(()=>window.pending);check((await state()).record.registrationId===host.records.b,label+'A-list-B delayed A cannot restore');const beforeStale=mutations();await staleAttempt();await page.waitForTimeout(30);check(mutations()===beforeStale,label+'old A save cannot target A under B');
  await open();await retain();await page.evaluate(()=>{fx.who='other';fx.listeners.forEach(fn=>fn('SIGNED_IN'))});check((await state()).state==='unavailable',label+'account switch immediate clear');await staleAttempt();await page.waitForTimeout(30);check(mutations()===beforeStale,label+'account switch detached form blocked');await open(host.records.c);check((await state()).record.registrationId===host.records.c,label+'new independently assigned account');
  await page.evaluate(()=>{fx.who='worker';fx.listeners.forEach(fn=>fn('SIGNED_IN'))});await open();await retain();await page.evaluate(()=>window.dispatchEvent(new PopStateEvent('popstate')));await staleAttempt();check((await state()).state==='unavailable',label+'back restoration clears');
  await open();await retain();await page.evaluate(()=>fx.listeners.forEach(fn=>fn('SIGNED_OUT')));await staleAttempt();check((await state()).state==='unavailable',label+'logout clears');
  await open();await retain();await host.retire(host.users.worker.id);await page.evaluate(()=>view.list().catch(()=>{}));check((await state()).state==='unavailable',label+'native session retirement denial');await host.reset();
  await open();const beforeUnknown=mutations();dropped=true;await submit('needs_contact');check((await state()).message.includes('uncertain'),label+'lost save response UNKNOWN');await staleAttempt();await page.waitForTimeout(30);check(mutations()===beforeUnknown+1,label+'UNKNOWN no duplicate mutation');await open();check((await state()).record.status==='needs_contact',label+'reauthorization observes actual committed state');
  await host.consent(host.records.a,false);await open();check(!(await state()).canSave&&await page.locator('form').count()===0,label+'consent loss disables edit');await host.reset();
  await open();await retain();await page.evaluate(other=>view.select(org,other),host.otherCampaignId);await staleAttempt();await page.evaluate(()=>view.list().catch(()=>{}));check((await state()).state==='unavailable',label+'other campaign denied');
  await page.evaluate(()=>{fx.who='unverified';fx.listeners.forEach(fn=>fn('SIGNED_IN'))});await open().catch(()=>{});check((await state()).state==='unavailable',label+'unverified account denied');
  await page.evaluate(()=>{fx.who='worker';fx.listeners.forEach(fn=>fn('SIGNED_IN'))});await open();
  hold={action:'detail',record:host.records.a,before:true};await page.evaluate(r=>{window.pending=view.detail(r).catch(e=>e.code)},host.records.a);while(!release)await new Promise(r=>setTimeout(r,10));await page.evaluate(r=>view.detail(r),host.records.b);await retain();await host.revoke(host.users.worker.id);release();release=null;await page.evaluate(()=>window.pending);check((await state()).state==='unavailable'&&await page.locator('form').count()===0,label+'obsolete navigation denial retires current same-scope record');const lateDenied=mutations();await staleAttempt();await page.waitForTimeout(30);check(mutations()===lateDenied,label+'late denial detached controls zero mutations');await host.reset();await open();
  hold={action:'detail',record:host.records.a,before:true};await page.evaluate(r=>{window.pending=view.detail(r).catch(e=>e.code)},host.records.a);while(!release)await new Promise(r=>setTimeout(r,10));await page.evaluate(()=>{fx.who='other';fx.listeners.forEach(fn=>fn('SIGNED_IN'))});await open(host.records.c);await host.revoke(host.users.worker.id);release();release=null;await page.evaluate(()=>window.pending);check((await state()).state==='detail'&&(await state()).record.registrationId===host.records.c,label+'old account denial cannot retire new account authority');await host.reset();await page.evaluate(()=>{fx.who='worker';fx.listeners.forEach(fn=>fn('SIGNED_IN'))});await open();
  const prior=mutations();await page.evaluate(()=>{const form=document.querySelector('form');form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});await page.waitForFunction(()=>view.snapshot()?.state==='detail'||view.snapshot()?.state==='unavailable');check(mutations()===prior+1,label+'double submission one mutation');
  if(!seeded){await host.seedAssigned(49);seeded=true}await page.evaluate(()=>view.list());check((await state()).rows.length===50,label+'first page fifty');await page.evaluate(()=>window.oldNext=[...document.querySelectorAll('button')].find(x=>x.textContent==='Next page'));await page.getByRole('button',{name:'Next page',exact:true}).click();await page.waitForFunction(()=>view.snapshot()?.state==='list'&&view.snapshot().page===1);check((await state()).rows.length===1,label+'last page remaining record');check(await page.getByRole('button',{name:'Next page',exact:true}).isDisabled(),label+'last page next disabled');await page.evaluate(()=>oldNext.click());await page.waitForTimeout(30);check((await state()).page===1,label+'detached pagination cannot navigate');await page.getByRole('button',{name:'Previous page',exact:true}).click();await page.waitForFunction(()=>view.snapshot()?.state==='list'&&view.snapshot().page===0);check((await state()).rows.length===50,label+'previous page works');
  await open();check(await page.locator('label').filter({hasText:'Follow-up status'}).count()===1,label+'accessible form label');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+'no horizontal overflow');check(await page.locator('.staff-propel-credit').getAttribute('href')==='https://kingdompropel.com/',label+'approved branding intact');check(unexpected.length===0,label+'no external network');
  if(evidence)await page.screenshot({path:path.join(evidence,engine+'-'+size+'.png'),fullPage:true});await page.evaluate(()=>view.close());await context.close();}finally{await browser.close()}
 }
 console.log(JSON.stringify({passed:passes,failed:0,nativeMutations:mutations(),auditRows:(await host.audit()).length}));
}finally{await host.close()}
